import { cn } from '@/lib/utils'

// Cor e atraso de cada item que cai na cesta.
const ITENS = [
  { x: 8.2, cor: 'fill-primary', atraso: '0ms' },
  { x: 12, cor: 'fill-destaque', atraso: '260ms' },
  { x: 15.8, cor: 'fill-verde', atraso: '520ms' },
]

/**
 * Animação de carregamento da marca: três itens caem, um de cada vez, na cesta
 * do assistente. Serve de tela de abertura e para esperas longas; para blocos
 * de conteúdo que ainda não chegaram use a classe "esqueleto".
 */
export function Carregando({ rotulo = 'Carregando', className }: { rotulo?: string; className?: string }) {
  return (
    <div role="status" className={cn('flex flex-col items-center', className)}>
      <svg viewBox="0 -7 24 31" fill="none" aria-hidden className="h-20 w-[3.75rem] overflow-visible text-foreground">
        {ITENS.map((item) => (
          <circle
            key={item.x}
            cx={item.x}
            cy={8}
            r={1.9}
            className={cn('animate-cai', item.cor)}
            style={{ animationDelay: item.atraso }}
          />
        ))}
        {/* O corpo da cesta é preenchido: os itens somem ao passar da borda. */}
        <path
          d="M4.75 9l1.3 8.6a2.4 2.4 0 0 0 2.4 2.05h7.1a2.4 2.4 0 0 0 2.4-2.05L19.25 9z"
          className="fill-background stroke-current"
          strokeWidth={2}
          strokeLinejoin="round"
        />
        <path d="M8 9l3-5.5M16 9l-3-5.5M2.75 9h18.5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
      </svg>
      <span className="sr-only">{rotulo}</span>
    </div>
  )
}
