-- Vincula partidos antiguos a la ficha central de clubes.
-- Es seguro ejecutarlo mas de una vez: solo completa IDs vacios.

with candidatos_local as (
  select
    p.id as partido_id,
    min(c.id) as club_id
  from public.partidos p
  join public.clubes c
    on (
      lower(btrim(p.local)) = lower(btrim(c.nombre_oficial))
      or lower(btrim(p.local)) = lower(btrim(c.nombre_corto))
      or exists (
        select 1
        from unnest(c.aliases) alias
        where lower(btrim(p.local)) = lower(btrim(alias))
      )
    )
  where p.local_id is null
    and p.local is not null
  group by p.id
  having count(distinct c.id) = 1
)
update public.partidos p
set local_id = candidatos_local.club_id
from candidatos_local
where p.id = candidatos_local.partido_id;

with candidatos_visitante as (
  select
    p.id as partido_id,
    min(c.id) as club_id
  from public.partidos p
  join public.clubes c
    on (
      lower(btrim(p.visitante)) = lower(btrim(c.nombre_oficial))
      or lower(btrim(p.visitante)) = lower(btrim(c.nombre_corto))
      or exists (
        select 1
        from unnest(c.aliases) alias
        where lower(btrim(p.visitante)) = lower(btrim(alias))
      )
    )
  where p.visitante_id is null
    and p.visitante is not null
  group by p.id
  having count(distinct c.id) = 1
)
update public.partidos p
set visitante_id = candidatos_visitante.club_id
from candidatos_visitante
where p.id = candidatos_visitante.partido_id;

select
  id,
  tipo,
  fase,
  numero_playoff,
  local,
  local_id,
  visitante,
  visitante_id
from public.partidos
where
  (local is not null and local_id is null)
  or (visitante is not null and visitante_id is null)
order by id;
