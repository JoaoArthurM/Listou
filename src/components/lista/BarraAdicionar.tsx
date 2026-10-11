import { useQueryClient } from '@tanstack/react-query'
import { ListPlus, Mic, Plus, X } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Gravador } from '@/components/chat/Gravador'
import { Digitando } from '@/components/chat/MessageBubble'
import { Button } from '@/components/ui/button'
import { useUsuario } from '@/hooks/sessao'
import { useConexao } from '@/hooks/useConexao'
import { useFrase } from '@/hooks/useFrase'
import { useAdicionarItens } from '@/hooks/useItens'
import { buscarMensagens, chaves, enviarAoChat, enviarVozAoChat } from '@/lib/api'
import { avisar } from '@/lib/avisos'
import { lerEntrada } from '@/lib/adicionar'
import { semOsQueJaEstao } from '@/lib/importar'
import { normalizarNome } from '@/lib/nomes'
import { fecharTeclado } from '@/lib/teclado'
import { plural } from '@/lib/utils'
import { gravar, vozDisponivel, type Gravacao } from '@/lib/voz'
import type { Item, Lista } from '@/types/app'

type BarraAdicionarProps = {
  lista: Lista
  itens: Item[]
  aoImportar: () => void
  /** Id do primeiro item que entrou, para a lista rolar até ele. */
  aoAdicionar: (id: string) => void
}

const mensagemDoErro = (erro: unknown, padrao: string) => (erro instanceof Error && erro.message ? erro.message : padrao)

/**
 * Rodapé da aba Lista: escrever ou falar o que falta comprar. Um item, vários
 * ("ovo, arroz e feijão") ou palavras soltas ("ovo arroz feijão batata") entram
 * de uma vez, e o que já está na lista esperando compra não entra de novo.
 * Texto simples é lido por código (funciona offline); pedido falado e frases
 * ambíguas vão para a mesma IA do chat, que valida repetidos no servidor.
 */
