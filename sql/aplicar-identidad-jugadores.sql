begin;

-- Aplicacion protegida de identidad unica de jugadores.
-- No ejecutar esta version: falla hasta reemplazar PENDIENTE_AUTORIZACION
-- por la frase exacta AUTORIZO IDENTIDAD JUGADORES.

do $$
declare
  v_autorizacion constant text := 'PENDIENTE_AUTORIZACION';
  v_faltantes text;
  v_apertura_partidos integer;
  v_apertura_eventos integer;
begin
  if v_autorizacion <> 'AUTORIZO IDENTIDAD JUGADORES' then
    raise exception
      'Aplicacion bloqueada. Falta autorizacion manual para identidad de jugadores.';
  end if;

  with required_tables(tabla) as (
    values
      ('public.torneos'),
      ('public.clubes'),
      ('public.partidos'),
      ('public.jugadores'),
      ('public.inscripciones_jugadores'),
      ('public.eventos_partido')
  )
  select string_agg(tabla, ', ' order by tabla)
  into v_faltantes
  from required_tables
  where to_regclass(tabla) is null;

  if v_faltantes is not null then
    raise exception 'Faltan tablas requeridas: %.', v_faltantes;
  end if;

  with required_columns(tabla, columna) as (
    values
      ('torneos', 'id'),
      ('torneos', 'anio'),
      ('torneos', 'tipo'),
      ('torneos', 'activo'),
      ('clubes', 'id'),
      ('partidos', 'id'),
      ('partidos', 'torneo_id'),
      ('partidos', 'local_id'),
      ('partidos', 'visitante_id'),
      ('jugadores', 'id'),
      ('jugadores', 'nombre_completo'),
      ('jugadores', 'aliases'),
      ('jugadores', 'activo'),
      ('inscripciones_jugadores', 'id'),
      ('inscripciones_jugadores', 'jugador_id'),
      ('inscripciones_jugadores', 'club_id'),
      ('inscripciones_jugadores', 'torneo_id'),
      ('inscripciones_jugadores', 'estado'),
      ('eventos_partido', 'id'),
      ('eventos_partido', 'partido_id'),
      ('eventos_partido', 'tipo'),
      ('eventos_partido', 'jugador'),
      ('eventos_partido', 'equipo_id'),
      ('eventos_partido', 'inscripcion_jugador_id')
  ),
  missing as (
    select columna.tabla, columna.columna
    from required_columns columna
    left join information_schema.columns actual
      on actual.table_schema = 'public'
     and actual.table_name = columna.tabla
     and actual.column_name = columna.columna
    where actual.column_name is null
  )
  select string_agg(tabla || '.' || columna, ', ' order by tabla, columna)
  into v_faltantes
  from missing;

  if v_faltantes is not null then
    raise exception 'Faltan columnas requeridas: %.', v_faltantes;
  end if;

  select count(*)
  into v_apertura_partidos
  from public.partidos
  where torneo_id = 1;

  if v_apertura_partidos <> 140 then
    raise exception
      'Conteo inesperado de Apertura 2026: % partidos.',
      v_apertura_partidos;
  end if;

  select count(*)
  into v_apertura_eventos
  from public.eventos_partido evento
  join public.partidos partido
    on partido.id = evento.partido_id
  where partido.torneo_id = 1;

  if v_apertura_eventos < 300 then
    raise exception
      'Conteo inesperado de eventos historicos de Apertura: %.',
      v_apertura_eventos;
  end if;

  if exists (
    select 1
    from public.torneos
    group by activo
    having activo is true and count(*) > 1
  ) then
    raise exception 'Hay mas de un torneo activo; revisar antes de aplicar.';
  end if;
end;
$$;

create or replace function public.tp_normalizar_nombre_jugador(
  p_nombre text
)
returns text
language sql
immutable
as $$
  select nullif(
    regexp_replace(
      regexp_replace(
        translate(
          lower(btrim(coalesce(p_nombre, ''))),
          'áàäâãéèëêíìïîóòöôõúùüûñç.',
          'aaaaaeeeeiiiiooooouuuunc '
        ),
        '[^a-z0-9]+',
        ' ',
        'g'
      ),
      '\s+',
      ' ',
      'g'
    ),
    ''
  );
$$;

alter table public.jugadores
  add column if not exists nombre_normalizado text null;

update public.jugadores
set
  nombre_normalizado = public.tp_normalizar_nombre_jugador(nombre_completo),
  actualizado_en = now()
