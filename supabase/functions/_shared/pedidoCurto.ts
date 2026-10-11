// Pedido escrito no formato curto "nome valor quantidade" ("ovo 12,30 1 caixa",
// "arroz 2 22.90", "tomate 8,90 1,5 kg"). É um formato estrito e sem ambiguidade,
// então é lido por código: resposta imediata, sem gastar a IA e sem depender
// de ela acertar. Qualquer coisa fora do formato volta null e segue para a IA.

const MAX_CENTAVOS = 99_999_999
const MAX_QUANTIDADE = 9999

export type PedidoCurto = { tipo: 'adicionar_item'; nome: string; qtd: number; unidade: 'un' | 'kg'; preco_centavos: number }

// Embalagens e rótulos de unidade que podem vir depois da quantidade e não fazem parte do nome.
const EMBALAGENS = new Set([
  'un', 'und', 'unid', 'unidade', 'unidades', 'caixa', 'caixas', 'cx', 'pacote', 'pacotes', 'pct', 'saco', 'sacos',
  'bandeja', 'bandejas', 'duzia', 'duzias', 'maco', 'macos', 'lata', 'latas', 'garrafa', 'garrafas', 'pote', 'potes',
  'frasco', 'frascos', 'peca', 'pecas', 'cada',
])
const QUILO = new Set(['kg', 'kgs', 'quilo', 'quilos', 'kilo', 'kilos'])
// Quem começa com verbo ou fala de pedido é conversa, não formato curto: vai para a IA.
const NAO_E_NOME = new Set([
  'peguei', 'pegar', 'pego', 'comprei', 'comprar', 'levei', 'levar', 'adiciona', 'adicionar', 'adicione', 'coloca',
  'colocar', 'poe', 'por', 'tira', 'tirar', 'remove', 'remover', 'acabei', 'quero', 'preciso', 'falta', 'quanto',
  'que', 'o', 'a', 'os', 'as', 'ja', 'foi', 'era', 'saiu', 'custou', 'deu', 'um', 'uma', 'dois', 'duas', 'tres',
])

const semAcento = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()

/** "12,30", "12.30", "R$12,30" -> 1230. Só vale com duas casas decimais ou com o R$ na frente. */
function lerPreco(token: string): number | null {
  const comSimbolo = /^r\$/i.test(token)
  const limpo = token.replace(/^r\$/i, '')
  const decimal = /^(\d{1,6})[.,](\d{2})$/.exec(limpo)
  if (decimal) {
    const centavos = Number(decimal[1]) * 100 + Number(decimal[2])
    return centavos > 0 && centavos <= MAX_CENTAVOS ? centavos : null
  }
  if (comSimbolo && /^\d{1,6}$/.test(limpo)) {
    const centavos = Number(limpo) * 100
    return centavos > 0 && centavos <= MAX_CENTAVOS ? centavos : null
  }
  return null
}

export function lerPedidoCurto(texto: string): PedidoCurto | null {
  // "R$ 5" vira "R$5" para ficar em um token só.
  const tokens = texto
    .trim()
    .replace(/r\$\s+(?=\d)/gi, 'R$')
    .split(/\s+/)
    .filter(Boolean)
  if (tokens.length < 3 || tokens.length > 8) return null

  let preco: number | null = null
  let qtd: number | null = null
  let unidade: 'un' | 'kg' = 'un'
  const nome: string[] = []

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!
    const chave = semAcento(token)
    const proximo = semAcento(tokens[i + 1] ?? '')

    // "1,5 kg" / "500g": quantidade por peso.
    const gramas = /^(\d{1,5})g$/.exec(chave)
    if (gramas) {
      if (qtd !== null) return null
      qtd = Math.round(Number(gramas[1])) / 1000
      unidade = 'kg'
      continue
    }
    if (/^\d+([.,]\d{1,3})?$/.test(chave) && QUILO.has(proximo)) {
      if (qtd !== null) return null
      qtd = Number(chave.replace(',', '.'))
      unidade = 'kg'
      i += 1
      continue
    }

    const valor = lerPreco(token)
    if (valor !== null) {
      if (preco !== null) return null
      preco = valor
      continue
    }

    if (/^\d{1,4}$/.test(chave)) {
      // Um inteiro solto depois do nome é a quantidade; só um.
      if (qtd !== null || nome.length === 0) return null
      qtd = Number(chave)
      continue
    }

    if (EMBALAGENS.has(chave)) {
      // Embalagem só vale depois do nome, nunca no meio dele.
      if (nome.length === 0) return null
      continue
    }

    if (QUILO.has(chave)) return null
    // O nome vem inteiro antes dos números; palavra de nome depois deles é outra frase.
    if (preco !== null || qtd !== null) return null
    if (NAO_E_NOME.has(chave) || !/^[\p{L}\p{N}][\p{L}\p{N}'-]*$/u.test(token) || !/\p{L}/u.test(token)) return null
    nome.push(token)
  }

  if (preco === null || qtd === null || nome.length === 0 || nome.length > 4) return null
  if (qtd <= 0 || qtd > MAX_QUANTIDADE) return null
  if (unidade === 'un' && !Number.isInteger(qtd)) return null

  const texto_nome = nome.join(' ')
  return {
    tipo: 'adicionar_item',
    nome: texto_nome.charAt(0).toUpperCase() + texto_nome.slice(1),
    qtd,
    unidade,
    preco_centavos: preco,
  }
}
