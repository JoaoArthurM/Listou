import { describe, expect, it } from 'vitest'
import { chaveDoDia, horaCurta, rotuloDoDia } from './datas'

const agora = new Date(2026, 9, 11, 15, 0) // domingo, 11 de outubro de 2026

describe('rotuloDoDia', () => {
  it('hoje e ontem', () => {
    expect(rotuloDoDia(new Date(2026, 9, 11, 0, 5), agora)).toBe('Hoje')
    expect(rotuloDoDia(new Date(2026, 9, 10, 23, 59), agora)).toBe('Ontem')
  })

  it('dia da semana até seis dias atrás', () => {
    expect(rotuloDoDia(new Date(2026, 9, 8, 12), agora)).toBe('quinta-feira')
    expect(rotuloDoDia(new Date(2026, 9, 5, 12), agora)).toBe('segunda-feira')
  })

  it('data por extenso a partir de uma semana', () => {
    expect(rotuloDoDia(new Date(2026, 9, 4, 12), agora)).toBe('4 de outubro')
    expect(rotuloDoDia(new Date(2025, 11, 25, 12), agora)).toBe('25 de dezembro de 2025')
  })
})

describe('horaCurta e chaveDoDia', () => {
  it('formata a hora com dois dígitos', () => {
    expect(horaCurta(new Date(2026, 9, 11, 9, 5))).toBe('09:05')
  })

  it('separa dias diferentes', () => {
    expect(chaveDoDia(new Date(2026, 9, 11, 1))).toBe(chaveDoDia(new Date(2026, 9, 11, 23)))
    expect(chaveDoDia(new Date(2026, 9, 11))).not.toBe(chaveDoDia(new Date(2026, 9, 10)))
  })
})
