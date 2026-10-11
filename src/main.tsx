import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { App } from './App'
import { SessaoProvider } from './components/SessaoProvider'
import { Toaster } from './components/ui/toaster'
import './index.css'
import { iniciarSonda } from './lib/conexao'
import { persistencia, queryClient } from './lib/queryClient'
import { acompanharTeclado } from './lib/teclado'
import './lib/tema'

acompanharTeclado()
iniciarSonda(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY)

// Service worker do PWA: guarda o app para abrir sem conexão e se atualiza sozinho.
registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={persistencia}
      // Cache restaurado: reenvia o que ficou na fila offline e só então busca
      // do servidor, para a resposta não apagar o que ainda não foi enviado.
      onSuccess={() => queryClient.resumePausedMutations().then(() => queryClient.invalidateQueries())}
    >
      <SessaoProvider>
        <App />
        <Toaster />
      </SessaoProvider>
    </PersistQueryClientProvider>
  </StrictMode>,
)
