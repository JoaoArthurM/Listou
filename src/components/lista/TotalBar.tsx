import { formatarReais } from '@/lib/dinheiro'
import { cn, plural } from '@/lib/utils'
import type { Resumo } from '@/types/app'

type TotalBarProps = {
  resumo: Resumo
  orcamentoCentavos: number | null
  semPreco?: number
  /** Carrinho mais o que falta, pelo preço da última compra. Null quando não há preço anterior de nada que falta. */
  previstoCentavos?: number | null
}

/**
 * Total do carrinho e progresso, fixos na faixa preta do rodapé. Os números
 * vêm dos itens em cache, somados em código (nunca pela IA), e mudam nos dois
 * aparelhos via Realtime.
 */
export function TotalBar({ resumo, orcamentoCentavos, semPreco = 0, previstoCentavos = null }: TotalBarProps) {
  const { total_centavos, itens_comprados, itens_total } = resumo
  const saldo = orcamentoCentavos === null ? null : orcamentoCentavos - total_centavos
  const percentual = itens_total > 0 ? Math.round((itens_comprados / itens_total) * 100) : 0

  return (
    <section aria-label="Total do carrinho" className="text-moldura-foreground">
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="dinheiro text-[0.8125rem] text-moldura-muted">
            Carrinho{previstoCentavos === null ? null : ` · previsão ${formatarReais(previstoCentavos)}`}
          </p>
          <p aria-live="polite" className="dinheiro mt-0.5 text-[1.875rem] font-semibold leading-none tracking-[-0.03em]">
            {formatarReais(total_centavos)}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="dinheiro text-[0.9375rem]">
            {itens_comprados} de {plural(itens_total, 'item', 'itens')}
          </p>
          {saldo !== null || semPreco > 0 ? (
            <p className={cn('dinheiro mt-0.5 text-[0.8125rem]', saldo !== null && saldo < 0 ? 'text-destaque' : 'text-moldura-muted')}>
              {[
                saldo === null ? null : saldo < 0 ? `passou ${formatarReais(-saldo)}` : `restam ${formatarReais(saldo)}`,
                semPreco > 0 ? `${semPreco} sem preço` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          ) : null}
        </div>
      </div>
      <div
        role="progressbar"
        aria-label="Itens no carrinho"
        aria-valuemin={0}
        aria-valuemax={itens_total}
        aria-valuenow={itens_comprados}
        className="mt-3 h-1 overflow-hidden rounded-full bg-moldura-borda"
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-500 ease-saida"
          style={{ width: `${percentual}%` }}
        />
      </div>
    </section>
  )
}
