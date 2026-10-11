import { describe, expect, it } from 'vitest'
import {
  acaoSchema,
  chatEntradaSchema,
  dadosMensagemSchema,
  extracaoSchema,
  interpretarAcoes,
  lerEtiquetaEntradaSchema,
  normalizarExtracao,
  type Extracao,
} from './schemas.ts'

const LISTA = '11111111-1111-4111-8111-111111111111'
const ITEM = '22222222-2222-4222-8222-222222222222'
const FOTO = '33333333-3333-4333-8333-333333333333'

const etiquetaValida = {
  produto: 'Produto X 400g',
  unidade: 'un',
  faixas: [
    { tipo: 'varejo', preco_centavos: 489, qtd_minima: 1, cartao: null },
    { tipo: 'atacado', preco_centavos: 469, qtd_minima: 6, cartao: null },
    { tipo: 'cartao', preco_centavos: 450, qtd_minima: 1, cartao: 'crediffato' },
  ],
  item_sugerido_id: ITEM,
  confianca: 'alta',
  observacao: '',
}

describe('extracaoSchema (resposta do Gemini em ler-etiqueta)', () => {
  it('aceita o exemplo da seção 6.1', () => {
    const lido = extracaoSchema.parse(etiquetaValida)
    expect(lido.faixas).toHaveLength(3)
    expect(lido.item_sugerido_id).toBe(ITEM)
  })

  it('aceita etiqueta simples, sem item sugerido e sem observação', () => {
    const lido = extracaoSchema.parse({
      produto: 'Banana prata',
      unidade: 'kg',
      faixas: [{ tipo: 'varejo', preco_centavos: 599, qtd_minima: 1, cartao: null }],
      item_sugerido_id: null,
      confianca: 'media',
    })
    expect(lido.observacao).toBe('')
  })

  it.each(['produto', 'unidade', 'faixas', 'item_sugerido_id', 'confianca'])('rejeita sem o campo %s', (campo) => {
    const incompleta: Record<string, unknown> = { ...etiquetaValida }
    delete incompleta[campo]
    expect(extracaoSchema.safeParse(incompleta).success).toBe(false)
  })

  it.each(['tipo', 'preco_centavos', 'qtd_minima', 'cartao'])('rejeita faixa sem o campo %s', (campo) => {
    const faixa: Record<string, unknown> = { tipo: 'varejo', preco_centavos: 489, qtd_minima: 1, cartao: null }
    delete faixa[campo]
    expect(extracaoSchema.safeParse({ ...etiquetaValida, faixas: [faixa] }).success).toBe(false)
  })

  const comPreco = (preco: unknown) => ({
    ...etiquetaValida,
    faixas: [{ tipo: 'varejo', preco_centavos: preco, qtd_minima: 1, cartao: null }],
  })

  it('rejeita preço negativo', () => {
    expect(extracaoSchema.safeParse(comPreco(-489)).success).toBe(false)
  })

  it('rejeita preço como string', () => {
    expect(extracaoSchema.safeParse(comPreco('4,89')).success).toBe(false)
    expect(extracaoSchema.safeParse(comPreco('489')).success).toBe(false)
  })

  it('rejeita preço com casas decimais (tem que ser centavo inteiro)', () => {
    expect(extracaoSchema.safeParse(comPreco(4.89)).success).toBe(false)
  })

  it('rejeita quantidade mínima zero, unidade e confiança desconhecidas', () => {
    const faixa = { tipo: 'atacado', preco_centavos: 469, qtd_minima: 0, cartao: null }
    expect(extracaoSchema.safeParse({ ...etiquetaValida, faixas: [faixa] }).success).toBe(false)
    expect(extracaoSchema.safeParse({ ...etiquetaValida, unidade: 'litro' }).success).toBe(false)
    expect(extracaoSchema.safeParse({ ...etiquetaValida, confianca: 'altíssima' }).success).toBe(false)
    expect(extracaoSchema.safeParse({ ...etiquetaValida, item_sugerido_id: 'leite' }).success).toBe(false)
  })
})

