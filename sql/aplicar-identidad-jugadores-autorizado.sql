-- ARCHIVO TEMPORAL AUTORIZADO PARA APLICACION MANUAL
--
-- Entorno esperado: Supabase produccion de Tres Palos.
-- Ejecutar solo despues de descargar el respaldo manual completo.
-- Ejecutar el archivo completo desde Supabase SQL Editor.
-- No seleccionar ni ejecutar fragmentos.
-- Si aparece un error, no volver a ejecutarlo sin revisar primero el mensaje.
-- Copiar solo el mensaje del error y detener el proceso.
-- Este archivo debe eliminarse del repositorio antes del merge.
--

begin;

-- Aplicacion manual autorizada de identidad unica de jugadores.
-- Mantiene las validaciones del SQL protegido y agrega verificaciones finales
-- antes del COMMIT.

do $$
declare
  v_autorizacion constant text := 'AUTORIZO IDENTIDAD JUGADORES';
  v_faltantes text;
  v_jugadores_total integer;
  v_jugadores_activos integer;
  v_jugadores_inactivos integer;
  v_jugadores_sin_nombre integer;
  v_inscripciones_total integer;
  v_inscripciones_duplicadas integer;
  v_inscripciones_incompletas integer;
  v_inscripciones_referencias_rotas integer;
  v_eventos_total integer;
  v_eventos_con_texto integer;
  v_eventos_vinculados integer;
  v_eventos_pendientes integer;
  v_eventos_referencias_rotas integer;
  v_autogoles integer;
  v_goles integer;
  v_goles_penal integer;
  v_rojas integer;
  v_goleadores_total integer;
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
      ('public.eventos_partido'),
      ('public.goleadores_oficiales')
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
      ('jugadores', 'creado_en'),
      ('jugadores', 'actualizado_en'),
      ('inscripciones_jugadores', 'id'),
      ('inscripciones_jugadores', 'jugador_id'),
      ('inscripciones_jugadores', 'club_id'),
      ('inscripciones_jugadores', 'torneo_id'),
      ('inscripciones_jugadores', 'dorsal'),
      ('inscripciones_jugadores', 'estado'),
      ('eventos_partido', 'id'),
      ('eventos_partido', 'partido_id'),
      ('eventos_partido', 'tipo'),
      ('eventos_partido', 'jugador'),
      ('eventos_partido', 'equipo'),
      ('eventos_partido', 'equipo_id'),
      ('eventos_partido', 'inscripcion_jugador_id'),
      ('eventos_partido', 'inscripcion_relacionada_id'),
      ('eventos_partido', 'jugador_relacionado'),
      ('goleadores_oficiales', 'id'),
      ('goleadores_oficiales', 'torneo_id'),
      ('goleadores_oficiales', 'posicion'),
      ('goleadores_oficiales', 'equipo_id'),
      ('goleadores_oficiales', 'equipo_nombre'),
      ('goleadores_oficiales', 'jugador_nombre'),
      ('goleadores_oficiales', 'goles')
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

  if not exists (
    select 1
    from pg_constraint con
    join pg_class cls
      on cls.oid = con.conrelid
    join pg_namespace ns
      on ns.oid = cls.relnamespace
    where ns.nspname = 'public'
      and cls.relname = 'inscripciones_jugadores'
      and con.contype in ('u', 'p')
      and (
        select array_agg(att.attname::text order by key_row.ordinalidad)
        from unnest(con.conkey) with ordinality as key_row(attnum, ordinalidad)
        join pg_attribute att
          on att.attrelid = con.conrelid
         and att.attnum = key_row.attnum
      ) = array['jugador_id', 'club_id', 'torneo_id']::text[]
  ) then
    raise exception
      'No se encontro la restriccion unica esperada en inscripciones_jugadores.';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'jugadores'
      and column_name = 'nombre_normalizado'
  ) then
    raise exception
      'Produccion no coincide con la prevalidacion: jugadores.nombre_normalizado ya existe.';
  end if;

  if to_regclass('public.jugadores_aliases') is not null then
    raise exception
      'Produccion no coincide con la prevalidacion: jugadores_aliases ya existe.';
  end if;

  if to_regprocedure('public.tp_normalizar_nombre_jugador(text)') is not null then
    raise exception
      'Produccion no coincide con la prevalidacion: tp_normalizar_nombre_jugador(text) ya existe.';
  end if;

  if exists (
    select 1
    from pg_trigger trigger_row
    join pg_class cls
      on cls.oid = trigger_row.tgrelid
    join pg_namespace ns
      on ns.oid = cls.relnamespace
    where ns.nspname = 'public'
      and not trigger_row.tgisinternal
      and trigger_row.tgname in (
        'jugadores_normalizar_nombre',
        'jugadores_aliases_normalizar',
        'eventos_partido_validar_inscripcion_jugador'
      )
  ) then
    raise exception
      'Produccion no coincide con la prevalidacion: ya existen triggers de identidad.';
  end if;

  select
    count(*),
    count(*) filter (where activo is true),
    count(*) filter (where activo is false),
    count(*) filter (where btrim(coalesce(nombre_completo, '')) = '')
  into
    v_jugadores_total,
    v_jugadores_activos,
    v_jugadores_inactivos,
    v_jugadores_sin_nombre
  from public.jugadores;

  if v_jugadores_total <> 27
     or v_jugadores_activos <> 27
     or v_jugadores_inactivos <> 0
     or v_jugadores_sin_nombre <> 0 then
    raise exception
      'Conteos inesperados en jugadores: total %, activos %, inactivos %, sin nombre %.',
      v_jugadores_total,
      v_jugadores_activos,
      v_jugadores_inactivos,
      v_jugadores_sin_nombre;
  end if;

  select
    count(*),
    count(*) filter (
      where jugador_id is null
         or club_id is null
         or torneo_id is null
    )
  into v_inscripciones_total, v_inscripciones_incompletas
  from public.inscripciones_jugadores;

  select count(*)
  into v_inscripciones_duplicadas
  from (
    select jugador_id, club_id, torneo_id
    from public.inscripciones_jugadores
    group by jugador_id, club_id, torneo_id
    having count(*) > 1
  ) duplicado;

  select count(*)
  into v_inscripciones_referencias_rotas
  from public.inscripciones_jugadores inscripcion
  where not exists (
      select 1
      from public.jugadores jugador
      where jugador.id = inscripcion.jugador_id
    )
    or not exists (
      select 1
      from public.clubes club
      where club.id = inscripcion.club_id
    )
    or not exists (
      select 1
      from public.torneos torneo
      where torneo.id = inscripcion.torneo_id
    );

  if v_inscripciones_total <> 27
     or v_inscripciones_incompletas <> 0
     or v_inscripciones_duplicadas <> 0
     or v_inscripciones_referencias_rotas <> 0
     or exists (
       select 1
       from public.inscripciones_jugadores
       where torneo_id is distinct from 1
     ) then
    raise exception
      'Conteos inesperados en inscripciones: total %, incompletas %, duplicadas %, rotas %.',
      v_inscripciones_total,
      v_inscripciones_incompletas,
      v_inscripciones_duplicadas,
      v_inscripciones_referencias_rotas;
  end if;

  if (
    select count(*)
    from public.partidos
    where torneo_id = 1
  ) <> 140 then
    raise exception
      'Conteo inesperado de Apertura 2026: se esperaban 140 partidos.';
  end if;

  select
    count(*),
    count(*) filter (where btrim(coalesce(jugador, '')) <> ''),
    count(*) filter (where inscripcion_jugador_id is not null),
    count(*) filter (where inscripcion_jugador_id is null),
    count(*) filter (where lower(coalesce(tipo, '')) in ('gol_en_contra', 'autogol')),
    count(*) filter (where tipo = 'gol'),
    count(*) filter (where tipo = 'gol_penal'),
    count(*) filter (where tipo = 'roja')
  into
    v_eventos_total,
    v_eventos_con_texto,
    v_eventos_vinculados,
    v_eventos_pendientes,
    v_autogoles,
    v_goles,
    v_goles_penal,
    v_rojas
  from public.eventos_partido;

  if v_eventos_total <> 368
     or v_eventos_con_texto <> 368
     or v_eventos_vinculados <> 60
     or v_eventos_pendientes <> 308
     or v_autogoles <> 1
     or v_goles <> 363
     or v_goles_penal <> 1
     or v_rojas <> 3 then
    raise exception
      'Conteos inesperados en eventos: total %, texto %, vinculados %, pendientes %, autogoles %, goles %, penales %, rojas %.',
      v_eventos_total,
      v_eventos_con_texto,
      v_eventos_vinculados,
      v_eventos_pendientes,
      v_autogoles,
      v_goles,
      v_goles_penal,
      v_rojas;
  end if;

  select count(*)
  into v_eventos_referencias_rotas
  from public.eventos_partido evento
  where (
      evento.partido_id is not null
      and not exists (
        select 1
        from public.partidos partido
        where partido.id = evento.partido_id
      )
    )
    or (
      evento.equipo_id is not null
      and not exists (
        select 1
        from public.clubes club
        where club.id = evento.equipo_id
      )
    )
    or (
      evento.inscripcion_jugador_id is not null
      and not exists (
        select 1
        from public.inscripciones_jugadores inscripcion
        where inscripcion.id = evento.inscripcion_jugador_id
      )
    )
    or (
      evento.inscripcion_relacionada_id is not null
      and not exists (
        select 1
        from public.inscripciones_jugadores inscripcion
        where inscripcion.id = evento.inscripcion_relacionada_id
      )
    );

  if v_eventos_referencias_rotas <> 0 then
    raise exception
      'Eventos con referencias rotas detectados: %.',
      v_eventos_referencias_rotas;
  end if;

  if not exists (
    select 1
    from public.eventos_partido
    where tipo = 'gol_en_contra'
      and jugador = 'ANGELETTI JOAQUIN'
  ) then
    raise exception 'Autogol historico esperado no encontrado.';
  end if;

  select count(*)
  into v_goleadores_total
  from public.goleadores_oficiales;

  if v_goleadores_total <> 4 then
    raise exception
      'Conteo inesperado de goleadores_oficiales: %.',
      v_goleadores_total;
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
parallel safe
returns null on null input
set search_path = pg_catalog
as $$
  select nullif(btrim(
    regexp_replace(
      regexp_replace(
        translate(
          lower(btrim(p_nombre)),
          U&'\00E1\00E0\00E4\00E2\00E3\00E9\00E8\00EB\00EA\00ED\00EC\00EF\00EE\00F3\00F2\00F6\00F4\00F5\00FA\00F9\00FC\00FB\00F1\00E7.',
          'aaaaaeeeeiiiiooooouuuunc '
        ),
        '[^a-z0-9]+',
        ' ',
        'g'
      ),
      '\s+',
      ' ',
      'g'
    )),
    ''
  );
