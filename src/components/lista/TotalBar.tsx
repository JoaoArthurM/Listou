import { Flag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatarReais } from '@/lib/dinheiro'
import { cn, plural } from '@/lib/utils'
import type { Resumo } from '@/types/app'

type TotalBarProps = {
  resumo: Resumo
  orcamentoCentavos: number | null
  semPreco?: number
  /** Carrinho mais o que falta, pelo preço da última compra. Null quando não há preço anterior de nada que falta. */
  previstoCentavos?: number | null
  /** Abre o resumo para fechar a compra. Sem ele, o botão não aparece (lista finalizada). */
  aoFinalizar?: () => void
}

/**
 * Total do carrinho e progresso, fixos na faixa preta do rodapé. Os números
 * vêm dos itens em cache, somados em código (nunca pela IA), e mudam nos dois
 * aparelhos via Realtime.
 */
export function TotalBar({ resumo, orcamentoCentavos, semPreco = 0, previstoCentavos = null, aoFinalizar }: TotalBarProps) {
  const { total_centavos, itens_comprados, itens_total } = resumo
  const saldo = orcamentoCentavos === null ? null : orcamentoCentavos - total_centavos
  const percentual = itens_total > 0 ? Math.round((itens_comprados / itens_total) * 100) : 0

  const detalhes = [
    saldo === null ? null : saldo < 0 ? `passou ${formatarReais(-saldo)}` : `restam ${formatarReais(saldo)}`,
    semPreco > 0 ? `${semPreco} sem preço` : null,
    previstoCentavos === null ? null : `previsão ${formatarReais(previstoCentavos)}`,
  ].filter(Boolean)

  return (
    <section aria-label="Total do carrinho" className="text-moldura-foreground">
      {/* Progresso como um fio: sem linha própria, só a cor avançando. */}
      <div
        role="progressbar"
        aria-label="Itens no carrinho"
        aria-valuemin={0}
        aria-valuemax={itens_total}
        aria-valuenow={itens_comprados}
        className="h-[3px] overflow-hidden rounded-full bg-moldura-borda"
      >
        <div className="h-full rounded-full bg-primary transition-[width] duration-500 ease-saida" style={{ width: `${percentual}%` }} />
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="dinheiro text-[0.8125rem] text-moldura-muted">
            Carrinho · {itens_comprados} de {plural(itens_total, 'item', 'itens')}
          </p>
          <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
            <span key={total_centavos} aria-live="polite" className="dinheiro inline-block animate-pop origin-left text-[1.625rem] font-semibold leading-none tracking-[-0.03em]">
              {formatarReais(total_centavos)}
            </span>
            {detalhes.length > 0 ? (
              <span className={cn('dinheiro text-[0.8125rem]', saldo !== null && saldo < 0 ? 'text-destaque' : 'text-moldura-muted')}>
                {detalhes.join(' · ')}
              </span>
            ) : null}
          </p>
        </div>
        {aoFinalizar && itens_comprados > 0 ? (
          <Button size="sm" className="shrink-0" aria-label="Finalizar compra" onClick={aoFinalizar}>
            <Flag aria-hidden className="size-4" />
            Finalizar
          </Button>
        ) : null}
      </div>
    </section>
  )
}
