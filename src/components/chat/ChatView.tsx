import { useQueryClient } from '@tanstack/react-query'
import { ArrowUp, Mic, RotateCcw } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { useUsuario } from '@/hooks/sessao'
import { useConexao } from '@/hooks/useConexao'
import { useMembros } from '@/hooks/useListas'
import { useMensagens } from '@/hooks/useMensagens'
import type { AoVivo } from '@/hooks/useRealtime'
import { chaves, enviarAoChat, enviarFoto, enviarVozAoChat, lerEtiqueta } from '@/lib/api'
import { avisar } from '@/lib/avisos'
import { comprimirImagem } from '@/lib/imagem'
import { listarNomes, primeiroNome } from '@/lib/utils'
import { gravar, vozDisponivel, type Gravacao } from '@/lib/voz'
import type { Item, Lista } from '@/types/app'
import { CameraButton } from './CameraButton'
import { FotoEtiqueta } from './Foto'
import { Gravador } from './Gravador'
import { Balao, Digitando, MessageBubble, Pontos } from './MessageBubble'

type ChatViewProps = { lista: Lista; itens: Item[]; aoVivo: AoVivo; somenteLeitura: boolean }

// O que o usuário mandou e ainda não voltou do servidor (ou falhou). Fica só
// na memória desta tela; o que deu certo chega pela busca de mensagens.
type Pendente =
  | { id: string; tipo: 'texto'; texto: string; erro: string | null }
  | { id: string; tipo: 'voz'; audio: string; erro: string | null }
  | { id: string; tipo: 'foto'; previa: string; foto: Blob | null; arquivo: File; erro: string | null }

const SEM_CONEXAO = 'Sem conexão. Tente de novo quando o sinal voltar.'
const SUGESTOES = ['O que falta?', 'Quanto já deu?']
const PAUSA_DE_DIGITACAO_MS = 2500

const mensagemDoErro = (erro: unknown, padrao: string) => (erro instanceof Error && erro.message ? erro.message : padrao)

