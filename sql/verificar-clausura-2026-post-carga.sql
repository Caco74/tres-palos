-- Verificacion posterior solo lectura - Clausura 2026.
-- Ejecutar despues de una carga autorizada.

with partidos_clausura as (
  select *
  from public.partidos
  where torneo_id = 2
)
select 'total_clausura_114' as chequeo, count(*)::text as valor, count(*) = 114 as ok
from partidos_clausura
union all
select 'zona_1_42', count(*) filter (where zona = 1)::text, count(*) filter (where zona = 1) = 42
from partidos_clausura
union all
select 'zona_2_30', count(*) filter (where zona = 2)::text, count(*) filter (where zona = 2) = 30
from partidos_clausura
union all
select 'zona_3_42', count(*) filter (where zona = 3)::text, count(*) filter (where zona = 3) = 42
from partidos_clausura
union all
select 'todos_torneo_id_2', count(*) filter (where torneo_id = 2)::text, count(*) filter (where torneo_id = 2) = 114
from partidos_clausura
union all
select 'todos_regular', count(*) filter (where tipo = 'regular')::text, count(*) filter (where tipo = 'regular') = 114
from partidos_clausura
union all
select 'todos_fase_null', count(*) filter (where fase is null)::text, count(*) filter (where fase is null) = 114
from partidos_clausura
union all
select 'todos_programados', count(*) filter (where estado = 'programado')::text, count(*) filter (where estado = 'programado') = 114
from partidos_clausura
union all
select 'todos_sin_goles', count(*) filter (where goles_local is null and goles_visitante is null)::text, count(*) filter (where goles_local is null and goles_visitante is null) = 114
from partidos_clausura
union all
select 'todos_sin_penales', count(*) filter (where penales_local is null and penales_visitante is null)::text, count(*) filter (where penales_local is null and penales_visitante is null) = 114
from partidos_clausura
union all
select 'todos_sin_fecha_hora_estadio', count(*) filter (
  where fecha_partido is null and dia is null and hora is null and estadio is null and arbitro is null
)::text, count(*) filter (
  where fecha_partido is null and dia is null and hora is null and estadio is null and arbitro is null
) = 114
from partidos_clausura
union all
select 'todos_source_null', count(*) filter (where source_local is null and source_visitante is null)::text, count(*) filter (where source_local is null and source_visitante is null) = 114
from partidos_clausura
union all
select 'sin_local_igual_visitante', count(*) filter (where local_id = visitante_id or local = visitante)::text, count(*) filter (where local_id = visitante_id or local = visitante) = 0
from partidos_clausura
union all
select 'carcarana_0', count(*) filter (
  where local_id = 57 or visitante_id = 57 or local ilike '%Carcara%' or visitante ilike '%Carcara%'
)::text, count(*) filter (
  where local_id = 57 or visitante_id = 57 or local ilike '%Carcara%' or visitante ilike '%Carcara%'
) = 0
from partidos_clausura
union all
select 'duplicados_0', count(*)::text, count(*) = 0
from (
  select torneo_id, tipo, fecha, zona, local_id, visitante_id
  from public.partidos
  where torneo_id = 2
    and tipo = 'regular'
  group by torneo_id, tipo, fecha, zona, local_id, visitante_id
  having count(*) > 1
) duplicados
union all
select 'apertura_140', count(*)::text, count(*) = 140
from public.partidos
where torneo_id = 1
union all
select 'clausura_no_activo', count(*)::text, count(*) = 1
from public.torneos
where id = 2
  and anio = 2026
  and tipo = 'clausura'
  and nombre = 'Clausura 2026'
  and activo is false
union all
select 'apertura_activo', count(*)::text, count(*) = 1
from public.torneos
where id = 1
  and anio = 2026
  and tipo = 'apertura'
  and nombre = 'Apertura 2026'
  and activo is true;
