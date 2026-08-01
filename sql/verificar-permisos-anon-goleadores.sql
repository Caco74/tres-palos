BEGIN TRANSACTION READ ONLY;

-- Verificacion posterior de permisos anonimos para goleadores publicos.
--
-- Entorno esperado: Supabase produccion.
-- Ejecucion: copiar y ejecutar manualmente despues de la correccion autorizada.
-- Alcance: solo lectura.
-- Resultado: columnas control, resultado y detalle, descargables como CSV.

with
targets(tabla, qualified_name, select_policy_name) as (
  values
    ('partidos', 'public.partidos', 'lectura publica'),
    ('eventos_partido', 'public.eventos_partido', 'public read eventos')
),
table_state as (
  select
    targets.tabla,
    targets.qualified_name,
    targets.select_policy_name,
    cls.oid is not null as existe,
    coalesce(cls.relrowsecurity, false) as rls_activo
  from targets
  left join pg_class cls
    on cls.oid = to_regclass(targets.qualified_name)
),
checks(orden, control, ok, detalle) as (
  select
    1,
    'RLS activo: partidos',
    rls_activo,
    case when existe then rls_activo::text else '<tabla inexistente>' end
  from table_state
  where tabla = 'partidos'

  union all

  select
    2,
    'RLS activo: eventos_partido',
    rls_activo,
    case when existe then rls_activo::text else '<tabla inexistente>' end
  from table_state
  where tabla = 'eventos_partido'

  union all

  select
    3,
    'anon tiene SELECT: partidos',
    case
      when existe then has_table_privilege('anon', qualified_name, 'SELECT')
      else false
    end,
    case
      when existe then has_table_privilege('anon', qualified_name, 'SELECT')::text
      else '<tabla inexistente>'
    end
  from table_state
  where tabla = 'partidos'

  union all

  select
    4,
    'anon tiene SELECT: eventos_partido',
    case
      when existe then has_table_privilege('anon', qualified_name, 'SELECT')
      else false
    end,
    case
      when existe then has_table_privilege('anon', qualified_name, 'SELECT')::text
      else '<tabla inexistente>'
    end
  from table_state
  where tabla = 'eventos_partido'

  union all

  select
    5,
    'anon no tiene INSERT: partidos',
    case
      when existe then not has_table_privilege('anon', qualified_name, 'INSERT')
      else false
    end,
    case
      when existe then 'insert=' || has_table_privilege('anon', qualified_name, 'INSERT')::text
      else '<tabla inexistente>'
    end
  from table_state
  where tabla = 'partidos'

  union all

  select
    6,
    'anon no tiene UPDATE: partidos',
    case
      when existe then not has_table_privilege('anon', qualified_name, 'UPDATE')
      else false
    end,
    case
      when existe then 'update=' || has_table_privilege('anon', qualified_name, 'UPDATE')::text
      else '<tabla inexistente>'
    end
  from table_state
  where tabla = 'partidos'

  union all

  select
    7,
    'anon no tiene DELETE: partidos',
    case
      when existe then not has_table_privilege('anon', qualified_name, 'DELETE')
      else false
    end,
    case
      when existe then 'delete=' || has_table_privilege('anon', qualified_name, 'DELETE')::text
      else '<tabla inexistente>'
    end
  from table_state
  where tabla = 'partidos'

  union all

  select
    8,
    'anon no tiene INSERT: eventos_partido',
    case
      when existe then not has_table_privilege('anon', qualified_name, 'INSERT')
      else false
    end,
    case
      when existe then 'insert=' || has_table_privilege('anon', qualified_name, 'INSERT')::text
      else '<tabla inexistente>'
    end
  from table_state
  where tabla = 'eventos_partido'

  union all

  select
    9,
    'anon no tiene UPDATE: eventos_partido',
    case
      when existe then not has_table_privilege('anon', qualified_name, 'UPDATE')
      else false
    end,
    case
      when existe then 'update=' || has_table_privilege('anon', qualified_name, 'UPDATE')::text
      else '<tabla inexistente>'
    end
  from table_state
  where tabla = 'eventos_partido'

  union all

  select
    10,
    'anon no tiene DELETE: eventos_partido',
    case
      when existe then not has_table_privilege('anon', qualified_name, 'DELETE')
      else false
    end,
    case
      when existe then 'delete=' || has_table_privilege('anon', qualified_name, 'DELETE')::text
      else '<tabla inexistente>'
    end
  from table_state
  where tabla = 'eventos_partido'

  union all

  select
    11,
    'Politica publica SELECT: partidos',
    exists (
      select 1
      from pg_policies policies
      where policies.schemaname = 'public'
        and policies.tablename = 'partidos'
        and policies.policyname = 'lectura publica'
        and policies.cmd = 'SELECT'
        and (
          'public' = any(policies.roles::text[]) or
          'anon' = any(policies.roles::text[])
        )
    ),
    coalesce((
      select policies.policyname || ' [' || policies.cmd || ']'
      from pg_policies policies
      where policies.schemaname = 'public'
        and policies.tablename = 'partidos'
        and policies.policyname = 'lectura publica'
      limit 1
    ), '<no encontrada>')

  union all

  select
    12,
    'Politica publica SELECT: eventos_partido',
    exists (
      select 1
      from pg_policies policies
      where policies.schemaname = 'public'
        and policies.tablename = 'eventos_partido'
        and policies.policyname = 'public read eventos'
        and policies.cmd = 'SELECT'
        and (
          'public' = any(policies.roles::text[]) or
          'anon' = any(policies.roles::text[])
        )
    ),
    coalesce((
      select policies.policyname || ' [' || policies.cmd || ']'
      from pg_policies policies
      where policies.schemaname = 'public'
        and policies.tablename = 'eventos_partido'
        and policies.policyname = 'public read eventos'
      limit 1
    ), '<no encontrada>')

  union all

  select
    13,
    'Sin politicas publicas de escritura: partidos',
    not exists (
      select 1
      from pg_policies policies
      where policies.schemaname = 'public'
        and policies.tablename = 'partidos'
        and policies.cmd in ('ALL', 'INSERT', 'UPDATE', 'DELETE')
        and (
          'public' = any(policies.roles::text[]) or
          'anon' = any(policies.roles::text[])
        )
    ),
    coalesce((
      select string_agg(policies.policyname || ' [' || policies.cmd || ']', ', ')
      from pg_policies policies
      where policies.schemaname = 'public'
        and policies.tablename = 'partidos'
        and policies.cmd in ('ALL', 'INSERT', 'UPDATE', 'DELETE')
        and (
          'public' = any(policies.roles::text[]) or
          'anon' = any(policies.roles::text[])
        )
    ), 'ninguna')

  union all

  select
    14,
    'Sin politicas publicas de escritura: eventos_partido',
    not exists (
      select 1
      from pg_policies policies
      where policies.schemaname = 'public'
        and policies.tablename = 'eventos_partido'
        and policies.cmd in ('ALL', 'INSERT', 'UPDATE', 'DELETE')
        and (
          'public' = any(policies.roles::text[]) or
          'anon' = any(policies.roles::text[])
        )
    ),
    coalesce((
      select string_agg(policies.policyname || ' [' || policies.cmd || ']', ', ')
      from pg_policies policies
      where policies.schemaname = 'public'
        and policies.tablename = 'eventos_partido'
        and policies.cmd in ('ALL', 'INSERT', 'UPDATE', 'DELETE')
        and (
          'public' = any(policies.roles::text[]) or
          'anon' = any(policies.roles::text[])
        )
    ), 'ninguna')

  union all

  select
    15,
    'Lectura efectiva disponible para anon',
    case
      when (select existe from table_state where tabla = 'partidos') and
        (select existe from table_state where tabla = 'eventos_partido')
      then has_table_privilege('anon', 'public.partidos', 'SELECT') and
        has_table_privilege('anon', 'public.eventos_partido', 'SELECT')
      else false
    end,
    case
      when (select existe from table_state where tabla = 'partidos') and
        (select existe from table_state where tabla = 'eventos_partido')
      then 'partidos=' ||
        has_table_privilege('anon', 'public.partidos', 'SELECT')::text ||
        ', eventos_partido=' ||
        has_table_privilege('anon', 'public.eventos_partido', 'SELECT')::text
      else '<tabla inexistente>'
    end

  union all

  select
    16,
    'Sin escritura heredada desde PUBLIC',
    not exists (
      select 1
      from information_schema.table_privileges grants
      where grants.table_schema = 'public'
        and grants.table_name in ('partidos', 'eventos_partido')
        and grants.grantee = 'PUBLIC'
        and grants.privilege_type in ('INSERT', 'UPDATE', 'DELETE')
    ),
    coalesce((
      select string_agg(grants.table_name || ':' || grants.privilege_type, ', ')
      from information_schema.table_privileges grants
      where grants.table_schema = 'public'
        and grants.table_name in ('partidos', 'eventos_partido')
        and grants.grantee = 'PUBLIC'
        and grants.privilege_type in ('INSERT', 'UPDATE', 'DELETE')
    ), 'ninguna')
)
select
  control,
  case when ok then 'OK' else 'REVISAR' end as resultado,
  detalle
from checks
order by orden;

COMMIT;
