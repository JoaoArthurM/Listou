import { useQuery } from '@tanstack/react-query'
import { ChevronDown } from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Segmented } from '@/components/ui/segmented'
import { Sheet } from '@/components/ui/sheet'
import { useUsuario } from '@/hooks/sessao'
import { useAdicionarItens } from '@/hooks/useItens'
import { useListas } from '@/hooks/useListas'
import { buscarItens, chaves } from '@/lib/api'
import { avisar } from '@/lib/avisos'
import { formatarQuantidade, type Unidade } from '@/lib/dinheiro'
import { interpretarLista, semOsQueJaEstao } from '@/lib/importar'
import { normalizarCartao } from '@/lib/precos'
import type { Secao } from '@/lib/secoes'
import { plural } from '@/lib/utils'
import type { Item, Lista } from '@/types/app'

type ImportarSheetProps = { lista: Lista; itens: Item[]; aoFechar: () => void }

type Origem = 'texto' | 'lista'
type Candidato = { nome: string; qtd: number | null; unidade: Unidade; secao?: Secao | null }

const dataCurta = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' })
const MAX_NA_PREVIA = 60

/**
 * Traz itens de fora para a lista aberta: de um texto colado (WhatsApp, notas)
 * ou de outra lista da pessoa, inclusive uma compra já finalizada. O que já
 * está na lista esperando compra não entra de novo.
 */
