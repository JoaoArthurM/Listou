// Fila de fotos de etiqueta (CLAUDE.md, seção 7.3). Dentro do mercado o sinal
// some; em vez de pedir para a pessoa tentar de novo, a foto fica guardada no
// aparelho e é lida sozinha quando a conexão volta, mesmo que o app tenha sido
// fechado no meio.
//
// Toda foto passa por aqui, com ou sem sinal: é um caminho só. A foto
// comprimida fica no IndexedDB (o localStorage não comporta imagem) até a
// função ler-etiqueta responder. O que der errado de vez (etiqueta que a IA
// não entende, lista já finalizada) fica na conversa com o erro, para a pessoa
// tentar de novo ou descartar.

import { onlineManager } from '@tanstack/react-query'
import { useSyncExternalStore } from 'react'
import { chaves, enviarFoto, ErroDoApp, lerEtiqueta } from './api'
import { avisar } from './avisos'
import { comprimirImagem } from './imagem'
import { queryClient } from './queryClient'
import { supabase } from './supabase'

export type FotoNaFila = {
  id: string
  lista_id: string
  /** preparando: comprimindo; na_fila: esperando sinal; lendo: com a IA; erro: precisa de alguém. */
  estado: 'preparando' | 'na_fila' | 'lendo' | 'erro'
  erro: string | null
  /** Endereço temporário da miniatura. */
  previa: string
  /** Falso quando nem a foto foi preparada: aí só resta descartar. */
  podeTentar: boolean
}

type Guardada = {
  id: string
  lista_id: string
  usuario_id: string
  criada_em: number
  /** Caminho no Storage quando o envio já deu certo e só falta a leitura. */
  foto_path: string | null
  erro: string | null
  blob: Blob
}

type Entrada = FotoNaFila & Omit<Guardada, 'blob'> & { blob: Blob | null; /** Está no IndexedDB (sobrevive ao fechar o app). */ persistida: boolean }

const BANCO = 'listou'
const LOJA = 'fotos-na-fila'
const TRAVA = 'listou:fila-de-fotos'
const MAX_NA_FILA = 30
const NOVA_TENTATIVA_MS = 20_000
const ERRO_PADRAO = 'Não consegui ler a etiqueta. Tente outra foto.'

// ---------------------------------------------------------------------------
// IndexedDB. Se o navegador não deixar usar (aba anônima antiga, disco cheio),
// a fila segue só na memória: perde-se a sobrevivência ao fechar o app, nada mais.
// ---------------------------------------------------------------------------

function abrir(): Promise<IDBDatabase> {
  return new Promise((resolver, rejeitar) => {
    const pedido = indexedDB.open(BANCO, 1)
    pedido.onupgradeneeded = () => pedido.result.createObjectStore(LOJA, { keyPath: 'id' })
    pedido.onsuccess = () => resolver(pedido.result)
    pedido.onerror = () => rejeitar(pedido.error)
  })
}

