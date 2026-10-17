import { describe, expect, it } from 'vitest'
import { parseDinheiro } from './dinheiro'
import { mascararDinheiro } from './mascara'

describe('mascararDinheiro', () => {
  it('entra pelos centavos, como caixa eletrônico', () => {
    expect(mascararDinheiro('1')).toBe('0,01')
    expect(mascararDinheiro('12')).toBe('0,12')
    expect(mascararDinheiro('123')).toBe('1,23')
    expect(mascararDinheiro('1234')).toBe('12,34')
    expect(mascararDinheiro('12345')).toBe('123,45')
    expect(mascararDinheiro('123456')).toBe('1.234,56')
    expect(mascararDinheiro('1234567')).toBe('12.345,67')
    expect(mascararDinheiro('12345678')).toBe('123.456,78')
  })

  it('digitar mais um número no texto já formatado empurra os dígitos', () => {
    expect(mascararDinheiro('0,015')).toBe('0,15')
    expect(mascararDinheiro('4,695')).toBe('46,95')
    expect(mascararDinheiro('1.234,567')).toBe('12.345,67')
  })

  it('apagar tira o último dígito, até esvaziar', () => {
    expect(mascararDinheiro('1.234,5')).toBe('123,45')
    expect(mascararDinheiro('0,0')).toBe('')
    expect(mascararDinheiro('')).toBe('')
  })

  it('ignora o que não é dígito e o que passa do teto', () => {
    expect(mascararDinheiro('R$ 24,90')).toBe('24,90')
    expect(mascararDinheiro('123456789')).toBe('123.456,78')
  })

  it('o texto da máscara é lido por parseDinheiro', () => {
    expect(parseDinheiro(mascararDinheiro('123456'))).toBe(123456)
    expect(parseDinheiro(mascararDinheiro('5'))).toBe(5)
    expect(parseDinheiro(mascararDinheiro('99999999'))).toBe(99999999)
  })
})
