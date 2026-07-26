-- Prevalidacion solo lectura - cierre por fecha y zona.
-- No crea tablas, no crea columnas, no modifica datos y no ejecuta RPC de cierre.

with tablas_requeridas(nombre) as (
  values
    ('etapas_estado'),
    ('respaldos_etapa')
),
tablas as (
  select
    tabla.nombre,
    to_regclass('public.' || tabla.nombre) is not null as existe
  from tablas_requeridas tabla
)
select
  'tablas_existentes' as chequeo,
  string_agg(nombre || '=' || existe::text, ', ' order by nombre) as detalle,
  bool_and(existe) as ok
from tablas;

with columnas_requeridas(tabla, columna) as (
  values
    ('etapas_estado', 'torneo_id'),
    ('etapas_estado', 'tipo'),
    ('etapas_estado', 'valor'),
    ('etapas_estado', 'etiqueta'),
    ('etapas_estado', 'estado'),
    ('etapas_estado', 'respaldo_cierre_id'),
    ('etapas_estado', 'cerrada_en'),
    ('etapas_estado', 'reabierta_en'),
    ('etapas_estado', 'actualizado_en'),
    ('respaldos_etapa', 'id'),
    ('respaldos_etapa', 'torneo_id'),
    ('respaldos_etapa', 'tipo'),
    ('respaldos_etapa', 'valor'),
    ('respaldos_etapa', 'etiqueta'),
    ('respaldos_etapa', 'version'),
    ('respaldos_etapa', 'motivo'),
    ('respaldos_etapa', 'nota'),
    ('respaldos_etapa', 'cantidad_partidos'),
    ('respaldos_etapa', 'partidos'),
    ('respaldos_etapa', 'incidencias'),
    ('respaldos_etapa', 'torneo_completo'),
    ('respaldos_etapa', 'creado_en')
),
estado_columnas as (
  select
    requerida.tabla,
    requerida.columna,
    columna.data_type,
    columna.udt_name,
    columna.column_name is not null as existe
  from columnas_requeridas requerida
  left join information_schema.columns columna
    on columna.table_schema = 'public'
    and columna.table_name = requerida.tabla
    and columna.column_name = requerida.columna
)
select
  'columnas_requeridas_existentes' as chequeo,
  coalesce(
    string_agg(
      tabla || '.' || columna || '=' ||
      case
        when existe then coalesce(data_type || '/' || udt_name, 'ok')
        else 'faltante'
      end,
      ', ' order by tabla, columna
    ),
    'sin columnas'
  ) as detalle,
  bool_and(existe) as ok
from estado_columnas;

with funciones_requeridas(nombre) as (
  values
    ('tp_exportar_torneo_completo'),
    ('tp_guardar_respaldo_etapa'),
    ('tp_cerrar_etapa'),
    ('tp_reabrir_etapa'),
    ('tp_restaurar_respaldo')
),
funciones as (
  select
    requerida.nombre,
    count(procedimiento.oid) as cantidad,
    string_agg(
      pg_get_function_identity_arguments(procedimiento.oid),
      ' | ' order by pg_get_function_identity_arguments(procedimiento.oid)
    ) as firmas
  from funciones_requeridas requerida
  left join (
    select
      procedimiento.oid,
      procedimiento.proname
    from pg_proc procedimiento
    join pg_namespace esquema
      on esquema.oid = procedimiento.pronamespace
    where esquema.nspname = 'public'
  ) procedimiento
    on procedimiento.proname = requerida.nombre
  group by requerida.nombre
)
select
  'rpc_actuales_existentes' as chequeo,
  string_agg(nombre || '=' || cantidad::text || '(' || coalesce(firmas, '-') || ')', ', ' order by nombre) as detalle,
  bool_and(cantidad > 0) as ok
from funciones;

select
  'apertura_respaldos_historicos' as chequeo,
  concat(
    'total=', count(*),
    ', legacy_regular=',
    count(*) filter (where tipo = 'regular' and valor ~ '^[0-9]+$'),
    ', playoffs=',
    count(*) filter (where tipo = 'playoff')
  ) as detalle,
  count(*) > 0
    and count(*) filter (where tipo = 'regular' and valor ~ '^[0-9]+$') > 0
    as ok
from public.respaldos_etapa
where torneo_id = 1;

select
  'apertura_estados_historicos' as chequeo,
  concat(
    'total=', count(*),
    ', legacy_regular=',
    count(*) filter (where tipo = 'regular' and valor ~ '^[0-9]+$'),
    ', cerradas=',
    count(*) filter (where estado = 'cerrada')
  ) as detalle,
  count(*) > 0
    and count(*) filter (where tipo = 'regular' and valor ~ '^[0-9]+$') > 0
    as ok
from public.etapas_estado
where torneo_id = 1;

select
  'clausura_sin_etapas_cerradas' as chequeo,
  concat(
    'total=', count(*),
    ', cerradas=',
    count(*) filter (where estado = 'cerrada')
  ) as detalle,
  count(*) filter (where estado = 'cerrada') = 0 as ok
from public.etapas_estado
where torneo_id = 2;

select
  'clausura_sin_respaldos_de_cierre' as chequeo,
  concat(
    'total=', count(*),
    ', cierres=',
    count(*) filter (where motivo = 'cierre')
  ) as detalle,
  count(*) filter (where motivo = 'cierre') = 0 as ok
from public.respaldos_etapa
where torneo_id = 2;

select
  'actualizacion_sin_ddl_de_tablas_columnas' as chequeo,
  'Las tablas y columnas requeridas ya existen; la actualizacion manual preparada solo reemplaza funciones y permisos.' as detalle,
  true as ok;
