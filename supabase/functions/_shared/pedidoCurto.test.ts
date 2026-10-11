import { describe, expect, it } from 'vitest'
import { lerPedidoCurto } from './pedidoCurto.ts'

describe('lerPedidoCurto', () => {
  it.each([
    ['ovo 12.30 1 caixa', { nome: 'Ovo', qtd: 1, unidade: 'un', preco_centavos: 1230 }],
    ['batata 12,30 1 caixa', { nome: 'Batata', qtd: 1, unidade: 'un', preco_centavos: 1230 }],
    ['alface 12.30 1 unidade', { nome: 'Alface', qtd: 1, unidade: 'un', preco_centavos: 1230 }],
    ['arroz 22,90 2', { nome: 'Arroz', qtd: 2, unidade: 'un', preco_centavos: 2290 }],
    ['pão de queijo 8,50 3', { nome: 'Pão de queijo', qtd: 3, unidade: 'un', preco_centavos: 850 }],
    ['Coca-Cola 2L 9,90 2', { nome: 'Coca-Cola 2L', qtd: 2, unidade: 'un', preco_centavos: 990 }],
    ['café R$ 18,00 1', { nome: 'Café', qtd: 1, unidade: 'un', preco_centavos: 1800 }],
    ['sabonete R$5 6', { nome: 'Sabonete', qtd: 6, unidade: 'un', preco_centavos: 500 }],
    ['tomate 8,90 1,5 kg', { nome: 'Tomate', qtd: 1.5, unidade: 'kg', preco_centavos: 890 }],
    ['queijo 39,90 500g', { nome: 'Queijo', qtd: 0.5, unidade: 'kg', preco_centavos: 3990 }],
  ])('lê "%s"', (texto, esperado) => {
    expect(lerPedidoCurto(texto)).toEqual({ tipo: 'adicionar_item', ...esperado })
  })

  it.each([
    'ovo 12,30', // sem quantidade: a IA pergunta
    'ovo 1 caixa', // sem preço
    'peguei ovo 12,30 1', // conversa, não formato curto
    'acabei de pegar dois sapatos por 15 reais cada',
    'o que falta?',
    'arroz 5 22,90 2', // dois inteiros: ambíguo
    'arroz 22,90 24,90 2', // dois preços
    'ovo 1,5 3', // 1,5 sem kg não é quantidade nem preço
    'leite 2',
    '',
  ])('deixa "%s" para a IA', (texto) => {
    expect(lerPedidoCurto(texto)).toBeNull()
  })
})
