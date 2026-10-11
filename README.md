# Listou

Lista de compras compartilhada, com chat que lê fotos de etiquetas de preço do mercado e soma o total do carrinho. PWA instalável, pensado para iPhone 16 e Galaxy S24 Ultra.

A especificação completa está em [CLAUDE.md](CLAUDE.md). Este arquivo é o guia de quem vai rodar e publicar.

## Rodar

```bash
npm install
cp .env.example .env      # preencha com a URL e a chave publishable do projeto Supabase
npm run dev               # http://localhost:5173
```

`http://localhost:5173/dev/dispositivos.html` mostra o app lado a lado nos dois tamanhos de tela alvo.

| Comando | O que faz |
|---|---|
| `npm run dev` | servidor de desenvolvimento |
| `npm run build` | `tsc --noEmit` e build de produção (com service worker) |
| `npm run lint` | ESLint |
| `npm test` | Vitest: dinheiro, faixas de preço e schemas das Edge Functions |
| `npm run sync:shared` | copia `src/lib/{dinheiro,precos}.ts` para as Edge Functions |
| `npm run icones` | regenera os ícones do PWA em `public/` |

## Supabase

Projeto `listou` (região `sa-east-1`, ref `fckfyyvdviifiioebmbc`).

**Banco.** As migrations de `supabase/migrations/` já estão aplicadas. Para conferir RLS, convites, gatilhos e arredondamento contra o banco real, rode `supabase/tests/seguranca.test.sql` no SQL Editor: ele faz tudo dentro de uma transação e desfaz no fim.

**Edge Functions.** `ler-etiqueta` e `chat` estão publicadas. Para publicar de novo depois de mexer no código:

```bash
npx supabase login
npx supabase link --project-ref fckfyyvdviifiioebmbc
npm run sync:shared
npx supabase functions deploy ler-etiqueta
npx supabase functions deploy chat
```

**Secrets das funções** (painel > Edge Functions > Secrets):

| Nome | Valor |
|---|---|
| `GEMINI_API_KEY` | chave do Google AI Studio. Obrigatório: sem ele o chat responde "Não consegui falar com a IA agora". |
| `GEMINI_MODEL` | opcional. Padrão: `gemini-3.5-flash-lite`. |

A chave do Gemini nunca entra no frontend nem no repositório.

**Auth** (painel > Authentication):

O login é por **e-mail e senha** (entrar e criar conta na mesma tela). O link de acesso por e-mail continua como alternativa e serve de "esqueci a senha": a pessoa entra pelo link e define outra senha no Perfil.

1. **Confirm email** (em *Sign In / Providers > Email*): hoje está **ligado**, então quem cria conta recebe um e-mail e só entra depois de abrir o link. Para a pessoa entrar só com e-mail e senha, sem depender de e-mail nenhum, desligue essa opção. O custo é que o endereço deixa de ser verificado.
2. **URL Configuration:** em *Site URL*, a URL de produção; em *Redirect URLs*, a de produção e `http://localhost:5173`. Vale para o link de acesso e para o e-mail de confirmação.
3. **SMTP:** o envio embutido do Supabase só entrega para e-mails da equipe do projeto e limita a 2 mensagens por hora (a documentação diz que ele não é para produção). Isso afeta o link de acesso e a confirmação de conta. Com *Confirm email* desligado e login por senha, dá para usar sem SMTP próprio; para o link funcionar com qualquer endereço, configure um (Resend, por exemplo).

No app instalado no iPhone, o link do e-mail abre no Safari, que não divide o login com o app. Ali o caminho é a senha.

## Publicar o frontend (Vercel)

Importe o repositório na Vercel (framework Vite, já descrito em `vercel.json`) e defina `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`. Depois ponha a URL gerada no passo 1 de Auth.

## Como o total é calculado

- Dinheiro é sempre centavo inteiro; `R$ 1.234,56` só existe na hora de mostrar (`src/lib/dinheiro.ts`).
- A IA só lê a etiqueta e interpreta pedidos. Quem escolhe a faixa (varejo, atacado, cartão) e multiplica é `src/lib/precos.ts`; quem soma o carrinho é a coluna gerada `total_centavos` e a view `lista_totais`.
- O servidor usa uma cópia de `dinheiro.ts` e `precos.ts` (`supabase/functions/_shared/`). O teste `src/lib/shared.test.ts` falha se as duas versões divergirem.

## Offline

Listas, itens e conversa ficam em cache no aparelho (React Query persistido). Sem conexão, adicionar, marcar e editar itens funciona e entra numa fila que é reenviada quando o sinal volta, mesmo depois de fechar o app. Chat, voz e foto de etiqueta precisam de conexão.

O indicador ao lado das abas mostra a conexão medida, não a que o navegador supõe: uma sonda pergunta ao Supabase a cada 20 s se ele responde (`src/lib/conexao.ts`). As barras refletem o tempo de resposta e piscam a cada resposta e a cada dado que chega do outro aparelho. Duas sondas sem resposta viram "Offline", mesmo com Wi-Fi conectado.

## Fotos de etiqueta

Bucket privado `etiquetas`, caminho `{lista_id}/{uuid}.jpg`, comprimidas no celular antes do envio. Por padrão são apagadas 24 h depois da compra (`MANTER_FOTOS` em `supabase/functions/_shared/config.ts`). A limpeza roda a cada leitura de etiqueta, não em job agendado; o detalhe está em `supabase/functions/_shared/fotos.ts`.

Tocar na miniatura, na conversa ou na folha do item, abre a foto inteira dentro do app.

## Voz

Com o campo do chat vazio, o botão de enviar vira microfone. O app grava até 25 s, mostra a onda do volume real do microfone, converte para WAV mono de 16 kHz no aparelho (`src/lib/voz.ts`) e manda para a função `chat`. O Gemini devolve a transcrição, que entra na conversa como mensagem, e as mesmas ações de um pedido escrito. Precisa de HTTPS (ou `localhost`) e da permissão de microfone.

## Ao vivo

Mudanças em itens, mensagens e na lista chegam pelo Realtime (canal `lista:{id}`). "Fulano está digitando" e "Listou está pensando" vão por Broadcast num canal privado à parte (`lista:{id}:atividade`), aberto só a membros da lista pelas políticas de `realtime.messages`. O código está em `src/hooks/useRealtime.ts`.

## Pendências conhecidas

- **Teste com 20 fotos reais de etiqueta** (seção 11 da spec), com taxa de acerto por faixa. Só etiquetas sintéticas foram testadas.
- **Ajustes de Auth** acima (principalmente desligar *Confirm email* e apontar *Site URL* para a URL da Vercel).
- **Voz em aparelho físico.** A gravação foi testada no Chrome com microfone simulado. No Safari do iPhone o formato gravado é outro (MP4/AAC) e a conversão para WAV ainda não foi conferida num aparelho de verdade.
- **Áreas seguras** (entalhe, barra de gestos) só foram conferidas por emulação, não em aparelho físico.
