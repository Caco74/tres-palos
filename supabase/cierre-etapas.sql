begin;

do $$
begin
  if to_regclass('public.torneos') is null then
    raise exception 'Falta public.torneos. Ejecuta supabase/planteles.sql antes de cierre-etapas.sql.';
  end if;

  if to_regclass('public.partidos') is null then
    raise exception 'Falta public.partidos.';
  end if;

  if to_regclass('public.eventos_partido') is null then
    raise exception 'Falta public.eventos_partido.';
  end if;

  if to_regclass('public.clubes') is null then
    raise exception 'Falta public.clubes.';
  end if;

  if to_regclass('public.jugadores') is null then
    raise exception 'Falta public.jugadores.';
  end if;

  if to_regclass('public.inscripciones_jugadores') is null then
    raise exception 'Falta public.inscripciones_jugadores.';
  end if;
end;
$$;

create table if not exists public.respaldos_etapa (
  id bigint generated always as identity primary key,
  torneo_id bigint not null references public.torneos(id),
  tipo text not null check (tipo in ('regular', 'playoff')),
  valor text not null,
  etiqueta text not null,
  version integer not null check (version > 0),
  motivo text not null check (
    motivo in ('cierre', 'pre_restauracion')
  ),
  nota text null,
  cantidad_partidos integer not null default 0,
  partidos jsonb not null default '[]'::jsonb,
  incidencias jsonb not null default '[]'::jsonb,
  torneo_completo jsonb not null default '{}'::jsonb,
  creado_en timestamptz not null default now(),
  constraint respaldos_etapa_torneo_tipo_valor_version_key
    unique (torneo_id, tipo, valor, version)
);

create table if not exists public.etapas_estado (
  torneo_id bigint not null references public.torneos(id),
  tipo text not null check (tipo in ('regular', 'playoff')),
  valor text not null,
  etiqueta text not null,
  estado text not null default 'abierta' check (
    estado in ('abierta', 'cerrada')
  ),
  respaldo_cierre_id bigint null references public.respaldos_etapa(id),
  cerrada_en timestamptz null,
  reabierta_en timestamptz null,
  actualizado_en timestamptz not null default now(),
  primary key (torneo_id, tipo, valor)
);

alter table public.respaldos_etapa
  add column if not exists torneo_id bigint null references public.torneos(id);

alter table public.respaldos_etapa
  alter column torneo_completo set default '{}'::jsonb;

alter table public.etapas_estado
  add column if not exists torneo_id bigint null references public.torneos(id);

create or replace function public.tp_etapa_regular_fecha(p_valor text)
returns integer
language sql
immutable
as $$
  select case
    when p_valor ~ '^fecha:[0-9]+:zona:[A-Za-z0-9_-]+$'
      then substring(p_valor from '^fecha:([0-9]+):zona:[A-Za-z0-9_-]+$')::integer
    when p_valor ~ '^[0-9]+$'
      then p_valor::integer
    else null
  end;
$$;

create or replace function public.tp_etapa_regular_zona(p_valor text)
returns text
language sql
immutable
as $$
  select case
    when p_valor ~ '^fecha:[0-9]+:zona:[A-Za-z0-9_-]+$'
      then substring(p_valor from '^fecha:[0-9]+:zona:([A-Za-z0-9_-]+)$')
    else null
  end;
$$;

drop trigger if exists respaldos_etapa_inmutables
  on public.respaldos_etapa;

with candidatos as (
  select
    respaldo.id,
    (array_agg(distinct (partido.item ->> 'torneo_id')::bigint))[1]
      as torneo_id,
    count(distinct (partido.item ->> 'torneo_id')::bigint)
      as cantidad_torneos
  from public.respaldos_etapa respaldo
  cross join lateral jsonb_array_elements(respaldo.partidos) partido(item)
  where respaldo.torneo_id is null
    and partido.item ? 'torneo_id'
    and (partido.item ->> 'torneo_id') ~ '^[0-9]+$'
  group by respaldo.id
)
update public.respaldos_etapa respaldo
set torneo_id = candidatos.torneo_id
from candidatos
where respaldo.id = candidatos.id
  and respaldo.torneo_id is null
  and candidatos.cantidad_torneos = 1;

