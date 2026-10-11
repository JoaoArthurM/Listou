import { Check, Copy, Share2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Dica } from '@/components/layout/Dica'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/input'
import { Sheet } from '@/components/ui/sheet'
import { useUsuario } from '@/hooks/sessao'
import {
  useAtualizarLista,
  useCriarConvite,
  useExcluirLista,
  useMembros,
  useResponderCartao,
  useSairDaLista,
} from '@/hooks/useListas'
import { avisar } from '@/lib/avisos'
import { formatarReais, formatarValor, parseDinheiro } from '@/lib/dinheiro'
import { nomeCartao } from '@/lib/precos'
import { resumirCompra } from '@/lib/resumo'
import { navegar } from '@/lib/rota'
import { listarNomes, plural } from '@/lib/utils'
import type { Item, Lista } from '@/types/app'

type ListaConfigSheetProps = { lista: Lista; itens: Item[]; aoFechar: () => void }

// "Leite, Café, Pão e mais 3": nomes demais não cabem numa frase.
function algunsNomes(nomes: string[]): string {
  if (nomes.length <= 4) return listarNomes(nomes)
  return `${nomes.slice(0, 3).join(', ')} e mais ${nomes.length - 3}`
}

const mensagem = (erro: unknown) => (erro instanceof Error ? erro.message : 'Algo deu errado. Tente de novo.')

