// ler-etiqueta (CLAUDE.md, seção 6.1): recebe o caminho de uma foto já
// enviada ao Storage, pede ao Gemini produto e faixas de preço, valida e
// devolve. Não grava no item: quem grava é a etapa de quantidade, no app,
// depois que o usuário diz quantos levou. Aqui só nascem as duas mensagens do
// chat (a foto e o card de quantidade), para os dois aparelhos verem.
//
// O que a IA não leu nunca é completado aqui: vira um problema no card
// (leitura.ts), que o app mostra como erro e resolve perguntando ao usuário.

import { encodeBase64 } from '@std/encoding/base64'
import { autenticar } from '../_shared/auth.ts'
import { BUCKET_ETIQUETAS } from '../_shared/config.ts'
import { limparFotosAntigas } from '../_shared/fotos.ts'
import { gerarJson, registrarUso, type RespostaGemini } from '../_shared/gemini.ts'
import { cors, emSegundoPlano, erro, json } from '../_shared/http.ts'
import { textoDoProblema } from '../_shared/leitura.ts'
import { linhaFaixas } from '../_shared/precos.ts'
import { INSTRUCAO_ETIQUETA, SCHEMA_ETIQUETA } from '../_shared/prompts.ts'
import {
  leituraSchema,
  lerEtiquetaEntradaSchema,
  validarLeitura,
  type DadosEtiqueta,
  type DadosFoto,
  type RespostaLerEtiqueta,
} from '../_shared/schemas.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return erro('Método não permitido.', 405)

  try {
    const ctx = await autenticar(req)
    if (ctx instanceof Response) return ctx

    const entrada = lerEtiquetaEntradaSchema.safeParse(await req.json().catch(() => null))
    if (!entrada.success) return erro('Pedido inválido.', 400)
    const { lista_id, foto_path } = entrada.data

    // 1. Membro da lista? A consulta roda com o token do usuário: sem ser
    //    membro, o RLS não devolve a linha.
    const { data: lista, error: erroLista } = await ctx.doUsuario
      .from('listas')
      .select('id, status')
      .eq('id', lista_id)
      .maybeSingle()
    if (erroLista) throw erroLista
    if (!lista) return erro('Você não participa desta lista.', 403)
    if (lista.status !== 'ativa') return erro('Esta compra já foi finalizada. Reabra a lista para continuar.', 409)

    // 2. Foto (também pelo token do usuário: a policy do bucket confere a pasta).
    const { data: arquivo, error: erroFoto } = await ctx.doUsuario.storage.from(BUCKET_ETIQUETAS).download(foto_path)
    if (erroFoto || !arquivo) return erro('Não encontrei a foto enviada. Tire outra.', 404)
    const imagem = encodeBase64(new Uint8Array(await arquivo.arrayBuffer()))

    // 3. Itens que ainda faltam, para a IA sugerir a qual deles a etiqueta corresponde.
    const { data: pendentes, error: erroItens } = await ctx.doUsuario
      .from('itens')
      .select('id, nome')
      .eq('lista_id', lista_id)
      .eq('comprado', false)
    if (erroItens) throw erroItens

    // 4. Gemini: texto antes da imagem, como recomenda a documentação.
    let resposta: RespostaGemini
    try {
      resposta = await gerarJson({
        instrucao: INSTRUCAO_ETIQUETA,
        entrada: [
          { type: 'text', text: `Itens que ainda faltam comprar (JSON): ${JSON.stringify(pendentes ?? [])}\n\nLeia a etiqueta de preço da foto.` },
          { type: 'image', data: imagem, mime_type: 'image/jpeg' },
        ],
        schema: SCHEMA_ETIQUETA,
      })
    } catch (e) {
      console.error('ler-etiqueta: gemini falhou', e)
      return erro('Não consegui falar com a IA agora. Tente de novo em instantes.', 502)
    }
    emSegundoPlano(registrarUso(ctx.admin, lista_id, 'ler-etiqueta', resposta))

    // 5. Validação. Resposta fora do contrato vira erro tratável, nunca valor inventado.
    const lida = leituraSchema.safeParse(resposta.json)
    if (!lida.success) {
      console.error('ler-etiqueta: resposta fora do schema', JSON.stringify(lida.error.issues))
      return erro('Não consegui entender essa etiqueta. Tente outra foto, mais de perto e sem reflexo.', 422)
    }
    const extracao = validarLeitura(lida.data, (pendentes ?? []).map((i) => i.id))
    const semEtiqueta = extracao.problemas.includes('sem_etiqueta')

    // 6. Mensagens do chat: a foto (do usuário) e o card de quantidade (do assistente).
    const foto: DadosFoto = { tipo: 'foto', foto_path }
    const { error: erroMensagem } = await ctx.doUsuario.from('mensagens').insert({
      lista_id,
      autor_id: ctx.usuarioId,
      papel: 'usuario',
      tipo: 'foto',
      conteudo: 'Foto de etiqueta',
      dados: foto,
    })
    if (erroMensagem) throw erroMensagem

    // Sem etiqueta na foto não há card: só o aviso, logo abaixo da foto.
    const card: DadosEtiqueta = { tipo: 'etiqueta', estado: 'aberto', foto_path, extracao }
    const precos = extracao.faixas.length > 0 ? linhaFaixas(extracao.faixas) : 'preço não lido'
    const pendencias = extracao.problemas.map(textoDoProblema).join(' ')
    const { data: mensagem, error: erroCard } = await ctx.admin
      .from('mensagens')
      .insert(
        semEtiqueta
          ? {
              lista_id,
              papel: 'assistente',
              tipo: 'texto',
              conteudo: `${pendencias} Tire outra, de frente, mais de perto e sem reflexo.`,
            }
          : {
              lista_id,
              papel: 'assistente',
              tipo: 'confirmacao',
              conteudo: pendencias
                ? `Etiqueta lida com pendências: ${extracao.produto ?? 'produto sem nome lido'}. ${precos}. ${pendencias}`
                : `Etiqueta lida: ${extracao.produto}. ${precos}. Quantos?`,
              dados: card,
            },
      )
      .select('id')
      .single()
    if (erroCard) throw erroCard

    emSegundoPlano(limparFotosAntigas(ctx.admin, lista_id))

    const corpo: RespostaLerEtiqueta = { ...extracao, mensagem_id: mensagem.id }
    return json(corpo)
  } catch (e) {
    console.error('ler-etiqueta: erro inesperado', e)
    return erro('Algo deu errado do nosso lado. Tente de novo.', 500)
  }
})
