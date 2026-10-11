// "Da última vez": o preço que cada item custou na compra mais recente, e a
// previsão do que ainda falta comprar com base nele. Tudo conta feita em
// código, com os preços que o próprio app gravou; nada vem da IA.

import { calcularTotalCentavos, type Unidade } from './dinheiro'
import { normalizarCartao } from './precos'

/** Um item comprado com preço, de qualquer lista da pessoa. */
export type CompraPassada = {
  nome: string
  unidade: Unidade
  preco_unit_centavos: number
  comprado_em: string | null
  lista_id: string
}

export type PrecoAnterior = { preco_centavos: number; unidade: Unidade; quando: string | null }

export type Previsao = {
  /** Soma estimada do que falta, só com os itens de preço conhecido. */
  centavos: number
  comPreco: number
  /** Itens que faltam e não entram na soma: nunca comprados, ou por peso sem quantidade planejada. */
  semPreco: number
}

/**
 * Preço mais recente de cada nome. As compras da própria lista aberta ficam de
 * fora: "da última vez" é de outra ida ao mercado.
 */
export function precosAnteriores(compras: CompraPassada[], listaAtualId: string): Map<string, PrecoAnterior> {
  const ordenadas = [...compras].sort((a, b) => (b.comprado_em ?? '').localeCompare(a.comprado_em ?? ''))
  const precos = new Map<string, PrecoAnterior>()
  for (const compra of ordenadas) {
    if (compra.lista_id === listaAtualId) continue
    const chave = normalizarCartao(compra.nome)
    if (!precos.has(chave)) {
      precos.set(chave, { preco_centavos: compra.preco_unit_centavos, unidade: compra.unidade, quando: compra.comprado_em })
    }
  }
  return precos
}

export function precoAnteriorDe(precos: Map<string, PrecoAnterior>, nome: string): PrecoAnterior | null {
  return precos.get(normalizarCartao(nome)) ?? null
}

type ItemQueFalta = { nome: string; unidade: Unidade; qtd_planejada: number | null; comprado: boolean }

/**
 * Quanto deve dar o que falta. Entra o preço da última vez vezes a quantidade
 * planejada; sem quantidade planejada conta uma unidade. Item por peso sem
 * peso planejado fica de fora (não há como estimar), assim como item cuja
 * unidade mudou desde a última compra.
 */
export function preverFaltantes(itens: ItemQueFalta[], precos: Map<string, PrecoAnterior>): Previsao {
  const previsao: Previsao = { centavos: 0, comPreco: 0, semPreco: 0 }
  for (const item of itens) {
    if (item.comprado) continue
    const anterior = precoAnteriorDe(precos, item.nome)
    const qtd = item.qtd_planejada ?? (item.unidade === 'un' ? 1 : null)
    if (!anterior || anterior.unidade !== item.unidade || qtd === null) {
      previsao.semPreco += 1
      continue
    }
    previsao.centavos += calcularTotalCentavos(anterior.preco_centavos, qtd)
    previsao.comPreco += 1
  }
  return previsao
}