/** Opções da lista: convidar, editar dados, cartões da loja, finalizar e sair. */
export function ListaConfigSheet({ lista, itens, aoFechar }: ListaConfigSheetProps) {
  const usuario = useUsuario()
  const { data: membros = [] } = useMembros(lista.id)
  const atualizar = useAtualizarLista(lista.id)
  const criarConvite = useCriarConvite()
  const excluir = useExcluirLista()
  const sair = useSairDaLista()
  const responderCartao = useResponderCartao(lista.id)

  const [nome, setNome] = useState(lista.nome)
  const [mercado, setMercado] = useState(lista.mercado ?? '')
  const [orcamento, setOrcamento] = useState(lista.orcamento_centavos === null ? '' : formatarValor(lista.orcamento_centavos))
  const [erro, setErro] = useState<string | null>(null)
  const [codigo, setCodigo] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)
  const [confirmarSaida, setConfirmarSaida] = useState(false)
  // Antes de fechar a compra, a pessoa vê o resumo dela.
  const [resumindo, setResumindo] = useState(false)

  const souDono = membros.some((m) => m.perfil_id === usuario.id && m.papel === 'dono') || lista.criado_por === usuario.id
  const outros = membros.filter((m) => m.perfil_id !== usuario.id).map((m) => m.nome)
  const finalizada = lista.status === 'finalizada'
  const cartoes = [
    ...lista.cartoes.map((c) => ({ nome: c, tem: true })),
    ...lista.cartoes_recusados.map((c) => ({ nome: c, tem: false })),
  ]

  function salvar(evento: FormEvent) {
    evento.preventDefault()
    const nomeLimpo = nome.trim()
    if (!nomeLimpo) return setErro('Dê um nome à lista.')
    const valor = orcamento.trim() === '' ? null : parseDinheiro(orcamento)
    if (orcamento.trim() !== '' && valor === null) return setErro('Confira o orçamento: use o formato 250,00.')
    setErro(null)
    atualizar.mutate(
      { nome: nomeLimpo, mercado: mercado.trim() || null, orcamento_centavos: valor },
      { onSuccess: () => avisar('Lista atualizada.', 'sucesso'), onError: (e) => setErro(mensagem(e)) },
    )
  }

  function gerarConvite() {
    criarConvite.mutate(lista.id, { onSuccess: setCodigo, onError: (e) => avisar(mensagem(e), 'erro') })
  }

  async function compartilhar() {
    if (!codigo) return
    const link = `${window.location.origin}/entrar/${codigo}`
    const texto = `Entre na lista “${lista.nome}” no Listou com o código ${codigo}`
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Listou', text: texto, url: link })
        return
      }
      await navigator.clipboard.writeText(`${texto}: ${link}`)
      setCopiado(true)
      window.setTimeout(() => setCopiado(false), 2500)
    } catch {
      // usuário fechou o painel de compartilhar: nada a fazer
    }
  }

  function mudarStatus() {
    atualizar.mutate(
      { status: finalizada ? 'ativa' : 'finalizada' },
      {
        onSuccess: () => {
          aoFechar()
          if (finalizada) return avisar('Lista reaberta.', 'sucesso')
          avisar('Compra finalizada. Ela está no Histórico.', 'sucesso')
          navegar('/historico', { substituir: true })
        },
        onError: (e) => avisar(mensagem(e), 'erro'),
      },
    )
  }

  function sairOuExcluir() {
    if (!confirmarSaida) return setConfirmarSaida(true)
    const opcoes = {
      onSuccess: () => {
        aoFechar()
        navegar('/', { substituir: true })
      },
      onError: (e: unknown) => avisar(mensagem(e), 'erro'),
    }
    if (souDono) excluir.mutate(lista.id, opcoes)
    else sair.mutate(lista.id, opcoes)
  }

  if (resumindo) {
    const resumo = resumirCompra(itens)
    const { economia } = resumo
    return (
      <Sheet open onOpenChange={(aberta) => !aberta && aoFechar()} title="Finalizar compra" description="Confira o resumo antes de fechar.">
        <div className="space-y-5">
          <dl className="rounded-cartao bg-card px-4 shadow-cartao">
            <div className="flex min-h-12 items-center justify-between gap-3 border-b border-border">
              <dt>Itens no carrinho</dt>
              <dd className="dinheiro">
                {resumo.comprados} de {itens.length}
              </dd>
            </div>
            {economia.atacado > 0 ? (
              <div className="flex min-h-12 items-center justify-between gap-3 border-b border-border">
                <dt>Economia com atacado</dt>
                <dd className="dinheiro text-sucesso">{formatarReais(economia.atacado)}</dd>
              </div>
            ) : null}
            {economia.cartao > 0 ? (
              <div className="flex min-h-12 items-center justify-between gap-3 border-b border-border">
                <dt>Economia com cartão</dt>
                <dd className="dinheiro text-sucesso">{formatarReais(economia.cartao)}</dd>
              </div>
            ) : null}
            <div className="flex min-h-14 items-center justify-between gap-3">
              <dt className="font-medium">Total do carrinho</dt>
              <dd className="dinheiro text-[1.375rem] font-semibold tracking-[-0.02em]">{formatarReais(resumo.total_centavos)}</dd>
            </div>
          </dl>

          {economia.total > 0 ? (
            <p className="text-[0.9375rem] leading-snug text-muted-foreground">
              A economia é a diferença para o preço de varejo das mesmas etiquetas: no varejo esta compra sairia por{' '}
              <span className="dinheiro">{formatarReais(resumo.total_centavos + economia.total)}</span>.
            </p>
          ) : null}

          {resumo.semPreco.length > 0 ? (
            <Dica>
              {plural(resumo.semPreco.length, 'item está', 'itens estão')} no carrinho sem preço e {resumo.semPreco.length === 1 ? 'fica' : 'ficam'} fora do total:{' '}
              {algunsNomes(resumo.semPreco)}. Para incluir, volte e informe o preço em cada um.
            </Dica>
          ) : null}
          {resumo.naoComprados.length > 0 ? (
            <p className="text-[0.9375rem] leading-snug text-muted-foreground">
              {plural(resumo.naoComprados.length, 'item ficou', 'itens ficaram')} sem comprar: {algunsNomes(resumo.naoComprados)}.
            </p>
          ) : null}

          <div className="space-y-3 pb-1">
            <Button className="w-full" disabled={atualizar.isPending} onClick={mudarStatus}>
              Finalizar compra
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => setResumindo(false)}>
              Voltar
            </Button>
          </div>
        </div>
      </Sheet>
    )
  }

  return (
    <Sheet
      open
      onOpenChange={(aberta) => !aberta && aoFechar()}
      title="Opções da lista"
      description={outros.length > 0 ? `Você divide esta lista com ${listarNomes(outros)}.` : 'Por enquanto só você está nesta lista.'}
    >
      <div className="space-y-7">
        <section aria-labelledby="titulo-convite">
          <h3 id="titulo-convite" className="text-[1.0625rem] font-medium">
            Convidar
          </h3>
          {codigo ? (
            <div className="mt-2.5 rounded-cartao bg-card p-4 shadow-cartao">
              <p className="text-[0.9375rem] text-muted-foreground">Código válido por 7 dias</p>
              <p className="dinheiro mt-1.5 select-all text-[2rem] font-semibold leading-none tracking-[0.18em]">{codigo}</p>
              <Button variant="dark" className="mt-4 w-full" onClick={() => void compartilhar()}>
                {copiado ? <Check className="size-5" /> : 'share' in navigator ? <Share2 className="size-5" /> : <Copy className="size-5" />}
                {copiado ? 'Copiado' : 'share' in navigator ? 'Compartilhar convite' : 'Copiar convite'}
              </Button>
            </div>
          ) : (
            <>
              <p className="mt-1 text-[0.9375rem] leading-snug text-muted-foreground">
                Quem entrar vê e edita a lista junto com você, em tempo real.
              </p>
              <Button variant="secondary" className="mt-3 w-full" disabled={criarConvite.isPending} onClick={gerarConvite}>
                Gerar código de convite
              </Button>
            </>
          )}
        </section>

        <form onSubmit={salvar} className="space-y-4" noValidate>
          <h3 className="text-[1.0625rem] font-medium">Dados da lista</h3>
          <Field label="Nome" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={60} autoComplete="off" />
          <Field label="Mercado" hint="Opcional" value={mercado} onChange={(e) => setMercado(e.target.value)} maxLength={60} placeholder="Max Atacadista" autoComplete="off" />
          <Field label="Orçamento (R$)" hint="Opcional. O rodapé mostra quanto resta ou quanto passou." value={orcamento} onChange={(e) => setOrcamento(e.target.value)} inputMode="decimal" placeholder="250,00" className="dinheiro" />
          {erro ? (
            <p role="alert" className="text-sm text-destructive">
              {erro}
            </p>
          ) : null}
          <Button type="submit" variant="secondary" className="w-full" disabled={atualizar.isPending}>
            Salvar dados
          </Button>
        </form>

        {cartoes.length > 0 ? (
          <section aria-labelledby="titulo-cartoes">
            <h3 id="titulo-cartoes" className="text-[1.0625rem] font-medium">
              Cartões da loja
            </h3>
            <p className="mt-1 text-[0.9375rem] leading-snug text-muted-foreground">
              O preço de cartão só entra na conta para os cartões que vocês têm.
            </p>
            <ul className="mt-2.5 rounded-cartao bg-card shadow-cartao">
              {cartoes.map((cartao) => (
                <li key={cartao.nome} className="flex min-h-14 items-center justify-between gap-3 border-b border-border px-4 last:border-b-0">
                  <span className="min-w-0 truncate text-[1.0625rem]">{nomeCartao(cartao.nome)}</span>
                  <Button
                    variant={cartao.tem ? 'dark' : 'secondary'}
                    size="sm"
                    aria-pressed={cartao.tem}
                    onClick={() => responderCartao.mutate({ cartao: cartao.nome, tem: !cartao.tem })}
                  >
                    {cartao.tem ? 'Temos' : 'Não temos'}
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="space-y-3 pb-1">
          <Button className="w-full" disabled={atualizar.isPending} onClick={finalizada ? mudarStatus : () => setResumindo(true)}>
            {finalizada ? 'Reabrir lista' : 'Finalizar compra'}
          </Button>
          <Button variant={confirmarSaida ? 'destructive' : 'ghost'} className={confirmarSaida ? 'w-full' : 'w-full text-destructive'} onClick={sairOuExcluir}>
            {confirmarSaida
              ? souDono
                ? 'Excluir para todo mundo'
                : 'Sair mesmo da lista'
              : souDono
                ? 'Excluir lista'
                : 'Sair da lista'}
          </Button>
        </section>
      </div>
    </Sheet>
  )
}
