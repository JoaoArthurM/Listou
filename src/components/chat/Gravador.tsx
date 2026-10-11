import { ArrowUp, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { MAX_SEGUNDOS_DE_VOZ, type Gravacao } from '@/lib/voz'

const BARRAS = 30
const INTERVALO_MS = 70

type GravadorProps = {
  gravacao: Gravacao
  aoEnviar: () => void
  aoCancelar: () => void
}

/**
 * Barra de gravação que toma o lugar do campo de texto. A onda é o volume real
 * do microfone, amostrado a cada 70 ms e empurrado da direita para a esquerda:
 * parada quando há silêncio, alta quando a pessoa fala.
 */
export function Gravador({ gravacao, aoEnviar, aoCancelar }: GravadorProps) {
  const [niveis, setNiveis] = useState<number[]>(() => Array<number>(BARRAS).fill(0))
  const [segundos, setSegundos] = useState(0)
  const enviar = useRef(aoEnviar)
  enviar.current = aoEnviar

  useEffect(() => {
    const inicio = Date.now()
    const relogio = window.setInterval(() => {
      setNiveis((atuais) => [...atuais.slice(1), gravacao.nivel()])
      const passados = (Date.now() - inicio) / 1000
      setSegundos(Math.floor(passados))
      // No limite, envia sozinho em vez de cortar a pessoa sem aviso.
      if (passados >= MAX_SEGUNDOS_DE_VOZ) enviar.current()
    }, INTERVALO_MS)
    return () => window.clearInterval(relogio)
  }, [gravacao])

  return (
    <div className="flex items-center gap-2">
      <Button variant="secondary" size="icon" aria-label="Cancelar gravação" className="size-12" onClick={aoCancelar}>
        <X className="size-5" />
      </Button>
      <div className="flex h-12 min-w-0 flex-1 items-center gap-3 rounded-full bg-foreground pl-4 pr-1 text-background">
        <span role="timer" aria-label="Tempo de gravação" className="dinheiro shrink-0 text-[0.875rem]">
          0:{String(segundos).padStart(2, '0')}
        </span>
        <span aria-hidden className="flex h-8 min-w-0 flex-1 items-center justify-end gap-[3px] overflow-hidden">
          {niveis.map((nivel, i) => (
            <span
              key={i}
              className="w-[3px] shrink-0 rounded-full bg-primary transition-[height] duration-100 ease-out"
              style={{ height: `${Math.max(10, Math.round(nivel * 100))}%` }}
            />
          ))}
        </span>
        <span className="sr-only" role="status">
          Gravando. Fale o pedido e toque em enviar.
        </span>
        <Button size="icon" aria-label="Enviar áudio" onClick={aoEnviar}>
          <ArrowUp className="size-5" strokeWidth={2.4} />
        </Button>
      </div>
    </div>
  )
}
