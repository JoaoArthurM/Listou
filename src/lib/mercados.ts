// Mercados perto de um ponto, para sugerir o nome na lista. Os dados são do
// OpenStreetMap, pela API Overpass: grátis, sem chave. A posição da pessoa só
// sai do aparelho aqui, e só quando ela pede (ou cria uma lista nova).

export type Ponto = { lat: number; lng: number }
export type Mercado = Ponto & { nome: string; distancia_m: number }

const RAIO_M = 400
const LIMITE = 5
const ENDERECOS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter']

/** Distância em metros entre dois pontos (haversine). */
export function distanciaEmMetros(a: Ponto, b: Ponto): number {
  const rad = (g: number) => (g * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return Math.round(2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(h))))
}

type ElementoOsm = {
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
}

/** Do JSON da Overpass para mercados com nome, do mais perto ao mais longe, sem repetir nome. */
export function mercadosDaResposta(resposta: unknown, origem: Ponto): Mercado[] {
  const elementos = (resposta as { elements?: ElementoOsm[] } | null)?.elements
  if (!Array.isArray(elementos)) return []

  const achados: Mercado[] = []
  for (const e of elementos) {
    const nome = e.tags?.name?.trim()
    const lat = e.lat ?? e.center?.lat
    const lng = e.lon ?? e.center?.lon
    if (!nome || typeof lat !== 'number' || typeof lng !== 'number') continue
    achados.push({ nome, lat, lng, distancia_m: distanciaEmMetros(origem, { lat, lng }) })
  }
  achados.sort((a, b) => a.distancia_m - b.distancia_m)

  const vistos = new Set<string>()
  return achados
    .filter((m) => {
      const chave = m.nome.toLocaleLowerCase('pt-BR')
      if (vistos.has(chave)) return false
      vistos.add(chave)
      return true
    })
    .slice(0, LIMITE)
}

export function consultaOverpass({ lat, lng }: Ponto): string {
  return `[out:json][timeout:10];nwr(around:${RAIO_M},${lat},${lng})[shop~"^(supermarket|wholesale|convenience|greengrocer|butcher|bakery)$"][name];out center 30;`
}

/** Mercados com nome até 400 m do ponto. Tenta um segundo servidor se o primeiro falhar. */
export async function mercadosPerto(ponto: Ponto, sinal?: AbortSignal): Promise<Mercado[]> {
  const corpo = new URLSearchParams({ data: consultaOverpass(ponto) })
  let ultimoErro: unknown = null
  for (const endereco of ENDERECOS) {
    try {
      const resposta = await fetch(endereco, { method: 'POST', body: corpo, signal: sinal })
      if (!resposta.ok) throw new Error(`Overpass respondeu ${resposta.status}`)
      return mercadosDaResposta(await resposta.json(), ponto)
    } catch (erro) {
      if (sinal?.aborted) throw erro
      ultimoErro = erro
    }
  }
  throw ultimoErro instanceof Error ? ultimoErro : new Error('Não deu para buscar mercados perto de você.')
}

/** Posição atual do aparelho; recusa com uma frase que dá para mostrar na tela. */
export function posicaoAtual(): Promise<Ponto> {
  return new Promise((resolver, recusar) => {
    if (!('geolocation' in navigator)) return recusar(new Error('Este aparelho não informa a localização.'))
    navigator.geolocation.getCurrentPosition(
      (p) => resolver({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (erro) =>
        recusar(
          new Error(
            erro.code === erro.PERMISSION_DENIED
              ? 'Sem permissão de localização. Escreva o nome do mercado.'
              : 'Não deu para achar sua localização agora. Escreva o nome do mercado.',
          ),
        ),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    )
  })
}