export function ImportarSheet({ lista, itens, aoFechar }: ImportarSheetProps) {
  const usuario = useUsuario()
  const adicionar = useAdicionarItens()
  const { data: ativas = [] } = useListas('ativa')
  const { data: finalizadas = [] } = useListas('finalizada')
  const idTexto = useId()
  const idLista = useId()
  const [origem, setOrigem] = useState<Origem>('texto')
  const [texto, setTexto] = useState('')
  const [origemId, setOrigemId] = useState('')

  const outras = [...ativas, ...finalizadas].filter((l) => l.id !== lista.id)
  const { data: itensDaOrigem, isFetching } = useQuery({
    queryKey: chaves.itens(origemId),
    queryFn: () => buscarItens(origemId),
    enabled: origem === 'lista' && origemId !== '',
  })

  const lido = useMemo(() => interpretarLista(texto), [texto])

  // Da outra lista vêm nome, unidade, quantidade planejada e a seção escolhida à mão. Preço, não.
  const daLista = useMemo(() => {
    const vistos = new Set<string>()
    const candidatos: Candidato[] = []
    for (const item of itensDaOrigem ?? []) {
      const chave = normalizarCartao(item.nome)
      if (vistos.has(chave)) continue
      vistos.add(chave)
      candidatos.push({ nome: item.nome, qtd: item.qtd_planejada, unidade: item.unidade, secao: item.secao })
    }
    return candidatos
  }, [itensDaOrigem])

  const candidatos: Candidato[] = origem === 'texto' ? lido.itens : daLista
  const { entram, jaEstavam } = semOsQueJaEstao(
    candidatos,
    itens.filter((i) => !i.comprado).map((i) => i.nome),
  )

  const observacoes = [
    jaEstavam > 0 ? `${plural(jaEstavam, 'já está', 'já estão')} na lista` : null,
    origem === 'texto' && lido.repetidos > 0 ? `${plural(lido.repetidos, 'repetido', 'repetidos')} no texto` : null,
    origem === 'texto' && lido.cortados > 0 ? `${plural(lido.cortados, 'ficou', 'ficaram')} de fora pelo limite` : null,
  ].filter(Boolean)

  function importar() {
    if (entram.length === 0) return
    adicionar.mutate({
      lista_id: lista.id,
      itens: entram.map((item) => ({
        id: crypto.randomUUID(),
        lista_id: lista.id,
        nome: item.nome,
        unidade: item.unidade,
        qtd_planejada: item.qtd,
        secao: item.secao ?? null,
        adicionado_por: usuario.id,
      })),
    })
    avisar(`${plural(entram.length, 'item adicionado', 'itens adicionados')}.`, 'sucesso')
    aoFechar()
  }

  return (
    <Sheet open onOpenChange={(aberta) => !aberta && aoFechar()} title="Importar itens" description={`Para a lista “${lista.nome}”.`}>
      <div className="space-y-4">
        <Segmented
          label="De onde vêm os itens"
          value={origem}
          onChange={setOrigem}
          options={[
            { value: 'texto', label: 'Colar texto' },
            { value: 'lista', label: 'De outra lista' },
          ]}
        />

        {origem === 'texto' ? (
          <div>
            <label htmlFor={idTexto} className="mb-1.5 block text-[0.875rem] font-medium">
              Lista
            </label>
            <textarea
              id={idTexto}
              data-autofocus
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={6}
              placeholder={'arroz\n2 leite\n1,5 kg de carne'}
              className="block w-full resize-none rounded-campo border border-controle/70 bg-card px-4 py-3 leading-snug text-foreground transition-[border-color,box-shadow] duration-200 placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
            />
            <p className="mt-1.5 text-sm text-muted-foreground">
              Um item por linha, ou separados por vírgula. A quantidade na frente é reconhecida: “2 leite”, “1,5 kg de carne”.
            </p>
          </div>
        ) : outras.length === 0 ? (
          <p className="text-[0.875rem] leading-snug text-muted-foreground">Você ainda não tem outra lista para trazer itens.</p>
        ) : (
          <div>
            <label htmlFor={idLista} className="mb-1.5 block text-[0.875rem] font-medium">
              Lista de origem
            </label>
            <div className="relative">
              <select
                id={idLista}
                value={origemId}
                onChange={(e) => setOrigemId(e.target.value)}
                className="h-12 w-full appearance-none truncate rounded-campo border border-controle/70 bg-card pl-4 pr-10 text-foreground"
              >
                <option value="">Escolha uma lista</option>
                {outras.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.nome}
                    {l.status === 'finalizada' && l.finalizada_em ? `, finalizada em ${dataCurta.format(new Date(l.finalizada_em))}` : ''} ({plural(l.resumo.itens_total, 'item', 'itens')})
                  </option>
                ))}
              </select>
              <ChevronDown aria-hidden className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            </div>
            <p className="mt-1.5 text-sm text-muted-foreground">Vêm o nome, a unidade e a quantidade planejada de cada item. Preço não vem.</p>
          </div>
        )}

        {entram.length > 0 ? (
          <ul aria-label="Itens que vão entrar" className="max-h-52 overflow-y-auto overscroll-contain rounded-cartao bg-card px-4 shadow-cartao">
            {entram.slice(0, MAX_NA_PREVIA).map((item) => (
              <li key={item.nome} className="flex min-h-11 items-center justify-between gap-3 border-b border-border py-2 last:border-b-0">
                <span className="min-w-0 truncate">{item.nome}</span>
                {item.qtd === null ? null : (
                  <span className="dinheiro shrink-0 text-[0.875rem] text-muted-foreground">
                    {formatarQuantidade(item.qtd, item.unidade)}
                    {item.unidade === 'un' ? ' un' : ''}
                  </span>
                )}
              </li>
            ))}
            {entram.length > MAX_NA_PREVIA ? (
              <li className="flex min-h-11 items-center text-[0.875rem] text-muted-foreground">e mais {entram.length - MAX_NA_PREVIA}</li>
            ) : null}
          </ul>
        ) : null}

        {observacoes.length > 0 ? (
          <p role="status" className="text-sm text-muted-foreground">
            {observacoes.join(' · ')}.
          </p>
        ) : null}
        {origem === 'lista' && origemId !== '' && !isFetching && candidatos.length === 0 ? (
          <p role="status" className="text-sm text-muted-foreground">
            Essa lista não tem itens.
          </p>
        ) : null}

        <Button className="w-full" disabled={entram.length === 0} onClick={importar}>
          {entram.length === 0 ? 'Adicionar itens' : `Adicionar ${plural(entram.length, 'item', 'itens')}`}
        </Button>
      </div>
    </Sheet>
  )
}
