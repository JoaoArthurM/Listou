import { ChevronDown, Trash2 } from 'lucide-react'
import { useId, useState, type FormEvent } from 'react'
import { FotoArmazenada } from '@/components/chat/Foto'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/input'
import { Segmented } from '@/components/ui/segmented'
import { Sheet } from '@/components/ui/sheet'
import { useAtualizarItem, useRemoverItem } from '@/hooks/useItens'
import { formatarQuantidade, formatarValor, parseDinheiro, parseQuantidade, type Unidade } from '@/lib/dinheiro'
import { mascararDinheiro } from '@/lib/mascara'
import { normalizarNome } from '@/lib/nomes'
import { escolherFaixa, linhaCalculo, linhaFaixas } from '@/lib/precos'
import { NOME_DA_SECAO, secaoPeloNome, SECOES, type Secao } from '@/lib/secoes'
import type { Item, ItemPatch, Lista } from '@/types/app'

type ItemSheetProps = {
  item: Item
  lista: Lista
  /** Nome de quem adicionou; só vem quando a lista é dividida com alguém. */
  quemAdicionou?: string | null
  /** "R$ 4,69, em 12 de outubro": quanto custou na compra anterior. */
  ultimoPreco?: string | null
  somenteLeitura?: boolean
  aoFechar: () => void
}

const textoQtd = (qtd: number | null, unidade: Unidade) =>
  qtd === null ? '' : formatarQuantidade(qtd, unidade).replace(' kg', '')

