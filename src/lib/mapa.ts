// Do histórico para os pontos do mapa. Cada compra finalizada com local entra
// num mercado; compras a menos de 120 m uma da outra (ou com o mesmo nome a
// menos de 1 km) são o mesmo mercado. A compra mais recente manda no ponto,
// no nome e no preço mostrados; as outras aparecem ao tocar no marcador.

import { distanciaEmMetros, type Ponto } from './mercados'

export type CompraNoMapa = {
  id: string
  nome: string
  mercado: string | null
  lat: number
  lng: number
  quando: string
  total_centavos: number
}

export type MercadoNoMapa = Ponto & {
  nome: string
  ultima: CompraNoMapa
  /** Da mais recente para a mais antiga. */
  compras: CompraNoMapa[]
}

const MESMO_LUGAR_M = 120
const MESMO_NOME_M = 1000

const nomeParaComparar = (nome: string | null) =>
  (nome ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLocaleLowerCase('pt-BR')
    .trim()

function mesmoMercado(a: CompraNoMapa, b: CompraNoMapa): boolean {
  const d = distanciaEmMetros(a, b)
  if (d <= MESMO_LUGAR_M) return true
  const nome = nomeParaComparar(a.mercado)
  return nome !== '' && nome === nomeParaComparar(b.mercado) && d <= MESMO_NOME_M
}

export function agruparPorMercado(compras: CompraNoMapa[]): MercadoNoMapa[] {
  const recentesPrimeiro = [...compras].sort((a, b) => b.quando.localeCompare(a.quando))
  const grupos: CompraNoMapa[][] = []
  for (const compra of recentesPrimeiro) {
    // O grupo é medido pela compra mais recente dele, que é a primeira.
    const grupo = grupos.find((g) => mesmoMercado(g[0]!, compra))
    if (grupo) grupo.push(compra)
    else grupos.push([compra])
  }
  return grupos.map((g) => {
    const ultima = g[0]!
    return { lat: ultima.lat, lng: ultima.lng, nome: ultima.mercado?.trim() || ultima.nome, ultima, compras: g }
  })
}

const RAIO_DO_MERCADO_M = 150

/**
 * Nome do mercado já conhecido onde a pessoa está: o do mercado mais perto,
 * a até 150 m, que tenha nome escrito. Null se não há nenhum por ali.
 */
export function mercadoConhecidoPerto(compras: CompraNoMapa[], ponto: Ponto): string | null {
  let melhor: { nome: string; d: number } | null = null
  for (const m of agruparPorMercado(compras)) {
    const nome = m.ultima.mercado?.trim()
    if (!nome) continue
    const d = distanciaEmMetros(m, ponto)
    if (d <= RAIO_DO_MERCADO_M && (!melhor || d < melhor.d)) melhor = { nome, d }
  }
  return melhor?.nome ?? null
}
