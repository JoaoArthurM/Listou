-- Testes de banco do Listou: RLS, convites, gatilhos e arredondamento.
--
-- Roda inteiro dentro de uma transação e desfaz tudo no fim (rollback), então
-- pode ser executado contra o projeto real pelo SQL Editor ou por psql:
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/seguranca.test.sql
--
-- Qualquer verificação que falhar aborta com a mensagem do assert.

begin;

do $$
declare
  v_ana uuid := gen_random_uuid();    -- dona da lista
  v_bruno uuid := gen_random_uuid();  -- de fora, depois entra por convite
  v_lista uuid;
  v_item uuid;
  v_codigo text;
  v_n integer;
  v_total integer;
  v_reg record;
begin
  -- Usuários de teste. O gatilho de signup precisa criar os perfis.
  insert into auth.users (id, email, raw_user_meta_data)
  values (v_ana, 'ana-teste@listou.invalid', '{"nome": "Ana"}'),
         (v_bruno, 'bruno-teste@listou.invalid', '{}');

  select count(*) into v_n from public.perfis where id in (v_ana, v_bruno);
  assert v_n = 2, 'gatilho de signup deveria criar 2 perfis';
  assert (select nome from public.perfis where id = v_ana) = 'Ana', 'perfil usa o metadado nome';
  assert (select nome from public.perfis where id = v_bruno) = 'bruno-teste', 'perfil cai no início do e-mail';

  -- Arredondamento de round(integer * numeric): meio centavo sobe.
  assert round(1999 * 0.333::numeric(10,3))::integer = 666, '1999 x 0,333 = 665,667 -> 666';
  assert round(100 * 0.145::numeric(10,3))::integer = 15, '100 x 0,145 = 14,5 -> 15';
  assert round(999 * 0.5::numeric(10,3))::integer = 500, '999 x 0,5 = 499,5 -> 500';
  assert round(3990 * 0.742::numeric(10,3))::integer = 2961, '3990 x 0,742 = 2960,58 -> 2961';
  assert round(469 * 6::numeric(10,3))::integer = 2814, '469 x 6 = 2814';

  -- ---------------- Ana cria a lista ----------------
  perform set_config('request.jwt.claims', json_build_object('sub', v_ana, 'role', 'authenticated')::text, true);
  set local role authenticated;

  insert into public.listas (nome, orcamento_centavos) values ('Compra do mês', 10000) returning id into v_lista;
  assert privado.is_dono(v_lista), 'quem cria a lista vira dona';

  insert into public.itens (lista_id, nome) values (v_lista, 'Leite') returning id into v_item;

  -- Gatilho do item: comprado carimba quem/quando e o total é calculado pelo banco.
  update public.itens
     set comprado = true, preco_unit_centavos = 469, qtd_comprada = 6, faixa_aplicada = 'atacado', origem_preco = 'ia'
   where id = v_item;
  select * into v_reg from public.itens where id = v_item;
  assert v_reg.total_centavos = 2814, 'total do item = 6 x 4,69';
  assert v_reg.comprado_por = v_ana and v_reg.comprado_em is not null, 'compra carimbada';

  select total_centavos into v_total from public.lista_totais where lista_id = v_lista;
  assert v_total = 2814, 'lista_totais soma o carrinho';

  -- Desmarcar apaga o preço, senão o item continuaria somando.
  update public.itens set comprado = false where id = v_item;
  select * into v_reg from public.itens where id = v_item;
  assert v_reg.preco_unit_centavos is null and v_reg.total_centavos is null and v_reg.comprado_por is null,
         'item desmarcado não carrega preço';

  v_codigo := public.criar_convite(v_lista);
  assert v_codigo ~ '^[A-HJ-NP-Z2-9]{6}$', 'código de convite tem 6 caracteres do alfabeto sem ambíguos';
  assert public.criar_convite(v_lista) = v_codigo, 'convite ainda válido é reaproveitado';

  -- ---------------- Bruno, de fora, não lê nem escreve ----------------
  perform set_config('request.jwt.claims', json_build_object('sub', v_bruno, 'role', 'authenticated')::text, true);

  select count(*) into v_n from public.listas where id = v_lista;
  assert v_n = 0, 'de fora não lê a lista';
  select count(*) into v_n from public.itens where lista_id = v_lista;
  assert v_n = 0, 'de fora não lê itens';
  select count(*) into v_n from public.lista_totais where lista_id = v_lista;
  assert v_n = 0, 'de fora não lê o total';
  select count(*) into v_n from public.lista_membros where lista_id = v_lista;
  assert v_n = 0, 'de fora não lê membros';
  select count(*) into v_n from public.convites where lista_id = v_lista;
  assert v_n = 0, 'de fora não lê convites';
  select count(*) into v_n from public.perfis where id = v_ana;
  assert v_n = 0, 'de fora não lê o perfil de quem não divide lista';
  assert not privado.is_membro_da_pasta(v_lista::text), 'de fora não acessa a pasta de fotos';
  assert not privado.is_membro_da_pasta('nao-e-uuid'), 'pasta inválida nega em vez de estourar';

  begin
    insert into public.itens (lista_id, nome) values (v_lista, 'Intruso');
    raise exception 'FALHOU: de fora inseriu item';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.mensagens (lista_id, autor_id, papel, conteudo) values (v_lista, v_bruno, 'usuario', 'oi');
    raise exception 'FALHOU: de fora inseriu mensagem';
  exception when insufficient_privilege then null;
  end;

  update public.itens set nome = 'Hackeado' where id = v_item;
  get diagnostics v_n = row_count;
  assert v_n = 0, 'de fora não edita item';

  delete from public.itens where id = v_item;
  get diagnostics v_n = row_count;
  assert v_n = 0, 'de fora não apaga item';

  update public.listas set nome = 'Hackeada' where id = v_lista;
  get diagnostics v_n = row_count;
  assert v_n = 0, 'de fora não edita a lista';

  begin
    perform public.responder_cartao(v_lista, 'crediffato', true);
    raise exception 'FALHOU: de fora respondeu cartão';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.criar_convite(v_lista);
    raise exception 'FALHOU: de fora criou convite';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.aceitar_convite('ZZZZZZ');
    raise exception 'FALHOU: aceitou convite inexistente';
  exception when raise_exception then
    assert sqlerrm = 'convite_invalido', 'código errado dá convite_invalido, veio: ' || sqlerrm;
  end;

  -- ---------------- Bruno entra pelo convite ----------------
  assert public.aceitar_convite(lower(v_codigo) || ' ') = v_lista, 'convite aceita minúsculas e espaços';
  assert privado.is_membro(v_lista) and not privado.is_dono(v_lista), 'convidado entra como membro';

  select count(*) into v_n from public.itens where lista_id = v_lista;
  assert v_n = 1, 'membro lê itens';
  select count(*) into v_n from public.perfis where id = v_ana;
  assert v_n = 1, 'membro lê o perfil de quem divide a lista';
  assert privado.is_membro_da_pasta(v_lista::text), 'membro acessa a pasta de fotos';

  insert into public.itens (lista_id, nome) values (v_lista, 'Pão');
  insert into public.mensagens (lista_id, autor_id, papel, conteudo) values (v_lista, v_bruno, 'usuario', 'adiciona pão');

  begin
    insert into public.mensagens (lista_id, papel, conteudo) values (v_lista, 'assistente', 'falsa');
    raise exception 'FALHOU: membro forjou mensagem do assistente';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.mensagens (lista_id, autor_id, papel, conteudo) values (v_lista, v_ana, 'usuario', 'em nome de outra');
    raise exception 'FALHOU: membro escreveu em nome de outra pessoa';
  exception when insufficient_privilege then null;
  end;

  begin
    update public.mensagens set conteudo = 'reescrita' where lista_id = v_lista;
    raise exception 'FALHOU: membro reescreveu o texto de uma mensagem';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.lista_membros (lista_id, perfil_id, papel) values (v_lista, v_bruno, 'dono');
    raise exception 'FALHOU: membro se promoveu a dono';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.uso_ia (funcao) values ('chat');
    raise exception 'FALHOU: usuário escreveu em uso_ia';
  exception when insufficient_privilege then null;
  end;

  perform public.responder_cartao(v_lista, ' Crediffato ', true);
  assert (select cartoes from public.listas where id = v_lista) = array['crediffato'], 'cartão gravado normalizado';
  perform public.responder_cartao(v_lista, 'crediffato', false);
  select * into v_reg from public.listas where id = v_lista;
  assert v_reg.cartoes = '{}' and v_reg.cartoes_recusados = array['crediffato'], 'cartão recusado troca de lista';

  delete from public.listas where id = v_lista;
  get diagnostics v_n = row_count;
  assert v_n = 0, 'membro não apaga a lista';

  -- Finalizar carimba a data.
  update public.listas set status = 'finalizada' where id = v_lista;
  assert (select finalizada_em from public.listas where id = v_lista) is not null, 'finalizar carimba finalizada_em';

  -- ---------------- anon não tem acesso nenhum ----------------
  set local role anon;
  begin
    perform 1 from public.listas;
    raise exception 'FALHOU: anon leu listas';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.aceitar_convite(v_codigo);
    raise exception 'FALHOU: anon chamou aceitar_convite';
  exception when insufficient_privilege then null;
  end;

  -- ---------------- só a dona apaga ----------------
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_ana, 'role', 'authenticated')::text, true);
  delete from public.listas where id = v_lista;
  get diagnostics v_n = row_count;
  assert v_n = 1, 'dona apaga a lista';

  reset role;
  select count(*) into v_n from public.itens where lista_id = v_lista;
  assert v_n = 0, 'apagar a lista leva os itens junto';

  raise notice 'Todos os testes de banco passaram.';
end;
$$;

rollback;
