import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type MolduraProps = {
  /** Conteúdo da folha clara. */
  children: ReactNode
  /** O que fica na faixa preta: navegação ou total do carrinho. */
  rodape?: ReactNode
  className?: string
}

/**
 * Estrutura de todas as telas, tirada da referência: fundo preto e, por cima,
 * a folha de conteúdo com os cantos de baixo arredondados. A folha não rola;
 * cada tela decide qual área interna rola.
 */
export function Moldura({ children, rodape, className }: MolduraProps) {
  return (
    <div className="moldura-app mx-auto flex max-w-[30rem] flex-col bg-moldura">
      <main
        className={cn(
          'moldura-folha pt-seguro relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-b-folha bg-background',
          className,
        )}
      >
        {children}
      </main>
      <footer className="moldura-rodape shrink-0 px-5 pb-[max(env(safe-area-inset-bottom),0.875rem)] pt-3.5">
        {rodape}
      </footer>
    </div>
  )
}
