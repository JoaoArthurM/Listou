// Máscara de dinheiro como a de caixa eletrônico: só contam os dígitos e eles
// entram pelos centavos. 1 -> "0,01", 12 -> "0,12", 1234 -> "12,34",
// 123456 -> "1.234,56". Apagar tira o último dígito. O texto devolvido é lido
// por parseDinheiro (src/lib/dinheiro.ts) sem mudança.

const MAX_DIGITOS = 8 // R$ 999.999,99, o mesmo teto de dinheiro.ts

export function mascararDinheiro(texto: string): string {
  const digitos = texto.replace(/\D/g, '').replace(/^0+/, '').slice(0, MAX_DIGITOS)
  if (digitos === '') return ''
  const cheio = digitos.padStart(3, '0')
  const inteiro = cheio.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${inteiro},${cheio.slice(-2)}`
}
