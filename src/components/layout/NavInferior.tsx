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
              'flex min-h-[3.5rem] min-w-[4.5rem] flex-col items-center justify-center gap-1.5 rounded-2xl text-xs transition-colors duration-200',
              ativa ? 'font-medium text-moldura-foreground' : 'text-moldura-muted hover:text-moldura-foreground',
            )}
          >
            <Icone
              aria-hidden
              className={cn('size-[1.625rem] transition-colors duration-200', ativa && 'text-primary')}
              strokeWidth={ativa ? 2 : 1.5}
            />
            {rotulo}
          </a>
        )
      })}
    </nav>
  )
}
