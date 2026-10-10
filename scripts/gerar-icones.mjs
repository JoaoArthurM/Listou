// Gera os ícones do PWA em public/ sem depender de biblioteca de imagem:
// desenha o símbolo (o check do checklist, branco sobre o laranja da marca)
// pixel a pixel com campos de distância e grava o PNG com o zlib do Node.
//
// Uso: npm run icones

import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'

const destino = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public')

const LARANJA = [0xfb, 0x61, 0x33]
const BRANCO = [0xff, 0xff, 0xff]

// Check em coordenadas de 0 a 1: perna curta, vértice, perna longa.
const CHECK = [
  [0.3, 0.52],
  [0.44, 0.66],
  [0.71, 0.36],
]

const tabelaCrc = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(bytes) {
  let c = 0xffffffff
  for (const b of bytes) c = tabelaCrc[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function bloco(tipo, dados) {
  const corpo = Buffer.concat([Buffer.from(tipo, 'ascii'), dados])
  const tamanho = Buffer.alloc(4)
  tamanho.writeUInt32BE(dados.length)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(corpo))
  return Buffer.concat([tamanho, corpo, crc])
}

function png(lado, rgba) {
  const cabecalho = Buffer.alloc(13)
  cabecalho.writeUInt32BE(lado, 0)
  cabecalho.writeUInt32BE(lado, 4)
  cabecalho.set([8, 6, 0, 0, 0], 8) // 8 bits por canal, RGBA
  const linhas = Buffer.alloc((lado * 4 + 1) * lado)
  for (let y = 0; y < lado; y++) {
    rgba.copy(linhas, y * (lado * 4 + 1) + 1, y * lado * 4, (y + 1) * lado * 4)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloco('IHDR', cabecalho),
    bloco('IDAT', deflateSync(linhas, { level: 9 })),
    bloco('IEND', Buffer.alloc(0)),
  ])
}

function distanciaAoSegmento(px, py, [ax, ay], [bx, by]) {
  const dx = bx - ax
  const dy = by - ay
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

// Distância com sinal até um quadrado de cantos arredondados centrado em (0,5; 0,5).
function distanciaAoQuadrado(px, py, meioLado, raio) {
  const qx = Math.abs(px - 0.5) - (meioLado - raio)
  const qy = Math.abs(py - 0.5) - (meioLado - raio)
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - raio
}

/**
 * @param lado     tamanho em pixels
 * @param raio     raio do canto do fundo (0 a 0,5); 0 = fundo ocupa o quadro todo
 * @param escala   tamanho do check; ícone "maskable" usa menor para caber na área segura
 */
function desenhar(lado, { raio, escala }) {
  const rgba = Buffer.alloc(lado * lado * 4)
  const espessura = 0.062 * escala
  const pontos = CHECK.map(([x, y]) => [0.5 + (x - 0.5) * escala, 0.5 + (y - 0.5) * escala])
  const borda = 1 / lado // meia transição de um pixel para suavizar o contorno

  for (let y = 0; y < lado; y++) {
    for (let x = 0; x < lado; x++) {
      const px = (x + 0.5) / lado
      const py = (y + 0.5) / lado

      const fundo = raio === 0 ? 1 : Math.max(0, Math.min(1, 0.5 - distanciaAoQuadrado(px, py, 0.5, raio) / borda))
      const d = Math.min(distanciaAoSegmento(px, py, pontos[0], pontos[1]), distanciaAoSegmento(px, py, pontos[1], pontos[2]))
      const traco = Math.max(0, Math.min(1, 0.5 - (d - espessura) / borda))

      const i = (y * lado + x) * 4
      for (let c = 0; c < 3; c++) rgba[i + c] = Math.round(LARANJA[c] + (BRANCO[c] - LARANJA[c]) * traco)
      rgba[i + 3] = Math.round(fundo * 255)
    }
  }
  return png(lado, rgba)
}

mkdirSync(destino, { recursive: true })

const arquivos = [
  ['pwa-192.png', 192, { raio: 0.225, escala: 1 }],
  ['pwa-512.png', 512, { raio: 0.225, escala: 1 }],
  // Android recorta o maskable em círculo ou "squircle": fundo inteiro, símbolo na área segura.
  ['pwa-maskable-512.png', 512, { raio: 0, escala: 0.72 }],
  // iOS aplica a própria máscara; precisa de fundo opaco de ponta a ponta.
  ['apple-touch-icon.png', 180, { raio: 0, escala: 0.9 }],
]

for (const [nome, lado, opcoes] of arquivos) {
  writeFileSync(path.join(destino, nome), desenhar(lado, opcoes))
  console.log(`public/${nome} (${lado}x${lado})`)
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="22.5" fill="#FB6133"/>
  <path d="M30 52 44 66 71 36" fill="none" stroke="#fff" stroke-width="12.4" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`
writeFileSync(path.join(destino, 'favicon.svg'), svg)
console.log('public/favicon.svg')
