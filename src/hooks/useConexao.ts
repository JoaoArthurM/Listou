import { onlineManager, useIsMutating } from '@tanstack/react-query'
import { useSyncExternalStore } from 'react'
import { MUTACAO_ITENS } from '@/lib/mutacoes'

export type Conexao = { estado: 'online' | 'offline' | 'sincronizando'; pendentes: number }

const assinar = (ouvinte: () => void) => onlineManager.subscribe(ouvinte)
const estaOnline = () => onlineManager.isOnline()

/** Estado da conexão e quantas alterações de itens ainda não chegaram ao servidor. */
export function useConexao(): Conexao {
  const online = useSyncExternalStore(assinar, estaOnline)
  const pendentes = useIsMutating({ mutationKey: MUTACAO_ITENS })
  if (!online) return { estado: 'offline', pendentes }
  return { estado: pendentes > 0 ? 'sincronizando' : 'online', pendentes }
}
