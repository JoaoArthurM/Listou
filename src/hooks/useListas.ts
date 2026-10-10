import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  aceitarConvite,
  atualizarLista,
  buscarLista,
  buscarListas,
  buscarMembros,
  buscarPerfil,
  chaves,
  criarConvite,
  criarLista,
  excluirLista,
  responderCartao,
  sairDaLista,
  salvarNome,
  type ListaPatch,
  type NovaLista,
} from '@/lib/api'
import type { Lista } from '@/types/app'
import { useUsuario } from './sessao'

export function usePerfil() {
  const { id } = useUsuario()
  return useQuery({ queryKey: chaves.perfil(id), queryFn: () => buscarPerfil(id) })
}

export function useSalvarNome() {
  const { id } = useUsuario()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (nome: string) => salvarNome(id, nome),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chaves.perfil(id) }),
  })
}

export function useListas(status: Lista['status']) {
  return useQuery({ queryKey: chaves.listas(status), queryFn: () => buscarListas(status) })
}

export function useLista(id: string) {
  return useQuery({ queryKey: chaves.lista(id), queryFn: () => buscarLista(id) })
}

export function useMembros(listaId: string) {
  return useQuery({ queryKey: chaves.membros(listaId), queryFn: () => buscarMembros(listaId), staleTime: 5 * 60_000 })
}

export function useCriarLista() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (nova: NovaLista) => criarLista(nova),
    onSuccess: (lista) => {
      queryClient.setQueryData(chaves.lista(lista.id), lista)
      return queryClient.invalidateQueries({ queryKey: chaves.todasAsListas })
    },
  })
}

export function useAtualizarLista(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (patch: ListaPatch) => atualizarLista(id, patch),
    onSuccess: (lista) => {
      queryClient.setQueryData(chaves.lista(id), lista)
      return queryClient.invalidateQueries({ queryKey: chaves.todasAsListas })
    },
  })
}

export function useExcluirLista() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => excluirLista(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chaves.todasAsListas }),
  })
}

export function useSairDaLista() {
  const { id: perfilId } = useUsuario()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (listaId: string) => sairDaLista(listaId, perfilId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chaves.todasAsListas }),
  })
}

export function useResponderCartao(listaId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ cartao, tem }: { cartao: string; tem: boolean }) => responderCartao(listaId, cartao, tem),
    // A resposta vale para todas as etiquetas seguintes: a lista em cache já
    // muda antes de o servidor confirmar, para o card recalcular na hora.
    onMutate: ({ cartao, tem }) => {
      queryClient.setQueryData<Lista | null>(chaves.lista(listaId), (lista) => {
        if (!lista) return lista
        const sem = (nomes: string[]) => nomes.filter((n) => n !== cartao)
        return {
          ...lista,
          cartoes: tem ? [...sem(lista.cartoes), cartao] : sem(lista.cartoes),
          cartoes_recusados: tem ? sem(lista.cartoes_recusados) : [...sem(lista.cartoes_recusados), cartao],
        }
      })
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: chaves.lista(listaId) }),
  })
}

export function useCriarConvite() {
  return useMutation({ mutationFn: (listaId: string) => criarConvite(listaId) })
}

export function useAceitarConvite() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (codigo: string) => aceitarConvite(codigo),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chaves.todasAsListas }),
  })
}
