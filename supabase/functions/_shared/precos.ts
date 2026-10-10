// Escolha da faixa de preço (CLAUDE.md, seção 6.4). A IA só lê as faixas da
// etiqueta; quem decide qual vale e faz a conta é este código.
//
// Este arquivo tem uma cópia idêntica em supabase/functions/_shared/
// (npm run sync:shared); por isso os imports levam a extensão .ts.

import {
  calcularTotalCentavos,
  formatarQuantidade,
  formatarReais,
  formatarValor,
  type Unidade,
} from './dinheiro.ts'

export type TipoFaixa = 'varejo' | 'atacado' | 'cartao'
export type FaixaAplicada = TipoFaixa | 'manual'

export type Faixa = {
  tipo: TipoFaixa
  preco_centavos: number
  qtd_minima: number
  cartao: string | null
}

export type Compra = { faixa: Faixa; total_centavos: number }

export type DicaEconomia = {
  qtd_sugerida: number
  total_atual_centavos: number
  total_sugerido_centavos: number
  /** Positivo quando levar mais sai mais barato; negativo quando custa um pouco mais. */
  economia_centavos: number
  a_mais: number
}

const ORDEM_TIPO: Record<TipoFaixa, number> = { varejo: 0, atacado: 1, cartao: 2 }

/** "Vuon Card" e "Cartão Crédiffato " viram "vuon card" e "cartao crediffato". */
export function normalizarCartao(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/\p{M}/gu, '') // tira os acentos decompostos pelo NFD
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function temCartao(faixa: Faixa, cartoes: Set<string>): boolean {
  return faixa.cartao === null || cartoes.has(normalizarCartao(faixa.cartao))
}

// Mínimo 1 quer dizer "sem condição de quantidade": 0,742 kg de um produto por
// peso continua valendo no varejo.
function atingeMinimo(faixa: Faixa, qtd: number): boolean {
  return faixa.qtd_minima <= 1 || qtd >= faixa.qtd_minima
}

/** Regra 1: quantidade atinge o mínimo e, se a faixa exige cartão, a lista tem esse cartão. */
export function faixasElegiveis(faixas: Faixa[], qtd: number, cartoesDaLista: string[]): Faixa[] {
  if (!(qtd > 0)) return []
  const cartoes = new Set(cartoesDaLista.map(normalizarCartao))
  return faixas.filter((f) => atingeMinimo(f, qtd) && temCartao(f, cartoes))
}

/**
 * Regra 2: a elegível de menor preço. O preço vale para todas as unidades
 * (regra 4), não só para as que passam do mínimo. Devolve null quando nenhuma
 * faixa serve (regra 3): aí o app pede o preço em vez de calcular.
 */
export function escolherFaixa(faixas: Faixa[], qtd: number, cartoesDaLista: string[]): Faixa | null {
  let melhor: Faixa | null = null
  for (const f of faixasElegiveis(faixas, qtd, cartoesDaLista)) {
    if (
      melhor === null ||
      f.preco_centavos < melhor.preco_centavos ||
      // No empate fica a faixa mais simples de explicar: varejo, depois atacado, depois cartão.
      (f.preco_centavos === melhor.preco_centavos && ORDEM_TIPO[f.tipo] < ORDEM_TIPO[melhor.tipo])
    ) {
      melhor = f
    }
  }
  return melhor
}

export function calcularCompra(faixas: Faixa[], qtd: number, cartoesDaLista: string[]): Compra | null {
  const faixa = escolherFaixa(faixas, qtd, cartoesDaLista)
  if (!faixa) return null
  return { faixa, total_centavos: calcularTotalCentavos(faixa.preco_centavos, qtd) }
}

/** Regra 5: cartões da etiqueta sobre os quais a lista ainda não respondeu. */
export function cartoesDesconhecidos(faixas: Faixa[], cartoes: string[], recusados: string[]): string[] {
  const respondidos = new Set([...cartoes, ...recusados].map(normalizarCartao))
  const novos = new Set<string>()
  for (const f of faixas) {
    if (f.cartao === null) continue
    const nome = normalizarCartao(f.cartao)
    if (nome && !respondidos.has(nome)) novos.add(nome)
  }
  return [...novos]
}

/**
 * Dica de economia: se a quantidade está perto do próximo degrau (pelo menos
 * metade do mínimo) e levar o mínimo sai mais barato ou até 10% mais caro,
 * devolve a sugestão. O app só mostra; nunca altera a quantidade sozinho.
 */
