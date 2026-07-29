-- Verificacion posterior de identidad de jugadores.
-- Solo lectura. Ejecutar despues de una aplicacion futura autorizada.
-- Devuelve una unica fila JSON facil de copiar.

BEGIN TRANSACTION READ ONLY;

with
expected_jugadores(
  id,
  nombre_completo,
  aliases,
  activo,
  creado_en,
  actualizado_en
) as (
  values
    (1, 'F. Pizzichini', array[]::text[], true, '2026-06-12T11:26:52.637263+00:00'::timestamptz, '2026-06-12T11:26:52.637263+00:00'::timestamptz),
    (2, 'Astrada', array[]::text[], true, '2026-06-12T11:27:26.082686+00:00'::timestamptz, '2026-06-12T11:27:26.082686+00:00'::timestamptz),
    (3, U&'B. Mart\00EDnez', array[]::text[], true, '2026-06-12T11:28:05.782942+00:00'::timestamptz, '2026-06-12T11:28:05.782942+00:00'::timestamptz),
    (4, 'Mora', array[]::text[], true, '2026-06-12T11:28:53.679659+00:00'::timestamptz, '2026-06-12T11:28:53.679659+00:00'::timestamptz),
    (5, 'Beloqui', array[]::text[], true, '2026-06-12T11:37:10.801369+00:00'::timestamptz, '2026-06-12T11:37:10.801369+00:00'::timestamptz),
    (6, 'Gimenez', array[]::text[], true, '2026-06-12T11:38:08.436016+00:00'::timestamptz, '2026-06-12T11:38:08.436016+00:00'::timestamptz),
    (7, 'Garino', array[]::text[], true, '2026-06-12T14:58:19.434626+00:00'::timestamptz, '2026-06-12T14:58:19.434626+00:00'::timestamptz),
    (8, 'Correa', array[]::text[], true, '2026-06-12T14:58:52.527021+00:00'::timestamptz, '2026-06-12T14:58:52.527021+00:00'::timestamptz),
    (9, 'Miramontes', array[]::text[], true, '2026-06-12T14:59:35.586344+00:00'::timestamptz, '2026-06-12T14:59:35.586344+00:00'::timestamptz),
    (10, 'Galindo', array[]::text[], true, '2026-06-13T09:00:04.220931+00:00'::timestamptz, '2026-06-13T09:00:04.220931+00:00'::timestamptz),
    (11, U&'S\00E1nchez', array[]::text[], true, '2026-06-13T09:00:25.780905+00:00'::timestamptz, '2026-06-13T09:00:25.780905+00:00'::timestamptz),
    (12, 'Cantiani', array[]::text[], true, '2026-06-13T09:01:21.034554+00:00'::timestamptz, '2026-06-13T09:01:21.034554+00:00'::timestamptz),
    (13, 'Angeleti', array[]::text[], true, '2026-06-13T09:01:39.827727+00:00'::timestamptz, '2026-06-13T09:01:39.827727+00:00'::timestamptz),
    (14, 'Bulgarelli', array[]::text[], true, '2026-06-13T09:02:03.567825+00:00'::timestamptz, '2026-06-13T09:02:03.567825+00:00'::timestamptz),
    (15, 'M. Aguero', array[]::text[], true, '2026-06-14T03:37:01.77564+00:00'::timestamptz, '2026-06-14T03:37:01.77564+00:00'::timestamptz),
    (16, 'Zeballos', array[]::text[], true, '2026-06-14T03:41:34.680151+00:00'::timestamptz, '2026-06-14T03:41:34.680151+00:00'::timestamptz),
    (17, 'Mauro Castellaro', array[]::text[], true, '2026-06-14T03:47:56.21513+00:00'::timestamptz, '2026-06-14T03:47:56.21513+00:00'::timestamptz),
    (18, U&'D\00EDaz', array[]::text[], true, '2026-06-14T20:16:40.978016+00:00'::timestamptz, '2026-06-14T20:16:40.978016+00:00'::timestamptz),
    (19, 'De Gasperi', array[]::text[], true, '2026-06-14T20:17:50.126326+00:00'::timestamptz, '2026-06-24T01:41:02.366083+00:00'::timestamptz),
    (20, 'Sarco', array[]::text[], true, '2026-06-14T20:18:28.853558+00:00'::timestamptz, '2026-06-14T20:18:28.853558+00:00'::timestamptz),
    (21, 'Sarco', array[]::text[], true, '2026-06-14T20:19:31.729971+00:00'::timestamptz, '2026-06-14T20:19:31.729971+00:00'::timestamptz),
    (22, 'Rojas', array[]::text[], true, '2026-06-14T20:20:11.938262+00:00'::timestamptz, '2026-06-14T20:20:11.938262+00:00'::timestamptz),
    (23, 'Godoy', array[]::text[], true, '2026-06-14T20:21:51.4032+00:00'::timestamptz, '2026-06-14T20:21:51.4032+00:00'::timestamptz),
    (24, 'Vitali', array[]::text[], true, '2026-06-14T20:22:40.669877+00:00'::timestamptz, '2026-06-14T20:22:40.669877+00:00'::timestamptz),
    (25, U&'S\00E1nchez', array[]::text[], true, '2026-06-14T20:23:19.969895+00:00'::timestamptz, '2026-06-14T20:23:19.969895+00:00'::timestamptz),
    (26, 'Zanabria', array[]::text[], true, '2026-06-14T23:15:20.295021+00:00'::timestamptz, '2026-06-14T23:15:20.295021+00:00'::timestamptz),
    (27, 'Joel Barrios', array[]::text[], true, '2026-06-14T23:23:31.650422+00:00'::timestamptz, '2026-06-14T23:23:31.650422+00:00'::timestamptz)
),
expected_inscripciones(
  id,
  jugador_id,
  club_id,
  torneo_id,
  dorsal,
  estado
) as (
  values
    (1, 1, 43, 1, null::integer, 'confirmado'),
    (2, 2, 43, 1, null::integer, 'confirmado'),
    (3, 3, 43, 1, null::integer, 'confirmado'),
    (4, 4, 50, 1, null::integer, 'confirmado'),
    (5, 5, 55, 1, null::integer, 'confirmado'),
    (6, 6, 55, 1, null::integer, 'confirmado'),
    (7, 7, 55, 1, null::integer, 'confirmado'),
    (8, 8, 49, 1, null::integer, 'confirmado'),
    (9, 9, 49, 1, null::integer, 'confirmado'),
    (10, 10, 53, 1, null::integer, 'confirmado'),
    (11, 11, 45, 1, null::integer, 'confirmado'),
    (12, 12, 57, 1, null::integer, 'confirmado'),
    (13, 13, 57, 1, null::integer, 'confirmado'),
    (14, 14, 57, 1, null::integer, 'confirmado'),
    (15, 15, 55, 1, null::integer, 'confirmado'),
    (16, 16, 48, 1, null::integer, 'confirmado'),
    (17, 17, 48, 1, null::integer, 'confirmado'),
    (18, 18, 55, 1, null::integer, 'confirmado'),
    (19, 19, 57, 1, null::integer, 'confirmado'),
    (20, 20, 57, 1, null::integer, 'confirmado'),
    (21, 21, 48, 1, null::integer, 'confirmado'),
    (22, 22, 48, 1, null::integer, 'confirmado'),
    (23, 23, 48, 1, null::integer, 'por_verificar'),
    (24, 24, 43, 1, null::integer, 'confirmado'),
    (25, 25, 57, 1, null::integer, 'confirmado'),
    (26, 26, 57, 1, null::integer, 'confirmado'),
    (27, 27, 43, 1, null::integer, 'confirmado')
),
expected_eventos_tipos(tipo, total) as (
  values
    ('gol', 363),
    ('gol_en_contra', 1),
    ('gol_penal', 1),
    ('roja', 3)
),
expected_goleadores(id, torneo_id, posicion, equipo_id, jugador_nombre, goles) as (
  values
    (17, 1, 1, 47, 'TOMBOLINI CARLOS DAMIAN', 13),
    (18, 1, 2, 47, 'CARRIZO LAUREANO JOAQUIN', 9),
    (19, 1, 3, 43, 'MARTINEZ BRIAN ALEJANDRO', 9),
    (20, 1, 4, 46, 'BORINI JULIO CESAR', 7)
),
normalizacion_pruebas(caso, entrada, esperado) as (
  values
    ('tilde_punto_doble_espacio', U&'JOAQU\00CDN  CARRIZO.', 'joaquin carrizo'),
    ('inicial_punto_espacios', ' J. Carrizo ', 'j carrizo'),
    ('espacios_interiores', U&'Joaqu\00EDn     Carrizo', 'joaquin carrizo'),
    ('punto_final', U&'Joaqu\00EDn Carrizo.', 'joaquin carrizo'),
    ('punto_inicial', U&'.Joaqu\00EDn Carrizo', 'joaquin carrizo'),
    ('solo_espacios', '     ', null::text),
    ('texto_vacio', '', null::text),
    ('null', null::text, null::text),
    ('estable', 'joaquin carrizo', 'joaquin carrizo')
),
normalizacion_resultados as (
  select
    caso,
    public.tp_normalizar_nombre_jugador(entrada) as resultado,
    esperado,
    public.tp_normalizar_nombre_jugador(
      public.tp_normalizar_nombre_jugador(entrada)
    ) as resultado_repetido
  from normalizacion_pruebas
),
jugadores_diferencias as (
  select count(*) as total
  from expected_jugadores expected
  full join public.jugadores actual
    on actual.id = expected.id
  where actual.id is null
     or expected.id is null
     or actual.nombre_completo is distinct from expected.nombre_completo
     or coalesce(actual.aliases, array[]::text[]) is distinct from expected.aliases
     or actual.activo is distinct from expected.activo
     or actual.creado_en is distinct from expected.creado_en
     or actual.actualizado_en is distinct from expected.actualizado_en
),
inscripciones_diferencias as (
  select count(*) as total
  from expected_inscripciones expected
  full join public.inscripciones_jugadores actual
    on actual.id = expected.id
  where actual.id is null
     or expected.id is null
     or actual.jugador_id is distinct from expected.jugador_id
     or actual.club_id is distinct from expected.club_id
     or actual.torneo_id is distinct from expected.torneo_id
     or actual.dorsal is distinct from expected.dorsal
     or actual.estado is distinct from expected.estado
),
eventos_por_tipo as (
  select tipo, count(*) as total
  from public.eventos_partido
  group by tipo
),
eventos_tipos_diferencias as (
  select (
    (
      select count(*)
      from (
        select tipo, total from expected_eventos_tipos
        except
        select tipo, total::integer from eventos_por_tipo
      ) faltante
    )
    +
    (
      select count(*)
      from (
        select tipo, total::integer from eventos_por_tipo
        except
        select tipo, total from expected_eventos_tipos
      ) sobrante
    )
  ) as total
),
eventos_referencias_rotas as (
  select count(*) as total
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
    )
),
goleadores_diferencias as (
  select count(*) as total
  from expected_goleadores expected
  full join public.goleadores_oficiales actual
    on actual.id = expected.id
  where actual.id is null
     or expected.id is null
     or actual.torneo_id is distinct from expected.torneo_id
     or actual.posicion is distinct from expected.posicion
     or actual.equipo_id is distinct from expected.equipo_id
     or actual.jugador_nombre is distinct from expected.jugador_nombre
     or actual.goles is distinct from expected.goles
),
aliases_desde_array as (
  select
    count(*) as valores_total,
    count(*) filter (where btrim(coalesce(alias.alias, '')) = '') as valores_vacios,
    count(*) filter (
      where btrim(coalesce(alias.alias, '')) <> ''
        and public.tp_normalizar_nombre_jugador(alias.alias) is not null
    ) as valores_validos
  from public.jugadores jugador
  cross join lateral unnest(coalesce(jugador.aliases, array[]::text[])) alias(alias)
),
checks as (
  select
    'jugadores_total_27' as chequeo,
    (select count(*) from public.jugadores) = 27 as ok,
    (select count(*)::text from public.jugadores) as detalle
  union all
  select
    'jugadores_normalizados_27',
    (
      select count(*)
      from public.jugadores
      where nombre_normalizado is not null
        and btrim(nombre_normalizado) <> ''
    ) = 27,
    (
      select count(*)::text
      from public.jugadores
      where nombre_normalizado is not null
        and btrim(nombre_normalizado) <> ''
    )
  union all
  select
    'jugadores_originales_sin_cambios',
    (select total from jugadores_diferencias) = 0,
    (select total::text from jugadores_diferencias)
  union all
  select
    'homonimos_sanchez_preservados',
    (
      select array_agg(id order by id)
      from public.jugadores
      where public.tp_normalizar_nombre_jugador(nombre_completo) = 'sanchez'
    ) = array[11::bigint, 25::bigint],
    'ids 11 y 25'
  union all
  select
    'homonimos_sarco_preservados',
    (
      select array_agg(id order by id)
      from public.jugadores
      where public.tp_normalizar_nombre_jugador(nombre_completo) = 'sarco'
    ) = array[20::bigint, 21::bigint],
    'ids 20 y 21'
  union all
  select
    'sin_unique_global_nombre_normalizado',
    not exists (
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
    ),
    'nombre_normalizado no es identidad unica global'
  union all
  select
    'normalizacion_pruebas_ok',
    not exists (
      select 1
      from normalizacion_resultados
      where resultado is distinct from esperado
         or resultado_repetido is distinct from esperado
    ),
    coalesce((
      select jsonb_agg(to_jsonb(normalizacion_resultados))::text
      from normalizacion_resultados
      where resultado is distinct from esperado
         or resultado_repetido is distinct from esperado
    ), '[]')
  union all
  select
    'inscripciones_total_27',
    (select count(*) from public.inscripciones_jugadores) = 27,
    (select count(*)::text from public.inscripciones_jugadores)
  union all
  select
    'inscripciones_sin_cambios',
    (select total from inscripciones_diferencias) = 0,
    (select total::text from inscripciones_diferencias)
  union all
  select
    'inscripciones_referencias_rotas_0',
    not exists (
      select 1
      from public.inscripciones_jugadores inscripcion
      where not exists (
          select 1 from public.jugadores jugador
          where jugador.id = inscripcion.jugador_id
        )
        or not exists (
          select 1 from public.clubes club
          where club.id = inscripcion.club_id
        )
        or not exists (
          select 1 from public.torneos torneo
          where torneo.id = inscripcion.torneo_id
        )
    ),
    '0'
  union all
  select
    'inscripciones_duplicados_0',
    not exists (
      select 1
      from public.inscripciones_jugadores
      group by jugador_id, club_id, torneo_id
      having count(*) > 1
    ),
    '0'
  union all
  select
    'eventos_total_368',
    (select count(*) from public.eventos_partido) = 368,
    (select count(*)::text from public.eventos_partido)
  union all
  select
    'eventos_vinculados_60',
    (
      select count(*)
      from public.eventos_partido
      where inscripcion_jugador_id is not null
    ) = 60,
    (
      select count(*)::text
      from public.eventos_partido
      where inscripcion_jugador_id is not null
    )
  union all
  select
    'eventos_pendientes_308',
    (
      select count(*)
      from public.eventos_partido
      where inscripcion_jugador_id is null
    ) = 308,
    (
      select count(*)::text
      from public.eventos_partido
      where inscripcion_jugador_id is null
    )
  union all
  select
    'eventos_texto_historico_368',
    (
      select count(*)
      from public.eventos_partido
      where btrim(coalesce(jugador, '')) <> ''
    ) = 368,
    (
      select count(*)::text
      from public.eventos_partido
      where btrim(coalesce(jugador, '')) <> ''
    )
  union all
  select
    'eventos_referencias_rotas_0',
    (select total from eventos_referencias_rotas) = 0,
    (select total::text from eventos_referencias_rotas)
  union all
  select
    'eventos_tipos_sin_cambios',
    (select total from eventos_tipos_diferencias) = 0,
    (select total::text from eventos_tipos_diferencias)
  union all
  select
    'autogol_historico_preservado',
    (
      select count(*)
      from public.eventos_partido
      where tipo = 'gol_en_contra'
        and jugador = 'ANGELETTI JOAQUIN'
    ) = 1,
    'ANGELETTI JOAQUIN'
  union all
  select
    'goleadores_oficiales_total_4',
    (select count(*) from public.goleadores_oficiales) = 4,
    (select count(*)::text from public.goleadores_oficiales)
  union all
  select
    'goleadores_oficiales_sin_cambios',
    (select total from goleadores_diferencias) = 0,
    (select total::text from goleadores_diferencias)
  union all
  select
    'estructura_nombre_normalizado',
    exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'jugadores'
        and column_name = 'nombre_normalizado'
    ),
    'public.jugadores.nombre_normalizado'
  union all
  select
    'estructura_funcion_normalizacion',
    to_regprocedure('public.tp_normalizar_nombre_jugador(text)') is not null,
    'public.tp_normalizar_nombre_jugador(text)'
  union all
  select
    'estructura_aliases',
    to_regclass('public.jugadores_aliases') is not null,
    'public.jugadores_aliases'
  union all
  select
    'aliases_desde_array_0',
    (select valores_validos from aliases_desde_array) = 0,
    (select valores_validos::text from aliases_desde_array)
  union all
  select
    'aliases_filas_0',
    (select count(*) from public.jugadores_aliases) = 0,
    (select count(*)::text from public.jugadores_aliases)
  union all
  select
    'triggers_esperados',
    (
      select count(*)
      from pg_trigger trigger_row
      where trigger_row.tgname in (
          'jugadores_normalizar_nombre',
          'jugadores_aliases_normalizar',
          'eventos_partido_validar_inscripcion_jugador'
        )
        and not trigger_row.tgisinternal
    ) = 3,
    '3'
  union all
  select
    'indices_esperados',
    (
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
    ) = 8,
    '8'
  union all
  select
    'rls_aliases_habilitado',
    coalesce((
      select relrowsecurity
      from pg_class cls
      join pg_namespace ns
        on ns.oid = cls.relnamespace
      where ns.nspname = 'public'
        and cls.relname = 'jugadores_aliases'
    ), false),
    'RLS en jugadores_aliases'
  union all
  select
    'sin_lectura_publica_aliases',
    not exists (
      select 1
      from information_schema.role_table_grants grant_row
      where grant_row.table_schema = 'public'
        and grant_row.table_name = 'jugadores_aliases'
        and grant_row.grantee in ('anon', 'authenticated', 'public')
        and grant_row.privilege_type = 'SELECT'
    ),
    'anon/authenticated/public sin SELECT directo'
  union all
  select
    'sin_escritura_publica_aliases',
    not exists (
      select 1
      from information_schema.role_table_grants grant_row
      where grant_row.table_schema = 'public'
        and grant_row.table_name = 'jugadores_aliases'
        and grant_row.grantee in ('anon', 'authenticated', 'public')
        and grant_row.privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')
    ),
    'anon/authenticated/public sin escrituras directas'
)
select jsonb_build_object(
  'ok',
  (select bool_and(ok) from checks),
  'fecha_verificacion',
  now(),
  'checks',
  (
    select jsonb_agg(
      jsonb_build_object(
        'chequeo',
        chequeo,
        'ok',
        ok,
        'detalle',
        detalle
      )
      order by chequeo
    )
    from checks
  ),
  'resumen',
  jsonb_build_object(
    'jugadores_total', (select count(*) from public.jugadores),
    'jugadores_normalizados', (
      select count(*)
      from public.jugadores
      where nombre_normalizado is not null
        and btrim(nombre_normalizado) <> ''
    ),
    'inscripciones_total', (
      select count(*) from public.inscripciones_jugadores
    ),
    'eventos_total', (select count(*) from public.eventos_partido),
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
    'goleadores_oficiales_total', (
      select count(*) from public.goleadores_oficiales
    ),
    'aliases_desde_array_validos', (
      select valores_validos from aliases_desde_array
    ),
    'aliases_filas', (
      select count(*) from public.jugadores_aliases
    )
  )
) as verificacion_identidad_jugadores;

COMMIT;
