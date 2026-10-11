-- Listou: "digitando" e "pensando" ao vivo (Realtime Broadcast).
--
-- O aviso de quem está digitando ou esperando a IA não passa pelas tabelas do
-- app: vai por Broadcast no canal privado "lista:{lista_id}:atividade". Canal
-- privado só aceita quem as políticas de realtime.messages deixam, então só
-- membros da lista ouvem e anunciam.

-- O tópico vem do cliente. A comparação é feita como texto para um tópico
-- malformado dar "não é membro" em vez de erro de conversão para uuid.
create or replace function privado.is_membro_do_topico(p_topico text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.lista_membros m
    where m.perfil_id = (select auth.uid())
      and p_topico = 'lista:' || m.lista_id::text || ':atividade'
  );
$$;

revoke all on function privado.is_membro_do_topico(text) from public, anon;
grant execute on function privado.is_membro_do_topico(text) to authenticated, service_role;

create policy atividade_membros_ouvem on realtime.messages for select to authenticated
  using (extension = 'broadcast' and privado.is_membro_do_topico((select realtime.topic())));

create policy atividade_membros_anunciam on realtime.messages for insert to authenticated
  with check (extension = 'broadcast' and privado.is_membro_do_topico((select realtime.topic())));