describe('normalizarExtracao', () => {
  const base = extracaoSchema.parse(etiquetaValida)

  it('mantém a sugestão só quando o item existe na lista', () => {
    expect(normalizarExtracao(base, [ITEM]).item_sugerido_id).toBe(ITEM)
    expect(normalizarExtracao(base, []).item_sugerido_id).toBeNull()
  })

  it('normaliza o nome do cartão e remove faixas repetidas', () => {
    const lida: Extracao = {
      ...base,
      faixas: [
        { tipo: 'varejo', preco_centavos: 199, qtd_minima: 1, cartao: null },
        { tipo: 'cartao', preco_centavos: 149, qtd_minima: 1, cartao: 'Vuon  Card' },
        { tipo: 'cartao', preco_centavos: 149, qtd_minima: 1, cartao: 'vuon card' },
      ],
    }
    expect(normalizarExtracao(lida, []).faixas).toEqual([
      { tipo: 'varejo', preco_centavos: 199, qtd_minima: 1, cartao: null },
      { tipo: 'cartao', preco_centavos: 149, qtd_minima: 1, cartao: 'vuon card' },
    ])
  })

  it('faixa de cartão sem nome não vira preço para todo mundo', () => {
    const lida: Extracao = {
      ...base,
      faixas: [
        { tipo: 'varejo', preco_centavos: 199, qtd_minima: 1, cartao: null },
        { tipo: 'cartao', preco_centavos: 149, qtd_minima: 1, cartao: null },
      ],
    }
    expect(normalizarExtracao(lida, []).faixas[1]?.cartao).toBe('cartao da loja')
  })

  it('varejo ilegível força confiança baixa', () => {
    const lida: Extracao = {
      ...base,
      faixas: [{ tipo: 'atacado', preco_centavos: 469, qtd_minima: 6, cartao: null }],
    }
    const normal = normalizarExtracao(lida, [])
    expect(normal.confianca).toBe('baixa')
    expect(normal.observacao).not.toBe('')
    expect(normalizarExtracao({ ...base, faixas: [] }, []).confianca).toBe('baixa')
  })

  it('atacado mais caro que o varejo força confiança baixa', () => {
    const lida: Extracao = {
      ...base,
      faixas: [
        { tipo: 'varejo', preco_centavos: 469, qtd_minima: 1, cartao: null },
        { tipo: 'atacado', preco_centavos: 489, qtd_minima: 6, cartao: null },
      ],
    }
    expect(normalizarExtracao(lida, []).confianca).toBe('baixa')
  })

  it('preserva a observação do modelo e a confiança de uma leitura boa', () => {
    const normal = normalizarExtracao({ ...base, observacao: 'reflexo no canto' }, [ITEM])
    expect(normal.confianca).toBe('alta')
    expect(normal.observacao).toBe('reflexo no canto')
  })
})

