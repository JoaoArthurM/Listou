import { Button } from '@/components/ui/button'
import { useAtualizarItem, useRemoverItem } from '@/hooks/useItens'
import { useAtualizarCard } from '@/hooks/useMensagens'
import { linhaCalculo } from '@/lib/precos'
import { fecharTeclado } from '@/lib/teclado'
import type { AcaoProposta, DadosProposta, Item } from '@/types/app'

type PropostaCardProps = {
  mensagemId: string
  dados: DadosProposta
  listaId: string
  itens: Item[]
  somenteLeitura: boolean
  /** O que o assistente disse junto da proposta: aparece no mesmo cartão. */
  texto?: string
}

function descrever(acao: AcaoProposta): string {
  if (acao.tipo === 'remover_item') return `Remover “${acao.nome}” da lista`
  if (acao.tipo === 'desmarcar_comprado') return `Tirar “${acao.nome}” do carrinho`
  return `Marcar “${acao.nome}”: ${linhaCalculo(acao.qtd, acao.unidade, acao.preco_centavos, 'manual')}`
}

/**
 * Ações pedidas por texto que mexem em dados já existentes (remover,
 * desmarcar, marcar com preço) chegam como proposta: só rodam depois que
 * alguém confirma aqui (CLAUDE.md, seção 6.2).
 */
export function PropostaCard({ mensagemId, dados, listaId, itens, somenteLeitura, texto }: PropostaCardProps) {
  const atualizar = useAtualizarItem()
  const remover = useRemoverItem()
  const atualizarCard = useAtualizarCard(listaId)
  const pendente = dados.estado === 'pendente' && !somenteLeitura

  function confirmar() {
    fecharTeclado()
    for (const acao of dados.acoes) {
      // O item pode ter sido removido pelo outro aparelho enquanto a proposta esperava.
      if (!itens.some((i) => i.id === acao.item_id)) continue
      if (acao.tipo === 'remover_item') {
        remover.mutate({ id: acao.item_id, lista_id: listaId })
      } else if (acao.tipo === 'desmarcar_comprado') {
        atualizar.mutate({ id: acao.item_id, lista_id: listaId, patch: { comprado: false } })
      } else {
        atualizar.mutate({
          id: acao.item_id,
          lista_id: listaId,
          patch: {
            comprado: true,
            qtd_comprada: acao.qtd,
            preco_unit_centavos: acao.preco_centavos,
            faixa_aplicada: 'manual',
            origem_preco: 'manual',
          },
        })
      }
    }
    atualizarCard.mutate({ mensagemId, dados: { ...dados, estado: 'confirmada' } })
  }

  // Confirmada e depois desfeita na lista (item tirado do carrinho, ou de volta
  // à lista): o chat riscaria de vermelho, como quem corrige a lápis.
  const desfeita = (acao: AcaoProposta): boolean => {
    if (dados.estado !== 'confirmada' || itens.length === 0) return false
    const item = itens.find((i) => i.id === acao.item_id)
    if (acao.tipo === 'marcar_comprado') return !item || !item.comprado
    if (acao.tipo === 'desmarcar_comprado') return !!item && item.comprado
    return !!item
  }
  const todasDesfeitas = dados.estado === 'confirmada' && dados.acoes.length > 0 && dados.acoes.every(desfeita)

  return (
    <div className="rounded-cartao border border-border bg-card p-4 shadow-cartao">
      {texto ? <p className="mb-2.5 whitespace-pre-line text-[1rem] leading-snug text-muted-foreground">{texto}</p> : null}
      <ul className="space-y-1.5">
        {dados.acoes.map((acao, i) => (
          <li key={i} className="dinheiro whitespace-normal text-[1rem] leading-snug">
            {desfeita(acao) ? <span className="risco-caneta risco-caneta-vermelho">{descrever(acao)}</span> : descrever(acao)}
          </li>
        ))}
      </ul>
      {pendente ? (
        <div className="mt-3.5 flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="flex-1"
            onClick={() => {
              fecharTeclado()
              atualizarCard.mutate({ mensagemId, dados: { ...dados, estado: 'cancelada' } })
            }}
          >
            Cancelar
          </Button>
          <Button size="sm" className="flex-1" onClick={confirmar}>
            Confirmar
          </Button>
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">
          {todasDesfeitas ? 'Desfeito na lista.' : dados.estado === 'confirmada' ? 'Confirmado.' : dados.estado === 'cancelada' ? 'Cancelado.' : 'Não confirmado.'}
        </p>
      )}
    </div>
  )
}
