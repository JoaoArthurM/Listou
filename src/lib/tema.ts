import { useSyncExternalStore } from 'react'

export type Tema = 'claro' | 'escuro' | 'sistema'

const CHAVE = 'listou:tema'
// Preto da moldura (--moldura) nos dois temas: o Android pinta a barra de gestos
// e a de status com essa cor, e a de baixo precisa ficar escura também no claro.
const COR_BARRA = { claro: '#000000', escuro: '#000000' }

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
