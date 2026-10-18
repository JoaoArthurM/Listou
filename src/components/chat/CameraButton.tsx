import { Camera } from 'lucide-react'
import { useRef, useState, type ChangeEvent } from 'react'
import { fecharTeclado } from '@/lib/teclado'
import { cn } from '@/lib/utils'
import { CamaraEtiqueta } from './CamaraEtiqueta'

type CameraButtonProps = { aoFotografar: (arquivo: File) => void; disabled?: boolean; className?: string }

/**
 * Botão da câmera do chat. O input com capture="environment" abre direto a
 * câmera traseira no celular (seção 7.2, passo 1); no computador vira o
 * seletor de arquivo.
 */
export function CameraButton({ aoFotografar, disabled, className }: CameraButtonProps) {
  const entrada = useRef<HTMLInputElement>(null)
  const [aberta, setAberta] = useState(false)

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
        onClick={() => {
          // Com o teclado aberto a câmera nativa abre espremida e volta com ele aberto.
          fecharTeclado()
          // Câmera própria (com quadro de leitura) quando o navegador deixa; senão a nativa.
          if (typeof navigator.mediaDevices?.getUserMedia === 'function') setAberta(true)
          else entrada.current?.click()
        }}
        className={cn(
          'grid size-12 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition-transform duration-200 ease-saida active:scale-95 disabled:opacity-45',
          className,
        )}
      >
        <Camera aria-hidden className="size-6" strokeWidth={2} />
      </button>
      {aberta ? <CamaraEtiqueta aoFotografar={aoFotografar} aoFechar={() => setAberta(false)} /> : null}
    </>
  )
}