where nombre_normalizado is distinct from
  public.tp_normalizar_nombre_jugador(nombre_completo);

alter table public.jugadores
  alter column nombre_normalizado set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'jugadores_nombre_normalizado_check'
      and conrelid = 'public.jugadores'::regclass
  ) then
    alter table public.jugadores
      add constraint jugadores_nombre_normalizado_check
      check (btrim(nombre_normalizado) <> '')
      not valid;
  end if;
end;
$$;

alter table public.jugadores
  validate constraint jugadores_nombre_normalizado_check;

create or replace function public.tp_jugadores_normalizar_trigger()
returns trigger
language plpgsql
as $$
begin
  new.nombre_normalizado :=
    public.tp_normalizar_nombre_jugador(new.nombre_completo);
  new.actualizado_en := now();
  return new;
end;
$$;

drop trigger if exists jugadores_normalizar_nombre
  on public.jugadores;

create trigger jugadores_normalizar_nombre
before insert or update of nombre_completo
on public.jugadores
for each row execute function public.tp_jugadores_normalizar_trigger();

create table if not exists public.jugadores_aliases (
  id bigint generated by default as identity primary key,
  jugador_id bigint not null
    references public.jugadores(id)
    on delete restrict,
  alias text not null,
  alias_normalizado text not null,
  club_id bigint null
    references public.clubes(id)
    on delete restrict,
  torneo_id bigint null
    references public.torneos(id)
    on delete restrict,
  origen text not null default 'manual',
  confirmado boolean not null default false,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  check (btrim(alias) <> ''),
  check (btrim(alias_normalizado) <> '')
);

create or replace function public.tp_jugadores_aliases_normalizar_trigger()
returns trigger
language plpgsql
as $$
begin
  new.alias := btrim(new.alias);
  new.alias_normalizado := public.tp_normalizar_nombre_jugador(new.alias);
  new.actualizado_en := now();
  return new;
end;
$$;

drop trigger if exists jugadores_aliases_normalizar
  on public.jugadores_aliases;

create trigger jugadores_aliases_normalizar
before insert or update of alias
on public.jugadores_aliases
for each row execute function public.tp_jugadores_aliases_normalizar_trigger();

create index if not exists jugadores_nombre_normalizado_idx
  on public.jugadores (nombre_normalizado);

create index if not exists jugadores_aliases_jugador_idx
  on public.jugadores_aliases (jugador_id);

create index if not exists jugadores_aliases_busqueda_idx
  on public.jugadores_aliases (
    alias_normalizado,
    torneo_id,
    club_id,
    confirmado
  );

create unique index if not exists jugadores_aliases_contexto_unico_idx
  on public.jugadores_aliases (
    jugador_id,
    alias_normalizado,
    coalesce(club_id, 0),
    coalesce(torneo_id, 0),
    origen
  );

insert into public.jugadores_aliases (
  jugador_id,
  alias,
  alias_normalizado,
  origen,
  confirmado
)
select
  jugador.id,
  btrim(alias.alias),
  public.tp_normalizar_nombre_jugador(alias.alias),
  'jugadores.aliases',
  true
from public.jugadores jugador
cross join lateral unnest(coalesce(jugador.aliases, '{}'::text[])) alias(alias)
where btrim(alias.alias) <> ''
  and public.tp_normalizar_nombre_jugador(alias.alias) is not null
on conflict do nothing;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'eventos_partido_inscripcion_fk'
      and conrelid = 'public.eventos_partido'::regclass
  ) then
    alter table public.eventos_partido
      add constraint eventos_partido_inscripcion_fk
      foreign key (inscripcion_jugador_id)
      references public.inscripciones_jugadores(id)
      on delete restrict
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'eventos_partido_inscripcion_relacionada_fk'
      and conrelid = 'public.eventos_partido'::regclass
  ) then
    alter table public.eventos_partido
      add constraint eventos_partido_inscripcion_relacionada_fk
      foreign key (inscripcion_relacionada_id)
      references public.inscripciones_jugadores(id)
      on delete restrict
      not valid;
  end if;
end;
$$;

alter table public.eventos_partido
  validate constraint eventos_partido_inscripcion_fk;

alter table public.eventos_partido
  validate constraint eventos_partido_inscripcion_relacionada_fk;

create index if not exists eventos_partido_inscripcion_idx
  on public.eventos_partido (inscripcion_jugador_id);

