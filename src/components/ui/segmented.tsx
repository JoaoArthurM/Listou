import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type Option<T extends string> = { value: T; label: ReactNode }

type SegmentedProps<T extends string> = {
  value: T
  onChange: (value: T) => void
  options: Array<Option<T>>
  label: string
  className?: string
}

/**
 * Escolha única entre poucas opções, com semântica de grupo de rádio. Cada
 * opção é uma pílula; a escolhida fica preenchida na cor do texto, no mesmo
 * jogo de preto e creme da moldura.
 */
export function Segmented<T extends string>({ value, onChange, options, label, className }: SegmentedProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className={cn('flex gap-2', className)}>
      {options.map((opcao) => {
        const ativa = opcao.value === value
        return (
          <button
            key={opcao.value}
            type="button"
            role="radio"
            aria-checked={ativa}
            onClick={() => onChange(opcao.value)}
            className={cn(
              'flex h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-full border px-4 text-[1rem] font-medium transition-[background-color,border-color,color] duration-200 ease-saida',
              ativa
                ? 'border-foreground bg-foreground text-background'
                : 'border-controle/45 bg-card text-foreground hover:border-controle',
            )}
          >
            {opcao.label}
          </button>
        )
      })}
    </div>
  )
}