$$;

do $$
begin
  if public.tp_normalizar_nombre_jugador(U&'JOAQU\00CDN  CARRIZO.') <> 'joaquin carrizo' then
    raise exception 'Normalizacion inesperada para JOAQUIN CARRIZO con tilde y punto.';
  end if;

  if public.tp_normalizar_nombre_jugador(' J. Carrizo ') <> 'j carrizo' then
    raise exception 'Normalizacion inesperada para J. Carrizo.';
  end if;

  if public.tp_normalizar_nombre_jugador(null) is not null then
    raise exception 'Normalizacion inesperada para NULL.';
  end if;

  if not exists (
    select 1
    from public.jugadores
    where id in (11, 25)
    group by public.tp_normalizar_nombre_jugador(nombre_completo)
    having public.tp_normalizar_nombre_jugador(nombre_completo) = 'sanchez'
       and array_agg(id order by id) = array[11::bigint, 25::bigint]
  ) then
    raise exception 'Homonimo Sanchez esperado no coincide con la prevalidacion.';
  end if;

  if not exists (
    select 1
    from public.jugadores
    where id in (20, 21)
    group by public.tp_normalizar_nombre_jugador(nombre_completo)
    having public.tp_normalizar_nombre_jugador(nombre_completo) = 'sarco'
       and array_agg(id order by id) = array[20::bigint, 21::bigint]
  ) then
    raise exception 'Homonimo Sarco esperado no coincide con la prevalidacion.';
  end if;
