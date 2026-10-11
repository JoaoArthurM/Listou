import { Camera, Check } from 'lucide-react'
import { useMemo, type ReactNode } from 'react'
import { useUsuario } from '@/hooks/sessao'
import { useMembros } from '@/hooks/useListas'
import { useColadoNoFim } from '@/hooks/useColadoNoFim'
import { useMensagens } from '@/hooks/useMensagens'
import { chaveDoDia } from '@/lib/datas'
import { linhaCalculo } from '@/lib/precos'
import { primeiroNome } from '@/lib/utils'
import type { Lista, Mensagem } from '@/types/app'

type HistoricoCompraProps = { lista: Lista }

const diaSemana = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' })
const hora = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' })

type Registro = { id: string; quem: 'eu' | 'assistente' | 'outro'; rotulo: string; quando: Date; corpo: ReactNode }

/** Texto de uma mensagem que não é card: o que a pessoa disse ou o que o assistente respondeu. */
function corpoDe(mensagem: Mensagem): ReactNode {
  const { dados } = mensagem
  if (dados?.tipo === 'foto') {
    return (
      <span className="flex items-center gap-2 text-muted-foreground">
        <Camera aria-hidden className="size-4 shrink-0" />
        Fotografou uma etiqueta
      </span>
    )
  }
  if (dados?.tipo === 'etiqueta') {
    const { resultado, extracao } = dados
    if (dados.estado === 'confirmado' && resultado) {
      return (
        <>
          <span className="flex items-center gap-2 font-medium">
            <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary text-white">
              <Check aria-hidden className="size-3" strokeWidth={3.5} />
            </span>
            <span className="min-w-0 break-words">{resultado.nome}</span>
          </span>
          <span className="dinheiro mt-1 block text-[0.875rem] text-muted-foreground">
            {linhaCalculo(resultado.qtd, resultado.unidade, resultado.preco_unit_centavos, resultado.faixa_aplicada, resultado.cartao)}
          </span>
        </>
      )
    }
    return (
      <span className="text-muted-foreground">
        Etiqueta {extracao.produto ? `de “${extracao.produto}”` : 'sem nome lido'} não adicionada.
      </span>
    )
  }
  if (dados?.tipo === 'proposta') {
    const situacao = dados.estado === 'confirmada' ? 'Confirmado.' : dados.estado === 'cancelada' ? 'Cancelado.' : 'Não confirmado.'
    const texto = mensagem.conteudo && mensagem.conteudo !== 'Confirma?' ? `${mensagem.conteudo} ` : ''
    return (
      <span className="whitespace-pre-line break-words">
        {texto}
        <span className="text-muted-foreground">{situacao}</span>
      </span>
    )
  }
  return <span className="whitespace-pre-line break-words">{mensagem.conteudo}</span>
}

/**
 * Chat de uma compra finalizada, em forma de histórico (tela "Plan" da
 * referência): a data na coluna da esquerda e, ao lado, um cartão por registro
 * com quem fez, o horário e o que aconteceu. Só leitura, sem campo de texto.
 */
export function HistoricoCompra({ lista }: HistoricoCompraProps) {
  const usuario = useUsuario()
  const { data: mensagens, isPending } = useMensagens(lista.id)
  const { data: membros = [] } = useMembros(lista.id)

  const dias = useMemo(() => {
    const grupos: Array<{ chave: string; data: Date; registros: Registro[] }> = []
    for (const mensagem of mensagens ?? []) {
      const quando = new Date(mensagem.criado_em)
      const quem = mensagem.papel === 'assistente' ? 'assistente' : mensagem.autor_id === usuario.id ? 'eu' : 'outro'
      const nomeDoOutro = primeiroNome(membros.find((m) => m.perfil_id === mensagem.autor_id)?.nome)
      const rotulo = quem === 'assistente' ? 'Listou' : quem === 'eu' ? 'Você' : nomeDoOutro || 'Alguém'
      const chave = chaveDoDia(quando)
      let grupo = grupos[grupos.length - 1]
      if (!grupo || grupo.chave !== chave) {
        grupo = { chave, data: quando, registros: [] }
        grupos.push(grupo)
      }
      grupo.registros.push({ id: mensagem.id, quem, rotulo, quando, corpo: corpoDe(mensagem) })
    }
    return grupos
  }, [mensagens, membros, usuario.id])

  const { rolagem, conteudo, aoRolar } = useColadoNoFim(dias.length + ':' + (mensagens?.length ?? 0))

  return (
    <div ref={rolagem} onScroll={aoRolar} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6 pt-1">
      <div ref={conteudo}>
      {isPending ? (
        <div aria-busy className="space-y-3">
          <div className="h-16 esqueleto rounded-cartao" />
          <div className="h-16 esqueleto rounded-cartao" />
        </div>
      ) : dias.length === 0 ? (
        <div className="px-1 pt-8">
          <p className="font-display text-[2.125rem] italic leading-none">Sem registros</p>
          <p className="mt-3 max-w-[20rem] text-[1rem] leading-snug text-muted-foreground">Esta compra foi finalizada sem conversa.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {dias.map((dia) => (
            <section key={dia.chave} aria-label={dia.data.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })} className="flex gap-3">
              <div className="w-10 shrink-0 pt-3 text-center text-muted-foreground">
                <p className="text-[0.875rem] capitalize leading-tight">{diaSemana.format(dia.data).replace('.', '')}</p>
                <p className="dinheiro text-[1.125rem] leading-tight text-foreground/80">{dia.data.getDate()}</p>
              </div>
              <ol className="escalonada min-w-0 flex-1 space-y-2">
                {dia.registros.map((registro) => (
                  <li key={registro.id} className="rounded-cartao bg-card px-4 py-3 shadow-cartao">
                    <p className="flex items-baseline justify-between gap-2 text-[0.8125rem]">
                      <span className={registro.quem === 'assistente' ? 'font-medium text-primary-texto' : 'font-medium text-sucesso'}>
                        {registro.rotulo}
                      </span>
                      <time dateTime={registro.quando.toISOString()} className="dinheiro text-muted-foreground">
                        {hora.format(registro.quando)}
                      </time>
                    </p>
                    <div className="mt-0.5 text-[1rem] leading-snug">{registro.corpo}</div>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}
      </div>
    </div>
  )
}
