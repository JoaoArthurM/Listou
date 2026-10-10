import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { chaves } from '@/lib/api'
import { MUTACAO_ITENS } from '@/lib/mutacoes'
import { supabase } from '@/lib/supabase'
import type { Item } from '@/types/app'

/**
 * Mantém a lista aberta em sincronia com o outro aparelho (seção 7.3): cada
 * mudança em itens, mensagens ou na própria lista invalida o cache
 * correspondente. O Realtime só entrega o que o RLS deixa o usuário ler.
 */
export function useRealtime(listaId: string) {
  const queryClient = useQueryClient()

  useEffect(() => {
    const atualizarItens = () => {
      // Com alteração local na fila, a busca traria um estado mais velho que a
      // tela; quem invalida nesse caso é a própria fila, ao esvaziar.
      if (queryClient.isMutating({ mutationKey: MUTACAO_ITENS }) > 0) return
      void queryClient.invalidateQueries({ queryKey: chaves.itens(listaId) })
    }
    const atualizarMensagens = () => void queryClient.invalidateQueries({ queryKey: chaves.mensagens(listaId) })
    const atualizarLista = () => {
      void queryClient.invalidateQueries({ queryKey: chaves.lista(listaId) })
      void queryClient.invalidateQueries({ queryKey: chaves.membros(listaId) })
    }

    const canal = supabase
      .channel(`lista:${listaId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'itens', filter: `lista_id=eq.${listaId}` }, atualizarItens)
      // O Realtime não filtra DELETE por coluna, e com RLS só a chave primária
      // vem no evento. Ouvimos todos e reagimos só se o id era desta lista.
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'itens' }, (evento) => {
        const id = (evento.old as { id?: string }).id
        const emCache = queryClient.getQueryData<Item[]>(chaves.itens(listaId))
        if (emCache?.some((item) => item.id === id)) atualizarItens()
      })
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'mensagens', filter: `lista_id=eq.${listaId}` },
        atualizarMensagens,
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'listas', filter: `id=eq.${listaId}` }, atualizarLista)
      .subscribe((status) => {
        // Ao (re)conectar, busca o que mudou enquanto o canal estava fora.
        if (status === 'SUBSCRIBED') {
          atualizarItens()
          atualizarMensagens()
          atualizarLista()
        }
      })

    return () => {
      void supabase.removeChannel(canal)
    }
  }, [listaId, queryClient])
}
