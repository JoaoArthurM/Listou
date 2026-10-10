import { useEffect, useState, type FormEvent } from 'react'
import { Moldura } from '@/components/layout/Moldura'
import { Button } from '@/components/ui/button'
import { Field, PasswordField } from '@/components/ui/input'
import { emailValido, mensagemDeAuth, SENHA_MINIMA } from '@/lib/auth'
import { FOTO_PADRAO } from '@/lib/fotos'
import { supabase } from '@/lib/supabase'

const ESPERA_REENVIO = 60

/** Entrar com senha, criar conta ou receber um link de acesso por e-mail. */
type Modo = 'entrar' | 'criar' | 'link'

/** Cartão de demonstração: o que o app faz, com o exemplo de etiqueta da própria especificação. */
function Demonstracao() {
  return (
    <div aria-hidden className="relative mx-auto mt-9 w-[15rem]">
      <span className="absolute inset-0 origin-bottom -rotate-[7deg] rounded-[1.5rem] bg-[#8d867c] dark:bg-[#3a3631]" />
      <span className="absolute inset-0 origin-bottom rotate-[5deg] rounded-[1.5rem] bg-[#57514a] dark:bg-[#2b2824]" />
      <div className="cartao-foto -rotate-[1.5deg] rounded-[1.5rem] p-4 shadow-flutuante">
        <img src={FOTO_PADRAO} alt="" decoding="async" />
        <div className="flex gap-2 text-sm">
          <span className="rounded-full bg-white/20 px-3 py-1 backdrop-blur-sm">Etiqueta</span>
          <span className="dinheiro rounded-full bg-destaque px-3 py-1 font-medium text-destaque-foreground">6+ 4,69</span>
        </div>
        <p className="mt-9 font-display text-[2.375rem] italic leading-none">Café 500 g</p>
        <p className="dinheiro mt-2 text-[0.9375rem] text-white/85">6 × R$ 4,69 = R$ 28,14</p>
      </div>
    </div>
  )
}

/**
 * Login por e-mail e senha, com criação de conta na mesma tela. O link de
 * acesso por e-mail continua como alternativa e serve também para quem
 * esqueceu a senha: entra pelo link e define outra no Perfil.
 */
