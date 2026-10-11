import { describe, expect, it } from 'vitest'
import { normalizarNome } from './nomes'

describe('normalizarNome', () => {
  it('tudo minúsculo ganha a inicial maiúscula', () => {
    expect(normalizarNome('arroz')).toBe('Arroz')
    expect(normalizarNome('papel higiênico')).toBe('Papel higiênico')
  })

  it('tudo maiúsculo vira inicial maiúscula e resto minúsculo', () => {
    expect(normalizarNome('ARROZ')).toBe('Arroz')
    expect(normalizarNome('LEITE INTEGRAL 1L')).toBe('Leite integral 1l')
    expect(normalizarNome('ÓLEO DE SOJA')).toBe('Óleo de soja')
  })

  it('maiúsculas e minúsculas bagunçadas são arrumadas', () => {
    expect(normalizarNome('aRrOz')).toBe('Arroz')
    expect(normalizarNome('FeIjÃo')).toBe('Feijão')
  })

  it('nome com maiúsculas de propósito só ganha a inicial', () => {
    expect(normalizarNome('Coca-Cola')).toBe('Coca-Cola')
    expect(normalizarNome('Leite Ninho')).toBe('Leite Ninho')
    expect(normalizarNome('iPhone')).toBe('IPhone')
    expect(normalizarNome('McDonald')).toBe('McDonald')
    expect(normalizarNome('café Pilão')).toBe('Café Pilão')
  })

  it('limpa espaços e aceita vazio', () => {
    expect(normalizarNome('  ovo   caipira ')).toBe('Ovo caipira')
    expect(normalizarNome('   ')).toBe('')
  })

  it('número e sigla sozinhos não quebram', () => {
    expect(normalizarNome('7')).toBe('7')
    expect(normalizarNome('TV')).toBe('Tv')
  })
})