describe('entradas das funções', () => {
  it('ler-etiqueta aceita foto na pasta da lista', () => {
    expect(lerEtiquetaEntradaSchema.safeParse({ lista_id: LISTA, foto_path: `${LISTA}/${FOTO}.jpg` }).success).toBe(true)
  })

  it('ler-etiqueta rejeita foto de outra lista, caminho torto e campos faltando', () => {
    expect(lerEtiquetaEntradaSchema.safeParse({ lista_id: LISTA, foto_path: `${ITEM}/${FOTO}.jpg` }).success).toBe(false)
    expect(lerEtiquetaEntradaSchema.safeParse({ lista_id: LISTA, foto_path: `${LISTA}/../x.jpg` }).success).toBe(false)
    expect(lerEtiquetaEntradaSchema.safeParse({ lista_id: LISTA, foto_path: `${LISTA}/${FOTO}.png` }).success).toBe(false)
    expect(lerEtiquetaEntradaSchema.safeParse({ lista_id: 'abc', foto_path: `abc/${FOTO}.jpg` }).success).toBe(false)
    expect(lerEtiquetaEntradaSchema.safeParse({ lista_id: LISTA }).success).toBe(false)
  })

  it('chat exige lista e mensagem não vazia', () => {
    expect(chatEntradaSchema.parse({ lista_id: LISTA, mensagem: '  o que falta?  ' }).mensagem).toBe('o que falta?')
    expect(chatEntradaSchema.safeParse({ lista_id: LISTA, mensagem: '   ' }).success).toBe(false)
    expect(chatEntradaSchema.safeParse({ lista_id: LISTA, mensagem: 'x'.repeat(1001) }).success).toBe(false)
    expect(chatEntradaSchema.safeParse({ mensagem: 'oi' }).success).toBe(false)
  })

  it('chat aceita pedido falado no lugar do escrito, nunca os dois nem nenhum', () => {
    const audio = { data: 'UklGRg'.repeat(40), mime_type: 'audio/wav' }
    expect(chatEntradaSchema.safeParse({ lista_id: LISTA, audio }).success).toBe(true)
    expect(chatEntradaSchema.safeParse({ lista_id: LISTA, audio, mensagem: 'oi' }).success).toBe(false)
    expect(chatEntradaSchema.safeParse({ lista_id: LISTA }).success).toBe(false)
  })

  it('chat rejeita áudio que não é base64, tipo desconhecido e áudio grande demais', () => {
    const com = (audio: unknown) => chatEntradaSchema.safeParse({ lista_id: LISTA, audio }).success
    expect(com({ data: 'isto não é base64 !!'.repeat(10), mime_type: 'audio/wav' })).toBe(false)
    expect(com({ data: 'UklGRg'.repeat(40), mime_type: 'video/mp4' })).toBe(false)
    expect(com({ data: 'A'.repeat(1_600_001), mime_type: 'audio/wav' })).toBe(false)
    expect(com({ data: 'UklGRg', mime_type: 'audio/wav' })).toBe(false) // curto demais para ser fala
  })
})

describe('acaoSchema (resposta do Gemini em chat)', () => {
  it.each([
    { tipo: 'adicionar_item', nome: 'Leite', qtd: 2, unidade: 'un' },
    { tipo: 'adicionar_item', nome: 'Pão' },
    { tipo: 'remover_item', item_id: ITEM },
    { tipo: 'marcar_comprado', item_id: ITEM, qtd: 2, preco_centavos: 499 },
    // "peguei o leite": vai para o carrinho sem preço e sem quantidade.
    { tipo: 'marcar_comprado', item_id: ITEM },
    { tipo: 'marcar_comprado', item_id: ITEM, qtd: 2 },
    { tipo: 'desmarcar_comprado', item_id: ITEM },
    { tipo: 'consultar_faltantes' },
    { tipo: 'consultar_total' },
    { tipo: 'informar_quantidade', qtd: 6 },
    { tipo: 'responder', texto: 'Qual dos dois leites?' },
  ])('aceita $tipo', (acao) => {
    expect(acaoSchema.safeParse(acao).success).toBe(true)
  })

  it.each([
    [{ tipo: 'adicionar_item' }, 'sem nome'],
    [{ tipo: 'adicionar_item', nome: '   ' }, 'nome vazio'],
    [{ tipo: 'remover_item' }, 'sem item_id'],
    [{ tipo: 'remover_item', item_id: 'arroz' }, 'item_id que não é uuid'],
    [{ tipo: 'marcar_comprado', item_id: ITEM, qtd: 2, preco_centavos: -499 }, 'preço negativo'],
    [{ tipo: 'marcar_comprado', item_id: ITEM, qtd: 2, preco_centavos: '4,99' }, 'preço como string'],
    [{ tipo: 'marcar_comprado', item_id: ITEM, qtd: 0, preco_centavos: 499 }, 'quantidade zero'],
    [{ tipo: 'informar_quantidade', qtd: -1 }, 'quantidade negativa'],
    [{ tipo: 'responder', texto: '' }, 'texto vazio'],
    [{ tipo: 'apagar_tudo' }, 'ação fora da lista permitida'],
    [{ nome: 'Leite' }, 'sem tipo'],
  ])('rejeita %j (%s)', (acao, _motivo) => {
    expect(acaoSchema.safeParse(acao).success).toBe(false)
  })
})

