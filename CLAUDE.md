# Listou

App de lista de compras compartilhada, com chat que lê fotos de etiquetas de preço do mercado e soma o total da compra automaticamente.

Este arquivo é a especificação do projeto. Leia inteiro antes de escrever código. Quando algo aqui não estiver claro ou entrar em conflito com a documentação oficial, **pare e pergunte** em vez de supor.

---

## 1. Objetivo

Duas pessoas compartilham a mesma lista de compras em tempo real. No mercado, o usuário:

1. Vê no chat o que ainda falta comprar.
2. Tira foto da etiqueta de gôndola.
3. A IA extrai produto e preço e sugere qual item da lista corresponde.
4. O usuário confirma (ou corrige) preço e quantidade.
5. O item é marcado como comprado e o total do carrinho atualiza nos dois celulares.

O chat também aceita **texto livre**: "adiciona leite", "tira o arroz", "quanto já deu?", "o que falta?".

Exemplo de cálculo que o app deve exibir:

```
Etiqueta: R$ 1,00 × 5 un = R$ 5,00
Etiqueta: R$ 24,90 × 1 un = R$ 24,90
Total do carrinho: R$ 29,90
```

---

## 2. Stack (obrigatória)

| Camada | Tecnologia |
|---|---|
| Frontend | React 18 + TypeScript 5 (strict) + Vite 5 |
| UI | Tailwind CSS 3 + shadcn/ui + lucide-react |
| Estado servidor | TanStack React Query 5 (com persistência local para modo offline) |
| Backend | Supabase: Postgres, Auth, Storage, Realtime, Edge Functions (Deno) |
| IA | Google Gemini API, modelo `gemini-3.5-flash-lite` |
| Deploy | Vercel (frontend) + Supabase (Edge Functions) |
| App mobile | PWA instalável (vite-plugin-pwa) |

Não adicionar bibliotecas fora desta lista sem justificar e perguntar antes.

---

## 3. Regras de ouro (não negociáveis)

1. **A IA nunca faz conta.** Gemini só extrai dados e interpreta comandos. Toda multiplicação e soma acontece em TypeScript ou SQL.
2. **Dinheiro sempre em centavos inteiros** (`integer` no Postgres, `number` inteiro no TS). Nunca `float` para valores monetários. Formatação para `R$ 1.234,56` só na camada de exibição, com `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`.
3. **O usuário não corrige preço, só informa a quantidade.** A IA lê todas as faixas de preço da etiqueta (varejo, atacado, cartão) e o código escolhe a faixa correta pela quantidade informada (seção 6.4). Edição manual existe como exceção, não como passo do fluxo.
4. **Chave da API do Gemini nunca no frontend.** Fica como secret da Edge Function (`GEMINI_API_KEY`). O frontend só chama a Edge Function autenticada.
5. **Row Level Security ligado em todas as tabelas.** Só membros de uma lista leem e escrevem nela.
6. **Produto vendido por peso** (`unidade = 'kg'`) aceita quantidade decimal (ex: 0,742 kg). O total do item é `round(preco_centavos_por_kg * qtd_kg)`, arredondado para centavo inteiro.

---

## 4. Modelo de dados

Crie via migrations do Supabase (`supabase/migrations/`). Nomes em português, snake_case.

