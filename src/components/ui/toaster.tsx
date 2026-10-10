import { CircleAlert, CircleCheck, Info } from 'lucide-react'
import { dispensarAviso, useAvisos } from '@/lib/avisos'
import { cn } from '@/lib/utils'

const icones = { info: Info, erro: CircleAlert, sucesso: CircleCheck }

/** Avisos rápidos no topo da tela. A fila vive em src/lib/avisos.ts. */
export function Toaster() {
  const avisos = useAvisos()
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[60] mx-auto flex w-full max-w-[30rem] flex-col items-center gap-2 px-4"
    >
      {avisos.map((aviso) => {
        const Icone = icones[aviso.tipo]
        return (
          <button
            key={aviso.id}
            type="button"
            role={aviso.tipo === 'erro' ? 'alert' : 'status'}
            onClick={() => dispensarAviso(aviso.id)}
            className="pointer-events-auto flex max-w-full animate-surge items-start gap-2.5 rounded-3xl bg-moldura px-4 py-3 text-left text-[0.9375rem] leading-snug text-moldura-foreground shadow-flutuante"
          >
            <Icone
              aria-hidden
              className={cn('mt-0.5 size-4 shrink-0', aviso.tipo === 'erro' ? 'text-destaque' : 'text-primary')}
            />
            <span>{aviso.texto}</span>
          </button>
        )
      })}
    </div>
  )
}
