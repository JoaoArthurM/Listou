// Conexão medida de verdade. O navegador diz "online" sempre que existe rede,
// mesmo sem sinal útil (Wi-Fi do mercado sem internet, 4G caindo). Aqui uma
// sonda leve pergunta ao servidor se ele responde e em quanto tempo; é isso
// que o indicador da tela mostra, e é isso que decide se as alterações vão
// para a fila offline.

import { onlineManager } from '@tanstack/react-query'
import { useSyncExternalStore } from 'react'

export type Sinal = {
  /** verificando: primeira medição; lento: respondeu acima de 1,5 s; fora: não respondeu duas vezes seguidas. */
  estado: 'verificando' | 'ok' | 'lento' | 'fora'
  latenciaMs: number | null
  /** Sobe a cada resposta do servidor e a cada dado recebido em tempo real; a tela pulsa junto. */
  batidas: number
}

const INTERVALO_MS = 20_000
const LIMITE_MS = 7_000
const LENTO_MS = 1_500

let sinal: Sinal = { estado: 'verificando', latenciaMs: null, batidas: 0 }
let falhas = 0
let relogio: number | undefined
const ouvintes = new Set<() => void>()

function publicar(novo: Sinal) {
  sinal = novo
  for (const ouvinte of ouvintes) ouvinte()
}

function semServidor() {
  publicar({ ...sinal, estado: 'fora', latenciaMs: null })
  onlineManager.setOnline(false)
}

async function sondar(url: string, chave: string) {
  if (!navigator.onLine) return semServidor()
  const inicio = performance.now()
  try {
    const resposta = await fetch(`${url}/auth/v1/health`, {
      headers: { apikey: chave },
      cache: 'no-store',
      signal: AbortSignal.timeout(LIMITE_MS),
    })
    if (!resposta.ok) throw new Error(String(resposta.status))
    const ms = Math.round(performance.now() - inicio)
    falhas = 0
    publicar({ estado: ms > LENTO_MS ? 'lento' : 'ok', latenciaMs: ms, batidas: sinal.batidas + 1 })
    // Só com o servidor respondendo a fila offline é reenviada.
    onlineManager.setOnline(true)
  } catch {
    // Uma falha isolada é comum em rede móvel; duas seguidas contam como fora do ar.
    falhas += 1
    if (falhas >= 2) semServidor()
  }
}

/** Dado recebido pelo Realtime: prova de conexão viva, faz o indicador pulsar. */
export function registrarAtividade() {
  if (sinal.estado === 'fora') return
  publicar({ ...sinal, batidas: sinal.batidas + 1 })
}

export function iniciarSonda(url: string | undefined, chave: string | undefined) {
  if (!url || !chave) return
  const medir = () => void sondar(url, chave)
  const agendar = () => {
    window.clearInterval(relogio)
    if (document.visibilityState === 'visible') relogio = window.setInterval(medir, INTERVALO_MS)
  }

  window.addEventListener('online', medir)
  window.addEventListener('offline', semServidor)
  document.addEventListener('visibilitychange', () => {
    // Aba em segundo plano não gasta rede; ao voltar, mede na hora.
    if (document.visibilityState === 'visible') medir()
    agendar()
  })
  medir()
  agendar()
}

function assinar(ouvinte: () => void) {
  ouvintes.add(ouvinte)
  return () => {
    ouvintes.delete(ouvinte)
  }
}

export function useSinal(): Sinal {
  return useSyncExternalStore(assinar, () => sinal)
}
