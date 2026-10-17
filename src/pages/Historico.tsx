import { useState, type MouseEvent } from 'react'
import { Moldura } from '@/components/layout/Moldura'
import { NavInferior } from '@/components/layout/NavInferior'
import { MapaHistorico } from '@/components/mapa/MapaHistorico'
import { Button } from '@/components/ui/button'
import { Segmented } from '@/components/ui/segmented'
import { useUsuario } from '@/hooks/sessao'
import { useListas } from '@/hooks/useListas'
import { formatarReais, somarCentavos } from '@/lib/dinheiro'
import { fotoDaLista } from '@/lib/fotos'
import { navegar } from '@/lib/rota'
import { listarNomes, plural, primeiroNome } from '@/lib/utils'
import type { ListaComResumo } from '@/types/app'

const diaDaSemana = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' })
const mes = new Intl.DateTimeFormat('pt-BR', { month: 'short' })

function LinhaHistorico({ lista, meuId }: { lista: ListaComResumo; meuId: string }) {
  const data = new Date(lista.finalizada_em ?? lista.criado_em)
  const outros = lista.membros.filter((m) => m.perfil_id !== meuId).map((m) => primeiroNome(m.nome))
  const detalhe = [lista.mercado, plural(lista.resumo.itens_comprados, 'item', 'itens'), outros.length > 0 ? `com ${listarNomes(outros)}` : null]
    .filter(Boolean)
    .join(' · ')

  const abrir = (evento: MouseEvent) => {
    if (evento.metaKey || evento.ctrlKey || evento.shiftKey) return
    evento.preventDefault()
    navegar(`/lista/${lista.id}?aba=itens`)
  }

  return (
    <li className="flex items-stretch gap-2.5">
      {/* Coluna de data à esquerda, como na agenda da referência. */}
      <time dateTime={data.toISOString()} className="flex w-9 shrink-0 flex-col items-center justify-center text-muted-foreground">
        <span className="text-sm capitalize">{diaDaSemana.format(data).replace('.', '')}</span>
        <span className="dinheiro text-[1.125rem] font-medium leading-tight text-foreground">{data.getDate()}</span>
        <span className="text-xs">{mes.format(data).replace('.', '')}</span>
      </time>
      <a href={`/lista/${lista.id}?aba=itens`} onClick={abrir} className="flex min-h-[4.25rem] min-w-0 flex-1 items-center gap-3 rounded-cartao bg-card p-2.5 pr-3 shadow-cartao">
        <img src={fotoDaLista(lista.id)} alt="" decoding="async" className="size-14 shrink-0 rounded-2xl object-cover" />
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 text-[1rem] font-medium leading-tight">{lista.nome}</span>
          <span className="mt-0.5 block truncate text-[0.875rem] text-muted-foreground">{detalhe}</span>
        </span>
        <span className="dinheiro shrink-0 text-[1rem] font-medium">
          {formatarReais(lista.resumo.total_centavos)}
        </span>
      </a>
    </li>
  )
}

/** Histórico: listas finalizadas com o total gasto (seção 7.1). */
export function Historico() {
  const usuario = useUsuario()
  const { data: listas, isPending, isError, refetch } = useListas('finalizada')
  const [vista, setVista] = useState<'lista' | 'mapa'>('lista')
  const gasto = somarCentavos((listas ?? []).map((l) => l.resumo.total_centavos))

  return (
    <Moldura rodape={<NavInferior atual="historico" />}>
      <header className="shrink-0 px-5 pt-6">
        <h1 className="text-[1.375rem] font-medium leading-tight tracking-[-0.025em]">Histórico</h1>
        <p className="dinheiro mt-0.5 whitespace-normal text-[1rem] text-muted-foreground">
          {listas && listas.length > 0
            ? `${plural(listas.length, 'compra finalizada', 'compras finalizadas')} · ${formatarReais(gasto)}`
            : 'Compras finalizadas'}
        </p>
        {listas && listas.length > 0 ? (
          <Segmented
            label="Como ver o histórico"
            className="mt-4"
            value={vista}
            onChange={setVista}
            options={[
              { value: 'lista', label: 'Lista' },
              { value: 'mapa', label: 'Mapa' },
            ]}
          />
        ) : null}
      </header>

      {vista === 'mapa' && listas && listas.length > 0 ? (
        <div className="flex min-h-0 flex-1 flex-col px-3 pb-3 pt-4">
          <MapaHistorico listas={listas} />
        </div>
      ) : (
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-8 pt-6">
        {isPending ? (
          <div aria-busy className="space-y-3">
            <div className="h-[4.5rem] esqueleto rounded-cartao" />
            <div className="h-[4.5rem] esqueleto rounded-cartao" />
          </div>
        ) : isError && !listas ? (
          <div className="pt-6">
            <p className="text-[1rem] leading-snug">Não deu para carregar o histórico. Confira a conexão.</p>
            <Button variant="secondary" className="mt-4" onClick={() => void refetch()}>
              Tentar de novo
            </Button>
          </div>
        ) : listas && listas.length > 0 ? (
          <ul className="escalonada space-y-3">
            {listas.map((lista) => (
              <LinhaHistorico key={lista.id} lista={lista} meuId={usuario.id} />
            ))}
          </ul>
        ) : (
          <div className="pt-8">
            <p className="font-display text-[2.25rem] italic leading-[0.95]">Nada por aqui ainda</p>
            <p className="mt-4 max-w-[20rem] text-[1rem] leading-snug text-muted-foreground">
              Quando passar no caixa, abra as opções da lista e toque em “Finalizar compra”. Ela vem para cá com o total gasto.
            </p>
          </div>
        )}
      </div>
      )}
    </Moldura>
  )
}
