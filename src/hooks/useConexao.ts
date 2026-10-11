import { useIsMutating } from '@tanstack/react-query'
import { useSinal } from '@/lib/conexao'
import { MUTACAO_ITENS } from '@/lib/mutacoes'

export type Conexao = {
  estado: 'conectando' | 'online' | 'lento' | 'offline' | 'sincronizando'
  /** Alterações de itens que ainda não chegaram ao servidor. */
  pendentes: number
  latenciaMs: number | null
  /** Muda a cada sinal de vida real (resposta do servidor ou dado recebido). */
  batidas: number
}

/** Estado da conexão medido pela sonda (src/lib/conexao.ts) e a fila de alterações. */
export function useConexao(): Conexao {
  const sinal = useSinal()
  const pendentes = useIsMutating({ mutationKey: MUTACAO_ITENS })
  const base = { pendentes, latenciaMs: sinal.latenciaMs, batidas: sinal.batidas }

  if (sinal.estado === 'fora') return { ...base, estado: 'offline' }
  if (sinal.estado === 'verificando') return { ...base, estado: 'conectando' }
  if (pendentes > 0) return { ...base, estado: 'sincronizando' }
  return { ...base, estado: sinal.estado === 'lento' ? 'lento' : 'online' }
}