export function dicaEconomia(faixas: Faixa[], qtd: number, cartoesDaLista: string[]): DicaEconomia | null {
  const atual = calcularCompra(faixas, qtd, cartoesDaLista)
  if (!atual) return null

  const cartoes = new Set(cartoesDaLista.map(normalizarCartao))
  const degraus = faixas.filter((f) => !atingeMinimo(f, qtd) && temCartao(f, cartoes)).map((f) => f.qtd_minima)
  if (degraus.length === 0) return null

  const proximo = Math.min(...degraus)
  if (qtd * 2 < proximo) return null

  const sugerido = calcularCompra(faixas, proximo, cartoesDaLista)
  if (!sugerido || sugerido.total_centavos * 10 > atual.total_centavos * 11) return null

  return {
    qtd_sugerida: proximo,
    total_atual_centavos: atual.total_centavos,
    total_sugerido_centavos: sugerido.total_centavos,
    economia_centavos: atual.total_centavos - sugerido.total_centavos,
    // Em milésimos para 0,742 kg não virar 0,25800000000000001.
    a_mais: Math.round((proximo - qtd) * 1000) / 1000,
  }
}

/** "Levando 6 você paga R$ 0,81 a menos e leva 1 a mais." */
export function textoDica(dica: DicaEconomia, unidade: Unidade): string {
  const levando = `Levando ${formatarQuantidade(dica.qtd_sugerida, unidade)} você paga`
  const leva = `e leva ${formatarQuantidade(dica.a_mais, unidade)} a mais.`
  if (dica.economia_centavos > 0) return `${levando} ${formatarReais(dica.economia_centavos)} a menos ${leva}`
  if (dica.economia_centavos === 0) return `${levando} o mesmo ${leva}`
  return `${levando} só ${formatarReais(-dica.economia_centavos)} a mais ${leva}`
}

/** "vuon card" -> "Vuon Card" */
export function nomeCartao(cartao: string): string {
  return cartao.replace(/(^|\s)\S/g, (letra) => letra.toUpperCase())
}

/** Como a faixa aparece ao lado do cálculo: "atacado", "cartão Crediffato". */
export function rotuloFaixa(tipo: FaixaAplicada, cartao?: string | null): string {
  if (tipo === 'cartao') return cartao ? `cartão ${nomeCartao(cartao)}` : 'cartão'
  if (tipo === 'manual') return 'preço informado'
  return tipo
}

/** Linha compacta do card: "Varejo 4,89 · 6+ 4,69 · Crediffato 4,50". */
export function linhaFaixas(faixas: Faixa[]): string {
  return [...faixas]
    .sort((a, b) => ORDEM_TIPO[a.tipo] - ORDEM_TIPO[b.tipo] || a.qtd_minima - b.qtd_minima)
    .map((f) => {
      const preco = formatarValor(f.preco_centavos)
      const minimo = f.qtd_minima > 1 ? `${f.qtd_minima}+ ` : ''
      if (f.tipo === 'varejo') return `Varejo ${minimo}${preco}`
      if (f.tipo === 'atacado') return `${minimo || 'Atacado '}${preco}`
      return `${f.cartao ? nomeCartao(f.cartao) : 'Cartão'} ${minimo}${preco}`
    })
    .join(' · ')
}

/** "6 × R$ 4,69 (atacado) = R$ 28,14" */
export function linhaCalculo(
  qtd: number,
  unidade: Unidade,
  precoCentavos: number,
  tipo: FaixaAplicada,
  cartao?: string | null,
): string {
  const total = calcularTotalCentavos(precoCentavos, qtd)
  return `${formatarQuantidade(qtd, unidade)} × ${formatarReais(precoCentavos)} (${rotuloFaixa(tipo, cartao)}) = ${formatarReais(total)}`
}

/** Botões de "Quantos?": 1, 2, 3, 6, 12 mais os mínimos de atacado da etiqueta. */
export function botoesQuantidade(faixas: Faixa[], unidade: Unidade): number[] {
  if (unidade === 'kg') return [0.5, 1, 2]
  const minimos = faixas.map((f) => f.qtd_minima).filter((n) => Number.isInteger(n) && n > 0)
  return [...new Set([1, 2, 3, 6, 12, ...minimos])].sort((a, b) => a - b).slice(0, 7)
}
