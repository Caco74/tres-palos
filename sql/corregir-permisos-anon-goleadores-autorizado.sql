-- ARCHIVO TEMPORAL AUTORIZADO PARA CORRECCIÓN MANUAL DE PERMISOS
-- Ejecutar el archivo completo; no ejecutar fragmentos.
-- No repetir ante un error: detenerse, guardar el error y revisar el estado.
-- Ejecutar despues sql/verificar-permisos-anon-goleadores.sql.
-- Eliminar este archivo antes del merge.
begin;

-- Correccion protegida de permisos anonimos para goleadores publicos.
-- No ejecutar esta version: falla hasta reemplazar PENDIENTE_AUTORIZACION
-- por la frase exacta AUTORIZO PERMISOS GOLEADORES PUBLICOS.
--
-- Variante elegida:
--   REVOKE ALL PRIVILEGES ... FROM anon;
--   REVOKE ALL PRIVILEGES ... FROM PUBLIC;
--   GRANT SELECT ... TO anon;
--
-- La auditoria real confirmo ACL directas otorgadas por postgres:
--   anon=arwdDxtm/postgres
--   authenticated=arwdDxtm/postgres
--
-- Esta correccion solo toca anon y PUBLIC sobre public.partidos y
-- public.eventos_partido. No modifica authenticated, service_role, politicas
-- RLS, estructura ni filas.

do $$
declare
  v_autorizacion constant text := 'AUTORIZO PERMISOS GOLEADORES PUBLICOS';
  v_endpoint_goleadores_solo_select constant boolean := true;
  v_error text;
