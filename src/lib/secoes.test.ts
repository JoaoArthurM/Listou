import { describe, expect, it } from 'vitest'
import { agruparPorSecao, NOME_DA_SECAO, secaoDoItem, secaoPeloNome, SECOES } from './secoes'

describe('secaoPeloNome', () => {
  it.each([
    ['Tomate', 'hortifruti'],
    ['Banana prata', 'hortifruti'],
    ['Limões', 'hortifruti'],
    ['Pães', 'padaria'],
    ['Pão de forma', 'padaria'],
    ['Peito de frango', 'acougue'],
    ['Carne moída', 'acougue'],
    ['Leite integral Italac 1L', 'frios'],
    ['Queijo mussarela', 'frios'],
    ['Arroz Tio João 5kg', 'mercearia'],
    ['Feijão carioca', 'mercearia'],
    ['Café Pilão Tradicional 500g', 'mercearia'],
    ['Ovos', 'mercearia'],
    ['Coca-Cola 2L', 'bebidas'],
    ['Cervejas', 'bebidas'],
    ['Pizza congelada', 'congelados'],
    ['DETERGENTE YPÊ NEUTRO 500ML', 'limpeza'],
    ['Sabão em pó', 'limpeza'],
    ['Sabonete', 'higiene'],
    ['Shampoo', 'higiene'],
    ['Ração para gato', 'pet'],
  ] as const)('%s vai para %s', (nome, secao) => {
    expect(secaoPeloNome(nome)).toBe(secao)
  })

  it.each([
    ['Molho de tomate', 'mercearia'],
    ['Extrato de tomate', 'mercearia'],
    ['Leite condensado', 'mercearia'],
    ['Creme de leite', 'mercearia'],
    ['Creme dental', 'higiene'],
    ['Água sanitária', 'limpeza'],
    ['Água mineral', 'bebidas'],
    ['Papel higiênico', 'higiene'],
    ['Papel toalha', 'limpeza'],
    ['Suco de laranja', 'bebidas'],
    ['Batata palha', 'mercearia'],
    ['Batata frita congelada', 'congelados'],
    ['Pão de queijo', 'congelados'],
    ['Caldo de galinha', 'mercearia'],
    ['Nuggets de frango', 'congelados'],
  ] as const)('o termo mais específico ganha: %s é %s', (nome, secao) => {
    expect(secaoPeloNome(nome)).toBe(secao)
  })

  it('produto que a tabela não conhece vai para "outros", sem chute', () => {
    expect(secaoPeloNome('Pilha AA')).toBe('outros')
    expect(secaoPeloNome('')).toBe('outros')
    // "pimentão" não é "pimenta", "sabonete" não é "sabão": só palavra inteira conta.
    expect(secaoPeloNome('Pimentão')).toBe('hortifruti')
    expect(secaoPeloNome('Salmoura')).toBe('outros')
  })
})

describe('secaoDoItem', () => {
  it('a seção escolhida à mão vale mais que o nome', () => {
    expect(secaoDoItem({ nome: 'Tomate', secao: 'mercearia' })).toBe('mercearia')
    expect(secaoDoItem({ nome: 'Tomate', secao: null })).toBe('hortifruti')
    expect(secaoDoItem({ nome: 'Tomate' })).toBe('hortifruti')
  })

  it('valor desconhecido na coluna cai de volta no nome', () => {
    expect(secaoDoItem({ nome: 'Tomate', secao: 'jardinagem' })).toBe('hortifruti')
  })
})

describe('agruparPorSecao', () => {
  it('segue a ordem do mercado e pula seção vazia', () => {
    const grupos = agruparPorSecao([{ nome: 'Detergente' }, { nome: 'Tomate' }, { nome: 'Pilha' }, { nome: 'Cebola' }])
    expect(grupos.map((g) => g.secao)).toEqual(['hortifruti', 'limpeza', 'outros'])
    expect(grupos[0]?.itens.map((i) => i.nome)).toEqual(['Tomate', 'Cebola'])
  })

  it('toda seção tem nome para a tela', () => {
    for (const secao of SECOES) expect(NOME_DA_SECAO[secao].length).toBeGreaterThan(2)
  })
})
