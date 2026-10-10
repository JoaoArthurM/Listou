import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...classes: ClassValue[]) {
  return twMerge(clsx(classes))
}

/** "João Arthur" -> "João" */
export function primeiroNome(nome: string | null | undefined): string {
  return nome?.trim().split(/\s+/)[0] ?? ''
}

export function saudacao(agora = new Date()): string {
  const hora = agora.getHours()
  if (hora < 5) return 'Boa noite'
  if (hora < 12) return 'Bom dia'
  if (hora < 18) return 'Boa tarde'
  return 'Boa noite'
}

/** "2 itens", "1 item" */
export function plural(n: number, um: string, varios: string): string {
  return `${n} ${n === 1 ? um : varios}`
}

/** Junta nomes como numa frase: "Ana", "Ana e Bruno", "Ana, Bruno e Caio". */
export function listarNomes(nomes: string[]): string {
  if (nomes.length <= 1) return nomes[0] ?? ''
  return `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`
}