/** Aba Chat: conversa com o assistente por texto, voz ou foto de etiqueta (seção 7.1). */
export function ChatView({ lista, itens, aoVivo, somenteLeitura }: ChatViewProps) {
  const usuario = useUsuario()
  const queryClient = useQueryClient()
  const { estado } = useConexao()
  const { data: mensagens, isPending } = useMensagens(lista.id)
  const { data: membros = [] } = useMembros(lista.id)
  const [texto, setTexto] = useState('')
  const [pendentes, setPendentes] = useState<Pendente[]>([])
  const [gravacao, setGravacao] = useState<Gravacao | null>(null)
  const rolagem = useRef<HTMLDivElement>(null)
  const previas = useRef(new Set<string>())
  const pausa = useRef<number>()
  const { anunciar, outros } = aoVivo

  const offline = estado === 'offline'
  const esperandoIA = pendentes.some((p) => p.erro === null)
  const digitando = outros.filter((o) => o.digitando).map((o) => primeiroNome(o.nome) || 'Alguém')
  // A IA também "pensa" quando o pedido saiu do outro aparelho.
  const outrosEsperando = outros.filter((o) => o.esperandoIA).map((o) => primeiroNome(o.nome) || 'alguém')
  const total = (mensagens?.length ?? 0) + pendentes.length

  // A conversa abre e acompanha no fim, como qualquer chat.
  useLayoutEffect(() => {
    const el = rolagem.current
    if (el) el.scrollTop = el.scrollHeight
  }, [total, esperandoIA, digitando.length, outrosEsperando.length])

  // Os outros aparelhos ficam sabendo que há um pedido meu com a IA.
  useEffect(() => {
    anunciar({ esperandoIA })
  }, [esperandoIA, anunciar])

  useEffect(() => {
    const urls = previas.current
    return () => {
      window.clearTimeout(pausa.current)
      anunciar({ digitando: false, esperandoIA: false })
      for (const url of urls) URL.revokeObjectURL(url)
    }
  }, [anunciar])

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
      else if (pendente.tipo === 'voz') await enviarVozAoChat(lista.id, pendente.audio)
      else {
        const foto = pendente.foto ?? (await comprimirImagem(pendente.arquivo)).blob
        editar(pendente.id, { foto })
        await lerEtiqueta(lista.id, await enviarFoto(lista.id, foto))
      }
      await atualizarTudo()
      tirar(pendente.id)
    } catch (erro) {
      const padrao = pendente.tipo === 'foto' ? 'Não consegui ler a etiqueta. Tente outra foto.' : 'Não consegui enviar. Tente de novo.'
      editar(pendente.id, { erro: mensagemDoErro(erro, padrao) })
    }
  }

  function enfileirar(pendente: Pendente) {
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
    enfileirar({ id: crypto.randomUUID(), tipo: 'texto', texto: limpo, erro: null })
    setTexto('')
  }

  function fotografar(arquivo: File) {
    const previa = URL.createObjectURL(arquivo)
    previas.current.add(previa)
    enfileirar({ id: crypto.randomUUID(), tipo: 'foto', previa, foto: null, arquivo, erro: null })
  }

  async function comecarAGravar() {
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
      enfileirar({ id: crypto.randomUUID(), tipo: 'voz', audio: await atual.parar(), erro: null })
    } catch (erro) {
      avisar(mensagemDoErro(erro, 'Não deu para preparar o áudio.'), 'erro')
    }
  }

  const nomeDe = (autorId: string | null) =>
    autorId && autorId !== usuario.id ? primeiroNome(membros.find((m) => m.perfil_id === autorId)?.nome) || null : null

  const vazio = !isPending && total === 0
  const podeFalar = vozDisponivel()

  return (
    <>
      <div ref={rolagem} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 pt-1">
        {isPending ? (
          <div aria-busy className="space-y-3">
            <div className="h-12 w-2/3 animate-pulso rounded-3xl bg-muted" />
            <div className="ml-auto h-12 w-1/2 animate-pulso rounded-3xl bg-muted" />
          </div>
        ) : null}

        {vazio ? (
          <div className="px-1 pt-8">
            <p className="font-display text-[2.5rem] italic leading-none">Bora ao mercado</p>
            <p className="mt-3 max-w-[20rem] text-[1.0625rem] leading-snug text-muted-foreground">
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
                    onClick={() => enfileirar({ id: crypto.randomUUID(), tipo: 'texto', texto: sugestao, erro: null })}
                  >
                    {sugestao}
                  </Button>
                ))}
              </div>
            )}
          </div>
        ) : null}

        <ol className="space-y-3">
          {mensagens?.map((mensagem) => (
            <li key={mensagem.id}>
              <MessageBubble
                mensagem={mensagem}
                lista={lista}
                itens={itens}
                minha={mensagem.autor_id === usuario.id}
                autor={nomeDe(mensagem.autor_id)}
                somenteLeitura={somenteLeitura}
              />
            </li>
          ))}

          {pendentes.map((pendente) => (
            <li key={pendente.id} className="flex animate-surge flex-col items-end gap-1.5">
              {pendente.tipo === 'texto' ? (
                <Balao lado="eu" className={pendente.erro ? 'opacity-60' : undefined}>
                  {pendente.texto}
                </Balao>
              ) : pendente.tipo === 'voz' ? (
                <Balao lado="eu" className={pendente.erro ? 'flex items-center gap-2 opacity-60' : 'flex items-center gap-2'}>
                  <Mic aria-hidden className="size-4" />
                  {pendente.erro ? 'Mensagem de voz' : 'Ouvindo o que você disse'}
                  {pendente.erro ? null : <Pontos />}
                </Balao>
              ) : (
                <FotoEtiqueta src={pendente.previa} alt="Foto que você tirou da etiqueta">
                  {pendente.erro ? null : (
                    <div role="status" className="absolute inset-0 flex items-end bg-black/35">
                      {/* Faixa de luz varrendo a etiqueta enquanto a leitura acontece. */}
                      <span aria-hidden className="absolute inset-x-0 top-0 h-full animate-varredura bg-gradient-to-b from-transparent via-white/45 to-transparent" />
                      <span className="relative w-full px-3 pb-2.5 text-sm font-medium text-white">Lendo etiqueta…</span>
                    </div>
                  )}
                </FotoEtiqueta>
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

          {digitando.length > 0 ? (
            <li className="animate-surge">
              <Digitando lado="outro" texto={`${listarNomes(digitando)} ${digitando.length === 1 ? 'está' : 'estão'} digitando`} />
            </li>
          ) : null}

          {esperandoIA || outrosEsperando.length > 0 ? (
            <li className="animate-surge">
              <Digitando
                lado="assistente"
                texto={esperandoIA ? 'Listou está pensando' : `Listou está respondendo a ${listarNomes(outrosEsperando)}`}
              />
            </li>
          ) : null}
        </ol>
      </div>

      {somenteLeitura ? null : (
        <div className="shrink-0 border-t border-border bg-background px-3 pb-3 pt-2.5">
          {offline ? (
            <p role="status" className="mb-2 px-2 text-sm text-muted-foreground">
              Sem conexão: o chat volta junto com o sinal. A aba Itens continua funcionando.
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
              <CameraButton aoFotografar={fotografar} />
              <div className="flex h-[3.25rem] min-w-0 flex-1 items-center rounded-full border border-controle/70 bg-card pl-5 pr-1 transition-[border-color,box-shadow] duration-200 focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/20">
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
                  <Button variant="dark" size="icon" aria-label="Falar o pedido" disabled={offline} onClick={() => void comecarAGravar()}>
                    <Mic className="size-5" />
                  </Button>
                ) : (
                  <Button type="submit" variant="dark" size="icon" aria-label="Enviar mensagem" disabled={!texto.trim() || offline}>
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
