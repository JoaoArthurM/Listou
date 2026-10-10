// Textos de erro do Supabase Auth em português, para as telas de login e perfil.

/** Mínimo padrão do Supabase Auth; se mudar no painel, mude aqui também. */
export const SENHA_MINIMA = 6

type ErroDeAuth = { message: string; status?: number; code?: string }

export function mensagemDeAuth(erro: ErroDeAuth): string {
  const codigo = erro.code ?? ''
  const texto = erro.message.toLowerCase()

  if (erro.status === 429 || codigo.includes('rate_limit') || texto.includes('rate limit') || texto.includes('security purposes')) {
    return 'Muitas tentativas em pouco tempo. Espere um minuto e tente de novo.'
  }
  if (codigo === 'invalid_credentials' || texto.includes('invalid login credentials')) return 'E-mail ou senha incorretos.'
  if (codigo === 'email_not_confirmed' || texto.includes('not confirmed')) {
    return 'Falta confirmar o e-mail: abra o link que enviamos e depois entre com a senha.'
  }
  if (codigo === 'user_already_exists' || texto.includes('already registered')) return 'Esse e-mail já tem conta. Entre com a senha.'
  if (codigo === 'weak_password' || texto.includes('password should')) return `Escolha uma senha com pelo menos ${SENHA_MINIMA} caracteres.`
  if (codigo === 'same_password') return 'Essa já é a sua senha atual. Escolha outra.'
  if (codigo === 'reauthentication_needed') return 'Por segurança, saia e entre de novo antes de trocar a senha.'
  if (codigo === 'signup_disabled' || texto.includes('signups not allowed')) return 'O cadastro de contas novas está desligado.'
  if (codigo === 'email_address_not_authorized' || codigo === 'email_address_invalid' || texto.includes('not authorized')) {
    return 'Não conseguimos mandar e-mail para esse endereço. Use e-mail e senha.'
  }
  if (texto.includes('fetch') || texto.includes('network')) return 'Sem conexão. Confira a internet e tente de novo.'
  return 'Não deu certo agora. Tente de novo em instantes.'
}

export const emailValido = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
