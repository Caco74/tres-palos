begin;

-- Torneo Clausura 2026, segun sorteo publicado el 25/06/2026.
-- Fuente operativa: capturas adjuntas de estadisticasligacanadense.
-- Ejecutar cuando el sitio deba pasar del Apertura al Clausura.

insert into public.torneos (
  anio,
  tipo,
  nombre,
  activo,
  fecha_inicio
)
values (
  2026,
  'clausura',
  'Clausura 2026',
  true,
  '2026-07-05'
)
on conflict (anio, tipo) do update
set
  nombre = excluded.nombre,
  activo = true,
  fecha_inicio = excluded.fecha_inicio,
  actualizado_en = now();

update public.torneos
set
  activo = false,
  actualizado_en = now()
where activo is true
  and not (anio = 2026 and tipo = 'clausura');

with zonas(club_id, zona) as (
  values
    -- Zona 1: Correa, Argentino, Sportivo, ADEO, Sport, Sportsman, Cosmopolita.
    (53, 1),
    (55, 1),
    (43, 1),
    (46, 1),
    (47, 1),
    (54, 1),
    (49, 1),
    -- Zona 2: Union VE, Belgrano, Montes de Oca, Carcarana, Campana, America, Newell's.
    (56, 2),
    (61, 2),
    (48, 2),
    (57, 2),
    (52, 2),
    (58, 2),
    (59, 2),
    -- Zona 3: Union Tortugas, Defensores, Barraca, Almafuerte, Williams Kemmis, San Jeronimo, El Porvenir.
    (62, 3),
    (44, 3),
    (63, 3),
    (50, 3),
    (51, 3),
    (60, 3),
    (45, 3)
)
update public.clubes club
set
  zona = zonas.zona,
  actualizado_en = now()
from zonas
where club.id = zonas.club_id
  and club.zona is distinct from zonas.zona;

do $$
declare
  v_clausura_id bigint;
begin
  select id
  into v_clausura_id
  from public.torneos
  where anio = 2026 and tipo = 'clausura'
  limit 1;

  if v_clausura_id is null then
    raise exception 'No se encontro el torneo Clausura 2026.';
  end if;

  with fixture(fecha, zona, local_id, visitante_id, fecha_partido) as (
    values
      -- Fecha 1 - Zona 1. Libre: Argentino.
      (1, 1, 49, 46, '2026-07-05'::date),
      (1, 1, 47, 54, '2026-07-05'::date),
      (1, 1, 43, 53, '2026-07-05'::date),
      -- Fecha 1 - Zona 2. Libre: Montes de Oca.
      (1, 2, 52, 58, '2026-07-05'::date),
      (1, 2, 59, 57, '2026-07-05'::date),
      (1, 2, 61, 56, '2026-07-05'::date),
      -- Fecha 1 - Zona 3. Libre: Williams Kemmis.
      (1, 3, 44, 45, '2026-07-05'::date),
      (1, 3, 60, 63, '2026-07-05'::date),
      (1, 3, 50, 62, '2026-07-05'::date)
  )
  insert into public.partidos (
    torneo_id,
    tipo,
    fecha,
    zona,
    local_id,
    visitante_id,
    local,
    visitante,
    fecha_partido,
    estado
  )
  select
    v_clausura_id,
    'regular',
    fixture.fecha,
    fixture.zona,
    club_local.id,
    club_visitante.id,
    club_local.nombre_oficial,
    club_visitante.nombre_oficial,
    fixture.fecha_partido,
    'programado'
  from fixture
  join public.clubes club_local
    on club_local.id = fixture.local_id
  join public.clubes club_visitante
    on club_visitante.id = fixture.visitante_id
  where not exists (
    select 1
    from public.partidos partido
    where partido.torneo_id = v_clausura_id
      and partido.tipo = 'regular'
      and partido.fecha = fixture.fecha
      and partido.zona = fixture.zona
      and partido.local_id = fixture.local_id
      and partido.visitante_id = fixture.visitante_id
  );
end;
$$;

insert into public.inscripciones_jugadores (
  jugador_id,
  club_id,
  torneo_id,
  posicion,
  dorsal,
  estado,
  fecha_desde,
  fuente,
  observaciones
)
select
  inscripcion.jugador_id,
  inscripcion.club_id,
  clausura.id,
  inscripcion.posicion,
  inscripcion.dorsal,
  'por_verificar',
  clausura.fecha_inicio,
  inscripcion.fuente,
  'Copiado desde Apertura 2026 para preparar Clausura 2026.'
from public.inscripciones_jugadores inscripcion
join public.torneos apertura
  on apertura.id = inscripcion.torneo_id
  and apertura.anio = 2026
  and apertura.tipo = 'apertura'
join public.torneos clausura
  on clausura.anio = 2026
  and clausura.tipo = 'clausura'
where inscripcion.estado <> 'inactivo'
on conflict (jugador_id, club_id, torneo_id) do nothing;

commit;
