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

/** Escolha única entre poucas opções, com semântica de grupo de rádio. */
export function Segmented<T extends string>({ value, onChange, options, label, className }: SegmentedProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className={cn('flex gap-1 rounded-full bg-muted p-1', className)}>
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
              'flex h-10 min-w-0 flex-1 items-center justify-center gap-2 rounded-full px-3 text-[0.9375rem] font-medium transition-[background-color,color,box-shadow] duration-200 ease-saida',
              // No escuro, cartão e trilho têm quase o mesmo tom; o véu claro separa a opção ativa.
              ativa
                ? 'bg-card text-foreground shadow-cartao dark:bg-white/[0.14]'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {opcao.label}
          </button>
        )
      })}
    </div>
  )
}
