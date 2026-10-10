// Acesso ao Supabase. Os hooks chamam estas funções; nenhum componente fala
// com o banco diretamente. Quem protege os dados é o RLS, não este arquivo.

import type { PostgrestError } from '@supabase/supabase-js'
import type {
  DadosMensagem,
  Item,
  ItemPatch,
  Lista,
  ListaComResumo,
  Membro,
  Mensagem,
  Perfil,
  RespostaLerEtiqueta,
  Resumo,
} from '@/types/app'
import type { Json, Tables } from '@/types/database'
import { calcularTotalCentavos, somarCentavos, type Unidade } from './dinheiro'
import { BUCKET_ETIQUETAS, supabase } from './supabase'

export const chaves = {
  perfil: (id: string) => ['perfil', id] as const,
  listas: (status: Lista['status']) => ['listas', status] as const,
  todasAsListas: ['listas'] as const,
  lista: (id: string) => ['lista', id] as const,
  membros: (listaId: string) => ['membros', listaId] as const,
  itens: (listaId: string) => ['itens', listaId] as const,
  mensagens: (listaId: string) => ['mensagens', listaId] as const,
  foto: (caminho: string) => ['foto', caminho] as const,
}

/** Erro com mensagem pronta para mostrar ao usuário. */
export class ErroDoApp extends Error {
  constructor(
    mensagem: string,
    readonly codigo?: string,
  ) {
    super(mensagem)
    this.name = 'ErroDoApp'
  }
}

function falhar(erro: PostgrestError | Error | null, contexto: string): never {
  const codigo = erro && 'code' in erro ? erro.code : undefined
  console.error(contexto, erro)
  throw new ErroDoApp(contexto, codigo)
}

const RESUMO_VAZIO: Resumo = { total_centavos: 0, itens_comprados: 0, itens_total: 0 }

const paraLista = (linha: Tables<'listas'>): Lista => linha as Lista
const paraItem = (linha: Tables<'itens'>): Item => linha as unknown as Item
const paraMensagem = (linha: Tables<'mensagens'>): Mensagem => linha as unknown as Mensagem

/** Total e progresso calculados a partir dos itens em cache (funciona offline). */
export function resumir(itens: Item[]): Resumo {
  return {
    total_centavos: somarCentavos(itens.map((i) => i.total_centavos)),
    itens_comprados: itens.filter((i) => i.comprado).length,
    itens_total: itens.length,
  }
}

/**
 * Aplica uma alteração no item do jeito que o banco aplicaria (gatilho
 * normalizar_item e coluna gerada total_centavos), para a tela já mostrar o
 * resultado certo antes de o servidor responder.
 */
export function aplicarPatch(item: Item, patch: ItemPatch): Item {
  const novo: Item = { ...item, ...patch }
  if (!novo.comprado) {
    novo.faixas_preco = null
    novo.faixa_aplicada = null
    novo.preco_unit_centavos = null
    novo.qtd_comprada = null
    novo.origem_preco = null
    novo.foto_path = null
    novo.comprado_por = null
    novo.comprado_em = null
  } else if (!item.comprado) {
    novo.comprado_em = new Date().toISOString()
  }
  novo.total_centavos =
    novo.preco_unit_centavos === null || novo.qtd_comprada === null
      ? null
      : calcularTotalCentavos(novo.preco_unit_centavos, novo.qtd_comprada)
  return novo
}

// ---------------------------------------------------------------------------
// Perfil
// ---------------------------------------------------------------------------

export async function buscarPerfil(id: string): Promise<Perfil | null> {
  const { data, error } = await supabase.from('perfis').select('*').eq('id', id).maybeSingle()
  if (error) falhar(error, 'Não deu para carregar seu perfil.')
  return data
}

export async function salvarNome(id: string, nome: string): Promise<void> {
  const { error } = await supabase.from('perfis').update({ nome }).eq('id', id)
  if (error) falhar(error, 'Não deu para salvar seu nome.')
}

// ---------------------------------------------------------------------------
// Listas
// ---------------------------------------------------------------------------

async function buscarMembrosDe(listaIds: string[]): Promise<Map<string, Membro[]>> {
  const porLista = new Map<string, Membro[]>()
  if (listaIds.length === 0) return porLista

  const { data: vinculos, error } = await supabase
    .from('lista_membros')
    .select('lista_id, perfil_id, papel')
    .in('lista_id', listaIds)
  if (error) falhar(error, 'Não deu para carregar quem divide as listas.')

  const perfilIds = [...new Set(vinculos.map((v) => v.perfil_id))]
  const { data: perfis, error: erroPerfis } = await supabase.from('perfis').select('id, nome').in('id', perfilIds)
  if (erroPerfis) falhar(erroPerfis, 'Não deu para carregar quem divide as listas.')

  const nomes = new Map(perfis.map((p) => [p.id, p.nome]))
  for (const v of vinculos) {
    const membros = porLista.get(v.lista_id) ?? []
    membros.push({ perfil_id: v.perfil_id, papel: v.papel as Membro['papel'], nome: nomes.get(v.perfil_id) ?? '' })
    porLista.set(v.lista_id, membros)
  }
  return porLista
}

