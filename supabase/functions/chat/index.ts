// chat (CLAUDE.md, seção 6.2): o Gemini interpreta a mensagem e devolve
// ações estruturadas; esta função valida (Zod) e executa. A IA não escreve no
// banco e não faz conta: totais vêm do banco, e a escolha da faixa de preço
// vem de precos.ts.
//
// - Adicionar item, consultas e pôr um item no carrinho sem preço rodam na hora.
// - Remover, desmarcar e marcar com preço voltam como proposta, que só é
//   aplicada quando alguém confirma no app.
// - O pedido pode vir escrito ou falado. Falado, o áudio vai junto para o
//   Gemini, que devolve a transcrição e as ações na mesma chamada.

import { autenticar, type Contexto } from '../_shared/auth.ts'
import { formatarQuantidade, formatarReais, precoUnitarioDoTotal, type Unidade } from '../_shared/dinheiro.ts'
import { gerarJson, registrarUso, type ParteDeEntrada, type RespostaGemini } from '../_shared/gemini.ts'
import { cors, emSegundoPlano, erro, json } from '../_shared/http.ts'
import { problemasDaLeitura, textoDoProblema, travaPreco } from '../_shared/leitura.ts'
import { calcularCompra, cartoesDesconhecidos, linhaCalculo, nomeCartao, normalizarCartao } from '../_shared/precos.ts'
import { lerPedidoCurto } from '../_shared/pedidoCurto.ts'
import { INSTRUCAO_CHAT, SCHEMA_CHAT } from '../_shared/prompts.ts'
import {
  chatEntradaSchema,
  dadosEtiquetaSchema,
  faixasSchema,
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
type ItemDaLista = {
  id: string
  nome: string
  unidade: Unidade
  comprado: boolean
  qtd_planejada: number | null
  qtd_comprada: number | null
  preco_unit_centavos: number | null
  faixas_preco: unknown
}

const MENSAGENS_DE_CONTEXTO = 10
const IA_FORA = 'Não consegui falar com a IA agora. Tente de novo em instantes.'

const frase = (texto: string) => (/[.!?…]$/.test(texto) ? texto : `${texto}.`)
const comInicialMaiuscula = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1)

function comQuantidade(item: { nome: string; unidade: Unidade; qtd_planejada: number | null }): string {
  if (item.qtd_planejada === null) return item.nome
  return `${item.nome} (${formatarQuantidade(item.qtd_planejada, item.unidade)}${item.unidade === 'un' ? ' un' : ''})`
}

/**
 * "5 por 10": troca o preço do conjunto pelo preço de uma unidade (divisão em
 * código). Sem quantidade dita nem planejada não há conta: vira pergunta. Se
 * a divisão não fecha em centavos, a diferença é dita, não escondida.
 */
