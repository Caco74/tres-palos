-- Verificacion solo lectura - Clausura 2026 Primera Division
-- No contiene INSERT, UPDATE, DELETE, UPSERT, RPC ni cambios de esquema.

with params as (
  select 2::bigint as torneo_id, 2026::smallint as anio, 'clausura'::text as tipo
)
select
  'torneo_clausura' as chequeo,
  torneo.id,
  torneo.anio,
  torneo.tipo,
  torneo.nombre,
  torneo.activo,
  torneo.fecha_inicio,
  torneo.fecha_fin,
  torneo.actualizado_en
from public.torneos torneo
join params
  on torneo.id = params.torneo_id
  and torneo.anio = params.anio
  and torneo.tipo = params.tipo;

with params as (
  select 2026::smallint as anio
)
select
  'torneos_2026' as chequeo,
  torneo.id,
  torneo.anio,
  torneo.tipo,
  torneo.nombre,
  torneo.activo,
  torneo.fecha_inicio,
  torneo.fecha_fin
from public.torneos torneo
join params on torneo.anio = params.anio
order by torneo.id;

with expected_clubs(nombre_fuente, nombre_en_proyecto, club_id, zona_clausura) as (
  values
    ('C.A. COSMOPOLITA', 'C.A. Cosmopolita', 49::bigint, 1),
    ('SPORT C. CAÑADENSE', 'Sport C. Cañadense', 47::bigint, 1),
    ('SPORTIVO A. CLUB', 'Sportivo A. Club', 43::bigint, 1),
    ('C.A. CORREA', 'C.A. Correa', 53::bigint, 1),
    ('DEF. SPORTSMAN', 'Def. Sportsman', 54::bigint, 1),
    ('AD.EVERTON/OLIMPIA', 'AD Everton/Olimpia', 46::bigint, 1),
    ('ARGENTINO A. CLUB', 'Argentino A. Club', 55::bigint, 1),
    ('C.A. MONTES DE OCA', 'C.A. Montes de Oca', 48::bigint, 2),
    ('C.A. N.O. BOYS', 'C.A. N.O. Boys', 59::bigint, 2),
    ('C.A. CAMPAÑA', 'C.A. Campaña', 52::bigint, 2),
    ('C.A. UNION C.S.D.', 'C.A. Unión C.S.D.', 56::bigint, 2),
    ('C.A. AMERICA', 'C.A. América', 58::bigint, 2),
    ('BELGRANO A.C.', 'Belgrano A.C.', 61::bigint, 2),
    ('C.A. DEFENSORES', 'C.A. Defensores', 44::bigint, 3),
    ('C.A. SAN JERONIMO', 'C.A. San Jerónimo', 60::bigint, 3),
    ('C.A. ALMAFUERTE', 'C.A. Almafuerte', 50::bigint, 3),
    ('C.A. UNION TORTUGAS', 'C.A. Unión Tortugas', 62::bigint, 3),
    ('C.A. BARRACA', 'C.A. Barraca', 63::bigint, 3),
    ('C.A. EL PORVENIR DEL NORTE', 'C.A. El Porvenir del Norte', 45::bigint, 3),
    ('C.A.WILLIAMS KEMMIS', 'C.A. Williams Kemmis', 51::bigint, 3)
)
select
  'clubes_mapeados' as chequeo,
  expected_clubs.nombre_fuente,
  expected_clubs.nombre_en_proyecto,
  expected_clubs.club_id,
  club.nombre_oficial,
  club.nombre_corto,
  club.activo,
  club.zona as zona_global_actual,
  expected_clubs.zona_clausura,
  case
    when club.id is null then 'no_encontrado'
    when club.nombre_oficial <> expected_clubs.nombre_en_proyecto then 'nombre_distinto'
    when club.activo is false then 'inactivo'
    else 'confirmado'
  end as estado_mapeo
from expected_clubs
left join public.clubes club
  on club.id = expected_clubs.club_id
order by expected_clubs.zona_clausura, expected_clubs.nombre_en_proyecto;

with expected_clubs(nombre_fuente, nombre_en_proyecto, club_id, zona_clausura) as (
  values
    ('C.A. COSMOPOLITA', 'C.A. Cosmopolita', 49::bigint, 1),
    ('SPORT C. CAÑADENSE', 'Sport C. Cañadense', 47::bigint, 1),
    ('SPORTIVO A. CLUB', 'Sportivo A. Club', 43::bigint, 1),
    ('C.A. CORREA', 'C.A. Correa', 53::bigint, 1),
    ('DEF. SPORTSMAN', 'Def. Sportsman', 54::bigint, 1),
    ('AD.EVERTON/OLIMPIA', 'AD Everton/Olimpia', 46::bigint, 1),
    ('ARGENTINO A. CLUB', 'Argentino A. Club', 55::bigint, 1),
    ('C.A. MONTES DE OCA', 'C.A. Montes de Oca', 48::bigint, 2),
    ('C.A. N.O. BOYS', 'C.A. N.O. Boys', 59::bigint, 2),
    ('C.A. CAMPAÑA', 'C.A. Campaña', 52::bigint, 2),
    ('C.A. UNION C.S.D.', 'C.A. Unión C.S.D.', 56::bigint, 2),
    ('C.A. AMERICA', 'C.A. América', 58::bigint, 2),
    ('BELGRANO A.C.', 'Belgrano A.C.', 61::bigint, 2),
    ('C.A. DEFENSORES', 'C.A. Defensores', 44::bigint, 3),
    ('C.A. SAN JERONIMO', 'C.A. San Jerónimo', 60::bigint, 3),
    ('C.A. ALMAFUERTE', 'C.A. Almafuerte', 50::bigint, 3),
    ('C.A. UNION TORTUGAS', 'C.A. Unión Tortugas', 62::bigint, 3),
    ('C.A. BARRACA', 'C.A. Barraca', 63::bigint, 3),
    ('C.A. EL PORVENIR DEL NORTE', 'C.A. El Porvenir del Norte', 45::bigint, 3),
    ('C.A.WILLIAMS KEMMIS', 'C.A. Williams Kemmis', 51::bigint, 3)
)
select
  'zonas_clausura_esperadas' as chequeo,
  zona_clausura,
  count(*) as clubes
