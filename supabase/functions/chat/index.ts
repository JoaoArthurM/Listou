// chat (CLAUDE.md, seção 6.2): o Gemini interpreta a mensagem e devolve
// ações estruturadas; esta função valida (Zod) e executa. A IA não escreve no
// banco e não faz conta: totais vêm do banco, e a escolha da faixa de preço
// vem de precos.ts.
//
// - Adicionar item e consultas rodam na hora.
// - Remover, desmarcar e marcar com preço voltam como proposta, que só é
//   aplicada quando alguém confirma no app.

import { autenticar, type Contexto } from '../_shared/auth.ts'
import { formatarQuantidade, formatarReais, type Unidade } from '../_shared/dinheiro.ts'
import { gerarJson, registrarUso, type RespostaGemini } from '../_shared/gemini.ts'
import { cors, emSegundoPlano, erro, json } from '../_shared/http.ts'
import { calcularCompra, cartoesDesconhecidos, linhaCalculo, nomeCartao, normalizarCartao } from '../_shared/precos.ts'
import { INSTRUCAO_CHAT, SCHEMA_CHAT } from '../_shared/prompts.ts'
import {
  chatEntradaSchema,
  dadosEtiquetaSchema,
  interpretarAcoes,
  type Acao,
  type AcaoProposta,
  type DadosEtiqueta,
  type DadosProposta,
} from '../_shared/schemas.ts'

type Lista = {
  id: string
  status: string
  orcamento_centavos: number | null
  cartoes: string[]
  cartoes_recusados: string[]
}
type ItemDaLista = { id: string; nome: string; unidade: Unidade; comprado: boolean; qtd_planejada: number | null }

const MENSAGENS_DE_CONTEXTO = 10
const IA_FORA = 'Não consegui falar com a IA agora. Tente de novo em instantes.'

const frase = (texto: string) => (/[.!?…]$/.test(texto) ? texto : `${texto}.`)
const comInicialMaiuscula = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1)

function comQuantidade(item: { nome: string; unidade: Unidade; qtd_planejada: number | null }): string {
  if (item.qtd_planejada === null) return item.nome
  return `${item.nome} (${formatarQuantidade(item.qtd_planejada, item.unidade)}${item.unidade === 'un' ? ' un' : ''})`
}

async function responder(ctx: Contexto, listaId: string, texto: string, tipo: 'texto' | 'sistema' = 'texto') {
  const { error } = await ctx.admin.from('mensagens').insert({ lista_id: listaId, papel: 'assistente', tipo, conteudo: texto })
  if (error) throw error
}

