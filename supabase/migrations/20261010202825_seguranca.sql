-- Listou: RLS, funções auxiliares, gatilhos, convites e Realtime.
-- Regra de ouro 5: só membros de uma lista leem e escrevem nela.

-- ---------------------------------------------------------------------------
-- Funções auxiliares (security definer para as policies não recursarem em
-- lista_membros). Ficam no schema "privado", que a Data API não expõe.
-- ---------------------------------------------------------------------------

create or replace function privado.is_membro(p_lista_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.lista_membros m
    where m.lista_id = p_lista_id and m.perfil_id = (select auth.uid())
  );
$$;

create or replace function privado.is_dono(p_lista_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.lista_membros m
    where m.lista_id = p_lista_id
      and m.perfil_id = (select auth.uid())
      and m.papel = 'dono'
  );
$$;

-- Quem divide alguma lista comigo pode ver meu nome ("comprado por Maria").
create or replace function privado.compartilha_lista(p_perfil_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.lista_membros eu
    join public.lista_membros outro on outro.lista_id = eu.lista_id
    where eu.perfil_id = (select auth.uid()) and outro.perfil_id = p_perfil_id
  );
$$;

-- Storage: a primeira pasta do caminho é o id da lista. Compara como texto
-- para um nome de pasta inválido negar o acesso em vez de estourar no cast.
create or replace function privado.is_membro_da_pasta(p_pasta text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.lista_membros m
    where m.lista_id::text = p_pasta and m.perfil_id = (select auth.uid())
  );
$$;

-- ---------------------------------------------------------------------------
-- Gatilhos
-- ---------------------------------------------------------------------------