```sql
-- perfis: 1:1 com auth.users
create table perfis (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  criado_em timestamptz not null default now()
);

create table listas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  orcamento_centavos integer check (orcamento_centavos >= 0),
  mercado text,                                   -- opcional, ex: "Max Atacadista"
  cartoes text[] not null default '{}',           -- cartões de loja que a família tem, ex: {'crediffato'}
  cartoes_recusados text[] not null default '{}', -- cartões que o usuário já disse que NÃO tem
  status text not null default 'ativa' check (status in ('ativa', 'finalizada')),
  criado_por uuid not null references perfis(id),
  criado_em timestamptz not null default now(),
  finalizada_em timestamptz
);

create table lista_membros (
  lista_id uuid references listas(id) on delete cascade,
  perfil_id uuid references perfis(id) on delete cascade,
  papel text not null default 'membro' check (papel in ('dono', 'membro')),
  primary key (lista_id, perfil_id)
);

create table itens (
  id uuid primary key default gen_random_uuid(),
  lista_id uuid not null references listas(id) on delete cascade,
  nome text not null,
  unidade text not null default 'un' check (unidade in ('un', 'kg')),
  qtd_planejada numeric(10,3) check (qtd_planejada > 0),
  comprado boolean not null default false,
  faixas_preco jsonb,                             -- todas as faixas lidas da etiqueta (ver 6.1)
  faixa_aplicada text check (faixa_aplicada in ('varejo', 'atacado', 'cartao', 'manual')),
  preco_unit_centavos integer check (preco_unit_centavos >= 0),  -- preço da faixa aplicada
  qtd_comprada numeric(10,3) check (qtd_comprada > 0),
  total_centavos integer generated always as (
    case when preco_unit_centavos is null or qtd_comprada is null then null
         else round(preco_unit_centavos * qtd_comprada)::integer end
  ) stored,
  foto_path text,
  origem_preco text check (origem_preco in ('ia', 'manual')),
  adicionado_por uuid references perfis(id),
  comprado_por uuid references perfis(id),
  comprado_em timestamptz,
  criado_em timestamptz not null default now()
);

create table mensagens (
  id uuid primary key default gen_random_uuid(),
  lista_id uuid not null references listas(id) on delete cascade,
  autor_id uuid references perfis(id),          -- null quando papel = 'assistente'
  papel text not null check (papel in ('usuario', 'assistente')),
  conteudo text not null,
  tipo text not null default 'texto' check (tipo in ('texto', 'foto', 'confirmacao', 'sistema')),
  dados jsonb,                                   -- payload estruturado (extração, ação proposta)
  item_id uuid references itens(id) on delete set null,
  criado_em timestamptz not null default now()
);

-- total do carrinho
create view lista_totais with (security_invoker = true) as
select lista_id,
       coalesce(sum(total_centavos), 0)::integer as total_centavos,
       count(*) filter (where comprado) as itens_comprados,
       count(*) as itens_total
from itens
group by lista_id;
```

**Pontos de atenção:**
- Confirme que `round(integer * numeric)` retorna o valor esperado em casos de borda (ex: 1999 × 0,333) e escreva teste.
- Crie função helper `is_membro(lista_id)` com `security definer` para usar nas policies e evitar recursão de RLS em `lista_membros`.
- Habilite Realtime (publication `supabase_realtime`) para `itens` e `mensagens`.
- Trigger para criar `perfis` automaticamente no signup.
- Convite para lista: tabela `convites` com código curto (6 caracteres) e expiração, ou link com token. Escolha e documente.

**Decisões tomadas na implementação (out/2026):**
- **Convite:** tabela `convites` com código de 6 caracteres (alfabeto sem `0/O/1/I`), válido por 7 dias. `criar_convite(lista_id)` gera ou reaproveita o código; `aceitar_convite(codigo)` põe quem chamou como membro. O link `/entrar/CODIGO` só preenche o mesmo código.
- **Schema `privado`:** `is_membro`, `is_dono` e as funções de gatilho ficam fora do schema exposto pela Data API.
- **Gatilho `normalizar_item`:** item desmarcado perde preço, quantidade e faixas (senão continuaria somando em `lista_totais`); item marcado ganha `comprado_por` e `comprado_em`.
- **Privilégios por coluna:** o cliente só altera `dados` e `item_id` em `mensagens`; mensagens do assistente são gravadas pela Edge Function.
- **Realtime:** além de `itens` e `mensagens`, a tabela `listas` está na publication (orçamento, cartões respondidos, finalização).
- **Tabela `uso_ia`** ganhou a coluna `modelo`.
- **Atividade ao vivo:** "digitando" e "pensando" não usam tabela. Vão por Realtime Broadcast no canal privado `lista:{lista_id}:atividade`; duas políticas em `realtime.messages` (migration `atividade_ao_vivo`) deixam só membros da lista ouvir e anunciar.
- **Quem adicionou:** `itens.adicionado_por` tem `default auth.uid()`, então vale também para itens criados pela função `chat` (ela grava com o token do usuário).
- **Seção do mercado:** coluna `itens.secao` (migration `secao_do_item`), nula na maioria dos itens. A seção sai do nome, por uma tabela de palavras em `src/lib/secoes.ts` (sem IA, funciona offline); a coluna só guarda a escolha feita à mão na folha do item.