with candidatos_por_torneo as (
  select
    respaldo.id,
    partido.torneo_id,
    count(*)::integer as cantidad_partidos
  from public.respaldos_etapa respaldo
  join public.partidos partido
    on partido.torneo_id is not null
    and (
      (
        respaldo.tipo = 'regular'
        and partido.tipo = 'regular'
        and partido.fecha = public.tp_etapa_regular_fecha(respaldo.valor)
        and (
          public.tp_etapa_regular_zona(respaldo.valor) is null
          or partido.zona::text = public.tp_etapa_regular_zona(respaldo.valor)
        )
      ) or (
        respaldo.tipo = 'playoff'
        and partido.tipo = 'playoff'
        and partido.fase::text = respaldo.valor
      )
    )
  where respaldo.torneo_id is null
    and not exists (
      select 1
      from jsonb_array_elements(respaldo.partidos) item(valor)
      where item.valor ? 'torneo_id'
        and (item.valor ->> 'torneo_id') ~ '^[0-9]+$'
    )
  group by
    respaldo.id,
    partido.torneo_id,
    respaldo.cantidad_partidos,
    jsonb_array_length(respaldo.partidos)
  having count(*) = respaldo.cantidad_partidos
    or count(*) = jsonb_array_length(respaldo.partidos)
),
candidatos_unicos as (
  select
    candidato.id,
    min(candidato.torneo_id) as torneo_id
  from candidatos_por_torneo candidato
  group by candidato.id
  having count(*) = 1
)
update public.respaldos_etapa respaldo
set
  torneo_id = candidato.torneo_id,
  partidos = (
    select coalesce(
      jsonb_agg(
        case
          when jsonb_typeof(item.valor) = 'object'
            then item.valor || jsonb_build_object(
              'torneo_id',
              candidato.torneo_id
            )
          else item.valor
        end
        order by item.orden
      ),
      '[]'::jsonb
    )
    from jsonb_array_elements(respaldo.partidos)
      with ordinality item(valor, orden)
  )
from candidatos_unicos candidato
where respaldo.id = candidato.id
  and respaldo.torneo_id is null;

update public.etapas_estado etapa
set torneo_id = respaldo.torneo_id
from public.respaldos_etapa respaldo
where etapa.torneo_id is null
  and etapa.respaldo_cierre_id = respaldo.id
  and respaldo.torneo_id is not null;

with candidatos as (
  select
    etapa.tipo,
    etapa.valor,
    (array_agg(distinct partido.torneo_id))[1] as torneo_id,
    count(distinct partido.torneo_id) as cantidad_torneos
  from public.etapas_estado etapa
  join public.partidos partido
    on partido.torneo_id is not null
    and (
      (
        etapa.tipo = 'regular'
        and partido.tipo = 'regular'
        and partido.fecha = public.tp_etapa_regular_fecha(etapa.valor)
        and (
          public.tp_etapa_regular_zona(etapa.valor) is null
          or partido.zona::text = public.tp_etapa_regular_zona(etapa.valor)
        )
      ) or (
        etapa.tipo = 'playoff'
        and partido.tipo = 'playoff'
        and partido.fase::text = etapa.valor
      )
    )
  where etapa.torneo_id is null
  group by etapa.tipo, etapa.valor
)
update public.etapas_estado etapa
set torneo_id = candidatos.torneo_id
from candidatos
where etapa.torneo_id is null
  and etapa.tipo = candidatos.tipo
  and etapa.valor = candidatos.valor
  and candidatos.cantidad_torneos = 1;

do $$
declare
  v_respaldos_sin_torneo integer;
  v_etapas_sin_torneo integer;
begin
  select count(*)
  into v_respaldos_sin_torneo
  from public.respaldos_etapa
  where torneo_id is null;

  if v_respaldos_sin_torneo > 0 then
    raise exception
      'No se pudo asignar torneo_id a % respaldo(s) existentes. Revisalos manualmente antes de continuar.',
      v_respaldos_sin_torneo;
  end if;

  select count(*)
  into v_etapas_sin_torneo
  from public.etapas_estado
  where torneo_id is null;

  if v_etapas_sin_torneo > 0 then
    raise exception
      'No se pudo asignar torneo_id a % etapa(s) existentes. Revisalas manualmente antes de continuar.',
      v_etapas_sin_torneo;
  end if;
end;
$$;

alter table public.respaldos_etapa
  alter column torneo_id set not null;

alter table public.etapas_estado
  alter column torneo_id set not null;

