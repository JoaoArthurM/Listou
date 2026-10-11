// Resumo da compra, mostrado na hora de finalizar: o que ficou sem preço, o
// que ficou sem comprar e quanto o atacado e o cartão economizaram em relação
// ao varejo. A economia sai das faixas que a etiqueta trazia, guardadas em
// cada item; é conta de código, não da IA.

import { calcularTotalCentavos, type Unidade } from './dinheiro'
import type { Faixa, FaixaAplicada } from './precos'

type ItemDoResumo = {
  nome: string
  unidade: Unidade
  comprado: boolean
  faixas_preco: Faixa[] | null
  faixa_aplicada: FaixaAplicada | null
  preco_unit_centavos: number | null
  qtd_comprada: number | null
  total_centavos: number | null
}

export type ResumoDaCompra = {
  total_centavos: number
  comprados: number
  /** No carrinho, mas fora do total. */
  semPreco: string[]
  /** Ficaram na lista sem comprar. */
  naoComprados: string[]
  economia: { atacado: number; cartao: number; total: number }
}

/** Quanto o item custaria no varejo menos o que custou. Zero quando não dá para saber. */
function economiaDoItem(item: ItemDoResumo): number {
  if (item.faixa_aplicada !== 'atacado' && item.faixa_aplicada !== 'cartao') return 0
  if (item.preco_unit_centavos === null || item.qtd_comprada === null) return 0
  const varejos = (item.faixas_preco ?? []).filter((f) => f.tipo === 'varejo').map((f) => f.preco_centavos)
  if (varejos.length === 0) return 0
  const noVarejo = calcularTotalCentavos(Math.min(...varejos), item.qtd_comprada)
  const pago = calcularTotalCentavos(item.preco_unit_centavos, item.qtd_comprada)
  return Math.max(0, noVarejo - pago)
}

export function resumirCompra(itens: ItemDoResumo[]): ResumoDaCompra {
  const resumo: ResumoDaCompra = {
    total_centavos: 0,
    comprados: 0,
    semPreco: [],
    naoComprados: [],
    economia: { atacado: 0, cartao: 0, total: 0 },
  }
  for (const item of itens) {
    if (!item.comprado) {
      resumo.naoComprados.push(item.nome)
      continue
    }
    resumo.comprados += 1
    if (item.total_centavos === null) resumo.semPreco.push(item.nome)
    else resumo.total_centavos += item.total_centavos

    const economia = economiaDoItem(item)
    if (item.faixa_aplicada === 'atacado') resumo.economia.atacado += economia
    else if (item.faixa_aplicada === 'cartao') resumo.economia.cartao += economia
  }
  resumo.economia.total = resumo.economia.atacado + resumo.economia.cartao
  return resumo
}
