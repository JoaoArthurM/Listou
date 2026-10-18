import { useQueryClient } from '@tanstack/react-query'
import { ArrowUp, ArrowUpRight, Clock, Mic, RotateCcw } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type FormEvent, type UIEvent } from 'react'
import { Button } from '@/components/ui/button'
import { useUsuario } from '@/hooks/sessao'
import { useConexao } from '@/hooks/useConexao'
import { useMembros } from '@/hooks/useListas'
import { useMensagens } from '@/hooks/useMensagens'
import { useColadoNoFim } from '@/hooks/useColadoNoFim'
import { useFrase } from '@/hooks/useFrase'
import type { AoVivo } from '@/hooks/useRealtime'
import { chaves, enviarAoChat, enviarVozAoChat } from '@/lib/api'
import { avisar } from '@/lib/avisos'
import { descartarFoto, fotografarEtiqueta, tentarFotoDeNovo, useFilaDeFotos } from '@/lib/filaDeFotos'
import { chaveDoDia, horaCurta, rotuloDoDia } from '@/lib/datas'
import { fecharTeclado } from '@/lib/teclado'
import { listarNomes, primeiroNome } from '@/lib/utils'
import { gravar, vozDisponivel, type Gravacao } from '@/lib/voz'
import type { Item, Lista } from '@/types/app'
import { BotaoIrAoFim, DISTANCIA_DO_BOTAO } from './BotaoIrAoFim'
import { CameraButton } from './CameraButton'
import { FotoEtiqueta } from './Foto'
import { Gravador } from './Gravador'
import { Balao, Digitando, MessageBubble, Pontos } from './MessageBubble'

type ChatViewProps = { lista: Lista; itens: Item[]; aoVivo: AoVivo; somenteLeitura: boolean }

// O que o usuário mandou e ainda não voltou do servidor (ou falhou). Fica só
// na memória desta tela; o que deu certo chega pela busca de mensagens. As
// fotos não entram aqui: elas têm fila própria, que sobrevive a fechar o app
// (src/lib/filaDeFotos.ts).
type Pendente =
  | { id: string; tipo: 'texto'; texto: string; erro: string | null; antes: string[] }
  | { id: string; tipo: 'voz'; audio: string; erro: string | null; antes: string[] }

const SEM_CONEXAO = 'Sem conexão. Tente de novo quando o sinal voltar.'
const SUGESTOES = ['O que falta?', 'O que já peguei?']
const PAUSA_DE_DIGITACAO_MS = 2500

const mensagemDoErro = (erro: unknown, padrao: string) => (erro instanceof Error && erro.message ? erro.message : padrao)