-- Cria o perfil no signup. Nome vem do metadado "nome" ou do início do e-mail.
create or replace function privado.criar_perfil()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.perfis (id, nome)
  values (
    new.id,
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'nome'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Sem nome'
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger ao_criar_usuario
after insert on auth.users
for each row execute function privado.criar_perfil();

-- Quem cria a lista vira dono dela.
create or replace function privado.adicionar_dono()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.lista_membros (lista_id, perfil_id, papel)
  values (new.id, new.criado_por, 'dono')
  on conflict (lista_id, perfil_id) do nothing;
  return new;
end;
$$;

create trigger ao_criar_lista
after insert on public.listas
for each row execute function privado.adicionar_dono();

create or replace function privado.carimbar_finalizacao()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.status = 'finalizada' and old.status is distinct from 'finalizada' then
    new.finalizada_em := now();
  elsif new.status = 'ativa' then
    new.finalizada_em := null;
  end if;
  return new;
end;
$$;

create trigger ao_mudar_status_lista
before update of status on public.listas
for each row execute function privado.carimbar_finalizacao();

-- Mantém o item coerente: comprado carimba quem/quando; não comprado não
-- carrega preço (senão continuaria somando em lista_totais).
create or replace function privado.normalizar_item()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.comprado then
    if tg_op = 'INSERT' then
      new.comprado_em := coalesce(new.comprado_em, now());
      new.comprado_por := coalesce(new.comprado_por, (select auth.uid()));
    elsif not old.comprado then
      new.comprado_em := coalesce(new.comprado_em, now());
      new.comprado_por := coalesce(new.comprado_por, (select auth.uid()));
    end if;
  else
    new.faixas_preco := null;
    new.faixa_aplicada := null;
    new.preco_unit_centavos := null;
    new.qtd_comprada := null;
    new.origem_preco := null;
    new.foto_path := null;
    new.comprado_por := null;
    new.comprado_em := null;
  end if;
  return new;
end;
$$;

create trigger ao_gravar_item
before insert or update on public.itens
for each row execute function privado.normalizar_item();

-- ---------------------------------------------------------------------------
-- RPCs chamadas pelo app
-- ---------------------------------------------------------------------------

-- Gera (ou reaproveita) um código de convite para a lista.
create or replace function public.criar_convite(p_lista_id uuid)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_alfabeto constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_hex text;
  v_codigo text;
  v_tentativas integer := 0;
begin
  if not privado.is_membro(p_lista_id) then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;

  select c.codigo into v_codigo
  from public.convites c
  where c.lista_id = p_lista_id and c.expira_em > now() + interval '1 day'
  order by c.expira_em desc
  limit 1;
  if v_codigo is not null then
    return v_codigo;
  end if;

  loop
    -- Os 12 primeiros dígitos hex de um uuid v4 são 6 bytes aleatórios;
    -- 256 é múltiplo de 32, então o módulo não enviesa o sorteio.
    v_hex := replace(gen_random_uuid()::text, '-', '');
    select string_agg(
             substr(v_alfabeto, 1 + (('x' || substr(v_hex, i * 2 + 1, 2))::bit(8)::integer % 32), 1),
             '' order by i
           )
      into v_codigo
      from generate_series(0, 5) as i;
    begin
      insert into public.convites (codigo, lista_id, criado_por)
      values (v_codigo, p_lista_id, (select auth.uid()));
      return v_codigo;
    exception when unique_violation then
      v_tentativas := v_tentativas + 1;
      if v_tentativas > 5 then
        raise;
      end if;
    end;
  end loop;
end;
$$;

-- Entra na lista do convite. Precisa ser security definer: quem aceita ainda
-- não é membro, então não enxerga nem o convite nem a lista.
create or replace function public.aceitar_convite(p_codigo text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_lista_id uuid;
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'nao_autenticado' using errcode = '28000';
  end if;

  select c.lista_id into v_lista_id
  from public.convites c
  where c.codigo = upper(btrim(p_codigo)) and c.expira_em > now();

  if v_lista_id is null then
    raise exception 'convite_invalido' using errcode = 'P0001';
  end if;

  insert into public.lista_membros (lista_id, perfil_id, papel)
  values (v_lista_id, v_uid, 'membro')
  on conflict (lista_id, perfil_id) do nothing;

  return v_lista_id;
end;
$$;

-- Grava a resposta de "Vocês têm o cartão X?" (seção 6.4, regra 5).
-- Security invoker: quem decide se pode é a policy de update de listas.
create or replace function public.responder_cartao(p_lista_id uuid, p_cartao text, p_tem boolean)
returns void
language plpgsql set search_path = ''
as $$
declare
  v_cartao text := lower(btrim(p_cartao));
begin
  if v_cartao = '' then
    raise exception 'cartao_vazio' using errcode = '22023';
  end if;

  update public.listas l
  set cartoes = case
        when p_tem then array(select distinct x from unnest(l.cartoes || v_cartao) as x order by x)
        else array_remove(l.cartoes, v_cartao)
      end,
      cartoes_recusados = case
        when p_tem then array_remove(l.cartoes_recusados, v_cartao)
        else array(select distinct x from unnest(l.cartoes_recusados || v_cartao) as x order by x)
      end
  where l.id = p_lista_id;

  if not found then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Privilégios: nada para anon; authenticated só o necessário.
-- ---------------------------------------------------------------------------

revoke all on schema privado from public, anon;
grant usage on schema privado to authenticated, service_role;
revoke all on all functions in schema privado from public, anon;
grant execute on all functions in schema privado to authenticated, service_role;

revoke all on function public.criar_convite(uuid) from public, anon;
revoke all on function public.aceitar_convite(text) from public, anon;
revoke all on function public.responder_cartao(uuid, text, boolean) from public, anon;
grant execute on function public.criar_convite(uuid) to authenticated;
grant execute on function public.aceitar_convite(text) to authenticated;
grant execute on function public.responder_cartao(uuid, text, boolean) to authenticated;

revoke all on public.perfis, public.listas, public.lista_membros, public.itens,
              public.mensagens, public.convites, public.uso_ia, public.lista_totais
  from anon, authenticated;

grant select on public.perfis to authenticated;
grant update (nome) on public.perfis to authenticated;

grant select, delete on public.listas to authenticated;
grant insert (nome, orcamento_centavos, mercado) on public.listas to authenticated;
grant update (nome, orcamento_centavos, mercado, cartoes, cartoes_recusados, status)
  on public.listas to authenticated;

grant select, delete on public.lista_membros to authenticated;

grant select, insert, update, delete on public.itens to authenticated;

grant select, insert on public.mensagens to authenticated;
grant update (dados, item_id) on public.mensagens to authenticated;  -- só o estado dos cards

grant select, delete on public.convites to authenticated;

grant select on public.lista_totais to authenticated;

grant all on public.perfis, public.listas, public.lista_membros, public.itens,
             public.mensagens, public.convites, public.uso_ia, public.lista_totais
  to service_role;
grant usage, select on all sequences in schema public to service_role;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.perfis enable row level security;
alter table public.listas enable row level security;
alter table public.lista_membros enable row level security;
alter table public.itens enable row level security;
alter table public.mensagens enable row level security;
alter table public.convites enable row level security;
alter table public.uso_ia enable row level security;  -- sem policy: só service_role

create policy perfis_leitura on public.perfis for select to authenticated
  using (id = (select auth.uid()) or privado.compartilha_lista(id));
create policy perfis_edicao on public.perfis for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- "criado_por = eu" cobre o insert ... returning: nessa hora o gatilho que
-- cria a linha em lista_membros ainda não rodou.
create policy listas_leitura on public.listas for select to authenticated
  using (criado_por = (select auth.uid()) or privado.is_membro(id));
create policy listas_criacao on public.listas for insert to authenticated
  with check (criado_por = (select auth.uid()));
create policy listas_edicao on public.listas for update to authenticated
  using (privado.is_membro(id))
  with check (privado.is_membro(id));
create policy listas_exclusao on public.listas for delete to authenticated
  using (privado.is_dono(id));

-- Entrar numa lista só por gatilho (dono) ou por aceitar_convite (membro).
create policy membros_leitura on public.lista_membros for select to authenticated
  using (privado.is_membro(lista_id));
create policy membros_saida on public.lista_membros for delete to authenticated
  using (
    (perfil_id = (select auth.uid()) and papel = 'membro')
    or (privado.is_dono(lista_id) and perfil_id <> (select auth.uid()))
  );

create policy itens_leitura on public.itens for select to authenticated
  using (privado.is_membro(lista_id));
create policy itens_criacao on public.itens for insert to authenticated
  with check (privado.is_membro(lista_id));
create policy itens_edicao on public.itens for update to authenticated
  using (privado.is_membro(lista_id))
  with check (privado.is_membro(lista_id));
create policy itens_exclusao on public.itens for delete to authenticated
  using (privado.is_membro(lista_id));

-- Mensagens do assistente são gravadas pela Edge Function (service_role).
create policy mensagens_leitura on public.mensagens for select to authenticated
  using (privado.is_membro(lista_id));
create policy mensagens_criacao on public.mensagens for insert to authenticated
  with check (
    privado.is_membro(lista_id)
    and papel = 'usuario'
    and autor_id = (select auth.uid())
  );
create policy mensagens_edicao on public.mensagens for update to authenticated
  using (privado.is_membro(lista_id))
  with check (privado.is_membro(lista_id));

create policy convites_leitura on public.convites for select to authenticated
  using (privado.is_membro(lista_id));
create policy convites_exclusao on public.convites for delete to authenticated
  using (privado.is_membro(lista_id));

-- ---------------------------------------------------------------------------
-- Realtime (seção 7.3). "listas" entra junto para os dois aparelhos verem
-- orçamento, cartões respondidos e a finalização.
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.itens, public.mensagens, public.listas;
