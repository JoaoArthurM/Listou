import { describe, expect, it } from 'vitest'
import {
  botoesQuantidade,
  calcularCompra,
  cartoesDesconhecidos,
  dicaEconomia,
  escolherFaixa,
  linhaCalculo,
  linhaFaixas,
  normalizarCartao,
  rotuloFaixa,
  textoDica,
  type Faixa,
} from './precos.ts'

const semNbsp = (s: string) => s.replace(/\s/g, ' ')

const varejo = (preco: number): Faixa => ({ tipo: 'varejo', preco_centavos: preco, qtd_minima: 1, cartao: null })
const atacado = (preco: number, minimo: number): Faixa => ({
  tipo: 'atacado',
  preco_centavos: preco,
  qtd_minima: minimo,
  cartao: null,
})
const cartao = (preco: number, nome: string, minimo = 1): Faixa => ({
  tipo: 'cartao',
  preco_centavos: preco,
  qtd_minima: minimo,
  cartao: nome,
})

// Etiquetas reais da tabela da seção 6.4.
const vuon = [varejo(199), atacado(189, 3), cartao(149, 'vuon card')]
const crediffato = [varejo(489), atacado(469, 6), cartao(450, 'crediffato')]
const duasFaixas = [varejo(159), atacado(119, 6)]
const soVarejo = [varejo(199)]

describe('escolherFaixa: tabela da seção 6.4', () => {
  it.each([
    ['Varejo 1,99 / 3+ 1,89 / Vuon 1,49', vuon, 2, [], 'varejo', 398],
    ['Varejo 1,99 / 3+ 1,89 / Vuon 1,49', vuon, 5, [], 'atacado', 945],
    ['Varejo 1,99 / 3+ 1,89 / Vuon 1,49', vuon, 5, ['vuon card'], 'cartao', 745],
    ['Varejo 4,89 / 6+ 4,69 / Crediffato 4,50', crediffato, 6, [], 'atacado', 2814],
    ['Varejo 4,89 / 6+ 4,69 / Crediffato 4,50', crediffato, 2, ['crediffato'], 'cartao', 900],
    ['Varejo 1,59 / 6+ 1,19', duasFaixas, 5, [], 'varejo', 795],
    ['Varejo 1,59 / 6+ 1,19', duasFaixas, 6, [], 'atacado', 714],
    ['Só 1,99', soVarejo, 3, [], 'varejo', 597],
  ] as const)('%s, qtd %i, cartões %j -> %s, %i centavos', (_nome, faixas, qtd, cartoes, tipo, total) => {
    const compra = calcularCompra([...faixas], qtd, [...cartoes])
    expect(compra?.faixa.tipo).toBe(tipo)
    expect(compra?.total_centavos).toBe(total)
  })
})

