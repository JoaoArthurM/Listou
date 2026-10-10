import { ChevronDown, Plus, ShoppingBasket, ShoppingCart, type LucideIcon } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Dica } from '@/components/layout/Dica'
import { Button } from '@/components/ui/button'
import { useAdicionarItem, useAtualizarItem } from '@/hooks/useItens'
import { formatarReais } from '@/lib/dinheiro'
import { cn, plural } from '@/lib/utils'
import type { Item, Lista, Resumo } from '@/types/app'
import { ItemRow } from './ItemRow'
import { ItemSheet } from './ItemSheet'

type ItensViewProps = { lista: Lista; itens: Item[]; resumo: Resumo; carregando: boolean; somenteLeitura: boolean }

type SecaoProps = { titulo: string; icone: LucideIcon; contagem: number; children: ReactNode }

/** Grupo recolhível do checklist, como as categorias da referência. */
function Secao({ titulo, icone: Icone, contagem, children }: SecaoProps) {
  const [aberta, setAberta] = useState(true)
  return (
    <section className="rounded-cartao bg-card shadow-cartao">
      <h2>
        <button
          type="button"
          aria-expanded={aberta}
          onClick={() => setAberta((a) => !a)}
          className="flex min-h-14 w-full items-center gap-3 rounded-cartao pl-3.5 pr-4 text-left text-verde"
        >
          <Icone aria-hidden className="size-6 shrink-0" strokeWidth={1.6} />
          <span className="flex-1 text-[1.125rem] font-medium tracking-[-0.015em]">{titulo}</span>
          <span className="dinheiro text-[0.9375rem] text-muted-foreground">{contagem}</span>
          <span className="grid size-6 place-items-center rounded-full border border-controle/70">
            <ChevronDown aria-hidden className={cn('size-3.5 transition-transform duration-300 ease-saida', !aberta && '-rotate-90')} />
          </span>
        </button>
      </h2>
      {aberta ? <ul className="pb-1 pl-0.5">{children}</ul> : null}
    </section>
  )
}

/** Aba Itens: checklist dividido em "Faltando" e "No carrinho", com adição rápida no rodapé da folha. */
export function ItensView({ lista, itens, resumo, carregando, somenteLeitura }: ItensViewProps) {
  const adicionar = useAdicionarItem()
  const atualizar = useAtualizarItem()
  const [novo, setNovo] = useState('')
  const [editando, setEditando] = useState<string | null>(null)
  const [recemAdicionado, setRecemAdicionado] = useState<string | null>(null)
  const rolagem = useRef<HTMLDivElement>(null)

  const faltando = itens.filter((i) => !i.comprado)
  const noCarrinho = itens.filter((i) => i.comprado)
  const semPreco = noCarrinho.filter((i) => i.total_centavos === null).length
  const itemEmEdicao = itens.find((i) => i.id === editando) ?? null
  const estouro = lista.orcamento_centavos === null ? 0 : resumo.total_centavos - lista.orcamento_centavos

  useEffect(() => {
    if (!recemAdicionado) return
    rolagem.current?.querySelector(`[data-item="${recemAdicionado}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [recemAdicionado, itens.length])

  function adicionarItem(evento: FormEvent) {
    evento.preventDefault()
    const nome = novo.trim()
    if (!nome) return
    const id = crypto.randomUUID()
    adicionar.mutate({ id, lista_id: lista.id, nome })
    setRecemAdicionado(id)
    setNovo('')
  }

  function alternar(item: Item) {
    // Desmarcar apaga o preço lido; marcar aqui é manual, sem preço (o preço vem pela foto ou pela edição).
    atualizar.mutate({ id: item.id, lista_id: item.lista_id, patch: { comprado: !item.comprado } })
  }

  const linha = (item: Item) => (
    <ItemRow key={item.id} item={item} somenteLeitura={somenteLeitura} aoAlternar={alternar} aoAbrir={(i) => setEditando(i.id)} />
  )

  let aviso: ReactNode = null
  if (estouro > 0) aviso = <>O carrinho passou {formatarReais(estouro)} do orçamento.</>
  else if (semPreco > 0)
    aviso = (
      <>
        {plural(semPreco, 'item no carrinho está', 'itens no carrinho estão')} sem preço e não {semPreco === 1 ? 'entra' : 'entram'} no total.
        Toque no item para informar.
      </>
    )
  else if (!somenteLeitura && itens.length > 0 && faltando.length === 0)
    aviso = <>Tudo no carrinho. Quando passar no caixa, finalize a compra nas opções da lista.</>

  return (
    <>
      <div ref={rolagem} className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 pb-6 pt-1">
        {aviso ? <Dica>{aviso}</Dica> : null}

        {carregando ? (
          <div aria-busy className="h-48 animate-pulso rounded-cartao bg-muted" />
        ) : itens.length === 0 ? (
          <div className="px-2 pt-10">
            <p className="font-display text-[2.5rem] italic leading-none">Lista em branco</p>
            <p className="mt-3 max-w-[19rem] text-[1.0625rem] leading-snug text-muted-foreground">
              {somenteLeitura
                ? 'Esta compra foi finalizada sem itens.'
                : 'Escreva o primeiro item aqui embaixo ou peça no chat: “adiciona leite e pão”.'}
            </p>
          </div>
        ) : (
          <>
            {faltando.length > 0 ? (
              <Secao titulo="Faltando" icone={ShoppingBasket} contagem={faltando.length}>
                {faltando.map(linha)}
              </Secao>
            ) : null}
            {noCarrinho.length > 0 ? (
              <Secao titulo="No carrinho" icone={ShoppingCart} contagem={noCarrinho.length}>
                {noCarrinho.map(linha)}
              </Secao>
            ) : null}
          </>
        )}
      </div>

      {somenteLeitura ? null : (
        <form onSubmit={adicionarItem} className="flex shrink-0 items-center gap-2 border-t border-border bg-background px-3 pb-3 pt-2.5">
          <div className="flex h-[3.25rem] min-w-0 flex-1 items-center rounded-full border border-controle/70 bg-card pl-5 pr-1 transition-[border-color,box-shadow] duration-200 focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/20">
            <input
              value={novo}
              onChange={(e) => setNovo(e.target.value)}
              aria-label="Novo item"
              placeholder="Adicionar item"
              maxLength={80}
              autoComplete="off"
              enterKeyHint="done"
              className="h-full min-w-0 flex-1 bg-transparent placeholder:text-muted-foreground focus:outline-none"
            />
            <Button type="submit" size="icon" aria-label="Adicionar item" disabled={!novo.trim()}>
              <Plus className="size-5" strokeWidth={2.4} />
            </Button>
          </div>
        </form>
      )}

      {itemEmEdicao ? (
        <ItemSheet key={itemEmEdicao.id} item={itemEmEdicao} lista={lista} somenteLeitura={somenteLeitura} aoFechar={() => setEditando(null)} />
      ) : null}
    </>
  )
}