alter table public.respaldos_etapa
  drop constraint if exists respaldos_etapa_tipo_valor_version_key;

alter table public.respaldos_etapa
  drop constraint if exists respaldos_etapa_torneo_id_tipo_valor_version_key;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'respaldos_etapa_torneo_tipo_valor_version_key'
      and conrelid = 'public.respaldos_etapa'::regclass
  ) then
    alter table public.respaldos_etapa
      add constraint respaldos_etapa_torneo_tipo_valor_version_key
      unique (torneo_id, tipo, valor, version);
  end if;
end;
$$;

alter table public.etapas_estado
  drop constraint if exists etapas_estado_pkey;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'etapas_estado_pkey'
      and conrelid = 'public.etapas_estado'::regclass
  ) then
    alter table public.etapas_estado
      add constraint etapas_estado_pkey
      primary key (torneo_id, tipo, valor);
  end if;
end;
$$;

alter table public.respaldos_etapa enable row level security;
alter table public.etapas_estado enable row level security;

drop index if exists public.respaldos_etapa_busqueda_idx;
create index if not exists respaldos_etapa_busqueda_idx
  on public.respaldos_etapa (torneo_id, tipo, valor, version desc);

drop index if exists public.etapas_estado_busqueda_idx;
create index if not exists etapas_estado_busqueda_idx
  on public.etapas_estado (torneo_id, tipo, valor);

create index if not exists respaldos_etapa_creado_en_idx
  on public.respaldos_etapa (creado_en desc);

create or replace function public.tp_bloquear_respaldo_inmutable()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Los respaldos de etapa son inmutables.';
end;
$$;

create trigger respaldos_etapa_inmutables
before update or delete on public.respaldos_etapa
for each row execute function public.tp_bloquear_respaldo_inmutable();

drop function if exists public.tp_guardar_respaldo_etapa(
  text, text, text, text, text
);
drop function if exists public.tp_cerrar_etapa(
  text, text, text, text
);
drop function if exists public.tp_reabrir_etapa(
  text, text, text
);
drop function if exists public.tp_restaurar_respaldo(
  bigint
);

