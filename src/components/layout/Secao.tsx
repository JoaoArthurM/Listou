import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type SecaoProps = {
  id: string
  icone: LucideIcon
  titulo: string
  descricao?: string
  /** Para listas de linhas que cuidam do próprio recuo. */
  semPadding?: boolean
  children: ReactNode
}

/** Bloco de configuração: título com ícone, uma frase de apoio e o conteúdo num cartão próprio. */
export function Secao({ id, icone: Icone, titulo, descricao, semPadding, children }: SecaoProps) {
  return (
    <section aria-labelledby={id}>
      <h3 id={id} className="flex items-center gap-2.5 px-1 text-[1.0625rem] font-medium text-verde">
        <Icone aria-hidden className="size-5 shrink-0" strokeWidth={1.7} />
        {titulo}
      </h3>
      {descricao ? <p className="mt-1 px-1 text-[0.875rem] leading-snug text-muted-foreground">{descricao}</p> : null}
      <div className={cn('mt-3 rounded-cartao bg-card shadow-cartao [&_input]:bg-background', !semPadding && 'p-4')}>{children}</div>
    </section>
  )
}
