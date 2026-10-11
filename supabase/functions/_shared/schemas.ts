// Contratos das Edge Functions. Tudo que vem do Gemini ou do navegador passa
// por estes schemas antes de tocar no banco: resposta inválida vira erro
// tratável, nunca valor inventado.
//
// O frontend importa só os tipos daqui (import type), então o Zod não entra
// no bundle do app.

import { z } from 'zod'
import { normalizarCartao, type Faixa } from './precos.ts'

const MAX_CENTAVOS = 99_999_999
const MAX_QUANTIDADE = 9999

const uuid = z.string().uuid()
const unidade = z.enum(['un', 'kg'])
const centavos = z.number().int().min(0).max(MAX_CENTAVOS)
const quantidade = z.number().positive().max(MAX_QUANTIDADE)

// ---------------------------------------------------------------------------
// ler-etiqueta
// ---------------------------------------------------------------------------

export const lerEtiquetaEntradaSchema = z
  .object({
    lista_id: uuid,
    foto_path: z.string().regex(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.jpg$/i, 'foto_path inválido'),
  })
  .refine((v) => v.foto_path.toLowerCase().startsWith(`${v.lista_id.toLowerCase()}/`), {
    message: 'a foto precisa estar na pasta da lista',
    path: ['foto_path'],
  })

export const faixaSchema = z.object({
  tipo: z.enum(['varejo', 'atacado', 'cartao']),
  preco_centavos: centavos,
  qtd_minima: z.number().int().min(1).max(MAX_QUANTIDADE),
  cartao: z.string().trim().min(1).max(60).nullable(),
})

/** O que o Gemini devolve ao ler a etiqueta (seção 6.1). */
export const extracaoSchema = z.object({
  produto: z.string().trim().min(1).max(120),
  unidade,
  faixas: z.array(faixaSchema).max(6),
  item_sugerido_id: uuid.nullable(),
  confianca: z.enum(['alta', 'media', 'baixa']),
  observacao: z.string().trim().max(300).default(''),
})

export type Extracao = z.infer<typeof extracaoSchema>

/**
 * Regras que não dependem da IA acertar: nome de cartão normalizado, sugestão
 * de item só se o id existir na lista e confiança baixa sempre que o varejo
 * faltar ou os preços parecerem trocados. Com confiança baixa o card pede o
 * preço em vez de calcular.
 */
export function normalizarExtracao(extracao: Extracao, idsDaLista: string[]): Extracao {
  const vistos = new Set<string>()
  const faixas: Faixa[] = []
  for (const f of extracao.faixas) {
    const cartao = f.cartao ? normalizarCartao(f.cartao) : null
    // Faixa de cartão sem nome não pode virar preço para todo mundo.
    const faixa: Faixa = { ...f, cartao: f.tipo === 'cartao' ? cartao || 'cartao da loja' : cartao }
    const chave = `${faixa.tipo}|${faixa.preco_centavos}|${faixa.qtd_minima}|${faixa.cartao}`
    if (!vistos.has(chave)) {
      vistos.add(chave)
      faixas.push(faixa)
    }
  }

  const varejos = faixas.filter((f) => f.tipo === 'varejo').map((f) => f.preco_centavos)
  const menorVarejo = varejos.length > 0 ? Math.min(...varejos) : null
  let confianca = extracao.confianca
  let observacao = extracao.observacao

  if (menorVarejo === null) {
    confianca = 'baixa'
    observacao ||= 'Não consegui ler o preço de varejo.'
  } else if (faixas.some((f) => f.tipo !== 'varejo' && f.preco_centavos > menorVarejo)) {
    // Atacado ou cartão mais caro que o varejo quase sempre é leitura trocada.
    confianca = 'baixa'
    observacao ||= 'Os preços lidos parecem trocados.'
  }

  return {
    ...extracao,
    faixas,
    confianca,
    observacao,
    item_sugerido_id:
      extracao.item_sugerido_id && idsDaLista.includes(extracao.item_sugerido_id)
        ? extracao.item_sugerido_id
        : null,
  }
}

// ---------------------------------------------------------------------------
// chat
// ---------------------------------------------------------------------------

// Áudio de até ~25 s em WAV mono 16 kHz dá perto de 1,1 MB em base64.
const MAX_AUDIO_BASE64 = 1_600_000

/** O pedido chega escrito (mensagem) ou falado (audio), nunca os dois. */
export const chatEntradaSchema = z
  .object({
    lista_id: uuid,
    mensagem: z.string().trim().min(1).max(1000).optional(),
    audio: z
      .object({
        data: z.string().min(100).max(MAX_AUDIO_BASE64).regex(/^[A-Za-z0-9+/]+=*$/, 'áudio fora do formato base64'),
        mime_type: z.enum(['audio/wav', 'audio/webm', 'audio/ogg', 'audio/m4a', 'audio/aac', 'audio/mp3']),
      })
      .optional(),
  })
  .refine((v) => (v.mensagem === undefined) !== (v.audio === undefined), {
    message: 'envie mensagem ou audio, um dos dois',
  })

