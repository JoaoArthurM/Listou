// Barra "Adicionar item" da aba Lista. O que a pessoa escreve cai em um de três
// caminhos, do mais barato ao mais flexível:
//
//   local   -> código lê sozinho: uma palavra, itens separados por vírgula,
//              ponto e vírgula, linha ou " e ", ou quantidade na frente
//              ("2 leite"). Funciona offline e não gasta IA.
//   ia      -> várias palavras soltas ("ovo arroz feijão batata"): só quem
//              entende o pedido sabe se são quatro itens ou um nome composto
//              ("papel higiênico"). Vai para o chat, que valida repetidos.
//
// A decisão é função pura para ter teste; quem chama escolhe o que fazer
// quando a IA não está disponível.

import { interpretarLista, type ItemImportado } from './importar'

export type EntradaLida =
  | { caminho: 'local'; itens: ItemImportado[]; repetidosNoTexto: number }
  | { caminho: 'ia'; texto: string }
  | { caminho: 'vazia' }

// "leite e pão", "ovo e arroz e feijão": o "e" entre palavras separa itens.
// Fica de fora quando faz parte de um nome conhecido ("mel e limão" é raro; o
// ganho de separar vale mais que esse caso, e o item pode ser editado).
const TEM_E = /\s+e\s+/i
const TODOS_OS_E = /\s+e\s+/gi

export function lerEntrada(bruto: string): EntradaLida {
  const texto = bruto.trim()
  if (texto === '') return { caminho: 'vazia' }

  const comSeparador = /[\n;,]/.test(texto) || TEM_E.test(texto)
  const partes = comSeparador ? texto.replace(TODOS_OS_E, ',') : texto
  const lido = interpretarLista(partes)
  if (lido.itens.length === 0) return { caminho: 'vazia' }

  const umaPalavra = !/\s/.test(texto)
  const temQuantidade = lido.itens.length === 1 && lido.itens[0]!.qtd !== null
  if (comSeparador || umaPalavra || temQuantidade) {
    return { caminho: 'local', itens: lido.itens, repetidosNoTexto: lido.repetidos }
  }
  // Duas palavras ou mais, sem nada que as separe: nome composto ou lista solta.
  return { caminho: 'ia', texto }
}
