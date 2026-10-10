import { useQueryClient } from '@tanstack/react-query'
import { ArrowUp, RotateCcw } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { useUsuario } from '@/hooks/sessao'
import { useConexao } from '@/hooks/useConexao'
import { useMembros } from '@/hooks/useListas'
import { useMensagens } from '@/hooks/useMensagens'
import { chaves, enviarAoChat, enviarFoto, lerEtiqueta } from '@/lib/api'
import { comprimirImagem } from '@/lib/imagem'
import { primeiroNome } from '@/lib/utils'
import type { Item, Lista } from '@/types/app'
import { CameraButton } from './CameraButton'
import { Balao, FotoEtiqueta, MessageBubble } from './MessageBubble'

type ChatViewProps = { lista: Lista; itens: Item[]; somenteLeitura: boolean }

// O que o usuário mandou e ainda não voltou do servidor (ou falhou). Fica só
// na memória desta tela; o que deu certo chega pela busca de mensagens.
type Pendente =
  | { id: string; tipo: 'texto'; texto: string; erro: string | null }
  | { id: string; tipo: 'foto'; previa: string; foto: Blob | null; arquivo: File; erro: string | null }

const SEM_CONEXAO = 'Sem conexão. Tente de novo quando o sinal voltar.'
const SUGESTOES = ['O que falta?', 'Quanto já deu?']

const mensagemDoErro = (erro: unknown, padrao: string) => (erro instanceof Error && erro.message ? erro.message : padrao)

/** Aba Chat: conversa com o assistente, câmera para a etiqueta e campo de texto (seção 7.1). */
export function ChatView({ lista, itens, somenteLeitura }: ChatViewProps) {
  const usuario = useUsuario()
  const queryClient = useQueryClient()
  const { estado } = useConexao()
  const { data: mensagens, isPending } = useMensagens(lista.id)
  const { data: membros = [] } = useMembros(lista.id)
  const [texto, setTexto] = useState('')
  const [pendentes, setPendentes] = useState<Pendente[]>([])
  const rolagem = useRef<HTMLDivElement>(null)
  const previas = useRef(new Set<string>())

  const offline = estado === 'offline'
  const aguardandoResposta = pendentes.some((p) => p.tipo === 'texto' && p.erro === null)
  const total = (mensagens?.length ?? 0) + pendentes.length

  // A conversa abre e acompanha no fim, como qualquer chat.
  useLayoutEffect(() => {
    const el = rolagem.current
    if (el) el.scrollTop = el.scrollHeight
  }, [total, aguardandoResposta])

  useEffect(() => {
    const urls = previas.current
    return () => {
      for (const url of urls) URL.revokeObjectURL(url)
    }
  }, [])

  const editar = (id: string, mudanca: Partial<Pendente>) =>
    setPendentes((atuais) => atuais.map((p) => (p.id === id ? ({ ...p, ...mudanca } as Pendente) : p)))
  const tirar = (id: string) => setPendentes((atuais) => atuais.filter((p) => p.id !== id))

  const atualizarTudo = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: chaves.mensagens(lista.id) }),
      queryClient.invalidateQueries({ queryKey: chaves.itens(lista.id) }),
    ])

  async function mandarTexto(pendente: Extract<Pendente, { tipo: 'texto' }>) {
    if (offline) return editar(pendente.id, { erro: SEM_CONEXAO })
    editar(pendente.id, { erro: null })
    try {
      await enviarAoChat(lista.id, pendente.texto)
      await atualizarTudo()
      tirar(pendente.id)
    } catch (erro) {
      editar(pendente.id, { erro: mensagemDoErro(erro, 'Não consegui enviar. Tente de novo.') })
    }
  }

  async function mandarFoto(pendente: Extract<Pendente, { tipo: 'foto' }>) {
    if (offline) return editar(pendente.id, { erro: SEM_CONEXAO })
    editar(pendente.id, { erro: null })
    try {
      const foto = pendente.foto ?? (await comprimirImagem(pendente.arquivo)).blob
      editar(pendente.id, { foto })
      const caminho = await enviarFoto(lista.id, foto)
      await lerEtiqueta(lista.id, caminho)
      await atualizarTudo()
      tirar(pendente.id)
    } catch (erro) {
      editar(pendente.id, { erro: mensagemDoErro(erro, 'Não consegui ler a etiqueta. Tente outra foto.') })
    }
  }

  function enviar(evento: FormEvent) {
    evento.preventDefault()
    const limpo = texto.trim()
    if (!limpo) return
    perguntar(limpo)
    setTexto('')
  }

  function perguntar(pergunta: string) {
    const pendente: Pendente = { id: crypto.randomUUID(), tipo: 'texto', texto: pergunta, erro: null }
    setPendentes((atuais) => [...atuais, pendente])
    void mandarTexto(pendente)
  }

  function fotografar(arquivo: File) {
    const previa = URL.createObjectURL(arquivo)
    previas.current.add(previa)
    const pendente: Pendente = { id: crypto.randomUUID(), tipo: 'foto', previa, foto: null, arquivo, erro: null }
    setPendentes((atuais) => [...atuais, pendente])
    void mandarFoto(pendente)
  }

  const nomeDe = (autorId: string | null) =>
    autorId && autorId !== usuario.id ? primeiroNome(membros.find((m) => m.perfil_id === autorId)?.nome) || null : null

  const vazio = !isPending && total === 0

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
                : 'Fotografe a etiqueta de preço e diga quantos levou: eu escolho o preço certo e somo o carrinho. Também entendo pedidos por escrito.'}
            </p>
            {somenteLeitura ? null : (
              <div className="mt-5 flex flex-wrap gap-2">
                {SUGESTOES.map((sugestao) => (
                  <Button key={sugestao} variant="secondary" size="sm" disabled={offline} onClick={() => perguntar(sugestao)}>
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
                  <Button
                    variant="ghost"
                    size="sm"
                    className="-mr-3 px-3 text-foreground"
                    onClick={() => void (pendente.tipo === 'texto' ? mandarTexto(pendente) : mandarFoto(pendente))}
                  >
                    <RotateCcw className="size-4" />
                    Tentar de novo
                  </Button>
                </div>
              ) : null}
            </li>
          ))}

          {aguardandoResposta ? (
            <li>
              <Balao lado="assistente" className="flex h-11 items-center gap-1.5">
                <span className="sr-only">O assistente está respondendo</span>
                {[0, 1, 2].map((i) => (
                  <span key={i} aria-hidden className="size-1.5 animate-pulso rounded-full bg-muted-foreground" style={{ animationDelay: `${i * 160}ms` }} />
                ))}
              </Balao>
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
          <form onSubmit={enviar} className="flex items-center gap-2">
            <CameraButton aoFotografar={fotografar} />
            <div className="flex h-[3.25rem] min-w-0 flex-1 items-center rounded-full border border-controle/70 bg-card pl-5 pr-1 transition-[border-color,box-shadow] duration-200 focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/20">
              <input
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                aria-label="Mensagem"
                placeholder="Adiciona leite, o que falta…"
                maxLength={1000}
                autoComplete="off"
                enterKeyHint="send"
                className="h-full min-w-0 flex-1 bg-transparent placeholder:text-muted-foreground focus:outline-none"
              />
              <Button type="submit" variant="dark" size="icon" aria-label="Enviar mensagem" disabled={!texto.trim() || offline}>
                <ArrowUp className="size-5" strokeWidth={2.4} />
              </Button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}