from expected_clubs
group by zona_clausura
order by zona_clausura;

with params as (
  select 2::bigint as torneo_id
)
select
  'partidos_existentes_clausura' as chequeo,
  count(*) as partidos
from public.partidos partido
join params on partido.torneo_id = params.torneo_id;

with params as (
  select 2::bigint as torneo_id
)
select
  'partidos_por_zona_clausura' as chequeo,
  partido.zona,
  count(*) as partidos
from public.partidos partido
join params on partido.torneo_id = params.torneo_id
where partido.tipo = 'regular'
group by partido.zona
order by partido.zona;

with params as (
  select 2::bigint as torneo_id
)
select
  'partidos_por_fecha_y_zona_clausura' as chequeo,
  partido.fecha,
  partido.zona,
  count(*) as partidos
from public.partidos partido
join params on partido.torneo_id = params.torneo_id
where partido.tipo = 'regular'
group by partido.fecha, partido.zona
order by partido.fecha, partido.zona;

with params as (
  select 2::bigint as torneo_id, 57::bigint as carcarana_id
)
select
  'carcarana_en_clausura' as chequeo,
  count(*) as partidos
from public.partidos partido
join params on partido.torneo_id = params.torneo_id
where partido.local_id = params.carcarana_id
   or partido.visitante_id = params.carcarana_id
   or partido.local ilike '%Carcara%'
   or partido.visitante ilike '%Carcara%';

with params as (
  select 2::bigint as torneo_id
)
select
  'duplicados_clave_logica' as chequeo,
  partido.torneo_id,
  partido.tipo,
  partido.fecha,
  partido.zona,
  partido.local_id,
  partido.visitante_id,
  count(*) as cantidad,
  array_agg(partido.id order by partido.id) as partido_ids
from public.partidos partido
join params on partido.torneo_id = params.torneo_id
where partido.tipo = 'regular'
group by
  partido.torneo_id,
  partido.tipo,
  partido.fecha,
  partido.zona,
  partido.local_id,
  partido.visitante_id
having count(*) > 1
order by cantidad desc, partido.fecha, partido.zona;

with params as (
  select 2::bigint as torneo_id
)
select
  'inscripciones_jugadores_clausura_fuera_de_alcance' as chequeo,
  count(*) as inscripciones,
  count(distinct inscripcion.club_id) as clubes_con_inscripciones
from public.inscripciones_jugadores inscripcion
join params on inscripcion.torneo_id = params.torneo_id;

-- Chequeos posteriores a una carga futura del fixture completo.
with params as (
  select 2::bigint as torneo_id
),
partidos_clausura as (
  select *
  from public.partidos partido
  join params on partido.torneo_id = params.torneo_id
  where partido.tipo = 'regular'
)
select
  'post_carga_total_114' as chequeo,
  count(*) as valor,
  count(*) = 114 as ok
from partidos_clausura
union all
select
  'post_carga_zona_1_42',
  count(*) filter (where zona::text = '1'),
  count(*) filter (where zona::text = '1') = 42
from partidos_clausura
union all
select
  'post_carga_zona_2_30',
  count(*) filter (where zona::text = '2'),
  count(*) filter (where zona::text = '2') = 30
from partidos_clausura
union all
select
  'post_carga_zona_3_42',
  count(*) filter (where zona::text = '3'),
  count(*) filter (where zona::text = '3') = 42
from partidos_clausura
union all
select
  'post_carga_carcarana_0',
  count(*) filter (where local_id = 57 or visitante_id = 57),
  count(*) filter (where local_id = 57 or visitante_id = 57) = 0
from partidos_clausura
union all
select
  'post_carga_todos_programados',
  count(*) filter (where estado = 'programado'),
  count(*) filter (where estado = 'programado') = 114
from partidos_clausura
union all
select
  'post_carga_sin_resultados',
  count(*) filter (
    where goles_local is null
      and goles_visitante is null
      and penales_local is null
      and penales_visitante is null
  ),
  count(*) filter (
    where goles_local is null
      and goles_visitante is null
      and penales_local is null
      and penales_visitante is null
  ) = 114
from partidos_clausura;
