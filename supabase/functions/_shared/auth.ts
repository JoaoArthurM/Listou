// Autenticação das Edge Functions: valida o JWT do usuário e devolve dois
// clientes. "doUsuario" age com o token dele, então o RLS continua valendo
// (é assim que se confere se ele é membro da lista). "admin" ignora o RLS e
// só é usado para o que o usuário não pode escrever: mensagens do assistente,
// registro de uso da IA e limpeza de fotos.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { erro } from './http.ts'

export type Contexto = { usuarioId: string; doUsuario: SupabaseClient; admin: SupabaseClient }

// As chaves novas chegam como JSON { "default": "sb_..." }; as legadas, como texto puro.
function chave(variavelNova: string, variavelLegada: string): string {
  const novas = Deno.env.get(variavelNova)
  if (novas) {
    try {
      const padrao = (JSON.parse(novas) as Record<string, unknown>).default
      if (typeof padrao === 'string' && padrao) return padrao
    } catch {
      // formato inesperado: cai na chave legada
    }
  }
  const legada = Deno.env.get(variavelLegada)
  if (!legada) throw new Error(`nenhuma chave em ${variavelNova} nem em ${variavelLegada}`)
  return legada
}

const semSessao = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }

export async function autenticar(req: Request): Promise<Contexto | Response> {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return erro('Entre na sua conta para continuar.', 401)

  const url = Deno.env.get('SUPABASE_URL')
  if (!url) throw new Error('SUPABASE_URL ausente')

  const doUsuario = createClient(url, chave('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY'), {
    ...semSessao,
    global: { headers: { Authorization: `Bearer ${token}` } },
  })

  const { data, error } = await doUsuario.auth.getUser(token)
  if (error || !data.user) return erro('Sua sessão expirou. Entre de novo.', 401)

  const admin = createClient(url, chave('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY'), semSessao)
  return { usuarioId: data.user.id, doUsuario, admin }
}
