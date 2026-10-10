import { useId } from 'react'

// Hexágono "deitado" (topo plano), como na referência: lado de 40px dá uma peça
// de 80 × 69,28. A grade repete a cada 120px na horizontal (uma coluna alinhada
// e uma coluna descida meia peça) e a cada 69,28px na vertical.
const LADO = 40
const ALTURA = Math.sqrt(3) * LADO
const MEIA = ALTURA / 2
const n = (v: number) => Number(v.toFixed(3))

const PECA = `M0 ${n(MEIA)} ${LADO / 2} 0h${LADO}l${LADO / 2} ${n(MEIA)}-${LADO / 2} ${n(MEIA)}H${LADO / 2}z`
// Metades das peças vizinhas que aparecem dentro do mesmo bloco de repetição.
const METADES_DE_CIMA = `M0 0h${LADO / 2}L0 ${n(MEIA)}zM${LADO * 1.5} 0h${LADO * 1.5}v${n(MEIA)}H${LADO * 2}z`
const METADES_DE_BAIXO = `M0 ${n(MEIA)}l${LADO / 2} ${n(MEIA)}H0zM${LADO * 2} ${n(MEIA)}h${LADO}v${n(MEIA)}H${LADO * 1.5}z`
const JUNTAS = `${PECA}M${LADO * 2} ${n(MEIA)}h${LADO}`

export type Relevo = { coluna: number; linha: number }

/**
 * Colmeia de fundo da folha, redesenhada a partir da referência: peças
 * deitadas em baixo-relevo (um nada mais claras no topo, juntas um tom
 * abaixo do fundo), quase imperceptíveis. A peça saltada da referência é
 * opcional (prop "relevo") e fica desligada por padrão.
 * É SVG com <pattern>, e não imagem de fundo repetida, para a peça saltada
 * encaixar exatamente na grade e as cores virem dos tokens do tema.
 */
export function Colmeia({ relevo = null }: { relevo?: Relevo | null }) {
  // O useId devolve ":r1:"; os dois-pontos atrapalham referências url(#id).
  const id = `colmeia${useId().replace(/:/g, '')}`

  // Cada peça clareia de cima para baixo; y1 é onde a peça começa dentro do bloco.
  const luz = (nome: string, y1: number) => (
    <linearGradient id={`${id}-${nome}`} gradientUnits="userSpaceOnUse" x1="0" y1={n(y1)} x2="0" y2={n(y1 + ALTURA)}>
      <stop style={{ stopColor: 'hsl(var(--colmeia-luz))', stopOpacity: 'var(--colmeia-forca)' }} />
      <stop offset="1" style={{ stopColor: 'hsl(var(--colmeia-luz))', stopOpacity: 0 }} />
    </linearGradient>
  )

  return (
    <svg aria-hidden className="pointer-events-none absolute inset-0 -z-10 size-full">
      <defs>
        {luz('inteira', 0)}
        {luz('cima', -MEIA)}
        {luz('baixo', MEIA)}
        <pattern id={id} width={LADO * 3} height={n(ALTURA)} patternUnits="userSpaceOnUse">
          <path d={PECA} fill={`url(#${id}-inteira)`} />
          <path d={METADES_DE_CIMA} fill={`url(#${id}-cima)`} />
          <path d={METADES_DE_BAIXO} fill={`url(#${id}-baixo)`} />
          <path d={JUNTAS} fill="none" style={{ stroke: 'hsl(var(--colmeia-junta))' }} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
      {relevo ? (
        <path
          d={PECA}
          transform={`translate(${relevo.coluna * LADO * 1.5} ${n(relevo.linha * ALTURA + (relevo.coluna % 2) * MEIA)})`}
          style={{
            fill: 'hsl(var(--colmeia-relevo))',
            filter: 'drop-shadow(0 8px 8px hsl(var(--sombra) / var(--colmeia-sombra)))',
          }}
        />
      ) : null}
    </svg>
  )
}
