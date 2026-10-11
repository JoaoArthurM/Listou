// Mantém o app encaixado na área realmente visível quando o teclado abre.
//
// No iPhone o teclado cobre a página sem redimensionar o layout, então um
// campo fixo no rodapé (o do chat) ficaria escondido atrás dele. O
// visualViewport diz quanto sobrou de tela; publicamos isso em variáveis CSS
// e a moldura (src/index.css) se ajusta. No Android o meta
// interactive-widget=resizes-content (index.html) já redimensiona, e as variáveis só
// acompanham.

const LIMIAR_TECLADO = 140

/**
 * Fecha o teclado do celular tirando o foco do campo ativo. A tela é pequena e,
 * depois de enviar, fotografar ou confirmar, o teclado só cobre a conversa.
 * Botões e links não abrem teclado, então só campos de texto são soltos.
 */
export function fecharTeclado() {
  const ativo = document.activeElement
  if (!(ativo instanceof HTMLElement)) return
  if (ativo.matches('input, textarea, select, [contenteditable="true"]')) ativo.blur()
}

export function acompanharTeclado() {
  const vv = window.visualViewport
  if (!vv) return

  const raiz = document.documentElement
  let alturaCheia = window.innerHeight

  const atualizar = () => {
    // Girar o aparelho ou fechar o teclado devolve a altura cheia.
    alturaCheia = Math.max(alturaCheia, window.innerHeight, vv.height)
    raiz.style.setProperty('--altura-visivel', `${vv.height}px`)
    raiz.style.setProperty('--vv-topo', `${vv.offsetTop}px`)
    raiz.style.setProperty('--teclado', `${Math.max(0, window.innerHeight - vv.height - vv.offsetTop)}px`)
    raiz.classList.toggle('teclado-aberto', alturaCheia - vv.height > LIMIAR_TECLADO)
  }

  vv.addEventListener('resize', atualizar)
  vv.addEventListener('scroll', atualizar)
  window.addEventListener('orientationchange', () => {
    alturaCheia = 0
    atualizar()
  })
  atualizar()
}
