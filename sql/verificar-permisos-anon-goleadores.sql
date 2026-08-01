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
privileges_to_check(privilege_type) as (
  values
    ('SELECT'),
    ('INSERT'),
    ('UPDATE'),
    ('DELETE'),
    ('TRUNCATE'),
    ('REFERENCES'),
    ('TRIGGER'),
    ('MAINTAIN')
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
direct_acl as (
  select
    table_state.tabla,
    case
      when acl.grantee = 0 then 'PUBLIC'
      else grantee_role.rolname
    end as grantee,
    grantor_role.rolname as grantor,
    acl.privilege_type::text as privilege_type,
    acl.is_grantable
  from table_state
  join pg_class cls
    on cls.oid = to_regclass(table_state.qualified_name)
  cross join lateral aclexplode(coalesce(cls.relacl, array[]::aclitem[])) acl
  left join pg_roles grantee_role
    on grantee_role.oid = acl.grantee
  left join pg_roles grantor_role
    on grantor_role.oid = acl.grantor
),
anon_effective_acl as (
  select tabla, privilege_type
  from direct_acl
  where grantee = 'anon'

  union

  select tabla, privilege_type
  from direct_acl
  where grantee = 'PUBLIC'
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
    10 + case when table_state.tabla = 'partidos' then 0 else 100 end,
    'anon tiene SELECT efectivo: ' || table_state.tabla,
    case
      when table_state.existe then exists (
        select 1
        from anon_effective_acl acl
        where acl.tabla = table_state.tabla
          and acl.privilege_type = 'SELECT'
      ) and has_table_privilege('anon', table_state.qualified_name, 'SELECT')
      else false
    end,
    case
      when table_state.existe then 'acl=' ||
        (exists (
          select 1
          from anon_effective_acl acl
          where acl.tabla = table_state.tabla
            and acl.privilege_type = 'SELECT'
        ))::text ||
        ', has_table_privilege=' ||
        has_table_privilege('anon', table_state.qualified_name, 'SELECT')::text
      else '<tabla inexistente>'
    end
  from table_state

  union all

  select
    20 +
      case privileges_to_check.privilege_type
        when 'INSERT' then 1
        when 'UPDATE' then 2
        when 'DELETE' then 3
        when 'TRUNCATE' then 4
        when 'REFERENCES' then 5
        when 'TRIGGER' then 6
        when 'MAINTAIN' then 7
        else 99
      end +
      case when table_state.tabla = 'partidos' then 0 else 100 end,
    'anon no tiene ' || privileges_to_check.privilege_type || ' efectivo: ' ||
      table_state.tabla,
    case
      when table_state.existe then not exists (
        select 1
        from anon_effective_acl acl
        where acl.tabla = table_state.tabla
          and acl.privilege_type = privileges_to_check.privilege_type
      ) and not has_table_privilege(
        'anon',
        table_state.qualified_name,
        privileges_to_check.privilege_type
      )
      else false
    end,
    case
      when table_state.existe then 'acl=' ||
        (exists (
          select 1
          from anon_effective_acl acl
          where acl.tabla = table_state.tabla
            and acl.privilege_type = privileges_to_check.privilege_type
        ))::text ||
        ', has_table_privilege=' ||
        has_table_privilege(
          'anon',
          table_state.qualified_name,
          privileges_to_check.privilege_type
        )::text
      else '<tabla inexistente>'
    end
  from table_state
  cross join privileges_to_check
  where privileges_to_check.privilege_type <> 'SELECT'

  union all

  select
    40 + case when table_state.tabla = 'partidos' then 0 else 100 end,
    'ACL directa anon solo SELECT: ' || table_state.tabla,
    coalesce((
      select array_agg(distinct acl.privilege_type order by acl.privilege_type)
      from direct_acl acl
      where acl.tabla = table_state.tabla
        and acl.grantee = 'anon'
    ), array[]::text[]) = array['SELECT']::text[],
    coalesce((
      select array_to_string(array_agg(distinct acl.privilege_type order by acl.privilege_type), ',')
      from direct_acl acl
      where acl.tabla = table_state.tabla
        and acl.grantee = 'anon'
    ), '<sin grants directos>')
  from table_state

  union all

  select
    45 + case when table_state.tabla = 'partidos' then 0 else 100 end,
    'anon sin SELECT WITH GRANT OPTION: ' || table_state.tabla,
    case
      when table_state.existe then not exists (
        select 1
        from direct_acl acl
        where acl.tabla = table_state.tabla
          and acl.grantee in ('anon', 'PUBLIC')
          and acl.privilege_type = 'SELECT'
          and acl.is_grantable
      )
      else false
    end,
    coalesce((
      select string_agg(acl.grantee || ':' || coalesce(acl.grantor, '<sin grantor>'), ',' order by acl.grantee, acl.grantor)
      from direct_acl acl
      where acl.tabla = table_state.tabla
        and acl.grantee in ('anon', 'PUBLIC')
        and acl.privilege_type = 'SELECT'
        and acl.is_grantable
    ), 'ninguno')
  from table_state

  union all

  select
    50 + case when table_state.tabla = 'partidos' then 0 else 100 end,
    'Sin privilegios heredados desde PUBLIC: ' || table_state.tabla,
    not exists (
      select 1
      from direct_acl acl
      where acl.tabla = table_state.tabla
        and acl.grantee = 'PUBLIC'
    ),
    coalesce((
      select string_agg(acl.privilege_type, ',' order by acl.privilege_type)
      from direct_acl acl
      where acl.tabla = table_state.tabla
        and acl.grantee = 'PUBLIC'
    ), 'ninguno')
  from table_state

  union all

  select
    60 + case when table_state.tabla = 'partidos' then 0 else 100 end,
    'Politica publica SELECT: ' || table_state.tabla,
    exists (
      select 1
      from pg_policies policies
      where policies.schemaname = 'public'
        and policies.tablename = table_state.tabla
        and policies.policyname = table_state.select_policy_name
        and policies.cmd = 'SELECT'
        and (
          'public' = any(policies.roles::text[]) or
          'anon' = any(policies.roles::text[])
        )
    ),
    coalesce((
      select policies.policyname || ' [' || policies.cmd || '] roles=' ||
        array_to_string(policies.roles::text[], ',')
      from pg_policies policies
      where policies.schemaname = 'public'
        and policies.tablename = table_state.tabla
        and policies.policyname = table_state.select_policy_name
      limit 1
    ), '<no encontrada>')
  from table_state

  union all

  select
    70 + case when table_state.tabla = 'partidos' then 0 else 100 end,
    'Sin politicas publicas de escritura: ' || table_state.tabla,
    not exists (
      select 1
      from pg_policies policies
      where policies.schemaname = 'public'
        and policies.tablename = table_state.tabla
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
        and policies.tablename = table_state.tabla
        and policies.cmd in ('ALL', 'INSERT', 'UPDATE', 'DELETE')
        and (
          'public' = any(policies.roles::text[]) or
          'anon' = any(policies.roles::text[])
        )
    ), 'ninguna')
  from table_state
)
select
  control,
  case when ok then 'OK' else 'REVISAR' end as resultado,
  detalle
from checks
order by orden;

COMMIT;
