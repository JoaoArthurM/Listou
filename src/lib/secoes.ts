// Seções do mercado. A lista de compras é agrupada por elas, na ordem em que
// costumam aparecer no caminho da loja. A seção sai do nome do item, por uma
// tabela de palavras: é imediato, funciona sem conexão e não gasta IA. Quando a
// tabela erra ou não conhece o produto, a pessoa escolhe a seção no item e a
// escolha fica gravada (coluna itens.secao).

export const SECOES = [
  'hortifruti',
  'padaria',
  'acougue',
  'frios',
  'mercearia',
  'bebidas',
  'congelados',
  'limpeza',
  'higiene',
  'pet',
  'outros',
] as const

export type Secao = (typeof SECOES)[number]

export const NOME_DA_SECAO: Record<Secao, string> = {
  hortifruti: 'Hortifrúti',
  padaria: 'Padaria',
  acougue: 'Açougue e peixaria',
  frios: 'Frios e laticínios',
  mercearia: 'Mercearia',
  bebidas: 'Bebidas',
  congelados: 'Congelados',
  limpeza: 'Limpeza',
  higiene: 'Higiene e beleza',
  pet: 'Pet',
  outros: 'Outros',
}

// Termos já sem acento e no singular. Um termo de várias palavras ganha de um
// de uma só ("molho de tomate" é mercearia, não hortifrúti).
const TERMOS: Record<Exclude<Secao, 'outros'>, string> = {
  hortifruti:
    'abacate|abacaxi|abobora|abobrinha|acelga|agriao|aipim|alface|alho|alho poro|ameixa|banana|batata|batata doce|berinjela|beterraba|brocolis|caju|caqui|cebola|cebolinha|cenoura|cheiro verde|chuchu|coco|coentro|couve|couve flor|espinafre|fruta|gengibre|goiaba|hortela|inhame|jilo|kiwi|laranja|legume|limao|maca|macaxeira|mamao|mandioca|mandioquinha|manga|manjericao|maracuja|maxixe|melancia|melao|morango|pepino|pera|pessego|pimentao|quiabo|rabanete|repolho|rucula|salsa|salsinha|tangerina|mexerica|tomate|uva|vagem|verdura',
  padaria: 'baguete|bisnaguinha|bolo|broa|croissant|pao|pao de forma|pao frances|pao integral|pao sirio|rosca|sonho|torrada',
  acougue:
    'acem|alcatra|bacon|bife|bisteca|camarao|carne|carne moida|contra file|costela|coxa|coxao mole|cupim|file|file de peixe|file de frango|fraldinha|frango|figado|lagarto|linguica|lombo|maminha|merluza|moela|musculo|patinho|peito de frango|peixe|pernil|picanha|salmao|sardinha fresca|sobrecoxa|tilapia|toucinho',
  frios:
    'coalhada|cream cheese|creme de ricota|iogurte|leite|leite fermentado|manteiga|margarina|massa fresca|mortadela|mussarela|mucarela|nata|peito de peru|petit suisse|presunto|queijo|requeijao|ricota|salame|salsicha',
  mercearia:
    'acucar|adocante|amendoim|amido|arroz|atum|aveia|azeite|azeitona|bala|batata palha|biscoito|bolacha|cafe|caldo de galinha|caldo de carne|canela|catchup|ketchup|cereal|cha|chocolate|chocolate em po|achocolatado|colorau|cominho|creme de leite|doce de leite|ervilha|extrato de tomate|farinha|farinha de trigo|farinha de mandioca|farofa|feijao|fermento|fuba|gelatina|geleia|granola|grao de bico|lasanha seca|leite condensado|leite de coco|leite em po|lentilha|macarrao|maionese|massa|massa de tomate|mel|milho|mistura para bolo|milho de pipoca|milho verde|molho|molho de tomate|mostarda|oleo|oleo de soja|oregano|ovo|palmito|pimenta|pipoca|polvilho|sal|salgadinho|sardinha|tapioca|tempero|trigo|vinagre',
  bebidas:
    'agua|agua de coco|agua mineral|agua tonica|cachaca|cerveja|energetico|espumante|guarana|isotonico|refrigerante|coca|coca cola|pepsi|fanta|sprite|skol|brahma|heineken|suco|suco de laranja|suco de uva|vinho|vodka|whisky',
  congelados:
    'acai|batata frita|batata congelada|empanado|empanado de frango|hamburguer|lasanha|nuggets|nuggets de frango|steak de frango|pao de queijo|picole|pizza|polpa|polpa de fruta|sorvete|steak',
  limpeza:
    'agua sanitaria|alcool|alvejante|amaciante|bombril|bucha|candida|cera|desengordurante|desinfetante|detergente|esponja|flanela|guardanapo|inseticida|limpa vidro|limpador|lustra movel|luva|multiuso|omo|pano|pinho sol|pano de chao|pano de prato|papel aluminio|papel toalha|rodo|sabao|sabao em barra|sabao em po|sabao liquido|saco de lixo|saponaceo|vassoura|veja',
  higiene:
    'absorvente|algodao|aparelho de barbear|barbeador|condicionador|cotonete|creme dental|creme de barbear|creme hidratante|desodorante|enxaguante|escova de dente|fio dental|fralda|hidratante|lenco umedecido|papel higienico|pasta de dente|protetor solar|sabonete|shampoo|xampu',
  pet: 'areia de gato|areia higienica|petisco|racao|sache de gato|sache de cachorro|tapete higienico',
}

