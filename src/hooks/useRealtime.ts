import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { chaves } from '@/lib/api'
import { registrarAtividade } from '@/lib/conexao'
import { MUTACAO_ITENS } from '@/lib/mutacoes'
import { supabase } from '@/lib/supabase'
import type { Item } from '@/types/app'

/** O que alguém com a lista aberta está fazendo agora. */
type Atividade = { digitando: boolean; esperandoIA: boolean }

export type Presente = Atividade & { id: string; nome: string }

export type AoVivo = {
  canal: 'conectando' | 'conectado' | 'erro'
  /** Quem, além de mim, está digitando ou esperando a IA nesta lista agora. */
  outros: Presente[]
  /** Conta aos outros o que estou fazendo (digitando, esperando a IA). */
  anunciar: (mudanca: Partial<Atividade>) => void
}

const EVENTO = 'atividade'
// Enquanto dura, o aviso é repetido; quem recebe esquece o que não for
// renovado. Assim ninguém fica "digitando" para sempre se o outro aparelho
// fechar o app ou perder o sinal no meio.
const REPETIR_MS = 3000
const VALIDADE_MS = 7000

/**
 * Mantém a lista aberta em sincronia com o outro aparelho (seção 7.3), em dois
 * canais separados:
 *
 * - "lista:{id}": cada mudança em itens, mensagens ou na própria lista
 *   invalida o cache correspondente.
 * - "lista:{id}:atividade": quem está digitando e quem está esperando a IA.
 *   É Broadcast, efêmero, não passa pelo banco; o canal é privado e só entra
 *   membro da lista. Fica à parte para uma falha aqui nunca derrubar os dados.
 */
export function useRealtime(listaId: string, eu: { id: string; nome: string }): AoVivo {
  const queryClient = useQueryClient()
  const [canal, setCanal] = useState<AoVivo['canal']>('conectando')
  const [outros, setOutros] = useState<Presente[]>([])
  const atividade = useRef<Atividade>({ digitando: false, esperandoIA: false })
  const nome = useRef(eu.nome)
  nome.current = eu.nome
  const enviar = useRef<() => void>(() => {})

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
    // Todo dado que chega é também prova de conexão viva: o indicador pulsa.
    const aoReceber = (acao: () => void) => () => {
      registrarAtividade()
      acao()
    }

    const assinatura = supabase
      .channel(`lista:${listaId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'itens', filter: `lista_id=eq.${listaId}` }, aoReceber(atualizarItens))
      // O Realtime não filtra DELETE por coluna, e com RLS só a chave primária
      // vem no evento. Ouvimos todos e reagimos só se o id era desta lista.
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'itens' }, (evento) => {
        const id = (evento.old as { id?: string }).id
        const emCache = queryClient.getQueryData<Item[]>(chaves.itens(listaId))
        if (emCache?.some((item) => item.id === id)) aoReceber(atualizarItens)()
      })
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'mensagens', filter: `lista_id=eq.${listaId}` },
        aoReceber(atualizarMensagens),
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'listas', filter: `id=eq.${listaId}` }, aoReceber(atualizarLista))
      .subscribe((status) => {
        setCanal(status === 'SUBSCRIBED' ? 'conectado' : status === 'CLOSED' ? 'conectando' : 'erro')
        // Ao (re)conectar, busca o que mudou enquanto o canal estava fora.
        if (status === 'SUBSCRIBED') {
          atualizarItens()
          atualizarMensagens()
          atualizarLista()
        }
      })

    return () => {
      void supabase.removeChannel(assinatura)
    }
  }, [listaId, queryClient])

  useEffect(() => {
    const vistos = new Map<string, Presente & { ate: number }>()
    const publicar = () => setOutros([...vistos.values()].map(({ id, nome, digitando, esperandoIA }) => ({ id, nome, digitando, esperandoIA })))

    const avisos = supabase
      .channel(`lista:${listaId}:atividade`, { config: { private: true } })
      .on('broadcast', { event: EVENTO }, ({ payload }) => {
        const aviso = payload as Partial<Presente>
        // O mesmo usuário em dois aparelhos não avisa a si mesmo.
        if (typeof aviso.id !== 'string' || aviso.id === eu.id) return
        if (aviso.digitando === true || aviso.esperandoIA === true) {
          vistos.set(aviso.id, {
            id: aviso.id,
            nome: typeof aviso.nome === 'string' ? aviso.nome : '',
            digitando: aviso.digitando === true,
            esperandoIA: aviso.esperandoIA === true,
            ate: Date.now() + VALIDADE_MS,
          })
        } else vistos.delete(aviso.id)
        publicar()
      })
      .subscribe()

    const mandar = () => {
      // Fora do canal não há a quem avisar; a próxima repetição cobre.
      if (avisos.state !== 'joined') return
      void avisos.send({ type: 'broadcast', event: EVENTO, payload: { id: eu.id, nome: nome.current, ...atividade.current } })
    }
    enviar.current = mandar

    const relogio = window.setInterval(() => {
      if (atividade.current.digitando || atividade.current.esperandoIA) mandar()
      const agora = Date.now()
      let mudou = false
      for (const [id, aviso] of vistos) {
        if (aviso.ate < agora) {
          vistos.delete(id)
          mudou = true
        }
      }
      if (mudou) publicar()
    }, REPETIR_MS)

    return () => {
      enviar.current = () => {}
      window.clearInterval(relogio)
      setOutros([])
      void supabase.removeChannel(avisos)
    }
  }, [listaId, eu.id])

  const anunciar = useCallback<AoVivo['anunciar']>((mudanca) => {
    const novo = { ...atividade.current, ...mudanca }
    if (novo.digitando === atividade.current.digitando && novo.esperandoIA === atividade.current.esperandoIA) return
    atividade.current = novo
    enviar.current()
  }, [])

  return { canal, outros, anunciar }
}
