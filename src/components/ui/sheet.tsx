import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Button } from './button'

type SheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: ReactNode
  className?: string
}

/**
 * Folha que sobe do rodapé, no gesto natural do celular. Usa o Dialog do
 * Radix para foco preso, Esc e leitor de tela; "--teclado" (src/lib/teclado.ts)
 * mantém a folha acima do teclado no iPhone.
 */
export function Sheet({ open, onOpenChange, title, description, children, className }: SheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/55 data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out data-[state=open]:fade-in" />
        <Dialog.Content
          // Sem descrição, o undefined explícito diz ao Radix que é intencional.
          {...(description ? {} : { 'aria-describedby': undefined })}
          // Por padrão o foco iria para o botão de fechar. Vai para o campo
          // marcado com data-autofocus ou, sem ele, para a própria folha, o
          // que não abre o teclado do celular à toa.
          onOpenAutoFocus={(evento) => {
            evento.preventDefault()
            const folha = evento.currentTarget as HTMLElement
            ;(folha.querySelector<HTMLElement>('[data-autofocus]') ?? folha).focus()
          }}
          className={cn(
            'fixed inset-x-0 bottom-[var(--teclado,0px)] z-50 mx-auto flex max-h-[calc(var(--altura-visivel,100dvh)-1.5rem)] w-full max-w-[30rem] flex-col rounded-t-folha bg-background shadow-flutuante focus:outline-none data-[state=closed]:animate-folha-desce data-[state=open]:animate-folha-sobe',
            className,
          )}
        >
          <div aria-hidden className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-controle/40" />
          <header className="flex shrink-0 items-start justify-between gap-4 pb-3 pl-5 pr-3 pt-3">
            <div className="min-w-0 pt-1.5">
              <Dialog.Title className="text-[1.25rem] font-medium leading-tight tracking-[-0.02em]">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-1 text-[0.875rem] leading-snug text-muted-foreground">
                  {description}
                </Dialog.Description>
              ) : null}
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Fechar">
                <X className="size-5" />
              </Button>
            </Dialog.Close>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[max(env(safe-area-inset-bottom),1.25rem)]">
            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
