import { ChevronRight, Plus, UserRoundPlus } from 'lucide-react'
import { useState, type MouseEvent } from 'react'
import { Moldura } from '@/components/layout/Moldura'
import { NavInferior } from '@/components/layout/NavInferior'
import { StatusConexao } from '@/components/layout/StatusConexao'
import { CodigoSheet, NovaListaSheet } from '@/components/lista/NovaListaSheet'
import { Button } from '@/components/ui/button'
import { useUsuario } from '@/hooks/sessao'
import { useConexao } from '@/hooks/useConexao'
import { useListas, usePerfil } from '@/hooks/useListas'
import { formatarReais } from '@/lib/dinheiro'
import { fotoDaLista } from '@/lib/fotos'
import { navegar } from '@/lib/rota'
import { cn, listarNomes, plural, primeiroNome, saudacao } from '@/lib/utils'
import type { ListaComResumo } from '@/types/app'

function abrir(evento: MouseEvent, id: string) {
  if (evento.metaKey || evento.ctrlKey || evento.shiftKey) return
  evento.preventDefault()
  navegar(`/lista/${id}`)
}

function companhia(lista: ListaComResumo, meuId: string): string | null {
  const outros = lista.membros.filter((m) => m.perfil_id !== meuId).map((m) => primeiroNome(m.nome))
  return outros.length > 0 ? `com ${listarNomes(outros)}` : null
}

/** A lista mais recente no cartão com foto e nome em serifada, como o cartão de receita da referência. */
function CartaoDestaque({ lista, meuId, sozinho }: { lista: ListaComResumo; meuId: string; sozinho: boolean }) {
  const { resumo } = lista
  const com = companhia(lista, meuId)
  return (
    <a href={`/lista/${lista.id}`} onClick={(e) => abrir(e, lista.id)} className="group relative block rounded-[1.75rem]">
      {/* Os cartões "de trás", levemente girados, que formam a pilha da referência. */}
      <span aria-hidden className="absolute inset-0 origin-bottom -rotate-[4deg] rounded-[1.75rem] bg-[#8d867c] dark:bg-[#3a3631]" />
      <span aria-hidden className="absolute inset-0 origin-bottom rotate-[2.5deg] rounded-[1.75rem] bg-[#57514a] dark:bg-[#2b2824]" />
      <article
        className={cn(
          'cartao-foto flex flex-col justify-between rounded-[1.75rem] p-5 shadow-flutuante transition-transform duration-300 ease-saida group-active:scale-[0.985]',
          sozinho ? 'min-h-[25rem]' : 'min-h-[19rem]',
        )}
      >
        <img src={fotoDaLista(lista.id)} alt="" decoding="async" />
        <div className="flex flex-wrap items-center gap-2">
          {lista.mercado ? (
            <span className="max-w-full truncate rounded-full bg-white/20 px-3.5 py-1.5 text-[0.875rem] backdrop-blur-sm">{lista.mercado}</span>
          ) : null}
          <span className="dinheiro rounded-full bg-destaque px-3.5 py-1.5 text-[0.875rem] font-medium text-destaque-foreground">
            {resumo.itens_total === 0 ? 'Lista vazia' : `${resumo.itens_comprados} de ${plural(resumo.itens_total, 'item', 'itens')}`}
          </span>
        </div>
        <div>
          <h2 className="line-clamp-3 break-words font-display text-[3.5rem] italic leading-[0.92] tracking-[-0.01em]">{lista.nome}</h2>
          <p className="dinheiro mt-3 whitespace-normal text-[1rem] text-white/85">
            {formatarReais(resumo.total_centavos)} no carrinho{com ? ` · ${com}` : ''}
          </p>
        </div>
      </article>
    </a>
  )
}

/** As demais listas, no formato das linhas da agenda da referência: miniatura, nome e detalhe. */
function LinhaLista({ lista, meuId }: { lista: ListaComResumo; meuId: string }) {
  const { resumo } = lista
  const detalhe = [
    resumo.itens_total === 0 ? 'vazia' : `${resumo.itens_comprados} de ${resumo.itens_total}`,
    formatarReais(resumo.total_centavos),
    companhia(lista, meuId),
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <li>
      <a
        href={`/lista/${lista.id}`}
        onClick={(e) => abrir(e, lista.id)}
        className="flex min-h-[4.25rem] items-center gap-3.5 rounded-cartao bg-card p-2.5 pr-3 shadow-cartao"
      >
        <img src={fotoDaLista(lista.id)} alt="" decoding="async" className="size-14 shrink-0 rounded-2xl object-cover" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[1rem] font-medium">{lista.nome}</span>
          <span className="dinheiro block truncate text-[0.875rem] text-muted-foreground">{detalhe}</span>
        </span>
        <ChevronRight aria-hidden className="size-5 shrink-0 text-muted-foreground" />
      </a>
    </li>
  )
}

