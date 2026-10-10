import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const url = import.meta.env.VITE_SUPABASE_URL
const chave = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

/** Falso quando o .env não foi preenchido; o app mostra um aviso em vez de quebrar. */
export const supabaseConfigurado = Boolean(url && chave)

// Só a chave publishable entra no navegador. A do Gemini fica como secret da
// Edge Function (regra de ouro 4).
export const supabase = createClient<Database>(url || 'http://localhost', chave || 'sem-chave', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})

export const BUCKET_ETIQUETAS = 'etiquetas'
