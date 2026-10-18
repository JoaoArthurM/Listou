import type { Config } from 'tailwindcss'
import animate from 'tailwindcss-animate'

// As cores não moram aqui: todas apontam para as variáveis de src/index.css,
// que é o único lugar onde a identidade visual (claro e escuro) é definida.
const cor = (nome: string) => `hsl(var(--${nome}) / <alpha-value>)`

export default {
  darkMode: 'class',
  // No toque, :hover fica "grudado" depois do tap; só vale onde existe ponteiro.
  future: { hoverOnlyWhenSupported: true },
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        moldura: {
          DEFAULT: cor('moldura'),
          foreground: cor('moldura-foreground'),
          muted: cor('moldura-muted'),
          borda: cor('moldura-borda'),
          cartao: cor('moldura-cartao'),
        },
        background: cor('background'),
        foreground: cor('foreground'),
        card: { DEFAULT: cor('card'), foreground: cor('foreground') },
        muted: { DEFAULT: cor('muted'), foreground: cor('muted-foreground') },
        border: cor('border'),
        controle: cor('controle'),
        ring: cor('ring'),
        primary: {
          DEFAULT: cor('primary'),
          foreground: cor('primary-foreground'),
          texto: cor('primary-texto'),
        },
        dica: { DEFAULT: cor('dica'), borda: cor('dica-borda'), foreground: cor('dica-foreground') },
        destaque: { DEFAULT: cor('destaque'), foreground: cor('destaque-foreground') },
        verde: cor('verde'),
        sucesso: cor('sucesso'),
        destructive: { DEFAULT: cor('destructive'), foreground: cor('destructive-foreground') },
      },
      fontFamily: {
        sans: ['"Inter Tight"', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['"Instrument Serif"', 'ui-serif', 'Georgia', 'serif'],
      },
      borderRadius: {
        folha: 'var(--raio-folha)',
        cartao: 'var(--raio-cartao)',
        campo: 'var(--raio-campo)',
      },
      boxShadow: {
        cartao: '0 1px 2px hsl(var(--sombra) / 0.04), 0 10px 24px -14px hsl(var(--sombra) / 0.16)',
        flutuante: '0 2px 4px hsl(var(--sombra) / 0.06), 0 18px 40px -16px hsl(var(--sombra) / 0.28)',
      },
      transitionTimingFunction: {
        saida: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      keyframes: {
        'folha-sobe': {
          from: { transform: 'translateY(100%)' },
          to: { transform: 'translateY(0)' },
        },
        'folha-desce': {
          from: { transform: 'translateY(0)' },
          to: { transform: 'translateY(100%)' },
        },
        surge: {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        marcar: {
          '0%': { transform: 'scale(0.6)' },
          '60%': { transform: 'scale(1.12)' },
          '100%': { transform: 'scale(1)' },
        },
        pulso: {
          '0%, 100%': { opacity: '0.35' },
          '50%': { opacity: '1' },
        },
        // Pontos de "digitando": sobem um de cada vez.
        onda: {
          '0%, 60%, 100%': { transform: 'translateY(0)', opacity: '0.45' },
          '30%': { transform: 'translateY(-4px)', opacity: '1' },
        },
        // Barras de sinal: piscam uma vez a cada sinal de vida da conexão.
        sinal: {
          '0%': { opacity: '0.3', transform: 'scaleY(0.6)' },
          '60%': { opacity: '1', transform: 'scaleY(1.15)' },
          '100%': { opacity: '1', transform: 'scaleY(1)' },
        },
        // Avatar do assistente: o anel gira.
        gira: {
          to: { transform: 'rotate(360deg)' },
        },
        varredura: {
          from: { transform: 'translateY(-100%)' },
          to: { transform: 'translateY(100%)' },
        },
        // Item caindo na cesta da tela de carregamento: some ao passar da borda.
        // Entrada com um leve "estouro": botões que trocam de função e valores que mudam.
        pop: {
          '0%': { transform: 'scale(0.55)', opacity: '0' },
          '60%': { transform: 'scale(1.12)', opacity: '1' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        // Troca de tela: só aparece, sem mover o conteúdo.
        entra: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        // Mensagem minha chegando: vem da direita, no sentido do envio.
        chega: {
          from: { opacity: '0', transform: 'translate(14px, 8px) scale(0.96)' },
          to: { opacity: '1', transform: 'translate(0, 0) scale(1)' },
        },
        // Câmera da etiqueta: o quadro fecha em cima do alvo ao abrir e dá um "clique" ao fotografar.
        mira: {
          from: { opacity: '0', transform: 'scale(1.16)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        encaixa: {
          '0%': { transform: 'scale(1)' },
          '35%': { transform: 'scale(0.955)' },
          '100%': { transform: 'scale(1)' },
        },
        congela: {
          from: { opacity: '0', transform: 'scale(1.04)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        cai: {
          '0%': { transform: 'translateY(-9px)', opacity: '0' },
          '20%': { opacity: '1' },
          '65%, 100%': { transform: 'translateY(5px)', opacity: '1' },
        },
      },
      animation: {
        'folha-sobe': 'folha-sobe 420ms cubic-bezier(0.16, 1, 0.3, 1)',
        'folha-desce': 'folha-desce 220ms cubic-bezier(0.4, 0, 1, 1)',
        surge: 'surge 320ms cubic-bezier(0.16, 1, 0.3, 1) both',
        marcar: 'marcar 320ms cubic-bezier(0.16, 1, 0.3, 1)',
        pulso: 'pulso 1.2s ease-in-out infinite',
        onda: 'onda 1.1s ease-in-out infinite',
        sinal: 'sinal 520ms cubic-bezier(0.16, 1, 0.3, 1) both',
        gira: 'gira 6s linear infinite',
        'gira-rapido': 'gira 1.1s linear infinite',
        varredura: 'varredura 1.6s cubic-bezier(0.45, 0, 0.55, 1) infinite',
        pop: 'pop 300ms cubic-bezier(0.16, 1, 0.3, 1) both',
        entra: 'entra 240ms ease-out both',
        chega: 'chega 340ms cubic-bezier(0.16, 1, 0.3, 1) both',
        mira: 'mira 520ms cubic-bezier(0.16, 1, 0.3, 1) both',
        encaixa: 'encaixa 380ms cubic-bezier(0.16, 1, 0.3, 1) both',
        congela: 'congela 260ms cubic-bezier(0.16, 1, 0.3, 1) both',
        cai: 'cai 1.5s cubic-bezier(0.5, 0, 0.9, 0.5) infinite',
      },
    },
  },
  plugins: [animate],
} satisfies Config