begin
  if v_autorizacion <> 'AUTORIZO PERMISOS GOLEADORES PUBLICOS' then
    raise exception
      'Correccion bloqueada. Falta autorizacion manual para permisos de goleadores publicos.';
  end if;

  if not v_endpoint_goleadores_solo_select then
    raise exception
      'Correccion bloqueada. La funcion publica de goleadores no fue validada como solo lectura.';
  end if;

  with required_tables(tabla) as (
    values
      ('public.partidos'),
      ('public.eventos_partido')
  )
  select string_agg(tabla, ', ' order by tabla)
  into v_error
  from required_tables
  where to_regclass(tabla) is null;

  if v_error is not null then
    raise exception 'Correccion bloqueada. Faltan tablas requeridas: %.', v_error;
  end if;

  with required_rls(tabla) as (
    values
      ('partidos'),
      ('eventos_partido')
  )
  select string_agg(tabla, ', ' order by tabla)
  into v_error
  from required_rls
  left join pg_class cls
    on cls.oid = to_regclass('public.' || required_rls.tabla)
  where coalesce(cls.relrowsecurity, false) is not true;

  if v_error is not null then
    raise exception 'Correccion bloqueada. RLS no esta activo en: %.', v_error;
  end if;

  with required_select(tabla, qualified_name) as (
    values
      ('partidos', 'public.partidos'),
      ('eventos_partido', 'public.eventos_partido')
  )
  select string_agg(tabla, ', ' order by tabla)
  into v_error
  from required_select
  where has_table_privilege('anon', qualified_name, 'SELECT') is not true;

  if v_error is not null then
    raise exception 'Correccion bloqueada. anon no conserva SELECT en: %.', v_error;
  end if;

  with required_policies(tabla, policy_name) as (
    values
      ('partidos', 'lectura publica'),
      ('eventos_partido', 'public read eventos')
  )
  select string_agg(tabla || ' -> ' || policy_name, ', ' order by tabla)
  into v_error
  from required_policies
  where not exists (
    select 1
    from pg_policies policies
    where policies.schemaname = 'public'
      and policies.tablename = required_policies.tabla
      and policies.policyname = required_policies.policy_name
      and policies.cmd = 'SELECT'
      and (
        'public' = any(policies.roles::text[]) or
        'anon' = any(policies.roles::text[])
      )
  );

  if v_error is not null then
    raise exception 'Correccion bloqueada. Falta politica publica SELECT: %.', v_error;
  end if;

  with write_policies(tabla, policy_name, cmd, roles) as (
    select
      policies.tablename,
      policies.policyname,
      policies.cmd,
      array_to_string(policies.roles::text[], ',')
    from pg_policies policies
    where policies.schemaname = 'public'
      and policies.tablename in ('partidos', 'eventos_partido')
      and policies.cmd in ('ALL', 'INSERT', 'UPDATE', 'DELETE')
      and (
        'public' = any(policies.roles::text[]) or
        'anon' = any(policies.roles::text[])
      )
  )
  select string_agg(tabla || ' -> ' || policy_name || ' [' || cmd || '] ' || roles, ', ')
  into v_error
  from write_policies;

  if v_error is not null then
    raise exception 'Correccion bloqueada. Existen politicas publicas de escritura: %.', v_error;
  end if;

  with targets(tabla, qualified_name) as (
    values
      ('partidos', 'public.partidos'),
      ('eventos_partido', 'public.eventos_partido')
  ),
  direct_acl as (
    select
      targets.tabla,
      case
        when acl.grantee = 0 then 'PUBLIC'
        else grantee_role.rolname
      end as grantee,
      grantor_role.rolname as grantor,
      acl.privilege_type::text as privilege_type
    from targets
    join pg_class cls
      on cls.oid = to_regclass(targets.qualified_name)
    cross join lateral aclexplode(coalesce(cls.relacl, array[]::aclitem[])) acl
    left join pg_roles grantee_role
      on grantee_role.oid = acl.grantee
    left join pg_roles grantor_role
      on grantor_role.oid = acl.grantor
    where case
      when acl.grantee = 0 then 'PUBLIC'
      else grantee_role.rolname
    end in ('anon', 'PUBLIC')
  )
  select string_agg(tabla || ':' || grantee || ':' || privilege_type, ', ' order by tabla, grantee, privilege_type)
  into v_error
  from direct_acl
  where grantee = 'PUBLIC';

  if v_error is not null then
    raise exception 'Correccion bloqueada. El origen no coincide: PUBLIC tiene grants directos: %.', v_error;
  end if;

  with targets(tabla, qualified_name) as (
    values
      ('partidos', 'public.partidos'),
      ('eventos_partido', 'public.eventos_partido')
  ),
  direct_acl as (
    select
      targets.tabla,
      grantor_role.rolname as grantor,
      acl.privilege_type::text as privilege_type
    from targets
    join pg_class cls
      on cls.oid = to_regclass(targets.qualified_name)
    cross join lateral aclexplode(coalesce(cls.relacl, array[]::aclitem[])) acl
    left join pg_roles grantee_role
      on grantee_role.oid = acl.grantee
    left join pg_roles grantor_role
      on grantor_role.oid = acl.grantor
    where grantee_role.rolname = 'anon'
  )
  select string_agg(tabla || ':' || privilege_type || ':' || coalesce(grantor, '<sin grantor>'), ', ' order by tabla, privilege_type)
  into v_error
  from direct_acl
  where grantor is distinct from 'postgres';

  if v_error is not null then
    raise exception 'Correccion bloqueada. Los grants directos de anon no vienen de postgres: %.', v_error;
  end if;

  with targets(tabla, qualified_name) as (
    values
      ('partidos', 'public.partidos'),
      ('eventos_partido', 'public.eventos_partido')
  ),
  required_privileges(privilege_type) as (
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
  direct_acl as (
    select
      targets.tabla,
      acl.privilege_type::text as privilege_type
    from targets
    join pg_class cls
      on cls.oid = to_regclass(targets.qualified_name)
    cross join lateral aclexplode(coalesce(cls.relacl, array[]::aclitem[])) acl
    left join pg_roles grantee_role
      on grantee_role.oid = acl.grantee
    where grantee_role.rolname = 'anon'
  ),
  missing as (
    select targets.tabla, required_privileges.privilege_type
    from targets
    cross join required_privileges
    where not exists (
      select 1
      from direct_acl
      where direct_acl.tabla = targets.tabla
        and direct_acl.privilege_type = required_privileges.privilege_type
    )
  )
  select string_agg(tabla || ':' || privilege_type, ', ' order by tabla, privilege_type)
  into v_error
  from missing;

  if v_error is not null then
    raise exception 'Correccion bloqueada. El ACL de anon no coincide con la auditoria: faltan %.', v_error;
  end if;

  with targets(tabla, qualified_name) as (
    values
      ('partidos', 'public.partidos'),
      ('eventos_partido', 'public.eventos_partido')
  ),
  direct_acl as (
    select
      targets.tabla,
      acl.privilege_type::text as privilege_type
    from targets
    join pg_class cls
      on cls.oid = to_regclass(targets.qualified_name)
    cross join lateral aclexplode(coalesce(cls.relacl, array[]::aclitem[])) acl
    left join pg_roles grantee_role
      on grantee_role.oid = acl.grantee
    where grantee_role.rolname = 'anon'
  ),
  non_select as (
    select tabla, privilege_type
    from direct_acl
    where privilege_type <> 'SELECT'
  )
  select string_agg(tabla || ':' || privilege_type, ', ' order by tabla, privilege_type)
  into v_error
  from non_select;

  if v_error is null then
    raise exception
      'Correccion bloqueada. El estado no coincide: anon ya no tiene privilegios innecesarios.';
  end if;
end $$;

revoke all privileges
on table public.partidos, public.eventos_partido
from anon;

revoke all privileges
on table public.partidos, public.eventos_partido
from public;

grant select
on table public.partidos, public.eventos_partido
to anon;

do $$
declare
  v_error text;
begin
  with required_rls(tabla) as (
    values
      ('partidos'),
      ('eventos_partido')
  )
  select string_agg(tabla, ', ' order by tabla)
  into v_error
  from required_rls
  left join pg_class cls
    on cls.oid = to_regclass('public.' || required_rls.tabla)
  where coalesce(cls.relrowsecurity, false) is not true;

  if v_error is not null then
    raise exception 'Verificacion final fallo. RLS no esta activo en: %.', v_error;
  end if;

  with targets(tabla, qualified_name) as (
    values
      ('partidos', 'public.partidos'),
      ('eventos_partido', 'public.eventos_partido')
  )
  select string_agg(tabla, ', ' order by tabla)
  into v_error
  from targets
  where has_table_privilege('anon', qualified_name, 'SELECT') is not true;

  if v_error is not null then
    raise exception 'Verificacion final fallo. anon perdio SELECT en: %.', v_error;
  end if;

  with targets(tabla, qualified_name) as (
    values
      ('partidos', 'public.partidos'),
      ('eventos_partido', 'public.eventos_partido')
  ),
  direct_acl as (
    select
      targets.tabla,
      case
        when acl.grantee = 0 then 'PUBLIC'
        else grantee_role.rolname
      end as grantee,
      acl.privilege_type::text as privilege_type
    from targets
    join pg_class cls
      on cls.oid = to_regclass(targets.qualified_name)
    cross join lateral aclexplode(coalesce(cls.relacl, array[]::aclitem[])) acl
    left join pg_roles grantee_role
      on grantee_role.oid = acl.grantee
    where case
      when acl.grantee = 0 then 'PUBLIC'
      else grantee_role.rolname
    end in ('anon', 'PUBLIC')
  )
  select string_agg(tabla || ':' || grantee || ':' || privilege_type, ', ' order by tabla, grantee, privilege_type)
  into v_error
  from direct_acl
  where grantee = 'PUBLIC'
    or (grantee = 'anon' and privilege_type <> 'SELECT');

  if v_error is not null then
    raise exception 'Verificacion final fallo. Quedaron privilegios anonimos innecesarios: %.', v_error;
  end if;

  with targets(tabla, qualified_name) as (
    values
      ('partidos', 'public.partidos'),
      ('eventos_partido', 'public.eventos_partido')
  ),
  direct_acl as (
    select
      targets.tabla,
      acl.privilege_type::text as privilege_type
    from targets
    join pg_class cls
      on cls.oid = to_regclass(targets.qualified_name)
    cross join lateral aclexplode(coalesce(cls.relacl, array[]::aclitem[])) acl
    left join pg_roles grantee_role
      on grantee_role.oid = acl.grantee
    where grantee_role.rolname = 'anon'
  )
  select string_agg(targets.tabla, ', ' order by targets.tabla)
  into v_error
  from targets
  where not exists (
    select 1
    from direct_acl
    where direct_acl.tabla = targets.tabla
      and direct_acl.privilege_type = 'SELECT'
  );

  if v_error is not null then
    raise exception 'Verificacion final fallo. ACL directa de anon no quedo en SELECT para: %.', v_error;
  end if;

  with standard_privileges(privilege_type) as (
    values
      ('INSERT'),
      ('UPDATE'),
      ('DELETE'),
      ('TRUNCATE'),
      ('REFERENCES'),
      ('TRIGGER')
  ),
  targets(tabla, qualified_name) as (
    values
      ('partidos', 'public.partidos'),
      ('eventos_partido', 'public.eventos_partido')
  )
  select string_agg(targets.tabla || ':' || standard_privileges.privilege_type, ', ' order by targets.tabla, standard_privileges.privilege_type)
  into v_error
  from targets
  cross join standard_privileges
  where has_table_privilege('anon', targets.qualified_name, standard_privileges.privilege_type);

  if v_error is not null then
    raise exception 'Verificacion final fallo. anon conserva privilegios efectivos de escritura o administracion: %.', v_error;
  end if;

  with required_policies(tabla, policy_name) as (
    values
      ('partidos', 'lectura publica'),
      ('eventos_partido', 'public read eventos')
  )
  select string_agg(tabla || ' -> ' || policy_name, ', ' order by tabla)
  into v_error
  from required_policies
  where not exists (
    select 1
    from pg_policies policies
    where policies.schemaname = 'public'
      and policies.tablename = required_policies.tabla
      and policies.policyname = required_policies.policy_name
      and policies.cmd = 'SELECT'
      and (
        'public' = any(policies.roles::text[]) or
        'anon' = any(policies.roles::text[])
      )
  );

  if v_error is not null then
    raise exception 'Verificacion final fallo. Falta politica publica SELECT: %.', v_error;
  end if;

  with write_policies(tabla, policy_name, cmd, roles) as (
    select
      policies.tablename,
      policies.policyname,
      policies.cmd,
      array_to_string(policies.roles::text[], ',')
    from pg_policies policies
    where policies.schemaname = 'public'
      and policies.tablename in ('partidos', 'eventos_partido')
      and policies.cmd in ('ALL', 'INSERT', 'UPDATE', 'DELETE')
      and (
        'public' = any(policies.roles::text[]) or
        'anon' = any(policies.roles::text[])
      )
  )
  select string_agg(tabla || ' -> ' || policy_name || ' [' || cmd || '] ' || roles, ', ')
  into v_error
  from write_policies;

  if v_error is not null then
    raise exception 'Verificacion final fallo. Existen politicas publicas de escritura: %.', v_error;
  end if;
end $$;

commit;
