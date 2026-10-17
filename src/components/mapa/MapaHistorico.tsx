import { ChevronRight, MapPin, MapPinOff, Pencil, X } from 'lucide-react'
import { lazy, Suspense, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useMoverMercado } from '@/hooks/useListas'
import { avisar } from '@/lib/avisos'
import { formatarReais } from '@/lib/dinheiro'
import { agruparPorMercado, type CompraNoMapa } from '@/lib/mapa'
import type { Ponto } from '@/lib/mercados'
import { navegar } from '@/lib/rota'
import { plural } from '@/lib/utils'
import type { ListaComResumo } from '@/types/app'

// maplibre-gl pesa; só quem abre o mapa baixa.
const MapaCompras = lazy(() => import('./MapaCompras'))

const dataCurta = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })

/** O que a compra custou de verdade: o que o caixa cobrou, se a pessoa disse; senão a soma do app. */
const valorDaCompra = (l: ListaComResumo) => l.total_pago_centavos ?? l.resumo.total_centavos
const quandoDaCompra = (l: ListaComResumo) => l.finalizada_em ?? l.criado_em

type Edicao = { listaId: string; nome: string; ponto: Ponto | null }

/** Mapa interativo das compras finalizadas, com edição do ponto de cada mercado. */
export function MapaHistorico({ listas }: { listas: ListaComResumo[] }) {
  const mover = useMoverMercado()
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null)
  const [edicao, setEdicao] = useState<Edicao | null>(null)
  const [semLocalAberto, setSemLocalAberto] = useState(false)

  const { compras, semLocal } = useMemo(() => {
    const com: CompraNoMapa[] = []
    const sem: ListaComResumo[] = []
    for (const l of listas) {
      if (l.mercado_lat === null || l.mercado_lng === null) sem.push(l)
      else
        com.push({
          id: l.id,
          nome: l.nome,
          mercado: l.mercado,
          lat: l.mercado_lat,
          lng: l.mercado_lng,
          quando: quandoDaCompra(l),
          total_centavos: valorDaCompra(l),
        })
    }
    return { compras: com, semLocal: sem }
  }, [listas])

  const mercados = useMemo(() => agruparPorMercado(compras), [compras])
  const selecionado = mercados.find((m) => m.compras.some((c) => c.id === selecionadoId)) ?? null

  function editar(compra: { id: string; nome: string; mercado: string | null }, ponto: Ponto | null) {
    setSelecionadoId(null)
    setSemLocalAberto(false)
    setEdicao({ listaId: compra.id, nome: compra.mercado?.trim() || compra.nome, ponto })
  }

  function salvar() {
    if (!edicao?.ponto) return
    mover.mutate(
      { id: edicao.listaId, lat: edicao.ponto.lat, lng: edicao.ponto.lng },
      {
        onSuccess: () => {
          setEdicao(null)
          avisar('Local do mercado atualizado.', 'sucesso')
        },
        onError: (e) => avisar(e instanceof Error ? e.message : 'Não deu para salvar o local.', 'erro'),
      },
    )
  }

  const folga = edicao ? 110 : selecionado ? 280 : 0

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden rounded-cartao bg-card shadow-cartao">
      <Suspense fallback={<div aria-busy className="absolute inset-0 esqueleto" />}>
        <MapaCompras
          mercados={mercados}
          selecionado={selecionado}
          aoSelecionar={(m) => setSelecionadoId(m.ultima.id)}
          editando={edicao ? { ponto: edicao.ponto } : null}
          aoMover={(ponto) => setEdicao((e) => (e ? { ...e, ponto } : e))}
          folgaInferior={folga}
        />
      </Suspense>

      {semLocal.length > 0 && !edicao ? (
        <div className="absolute left-3 top-3 z-10 max-w-[calc(100%-5rem)]">
          <Button size="sm" variant="secondary" aria-expanded={semLocalAberto} onClick={() => setSemLocalAberto((a) => !a)}>
            <MapPinOff aria-hidden className="size-4" />
            {semLocal.length} sem local
          </Button>
          {semLocalAberto ? (
            <ul className="mt-2 max-h-64 overflow-y-auto rounded-cartao bg-card p-1.5 shadow-flutuante">
              {semLocal.map((l) => (
                <li key={l.id} className="flex min-h-14 items-center gap-2 rounded-2xl px-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[0.9375rem] font-medium">{l.mercado?.trim() || l.nome}</span>
                    <span className="dinheiro block truncate text-[0.8125rem] text-muted-foreground">
                      {dataCurta.format(new Date(quandoDaCompra(l)))} · {formatarReais(valorDaCompra(l))}
                    </span>
                  </span>
                  <Button size="sm" variant="dark" onClick={() => editar(l, null)}>
                    <MapPin aria-hidden className="size-4" />
                    Marcar
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {mercados.length === 0 && !edicao ? (
        <p className="pointer-events-none absolute inset-x-6 bottom-6 z-10 rounded-cartao bg-card/95 p-4 text-center text-[0.9375rem] leading-snug shadow-flutuante">
          {semLocal.length > 0
            ? 'Suas compras ainda não têm local. Toque em “sem local” e marque onde cada uma foi.'
            : 'Quando você finalizar uma compra com o mercado marcado, ela aparece aqui.'}
        </p>
      ) : null}

      {edicao ? (
        <div className="absolute inset-x-3 bottom-3 z-10 rounded-cartao bg-card p-4 shadow-flutuante">
          <p className="text-[0.9375rem] font-medium leading-snug">Onde fica “{edicao.nome}”?</p>
          <p className="mt-0.5 text-[0.8125rem] leading-snug text-muted-foreground">Arraste o pino ou toque no mapa.</p>
          <div className="mt-3 flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setEdicao(null)} disabled={mover.isPending}>
              Cancelar
            </Button>
            <Button className="flex-1" onClick={salvar} disabled={!edicao.ponto || mover.isPending}>
              {mover.isPending ? 'Salvando…' : 'Salvar local'}
            </Button>
          </div>
        </div>
      ) : selecionado ? (
        <section aria-label={`Compras em ${selecionado.nome}`} className="absolute inset-x-3 bottom-3 z-10 flex max-h-[55%] flex-col rounded-cartao bg-card shadow-flutuante">
          <header className="flex shrink-0 items-start gap-2 py-2.5 pl-4 pr-1.5">
            <div className="min-w-0 flex-1 pt-1">
              <h2 className="truncate text-[1.0625rem] font-medium leading-tight">{selecionado.nome}</h2>
              <p className="dinheiro text-[0.8125rem] text-muted-foreground">
                {plural(selecionado.compras.length, 'compra', 'compras')} · última {formatarReais(selecionado.ultima.total_centavos)}
              </p>
            </div>
            <Button variant="ghost" size="icon" aria-label="Fechar" onClick={() => setSelecionadoId(null)}>
              <X className="size-5" />
            </Button>
          </header>
          <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-border px-1.5 pb-1.5">
            {selecionado.compras.map((c) => (
              <li key={c.id} className="flex items-center">
                <a
                  href={`/lista/${c.id}?aba=itens`}
                  onClick={(evento) => {
                    if (evento.metaKey || evento.ctrlKey || evento.shiftKey) return
                    evento.preventDefault()
                    navegar(`/lista/${c.id}?aba=itens`)
                  }}
                  className="flex min-h-14 min-w-0 flex-1 items-center gap-2 rounded-2xl px-2.5"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[0.9375rem] font-medium">{c.nome}</span>
                    <span className="block text-[0.8125rem] text-muted-foreground">{dataCurta.format(new Date(c.quando))}</span>
                  </span>
                  <span className="dinheiro shrink-0 text-[1rem] font-medium">{formatarReais(c.total_centavos)}</span>
                  <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                </a>
                <Button variant="ghost" size="icon" aria-label={`Corrigir o local de ${c.nome}`} onClick={() => editar(c, { lat: c.lat, lng: c.lng })}>
                  <Pencil className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
