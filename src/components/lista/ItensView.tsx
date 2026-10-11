import {
  Bath,
  Beef,
  Carrot,
  ChevronDown,
  Croissant,
  CupSoda,
  ListPlus,
  Milk,
  Package,
  PawPrint,
  Plus,
  ShoppingCart,
  Snowflake,
  SprayCan,
  Wheat,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Dica } from '@/components/layout/Dica'
import { Button } from '@/components/ui/button'
import { useUsuario } from '@/hooks/sessao'
import { useAdicionarItem, useAtualizarItem, useRemoverItem } from '@/hooks/useItens'
import { avisar } from '@/lib/avisos'
import { useMembros } from '@/hooks/useListas'
import { formatarReais } from '@/lib/dinheiro'
import { precoAnteriorDe, preverFaltantes, type PrecoAnterior } from '@/lib/previsao'
import { agruparPorSecao, NOME_DA_SECAO, type Secao } from '@/lib/secoes'
import { cn, plural, primeiroNome } from '@/lib/utils'
import type { Item, Lista, Resumo } from '@/types/app'
import { ImportarSheet } from './ImportarSheet'
import { ItemRow } from './ItemRow'
import { ItemSheet } from './ItemSheet'

type ItensViewProps = {
  lista: Lista
  itens: Item[]
  resumo: Resumo
  /** Quanto cada item custou na compra anterior (src/lib/previsao.ts). */
  precos: Map<string, PrecoAnterior>
  carregando: boolean
  somenteLeitura: boolean
}

const ICONE_DA_SECAO: Record<Secao, LucideIcon> = {
  hortifruti: Carrot,
  padaria: Croissant,
  acougue: Beef,
  frios: Milk,
  mercearia: Wheat,
  bebidas: CupSoda,
  congelados: Snowflake,
  limpeza: SprayCan,
  higiene: Bath,
  pet: PawPrint,
  outros: Package,
}

const dataCurta = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long' })

type GrupoProps = { titulo: string; icone: LucideIcon; contagem: number; children: ReactNode }

/** Grupo recolhível do checklist, como as categorias da referência. */
function Grupo({ titulo, icone: Icone, contagem, children }: GrupoProps) {
  const [aberto, setAberto] = useState(true)
  return (
    <section className="rounded-cartao bg-card shadow-cartao">
      <h2>
        <button
          type="button"
          aria-expanded={aberto}
          onClick={() => setAberto((a) => !a)}
          className="flex min-h-14 w-full items-center gap-3 rounded-cartao pl-3.5 pr-4 text-left text-verde"
        >
          <Icone aria-hidden className="size-6 shrink-0" strokeWidth={1.6} />
          <span className="flex-1 text-[1.125rem] font-medium tracking-[-0.015em]">{titulo}</span>
          <span className="dinheiro text-[0.9375rem] text-muted-foreground">{contagem}</span>
          <span className="grid size-6 place-items-center rounded-full border border-controle/70">
            <ChevronDown aria-hidden className={cn('size-3.5 transition-transform duration-300 ease-saida', !aberto && '-rotate-90')} />
          </span>
        </button>
      </h2>
      {aberto ? <ul className="pb-1 pl-0.5">{children}</ul> : null}
    </section>
  )
}

/**
 * Aba Itens: o que falta, agrupado pelas seções do mercado na ordem do caminho
 * da loja, e por último o que já está no carrinho. Adição rápida e importação
 * no rodapé da folha.
 */
