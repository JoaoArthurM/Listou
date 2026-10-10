import { createContext, useContext } from 'react'

export type Usuario = { id: string; email: string | null }

export type EstadoSessao = { usuario: Usuario | null; carregando: boolean }

export const ContextoSessao = createContext<EstadoSessao>({ usuario: null, carregando: true })

export function useSessao(): EstadoSessao {
  return useContext(ContextoSessao)
}

/** Para telas que só existem depois do login. */
export function useUsuario(): Usuario {
  const { usuario } = useSessao()
  if (!usuario) throw new Error('useUsuario fora de uma tela autenticada')
  return usuario
}
