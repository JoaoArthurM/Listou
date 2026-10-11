// Entrada por voz: grava o microfone e entrega um WAV mono de 16 kHz em base64,
// pronto para a Edge Function "chat" mandar ao Gemini. Converter no aparelho
// para um formato único evita depender do codec de cada navegador (o Chrome
// grava WebM/Opus, o Safari grava MP4/AAC).

const TAXA = 16_000
const MAX_SEGUNDOS = 25
const MIN_SEGUNDOS = 0.4

export type Gravacao = {
  /** Volume do microfone agora, de 0 a 1. Alimenta a onda da tela. */
  nivel: () => number
  /** Encerra e devolve o áudio em base64 (WAV). */
  parar: () => Promise<string>
  /** Encerra e joga fora. */
  cancelar: () => void
}

export class ErroDeVoz extends Error {}

export const MAX_SEGUNDOS_DE_VOZ = MAX_SEGUNDOS

export function vozDisponivel(): boolean {
  return typeof MediaRecorder !== 'undefined' && typeof navigator.mediaDevices?.getUserMedia === 'function'
}

function emBase64(bytes: Uint8Array): string {
  let binario = ''
  // Em blocos: String.fromCharCode com o array inteiro estoura a pilha.
  for (let i = 0; i < bytes.length; i += 0x8000) binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(binario)
}

function emWav(amostras: Float32Array): Uint8Array {
  const bytes = new Uint8Array(44 + amostras.length * 2)
  const v = new DataView(bytes.buffer)
  const texto = (pos: number, s: string) => [...s].forEach((c, i) => v.setUint8(pos + i, c.charCodeAt(0)))
  texto(0, 'RIFF')
  v.setUint32(4, 36 + amostras.length * 2, true)
  texto(8, 'WAVEfmt ')
  v.setUint32(16, 16, true) // tamanho do bloco fmt
  v.setUint16(20, 1, true) // PCM
  v.setUint16(22, 1, true) // mono
  v.setUint32(24, TAXA, true)
  v.setUint32(28, TAXA * 2, true) // bytes por segundo
  v.setUint16(32, 2, true) // bytes por amostra
  v.setUint16(34, 16, true) // bits por amostra
  texto(36, 'data')
  v.setUint32(40, amostras.length * 2, true)
  amostras.forEach((a, i) => {
    const s = Math.max(-1, Math.min(1, a))
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  })
  return bytes
}

async function converter(gravado: Blob): Promise<string> {
  const decodificador = new AudioContext()
  let audio: AudioBuffer
  try {
    audio = await decodificador.decodeAudioData(await gravado.arrayBuffer())
  } finally {
    void decodificador.close()
  }
  if (audio.duration < MIN_SEGUNDOS) throw new ErroDeVoz('Gravação curta demais. Segure um pouco mais e fale.')

  // Reamostra para 16 kHz e junta os canais num só.
  const duracao = Math.min(audio.duration, MAX_SEGUNDOS)
  const offline = new OfflineAudioContext(1, Math.ceil(duracao * TAXA), TAXA)
  const fonte = offline.createBufferSource()
  fonte.buffer = audio
  fonte.connect(offline.destination)
  fonte.start()
  const mono = (await offline.startRendering()).getChannelData(0)
  return emBase64(emWav(mono))
}

export async function gravar(): Promise<Gravacao> {
  let stream: MediaStream
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } })
  } catch {
    throw new ErroDeVoz('Não consegui usar o microfone. Libere o acesso nas permissões do navegador.')
  }

  const contexto = new AudioContext()
  const analisador = contexto.createAnalyser()
  analisador.fftSize = 256
  contexto.createMediaStreamSource(stream).connect(analisador)
  const onda = new Uint8Array(analisador.fftSize)

  const gravador = new MediaRecorder(stream)
  const pedacos: Blob[] = []
  gravador.ondataavailable = (e) => {
    if (e.data.size > 0) pedacos.push(e.data)
  }
  gravador.start()

  const soltar = () => {
    for (const faixa of stream.getTracks()) faixa.stop()
    void contexto.close()
  }
  // Depois de parar ou cancelar, a gravação não aceita mais nada: a tela chama
  // cancelar() ao desmontar, e isso não pode descartar um áudio já a caminho.
  let encerrada = false

  return {
    nivel() {
      if (encerrada) return 0
      analisador.getByteTimeDomainData(onda)
      let pico = 0
      for (const amostra of onda) pico = Math.max(pico, Math.abs(amostra - 128))
      // Fala normal fica perto de 40 a 60 num máximo de 128.
      return Math.min(1, pico / 64)
    },
    cancelar() {
      if (encerrada) return
      encerrada = true
      gravador.onstop = null
      if (gravador.state !== 'inactive') gravador.stop()
      soltar()
    },
    parar() {
      if (encerrada) return Promise.reject(new ErroDeVoz('Essa gravação já foi encerrada.'))
      encerrada = true
      return new Promise<string>((resolve, reject) => {
        gravador.onstop = () => {
          soltar()
          converter(new Blob(pedacos, { type: gravador.mimeType })).then(resolve, (e) =>
            reject(e instanceof ErroDeVoz ? e : new ErroDeVoz('Não deu para preparar o áudio. Tente de novo.')),
          )
        }
        if (gravador.state === 'inactive') gravador.onstop(new Event('stop'))
        else gravador.stop()
      })
    },
  }
}
