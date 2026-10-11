-- Listou: seção do mercado de cada item (hortifrúti, limpeza, frios...).
--
-- A lista de compras é agrupada por seção. Quem classifica é o app, pelo nome
-- do item (src/lib/secoes.ts), então a coluna quase sempre fica nula. Ela só é
-- preenchida quando alguém escolhe a seção à mão, e aí vale a escolha.
alter table public.itens
  add column secao text
  check (secao in ('hortifruti', 'padaria', 'acougue', 'frios', 'mercearia', 'bebidas', 'congelados', 'limpeza', 'higiene', 'pet', 'outros'));

comment on column public.itens.secao is 'Seção do mercado escolhida à mão; null = o app decide pelo nome.';
