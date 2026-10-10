import { isAuthRetryableFetchError, type Session } from '@supabase/supabase-js'
import { useEffect, useState, type ReactNode } from 'react'
import { ContextoSessao, type EstadoSessao, type Usuario } from '@/hooks/sessao'
import { limparCacheLocal } from '@/lib/queryClient'
import { supabase } from '@/lib/supabase'

const CHAVE = 'listou:usuario'

function lerUsuarioSalvo(): Usuario | null {
  try {
    const salvo = localStorage.getItem(CHAVE)
    return salvo ? (JSON.parse(salvo) as Usuario) : null
  } catch {
    return null
  }
}

function guardar(usuario: Usuario | null) {
  try {
    if (usuario) localStorage.setItem(CHAVE, JSON.stringify(usuario))
    else localStorage.removeItem(CHAVE)
  } catch {
    // sem armazenamento: o modo offline só não reconhece o usuário
  }
}

const daSessao = (sessao: Session): Usuario => ({ id: sessao.user.id, email: sessao.user.email ?? null })

export function SessaoProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<EstadoSessao>({ usuario: null, carregando: true })

  useEffect(() => {
    let ativo = true

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!ativo) return
      if (data.session) {
        const usuario = daSessao(data.session)
        guardar(usuario)
        setEstado({ usuario, carregando: false })
      } else if (error && isAuthRetryableFetchError(error)) {
        // Token vencido e sem rede para renovar (comum dentro do mercado): o
        // login continua valendo, então o app abre com o último usuário e os
        // dados em cache. A sessão se renova sozinha quando a conexão voltar.
        setEstado({ usuario: lerUsuarioSalvo(), carregando: false })
      } else {
        guardar(null)
        setEstado({ usuario: null, carregando: false })
      }
    })

    const { data } = supabase.auth.onAuthStateChange((evento, sessao) => {
      if (sessao) {
        const usuario = daSessao(sessao)
        guardar(usuario)
        setEstado((atual) => (atual.usuario?.id === usuario.id && !atual.carregando ? atual : { usuario, carregando: false }))
      } else if (evento === 'SIGNED_OUT') {
        guardar(null)
        limparCacheLocal()
        setEstado({ usuario: null, carregando: false })
      }
    })

    return () => {
      ativo = false
      data.subscription.unsubscribe()
    }
  }, [])

  return <ContextoSessao.Provider value={estado}>{children}</ContextoSessao.Provider>
}