// "limões" -> "limao", "pães" -> "pao", "tomates" -> "tomate", "cereais" -> "cereal".
function singular(palavra: string): string {
  if (palavra.length <= 3) return palavra
  if (palavra.endsWith('oes') || palavra.endsWith('aes')) return palavra.slice(0, -3) + 'ao'
  if (palavra.endsWith('eis') || palavra.endsWith('ais')) return palavra.slice(0, -2) + 'l'
  if (palavra.endsWith('res') || palavra.endsWith('zes')) return palavra.slice(0, -2)
  if (palavra.endsWith('s') && !palavra.endsWith('ss')) return palavra.slice(0, -1)
  return palavra
}

function palavras(nome: string): string[] {
  return nome
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map(singular)
}

// termo -> seção, com os termos mais longos primeiro.
const INDICE: Array<{ termo: string[]; secao: Secao }> = (Object.entries(TERMOS) as Array<[Secao, string]>)
  .flatMap(([secao, lista]) => lista.split('|').map((termo) => ({ termo: termo.split(' ').map(singular), secao })))
  .sort((a, b) => b.termo.length - a.termo.length)

function contem(frase: string[], termo: string[]): boolean {
  for (let i = 0; i + termo.length <= frase.length; i++) {
    if (termo.every((palavra, j) => frase[i + j] === palavra)) return true
  }
  return false
}

/** Seção pelo nome do item. O que a tabela não conhece vai para "outros". */
export function secaoPeloNome(nome: string): Secao {
  const frase = palavras(nome)
  return INDICE.find(({ termo }) => contem(frase, termo))?.secao ?? 'outros'
}

const ehSecao = (valor: string | null | undefined): valor is Secao => SECOES.includes(valor as Secao)

/** A seção escolhida à mão vale; sem escolha, decide o nome. */
export function secaoDoItem(item: { nome: string; secao?: string | null }): Secao {
  return ehSecao(item.secao) ? item.secao : secaoPeloNome(item.nome)
}

/** Agrupa na ordem das seções, pulando as vazias. */
export function agruparPorSecao<T extends { nome: string; secao?: string | null }>(itens: T[]): Array<{ secao: Secao; itens: T[] }> {
  const grupos = new Map<Secao, T[]>()
  for (const item of itens) {
    const secao = secaoDoItem(item)
    grupos.set(secao, [...(grupos.get(secao) ?? []), item])
  }
  return SECOES.filter((s) => grupos.has(s)).map((secao) => ({ secao, itens: grupos.get(secao) as T[] }))
}
