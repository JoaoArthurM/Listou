// Alterações que o servidor recusou ou que não chegaram depois das tentativas.
// O aviso rápido (toast) some em segundos; esta lista fica até a pessoa ler,
// para ninguém achar que algo foi salvo quando não foi. Fica fora do React,
// como os avisos, porque quem registra é a camada de dados.

import { useSyncExternalStore } from 'react'

export type Falha = { id: number; o_que: string; motivo: string; quando: number }

let falhas: Falha[] = []
let proximoId = 1
const ouvintes = new Set<() => void>()

function publicar(novas: Falha[]) {
  falhas = novas
  for (const ouvinte of ouvintes) ouvinte()
}

export function registrarFalha(o_que: string, motivo: string) {
  publicar([...falhas, { id: proximoId++, o_que, motivo, quando: Date.now() }].slice(-20))
}

export function limparFalhas() {
  if (falhas.length > 0) publicar([])
}

function assinar(ouvinte: () => void) {
  ouvintes.add(ouvinte)
  return () => {
    ouvintes.delete(ouvinte)
  }
}

export function useFalhas(): Falha[] {
  return useSyncExternalStore(assinar, () => falhas)
}
