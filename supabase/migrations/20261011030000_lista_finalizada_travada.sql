-- Listou: lista finalizada é só leitura no banco, não só na tela.
--
-- Até aqui a trava estava no app e nas Edge Functions; quem falasse direto com
-- a API ainda conseguia mexer em itens e gerar convite. Agora o banco recusa.
-- A única mudança aceita numa lista finalizada é reabri-la (status = 'ativa').

-- Membro de uma lista que ainda está ativa.
create or replace function privado.is_membro_ativa(p_lista_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.lista_membros m
    join public.listas l on l.id = m.lista_id
    where m.lista_id = p_lista_id
      and m.perfil_id = (select auth.uid())
      and l.status = 'ativa'
  );
$$;

revoke all on function privado.is_membro_ativa(uuid) from public, anon;
grant execute on function privado.is_membro_ativa(uuid) to authenticated, service_role;

-- Itens: ler continua valendo; escrever só com a lista ativa.
drop policy itens_criacao on public.itens;
drop policy itens_edicao on public.itens;
drop policy itens_exclusao on public.itens;

create policy itens_criacao on public.itens for insert to authenticated
  with check (privado.is_membro_ativa(lista_id));
create policy itens_edicao on public.itens for update to authenticated
  using (privado.is_membro_ativa(lista_id))
  with check (privado.is_membro_ativa(lista_id));
create policy itens_exclusao on public.itens for delete to authenticated
  using (privado.is_membro_ativa(lista_id));

-- Mensagens: nada novo na conversa nem no estado dos cards.
drop policy mensagens_criacao on public.mensagens;
drop policy mensagens_edicao on public.mensagens;

create policy mensagens_criacao on public.mensagens for insert to authenticated
  with check (
    privado.is_membro_ativa(lista_id)
    and papel = 'usuario'
    and autor_id = (select auth.uid())
  );
create policy mensagens_edicao on public.mensagens for update to authenticated
  using (privado.is_membro_ativa(lista_id))
  with check (privado.is_membro_ativa(lista_id));

-- Fotos: nada de upload novo (apagar continua, para a limpeza das antigas).
drop policy etiquetas_membros_enviam on storage.objects;
create policy etiquetas_membros_enviam on storage.objects for insert to authenticated
  with check (
    bucket_id = 'etiquetas'
    and exists (
      select 1 from public.listas l
      where l.id::text = (storage.foldername(name))[1] and l.status = 'ativa'
    )
    and privado.is_membro_da_pasta((storage.foldername(name))[1])
  );

-- Lista: com ela finalizada, só o status pode mudar (para reabrir). Nome,
-- orçamento, mercado e cartões ficam como estavam. O gatilho vale também para
-- responder_cartao, que atualiza a lista.
create or replace function privado.travar_lista_finalizada()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if old.status = 'finalizada' and new.status = 'finalizada'
     and (new.nome, new.orcamento_centavos, new.mercado, new.cartoes, new.cartoes_recusados)
         is distinct from
         (old.nome, old.orcamento_centavos, old.mercado, old.cartoes, old.cartoes_recusados) then
    raise exception 'lista_finalizada' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger ao_editar_lista_finalizada
before update on public.listas
for each row execute function privado.travar_lista_finalizada();

-- Convites: nem gerar nem aceitar enquanto a lista estiver finalizada.
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

  if not privado.is_membro_ativa(p_lista_id) then
    raise exception 'lista_finalizada' using errcode = 'P0001';
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

create or replace function public.aceitar_convite(p_codigo text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_lista_id uuid;
  v_status text;
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'nao_autenticado' using errcode = '28000';
  end if;

  select c.lista_id, l.status into v_lista_id, v_status
  from public.convites c
  join public.listas l on l.id = c.lista_id
  where c.codigo = upper(btrim(p_codigo)) and c.expira_em > now();

  if v_lista_id is null then
    raise exception 'convite_invalido' using errcode = 'P0001';
  end if;

  if v_status <> 'ativa' then
    raise exception 'lista_finalizada' using errcode = 'P0001';
  end if;

  insert into public.lista_membros (lista_id, perfil_id, papel)
  values (v_lista_id, v_uid, 'membro')
  on conflict (lista_id, perfil_id) do nothing;

  return v_lista_id;
end;
$$;