/** "levei 6": aplica a quantidade ao último card de etiqueta aberto (seção 7.2, passo 5). */
async function aplicarQuantidade(
  ctx: Contexto,
  lista: Lista,
  itens: ItemDaLista[],
  card: { id: string; dados: DadosEtiqueta } | null,
  qtd: number,
): Promise<string> {
  if (!card) return 'Não há etiqueta esperando quantidade. Fotografe a etiqueta primeiro.'
  const { extracao } = card.dados
  if (extracao.unidade === 'un' && !Number.isInteger(qtd)) return 'Esse produto é vendido por unidade: diga um número inteiro.'
  if (extracao.confianca === 'baixa') return 'Não li bem o preço dessa etiqueta. Informe o preço no card dela.'

  const [pendente] = cartoesDesconhecidos(extracao.faixas, lista.cartoes, lista.cartoes_recusados)
  if (pendente) return `Antes, responda no card: vocês têm o cartão ${nomeCartao(pendente)}?`

  const compra = calcularCompra(extracao.faixas, qtd, lista.cartoes)
  if (!compra) return 'Para essa quantidade nenhum preço da etiqueta vale. Informe o preço no card dela.'

  const compraDoItem = {
    comprado: true,
    unidade: extracao.unidade,
    faixas_preco: extracao.faixas,
    faixa_aplicada: compra.faixa.tipo,
    preco_unit_centavos: compra.faixa.preco_centavos,
    qtd_comprada: qtd,
    origem_preco: 'ia',
    foto_path: card.dados.foto_path,
  }

  // Grava com o token do usuário: o gatilho do banco carimba "comprado_por" com quem falou.
  const sugerido = itens.find((i) => i.id === extracao.item_sugerido_id && !i.comprado)
  let itemId: string
  let nome: string
  if (sugerido) {
    const { error } = await ctx.doUsuario.from('itens').update(compraDoItem).eq('id', sugerido.id)
    if (error) throw error
    itemId = sugerido.id
    nome = sugerido.nome
  } else {
    const { data, error } = await ctx.doUsuario
      .from('itens')
      .insert({ lista_id: lista.id, nome: extracao.produto, ...compraDoItem })
      .select('id')
      .single()
    if (error) throw error
    itemId = data.id
    nome = extracao.produto
  }

  const fechado: DadosEtiqueta = {
    ...card.dados,
    estado: 'confirmado',
    resultado: {
      nome,
      unidade: extracao.unidade,
      qtd,
      preco_unit_centavos: compra.faixa.preco_centavos,
      faixa_aplicada: compra.faixa.tipo,
      cartao: compra.faixa.cartao,
      total_centavos: compra.total_centavos,
    },
  }
  const { error } = await ctx.doUsuario.from('mensagens').update({ dados: fechado, item_id: itemId }).eq('id', card.id)
  if (error) throw error

  return `${nome}: ${linhaCalculo(qtd, extracao.unidade, compra.faixa.preco_centavos, compra.faixa.tipo, compra.faixa.cartao)}.`
}

