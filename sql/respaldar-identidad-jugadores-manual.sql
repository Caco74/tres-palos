-- Respaldo manual de identidad de jugadores.
-- Entorno esperado: Supabase produccion de Tres Palos.
-- Ejecucion manual desde Supabase SQL Editor.
-- Ejecutar completo y descargar el resultado como CSV fuera de Git.
-- No copiar claves, JWT, connection strings ni secretos en informes o logs.

BEGIN TRANSACTION READ ONLY;

with
counts as (
  select jsonb_build_object(
    'jugadores', (select count(*) from public.jugadores),
    'inscripciones_jugadores', (
      select count(*) from public.inscripciones_jugadores
    ),
    'eventos_partido', (select count(*) from public.eventos_partido),
    'eventos_vinculados', (
      select count(*)
      from public.eventos_partido
      where inscripcion_jugador_id is not null
    ),
    'eventos_pendientes', (
      select count(*)
      from public.eventos_partido
      where inscripcion_jugador_id is null
    ),
    'goleadores_oficiales', (
      select count(*) from public.goleadores_oficiales
    ),
    'autogoles', (
      select count(*)
      from public.eventos_partido
      where lower(coalesce(tipo, '')) in ('gol_en_contra', 'autogol')
    )
  ) as data
),
jugadores_rows as (
  select
    jugador.id,
    to_jsonb(jugador) as row_json,
    jsonb_build_object(
      'id', jugador.id,
      'nombre_completo', jugador.nombre_completo,
      'aliases', coalesce(jugador.aliases, array[]::text[]),
      'activo', jugador.activo,
      'creado_en', jugador.creado_en,
      'actualizado_en', jugador.actualizado_en
    ) as hash_json
  from public.jugadores jugador
),
inscripciones_rows as (
  select
    inscripcion.id,
    to_jsonb(inscripcion) as row_json
  from public.inscripciones_jugadores inscripcion
),
eventos_rows as (
  select
    evento.id,
    to_jsonb(evento) as row_json
  from public.eventos_partido evento
),
goleadores_rows as (
  select
    goleador.id,
    to_jsonb(goleador) as row_json
  from public.goleadores_oficiales goleador
),
jugadores_data as (
  select coalesce(
    jsonb_agg(row_json order by id),
    '[]'::jsonb
  ) as data
  from jugadores_rows
),
inscripciones_data as (
  select coalesce(
    jsonb_agg(row_json order by id),
    '[]'::jsonb
  ) as data
  from inscripciones_rows
),
eventos_data as (
  select coalesce(
    jsonb_agg(row_json order by id),
    '[]'::jsonb
  ) as data
  from eventos_rows
),
goleadores_data as (
  select coalesce(
    jsonb_agg(row_json order by id),
    '[]'::jsonb
  ) as data
  from goleadores_rows
),
hashes as (
  select jsonb_build_object(
    'jugadores', (
      select md5(coalesce(string_agg(hash_json::text, '' order by id), ''))
      from jugadores_rows
    ),
    'inscripciones_jugadores', (
      select md5(coalesce(string_agg(row_json::text, '' order by id), ''))
      from inscripciones_rows
    ),
    'eventos_partido', (
      select md5(coalesce(string_agg(row_json::text, '' order by id), ''))
      from eventos_rows
    ),
    'goleadores_oficiales', (
      select md5(coalesce(string_agg(row_json::text, '' order by id), ''))
      from goleadores_rows
    )
  ) as data
),
related_tables(tabla) as (
  values
    ('jugadores'),
    ('jugadores_aliases'),
    ('inscripciones_jugadores'),
    ('eventos_partido'),
    ('goleadores_oficiales')
),
columns_related as (
  select
    table_name,
    column_name,
    data_type,
    udt_name,
    is_nullable,
    ordinal_position
  from information_schema.columns
  where table_schema = 'public'
    and table_name in (
      select tabla
      from related_tables
    )
),
structure_columns as (
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'tabla', table_name,
        'columna', column_name,
        'data_type', data_type,
        'udt_name', udt_name,
        'nullable', is_nullable
      )
      order by table_name, ordinal_position
    ),
    '[]'::jsonb
  ) as data
  from columns_related
),
structure_functions as (
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'schema', ns.nspname,
        'funcion', proc.proname,
        'retorno', pg_get_function_result(proc.oid)
      )
      order by ns.nspname, proc.proname
    ),
    '[]'::jsonb
  ) as data
  from pg_proc proc
  join pg_namespace ns
    on ns.oid = proc.pronamespace
  where ns.nspname = 'public'
    and (
      proc.proname ilike '%jugador%'
      or proc.proname ilike '%inscripcion%'
      or proc.proname ilike '%alias%'
    )
),
structure_triggers as (
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'tabla', cls.relname,
        'trigger', trigger_row.tgname,
        'habilitado', trigger_row.tgenabled
      )
      order by cls.relname, trigger_row.tgname
    ),
    '[]'::jsonb
  ) as data
  from pg_trigger trigger_row
  join pg_class cls
    on cls.oid = trigger_row.tgrelid
  join pg_namespace ns
    on ns.oid = cls.relnamespace
  where ns.nspname = 'public'
    and not trigger_row.tgisinternal
    and (
      trigger_row.tgname ilike '%jugador%'
      or trigger_row.tgname ilike '%inscripcion%'
      or trigger_row.tgname ilike '%alias%'
    )
),
structure_indexes as (
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'tabla', table_cls.relname,
        'indice', index_cls.relname,
        'unico', index_row.indisunique,
        'primario', index_row.indisprimary,
        'columnas', coalesce(columns.data, '[]'::jsonb)
      )
      order by table_cls.relname, index_cls.relname
    ),
    '[]'::jsonb
  ) as data
  from pg_index index_row
  join pg_class table_cls
    on table_cls.oid = index_row.indrelid
  join pg_namespace ns
    on ns.oid = table_cls.relnamespace
  join pg_class index_cls
    on index_cls.oid = index_row.indexrelid
  left join lateral (
    select jsonb_agg(att.attname order by key_row.ordinalidad) as data
    from unnest(index_row.indkey)
      with ordinality as key_row(attnum, ordinalidad)
    join pg_attribute att
      on att.attrelid = table_cls.oid
     and att.attnum = key_row.attnum
  ) columns
    on true
  where ns.nspname = 'public'
    and table_cls.relname in (
      select tabla
      from related_tables
    )
),
structure_rls as (
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'tabla', cls.relname,
        'rls_habilitado', cls.relrowsecurity,
        'politica', policies.policyname,
        'cmd', policies.cmd,
        'roles', policies.roles
      )
      order by cls.relname, policies.policyname
    ),
    '[]'::jsonb
  ) as data
  from pg_class cls
  join pg_namespace ns
    on ns.oid = cls.relnamespace
  left join pg_policies policies
    on policies.schemaname = ns.nspname
   and policies.tablename = cls.relname
  where ns.nspname = 'public'
    and cls.relname in (
      select tabla
      from related_tables
    )
),
structure_previous as (
  select jsonb_build_object(
    'jugadores_nombre_normalizado', exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'jugadores'
        and column_name = 'nombre_normalizado'
    ),
    'jugadores_aliases', to_regclass('public.jugadores_aliases') is not null,
    'tp_normalizar_nombre_jugador', to_regprocedure(
      'public.tp_normalizar_nombre_jugador(text)'
    ) is not null,
    'columnas_relacionadas', (select data from structure_columns),
    'funciones_relacionadas', (select data from structure_functions),
    'triggers_relacionados', (select data from structure_triggers),
    'indices_relacionados', (select data from structure_indexes),
    'politicas_rls_relacionadas', (select data from structure_rls)
  ) as data
)
select jsonb_build_object(
  'metadata', jsonb_build_object(
    'generado_en', now(),
    'version_postgresql', version(),
    'esquema', 'public',
    'nombre_respaldo', 'identidad-jugadores-pre-aplicacion-manual-v1',
    'cantidades', (select data from counts),
    'privacidad', jsonb_build_object(
      'incluye_secretos', false,
      'incluye_connection_strings', false,
      'incluye_jwt', false
    )
  ),
  'jugadores', (select data from jugadores_data),
  'inscripciones_jugadores', (select data from inscripciones_data),
  'eventos_partido', (select data from eventos_data),
  'goleadores_oficiales', (select data from goleadores_data),
  'estructura_previa', (select data from structure_previous),
  'hashes', (select data from hashes)
) as backup_identidad_jugadores;

COMMIT;
