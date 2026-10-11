import { describe, expect, it } from 'vitest'
import { lerEntrada } from './adicionar'

const nomes = (texto: string) => {
  const lida = lerEntrada(texto)
  return lida.caminho === 'local' ? lida.itens.map((i) => i.nome) : null
}

describe('lerEntrada', () => {
  it('uma palavra é um item, lido por código', () => {
    expect(nomes('leite')).toEqual(['Leite'])
  })

  it('separa por vírgula, linha, ponto e vírgula e "e"', () => {
    expect(nomes('ovo, arroz, feijão')).toEqual(['Ovo', 'Arroz', 'Feijão'])
    expect(nomes('ovo\narroz')).toEqual(['Ovo', 'Arroz'])
    expect(nomes('ovo; arroz')).toEqual(['Ovo', 'Arroz'])
    expect(nomes('leite e pão')).toEqual(['Leite', 'Pão'])
    expect(nomes('ovo, arroz e feijão')).toEqual(['Ovo', 'Arroz', 'Feijão'])
    expect(nomes('ovo e arroz e feijão')).toEqual(['Ovo', 'Arroz', 'Feijão'])
  })

  it('quantidade na frente continua sendo um item só', () => {
    const lida = lerEntrada('2 leite')
    expect(lida).toMatchObject({ caminho: 'local', itens: [{ nome: 'Leite', qtd: 2, unidade: 'un' }] })
    expect(lerEntrada('1,5 kg de carne')).toMatchObject({ caminho: 'local', itens: [{ nome: 'Carne', qtd: 1.5, unidade: 'kg' }] })
  })

  it('várias palavras soltas vão para a IA decidir', () => {
    expect(lerEntrada('ovo arroz feijão batata')).toEqual({ caminho: 'ia', texto: 'ovo arroz feijão batata' })
    expect(lerEntrada('papel higiênico')).toEqual({ caminho: 'ia', texto: 'papel higiênico' })
  })

  it('conta repetidos dentro do próprio texto', () => {
    expect(lerEntrada('leite, Leite, pão')).toMatchObject({ caminho: 'local', repetidosNoTexto: 1 })
  })

  it('texto sem item é vazio', () => {
    expect(lerEntrada('   ')).toEqual({ caminho: 'vazia' })
    expect(lerEntrada(',,')).toEqual({ caminho: 'vazia' })
  })
})
