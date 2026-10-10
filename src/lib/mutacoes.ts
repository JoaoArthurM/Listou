// Alterações de itens com suporte a offline (CLAUDE.md, seção 7.3).
//
// As funções ficam registradas como padrão do QueryClient, e não dentro dos
// hooks, porque uma alteração feita sem conexão pode sobreviver a um
// recarregamento do app: ela volta do cache persistido só com a chave e as
// variáveis, e o React Query precisa saber o que executar para reenviá-la.

import type { QueryClient } from '@tanstack/react-query'
import type { Item, ItemPatch } from '@/types/app'
import { aplicarPatch, atualizarItem, chaves, ErroDoApp, inserirItem, removerItem, type NovoItem } from './api'
import { avisar } from './avisos'

export const MUTACAO_ITENS = ['itens'] as const
export const MUTACAO = {
  adicionar: ['itens', 'adicionar'],
  atualizar: ['itens', 'atualizar'],
  remover: ['itens', 'remover'],
} as const

export type AtualizarItemVars = { id: string; lista_id: string; patch: ItemPatch }
export type RemoverItemVars = { id: string; lista_id: string }

// Erro com código veio do banco (RLS, check constraint): repetir não resolve.
// Sem código é rede ruim de supermercado: vale tentar de novo.
function tentarDeNovo(tentativas: number, erro: Error): boolean {
  return tentativas < 3 && !(erro instanceof ErroDoApp && erro.codigo)
}

function itemOtimista(novo: NovoItem): Item {
  const base: Item = {
    id: novo.id,
    lista_id: novo.lista_id,
    nome: novo.nome,
    unidade: novo.unidade ?? 'un',
    qtd_planejada: novo.qtd_planejada ?? null,
    comprado: false,
    faixas_preco: null,
    faixa_aplicada: null,
    preco_unit_centavos: null,
    qtd_comprada: null,
    total_centavos: null,
    foto_path: null,
    origem_preco: null,
    adicionado_por: null,
    comprado_por: null,
    comprado_em: null,
    criado_em: new Date().toISOString(),
  }
  const { id: _id, lista_id: _lista, ...patch } = novo
  return aplicarPatch(base, patch)
}

export function registrarMutacoes(queryClient: QueryClient) {
  const editarCache = async (listaId: string, editar: (itens: Item[]) => Item[]) => {
    // Uma busca em andamento sobrescreveria a alteração otimista ao terminar.
    await queryClient.cancelQueries({ queryKey: chaves.itens(listaId) })
    queryClient.setQueryData<Item[]>(chaves.itens(listaId), (atuais) => editar(atuais ?? []))
  }

  // Só busca do servidor quando a fila esvazia; antes disso a resposta ainda
  // não teria as alterações pendentes e a tela "voltaria no tempo".
  const reconciliar = (listaId: string) => {
    if (queryClient.isMutating({ mutationKey: MUTACAO_ITENS }) <= 1) {
      void queryClient.invalidateQueries({ queryKey: chaves.itens(listaId) })
      void queryClient.invalidateQueries({ queryKey: chaves.todasAsListas })
    }
  }

  const comuns = {
    retry: tentarDeNovo,
    // Fila única: as alterações chegam ao banco na ordem em que foram feitas.
    scope: { id: 'itens' },
  }

  queryClient.setMutationDefaults<void, Error, NovoItem, void>(MUTACAO.adicionar, {
    ...comuns,
    mutationFn: (novo: NovoItem) => inserirItem(novo),
    onMutate: (novo: NovoItem) =>
      editarCache(novo.lista_id, (itens) =>
        itens.some((i) => i.id === novo.id) ? itens : [...itens, itemOtimista(novo)],
      ),
    onError: (erro: Error) => avisar(erro.message, 'erro'),
    onSettled: (_dados: unknown, _erro: unknown, novo: NovoItem) => reconciliar(novo.lista_id),
  })

  queryClient.setMutationDefaults<void, Error, AtualizarItemVars, void>(MUTACAO.atualizar, {
    ...comuns,
    mutationFn: ({ id, patch }: AtualizarItemVars) => atualizarItem(id, patch),
    onMutate: ({ id, lista_id, patch }: AtualizarItemVars) =>
      editarCache(lista_id, (itens) => itens.map((i) => (i.id === id ? aplicarPatch(i, patch) : i))),
    onError: (erro: Error) => avisar(erro.message, 'erro'),
    onSettled: (_dados: unknown, _erro: unknown, vars: AtualizarItemVars) => reconciliar(vars.lista_id),
  })

  queryClient.setMutationDefaults<void, Error, RemoverItemVars, void>(MUTACAO.remover, {
    ...comuns,
    mutationFn: ({ id }: RemoverItemVars) => removerItem(id),
    onMutate: ({ id, lista_id }: RemoverItemVars) =>
      editarCache(lista_id, (itens) => itens.filter((i) => i.id !== id)),
    onError: (erro: Error) => avisar(erro.message, 'erro'),
    onSettled: (_dados: unknown, _erro: unknown, vars: RemoverItemVars) => reconciliar(vars.lista_id),
  })
}