/** Aba Chat: conversa com o assistente por texto, voz ou foto de etiqueta (seção 7.1). */
export function ChatView({ lista, itens, aoVivo, somenteLeitura }: ChatViewProps) {
  const usuario = useUsuario()
  const queryClient = useQueryClient()
  const { estado } = useConexao()
  const { data: mensagens, isPending } = useMensagens(lista.id)
  const { data: membros = [] } = useMembros(lista.id)
  const fila = useFilaDeFotos()
  const fotos = useMemo(() => fila.filter((f) => f.lista_id === lista.id), [fila, lista.id])
  const [texto, setTexto] = useState('')
  const [pendentes, setPendentes] = useState<Pendente[]>([])
  const [gravacao, setGravacao] = useState<Gravacao | null>(null)
  // Mensagens que já estavam na conversa ao abrir não animam; só as que chegam depois.
  const iniciais = useRef<Set<string> | null>(null)
  const pausa = useRef<number>()
  const { anunciar, outros } = aoVivo

  const offline = estado === 'offline'
  const esperandoIA = pendentes.some((p) => p.erro === null) || fotos.some((f) => f.estado === 'lendo' || f.estado === 'preparando')
  const lendoFoto = fotos.some((f) => f.estado === 'lendo' || f.estado === 'preparando')
  const falando = pendentes.some((p) => p.erro === null && p.tipo === 'voz')
  const frase = useFrase(!esperandoIA ? null : lendoFoto ? 'foto' : falando ? 'voz' : 'texto')
  const digitando = outros.filter((o) => o.digitando).map((o) => primeiroNome(o.nome) || 'Alguém')
  // A IA também "pensa" quando o pedido saiu do outro aparelho.
  const outrosEsperando = outros.filter((o) => o.esperandoIA).map((o) => primeiroNome(o.nome) || 'alguém')
  // O servidor grava a mensagem antes de a IA responder, e ela chega pelo
  // Realtime enquanto o pedido ainda está pendente. Daí o balão real substitui o
  // pendente na hora, em vez de os dois aparecerem juntos.
  const visiveis = pendentes.filter((p) => {
    if (p.erro) return true
    const jaChegou = mensagens?.some(
      (m) =>
        m.autor_id === usuario.id &&
        m.papel === 'usuario' &&
        !p.antes.includes(m.id) &&
        (p.tipo === 'voz' || m.conteudo === p.texto),
    )
    return !jaChegou
  })
  const total = (mensagens?.length ?? 0) + visiveis.length + fotos.length
  if (iniciais.current === null && mensagens) iniciais.current = new Set(mensagens.map((m) => m.id))

  // A conversa abre no fim e acompanha: mensagem nova, "digitando" e fotos que terminam de carregar.
  const [diaFlutuante, setDiaFlutuante] = useState<string | null>(null)
  const sumirDia = useRef<number>()
  const [longe, setLonge] = useState(false)
  const { rolagem, conteudo, aoRolar, irParaOFim } = useColadoNoFim(`${total}|${esperandoIA}|${digitando.length}|${outrosEsperando.length}`)

  // Os outros aparelhos ficam sabendo que há um pedido meu com a IA.
  useEffect(() => {
    anunciar({ esperandoIA })
  }, [esperandoIA, anunciar])

  useEffect(
    () => () => {
      window.clearTimeout(pausa.current)
      anunciar({ digitando: false, esperandoIA: false })
    },
    [anunciar],
  )

  // Sair da tela no meio de uma gravação solta o microfone.
  useEffect(() => () => gravacao?.cancelar(), [gravacao])

  const editar = (id: string, mudanca: Partial<Pendente>) =>
    setPendentes((atuais) => atuais.map((p) => (p.id === id ? ({ ...p, ...mudanca } as Pendente) : p)))
  const tirar = (id: string) => setPendentes((atuais) => atuais.filter((p) => p.id !== id))

  const atualizarTudo = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: chaves.mensagens(lista.id) }),
      queryClient.invalidateQueries({ queryKey: chaves.itens(lista.id) }),
    ])

  async function mandar(pendente: Pendente) {
    if (offline) return editar(pendente.id, { erro: SEM_CONEXAO })
    editar(pendente.id, { erro: null })
    try {
      if (pendente.tipo === 'texto') await enviarAoChat(lista.id, pendente.texto)
      else await enviarVozAoChat(lista.id, pendente.audio)
      await atualizarTudo()
      tirar(pendente.id)
    } catch (erro) {
      editar(pendente.id, { erro: mensagemDoErro(erro, 'Não consegui enviar. Tente de novo.') })
    }
  }

  const idsAtuais = () => mensagens?.map((m) => m.id) ?? []

  function enfileirar(pendente: Pendente) {
    // Pedido enviado (texto, voz ou atalho): a conversa precisa de tela, não de teclado.
    fecharTeclado()
    irParaOFim()
    setPendentes((atuais) => [...atuais, pendente])
    void mandar(pendente)
  }

  function pararDeDigitar() {
    window.clearTimeout(pausa.current)
    anunciar({ digitando: false })
  }

  function aoDigitar(valor: string) {
    setTexto(valor)
    if (valor.trim() === '') return pararDeDigitar()
    anunciar({ digitando: true })
    window.clearTimeout(pausa.current)
    pausa.current = window.setTimeout(() => anunciar({ digitando: false }), PAUSA_DE_DIGITACAO_MS)
  }

  function enviar(evento: FormEvent) {
    evento.preventDefault()
    const limpo = texto.trim()
    if (!limpo) return
    pararDeDigitar()
    enfileirar({ id: crypto.randomUUID(), tipo: 'texto', texto: limpo, erro: null, antes: idsAtuais() })
    setTexto('')
  }

  async function comecarAGravar() {
    fecharTeclado()
    try {
      setGravacao(await gravar())
    } catch (erro) {
      avisar(mensagemDoErro(erro, 'Não consegui usar o microfone.'), 'erro')
    }
  }

  async function enviarGravacao() {
    if (!gravacao) return
    const atual = gravacao
    setGravacao(null)
    try {
      enfileirar({ id: crypto.randomUUID(), tipo: 'voz', audio: await atual.parar(), erro: null, antes: idsAtuais() })
    } catch (erro) {
      avisar(mensagemDoErro(erro, 'Não deu para preparar o áudio.'), 'erro')
    }
  }

  const nomeDe = (autorId: string | null) =>
    autorId && autorId !== usuario.id ? primeiroNome(membros.find((m) => m.perfil_id === autorId)?.nome) || null : null

  const vazio = !isPending && total === 0
  // Atalhos: campo vazio e a última fala é da IA (sem nada a caminho). Com um card de
  // etiqueta aberto a tela é do card, e com o teclado aberto não sobra espaço.
  const ultima = mensagens?.[mensagens.length - 1]
  const cardAberto = mensagens?.some((m) => m.dados?.tipo === 'etiqueta' && m.dados.estado === 'aberto') ?? false
  const mostrarAtalhos =
    !gravacao && texto.trim() === '' && ultima?.papel === 'assistente' && visiveis.length === 0 && !esperandoIA && !cardAberto
  const podeFalar = vozDisponivel()

  // Como no Telegram: ao rolar, uma pílula sob o cabeçalho diz de que dia é a mensagem
  // que está passando por ali e some logo depois que a rolagem para.
  function aoRolarComDia(evento: UIEvent<HTMLDivElement>) {
    aoRolar()
    const area = evento.currentTarget
    window.clearTimeout(sumirDia.current)
    const distancia = area.scrollHeight - area.scrollTop - area.clientHeight
    setLonge(distancia > DISTANCIA_DO_BOTAO)
    if (distancia < 80) return setDiaFlutuante(null)
    const limite = area.getBoundingClientRect().top + parseFloat(getComputedStyle(area).paddingTop)
    const mensagemNoTopo = Array.from(area.querySelectorAll<HTMLElement>('li[data-dia]')).find((li) => li.getBoundingClientRect().bottom > limite)
    setDiaFlutuante(mensagemNoTopo?.dataset.dia ?? null)
    sumirDia.current = window.setTimeout(() => setDiaFlutuante(null), 1400)
  }

  return (
    <>
      <p
        aria-hidden
        className={`pointer-events-none absolute inset-x-0 top-[calc(var(--altura-cabecalho,0px)+0.625rem)] z-20 flex justify-center transition-[opacity,transform] duration-300 ease-saida ${diaFlutuante ? 'translate-y-0 opacity-100' : '-translate-y-1 opacity-0'}`}
      >
        <span className="rounded-full bg-foreground/80 px-3 py-1 text-xs font-medium capitalize text-background backdrop-blur">{diaFlutuante}</span>
      </p>
      <div className="relative flex min-h-0 flex-1 flex-col">
      <div ref={rolagem} onScroll={aoRolarComDia} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 pt-[calc(var(--altura-cabecalho,0px)+0.5rem)]">
        <div ref={conteudo}>
        {isPending ? (
          <div aria-busy className="space-y-3">
            <div className="h-12 w-2/3 esqueleto rounded-3xl" />
            <div className="ml-auto h-12 w-1/2 esqueleto rounded-3xl" />
          </div>
        ) : null}

        {vazio ? (
          <div className="px-1 pt-8">
            <p className="font-display text-[2.125rem] italic leading-none">Bora ao mercado</p>
            <p className="mt-3 max-w-[20rem] text-[1rem] leading-snug text-muted-foreground">
              {somenteLeitura
                ? 'Esta compra foi finalizada sem conversa.'
                : 'Fotografe a etiqueta de preço e diga quantos levou: eu escolho o preço certo e somo o carrinho. Também entendo pedidos escritos ou falados.'}
            </p>
            {somenteLeitura ? null : (
              <div className="mt-5 flex flex-wrap gap-2">
                {SUGESTOES.map((sugestao) => (
                  <Button
                    key={sugestao}
                    variant="secondary"
                    size="sm"
                    disabled={offline}
                    onClick={() => enfileirar({ id: crypto.randomUUID(), tipo: 'texto', texto: sugestao, erro: null, antes: idsAtuais() })}
                  >
                    {sugestao}
                  </Button>
                ))}
              </div>
            )}
          </div>
        ) : null}

        <ol className="space-y-3">
          {mensagens?.map((mensagem, i) => {
            const quando = new Date(mensagem.criado_em)
            const anterior = i > 0 ? mensagens[i - 1] : null
            const novoDia = !anterior || chaveDoDia(new Date(anterior.criado_em)) !== chaveDoDia(quando)
            const minha = mensagem.autor_id === usuario.id
            return (
              <li
                key={mensagem.id}
                data-dia={rotuloDoDia(quando)}
                className={iniciais.current && !iniciais.current.has(mensagem.id) ? (minha ? 'animate-chega' : 'animate-surge') : undefined}
              >
                {novoDia ? (
                  <p className="mb-3 mt-1 flex justify-center">
                    <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium capitalize text-muted-foreground">
                      {rotuloDoDia(quando)}
                    </span>
                  </p>
                ) : null}
                <MessageBubble
                  mensagem={mensagem}
                  lista={lista}
                  itens={itens}
                  minha={minha}
                  autor={nomeDe(mensagem.autor_id)}
                  somenteLeitura={somenteLeitura}
                />
                {/* Hora do envio, sob a mensagem e do lado dela (à esquerda, depois do avatar). */}
                <time
                  dateTime={quando.toISOString()}
                  className={`dinheiro mt-0.5 block text-[0.6875rem] text-muted-foreground ${minha ? 'pr-1 text-right' : 'pl-10'}`}
                >
                  {horaCurta(quando)}
                </time>
              </li>
            )
          })}

          {visiveis.map((pendente) => (
            <li key={pendente.id} className="flex animate-surge flex-col items-end gap-1.5">
              {pendente.tipo === 'texto' ? (
                <Balao lado="eu" className={pendente.erro ? 'opacity-60' : undefined}>
                  {pendente.texto}
                </Balao>
              ) : (
                <Balao lado="eu" className={pendente.erro ? 'flex items-center gap-2 opacity-60' : 'flex items-center gap-2'}>
                  <Mic aria-hidden className="size-4" />
                  {pendente.erro ? 'Mensagem de voz' : 'Ouvindo o que você disse'}
                  {pendente.erro ? null : <Pontos />}
                </Balao>
              )}
              {pendente.erro ? (
                <div role="alert" className="flex max-w-[85%] flex-col items-end text-right text-sm text-destructive">
                  <span>{pendente.erro}</span>
                  <Button variant="ghost" size="sm" className="-mr-3 px-3 text-foreground" onClick={() => void mandar(pendente)}>
                    <RotateCcw className="size-4" />
                    Tentar de novo
                  </Button>
                </div>
              ) : null}
            </li>
          ))}

          {fotos.map((foto) => (
            <li key={foto.id} data-foto-na-fila={foto.estado} className="flex animate-surge flex-col items-end gap-1.5">
              <FotoEtiqueta src={foto.previa} alt="Foto que você tirou da etiqueta">
                {foto.estado === 'erro' ? null : foto.estado === 'na_fila' ? (
                  <div role="status" className="absolute inset-0 flex items-end bg-black/45">
                    <span className="flex w-full items-center gap-1.5 px-3 pb-2.5 text-sm font-medium text-white">
                      <Clock aria-hidden className="size-4" />
                      Na fila
                    </span>
                  </div>
                ) : (
                  <div role="status" className="absolute inset-0 flex items-end bg-black/35">
                    {/* Faixa de luz varrendo a etiqueta enquanto a leitura acontece. */}
                    <span aria-hidden className="absolute inset-x-0 top-0 h-full animate-varredura bg-gradient-to-b from-transparent via-white/45 to-transparent" />
                    <span className="relative w-full px-3 pb-2.5 text-sm font-medium text-white">Lendo etiqueta…</span>
                  </div>
                )}
              </FotoEtiqueta>
              {foto.estado === 'na_fila' ? (
                <p className="max-w-[85%] text-right text-sm text-muted-foreground">Sem sinal agora. Leio esta etiqueta sozinho quando a conexão voltar.</p>
              ) : null}
              {foto.estado === 'erro' ? (
                <div role="alert" className="flex w-full flex-col items-end gap-2.5 text-right text-sm text-destructive">
                  <span>{foto.erro}</span>
                  <span className="flex w-full gap-2">
                    <Button variant="secondary" className="flex-1 px-3 text-foreground" onClick={() => void descartarFoto(foto.id)}>
                      Descartar
                    </Button>
                    {foto.podeTentar ? (
                      <Button variant="dark" className="flex-1 px-3" onClick={() => void tentarFotoDeNovo(foto.id)}>
                        <RotateCcw aria-hidden className="size-4" />
                        Tentar de novo
                      </Button>
                    ) : null}
                  </span>
                </div>
              ) : null}
            </li>
          ))}

          {digitando.length > 0 ? (
            <li className="animate-surge">
              <Digitando lado="outro" texto={`${listarNomes(digitando)} ${digitando.length === 1 ? 'está' : 'estão'} digitando`} />
            </li>
          ) : null}

          {esperandoIA || outrosEsperando.length > 0 ? (
            <li className="animate-surge">
              <Digitando
                lado="assistente"
                texto={esperandoIA ? (frase ?? 'Listou está pensando…') : `Listou está respondendo a ${listarNomes(outrosEsperando)}`}
              />
            </li>
          ) : null}
        </ol>

        {/* Sugestões no fim da conversa: um toque envia, como se tivesse digitado. */}
        {mostrarAtalhos && !somenteLeitura ? (
          <div className="mt-3 flex animate-surge flex-wrap justify-end gap-2 [.teclado-aberto_&]:hidden">
            {SUGESTOES.map((sugestao) => (
              <button
                key={sugestao}
                type="button"
                disabled={offline}
                onClick={() => enfileirar({ id: crypto.randomUUID(), tipo: 'texto', texto: sugestao, erro: null, antes: idsAtuais() })}
                className="flex h-11 items-center gap-2 rounded-full border border-controle/70 bg-card pl-4 pr-3 text-[0.875rem] font-medium transition-colors active:bg-muted disabled:opacity-50"
              >
                {sugestao}
                <ArrowUpRight aria-hidden className="size-4 text-primary-texto" strokeWidth={2.4} />
              </button>
            ))}
          </div>
        ) : null}
        </div>
      </div>

      <BotaoIrAoFim visivel={longe} aoTocar={() => rolagem.current?.scrollTo({ top: rolagem.current.scrollHeight, behavior: 'smooth' })} />
      </div>

      {somenteLeitura ? null : (
        <div className="shrink-0 border-t border-border bg-background px-3 pb-3 pt-2.5">
          {offline ? (
            <p role="status" className="mb-2 px-2 text-sm text-muted-foreground">
              Sem conexão. As fotos de etiqueta ficam na fila e são lidas quando o sinal voltar; texto e voz precisam dele.
            </p>
          ) : null}
          {gravacao ? (
            <Gravador
              gravacao={gravacao}
              aoEnviar={() => void enviarGravacao()}
              aoCancelar={() => {
                gravacao.cancelar()
                setGravacao(null)
              }}
            />
          ) : (
            <form onSubmit={enviar} className="flex items-center gap-2">
              <CameraButton
                aoFotografar={(arquivo) => {
                  fecharTeclado()
                  irParaOFim()
                  void fotografarEtiqueta(lista.id, usuario.id, arquivo)
                }}
              />
              <div className="flex h-12 min-w-0 flex-1 items-center rounded-full border border-controle/70 bg-card pl-5 pr-1 transition-[border-color,box-shadow] duration-200 focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/20">
                <input
                  value={texto}
                  onChange={(e) => aoDigitar(e.target.value)}
                  onBlur={pararDeDigitar}
                  aria-label="Mensagem"
                  placeholder="Escreva ou fale o pedido"
                  maxLength={1000}
                  autoComplete="off"
                  enterKeyHint="send"
                  className="h-full min-w-0 flex-1 bg-transparent placeholder:text-muted-foreground focus:outline-none"
                />
                {/* Campo vazio oferece o microfone; com texto, o botão vira enviar. */}
                {texto.trim() === '' && podeFalar ? (
                  <Button key="mic" variant="dark" size="icon" aria-label="Falar o pedido" className="animate-pop" disabled={offline} onClick={() => void comecarAGravar()}>
                    <Mic className="size-5" />
                  </Button>
                ) : (
                  <Button key="enviar" type="submit" variant="dark" size="icon" aria-label="Enviar mensagem" className="animate-pop" disabled={!texto.trim() || offline}>
                    <ArrowUp className="size-5" strokeWidth={2.4} />
                  </Button>
                )}
              </div>
            </form>
          )}
        </div>
      )}
    </>
  )
}
