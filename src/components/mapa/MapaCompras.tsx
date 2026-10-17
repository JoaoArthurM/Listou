import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import urlDoWorker from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { useEffect, useRef } from 'react'
import { formatarReais } from '@/lib/dinheiro'
import type { MercadoNoMapa } from '@/lib/mapa'
import type { Ponto } from '@/lib/mercados'

// O Vite não acha o worker sozinho (nem no dev, nem no build): aponta o arquivo.
maplibregl.setWorkerUrl(urlDoWorker)

// Fundo do OpenFreeMap: grátis, sem chave, uso comercial liberado.
const ESTILO = 'https://tiles.openfreemap.org/styles/positron'
// Abaixo disso os nomes sobrepõem demais: ficam só os ícones.
const ZOOM_COM_NOMES = 11.5
const SVG = 'http://www.w3.org/2000/svg'

type MapaComprasProps = {
  mercados: MercadoNoMapa[]
  /** Mercado aberto na folha; o mapa o destaca e chega perto dele. */
  selecionado: MercadoNoMapa | null
  aoSelecionar: (mercado: MercadoNoMapa) => void
  /** Compra com o ponto sendo corrigido (ou colocado pela primeira vez). */
  editando: { ponto: Ponto | null } | null
  aoMover: (ponto: Ponto) => void
  /** Espaço ocupado por folhas por cima do mapa, para centralizar no que sobra. */
  folgaInferior: number
}

function icone(): SVGSVGElement {
  const svg = document.createElementNS(SVG, 'svg')
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('fill', 'none')
  svg.setAttribute('stroke', 'currentColor')
  svg.setAttribute('stroke-width', '2')
  svg.setAttribute('stroke-linecap', 'round')
  svg.setAttribute('stroke-linejoin', 'round')
  svg.setAttribute('aria-hidden', 'true')
  for (const d of [
    'm2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7',
    'M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8',
    'M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4',
    'M2 7h20',
  ]) {
    const caminho = document.createElementNS(SVG, 'path')
    caminho.setAttribute('d', d)
    svg.append(caminho)
  }
  return svg
}

function elementoDoMercado(m: MercadoNoMapa, aoClicar: () => void): HTMLButtonElement {
  const botao = document.createElement('button')
  botao.type = 'button'
  botao.className = 'pino-mercado'
  botao.setAttribute('aria-label', `${m.nome}, ${formatarReais(m.ultima.total_centavos)}. Ver compras.`)

  const bolinha = document.createElement('span')
  bolinha.className = 'pino-mercado-icone'
  bolinha.append(icone())

  const texto = document.createElement('span')
  texto.className = 'pino-mercado-texto'
  const nome = document.createElement('b')
  nome.textContent = m.nome
  const preco = document.createElement('i')
  preco.textContent = formatarReais(m.ultima.total_centavos)
  texto.append(nome, preco)

  botao.append(bolinha, texto)
  botao.addEventListener('click', (evento) => {
    evento.stopPropagation()
    aoClicar()
  })
  return botao
}

function elementoDoPino(): HTMLDivElement {
  const pino = document.createElement('div')
  pino.className = 'pino-edicao'
  const bolinha = document.createElement('span')
  bolinha.className = 'pino-mercado-icone'
  bolinha.append(icone())
  pino.append(bolinha)
  return pino
}

/**
 * Mapa do histórico: um marcador por mercado, com nome, preço da compra mais
 * recente e ícone. Tocar leva até ele; no modo de edição aparece um pino que
 * se arrasta (ou se toca no mapa) para corrigir o lugar de uma compra.
 */
