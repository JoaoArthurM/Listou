import { ArrowLeft, Ellipsis } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { ChatView } from '@/components/chat/ChatView'
import { HistoricoCompra } from '@/components/chat/HistoricoCompra'
import { Moldura } from '@/components/layout/Moldura'
import { StatusConexao } from '@/components/layout/StatusConexao'
import { ItensView } from '@/components/lista/ItensView'
import { ListaConfigSheet } from '@/components/lista/ListaConfigSheet'
import { Recibo } from '@/components/lista/Recibo'
import { TotalBar } from '@/components/lista/TotalBar'
import { Button } from '@/components/ui/button'
import { Segmented } from '@/components/ui/segmented'
import { useUsuario } from '@/hooks/sessao'
import { useItens, usePrecosAnteriores } from '@/hooks/useItens'
import { useLista, usePerfil } from '@/hooks/useListas'
import { useMercadoPeloLocal } from '@/hooks/useMercadoPeloLocal'
import { useRealtime } from '@/hooks/useRealtime'
import { resumir } from '@/lib/api'
import { preverFaltantes } from '@/lib/previsao'
import { navegar, voltar } from '@/lib/rota'
import { cn } from '@/lib/utils'

/** Botão redondo do cabeçalho: vidro fosco sobre a conversa, no mesmo formato do botão da câmera. */
const botaoFlutuante = 'pointer-events-auto size-11 shrink-0 rounded-full border border-border/60 bg-card/85 shadow-cartao backdrop-blur-md hover:bg-card'

type ListaPaginaProps = { id: string; aba: 'chat' | 'itens' }

/** Tela principal: a lista com as abas Chat e Lista e o total do carrinho no rodapé (seção 7.1). */
export function ListaPagina({ id, aba }: ListaPaginaProps) {
  const { data: lista, isPending } = useLista(id)
  const { data: itens = [], isPending: carregandoItens } = useItens(id)
  const [opcoesAbertas, setOpcoesAbertas] = useState(false)
  // Aberta pelo botão do rodapé, a folha já vem no resumo da compra.
  const [abrirResumo, setAbrirResumo] = useState(false)
  const usuario = useUsuario()
  const { data: perfil } = usePerfil()
  const aoVivo = useRealtime(id, { id: usuario.id, nome: perfil?.nome ?? '' })
  const precos = usePrecosAnteriores(id)
  useMercadoPeloLocal(lista ?? undefined)

  // O cabeçalho flutua sobre a conversa (a mensagem passa por baixo dele, desfocada); a
  // altura dele vira variável CSS para a conversa deixar o espaço certo no começo.
  const [cabecalho, setCabecalho] = useState<HTMLElement | null>(null)
  const envoltorio = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!cabecalho) return
    const medir = () => envoltorio.current?.style.setProperty('--altura-cabecalho', `${cabecalho.offsetHeight}px`)
    medir()
    const observador = new ResizeObserver(medir)
    observador.observe(cabecalho)
    return () => observador.disconnect()
  }, [cabecalho])

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
            <div className="mx-auto h-6 w-40 esqueleto rounded-full" />
            <div className="h-48 esqueleto rounded-cartao" />
          </div>
        ) : (
          <div className="px-6 pt-12">
            <h1 className="font-display text-[2.125rem] italic leading-none">Lista não encontrada</h1>
            <p className="mt-3 text-[1rem] leading-snug text-muted-foreground">
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
  const subtitulo = lista.mercado
  const sobrepor = aba === 'chat' && !finalizada

  return (
    <Moldura
      rodape={
        <>
          <Segmented
            label="Visão da lista"
            className="mb-2.5"
            tom="escuro"
            compacto
            value={aba}
            onChange={(nova) => navegar(nova === 'itens' ? `/lista/${id}?aba=itens` : `/lista/${id}`, { substituir: true })}
            options={
              finalizada
                ? [
                    { value: 'chat', label: 'Histórico' },
                    { value: 'itens', label: 'Recibo' },
                  ]
                : [
                    {
                      value: 'itens',
                      label: (
                        <>
                          Lista
                          {faltando > 0 ? (
                            <span className="dinheiro grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground">
                              <span className="sr-only">, faltam </span>
                              {faltando}
                            </span>
                          ) : null}
                        </>
                      ),
                    },
                    { value: 'chat', label: 'Chat' },
                  ]
            }
          />
          <TotalBar
          resumo={resumo}
          orcamentoCentavos={lista.orcamento_centavos}
          aoFinalizar={finalizada ? undefined : () => { setAbrirResumo(true); setOpcoesAbertas(true) }}
          semPreco={itens.filter((i) => i.comprado && i.total_centavos === null).length}
          previstoCentavos={!finalizada && previsao.comPreco > 0 ? resumo.total_centavos + previsao.centavos : null}
          />
        </>
      }
    >
      <div ref={envoltorio} className="relative flex min-h-0 flex-1 flex-col">
      {/* Botões redondos e uma pílula com o nome, flutuando sobre a conversa: sem barra, a mensagem passa por trás. */}
      <header
        ref={setCabecalho}
        className={cn('pointer-events-none z-10 flex shrink-0 items-center gap-2 px-3 pb-1 pt-3', sobrepor && 'absolute inset-x-0 top-0')}
      >
        <Button variant="ghost" size="icon" aria-label="Voltar" className={botaoFlutuante} onClick={() => voltar(finalizada ? '/historico' : '/')}>
          <ArrowLeft className="size-6" />
        </Button>
        <div className="flex min-w-0 flex-1 justify-center">
          <div className="pointer-events-auto flex min-h-11 min-w-0 max-w-full flex-col items-center justify-center rounded-3xl border border-border/60 bg-card/85 px-4 py-1 shadow-cartao backdrop-blur-md">
            <div className="flex min-w-0 items-center gap-2">
              <h1 className="truncate text-[1.0625rem] font-medium leading-tight tracking-[-0.02em]">{lista.nome}</h1>
              {finalizada ? null : <StatusConexao canal={aoVivo.canal} compacto className="h-5 shrink-0" />}
            </div>
            {subtitulo ? <p className="max-w-full truncate text-[0.8125rem] leading-tight text-muted-foreground">{subtitulo}</p> : null}
          </div>
        </div>
        <Button variant="ghost" size="icon" aria-label="Opções da lista" className={botaoFlutuante} onClick={() => { setAbrirResumo(false); setOpcoesAbertas(true) }}>
          <Ellipsis className="size-6" />
        </Button>
      </header>

      <div className={cn('flex min-h-0 flex-1 flex-col', !sobrepor && 'pt-2')}>
        {finalizada ? (
          aba === 'chat' ? (
            <HistoricoCompra lista={lista} />
          ) : (
            <Recibo lista={lista} itens={itens} carregando={carregandoItens} />
          )
        ) : aba === 'chat' ? (
          <ChatView lista={lista} itens={itens} aoVivo={aoVivo} somenteLeitura={false} />
        ) : (
          <ItensView lista={lista} itens={itens} resumo={resumo} precos={precos} carregando={carregandoItens} somenteLeitura={false} />
        )}
      </div>

      </div>

      {opcoesAbertas ? <ListaConfigSheet lista={lista} itens={itens} iniciarNoResumo={abrirResumo} aoFechar={() => setOpcoesAbertas(false)} /> : null}
    </Moldura>
  )
}