async function naLoja<T>(modo: IDBTransactionMode, acao: (loja: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
  try {
    const banco = await abrir()
    return await new Promise<T>((resolver, rejeitar) => {
      const transacao = banco.transaction(LOJA, modo)
      const pedido = acao(transacao.objectStore(LOJA))
      transacao.oncomplete = () => {
        banco.close()
        resolver(pedido.result)
      }
      transacao.onerror = transacao.onabort = () => {
        banco.close()
        rejeitar(transacao.error)
      }
    })
  } catch (erro) {
    console.warn('fila de fotos sem IndexedDB', erro)
    return undefined
  }
}

const guardar = (foto: Guardada) => naLoja('readwrite', (loja) => loja.put(foto))
const apagar = (id: string) => naLoja('readwrite', (loja) => loja.delete(id))
const ler = (id: string) => naLoja<Guardada | undefined>('readonly', (loja) => loja.get(id))
const lerTodas = () => naLoja<Guardada[]>('readonly', (loja) => loja.getAll())

// ---------------------------------------------------------------------------
// Estado em memória, observado pelas telas
// ---------------------------------------------------------------------------

let fila: Entrada[] = []
const ouvintes = new Set<() => void>()

function publicar(nova: Entrada[]) {
  fila = nova
  for (const ouvinte of ouvintes) ouvinte()
}

const mudar = (id: string, mudanca: Partial<Entrada>) => publicar(fila.map((f) => (f.id === id ? { ...f, ...mudanca } : f)))

function tirar(id: string) {
  const foto = fila.find((f) => f.id === id)
  if (foto) URL.revokeObjectURL(foto.previa)
  publicar(fila.filter((f) => f.id !== id))
}

function assinar(ouvinte: () => void) {
  ouvintes.add(ouvinte)
  return () => {
    ouvintes.delete(ouvinte)
  }
}

/** Todas as fotos que ainda não viraram card, de todas as listas. */
export function useFilaDeFotos(): FotoNaFila[] {
  return useSyncExternalStore(assinar, () => fila)
}

// ---------------------------------------------------------------------------
// Processamento
// ---------------------------------------------------------------------------

let processando = false
let novaTentativa: number | undefined

/** Lê uma foto. Devolve false quando a rede caiu e não adianta seguir para a próxima. */
async function lerFoto(entrada: Entrada): Promise<boolean> {
  // Outra aba do app pode já ter lido esta foto: nesse caso ela sumiu do IndexedDB.
  const guardada = entrada.persistida ? await ler(entrada.id) : undefined
  if (entrada.persistida && guardada === undefined && (await lerTodas()) !== undefined) {
    tirar(entrada.id)
    return true
  }

  mudar(entrada.id, { estado: 'lendo', erro: null })
  try {
    let caminho = guardada?.foto_path ?? entrada.foto_path
    if (!caminho) {
      caminho = await enviarFoto(entrada.lista_id, entrada.blob as Blob)
      // Guardado antes da leitura: se ela falhar, a nova tentativa não reenvia a foto.
      mudar(entrada.id, { foto_path: caminho })
      if (guardada) await guardar({ ...guardada, foto_path: caminho })
    }
    await lerEtiqueta(entrada.lista_id, caminho)
    await apagar(entrada.id)
    tirar(entrada.id)
    void queryClient.invalidateQueries({ queryKey: chaves.mensagens(entrada.lista_id) })
    void queryClient.invalidateQueries({ queryKey: chaves.itens(entrada.lista_id) })
    return true
  } catch (erro) {
    const semRede = !navigator.onLine || (erro instanceof ErroDoApp && erro.codigo === 'rede')
    if (semRede) {
      mudar(entrada.id, { estado: 'na_fila' })
      return false
    }
    const mensagem = erro instanceof Error && erro.message ? erro.message : ERRO_PADRAO
    mudar(entrada.id, { estado: 'erro', erro: mensagem })
    const atual = await ler(entrada.id)
    if (atual) await guardar({ ...atual, erro: mensagem })
    return true
  }
}

async function processar(): Promise<void> {
  if (processando || !onlineManager.isOnline()) return
  processando = true
  window.clearTimeout(novaTentativa)
  try {
    const { data } = await supabase.auth.getSession()
    const usuarioId = data.session?.user.id
    if (!usuarioId) return

    const esvaziar = async () => {
      for (;;) {
        // A foto é enviada com a conta de quem a tirou.
        const proxima = fila.find((f) => f.estado === 'na_fila' && f.blob !== null && f.usuario_id === usuarioId)
        if (!proxima) return
        if (!(await lerFoto(proxima))) {
          // A rede caiu sem o navegador avisar: tenta de novo daqui a pouco.
          novaTentativa = window.setTimeout(() => void processar(), NOVA_TENTATIVA_MS)
          return
        }
      }
    }
    // Com o app aberto em duas abas, só uma esvazia a fila.
    if ('locks' in navigator) await navigator.locks.request(TRAVA, { ifAvailable: true }, async (trava) => (trava ? esvaziar() : undefined))
    else await esvaziar()
  } finally {
    processando = false
  }
}

// ---------------------------------------------------------------------------
// O que as telas chamam
// ---------------------------------------------------------------------------

/** Põe a foto na fila e, havendo sinal, já manda ler. */
export async function fotografarEtiqueta(listaId: string, usuarioId: string, arquivo: File): Promise<void> {
  if (fila.length >= MAX_NA_FILA) {
    avisar('Tem foto demais esperando leitura. Descarte alguma ou espere o sinal voltar.', 'erro')
    return
  }
  const base = { id: crypto.randomUUID(), lista_id: listaId, usuario_id: usuarioId, criada_em: Date.now(), foto_path: null, erro: null }
  publicar([...fila, { ...base, blob: null, persistida: false, estado: 'preparando', previa: URL.createObjectURL(arquivo), podeTentar: false }])
  try {
    const { blob } = await comprimirImagem(arquivo)
    const persistida = (await guardar({ ...base, blob })) !== undefined
    mudar(base.id, { blob, persistida, estado: 'na_fila', podeTentar: true })
  } catch (erro) {
    mudar(base.id, { estado: 'erro', erro: erro instanceof Error && erro.message ? erro.message : 'Não deu para preparar a foto.' })
    return
  }
  void processar()
}

export async function tentarFotoDeNovo(id: string): Promise<void> {
  mudar(id, { estado: 'na_fila', erro: null })
  const guardada = await ler(id)
  if (guardada) await guardar({ ...guardada, erro: null })
  void processar()
}

export async function descartarFoto(id: string): Promise<void> {
  tirar(id)
  await apagar(id)
}

/** Ao sair da conta, as fotos que esperavam leitura também saem do aparelho. */
export async function esvaziarFilaDeFotos(): Promise<void> {
  for (const foto of fila) URL.revokeObjectURL(foto.previa)
  publicar([])
  await naLoja('readwrite', (loja) => loja.clear())
}

/** Chamado uma vez, ao abrir o app: recupera o que ficou guardado e volta a ler quando houver sinal. */
export function iniciarFilaDeFotos() {
  void lerTodas().then((guardadas) => {
    if (guardadas && guardadas.length > 0) {
      const conhecidas = new Set(fila.map((f) => f.id))
      const recuperadas = guardadas
        .filter((g) => !conhecidas.has(g.id))
        .sort((a, b) => a.criada_em - b.criada_em)
        .map<Entrada>((g) => ({ ...g, persistida: true, estado: g.erro ? 'erro' : 'na_fila', previa: URL.createObjectURL(g.blob), podeTentar: true }))
      publicar([...recuperadas, ...fila])
    }
    void processar()
  })
  onlineManager.subscribe((online) => {
    if (online) void processar()
  })
  // Quem tirou a foto pode ter entrado na conta só agora.
  supabase.auth.onAuthStateChange((evento) => {
    if (evento === 'SIGNED_IN') void processar()
  })
}
