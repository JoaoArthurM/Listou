import { ArrowDown } from 'lucide-react'

/** Distância do fim, em px, a partir da qual o botão aparece. */
export const DISTANCIA_DO_BOTAO = 320

/** Quem subiu na conversa volta ao fim com um toque, como no Telegram. Fica no canto direito da área de rolagem. */
export function BotaoIrAoFim({ visivel, aoTocar }: { visivel: boolean; aoTocar: () => void }) {
  if (!visivel) return null
  return (
    <button
      type="button"
      aria-label="Ir para o fim"
      onClick={aoTocar}
      className="absolute bottom-3 right-4 z-20 grid size-11 animate-pop place-items-center rounded-full border border-border bg-card text-foreground shadow-flutuante active:scale-95"
    >
      <ArrowDown aria-hidden className="size-5" />
    </button>
  )
}
