import { Check } from 'lucide-react'
import { useState } from 'react'
import { formatarQuantidade, formatarReais } from '@/lib/dinheiro'
import { rotuloFaixa } from '@/lib/precos'
import { cn } from '@/lib/utils'
import type { Item } from '@/types/app'

type ItemRowProps = {
  item: Item
  somenteLeitura?: boolean
  /** Nome de quem adicionou. Só vem quando a lista é dividida com alguém. */
  quemAdicionou?: string | null
  /** "R$ 4,69" ou "R$ 5,99 o kg": quanto custou na compra anterior. Só para item ainda não comprado. */
  ultimoPreco?: string | null
  aoAlternar: (item: Item) => void
  aoAbrir: (item: Item) => void
}

function cartaoAplicado(item: Item): string | null {
  if (item.faixa_aplicada !== 'cartao') return null
  return item.faixas_preco?.find((f) => f.tipo === 'cartao' && f.preco_centavos === item.preco_unit_centavos)?.cartao ?? null
}

/** "6 × R$ 4,69 · atacado" para item com preço; null se ainda não tem. */
function detalheDaCompra(item: Item): string | null {
  if (item.preco_unit_centavos === null || item.qtd_comprada === null) return null
  const conta = `${formatarQuantidade(item.qtd_comprada, item.unidade)} × ${formatarReais(item.preco_unit_centavos)}`
  return item.faixa_aplicada ? `${conta} · ${rotuloFaixa(item.faixa_aplicada, cartaoAplicado(item))}` : conta
}

/** Linha do checklist: círculo à esquerda marca, o resto da linha abre a edição. */
export function ItemRow({ item, somenteLeitura = false, quemAdicionou, ultimoPreco, aoAlternar, aoAbrir }: ItemRowProps) {
  // A animação do check só toca quando o usuário marca, não a cada vez que a lista é desenhada.
  const [recemMarcado, setRecemMarcado] = useState(false)
  const compra = item.comprado ? (detalheDaCompra(item) ?? 'sem preço') : null
  const anterior = !item.comprado && ultimoPreco ? `da última vez ${ultimoPreco}` : null
  const detalhe = [compra, anterior, quemAdicionou ? `${quemAdicionou} adicionou` : null].filter(Boolean).join(' · ') || null
  const planejado = item.qtd_planejada === null ? null : formatarQuantidade(item.qtd_planejada, item.unidade)

  return (
    // O divisor é recuado dos dois lados, como no checklist da referência.
    <li
      data-item={item.id}
      className="relative flex items-stretch after:absolute after:inset-x-4 after:bottom-0 after:h-px after:bg-border last:after:hidden"
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={item.comprado}
        aria-label={item.nome}
        disabled={somenteLeitura}
        onClick={() => {
          setRecemMarcado(!item.comprado)
          aoAlternar(item)
        }}
        className="grid w-12 shrink-0 place-items-center rounded-2xl disabled:pointer-events-none"
      >
        <span
          className={cn(
            'grid size-6 place-items-center rounded-full border-[1.5px] transition-colors duration-200',
            item.comprado ? 'border-primary bg-primary text-white' : 'border-controle',
            item.comprado && recemMarcado && 'animate-marcar',
          )}
        >
          {item.comprado ? <Check aria-hidden className="size-3.5" strokeWidth={3.25} /> : null}
        </span>
      </button>

      <button
        type="button"
        onClick={() => aoAbrir(item)}
        className="flex min-h-[3.75rem] min-w-0 flex-1 items-center justify-between gap-3 rounded-2xl py-2 pr-4 text-left"
      >
        <span className="sr-only">Editar: </span>
        <span className="min-w-0">
          <span
            className={cn(
              'block truncate text-[1.0625rem] leading-snug transition-colors duration-200',
              item.comprado && 'text-muted-foreground line-through decoration-controle decoration-1',
            )}
          >
            {item.nome}
          </span>
          {detalhe ? <span className="dinheiro mt-0.5 block truncate text-[0.8125rem] text-muted-foreground">{detalhe}</span> : null}
        </span>
        <span className={cn('dinheiro shrink-0 text-[0.9375rem]', item.comprado ? 'font-medium text-foreground' : 'text-muted-foreground')}>
          {item.comprado
            ? item.total_centavos === null
              ? null
              : formatarReais(item.total_centavos)
            : planejado
              ? `${planejado}${item.unidade === 'un' ? ' un' : ''}`
              : null}
        </span>
      </button>
    </li>
  )
}
