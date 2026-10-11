import { describe, expect, it } from 'vitest'
import { precoAnteriorDe, precosAnteriores, preverFaltantes, type CompraPassada } from './previsao'
import { resumirCompra } from './resumo'

const ATUAL = 'lista-atual'
const compra = (nome: string, preco: number, quando: string, extra: Partial<CompraPassada> = {}): CompraPassada => ({
  nome,
  unidade: 'un',
  preco_unit_centavos: preco,
  comprado_em: quando,
  lista_id: 'lista-antiga',
  ...extra,
})

describe('precosAnteriores', () => {
  const precos = precosAnteriores(
    [
      compra('Café', 1890, '2026-08-01T10:00:00Z'),
      compra('café', 2190, '2026-09-15T10:00:00Z'),
      compra('Leite', 549, '2026-09-15T10:00:00Z'),
      compra('Leite', 999, '2026-10-10T10:00:00Z', { lista_id: ATUAL }),
      compra('Banana', 599, '2026-09-15T10:00:00Z', { unidade: 'kg' }),
    ],
    ATUAL,
  )

  it('fica com a compra mais recente de cada nome, sem ligar para acento e maiúscula', () => {
    expect(precoAnteriorDe(precos, 'CAFE')).toEqual({ preco_centavos: 2190, unidade: 'un', quando: '2026-09-15T10:00:00Z' })
  })

  it('a própria lista aberta não conta como "última vez"', () => {
    expect(precoAnteriorDe(precos, 'Leite')?.preco_centavos).toBe(549)
  })

  it('nome nunca comprado não tem preço', () => {
    expect(precoAnteriorDe(precos, 'Sabonete')).toBeNull()
    // Só nome igual conta: "café solúvel" não herda o preço do "café".
    expect(precoAnteriorDe(precos, 'Café solúvel')).toBeNull()
  })

  it('prevê o que falta com quantidade planejada, ou uma unidade', () => {
    const itens = [
      { nome: 'Café', unidade: 'un' as const, qtd_planejada: 2, comprado: false }, // 2 × 21,90
      { nome: 'Leite', unidade: 'un' as const, qtd_planejada: null, comprado: false }, // 1 × 5,49
      { nome: 'Banana', unidade: 'kg' as const, qtd_planejada: 1.5, comprado: false }, // 1,5 × 5,99 = 8,985 -> 8,99
      { nome: 'Sabonete', unidade: 'un' as const, qtd_planejada: 3, comprado: false }, // nunca comprado
      { nome: 'Arroz', unidade: 'un' as const, qtd_planejada: 1, comprado: true }, // já no carrinho
    ]
    expect(preverFaltantes(itens, precos)).toEqual({ centavos: 4380 + 549 + 899, comPreco: 3, semPreco: 1 })
  })

  it('não estima item por peso sem peso planejado nem item que mudou de unidade', () => {
    const itens = [
      { nome: 'Banana', unidade: 'kg' as const, qtd_planejada: null, comprado: false },
      { nome: 'Café', unidade: 'kg' as const, qtd_planejada: 1, comprado: false },
    ]
    expect(preverFaltantes(itens, precos)).toEqual({ centavos: 0, comPreco: 0, semPreco: 2 })
  })
})

describe('resumirCompra', () => {
  const faixas = [
    { tipo: 'varejo' as const, preco_centavos: 489, qtd_minima: 1, cartao: null },
    { tipo: 'atacado' as const, preco_centavos: 469, qtd_minima: 6, cartao: null },
    { tipo: 'cartao' as const, preco_centavos: 450, qtd_minima: 1, cartao: 'crediffato' },
  ]
  const item = (nome: string, extra: object) => ({
    nome,
    unidade: 'un' as const,
    comprado: true,
    faixas_preco: null,
    faixa_aplicada: null,
    preco_unit_centavos: null,
    qtd_comprada: null,
    total_centavos: null,
    ...extra,
  })

  it('soma o carrinho e separa o que ficou sem preço e sem comprar', () => {
    const resumo = resumirCompra([
      item('Café', { faixas_preco: faixas, faixa_aplicada: 'varejo', preco_unit_centavos: 489, qtd_comprada: 2, total_centavos: 978 }),
      item('Leite', {}),
      item('Pão', { comprado: false }),
    ])
    expect(resumo).toMatchObject({ total_centavos: 978, comprados: 2, semPreco: ['Leite'], naoComprados: ['Pão'] })
    expect(resumo.economia).toEqual({ atacado: 0, cartao: 0, total: 0 })
  })

  it('economia do atacado e do cartão é a diferença para o varejo', () => {
    const resumo = resumirCompra([
      // 6 × 4,89 = 29,34 no varejo; pagou 6 × 4,69 = 28,14.
      item('Café', { faixas_preco: faixas, faixa_aplicada: 'atacado', preco_unit_centavos: 469, qtd_comprada: 6, total_centavos: 2814 }),
      // 2 × 4,89 = 9,78 no varejo; pagou 2 × 4,50 = 9,00.
      item('Chá', { faixas_preco: faixas, faixa_aplicada: 'cartao', preco_unit_centavos: 450, qtd_comprada: 2, total_centavos: 900 }),
    ])
    expect(resumo.economia).toEqual({ atacado: 120, cartao: 78, total: 198 })
  })

  it('sem o varejo guardado, ou com preço digitado, não inventa economia', () => {
    const resumo = resumirCompra([
      item('A', { faixas_preco: [faixas[1]], faixa_aplicada: 'atacado', preco_unit_centavos: 469, qtd_comprada: 6, total_centavos: 2814 }),
      item('B', { faixas_preco: faixas, faixa_aplicada: 'manual', preco_unit_centavos: 300, qtd_comprada: 6, total_centavos: 1800 }),
      item('C', { faixas_preco: null, faixa_aplicada: 'atacado', preco_unit_centavos: 469, qtd_comprada: 6, total_centavos: 2814 }),
    ])
    expect(resumo.economia.total).toBe(0)
  })
})
