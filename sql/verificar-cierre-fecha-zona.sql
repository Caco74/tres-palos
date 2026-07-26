-- Verificacion posterior solo lectura - cierre por fecha y zona.
-- No cierra etapas, no crea respaldos, no modifica partidos ni incidencias.

select
  'helper_legacy_fecha' as chequeo,
  public.tp_etapa_regular_fecha('1')::text as valor,
  public.tp_etapa_regular_fecha('1') = 1 as ok;

select
  'helper_legacy_zona_null' as chequeo,
  coalesce(public.tp_etapa_regular_zona('1'), 'null') as valor,
  public.tp_etapa_regular_zona('1') is null as ok;

select
  'helper_zona_fecha' as chequeo,
  public.tp_etapa_regular_fecha('fecha:1:zona:1')::text as valor,
  public.tp_etapa_regular_fecha('fecha:1:zona:1') = 1 as ok;

select
  'helper_zona_valor' as chequeo,
  public.tp_etapa_regular_zona('fecha:1:zona:1') as valor,
  public.tp_etapa_regular_zona('fecha:1:zona:1') = '1' as ok;

select
  'apertura_legacy_regular_interpretable' as chequeo,
  concat(
    'respaldos=',
    count(*) filter (where origen = 'respaldo'),
    ', estados=',
    count(*) filter (where origen = 'estado')
  ) as valor,
  count(*) > 0 as ok
from (
  select 'respaldo' as origen, valor
  from public.respaldos_etapa
  where torneo_id = 1
    and tipo = 'regular'
    and public.tp_etapa_regular_fecha(valor) is not null
    and public.tp_etapa_regular_zona(valor) is null
  union all
  select 'estado' as origen, valor
  from public.etapas_estado
  where torneo_id = 1
    and tipo = 'regular'
    and public.tp_etapa_regular_fecha(valor) is not null
    and public.tp_etapa_regular_zona(valor) is null
) item;

select
  'clausura_fecha_1_zona_1_tres_partidos' as chequeo,
  count(*)::text as valor,
  count(*) = 3 as ok
from public.partidos partido
where partido.torneo_id = 2
  and partido.tipo = 'regular'
  and partido.fecha = public.tp_etapa_regular_fecha('fecha:1:zona:1')
  and partido.zona::text = public.tp_etapa_regular_zona('fecha:1:zona:1');

select
  'clausura_fecha_1_zona_2_tres_partidos' as chequeo,
  count(*)::text as valor,
  count(*) = 3 as ok
from public.partidos partido
where partido.torneo_id = 2
  and partido.tipo = 'regular'
  and partido.fecha = public.tp_etapa_regular_fecha('fecha:1:zona:2')
  and partido.zona::text = public.tp_etapa_regular_zona('fecha:1:zona:2');

select
  'clausura_fecha_1_zona_3_tres_partidos' as chequeo,
  count(*)::text as valor,
  count(*) = 3 as ok
from public.partidos partido
where partido.torneo_id = 2
  and partido.tipo = 'regular'
  and partido.fecha = public.tp_etapa_regular_fecha('fecha:1:zona:3')
  and partido.zona::text = public.tp_etapa_regular_zona('fecha:1:zona:3');

select
  'clausura_zona_2_fechas_sin_partidos' as chequeo,
  count(*)::text as valor,
  count(*) = 0 as ok
from public.partidos partido
where partido.torneo_id = 2
  and partido.tipo = 'regular'
  and partido.zona::text = '2'
  and partido.fecha in (6, 7, 13, 14);

select
  'playoffs_por_fase_siguen_disponibles' as chequeo,
  concat(
    'apertura_octavos=',
    count(*) filter (
      where torneo_id = 1 and tipo = 'playoff' and fase = 'octavos'
    )
  ) as valor,
  count(*) filter (
    where torneo_id = 1 and tipo = 'playoff' and fase = 'octavos'
  ) >= 0 as ok
from public.partidos;

select
  'clausura_sin_etapas_cerradas_post' as chequeo,
  count(*) filter (where estado = 'cerrada')::text as valor,
  count(*) filter (where estado = 'cerrada') = 0 as ok
from public.etapas_estado
where torneo_id = 2;

select
  'clausura_sin_respaldos_de_cierre_post' as chequeo,
  count(*) filter (where motivo = 'cierre')::text as valor,
  count(*) filter (where motivo = 'cierre') = 0 as ok
from public.respaldos_etapa
where torneo_id = 2;
