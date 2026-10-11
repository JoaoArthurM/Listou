-- O plano gratuito pausa o projeto depois de 7 dias sem atividade. Um agendador
-- externo chama public.batimento() a cada poucos dias; ela grava um carimbo numa
-- linha só, então o banco registra escrita de verdade e não cresce.
create table public.batimento (
  id boolean primary key default true check (id),
  ultimo timestamptz not null default now()
);

alter table public.batimento enable row level security;  -- sem policy: ninguém lê pela API
revoke all on public.batimento from anon, authenticated;

insert into public.batimento (id) values (true);

create or replace function public.batimento()
returns timestamptz
language sql security definer set search_path = ''
as $$
  update public.batimento set ultimo = now() where id returning ultimo;
$$;

revoke all on function public.batimento() from public;
grant execute on function public.batimento() to anon, authenticated;
