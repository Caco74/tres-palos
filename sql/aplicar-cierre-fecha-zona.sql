-- Aplicacion manual protegida - cierre regular por fecha y zona.
-- Ejecutar solo despues de sql/prevalidar-cierre-fecha-zona.sql y respaldo local.
-- No ejecuta cierres, reaperturas ni restauraciones. No crea tablas ni columnas.

begin;

do $$
declare
  v_faltantes text;
begin
  with tablas_requeridas(nombre) as (
    values
      ('torneos'),
      ('partidos'),
      ('eventos_partido'),
      ('etapas_estado'),
      ('respaldos_etapa')
  )
  select string_agg(nombre, ', ' order by nombre)
  into v_faltantes
  from tablas_requeridas
  where to_regclass('public.' || nombre) is null;

  if v_faltantes is not null then
    raise exception 'Faltan tablas requeridas: %.', v_faltantes;
  end if;

  with columnas_requeridas(tabla, columna) as (
    values
      ('partidos', 'torneo_id'),
      ('partidos', 'tipo'),
      ('partidos', 'fecha'),
      ('partidos', 'zona'),
      ('partidos', 'fase'),
      ('partidos', 'estado'),
      ('partidos', 'goles_local'),
      ('partidos', 'goles_visitante'),
      ('eventos_partido', 'partido_id'),
      ('etapas_estado', 'torneo_id'),
      ('etapas_estado', 'tipo'),
      ('etapas_estado', 'valor'),
      ('etapas_estado', 'estado'),
      ('respaldos_etapa', 'torneo_id'),
      ('respaldos_etapa', 'tipo'),
      ('respaldos_etapa', 'valor'),
      ('respaldos_etapa', 'partidos'),
      ('respaldos_etapa', 'incidencias'),
      ('respaldos_etapa', 'torneo_completo')
  )
  select string_agg(tabla || '.' || columna, ', ' order by tabla, columna)
  into v_faltantes
  from columnas_requeridas requerida
  where not exists (
    select 1
    from information_schema.columns columna
    where columna.table_schema = 'public'
      and columna.table_name = requerida.tabla
      and columna.column_name = requerida.columna
  );

  if v_faltantes is not null then
    raise exception 'Faltan columnas requeridas: %.', v_faltantes;
  end if;
end;
$$;

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

revoke all on function public.tp_etapa_regular_fecha(
  text
) from public, anon, authenticated;
revoke all on function public.tp_etapa_regular_zona(
  text
) from public, anon, authenticated;

grant execute on function public.tp_etapa_regular_fecha(
  text
) to service_role;
grant execute on function public.tp_etapa_regular_zona(
  text
) to service_role;

commit;
