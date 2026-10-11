import { formatarQuantidade, formatarReais } from './dinheiro'
import { rotuloFaixa } from './precos'
import type { Item } from '@/types/app'

function cartaoAplicado(item: Item): string | null {
  if (item.faixa_aplicada !== 'cartao') return null
  return item.faixas_preco?.find((f) => f.tipo === 'cartao' && f.preco_centavos === item.preco_unit_centavos)?.cartao ?? null
}

/** "6 × R$ 4,69 · atacado" para item com preço; null se ainda não tem. */
export function detalheDaCompra(item: Item): string | null {
  if (item.preco_unit_centavos === null || item.qtd_comprada === null) return null
  const conta = `${formatarQuantidade(item.qtd_comprada, item.unidade)} × ${formatarReais(item.preco_unit_centavos)}`
  return item.faixa_aplicada ? `${conta} · ${rotuloFaixa(item.faixa_aplicada, cartaoAplicado(item))}` : conta
}
