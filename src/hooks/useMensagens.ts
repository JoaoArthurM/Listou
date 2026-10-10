import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { atualizarCard, buscarMensagens, chaves, urlDaFoto } from '@/lib/api'
import type { DadosMensagem, Mensagem } from '@/types/app'

export function useMensagens(listaId: string) {
  return useQuery({ queryKey: chaves.mensagens(listaId), queryFn: () => buscarMensagens(listaId) })
}

/** Muda o estado de um card do chat (confirmado, descartado, cancelado). */
export function useAtualizarCard(listaId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: { mensagemId: string; dados: DadosMensagem; itemId?: string | null }) =>
      atualizarCard(vars.mensagemId, vars.dados, vars.itemId),
    onMutate: async ({ mensagemId, dados }) => {
      await queryClient.cancelQueries({ queryKey: chaves.mensagens(listaId) })
      queryClient.setQueryData<Mensagem[]>(chaves.mensagens(listaId), (atuais) =>
        atuais?.map((m) => (m.id === mensagemId ? { ...m, dados } : m)),
      )
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: chaves.mensagens(listaId) }),
  })
}

/** Link assinado da foto da etiqueta. Fica null depois que a foto é apagada (24h). */
export function useFotoUrl(caminho: string | null | undefined) {
  return useQuery({
    queryKey: chaves.foto(caminho ?? ''),
    queryFn: () => urlDaFoto(caminho!),
    enabled: Boolean(caminho),
    staleTime: 50 * 60_000,
    gcTime: 55 * 60_000,
    retry: false,
  })
}
