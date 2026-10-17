import { Check, Trash2 } from 'lucide-react'
import { useRef, useState, type PointerEvent } from 'react'
import { detalheDaCompra } from '@/lib/compra'
import { formatarQuantidade, formatarReais } from '@/lib/dinheiro'
import { normalizarNome } from '@/lib/nomes'
import { cn } from '@/lib/utils'
import type { Item } from '@/types/app'

type ItemRowProps = {
  item: Item
  somenteLeitura?: boolean
  /** Nome de quem adicionou. Só vem quando a lista é dividida com alguém. */
  quemAdicionou?: string | null
  /** "R$ 4,69" ou "R$ 5,99 o kg": quanto custou na compra anterior. Só para item ainda não comprado. */
  ultimoPreco?: string | null
  aoAlternar: (item: Item) => void
  aoAbrir: (item: Item) => void
  /** Deslizar a linha para a direita, até o fim, exclui o item. */
  aoExcluir?: (item: Item) => void
}

// Quanto da largura precisa ser percorrido para a exclusão valer ao soltar.
const FRACAO_PARA_EXCLUIR = 0.45
const MINIMO_PARA_EXCLUIR_PX = 120

/** Linha do checklist: círculo à esquerda marca, o resto da linha abre a edição. */
export function ItemRow({ item, somenteLeitura = false, quemAdicionou, ultimoPreco, aoAlternar, aoAbrir, aoExcluir }: ItemRowProps) {
  // A animação do check só toca quando o usuário marca, não a cada vez que a lista é desenhada.
  const [recemMarcado, setRecemMarcado] = useState(false)
  const compra = item.comprado ? (detalheDaCompra(item) ?? 'sem preço') : null
  const anterior = !item.comprado && ultimoPreco ? `da última vez ${ultimoPreco}` : null
  const detalhe = [compra, anterior, quemAdicionou ? `${quemAdicionou} adicionou` : null].filter(Boolean).join(' · ') || null
  const planejado = item.qtd_planejada === null ? null : formatarQuantidade(item.qtd_planejada, item.unidade)

  // Deslizar para a direita: a linha acompanha o dedo, o vermelho aparece por
  // trás e, soltando depois do limite, o item sai. Rolar na vertical segue normal.
  const podeDeslizar = !somenteLeitura && aoExcluir !== undefined
  const [deslocamento, setDeslocamento] = useState(0)
  const [solto, setSolto] = useState(false)
  const gesto = useRef<{ x: number; y: number; id: number; horizontal: boolean | null } | null>(null)
  const arrastou = useRef(false)
  const linhaRef = useRef<HTMLLIElement>(null)

  const limite = () => Math.max(MINIMO_PARA_EXCLUIR_PX, (linhaRef.current?.offsetWidth ?? 0) * FRACAO_PARA_EXCLUIR)

  function aoTocar(evento: PointerEvent<HTMLLIElement>) {
    if (!podeDeslizar || solto) return
    gesto.current = { x: evento.clientX, y: evento.clientY, id: evento.pointerId, horizontal: null }
    arrastou.current = false
  }

  function aoMover(evento: PointerEvent<HTMLLIElement>) {
    const g = gesto.current
    if (!g || g.id !== evento.pointerId) return
    const dx = evento.clientX - g.x
    const dy = evento.clientY - g.y
    if (g.horizontal === null) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
      // Só vale o gesto que começa mais para o lado que para cima ou para baixo.
      g.horizontal = Math.abs(dx) > Math.abs(dy) * 1.5
      if (g.horizontal) evento.currentTarget.setPointerCapture(evento.pointerId)
    }
    if (!g.horizontal) return
    arrastou.current = true
    setDeslocamento(Math.max(0, dx))
  }

  function aoSoltar(evento: PointerEvent<HTMLLIElement>) {
    const g = gesto.current
    if (!g || g.id !== evento.pointerId) return
    gesto.current = null
    if (!g.horizontal) return
    if (deslocamento >= limite()) {
      setSolto(true)
      setDeslocamento(linhaRef.current?.offsetWidth ?? 600)
      window.setTimeout(() => aoExcluir?.(item), 180)
    } else {
      setDeslocamento(0)
    }
  }

  const passou = deslocamento >= limite()

  return (
    // O divisor é recuado dos dois lados, como no checklist da referência.
    <li
      ref={linhaRef}
      data-item={item.id}
      onPointerDown={aoTocar}
      onPointerMove={aoMover}
      onPointerUp={aoSoltar}
      onPointerCancel={aoSoltar}
      // Depois de arrastar, o toque que o navegador gera não pode marcar nem abrir o item.
      onClickCapture={(evento) => {
        if (arrastou.current) {
          evento.preventDefault()
          evento.stopPropagation()
          arrastou.current = false
        }
      }}
      className={cn(
        'relative flex items-stretch overflow-hidden after:absolute after:inset-x-4 after:bottom-0 after:h-px after:bg-border last:after:hidden',
        podeDeslizar && '[touch-action:pan-y]',
      )}
    >
      {podeDeslizar && deslocamento > 0 ? (
        <span
          aria-hidden
          style={{ width: deslocamento }}
          className="absolute inset-y-0 left-0 flex items-center bg-destructive pl-5 text-destructive-foreground"
        >
          <Trash2 className={cn('size-5 transition-transform duration-150', passou && 'scale-125')} />
        </span>
      ) : null}
      <div
        style={{ transform: `translateX(${deslocamento}px)` }}
        className={cn('relative flex min-w-0 flex-1 items-stretch', gesto.current === null && 'transition-transform duration-200')}
      >
        <button
          type="button"
          role="checkbox"
          aria-checked={item.comprado}
          aria-label={normalizarNome(item.nome)}
          disabled={somenteLeitura}
          onClick={() => {
            setRecemMarcado(!item.comprado)
            aoAlternar(item)
          }}
          className="grid w-12 shrink-0 place-items-center rounded-2xl disabled:pointer-events-none"
        >
          <span
            className={cn(
              'grid size-6 place-items-center rounded-full border-[1.5px] transition-colors duration-200',
              item.comprado ? 'border-primary bg-primary text-white' : 'border-controle',
              item.comprado && recemMarcado && 'animate-marcar',
            )}
          >
            {item.comprado ? <Check aria-hidden className="size-3.5" strokeWidth={3.25} /> : null}
          </span>
        </button>

        <button
          type="button"
          onClick={() => aoAbrir(item)}
          className="flex min-h-[3.25rem] min-w-0 flex-1 items-center justify-between gap-3 rounded-2xl py-2 pr-4 text-left"
        >
          <span className="sr-only">Editar: </span>
          <span className="min-w-0">
            <span
              className={cn(
                'block truncate text-[1rem] leading-snug transition-colors duration-200',
                item.comprado && 'text-muted-foreground',
              )}
            >
              {item.comprado ? <span className="risco-caneta">{normalizarNome(item.nome)}</span> : normalizarNome(item.nome)}
            </span>
            {detalhe ? <span className="dinheiro mt-0.5 block truncate text-[0.8125rem] text-muted-foreground">{detalhe}</span> : null}
          </span>
          <span className={cn('dinheiro shrink-0 text-[0.875rem]', item.comprado ? 'font-medium text-foreground' : 'text-muted-foreground')}>
            {item.comprado
              ? item.total_centavos === null
                ? null
                : formatarReais(item.total_centavos)
              : planejado
                ? `${planejado}${item.unidade === 'un' ? ' un' : ''}`
                : null}
          </span>
        </button>
      </div>
    </li>
  )
}
