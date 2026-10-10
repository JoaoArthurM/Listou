import { useSyncExternalStore } from 'react'

export type Tema = 'claro' | 'escuro' | 'sistema'

const CHAVE = 'listou:tema'
// Mesmos valores de --background em src/index.css; pintam a barra de status.
const COR_BARRA = { claro: '#FCF9EF', escuro: '#161513' }

const sistemaEscuro = window.matchMedia('(prefers-color-scheme: dark)')
const ouvintes = new Set<() => void>()

export function lerTema(): Tema {
  try {
    const salvo = localStorage.getItem(CHAVE)
    if (salvo === 'claro' || salvo === 'escuro') return salvo
  } catch {
    // armazenamento bloqueado: segue o sistema
  }
  return 'sistema'
}

function aplicar() {
  const tema = lerTema()
  const escuro = tema === 'escuro' || (tema === 'sistema' && sistemaEscuro.matches)
  document.documentElement.classList.toggle('dark', escuro)
  document
    .getElementById('meta-tema')
    ?.setAttribute('content', escuro ? COR_BARRA.escuro : COR_BARRA.claro)
}

export function definirTema(tema: Tema) {
  try {
    if (tema === 'sistema') localStorage.removeItem(CHAVE)
    else localStorage.setItem(CHAVE, tema)
  } catch {
    // sem armazenamento a escolha vale só para esta visita
  }
  aplicar()
  for (const ouvinte of ouvintes) ouvinte()
}

sistemaEscuro.addEventListener('change', aplicar)

function assinar(ouvinte: () => void) {
  ouvintes.add(ouvinte)
  return () => {
    ouvintes.delete(ouvinte)
  }
}

export function useTema(): Tema {
  return useSyncExternalStore(assinar, lerTema)
}
