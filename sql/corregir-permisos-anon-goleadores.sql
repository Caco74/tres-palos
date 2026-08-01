begin;

-- Correccion protegida de permisos anonimos para goleadores publicos.
-- No ejecutar esta version: falla hasta reemplazar PENDIENTE_AUTORIZACION
-- por la frase exacta AUTORIZO PERMISOS GOLEADORES PUBLICOS.
--
-- Variante elegida:
--   REVOKE INSERT, UPDATE, DELETE ... FROM anon;
--   REVOKE INSERT, UPDATE, DELETE ... FROM PUBLIC;
--   GRANT SELECT ... TO anon;
--
-- No se usa REVOKE ALL PRIVILEGES porque podria tocar SELECT heredado desde
-- PUBLIC u otros permisos no auditados. La variante especifica conserva la
-- lectura publica necesaria y elimina solo los privilegios DML innecesarios.

do $$
declare
  v_autorizacion constant text := 'PENDIENTE_AUTORIZACION';
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
  anon_write_privileges as (
    select tabla, privilege_type
    from targets
    cross join (values ('INSERT'), ('UPDATE'), ('DELETE')) as privileges(privilege_type)
    where has_table_privilege('anon', qualified_name, privilege_type)
  )
  select string_agg(tabla || ':' || privilege_type, ', ' order by tabla, privilege_type)
  into v_error
  from anon_write_privileges;

  if v_error is null then
    raise exception
      'Correccion bloqueada. El estado no coincide: anon no tiene privilegios DML innecesarios.';
  end if;

  with targets(tabla, qualified_name) as (
    values
      ('partidos', 'public.partidos'),
      ('eventos_partido', 'public.eventos_partido')
  ),
  unexpected_effective as (
    select tabla, privilege_type
    from targets
    cross join (
      values
        ('TRUNCATE'),
        ('REFERENCES'),
        ('TRIGGER')
    ) as privileges(privilege_type)
    where has_table_privilege('anon', qualified_name, privilege_type)
  ),
  unexpected_direct as (
    select grants.table_name as tabla, grants.privilege_type
    from information_schema.table_privileges grants
    where grants.table_schema = 'public'
      and grants.table_name in ('partidos', 'eventos_partido')
      and grants.grantee in ('anon', 'PUBLIC')
      and grants.privilege_type not in ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
  )
  select string_agg(tabla || ':' || privilege_type, ', ' order by tabla, privilege_type)
  into v_error
  from (
    select * from unexpected_effective
    union all
    select * from unexpected_direct
  ) unexpected;

  if v_error is not null then
    raise exception
      'Correccion bloqueada. Existen privilegios anonimos no auditados: %.',
      v_error;
  end if;
end $$;

revoke insert, update, delete
on table public.partidos, public.eventos_partido
from anon;

revoke insert, update, delete
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
  write_privileges as (
    select tabla, privilege_type
    from targets
    cross join (values ('INSERT'), ('UPDATE'), ('DELETE')) as privileges(privilege_type)
    where has_table_privilege('anon', qualified_name, privilege_type)
  )
  select string_agg(tabla || ':' || privilege_type, ', ' order by tabla, privilege_type)
  into v_error
  from write_privileges;

  if v_error is not null then
    raise exception 'Verificacion final fallo. anon conserva escritura: %.', v_error;
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

  select string_agg(grants.table_name || ':' || grants.privilege_type, ', ')
  into v_error
  from information_schema.table_privileges grants
  where grants.table_schema = 'public'
    and grants.table_name in ('partidos', 'eventos_partido')
    and grants.grantee = 'PUBLIC'
    and grants.privilege_type in ('INSERT', 'UPDATE', 'DELETE');

  if v_error is not null then
    raise exception 'Verificacion final fallo. PUBLIC conserva escritura: %.', v_error;
  end if;
end $$;

commit;
