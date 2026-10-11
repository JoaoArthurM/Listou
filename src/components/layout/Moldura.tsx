import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Colmeia, type Relevo } from './Colmeia'

type MolduraProps = {
  /** Conteúdo da folha clara. */
  children: ReactNode
  /** O que fica na faixa preta de baixo: navegação ou total do carrinho. */
  rodape?: ReactNode
  /**
   * Conteúdo sobre o preto, acima da folha (a tela "Your week, sorted" da
   * referência). Com ele a folha fica do tamanho do que tem dentro, ancorada
   * embaixo, e é o topo que cede altura quando a tela encolhe.
   */
  topo?: ReactNode
  /** Liga a peça saltada da colmeia nessa posição da grade (coluna e linha). */
  relevo?: Relevo | null
  className?: string
}

/**
 * Estrutura de todas as telas, tirada da referência: fundo preto e, por cima,
 * a folha de conteúdo com os cantos de baixo arredondados e a colmeia ao
 * fundo. A folha não rola; cada tela decide qual área interna rola.
 */
export function Moldura({ children, rodape, topo, relevo, className }: MolduraProps) {
  return (
    <div className="moldura-app mx-auto flex max-w-[30rem] flex-col bg-moldura">
      {topo ? <header className="moldura-topo pt-seguro min-h-0 flex-1 text-moldura-foreground">{topo}</header> : null}
      <main
        className={cn(
          'moldura-folha relative isolate flex min-h-0 flex-col overflow-hidden rounded-b-folha bg-background',
          topo ? 'moldura-folha-ancorada rounded-t-folha' : 'pt-seguro flex-1',
          className,
        )}
      >
        <Colmeia relevo={relevo} />
        {children}
      </main>
      <footer className="moldura-rodape shrink-0 px-5 pb-[max(env(safe-area-inset-bottom),0.875rem)] pt-3.5">
        {rodape}
      </footer>
    </div>
  )
}
