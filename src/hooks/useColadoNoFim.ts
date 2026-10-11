import { useEffect, useLayoutEffect, useRef } from 'react'

const MARGEM_PX = 80

/**
 * Mantém uma área rolável no fim, como um chat. Abre embaixo e continua
 * embaixo quando chega algo novo (`gatilho`) ou o conteúdo cresce por conta
 * própria (fotos e cartões que terminam de carregar). Se a pessoa subir para
 * ler, o hook solta e não puxa a tela de volta; ao chegar perto do fim, ele
 * cola de novo. `irParaOFim` força a descida (ex.: ao enviar uma mensagem).
 *
 * `rolagem` vai na área com overflow e `conteudo` no bloco que a preenche.
 */
export function useColadoNoFim(gatilho: unknown) {
  const rolagem = useRef<HTMLDivElement>(null)
  const conteudo = useRef<HTMLDivElement>(null)
  const colado = useRef(true)

  const descer = () => {
    const el = rolagem.current
    if (el) el.scrollTop = el.scrollHeight
  }

  useLayoutEffect(() => {
    if (colado.current) descer()
  }, [gatilho])

  const irParaOFim = () => {
    colado.current = true
    descer()
  }

  useEffect(() => {
    const bloco = conteudo.current
    if (!bloco || typeof ResizeObserver === 'undefined') return
    const observador = new ResizeObserver(() => {
      if (colado.current) descer()
    })
    observador.observe(bloco)
    return () => observador.disconnect()
  }, [])

  const aoRolar = () => {
    const el = rolagem.current
    if (el) colado.current = el.scrollHeight - el.scrollTop - el.clientHeight < MARGEM_PX
  }

  return { rolagem, conteudo, aoRolar, irParaOFim }
}