/** Minhas listas: listas ativas, nova lista e entrada por código de convite (seção 7.1). */
export function Listas() {
  const usuario = useUsuario()
  const { data: perfil } = usePerfil()
  const { data: listas, isPending, isError, refetch } = useListas('ativa')
  const { estado } = useConexao()
  const [folha, setFolha] = useState<'nova' | 'codigo' | null>(null)

  const [destaque, ...outras] = listas ?? []
  const nome = primeiroNome(perfil?.nome)
  const subtitulo = !listas
    ? 'Suas listas de compras'
    : listas.length === 0
      ? 'Nenhuma lista ativa'
      : plural(listas.length, 'lista ativa', 'listas ativas')

  return (
    <Moldura rodape={<NavInferior atual="listas" />}>
      <header className="flex shrink-0 items-start justify-between gap-4 px-5 pt-6">
        <div className="min-w-0">
          <h1 className="truncate text-[1.375rem] font-medium leading-tight tracking-[-0.025em]">
            {saudacao()}
            {nome ? `, ${nome}` : ''}!
          </h1>
          <p className="mt-0.5 text-[1rem] text-muted-foreground">{subtitulo}</p>
        </div>
        <Button variant="secondary" size="icon" aria-label="Entrar numa lista com código de convite" onClick={() => setFolha('codigo')}>
          <UserRoundPlus className="size-5" />
        </Button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-28 pt-7">
        {estado !== 'online' ? <StatusConexao className="mb-4" /> : null}

        {isPending ? (
          <div aria-busy className="h-[19rem] esqueleto rounded-[1.75rem]" />
        ) : isError && !listas ? (
          <div className="pt-8">
            <p className="text-[1rem] leading-snug">Não deu para carregar suas listas. Confira a conexão.</p>
            <Button variant="secondary" className="mt-4" onClick={() => void refetch()}>
              Tentar de novo
            </Button>
          </div>
        ) : destaque ? (
          <>
            <div className="px-1.5 pb-2 pt-1">
              <CartaoDestaque lista={destaque} meuId={usuario.id} sozinho={outras.length === 0} />
            </div>
            {outras.length > 0 ? (
              <ul className="escalonada mt-8 space-y-2.5">
                {outras.map((lista) => (
                  <LinhaLista key={lista.id} lista={lista} meuId={usuario.id} />
                ))}
              </ul>
            ) : null}
          </>
        ) : (
          <div className="pt-10">
            <p className="font-display text-[3.5rem] italic leading-[0.92]">Vamos às compras?</p>
            <p className="mt-4 max-w-[20rem] text-[1rem] leading-snug text-muted-foreground">
              Crie a lista, convide quem compra com você e fotografe as etiquetas no mercado. O total do carrinho aparece nos dois celulares.
            </p>
            <button
              type="button"
              onClick={() => setFolha('codigo')}
              className="mt-7 flex min-h-12 w-full items-center gap-3 rounded-2xl border border-dashed border-primary/70 bg-card/60 px-4 text-left text-[1rem] font-medium text-primary-texto"
            >
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
                <Plus aria-hidden className="size-4" strokeWidth={3} />
              </span>
              Tenho um código de convite
            </button>
          </div>
        )}
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-background from-55% to-transparent px-5 pb-5 pt-10">
        <Button size="lg" className="pointer-events-auto w-full" onClick={() => setFolha('nova')}>
          <Plus className="size-5" strokeWidth={2.4} />
          Nova lista
        </Button>
      </div>

      {folha === 'nova' ? <NovaListaSheet aoFechar={() => setFolha(null)} /> : null}
      {folha === 'codigo' ? <CodigoSheet aoFechar={() => setFolha(null)} /> : null}
    </Moldura>
  )
}
