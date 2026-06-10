create table if not exists public.respaldos_etapa (
  id bigint generated always as identity primary key,
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
  torneo_completo jsonb not null default '[]'::jsonb,
  creado_en timestamptz not null default now(),
  unique (tipo, valor, version)
);

create table if not exists public.etapas_estado (
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
  primary key (tipo, valor)
);

alter table public.respaldos_etapa enable row level security;
alter table public.etapas_estado enable row level security;

create index if not exists respaldos_etapa_busqueda_idx
  on public.respaldos_etapa (tipo, valor, version desc);

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

drop trigger if exists respaldos_etapa_inmutables
  on public.respaldos_etapa;

create trigger respaldos_etapa_inmutables
before update or delete on public.respaldos_etapa
for each row execute function public.tp_bloquear_respaldo_inmutable();

create or replace function public.tp_guardar_respaldo_etapa(
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
  v_torneo jsonb := '[]'::jsonb;
  v_partido_ids bigint[];
  v_version integer;
  v_respaldo_id bigint;
begin
  if p_tipo not in ('regular', 'playoff') then
    raise exception 'Tipo de etapa invalido.';
  end if;

  if p_motivo not in ('cierre', 'pre_restauracion') then
    raise exception 'Motivo de respaldo invalido.';
  end if;

  perform pg_advisory_xact_lock(
    hashtext('tres-palos:' || p_tipo || ':' || p_valor)
  );

  select coalesce(
    jsonb_agg(to_jsonb(p) order by p.id),
    '[]'::jsonb
  )
  into v_partidos
  from public.partidos p
  where (
    p_tipo = 'regular'
    and p.tipo = 'regular'
    and p.fecha::text = p_valor
  ) or (
    p_tipo = 'playoff'
    and p.tipo = 'playoff'
    and p.fase::text = p_valor
  );

  select coalesce(
    array_agg((item ->> 'id')::bigint),
    array[]::bigint[]
  )
  into v_partido_ids
  from jsonb_array_elements(v_partidos) item;

  if to_regclass('public.eventos_partido') is not null then
    execute $sql$
      select coalesce(jsonb_agg(to_jsonb(e)), '[]'::jsonb)
      from public.eventos_partido e
      where e.partido_id = any($1)
    $sql$
    into v_incidencias
    using v_partido_ids;
  end if;

  select coalesce(
    jsonb_agg(to_jsonb(p) order by p.id),
    '[]'::jsonb
  )
  into v_torneo
  from public.partidos p;

  select coalesce(max(version), 0) + 1
  into v_version
  from public.respaldos_etapa
  where tipo = p_tipo and valor = p_valor;

  insert into public.respaldos_etapa (
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
    p_tipo,
    p_valor,
    p_etiqueta,
    v_version,
    p_motivo,
    nullif(trim(p_nota), ''),
    jsonb_array_length(v_partidos),
    v_partidos,
    v_incidencias,
    v_torneo
  )
  returning id into v_respaldo_id;

  return v_respaldo_id;
end;
$$;

create or replace function public.tp_cerrar_etapa(
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
  if p_tipo not in ('regular', 'playoff') then
    raise exception 'Tipo de etapa invalido.';
  end if;

  if nullif(trim(p_valor), '') is null then
    raise exception 'Falta identificar la etapa.';
  end if;

  perform pg_advisory_xact_lock(
    hashtext('tres-palos:' || p_tipo || ':' || p_valor)
  );

  select estado
  into v_estado
  from public.etapas_estado
  where tipo = p_tipo and valor = p_valor;

  if v_estado = 'cerrada' then
    raise exception 'La etapa ya esta cerrada.';
  end if;

  select
    count(*),
    count(*) filter (
      where
        nullif(trim(coalesce(to_jsonb(p) ->> 'local', '')), '') is null
        or nullif(trim(coalesce(to_jsonb(p) ->> 'visitante', '')), '') is null
        or (to_jsonb(p) ->> 'goles_local') is null
        or (to_jsonb(p) ->> 'goles_visitante') is null
        or coalesce(to_jsonb(p) ->> 'estado', '') in (
          'en_vivo',
          'pendiente_resultado',
          'suspendido',
          'postergado'
        )
    )
  into v_total, v_pendientes
  from public.partidos p
  where (
    p_tipo = 'regular'
    and p.tipo = 'regular'
    and p.fecha::text = p_valor
  ) or (
    p_tipo = 'playoff'
    and p.tipo = 'playoff'
    and p.fase::text = p_valor
  );

  if v_total = 0 then
    raise exception 'La etapa no tiene partidos para respaldar.';
  end if;

  if v_pendientes > 0 then
    raise exception
      'No se puede cerrar: hay % partido(s) incompleto(s).',
      v_pendientes;
  end if;

  update public.partidos p
  set
    estado = 'finalizado',
    actualizado_en = now()
  where (
    (
      p_tipo = 'regular'
      and p.tipo = 'regular'
      and p.fecha::text = p_valor
    ) or (
      p_tipo = 'playoff'
      and p.tipo = 'playoff'
      and p.fase::text = p_valor
    )
  )
  and p.estado = 'programado'
  and p.goles_local is not null
  and p.goles_visitante is not null;

  v_respaldo_id := public.tp_guardar_respaldo_etapa(
    p_tipo,
    p_valor,
    p_etiqueta,
    'cierre',
    p_nota
  );

  insert into public.etapas_estado (
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
    p_tipo,
    p_valor,
    p_etiqueta,
    'cerrada',
    v_respaldo_id,
    now(),
    null,
    now()
  )
  on conflict (tipo, valor) do update set
    etiqueta = excluded.etiqueta,
    estado = 'cerrada',
    respaldo_cierre_id = excluded.respaldo_cierre_id,
    cerrada_en = excluded.cerrada_en,
    reabierta_en = null,
    actualizado_en = now();

  return jsonb_build_object(
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
  select estado
  into v_estado
  from public.etapas_estado
  where tipo = p_tipo and valor = p_valor;

  if v_estado is distinct from 'cerrada' then
    raise exception 'La etapa no esta cerrada.';
  end if;

  update public.etapas_estado
  set
    etiqueta = p_etiqueta,
    estado = 'abierta',
    reabierta_en = now(),
    actualizado_en = now()
  where tipo = p_tipo and valor = p_valor;

  return jsonb_build_object(
    'tipo', p_tipo,
    'valor', p_valor,
    'etiqueta', p_etiqueta,
    'estado', 'abierta'
  );
end;
$$;

create or replace function public.tp_restaurar_respaldo(
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
  v_ids_actuales bigint[];
  v_ids_respaldo bigint[];
  v_ids_afectados bigint[];
  v_sequence text;
  v_event_sequence text;
begin
  select *
  into v_respaldo
  from public.respaldos_etapa
  where id = p_respaldo_id;

  if not found then
    raise exception 'Respaldo no encontrado.';
  end if;

  perform pg_advisory_xact_lock(
    hashtext(
      'tres-palos:' || v_respaldo.tipo || ':' || v_respaldo.valor
    )
  );

  v_respaldo_previo_id := public.tp_guardar_respaldo_etapa(
    v_respaldo.tipo,
    v_respaldo.valor,
    v_respaldo.etiqueta,
    'pre_restauracion',
    'Estado anterior a restaurar el respaldo #' || p_respaldo_id
  );

  select coalesce(array_agg(p.id::bigint), array[]::bigint[])
  into v_ids_actuales
  from public.partidos p
  where (
    v_respaldo.tipo = 'regular'
    and p.tipo = 'regular'
    and p.fecha::text = v_respaldo.valor
  ) or (
    v_respaldo.tipo = 'playoff'
    and p.tipo = 'playoff'
    and p.fase::text = v_respaldo.valor
  );

  select coalesce(
    array_agg((item ->> 'id')::bigint),
    array[]::bigint[]
  )
  into v_ids_respaldo
  from jsonb_array_elements(v_respaldo.partidos) item;

  select array(
    select distinct unnest(v_ids_actuales || v_ids_respaldo)
  )
  into v_ids_afectados;

  if to_regclass('public.eventos_partido') is not null then
    execute
      'delete from public.eventos_partido where partido_id = any($1)'
    using v_ids_afectados;
  end if;

  delete from public.partidos p
  where p.id = any(v_ids_afectados);

  insert into public.partidos
  overriding system value
  select *
  from jsonb_populate_recordset(
    null::public.partidos,
    v_respaldo.partidos
  );

  if
    to_regclass('public.eventos_partido') is not null
    and jsonb_array_length(v_respaldo.incidencias) > 0
  then
    execute $sql$
      insert into public.eventos_partido
      overriding system value
      select *
      from jsonb_populate_recordset(
        null::public.eventos_partido,
        $1
      )
    $sql$
    using v_respaldo.incidencias;
  end if;

  if
    to_regclass('public.eventos_partido') is not null
    and exists (
      select 1
      from information_schema.columns
      where
        table_schema = 'public'
        and table_name = 'eventos_partido'
        and column_name = 'id'
    )
  then
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
    v_respaldo.tipo,
    v_respaldo.valor,
    v_respaldo.etiqueta,
    'abierta',
    null,
    null,
    now(),
    now()
  )
  on conflict (tipo, valor) do update set
    etiqueta = excluded.etiqueta,
    estado = 'abierta',
    respaldo_cierre_id = null,
    cerrada_en = null,
    reabierta_en = now(),
    actualizado_en = now();

  return jsonb_build_object(
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

revoke all on function public.tp_guardar_respaldo_etapa(
  text, text, text, text, text
) from public, anon, authenticated;
revoke all on function public.tp_cerrar_etapa(
  text, text, text, text
) from public, anon, authenticated;
revoke all on function public.tp_reabrir_etapa(
  text, text, text
) from public, anon, authenticated;
revoke all on function public.tp_restaurar_respaldo(
  bigint
) from public, anon, authenticated;

grant select, insert on table public.respaldos_etapa to service_role;
grant select, insert, update on table public.etapas_estado to service_role;
grant usage, select on sequence public.respaldos_etapa_id_seq to service_role;

grant execute on function public.tp_cerrar_etapa(
  text, text, text, text
) to service_role;
grant execute on function public.tp_reabrir_etapa(
  text, text, text
) to service_role;
grant execute on function public.tp_restaurar_respaldo(
  bigint
) to service_role;

comment on table public.respaldos_etapa is
  'Copias inmutables creadas al cerrar o restaurar una fecha o fase.';

comment on table public.etapas_estado is
  'Estado administrativo actual de cada fecha o fase del torneo.';
