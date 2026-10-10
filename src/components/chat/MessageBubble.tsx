import { ImageOff } from 'lucide-react'
import type { ReactNode } from 'react'
import { useFotoUrl } from '@/hooks/useMensagens'
import { cn } from '@/lib/utils'
import type { Item, Lista, Mensagem } from '@/types/app'
import { ConfirmCard } from './ConfirmCard'
import { PropostaCard } from './PropostaCard'

type BalaoProps = {
  /** "eu" à direita; a outra pessoa da lista e o assistente à esquerda. */
  lado: 'eu' | 'outro' | 'assistente'
  autor?: string | null
  children: ReactNode
  className?: string
}

const estilos = {
  eu: 'rounded-br-md bg-foreground text-background',
  outro: 'rounded-bl-md bg-muted text-foreground',
  assistente: 'rounded-bl-md bg-card text-foreground shadow-cartao',
}

/** Balão de texto do chat. */
export function Balao({ lado, autor, children, className }: BalaoProps) {
  return (
    <div className={cn('flex flex-col', lado === 'eu' ? 'items-end' : 'items-start')}>
      {autor ? <span className="mb-1 px-3 text-xs text-muted-foreground">{autor}</span> : null}
      <div
        className={cn(
          'max-w-[85%] whitespace-pre-line break-words rounded-[1.375rem] px-4 py-2.5 text-[1.0625rem] leading-snug',
          estilos[lado],
          className,
        )}
      >
        {children}
      </div>
    </div>
  )
}

/** Miniatura da etiqueta. A foto some do servidor 24h depois da compra; aí fica só o marcador. */
export function FotoEtiqueta({ src, children, alt = 'Foto da etiqueta' }: { src: string | null; children?: ReactNode; alt?: string }) {
  if (!src) {
    return (
      <p className="flex h-9 items-center gap-2 rounded-full bg-muted px-3.5 text-sm text-muted-foreground">
        <ImageOff aria-hidden className="size-4" />
        Foto da etiqueta apagada
      </p>
    )
  }
  return (
    <div className="relative size-40 overflow-hidden rounded-3xl bg-muted shadow-cartao">
      <img src={src} alt={alt} className="size-full object-cover" />
      {children}
    </div>
  )
}

function FotoDaMensagem({ caminho }: { caminho: string }) {
  const { data: url, isPending } = useFotoUrl(caminho)
  if (isPending) return <div aria-hidden className="size-40 animate-pulso rounded-3xl bg-muted" />
  return <FotoEtiqueta src={url ?? null} />
}

type MessageBubbleProps = {
  mensagem: Mensagem
  lista: Lista
  itens: Item[]
  /** A mensagem é de quem está usando este aparelho. */
  minha: boolean
  /** Nome do autor quando a mensagem é do outro membro da lista. */
  autor: string | null
  somenteLeitura: boolean
}

export function MessageBubble({ mensagem, lista, itens, minha, autor, somenteLeitura }: MessageBubbleProps) {
  const { dados } = mensagem
  const lado = mensagem.papel === 'assistente' ? 'assistente' : minha ? 'eu' : 'outro'

  if (dados?.tipo === 'etiqueta') {
    return <ConfirmCard mensagemId={mensagem.id} dados={dados} lista={lista} itens={itens} somenteLeitura={somenteLeitura} />
  }

  if (dados?.tipo === 'proposta') {
    return (
      <div className="space-y-2">
        {mensagem.conteudo ? <Balao lado="assistente">{mensagem.conteudo}</Balao> : null}
        <PropostaCard mensagemId={mensagem.id} dados={dados} listaId={lista.id} itens={itens} somenteLeitura={somenteLeitura} />
      </div>
    )
  }

  if (dados?.tipo === 'foto') {
    return (
      <div className={cn('flex flex-col', minha ? 'items-end' : 'items-start')}>
        {autor ? <span className="mb-1 px-3 text-xs text-muted-foreground">{autor}</span> : null}
        <FotoDaMensagem caminho={dados.foto_path} />
      </div>
    )
  }

  return (
    <Balao lado={lado} autor={autor}>
      {mensagem.conteudo}
    </Balao>
  )
}