export function BarraAdicionar({ lista, itens, aoImportar, aoAdicionar }: BarraAdicionarProps) {
  const usuario = useUsuario()
  const queryClient = useQueryClient()
  const adicionar = useAdicionarItens()
  const { estado } = useConexao()
  const offline = estado === 'offline'
  const [texto, setTexto] = useState('')
  const [gravacao, setGravacao] = useState<Gravacao | null>(null)
  const [trabalhando, setTrabalhando] = useState<'texto' | 'voz' | null>(null)
  const [resultado, setResultado] = useState<string | null>(null)
  const frase = useFrase(trabalhando)
  const podeFalar = vozDisponivel()
  const ocupado = trabalhando !== null
  const esperando = useRef(itens)
  esperando.current = itens

  // Sair da tela no meio de uma gravação solta o microfone.
  useEffect(() => () => gravacao?.cancelar(), [gravacao])

  function entrarNaLista(nomes: Array<{ nome: string; qtd: number | null; unidade: 'un' | 'kg' }>) {
    const novos = nomes.map((n) => ({
      id: crypto.randomUUID(),
      lista_id: lista.id,
      nome: n.nome,
      unidade: n.unidade,
      qtd_planejada: n.qtd,
      secao: null,
      adicionado_por: usuario.id,
    }))
    if (novos.length === 0) return
    adicionar.mutate({ lista_id: lista.id, itens: novos })
    aoAdicionar(novos[0]!.id)
  }

  /** Chama a função "chat" e mostra o que o assistente respondeu, sem tirar a pessoa da lista. */
  async function pelaIA(tipo: 'texto' | 'voz', chamada: () => Promise<void>) {
    const antes = new Set(queryClient.getQueryData<Array<{ id: string }>>(chaves.mensagens(lista.id))?.map((m) => m.id) ?? [])
    setTrabalhando(tipo)
    setResultado(null)
    try {
      await chamada()
      const [mensagens] = await Promise.all([
        queryClient.fetchQuery({ queryKey: chaves.mensagens(lista.id), queryFn: () => buscarMensagens(lista.id), staleTime: 0 }),
        queryClient.invalidateQueries({ queryKey: chaves.itens(lista.id) }),
      ])
      const respostas = mensagens.filter((m) => m.papel === 'assistente' && !antes.has(m.id))
      const linhas = respostas.map((m) => m.conteudo)
      if (respostas.some((m) => m.dados?.tipo === 'proposta')) linhas.push('Falta confirmar na aba Chat.')
      setResultado(linhas.join('\n') || 'Pronto.')
      setTexto('')
    } catch (erro) {
      avisar(mensagemDoErro(erro, 'Não consegui adicionar. Tente de novo.'), 'erro')
    } finally {
      setTrabalhando(null)
    }
  }

  function enviar(evento: FormEvent) {
    evento.preventDefault()
    if (ocupado) return
    const lida = lerEntrada(texto)
    if (lida.caminho === 'vazia') return
    fecharTeclado()
    setResultado(null)

    if (lida.caminho === 'ia' && !offline) {
      void pelaIA('texto', () => enviarAoChat(lista.id, `adiciona ${lida.texto}`))
      return
    }

    // Sem IA (offline ou texto simples): vira o que o código leu; frase ambígua entra inteira, como um item só.
    const candidatos = lida.caminho === 'local' ? lida.itens : [{ nome: normalizarNome(lida.texto), qtd: null, unidade: 'un' as const }]
    const { entram } = semOsQueJaEstao(
      candidatos,
      esperando.current.filter((i) => !i.comprado).map((i) => i.nome),
    )
    const repetidos = candidatos.filter((c) => !entram.includes(c)).map((c) => c.nome)
    entrarNaLista(entram)
    setTexto('')

    if (repetidos.length > 0) {
      const lista_ = repetidos.join(', ')
      avisar(repetidos.length === 1 ? `“${lista_}” já está na lista.` : `Já estavam na lista: ${lista_}.`, 'info')
    } else if (entram.length > 1) {
      avisar(`${plural(entram.length, 'item adicionado', 'itens adicionados')}.`, 'sucesso')
    }
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
    let audio: string
    try {
      audio = await atual.parar()
    } catch (erro) {
      return avisar(mensagemDoErro(erro, 'Não deu para preparar o áudio.'), 'erro')
    }
    void pelaIA('voz', () => enviarVozAoChat(lista.id, audio))
  }

  return (
    <div className="shrink-0 border-t border-border bg-background px-3 pb-3 pt-2.5">
      {ocupado ? (
        <div className="mb-2 animate-surge">
          <Digitando lado="assistente" texto={frase ?? 'Pensando…'} />
        </div>
      ) : null}

      {resultado && !ocupado ? (
        <div role="status" className="mb-2 flex animate-surge items-start gap-2 rounded-cartao bg-card py-3 pl-4 pr-1.5 shadow-cartao">
          <p className="min-w-0 flex-1 whitespace-pre-line text-[0.875rem] leading-snug">{resultado}</p>
          <Button variant="ghost" size="icon" aria-label="Fechar resultado" className="-mt-1.5 shrink-0" onClick={() => setResultado(null)}>
            <X className="size-5" />
          </Button>
        </div>
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
          <Button type="button" variant="secondary" size="icon" aria-label="Importar itens" className="size-12" onClick={aoImportar}>
            <ListPlus className="size-[1.375rem]" />
          </Button>
          <div className="flex h-12 min-w-0 flex-1 items-center rounded-full border border-controle/70 bg-card pl-5 pr-1 transition-[border-color,box-shadow] duration-200 focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/20">
            <input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              aria-label="Novo item"
              placeholder="Escreva ou fale os itens"
              maxLength={300}
              autoComplete="off"
              enterKeyHint="done"
              disabled={ocupado}
              className="h-full min-w-0 flex-1 bg-transparent placeholder:text-muted-foreground focus:outline-none"
            />
            {/* Campo vazio oferece o microfone; com texto, o botão vira adicionar. */}
            {texto.trim() === '' && podeFalar ? (
              <Button key="mic" type="button" variant="dark" size="icon" aria-label="Falar os itens" className="animate-pop" disabled={offline || ocupado} onClick={() => void comecarAGravar()}>
                <Mic className="size-5" />
              </Button>
            ) : (
              <Button key="adicionar" type="submit" size="icon" aria-label="Adicionar item" className="animate-pop" disabled={!texto.trim() || ocupado}>
                <Plus className="size-5" strokeWidth={2.4} />
              </Button>
            )}
          </div>
        </form>
      )}
    </div>
  )
}
