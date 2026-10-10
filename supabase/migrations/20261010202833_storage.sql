-- Listou: bucket privado das fotos de etiqueta (CLAUDE.md, seção 5).
-- Caminho: {lista_id}/{uuid}.jpg. O cliente comprime antes do upload
-- (lado maior 1280px, JPEG ~0.8), então 2 MB é folga de sobra.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('etiquetas', 'etiquetas', false, 2097152, array['image/jpeg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy etiquetas_membros_leem on storage.objects for select to authenticated
  using (bucket_id = 'etiquetas' and privado.is_membro_da_pasta((storage.foldername(name))[1]));

create policy etiquetas_membros_enviam on storage.objects for insert to authenticated
  with check (bucket_id = 'etiquetas' and privado.is_membro_da_pasta((storage.foldername(name))[1]));

create policy etiquetas_membros_apagam on storage.objects for delete to authenticated
  using (bucket_id = 'etiquetas' and privado.is_membro_da_pasta((storage.foldername(name))[1]));
