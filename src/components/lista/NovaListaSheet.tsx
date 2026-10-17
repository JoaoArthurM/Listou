import { ScanLine } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { LeitorQr } from '@/components/lista/LeitorQr'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/input'
import { Sheet } from '@/components/ui/sheet'
import { useAceitarConvite, useCriarLista } from '@/hooks/useListas'
import { parseDinheiro } from '@/lib/dinheiro'
import { navegar } from '@/lib/rota'

const mensagem = (erro: unknown) => (erro instanceof Error ? erro.message : 'Algo deu errado. Tente de novo.')

export function NovaListaSheet({ aoFechar }: { aoFechar: () => void }) {
  const criar = useCriarLista()
  const [nome, setNome] = useState('')
  const [mercado, setMercado] = useState('')
  const [orcamento, setOrcamento] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  function enviar(evento: FormEvent) {
    evento.preventDefault()
    const nomeLimpo = nome.trim()
    if (!nomeLimpo) return setErro('Dê um nome à lista, como “Compra do mês”.')
    const valor = orcamento.trim() === '' ? null : parseDinheiro(orcamento)
    if (orcamento.trim() !== '' && valor === null) return setErro('Confira o orçamento: use o formato 250,00.')
    setErro(null)
    criar.mutate(
      { nome: nomeLimpo, mercado: mercado.trim() || null, orcamento_centavos: valor },
      {
        onSuccess: (lista) => {
          aoFechar()
          navegar(`/lista/${lista.id}?aba=itens`)
        },
        onError: (e) => setErro(mensagem(e)),
      },
    )
  }

  return (
    <Sheet open onOpenChange={(aberta) => !aberta && aoFechar()} title="Nova lista" description="Depois de criar, convide quem compra com você.">
      <form onSubmit={enviar} className="space-y-4" noValidate>
        <Field label="Nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Compra do mês" maxLength={60} autoComplete="off" data-autofocus />
        <Field label="Mercado" hint="Opcional" value={mercado} onChange={(e) => setMercado(e.target.value)} placeholder="Atacadão" maxLength={60} autoComplete="off" />
        <Field label="Orçamento (R$)" hint="Opcional" value={orcamento} onChange={(e) => setOrcamento(e.target.value)} inputMode="decimal" placeholder="250,00" className="dinheiro" />
        {erro ? (
          <p role="alert" className="text-sm text-destructive">
            {erro}
          </p>
        ) : null}
        <Button type="submit" className="w-full" disabled={criar.isPending}>
          {criar.isPending ? 'Criando…' : 'Criar lista'}
        </Button>
      </form>
    </Sheet>
  )
}

export function CodigoSheet({ aoFechar }: { aoFechar: () => void }) {
  const aceitar = useAceitarConvite()
  const [codigo, setCodigo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [lendo, setLendo] = useState(false)

  function entrar(codigoDoConvite: string) {
    if (codigoDoConvite.length !== 6) return setErro('O código tem 6 caracteres.')
    setErro(null)
    aceitar.mutate(codigoDoConvite, {
      onSuccess: (listaId) => {
        aoFechar()
        navegar(`/lista/${listaId}`)
      },
      onError: (e) => setErro(mensagem(e)),
    })
  }

  function enviar(evento: FormEvent) {
    evento.preventDefault()
    entrar(codigo)
  }

  // O QR leu um convite: volta para o campo com o código preenchido e já entra.
  // Se o convite falhar (vencido, por exemplo), o motivo aparece no campo.
  function aoLerQr(lido: string) {
    setCodigo(lido)
    setLendo(false)
    entrar(lido)
  }

  return (
    <Sheet open onOpenChange={(aberta) => !aberta && aoFechar()} title="Entrar numa lista" description={lendo ? 'Leia o QR code que a outra pessoa abriu nas opções da lista.' : 'Digite o código ou leia o QR code que a outra pessoa gerou nas opções da lista dela.'}>
      {lendo ? (
        <LeitorQr aoLer={aoLerQr} aoCancelar={() => setLendo(false)} />
      ) : (
      <form onSubmit={enviar} className="space-y-4" noValidate>
        <Field
          label="Código de convite"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
          error={erro}
          placeholder="ABC234"
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          data-autofocus
          className="[&_input]:dinheiro [&_input]:h-12 [&_input]:text-center [&_input]:text-2xl [&_input]:font-semibold [&_input]:tracking-[0.2em]"
        />
        <Button type="submit" className="w-full" disabled={aceitar.isPending}>
          {aceitar.isPending ? 'Entrando…' : 'Entrar na lista'}
        </Button>
        <Button type="button" variant="secondary" className="w-full" disabled={aceitar.isPending} onClick={() => setLendo(true)}>
          <ScanLine className="size-5" />
          Ler QR code
        </Button>
      </form>
      )}
    </Sheet>
  )
}