create or replace function public.tp_exportar_torneo_completo(
  p_torneo_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_torneo public.torneos%rowtype;
  v_partidos jsonb := '[]'::jsonb;
  v_eventos jsonb := '[]'::jsonb;
  v_clubes jsonb := '[]'::jsonb;
  v_jugadores jsonb := '[]'::jsonb;
  v_inscripciones jsonb := '[]'::jsonb;
  v_partido_ids bigint[] := array[]::bigint[];
begin
  if p_torneo_id is null then
    raise exception 'Falta torneo_id.';
  end if;

  select *
  into v_torneo
  from public.torneos
  where id = p_torneo_id;

  if not found then
    raise exception 'Torneo no encontrado: %.', p_torneo_id;
  end if;

  select
    coalesce(jsonb_agg(to_jsonb(partido) order by partido.id), '[]'::jsonb),
    coalesce(array_agg(partido.id::bigint), array[]::bigint[])
  into v_partidos, v_partido_ids
  from public.partidos partido
  where partido.torneo_id = p_torneo_id;

  select coalesce(
    jsonb_agg(to_jsonb(evento) order by evento.partido_id, evento.orden, evento.id),
    '[]'::jsonb
  )
  into v_eventos
  from public.eventos_partido evento
  where evento.partido_id = any(v_partido_ids);

  select coalesce(jsonb_agg(to_jsonb(club) order by club.id), '[]'::jsonb)
  into v_clubes
  from public.clubes club
  where club.id in (
    select partido.local_id
    from public.partidos partido
    where partido.torneo_id = p_torneo_id
      and partido.local_id is not null
    union
    select partido.visitante_id
    from public.partidos partido
    where partido.torneo_id = p_torneo_id
      and partido.visitante_id is not null
    union
    select inscripcion.club_id
    from public.inscripciones_jugadores inscripcion
    where inscripcion.torneo_id = p_torneo_id
  );

  select coalesce(
    jsonb_agg(to_jsonb(inscripcion) order by inscripcion.club_id, inscripcion.id),
    '[]'::jsonb
  )
  into v_inscripciones
  from public.inscripciones_jugadores inscripcion
  where inscripcion.torneo_id = p_torneo_id;

  select coalesce(jsonb_agg(to_jsonb(jugador) order by jugador.id), '[]'::jsonb)
  into v_jugadores
  from public.jugadores jugador
  where exists (
    select 1
    from public.inscripciones_jugadores inscripcion
    where inscripcion.torneo_id = p_torneo_id
      and inscripcion.jugador_id = jugador.id
  );

  return jsonb_build_object(
    'metadata', jsonb_build_object(
      'torneo_id', v_torneo.id,
      'torneo', v_torneo.nombre,
      'tipo', v_torneo.tipo,
      'temporada', v_torneo.anio,
      'exportado_en', now(),
      'schema_version', '2'
    ),
    'counts', jsonb_build_object(
      'torneos', 1,
      'clubes', jsonb_array_length(v_clubes),
      'jugadores', jsonb_array_length(v_jugadores),
      'inscripciones_jugadores', jsonb_array_length(v_inscripciones),
      'partidos', jsonb_array_length(v_partidos),
      'eventos_partido', jsonb_array_length(v_eventos)
    ),
    'torneos', jsonb_build_array(to_jsonb(v_torneo)),
    'clubes', v_clubes,
    'jugadores', v_jugadores,
    'inscripciones_jugadores', v_inscripciones,
    'partidos', v_partidos,
    'eventos_partido', v_eventos
  );
end;
$$;

create or replace function public.tp_guardar_respaldo_etapa(
  p_torneo_id bigint,
  p_tipo text,
  p_valor text,
  p_etiqueta text,
  p_motivo text,
  p_nota text
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_partidos jsonb := '[]'::jsonb;
  v_incidencias jsonb := '[]'::jsonb;
  v_torneo_completo jsonb := '{}'::jsonb;
  v_partido_ids bigint[];
  v_version integer;
  v_respaldo_id bigint;
begin
  if p_torneo_id is null then
    raise exception 'Falta torneo_id.';
  end if;

  if p_tipo not in ('regular', 'playoff') then
    raise exception 'Tipo de etapa invalido.';
  end if;

  if nullif(trim(p_valor), '') is null then
    raise exception 'Falta identificar la etapa.';
  end if;

  if p_motivo not in ('cierre', 'pre_restauracion') then
    raise exception 'Motivo de respaldo invalido.';
  end if;

  v_torneo_completo := public.tp_exportar_torneo_completo(p_torneo_id);

  perform pg_advisory_xact_lock(
    hashtext('tres-palos:' || p_torneo_id || ':' || p_tipo || ':' || p_valor)
  );

  select coalesce(
    jsonb_agg(to_jsonb(partido) order by partido.id),
    '[]'::jsonb
  )
  into v_partidos
  from public.partidos partido
  where partido.torneo_id = p_torneo_id
    and (
      (
        p_tipo = 'regular'
        and partido.tipo = 'regular'
        and partido.fecha = public.tp_etapa_regular_fecha(p_valor)
        and (
          public.tp_etapa_regular_zona(p_valor) is null
          or partido.zona::text = public.tp_etapa_regular_zona(p_valor)
        )
      ) or (
        p_tipo = 'playoff'
        and partido.tipo = 'playoff'
        and partido.fase::text = p_valor
      )
    );

  select coalesce(
    array_agg((item ->> 'id')::bigint),
    array[]::bigint[]
  )
  into v_partido_ids
  from jsonb_array_elements(v_partidos) item;

  select coalesce(
    jsonb_agg(to_jsonb(evento) order by evento.partido_id, evento.orden, evento.id),
    '[]'::jsonb
  )
  into v_incidencias
  from public.eventos_partido evento
  where evento.partido_id = any(v_partido_ids);

  select coalesce(max(version), 0) + 1
  into v_version
  from public.respaldos_etapa
  where torneo_id = p_torneo_id
    and tipo = p_tipo
    and valor = p_valor;

  insert into public.respaldos_etapa (
    torneo_id,
    tipo,
    valor,
    etiqueta,
    version,
    motivo,
    nota,
    cantidad_partidos,
    partidos,
    incidencias,
    torneo_completo
  )
  values (
    p_torneo_id,
    p_tipo,
    p_valor,
    p_etiqueta,
    v_version,
    p_motivo,
    nullif(trim(p_nota), ''),
    jsonb_array_length(v_partidos),
    v_partidos,
    v_incidencias,
    v_torneo_completo
  )
  returning id into v_respaldo_id;

  return v_respaldo_id;
end;
$$;

create or replace function public.tp_cerrar_etapa(
  p_torneo_id bigint,
  p_tipo text,
  p_valor text,
  p_etiqueta text,
  p_nota text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total integer;
  v_pendientes integer;
  v_respaldo_id bigint;
  v_estado text;
begin
  if p_torneo_id is null then
    raise exception 'Falta torneo_id.';
  end if;

  if not exists (
    select 1
    from public.torneos
    where id = p_torneo_id
  ) then
    raise exception 'Torneo no encontrado: %.', p_torneo_id;
  end if;

  if p_tipo not in ('regular', 'playoff') then
    raise exception 'Tipo de etapa invalido.';
  end if;

  if nullif(trim(p_valor), '') is null then
    raise exception 'Falta identificar la etapa.';
  end if;

  perform pg_advisory_xact_lock(
    hashtext('tres-palos:' || p_torneo_id || ':' || p_tipo || ':' || p_valor)
  );

  select estado
  into v_estado
  from public.etapas_estado
  where torneo_id = p_torneo_id
    and tipo = p_tipo
    and valor = p_valor;

  if v_estado = 'cerrada' then
    raise exception 'La etapa ya esta cerrada.';
  end if;

  select
    count(*),
    count(*) filter (
      where
        nullif(trim(coalesce(to_jsonb(partido) ->> 'local', '')), '') is null
        or nullif(trim(coalesce(to_jsonb(partido) ->> 'visitante', '')), '') is null
        or (to_jsonb(partido) ->> 'goles_local') is null
        or (to_jsonb(partido) ->> 'goles_visitante') is null
        or coalesce(to_jsonb(partido) ->> 'estado', '') in (
          'en_vivo',
          'pendiente_resultado',
          'suspendido',
          'postergado'
        )
    )
  into v_total, v_pendientes
  from public.partidos partido
  where partido.torneo_id = p_torneo_id
    and (
      (
        p_tipo = 'regular'
        and partido.tipo = 'regular'
        and partido.fecha = public.tp_etapa_regular_fecha(p_valor)
        and (
          public.tp_etapa_regular_zona(p_valor) is null
          or partido.zona::text = public.tp_etapa_regular_zona(p_valor)
        )
      ) or (
        p_tipo = 'playoff'
        and partido.tipo = 'playoff'
        and partido.fase::text = p_valor
      )
    );

  if v_total = 0 then
    raise exception 'La etapa no tiene partidos para respaldar.';
  end if;

  if v_pendientes > 0 then
    raise exception
      'No se puede cerrar: hay % partido(s) incompleto(s).',
      v_pendientes;
  end if;

  update public.partidos partido
  set
    estado = 'finalizado',
    actualizado_en = now()
  where partido.torneo_id = p_torneo_id
    and (
      (
        p_tipo = 'regular'
        and partido.tipo = 'regular'
        and partido.fecha = public.tp_etapa_regular_fecha(p_valor)
        and (
          public.tp_etapa_regular_zona(p_valor) is null
          or partido.zona::text = public.tp_etapa_regular_zona(p_valor)
        )
      ) or (
        p_tipo = 'playoff'
        and partido.tipo = 'playoff'
        and partido.fase::text = p_valor
      )
    )
    and partido.estado = 'programado'
    and partido.goles_local is not null
    and partido.goles_visitante is not null;

  v_respaldo_id := public.tp_guardar_respaldo_etapa(
    p_torneo_id,
    p_tipo,
    p_valor,
    p_etiqueta,
    'cierre',
    p_nota
  );

  insert into public.etapas_estado (
    torneo_id,
    tipo,
    valor,
    etiqueta,
    estado,
    respaldo_cierre_id,
    cerrada_en,
    reabierta_en,
    actualizado_en
  )
  values (
    p_torneo_id,
    p_tipo,
    p_valor,
    p_etiqueta,
    'cerrada',
    v_respaldo_id,
    now(),
    null,
    now()
  )
  on conflict (torneo_id, tipo, valor) do update set
    etiqueta = excluded.etiqueta,
    estado = 'cerrada',
    respaldo_cierre_id = excluded.respaldo_cierre_id,
    cerrada_en = excluded.cerrada_en,
    reabierta_en = null,
    actualizado_en = now();

  return jsonb_build_object(
    'torneo_id', p_torneo_id,
    'tipo', p_tipo,
    'valor', p_valor,
    'etiqueta', p_etiqueta,
    'estado', 'cerrada',
    'respaldo_id', v_respaldo_id,
    'cantidad_partidos', v_total
  );
end;
$$;

create or replace function public.tp_reabrir_etapa(
  p_torneo_id bigint,
  p_tipo text,
  p_valor text,
  p_etiqueta text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_estado text;
begin
  if p_torneo_id is null then
    raise exception 'Falta torneo_id.';
  end if;

  select estado
  into v_estado
  from public.etapas_estado
  where torneo_id = p_torneo_id
    and tipo = p_tipo
    and valor = p_valor;

  if v_estado is distinct from 'cerrada' then
    raise exception 'La etapa no esta cerrada.';
  end if;

  update public.etapas_estado
  set
    etiqueta = p_etiqueta,
    estado = 'abierta',
    reabierta_en = now(),
    actualizado_en = now()
  where torneo_id = p_torneo_id
    and tipo = p_tipo
    and valor = p_valor;

  return jsonb_build_object(
    'torneo_id', p_torneo_id,
    'tipo', p_tipo,
    'valor', p_valor,
    'etiqueta', p_etiqueta,
    'estado', 'abierta'
  );
end;
$$;

create or replace function public.tp_restaurar_respaldo(
  p_torneo_id bigint,
  p_respaldo_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_respaldo public.respaldos_etapa%rowtype;
  v_respaldo_previo_id bigint;
  v_ids_actuales bigint[] := array[]::bigint[];
  v_ids_respaldo bigint[] := array[]::bigint[];
  v_ids_afectados bigint[] := array[]::bigint[];
  v_sequence text;
  v_event_sequence text;
begin
  if p_torneo_id is null then
    raise exception 'Falta torneo_id.';
  end if;

  select *
  into v_respaldo
  from public.respaldos_etapa
  where id = p_respaldo_id
    and torneo_id = p_torneo_id;

  if not found then
    raise exception
      'Respaldo no encontrado para torneo_id %.',
      p_torneo_id;
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_respaldo.partidos) item
    where not (
      (item ->> 'torneo_id') ~ '^[0-9]+$'
      and (item ->> 'torneo_id')::bigint = p_torneo_id
    )
  ) then
    raise exception
      'El respaldo contiene partidos sin torneo_id o de otro torneo.';
  end if;

  perform pg_advisory_xact_lock(
    hashtext(
      'tres-palos:' ||
      p_torneo_id ||
      ':' ||
      v_respaldo.tipo ||
      ':' ||
      v_respaldo.valor
    )
  );

  v_respaldo_previo_id := public.tp_guardar_respaldo_etapa(
    p_torneo_id,
    v_respaldo.tipo,
    v_respaldo.valor,
    v_respaldo.etiqueta,
    'pre_restauracion',
    'Estado anterior a restaurar el respaldo #' || p_respaldo_id
  );

  select coalesce(array_agg(partido.id::bigint), array[]::bigint[])
  into v_ids_actuales
  from public.partidos partido
  where partido.torneo_id = p_torneo_id
    and (
      (
        v_respaldo.tipo = 'regular'
        and partido.tipo = 'regular'
        and partido.fecha = public.tp_etapa_regular_fecha(v_respaldo.valor)
        and (
          public.tp_etapa_regular_zona(v_respaldo.valor) is null
          or partido.zona::text = public.tp_etapa_regular_zona(v_respaldo.valor)
        )
      ) or (
        v_respaldo.tipo = 'playoff'
        and partido.tipo = 'playoff'
        and partido.fase::text = v_respaldo.valor
      )
    );

  select coalesce(
    array_agg((item ->> 'id')::bigint),
    array[]::bigint[]
  )
  into v_ids_respaldo
  from jsonb_array_elements(v_respaldo.partidos) item;

  if exists (
    select 1
    from public.partidos partido
    where partido.id = any(v_ids_respaldo)
      and partido.torneo_id is distinct from p_torneo_id
  ) then
    raise exception
      'No se puede restaurar: un ID de partido del respaldo pertenece a otro torneo.';
  end if;

  select array(
    select distinct unnest(v_ids_actuales || v_ids_respaldo)
  )
  into v_ids_afectados;

  delete from public.eventos_partido evento
  where evento.partido_id = any(v_ids_afectados);

  delete from public.partidos partido
  where partido.torneo_id = p_torneo_id
    and partido.id = any(v_ids_afectados);

  insert into public.partidos
  overriding system value
  select *
  from jsonb_populate_recordset(
    null::public.partidos,
    v_respaldo.partidos
  );

  if jsonb_array_length(v_respaldo.incidencias) > 0 then
    insert into public.eventos_partido
    overriding system value
    select *
    from jsonb_populate_recordset(
      null::public.eventos_partido,
      v_respaldo.incidencias
    );
  end if;

  v_event_sequence := pg_get_serial_sequence(
    'public.eventos_partido',
    'id'
  );
  if v_event_sequence is not null then
    execute format(
      'select setval(%L, greatest(coalesce(max(id), 1), 1), true) ' ||
      'from public.eventos_partido',
      v_event_sequence
    );
  end if;

  v_sequence := pg_get_serial_sequence('public.partidos', 'id');
  if v_sequence is not null then
    perform setval(
      v_sequence::regclass,
      greatest(coalesce((select max(id) from public.partidos), 1), 1),
      true
    );
  end if;

  insert into public.etapas_estado (
    torneo_id,
    tipo,
    valor,
    etiqueta,
    estado,
    respaldo_cierre_id,
    cerrada_en,
    reabierta_en,
    actualizado_en
  )
  values (
    p_torneo_id,
    v_respaldo.tipo,
    v_respaldo.valor,
    v_respaldo.etiqueta,
    'abierta',
    null,
    null,
    now(),
    now()
  )
  on conflict (torneo_id, tipo, valor) do update set
    etiqueta = excluded.etiqueta,
    estado = 'abierta',
    respaldo_cierre_id = null,
    cerrada_en = null,
    reabierta_en = now(),
    actualizado_en = now();

  return jsonb_build_object(
    'torneo_id', p_torneo_id,
    'tipo', v_respaldo.tipo,
    'valor', v_respaldo.valor,
    'etiqueta', v_respaldo.etiqueta,
    'estado', 'abierta',
    'respaldo_restaurado_id', p_respaldo_id,
    'respaldo_previo_id', v_respaldo_previo_id,
    'cantidad_partidos', jsonb_array_length(v_respaldo.partidos)
  );
end;
$$;

revoke all on table public.respaldos_etapa from public, anon, authenticated;
revoke all on table public.etapas_estado from public, anon, authenticated;

revoke all on function public.tp_exportar_torneo_completo(
  bigint
) from public, anon, authenticated;
revoke all on function public.tp_guardar_respaldo_etapa(
  bigint, text, text, text, text, text
) from public, anon, authenticated;
revoke all on function public.tp_cerrar_etapa(
  bigint, text, text, text, text
) from public, anon, authenticated;
revoke all on function public.tp_reabrir_etapa(
  bigint, text, text, text
) from public, anon, authenticated;
revoke all on function public.tp_restaurar_respaldo(
  bigint, bigint
) from public, anon, authenticated;
revoke all on function public.tp_etapa_regular_fecha(
  text
) from public, anon, authenticated;
revoke all on function public.tp_etapa_regular_zona(
  text
) from public, anon, authenticated;

grant select, insert on table public.respaldos_etapa to service_role;
grant select, insert, update on table public.etapas_estado to service_role;
grant usage, select on sequence public.respaldos_etapa_id_seq to service_role;

grant execute on function public.tp_exportar_torneo_completo(
  bigint
) to service_role;
grant execute on function public.tp_guardar_respaldo_etapa(
  bigint, text, text, text, text, text
) to service_role;
grant execute on function public.tp_cerrar_etapa(
  bigint, text, text, text, text
) to service_role;
grant execute on function public.tp_reabrir_etapa(
  bigint, text, text, text
) to service_role;
grant execute on function public.tp_restaurar_respaldo(
  bigint, bigint
) to service_role;
grant execute on function public.tp_etapa_regular_fecha(
  text
) to service_role;
grant execute on function public.tp_etapa_regular_zona(
  text
) to service_role;

comment on table public.respaldos_etapa is
  'Copias inmutables creadas al cerrar o restaurar una fecha, fecha/zona o fase, siempre dentro de un torneo.';

comment on table public.etapas_estado is
  'Estado administrativo actual de cada fecha, fecha/zona o fase de un torneo.';

commit;
