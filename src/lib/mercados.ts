// Pontos no mapa. O nome do mercado é sempre escrito pela pessoa; o ponto
// vem da localização na hora de finalizar a compra, e se corrige no mapa do Histórico.

export type Ponto = { lat: number; lng: number }

/** Distância em metros entre dois pontos (haversine). */
export function distanciaEmMetros(a: Ponto, b: Ponto): number {
  const rad = (g: number) => (g * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return Math.round(2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(h))))
}

/**
 * Posição atual do aparelho, ou null se a pessoa recusou, o aparelho não
 * informa ou demorou demais. Quem chama segue sem ela: nunca trava a ação.
 */
export function posicaoAtual(esperaMs = 8000): Promise<Ponto | null> {
  return new Promise((resolver) => {
    if (!('geolocation' in navigator)) return resolver(null)
    navigator.geolocation.getCurrentPosition(
      (p) => resolver({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolver(null),
      { enableHighAccuracy: true, timeout: esperaMs, maximumAge: 60000 },
    )
  })
}
