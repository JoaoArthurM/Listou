import jsQR from 'jsqr'
import { describe, expect, it } from 'vitest'
import { codigoDoQr, linkDoConvite, matrizQr } from './qr'

describe('codigoDoQr', () => {
  it('lê o código do link do convite', () => {
    expect(codigoDoQr('https://listou.vercel.app/entrar/ABC234')).toBe('ABC234')
  })
  it('aceita link com barra final, query e minúsculas', () => {
    expect(codigoDoQr('https://exemplo.app/entrar/abc234/?x=1')).toBe('ABC234')
  })
  it('aceita o código puro', () => {
    expect(codigoDoQr(' abc234 ')).toBe('ABC234')
  })
  it('recusa conteúdo que não é convite', () => {
    expect(codigoDoQr('https://outro.site/promocao')).toBeNull()
    expect(codigoDoQr('https://listou.vercel.app/entrar/ABC')).toBeNull()
    expect(codigoDoQr('WIFI:S:casa;T:WPA;P:12345678;;')).toBeNull()
    expect(codigoDoQr('')).toBeNull()
  })
})

describe('ida e volta', () => {
  it('o QR gerado é lido pelo mesmo leitor que o app usa', () => {
    const link = linkDoConvite('ABC234', 'https://listou.vercel.app')
    const matriz = matrizQr(link)
    const escala = 6
    const margem = 4
    const lado = (matriz.length + margem * 2) * escala
    const pixels = new Uint8ClampedArray(lado * lado * 4).fill(255)
    matriz.forEach((linha, y) =>
      linha.forEach((escuro, x) => {
        if (!escuro) return
        for (let dy = 0; dy < escala; dy++) {
          for (let dx = 0; dx < escala; dx++) {
            const i = (((y + margem) * escala + dy) * lado + (x + margem) * escala + dx) * 4
            pixels[i] = pixels[i + 1] = pixels[i + 2] = 0
          }
        }
      }),
    )
    const lido = jsQR(pixels, lado, lado)
    expect(lido?.data).toBe(link)
    expect(codigoDoQr(lido?.data ?? '')).toBe('ABC234')
  })
})

describe('matrizQr', () => {
  it('gera matriz quadrada e determinística para o link', () => {
    const link = linkDoConvite('ABC234', 'https://listou.vercel.app')
    const a = matrizQr(link)
    expect(a.length).toBeGreaterThanOrEqual(21)
    expect(a.every((linha) => linha.length === a.length)).toBe(true)
    expect(matrizQr(link)).toEqual(a)
  })
})