describe('escolherFaixa: bordas', () => {
  it('quantidade exatamente no mínimo usa o atacado; uma abaixo, não', () => {
    expect(escolherFaixa(crediffato, 6, [])?.tipo).toBe('atacado')
    expect(escolherFaixa(crediffato, 5, [])?.tipo).toBe('varejo')
  })

  it('atacado vale para todas as unidades, não só para as que passam do mínimo', () => {
    // 6 x 4,69 = 28,14, e não 5 x 4,89 + 1 x 4,69 = 29,14.
    expect(calcularCompra(crediffato, 6, [])?.total_centavos).toBe(2814)
    expect(calcularCompra(crediffato, 7, [])?.total_centavos).toBe(3283)
  })

  it('cartão recusado (fora da lista) nunca é aplicado', () => {
    expect(escolherFaixa(vuon, 5, [])?.tipo).toBe('atacado')
    expect(escolherFaixa(vuon, 5, ['crediffato'])?.tipo).toBe('atacado')
    expect(escolherFaixa(crediffato, 1, [])?.tipo).toBe('varejo')
  })

  it('faixa de cartão com quantidade mínima própria respeita o mínimo', () => {
    const faixas = [varejo(500), cartao(400, 'clube', 3)]
    expect(escolherFaixa(faixas, 2, ['clube'])?.tipo).toBe('varejo')
    expect(escolherFaixa(faixas, 3, ['clube'])?.tipo).toBe('cartao')
    expect(calcularCompra(faixas, 3, ['clube'])?.total_centavos).toBe(1200)
  })

  it('nenhuma faixa elegível devolve null (o app pede o preço)', () => {
    // Varejo ilegível e quantidade abaixo do atacado.
    expect(escolherFaixa([atacado(469, 6)], 2, [])).toBeNull()
    expect(calcularCompra([atacado(469, 6)], 2, [])).toBeNull()
    expect(escolherFaixa([cartao(450, 'crediffato')], 3, [])).toBeNull()
    expect(escolherFaixa([], 1, [])).toBeNull()
  })

  it('quantidade zero ou negativa não escolhe faixa', () => {
    expect(escolherFaixa(soVarejo, 0, [])).toBeNull()
    expect(escolherFaixa(soVarejo, -1, [])).toBeNull()
    expect(escolherFaixa(soVarejo, Number.NaN, [])).toBeNull()
  })

  it('escolhe a mais barata mesmo quando o cartão custa mais que o atacado', () => {
    const faixas = [varejo(500), atacado(400, 6), cartao(450, 'clube')]
    expect(escolherFaixa(faixas, 6, ['clube'])?.tipo).toBe('atacado')
    expect(escolherFaixa(faixas, 2, ['clube'])?.tipo).toBe('cartao')
  })

  it('no empate de preço prefere a faixa sem cartão', () => {
    const faixas = [cartao(189, 'clube'), atacado(189, 3), varejo(199)]
    expect(escolherFaixa(faixas, 3, ['clube'])?.tipo).toBe('atacado')
  })

  it('compara o nome do cartão sem acento e sem diferenciar maiúsculas', () => {
    const faixas = [varejo(500), cartao(400, 'Cartão Crédiffato')]
    expect(escolherFaixa(faixas, 1, ['cartao crediffato'])?.tipo).toBe('cartao')
    expect(escolherFaixa(faixas, 1, [' CARTÃO  CRÉDIFFATO '])?.tipo).toBe('cartao')
  })

  it('produto por peso: preço do kg vezes o peso, arredondado ao centavo', () => {
    const picanha = [varejo(3990)]
    expect(calcularCompra(picanha, 0.742, [])?.total_centavos).toBe(2961)
    const comAtacado = [varejo(3990), atacado(3490, 2)]
    expect(calcularCompra(comAtacado, 1.999, [])?.faixa.tipo).toBe('varejo')
    expect(calcularCompra(comAtacado, 2, [])?.faixa.tipo).toBe('atacado')
  })
})

describe('cartoesDesconhecidos', () => {
  it('lista só os cartões ainda não respondidos', () => {
    expect(cartoesDesconhecidos(crediffato, [], [])).toEqual(['crediffato'])
    expect(cartoesDesconhecidos(crediffato, ['crediffato'], [])).toEqual([])
    expect(cartoesDesconhecidos(crediffato, [], ['crediffato'])).toEqual([])
    expect(cartoesDesconhecidos(soVarejo, [], [])).toEqual([])
  })

  it('não repete o mesmo cartão e normaliza o nome', () => {
    const faixas = [cartao(450, 'Vuon Card'), cartao(430, 'vuon card', 6)]
    expect(cartoesDesconhecidos(faixas, [], [])).toEqual(['vuon card'])
  })
})

