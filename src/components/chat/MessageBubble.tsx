import { Sparkles, User } from 'lucide-react'
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
  /** Assistente trabalhando: o avatar anima mais rápido. */
  pensando?: boolean
  children: ReactNode
  className?: string
}

// Três vozes, três cores: eu em laranja, a outra pessoa em amarelo, o assistente
// em cartão neutro com borda. No escuro, muted e card quase se confundem, por isso
// cada voz tem cor própria em vez de variar só o tom do cinza.
const estilos = {
  eu: 'rounded-br-md bg-primary text-primary-foreground',
  outro: 'rounded-bl-md bg-destaque text-destaque-foreground',
  assistente: 'rounded-bl-md border border-border bg-card text-foreground shadow-cartao',
}

/** Foto de perfil redonda: inicial da pessoa, ou o orbe animado do assistente. */
export function Avatar({ lado, nome, pensando }: { lado: 'outro' | 'assistente'; nome?: string | null; pensando?: boolean }) {
  if (lado === 'assistente') {
    return (
      <span aria-hidden className="relative mb-0.5 flex size-8 shrink-0 items-center justify-center rounded-full">
        {/* Anel em degradê girando; o miolo escuro fica parado por cima. */}
        <span
          className={cn('absolute inset-0 rounded-full', pensando ? 'animate-gira-rapido' : 'animate-gira')}
          style={{
            background:
              'conic-gradient(from 0deg, hsl(var(--primary)), hsl(var(--destaque)), hsl(var(--primary) / 0.15), hsl(var(--primary)))',
          }}
        />
        <span className="absolute inset-[2.5px] rounded-full bg-card" />
        <Sparkles
          className={cn('relative size-4 text-primary-texto', pensando ? 'animate-brilha-rapido' : 'animate-brilha')}
          strokeWidth={2.25}
        />
      </span>
    )
  }
  const inicial = nome?.trim().charAt(0).toUpperCase()
  return (
    <span
      aria-hidden
      className="mb-0.5 flex size-8 shrink-0 select-none items-center justify-center rounded-full bg-destaque text-sm font-semibold text-destaque-foreground"
    >
      {inicial || <User className="size-4" />}
    </span>
  )
}

/** Balão de texto do chat. */
export function Balao({ lado, autor, pensando, children, className }: BalaoProps) {
  const nome = lado === 'assistente' ? 'Listou' : autor
  return (
    // w-full: dentro de um pai flex o balão encolheria até o texto e os 85% de
    // largura máxima passariam a valer sobre esse tamanho encolhido.
    <div className={cn('flex w-full items-end gap-2', lado === 'eu' ? 'justify-end' : 'justify-start')}>
      {lado === 'eu' ? null : <Avatar lado={lado} nome={autor} pensando={pensando} />}
      <div className={cn('flex min-w-0 max-w-[85%] flex-col', lado === 'eu' ? 'items-end' : 'items-start')}>
        {nome ? <span className="mb-1 px-1 text-xs font-medium text-muted-foreground">{nome}</span> : null}
        <div
          className={cn(
            'whitespace-pre-line break-words rounded-[1.375rem] px-4 py-2.5 text-[1.0625rem] leading-snug',
            estilos[lado],
            className,
          )}
        >
          {children}
        </div>
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
    <Balao
      lado={lado}
      pensando={lado === 'assistente'}
      className={cn('flex min-h-11 items-center gap-2.5 text-[0.9375rem]', lado === 'assistente' && 'text-muted-foreground')}
    >
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
      <div className={cn('flex items-end gap-2', minha ? 'justify-end' : 'justify-start')}>
        {minha ? null : <Avatar lado="outro" nome={autor} />}
        <div className={cn('flex min-w-0 flex-col', minha ? 'items-end' : 'items-start')}>
          {autor ? <span className="mb-1 px-1 text-xs font-medium text-muted-foreground">{autor}</span> : null}
          <FotoArmazenada caminho={dados.foto_path} />
        </div>
      </div>
    )
  }

  return (
    <Balao lado={lado} autor={autor}>
      {mensagem.conteudo}
    </Balao>
  )
}