---

## 5. Storage (fotos)

- Bucket privado `etiquetas`, caminho `{lista_id}/{uuid}.jpg`.
- Policy: só membros da lista leem/escrevem na pasta da lista.
- **Comprimir no cliente antes do upload**: redimensionar para lado maior de 1280px, JPEG qualidade ~0.8. Etiqueta não precisa de foto de 12MP.
- **Padrão: apagar a foto 24h após a confirmação do preço** (job agendado ou limpeza na Edge Function). Deixar isso configurável por uma constante `MANTER_FOTOS = false`. Se `true`, guarda para histórico de preços.

---

## 6. Edge Functions

### 6.1 `ler-etiqueta`

Entrada (POST, JWT do usuário obrigatório):
```json
{ "lista_id": "uuid", "foto_path": "lista_id/arquivo.jpg" }
```

Passos:
1. Validar JWT e que o usuário é membro da lista.
2. Baixar a foto do Storage.
3. Buscar os itens **não comprados** da lista (id + nome) para a IA sugerir correspondência.
4. Chamar o Gemini com a imagem + prompt + JSON schema (ver 6.3).
5. Validar a resposta com Zod. Se inválida, retornar erro tratável, nunca inventar valores.
6. Retornar ao frontend. **Não grava no item**: quem grava é a etapa de quantidade (7.2).

Saída:
```json
{
  "produto": "Produto X 400g",
  "unidade": "un",
  "faixas": [
    { "tipo": "varejo",  "preco_centavos": 489, "qtd_minima": 1, "cartao": null },
    { "tipo": "atacado", "preco_centavos": 469, "qtd_minima": 6, "cartao": null },
    { "tipo": "cartao",  "preco_centavos": 450, "qtd_minima": 1, "cartao": "crediffato" }
  ],
  "item_sugerido_id": "uuid ou null",
  "confianca": "alta | media | baixa",
  "observacao": "texto curto se algo estiver ilegível"
}
```

Regras do prompt (baseadas em etiquetas reais de atacarejo):
- **Ler todas as faixas visíveis.** Etiquetas comuns têm 1 a 3 preços: varejo (preço base), atacado ("a partir de N unidades") e cartão da loja ("Vuon Card", "Cartão Crediffato", "Clube", etc.).
- `qtd_minima`: extrair o N de "a partir de N unidades". Varejo e cartão sem condição de quantidade = 1.
- `cartao`: nome do cartão normalizado em minúsculas sem acento (ex: `"vuon card"`, `"crediffato"`). `null` se a faixa não exige cartão.
- **Ignorar preços de referência** que não são preço de venda da unidade: "Preço ref. 1 litro", "R$/kg" ao lado de produto vendido por unidade, "preço por unidade R$ X" que só repete um valor já lido. Não podem virar faixa.
- Etiqueta com um só preço (estilo gôndola simples) = uma faixa `varejo`.
- Preço "de/por": usar o "por" como varejo.
- Produto vendido por peso: `unidade = 'kg'` e preços são do kg.
- Faixa ilegível: omitir a faixa e explicar em `observacao`. **Se o varejo estiver ilegível**, `confianca = 'baixa'`. Nunca chutar número.

**Decisão (out/2026): validação da leitura, nada presumido.** O que a IA não lê com certeza vira erro na tela, nunca valor preenchido:
- O modelo devolve `produto: null` quando não lê o nome e lista em `nao_lido` o que existe na etiqueta mas ficou sem ler (`etiqueta`, `produto`, `unidade`, `preco_varejo`, `preco_atacado`, `qtd_minima`, `preco_cartao`, `nome_cartao`).
- `validarLeitura` (`_shared/schemas.ts`) confere a resposta sem confiar nela e sem completar o que falta. O resultado traz `problemas`, com os códigos e textos de `src/lib/leitura.ts`: `sem_etiqueta`, `sem_nome`, `sem_preco`, `atacado_ilegivel`, `cartao_ilegivel`, `unidade_incerta`, `precos_incoerentes`, `leitura_duvidosa`. Também viram problema: preço zero, cartão sem nome, atacado sem quantidade mínima, dois varejos diferentes e atacado ou cartão mais caro que o varejo.
- `sem_etiqueta` não gera card: a foto fica na conversa com o aviso do assistente.
- Qualquer problema que não seja só o nome trava o preço: o card mostra o que faltou, não calcula e pede o valor da etiqueta. As faixas que foram lidas aparecem como atalhos, e só entram se a pessoa tocar. O item é gravado como `origem_preco = 'manual'` e sem `faixas_preco`.
- `sem_nome`: o card pede o nome (ou a escolha de um item da lista) e descarta a sugestão de item.
- A função `chat` segue a mesma regra: "levei 6" não calcula em cima de leitura incompleta; preço dito sem quantidade dita nem planejada vira pergunta, não "1".