end;
$$;

alter table public.jugadores
  add column if not exists nombre_normalizado text null;

do $$
declare
  v_backfill_jugadores integer;
begin
  update public.jugadores
  set nombre_normalizado =
    public.tp_normalizar_nombre_jugador(nombre_completo)
  where nombre_normalizado is distinct from
    public.tp_normalizar_nombre_jugador(nombre_completo);

  get diagnostics v_backfill_jugadores = row_count;

  if v_backfill_jugadores <> 27 then
    raise exception
      'Backfill inesperado de jugadores.nombre_normalizado: % filas.',
      v_backfill_jugadores;
  end if;
end;
$$;

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
set search_path = public, pg_catalog
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
set search_path = public, pg_catalog
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
set search_path = public, pg_catalog
as $$
declare
  v_partido record;
  v_inscripcion record;
begin
  -- Transicion: los eventos historicos pueden conservar solo texto.
  -- La validacion actua cuando se informa una inscripcion por ID.
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

grant usage, select on sequence public.jugadores_aliases_id_seq
  to service_role;

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


do $$
declare
  v_referencias_rotas integer;
begin
  if (select count(*) from public.jugadores) <> 27 then
    raise exception 'Validacion final fallo: jugadores no es 27.';
  end if;

  if (
    select count(*)
    from public.jugadores
    where nombre_normalizado is not null
      and btrim(nombre_normalizado) <> ''
  ) <> 27 then
    raise exception 'Validacion final fallo: jugadores normalizados no es 27.';
  end if;

  if exists (
    select 1
    from public.jugadores
    where nombre_normalizado is distinct from btrim(nombre_normalizado)
  ) then
    raise exception 'Validacion final fallo: hay nombres normalizados con espacios de borde.';
  end if;

  if public.tp_normalizar_nombre_jugador(U&'JOAQU\00CDN  CARRIZO.') <> 'joaquin carrizo' then
    raise exception 'Validacion final fallo: normalizacion con tilde y punto.';
  end if;

  if public.tp_normalizar_nombre_jugador(null) is not null then
    raise exception 'Validacion final fallo: la normalizacion no preserva NULL.';
  end if;

  if public.tp_normalizar_nombre_jugador('joaquin carrizo') <> 'joaquin carrizo' then
    raise exception 'Validacion final fallo: normalizacion no idempotente.';
  end if;

  if (select count(*) from public.inscripciones_jugadores) <> 27 then
    raise exception 'Validacion final fallo: inscripciones no es 27.';
  end if;

  if (select count(*) from public.eventos_partido) <> 368 then
    raise exception 'Validacion final fallo: eventos no es 368.';
  end if;

  if (
    select count(*)
    from public.eventos_partido
    where inscripcion_jugador_id is not null
  ) <> 60 then
    raise exception 'Validacion final fallo: eventos vinculados no es 60.';
  end if;

  if (
    select count(*)
    from public.eventos_partido
    where inscripcion_jugador_id is null
  ) <> 308 then
    raise exception 'Validacion final fallo: eventos pendientes no es 308.';
  end if;

  if (
    select count(*)
    from public.eventos_partido
    where btrim(coalesce(jugador, '')) <> ''
  ) <> 368 then
    raise exception 'Validacion final fallo: texto historico no es 368.';
  end if;

  if (select count(*) from public.goleadores_oficiales) <> 4 then
    raise exception 'Validacion final fallo: goleadores_oficiales no es 4.';
  end if;

  if (
    select count(*)
    from public.eventos_partido
    where tipo = 'gol_en_contra'
      and jugador = 'ANGELETTI JOAQUIN'
  ) <> 1 then
    raise exception 'Validacion final fallo: autogol historico no preservado.';
  end if;

  select count(*)
  into v_referencias_rotas
  from public.eventos_partido evento
  where (
      evento.partido_id is not null
      and not exists (
        select 1 from public.partidos partido
        where partido.id = evento.partido_id
      )
    )
    or (
      evento.equipo_id is not null
      and not exists (
        select 1 from public.clubes club
        where club.id = evento.equipo_id
      )
    )
    or (
      evento.inscripcion_jugador_id is not null
      and not exists (
        select 1 from public.inscripciones_jugadores inscripcion
        where inscripcion.id = evento.inscripcion_jugador_id
      )
    )
    or (
      evento.inscripcion_relacionada_id is not null
      and not exists (
        select 1 from public.inscripciones_jugadores inscripcion
        where inscripcion.id = evento.inscripcion_relacionada_id
      )
    );

  if v_referencias_rotas <> 0 then
    raise exception 'Validacion final fallo: referencias rotas %.', v_referencias_rotas;
  end if;

  if (
    select array_agg(id order by id)
    from public.jugadores
    where public.tp_normalizar_nombre_jugador(nombre_completo) = 'sanchez'
  ) <> array[11::bigint, 25::bigint] then
    raise exception 'Validacion final fallo: homonimos Sanchez no preservados.';
  end if;

  if (
    select array_agg(id order by id)
    from public.jugadores
    where public.tp_normalizar_nombre_jugador(nombre_completo) = 'sarco'
  ) <> array[20::bigint, 21::bigint] then
    raise exception 'Validacion final fallo: homonimos Sarco no preservados.';
  end if;

  if exists (
    select 1
    from pg_index index_row
    join pg_class table_cls
      on table_cls.oid = index_row.indrelid
    join pg_namespace ns
      on ns.oid = table_cls.relnamespace
    join lateral unnest(index_row.indkey) as index_key(attnum)
      on true
    join pg_attribute att
      on att.attrelid = table_cls.oid
     and att.attnum = index_key.attnum
    where ns.nspname = 'public'
      and table_cls.relname = 'jugadores'
      and index_row.indisunique
      and att.attname = 'nombre_normalizado'
  ) then
    raise exception 'Validacion final fallo: existe UNIQUE global por nombre_normalizado.';
  end if;

  if to_regclass('public.jugadores_aliases') is null then
    raise exception 'Validacion final fallo: jugadores_aliases no existe.';
  end if;

  if not coalesce((
    select relrowsecurity
    from pg_class cls
    join pg_namespace ns
      on ns.oid = cls.relnamespace
    where ns.nspname = 'public'
      and cls.relname = 'jugadores_aliases'
  ), false) then
    raise exception 'Validacion final fallo: RLS de jugadores_aliases no esta habilitado.';
  end if;

  if exists (
    select 1
    from information_schema.role_table_grants grant_row
    where grant_row.table_schema = 'public'
      and grant_row.table_name = 'jugadores_aliases'
      and grant_row.grantee in ('anon', 'authenticated', 'public')
      and grant_row.privilege_type in ('SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')
  ) then
    raise exception 'Validacion final fallo: jugadores_aliases tiene permisos publicos inesperados.';
  end if;

  if (select count(*) from public.jugadores_aliases) <> 0 then
    raise exception 'Validacion final fallo: aliases migrados no es 0.';
  end if;

  if (
    select count(*)
    from (
      values
        ('public.jugadores_nombre_normalizado_idx'),
        ('public.jugadores_aliases_jugador_idx'),
        ('public.jugadores_aliases_busqueda_idx'),
        ('public.jugadores_aliases_contexto_unico_idx'),
        ('public.eventos_partido_inscripcion_idx'),
        ('public.eventos_partido_inscripcion_relacionada_idx'),
        ('public.inscripciones_jugador_torneo_idx'),
        ('public.inscripciones_torneo_club_estado_idx')
    ) expected(index_name)
    where to_regclass(expected.index_name) is not null
  ) <> 8 then
    raise exception 'Validacion final fallo: indices esperados incompletos.';
  end if;

  if (
    select count(*)
    from pg_trigger trigger_row
    where trigger_row.tgname in (
        'jugadores_normalizar_nombre',
        'jugadores_aliases_normalizar',
        'eventos_partido_validar_inscripcion_jugador'
      )
      and not trigger_row.tgisinternal
  ) <> 3 then
    raise exception 'Validacion final fallo: triggers esperados incompletos.';
  end if;

  if (
    select count(*)
    from pg_constraint con
    where con.conrelid = 'public.eventos_partido'::regclass
      and con.contype = 'f'
      and con.conname in (
        'eventos_partido_inscripcion_fk',
        'eventos_partido_inscripcion_relacionada_fk'
      )
  ) <> 2 then
    raise exception 'Validacion final fallo: FKs esperadas incompletas.';
  end if;
end;
$$;

commit;
