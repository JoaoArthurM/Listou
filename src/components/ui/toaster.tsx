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
          <div
            key={aviso.id}
            role={aviso.tipo === 'erro' ? 'alert' : 'status'}
            className="pointer-events-auto flex max-w-full animate-surge items-center gap-1 rounded-3xl bg-moldura text-[0.875rem] leading-snug text-moldura-foreground shadow-flutuante"
          >
            <button
              type="button"
              onClick={() => dispensarAviso(aviso.id)}
              className="flex min-w-0 items-start gap-2.5 py-3 pl-4 pr-4 text-left"
            >
              <Icone
                aria-hidden
                className={cn('mt-0.5 size-4 shrink-0', aviso.tipo === 'erro' ? 'text-destaque' : 'text-primary')}
              />
              <span>{aviso.texto}</span>
            </button>
            {aviso.acao ? (
              <button
                type="button"
                onClick={() => {
                  aviso.acao?.aoClicar()
                  dispensarAviso(aviso.id)
                }}
                className="mr-1.5 shrink-0 rounded-full px-3 py-2 text-[0.875rem] font-semibold text-destaque"
              >
                {aviso.acao.rotulo}
              </button>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