describe('dicaEconomia', () => {
  it('exemplo da spec: 5 x 1,59 = 7,95, mas 6 x 1,19 = 7,14', () => {
    const dica = dicaEconomia(duasFaixas, 5, [])
    expect(dica).toEqual({
      qtd_sugerida: 6,
      total_atual_centavos: 795,
      total_sugerido_centavos: 714,
      economia_centavos: 81,
      a_mais: 1,
    })
    expect(semNbsp(textoDica(dica!, 'un'))).toBe('Levando 6 você paga R$ 0,81 a menos e leva 1 a mais.')
  })

  it('não sugere quando levar mais sai bem mais caro', () => {
    // 5 x 4,89 = 24,45; 6 x 4,69 = 28,14 (15% a mais).
    expect(dicaEconomia(crediffato, 5, [])).toBeNull()
    expect(dicaEconomia(vuon, 2, [])).toBeNull()
  })

  it('não sugere quando a quantidade está longe do degrau', () => {
    expect(dicaEconomia(duasFaixas, 2, [])).toBeNull()
  })

  it('não sugere quando já está no atacado ou não há degrau acima', () => {
    expect(dicaEconomia(duasFaixas, 6, [])).toBeNull()
    expect(dicaEconomia(soVarejo, 3, [])).toBeNull()
  })

  it('ignora degrau de cartão que a lista não tem', () => {
    const faixas = [varejo(1000), cartao(500, 'clube', 6)]
    expect(dicaEconomia(faixas, 5, [])).toBeNull()
    expect(dicaEconomia(faixas, 5, ['clube'])?.qtd_sugerida).toBe(6)
  })

  it('avisa também quando custa quase igual', () => {
    // 5 x 2,00 = 10,00; 6 x 1,75 = 10,50 (5% a mais).
    const dica = dicaEconomia([varejo(200), atacado(175, 6)], 5, [])
    expect(dica?.economia_centavos).toBe(-50)
    expect(semNbsp(textoDica(dica!, 'un'))).toBe('Levando 6 você paga só R$ 0,50 a mais e leva 1 a mais.')
    // 4 x 1,50 = 6,00; 6 x 1,00 = 6,00.
    const igual = dicaEconomia([varejo(150), atacado(100, 6)], 4, [])
    expect(semNbsp(textoDica(igual!, 'un'))).toBe('Levando 6 você paga o mesmo e leva 2 a mais.')
  })

  it('sem faixa elegível não há dica', () => {
    expect(dicaEconomia([atacado(469, 6)], 5, [])).toBeNull()
  })
})

describe('textos do card', () => {
  it('linha compacta das faixas', () => {
    expect(linhaFaixas(crediffato)).toBe('Varejo 4,89 · 6+ 4,69 · Crediffato 4,50')
    expect(linhaFaixas([cartao(149, 'vuon card'), atacado(189, 3), varejo(199)])).toBe(
      'Varejo 1,99 · 3+ 1,89 · Vuon Card 1,49',
    )
    expect(linhaFaixas(soVarejo)).toBe('Varejo 1,99')
    expect(linhaFaixas([varejo(500), cartao(400, 'clube', 3)])).toBe('Varejo 5,00 · Clube 3+ 4,00')
  })

  it('linha do cálculo', () => {
    expect(semNbsp(linhaCalculo(6, 'un', 469, 'atacado'))).toBe('6 × R$ 4,69 (atacado) = R$ 28,14')
    expect(semNbsp(linhaCalculo(2, 'un', 450, 'cartao', 'crediffato'))).toBe(
      '2 × R$ 4,50 (cartão Crediffato) = R$ 9,00',
    )
    expect(semNbsp(linhaCalculo(0.742, 'kg', 3990, 'varejo'))).toBe('0,742 kg × R$ 39,90 (varejo) = R$ 29,61')
    expect(semNbsp(linhaCalculo(1, 'un', 2490, 'manual'))).toBe('1 × R$ 24,90 (preço informado) = R$ 24,90')
  })

  it('rótulos e normalização', () => {
    expect(rotuloFaixa('cartao', 'vuon card')).toBe('cartão Vuon Card')
    expect(rotuloFaixa('cartao')).toBe('cartão')
    expect(normalizarCartao('  Cartão   CRÉDIFFATO ')).toBe('cartao crediffato')
  })

  it('botões de quantidade incluem o mínimo do atacado', () => {
    expect(botoesQuantidade(soVarejo, 'un')).toEqual([1, 2, 3, 6, 12])
    expect(botoesQuantidade([varejo(199), atacado(189, 4)], 'un')).toEqual([1, 2, 3, 4, 6, 12])
    expect(botoesQuantidade(crediffato, 'un')).toEqual([1, 2, 3, 6, 12])
    expect(botoesQuantidade(soVarejo, 'kg')).toEqual([0.5, 1, 2])
  })
})
