import type { SVGProps } from 'react'

/** Marca do assistente: uma cesta de compras com o "feito" dentro. Traço simples, para ler bem em 16px. */
export function IconeListou(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <path d="M8 9l3-5.5M16 9l-3-5.5" />
      <path d="M2.75 9h18.5" />
      <path d="M4.75 9l1.3 8.6a2.4 2.4 0 0 0 2.4 2.05h7.1a2.4 2.4 0 0 0 2.4-2.05L19.25 9" />
      <path d="M9.3 14.3l2 2 3.5-3.7" />
    </svg>
  )
}
