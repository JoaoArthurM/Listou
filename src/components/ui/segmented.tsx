import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type Option<T extends string> = { value: T; label: ReactNode }

type SegmentedProps<T extends string> = {
  value: T
  onChange: (value: T) => void
  options: Array<Option<T>>
  label: string
  className?: string
  /** 'escuro' para usar sobre a faixa preta da moldura. */
  tom?: 'claro' | 'escuro'
  /** Altura de 36 px; a área de toque continua com 44 px. */
  compacto?: boolean
}

const FOLGA_REM = 0.5

/**
 * Escolha única entre poucas opções, com semântica de grupo de rádio. A opção
 * escolhida é uma pílula preenchida que desliza de uma para outra, no mesmo
 * jogo de preto e creme da moldura.
 */
export function Segmented<T extends string>({ value, onChange, options, label, className, tom = 'claro', compacto = false }: SegmentedProps<T>) {
  const indice = options.findIndex((o) => o.value === value)
  const total = options.length
  return (
    <div role="radiogroup" aria-label={label} className={cn('relative flex', className)} style={{ gap: `${FOLGA_REM}rem` }}>
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-y-0 left-0 rounded-full transition-[transform,opacity] duration-300 ease-saida',
          tom === 'escuro' ? 'bg-background' : 'bg-foreground',
          indice < 0 && 'opacity-0',
        )}
        style={{
          width: `calc((100% - ${(total - 1) * FOLGA_REM}rem) / ${total})`,
          transform: `translateX(calc(${Math.max(indice, 0)} * (100% + ${FOLGA_REM}rem)))`,
        }}
      />
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
              'relative flex min-w-0 flex-1 items-center justify-center gap-2 rounded-full border px-4 font-medium transition-[border-color,color,transform] duration-300 ease-saida active:scale-[0.97]',
              compacto ? 'h-9 text-[0.9375rem] before:absolute before:inset-x-0 before:-inset-y-1 before:content-[""]' : 'h-11 text-[1rem]',
              tom === 'escuro'
                ? ativa
                  ? 'border-background text-foreground'
                  : 'border-moldura-borda text-moldura-foreground hover:border-moldura-muted'
                : ativa
                  ? 'border-foreground text-background'
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