export default function MapaCompras({ mercados, selecionado, aoSelecionar, editando, aoMover, folgaInferior }: MapaComprasProps) {
  const recipiente = useRef<HTMLDivElement>(null)
  const mapa = useRef<maplibregl.Map | null>(null)
  const marcadores = useRef<Map<MercadoNoMapa, HTMLButtonElement>>(new Map())
  const pino = useRef<maplibregl.Marker | null>(null)
  // Os efeitos abaixo leem sempre a versão mais nova dos callbacks e da folga.
  const vivo = useRef({ aoSelecionar, aoMover, folgaInferior })
  vivo.current = { aoSelecionar, aoMover, folgaInferior }

  // Cria o mapa uma vez.
  useEffect(() => {
    if (!recipiente.current) return
    const escuro = () => document.documentElement.classList.contains('dark')
    const instancia = new maplibregl.Map({
      container: recipiente.current,
      style: ESTILO,
      center: [-47.9, -15.8],
      zoom: 3.5,
      attributionControl: { compact: true },
      pitchWithRotate: false,
      dragRotate: false,
    })
    instancia.touchZoomRotate.disableRotation()
    instancia.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    mapa.current = instancia

    const atualizarTema = () => recipiente.current?.classList.toggle('mapa-escuro', escuro())
    atualizarTema()
    const observador = new MutationObserver(atualizarTema)
    observador.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })

    const atualizarNomes = () => recipiente.current?.classList.toggle('mapa-sem-nomes', instancia.getZoom() < ZOOM_COM_NOMES)
    instancia.on('zoom', atualizarNomes)
    instancia.on('click', (evento) => {
      if (pino.current) vivo.current.aoMover({ lat: evento.lngLat.lat, lng: evento.lngLat.lng })
    })

    const marcadoresVivos = marcadores.current
    return () => {
      observador.disconnect()
      marcadoresVivos.clear()
      pino.current = null
      instancia.remove()
      mapa.current = null
    }
  }, [])

  // Um marcador por mercado; enquadra todos quando o conjunto muda.
  useEffect(() => {
    const instancia = mapa.current
    if (!instancia) return
    const criados: maplibregl.Marker[] = []
    const mapaDeElementos = marcadores.current
    mapaDeElementos.clear()

    for (const m of mercados) {
      const elemento = elementoDoMercado(m, () => vivo.current.aoSelecionar(m))
      mapaDeElementos.set(m, elemento)
      criados.push(new maplibregl.Marker({ element: elemento, anchor: 'bottom' }).setLngLat([m.lng, m.lat]).addTo(instancia))
    }

    if (mercados.length === 1) {
      const [unico] = mercados
      instancia.jumpTo({ center: [unico!.lng, unico!.lat], zoom: 14 })
    } else if (mercados.length > 1) {
      const limites = new maplibregl.LngLatBounds()
      for (const m of mercados) limites.extend([m.lng, m.lat])
      instancia.fitBounds(limites, { padding: { top: 90, bottom: 90, left: 60, right: 60 }, maxZoom: 15, duration: 0 })
    }
    instancia.once('idle', () => instancia.fire('zoom'))

    return () => {
      for (const marcador of criados) marcador.remove()
      mapaDeElementos.clear()
    }
  }, [mercados])

  // Destaca o mercado aberto e chega perto dele, acima da folha.
  useEffect(() => {
    for (const [m, elemento] of marcadores.current) elemento.classList.toggle('pino-mercado-ativo', m === selecionado)
    const instancia = mapa.current
    if (!instancia || !selecionado) return
    instancia.flyTo({
      center: [selecionado.lng, selecionado.lat],
      zoom: Math.max(instancia.getZoom(), 15),
      offset: [0, -vivo.current.folgaInferior / 2],
      duration: 900,
      essential: true,
    })
  }, [selecionado])

  // Pino arrastável do modo de edição.
  useEffect(() => {
    const instancia = mapa.current
    if (!instancia || !editando) return
    const inicio = editando.ponto ?? { lat: instancia.getCenter().lat, lng: instancia.getCenter().lng }
    const marcador = new maplibregl.Marker({ element: elementoDoPino(), anchor: 'bottom', draggable: true })
      .setLngLat([inicio.lng, inicio.lat])
      .addTo(instancia)
    pino.current = marcador
    marcador.on('dragend', () => {
      const { lat, lng } = marcador.getLngLat()
      vivo.current.aoMover({ lat, lng })
    })
    if (editando.ponto) {
      instancia.flyTo({ center: [inicio.lng, inicio.lat], zoom: Math.max(instancia.getZoom(), 16), offset: [0, -vivo.current.folgaInferior / 2], duration: 700, essential: true })
    } else {
      // Sem ponto ainda: o pino nasce no centro e já vale como posição inicial.
      vivo.current.aoMover(inicio)
    }
    return () => {
      marcador.remove()
      pino.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editando === null, editando?.ponto === null])

  // O ponto muda por clique no mapa: o pino acompanha.
  useEffect(() => {
    if (pino.current && editando?.ponto) pino.current.setLngLat([editando.ponto.lng, editando.ponto.lat])
  }, [editando?.ponto])

  // O CSS do maplibre põe position: relative no recipiente e anularia o inset-0;
  // por isso o recipiente fica dentro de um invólucro que ocupa o espaço todo.
  return (
    <div className="absolute inset-0">
      <div ref={recipiente} className="size-full" />
    </div>
  )
}
