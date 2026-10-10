import { useEffect, useRef, useState } from 'react'
import { Moldura } from '@/components/layout/Moldura'
import { Button } from '@/components/ui/button'
import { useAceitarConvite } from '@/hooks/useListas'
import { navegar } from '@/lib/rota'

/** Destino do link de convite (/entrar/CODIGO): aceita e abre a lista. */
export function Convite({ codigo }: { codigo: string }) {
  const { mutate } = useAceitarConvite()
  const [erro, setErro] = useState<string | null>(null)
  const tentou = useRef(false)

  useEffect(() => {
    // Em desenvolvimento o StrictMode monta duas vezes; o convite é aceito uma só.
    if (tentou.current) return
    tentou.current = true
    mutate(codigo, {
      onSuccess: (listaId) => navegar(`/lista/${listaId}`, { substituir: true }),
      onError: (e) => setErro(e.message),
    })
  }, [codigo, mutate])

  return (
    <Moldura className="colmeia">
      <div className="halo flex-1 px-6 pt-16">
        {erro ? (
          <>
            <h1 className="font-display text-[2.75rem] italic leading-[0.95]">Convite não aceito</h1>
            <p role="alert" className="mt-4 text-[1.0625rem] leading-snug text-muted-foreground">
              {erro}
            </p>
            <Button className="mt-6" onClick={() => navegar('/', { substituir: true })}>
              Ver minhas listas
            </Button>
          </>
        ) : (
          <>
            <h1 className="font-display text-[2.75rem] italic leading-[0.95]">Entrando na lista…</h1>
            <p role="status" className="dinheiro mt-4 text-[1.0625rem] text-muted-foreground">
              Convite {codigo.toUpperCase()}
            </p>
          </>
        )}
      </div>
    </Moldura>
  )
}
