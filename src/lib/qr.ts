// QR code do convite: o QR carrega o mesmo link que o compartilhamento já usa
// (/entrar/CODIGO). Quem lê com a câmera nativa abre o app direto; quem lê
// pelo leitor do app só precisa do código que vem dentro do link.

import qrcode from 'qrcode-generator'

const ALFABETO_CODIGO = /^[A-Z0-9]{6}$/

export function linkDoConvite(codigo: string, origem = window.location.origin): string {
  return `${origem}/entrar/${codigo}`
}

/**
 * Matriz do QR (true = módulo escuro). Correção de erro "M": o link é curto,
 * então a versão fica pequena e os módulos grandes o bastante para ler de longe.
 */
export function matrizQr(texto: string): boolean[][] {
  const qr = qrcode(0, 'M')
  qr.addData(texto)
  qr.make()
  const n = qr.getModuleCount()
  return Array.from({ length: n }, (_, linha) => Array.from({ length: n }, (_, coluna) => qr.isDark(linha, coluna)))
}

/**
 * Extrai o código de 6 caracteres do que o QR trouxe: o link do convite
 * (de qualquer origem, para valer também em preview da Vercel) ou o código puro.
 * Devolve null quando o conteúdo não é um convite do Listou.
 */
export function codigoDoQr(conteudo: string): string | null {
  const texto = conteudo.trim()
  const doLink = /\/entrar\/([A-Za-z0-9]+)\/?(?:[?#].*)?$/.exec(texto)
  const candidato = (doLink?.[1] ?? texto).toUpperCase()
  return ALFABETO_CODIGO.test(candidato) ? candidato : null
}
