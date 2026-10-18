import { Image as IconeGaleria, X, Zap, ZapOff } from 'lucide-react'
import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

type CamaraEtiquetaProps = { aoFotografar: (arquivo: File) => void; aoFechar: () => void }

type Estado = 'iniciando' | 'pronta' | 'lendo' | 'erro'

const PAUSA_LENDO_MS = 650 // tempo do quadro congelado com a varredura, antes de voltar ao chat

/** Lanterna não está no tipo padrão do TypeScript, mas Chrome no Android expõe. */
type CapacidadesComLanterna = MediaTrackCapabilities & { torch?: boolean }

/**
 * Câmera própria para fotografar a etiqueta: quadro de enquadramento, varredura
 * enquanto "lê" e lanterna quando o aparelho tem. Substitui a câmera nativa
 * (seção 7.2, passo 1), que não dá nenhuma pista do que fotografar. O arquivo
 * sai igual ao da câmera nativa e segue pelo mesmo caminho (fotografarEtiqueta).
 */
export function CamaraEtiqueta({ aoFotografar, aoFechar }: CamaraEtiquetaProps) {
  const video = useRef<HTMLVideoElement>(null)
  const faixa = useRef<MediaStreamTrack | null>(null)
  const galeria = useRef<HTMLInputElement>(null)
  const nativa = useRef<HTMLInputElement>(null)
  const [estado, setEstado] = useState<Estado>('iniciando')
  const [temLanterna, setTemLanterna] = useState(false)
  const [lanterna, setLanterna] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const [piscar, setPiscar] = useState(false)
  const [congelada, setCongelada] = useState<string | null>(null)

  useEffect(() => {
    let ativo = true
    let fluxo: MediaStream | null = null

    async function iniciar() {
      if (typeof navigator.mediaDevices?.getUserMedia !== 'function') return setEstado('erro')
      try {
        fluxo = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        })
      } catch {
        return setEstado('erro')
      }
      if (!ativo) return fluxo.getTracks().forEach((t) => t.stop())
      const elemento = video.current
      const trilha = fluxo.getVideoTracks()[0]
      if (!elemento || !trilha) return
      faixa.current = trilha
      elemento.srcObject = fluxo
      await elemento.play().catch(() => undefined)
      // Em vários Androids a capacidade só aparece depois que o vídeo já está rodando.
      // Em celular o botão fica mesmo sem a confirmação: tocar tenta, e avisa se não der.
      const confirmada = () => ((trilha.getCapabilities?.() ?? {}) as CapacidadesComLanterna).torch === true
      setTemLanterna(confirmada() || navigator.maxTouchPoints > 0)
      window.setTimeout(() => ativo && confirmada() && setTemLanterna(true), 600)
      // Foco contínuo: etiqueta de gôndola é perto e o foco automático padrão hesita.
      void trilha.applyConstraints({ advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet] }).catch(() => undefined)
      setEstado('pronta')
    }

    void iniciar()
    return () => {
      ativo = false
      faixa.current = null
      fluxo?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar()
    window.addEventListener('keydown', aoTeclar)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', aoTeclar)
      document.body.style.overflow = overflow
    }
  }, [aoFechar])

  useEffect(
    () => () => {
      if (congelada) URL.revokeObjectURL(congelada)
    },
    [congelada],
  )

  async function alternarLanterna() {
    const proxima = !lanterna
    try {
      await faixa.current?.applyConstraints({ advanced: [{ torch: proxima } as MediaTrackConstraintSet] })
      setLanterna(proxima)
    } catch {
      setTemLanterna(false)
      setAviso('Este aparelho não deixa o navegador acender a lanterna.')
      window.setTimeout(() => setAviso(null), 3500)
    }
  }

  function fotografar() {
    const elemento = video.current
    if (!elemento || elemento.videoWidth === 0 || estado !== 'pronta') return
    const tela = document.createElement('canvas')
    tela.width = elemento.videoWidth
    tela.height = elemento.videoHeight
    tela.getContext('2d')?.drawImage(elemento, 0, 0)
    setEstado('lendo')
    setPiscar(true)
    window.setTimeout(() => setPiscar(false), 120)
    navigator.vibrate?.(30)
    tela.toBlob(
      (blob) => {
        if (!blob) return setEstado('pronta')
        setCongelada(URL.createObjectURL(blob))
        const arquivo = new File([blob], `etiqueta-${Date.now()}.jpg`, { type: 'image/jpeg' })
        window.setTimeout(() => {
          aoFotografar(arquivo)
          aoFechar()
        }, PAUSA_LENDO_MS)
      },
      'image/jpeg',
      0.9,
    )
  }

  function aoEscolherArquivo(evento: ChangeEvent<HTMLInputElement>) {
    const arquivo = evento.target.files?.[0]
    evento.target.value = ''
    if (!arquivo) return
    aoFotografar(arquivo)
    aoFechar()
  }

  const lendo = estado === 'lendo'

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Câmera da etiqueta" className="fixed inset-0 z-[100] flex flex-col bg-black text-white animate-entra">
      <input ref={galeria} type="file" accept="image/*" tabIndex={-1} aria-hidden className="sr-only" onChange={aoEscolherArquivo} />
      <input ref={nativa} type="file" accept="image/*" capture="environment" tabIndex={-1} aria-hidden className="sr-only" onChange={aoEscolherArquivo} />

      {estado === 'erro' ? (
        <div className="m-auto grid max-w-xs gap-4 px-6 text-center">
          <p role="alert" className="text-[0.9375rem] leading-snug">
            Não consegui abrir a câmera aqui. Libere o acesso nas permissões do navegador ou use a câmera do aparelho.
          </p>
          <button type="button" onClick={() => nativa.current?.click()} className="h-12 rounded-full bg-primary px-6 font-semibold text-primary-foreground">
            Usar a câmera do aparelho
          </button>
          <button type="button" onClick={aoFechar} className="h-11 text-sm text-white/70">
            Cancelar
          </button>
        </div>
      ) : (
        <>
          <div className="relative min-h-0 flex-1 overflow-hidden">
            <video ref={video} muted playsInline aria-label="Imagem da câmera" className="size-full object-cover" />
            {congelada ? <img src={congelada} alt="" className="absolute inset-0 size-full animate-congela object-cover" /> : null}
            <span aria-hidden className={cn('pointer-events-none absolute inset-0 bg-white transition-opacity duration-300', piscar ? 'opacity-70' : 'opacity-0')} />

            {/* Moldura: a sombra gigante escurece tudo menos o quadro. */}
            <div className="pointer-events-none absolute inset-x-0 top-[44%] flex -translate-y-1/2 flex-col items-center gap-6 px-6">
              <div key={lendo ? 'lendo' : 'mira'} className={cn('relative aspect-[3/2] w-full max-w-[26rem]', lendo ? 'animate-encaixa' : 'animate-mira')}>
                <div className="absolute inset-0 overflow-hidden rounded-2xl shadow-[0_0_0_100vmax_rgba(0,0,0,0.58)]">
                  {lendo ? (
                    <>
                      <span aria-hidden className="absolute inset-0 bg-primary/10" />
                      <span aria-hidden className="absolute inset-0 animate-varredura bg-gradient-to-b from-transparent from-80% to-primary/45">
                        <span className="absolute inset-x-0 bottom-0 h-0.5 bg-primary" />
                      </span>
                    </>
                  ) : null}
                </div>
                {(['left-0 top-0 rounded-tl-2xl border-l-4 border-t-4', 'right-0 top-0 rounded-tr-2xl border-r-4 border-t-4', 'bottom-0 left-0 rounded-bl-2xl border-b-4 border-l-4', 'bottom-0 right-0 rounded-br-2xl border-b-4 border-r-4'] as const).map((canto) => (
                  <i key={canto} aria-hidden className={cn('absolute size-9 transition-colors duration-300', canto, lendo ? 'border-primary' : 'border-white')} />
                ))}
              </div>
              <p role="status" className="text-center text-[0.9375rem] font-medium leading-snug drop-shadow">
                {aviso ?? null}
                {aviso ? <br /> : null}
                {estado === 'iniciando' ? 'Abrindo a câmera…' : lendo ? 'Lendo etiqueta' : 'Enquadre a etiqueta de preço'}
                {lendo
                  ? [0, 1, 2].map((i) => (
                      <span key={i} aria-hidden className="inline-block animate-onda" style={{ animationDelay: `${i * 140}ms` }}>
                        .
                      </span>
                    ))
                  : null}
              </p>
            </div>

            <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))]">
              <button type="button" aria-label="Fechar câmera" onClick={aoFechar} className="grid size-11 place-items-center rounded-full bg-black/45 backdrop-blur">
                <X aria-hidden className="size-6" />
              </button>
              {temLanterna ? (
                <button
                  type="button"
                  aria-label={lanterna ? 'Apagar a lanterna' : 'Acender a lanterna'}
                  aria-pressed={lanterna}
                  onClick={() => void alternarLanterna()}
                  className={cn('grid size-11 place-items-center rounded-full backdrop-blur', lanterna ? 'bg-amber-300 text-black' : 'bg-black/45')}
                >
                  {lanterna ? <Zap aria-hidden className="size-5" /> : <ZapOff aria-hidden className="size-5" />}
                </button>
              ) : null}
            </div>

          </div>

          <div className="flex items-center justify-between px-8 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5">
            <button type="button" aria-label="Escolher da galeria" disabled={lendo} onClick={() => galeria.current?.click()} className="grid size-12 place-items-center rounded-full bg-white/15 disabled:opacity-40">
              <IconeGaleria aria-hidden className="size-6" />
            </button>
            <button
              type="button"
              aria-label="Fotografar"
              disabled={estado !== 'pronta'}
              onClick={fotografar}
              className="grid size-[4.5rem] place-items-center rounded-full border-4 border-white transition-transform duration-150 ease-saida active:scale-95 disabled:opacity-50"
            >
              <span className={cn('size-[3.25rem] rounded-full bg-white transition-colors', lendo && 'animate-pulso bg-primary')} />
            </button>
            <span aria-hidden className="size-12" />
          </div>
        </>
      )}
    </div>,
    document.body,
  )
}
