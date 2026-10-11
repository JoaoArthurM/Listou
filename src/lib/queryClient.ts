import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import { QueryClient } from '@tanstack/react-query'
import type { PersistQueryClientOptions } from '@tanstack/react-query-persist-client'
import { limparFalhas } from './falhas'
import { registrarMutacoes } from './mutacoes'

const SEMANA = 1000 * 60 * 60 * 24 * 7

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Precisa durar pelo menos o maxAge da persistência, senão o cache
      // restaurado é descartado antes de ser usado offline.
      gcTime: SEMANA,
      retry: 1,
    },
    mutations: { gcTime: SEMANA },
  },
})

registrarMutacoes(queryClient)

const persister = createSyncStoragePersister({
  storage: window.localStorage,
  key: 'listou:cache',
  throttleTime: 1000,
})

// Listas, itens e conversa ficam no aparelho para o app abrir sem conexão
// dentro do mercado. As alterações feitas offline (pausadas) também.
export const persistencia: Omit<PersistQueryClientOptions, 'queryClient'> = {
  persister,
  maxAge: SEMANA,
  buster: 'v1',
  dehydrateOptions: {
    // Links assinados de foto vencem em uma hora: não vale guardar.
    shouldDehydrateQuery: (query) => query.state.status === 'success' && query.queryKey[0] !== 'foto',
  },
}

/** Ao sair da conta, nada do usuário anterior fica no aparelho. */
export function limparCacheLocal() {
  queryClient.clear()
  limparFalhas()
  void persister.removeClient()
}
