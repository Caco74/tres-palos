-- Verificacion posterior solo lectura - cierre por fecha y zona.

with funciones_requeridas(nombre, argumentos) as (
  values
    ('tp_etapa_regular_fecha', 'p_valor text'),
    ('tp_etapa_regular_zona', 'p_valor text'),
    (
      'tp_guardar_respaldo_etapa',
      'p_torneo_id bigint, p_tipo text, p_valor text, p_etiqueta text, p_motivo text, p_nota text'
    ),
    (
      'tp_cerrar_etapa',
      'p_torneo_id bigint, p_tipo text, p_valor text, p_etiqueta text, p_nota text'
    ),
    ('tp_restaurar_respaldo', 'p_torneo_id bigint, p_respaldo_id bigint')
),
funciones as (
  select
    requerida.nombre,
    requerida.argumentos,
    count(procedimiento.oid) as cantidad,
    coalesce(
      string_agg(
        pg_get_function_identity_arguments(procedimiento.oid),
        ' | ' order by pg_get_function_identity_arguments(procedimiento.oid)
      ),
      ''
    ) as firmas
  from funciones_requeridas requerida
  left join pg_proc procedimiento
    on procedimiento.proname = requerida.nombre
    and pg_get_function_identity_arguments(procedimiento.oid) = requerida.argumentos
  left join pg_namespace esquema
    on esquema.oid = procedimiento.pronamespace
    and esquema.nspname = 'public'
  group by requerida.nombre, requerida.argumentos
),
helpers as (
  select
    public.tp_etapa_regular_fecha('1') as legacy_fecha,
    public.tp_etapa_regular_zona('1') as legacy_zona,
    public.tp_etapa_regular_fecha('fecha:1:zona:1') as fecha_zona_fecha,
    public.tp_etapa_regular_zona('fecha:1:zona:1') as fecha_zona_zona,
    public.tp_etapa_regular_fecha('octavos') as playoff_fecha,
    public.tp_etapa_regular_zona('octavos') as playoff_zona
),
conteos as (
  select
    (select count(*) from public.etapas_estado) as etapas_estado_total,
    (select count(*) from public.respaldos_etapa) as respaldos_etapa_total,
    (
      select count(*)
      from public.etapas_estado
      where torneo_id = 2
    ) as clausura_estados,
    (
      select count(*)
      from public.respaldos_etapa
      where torneo_id = 2
    ) as clausura_respaldos,
    (
      select count(*)
      from public.etapas_estado
      where torneo_id = 1
        and tipo = 'regular'
        and valor ~ '^[0-9]+$'
        and public.tp_etapa_regular_fecha(valor) = valor::integer
        and public.tp_etapa_regular_zona(valor) is null
    ) as apertura_estados_legacy,
    (
      select count(*)
      from public.respaldos_etapa
      where torneo_id = 1
        and tipo = 'regular'
        and valor ~ '^[0-9]+$'
        and public.tp_etapa_regular_fecha(valor) = valor::integer
        and public.tp_etapa_regular_zona(valor) is null
    ) as apertura_respaldos_legacy,
    (
      select count(*)
      from public.partidos
      where torneo_id = 1
    ) as apertura_partidos,
    (
      select count(*)
      from public.partidos
      where torneo_id = 2
        and (
          estado is distinct from 'programado'
          or goles_local is not null
          or goles_visitante is not null
          or penales_local is not null
          or penales_visitante is not null
        )
    ) as clausura_partidos_con_resultado_o_cierre,
    (
      select count(*)
      from public.eventos_partido evento
      join public.partidos partido
        on partido.id = evento.partido_id
      where partido.torneo_id = 2
    ) as clausura_incidencias,
    (
      select count(*)
      from public.torneos
      where activo is true
    ) as torneos_activos,
    (
      select count(*)
      from public.torneos
      where id = 1
        and nombre = 'Apertura 2026'
        and activo is true
    ) as apertura_activo,
    (
      select count(*)
      from public.torneos
      where id = 2
        and nombre = 'Clausura 2026'
        and activo is false
    ) as clausura_inactivo
)
select
  'funciones_requeridas' as chequeo,
  count(*) filter (where cantidad = 1)::text as valor,
  count(*) filter (where cantidad = 1) = 5 as ok,
  string_agg(
    nombre || '(' || argumentos || ')=' || cantidad::text ||
      case when firmas = '' then '' else ' [' || firmas || ']' end,
    '; ' order by nombre
  ) as detalle
