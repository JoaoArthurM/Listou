// Ajustes das Edge Functions que não são segredo.

/**
 * false (padrão): a foto da etiqueta é apagada 24h depois da confirmação do
 * preço. true: fica guardada, para um futuro histórico de preços (seção 5).
 */
export const MANTER_FOTOS = false
export const HORAS_ATE_APAGAR_FOTO = 24

/** Usado quando o secret GEMINI_MODEL não está definido. */
export const MODELO_PADRAO = 'gemini-3.5-flash-lite'

export const BUCKET_ETIQUETAS = 'etiquetas'