describe('interpretarAcoes', () => {
  it('ignora os campos que o modelo preenche com null', () => {
    const { acoes, descartadas } = interpretarAcoes({
      acoes: [
        { tipo: 'adicionar_item', nome: 'Leite', qtd: 2, unidade: null, item_id: null, preco_centavos: null, texto: null },
        { tipo: 'consultar_total', nome: null, qtd: null, unidade: null, item_id: null, preco_centavos: null, texto: null },
      ],
    })
    expect(descartadas).toBe(0)
    expect(acoes).toEqual([{ tipo: 'adicionar_item', nome: 'Leite', qtd: 2 }, { tipo: 'consultar_total' }])
  })

  it('descarta só a ação inválida e conta quantas saíram', () => {
    const { acoes, descartadas } = interpretarAcoes({
      acoes: [{ tipo: 'adicionar_item', nome: 'Pão' }, { tipo: 'remover_item', item_id: 'arroz' }, 'lixo'],
    })
    expect(acoes).toEqual([{ tipo: 'adicionar_item', nome: 'Pão' }])
    expect(descartadas).toBe(2)
  })

  it('corta respostas com ações demais', () => {
    const muitas = Array.from({ length: 20 }, (_, i) => ({ tipo: 'adicionar_item', nome: `Item ${i}` }))
    const { acoes, descartadas } = interpretarAcoes({ acoes: muitas })
    expect(acoes).toHaveLength(12)
    expect(descartadas).toBe(8)
  })

  it('devolve a transcrição quando o pedido veio falado', () => {
    const falado = interpretarAcoes({ transcricao: ' Peguei o detergente. ', acoes: [{ tipo: 'marcar_comprado', item_id: ITEM, qtd: null, preco_centavos: null }] })
    expect(falado.transcricao).toBe('Peguei o detergente.')
    expect(falado.acoes).toEqual([{ tipo: 'marcar_comprado', item_id: ITEM }])
    expect(interpretarAcoes({ transcricao: null, acoes: [] }).transcricao).toBeNull()
    expect(interpretarAcoes({ transcricao: '', acoes: [] }).transcricao).toBeNull()
    expect(interpretarAcoes({ acoes: [] }).transcricao).toBeNull()
  })

  it('recusa resposta que não tem a lista de ações', () => {
    expect(() => interpretarAcoes({ resposta: 'oi' })).toThrow()
    expect(() => interpretarAcoes(null)).toThrow()
    expect(() => interpretarAcoes('adicionei o leite')).toThrow()
  })
})

describe('dadosMensagemSchema (payload dos cards)', () => {
  it('aceita card de etiqueta aberto e confirmado', () => {
    const aberto = { tipo: 'etiqueta', estado: 'aberto', foto_path: `${LISTA}/${FOTO}.jpg`, extracao: etiquetaValida }
    expect(dadosMensagemSchema.safeParse(aberto).success).toBe(true)
    const confirmado = {
      ...aberto,
      estado: 'confirmado',
      resultado: {
        nome: 'Produto X 400g',
        unidade: 'un',
        qtd: 6,
        preco_unit_centavos: 469,
        faixa_aplicada: 'atacado',
        cartao: null,
        total_centavos: 2814,
      },
    }
    expect(dadosMensagemSchema.safeParse(confirmado).success).toBe(true)
  })

  it('aceita proposta e rejeita proposta vazia', () => {
    const proposta = {
      tipo: 'proposta',
      estado: 'pendente',
      acoes: [{ tipo: 'remover_item', item_id: ITEM, nome: 'Arroz' }],
    }
    expect(dadosMensagemSchema.safeParse(proposta).success).toBe(true)
    expect(dadosMensagemSchema.safeParse({ ...proposta, acoes: [] }).success).toBe(false)
  })
})
