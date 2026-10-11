// Frases do balão "Listou está pensando". A espera passa mais leve quando o
// assistente conta o que está fazendo, em linguagem de gente, e não repete uma
// única legenda. Cada contexto tem uma sequência de etapas (na ordem em que o
// trabalho acontece) e, se a espera continuar, um ciclo de frases de paciência.

export type ContextoDePensar = 'texto' | 'voz' | 'foto'

type Roteiro = { etapas: readonly string[]; paciencia: readonly string[] }

const PACIENCIA = ['Só mais um instante…', 'Quase lá…', 'Conferindo os detalhes…', 'Tirando a prova dos números…'] as const

const ROTEIROS: Record<ContextoDePensar, Roteiro> = {
  texto: {
    etapas: ['Entendendo o que você pediu…', 'Dando uma olhada na sua lista…', 'Vendo o que muda…', 'Preparando a resposta…'],
    paciencia: PACIENCIA,
  },
  voz: {
    etapas: ['Escutando com atenção…', 'Entendendo o que você falou…', 'Dando uma olhada na sua lista…', 'Preparando a resposta…'],
    paciencia: PACIENCIA,
  },
  foto: {
    etapas: [
      'Deixa eu olhar essa foto…',
      'Procurando a etiqueta…',
      'Lendo os preços…',
      'Conferindo se tem preço de atacado ou cartão…',
      'Vendo qual item da sua lista combina…',
      'Confirmando que li tudo certinho…',
    ],
    paciencia: PACIENCIA,
  },
}

/** Frase da posição n da espera: percorre as etapas e, depois delas, gira na paciência sem repetir a anterior. */
export function fraseDaEspera(contexto: ContextoDePensar, n: number): string {
  const { etapas, paciencia } = ROTEIROS[contexto]
  const passo = Math.max(0, Math.floor(n))
  if (passo < etapas.length) return etapas[passo] as string
  return paciencia[(passo - etapas.length) % paciencia.length] as string
}
