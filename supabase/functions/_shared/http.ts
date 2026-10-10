// Respostas HTTP das Edge Functions. Erros saem como { erro: "texto para o
// usuário" }: o app mostra essa frase direto no chat.

export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-api-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export function json(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

export function erro(mensagem: string, status: number): Response {
  return json({ erro: mensagem }, status)
}

declare const EdgeRuntime: { waitUntil(promessa: Promise<unknown>): void } | undefined

/** Roda uma tarefa depois da resposta, sem atrasar o usuário (limpeza de fotos, registro de uso). */
export function emSegundoPlano(tarefa: Promise<unknown>) {
  const segura = tarefa.catch((e) => console.error('tarefa em segundo plano falhou', e))
  if (typeof EdgeRuntime !== 'undefined') EdgeRuntime.waitUntil(segura)
}
