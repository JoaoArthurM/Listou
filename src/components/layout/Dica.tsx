import { Lightbulb } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Faixa pêssego com a lâmpada, usada para dicas e avisos dentro da folha. */
export function Dica({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'flex items-start gap-2.5 rounded-2xl border border-dica-borda bg-dica px-4 py-3 text-[0.875rem] leading-snug text-dica-foreground shadow-[0_6px_14px_-10px_hsl(var(--sombra)/0.35)]',
        className,
      )}
    >
      <Lightbulb aria-hidden className="mt-0.5 size-[1.125rem] shrink-0 fill-primary text-primary" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
