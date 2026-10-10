// Roteador mínimo sobre a History API. São seis rotas; uma biblioteca de
// rotas ficaria fora da stack definida no CLAUDE.md.

import { useSyncExternalStore } from 'react'

const ouvintes = new Set<() => void>()

function avisar() {
  for (const ouvinte of ouvintes) ouvinte()
}

function assinar(ouvinte: () => void) {
  ouvintes.add(ouvinte)
  window.addEventListener('popstate', ouvinte)
  return () => {
    ouvintes.delete(ouvinte)
    window.removeEventListener('popstate', ouvinte)
  }
}

const caminhoAtual = () => window.location.pathname + window.location.search

// Quantas telas o app empilhou nesta visita. Serve para "voltar" não jogar o
// usuário para fora do app quando ele abriu direto num link.
function profundidade(): number {
  const estado = window.history.state as { listou?: number } | null
  return estado?.listou ?? 0
}

export function navegar(para: string, opcoes: { substituir?: boolean } = {}) {
  if (para === caminhoAtual()) return
  if (opcoes.substituir) {
    window.history.replaceState({ listou: profundidade() }, '', para)
  } else {
    window.history.pushState({ listou: profundidade() + 1 }, '', para)
  }
  avisar()
}

export function voltar(alternativa = '/') {
  if (profundidade() > 0) window.history.back()
  else navegar(alternativa, { substituir: true })
}

/** Caminho + query atuais; re-renderiza quando a rota muda. */
export function useCaminho(): string {
  return useSyncExternalStore(assinar, caminhoAtual)
}

export type Rota =
  | { tela: 'listas' }
  | { tela: 'lista'; id: string; aba: 'chat' | 'itens' }
  | { tela: 'historico' }
  | { tela: 'perfil' }
  | { tela: 'convite'; codigo: string }
  | { tela: 'desconhecida' }

export function interpretarRota(caminho: string): Rota {
  const [parte = '/', query = ''] = caminho.split('?')
  const segmentos = parte.split('/').filter(Boolean)
  const [primeiro, segundo] = segmentos

  if (!primeiro) return { tela: 'listas' }
  if (primeiro === 'historico' && segmentos.length === 1) return { tela: 'historico' }
  if (primeiro === 'perfil' && segmentos.length === 1) return { tela: 'perfil' }
  if (primeiro === 'lista' && segundo && segmentos.length === 2) {
    const aba = new URLSearchParams(query).get('aba') === 'itens' ? 'itens' : 'chat'
    return { tela: 'lista', id: segundo, aba }
  }
  if (primeiro === 'entrar' && segundo && segmentos.length === 2) {
    return { tela: 'convite', codigo: decodeURIComponent(segundo) }
  }
  return { tela: 'desconhecida' }
}
