import { describe, expect, it } from 'vitest'
import {
  calcularTotalCentavos,
  formatarQuantidade,
  formatarReais,
  formatarValor,
  parseDinheiro,
  parseQuantidade,
  precoUnitarioDoTotal,
  somarCentavos,
} from './dinheiro.ts'

// O Intl separa "R$" do número com espaço não separável.
const semNbsp = (s: string) => s.replace(/\s/g, ' ')

describe('parseDinheiro', () => {
  it.each([
    ['24,90', 2490],
    ['24.90', 2490],
    ['1.234,56', 123456],
    ['R$ 5', 500],
    ['R$ 1.234', 123400],
    ['r$24,9', 2490],
    ['0,5', 50],
    ['4.5', 450],
    ['12', 1200],
    [' 3,99 ', 399],
    ['5,', 500],
    ['999.999,99', 99999999],
  ])('%s -> %s centavos', (texto, esperado) => {
    expect(parseDinheiro(texto)).toBe(esperado)
  })

  // O último passa do teto de R$ 999.999,99: é erro de digitação, não preço de gôndola.
  it.each(['', '   ', 'abc', '-5', '4,899', '1,2,3', '1.23,45', ',50', '12,3x', '1..2', 'R$', '1.234.567,89'])(
    'rejeita "%s"',
    (texto) => {
      expect(parseDinheiro(texto)).toBeNull()
    },
  )
})

describe('parseQuantidade', () => {
  it('aceita inteiro para unidade', () => {
    expect(parseQuantidade('6', 'un')).toBe(6)
    expect(parseQuantidade(' 12 ', 'un')).toBe(12)
  })

  it('aceita decimal para kg, com vírgula ou ponto', () => {
    expect(parseQuantidade('0,742', 'kg')).toBe(0.742)
    expect(parseQuantidade('1.5', 'kg')).toBe(1.5)
    expect(parseQuantidade('2', 'kg')).toBe(2)
  })

  it('rejeita decimal para unidade, zero, negativo e lixo', () => {
    expect(parseQuantidade('1,5', 'un')).toBeNull()
    expect(parseQuantidade('0', 'un')).toBeNull()
    expect(parseQuantidade('0,000', 'kg')).toBeNull()
    expect(parseQuantidade('-2', 'un')).toBeNull()
    expect(parseQuantidade('0,7425', 'kg')).toBeNull()
    expect(parseQuantidade('abc', 'un')).toBeNull()
    expect(parseQuantidade('', 'kg')).toBeNull()
  })
})

describe('calcularTotalCentavos', () => {
  it('quantidade inteira', () => {
    expect(calcularTotalCentavos(100, 5)).toBe(500)
    expect(calcularTotalCentavos(2490, 1)).toBe(2490)
    expect(calcularTotalCentavos(469, 6)).toBe(2814)
  })

  it('exemplo da spec: R$ 1,00 x 5 + R$ 24,90 x 1 = R$ 29,90', () => {
    const total = somarCentavos([calcularTotalCentavos(100, 5), calcularTotalCentavos(2490, 1)])
    expect(total).toBe(2990)
    expect(semNbsp(formatarReais(total))).toBe('R$ 29,90')
  })

  it('quantidade decimal arredonda para o centavo', () => {
    expect(calcularTotalCentavos(1999, 0.333)).toBe(666) // 665,667
    expect(calcularTotalCentavos(3990, 0.742)).toBe(2961) // 2960,58
    expect(calcularTotalCentavos(1000, 0.001)).toBe(1)
    expect(calcularTotalCentavos(100, 0.004)).toBe(0) // 0,4 centavo
  })

  it('meio centavo sobe, igual ao round() do Postgres', () => {
    expect(calcularTotalCentavos(999, 0.5)).toBe(500) // 499,5
    expect(calcularTotalCentavos(1, 0.5)).toBe(1) // 0,5
    // Em float, 100 * 0.145 = 14.499999999999998, e Math.round daria 14.
    expect(Math.round(100 * 0.145)).toBe(14)
    expect(calcularTotalCentavos(100, 0.145)).toBe(15)
  })

  it('sempre devolve inteiro', () => {
    for (const [preco, qtd] of [
      [3333, 0.333],
      [199, 7],
      [8999, 1.275],
    ] as const) {
      expect(Number.isInteger(calcularTotalCentavos(preco, qtd))).toBe(true)
    }
  })
})

describe('formatação', () => {
  it('formatarReais usa o padrão brasileiro', () => {
    expect(semNbsp(formatarReais(123456))).toBe('R$ 1.234,56')
    expect(semNbsp(formatarReais(0))).toBe('R$ 0,00')
    expect(semNbsp(formatarReais(5))).toBe('R$ 0,05')
  })

  it('formatarValor omite o símbolo', () => {
    expect(formatarValor(469)).toBe('4,69')
    expect(formatarValor(123456)).toBe('1.234,56')
  })

  it('formatarQuantidade mostra kg só quando é peso', () => {
    expect(formatarQuantidade(6, 'un')).toBe('6')
    expect(formatarQuantidade(0.742, 'kg')).toBe('0,742 kg')
    expect(formatarQuantidade(2, 'kg')).toBe('2 kg')
  })
})

describe('somarCentavos', () => {
  it('ignora itens sem preço', () => {
    expect(somarCentavos([500, null, 2490, undefined])).toBe(2990)
    expect(somarCentavos([])).toBe(0)
  })
})

describe('precoUnitarioDoTotal', () => {
  it('divide o preço do conjunto: 5 por R$ 10 = R$ 2,00 cada', () => {
    expect(precoUnitarioDoTotal(1000, 5)).toEqual({ preco_centavos: 200, total_centavos: 1000, exato: true })
  })

  it('avisa quando não fecha em centavos: 3 por R$ 10', () => {
    const r = precoUnitarioDoTotal(1000, 3)
    expect(r).toEqual({ preco_centavos: 333, total_centavos: 999, exato: false })
  })

  it('por peso, procura o preço do quilo que bate com o total', () => {
    const r = precoUnitarioDoTotal(1000, 0.742)
    expect(r?.exato).toBe(true)
    expect(r && calcularTotalCentavos(r.preco_centavos, 0.742)).toBe(1000)
  })

  it('recusa total ou quantidade inválidos', () => {
    expect(precoUnitarioDoTotal(0, 5)).toBeNull()
    expect(precoUnitarioDoTotal(1000, 0)).toBeNull()
    expect(precoUnitarioDoTotal(1, 5)).toBeNull()
  })
})
