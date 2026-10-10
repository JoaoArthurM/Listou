import { useMutation, useQuery } from '@tanstack/react-query'
import { buscarItens, chaves, type NovoItem } from '@/lib/api'
import { MUTACAO, type AtualizarItemVars, type RemoverItemVars } from '@/lib/mutacoes'

export function useItens(listaId: string) {
  return useQuery({ queryKey: chaves.itens(listaId), queryFn: () => buscarItens(listaId) })
}

// O que cada alteração faz (incluindo o efeito otimista e a fila offline) está
// registrado em src/lib/mutacoes.ts; aqui só se escolhe a chave.

export function useAdicionarItem() {
  return useMutation<void, Error, NovoItem>({ mutationKey: MUTACAO.adicionar })
}

export function useAtualizarItem() {
  return useMutation<void, Error, AtualizarItemVars>({ mutationKey: MUTACAO.atualizar })
}

export function useRemoverItem() {
  return useMutation<void, Error, RemoverItemVars>({ mutationKey: MUTACAO.remover })
}
