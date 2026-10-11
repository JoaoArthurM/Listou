import { describe, expect, it } from 'vitest'
import { PROBLEMAS, problemasDaLeitura, textoDoProblema, travaPreco } from './leitura.ts'
import {
  acaoSchema,
  chatEntradaSchema,
  dadosMensagemSchema,
  extracaoSchema,
  interpretarAcoes,
  leituraSchema,
  lerEtiquetaEntradaSchema,
  validarLeitura,
  type Leitura,
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

describe('leituraSchema (resposta do Gemini em ler-etiqueta)', () => {
  it('aceita o exemplo da seção 6.1', () => {
    const lido = leituraSchema.parse(etiquetaValida)
    expect(lido.faixas).toHaveLength(3)
    expect(lido.item_sugerido_id).toBe(ITEM)
    expect(lido.nao_lido).toEqual([])
  })

  it('aceita etiqueta simples, sem item sugerido e sem observação', () => {
    const lido = leituraSchema.parse({
      produto: 'Banana prata',
      unidade: 'kg',
      faixas: [{ tipo: 'varejo', preco_centavos: 599, qtd_minima: 1, cartao: null }],
      item_sugerido_id: null,
      confianca: 'media',
    })
    expect(lido.observacao).toBe('')
  })

  it('aceita nome não lido (null) e a lista do que ficou sem ler', () => {
    const lido = leituraSchema.parse({ ...etiquetaValida, produto: null, nao_lido: ['produto', 'preco_cartao'] })
    expect(lido.produto).toBeNull()
    expect(lido.nao_lido).toEqual(['produto', 'preco_cartao'])
  })

  it('valor desconhecido em nao_lido continua contando como dúvida', () => {
    expect(leituraSchema.parse({ ...etiquetaValida, nao_lido: ['codigo_de_barras'] }).nao_lido).toEqual(['outro'])
  })

  it.each(['produto', 'unidade', 'faixas', 'item_sugerido_id', 'confianca'])('rejeita sem o campo %s', (campo) => {
    const incompleta: Record<string, unknown> = { ...etiquetaValida }
    delete incompleta[campo]
    expect(leituraSchema.safeParse(incompleta).success).toBe(false)
  })

  it.each(['tipo', 'preco_centavos', 'qtd_minima', 'cartao'])('rejeita faixa sem o campo %s', (campo) => {
    const faixa: Record<string, unknown> = { tipo: 'varejo', preco_centavos: 489, qtd_minima: 1, cartao: null }
    delete faixa[campo]
    expect(leituraSchema.safeParse({ ...etiquetaValida, faixas: [faixa] }).success).toBe(false)
  })

  const comPreco = (preco: unknown) => ({
    ...etiquetaValida,
    faixas: [{ tipo: 'varejo', preco_centavos: preco, qtd_minima: 1, cartao: null }],
  })

  it('rejeita preço negativo', () => {
    expect(leituraSchema.safeParse(comPreco(-489)).success).toBe(false)
  })

  it('rejeita preço como string', () => {
    expect(leituraSchema.safeParse(comPreco('4,89')).success).toBe(false)
    expect(leituraSchema.safeParse(comPreco('489')).success).toBe(false)
  })

  it('rejeita preço com casas decimais (tem que ser centavo inteiro)', () => {
    expect(leituraSchema.safeParse(comPreco(4.89)).success).toBe(false)
  })

  it('rejeita quantidade mínima zero, unidade e confiança desconhecidas', () => {
    const faixa = { tipo: 'atacado', preco_centavos: 469, qtd_minima: 0, cartao: null }
    expect(leituraSchema.safeParse({ ...etiquetaValida, faixas: [faixa] }).success).toBe(false)
    expect(leituraSchema.safeParse({ ...etiquetaValida, unidade: 'litro' }).success).toBe(false)
    expect(leituraSchema.safeParse({ ...etiquetaValida, confianca: 'altíssima' }).success).toBe(false)
    expect(leituraSchema.safeParse({ ...etiquetaValida, item_sugerido_id: 'leite' }).success).toBe(false)
  })
})

describe('validarLeitura (nada é presumido: o que falta vira problema)', () => {
  const base = leituraSchema.parse(etiquetaValida)
  const varejo = { tipo: 'varejo', preco_centavos: 199, qtd_minima: 1, cartao: null } as const
  const validar = (mudanca: Partial<Leitura>) => validarLeitura({ ...base, ...mudanca }, [ITEM])

  it('leitura completa passa sem problema nenhum', () => {
    const boa = validar({ observacao: 'reflexo no canto' })
    expect(boa.problemas).toEqual([])
    expect(boa.confianca).toBe('alta')
    expect(boa.produto).toBe('Produto X 400g')
    expect(boa.observacao).toBe('reflexo no canto')
    expect(travaPreco(boa.problemas)).toBe(false)
  })

  it('mantém a sugestão só quando o item existe na lista', () => {
    expect(validarLeitura(base, [ITEM]).item_sugerido_id).toBe(ITEM)
    expect(validarLeitura(base, []).item_sugerido_id).toBeNull()
  })

  it('normaliza o nome do cartão e remove faixas repetidas', () => {
    const lida = validar({
      faixas: [
        varejo,
        { tipo: 'cartao', preco_centavos: 149, qtd_minima: 1, cartao: 'Vuon  Card' },
        { tipo: 'cartao', preco_centavos: 149, qtd_minima: 1, cartao: 'vuon card' },
      ],
    })
    expect(lida.faixas).toEqual([varejo, { tipo: 'cartao', preco_centavos: 149, qtd_minima: 1, cartao: 'vuon card' }])
    expect(lida.problemas).toEqual([])
  })

  it.each([null, '', 'Produto não identificado', 'ILEGÍVEL', 'X'])('nome %j não é nome: fica null e vira problema', (produto) => {
    const lida = validar({ produto })
    expect(lida.produto).toBeNull()
    expect(lida.problemas).toEqual(['sem_nome'])
    // Só o nome faltou: o preço continua valendo.
    expect(lida.confianca).toBe('alta')
    expect(travaPreco(lida.problemas)).toBe(false)
  })

  it('nome que o modelo disse não ter lido é descartado, mesmo preenchido', () => {
    const lida = validar({ produto: 'Arroz Tio Jo', nao_lido: ['produto'] })
    expect(lida.produto).toBeNull()
    expect(lida.problemas).toEqual(['sem_nome'])
  })

  it('sem varejo (omitido, zerado ou declarado ilegível) o preço trava', () => {
    const soAtacado = validar({ faixas: [{ tipo: 'atacado', preco_centavos: 469, qtd_minima: 6, cartao: null }] })
    expect(soAtacado.problemas).toEqual(['sem_preco'])
    expect(soAtacado.confianca).toBe('baixa')

    const zerado = validar({ faixas: [{ ...varejo, preco_centavos: 0 }] })
    expect(zerado.problemas).toEqual(['sem_preco'])
    expect(zerado.faixas).toEqual([])

    const declarado = validar({ faixas: [varejo], nao_lido: ['preco_varejo'] })
    expect(declarado.problemas).toEqual(['sem_preco'])
    expect(travaPreco(declarado.problemas)).toBe(true)
  })

  it('faixa de cartão sem o nome do cartão não entra: vira problema', () => {
    const lida = validar({ faixas: [varejo, { tipo: 'cartao', preco_centavos: 149, qtd_minima: 1, cartao: null }] })
    expect(lida.faixas).toEqual([varejo])
    expect(lida.problemas).toEqual(['cartao_ilegivel'])
    expect(lida.confianca).toBe('baixa')
  })

  it('atacado sem quantidade mínima não entra: vira problema', () => {
    const lida = validar({ faixas: [varejo, { tipo: 'atacado', preco_centavos: 189, qtd_minima: 1, cartao: null }] })
    expect(lida.faixas).toEqual([varejo])
    expect(lida.problemas).toEqual(['atacado_ilegivel'])
  })

  it('o que o modelo declarou não ter lido vira o problema correspondente', () => {
    expect(validar({ faixas: [varejo], nao_lido: ['preco_atacado'] }).problemas).toEqual(['atacado_ilegivel'])
    expect(validar({ faixas: [varejo], nao_lido: ['qtd_minima'] }).problemas).toEqual(['atacado_ilegivel'])
    expect(validar({ faixas: [varejo], nao_lido: ['preco_cartao'] }).problemas).toEqual(['cartao_ilegivel'])
    expect(validar({ faixas: [varejo], nao_lido: ['nome_cartao'] }).problemas).toEqual(['cartao_ilegivel'])
    expect(validar({ faixas: [varejo], nao_lido: ['unidade'] }).problemas).toEqual(['unidade_incerta'])
    expect(validar({ faixas: [varejo], nao_lido: ['outro'] }).problemas).toEqual(['leitura_duvidosa'])
  })

  it('preços que não batem entre si travam o cálculo', () => {
    const atacadoMaisCaro = validar({ faixas: [{ ...varejo, preco_centavos: 469 }, { tipo: 'atacado', preco_centavos: 489, qtd_minima: 6, cartao: null }] })
    expect(atacadoMaisCaro.problemas).toEqual(['precos_incoerentes'])
    expect(atacadoMaisCaro.confianca).toBe('baixa')

    const doisVarejos = validar({ faixas: [varejo, { ...varejo, preco_centavos: 799 }] })
    expect(doisVarejos.problemas).toEqual(['precos_incoerentes'])
  })

  it('confiança baixa sem explicação vira dúvida; média com tudo lido não trava', () => {
    const baixa = validar({ faixas: [varejo], confianca: 'baixa' })
    expect(baixa.problemas).toEqual(['leitura_duvidosa'])
    expect(baixa.confianca).toBe('baixa')

    const media = validar({ faixas: [varejo], confianca: 'media' })
    expect(media.problemas).toEqual([])
    expect(media.confianca).toBe('media')
  })

  it('confiança baixa explicada só pelo nome não põe o preço em dúvida', () => {
    const lida = validar({ produto: null, faixas: [varejo], confianca: 'baixa', nao_lido: ['produto'] })
    expect(lida.problemas).toEqual(['sem_nome'])
    expect(travaPreco(lida.problemas)).toBe(false)
    expect(lida.faixas).toEqual([varejo])
  })

  it('foto que não é etiqueta: nenhum dado sai, só o problema', () => {
    const declarada = validar({ nao_lido: ['etiqueta'] })
    expect(declarada).toMatchObject({ produto: null, faixas: [], item_sugerido_id: null, problemas: ['sem_etiqueta'] })

    const vazia = validar({ produto: null, faixas: [] })
    expect(vazia.problemas).toEqual(['sem_etiqueta'])
  })

  it('junta vários problemas, na ordem fixa', () => {
    const lida = validar({ produto: null, faixas: [varejo], nao_lido: ['preco_atacado', 'unidade'] })
    expect(lida.problemas).toEqual(['sem_nome', 'atacado_ilegivel', 'unidade_incerta'])
    expect(lida.confianca).toBe('baixa')
  })

  it('o resultado cabe no schema do card', () => {
    const lida = validar({ produto: null, faixas: [varejo], nao_lido: ['preco_cartao'] })
    expect(extracaoSchema.parse(lida)).toEqual(lida)
  })

  it('todo problema tem um texto para a tela', () => {
    for (const problema of PROBLEMAS) expect(textoDoProblema(problema).length).toBeGreaterThan(10)
  })

  it('card antigo (sem a lista de problemas) com confiança baixa continua pedindo o preço', () => {
    expect(problemasDaLeitura({ confianca: 'baixa' })).toEqual(['leitura_duvidosa'])
    expect(problemasDaLeitura({ confianca: 'alta' })).toEqual([])
    expect(problemasDaLeitura({ confianca: 'baixa', problemas: ['sem_preco'] })).toEqual(['sem_preco'])
    // Card novo: vale a lista. Faltar só o nome não vira dúvida no preço.
    expect(problemasDaLeitura({ confianca: 'baixa', problemas: ['sem_nome'] })).toEqual(['sem_nome'])
    expect(extracaoSchema.parse(etiquetaValida).problemas).toEqual([])
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

  it('aceita item novo com preço dito ("ovo 12,30 1 caixa")', () => {
    const { acoes, descartadas } = interpretarAcoes({
      acoes: [{ tipo: 'adicionar_item', nome: 'Ovo', qtd: 1, unidade: 'un', item_id: null, preco_centavos: 1230, texto: null }],
    })
    expect(descartadas).toBe(0)
    expect(acoes).toEqual([{ tipo: 'adicionar_item', nome: 'Ovo', qtd: 1, unidade: 'un', preco_centavos: 1230 }])
  })

  it('aceita a consulta do que já está no carrinho', () => {
    expect(acaoSchema.safeParse({ tipo: 'consultar_comprados' }).success).toBe(true)
  })

  it('rejeita preço negativo em item novo', () => {
    expect(acaoSchema.safeParse({ tipo: 'adicionar_item', nome: 'Ovo', preco_centavos: -1 }).success).toBe(false)
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
