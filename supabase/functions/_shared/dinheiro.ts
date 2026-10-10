// Regra de ouro 2: dinheiro é sempre centavo inteiro. Float só aparece na hora
// de exibir. Toda conta do app passa por aqui, nunca pela IA.
//
// Este arquivo tem uma cópia idêntica em supabase/functions/_shared/
// (npm run sync:shared); por isso os imports levam a extensão .ts.

export type Unidade = 'un' | 'kg'

const MAX_CENTAVOS = 99_999_999 // R$ 999.999,99
const MAX_QUANTIDADE = 9999

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const valor = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const quantidade = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 })

/** 123456 -> "R$ 1.234,56" */
export function formatarReais(centavos: number): string {
  return moeda.format(centavos / 100)
}

/** 469 -> "4,69", sem o símbolo, para linhas compactas. */
export function formatarValor(centavos: number): string {
  return valor.format(centavos / 100)
}

/** 6 -> "6"; 0.742 em kg -> "0,742 kg" */
export function formatarQuantidade(qtd: number, unidade: Unidade): string {
  return unidade === 'kg' ? `${quantidade.format(qtd)} kg` : quantidade.format(qtd)
}

// "1.234" -> "1234"; null se os pontos não estiverem em grupos de milhar.
function semMilhar(parte: string): string | null {
  const grupos = parte.split('.')
  if (grupos.length === 1) return parte
  const [primeiro, ...resto] = grupos
  if (!primeiro || primeiro.length > 3 || resto.some((g) => g.length !== 3)) return null
  return grupos.join('')
}

/**
 * Lê um valor digitado e devolve centavos: "24,90", "24.90", "1.234,56", "R$ 5".
 * Devolve null quando não é um valor em reais (vazio, negativo, 3 casas decimais).
 */
export function parseDinheiro(texto: string): number | null {
  const limpo = texto.replace(/R\$/gi, '').replace(/\s/g, '')
  if (!/^\d[\d.,]*$/.test(limpo)) return null

  let inteiro: string | null
  let fracao: string
  if (limpo.includes(',')) {
    // Com vírgula, ela é o decimal e os pontos são de milhar.
    const partes = limpo.split(',')
    if (partes.length !== 2) return null
    inteiro = semMilhar(partes[0] ?? '')
    fracao = partes[1] ?? ''
  } else {
    const partes = limpo.split('.')
    const ultima = partes[partes.length - 1] ?? ''
    if (partes.length === 2 && ultima.length <= 2) {
      // "24.90" ou "4.5": ponto usado como decimal.
      inteiro = partes[0] ?? ''
      fracao = ultima
    } else {
      inteiro = semMilhar(limpo)
      fracao = ''
    }
  }

  if (inteiro === null || inteiro === '' || !/^\d{0,2}$/.test(fracao)) return null
  const centavos = Number(inteiro) * 100 + Number(fracao.padEnd(2, '0'))
  return centavos <= MAX_CENTAVOS ? centavos : null
}

/**
 * Lê a quantidade digitada. Unidade "un" só aceita inteiro; "kg" aceita até
 * 3 casas ("0,742"). Devolve null para zero, negativo ou texto inválido.
 */
export function parseQuantidade(texto: string, unidade: Unidade): number | null {
  const limpo = texto.trim().replace(',', '.')
  if (!/^\d+(\.\d{1,3})?$/.test(limpo)) return null
  const qtd = Number(limpo)
  if (!(qtd > 0) || qtd > MAX_QUANTIDADE) return null
  if (unidade === 'un' && !Number.isInteger(qtd)) return null
  return qtd
}

/**
 * Total do item em centavos: round(preço × quantidade), meio centavo para cima.
 * A quantidade vira milésimos inteiros antes da conta, então o resultado bate
 * com o round(integer * numeric) da coluna gerada no Postgres mesmo nos casos
 * em que o float erraria (100 × 0,145 daria 14 em vez de 15).
 */
export function calcularTotalCentavos(precoCentavos: number, qtd: number): number {
  const milesimos = Math.round(qtd * 1000)
  const numerador = precoCentavos * milesimos + 500
  return (numerador - (numerador % 1000)) / 1000
}

/** Soma ignorando itens ainda sem preço. */
export function somarCentavos(valores: Array<number | null | undefined>): number {
  let soma = 0
  for (const v of valores) soma += v ?? 0
  return soma
}
