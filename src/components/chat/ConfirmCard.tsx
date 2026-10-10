import { Check, ChevronDown, X } from 'lucide-react'
import { useId, useState } from 'react'
import { Dica } from '@/components/layout/Dica'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAdicionarItem, useAtualizarItem } from '@/hooks/useItens'
import { useResponderCartao } from '@/hooks/useListas'
import { useAtualizarCard } from '@/hooks/useMensagens'
import { calcularTotalCentavos, formatarQuantidade, parseDinheiro, parseQuantidade } from '@/lib/dinheiro'
import {
  botoesQuantidade,
  calcularCompra,
  cartoesDesconhecidos,
  dicaEconomia,
  linhaCalculo,
  linhaFaixas,
  nomeCartao,
  textoDica,
  type FaixaAplicada,
} from '@/lib/precos'
import { cn } from '@/lib/utils'
import type { DadosEtiqueta, Item, ItemPatch, Lista, ResultadoCompra } from '@/types/app'

type ConfirmCardProps = {
  mensagemId: string
  dados: DadosEtiqueta
  lista: Lista
  itens: Item[]
  somenteLeitura: boolean
}

const NOVO = 'novo'

function Resolvido({ resultado }: { resultado: ResultadoCompra }) {
  return (
    <div className="rounded-cartao bg-card p-4 shadow-cartao">
      <p className="flex items-center gap-2 text-[1.0625rem] font-medium">
        <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary text-white">
          <Check aria-hidden className="size-3" strokeWidth={3.5} />
        </span>
        <span className="truncate">{resultado.nome}</span>
      </p>
      <p className="dinheiro mt-1.5 whitespace-normal text-[0.9375rem] text-muted-foreground">
        {linhaCalculo(resultado.qtd, resultado.unidade, resultado.preco_unit_centavos, resultado.faixa_aplicada, resultado.cartao)}
      </p>
    </div>
  )
}

/**
 * Card de quantidade (CLAUDE.md, seção 7.2): a IA leu produto e faixas; o
 * usuário só diz quantos levou. A faixa aplicada e a conta saem de
 * src/lib/precos.ts. O preço só é pedido quando a leitura não é confiável ou
 * nenhuma faixa vale para a quantidade.
 */
