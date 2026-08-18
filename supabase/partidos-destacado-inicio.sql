-- Partido destacado en Inicio
-- Ejecutar manualmente en Supabase SQL Editor.
-- Este script no cambia RLS, policies, grants, ACL, owners, funciones,
-- triggers ni tablas distintas de public.partidos.

-- ============================================================================
-- 1. PRECHECK
-- ============================================================================

select
  'PRECHECK - tabla public.partidos' as etapa,
  to_regclass('public.partidos') is not null as existe_public_partidos;

with columnas_esperadas(column_name) as (
  values
    ('destacado_inicio'),
    ('destacado_titulo')
)
select
  'PRECHECK - columnas esperadas' as etapa,
  esperado.column_name,
  columna.column_name is not null as existe,
  columna.data_type,
  columna.udt_name,
  columna.is_nullable,
  columna.column_default
from columnas_esperadas esperado
left join information_schema.columns columna
  on columna.table_schema = 'public'
  and columna.table_name = 'partidos'
  and columna.column_name = esperado.column_name
order by esperado.column_name;

select
  'PRECHECK - indice esperado' as etapa,
  indice.indexname is not null as existe,
  indice.schemaname,
  indice.tablename,
  indice.indexname,
  indice.indexdef
from (values ('partidos_destacado_inicio_torneo_idx')) esperado(indexname)
left join pg_indexes indice
  on indice.schemaname = 'public'
  and indice.tablename = 'partidos'
  and indice.indexname = esperado.indexname;

do $$
declare
  v_table_exists boolean;
  v_column_exists boolean;
  v_column_is_boolean boolean;
  v_total bigint;
  v_duplicados bigint;
  v_row record;
begin
  select to_regclass('public.partidos') is not null
    into v_table_exists;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'partidos'
      and column_name = 'destacado_inicio'
  )
    into v_column_exists;

  if not v_table_exists then
    raise notice 'PRECHECK destacados: public.partidos no existe; no se consultan filas.';
    return;
  end if;

  if not v_column_exists then
    raise notice 'PRECHECK destacados: destacado_inicio no existe; no se consultan filas.';
    return;
  end if;

  select exists (
    select 1
    from pg_attribute attr
    where attr.attrelid = 'public.partidos'::regclass
      and attr.attname = 'destacado_inicio'
      and attr.atttypid = 'pg_catalog.bool'::regtype
      and not attr.attisdropped
  )
    into v_column_is_boolean;

  if not v_column_is_boolean then
    raise notice 'PRECHECK destacados: destacado_inicio existe pero no es boolean; no se consultan filas.';
    return;
  end if;

  execute
    'select count(*) from public.partidos where destacado_inicio is true'
    into v_total;
  raise notice 'PRECHECK destacados total actual: %', v_total;

  for v_row in execute
    'select torneo_id, count(*) as cantidad
       from public.partidos
      where destacado_inicio is true
      group by torneo_id
      order by torneo_id nulls first'
  loop
    raise notice
      'PRECHECK destacado por torneo: torneo_id=%, cantidad=%',
      coalesce(v_row.torneo_id::text, '<null>'),
      v_row.cantidad;
  end loop;

  execute
    'select count(*)
       from (
         select torneo_id
           from public.partidos
          where destacado_inicio is true
          group by torneo_id
         having count(*) > 1
       ) duplicados'
    into v_duplicados;

  if v_duplicados = 0 then
    raise notice 'PRECHECK duplicados: no hay torneos con mas de un destacado_inicio=true.';
  else
    raise warning
      'PRECHECK duplicados: hay % torneo(s) con mas de un destacado_inicio=true. APPLY debe detenerse.',
      v_duplicados;
  end if;
end $$;

-- ============================================================================
-- 2. APPLY
-- ============================================================================

begin;

do $$
declare
  v_destacado_inicio record;
  v_destacado_titulo record;
  v_destacado_inicio_exists boolean;
  v_destacado_titulo_exists boolean;
  v_duplicados bigint := 0;
  v_index_oid regclass;
  v_indexdef text;
  v_expected_indexdef constant text :=
    'CREATE UNIQUE INDEX partidos_destacado_inicio_torneo_idx ON public.partidos USING btree (torneo_id) WHERE (destacado_inicio = true)';