### 6.4 Regra de escolha da faixa (código, não IA)

Função pura em `src/lib/precos.ts` (e cópia em `supabase/functions/_shared/` se o servidor precisar), com testes:

```ts
type Faixa = { tipo: 'varejo' | 'atacado' | 'cartao'; preco_centavos: number; qtd_minima: number; cartao: string | null };

function escolherFaixa(faixas: Faixa[], qtd: number, cartoesDaLista: string[]): Faixa
```

1. **Elegíveis** = faixas com `qtd >= qtd_minima` **e** (`cartao === null` **ou** `cartao` está em `cartoesDaLista`).
2. Escolher a elegível de **menor preço**.
3. Se nenhuma for elegível (ex: varejo ilegível e quantidade abaixo do atacado), não calcular: pedir o preço manualmente.
4. **Atacado vale para todas as unidades** quando a quantidade atinge o mínimo (padrão do atacarejo brasileiro: 6 unidades de R$ 4,69 = R$ 28,14, não 5 × varejo + 1 × atacado).
5. **Cartão desconhecido:** se a etiqueta tem faixa de cartão que não está em `cartoes` nem em `cartoes_recusados` da lista, o chat pergunta uma vez "Vocês têm o cartão Crediffato?" e grava a resposta na lista. Nas próximas etiquetas do mesmo cartão, não pergunta mais.

Exemplos que devem virar teste (etiquetas reais):

| Etiqueta | Qtd | Cartão? | Faixa | Cálculo |
|---|---|---|---|---|
| Varejo 1,99 / 3+ 1,89 / Vuon Card 1,49 | 2 | não | varejo | 2 × 1,99 = 3,98 |
| Varejo 1,99 / 3+ 1,89 / Vuon Card 1,49 | 5 | não | atacado | 5 × 1,89 = 9,45 |
| Varejo 1,99 / 3+ 1,89 / Vuon Card 1,49 | 5 | sim | cartão | 5 × 1,49 = 7,45 |
| Varejo 4,89 / 6+ 4,69 / Crediffato 4,50 | 6 | não | atacado | 6 × 4,69 = 28,14 |
| Varejo 4,89 / 6+ 4,69 / Crediffato 4,50 | 2 | sim | cartão | 2 × 4,50 = 9,00 |
| Varejo 1,59 / 6+ 1,19 | 5 | n/a | varejo | 5 × 1,59 = 7,95 |
| Varejo 1,59 / 6+ 1,19 | 6 | n/a | atacado | 6 × 1,19 = 7,14 |
| Só 1,99 | 3 | n/a | varejo | 3 × 1,99 = 5,97 |

**Mudança de quantidade depois:** se o usuário alterar a quantidade de um item já comprado, recalcular a faixa a partir de `faixas_preco` salvas no item. Por isso as faixas são persistidas.

**Dica de economia (opcional, ligada por padrão):** se a quantidade estiver perto do atacado e levar o mínimo sair mais barato ou quase igual, avisar. Ex: 5 × 1,59 = 7,95, mas 6 × 1,19 = 7,14: "Levando 6 você paga R$ 0,81 a menos e leva 1 a mais." O cálculo é do código; o app só sugere, nunca altera sozinho.

### 6.2 `chat`

Entrada:
```json
{ "lista_id": "uuid", "mensagem": "adiciona 2 leites e tira o arroz" }
```

O Gemini interpreta a mensagem e devolve uma **lista de ações estruturadas**, que a Edge Function valida (Zod) e executa no banco. A IA não escreve no banco diretamente.

