// Limpeza das fotos de etiqueta (CLAUDE.md, seção 5): por padrão a foto é
// apagada 24h depois da confirmação do preço.
//
// Em vez de um job agendado, a limpeza roda em segundo plano a cada leitura de
// etiqueta. Quem usa o app dispara a faxina; se ninguém usa, não há foto nova
// para apagar. O ponto fraco é uma lista abandonada logo depois da compra: as
// fotos dela só somem quando alguém ler outra etiqueta. Para um prazo rígido,
// troque por pg_cron chamando uma função dedicada.

import type { SupabaseClient } from '@supabase/supabase-js'
import { BUCKET_ETIQUETAS, HORAS_ATE_APAGAR_FOTO, MANTER_FOTOS } from './config.ts'

const LOTE = 100

export async function limparFotosAntigas(admin: SupabaseClient, listaId: string): Promise<void> {
  if (MANTER_FOTOS) return
  const limite = new Date(Date.now() - HORAS_ATE_APAGAR_FOTO * 3_600_000).toISOString()
  const bucket = admin.storage.from(BUCKET_ETIQUETAS)

  // 1. Fotos de compras confirmadas há mais de 24h, em qualquer lista.
  const { data: vencidos, error } = await admin
    .from('itens')
    .select('id, foto_path')
    .not('foto_path', 'is', null)
    .lt('comprado_em', limite)
    .limit(LOTE)
  if (error) throw error

  if (vencidos && vencidos.length > 0) {
    const { error: erroRemover } = await bucket.remove(vencidos.map((i) => i.foto_path as string))
    if (erroRemover) throw erroRemover
    await admin.from('itens').update({ foto_path: null }).in('id', vencidos.map((i) => i.id))
  }

  // 2. Fotos desta lista que nunca viraram compra (card descartado, leitura
  //    que falhou) e já passaram do prazo.
  const [{ data: arquivos }, { data: emUso }] = await Promise.all([
    bucket.list(listaId, { limit: LOTE * 2 }),
    admin.from('itens').select('foto_path').eq('lista_id', listaId).not('foto_path', 'is', null),
  ])
  const usadas = new Set((emUso ?? []).map((i) => i.foto_path as string))
  const orfas = (arquivos ?? [])
    .filter((a) => a.created_at && a.created_at < limite)
    .map((a) => `${listaId}/${a.name}`)
    .filter((caminho) => !usadas.has(caminho))
  if (orfas.length > 0) await bucket.remove(orfas)
}
