import { useEffect, useRef } from 'react'
import { useAtualizarLista, useListas } from '@/hooks/useListas'
import { avisar } from '@/lib/avisos'
import { mercadoConhecidoPerto, type CompraNoMapa } from '@/lib/mapa'
import { posicaoAtual } from '@/lib/mercados'
import type { Lista } from '@/types/app'

/**
 * Lista ativa sem mercado, aberta onde a pessoa já comprou: usa o nome desse
 * mercado. Só preenche campo vazio (nunca troca um nome escrito) e só tenta
 * uma vez por lista nesta sessão, para não pedir localização a cada abertura.
 */
export function useMercadoPeloLocal(lista: Lista | undefined) {
  const { data: finalizadas } = useListas('finalizada')
  const atualizar = useAtualizarLista(lista?.id ?? '')
  const tentou = useRef(new Set<string>())

  const precisa = !!lista && lista.status === 'ativa' && !lista.mercado?.trim()
  const id = lista?.id
  const pronto = precisa && finalizadas !== undefined

  useEffect(() => {
    if (!pronto || !id || tentou.current.has(id)) return
    tentou.current.add(id)

    const compras: CompraNoMapa[] = (finalizadas ?? []).flatMap((l) =>
      l.mercado_lat === null || l.mercado_lng === null
        ? []
        : [{ id: l.id, nome: l.nome, mercado: l.mercado, lat: l.mercado_lat, lng: l.mercado_lng, quando: l.finalizada_em ?? l.criado_em, total_centavos: l.resumo.total_centavos }],
    )
    if (compras.length === 0) return

    let cancelado = false
    void posicaoAtual(6000).then((ponto) => {
      if (cancelado || !ponto) return
      const nome = mercadoConhecidoPerto(compras, ponto)
      if (!nome) return
      atualizar.mutate({ mercado: nome }, { onSuccess: () => avisar(`Mercado: ${nome}, pelo local onde você já comprou.`, 'info') })
    })
    return () => {
      cancelado = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pronto, id])
}