/** Ações permitidas (seção 6.2). "informar_quantidade" responde ao último card de etiqueta aberto (7.2.5). */
export const acaoSchema = z.discriminatedUnion('tipo', [
  z.object({
    tipo: z.literal('adicionar_item'),
    nome: z.string().trim().min(1).max(80),
    qtd: quantidade.optional(),
    unidade: unidade.optional(),
  }),
  z.object({ tipo: z.literal('remover_item'), item_id: uuid }),
  // Sem preço, só põe o item no carrinho (fica fora do total até alguém informar).
  z.object({
    tipo: z.literal('marcar_comprado'),
    item_id: uuid,
    qtd: quantidade.optional(),
    preco_centavos: centavos.optional(),
  }),
  z.object({ tipo: z.literal('desmarcar_comprado'), item_id: uuid }),
  z.object({ tipo: z.literal('consultar_faltantes') }),
  z.object({ tipo: z.literal('consultar_total') }),
  z.object({ tipo: z.literal('informar_quantidade'), qtd: quantidade }),
  z.object({ tipo: z.literal('responder'), texto: z.string().trim().min(1).max(600) }),
])

export type Acao = z.infer<typeof acaoSchema>

const MAX_ACOES = 12

function semNulos(valor: unknown): unknown {
  if (valor === null || typeof valor !== 'object' || Array.isArray(valor)) return valor
  return Object.fromEntries(Object.entries(valor).filter(([, v]) => v !== null))
}

/**
 * Valida a resposta do Gemini ação por ação. O modelo preenche com null os
 * campos que não se aplicam, então eles saem antes da validação. Ação inválida
 * é descartada (e contada), nunca "consertada".
 */
export function interpretarAcoes(bruto: unknown): { acoes: Acao[]; descartadas: number; transcricao: string | null } {
  const lista = z
    .object({ acoes: z.array(z.unknown()), transcricao: z.string().trim().max(1000).nullish() })
    .safeParse(bruto)
  if (!lista.success) throw new Error('resposta do modelo sem a lista de ações')

  const acoes: Acao[] = []
  let descartadas = 0
  for (const item of lista.data.acoes.slice(0, MAX_ACOES)) {
    const acao = acaoSchema.safeParse(semNulos(item))
    if (acao.success) acoes.push(acao.data)
    else descartadas += 1
  }
  descartadas += Math.max(0, lista.data.acoes.length - MAX_ACOES)
  // Só existe quando o pedido veio falado: é o que a IA ouviu.
  return { acoes, descartadas, transcricao: lista.data.transcricao || null }
}

// ---------------------------------------------------------------------------
// mensagens.dados: payload estruturado dos cards do chat
// ---------------------------------------------------------------------------

export const resultadoCompraSchema = z.object({
  nome: z.string(),
  unidade,
  qtd: quantidade,
  preco_unit_centavos: centavos,
  faixa_aplicada: z.enum(['varejo', 'atacado', 'cartao', 'manual']),
  cartao: z.string().nullable(),
  total_centavos: centavos,
})

export type ResultadoCompra = z.infer<typeof resultadoCompraSchema>

export const dadosFotoSchema = z.object({ tipo: z.literal('foto'), foto_path: z.string() })

/** Card de quantidade (seção 7.2, passo 4). */
export const dadosEtiquetaSchema = z.object({
  tipo: z.literal('etiqueta'),
  estado: z.enum(['aberto', 'confirmado', 'descartado']),
  foto_path: z.string(),
  extracao: extracaoSchema,
  resultado: resultadoCompraSchema.optional(),
})

/** Ações que só rodam depois de o usuário confirmar no app. */
export const acaoPropostaSchema = z.discriminatedUnion('tipo', [
  z.object({ tipo: z.literal('remover_item'), item_id: uuid, nome: z.string() }),
  z.object({ tipo: z.literal('desmarcar_comprado'), item_id: uuid, nome: z.string() }),
  z.object({
    tipo: z.literal('marcar_comprado'),
    item_id: uuid,
    nome: z.string(),
    unidade,
    qtd: quantidade,
    preco_centavos: centavos,
  }),
])

export const dadosPropostaSchema = z.object({
  tipo: z.literal('proposta'),
  estado: z.enum(['pendente', 'confirmada', 'cancelada']),
  acoes: z.array(acaoPropostaSchema).min(1),
})

export const dadosMensagemSchema = z.discriminatedUnion('tipo', [
  dadosFotoSchema,
  dadosEtiquetaSchema,
  dadosPropostaSchema,
])

export type DadosFoto = z.infer<typeof dadosFotoSchema>
export type DadosEtiqueta = z.infer<typeof dadosEtiquetaSchema>
export type AcaoProposta = z.infer<typeof acaoPropostaSchema>
export type DadosProposta = z.infer<typeof dadosPropostaSchema>
export type DadosMensagem = z.infer<typeof dadosMensagemSchema>

/** Resposta de ler-etiqueta: a extração da seção 6.1 mais o id do card criado no chat. */
export type RespostaLerEtiqueta = Extracao & { mensagem_id: string }