export async function buscarListas(status: Lista['status']): Promise<ListaComResumo[]> {
  const coluna = status === 'ativa' ? 'criado_em' : 'finalizada_em'
  const { data, error } = await supabase
    .from('listas')
    .select('*')
    .eq('status', status)
    .order(coluna, { ascending: false })
  if (error) falhar(error, 'Não deu para carregar suas listas.')

  const ids = data.map((l) => l.id)
  if (ids.length === 0) return []

  const [totais, membros] = await Promise.all([
    supabase.from('lista_totais').select('*').in('lista_id', ids),
    buscarMembrosDe(ids),
  ])
  if (totais.error) falhar(totais.error, 'Não deu para carregar os totais.')

  const resumos = new Map(
    totais.data.map((t) => [
      t.lista_id,
      {
        total_centavos: t.total_centavos ?? 0,
        itens_comprados: t.itens_comprados ?? 0,
        itens_total: t.itens_total ?? 0,
      } satisfies Resumo,
    ]),
  )

  return data.map((linha) => ({
    ...paraLista(linha),
    resumo: resumos.get(linha.id) ?? RESUMO_VAZIO,
    membros: membros.get(linha.id) ?? [],
  }))
}

export async function buscarLista(id: string): Promise<Lista | null> {
  const { data, error } = await supabase.from('listas').select('*').eq('id', id).maybeSingle()
  if (error) falhar(error, 'Não deu para carregar a lista.')
  return data ? paraLista(data) : null
}

export async function buscarMembros(listaId: string): Promise<Membro[]> {
  return (await buscarMembrosDe([listaId])).get(listaId) ?? []
}

export type NovaLista = { nome: string; mercado: string | null; orcamento_centavos: number | null }

export async function criarLista(nova: NovaLista): Promise<Lista> {
  const { data, error } = await supabase.from('listas').insert(nova).select().single()
  if (error) falhar(error, 'Não deu para criar a lista.')
  return paraLista(data)
}

export type ListaPatch = Partial<Pick<Lista, 'nome' | 'mercado' | 'orcamento_centavos' | 'status'>>

export async function atualizarLista(id: string, patch: ListaPatch): Promise<Lista> {
  const { data, error } = await supabase.from('listas').update(patch).eq('id', id).select().single()
  if (error) falhar(error, 'Não deu para salvar a lista.')
  return paraLista(data)
}

export async function excluirLista(id: string): Promise<void> {
  const { error } = await supabase.from('listas').delete().eq('id', id)
  if (error) falhar(error, 'Não deu para excluir a lista.')
}

export async function sairDaLista(listaId: string, perfilId: string): Promise<void> {
  const { error } = await supabase.from('lista_membros').delete().eq('lista_id', listaId).eq('perfil_id', perfilId)
  if (error) falhar(error, 'Não deu para sair da lista.')
}

export async function responderCartao(listaId: string, cartao: string, tem: boolean): Promise<void> {
  const { error } = await supabase.rpc('responder_cartao', { p_lista_id: listaId, p_cartao: cartao, p_tem: tem })
  if (error) falhar(error, 'Não deu para gravar a resposta sobre o cartão.')
}

// ---------------------------------------------------------------------------
// Convites
// ---------------------------------------------------------------------------

export async function criarConvite(listaId: string): Promise<string> {
  const { data, error } = await supabase.rpc('criar_convite', { p_lista_id: listaId })
  if (error) falhar(error, 'Não deu para gerar o convite.')
  return data
}

export async function aceitarConvite(codigo: string): Promise<string> {
  const { data, error } = await supabase.rpc('aceitar_convite', { p_codigo: codigo })
  if (error) {
    if (error.message.includes('convite_invalido')) {
      throw new ErroDoApp('Esse código não existe ou já venceu. Peça um novo para quem criou a lista.', 'convite_invalido')
    }
    falhar(error, 'Não deu para entrar na lista.')
  }
  return data
}

// ---------------------------------------------------------------------------
// Itens
// ---------------------------------------------------------------------------

