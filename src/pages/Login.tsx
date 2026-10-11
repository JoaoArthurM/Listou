import { useEffect, useState, type FormEvent } from 'react'
import { Moldura } from '@/components/layout/Moldura'
import { Button } from '@/components/ui/button'
import { Field, PasswordField } from '@/components/ui/input'
import { Segmented } from '@/components/ui/segmented'
import { emailValido, mensagemDeAuth, SENHA_MINIMA } from '@/lib/auth'
import { calcularTotalCentavos, formatarQuantidade, formatarReais } from '@/lib/dinheiro'
import { FOTO_PADRAO } from '@/lib/fotos'
import { supabase } from '@/lib/supabase'

const ESPERA_REENVIO = 60

/** Entrar com senha, criar conta ou receber um link de acesso por e-mail. */
type Modo = 'entrar' | 'criar' | 'link'

// A conta do cartão de demonstração sai do mesmo código que soma o carrinho.
const EXEMPLO = { precoDoKg: 499, peso: 0.742 }
const CONTA = `${formatarQuantidade(EXEMPLO.peso, 'kg')} × ${formatarReais(EXEMPLO.precoDoKg)} = ${formatarReais(calcularTotalCentavos(EXEMPLO.precoDoKg, EXEMPLO.peso))}`

/**
 * Quem volta de um link de e-mail vencido ou já usado chega com o motivo no
 * endereço. Sem isto a pessoa cairia no login sem saber por quê.
 */
function erroDoLink(): string | null {
  const dados = new URLSearchParams(window.location.hash.replace(/^#/, '') || window.location.search)
  if (!dados.get('error') && !dados.get('error_code')) return null
  return dados.get('error_code') === 'otp_expired'
    ? 'Esse link venceu ou já foi usado. Entre com a senha ou peça outro link.'
    : 'Não deu para entrar por esse link. Entre com a senha ou peça outro link.'
}

/** Cartão de demonstração: o que o app faz, numa etiqueta de produto por peso. */
function Demonstracao() {
  return (
    <div aria-hidden className="abertura-cartao animate-surge [animation-delay:140ms]">
      <span className="absolute inset-0 origin-bottom -rotate-[7deg] rounded-[1.5rem] bg-[#3a3631]" />
      <span className="absolute inset-0 origin-bottom rotate-[5deg] rounded-[1.5rem] bg-[#2b2824]" />
      <div className="cartao-foto -rotate-[1.5deg] rounded-[1.5rem] p-4">
        <img src={FOTO_PADRAO} alt="" decoding="async" />
        <div className="flex gap-2 text-sm">
          <span className="rounded-full bg-white/20 px-3 py-1 backdrop-blur-sm">Etiqueta</span>
          <span className="dinheiro rounded-full bg-destaque px-3 py-1 font-medium text-destaque-foreground">
            {formatarReais(EXEMPLO.precoDoKg)} o kg
          </span>
        </div>
        <p className="mt-9 font-display text-[2.375rem] italic leading-none">Cenoura</p>
        <p className="dinheiro mt-2 text-[0.9375rem] text-white/85">{CONTA}</p>
      </div>
    </div>
  )
}

/**
 * A faixa preta do topo: a marca, a frase e o cartão. O que aparece depende da
 * altura que sobra acima do formulário (regras em src/index.css): tela cheia
 * mostra tudo, navegador com barras perde o cartão, teclado aberto fica só com
 * a marca pequena ou com nada.
 */
function Abertura() {
  return (
    <div className="abertura">
      <h1 className="abertura-marca font-display italic leading-[0.85] tracking-[-0.02em]">Listou</h1>
      <p className="abertura-frase mt-4 max-w-[17rem] text-[1.0625rem] leading-snug text-moldura-muted">
        A lista de compras a dois que lê a etiqueta e soma o carrinho.
      </p>
      <Demonstracao />
    </div>
  )
}

/**
 * Login por e-mail e senha, com criação de conta na mesma tela. O link de
 * acesso por e-mail continua como alternativa e serve também para quem
 * esqueceu a senha: entra pelo link e define outra no Perfil.
 *
 * O formulário fica ancorado embaixo e cabe inteiro na tela, com ou sem
 * teclado: não há área rolável para o navegador sair rolando sozinho ao focar
 * um campo. Com o teclado aberto, o que não é campo nem botão sai de cena.
 */
export function Login({ temConvite }: { temConvite: boolean }) {
  const [modo, setModo] = useState<Modo>('entrar')
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(erroDoLink)
  const [aviso, setAviso] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [espera, setEspera] = useState(0)

  // O motivo já foi lido para a tela: sai do endereço para não reaparecer ao recarregar.
  useEffect(() => {
    if (erroDoLink()) window.history.replaceState(window.history.state, '', window.location.pathname)
  }, [])

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
    <Moldura topo={<Abertura />} className="animate-folha-sobe">
      <div className="flex min-h-0 flex-col overflow-y-auto overscroll-contain px-5 pb-4 pt-5">
        {modo === 'link' ? (
          <div className="[.teclado-aberto_&]:hidden">
            <h2 className="text-[1.375rem] font-medium tracking-[-0.02em]">Entrar com link</h2>
            <p className="mt-1 text-[0.9375rem] leading-snug text-muted-foreground">
              Mandamos um link de acesso para o seu e-mail. Serve também se você esqueceu a senha: depois de entrar, defina outra no Perfil.
            </p>
          </div>
        ) : (
          <Segmented
            label="Entrar ou criar conta"
            className="[.teclado-aberto_&]:hidden"
            value={modo}
            onChange={trocarModo}
            options={[
              { value: 'entrar', label: 'Entrar' },
              { value: 'criar', label: 'Criar conta' },
            ]}
          />
        )}

        <form onSubmit={(e) => void enviar(e)} className="mt-4 space-y-3.5 [.teclado-aberto_&]:mt-0" noValidate>
          {temConvite && !aviso ? (
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
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Como você aparece na lista"
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
              placeholder={modo === 'criar' ? `Pelo menos ${SENHA_MINIMA} caracteres` : undefined}
              autoComplete={modo === 'criar' ? 'new-password' : 'current-password'}
              enterKeyHint="go"
            />
          )}

          {erro ? (
            <p role="alert" className="text-[0.9375rem] leading-snug text-destructive">
              {erro}
            </p>
          ) : null}

          <Button type="submit" size="lg" className="dinheiro !mt-[1.125rem] w-full" disabled={ocupado || (modo === 'link' && espera > 0)}>
            {acao}
          </Button>
        </form>

        {modo === 'criar' ? null : (
          <Button variant="ghost" size="sm" className="mx-auto mt-1.5 [.teclado-aberto_&]:hidden" onClick={() => trocarModo(modo === 'link' ? 'entrar' : 'link')}>
            {modo === 'link' ? 'Entrar com e-mail e senha' : 'Entrar com link por e-mail'}
          </Button>
        )}
      </div>
    </Moldura>
  )
}
