import { describe, expect, it } from 'vitest'
import { fraseDaEspera, type ContextoDePensar } from './frases'

const CONTEXTOS: ContextoDePensar[] = ['texto', 'voz', 'foto']

describe('fraseDaEspera', () => {
  it('começa pelas etapas do contexto, na ordem', () => {
    expect(fraseDaEspera('foto', 0)).toBe('Deixa eu olhar essa foto…')
    expect(fraseDaEspera('texto', 0)).toBe('Entendendo o que você pediu…')
    expect(fraseDaEspera('voz', 0)).toBe('Escutando com atenção…')
  })

  it.each(CONTEXTOS)('nunca repete a frase anterior e nunca fica vazia (%s)', (contexto) => {
    for (let n = 1; n < 60; n++) {
      const frase = fraseDaEspera(contexto, n)
      expect(frase.length).toBeGreaterThan(0)
      expect(frase).not.toBe(fraseDaEspera(contexto, n - 1))
    }
  })

  it('depois das etapas gira nas frases de paciência', () => {
    expect(fraseDaEspera('texto', 4)).toBe('Só mais um instante…')
    expect(fraseDaEspera('texto', 4 + 4)).toBe(fraseDaEspera('texto', 4))
  })

  it('aguenta posição inválida', () => {
    expect(fraseDaEspera('foto', -3)).toBe(fraseDaEspera('foto', 0))
    expect(fraseDaEspera('foto', 2.9)).toBe(fraseDaEspera('foto', 2))
  })
})