export async function buscarItens(listaId: string): Promise<Item[]> {
  const { data, error } = await supabase
    .from('itens')
    .select('*')
    .eq('lista_id', listaId)
    .order('criado_em', { ascending: true })
  if (error) falhar(error, 'Não deu para carregar os itens.')
  return data.map(paraItem)
}

export type NovoItem = {
  id: string
  lista_id: string
  nome: string
  unidade?: Unidade
  qtd_planejada?: number | null
} & ItemPatch

export async function inserirItem(novo: NovoItem): Promise<void> {
  const { faixas_preco, ...resto } = novo
  const { error } = await supabase
    .from('itens')
    .insert({ ...resto, faixas_preco: (faixas_preco ?? null) as Json })
  // 23505: o id já existe porque uma tentativa anterior chegou ao banco e só a
  // resposta se perdeu (comum ao reenviar a fila offline). Já está gravado.
  if (error && error.code !== '23505') falhar(error, 'Não deu para adicionar o item.')
}

export async function atualizarItem(id: string, patch: ItemPatch): Promise<void> {
  const { faixas_preco, ...resto } = patch
  const linha = faixas_preco === undefined ? resto : { ...resto, faixas_preco: faixas_preco as Json }
  const { error } = await supabase.from('itens').update(linha).eq('id', id)
  if (error) falhar(error, 'Não deu para salvar o item.')
}

export async function removerItem(id: string): Promise<void> {
  const { error } = await supabase.from('itens').delete().eq('id', id)
  if (error) falhar(error, 'Não deu para remover o item.')
}

// ---------------------------------------------------------------------------
// Mensagens e Edge Functions
// ---------------------------------------------------------------------------

const MAX_MENSAGENS = 200

export async function buscarMensagens(listaId: string): Promise<Mensagem[]> {
  const { data, error } = await supabase
    .from('mensagens')
    .select('*')
    .eq('lista_id', listaId)
    .order('criado_em', { ascending: false })
    .limit(MAX_MENSAGENS)
  if (error) falhar(error, 'Não deu para carregar a conversa.')
  return data.reverse().map(paraMensagem)
}

export async function atualizarCard(mensagemId: string, dados: DadosMensagem, itemId?: string | null): Promise<void> {
  const patch: { dados: Json; item_id?: string | null } = { dados: dados as unknown as Json }
  if (itemId !== undefined) patch.item_id = itemId
  const { error } = await supabase.from('mensagens').update(patch).eq('id', mensagemId)
  if (error) falhar(error, 'Não deu para atualizar o card.')
}

// As Edge Functions respondem { erro: "texto para o usuário" } quando falham.
async function mensagemDeErro(erro: unknown, padrao: string): Promise<string> {
  const resposta = (erro as { context?: unknown } | null)?.context
  if (resposta instanceof Response) {
    try {
      const corpo: unknown = await resposta.clone().json()
      if (corpo && typeof corpo === 'object' && 'erro' in corpo && typeof corpo.erro === 'string') return corpo.erro
    } catch {
      // corpo não era JSON: fica a mensagem padrão
    }
  }
  return padrao
}

export async function enviarAoChat(listaId: string, mensagem: string): Promise<void> {
  const { error } = await supabase.functions.invoke('chat', { body: { lista_id: listaId, mensagem } })
  if (error) throw new ErroDoApp(await mensagemDeErro(error, 'Não consegui enviar. Tente de novo.'))
}

export async function enviarFoto(listaId: string, foto: Blob): Promise<string> {
  const caminho = `${listaId}/${crypto.randomUUID()}.jpg`
  const { error } = await supabase.storage
    .from(BUCKET_ETIQUETAS)
    .upload(caminho, foto, { contentType: 'image/jpeg', cacheControl: '3600' })
  if (error) {
    console.error('upload da etiqueta', error)
    throw new ErroDoApp('Não deu para enviar a foto. Tente de novo.')
  }
  return caminho
}

export async function lerEtiqueta(listaId: string, fotoPath: string): Promise<RespostaLerEtiqueta> {
  const { data, error } = await supabase.functions.invoke<RespostaLerEtiqueta>('ler-etiqueta', {
    body: { lista_id: listaId, foto_path: fotoPath },
  })
  if (error || !data) {
    throw new ErroDoApp(await mensagemDeErro(error, 'Não consegui ler a etiqueta. Tente outra foto.'))
  }
  return data
}

/** Link temporário para mostrar a foto da etiqueta (bucket privado). Null se ela já foi apagada. */
export async function urlDaFoto(caminho: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(BUCKET_ETIQUETAS).createSignedUrl(caminho, 3600)
  return error ? null : data.signedUrl
}