from funciones
union all
select
  'helper_legacy_fecha',
  legacy_fecha::text,
  legacy_fecha = 1,
  'tp_etapa_regular_fecha(''1'')'
from helpers
union all
select
  'helper_legacy_zona_null',
  coalesce(legacy_zona, 'null'),
  legacy_zona is null,
  'tp_etapa_regular_zona(''1'')'
from helpers
union all
select
  'helper_fecha_zona_fecha',
  fecha_zona_fecha::text,
  fecha_zona_fecha = 1,
  'tp_etapa_regular_fecha(''fecha:1:zona:1'')'
from helpers
union all
select
  'helper_fecha_zona_zona',
  coalesce(fecha_zona_zona, 'null'),
  fecha_zona_zona = '1',
  'tp_etapa_regular_zona(''fecha:1:zona:1'')'
from helpers
union all
select
  'helper_playoff_no_regular',
  concat(
    'fecha=',
    coalesce(playoff_fecha::text, 'null'),
    ', zona=',
    coalesce(playoff_zona, 'null')
  ),
  playoff_fecha is null and playoff_zona is null,
  'octavos no se interpreta como etapa regular'
from helpers
union all
select
  'etapas_estado_2_filas',
  etapas_estado_total::text,
  etapas_estado_total = 2,
  'cantidad total posterior'
from conteos
union all
select
  'respaldos_etapa_2_filas',
  respaldos_etapa_total::text,
  respaldos_etapa_total = 2,
  'cantidad total posterior'
from conteos
union all
select
  'clausura_sin_estados_nuevos',
  clausura_estados::text,
  clausura_estados = 0,
  'torneo_id=2 en etapas_estado'
from conteos
union all
select
  'clausura_sin_respaldos_nuevos',
  clausura_respaldos::text,
  clausura_respaldos = 0,
  'torneo_id=2 en respaldos_etapa'
from conteos
union all
select
  'apertura_legacy_estados_legibles',
  apertura_estados_legacy::text,
  apertura_estados_legacy > 0,
  'valores regulares numericos interpretables'
from conteos
union all
select
  'apertura_legacy_respaldos_legibles',
  apertura_respaldos_legacy::text,
  apertura_respaldos_legacy > 0,
  'valores regulares numericos interpretables'
from conteos
union all
select
  'apertura_partidos_140',
  apertura_partidos::text,
  apertura_partidos = 140,
  'historial de Apertura'
from conteos
union all
select
  'clausura_sin_resultados_o_cierres',
  clausura_partidos_con_resultado_o_cierre::text,
  clausura_partidos_con_resultado_o_cierre = 0,
  'partidos torneo_id=2 con estado o marcador fuera de programado/null'
from conteos
union all
select
  'clausura_sin_incidencias',
  clausura_incidencias::text,
  clausura_incidencias = 0,
  'eventos asociados a partidos torneo_id=2'
from conteos
union all
select
  'torneo_activo_sin_cambios',
  concat(
    'activos=',
    torneos_activos,
    ', apertura=',
    apertura_activo,
    ', clausura_inactivo=',
    clausura_inactivo
  ),
  torneos_activos = 1
    and apertura_activo = 1
    and clausura_inactivo = 1,
  'Apertura sigue activo y Clausura sigue inactivo'
from conteos;
