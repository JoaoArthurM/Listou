// Datas do chat, no estilo do WhatsApp: "Hoje", "Ontem", o dia da semana
// para a última semana e a data por extenso para o que é mais antigo.

const hora = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' })
const diaDaSemana = new Intl.DateTimeFormat('pt-BR', { weekday: 'long' })
const dataCompleta = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })
const dataSemAno = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long' })

const inicioDoDia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

/** Identifica o dia do calendário local, para saber quando a conversa muda de dia. */
export const chaveDoDia = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`

/** "14:32". */
export const horaCurta = (d: Date) => hora.format(d)

/** "Hoje", "Ontem", "quarta-feira" (até 6 dias atrás), "10 de outubro" ou, em outro ano, "10 de outubro de 2025". */
export function rotuloDoDia(d: Date, agora = new Date()): string {
  const dias = Math.round((inicioDoDia(agora).getTime() - inicioDoDia(d).getTime()) / 86_400_000)
  if (dias <= 0) return 'Hoje'
  if (dias === 1) return 'Ontem'
  if (dias < 7) return diaDaSemana.format(d)
  return d.getFullYear() === agora.getFullYear() ? dataSemAno.format(d) : dataCompleta.format(d)
}
