-- Prevalidacion manual de identidad de jugadores.
--
-- Entorno esperado: Supabase produccion.
-- Ejecucion: copiar y ejecutar manualmente desde Supabase SQL Editor.
-- Alcance: consultas de solo lectura dentro de una transaccion READ ONLY.
--
-- No aplicar el SQL de migracion desde este archivo.
-- No copiar claves, JWT, connection strings ni secretos en informes o logs.
-- El resultado final es una unica fila con una columna JSON:
--   prevalidacion_identidad_jugadores

BEGIN TRANSACTION READ ONLY;

with
entorno as (
  select jsonb_build_object(
    'fecha_ejecucion', now(),
    'version_postgresql', version(),
    'esquema_consultado', 'public',
    'entorno_esperado', 'Supabase produccion',
    'ejecucion', 'Manual desde Supabase SQL Editor',
    'modo', 'BEGIN TRANSACTION READ ONLY',
    'escrituras_remotas', 0
  ) as data
),
tables_expected(tabla) as (
  values
    ('jugadores'),
    ('inscripciones_jugadores'),
    ('eventos_partido'),
    ('goleadores_oficiales')
),
tables_presence as (
  select
    expected.tabla,
    to_regclass('public.' || expected.tabla) is not null as existe
  from tables_expected expected
),
columns_relevant(tabla, columna) as (
  values
    ('jugadores', 'id'),
    ('jugadores', 'nombre_completo'),
    ('jugadores', 'nombre_normalizado'),
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
    ('inscripciones_jugadores', 'fecha_desde'),
    ('inscripciones_jugadores', 'fecha_hasta'),
    ('eventos_partido', 'id'),
    ('eventos_partido', 'partido_id'),
    ('eventos_partido', 'tipo'),
    ('eventos_partido', 'jugador'),
    ('eventos_partido', 'equipo'),
    ('eventos_partido', 'equipo_id'),
    ('eventos_partido', 'inscripcion_jugador_id'),
    ('eventos_partido', 'inscripcion_relacionada_id'),
    ('eventos_partido', 'jugador_relacionado'),
    ('eventos_partido', 'estado_dato'),
    ('eventos_partido', 'fuente'),
    ('eventos_partido', 'observaciones'),
    ('eventos_partido', 'orden'),
    ('eventos_partido', 'periodo'),
    ('eventos_partido', 'minuto'),
    ('goleadores_oficiales', 'id'),
    ('goleadores_oficiales', 'torneo_id'),
    ('goleadores_oficiales', 'posicion'),
    ('goleadores_oficiales', 'equipo_id'),
    ('goleadores_oficiales', 'equipo_nombre'),
    ('goleadores_oficiales', 'jugador_nombre'),
    ('goleadores_oficiales', 'goles'),
    ('goleadores_oficiales', 'fuente')
),
columns_catalog as (
  select
    col.table_name as tabla,
    col.column_name as columna,
    col.data_type,
    col.udt_name,
    col.is_nullable,
    col.column_default,
    col.ordinal_position
  from information_schema.columns col
  join columns_relevant relevant
    on relevant.tabla = col.table_name
   and relevant.columna = col.column_name
  where col.table_schema = 'public'
),
columns_json as (
  select
    presence.tabla,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'columna', catalog.columna,
          'data_type', catalog.data_type,
          'udt_name', catalog.udt_name,
          'nullable', catalog.is_nullable,
          'default', catalog.column_default
        )
        order by catalog.ordinal_position
      ) filter (where catalog.columna is not null),
      '[]'::jsonb
    ) as data
  from tables_presence presence
  left join columns_catalog catalog
    on catalog.tabla = presence.tabla
  group by presence.tabla
),
constraints_catalog as (
  select
    cls.relname as tabla,
    con.conname as nombre,
    con.contype as tipo,
    coalesce((
      select jsonb_agg(att.attname::text order by key_row.ordinalidad)
      from unnest(con.conkey) with ordinality as key_row(attnum, ordinalidad)
      join pg_attribute att
        on att.attrelid = con.conrelid
       and att.attnum = key_row.attnum
    ), '[]'::jsonb) as columnas,
    referenced_cls.relname as tabla_referenciada,
    coalesce((
      select jsonb_agg(att.attname::text order by key_row.ordinalidad)
      from unnest(con.confkey) with ordinality as key_row(attnum, ordinalidad)
      join pg_attribute att
        on att.attrelid = con.confrelid
       and att.attnum = key_row.attnum
    ), '[]'::jsonb) as columnas_referenciadas,
    case con.confdeltype
      when 'a' then 'no_action'
      when 'r' then 'restrict'
      when 'c' then 'cascade'
      when 'n' then 'set_null'
      when 'd' then 'set_default'
      else null
    end as accion_borrado,
    case con.confupdtype
      when 'a' then 'no_action'
      when 'r' then 'restrict'
      when 'c' then 'cascade'
      when 'n' then 'set_null'
      when 'd' then 'set_default'
      else null
    end as accion_actualizacion
  from pg_constraint con
  join pg_class cls
    on cls.oid = con.conrelid
  join pg_namespace ns
    on ns.oid = cls.relnamespace
  left join pg_class referenced_cls
    on referenced_cls.oid = con.confrelid
  where ns.nspname = 'public'
    and cls.relname in (
      'jugadores',
      'inscripciones_jugadores',
      'eventos_partido',
      'goleadores_oficiales',
      'jugadores_aliases'
    )
),
constraints_json as (
  select
    tabla,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'nombre', nombre,
          'tipo', tipo,
          'columnas', columnas,
          'tabla_referenciada', tabla_referenciada,
          'columnas_referenciadas', columnas_referenciadas,
          'accion_borrado', accion_borrado,
          'accion_actualizacion', accion_actualizacion
        )
        order by nombre
      ),
      '[]'::jsonb
    ) as data
  from constraints_catalog
  group by tabla
),
indexes_catalog as (
  select
    table_cls.relname as tabla,
    index_cls.relname as nombre,
    index_row.indisprimary as es_primario,
    index_row.indisunique as es_unico,
    index_row.indisvalid as es_valido,
    coalesce(
      jsonb_agg(att.attname::text order by index_key.ordinalidad)
        filter (where att.attname is not null),
      '[]'::jsonb
    ) as columnas,
    index_row.indpred is not null as tiene_filtro
  from pg_index index_row
  join pg_class table_cls
    on table_cls.oid = index_row.indrelid
  join pg_namespace ns
    on ns.oid = table_cls.relnamespace
  join pg_class index_cls
    on index_cls.oid = index_row.indexrelid
  left join lateral unnest(index_row.indkey)
    with ordinality as index_key(attnum, ordinalidad)
    on true
  left join pg_attribute att
    on att.attrelid = table_cls.oid
   and att.attnum = index_key.attnum
  where ns.nspname = 'public'
    and table_cls.relname in (
      'jugadores',
      'inscripciones_jugadores',
      'eventos_partido',
      'goleadores_oficiales',
      'jugadores_aliases'
    )
  group by
    table_cls.relname,
    index_cls.relname,
    index_row.indisprimary,
    index_row.indisunique,
    index_row.indisvalid,
    index_row.indpred
),
indexes_json as (
  select
    tabla,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'nombre', nombre,
          'es_primario', es_primario,
          'es_unico', es_unico,
          'es_valido', es_valido,
          'columnas', columnas,
          'tiene_filtro', tiene_filtro
        )
        order by nombre
      ),
      '[]'::jsonb
    ) as data
  from indexes_catalog
  group by tabla
),
rls_catalog as (
  select
    cls.relname as tabla,
    cls.relrowsecurity as rls_habilitado,
    pol.policyname as politica,
    pol.cmd,
    pol.roles,
    pol.qual,
    pol.with_check
  from pg_class cls
  join pg_namespace ns
    on ns.oid = cls.relnamespace
  left join pg_policies pol
    on pol.schemaname = ns.nspname
   and pol.tablename = cls.relname
  where ns.nspname = 'public'
    and cls.relname in (
      'jugadores',
      'inscripciones_jugadores',
      'eventos_partido',
      'goleadores_oficiales',
      'jugadores_aliases'
    )
),
rls_json as (
  select
    tabla,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'rls_habilitado', rls_habilitado,
          'politica', politica,
          'cmd', cmd,
          'roles', roles,
          'using', qual,
          'with_check', with_check
        )
        order by politica nulls first
      ),
      jsonb_build_array(
        jsonb_build_object(
          'rls_habilitado',
          bool_or(rls_habilitado),
          'politica',
          null
        )
      )
    ) as data
  from rls_catalog
  group by tabla
),
normalize_probe as (
  select
    nullif(btrim(
      regexp_replace(
        regexp_replace(
          translate(
            lower(btrim(coalesce(U&'JOAQU\00CDN  CARRIZO.', ''))),
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
    ) as ejemplo_normalizado
),
jugadores_base as (
  select
    jugador.id,
    jugador.nombre_completo,
    jugador.activo,
    nullif(btrim(coalesce(jugador.nombre_completo, '')), '') as nombre_limpio,
    nullif(btrim(
      regexp_replace(
        regexp_replace(
          translate(
            lower(btrim(coalesce(jugador.nombre_completo, ''))),
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
    ) as nombre_normalizado_calculado
  from public.jugadores jugador
),
jugadores_duplicados_exactos as (
  select
    nombre_limpio,
    count(*) as total,
    (array_agg(id order by id))[1:10] as ids_muestra
  from jugadores_base
  where nombre_limpio is not null
  group by nombre_limpio
  having count(*) > 1
),
jugadores_duplicados_normalizados as (
  select
    nombre_normalizado_calculado,
    count(*) as total,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id',
          id,
          'nombre_completo',
          nombre_completo
        )
        order by id
      ) filter (where rn_nombre <= 10),
      '[]'::jsonb
    ) as jugadores_muestra
  from (
    select
      base.*,
      row_number() over (
        partition by nombre_normalizado_calculado
        order by id
      ) as rn_nombre
    from jugadores_base base
    where nombre_normalizado_calculado is not null
  ) ranked
  where nombre_normalizado_calculado is not null
  group by nombre_normalizado_calculado
  having count(*) > 1
),
jugadores_resumen as (
  select jsonb_build_object(
    'tabla_existe', to_regclass('public.jugadores') is not null,
    'columnas', coalesce((select data from columns_json where tabla = 'jugadores'), '[]'::jsonb),
    'cantidad_total', count(*),
    'activos', count(*) filter (where activo is true),
    'inactivos', count(*) filter (where activo is false),
    'nombres_vacios', count(*) filter (where nombre_limpio is null),
    'nombres_duplicados_exactos', (
      select jsonb_build_object(
        'cantidad_grupos',
        count(*),
        'muestra',
        coalesce(
          jsonb_agg(
            jsonb_build_object(
              'nombre_completo',
              nombre_limpio,
              'total',
              total,
              'ids_muestra',
              ids_muestra
            )
            order by total desc, nombre_limpio
          ) filter (where rn <= 10),
          '[]'::jsonb
        )
      )
      from (
        select
          duplicated.*,
          row_number() over (order by total desc, nombre_limpio) as rn
        from jugadores_duplicados_exactos duplicated
      ) item
    ),
    'candidatos_duplicados_normalizados', (
      select jsonb_build_object(
        'cantidad_grupos',
        count(*),
        'muestra',
        coalesce(
          jsonb_agg(
            jsonb_build_object(
              'nombre_normalizado',
              nombre_normalizado_calculado,
              'total',
              total,
              'jugadores_muestra',
              jugadores_muestra
            )
            order by total desc, nombre_normalizado_calculado
          ) filter (where rn <= 10),
          '[]'::jsonb
        )
      )
      from (
        select
          duplicated.*,
          row_number() over (
            order by total desc, nombre_normalizado_calculado
          ) as rn
        from jugadores_duplicados_normalizados duplicated
      ) item
    ),
    'indices', coalesce((select data from indexes_json where tabla = 'jugadores'), '[]'::jsonb),
    'restricciones', coalesce((select data from constraints_json where tabla = 'jugadores'), '[]'::jsonb),
    'politicas_rls', coalesce((select data from rls_json where tabla = 'jugadores'), '[]'::jsonb)
  ) as data
  from jugadores_base
),
inscripciones_base as (
  select *
  from public.inscripciones_jugadores
),
inscripciones_por_torneo as (
  select
    torneo_id,
    count(*) as total
  from inscripciones_base
  group by torneo_id
),
inscripciones_por_club as (
  select
    club_id,
    torneo_id,
    count(*) as total
  from inscripciones_base
  group by club_id, torneo_id
),
inscripciones_duplicadas as (
  select
    jugador_id,
    club_id,
    torneo_id,
    count(*) as total,
    (array_agg(id order by id))[1:10] as ids_muestra
  from inscripciones_base
  group by jugador_id, club_id, torneo_id
  having count(*) > 1
),
cambios_club_torneos as (
  select
    jugador_id,
    count(distinct torneo_id) as torneos,
    count(distinct club_id) as clubes,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'inscripcion_id',
          id,
          'torneo_id',
          torneo_id,
          'club_id',
          club_id
        )
        order by torneo_id, club_id, id
      ) filter (where rn_inscripcion <= 10),
      '[]'::jsonb
    ) as inscripciones_muestra
  from (
    select
      inscripcion.*,
      row_number() over (
        partition by jugador_id
        order by torneo_id, club_id, id
      ) as rn_inscripcion
    from inscripciones_base inscripcion
  ) ranked
  group by jugador_id
  having count(distinct torneo_id) > 1
     and count(distinct club_id) > 1
),
inscripciones_resumen as (
  select jsonb_build_object(
    'tabla_existe', to_regclass('public.inscripciones_jugadores') is not null,
    'columnas', coalesce((select data from columns_json where tabla = 'inscripciones_jugadores'), '[]'::jsonb),
    'cantidad_total', count(*),
    'cantidad_por_torneo', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'torneo_id',
            torneo_id,
            'total',
            total
          )
          order by torneo_id
        ),
        '[]'::jsonb
      )
      from inscripciones_por_torneo
    ),
    'cantidad_por_club', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'club_id',
            club_id,
            'torneo_id',
            torneo_id,
            'total',
            total
          )
          order by torneo_id, club_id
        ),
        '[]'::jsonb
      )
      from inscripciones_por_club
    ),
    'referencias_incompletas', jsonb_build_object(
      'sin_jugador_id',
      count(*) filter (where jugador_id is null),
      'sin_club_id',
      count(*) filter (where club_id is null),
      'sin_torneo_id',
      count(*) filter (where torneo_id is null)
    ),
    'referencias_rotas', jsonb_build_object(
      'jugador_inexistente',
      count(*) filter (
        where jugador_id is not null
          and not exists (
            select 1
            from public.jugadores jugador
            where jugador.id = inscripciones_base.jugador_id
          )
      ),
      'club_inexistente',
      count(*) filter (
        where club_id is not null
          and not exists (
            select 1
            from public.clubes club
            where club.id = inscripciones_base.club_id
          )
      ),
      'torneo_inexistente',
      count(*) filter (
        where torneo_id is not null
          and not exists (
            select 1
            from public.torneos torneo
            where torneo.id = inscripciones_base.torneo_id
          )
      )
    ),
    'duplicados', (
      select jsonb_build_object(
        'cantidad_grupos',
        count(*),
        'muestra',
        coalesce(
          jsonb_agg(
            jsonb_build_object(
              'jugador_id',
              jugador_id,
              'club_id',
              club_id,
              'torneo_id',
              torneo_id,
              'total',
              total,
              'ids_muestra',
              ids_muestra
            )
            order by total desc, jugador_id, club_id, torneo_id
          ) filter (where rn <= 10),
          '[]'::jsonb
        )
      )
      from (
        select
          duplicated.*,
          row_number() over (
            order by total desc, jugador_id, club_id, torneo_id
          ) as rn
        from inscripciones_duplicadas duplicated
      ) item
    ),
    'posibles_cambios_club_entre_torneos', (
      select jsonb_build_object(
        'cantidad_jugadores',
        count(*),
        'muestra',
        coalesce(
          jsonb_agg(
            jsonb_build_object(
              'jugador_id',
              jugador_id,
              'torneos',
              torneos,
              'clubes',
              clubes,
              'inscripciones_muestra',
              inscripciones_muestra
            )
            order by jugador_id
          ) filter (where rn <= 10),
          '[]'::jsonb
        )
      )
      from (
        select
          cambios.*,
          row_number() over (order by jugador_id) as rn
        from cambios_club_torneos cambios
      ) item
    ),
    'claves_foraneas', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'nombre',
          nombre,
          'columnas',
          columnas,
          'tabla_referenciada',
          tabla_referenciada,
          'columnas_referenciadas',
          columnas_referenciadas,
          'accion_borrado',
          accion_borrado,
          'accion_actualizacion',
          accion_actualizacion
        )
        order by nombre
      )
      from constraints_catalog
      where tabla = 'inscripciones_jugadores'
        and tipo = 'f'
    ), '[]'::jsonb),
    'restriccion_unica', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'nombre',
          nombre,
          'tipo',
          tipo,
          'columnas',
          columnas
        )
        order by nombre
      )
      from constraints_catalog
      where tabla = 'inscripciones_jugadores'
        and tipo in ('u', 'p')
    ), '[]'::jsonb),
    'indices', coalesce((select data from indexes_json where tabla = 'inscripciones_jugadores'), '[]'::jsonb),
    'politicas_rls', coalesce((select data from rls_json where tabla = 'inscripciones_jugadores'), '[]'::jsonb)
  ) as data
  from inscripciones_base
),
eventos_base as (
  select
    evento.*,
    partido.torneo_id,
    partido.local_id,
    partido.visitante_id
  from public.eventos_partido evento
  left join public.partidos partido
    on partido.id = evento.partido_id
),
eventos_por_torneo as (
  select
    coalesce(torneo_id::text, 'sin_torneo') as torneo_id,
    count(*) as total
  from eventos_base
  group by coalesce(torneo_id::text, 'sin_torneo')
),
eventos_tipos as (
  select
    coalesce(tipo, 'sin_tipo') as tipo,
    count(*) as total
  from eventos_base
  group by coalesce(tipo, 'sin_tipo')
),
eventos_autogoles as (
  select
    id,
    partido_id,
    tipo,
    jugador,
    equipo_id,
    equipo,
    torneo_id
  from eventos_base
  where lower(coalesce(tipo, '')) in ('gol_en_contra', 'autogol')
     or lower(coalesce(tipo, '')) like '%contra%'
     or lower(coalesce(tipo, '')) like '%autogol%'
),
eventos_resumen as (
  select jsonb_build_object(
    'tabla_existe', to_regclass('public.eventos_partido') is not null,
    'columnas', coalesce((select data from columns_json where tabla = 'eventos_partido'), '[]'::jsonb),
    'cantidad_total', count(*),
    'cantidad_por_torneo', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'torneo_id',
            torneo_id,
            'total',
            total
          )
          order by torneo_id
        ),
        '[]'::jsonb
      )
      from eventos_por_torneo
    ),
    'con_texto_jugador',
      count(*) filter (where btrim(coalesce(jugador, '')) <> ''),
    'sin_texto_jugador',
      count(*) filter (where btrim(coalesce(jugador, '')) = ''),
    'con_inscripcion_jugador_id',
      count(*) filter (where inscripcion_jugador_id is not null),
    'sin_inscripcion_jugador_id',
      count(*) filter (where inscripcion_jugador_id is null),
    'referencias_rotas', jsonb_build_object(
      'partido_inexistente',
      count(*) filter (where partido_id is not null and torneo_id is null),
      'inscripcion_jugador_inexistente',
      count(*) filter (
        where inscripcion_jugador_id is not null
          and not exists (
            select 1
            from public.inscripciones_jugadores inscripcion
            where inscripcion.id = eventos_base.inscripcion_jugador_id
          )
      ),
      'inscripcion_relacionada_inexistente',
      count(*) filter (
        where inscripcion_relacionada_id is not null
          and not exists (
            select 1
            from public.inscripciones_jugadores inscripcion
            where inscripcion.id = eventos_base.inscripcion_relacionada_id
          )
      ),
      'equipo_inexistente',
      count(*) filter (
        where equipo_id is not null
          and not exists (
            select 1
            from public.clubes club
            where club.id = eventos_base.equipo_id
          )
      )
    ),
    'tipos_de_eventos', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'tipo',
            tipo,
            'total',
            total
          )
          order by tipo
        ),
        '[]'::jsonb
      )
      from eventos_tipos
    ),
    'autogoles', (
      select jsonb_build_object(
        'cantidad',
        count(*),
        'muestra',
        coalesce(
          jsonb_agg(
            jsonb_build_object(
              'evento_id',
              id,
              'partido_id',
              partido_id,
              'torneo_id',
              torneo_id,
              'tipo',
              tipo,
              'jugador',
              jugador,
              'equipo_id',
              equipo_id,
              'equipo',
              equipo
            )
            order by id
          ) filter (where rn <= 10),
          '[]'::jsonb
        )
      )
      from (
        select
          autogol.*,
          row_number() over (order by id) as rn
        from eventos_autogoles autogol
      ) item
    ),
    'uso_inscripcion_relacionada_id', jsonb_build_object(
      'con_valor',
      count(*) filter (where inscripcion_relacionada_id is not null),
      'sin_valor',
      count(*) filter (where inscripcion_relacionada_id is null),
      'por_tipo',
      (
        select coalesce(
          jsonb_agg(
            jsonb_build_object(
              'tipo',
              tipo,
              'total',
              total
            )
            order by tipo
          ),
          '[]'::jsonb
        )
        from (
          select
            coalesce(tipo, 'sin_tipo') as tipo,
            count(*) as total
          from eventos_base
          where inscripcion_relacionada_id is not null
          group by coalesce(tipo, 'sin_tipo')
        ) item
      )
    ),
    'claves_foraneas', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'nombre',
          nombre,
          'columnas',
          columnas,
          'tabla_referenciada',
          tabla_referenciada,
          'columnas_referenciadas',
          columnas_referenciadas,
          'accion_borrado',
          accion_borrado,
          'accion_actualizacion',
          accion_actualizacion
        )
        order by nombre
      )
      from constraints_catalog
      where tabla = 'eventos_partido'
        and tipo = 'f'
    ), '[]'::jsonb),
    'restricciones', coalesce((select data from constraints_json where tabla = 'eventos_partido'), '[]'::jsonb),
    'indices', coalesce((select data from indexes_json where tabla = 'eventos_partido'), '[]'::jsonb),
    'politicas_rls', coalesce((select data from rls_json where tabla = 'eventos_partido'), '[]'::jsonb)
  ) as data
  from eventos_base
),
goleadores_base as (
  select *
  from public.goleadores_oficiales
),
goleadores_por_torneo as (
  select
    torneo_id,
    count(*) as total
  from goleadores_base
  group by torneo_id
),
goleadores_resumen as (
  select jsonb_build_object(
    'tabla_existe', to_regclass('public.goleadores_oficiales') is not null,
    'columnas', coalesce((select data from columns_json where tabla = 'goleadores_oficiales'), '[]'::jsonb),
    'cantidad_total', count(*),
    'cantidad_por_torneo', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'torneo_id',
            torneo_id,
            'total',
            total
          )
          order by torneo_id
        ),
        '[]'::jsonb
      )
      from goleadores_por_torneo
    ),
    'uso_jugador_nombre_textual', jsonb_build_object(
      'columna_existe',
      exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'goleadores_oficiales'
          and column_name = 'jugador_nombre'
      ),
      'con_texto',
      count(*) filter (where btrim(coalesce(jugador_nombre, '')) <> ''),
      'sin_texto',
      count(*) filter (where btrim(coalesce(jugador_nombre, '')) = ''),
      'lectura',
      'snapshot manual compatible temporalmente con calculos por ID si no se mezclan fuentes'
    ),
    'restricciones', coalesce((select data from constraints_json where tabla = 'goleadores_oficiales'), '[]'::jsonb),
    'indices', coalesce((select data from indexes_json where tabla = 'goleadores_oficiales'), '[]'::jsonb),
    'politicas_rls', coalesce((select data from rls_json where tabla = 'goleadores_oficiales'), '[]'::jsonb)
  ) as data
  from goleadores_base
),
auxiliary_structure as (
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
    'triggers_relacionados', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'tabla',
          rel.relname,
          'trigger',
          trigger_row.tgname,
          'habilitado',
          trigger_row.tgenabled
        )
        order by rel.relname, trigger_row.tgname
      )
      from pg_trigger trigger_row
      join pg_class rel
        on rel.oid = trigger_row.tgrelid
      join pg_namespace ns
        on ns.oid = rel.relnamespace
      where ns.nspname = 'public'
        and not trigger_row.tgisinternal
        and (
          trigger_row.tgname ilike '%jugador%'
          or trigger_row.tgname ilike '%alias%'
          or trigger_row.tgname ilike '%inscripcion%'
        )
    ), '[]'::jsonb),
    'politicas_relacionadas', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'tabla',
          tablename,
          'politica',
          policyname,
          'cmd',
          cmd,
          'roles',
          roles
        )
        order by tablename, policyname
      )
      from pg_policies
      where schemaname = 'public'
        and tablename in (
          'jugadores',
          'jugadores_aliases',
          'inscripciones_jugadores',
          'eventos_partido'
        )
    ), '[]'::jsonb),
    'normalizacion_muestra', jsonb_build_object(
      'entrada', U&'JOAQU\00CDN  CARRIZO.',
      'salida_calculada', (select ejemplo_normalizado from normalize_probe),
      'nota', 'La normalizacion ayuda a buscar candidatos; no es identidad unica.'
    )
  ) as data
),
comparison_signals as (
  select jsonb_build_object(
    'sql_versionado_espera', jsonb_build_object(
      'tabla_jugadores', true,
      'tabla_inscripciones_jugadores', true,
      'tabla_eventos_partido', true,
      'columna_eventos_inscripcion_jugador_id', true,
      'columna_eventos_jugador_textual_conservada', true,
      'tabla_jugadores_aliases_pre_migracion', false,
      'nombre_normalizado_pre_migracion', false
    ),
    'respaldo_apertura_2026_referencia', jsonb_build_object(
      'partidos_apertura_esperados', 140,
      'eventos_apertura_respaldo', 368,
      'eventos_apertura_vinculados_respaldo', 60,
      'eventos_apertura_pendientes_respaldo', 308,
      'autogoles_respaldo', 1,
      'jugadores_respaldo', 27,
      'inscripciones_respaldo', 27
    ),
    'migracion_propuesta', jsonb_build_object(
      'agrega_jugadores_nombre_normalizado', true,
      'crea_jugadores_aliases', true,
      'crea_funcion_normalizacion', true,
      'no_unique_global_nombre_normalizado', true,
      'conserva_eventos_partido_jugador', true,
      'no_vincula_automaticamente_ambiguos', true,
      'aliases_sin_lectura_anonima_publica', true
    )
  ) as data
)
select jsonb_build_object(
  'entorno', (select data from entorno),
  'jugadores', (select data from jugadores_resumen),
  'inscripciones_jugadores', (select data from inscripciones_resumen),
  'eventos_partido', (select data from eventos_resumen),
  'goleadores_oficiales', (select data from goleadores_resumen),
  'estructura_auxiliar', (select data from auxiliary_structure),
  'comparacion', (select data from comparison_signals),
  'estado_esperado_post_fallo', jsonb_build_object(
    'objetivo',
    'confirmar que produccion sigue en estado previo a la migracion',
    'conteos_esperados', jsonb_build_object(
      'jugadores', 27,
      'jugadores_activos', 27,
      'inscripciones_jugadores', 27,
      'eventos_partido', 368,
      'eventos_con_inscripcion_jugador_id', 60,
      'eventos_sin_inscripcion_jugador_id', 308,
      'eventos_con_texto_historico', 368,
      'goleadores_oficiales', 4,
      'autogoles', 1,
      'referencias_rotas', 0
    ),
    'estructura_nueva_detectada', jsonb_build_object(
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
      'funciones_auxiliares', (
        select count(*)
        from (
          values
            ('public.tp_jugadores_normalizar_trigger()'),
            ('public.tp_jugadores_aliases_normalizar_trigger()'),
            ('public.tp_validar_evento_inscripcion_jugador()')
        ) expected(regprocedure_name)
        where to_regprocedure(expected.regprocedure_name) is not null
      ),
      'triggers_nuevos', (
        select count(*)
        from pg_trigger trigger_row
        where trigger_row.tgname in (
            'jugadores_normalizar_nombre',
            'jugadores_aliases_normalizar',
            'eventos_partido_validar_inscripcion_jugador'
          )
          and not trigger_row.tgisinternal
      ),
      'indices_nuevos', (
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
      )
    ),
    'estado_pre_migracion_probable', (
      not exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'jugadores'
          and column_name = 'nombre_normalizado'
      )
      and to_regclass('public.jugadores_aliases') is null
      and to_regprocedure('public.tp_normalizar_nombre_jugador(text)') is null
    )
  ),
  'privacidad', jsonb_build_object(
    'incluye_secretos', false,
    'incluye_connection_strings', false,
    'incluye_jwt', false,
    'muestras_limitadas', true,
    'maximo_registros_por_muestra', 10
  )
) as prevalidacion_identidad_jugadores;

COMMIT;
