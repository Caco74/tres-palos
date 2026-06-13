alter table public.eventos_partido
  add column if not exists inscripcion_relacionada_id bigint null,
  add column if not exists jugador_relacionado text null,
  add column if not exists orden integer null,
  add column if not exists estado_dato text default 'por_verificar',
  add column if not exists fuente text null,
  add column if not exists observaciones text null,
  add column if not exists actualizado_en timestamptz not null default now();

update public.eventos_partido
set estado_dato = 'por_verificar'
where estado_dato is null;

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
      conname = 'eventos_partido_inscripcion_relacionada_fk'
      and conrelid = 'public.eventos_partido'::regclass
  ) then
    alter table public.eventos_partido
      add constraint eventos_partido_inscripcion_relacionada_fk
      foreign key (inscripcion_relacionada_id)
      references public.inscripciones_jugadores(id)
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where
      conname = 'eventos_partido_estado_dato_check'
      and conrelid = 'public.eventos_partido'::regclass
  ) then
    alter table public.eventos_partido
      add constraint eventos_partido_estado_dato_check
      check (estado_dato in ('confirmado', 'por_verificar'))
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where
      conname = 'eventos_partido_minuto_check'
      and conrelid = 'public.eventos_partido'::regclass
  ) then
    alter table public.eventos_partido
      add constraint eventos_partido_minuto_check
      check (minuto is null or minuto between 0 and 130)
      not valid;
  end if;

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
  validate constraint eventos_partido_inscripcion_relacionada_fk;

alter table public.eventos_partido
  validate constraint eventos_partido_estado_dato_check;

alter table public.eventos_partido
  validate constraint eventos_partido_minuto_check;

alter table public.eventos_partido
  validate constraint eventos_partido_orden_check;

create index if not exists eventos_partido_partido_orden_idx
  on public.eventos_partido (partido_id, orden, id);

create index if not exists eventos_partido_inscripcion_relacionada_idx
  on public.eventos_partido (inscripcion_relacionada_id);

grant select, insert, update, delete on table public.eventos_partido
  to service_role;

do $$
declare
  v_sequence text;
begin
  select pg_get_serial_sequence(
    'public.eventos_partido',
    'id'
  )
  into v_sequence;

  if v_sequence is not null then
    execute format(
      'grant usage, select on sequence %s to service_role',
      v_sequence
    );
  end if;
end;
$$;

comment on column public.eventos_partido.inscripcion_jugador_id is
  'Inscripcion del protagonista principal en el club y torneo del partido.';

comment on column public.eventos_partido.inscripcion_relacionada_id is
  'Segunda inscripcion relacionada, utilizada principalmente en cambios.';

comment on column public.eventos_partido.orden is
  'Secuencia narrativa de la incidencia dentro del partido.';

comment on column public.eventos_partido.estado_dato is
  'Nivel de verificacion de la incidencia y su fuente.';
