import { useMemo } from 'react'
import { matrizQr } from '@/lib/qr'

const MARGEM = 4 // módulos de zona de silêncio exigidos pela especificação do QR

/**
 * QR sempre preto sobre branco, mesmo no modo escuro: leitores esperam esse
 * contraste e muitos não leem QR invertido.
 */
export function QrCodigo({ conteudo, rotulo }: { conteudo: string; rotulo: string }) {
  const { lado, caminho } = useMemo(() => {
    const matriz = matrizQr(conteudo)
    let d = ''
    matriz.forEach((linha, y) => {
      let x = 0
      while (x < linha.length) {
        if (!linha[x]) {
          x++
          continue
        }
        const inicio = x
        while (x < linha.length && linha[x]) x++
        d += `M${inicio + MARGEM} ${y + MARGEM}h${x - inicio}v1h${-(x - inicio)}z`
      }
    })
    return { lado: matriz.length + MARGEM * 2, caminho: d }
  }, [conteudo])

  return (
    <svg
      role="img"
      aria-label={rotulo}
      viewBox={`0 0 ${lado} ${lado}`}
      shapeRendering="crispEdges"
      className="mx-auto aspect-square w-full max-w-[14rem] rounded-2xl bg-white"
    >
      <path d={caminho} fill="#000" />
    </svg>
  )
}
