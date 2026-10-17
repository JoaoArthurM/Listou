-- Listou: quanto a compra custou de verdade no caixa.
--
-- Ao finalizar, o resumo pergunta o valor cobrado (opcional). O recibo mostra a
-- diferença para o total que o app somou. Fica em centavos inteiros, como todo
-- dinheiro do app; nulo quando a pessoa não informou.

alter table public.listas
  add column total_pago_centavos integer check (total_pago_centavos >= 0);

grant update (total_pago_centavos) on public.listas to authenticated;

-- Com a lista finalizada o valor também fica travado, como os demais dados.
create or replace function privado.travar_lista_finalizada()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if old.status = 'finalizada' and new.status = 'finalizada'
     and (new.nome, new.orcamento_centavos, new.mercado, new.cartoes, new.cartoes_recusados, new.total_pago_centavos)
         is distinct from
         (old.nome, old.orcamento_centavos, old.mercado, old.cartoes, old.cartoes_recusados, old.total_pago_centavos) then
    raise exception 'lista_finalizada' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