export function ConfirmCard({ mensagemId, dados, lista, itens, somenteLeitura }: ConfirmCardProps) {
  const { extracao } = dados
  const { unidade, faixas } = extracao
  const idSelecao = useId()
  const adicionar = useAdicionarItem()
  const atualizar = useAtualizarItem()
  const atualizarCard = useAtualizarCard(lista.id)
  const responderCartao = useResponderCartao(lista.id)

  const faltando = itens.filter((i) => !i.comprado)
  const sugerido = faltando.find((i) => i.id === extracao.item_sugerido_id)
  const [destino, setDestino] = useState<string>(sugerido?.id ?? NOVO)
  const [qtdTexto, setQtdTexto] = useState('')
  const [precoTexto, setPrecoTexto] = useState('')
  const [pediuPrecoDiferente, setPediuPrecoDiferente] = useState(false)

  if (dados.estado === 'confirmado' && dados.resultado) return <Resolvido resultado={dados.resultado} />
  if (dados.estado !== 'aberto' || somenteLeitura) {
    return <p className="px-1 text-[0.9375rem] text-muted-foreground">Etiqueta de “{extracao.produto}” não adicionada.</p>
  }

  const qtd = parseQuantidade(qtdTexto, unidade)
  const leituraFraca = extracao.confianca === 'baixa'
  const compra = qtd === null || leituraFraca ? null : calcularCompra(faixas, qtd, lista.cartoes)
  const semFaixa = qtd !== null && !leituraFraca && compra === null
  const precoManual = pediuPrecoDiferente || leituraFraca || semFaixa
  const precoDigitado = parseDinheiro(precoTexto)
  const preco = precoManual ? precoDigitado : (compra?.faixa.preco_centavos ?? null)
  const faixaAplicada: FaixaAplicada | null = precoManual ? 'manual' : (compra?.faixa.tipo ?? null)
  const cartaoAplicado = precoManual ? null : (compra?.faixa.cartao ?? null)
  const dica = qtd !== null && !precoManual ? dicaEconomia(faixas, qtd, lista.cartoes) : null
  const [cartaoPendente] = cartoesDesconhecidos(faixas, lista.cartoes, lista.cartoes_recusados)
  const itemDestino = faltando.find((i) => i.id === destino)
  const pronto = qtd !== null && preco !== null && faixaAplicada !== null

  function confirmar() {
    if (qtd === null || preco === null || faixaAplicada === null) return
    const nome = itemDestino?.nome ?? extracao.produto
    const patch: ItemPatch = {
      comprado: true,
      unidade,
      faixas_preco: faixas,
      faixa_aplicada: faixaAplicada,
      preco_unit_centavos: preco,
      qtd_comprada: qtd,
      origem_preco: precoManual ? 'manual' : 'ia',
      foto_path: dados.foto_path,
    }
    if (itemDestino) atualizar.mutate({ id: itemDestino.id, lista_id: lista.id, patch })
    else adicionar.mutate({ id: crypto.randomUUID(), lista_id: lista.id, nome, ...patch })

    atualizarCard.mutate({
      mensagemId,
      dados: {
        ...dados,
        estado: 'confirmado',
        resultado: {
          nome,
          unidade,
          qtd,
          preco_unit_centavos: preco,
          faixa_aplicada: faixaAplicada,
          cartao: cartaoAplicado,
          total_centavos: calcularTotalCentavos(preco, qtd),
        },
      },
    })
  }

  return (
    <div className="rounded-cartao bg-card p-4 shadow-cartao">
      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 pt-1 text-[1.125rem] font-medium leading-snug">{extracao.produto}</h3>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Descartar esta etiqueta"
          className="-mr-2 -mt-2 text-muted-foreground"
          onClick={() => atualizarCard.mutate({ mensagemId, dados: { ...dados, estado: 'descartado' } })}
        >
          <X className="size-5" />
        </Button>
      </div>

      {faixas.length > 0 ? <p className="dinheiro mt-0.5 whitespace-normal text-[0.9375rem] text-muted-foreground">{linhaFaixas(faixas)}</p> : null}

      <div className="relative mt-3">
        <label htmlFor={idSelecao} className="sr-only">
          Item da lista
        </label>
        <select
          id={idSelecao}
          value={destino}
          onChange={(e) => setDestino(e.target.value)}
          className="h-11 w-full appearance-none truncate rounded-full border border-border bg-background pl-4 pr-10 text-[0.9375rem] font-medium"
        >
          <option value={NOVO}>Novo item na lista</option>
          {faltando.map((item) => (
            <option key={item.id} value={item.id}>
              Na lista: {item.nome}
            </option>
          ))}
        </select>
        <ChevronDown aria-hidden className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      </div>

      {extracao.observacao ? <Dica className="mt-3">{extracao.observacao}</Dica> : null}

      {cartaoPendente ? (
        <div className="mt-3 rounded-2xl bg-muted p-3">
          <p className="text-[0.9375rem] font-medium">Vocês têm o cartão {nomeCartao(cartaoPendente)}?</p>
          <div className="mt-2 flex gap-2">
            <Button variant="dark" size="sm" className="flex-1" onClick={() => responderCartao.mutate({ cartao: cartaoPendente, tem: true })}>
              Temos
            </Button>
            <Button variant="secondary" size="sm" className="flex-1" onClick={() => responderCartao.mutate({ cartao: cartaoPendente, tem: false })}>
              Não temos
            </Button>
          </div>
        </div>
      ) : null}

      <p className="mt-4 text-[0.9375rem] font-medium">{unidade === 'kg' ? 'Quanto pesou?' : 'Quantos?'}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {botoesQuantidade(faixas, unidade).map((n) => {
          const escolhido = qtd === n
          return (
            <button
              key={n}
              type="button"
              aria-pressed={escolhido}
              onClick={() => setQtdTexto(String(n).replace('.', ','))}
              className={cn(
                'dinheiro grid h-14 min-w-12 place-items-center rounded-full border px-3 text-[1.0625rem] font-medium transition-[background-color,border-color,color,box-shadow] duration-200 ease-saida',
                escolhido
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background text-foreground',
              )}
            >
              {formatarQuantidade(n, unidade)}
            </button>
          )
        })}
        <Input
          value={qtdTexto}
          onChange={(e) => setQtdTexto(e.target.value)}
          aria-label={unidade === 'kg' ? 'Peso em kg' : 'Outra quantidade'}
          placeholder={unidade === 'kg' ? '0,000 kg' : 'Outro'}
          inputMode={unidade === 'kg' ? 'decimal' : 'numeric'}
          className="dinheiro h-14 min-w-24 flex-1 rounded-full text-center"
        />
      </div>

      {precoManual ? (
        <div className="mt-3">
          <label htmlFor={`${idSelecao}-preco`} className="mb-1.5 block text-[0.9375rem] font-medium">
            {unidade === 'kg' ? 'Preço do kg (R$)' : 'Preço da unidade (R$)'}
          </label>
          <Input
            id={`${idSelecao}-preco`}
            value={precoTexto}
            onChange={(e) => setPrecoTexto(e.target.value)}
            inputMode="decimal"
            placeholder="0,00"
            className="dinheiro"
          />
          {semFaixa && !pediuPrecoDiferente ? (
            <p className="mt-1.5 text-sm text-muted-foreground">Para essa quantidade não li um preço que valha. Informe o que está na etiqueta.</p>
          ) : null}
        </div>
      ) : null}

      {pronto ? (
        <p aria-live="polite" className="dinheiro mt-4 whitespace-normal rounded-2xl bg-muted px-4 py-3 text-[1.0625rem] font-semibold">
          {linhaCalculo(qtd, unidade, preco, faixaAplicada, cartaoAplicado)}
        </p>
      ) : null}

      {dica ? <Dica className="mt-3">{textoDica(dica, unidade)}</Dica> : null}

      <Button className="mt-4 w-full" disabled={!pronto} onClick={confirmar}>
        Adicionar
      </Button>
      {precoManual ? null : (
        <button
          type="button"
          onClick={() => setPediuPrecoDiferente(true)}
          className="mx-auto mt-1 block min-h-11 px-3 text-sm text-muted-foreground underline underline-offset-4"
        >
          preço diferente?
        </button>
      )}
    </div>
  )
}
