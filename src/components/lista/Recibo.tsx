import type { CSSProperties, ReactNode } from 'react'
import { useMembros } from '@/hooks/useListas'
import { detalheDaCompra } from '@/lib/compra'
import { formatarReais } from '@/lib/dinheiro'
import { normalizarNome } from '@/lib/nomes'
import { resumirCompra } from '@/lib/resumo'
import { cn, listarNomes, plural, primeiroNome } from '@/lib/utils'
import type { Item, Lista } from '@/types/app'

type ReciboProps = {
  lista: Lista
  itens: Item[]
  carregando: boolean
}

const dataLonga = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })
const hora = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' })

// A borda serrilhada do papel é só máscara: a cor continua a do cartão, no claro e no escuro.
const DENTE = 8
const MASCARA = {
  baixo: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='${DENTE}'%3E%3Cpath d='M0 0H16L8 ${DENTE}Z'/%3E%3C/svg%3E")`,
  cima: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='${DENTE}'%3E%3Cpath d='M0 ${DENTE}L8 0L16 ${DENTE}Z'/%3E%3C/svg%3E")`,
}

function Serrilha({ lado }: { lado: 'cima' | 'baixo' }) {
  const estilo: CSSProperties = {
    height: DENTE,
    maskImage: MASCARA[lado],
    WebkitMaskImage: MASCARA[lado],
    maskSize: `16px ${DENTE}px`,
    WebkitMaskSize: `16px ${DENTE}px`,
    maskRepeat: 'repeat-x',
    WebkitMaskRepeat: 'repeat-x',
  }
  return <div aria-hidden style={estilo} className="bg-card" />
}

const Tracejado = () => <hr aria-hidden className="my-4 border-0 border-t border-dashed border-controle/70" />

function Linha({ rotulo, valor, forte, discreto }: { rotulo: ReactNode; valor: ReactNode; forte?: boolean; discreto?: boolean }) {
  return (
    <div className={cn('flex items-baseline justify-between gap-3', forte && 'font-semibold', discreto && 'text-muted-foreground')}>
      <dt>{rotulo}</dt>
      <dd className="dinheiro shrink-0">{valor}</dd>
    </div>
  )
}

// Barras do código de barras de enfeite, em largura de 1 a 3 px.
const CODIGO_DE_BARRAS =
  'repeating-linear-gradient(90deg, hsl(var(--foreground)) 0 2px, transparent 2px 5px, hsl(var(--foreground)) 5px 6px, transparent 6px 8px, hsl(var(--foreground)) 8px 11px, transparent 11px 13px, hsl(var(--foreground)) 13px 14px, transparent 14px 17px)'

/**
 * Aba de uma compra finalizada: a lista vira o recibo, com uma linha por item
 * comprado (quantidade × preço, faixa aplicada e total), a economia e o total
 * pago. Tudo sai dos itens, somado em código.
 */
