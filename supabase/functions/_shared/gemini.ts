// Cliente do Gemini (CLAUDE.md, seção 6.3), pela Interactions API, que é a
// recomendada pela documentação oficial para projetos novos:
// https://ai.google.dev/gemini-api/docs/interactions
//
// - Saída estruturada nativa (response_format com JSON Schema), não "peça JSON
//   no prompt". Mesmo assim, quem chama valida a resposta com Zod.
// - store: false, para o Google não guardar as conversas nem as fotos.
// - A chave fica no secret GEMINI_API_KEY e nunca chega ao navegador.
// - Timeout de 20s e uma única nova tentativa em erro 5xx ou 429.

import type { SupabaseClient } from '@supabase/supabase-js'
import { MODELO_PADRAO } from './config.ts'

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/interactions'
const TIMEOUT_MS = 20_000
const ESPERA_ANTES_DE_REPETIR_MS = 800

export type ParteDeEntrada =
  | { type: 'text'; text: string }
  | { type: 'image'; data: string; mime_type: string }
  | { type: 'audio'; data: string; mime_type: string }

export type RespostaGemini = { json: unknown; modelo: string; tokensEntrada: number; tokensSaida: number }

export class ErroGemini extends Error {
  constructor(
    mensagem: string,
    readonly status?: number,
  ) {
    super(mensagem)
    this.name = 'ErroGemini'
  }
}

type Interacao = {
  status?: string
  steps?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>
  usage?: { total_input_tokens?: number; total_output_tokens?: number; total_thought_tokens?: number }
  error?: { message?: string }
}

// O texto da resposta fica nos blocos "text" do passo "model_output".
function textoDaResposta(interacao: Interacao): string {
  return (interacao.steps ?? [])
    .filter((passo) => passo.type === 'model_output')
    .flatMap((passo) => passo.content ?? [])
    .filter((bloco) => bloco.type === 'text' && typeof bloco.text === 'string')
    .map((bloco) => bloco.text)
    .join('')
}

async function chamar(chave: string, corpo: string): Promise<Response> {
  return await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': chave },
    body: corpo,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
}

export async function gerarJson(pedido: {
  instrucao: string
  entrada: ParteDeEntrada[]
  schema: Record<string, unknown>
}): Promise<RespostaGemini> {
  const chave = Deno.env.get('GEMINI_API_KEY')
  if (!chave) throw new ErroGemini('secret GEMINI_API_KEY não configurado')

  const modelo = Deno.env.get('GEMINI_MODEL') || MODELO_PADRAO
  const corpo = JSON.stringify({
    model: modelo,
    system_instruction: pedido.instrucao,
    input: pedido.entrada,
    response_format: { type: 'text', mime_type: 'application/json', schema: pedido.schema },
    store: false,
  })

  let resposta: Response
  try {
    resposta = await chamar(chave, corpo)
    if (resposta.status === 429 || resposta.status >= 500) {
      console.warn(`gemini respondeu ${resposta.status}; tentando mais uma vez`)
      await resposta.body?.cancel()
      await new Promise((resolver) => setTimeout(resolver, ESPERA_ANTES_DE_REPETIR_MS))
      resposta = await chamar(chave, corpo)
    }
  } catch (e) {
    const estourou = e instanceof DOMException && e.name === 'TimeoutError'
    throw new ErroGemini(estourou ? `gemini não respondeu em ${TIMEOUT_MS / 1000}s` : `falha de rede ao chamar o gemini: ${e}`)
  }

  if (!resposta.ok) {
    // O corpo do erro vai só para o log; nunca para o usuário.
    throw new ErroGemini(`gemini ${resposta.status}: ${(await resposta.text()).slice(0, 500)}`, resposta.status)
  }

  const interacao = (await resposta.json()) as Interacao
  if (interacao.status && interacao.status !== 'completed') {
    throw new ErroGemini(`interação terminou como "${interacao.status}": ${interacao.error?.message ?? ''}`)
  }

  const texto = textoDaResposta(interacao)
  let json: unknown
  try {
    json = JSON.parse(texto)
  } catch {
    throw new ErroGemini(`resposta do gemini não é JSON: ${texto.slice(0, 200)}`)
  }

  const uso = interacao.usage ?? {}
  return {
    json,
    modelo,
    tokensEntrada: uso.total_input_tokens ?? 0,
    // O raciocínio do modelo é cobrado como saída.
    tokensSaida: (uso.total_output_tokens ?? 0) + (uso.total_thought_tokens ?? 0),
  }
}

/** Registra o consumo em uso_ia para acompanhar custo. Falhar aqui não derruba o pedido. */
export async function registrarUso(admin: SupabaseClient, listaId: string, funcao: string, resposta: RespostaGemini) {
  const { error } = await admin.from('uso_ia').insert({
    lista_id: listaId,
    funcao,
    modelo: resposta.modelo,
    tokens_entrada: resposta.tokensEntrada,
    tokens_saida: resposta.tokensSaida,
  })
  if (error) console.error('não registrou uso_ia', error)
}
