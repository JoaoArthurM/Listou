import { useEffect, useState } from 'react'
import { fraseDaEspera, type ContextoDePensar } from '@/lib/frases'

const TROCA_MS = 2400

/**
 * Frase da espera da IA, trocando a cada poucos segundos enquanto o contexto
 * existir. Com `null` (nada a caminho) devolve null e zera a sequência, então
 * o próximo pedido recomeça pela primeira etapa.
 */
export function useFrase(contexto: ContextoDePensar | null): string | null {
  const [passo, setPasso] = useState(0)

  useEffect(() => {
    setPasso(0)
    if (contexto === null) return
    const relogio = window.setInterval(() => setPasso((n) => n + 1), TROCA_MS)
    return () => window.clearInterval(relogio)
  }, [contexto])

  return contexto === null ? null : fraseDaEspera(contexto, passo)
}
