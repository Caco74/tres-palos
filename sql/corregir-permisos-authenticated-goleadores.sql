begin;

-- Correccion protegida de permisos authenticated para goleadores publicos.
-- No ejecutar esta version: falla hasta reemplazar PENDIENTE_AUTORIZACION
-- por la frase exacta AUTORIZO PERMISOS AUTHENTICATED GOLEADORES.
--
-- La auditoria del repositorio no encontro uso de Supabase Auth ni sesiones de
-- usuario. El admin usa funciones Netlify con service_role y contrasena propia.
--
-- Esta correccion solo toca authenticated sobre public.partidos y
-- public.eventos_partido. No modifica anon, PUBLIC, service_role, politicas RLS,
-- estructura ni filas.

do $$
declare
  v_autorizacion constant text := 'PENDIENTE_AUTORIZACION';
  v_authenticated_sin_uso_en_repo constant boolean := true;
  v_error text;
begin
  if v_autorizacion <> 'AUTORIZO PERMISOS AUTHENTICATED GOLEADORES' then
    raise exception
      'Correccion bloqueada. Falta autorizacion manual para permisos authenticated de goleadores.';
  end if;

  if not v_authenticated_sin_uso_en_repo then
    raise exception
      'Correccion bloqueada. Falta decision explicita sobre authenticated.';
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
  where has_table_privilege('authenticated', qualified_name, 'SELECT') is not true;

  if v_error is not null then
    raise exception 'Correccion bloqueada. authenticated no conserva SELECT en: %.', v_error;
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
        'authenticated' = any(policies.roles::text[])
      )
  )
  select string_agg(tabla || ' -> ' || policy_name || ' [' || cmd || '] ' || roles, ', ')
  into v_error
  from write_policies;

  if v_error is not null then
    raise exception 'Correccion bloqueada. Existen politicas authenticated/public de escritura: %.', v_error;
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
    end in ('authenticated', 'PUBLIC')
  )
  select string_agg(tabla || ':' || grantee || ':' || privilege_type, ', ' order by tabla, grantee, privilege_type)
  into v_error
  from direct_acl
  where grantee = 'PUBLIC';

  if v_error is not null then
    raise exception 'Correccion bloqueada. PUBLIC tiene grants directos no esperados: %.', v_error;
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
    where grantee_role.rolname = 'authenticated'
  )
  select string_agg(tabla || ':' || privilege_type || ':' || coalesce(grantor, '<sin grantor>'), ', ' order by tabla, privilege_type)
  into v_error
  from direct_acl
  where grantor is distinct from 'postgres';

  if v_error is not null then
    raise exception 'Correccion bloqueada. Los grants directos de authenticated no vienen de postgres: %.', v_error;
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
    where grantee_role.rolname = 'authenticated'
  )
  select string_agg(tabla || ':' || privilege_type, ', ' order by tabla, privilege_type)
  into v_error
  from direct_acl
  where privilege_type <> 'SELECT';

  if v_error is null then
    raise exception
      'Correccion bloqueada. El estado no coincide: authenticated ya no tiene privilegios innecesarios.';
  end if;
end $$;

revoke all privileges
on table public.partidos, public.eventos_partido
from authenticated;

grant select
on table public.partidos, public.eventos_partido
to authenticated;

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
    where grantee_role.rolname = 'authenticated'
  )
  select string_agg(tabla || ':' || privilege_type, ', ' order by tabla, privilege_type)
  into v_error
  from direct_acl
  where privilege_type <> 'SELECT';

  if v_error is not null then
    raise exception 'Verificacion final fallo. authenticated conserva privilegios innecesarios: %.', v_error;
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
    where grantee_role.rolname = 'authenticated'
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
    raise exception 'Verificacion final fallo. ACL directa de authenticated no quedo en SELECT para: %.', v_error;
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
  where has_table_privilege('authenticated', targets.qualified_name, standard_privileges.privilege_type);

  if v_error is not null then
    raise exception 'Verificacion final fallo. authenticated conserva privilegios efectivos de escritura o administracion: %.', v_error;
  end if;
end $$;

commit;
