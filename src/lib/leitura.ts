// O que pode faltar na leitura de uma etiqueta (CLAUDE.md, seção 6.1). A regra
// é uma só: o que a IA não leu com certeza aparece na tela como erro, e o app
// pede o dado a quem está com a etiqueta na mão. Nada é preenchido por palpite.
//
// Este arquivo tem uma cópia idêntica em supabase/functions/_shared/
// (npm run sync:shared).

export const PROBLEMAS = [
  'sem_etiqueta',
  'sem_nome',
  'sem_preco',
  'atacado_ilegivel',
  'cartao_ilegivel',
  'unidade_incerta',
  'precos_incoerentes',
  'leitura_duvidosa',
] as const

export type Problema = (typeof PROBLEMAS)[number]

const TEXTOS: Record<Problema, string> = {
  sem_etiqueta: 'Não encontrei uma etiqueta de preço nessa foto.',
  sem_nome: 'Não consegui ler o nome do produto.',
  sem_preco: 'Não consegui ler o preço de varejo com certeza.',
  atacado_ilegivel: 'A etiqueta tem preço de atacado, mas não consegui ler o valor ou a quantidade mínima.',
  cartao_ilegivel: 'A etiqueta tem preço de cartão, mas não consegui ler o valor ou o nome do cartão.',
  unidade_incerta: 'Não deu para saber se o preço é por unidade ou por quilo.',
  precos_incoerentes: 'Os preços que li não batem entre si.',
  leitura_duvidosa: 'A leitura ficou com dúvida.',
}

export function textoDoProblema(problema: Problema): string {
  return TEXTOS[problema]
}

// Só a falta do nome deixa o preço de pé: o resto põe o valor em dúvida.
const NAO_TRAVAM_O_PRECO: ReadonlySet<Problema> = new Set<Problema>(['sem_nome'])

/** Com problema no preço o app não calcula sozinho: pede o valor a quem está vendo a etiqueta. */
export function travaPreco(problemas: readonly Problema[]): boolean {
  return problemas.some((p) => !NAO_TRAVAM_O_PRECO.has(p))
}

/**
 * Problemas de uma leitura guardada. Cards gravados antes desta validação não
 * têm a lista: neles só existe a confiança, e "baixa" já pedia o preço. Nos
 * novos vale a lista, e só ela (confiança baixa por faltar o nome não põe o
 * preço em dúvida).
 */
export function problemasDaLeitura(leitura: {
  problemas?: readonly Problema[]
  confianca: 'alta' | 'media' | 'baixa'
}): Problema[] {
  const problemas = [...(leitura.problemas ?? [])]
  if (problemas.length === 0 && leitura.confianca === 'baixa') problemas.push('leitura_duvidosa')
  return problemas
}