/** Total e orçamento, sempre lidos do banco (nunca um número vindo da IA). */
async function textoDoTotal(ctx: Contexto, lista: Lista): Promise<string> {
  const { data, error } = await ctx.doUsuario
    .from('lista_totais')
    .select('total_centavos, itens_comprados, itens_total')
    .eq('lista_id', lista.id)
    .maybeSingle()
  if (error) throw error
  if (!data || !data.itens_total) return 'A lista ainda está vazia.'

  const total = data.total_centavos ?? 0
  let texto = `Carrinho: ${formatarReais(total)}, com ${data.itens_comprados} de ${data.itens_total} ${data.itens_total === 1 ? 'item' : 'itens'}.`
  if (lista.orcamento_centavos !== null) {
    const saldo = lista.orcamento_centavos - total
    texto +=
      saldo >= 0
        ? ` Restam ${formatarReais(saldo)} do orçamento de ${formatarReais(lista.orcamento_centavos)}.`
        : ` Passou ${formatarReais(-saldo)} do orçamento de ${formatarReais(lista.orcamento_centavos)}.`
  }
  return texto
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return erro('Método não permitido.', 405)

  try {
    const ctx = await autenticar(req)
    if (ctx instanceof Response) return ctx

    const entrada = chatEntradaSchema.safeParse(await req.json().catch(() => null))
    if (!entrada.success) return erro('Mensagem inválida.', 400)
    const { lista_id, mensagem } = entrada.data

    // Só membro enxerga a lista (RLS, com o token do usuário).
    const { data: lista, error: erroLista } = await ctx.doUsuario
      .from('listas')
      .select('id, status, orcamento_centavos, cartoes, cartoes_recusados')
      .eq('id', lista_id)
      .maybeSingle<Lista>()
    if (erroLista) throw erroLista
    if (!lista) return erro('Você não participa desta lista.', 403)
    if (lista.status !== 'ativa') return erro('Esta compra já foi finalizada. Reabra a lista para continuar.', 409)

    // Contexto mínimo para o modelo: itens, as últimas mensagens e o card aberto.
    const [consultaItens, consultaHistorico, consultaCard] = await Promise.all([
      ctx.doUsuario.from('itens').select('id, nome, unidade, comprado, qtd_planejada').eq('lista_id', lista_id).order('criado_em'),
      ctx.doUsuario
        .from('mensagens')
        .select('papel, conteudo')
        .eq('lista_id', lista_id)
        .order('criado_em', { ascending: false })
        .limit(MENSAGENS_DE_CONTEXTO),
      ctx.doUsuario
        .from('mensagens')
        .select('id, dados')
        .eq('lista_id', lista_id)
        .eq('tipo', 'confirmacao')
        .eq('dados->>tipo', 'etiqueta')
        .eq('dados->>estado', 'aberto')
        .order('criado_em', { ascending: false })
        .limit(1),
    ])
    if (consultaItens.error) throw consultaItens.error
    if (consultaHistorico.error) throw consultaHistorico.error
    if (consultaCard.error) throw consultaCard.error

    const itens = consultaItens.data as ItemDaLista[]
    const dadosDoCard = dadosEtiquetaSchema.safeParse(consultaCard.data[0]?.dados)
    const card = dadosDoCard.success ? { id: consultaCard.data[0]!.id as string, dados: dadosDoCard.data } : null

    // A mensagem do usuário entra na conversa antes da chamada à IA: se a IA
    // falhar, ela continua lá, seguida do aviso.
    const { error: erroMensagem } = await ctx.doUsuario
      .from('mensagens')
      .insert({ lista_id, autor_id: ctx.usuarioId, papel: 'usuario', tipo: 'texto', conteudo: mensagem })
    if (erroMensagem) throw erroMensagem

    let resposta: RespostaGemini
    try {
      resposta = await gerarJson({
        instrucao: INSTRUCAO_CHAT,
        entrada: [
          {
            type: 'text',
            text: JSON.stringify({
              itens: itens.map(({ id, nome, unidade, comprado }) => ({ id, nome, unidade, comprado })),
              conversa_recente: consultaHistorico.data.reverse().map((m) => ({ de: m.papel, texto: m.conteudo })),
              card_aberto: card ? { produto: card.dados.extracao.produto, unidade: card.dados.extracao.unidade } : null,
              mensagem,
            }),
          },
        ],
        schema: SCHEMA_CHAT,
      })
    } catch (e) {
      console.error('chat: gemini falhou', e)
      await responder(ctx, lista_id, IA_FORA, 'sistema')
      return json({ ok: false })
    }
    emSegundoPlano(registrarUso(ctx.admin, lista_id, 'chat', resposta))

    let acoes: Acao[]
    let naoEntendidas: number
    try {
      const lidas = interpretarAcoes(resposta.json)
      acoes = lidas.acoes
      naoEntendidas = lidas.descartadas
    } catch (e) {
      console.error('chat: resposta fora do schema', e)
      await responder(ctx, lista_id, 'Não entendi o pedido. Pode dizer de outro jeito?')
      return json({ ok: false })
    }

    const porId = new Map(itens.map((i) => [i.id, i]))
    const novos: Array<{ lista_id: string; nome: string; unidade: Unidade; qtd_planejada: number | null }> = []
    const repetidos: string[] = []
    const propostas: AcaoProposta[] = []
    const avisos: string[] = []
    const falas: string[] = []
    let qtdDoCard: number | null = null
    let querFaltantes = false
    let querTotal = false

    for (const acao of acoes) {
      switch (acao.tipo) {
        case 'adicionar_item': {
          const nome = comInicialMaiuscula(acao.nome)
          const chave = normalizarCartao(nome) // mesma normalização: minúsculas, sem acento
          const repetido =
            itens.find((i) => !i.comprado && normalizarCartao(i.nome) === chave)?.nome ??
            novos.find((n) => normalizarCartao(n.nome) === chave)?.nome
          if (repetido) {
            repetidos.push(repetido)
            break
          }
          const unidade = acao.unidade ?? 'un'
          const qtd = acao.qtd !== undefined && (unidade === 'kg' || Number.isInteger(acao.qtd)) ? acao.qtd : null
          novos.push({ lista_id, nome, unidade, qtd_planejada: qtd })
          break
        }
        case 'remover_item': {
          const item = porId.get(acao.item_id)
          if (item) propostas.push({ tipo: 'remover_item', item_id: item.id, nome: item.nome })
          else naoEntendidas += 1
          break
        }
        case 'desmarcar_comprado': {
          const item = porId.get(acao.item_id)
          if (!item) naoEntendidas += 1
          else if (!item.comprado) avisos.push(`“${item.nome}” ainda não está no carrinho.`)
          else propostas.push({ tipo: 'desmarcar_comprado', item_id: item.id, nome: item.nome })
          break
        }
        case 'marcar_comprado': {
          const item = porId.get(acao.item_id)
          if (!item) naoEntendidas += 1
          else if (item.unidade === 'un' && !Number.isInteger(acao.qtd)) {
            avisos.push(`“${item.nome}” é vendido por unidade: diga um número inteiro.`)
          } else {
            propostas.push({
              tipo: 'marcar_comprado',
              item_id: item.id,
              nome: item.nome,
              unidade: item.unidade,
              qtd: acao.qtd,
              preco_centavos: acao.preco_centavos,
            })
          }
          break
        }
        case 'informar_quantidade':
          qtdDoCard = acao.qtd
          break
        case 'consultar_faltantes':
          querFaltantes = true
          break
        case 'consultar_total':
          querTotal = true
          break
        case 'responder':
          falas.push(frase(acao.texto))
          break
      }
    }

    // Execução, na ordem em que a resposta será lida.
    const linhas: string[] = []

    if (novos.length > 0) {
      const { error } = await ctx.doUsuario.from('itens').insert(novos)
      if (error) throw error
      linhas.push(`Adicionei: ${novos.map(comQuantidade).join(', ')}.`)
    }
    if (repetidos.length > 0) linhas.push(`Já ${repetidos.length === 1 ? 'estava' : 'estavam'} na lista: ${repetidos.join(', ')}.`)

    if (qtdDoCard !== null) linhas.push(await aplicarQuantidade(ctx, lista, itens, card, qtdDoCard))

    linhas.push(...avisos)

    if (querFaltantes) {
      // Depois das inclusões e da compra acima, para a resposta já refleti-las.
      const { data, error } = await ctx.doUsuario
        .from('itens')
        .select('nome, unidade, qtd_planejada, comprado')
        .eq('lista_id', lista_id)
        .order('criado_em')
      if (error) throw error
      const faltando = (data as ItemDaLista[]).filter((i) => !i.comprado)
      if (data.length === 0) linhas.push('A lista ainda está vazia.')
      else if (faltando.length === 0) linhas.push('Não falta nada: está tudo no carrinho.')
      else linhas.push(`Falta comprar (${faltando.length}): ${faltando.map(comQuantidade).join(', ')}.`)
    }

    if (querTotal) linhas.push(await textoDoTotal(ctx, lista))

    linhas.push(...falas)

    if (naoEntendidas > 0) {
      linhas.push(linhas.length > 0 || propostas.length > 0 ? 'Uma parte do pedido eu não entendi.' : 'Não entendi o pedido. Pode dizer de outro jeito?')
    }
    if (linhas.length === 0 && propostas.length === 0) linhas.push('Não entendi o pedido. Pode dizer de outro jeito?')

    if (linhas.length > 0) await responder(ctx, lista_id, linhas.join('\n'))

    if (propostas.length > 0) {
      const dados: DadosProposta = { tipo: 'proposta', estado: 'pendente', acoes: propostas }
      const { error } = await ctx.admin.from('mensagens').insert({
        lista_id,
        papel: 'assistente',
        tipo: 'confirmacao',
        conteudo: 'Confirma?',
        dados,
      })
      if (error) throw error
    }

    return json({ ok: true })
  } catch (e) {
    console.error('chat: erro inesperado', e)
    return erro('Algo deu errado do nosso lado. Tente de novo.', 500)
  }
})
