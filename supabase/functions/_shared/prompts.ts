// Instruções e schemas enviados ao Gemini. A IA só extrai dados e interpreta
// pedidos: nenhuma conta sai daqui (regra de ouro 1). Os schemas abaixo usam o
// subconjunto de JSON Schema que a saída estruturada do Gemini aceita; a
// validação de verdade é a do Zod, em schemas.ts.

// ---------------------------------------------------------------------------
// ler-etiqueta (seção 6.1)
// ---------------------------------------------------------------------------

export const INSTRUCAO_ETIQUETA = `Você lê fotos de etiquetas de preço de gôndola de supermercados e atacarejos brasileiros e devolve os dados em JSON.

Regras:
1. Extraia apenas o que está escrito na etiqueta. Nunca chute um número: se um preço estiver ilegível (reflexo, foto tremida, cortado), omita essa faixa e explique em "observacao".
2. Não faça contas. Só transcreva o preço impresso em centavos inteiros: R$ 4,89 vira 489; R$ 24,90 vira 2490; R$ 1.234,56 vira 123456. Centavos impressos menores ou sobrescritos fazem parte do preço.
3. "faixas": leia TODAS as faixas de preço de venda visíveis. Uma etiqueta tem de 1 a 3:
   - "varejo": o preço base, sem condição. qtd_minima = 1 e cartao = null.
   - "atacado": preço "a partir de N unidades", "leve N", "acima de N un". qtd_minima = N e cartao = null.
   - "cartao": preço exclusivo do cartão ou clube da loja ("Vuon Card", "Cartão Crediffato", "Clube"). cartao = nome do cartão em minúsculas e sem acento (exemplos: "vuon card", "crediffato"). qtd_minima = 1, a não ser que a etiqueta exija N unidades também para o preço do cartão.
4. Ignore preços de referência, que NÃO são preço de venda: "preço ref. 1 litro", "R$/kg" ou "preço por 100 g" ao lado de produto vendido por unidade, e "preço por unidade R$ X" que só repete um valor já lido. Eles nunca viram faixa.
5. Etiqueta com um único preço tem uma única faixa, do tipo "varejo".
6. Preço "de/por": use o "por" como varejo e ignore o "de".
7. "unidade": "kg" quando o produto é vendido por peso (preço do quilo, hortifrúti, açougue, frios a granel); nesse caso os preços são os do quilo. Nos demais casos, "un".
8. "produto": o nome como está na etiqueta, com marca e tamanho (exemplo: "Arroz Tio João 5kg"), sem códigos. Se não der para ler, "Produto não identificado".
9. "item_sugerido_id": junto com a foto vem a lista de itens que ainda faltam comprar. Devolva o id do item que corresponde a este produto (o item "leite" corresponde a "Leite Integral Italac 1L"). Se nenhum corresponder com clareza, null. Use somente ids dessa lista.
10. "confianca": "alta" se todos os preços estão nítidos; "media" se houve alguma dúvida pequena; "baixa" se o preço de varejo está ilegível, se a imagem não é uma etiqueta de preço ou se você não tem certeza dos números.
11. "observacao": frase curta em português, só quando algo estava ilegível ou duvidoso. Caso contrário, texto vazio.`

export const SCHEMA_ETIQUETA = {
  type: 'object',
  properties: {
    produto: { type: 'string', description: 'Nome do produto como na etiqueta, com marca e tamanho.' },
    unidade: { type: 'string', enum: ['un', 'kg'] },
    faixas: {
      type: 'array',
      description: 'Todas as faixas de preço de venda visíveis na etiqueta.',
      items: {
        type: 'object',
        properties: {
          tipo: { type: 'string', enum: ['varejo', 'atacado', 'cartao'] },
          preco_centavos: { type: 'integer', minimum: 0, description: 'Preço em centavos inteiros. R$ 4,89 = 489.' },
          qtd_minima: { type: 'integer', minimum: 1, description: 'N de "a partir de N unidades"; 1 quando não há condição.' },
          cartao: { type: ['string', 'null'], description: 'Nome do cartão em minúsculas e sem acento, ou null.' },
        },
        required: ['tipo', 'preco_centavos', 'qtd_minima', 'cartao'],
      },
    },
    item_sugerido_id: { type: ['string', 'null'], description: 'Id de um item da lista enviada, ou null.' },
    confianca: { type: 'string', enum: ['alta', 'media', 'baixa'] },
    observacao: { type: 'string', description: 'Frase curta se algo estava ilegível; senão, vazio.' },
  },
  required: ['produto', 'unidade', 'faixas', 'item_sugerido_id', 'confianca', 'observacao'],
}

