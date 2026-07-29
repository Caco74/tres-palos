-- Prevalidacion de identidad de jugadores.
-- Solo lectura. No modifica datos remotos.

with expected_columns(table_name, column_name) as (
  values
    ('torneos', 'id'),
    ('torneos', 'anio'),
    ('torneos', 'tipo'),
    ('torneos', 'nombre'),
    ('torneos', 'activo'),
    ('clubes', 'id'),
    ('clubes', 'nombre_oficial'),
    ('clubes', 'nombre_corto'),
    ('clubes', 'aliases'),
    ('clubes', 'activo'),
    ('partidos', 'id'),
    ('partidos', 'torneo_id'),
    ('partidos', 'local_id'),
    ('partidos', 'visitante_id'),
    ('partidos', 'goles_local'),
    ('partidos', 'goles_visitante'),
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
    ('eventos_partido', 'equipo'),
    ('eventos_partido', 'equipo_id'),
    ('eventos_partido', 'inscripcion_jugador_id'),
    ('eventos_partido', 'inscripcion_relacionada_id'),
    ('eventos_partido', 'jugador_relacionado'),
    ('eventos_partido', 'estado_dato')
),
actual_columns as (
  select table_name, column_name, data_type
  from information_schema.columns
  where table_schema = 'public'
),
missing_columns as (
  select expected.table_name, expected.column_name
  from expected_columns expected
  left join actual_columns actual
    on actual.table_name = expected.table_name
   and actual.column_name = expected.column_name
  where actual.column_name is null
),
table_presence as (
  select *
  from (
    values
      ('torneos', to_regclass('public.torneos') is not null),
      ('clubes', to_regclass('public.clubes') is not null),
      ('partidos', to_regclass('public.partidos') is not null),
      ('jugadores', to_regclass('public.jugadores') is not null),
      (
        'jugadores_aliases',
        to_regclass('public.jugadores_aliases') is not null
      ),
      (
        'inscripciones_jugadores',
        to_regclass('public.inscripciones_jugadores') is not null
      ),
      ('eventos_partido', to_regclass('public.eventos_partido') is not null),
      (
        'goleadores_oficiales',
        to_regclass('public.goleadores_oficiales') is not null
      )
  ) as item(tabla, existe)
),
constraints_relevantes as (
  select
    rel.relname as tabla,
    con.conname as constraint_name,
    con.contype as tipo,
    pg_get_constraintdef(con.oid) as definicion
  from pg_constraint con
  join pg_class rel
    on rel.oid = con.conrelid
  join pg_namespace ns
    on ns.oid = rel.relnamespace
  where ns.nspname = 'public'
    and rel.relname in (
      'jugadores',
      'jugadores_aliases',
      'inscripciones_jugadores',
      'eventos_partido'
    )
),
rls_relevante as (
  select
    cls.relname as tabla,
    cls.relrowsecurity as rls_habilitado,
    pol.policyname,
    pol.cmd,
    pol.roles
  from pg_class cls
  join pg_namespace ns
    on ns.oid = cls.relnamespace
  left join pg_policies pol
    on pol.schemaname = ns.nspname
   and pol.tablename = cls.relname
  where ns.nspname = 'public'
    and cls.relname in (
      'torneos',
      'clubes',
      'jugadores',
      'jugadores_aliases',
      'inscripciones_jugadores',
      'eventos_partido',
      'goleadores_oficiales'
    )
),
eventos_historicos as (
  select
    evento.*,
    partido.torneo_id,
    partido.local_id,
    partido.visitante_id,
    regexp_replace(
      regexp_replace(
        translate(
          lower(btrim(coalesce(evento.jugador, ''))),
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
    ) as jugador_normalizado
  from public.eventos_partido evento
  join public.partidos partido
    on partido.id = evento.partido_id
  where partido.torneo_id = 1
),
jugadores_base as (
  select
    jugador.id,
    jugador.nombre_completo,
    regexp_replace(
      regexp_replace(
        translate(
          lower(btrim(coalesce(jugador.nombre_completo, ''))),
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
    ) as nombre_normalizado
  from public.jugadores jugador
),
jugadores_alias_array as (
  select
    jugador.id as jugador_id,
    alias.alias,
    regexp_replace(
      regexp_replace(
        translate(
          lower(btrim(coalesce(alias.alias, ''))),
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
    ) as alias_normalizado
  from public.jugadores jugador
  cross join lateral unnest(coalesce(jugador.aliases, '{}'::text[])) alias(alias)
),
candidatos_evento as (
  select
    evento.id as evento_id,
    count(distinct inscripcion.id) filter (
      where btrim(evento.jugador) = jugador.nombre_completo
    ) as candidatos_exactos,
    count(distinct inscripcion.id) filter (
      where alias.alias_normalizado = evento.jugador_normalizado
    ) as candidatos_alias,
    count(distinct inscripcion.id) as candidatos_normalizados
  from eventos_historicos evento
  join public.inscripciones_jugadores inscripcion
    on inscripcion.torneo_id = evento.torneo_id
   and inscripcion.club_id in (
      evento.local_id,
      evento.visitante_id,
      evento.equipo_id
    )
  join jugadores_base jugador
    on jugador.id = inscripcion.jugador_id
  left join jugadores_alias_array alias
    on alias.jugador_id = jugador.id
  where evento.inscripcion_jugador_id is null
    and evento.jugador_normalizado <> ''
    and (
      jugador.nombre_normalizado = evento.jugador_normalizado
      or alias.alias_normalizado = evento.jugador_normalizado
    )
  group by evento.id
),
clasificacion_eventos as (
  select
    evento.id,
    evento.tipo,
    evento.jugador,
    evento.equipo_id,
    evento.equipo,
    evento.inscripcion_jugador_id,
    case
      when regexp_replace(
        lower(coalesce(evento.tipo, '')),
        '[-\s]+',
        '_',
        'g'
      ) not in (
        'gol',
        'gol_penal',
        'gol_en_contra',
        'amarilla',
        'doble_amarilla',
        'roja',
        'cambio'
      ) then 'evento_sin_jugador_aplicable'
      when evento.jugador_normalizado in (
        '',
        'jugador no informado',
        'sin informar',
        'no informado',
        'desconocido'
      ) then 'texto_vacio'
      when evento.inscripcion_jugador_id is not null then 'ya_vinculado'
      when coalesce(candidato.candidatos_exactos, 0) = 1
        then 'coincidencia_exacta_segura'
      when coalesce(candidato.candidatos_exactos, 0) > 1
        then 'ambiguo'
      when coalesce(candidato.candidatos_alias, 0) = 1
        then 'coincidencia_alias_confirmado'
      when coalesce(candidato.candidatos_alias, 0) > 1
        then 'ambiguo'
      when coalesce(candidato.candidatos_normalizados, 0) = 1
        then 'candidato_probable'
      when coalesce(candidato.candidatos_normalizados, 0) > 1
        then 'ambiguo'
      else 'sin_coincidencia'
    end as estado_dry_run
  from eventos_historicos evento
  left join candidatos_evento candidato
    on candidato.evento_id = evento.id
),
nombres_unicos as (
  select distinct
    btrim(jugador) as jugador,
    regexp_replace(
      regexp_replace(
        translate(
          lower(btrim(coalesce(jugador, ''))),
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
    ) as jugador_normalizado
  from eventos_historicos
  where btrim(coalesce(jugador, '')) <> ''
),
duplicados_normalizados as (
  select
    jugador_normalizado,
    array_agg(jugador order by jugador) as variantes,
    count(*) as variantes_total
  from nombres_unicos
  group by jugador_normalizado
  having count(*) > 1
),
homonimos_jugadores as (
  select
    nombre_normalizado,
    jsonb_agg(
      jsonb_build_object(
        'jugador_id',
        jugador.id,
        'nombre_completo',
        jugador.nombre_completo
      )
      order by jugador.id
    ) as jugadores,
    count(*) as total
  from jugadores_base jugador
  group by nombre_normalizado
  having count(*) > 1
),
resumen_eventos as (
  select
    count(*) as eventos_historicos,
    count(*) filter (
      where jugador is not null and btrim(jugador) <> ''
    ) as eventos_con_jugador_textual,
    count(distinct btrim(jugador)) filter (
      where jugador is not null and btrim(jugador) <> ''
    ) as nombres_unicos_exactos,
    count(distinct jugador_normalizado) filter (
      where jugador_normalizado <> ''
    ) as nombres_unicos_normalizados,
    count(*) filter (
      where lower(coalesce(tipo, '')) in ('gol_en_contra', 'autogol')
    ) as autogoles
  from eventos_historicos
)
select
  'tablas' as seccion,
  jsonb_agg(
    jsonb_build_object('tabla', tabla, 'existe', existe)
    order by tabla
  ) as detalle
from table_presence
union all
select
  'columnas_faltantes',
  coalesce(
    jsonb_agg(
      jsonb_build_object('tabla', table_name, 'columna', column_name)
      order by table_name, column_name
    ),
    '[]'::jsonb
  )
from missing_columns
union all
select
  'constraints',
  coalesce(
    jsonb_agg(to_jsonb(constraints_relevantes) order by tabla, constraint_name),
    '[]'::jsonb
  )
from constraints_relevantes
union all
select
  'rls',
  coalesce(
    jsonb_agg(to_jsonb(rls_relevante) order by tabla, policyname),
    '[]'::jsonb
  )
from rls_relevante
union all
select
  'resumen_apertura',
  to_jsonb(resumen_eventos)
from resumen_eventos
union all
select
  'clasificacion_dry_run',
  jsonb_object_agg(estado_dry_run, total order by estado_dry_run)
from (
  select estado_dry_run, count(*) as total
  from clasificacion_eventos
  group by estado_dry_run
) item
union all
select
  'distribucion_por_club',
  jsonb_object_agg(coalesce(club.nombre_corto, evento.equipo, 'sin_equipo'), total)
from (
  select equipo_id, equipo, count(*) as total
  from eventos_historicos
  group by equipo_id, equipo
) evento
left join public.clubes club
  on club.id = evento.equipo_id
union all
select
  'distribucion_por_torneo',
  jsonb_object_agg(torneo_id::text, total)
from (
  select torneo_id, count(*) as total
  from eventos_historicos
  group by torneo_id
) item
union all
select
  'duplicados_normalizados',
  coalesce(jsonb_agg(to_jsonb(duplicados_normalizados)), '[]'::jsonb)
from duplicados_normalizados
union all
select
  'homonimos_jugadores',
  coalesce(jsonb_agg(to_jsonb(homonimos_jugadores)), '[]'::jsonb)
from homonimos_jugadores
union all
select
  'autogoles',
  coalesce(
    jsonb_agg(
      jsonb_build_object(
        'evento_id',
        id,
        'tipo',
        tipo,
        'jugador',
        jugador,
        'equipo_id',
        equipo_id,
        'equipo',
        equipo,
        'estado_dry_run',
        estado_dry_run
      )
      order by id
    ),
    '[]'::jsonb
  )
from clasificacion_eventos
where lower(coalesce(tipo, '')) in ('gol_en_contra', 'autogol');
