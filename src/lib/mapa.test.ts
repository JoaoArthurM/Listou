import { describe, expect, it } from 'vitest'
import { agruparPorMercado, type CompraNoMapa } from './mapa'
import { distanciaEmMetros, mercadosDaResposta } from './mercados'

const compra = (id: string, quando: string, lat: number, lng: number, mercado: string | null = 'Atacadão'): CompraNoMapa => ({
  id,
  nome: `Compra ${id}`,
  mercado,
  lat,
  lng,
  quando,
  total_centavos: 10000,
})

describe('agruparPorMercado', () => {
  it('junta compras no mesmo lugar e deixa a mais recente mandar', () => {
    const [m, ...resto] = agruparPorMercado([
      compra('a', '2026-09-01', -16.6, -49.2),
      compra('b', '2026-10-01', -16.6003, -49.2002),
    ])
    expect(resto).toHaveLength(0)
    expect(m!.ultima.id).toBe('b')
    expect(m!.lat).toBe(-16.6003)
    expect(m!.compras.map((c) => c.id)).toEqual(['b', 'a'])
  })

  it('separa mercados distantes', () => {
    expect(agruparPorMercado([compra('a', '2026-09-01', -16.6, -49.2), compra('b', '2026-10-01', -16.7, -49.3, 'Max')])).toHaveLength(2)
  })

  it('mesmo nome a menos de 1 km é o mesmo mercado, ignorando acento e caixa', () => {
    const r = agruparPorMercado([compra('a', '2026-09-01', -16.6, -49.2, 'Atacadão'), compra('b', '2026-10-01', -16.606, -49.2, 'ATACADAO')])
    expect(r).toHaveLength(1)
  })

  it('usa o nome da lista quando não há mercado', () => {
    expect(agruparPorMercado([compra('a', '2026-09-01', -16.6, -49.2, null)])[0]!.nome).toBe('Compra a')
  })
})

describe('mercados', () => {
  it('mede distância em metros', () => {
    const d = distanciaEmMetros({ lat: -16.6, lng: -49.2 }, { lat: -16.601, lng: -49.2 })
    expect(d).toBeGreaterThan(105)
    expect(d).toBeLessThan(117)
  })

  it('ordena por distância, tira sem nome e repetidos', () => {
    const origem = { lat: -16.6, lng: -49.2 }
    const r = mercadosDaResposta(
      {
        elements: [
          { lat: -16.603, lon: -49.2, tags: { name: 'Longe' } },
          { center: { lat: -16.6005, lon: -49.2 }, tags: { name: 'Perto' } },
          { lat: -16.6001, lon: -49.2, tags: {} },
          { lat: -16.602, lon: -49.2, tags: { name: 'perto' } },
        ],
      },
      origem,
    )
    expect(r.map((m) => m.nome)).toEqual(['Perto', 'Longe'])
  })

  it('resposta estranha vira lista vazia', () => {
    expect(mercadosDaResposta(null, { lat: 0, lng: 0 })).toEqual([])
    expect(mercadosDaResposta({ elements: 'x' }, { lat: 0, lng: 0 })).toEqual([])
  })
})
