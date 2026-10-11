import { KeyRound, LogOut, Monitor, Moon, Palette, Sun, UserRound } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Moldura } from '@/components/layout/Moldura'
import { NavInferior } from '@/components/layout/NavInferior'
import { Secao } from '@/components/layout/Secao'
import { StatusConexao } from '@/components/layout/StatusConexao'
import { Button } from '@/components/ui/button'
import { Field, PasswordField } from '@/components/ui/input'
import { Segmented } from '@/components/ui/segmented'
import { useUsuario } from '@/hooks/sessao'
import { usePerfil, useSalvarNome } from '@/hooks/useListas'
import { mensagemDeAuth, SENHA_MINIMA } from '@/lib/auth'
import { avisar } from '@/lib/avisos'
import { supabase } from '@/lib/supabase'
import { definirTema, useTema, type Tema } from '@/lib/tema'

/** Perfil: nome que aparece para quem divide a lista, senha, aparência e saída da conta. */
export function Perfil() {
  const usuario = useUsuario()
  const { data: perfil } = usePerfil()
  const salvarNome = useSalvarNome()
  const tema = useTema()
  const [nome, setNome] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [senha, setSenha] = useState('')
  const [erroSenha, setErroSenha] = useState<string | null>(null)
  const [salvandoSenha, setSalvandoSenha] = useState(false)
  const [saindo, setSaindo] = useState(false)

  // O campo começa com o nome salvo assim que ele chega do servidor.
  useEffect(() => {
    if (perfil?.nome) setNome(perfil.nome)
  }, [perfil?.nome])

  function salvar(evento: FormEvent) {
    evento.preventDefault()
    const limpo = nome.trim()
    if (!limpo) return setErro('Escreva como quer aparecer para quem divide a lista.')
    setErro(null)
    salvarNome.mutate(limpo, {
      onSuccess: () => avisar('Nome atualizado.', 'sucesso'),
      onError: (e) => setErro(e.message),
    })
  }

  async function salvarSenha(evento: FormEvent) {
    evento.preventDefault()
    if (senha.length < SENHA_MINIMA) return setErroSenha(`Escolha uma senha com pelo menos ${SENHA_MINIMA} caracteres.`)
    setErroSenha(null)
    setSalvandoSenha(true)
    const { error } = await supabase.auth.updateUser({ password: senha })
    setSalvandoSenha(false)
    if (error) return setErroSenha(mensagemDeAuth(error))
    setSenha('')
    avisar('Senha salva. Use-a na próxima vez que entrar.', 'sucesso')
  }

  async function sair() {
    setSaindo(true)
    // "local": encerra só neste aparelho e funciona mesmo sem conexão.
    const { error } = await supabase.auth.signOut({ scope: 'local' })
    if (error) {
      setSaindo(false)
      avisar('Não deu para sair agora. Tente de novo.', 'erro')
    }
  }

  return (
    <Moldura rodape={<NavInferior atual="perfil" />}>
      <header className="flex shrink-0 items-start justify-between gap-4 px-5 pt-6">
        <div className="min-w-0">
          <h1 className="text-[1.375rem] font-medium leading-tight tracking-[-0.025em]">Perfil</h1>
          <p className="mt-0.5 truncate text-[1rem] text-muted-foreground">{usuario.email ?? 'Sua conta'}</p>
        </div>
        <StatusConexao className="mt-1" />
      </header>

      <div className="min-h-0 flex-1 space-y-7 overflow-y-auto overscroll-contain px-5 pb-8 pt-6">
        <Secao id="titulo-nome" icone={UserRound} titulo="Seu nome" descricao="É como você aparece para quem divide a lista.">
          <form onSubmit={salvar} className="space-y-3" noValidate>
            <Field
              label="Nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              error={erro}
              maxLength={40}
              autoComplete="given-name"
            />
            <Button type="submit" variant="secondary" className="w-full" disabled={salvarNome.isPending || nome.trim() === (perfil?.nome ?? '')}>
              Salvar nome
            </Button>
          </form>
        </Secao>

        <Secao id="titulo-senha" icone={KeyRound} titulo="Senha" descricao="Serve para criar a primeira senha ou trocar a atual.">
          <form onSubmit={(e) => void salvarSenha(e)} className="space-y-3" noValidate>
            {/* Campo de usuário escondido: ajuda o gerenciador de senhas a ligar a senha nova à conta certa. */}
            <input type="email" name="email" value={usuario.email ?? ''} autoComplete="username" readOnly hidden />
            <PasswordField
              label="Nova senha"
              name="nova-senha"
              hint={`Pelo menos ${SENHA_MINIMA} caracteres.`}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              error={erroSenha}
              autoComplete="new-password"
            />
            <Button type="submit" variant="secondary" className="w-full" disabled={salvandoSenha || senha === ''}>
              {salvandoSenha ? 'Salvando…' : 'Salvar senha'}
            </Button>
          </form>
        </Secao>

        <Secao id="titulo-aparencia" icone={Palette} titulo="Aparência" descricao="Claro, escuro ou o mesmo do seu aparelho.">
          <Segmented<Tema>
            label="Aparência"
            value={tema}
            onChange={definirTema}
            options={[
              { value: 'claro', label: <><Sun aria-hidden className="size-4" /> Claro</> },
              { value: 'escuro', label: <><Moon aria-hidden className="size-4" /> Escuro</> },
              { value: 'sistema', label: <><Monitor aria-hidden className="size-4" /> Sistema</> },
            ]}
          />
        </Secao>

        <section aria-label="Conta" className="border-t border-dashed border-controle/60 pt-5">
          <p className="px-1 text-sm leading-snug text-muted-foreground">
            Ao sair, as listas guardadas neste aparelho para uso offline são apagadas daqui. Elas continuam na sua conta.
          </p>
          <Button variant="secondary" className="mt-3 w-full" disabled={saindo} onClick={() => void sair()}>
            <LogOut className="size-5" />
            {saindo ? 'Saindo…' : 'Sair da conta'}
          </Button>
        </section>
      </div>
    </Moldura>
  )
}