create index if not exists eventos_partido_inscripcion_relacionada_idx
  on public.eventos_partido (inscripcion_relacionada_id);

create index if not exists inscripciones_jugador_torneo_idx
  on public.inscripciones_jugadores (jugador_id, torneo_id);

create index if not exists inscripciones_torneo_club_estado_idx
  on public.inscripciones_jugadores (torneo_id, club_id, estado);

create or replace function public.tp_validar_evento_inscripcion_jugador()
returns trigger
language plpgsql
as $$
declare
  v_partido record;
  v_inscripcion record;
begin
  select
    partido.id,
    partido.torneo_id,
    partido.local_id,
    partido.visitante_id
  into v_partido
  from public.partidos partido
  where partido.id = new.partido_id;

  if not found then
    raise exception 'Partido no encontrado para la incidencia: %.', new.partido_id;
  end if;

  if new.inscripcion_jugador_id is not null then
    select *
    into v_inscripcion
    from public.inscripciones_jugadores
    where id = new.inscripcion_jugador_id;

    if not found then
      raise exception
        'Inscripcion de jugador no encontrada: %.',
        new.inscripcion_jugador_id;
    end if;

    if v_inscripcion.torneo_id is distinct from v_partido.torneo_id then
      raise exception
        'La inscripcion % pertenece a otro torneo.',
        new.inscripcion_jugador_id;
    end if;

    if v_inscripcion.club_id not in (v_partido.local_id, v_partido.visitante_id) then
      raise exception
        'La inscripcion % no corresponde a un club del partido.',
        new.inscripcion_jugador_id;
    end if;
  end if;

  if new.inscripcion_relacionada_id is not null then
    select *
    into v_inscripcion
    from public.inscripciones_jugadores
    where id = new.inscripcion_relacionada_id;

    if not found then
      raise exception
        'Inscripcion relacionada no encontrada: %.',
        new.inscripcion_relacionada_id;
    end if;

    if v_inscripcion.torneo_id is distinct from v_partido.torneo_id then
      raise exception
        'La inscripcion relacionada % pertenece a otro torneo.',
        new.inscripcion_relacionada_id;
    end if;

    if v_inscripcion.club_id not in (v_partido.local_id, v_partido.visitante_id) then
      raise exception
        'La inscripcion relacionada % no corresponde a un club del partido.',
        new.inscripcion_relacionada_id;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists eventos_partido_validar_inscripcion_jugador
  on public.eventos_partido;

create trigger eventos_partido_validar_inscripcion_jugador
before insert or update of
  partido_id,
  inscripcion_jugador_id,
  inscripcion_relacionada_id
on public.eventos_partido
for each row execute function public.tp_validar_evento_inscripcion_jugador();

alter table public.jugadores_aliases enable row level security;

drop policy if exists jugadores_aliases_lectura_publica
  on public.jugadores_aliases;

revoke all on table public.jugadores_aliases
  from public, anon, authenticated;

grant select, insert, update, delete on table public.jugadores_aliases
  to service_role;

do $$
declare
  v_sequence text;
begin
  select pg_get_serial_sequence(
    'public.jugadores_aliases',
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

grant execute on function public.tp_normalizar_nombre_jugador(text)
  to anon, authenticated, service_role;

revoke all on function public.tp_jugadores_normalizar_trigger()
  from public, anon, authenticated;

revoke all on function public.tp_jugadores_aliases_normalizar_trigger()
  from public, anon, authenticated;

revoke all on function public.tp_validar_evento_inscripcion_jugador()
  from public, anon, authenticated;

grant execute on function public.tp_jugadores_normalizar_trigger()
  to service_role;

grant execute on function public.tp_jugadores_aliases_normalizar_trigger()
  to service_role;

grant execute on function public.tp_validar_evento_inscripcion_jugador()
  to service_role;

comment on column public.jugadores.nombre_normalizado is
  'Nombre publico normalizado para busqueda y candidatos; no es identidad unica global.';

comment on table public.jugadores_aliases is
  'Variantes historicas o externas de nombres vinculadas a una identidad canonica. Acceso solo administrativo.';

comment on column public.eventos_partido.inscripcion_jugador_id is
  'Inscripcion del protagonista principal. El texto jugador se conserva como snapshot historico.';

comment on function public.tp_validar_evento_inscripcion_jugador() is
  'Valida torneo y participacion del club de la inscripcion sin exigir que coincida con equipo_id, para contemplar autogoles.';

commit;
