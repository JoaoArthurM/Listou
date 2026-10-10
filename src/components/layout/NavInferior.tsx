import { CircleUserRound, ReceiptText, ShoppingBasket, type LucideIcon } from 'lucide-react'
import type { MouseEvent } from 'react'
import { navegar } from '@/lib/rota'
import { cn } from '@/lib/utils'

type Aba = 'listas' | 'historico' | 'perfil'

const abas: Array<{ id: Aba; rota: string; rotulo: string; icone: LucideIcon }> = [
  { id: 'listas', rota: '/', rotulo: 'Listas', icone: ShoppingBasket },
  { id: 'historico', rota: '/historico', rotulo: 'Histórico', icone: ReceiptText },
  { id: 'perfil', rota: '/perfil', rotulo: 'Perfil', icone: CircleUserRound },
]

/** Navegação principal, na faixa preta do rodapé. */
export function NavInferior({ atual }: { atual: Aba }) {
  const ir = (evento: MouseEvent, rota: string) => {
    // Ctrl/Cmd + clique continua abrindo em outra aba.
    if (evento.metaKey || evento.ctrlKey || evento.shiftKey) return
    evento.preventDefault()
    navegar(rota, { substituir: true })
  }

  return (
    <nav aria-label="Principal" className="flex items-stretch justify-around">
      {abas.map(({ id, rota, rotulo, icone: Icone }) => {
        const ativa = id === atual
        return (
          <a
            key={id}
            href={rota}
            aria-current={ativa ? 'page' : undefined}
            onClick={(evento) => ir(evento, rota)}
            className={cn(
              'flex min-h-[3.25rem] min-w-[4.5rem] flex-col items-center justify-center gap-1 rounded-2xl text-[0.6875rem] transition-colors duration-200',
              ativa ? 'text-moldura-foreground' : 'text-moldura-muted hover:text-moldura-foreground',
            )}
          >
            <span
              className={cn(
                'grid size-8 place-items-center rounded-full transition-[background-color,box-shadow] duration-300 ease-saida',
                ativa && 'bg-primary text-primary-foreground shadow-[0_0_22px_hsl(var(--primary)/0.55)]',
              )}
            >
              <Icone aria-hidden className="size-[1.375rem]" strokeWidth={ativa ? 2 : 1.6} />
            </span>
            {rotulo}
          </a>
        )
      })}
    </nav>
  )
}