export function ItensView({ lista, itens, resumo, precos, carregando, somenteLeitura }: ItensViewProps) {
  const adicionar = useAdicionarItem()
  const atualizar = useAtualizarItem()
  const remover = useRemoverItem()
  const usuario = useUsuario()
  const { data: membros = [] } = useMembros(lista.id)
  const [novo, setNovo] = useState('')
  const [editando, setEditando] = useState<string | null>(null)
  const [importando, setImportando] = useState(false)
  const [recemAdicionado, setRecemAdicionado] = useState<string | null>(null)
  const rolagem = useRef<HTMLDivElement>(null)

  const faltando = itens.filter((i) => !i.comprado)
  const noCarrinho = itens.filter((i) => i.comprado)
  const itemEmEdicao = itens.find((i) => i.id === editando) ?? null
  const estouro = lista.orcamento_centavos === null ? 0 : resumo.total_centavos - lista.orcamento_centavos
  const previsao = preverFaltantes(faltando, precos)

  // Quem pôs cada item só aparece quando a lista é dividida com alguém.
  const compartilhada = membros.length > 1
  const quemAdicionou = (item: Item): string | null => {
    if (!compartilhada || !item.adicionado_por) return null
    if (item.adicionado_por === usuario.id) return 'Você'
    return primeiroNome(membros.find((m) => m.perfil_id === item.adicionado_por)?.nome) || null
  }

  // "R$ 4,69" ou "R$ 5,99 o kg"; com a data, para a folha do item.
  const ultimoPreco = (item: Item, comData = false): string | null => {
    const anterior = precoAnteriorDe(precos, item.nome)
    if (!anterior) return null
    const preco = `${formatarReais(anterior.preco_centavos)}${anterior.unidade === 'kg' ? ' o kg' : ''}`
    return comData && anterior.quando ? `${preco}, em ${dataCurta.format(new Date(anterior.quando))}` : preco
  }

  useEffect(() => {
    if (!recemAdicionado) return
    rolagem.current?.querySelector(`[data-item="${recemAdicionado}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [recemAdicionado, itens.length])

  function adicionarItem(evento: FormEvent) {
    evento.preventDefault()
    const nome = novo.trim()
    if (!nome) return
    const id = crypto.randomUUID()
    adicionar.mutate({ id, lista_id: lista.id, nome, adicionado_por: usuario.id })
    setRecemAdicionado(id)
    setNovo('')
  }

  function alternar(item: Item) {
    // Desmarcar apaga o preço lido; marcar aqui é manual, sem preço (o preço vem pela foto ou pela edição).
    atualizar.mutate({ id: item.id, lista_id: item.lista_id, patch: { comprado: !item.comprado } })
  }

  const linha = (item: Item) => (
    <ItemRow
      key={item.id}
      item={item}
      somenteLeitura={somenteLeitura}
      quemAdicionou={quemAdicionou(item)}
      ultimoPreco={ultimoPreco(item)}
      aoAlternar={alternar}
      aoAbrir={(i) => setEditando(i.id)}
      aoExcluir={(i) => {
        remover.mutate({ id: i.id, lista_id: i.lista_id })
        avisar(`“${i.nome}” removido.`)
      }}
    />
  )

  let aviso: ReactNode = null
  if (estouro > 0) aviso = <>O carrinho passou {formatarReais(estouro)} do orçamento.</>
  else if (!somenteLeitura && itens.length > 0 && faltando.length === 0)
    aviso = <>Tudo no carrinho. Quando passar no caixa, finalize a compra nas opções da lista.</>

  return (
    <>
      <div ref={rolagem} className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 pb-6 pt-1">
        {aviso ? <Dica>{aviso}</Dica> : null}

        {carregando ? (
          <div aria-busy className="h-48 animate-pulso rounded-cartao bg-muted" />
        ) : itens.length === 0 ? (
          <div className="px-2 pt-10">
            <p className="font-display text-[2.5rem] italic leading-none">Lista em branco</p>
            <p className="mt-3 max-w-[19rem] text-[1.0625rem] leading-snug text-muted-foreground">
              {somenteLeitura
                ? 'Esta compra foi finalizada sem itens.'
                : 'Escreva o primeiro item aqui embaixo, peça no chat (“adiciona leite e pão”) ou traga uma lista pronta.'}
            </p>
            {somenteLeitura ? null : (
              <Button variant="secondary" className="mt-5" onClick={() => setImportando(true)}>
                <ListPlus className="size-5" />
                Importar uma lista
              </Button>
            )}
          </div>
        ) : (
          <>
            {!somenteLeitura && previsao.comPreco > 0 ? (
              <p data-previsao className="px-2 text-[0.9375rem] leading-snug text-muted-foreground">
                Pelo preço da última compra, o que falta deve dar <span className="dinheiro font-medium text-foreground">{formatarReais(previsao.centavos)}</span>.
                {previsao.semPreco > 0
                  ? ` ${plural(previsao.semPreco, 'item', 'itens')} sem preço anterior ${previsao.semPreco === 1 ? 'ficou' : 'ficaram'} fora da conta.`
                  : null}
              </p>
            ) : null}
            {agruparPorSecao(faltando).map(({ secao, itens: daSecao }) => (
              <Grupo key={secao} titulo={NOME_DA_SECAO[secao]} icone={ICONE_DA_SECAO[secao]} contagem={daSecao.length}>
                {daSecao.map(linha)}
              </Grupo>
            ))}
            {noCarrinho.length > 0 ? (
              <Grupo titulo="No carrinho" icone={ShoppingCart} contagem={noCarrinho.length}>
                {noCarrinho.map(linha)}
              </Grupo>
            ) : null}
          </>
        )}
      </div>

      {somenteLeitura ? null : (
        <form onSubmit={adicionarItem} className="flex shrink-0 items-center gap-2 border-t border-border bg-background px-3 pb-3 pt-2.5">
          <Button variant="secondary" size="icon" aria-label="Importar itens" className="size-[3.25rem]" onClick={() => setImportando(true)}>
            <ListPlus className="size-[1.375rem]" />
          </Button>
          <div className="flex h-[3.25rem] min-w-0 flex-1 items-center rounded-full border border-controle/70 bg-card pl-5 pr-1 transition-[border-color,box-shadow] duration-200 focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/20">
            <input
              value={novo}
              onChange={(e) => setNovo(e.target.value)}
              aria-label="Novo item"
              placeholder="Adicionar item"
              maxLength={80}
              autoComplete="off"
              enterKeyHint="done"
              className="h-full min-w-0 flex-1 bg-transparent placeholder:text-muted-foreground focus:outline-none"
            />
            <Button type="submit" size="icon" aria-label="Adicionar item" disabled={!novo.trim()}>
              <Plus className="size-5" strokeWidth={2.4} />
            </Button>
          </div>
        </form>
      )}

      {itemEmEdicao ? (
        <ItemSheet
          key={itemEmEdicao.id}
          item={itemEmEdicao}
          lista={lista}
          quemAdicionou={quemAdicionou(itemEmEdicao)}
          ultimoPreco={ultimoPreco(itemEmEdicao, true)}
          somenteLeitura={somenteLeitura}
          aoFechar={() => setEditando(null)}
        />
      ) : null}

      {importando ? <ImportarSheet lista={lista} itens={itens} aoFechar={() => setImportando(false)} /> : null}
    </>
  )
}
