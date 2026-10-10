// Compressão no cliente antes do upload (CLAUDE.md, seção 5). Etiqueta não
// precisa de foto de 12 MP: lado maior em 1280px e JPEG ~0.8 dão ~200 KB.

const LADO_MAIOR = 1280
const QUALIDADE = 0.8

export type FotoComprimida = { blob: Blob; largura: number; altura: number }

async function carregar(arquivo: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) {
    try {
      // "from-image" respeita a orientação EXIF; sem isso foto em pé sai deitada.
      return await createImageBitmap(arquivo, { imageOrientation: 'from-image' })
    } catch {
      // formato que o createImageBitmap não abre (alguns HEIC): tenta por <img>
    }
  }
  const url = URL.createObjectURL(arquivo)
  try {
    const img = new Image()
    img.decoding = 'async'
    img.src = url
    await img.decode()
    return img
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function comprimirImagem(arquivo: Blob): Promise<FotoComprimida> {
  const origem = await carregar(arquivo)
  const escala = Math.min(1, LADO_MAIOR / Math.max(origem.width, origem.height))
  const largura = Math.max(1, Math.round(origem.width * escala))
  const altura = Math.max(1, Math.round(origem.height * escala))

  const canvas = document.createElement('canvas')
  canvas.width = largura
  canvas.height = altura
  const contexto = canvas.getContext('2d')
  if (!contexto) throw new Error('Este navegador não consegue preparar a foto.')
  contexto.imageSmoothingQuality = 'high'
  contexto.drawImage(origem, 0, 0, largura, altura)
  if ('close' in origem) origem.close()

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALIDADE))
  if (!blob) throw new Error('Não deu para converter a foto.')
  return { blob, largura, altura }
}
