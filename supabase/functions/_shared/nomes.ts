// Nome de item com inicial maiúscula e o resto em minúsculas quando o texto
// veio "gritado" (ARROZ), todo minúsculo (arroz) ou bagunçado (aRrOz).
//
// Nome que já tem maiúsculas de propósito ("Coca-Cola", "Leite Ninho",
// "iPhone") só ganha a inicial maiúscula: o código não adivinha marca.

// "McDonald" tem 3 trocas de caixa e "iPhone" 2; "aRrOz" tem 4.
const MAX_VIRADAS_NORMAIS = 3

const temMaiuscula = (texto: string) => texto !== texto.toLowerCase()
const temMinuscula = (texto: string) => texto !== texto.toUpperCase()

/** Quantas vezes, dentro de um trecho de letras, a caixa troca ("aRrOz" tem 4). Hífen e apóstrofo reiniciam a conta. */
function viradasDeCaixa(palavra: string): number {
  let viradas = 0
  let anterior: 'alta' | 'baixa' | null = null
  for (const letra of palavra) {
    if (letra.toLowerCase() === letra.toUpperCase()) {
      // Número, hífen, apóstrofo: separa trechos ("Coca-Cola" são dois, de uma troca cada).
      if (!/\d/.test(letra)) anterior = null
      continue
    }
    const atual = letra === letra.toUpperCase() ? 'alta' : 'baixa'
    if (anterior !== null && atual !== anterior) viradas += 1
    anterior = atual
  }
  return viradas
}

const comInicial = (texto: string) => texto.charAt(0).toLocaleUpperCase('pt-BR') + texto.slice(1)

export function normalizarNome(nome: string): string {
  const limpo = nome.replace(/\s+/g, ' ').trim()
  if (limpo === '') return limpo

  const gritado = temMaiuscula(limpo) && !temMinuscula(limpo)
  const bagunçado = limpo.split(' ').some((palavra) => viradasDeCaixa(palavra) > MAX_VIRADAS_NORMAIS)
  if (gritado || bagunçado) return comInicial(limpo.toLocaleLowerCase('pt-BR'))
  return comInicial(limpo)
}