Ações permitidas:
```ts
type Acao =
  | { tipo: 'adicionar_item'; nome: string; qtd?: number; unidade?: 'un' | 'kg' }
  | { tipo: 'remover_item'; item_id: string }
  | { tipo: 'marcar_comprado'; item_id: string; qtd: number; preco_centavos: number }
  | { tipo: 'desmarcar_comprado'; item_id: string }
  | { tipo: 'consultar_faltantes' }
  | { tipo: 'consultar_total' }
  | { tipo: 'responder'; texto: string };   // pergunta fora do escopo ou pedido de esclarecimento
```

- `consultar_total` e `consultar_faltantes` são respondidas **com dados do banco**, nunca com número gerado pela IA.
- Ações destrutivas (`remover_item`, `desmarcar_comprado`) e `marcar_comprado` via texto retornam como **proposta** para o usuário confirmar no app antes de executar.
- Se a mensagem for ambígua (ex: "tira o leite" e existem 2 leites), a ação é `responder` pedindo esclarecimento.
- Enviar ao modelo só o necessário: itens da lista (id, nome, unidade, comprado) e as últimas ~10 mensagens.
- **Decisões (out/2026):**
  - **Pedido falado.** A entrada aceita `audio: { data, mime_type }` (base64) no lugar de `mensagem`, nunca os dois. O áudio vai para o Gemini na mesma chamada, junto do contexto; a resposta traz `transcricao`, que a função grava como a mensagem do usuário, e as ações de sempre. O app grava no microfone, converte para WAV mono de 16 kHz e limita a 25 s (`src/lib/voz.ts`).
  - **Marcar sem preço.** Em `marcar_comprado`, `qtd` e `preco_centavos` passaram a ser opcionais. Sem preço ("peguei o leite"), a função põe o item no carrinho na hora, igual a tocar no círculo: ele fica fora do total até alguém informar o preço. Com preço dito, continua sendo proposta para confirmar.
- **Ação extra implementada:** `{ tipo: 'informar_quantidade'; qtd: number }`, usada quando o usuário responde por texto ao último card de etiqueta aberto ("levei 6", seção 7.2 passo 5). A faixa é escolhida por `precos.ts` e o item é gravado na hora, como se ele tivesse tocado em Adicionar.

### 6.3 Chamada ao Gemini