export function Recibo({ lista, itens, carregando }: ReciboProps) {
  const { data: membros = [] } = useMembros(lista.id)
  const resumo = resumirCompra(itens)
  const comprados = itens
    .filter((i) => i.comprado)
    .sort((a, b) => (a.comprado_em ?? a.criado_em).localeCompare(b.comprado_em ?? b.criado_em))
  const naoComprados = itens.filter((i) => !i.comprado)
  const quando = lista.finalizada_em ? new Date(lista.finalizada_em) : null
  const quem = listarNomes(membros.map((m) => primeiroNome(m.nome)).filter(Boolean))
  const saldo = lista.orcamento_centavos === null ? null : lista.orcamento_centavos - resumo.total_centavos

  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6 pt-1">
      {carregando ? (
        <div aria-busy className="h-72 animate-pulso rounded-cartao bg-muted" />
      ) : (
        <article aria-label={`Recibo da compra ${lista.nome}`} className="animate-surge drop-shadow-[0_10px_18px_hsl(var(--sombra)/0.12)]">
          <Serrilha lado="cima" />
          <div className="bg-card px-5 pb-1 pt-3 text-[0.9375rem] leading-snug text-foreground">
            <header className="text-center">
              <p className="text-[0.6875rem] uppercase tracking-[0.22em] text-muted-foreground">Listou · compra finalizada</p>
              <h2 className="mt-2 break-words font-display text-[2.25rem] italic leading-none tracking-normal">{lista.nome}</h2>
              {lista.mercado ? <p className="mt-2 uppercase tracking-wide">{lista.mercado}</p> : null}
              <p className="dinheiro mt-1 text-muted-foreground">
                {quando ? `${dataLonga.format(quando)} · ${hora.format(quando)}` : 'Sem data de finalização'}
              </p>
              {quem ? <p className="mt-0.5 text-muted-foreground">Compra de {quem}</p> : null}
            </header>

            <Tracejado />

            {comprados.length === 0 ? (
              <p className="py-6 text-center text-muted-foreground">Esta compra foi finalizada sem itens no carrinho.</p>
            ) : (
              <>
                <div className="flex justify-between text-[0.6875rem] uppercase tracking-[0.18em] text-muted-foreground">
                  <span>Item</span>
                  <span>Total</span>
                </div>
                <ol className="mt-2 space-y-2.5">
                  {comprados.map((item) => (
                    <li key={item.id}>
                      <div className="flex items-baseline gap-2">
                        <span className="min-w-0 break-words">{normalizarNome(item.nome)}</span>
                        <span aria-hidden className="mb-1 min-w-3 flex-1 self-end border-b border-dotted border-controle/60" />
                        <span className="dinheiro shrink-0 font-semibold">
                          {item.total_centavos === null ? 'sem preço' : formatarReais(item.total_centavos)}
                        </span>
                      </div>
                      {detalheDaCompra(item) ? (
                        <p className="dinheiro pl-3 text-[0.75rem] text-muted-foreground">{detalheDaCompra(item)}</p>
                      ) : null}
                    </li>
                  ))}
                </ol>
              </>
            )}

            <Tracejado />

            <dl className="space-y-1">
              <Linha rotulo="Itens comprados" valor={resumo.comprados} />
              {resumo.semPreco.length > 0 ? <Linha rotulo="Sem preço informado" valor={resumo.semPreco.length} discreto /> : null}
              {resumo.economia.atacado > 0 ? <Linha rotulo="Economia no atacado" valor={`− ${formatarReais(resumo.economia.atacado)}`} discreto /> : null}
              {resumo.economia.cartao > 0 ? <Linha rotulo="Economia no cartão" valor={`− ${formatarReais(resumo.economia.cartao)}`} discreto /> : null}
            </dl>

            <div className="mt-3 border-y-2 border-double border-foreground/70 py-2.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[0.9375rem] font-semibold uppercase tracking-[0.18em]">Total</span>
                <span className="dinheiro text-[1.625rem] font-semibold leading-none tracking-tight">{formatarReais(resumo.total_centavos)}</span>
              </div>
            </div>

            {saldo !== null ? (
              <dl className="mt-3 space-y-1 text-muted-foreground">
                <Linha rotulo="Orçamento" valor={formatarReais(lista.orcamento_centavos ?? 0)} />
                <Linha
                  rotulo={saldo < 0 ? 'Passou do orçamento' : 'Sobrou do orçamento'}
                  valor={formatarReais(Math.abs(saldo))}
                  forte
                />
              </dl>
            ) : null}

            {naoComprados.length > 0 ? (
              <>
                <Tracejado />
                <p className="text-[0.6875rem] uppercase tracking-[0.18em] text-muted-foreground">
                  Ficaram de fora · {plural(naoComprados.length, 'item', 'itens')}
                </p>
                <ul className="mt-1.5 space-y-0.5 text-muted-foreground">
                  {naoComprados.map((item) => (
                    <li key={item.id} className="break-words line-through decoration-controle">
                      {normalizarNome(item.nome)}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}

            <Tracejado />

            <footer className="pb-4 text-center">
              <div aria-hidden className="mx-auto h-9 w-48 opacity-80" style={{ backgroundImage: CODIGO_DE_BARRAS }} />
              <p className="mt-1.5 text-[0.6875rem] uppercase tracking-[0.2em] text-muted-foreground">Nº {lista.id.slice(0, 8)}</p>
              <p className="mt-3">Até a próxima compra!</p>
            </footer>
          </div>
          <Serrilha lado="baixo" />
        </article>
      )}

      <p className="mt-4 px-2 text-center text-sm text-muted-foreground">Para mexer nesta compra de novo, reabra nas opções da lista.</p>
    </div>
  )
}
