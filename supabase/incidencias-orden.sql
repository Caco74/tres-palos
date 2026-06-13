-- Ordena las incidencias por secuencia de carga, sin depender del minuto.
-- Es seguro ejecutarlo mas de una vez.

alter table public.eventos_partido
  add column if not exists orden integer null;

with secuencia as (
  select
    id,
    row_number() over (
      partition by partido_id
      order by id
    ) as orden_calculado
  from public.eventos_partido
)
update public.eventos_partido evento
set orden = secuencia.orden_calculado
from secuencia
where evento.id = secuencia.id
  and evento.orden is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where
      conname = 'eventos_partido_orden_check'
      and conrelid = 'public.eventos_partido'::regclass
  ) then
    alter table public.eventos_partido
      add constraint eventos_partido_orden_check
      check (orden is null or orden > 0)
      not valid;
  end if;
end;
$$;

alter table public.eventos_partido
  validate constraint eventos_partido_orden_check;

create index if not exists eventos_partido_partido_orden_idx
  on public.eventos_partido (partido_id, orden, id);

comment on column public.eventos_partido.orden is
  'Secuencia narrativa de la incidencia dentro del partido.';

select
  partido_id,
  id,
  orden,
  equipo_id,
  jugador,
  tipo
from public.eventos_partido
order by partido_id, orden, id;