- Usar a REST API (`generateContent`) via `fetch` no Deno, ou o SDK oficial `@google/genai` se funcionar bem no runtime Deno da Supabase. **Consulte a documentação oficial atual** (https://ai.google.dev/gemini-api/docs) para:
  - endpoint e header de autenticação corretos;
  - como enviar imagem inline em base64;
  - **structured output** (resposta em JSON com schema). Use o recurso nativo de schema, não "peça JSON no prompt" e faça parse no escuro.
- Modelo configurável por secret `GEMINI_MODEL` (default `gemini-3.5-flash-lite`), para trocar sem redeploy de código.
- Timeout de 20s e uma única tentativa de retry em erro 5xx/429. Erro final vira mensagem amigável no chat.
- Logar tokens consumidos (vêm em `usageMetadata`) numa tabela `uso_ia` (lista_id, funcao, tokens_entrada, tokens_saida, criado_em) para acompanhar custo.

**Atenção sobre o plano gratuito do Gemini:** no free tier, o Google usa o conteúdo enviado para melhorar os produtos dele. No pago, não. Fotos de etiqueta não são sensíveis, mas fica registrado.

**Decisão (out/2026): Interactions API em vez de `generateContent`.** A documentação oficial passou a recomendar a Interactions API para projetos novos e a tratar `generateContent` como legado (ainda suportado). O cliente está em `supabase/functions/_shared/gemini.ts`:
- `POST https://generativelanguage.googleapis.com/v1beta/interactions`, header `x-goog-api-key`.
- Imagem inline: bloco `{ type: 'image', data: <base64>, mime_type: 'image/jpeg' }` em `input`, depois do bloco de texto.
- Saída estruturada: `response_format: { type: 'text', mime_type: 'application/json', schema }`.
- `store: false`, para o Google não guardar as interações (o padrão é guardar).
- Tokens: `usage.total_input_tokens` e `usage.total_output_tokens` + `usage.total_thought_tokens` (no lugar de `usageMetadata`).

---

## 7. Frontend

### 7.1 Telas

1. **Login** (magic link por e-mail via Supabase Auth).
   **Decisão (out/2026):** o login principal passou a ser **e-mail e senha**, com criação de conta na mesma tela. O magic link ficou como alternativa (e como "esqueci a senha": entra pelo link e define outra senha no Perfil). Não há código de 6 dígitos por e-mail.
   **Layout (out/2026):** marca, frase e cartão de foto sobre o preto (`Moldura` com `topo`, a tela escura da referência) e o formulário numa folha ancorada embaixo. A folha cabe inteira na tela, então não há área rolável; quem cede altura é o topo, em degraus por container query (`src/index.css`): sai o cartão, depois a frase, depois a marca. Com o teclado aberto ficam só os campos e o botão. Quem volta de um link de e-mail vencido vê o motivo.
2. **Minhas listas**: listas ativas, botão "nova lista", entrar por código de convite.
3. **Lista** (tela principal), com duas abas:
   - **Chat**: conversa com o assistente, botão de câmera, campo de texto.
   - **Itens**: visão de checklist (faltando / no carrinho), edição rápida.
   - Barra fixa no rodapé ou topo com **total do carrinho** e progresso (`7 de 12 itens`). Se houver orçamento, mostrar quanto falta / quanto passou.
4. **Histórico**: listas finalizadas com total gasto.

### 7.2 Fluxo da foto no chat

1. Botão câmera abre `<input type="file" accept="image/*" capture="environment">`.
2. Comprime no cliente, mostra a miniatura na conversa com estado "lendo etiqueta...".
3. Upload no Storage, chama `ler-etiqueta`.
4. Assistente responde com um **card de quantidade** (não de correção de preço):
   - nome do produto e item da lista sugerido (trocável, ou "novo item");
   - as faixas lidas, em linha compacta: `Varejo 4,89 · 6+ 4,69 · Crediffato 4,50`;
   - pergunta "Quantos?" com botões 1, 2, 3, 6, 12 e campo livre (decimal se `kg`). Se a etiqueta tem atacado, incluir o `qtd_minima` entre os botões;
   - ao escolher a quantidade, o card mostra na hora a faixa aplicada e o cálculo: `6 × R$ 4,69 (atacado) = R$ 28,14`, mais a dica de economia se houver;
   - um toque em **Adicionar** grava. Botão secundário discreto "preço diferente?" para o caso raro de erro.
5. A quantidade também pode vir por texto ou voz no chat ("levei 6"), interpretada pela função `chat` como resposta ao último card aberto.
6. Gravar no item: `comprado = true`, `faixas_preco`, `faixa_aplicada`, `preco_unit_centavos`, `qtd_comprada`, `origem_preco = 'ia'` (ou `'manual'` se o usuário usou "preço diferente?"). Total atualiza via Realtime nos dois aparelhos.
7. Confiança `baixa` ou nenhuma faixa elegível: aí sim o card pede o preço, explicando o que não deu para ler.

### 7.3 Realtime e offline

- Assinar mudanças em `itens` e `mensagens` filtradas por `lista_id`, e invalidar/atualizar o cache do React Query.
- Persistir cache do React Query localmente (`@tanstack/query-sync-storage-persister` ou equivalente oficial).
- Sem conexão: lista e marcações manuais funcionam e entram numa fila; foto mostra "sem conexão, tente de novo". Ao reconectar, sincroniza.
- Indicador visível de status (online / offline / sincronizando).

**Decisões (out/2026):**
- **Conexão medida, não suposta.** `navigator.onLine` diz "online" em Wi-Fi sem internet. Uma sonda (`src/lib/conexao.ts`) chama `GET /auth/v1/health` a cada 20 s com a aba visível; duas falhas seguidas viram offline e põem as alterações na fila, e a primeira resposta reenvia a fila. O indicador (`StatusConexao`) mostra barras de sinal conforme a latência medida e pisca a cada resposta da sonda e a cada dado que chega pelo Realtime. Com o servidor respondendo mas o canal da lista fora, mostra "Reconectando".
- **Dois canais por lista.** `lista:{id}` leva só as mudanças do banco. `lista:{id}:atividade` leva "digitando" e "pensando" por Broadcast, com repetição a cada 3 s enquanto dura e validade de 7 s em quem recebe (se o outro aparelho some, o aviso some junto). Não usar Presence para isso: o Realtime aceita 5 atualizações de Presence a cada 30 s por conexão e derruba o canal inteiro quando passa, levando a sincronização junto.
- **Quem colocou o quê.** Com mais de um membro na lista, cada item mostra "Você adicionou" ou "Fulano adicionou" na linha e na folha de edição.
- **Sem preço não trava.** Tocar no círculo marca o item sem pedir preço; ele aparece como "sem preço" e o rodapé conta quantos estão assim.
- **Foto sem sinal fica na fila.** Toda foto de etiqueta passa por `src/lib/filaDeFotos.ts`: a imagem comprimida é guardada no IndexedDB e só sai de lá quando `ler-etiqueta` responde. Sem conexão ela aparece na conversa como "Na fila" e é lida sozinha quando o sinal volta, mesmo depois de fechar e reabrir o app. Falha de rede devolve a foto à fila (nova tentativa em 20 s); recusa do servidor vira erro com "Tentar de novo" e "Descartar". O indicador soma as fotos ao "N na fila".
- **Lista agrupada por seção.** O que falta aparece em grupos (hortifrúti, padaria, açougue, frios, mercearia, bebidas, congelados, limpeza, higiene, pet, outros), na ordem do caminho da loja; "No carrinho" fica por último.
- **Preço da última vez.** Cada item ainda não comprado mostra quanto custou na compra anterior mais recente de mesmo nome (`src/lib/previsao.ts`, sobre os itens com preço das outras listas da pessoa). Com isso o app estima o que falta (preço anterior vezes quantidade planejada, ou uma unidade) e o rodapé mostra a previsão do total. Item sem preço anterior, ou por peso sem peso planejado, fica fora da conta, e a tela diz quantos ficaram.
- **Importar itens.** Na aba Itens: de um texto colado (`src/lib/importar.ts`, leitura sem IA; quantidade só nos formatos sem dúvida, e "Arroz 5kg" continua sendo nome) ou de outra lista da pessoa, inclusive finalizada (vêm nome, unidade, quantidade planejada e seção; preço não). O que já está na lista esperando compra não entra de novo. O lote vai num pedido só e reenviar não duplica.
- **Resumo ao finalizar.** "Finalizar compra" abre antes um resumo (`src/lib/resumo.ts`): total, itens no carrinho, economia do atacado e do cartão em relação ao varejo das mesmas etiquetas, itens sem preço e itens que ficaram sem comprar. Só o segundo toque finaliza.

### 7.4 PWA

- `vite-plugin-pwa` com manifest: nome "Listou", ícones, `display: standalone`, cor de tema conforme o design.
- Funcionar bem em tela de 360px a 430px de largura. Desktop é secundário.

---

## 8. Design

> **Aplicado (out/2026):** a referência é o "Savor - Meal & Grocery Mobile App" (Odama, Dribbble). Todos os tokens (cores, raios, fontes, claro e escuro) estão em `src/index.css`; os componentes só os referenciam via `tailwind.config.ts`.

O que veio da referência:
- **Moldura:** fundo preto com a folha creme (`#FCF9EF`) de cantos inferiores arredondados; navegação ou total do carrinho na faixa preta (`components/layout/Moldura.tsx`).
- **Cores:** laranja `#FB6133`, chip amarelo `#F4C54F`, verde-escuro dos títulos do checklist `#0D2619`, faixa de dica pêssego.
- **Tipografia:** Inter Tight (interface) e Instrument Serif itálica (nomes de lista e títulos de destaque), hospedadas no próprio app.
- **Cartão com foto** para a lista em destaque e miniaturas nas linhas, no lugar das fotos de receita (`src/lib/fotos.ts`, créditos em `src/assets/fotos/CREDITOS.md`).
- **Checklist** com círculos, texto riscado e divisores recuados.
- **Colmeia** de hexágonos deitados ao fundo, propositalmente quase invisível (`components/layout/Colmeia.tsx`; a força é o token `--colmeia-forca`).

Onde o app se afasta dela, de propósito:
- **Texto branco sobre o laranja (decisão do usuário, out/2026).** Dá 3,06:1: passa no AA só para texto grande ou em negrito, e não para texto pequeno corrido. O app antes usava texto escuro (6,8:1); voltar é trocar `--primary-foreground` em `src/index.css`.
- **Cinzas mais escuros** em texto secundário e na borda dos círculos, pelo mesmo motivo.
- **Sem brilhos:** nada de halo colorido atrás de cartões nem sombra laranja em botões.

Alvos de teste: iPhone 16 (393 × 852) e Galaxy S24 Ultra (412 × 915). `dev/dispositivos.html` mostra os dois lado a lado.

Requisitos que valem independente do design:
- Modo claro e escuro.
- Alvos de toque com no mínimo 44px.
- Valores monetários com `font-variant-numeric: tabular-nums`.
- Contraste mínimo WCAG AA.

---

## 9. Estrutura de pastas sugerida

```
listou/
├── src/
│   ├── components/
│   │   ├── ui/              # shadcn
│   │   ├── chat/            # ChatView, MessageBubble, ConfirmCard, CameraButton
│   │   └── lista/           # ItemRow, TotalBar, ListaTabs
│   ├── hooks/               # useLista, useItens, useMensagens, useRealtime
│   ├── lib/
│   │   ├── supabase.ts
│   │   ├── dinheiro.ts      # formatar, parse "24,90" -> 2490, calcular total
│   │   ├── imagem.ts        # compressão
│   │   └── queryClient.ts
│   ├── pages/
│   ├── types/database.ts    # gerado pelo supabase gen types
│   └── main.tsx
├── supabase/
│   ├── migrations/
│   └── functions/
│       ├── ler-etiqueta/
│       ├── chat/
│       └── _shared/         # cliente Gemini, schemas Zod, auth helper
├── .env.example
└── CLAUDE.md
```

---

## 10. Variáveis de ambiente

**Frontend (`.env`, também na Vercel):**
```
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

**Edge Functions (secrets do Supabase):**
```
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.5-flash-lite
```

Nunca commitar `.env`. Criar `.env.example` sem valores.

---

## 11. Testes obrigatórios

- `lib/dinheiro.ts`: parse de "24,90", "24.90", "1.234,56", "R$ 5"; total com quantidade inteira e decimal; arredondamento. Vitest.
- `lib/precos.ts`: todos os casos da tabela da seção 6.4, mais: quantidade exatamente no mínimo, uma abaixo, cartão recusado, faixa de cartão com quantidade mínima própria, nenhuma faixa elegível, dica de economia.
- Schemas Zod das Edge Functions: respostas válidas, campos faltando, preço negativo, preço como string.
- Policies RLS: usuário de fora da lista não lê nem escreve.
- Teste manual com pelo menos 20 fotos reais de etiquetas antes de considerar a leitura pronta: preço único, varejo + atacado, varejo + atacado + cartão, de/por, por kg, etiqueta com "preço ref. por litro", foto tremida ou com reflexo. Registrar taxa de acerto **por faixa** (varejo, atacado, qtd mínima, cartão). Como o usuário não revisa preço, a meta é acertar todas as faixas em pelo menos 95% das fotos nítidas; abaixo disso, reportar antes de seguir.

---

## 12. Ordem de implementação

1. Scaffold Vite + TS + Tailwind + shadcn + React Query. Lint e `tsc --noEmit` passando.
2. Migrations, RLS, trigger de perfil, Realtime. Gerar tipos.
3. Auth (magic link) + telas de listas e itens **sem IA**. Soma e Realtime funcionando entre dois navegadores.
4. Upload de foto + Edge Function `ler-etiqueta` + card de confirmação.
5. Edge Function `chat` com texto livre.
6. Offline + PWA.
7. Aplicar o design definitivo.
8. Deploy: Edge Functions no Supabase, frontend na Vercel com as env vars.

Ao fim de cada etapa: rodar build e testes, fazer commit, e reportar o que foi feito e o que ficou pendente. Se algo não funcionar, diga claramente, não simule progresso.

---

## 13. Fora do escopo (por enquanto)

- Leitura de cupom fiscal / NFC-e.
- Comparação de preço entre mercados.
- Notificações push.
- App nativo nas lojas.
