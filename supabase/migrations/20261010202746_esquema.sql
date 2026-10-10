-- Listou: esquema base (CLAUDE.md, seção 4).
-- Dinheiro sempre em centavos inteiros; quantidades em numeric(10,3) para aceitar kg.

-- Funções auxiliares ficam fora do schema exposto pela Data API.
create schema if not exists privado;

-- perfis: 1:1 com auth.users
create table public.perfis (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null check (btrim(nome) <> ''),
  criado_em timestamptz not null default now()
);

create table public.listas (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (btrim(nome) <> ''),
  orcamento_centavos integer check (orcamento_centavos >= 0),
  mercado text,                                   -- opcional, ex: "Max Atacadista"
  cartoes text[] not null default '{}',           -- cartões de loja que a família tem, ex: {'crediffato'}
  cartoes_recusados text[] not null default '{}', -- cartões que o usuário já disse que NÃO tem
  status text not null default 'ativa' check (status in ('ativa', 'finalizada')),
  criado_por uuid not null default auth.uid() references public.perfis(id),
  criado_em timestamptz not null default now(),
  finalizada_em timestamptz
);

create table public.lista_membros (
  lista_id uuid references public.listas(id) on delete cascade,
  perfil_id uuid references public.perfis(id) on delete cascade,
  papel text not null default 'membro' check (papel in ('dono', 'membro')),
  primary key (lista_id, perfil_id)
);

create table public.itens (
  id uuid primary key default gen_random_uuid(),
  lista_id uuid not null references public.listas(id) on delete cascade,
  nome text not null check (btrim(nome) <> ''),
  unidade text not null default 'un' check (unidade in ('un', 'kg')),
  qtd_planejada numeric(10,3) check (qtd_planejada > 0),
  comprado boolean not null default false,
  faixas_preco jsonb,                             -- todas as faixas lidas da etiqueta (seção 6.1)
  faixa_aplicada text check (faixa_aplicada in ('varejo', 'atacado', 'cartao', 'manual')),
  preco_unit_centavos integer check (preco_unit_centavos >= 0),  -- preço da faixa aplicada
  qtd_comprada numeric(10,3) check (qtd_comprada > 0),
  total_centavos integer generated always as (
    case when preco_unit_centavos is null or qtd_comprada is null then null
         else round(preco_unit_centavos * qtd_comprada)::integer end
  ) stored,
  foto_path text,
  origem_preco text check (origem_preco in ('ia', 'manual')),
  adicionado_por uuid default auth.uid() references public.perfis(id),
  comprado_por uuid references public.perfis(id),
  comprado_em timestamptz,
  criado_em timestamptz not null default now()
);

create table public.mensagens (
  id uuid primary key default gen_random_uuid(),
  lista_id uuid not null references public.listas(id) on delete cascade,
  autor_id uuid references public.perfis(id),    -- null quando papel = 'assistente'
  papel text not null check (papel in ('usuario', 'assistente')),
  conteudo text not null,
  tipo text not null default 'texto' check (tipo in ('texto', 'foto', 'confirmacao', 'sistema')),
  dados jsonb,                                   -- payload estruturado (extração, ação proposta)
  item_id uuid references public.itens(id) on delete set null,
  criado_em timestamptz not null default now()
);

-- Convite por código curto (decisão documentada no CLAUDE.md, seção 4).
-- 6 caracteres de um alfabeto sem 0/O/1/I, válido por 7 dias.
create table public.convites (
  codigo text primary key check (codigo ~ '^[A-HJ-NP-Z2-9]{6}$'),
  lista_id uuid not null references public.listas(id) on delete cascade,
  criado_por uuid not null references public.perfis(id),
  expira_em timestamptz not null default now() + interval '7 days',
  criado_em timestamptz not null default now()
);

-- Consumo do Gemini, para acompanhar custo (seção 6.3). Só a Edge Function escreve.
create table public.uso_ia (
  id bigint generated always as identity primary key,
  lista_id uuid references public.listas(id) on delete set null,
  funcao text not null,
  modelo text,
  tokens_entrada integer not null default 0,
  tokens_saida integer not null default 0,
  criado_em timestamptz not null default now()
);

create index itens_lista_id_idx on public.itens (lista_id);
create index mensagens_lista_criado_idx on public.mensagens (lista_id, criado_em);
create index mensagens_item_id_idx on public.mensagens (item_id);
create index lista_membros_perfil_id_idx on public.lista_membros (perfil_id);
create index listas_criado_por_idx on public.listas (criado_por);
create index convites_lista_id_idx on public.convites (lista_id);
create index uso_ia_lista_id_idx on public.uso_ia (lista_id);

-- total do carrinho
create view public.lista_totais with (security_invoker = true) as
select lista_id,
       coalesce(sum(total_centavos), 0)::integer as total_centavos,
       count(*) filter (where comprado) as itens_comprados,
       count(*) as itens_total
from public.itens
group by lista_id;
