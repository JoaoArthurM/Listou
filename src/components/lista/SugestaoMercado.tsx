import { LoaderCircle, MapPin } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { mercadosPerto, posicaoAtual, type Mercado } from '@/lib/mercados'
import { cn } from '@/lib/utils'

type SugestaoMercadoProps = {
  /** Nome do mercado escolhido hoje; marca o botão correspondente. */
  escolhido: string | null
  /** A pessoa tocou num mercado (ou o mais perto foi aplicado sozinho). */
  aoEscolher: (mercado: Mercado) => void
  /** Procura assim que a folha abre, em vez de esperar o toque. */
  automatico?: boolean
  /** Aplica o mais perto sozinho quando a pessoa ainda não escolheu nada. */
  aplicarMaisPerto?: boolean
  desabilitado?: boolean
}

type Estado = { fase: 'ocioso' } | { fase: 'buscando' } | { fase: 'pronto'; mercados: Mercado[] } | { fase: 'erro'; texto: string }

const distancia = (metros: number) => (metros < 1000 ? `${Math.round(metros / 10) * 10} m` : `${(metros / 1000).toFixed(1).replace('.', ',')} km`)

/**
 * Pede a localização, acha mercados do OpenStreetMap perto e deixa tocar no
 * certo. Se não achar ou errar, a pessoa escreve o nome no campo ao lado.
 */
export function SugestaoMercado({ escolhido, aoEscolher, automatico = false, aplicarMaisPerto = false, desabilitado = false }: SugestaoMercadoProps) {
  const [estado, setEstado] = useState<Estado>({ fase: 'ocioso' })
  const sinal = useRef<AbortController | null>(null)
  // Sempre a versão mais nova: a busca termina depois de a tela re-renderizar.
  const aoTerminar = useRef({ aoEscolher, aplicarMaisPerto, escolhido })
  aoTerminar.current = { aoEscolher, aplicarMaisPerto, escolhido }

  const buscar = useCallback(async () => {
    sinal.current?.abort()
    const controle = new AbortController()
    sinal.current = controle
    setEstado({ fase: 'buscando' })
    try {
      const ponto = await posicaoAtual()
      const mercados = await mercadosPerto(ponto, controle.signal)
      if (controle.signal.aborted) return
      setEstado({ fase: 'pronto', mercados })
      const { aplicarMaisPerto: aplicar, escolhido: atual, aoEscolher: escolher } = aoTerminar.current
      if (aplicar && !atual && mercados[0]) escolher(mercados[0])
    } catch (erro) {
      if (controle.signal.aborted) return
      const texto = erro instanceof Error && erro.message.includes('localização') ? erro.message : 'Não deu para buscar mercados agora. Escreva o nome.'
      setEstado({ fase: 'erro', texto })
    }
  }, [])

  useEffect(() => {
    if (automatico) void buscar()
    return () => sinal.current?.abort()
  }, [automatico, buscar])

  if (estado.fase === 'buscando') {
    return (
      <p role="status" className="flex min-h-11 items-center gap-2 text-[0.875rem] text-muted-foreground">
        <LoaderCircle aria-hidden className="size-4 animate-spin" />
        Procurando mercados perto de você…
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {estado.fase === 'pronto' && estado.mercados.length > 0 ? (
        <>
          <p className="text-[0.8125rem] text-muted-foreground">Perto de você. Toque no certo ou escreva o nome.</p>
          <ul className="flex flex-wrap gap-2">
            {estado.mercados.slice(0, 4).map((m) => {
              const ativo = escolhido === m.nome
              return (
                <li key={`${m.nome}-${m.lat}-${m.lng}`}>
                  <Button
                    type="button"
                    size="sm"
                    variant={ativo ? 'dark' : 'secondary'}
                    aria-pressed={ativo}
                    disabled={desabilitado}
                    onClick={() => aoEscolher(m)}
                  >
                    <MapPin aria-hidden className="size-4" />
                    <span className="max-w-[10rem] truncate">{m.nome}</span>
                    <span className={cn('text-[0.75rem]', ativo ? 'opacity-70' : 'text-muted-foreground')}>{distancia(m.distancia_m)}</span>
                  </Button>
                </li>
              )
            })}
          </ul>
        </>
      ) : null}

      {estado.fase === 'pronto' && estado.mercados.length === 0 ? (
        <p className="text-[0.875rem] leading-snug text-muted-foreground">Não achei mercado do mapa aqui perto. Escreva o nome.</p>
      ) : null}
      {estado.fase === 'erro' ? (
        <p role="alert" className="text-[0.875rem] leading-snug text-muted-foreground">
          {estado.texto}
        </p>
      ) : null}

      {estado.fase !== 'pronto' || estado.mercados.length === 0 ? (
        <Button type="button" variant="secondary" size="sm" disabled={desabilitado} onClick={() => void buscar()}>
          <MapPin aria-hidden className="size-4" />
          {estado.fase === 'ocioso' ? 'Sugerir pela minha localização' : 'Tentar de novo'}
        </Button>
      ) : null}
    </div>
  )
}
