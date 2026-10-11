import { useMutation, useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { buscarComprasPassadas, buscarItens, chaves, type NovoItem } from '@/lib/api'
import { MUTACAO, type AdicionarItensVars, type AtualizarItemVars, type RemoverItemVars } from '@/lib/mutacoes'
import { precosAnteriores, type PrecoAnterior } from '@/lib/previsao'

export function useItens(listaId: string) {
  return useQuery({ queryKey: chaves.itens(listaId), queryFn: () => buscarItens(listaId) })
}

// O que cada alteração faz (incluindo o efeito otimista e a fila offline) está
// registrado em src/lib/mutacoes.ts; aqui só se escolhe a chave.

export function useAdicionarItem() {
  return useMutation<void, Error, NovoItem>({ mutationKey: MUTACAO.adicionar })
}

/** Vários itens num pedido só (importação). */
export function useAdicionarItens() {
  return useMutation<void, Error, AdicionarItensVars>({ mutationKey: MUTACAO.adicionarVarios })
}

const SEM_PRECOS = new Map<string, PrecoAnterior>()

/** Preço que cada item custou na compra anterior mais recente, fora a lista aberta. */
export function usePrecosAnteriores(listaId: string): Map<string, PrecoAnterior> {
  const { data } = useQuery({ queryKey: chaves.comprasPassadas, queryFn: buscarComprasPassadas, staleTime: 5 * 60_000 })
  return useMemo(() => (data ? precosAnteriores(data, listaId) : SEM_PRECOS), [data, listaId])
}

export function useAtualizarItem() {
  return useMutation<void, Error, AtualizarItemVars>({ mutationKey: MUTACAO.atualizar })
}

export function useRemoverItem() {
  return useMutation<void, Error, RemoverItemVars>({ mutationKey: MUTACAO.remover })
}
