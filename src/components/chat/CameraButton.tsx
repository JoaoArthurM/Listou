import { Camera } from 'lucide-react'
import { useRef, type ChangeEvent } from 'react'
import { cn } from '@/lib/utils'

type CameraButtonProps = { aoFotografar: (arquivo: File) => void; disabled?: boolean; className?: string }

/**
 * Botão da câmera do chat. O input com capture="environment" abre direto a
 * câmera traseira no celular (seção 7.2, passo 1); no computador vira o
 * seletor de arquivo.
 */
export function CameraButton({ aoFotografar, disabled, className }: CameraButtonProps) {
  const entrada = useRef<HTMLInputElement>(null)

  function aoEscolher(evento: ChangeEvent<HTMLInputElement>) {
    const arquivo = evento.target.files?.[0]
    // Limpa para a mesma foto poder ser escolhida de novo depois de um erro.
    evento.target.value = ''
    if (arquivo) aoFotografar(arquivo)
  }

  return (
    <>
      <input
        ref={entrada}
        type="file"
        accept="image/*"
        capture="environment"
        tabIndex={-1}
        aria-hidden
        className="sr-only"
        onChange={aoEscolher}
      />
      <button
        type="button"
        aria-label="Fotografar etiqueta de preço"
        disabled={disabled}
        onClick={() => entrada.current?.click()}
        className={cn(
          'grid size-[3.25rem] shrink-0 place-items-center rounded-full bg-primary text-primary-foreground shadow-acento transition-transform duration-200 ease-saida active:scale-95 disabled:opacity-45',
          className,
        )}
      >
        <Camera aria-hidden className="size-6" strokeWidth={2} />
      </button>
    </>
  )
}
