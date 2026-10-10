import { useEffect, useState, type FormEvent } from 'react'
import { Moldura } from '@/components/layout/Moldura'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'

const ESPERA_REENVIO = 60

function traduzir(erro: { message: string; status?: number; code?: string }): string {
  const texto = erro.message.toLowerCase()
  if (erro.status === 429 || texto.includes('rate limit') || texto.includes('security purposes')) {
    return 'Muitos pedidos em pouco tempo. Espere um minuto e tente de novo.'
  }
  if (erro.code === 'otp_expired' || texto.includes('expired') || texto.includes('invalid')) {
    return 'Código errado ou vencido. Confira o e-mail mais recente ou peça outro.'
  }
  if (texto.includes('fetch') || texto.includes('network')) return 'Sem conexão. Confira a internet e tente de novo.'
  return 'Não deu para entrar agora. Tente de novo em instantes.'
}

/** Cartão de demonstração: o que o app faz, com o exemplo de etiqueta da própria especificação. */
function Demonstracao() {
  return (
    <div aria-hidden className="relative mx-auto mt-9 w-[15.5rem]">
      <span className="absolute inset-0 origin-bottom -rotate-[7deg] rounded-[1.5rem] bg-foreground/15 dark:bg-white/[0.06]" />
      <span className="absolute inset-0 origin-bottom rotate-[5deg] rounded-[1.5rem] bg-foreground/30 dark:bg-white/10" />
      <div className="cartao-escuro relative -rotate-[1.5deg] rounded-[1.5rem] p-4 shadow-flutuante">
        <div className="flex gap-2 text-sm">
          <span className="rounded-full bg-white/[0.16] px-3 py-1">Etiqueta</span>
          <span className="dinheiro rounded-full bg-destaque px-3 py-1 font-medium text-destaque-foreground">6+ 4,69</span>
        </div>
        <p className="mt-7 font-display text-[2.375rem] italic leading-none">Café 500 g</p>
        <p className="dinheiro mt-2 text-[0.9375rem] text-white/80">6 × R$ 4,69 = R$ 28,14</p>
      </div>
    </div>
  )
}

/** Login sem senha: link mágico por e-mail, com o código do mesmo e-mail como alternativa (seção 7.1). */
export function Login({ temConvite }: { temConvite: boolean }) {
  const [etapa, setEtapa] = useState<'email' | 'codigo'>('email')
  const [email, setEmail] = useState('')
  const [codigo, setCodigo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [espera, setEspera] = useState(0)

  useEffect(() => {
    if (espera <= 0) return
    const relogio = window.setTimeout(() => setEspera((s) => s - 1), 1000)
    return () => window.clearTimeout(relogio)
  }, [espera])

  async function pedirLink(evento?: FormEvent) {
    evento?.preventDefault()
    const limpo = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(limpo)) return setErro('Confira o e-mail: parece faltar alguma coisa.')
    setErro(null)
    setOcupado(true)
    const { error } = await supabase.auth.signInWithOtp({
      email: limpo,
      options: { emailRedirectTo: window.location.origin },
    })
    setOcupado(false)
    if (error) return setErro(traduzir(error))
    setEmail(limpo)
    setEtapa('codigo')
    setEspera(ESPERA_REENVIO)
  }

  async function entrarComCodigo(evento: FormEvent) {
    evento.preventDefault()
    if (codigo.length < 6) return setErro('O código do e-mail tem pelo menos 6 números.')
    setErro(null)
    setOcupado(true)
    const { error } = await supabase.auth.verifyOtp({ email, token: codigo, type: 'email' })
    setOcupado(false)
    // Deu certo: o SessaoProvider percebe a sessão e troca de tela sozinho.
    if (error) setErro(traduzir(error))
  }

  return (
    <Moldura
      className="colmeia"
      rodape={<p className="py-2 text-center text-[0.9375rem] text-moldura-muted">Sem senha. O acesso chega por e-mail.</p>}
    >
      <div className="halo flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-6 pb-7 pt-12">
        <h1 className="font-display text-[5rem] italic leading-[0.85] tracking-[-0.02em]">Listou</h1>
        <p className="mt-4 max-w-[17rem] text-[1.0625rem] leading-snug text-muted-foreground">
          A lista de compras a dois que lê a etiqueta e soma o carrinho.
        </p>

        {etapa === 'email' ? (
          <>
            <Demonstracao />
            <form onSubmit={(e) => void pedirLink(e)} className="mt-auto space-y-4 pt-10" noValidate>
              {temConvite ? (
                <p className="rounded-2xl border border-dica-borda bg-dica px-4 py-3 text-[0.9375rem] leading-snug text-dica-foreground">
                  Você recebeu um convite. Entre com seu e-mail para abrir a lista.
                </p>
              ) : null}
              <Field
                label="Seu e-mail"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={erro}
                placeholder="voce@exemplo.com"
                autoComplete="email"
                inputMode="email"
                autoCapitalize="none"
                enterKeyHint="send"
              />
              <Button type="submit" size="lg" className="w-full" disabled={ocupado}>
                {ocupado ? 'Enviando…' : 'Receber link de acesso'}
              </Button>
            </form>
          </>
        ) : (
          <form onSubmit={(e) => void entrarComCodigo(e)} className="mt-auto space-y-4 pt-10" noValidate>
            <div>
              <h2 className="text-[1.375rem] font-semibold tracking-[-0.02em]">Confira seu e-mail</h2>
              <p className="mt-1.5 text-[1.0625rem] leading-snug text-muted-foreground">
                Mandamos um link para <span className="break-all font-medium text-foreground">{email}</span>. Toque nele neste aparelho ou digite o código que veio junto.
              </p>
            </div>
            <Field
              label="Código do e-mail"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 8))}
              error={erro}
              hint="No app instalado no iPhone, use o código: o link abre no Safari."
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              className="[&_input]:dinheiro [&_input]:h-14 [&_input]:text-center [&_input]:text-2xl [&_input]:font-semibold [&_input]:tracking-[0.25em]"
            />
            <Button type="submit" size="lg" className="w-full" disabled={ocupado}>
              {ocupado ? 'Entrando…' : 'Entrar com o código'}
            </Button>
            <div className="flex items-center justify-between gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEtapa('email')
                  setCodigo('')
                  setErro(null)
                }}
              >
                Usar outro e-mail
              </Button>
              <Button variant="ghost" size="sm" className="dinheiro" disabled={espera > 0 || ocupado} onClick={() => void pedirLink()}>
                {espera > 0 ? `Reenviar em ${espera}s` : 'Reenviar e-mail'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </Moldura>
  )
}
