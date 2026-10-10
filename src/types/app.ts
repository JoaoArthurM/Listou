// Tipos de domínio do app. As linhas do banco (database.ts, gerado) trazem
// "string" onde o esquema tem check constraint; aqui elas ganham os valores reais.

import type { Unidade } from '@/lib/dinheiro'
import type { Faixa, FaixaAplicada } from '@/lib/precos'
import type { DadosMensagem } from '../../supabase/functions/_shared/schemas'
import type { Tables } from './database'

export type {
  AcaoProposta,
  DadosEtiqueta,
  DadosFoto,
  DadosMensagem,
  DadosProposta,
  Extracao,
  RespostaLerEtiqueta,
  ResultadoCompra,
} from '../../supabase/functions/_shared/schemas'

export type Perfil = Tables<'perfis'>

export type Lista = Omit<Tables<'listas'>, 'status'> & { status: 'ativa' | 'finalizada' }

export type Item = Omit<Tables<'itens'>, 'unidade' | 'faixas_preco' | 'faixa_aplicada' | 'origem_preco'> & {
  unidade: Unidade
  faixas_preco: Faixa[] | null
  faixa_aplicada: FaixaAplicada | null
  origem_preco: 'ia' | 'manual' | null
}

/** Campos de um item que o app altera. */
export type ItemPatch = Partial<
  Pick<
    Item,
    | 'nome'
    | 'unidade'
    | 'qtd_planejada'
    | 'comprado'
    | 'faixas_preco'
    | 'faixa_aplicada'
    | 'preco_unit_centavos'
    | 'qtd_comprada'
    | 'foto_path'
    | 'origem_preco'
  >
>

export type Mensagem = Omit<Tables<'mensagens'>, 'papel' | 'tipo' | 'dados'> & {
  papel: 'usuario' | 'assistente'
  tipo: 'texto' | 'foto' | 'confirmacao' | 'sistema'
  dados: DadosMensagem | null
}

export type Membro = { perfil_id: string; papel: 'dono' | 'membro'; nome: string }

export type Resumo = { total_centavos: number; itens_comprados: number; itens_total: number }

export type ListaComResumo = Lista & { resumo: Resumo; membros: Membro[] }
