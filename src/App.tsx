import { useEffect } from 'react'
import { Carregando } from '@/components/layout/Carregando'
import { Moldura } from '@/components/layout/Moldura'
import { Button } from '@/components/ui/button'
import { useSessao } from '@/hooks/sessao'
import { interpretarRota, navegar, useCaminho } from '@/lib/rota'
import { supabaseConfigurado } from '@/lib/supabase'
import { Convite } from '@/pages/Convite'
import { Historico } from '@/pages/Historico'
import { ListaPagina } from '@/pages/Lista'
import { Listas } from '@/pages/Listas'
import { Login } from '@/pages/Login'
import { Perfil } from '@/pages/Perfil'

// Convite aberto antes do login: fica guardado e é aceito logo depois de entrar.
const CHAVE_CONVITE = 'listou:convite'

function lerConvite(): string | null {
  try {
    return localStorage.getItem(CHAVE_CONVITE)
  } catch {
    return null
  }
}

function guardarConvite(codigo: string | null) {
  try {
    if (codigo) localStorage.setItem(CHAVE_CONVITE, codigo)
    else localStorage.removeItem(CHAVE_CONVITE)
  } catch {
    // sem armazenamento, o convite só precisa ser aberto de novo depois do login
  }
}

function Aviso({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <Moldura>
      <div className="flex-1 px-6 pt-16">
        <h1 className="font-display text-[2.25rem] italic leading-[0.95]">{titulo}</h1>
        <div className="mt-4 text-[1rem] leading-snug text-muted-foreground">{children}</div>
      </div>
    </Moldura>
  )
}

export function App() {
  const { usuario, carregando } = useSessao()
  const rota = interpretarRota(useCaminho())
  const codigoNaRota = rota.tela === 'convite' ? rota.codigo : null

  useEffect(() => {
    if (carregando) return
    if (!usuario) {
      if (codigoNaRota) guardarConvite(codigoNaRota)
      return
    }
    const pendente = lerConvite()
    if (!pendente) return
    guardarConvite(null)
    if (!codigoNaRota) navegar(`/entrar/${encodeURIComponent(pendente)}`, { substituir: true })
  }, [usuario, carregando, codigoNaRota])

  if (!supabaseConfigurado) {
    return (
      <Aviso titulo="Falta configurar">
        Preencha <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> no arquivo <code>.env</code> (veja
        o <code>.env.example</code>) e reinicie o app.
      </Aviso>
    )
  }

  if (carregando) {
    return (
      <Moldura>
        <div className="flex flex-1 flex-col items-center justify-center gap-6">
          <span className="font-display text-[4rem] italic leading-none">Listou</span>
          <Carregando />
        </div>
      </Moldura>
    )
  }

  if (!usuario) return <Login temConvite={Boolean(codigoNaRota ?? lerConvite())} />

  switch (rota.tela) {
    case 'listas':
      return <Listas />
    case 'lista':
      return <ListaPagina key={rota.id} id={rota.id} aba={rota.aba} />
    case 'historico':
      return <Historico />
    case 'perfil':
      return <Perfil />
    case 'convite':
      return <Convite key={rota.codigo} codigo={rota.codigo} />
    default:
      return (
        <Aviso titulo="Página não encontrada">
          <p>Esse endereço não existe no Listou.</p>
          <Button className="mt-6" onClick={() => navegar('/', { substituir: true })}>
            Ver minhas listas
          </Button>
        </Aviso>
      )
  }
}
