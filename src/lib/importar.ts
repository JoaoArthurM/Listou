// Importa itens de um texto colado (lista do WhatsApp, das notas, de outro
// app). É leitura de texto, sem IA: cada linha vira um item, e a quantidade só
// é reconhecida nos formatos em que não há dúvida. Em "Arroz 5kg" o 5kg é o
// tamanho do pacote e fica no nome; em "2 kg de batata" é quantidade.

import type { Unidade } from './dinheiro'
import { normalizarCartao } from './precos'

export type ItemImportado = { nome: string; qtd: number | null; unidade: Unidade }

export const MAX_ITENS_IMPORTADOS = 100
const MAX_NOME = 80

// Marcadores de lista no começo da linha: traço, bolinha, caixa de marcar, "1." ou "1)".
const MARCADOR = /^(?:\s*(?:[-–—•*·▪◦●○▫⬜✅☑✔✓]️?|\[[ xX✓]?\]|\(\s?\)|\d{1,2}[.)](?=\s)))+\s*/u
// "2 leite", "2x leite", "2 un de leite", "1,5 kg de carne", "500g de queijo".
const QTD_NA_FRENTE = /^(\d+(?:[.,]\d{1,3})?)\s*(kg|quilos?|kilos?|g|gr|gramas?|un|und|unid|unidades?|x)?(?=\s)\s+(?:de\s+)?(.+)$/i
// "leite x2", "leite (2)", "leite: 2", "leite - 2 un".
const QTD_NO_FIM = /^(.+?)(?:\s+x\s*(\d{1,4})|\s*\((\d{1,4})\)|\s*[:\-–]\s*(\d{1,4})\s*(?:un|und|unid|unidades?)?)$/i

const numero = (texto: string) => Number(texto.replace(',', '.'))
const temLetra = (texto: string) => /\p{L}/u.test(texto)

function limparNome(texto: string): string | null {
  const nome = texto
    .replace(/\s+/g, ' ')
    .replace(/[\s.;,:]+$/, '')
    .trim()
    .slice(0, MAX_NOME)
    .trim()
  if (nome.length < 2 || !temLetra(nome)) return null
  return nome.charAt(0).toUpperCase() + nome.slice(1)
}

function interpretarLinha(bruta: string): ItemImportado | null {
  // A formatação do WhatsApp (*negrito*, _itálico_) sai antes de tudo.
  const linha = bruta.replace(MARCADOR, '').replace(/[*_~`]+/g, '').trim()
  // Título de lista ("Mercado:", "Compras da semana:") não é item.
  if (linha === '' || linha.endsWith(':')) return null

  const frente = QTD_NA_FRENTE.exec(linha)
  if (frente) {
    const [, valor = '', sufixo = '', resto = ''] = frente
    const qtd = numero(valor)
    const unidadeLida = sufixo.toLowerCase()
    const nome = limparNome(resto)
    if (nome && qtd > 0) {
      if (/^(kg|quilos?|kilos?)$/.test(unidadeLida)) return { nome, qtd, unidade: 'kg' }
      if (/^(g|gr|gramas?)$/.test(unidadeLida)) return { nome, qtd: Math.round(qtd) / 1000, unidade: 'kg' }
      // Sem unidade de peso, só número inteiro é quantidade ("1,5 leite" não é).
      if (Number.isInteger(qtd) && qtd <= 9999) return { nome, qtd, unidade: 'un' }
    }
  }

  const fim = QTD_NO_FIM.exec(linha)
  if (fim) {
    const qtd = Number(fim[2] ?? fim[3] ?? fim[4])
    const nome = limparNome(fim[1] ?? '')
    if (nome && qtd > 0) return { nome, qtd, unidade: 'un' }
  }

  const nome = limparNome(linha)
  return nome ? { nome, qtd: null, unidade: 'un' } : null
}

/**
 * Lê o texto colado. Uma linha, um item; vírgula e ponto e vírgula também
 * separam ("leite, pão, café"), menos a vírgula decimal ("1,5 kg").
 * Nomes repetidos entram uma vez só.
 */
export function interpretarLista(texto: string): { itens: ItemImportado[]; repetidos: number; cortados: number } {
  const pedacos = texto
    .split(/\r?\n|;/)
    .flatMap((linha) => linha.split(/,(?!\d)/))
    .map(interpretarLinha)
    .filter((item): item is ItemImportado => item !== null)

  const vistos = new Set<string>()
  const itens: ItemImportado[] = []
  let repetidos = 0
  for (const item of pedacos) {
    const chave = normalizarCartao(item.nome)
    if (vistos.has(chave)) repetidos += 1
    else {
      vistos.add(chave)
      itens.push(item)
    }
  }
  return { itens: itens.slice(0, MAX_ITENS_IMPORTADOS), repetidos, cortados: Math.max(0, itens.length - MAX_ITENS_IMPORTADOS) }
}

/** Tira do que vai entrar o que já está na lista esperando compra (mesmo nome, sem ligar para acento e maiúscula). */
export function semOsQueJaEstao<T extends { nome: string }>(novos: T[], nomesNaLista: string[]): { entram: T[]; jaEstavam: number } {
  const naLista = new Set(nomesNaLista.map(normalizarCartao))
  const entram = novos.filter((item) => !naLista.has(normalizarCartao(item.nome)))
  return { entram, jaEstavam: novos.length - entram.length }
}
