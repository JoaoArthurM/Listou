import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { codigoDoQr } from '@/lib/qr'

type LeitorQrProps = { aoLer: (codigo: string) => void; aoCancelar: () => void }

const LADO_MAX = 480 // reduzir o quadro deixa a leitura leve em celular fraco

/** Câmera traseira procurando um QR de convite do Listou. O jsqr só é baixado quando o leitor abre. */
export function LeitorQr({ aoLer, aoCancelar }: LeitorQrProps) {
  const video = useRef<HTMLVideoElement>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [ignorado, setIgnorado] = useState(false)
  const aoLerRef = useRef(aoLer)
  aoLerRef.current = aoLer

  useEffect(() => {
    let ativo = true
    let fluxo: MediaStream | null = null
    let quadro = 0

    async function iniciar() {
      if (typeof navigator.mediaDevices?.getUserMedia !== 'function') {
        return setErro('Este navegador não abre a câmera. Digite o código.')
      }
      try {
        fluxo = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      } catch {
        return setErro('Não consegui usar a câmera. Libere o acesso nas permissões do navegador ou digite o código.')
      }
      if (!ativo) return fluxo.getTracks().forEach((t) => t.stop())
      const elemento = video.current
      if (!elemento) return
      elemento.srcObject = fluxo
      await elemento.play().catch(() => undefined)

      const { default: jsQR } = await import('jsqr')
      const tela = document.createElement('canvas')
      const contexto = tela.getContext('2d', { willReadFrequently: true })
      if (!contexto) return setErro('Não deu para ler a imagem da câmera. Digite o código.')

      const olhar = () => {
        if (!ativo) return
        if (elemento.videoWidth > 0) {
          const escala = Math.min(1, LADO_MAX / Math.max(elemento.videoWidth, elemento.videoHeight))
          tela.width = Math.round(elemento.videoWidth * escala)
          tela.height = Math.round(elemento.videoHeight * escala)
          contexto.drawImage(elemento, 0, 0, tela.width, tela.height)
          const imagem = contexto.getImageData(0, 0, tela.width, tela.height)
          const achado = jsQR(imagem.data, imagem.width, imagem.height, { inversionAttempts: 'dontInvert' })
          if (achado?.data) {
            const codigo = codigoDoQr(achado.data)
            if (codigo) {
              ativo = false
              return aoLerRef.current(codigo)
            }
            setIgnorado(true)
          }
        }
        quadro = window.setTimeout(olhar, 120)
      }
      olhar()
    }

    void iniciar()
    return () => {
      ativo = false
      window.clearTimeout(quadro)
      fluxo?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  return (
    <div className="space-y-4">
      {erro ? (
        <p role="alert" className="rounded-cartao bg-card p-4 text-[0.9375rem] leading-snug text-destructive shadow-cartao">
          {erro}
        </p>
      ) : (
        <>
          <div className="relative mx-auto aspect-square w-full max-w-[20rem] overflow-hidden rounded-3xl bg-black">
            <video ref={video} muted playsInline className="size-full object-cover" aria-label="Imagem da câmera" />
            <span aria-hidden className="pointer-events-none absolute inset-[14%] rounded-2xl border-2 border-white/80" />
          </div>
          <p role="status" className="text-center text-[0.9375rem] leading-snug text-muted-foreground">
            {ignorado ? 'Esse QR code não é de um convite do Listou.' : 'Aponte para o QR code na tela do outro celular.'}
          </p>
        </>
      )}
      <Button variant="secondary" className="w-full" onClick={aoCancelar}>
        Digitar o código
      </Button>
    </div>
  )
}
