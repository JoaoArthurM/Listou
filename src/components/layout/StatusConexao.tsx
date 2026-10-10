import { CloudOff, RefreshCw } from 'lucide-react'
import { useConexao } from '@/hooks/useConexao'
import { cn } from '@/lib/utils'

/** Indicador de conexão: online, offline (com a fila) ou sincronizando. */
export function StatusConexao({ className }: { className?: string }) {
  const { estado, pendentes } = useConexao()

  const base = 'inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[0.8125rem] font-medium'

  if (estado === 'offline') {
    return (
      <span role="status" className={cn(base, 'bg-destaque text-destaque-foreground', className)}>
        <CloudOff aria-hidden className="size-3.5" />
        {pendentes > 0 ? `Offline · ${pendentes} na fila` : 'Offline'}
      </span>
    )
  }

  if (estado === 'sincronizando') {
    return (
      <span role="status" className={cn(base, 'bg-muted text-foreground', className)}>
        <RefreshCw aria-hidden className="size-3.5 animate-spin" />
        Sincronizando
      </span>
    )
  }

  return (
    <span role="status" className={cn(base, 'text-muted-foreground', className)}>
      <span aria-hidden className="size-2 rounded-full bg-sucesso" />
      Online
    </span>
  )
}