function resolverTotais(acoes: Acao[], itens: ItemDaLista[], avisos: string[]): Acao[] {
  const porId = new Map(itens.map((i) => [i.id, i]))
  const saida: Acao[] = []
  for (const acao of acoes) {
    if ((acao.tipo !== 'adicionar_item' && acao.tipo !== 'marcar_comprado') || acao.preco_total_centavos === undefined) {
      saida.push(acao)
      continue
    }
    const { preco_total_centavos: total, ...resto } = acao
    if (acao.preco_centavos !== undefined) {
      saida.push(resto as Acao) // preço unitário dito vale mais que o do conjunto
      continue
    }
    let nome: string
    let qtd: number | null | undefined = acao.qtd
    if (acao.tipo === 'marcar_comprado') {
      const item = porId.get(acao.item_id)
      if (!item) {
        saida.push(resto as Acao) // id inválido: segue para ser descartado como antes
        continue
      }
      nome = item.nome
      qtd ??= (item.comprado ? item.qtd_comprada : null) ?? item.qtd_planejada
    } else {
      nome = comInicialMaiuscula(acao.nome)
      const chave = normalizarCartao(nome)
      qtd ??= itens.find((i) => !i.comprado && normalizarCartao(i.nome) === chave)?.qtd_planejada
    }
    if (qtd === null || qtd === undefined) {
      avisos.push(`Quantos “${nome}” você levou? Diga a quantidade junto com o preço.`)
      continue
    }
    const unidade = acao.tipo === 'adicionar_item' ? acao.unidade : porId.get(acao.item_id)?.unidade
    if (unidade !== 'kg' && !Number.isInteger(qtd)) {
      avisos.push(`“${nome}” é vendido por unidade: diga um número inteiro.`)
      continue
    }
    const unitario = precoUnitarioDoTotal(total, qtd)
    if (!unitario) {
      avisos.push(`Não consegui dividir ${formatarReais(total)} por ${qtd} “${nome}”. Diga o preço de cada um.`)
      continue
    }
    if (!unitario.exato) {
      avisos.push(
        `${formatarReais(total)} por ${qtd} “${nome}” não fecha em centavos: ficou ${formatarReais(unitario.preco_centavos)} cada, total ${formatarReais(unitario.total_centavos)}.`,
      )
    }
    saida.push({ ...resto, qtd, preco_centavos: unitario.preco_centavos } as Acao)
  }
  return saida
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
  // Leitura com pendência no preço não é calculada por aqui: quem resolve é o
  // card, onde a pessoa vê o que faltou e informa o valor.
  const problemas = problemasDaLeitura(extracao)
  if (travaPreco(problemas)) {
    return `A leitura dessa etiqueta ficou incompleta. ${problemas.map(textoDoProblema).join(' ')} Confirme o preço no card dela.`
  }
  if (extracao.unidade === 'un' && !Number.isInteger(qtd)) return 'Esse produto é vendido por unidade: diga um número inteiro.'

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
  if (!sugerido && !extracao.produto) return 'Não li o nome do produto dessa etiqueta. Escolha o item ou digite o nome no card dela.'
  let itemId: string
  let nome: string
  if (sugerido) {
    const { error } = await ctx.doUsuario.from('itens').update(compraDoItem).eq('id', sugerido.id)
    if (error) throw error
    itemId = sugerido.id
    nome = sugerido.nome
  } else {
    nome = extracao.produto as string // conferido acima: sem item sugerido, o nome existe
    const { data, error } = await ctx.doUsuario
      .from('itens')
      .insert({ lista_id: lista.id, nome, ...compraDoItem })
      .select('id')
      .single()
    if (error) throw error
    itemId = data.id
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

/** Título seguido de um marcador por item: tudo que o assistente diz sai em tópicos. */
const comTopicos = (titulo: string, itens: string[]) => `${titulo}\n${itens.map((i) => `• ${i}`).join('\n')}`

/** Total e orçamento, sempre lidos do banco (nunca um número vindo da IA). */
async function textoDoTotal(ctx: Contexto, lista: Lista): Promise<string[]> {
  const { data, error } = await ctx.doUsuario
    .from('lista_totais')
    .select('total_centavos, itens_comprados, itens_total')
    .eq('lista_id', lista.id)
    .maybeSingle()
  if (error) throw error
  if (!data || !data.itens_total) return ['A lista ainda está vazia.']

  const total = data.total_centavos ?? 0
  const linhas = [`Carrinho: ${formatarReais(total)}, com ${data.itens_comprados} de ${data.itens_total} ${data.itens_total === 1 ? 'item' : 'itens'}.`]
  if (lista.orcamento_centavos !== null) {
    const saldo = lista.orcamento_centavos - total
    linhas.push(
      saldo >= 0
        ? `Restam ${formatarReais(saldo)} do orçamento de ${formatarReais(lista.orcamento_centavos)}.`
        : `Passou ${formatarReais(-saldo)} do orçamento de ${formatarReais(lista.orcamento_centavos)}.`,
    )
  }
  return linhas
}

/** O que já está no carrinho, com quantidade e total de cada item vindos do banco. */
async function textoDosComprados(ctx: Contexto, listaId: string): Promise<string> {
  const { data, error } = await ctx.doUsuario
    .from('itens')
    .select('nome, unidade, qtd_comprada, total_centavos')
    .eq('lista_id', listaId)
    .eq('comprado', true)
    .order('comprado_em')
  if (error) throw error
  if (data.length === 0) return 'Ainda não há nada no carrinho.'
  const linha = (i: { nome: string; unidade: Unidade; qtd_comprada: number | null; total_centavos: number | null }) => {
    const qtd = i.qtd_comprada === null ? '' : ` (${formatarQuantidade(i.qtd_comprada, i.unidade)}${i.unidade === 'un' ? ' un' : ''})`
    return `${i.nome}${qtd}: ${i.total_centavos === null ? 'sem preço' : formatarReais(i.total_centavos)}`
  }
  return comTopicos(`No carrinho (${data.length}):`, data.map(linha))
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return erro('Método não permitido.', 405)

  try {
    const ctx = await autenticar(req)
    if (ctx instanceof Response) return ctx

    const entrada = chatEntradaSchema.safeParse(await req.json().catch(() => null))
    if (!entrada.success) return erro('Mensagem inválida.', 400)
    const { lista_id, mensagem, audio } = entrada.data

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
      ctx.doUsuario
        .from('itens')
        .select('id, nome, unidade, comprado, qtd_planejada, qtd_comprada, preco_unit_centavos, faixas_preco')
        .eq('lista_id', lista_id)
        .order('criado_em'),
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

    const gravarFala = async (conteudo: string) => {
      const { error } = await ctx.doUsuario
        .from('mensagens')
        .insert({ lista_id, autor_id: ctx.usuarioId, papel: 'usuario', tipo: 'texto', conteudo })
      if (error) throw error
    }

    // A mensagem escrita entra na conversa antes da chamada à IA: se a IA
    // falhar, ela continua lá, seguida do aviso. A falada só existe como
    // texto depois que a IA devolve a transcrição.
    if (mensagem !== undefined) await gravarFala(mensagem)

    // Formato curto ("ovo 12,30 1 caixa") é lido por código: imediato e sem depender da IA.
    const curto = mensagem !== undefined ? lerPedidoCurto(mensagem) : null

    const partes: ParteDeEntrada[] = [
      {
        type: 'text',
        text: JSON.stringify({
          itens: itens.map(({ id, nome, unidade, comprado }) => ({ id, nome, unidade, comprado })),
          conversa_recente: consultaHistorico.data.reverse().map((m) => ({ de: m.papel, texto: m.conteudo })),
          card_aberto: card ? { produto: card.dados.extracao.produto, unidade: card.dados.extracao.unidade } : null,
          mensagem: mensagem ?? null,
        }),
      },
    ]
    if (audio) partes.push({ type: 'audio', data: audio.data, mime_type: audio.mime_type })

    let acoes: Acao[]
    let naoEntendidas: number
    if (curto) {
      acoes = [curto]
      naoEntendidas = 0
    } else {
      let resposta: RespostaGemini
      try {
        resposta = await gerarJson({
          instrucao: INSTRUCAO_CHAT,
          entrada: partes,
          schema: SCHEMA_CHAT,
        })
      } catch (e) {
        console.error('chat: gemini falhou', e)
        await responder(ctx, lista_id, IA_FORA, 'sistema')
        return json({ ok: false })
      }
      emSegundoPlano(registrarUso(ctx.admin, lista_id, 'chat', resposta))

      try {
        const lidas = interpretarAcoes(resposta.json)
        acoes = lidas.acoes
        naoEntendidas = lidas.descartadas
        if (audio) {
          if (!lidas.transcricao) {
            await responder(ctx, lista_id, 'Não consegui entender o áudio. Tente de novo, mais perto do microfone.')
            return json({ ok: false })
          }
          await gravarFala(lidas.transcricao)
        }
      } catch (e) {
        console.error('chat: resposta fora do schema', e)
        await responder(ctx, lista_id, 'Não entendi o pedido. Pode dizer de outro jeito?')
        return json({ ok: false })
      }
    }

    const avisos: string[] = []
    acoes = resolverTotais(acoes, itens, avisos)

    const porId = new Map(itens.map((i) => [i.id, i]))
    const novos: Array<{ lista_id: string; nome: string; unidade: Unidade; qtd_planejada: number | null }> = []
    // Itens novos que já vêm com preço dito: depois de gravados, viram proposta de compra.
    const comPreco = new Map<number, { qtd: number | null; preco_centavos: number }>()
    const repetidos: string[] = []
    const novasQuantidades: Array<{ id: string; nome: string; unidade: Unidade; qtd: number }> = []
    const propostas: AcaoProposta[] = []
    const paraOCarrinho: Array<{ item: ItemDaLista; qtd: number | null }> = []
    const falas: string[] = []
    let qtdDoCard: number | null = null
    let querFaltantes = false
    let querTotal = false
    let querComprados = false

    for (const acao of acoes) {
      switch (acao.tipo) {
        case 'adicionar_item': {
          const nome = comInicialMaiuscula(acao.nome)
          const chave = normalizarCartao(nome) // mesma normalização: minúsculas, sem acento
          const repetido =
            itens.find((i) => !i.comprado && normalizarCartao(i.nome) === chave)?.nome ??
            novos.find((n) => normalizarCartao(n.nome) === chave)?.nome
          const naLista = itens.find((i) => !i.comprado && normalizarCartao(i.nome) === chave)
          // "leite 5,00 2" com "Leite" já esperando na lista: é a compra desse item, não um item novo.
          if (naLista && acao.preco_centavos !== undefined) {
            const qtdDita = acao.qtd ?? naLista.qtd_planejada
            if (qtdDita === null) avisos.push(`Quantos “${naLista.nome}” você levou? Diga a quantidade junto com o preço.`)
            else if (naLista.unidade === 'un' && !Number.isInteger(qtdDita)) {
              avisos.push(`“${naLista.nome}” é vendido por unidade: diga um número inteiro.`)
            } else {
              propostas.push({
                tipo: 'marcar_comprado',
                item_id: naLista.id,
                nome: naLista.nome,
                unidade: naLista.unidade,
                qtd: qtdDita,
                preco_centavos: acao.preco_centavos,
              })
            }
            break
          }
          if (repetido) {
            repetidos.push(repetido)
            break
          }
          const unidade = acao.unidade ?? 'un'
          const qtd = acao.qtd !== undefined && (unidade === 'kg' || Number.isInteger(acao.qtd)) ? acao.qtd : null
          // Quantidade que não fecha com a unidade não é arredondada nem trocada: fica sem, e avisa.
          if (acao.qtd !== undefined && qtd === null) avisos.push(`Não entendi a quantidade de “${nome}”: entrou na lista sem quantidade.`)
          if (acao.preco_centavos !== undefined) comPreco.set(novos.length, { qtd, preco_centavos: acao.preco_centavos })
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
          else if (item.comprado && acao.preco_centavos === undefined && acao.qtd === undefined) {
            avisos.push(`“${item.nome}” já está no carrinho.`)
          } else if (item.unidade === 'un' && acao.qtd !== undefined && !Number.isInteger(acao.qtd)) {
            avisos.push(`“${item.nome}” é vendido por unidade: diga um número inteiro.`)
          } else if (item.comprado && acao.preco_centavos === undefined) {
            // Corrigir só a quantidade: o preço já está no item. Com faixas gravadas, a faixa
            // é escolhida de novo para a nova quantidade (seção 6.4); a conta é do código.
            const faixas = faixasSchema.safeParse(item.faixas_preco)
            const compra =
              faixas.success && faixas.data.length > 0 && acao.qtd !== undefined
                ? calcularCompra(faixas.data, acao.qtd, lista.cartoes)
                : null
            const preco = compra?.faixa.preco_centavos ?? item.preco_unit_centavos
            if (preco === null || acao.qtd === undefined) {
              avisos.push(`Para corrigir a quantidade de “${item.nome}”, diga também o preço.`)
            } else {
              propostas.push({
                tipo: 'marcar_comprado',
                item_id: item.id,
                nome: item.nome,
                unidade: item.unidade,
                qtd: acao.qtd,
                preco_centavos: preco,
              })
            }
          } else if (acao.preco_centavos === undefined) {
            // Sem preço não mexe no total: é o mesmo que tocar no círculo do item.
            // A quantidade só é gravada se foi dita.
            paraOCarrinho.push({ item, qtd: acao.qtd ?? null })
          } else {
            // Com preço, a conta precisa de uma quantidade dita ou planejada; não se presume "1".
            // Correção de item já comprado mantém a quantidade que ele tinha.
            const qtd = acao.qtd ?? (item.comprado ? item.qtd_comprada : null) ?? item.qtd_planejada
            if (qtd === null) avisos.push(`Quantos “${item.nome}” você levou? Diga a quantidade junto com o preço.`)
            else {
              propostas.push({
                tipo: 'marcar_comprado',
                item_id: item.id,
                nome: item.nome,
                unidade: item.unidade,
                qtd,
                preco_centavos: acao.preco_centavos,
              })
            }
          }
          break
        }
        case 'informar_quantidade':
          qtdDoCard = acao.qtd
          break
        case 'atualizar_quantidade': {
          const item = porId.get(acao.item_id)
          if (!item) {
            naoEntendidas += 1
            break
          }
          if (item.comprado) {
            avisos.push(`“${item.nome}” já está no carrinho. Para mudar a quantidade comprada, diga também o preço.`)
            break
          }
          const nova = acao.modo === 'somar' ? (item.qtd_planejada ?? 0) + acao.qtd : acao.qtd
          if (item.unidade === 'un' && !Number.isInteger(nova)) {
            avisos.push(`“${item.nome}” é vendido por unidade: diga um número inteiro.`)
            break
          }
          const arredondada = Math.round(nova * 1000) / 1000
          if (arredondada > 0 && arredondada <= 9999) {
            novasQuantidades.push({ id: item.id, nome: item.nome, unidade: item.unidade, qtd: arredondada })
            item.qtd_planejada = arredondada // várias ações no mesmo pedido enxergam o valor novo
          } else avisos.push(`Quantidade de “${item.nome}” fora do limite.`)
          break
        }
        case 'consultar_faltantes':
          querFaltantes = true
          break
        case 'consultar_total':
          querTotal = true
          break
        case 'consultar_comprados':
          querComprados = true
          break
        case 'responder':
          falas.push(frase(acao.texto))
          break
      }
    }

    // Execução, na ordem em que a resposta será lida.
    const linhas: string[] = []

    if (novos.length > 0) {
      const { data: criados, error } = await ctx.doUsuario.from('itens').insert(novos).select('id')
      if (error) throw error
      // Item que já vira proposta de compra (preço e quantidade ditos) não precisa
      // de uma linha "Adicionei": a proposta diz o que vai acontecer com ele.
      const viraProposta = (i: number) => comPreco.get(i)?.qtd != null && criados?.[i]?.id !== undefined
      const soAdicionados = novos.filter((_, i) => !viraProposta(i))
      if (soAdicionados.length > 0) linhas.push(comTopicos('Adicionei:', soAdicionados.map(comQuantidade)))
      // Com preço dito, a conta precisa de quantidade dita; não se presume "1".
      comPreco.forEach(({ qtd, preco_centavos }, indice) => {
        const nome = novos[indice]!.nome
        const id = criados?.[indice]?.id as string | undefined
        if (qtd === null) avisos.push(`Quantos “${nome}” você levou? Diga a quantidade junto com o preço.`)
        else if (id) propostas.push({ tipo: 'marcar_comprado', item_id: id, nome, unidade: novos[indice]!.unidade, qtd, preco_centavos })
      })
    }
    if (novasQuantidades.length > 0) {
      for (const n of novasQuantidades) {
        const { error } = await ctx.doUsuario.from('itens').update({ qtd_planejada: n.qtd }).eq('id', n.id)
        if (error) throw error
      }
      linhas.push(
        comTopicos(
          'Quantidade atualizada:',
          novasQuantidades.map((n) => comQuantidade({ nome: n.nome, unidade: n.unidade, qtd_planejada: n.qtd })),
        ),
      )
    }
    if (repetidos.length > 0) linhas.push(comTopicos(`Já ${repetidos.length === 1 ? 'estava' : 'estavam'} na lista:`, repetidos))

    if (paraOCarrinho.length > 0) {
      for (const { item, qtd } of paraOCarrinho) {
        const { error } = await ctx.doUsuario.from('itens').update({ comprado: true, qtd_comprada: qtd }).eq('id', item.id)
        if (error) throw error
      }
      linhas.push(comTopicos('No carrinho, sem preço:', paraOCarrinho.map((p) => p.item.nome)))
    }

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
      else linhas.push(comTopicos(`Falta comprar (${faltando.length}):`, faltando.map(comQuantidade)))
    }

    if (querComprados) linhas.push(await textoDosComprados(ctx, lista_id))

    if (querTotal) linhas.push(...(await textoDoTotal(ctx, lista)))

    linhas.push(...falas)

    if (naoEntendidas > 0) {
      linhas.push(linhas.length > 0 || propostas.length > 0 ? 'Uma parte do pedido eu não entendi.' : 'Não entendi o pedido. Pode dizer de outro jeito?')
    }
    if (linhas.length === 0 && propostas.length === 0) linhas.push('Não entendi o pedido. Pode dizer de outro jeito?')

    // Toda resposta sai em tópicos: cada fala ganha um marcador; as listas já vêm com um por item.
    const texto = linhas.map((l) => (l.includes('\n') ? l : `• ${l}`)).join('\n')

    if (propostas.length > 0) {
      // Uma mensagem só: o texto e a proposta com os botões ficam no mesmo cartão.
      const dados: DadosProposta = { tipo: 'proposta', estado: 'pendente', acoes: propostas }
      const { error } = await ctx.admin.from('mensagens').insert({
        lista_id,
        papel: 'assistente',
        tipo: 'confirmacao',
        conteudo: texto,
        dados,
      })
      if (error) throw error
    } else if (texto) {
      await responder(ctx, lista_id, texto)
    }

    return json({ ok: true })
  } catch (e) {
    console.error('chat: erro inesperado', e)
    return erro('Algo deu errado do nosso lado. Tente de novo.', 500)
  }
})
