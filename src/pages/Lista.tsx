import { ArrowLeft, Ellipsis } from 'lucide-react'
import { useState } from 'react'
import { ChatView } from '@/components/chat/ChatView'
import { Dica } from '@/components/layout/Dica'
import { Moldura } from '@/components/layout/Moldura'
import { StatusConexao } from '@/components/layout/StatusConexao'
import { ItensView } from '@/components/lista/ItensView'
import { ListaConfigSheet } from '@/components/lista/ListaConfigSheet'
import { TotalBar } from '@/components/lista/TotalBar'
import { Button } from '@/components/ui/button'
import { Segmented } from '@/components/ui/segmented'
import { useUsuario } from '@/hooks/sessao'
import { useItens, usePrecosAnteriores } from '@/hooks/useItens'
import { useLista, usePerfil } from '@/hooks/useListas'
import { useRealtime } from '@/hooks/useRealtime'
import { resumir } from '@/lib/api'
import { formatarReais } from '@/lib/dinheiro'
import { preverFaltantes } from '@/lib/previsao'
import { resumirCompra } from '@/lib/resumo'
import { navegar, voltar } from '@/lib/rota'
import { plural } from '@/lib/utils'

type ListaPaginaProps = { id: string; aba: 'chat' | 'itens' }

const dataCurta = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long' })

/** Tela principal: a lista com as abas Chat e Itens e o total do carrinho no rodapé (seção 7.1). */
export function ListaPagina({ id, aba }: ListaPaginaProps) {
  const { data: lista, isPending } = useLista(id)
  const { data: itens = [], isPending: carregandoItens } = useItens(id)
  const [opcoesAbertas, setOpcoesAbertas] = useState(false)
  const usuario = useUsuario()
  const { data: perfil } = usePerfil()
  const aoVivo = useRealtime(id, { id: usuario.id, nome: perfil?.nome ?? '' })
  const precos = usePrecosAnteriores(id)

  const resumo = resumir(itens)
  const faltando = resumo.itens_total - resumo.itens_comprados

  if (!lista) {
    return (
      <Moldura>
        <div className="px-3 pt-3">
          <Button variant="ghost" size="icon" aria-label="Voltar" onClick={() => voltar('/')}>
            <ArrowLeft className="size-6" />
          </Button>
        </div>
        {isPending ? (
          <div aria-busy className="space-y-4 px-5 pt-6">
            <div className="mx-auto h-6 w-40 animate-pulso rounded-full bg-muted" />
            <div className="h-48 animate-pulso rounded-cartao bg-muted" />
          </div>
        ) : (
          <div className="px-6 pt-12">
            <h1 className="font-display text-[2.5rem] italic leading-none">Lista não encontrada</h1>
            <p className="mt-3 text-[1.0625rem] leading-snug text-muted-foreground">
              Ela pode ter sido excluída, ou você saiu dela. Se alguém te convidou, peça o código de novo.
            </p>
            <Button className="mt-6" onClick={() => navegar('/', { substituir: true })}>
              Ver minhas listas
            </Button>
          </div>
        )}
      </Moldura>
    )
  }

  const finalizada = lista.status === 'finalizada'
  // Carrinho mais o que falta, pelo preço da última compra de cada item.
  const previsao = preverFaltantes(itens, precos)
  const economia = finalizada ? resumirCompra(itens).economia.total : 0
  const subtitulo = [
    `${resumo.itens_comprados} de ${plural(resumo.itens_total, 'item', 'itens')}`,
    lista.mercado,
  ]
    .filter(Boolean)
    .join(' • ')

  return (
    <Moldura
      rodape={
        <TotalBar
          resumo={resumo}
          orcamentoCentavos={lista.orcamento_centavos}
          semPreco={itens.filter((i) => i.comprado && i.total_centavos === null).length}
          previstoCentavos={!finalizada && previsao.comPreco > 0 ? resumo.total_centavos + previsao.centavos : null}
        />
      }
    >
      <header className="shrink-0 px-3 pt-3">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" aria-label="Voltar" onClick={() => voltar(finalizada ? '/historico' : '/')}>
            <ArrowLeft className="size-6" />
          </Button>
          <div className="min-w-0 flex-1 text-center">
            <h1 className="truncate text-[1.25rem] font-medium leading-tight tracking-[-0.02em]">{lista.nome}</h1>
            <p className="dinheiro truncate text-[0.9375rem] text-muted-foreground">{subtitulo}</p>
          </div>
          <Button variant="ghost" size="icon" aria-label="Opções da lista" onClick={() => setOpcoesAbertas(true)}>
            <Ellipsis className="size-6" />
          </Button>
        </div>

        <div className="mt-3 flex items-center gap-2 px-1">
          <Segmented
            label="Visão da lista"
            className="flex-1"
            value={aba}
            onChange={(nova) => navegar(nova === 'itens' ? `/lista/${id}?aba=itens` : `/lista/${id}`, { substituir: true })}
            options={[
              { value: 'chat', label: 'Chat' },
              {
                value: 'itens',
                label: (
                  <>
                    Itens
                    {faltando > 0 ? (
                      <span className="dinheiro grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground">
                        <span className="sr-only">, faltam </span>
                        {faltando}
                      </span>
                    ) : null}
                  </>
                ),
              },
            ]}
          />
          <StatusConexao canal={aoVivo.canal} />
        </div>
      </header>

      {finalizada ? (
        <div className="shrink-0 px-4 pt-3">
          <Dica>
            Compra finalizada{lista.finalizada_em ? ` em ${dataCurta.format(new Date(lista.finalizada_em))}` : ''}.
            {economia > 0 ? ` Atacado e cartão economizaram ${formatarReais(economia)}.` : ''} Para mexer nela de novo, reabra nas opções.
          </Dica>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col pt-3">
        {aba === 'chat' ? (
          <ChatView lista={lista} itens={itens} aoVivo={aoVivo} somenteLeitura={finalizada} />
        ) : (
          <ItensView lista={lista} itens={itens} resumo={resumo} precos={precos} carregando={carregandoItens} somenteLeitura={finalizada} />
        )}
      </div>

      {opcoesAbertas ? <ListaConfigSheet lista={lista} itens={itens} aoFechar={() => setOpcoesAbertas(false)} /> : null}
    </Moldura>
  )
}
