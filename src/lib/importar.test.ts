import { describe, expect, it } from 'vitest'
import { interpretarLista, MAX_ITENS_IMPORTADOS, semOsQueJaEstao } from './importar'

const ler = (texto: string) => interpretarLista(texto).itens

describe('interpretarLista', () => {
  it('uma linha, um item, com a inicial maiúscula', () => {
    expect(ler('arroz\nfeijão\n\n  café  ')).toEqual([
      { nome: 'Arroz', qtd: null, unidade: 'un' },
      { nome: 'Feijão', qtd: null, unidade: 'un' },
      { nome: 'Café', qtd: null, unidade: 'un' },
    ])
  })

  it('vírgula e ponto e vírgula também separam, menos a vírgula decimal', () => {
    expect(ler('leite, pão,café; 1,5 kg de carne').map((i) => i.nome)).toEqual(['Leite', 'Pão', 'Café', 'Carne'])
    expect(ler('1,5 kg de carne')).toEqual([{ nome: 'Carne', qtd: 1.5, unidade: 'kg' }])
  })

  it('tira marcadores de lista e a formatação do WhatsApp', () => {
    const texto = '- arroz\n• feijão\n* café\n1. açúcar\n2) sal\n[ ] leite\n[x] pão\n✅ ovos\n*manteiga*\n_queijo_'
    expect(ler(texto).map((i) => i.nome)).toEqual(['Arroz', 'Feijão', 'Café', 'Açúcar', 'Sal', 'Leite', 'Pão', 'Ovos', 'Manteiga', 'Queijo'])
  })

  it('pula título e linha sem letra', () => {
    expect(ler('Compras da semana:\n*Mercado:*\narroz\n---\n123').map((i) => i.nome)).toEqual(['Arroz'])
  })

  it.each([
    ['2 leite', { nome: 'Leite', qtd: 2, unidade: 'un' }],
    ['2x leite', { nome: 'Leite', qtd: 2, unidade: 'un' }],
    ['3 un de sabonete', { nome: 'Sabonete', qtd: 3, unidade: 'un' }],
    ['12 ovos', { nome: 'Ovos', qtd: 12, unidade: 'un' }],
    ['2 kg de batata', { nome: 'Batata', qtd: 2, unidade: 'kg' }],
    ['1,5kg carne moída', { nome: 'Carne moída', qtd: 1.5, unidade: 'kg' }],
    ['500g de queijo', { nome: 'Queijo', qtd: 0.5, unidade: 'kg' }],
    ['leite x2', { nome: 'Leite', qtd: 2, unidade: 'un' }],
    ['Leite 1L x 6', { nome: 'Leite 1L', qtd: 6, unidade: 'un' }],
    ['leite (2)', { nome: 'Leite', qtd: 2, unidade: 'un' }],
    ['leite: 2', { nome: 'Leite', qtd: 2, unidade: 'un' }],
    ['pão de queijo - 2 un', { nome: 'Pão de queijo', qtd: 2, unidade: 'un' }],
  ] as const)('lê a quantidade em "%s"', (linha, esperado) => {
    expect(ler(linha)).toEqual([esperado])
  })

  it.each(['Arroz 5kg', 'Coca-Cola 2L', 'Detergente 500ml', 'Max 3', 'Sabão em pó OMO 1,6kg'])(
    'tamanho de embalagem fica no nome: "%s"',
    (linha) => {
      expect(ler(linha)).toEqual([{ nome: linha, qtd: null, unidade: 'un' }])
    },
  )

  it('número quebrado sem unidade de peso não vira quantidade', () => {
    expect(ler('1,5 leite')).toEqual([{ nome: '1,5 leite', qtd: null, unidade: 'un' }])
  })

  it('nome repetido entra uma vez, sem ligar para acento e maiúscula', () => {
    const lido = interpretarLista('Café\ncafe\nCAFÉ\nleite')
    expect(lido.itens.map((i) => i.nome)).toEqual(['Café', 'Leite'])
    expect(lido.repetidos).toBe(2)
  })

  it('corta listas enormes e diz quantos ficaram de fora', () => {
    const texto = Array.from({ length: MAX_ITENS_IMPORTADOS + 7 }, (_, i) => `item numero ${i + 1}`).join('\n')
    const lido = interpretarLista(texto)
    expect(lido.itens).toHaveLength(MAX_ITENS_IMPORTADOS)
    expect(lido.cortados).toBe(7)
  })

  it('texto vazio ou só com sujeira não gera item', () => {
    expect(interpretarLista('').itens).toEqual([])
    expect(interpretarLista('\n - \n • \n ,,, ').itens).toEqual([])
  })
})

describe('semOsQueJaEstao', () => {
  it('tira o que já está na lista esperando compra', () => {
    const novos = [{ nome: 'Café' }, { nome: 'Leite' }, { nome: 'ARROZ' }]
    expect(semOsQueJaEstao(novos, ['cafe', 'Arroz'])).toEqual({ entram: [{ nome: 'Leite' }], jaEstavam: 2 })
  })
})
