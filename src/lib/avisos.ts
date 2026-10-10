// Avisos rápidos (toasts). Fica fora do React para a camada de dados também
// poder avisar, por exemplo quando uma alteração feita offline é recusada.

import { useSyncExternalStore } from 'react'

export type Aviso = { id: number; texto: string; tipo: 'info' | 'erro' | 'sucesso' }

let avisos: Aviso[] = []
let proximoId = 1
const ouvintes = new Set<() => void>()

function publicar(novos: Aviso[]) {
  avisos = novos
  for (const ouvinte of ouvintes) ouvinte()
}

export function dispensarAviso(id: number) {
  publicar(avisos.filter((a) => a.id !== id))
}

export function avisar(texto: string, tipo: Aviso['tipo'] = 'info') {
  const id = proximoId++
  // No máximo três na tela; repetir o mesmo texto só renova o aviso.
  publicar([...avisos.filter((a) => a.texto !== texto).slice(-2), { id, texto, tipo }])
  window.setTimeout(() => dispensarAviso(id), tipo === 'erro' ? 6000 : 3500)
}

function assinar(ouvinte: () => void) {
  ouvintes.add(ouvinte)
  return () => {
    ouvintes.delete(ouvinte)
  }
}

export function useAvisos(): Aviso[] {
  return useSyncExternalStore(assinar, () => avisos)
}
