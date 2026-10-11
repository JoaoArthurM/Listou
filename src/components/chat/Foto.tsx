import * as Dialog from '@radix-ui/react-dialog'
import { ImageOff, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { useFotoUrl } from '@/hooks/useMensagens'
import { cn } from '@/lib/utils'

/** Foto em tela cheia, dentro do app. Dá para ampliar com os dedos, como em qualquer imagem. */
function Visualizador({ src, alt, aoFechar }: { src: string; alt: string; aoFechar: () => void }) {
  return (
    <Dialog.Root open onOpenChange={(aberto) => !aberto && aoFechar()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/95 data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out data-[state=open]:fade-in" />
        <Dialog.Content
          aria-describedby={undefined}
          // O foco vai para a própria tela, não para o botão de fechar: no
          // celular ele abriria com um anel de foco que ninguém pediu.
          onOpenAutoFocus={(evento) => {
            evento.preventDefault()
            ;(evento.currentTarget as HTMLElement).focus()
          }}
          className="fixed inset-0 z-50 flex flex-col focus:outline-none data-[state=open]:animate-in data-[state=open]:fade-in"
        >
          <Dialog.Title className="sr-only">{alt}</Dialog.Title>
          <div className="flex shrink-0 justify-end px-3 pb-2 pt-[max(env(safe-area-inset-top),0.75rem)]">
            <Dialog.Close asChild>
              <Button variant="moldura" size="icon" aria-label="Fechar foto" className="bg-black/40">
                <X className="size-5" />
              </Button>
            </Dialog.Close>
          </div>
          {/* Tocar fora da imagem também fecha. */}
          <div className="grid min-h-0 flex-1 place-items-center overflow-auto px-2 pb-[max(env(safe-area-inset-bottom),0.75rem)]" onClick={aoFechar}>
            <img src={src} alt={alt} className="max-h-full max-w-full rounded-lg object-contain" onClick={(e) => e.stopPropagation()} />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

type FotoEtiquetaProps = {
  src: string | null
  alt?: string
  /** Camada por cima da miniatura (ex.: "Lendo etiqueta…"). Com ela, a foto não abre. */
  children?: ReactNode
  className?: string
}

/** Miniatura da etiqueta; tocar abre a foto inteira. Depois de 24h a foto some do servidor e fica só o marcador. */
export function FotoEtiqueta({ src, alt = 'Foto da etiqueta', children, className }: FotoEtiquetaProps) {
  const [aberta, setAberta] = useState(false)

  if (!src) {
    return (
      <p className="flex h-9 items-center gap-2 rounded-full bg-muted px-3.5 text-sm text-muted-foreground">
        <ImageOff aria-hidden className="size-4" />
        Foto da etiqueta apagada
      </p>
    )
  }

  const moldura = cn('relative block size-40 overflow-hidden rounded-3xl bg-muted shadow-cartao', className)
  if (children) {
    return (
      <div className={moldura}>
        <img src={src} alt={alt} className="size-full object-cover" />
        {children}
      </div>
    )
  }

  return (
    <>
      <button type="button" aria-label={`Abrir ${alt.toLowerCase()}`} onClick={() => setAberta(true)} className={moldura}>
        <img src={src} alt="" className="size-full object-cover" />
      </button>
      {aberta ? <Visualizador src={src} alt={alt} aoFechar={() => setAberta(false)} /> : null}
    </>
  )
}

/** Foto guardada no Storage (bucket privado): busca o link temporário e mostra. */
export function FotoArmazenada({ caminho, className }: { caminho: string; className?: string }) {
  const { data: url, isPending } = useFotoUrl(caminho)
  if (isPending) return <div aria-hidden className={cn('size-40 animate-pulso rounded-3xl bg-muted', className)} />
  return <FotoEtiqueta src={url ?? null} className={className} />
}
