import { CloudOff, RefreshCw } from 'lucide-react'
import { useConexao } from '@/hooks/useConexao'
import { cn } from '@/lib/utils'

type StatusConexaoProps = {
  /** Estado do canal em tempo real da lista aberta, quando há um. */
  canal?: 'conectando' | 'conectado' | 'erro'
  className?: string
}

/**
 * Barras de sinal. Quantas ficam cheias depende do tempo de resposta medido;
 * a cada sinal de vida real (resposta do servidor, dado chegando do outro
 * aparelho) elas piscam em sequência. Enquanto procura conexão, ficam em onda.
 */
function Barras({ cheias, batidas, buscando }: { cheias: number; batidas: number; buscando: boolean }) {
  return (
    // A chave reinicia a animação a cada batida.
    <span key={buscando ? 'buscando' : batidas} aria-hidden className="flex h-3 items-end gap-[2px]">
      {[5, 8, 12].map((altura, i) => (
        <span
          key={altura}
          style={{ height: altura, animationDelay: `${i * 110}ms` }}
          className={cn(
            'w-[3px] rounded-full',
            i < cheias ? 'bg-sucesso' : 'bg-controle/50',
            buscando ? 'animate-pulso bg-controle' : i < cheias && 'animate-sinal',
          )}
        />
      ))}
    </span>
  )
}

/** Indicador de conexão: mostra o que a sonda mediu, não o que o navegador supõe. */
export function StatusConexao({ canal, className }: StatusConexaoProps) {
  const { estado, pendentes, fotosNaFila, latenciaMs, batidas } = useConexao()
  // Alterações de itens e fotos de etiqueta que esperam o sinal voltar.
  const naFila = pendentes + fotosNaFila
  const base = 'inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[0.8125rem] font-medium'

  if (estado === 'offline') {
    return (
      <span role="status" className={cn(base, 'bg-destaque text-destaque-foreground', className)}>
        <CloudOff aria-hidden className="size-3.5" />
        {naFila > 0 ? `Offline · ${naFila} na fila` : 'Offline'}
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

  // Servidor responde, mas o canal em tempo real da lista ainda não entrou (ou caiu).
  const semCanal = canal === 'conectando' || canal === 'erro'
  const buscando = estado === 'conectando' || semCanal
  const lento = estado === 'lento'
  const cheias = buscando ? 0 : lento ? 1 : latenciaMs !== null && latenciaMs > 600 ? 2 : 3
  const rotulo = estado === 'conectando' ? 'Conectando' : semCanal ? 'Reconectando' : lento ? 'Conexão lenta' : 'Online'

  return (
    <span
      role="status"
      title={latenciaMs === null ? undefined : `Servidor respondeu em ${latenciaMs} ms`}
      className={cn(base, lento ? 'text-foreground' : 'text-muted-foreground', className)}
    >
      <Barras cheias={cheias} batidas={batidas} buscando={buscando} />
      {rotulo}
    </span>
  )
}
