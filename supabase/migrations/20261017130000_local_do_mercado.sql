-- Listou: onde o mercado fica.
--
-- A lista guarda o ponto do mercado (latitude e longitude) para o mapa do
-- Histórico. Os dois vêm juntos ou nenhum. O ponto continua editável depois de
-- a lista ser finalizada (a pessoa corrige no mapa), por isso o gatilho de
-- lista finalizada não o trava.

alter table public.listas
  add column mercado_lat double precision check (mercado_lat between -90 and 90),
  add column mercado_lng double precision check (mercado_lng between -180 and 180),
  add constraint listas_mercado_ponto_completo check ((mercado_lat is null) = (mercado_lng is null));

grant insert (mercado_lat, mercado_lng) on public.listas to authenticated;
grant update (mercado_lat, mercado_lng) on public.listas to authenticated;