/** Edição rápida de um item: nome, unidade, quantidade e, se já está no carrinho, o preço. */
export function ItemSheet({ item, lista, quemAdicionou, ultimoPreco, somenteLeitura = false, aoFechar }: ItemSheetProps) {
  const atualizar = useAtualizarItem()
  const remover = useRemoverItem()

  const idSecao = useId()
  const [nome, setNome] = useState(item.nome)
  // '' = automática: o app decide pelo nome.
  const [secao, setSecao] = useState<Secao | ''>(item.secao ?? '')
  const [unidade, setUnidade] = useState<Unidade>(item.unidade)
  const [comprado, setComprado] = useState(item.comprado)
  const [planejada, setPlanejada] = useState(textoQtd(item.qtd_planejada, item.unidade))
  const [comprada, setComprada] = useState(textoQtd(item.qtd_comprada ?? item.qtd_planejada, item.unidade))
  // null = preço automático, pela faixa da etiqueta. Texto = o usuário digitou.
  const [precoDigitado, setPrecoDigitado] = useState<string | null>(
    item.faixa_aplicada === 'manual' && item.preco_unit_centavos !== null ? formatarValor(item.preco_unit_centavos) : null,
  )
  const [erro, setErro] = useState<string | null>(null)
  const [confirmarExclusao, setConfirmarExclusao] = useState(false)

  const faixas = item.faixas_preco ?? []
  const qtdComprada = parseQuantidade(comprada, unidade)
  // Mudou a quantidade de um item lido da etiqueta: a faixa é recalculada (seção 6.4).
  const faixaAuto = qtdComprada !== null && faixas.length > 0 ? escolherFaixa(faixas, qtdComprada, lista.cartoes) : null
  const precoAuto = faixaAuto?.preco_centavos ?? null
  const precoManual = precoDigitado === null ? null : parseDinheiro(precoDigitado)
  const preco = precoDigitado === null ? precoAuto : precoManual
  const tipoFaixa = precoDigitado === null ? (faixaAuto?.tipo ?? null) : 'manual'

  function salvar(evento: FormEvent) {
    evento.preventDefault()
    const nomeLimpo = normalizarNome(nome)
    if (!nomeLimpo) return setErro('Dê um nome ao item.')

    const qtdPlanejada = planejada.trim() === '' ? null : parseQuantidade(planejada, unidade)
    if (planejada.trim() !== '' && qtdPlanejada === null) {
      return setErro(unidade === 'un' ? 'A quantidade precisa ser um número inteiro.' : 'Confira o peso: use até 3 casas, como 0,750.')
    }

    const patch: ItemPatch = { nome: nomeLimpo, unidade, qtd_planejada: qtdPlanejada, comprado, secao: secao === '' ? null : secao }
    if (comprado) {
      const temPreco = precoDigitado !== null ? precoDigitado.trim() !== '' : precoAuto !== null
      if (comprada.trim() !== '' && qtdComprada === null) return setErro('Confira a quantidade comprada.')
      if (precoDigitado !== null && precoDigitado.trim() !== '' && precoManual === null) {
        return setErro('Confira o preço: use o formato 4,69.')
      }
      if (temPreco && qtdComprada === null) return setErro('Informe quantos você levou para calcular o total.')
      // Regra 3 da seção 6.4: sem faixa elegível não se calcula, pede-se o preço.
      if (precoDigitado === null && faixas.length > 0 && qtdComprada !== null && faixaAuto === null) {
        return setErro('Com essa quantidade nenhum preço da etiqueta vale. Informe o preço que você pagou.')
      }
      patch.qtd_comprada = qtdComprada
      patch.preco_unit_centavos = temPreco ? preco : null
      patch.faixa_aplicada = temPreco ? tipoFaixa : null
      patch.origem_preco = temPreco ? (tipoFaixa === 'manual' ? 'manual' : 'ia') : null
      patch.faixas_preco = item.faixas_preco
    }

    atualizar.mutate({ id: item.id, lista_id: item.lista_id, patch })
    aoFechar()
  }

  function excluir() {
    if (!confirmarExclusao) return setConfirmarExclusao(true)
    remover.mutate({ id: item.id, lista_id: item.lista_id })
    aoFechar()
  }

  const rotuloQtd = unidade === 'kg' ? 'Peso (kg)' : 'Quantidade'

  return (
    <Sheet
      open
      onOpenChange={(aberta) => !aberta && aoFechar()}
      title={somenteLeitura ? normalizarNome(item.nome) : 'Editar item'}
      description={quemAdicionou ? `${quemAdicionou} adicionou este item.` : undefined}
    >
      <form onSubmit={salvar} className="space-y-4" noValidate>
        <fieldset disabled={somenteLeitura} className="space-y-4">
          <Field label="Nome" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={80} autoComplete="off" />

          <div>
            <p className="mb-1.5 text-[0.875rem] font-medium">Vendido por</p>
            <Segmented
              label="Vendido por"
              value={unidade}
              onChange={setUnidade}
              options={[
                { value: 'un', label: 'Unidade' },
                { value: 'kg', label: 'Peso (kg)' },
              ]}
            />
          </div>

          <div>
            <label htmlFor={idSecao} className="mb-1.5 block text-[0.875rem] font-medium">
              Seção do mercado
            </label>
            <div className="relative">
              <select
                id={idSecao}
                value={secao}
                onChange={(e) => setSecao(e.target.value as Secao | '')}
                className="h-12 w-full appearance-none truncate rounded-campo border border-controle/70 bg-card pl-4 pr-10 text-foreground disabled:opacity-50"
              >
                <option value="">Automática: {NOME_DA_SECAO[secaoPeloNome(nome)]}</option>
                {SECOES.map((s) => (
                  <option key={s} value={s}>
                    {NOME_DA_SECAO[s]}
                  </option>
                ))}
              </select>
              <ChevronDown aria-hidden className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-[0.875rem] font-medium">Situação</p>
            <Segmented
              label="Situação"
              value={comprado ? 'carrinho' : 'faltando'}
              onChange={(valor) => setComprado(valor === 'carrinho')}
              options={[
                { value: 'faltando', label: 'Faltando' },
                { value: 'carrinho', label: 'No carrinho' },
              ]}
            />
          </div>

          {comprado ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label={unidade === 'kg' ? 'Peso levado (kg)' : 'Quantos levou'}
                  value={comprada}
                  onChange={(e) => setComprada(e.target.value)}
                  inputMode={unidade === 'kg' ? 'decimal' : 'numeric'}
                  className="dinheiro"
                />
                <Field
                  label={unidade === 'kg' ? 'Preço do kg (R$)' : 'Preço unitário (R$)'}
                  value={precoDigitado ?? (precoAuto === null ? '' : formatarValor(precoAuto))}
                  onChange={(e) => setPrecoDigitado(mascararDinheiro(e.target.value))}
                  inputMode="numeric"
                  placeholder="0,00"
                  className="dinheiro"
                />
              </div>
              {faixas.length > 0 ? (
                <p className="dinheiro whitespace-normal text-sm text-muted-foreground">
                  Etiqueta: {linhaFaixas(faixas)}
                  {precoDigitado !== null ? (
                    <>
                      {' · '}
                      <button type="button" className="text-primary-texto underline underline-offset-4" onClick={() => setPrecoDigitado(null)}>
                        usar o preço da etiqueta
                      </button>
                    </>
                  ) : null}
                </p>
              ) : null}
              {qtdComprada !== null && preco !== null && tipoFaixa ? (
                <p className="dinheiro rounded-2xl bg-muted px-4 py-3 text-[0.875rem] font-medium">
                  {linhaCalculo(qtdComprada, unidade, preco, tipoFaixa, faixaAuto?.cartao)}
                </p>
              ) : null}
            </>
          ) : (
            <Field
              label={`${rotuloQtd} planejada`}
              hint="Opcional"
              value={planejada}
              onChange={(e) => setPlanejada(e.target.value)}
              inputMode={unidade === 'kg' ? 'decimal' : 'numeric'}
              className="dinheiro"
            />
          )}
        </fieldset>

        {ultimoPreco ? (
          <p className="dinheiro whitespace-normal text-sm text-muted-foreground">Da última vez custou {ultimoPreco}.</p>
        ) : null}

        {item.foto_path ? (
          <div>
            <p className="mb-1.5 text-[0.875rem] font-medium">Etiqueta fotografada</p>
            <FotoArmazenada caminho={item.foto_path} className="size-24 rounded-2xl" />
          </div>
        ) : null}

        {erro ? (
          <p role="alert" className="text-sm text-destructive">
            {erro}
          </p>
        ) : null}

        {somenteLeitura ? null : (
          <div className="flex items-center gap-3 pt-1">
            <Button type="button" variant={confirmarExclusao ? 'destructive' : 'secondary'} size={confirmarExclusao ? 'default' : 'icon'} onClick={excluir} aria-label="Excluir item" className={confirmarExclusao ? 'px-5' : 'size-12'}>
              <Trash2 className="size-5" />
              {confirmarExclusao ? 'Excluir mesmo' : null}
            </Button>
            <Button type="submit" className="flex-1">
              Salvar
            </Button>
          </div>
        )}
      </form>
    </Sheet>
  )
}
