import { AlertTriangle, CloudOff, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Sheet } from '@/components/ui/sheet'
import { useConexao } from '@/hooks/useConexao'
import { limparFalhas, useFalhas } from '@/lib/falhas'
import { useFilaDeFotos } from '@/lib/filaDeFotos'
import { cn, plural } from '@/lib/utils'

type StatusConexaoProps = {
  /** Estado do canal em tempo real da lista aberta, quando há um. */
  canal?: 'conectando' | 'conectado' | 'erro'
  /** Online sem problema vira só as barras de sinal; os outros estados mantêm o texto. */
  compacto?: boolean
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
export function StatusConexao({ canal, compacto, className }: StatusConexaoProps) {
  const { estado, pendentes, fotosNaFila, latenciaMs, batidas } = useConexao()
  const falhas = useFalhas()
  const fotosComErro = useFilaDeFotos().filter((f) => f.estado === 'erro').length
  const [detalhes, setDetalhes] = useState(false)
  // Alterações de itens e fotos de etiqueta que esperam o sinal voltar.
  const naFila = pendentes + fotosNaFila
  const naoSalvos = falhas.length + fotosComErro
  const base = 'inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[0.8125rem] font-medium'

  // O que não foi salvo tem prioridade sobre qualquer outro estado: fica até a pessoa ler.
  if (naoSalvos > 0) {
    return (
      <>
        <button
          type="button"
          onClick={() => setDetalhes(true)}
          aria-label={`${plural(naoSalvos, 'alteração não salva', 'alterações não salvas')}. Toque para ver.`}
          className={cn(base, 'bg-destructive text-destructive-foreground', className)}
        >
          <AlertTriangle aria-hidden className="size-3.5" />
          {naoSalvos === 1 ? '1 não salvo' : `${naoSalvos} não salvos`}
          {estado === 'offline' ? ' · offline' : naFila > 0 ? ` · ${naFila} na fila` : ''}
        </button>
        <Sheet
          open={detalhes}
          onOpenChange={setDetalhes}
          title="Não foi salvo"
          description="O servidor não recebeu estas alterações. A lista voltou ao que está salvo: confira e refaça o que precisar."
        >
          <div className="space-y-5 pb-1">
            <ul className="rounded-cartao bg-card shadow-cartao">
              {falhas.map((falha) => (
                <li key={falha.id} className="border-b border-border px-4 py-3 last:border-b-0">
                  <p className="text-[1rem] font-medium">{falha.o_que}</p>
                  <p className="mt-0.5 text-[0.875rem] leading-snug text-muted-foreground">{falha.motivo}</p>
                </li>
              ))}
              {fotosComErro > 0 ? (
                <li className="border-b border-border px-4 py-3 last:border-b-0">
                  <p className="text-[1rem] font-medium">{plural(fotosComErro, 'foto de etiqueta', 'fotos de etiqueta')}</p>
                  <p className="mt-0.5 text-[0.875rem] leading-snug text-muted-foreground">
                    Não {fotosComErro === 1 ? 'foi lida' : 'foram lidas'}. Use “Tentar de novo” na conversa.
                  </p>
                </li>
              ) : null}
            </ul>
            <Button
              className="w-full"
              onClick={() => {
                limparFalhas()
                setDetalhes(false)
              }}
            >
              Entendi
            </Button>
          </div>
        </Sheet>
      </>
    )
  }

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
      className={cn(base, compacto && rotulo === 'Online' && 'px-0', lento ? 'text-foreground' : 'text-muted-foreground', className)}
    >
      <Barras cheias={cheias} batidas={batidas} buscando={buscando} />
      {compacto && rotulo === 'Online' ? <span className="sr-only">{rotulo}</span> : rotulo}
    </span>
  )
}
