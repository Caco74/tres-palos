BEGIN TRANSACTION READ ONLY;

-- Auditoria de permisos publicos para goleadores calculados desde eventos.
--
-- Entorno esperado: Supabase produccion.
-- Ejecucion: copiar y ejecutar manualmente desde Supabase SQL Editor.
-- Alcance: solo lectura. No corrige permisos.
-- Resultado: una grilla facil de descargar como CSV.

with
targets(table_schema, table_name, qualified_name) as (
  values
    ('public', 'partidos', 'public.partidos'),
    ('public', 'eventos_partido', 'public.eventos_partido')
),
table_catalog as (
  select
    targets.table_name as tabla,
    owner_role.rolname as propietario,
    cls.relrowsecurity as rls_activo,
    coalesce(cls.relacl::text, '<sin ACL explicita>') as acl_efectiva
  from targets
  left join pg_class cls
    on cls.oid = to_regclass(targets.qualified_name)
  left join pg_roles owner_role
    on owner_role.oid = cls.relowner
),
direct_acl as (
  select
    'acl_directa' as seccion,
    targets.table_name as tabla,
    case
      when acl.grantee = 0 then 'PUBLIC'
      else grantee_role.rolname
    end as grantee,
    grantor_role.rolname as grantor,
    acl.privilege_type::text as privilege_type,
    acl.is_grantable::text as is_grantable,
    table_catalog.propietario,
    table_catalog.rls_activo,
    null::text as policy_name,
    null::text as policy_command,
    null::text as policy_roles,
    null::text as policy_qual,
    null::text as policy_with_check,
    table_catalog.acl_efectiva,
    case
      when acl.grantee = 0 then 'ACL heredable desde PUBLIC'
      when grantee_role.rolname = 'anon' then 'ACL directa a anon'
      when grantee_role.rolname = 'authenticated' then 'ACL directa a authenticated'
      else 'ACL directa a otro rol'
    end as origen_privilegio,
    format(
      '%s para %s otorgado por %s',
      acl.privilege_type::text,
      case
        when acl.grantee = 0 then 'PUBLIC'
        else grantee_role.rolname
      end,
      grantor_role.rolname
    ) as detalle
  from targets
  join pg_class cls
    on cls.oid = to_regclass(targets.qualified_name)
  cross join lateral aclexplode(coalesce(cls.relacl, array[]::aclitem[])) acl
  left join pg_roles grantee_role
    on grantee_role.oid = acl.grantee
  left join pg_roles grantor_role
    on grantor_role.oid = acl.grantor
  left join table_catalog
    on table_catalog.tabla = targets.table_name
  where case
    when acl.grantee = 0 then 'PUBLIC'
    else grantee_role.rolname
  end in ('anon', 'PUBLIC', 'authenticated')
),
direct_grants as (
  select
    'grant_directo' as seccion,
    grants.table_name as tabla,
    grants.grantee,
    grants.grantor,
    grants.privilege_type,
    grants.is_grantable,
    table_catalog.propietario,
    table_catalog.rls_activo,
    null::text as policy_name,
    null::text as policy_command,
    null::text as policy_roles,
    null::text as policy_qual,
    null::text as policy_with_check,
    table_catalog.acl_efectiva,
    case
      when grants.grantee = 'anon' then 'GRANT directo a anon'
      when grants.grantee = 'PUBLIC' then 'GRANT heredable desde PUBLIC'
      when grants.grantee = 'authenticated' then 'GRANT directo a authenticated'
      else 'otro'
    end as origen_privilegio,
    format(
      '%s directo para %s otorgado por %s',
      grants.privilege_type,
      grants.grantee,
      grants.grantor
    ) as detalle
  from information_schema.table_privileges grants
  join targets
    on targets.table_schema = grants.table_schema
    and targets.table_name = grants.table_name
  left join table_catalog
    on table_catalog.tabla = grants.table_name
  where grants.grantee in ('anon', 'PUBLIC', 'authenticated')
),
effective_privileges as (
  select
    'privilegio_efectivo' as seccion,
    targets.table_name as tabla,
    grantees.grantee,
    null::text as grantor,
    privileges.privilege_type,
    null::text as is_grantable,
    table_catalog.propietario,
    table_catalog.rls_activo,
    null::text as policy_name,
    null::text as policy_command,
    null::text as policy_roles,
    null::text as policy_qual,
    null::text as policy_with_check,
    table_catalog.acl_efectiva,
    'has_table_privilege' as origen_privilegio,
    case
      when to_regclass(targets.qualified_name) is null then 'tabla inexistente'
      when has_table_privilege(
        grantees.grantee,
        targets.qualified_name,
        privileges.privilege_type
      ) then 'true'
      else 'false'
    end as detalle
  from targets
  cross join (values ('anon'), ('authenticated')) as grantees(grantee)
  cross join (
    values
      ('SELECT'),
      ('INSERT'),
      ('UPDATE'),
      ('DELETE'),
      ('TRUNCATE'),
      ('REFERENCES'),
      ('TRIGGER')
  ) as privileges(privilege_type)
  left join table_catalog
    on table_catalog.tabla = targets.table_name
),
table_rows as (
  select
    'tabla' as seccion,
    table_catalog.tabla,
    null::text as grantee,
    null::text as grantor,
    null::text as privilege_type,
    null::text as is_grantable,
    table_catalog.propietario,
    table_catalog.rls_activo,
    null::text as policy_name,
    null::text as policy_command,
    null::text as policy_roles,
    null::text as policy_qual,
    null::text as policy_with_check,
    table_catalog.acl_efectiva,
    'catalogo' as origen_privilegio,
    format(
      'propietario=%s; rls_activo=%s; acl=%s',
      coalesce(table_catalog.propietario, '<sin propietario>'),
      coalesce(table_catalog.rls_activo::text, '<sin tabla>'),
      table_catalog.acl_efectiva
    ) as detalle
  from table_catalog
),
policy_rows as (
  select
    'politica' as seccion,
    policies.tablename as tabla,
    null::text as grantee,
    null::text as grantor,
    null::text as privilege_type,
    null::text as is_grantable,
    table_catalog.propietario,
    table_catalog.rls_activo,
    policies.policyname as policy_name,
    policies.cmd as policy_command,
    array_to_string(policies.roles::text[], ',') as policy_roles,
    policies.qual as policy_qual,
    policies.with_check as policy_with_check,
    table_catalog.acl_efectiva,
    'pg_policies' as origen_privilegio,
    format(
      'policy=%s; cmd=%s; roles=%s',
      policies.policyname,
      policies.cmd,
      array_to_string(policies.roles::text[], ',')
    ) as detalle
  from pg_policies policies
  join targets
    on targets.table_schema = policies.schemaname
    and targets.table_name = policies.tablename
  left join table_catalog
    on table_catalog.tabla = policies.tablename
)
select
  seccion,
  tabla,
  grantee,
  grantor,
  privilege_type,
  is_grantable,
  propietario,
  rls_activo,
  policy_name,
  policy_command,
  policy_roles,
  policy_qual,
  policy_with_check,
  acl_efectiva,
  origen_privilegio,
  detalle
from (
  select * from table_rows
  union all
  select * from direct_acl
  union all
  select * from direct_grants
  union all
  select * from effective_privileges
  union all
  select * from policy_rows
) audit
order by
  tabla,
  case seccion
    when 'tabla' then 1
    when 'acl_directa' then 2
    when 'grant_directo' then 3
    when 'privilegio_efectivo' then 4
    when 'politica' then 5
    else 99
  end,
  grantee nulls first,
  privilege_type nulls first,
  policy_name nulls first;

COMMIT;