begin
  if to_regclass('public.partidos') is null then
    raise exception 'APPLY detenido: public.partidos no existe.';
  end if;

  select
    format_type(attr.atttypid, attr.atttypmod) as data_type,
    attr.attnotnull as not_null,
    pg_get_expr(def.adbin, def.adrelid) as default_expr
  into v_destacado_inicio
  from pg_attribute attr
  left join pg_attrdef def
    on def.adrelid = attr.attrelid
    and def.adnum = attr.attnum
  where attr.attrelid = 'public.partidos'::regclass
    and attr.attname = 'destacado_inicio'
    and not attr.attisdropped;

  v_destacado_inicio_exists := found;

  if v_destacado_inicio_exists then
    if v_destacado_inicio.data_type <> 'boolean' then
      raise exception
        'APPLY detenido: public.partidos.destacado_inicio existe con tipo %, se esperaba boolean.',
        v_destacado_inicio.data_type;
    end if;

    if v_destacado_inicio.not_null is not true then
      raise exception
        'APPLY detenido: public.partidos.destacado_inicio existe pero no es NOT NULL.';
    end if;

    if coalesce(v_destacado_inicio.default_expr, '') <> 'false' then
      raise exception
        'APPLY detenido: public.partidos.destacado_inicio existe con default %, se esperaba false.',
        coalesce(v_destacado_inicio.default_expr, '<sin default>');
    end if;

    execute
      'select count(*)
         from (
           select torneo_id
             from public.partidos
            where destacado_inicio is true
            group by torneo_id
           having count(*) > 1
         ) duplicados'
      into v_duplicados;

    if v_duplicados > 0 then
      raise exception
        'APPLY detenido: existen % torneo(s) con mas de un destacado_inicio=true.',
        v_duplicados;
    end if;
  end if;

  select
    format_type(attr.atttypid, attr.atttypmod) as data_type,
    attr.attnotnull as not_null
  into v_destacado_titulo
  from pg_attribute attr
  where attr.attrelid = 'public.partidos'::regclass
    and attr.attname = 'destacado_titulo'
    and not attr.attisdropped;

  v_destacado_titulo_exists := found;

  if v_destacado_titulo_exists then
    if v_destacado_titulo.data_type <> 'text' then
      raise exception
        'APPLY detenido: public.partidos.destacado_titulo existe con tipo %, se esperaba text.',
        v_destacado_titulo.data_type;
    end if;

    if v_destacado_titulo.not_null is true then
      raise exception
        'APPLY detenido: public.partidos.destacado_titulo existe como NOT NULL, se esperaba nullable.';
    end if;
  end if;

  v_index_oid := to_regclass('public.partidos_destacado_inicio_torneo_idx');

  if v_index_oid is not null then
    select pg_get_indexdef(v_index_oid::oid)
      into v_indexdef;

    if v_indexdef <> v_expected_indexdef then
      raise exception
        'APPLY detenido: el indice public.partidos_destacado_inicio_torneo_idx existe con otra definicion: %',
        v_indexdef;
    end if;
  end if;
end $$;

alter table public.partidos
  add column if not exists destacado_inicio boolean not null default false,
  add column if not exists destacado_titulo text;

comment on column public.partidos.destacado_inicio is
  'Marca manual para mostrar como maximo un partido destacado en el Inicio del torneo.';

comment on column public.partidos.destacado_titulo is
  'Titulo editorial opcional para el partido destacado del Inicio.';

create unique index if not exists partidos_destacado_inicio_torneo_idx
  on public.partidos (torneo_id)
  where destacado_inicio = true;

commit;

-- ============================================================================
-- 3. POSTCHECK
-- ============================================================================

select
  'POSTCHECK - destacado_inicio' as etapa,
  format_type(attr.atttypid, attr.atttypmod) as data_type,
  attr.attnotnull as not_null,
  pg_get_expr(def.adbin, def.adrelid) as default_expr,
  (
    format_type(attr.atttypid, attr.atttypmod) = 'boolean'
    and attr.attnotnull is true
    and pg_get_expr(def.adbin, def.adrelid) = 'false'
  ) as ok
from pg_attribute attr
left join pg_attrdef def
  on def.adrelid = attr.attrelid
  and def.adnum = attr.attnum
where attr.attrelid = 'public.partidos'::regclass
  and attr.attname = 'destacado_inicio'
  and not attr.attisdropped;

select
  'POSTCHECK - destacado_titulo' as etapa,
  format_type(attr.atttypid, attr.atttypmod) as data_type,
  attr.attnotnull is false as nullable,
  attr.attnotnull as not_null,
  (
    format_type(attr.atttypid, attr.atttypmod) = 'text'
    and attr.attnotnull is false
  ) as ok
from pg_attribute attr
where attr.attrelid = 'public.partidos'::regclass
  and attr.attname = 'destacado_titulo'
  and not attr.attisdropped;

select
  'POSTCHECK - indice' as etapa,
  pg_get_indexdef('public.partidos_destacado_inicio_torneo_idx'::regclass) as indexdef,
  pg_get_indexdef('public.partidos_destacado_inicio_torneo_idx'::regclass) =
    'CREATE UNIQUE INDEX partidos_destacado_inicio_torneo_idx ON public.partidos USING btree (torneo_id) WHERE (destacado_inicio = true)' as ok;

select
  'POSTCHECK - total destacados' as etapa,
  count(*) as total_destacados
from public.partidos
where destacado_inicio is true;

with destacados as (
  select
    torneo_id::text as torneo_id,
    count(*) as cantidad
  from public.partidos
  where destacado_inicio is true
  group by torneo_id
),
salida as (
  select torneo_id, cantidad from destacados
  union all
  select 'sin destacados' as torneo_id, 0::bigint as cantidad
  where not exists (select 1 from destacados)
)
select
  'POSTCHECK - destacados por torneo' as etapa,
  torneo_id,
  cantidad
from salida
order by
  case when torneo_id = 'sin destacados' then 0 else 1 end,
  torneo_id;

select
  'POSTCHECK - maximo uno por torneo' as etapa,
  not exists (
    select 1
    from public.partidos
    where destacado_inicio is true
    group by torneo_id
    having count(*) > 1
  ) as ok_sin_mas_de_un_destacado_por_torneo;

-- ============================================================================
-- 4. ROLLBACK MANUAL
-- ============================================================================
-- Ejecutar manualmente solo si se decide revertir esta migracion.
-- No ejecutar junto con el APPLY.

/*
drop index if exists public.partidos_destacado_inicio_torneo_idx;

alter table public.partidos
  drop column if exists destacado_titulo,
  drop column if exists destacado_inicio;
*/