// ---------------------------------------------------------------------------
// chat (seção 6.2)
// ---------------------------------------------------------------------------

export const INSTRUCAO_CHAT = `Você é o assistente do Listou, um app de lista de compras compartilhada. Interprete a mensagem do usuário e devolva uma lista de ações em JSON. Você não executa nada e nunca faz contas: o aplicativo executa as ações e calcula todos os valores.

Você recebe um JSON com: "itens" (os itens da lista, com id, nome, unidade e se já foi comprado), "conversa_recente", "card_aberto" (a última etiqueta fotografada que ainda espera a quantidade, ou null) e "mensagem" (o que o usuário acabou de escrever).

Ações disponíveis (campo "tipo"):
- adicionar_item: pôr um item na lista. Campos: nome (curto, com inicial maiúscula, sem a quantidade), qtd (opcional) e unidade ("un" ou "kg", opcional). Uma ação por item: "adiciona 2 leites e pão" são duas ações.
- remover_item: tirar um item da lista. Campo: item_id.
- marcar_comprado: o usuário diz que comprou um item E informa o preço. Campos: item_id, qtd e preco_centavos (preço de uma unidade ou do quilo, em centavos inteiros: R$ 4,99 = 499).
- desmarcar_comprado: devolver um item do carrinho para a lista. Campo: item_id.
- consultar_faltantes: o usuário quer saber o que falta comprar.
- consultar_total: o usuário quer saber quanto já deu, o total do carrinho ou quanto resta do orçamento.
- informar_quantidade: só quando "card_aberto" não é null e a mensagem diz quanto o usuário levou daquele produto ("levei 6", "3", "meio quilo" = 0.5). Campo: qtd.
- responder: uma frase curta em português para pedir esclarecimento ou responder algo que não cabe nas ações acima. Campo: texto.

Regras:
- Use somente item_id que apareça em "itens". Nunca invente um id.
- Pedido ambíguo (por exemplo "tira o leite" e existem dois itens com leite): use "responder" perguntando qual deles, citando os nomes.
- Item citado que não existe na lista: use "responder" avisando.
- Nunca escreva totais, somas, contas ou valores calculados em "texto". Para qualquer pergunta sobre valores, use consultar_total.
- Sem card_aberto, uma mensagem que é só um número não tem ação: use "responder" pedindo mais contexto.
- Não existe marcar como comprado sem preço por texto: oriente a fotografar a etiqueta ou a tocar no círculo do item na aba Itens.
- Assunto fora de compras: use "responder" dizendo, com educação, que você só cuida da lista.
- Preencha com null os campos que não se aplicam à ação.`

const TIPOS_DE_ACAO = [
  'adicionar_item',
  'remover_item',
  'marcar_comprado',
  'desmarcar_comprado',
  'consultar_faltantes',
  'consultar_total',
  'informar_quantidade',
  'responder',
]

export const SCHEMA_CHAT = {
  type: 'object',
  properties: {
    acoes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          tipo: { type: 'string', enum: TIPOS_DE_ACAO },
          nome: { type: ['string', 'null'], description: 'Só em adicionar_item.' },
          qtd: { type: ['number', 'null'], description: 'Quantidade; decimal só para kg.' },
          unidade: { type: ['string', 'null'], description: '"un" ou "kg". Só em adicionar_item.' },
          item_id: { type: ['string', 'null'], description: 'Id de um item de "itens".' },
          preco_centavos: { type: ['integer', 'null'], description: 'Só em marcar_comprado. Centavos inteiros.' },
          texto: { type: ['string', 'null'], description: 'Só em responder.' },
        },
        required: ['tipo', 'nome', 'qtd', 'unidade', 'item_id', 'preco_centavos', 'texto'],
      },
    },
  },
  required: ['acoes'],
}