export function Login({ temConvite }: { temConvite: boolean }) {
  const [modo, setModo] = useState<Modo>('entrar')
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [espera, setEspera] = useState(0)

  useEffect(() => {
    if (espera <= 0) return
    const relogio = window.setTimeout(() => setEspera((s) => s - 1), 1000)
    return () => window.clearTimeout(relogio)
  }, [espera])

  function trocarModo(novo: Modo) {
    setModo(novo)
    setErro(null)
    setAviso(null)
  }

  async function entrar(endereco: string) {
    const { error } = await supabase.auth.signInWithPassword({ email: endereco, password: senha })
    // Deu certo: o SessaoProvider percebe a sessão e troca de tela sozinho.
    if (error) setErro(mensagemDeAuth(error))
  }

  async function criarConta(endereco: string) {
    const { data, error } = await supabase.auth.signUp({
      email: endereco,
      password: senha,
      options: { emailRedirectTo: window.location.origin, data: nome.trim() ? { nome: nome.trim() } : undefined },
    })
    if (error) return setErro(mensagemDeAuth(error))
    if (data.session) return

    // Sem sessão, o projeto exige confirmar o e-mail. Nesse modo o Supabase não
    // revela se o endereço já tinha conta: devolve um usuário sem identidades.
    if (data.user?.identities?.length === 0) return setErro('Esse e-mail já tem conta. Entre com a senha.')
    setModo('entrar')
    setAviso(`Conta criada. Enviamos um link de confirmação para ${endereco}: abra o link e depois entre com a senha.`)
  }

  async function pedirLink(endereco: string) {
    const { error } = await supabase.auth.signInWithOtp({ email: endereco, options: { emailRedirectTo: window.location.origin } })
    if (error) return setErro(mensagemDeAuth(error))
    setAviso(`Enviamos um link para ${endereco}. Abra-o neste aparelho para entrar.`)
    setEspera(ESPERA_REENVIO)
  }

  async function enviar(evento: FormEvent) {
    evento.preventDefault()
    const endereco = email.trim().toLowerCase()
    if (!emailValido(endereco)) return setErro('Confira o e-mail: parece faltar alguma coisa.')
    if (modo === 'entrar' && senha === '') return setErro('Digite sua senha.')
    if (modo === 'criar' && senha.length < SENHA_MINIMA) return setErro(`Escolha uma senha com pelo menos ${SENHA_MINIMA} caracteres.`)

    setErro(null)
    setAviso(null)
    setOcupado(true)
    try {
      if (modo === 'entrar') await entrar(endereco)
      else if (modo === 'criar') await criarConta(endereco)
      else await pedirLink(endereco)
    } finally {
      setOcupado(false)
    }
  }

  const acao = {
    entrar: ocupado ? 'Entrando…' : 'Entrar',
    criar: ocupado ? 'Criando…' : 'Criar conta',
    link: ocupado ? 'Enviando…' : espera > 0 ? `Reenviar em ${espera}s` : 'Receber link de acesso',
  }[modo]

  return (
    <Moldura rodape={<p className="py-2 text-center text-[0.9375rem] text-moldura-muted">Suas listas ficam guardadas na sua conta.</p>}>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-6 pb-6 pt-10">
        <h1 className="font-display text-[5rem] italic leading-[0.85] tracking-[-0.02em]">Listou</h1>
        <p className="mt-4 max-w-[17rem] text-[1.0625rem] leading-snug text-muted-foreground">
          A lista de compras a dois que lê a etiqueta e soma o carrinho.
        </p>

        {/* Criar conta tem um campo a mais: o cartão sai para o formulário caber sem rolar. */}
        {modo === 'criar' ? null : <Demonstracao />}

        <form onSubmit={(e) => void enviar(e)} className="mt-auto space-y-4 pt-9" noValidate>
          {modo === 'criar' ? <h2 className="text-[1.375rem] font-medium tracking-[-0.02em]">Criar conta</h2> : null}
          {modo === 'link' ? (
            <div>
              <h2 className="text-[1.375rem] font-medium tracking-[-0.02em]">Entrar com link</h2>
              <p className="mt-1 text-[0.9375rem] leading-snug text-muted-foreground">
                Mandamos um link de acesso para o seu e-mail. Serve também se você esqueceu a senha: depois de entrar, defina outra no Perfil.
              </p>
            </div>
          ) : null}

          {temConvite && modo === 'entrar' && !aviso ? (
            <p className="rounded-2xl border border-dica-borda bg-dica px-4 py-3 text-[0.9375rem] leading-snug text-dica-foreground">
              Você recebeu um convite. Entre ou crie sua conta para abrir a lista.
            </p>
          ) : null}
          {aviso ? (
            <p role="status" className="rounded-2xl border border-dica-borda bg-dica px-4 py-3 text-[0.9375rem] leading-snug text-dica-foreground">
              {aviso}
            </p>
          ) : null}

          {modo === 'criar' ? (
            <Field
              label="Seu nome"
              hint="Opcional. É como você aparece para quem divide a lista."
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              maxLength={40}
              autoComplete="given-name"
            />
          ) : null}
          <Field
            label="E-mail"
            type="email"
            name="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@exemplo.com"
            autoComplete="username"
            inputMode="email"
            autoCapitalize="none"
          />
          {modo === 'link' ? null : (
            <PasswordField
              label="Senha"
              name="senha"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              hint={modo === 'criar' ? `Pelo menos ${SENHA_MINIMA} caracteres.` : undefined}
              autoComplete={modo === 'criar' ? 'new-password' : 'current-password'}
              enterKeyHint="go"
            />
          )}

          {erro ? (
            <p role="alert" className="text-[0.9375rem] leading-snug text-destructive">
              {erro}
            </p>
          ) : null}

          <Button type="submit" size="lg" className="dinheiro w-full" disabled={ocupado || (modo === 'link' && espera > 0)}>
            {acao}
          </Button>

          <div className="-mx-2 flex flex-wrap items-center justify-between gap-x-2">
            {modo === 'entrar' ? (
              <>
                <Button variant="ghost" size="sm" onClick={() => trocarModo('criar')}>
                  Criar conta
                </Button>
                <Button variant="ghost" size="sm" onClick={() => trocarModo('link')}>
                  Entrar com link por e-mail
                </Button>
              </>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => trocarModo('entrar')}>
                {modo === 'criar' ? 'Já tenho conta' : 'Entrar com senha'}
              </Button>
            )}
          </div>
        </form>
      </div>
    </Moldura>
  )
}
