import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import type { Item, Lista, Mensagem } from '@/types/app'
import { ConfirmCard } from './ConfirmCard'
import { FotoArmazenada } from './Foto'
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
    // w-full: dentro de um pai flex o balão encolheria até o texto e os 85% de
    // largura máxima passariam a valer sobre esse tamanho encolhido.
    <div className={cn('flex w-full flex-col', lado === 'eu' ? 'items-end' : 'items-start')}>
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

/** Três pontos em onda: alguém está escrevendo ou a IA está pensando. */
export function Pontos({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn('inline-flex items-end gap-1', className)}>
      {[0, 1, 2].map((i) => (
        <span key={i} className="size-1.5 animate-onda rounded-full bg-current" style={{ animationDelay: `${i * 140}ms` }} />
      ))}
    </span>
  )
}

/** Balão de "digitando" ou "pensando", com quem e o quê ao lado dos pontos. */
export function Digitando({ lado, texto }: { lado: 'outro' | 'assistente'; texto: string }) {
  return (
    <Balao lado={lado} className="flex min-h-11 items-center gap-2.5 text-[0.9375rem] text-muted-foreground">
      <Pontos className={lado === 'assistente' ? 'text-primary' : undefined} />
      <span role="status">{texto}</span>
    </Balao>
  )
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
        <FotoArmazenada caminho={dados.foto_path} />
      </div>
    )
  }

  return (
    <Balao lado={lado} autor={autor}>
      {mensagem.conteudo}
    </Balao>
  )
}
