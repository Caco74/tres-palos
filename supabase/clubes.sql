create table if not exists public.clubes (
  id bigint primary key,
  nombre_oficial text not null unique,
  nombre_corto text not null,
  apodo text null,
  ciudad text not null,
  provincia text not null default 'Santa Fe',
  zona integer not null check (zona between 1 and 3),
  escudo_url text null,
  color_primario text null check (
    color_primario is null or color_primario ~ '^#[0-9A-Fa-f]{6}$'
  ),
  color_secundario text null check (
    color_secundario is null or color_secundario ~ '^#[0-9A-Fa-f]{6}$'
  ),
  aliases text[] not null default '{}',
  activo boolean not null default true,
  actualizado_en timestamptz not null default now()
);

alter table public.clubes enable row level security;

drop policy if exists clubes_lectura_publica on public.clubes;
create policy clubes_lectura_publica
on public.clubes
for select
to anon, authenticated
using (true);

insert into public.clubes (
  id,
  nombre_oficial,
  nombre_corto,
  ciudad,
  zona,
  escudo_url,
  aliases
)
values
  (43, 'Sportivo A. Club', 'Sportivo', 'Las Parejas', 3,
    '/assets/img/sportivo.png', array['Sportivo Atlético Club', 'Sportivo']),
  (44, 'C.A. Defensores', 'Defensores', 'Armstrong', 2,
    '/assets/img/defensores.png', array['Defensores de Armstrong', 'Defensores']),
  (45, 'C.A. El Porvenir del Norte', 'Porvenir', 'San Jerónimo Sud', 1,
    '/assets/img/porvenir.png', array['El Porvenir del Norte', 'Porvenir']),
  (46, 'AD Everton/Olimpia', 'ADEO', 'Cañada de Gómez', 2,
    '/assets/img/everton.png', array['Everton Olimpia', 'ADEO']),
  (47, 'Sport C. Cañadense', 'Sport', 'Cañada de Gómez', 2,
    '/assets/img/sport.png', array['Sport Club Cañadense', 'Sport']),
  (48, 'C.A. Montes de Oca', 'Montes', 'Montes de Oca', 3,
    '/assets/img/montes.png', array['Atlético Montes de Oca', 'Montes']),
  (49, 'C.A. Cosmopolita', 'Cosmo', 'Roldán', 1,
    '/assets/img/cosmo.png', array['Cosmopolita', 'Cosmo']),
  (50, 'C.A. Almafuerte', 'Almafuerte', 'Las Rosas', 3,
    '/assets/img/almafuerte.png', array['Almafuerte']),
  (51, 'C.A. Williams Kemmis', 'Kemmis', 'Las Rosas', 3,
    '/assets/img/kemmis.png', array['Williams Kemmis', 'Kemmis']),
  (52, 'C.A. Campaña', 'Campaña', 'Carcarañá', 1,
    '/assets/img/campana.png', array['Atlético Campaña', 'Campaña']),
  (53, 'C.A. Correa', 'Correa', 'Correa', 1,
    '/assets/img/correa.png', array['Atlético Correa', 'Correa']),
  (54, 'Def. Sportsman', 'Sportsman', 'Roldán', 1,
    '/assets/img/sportsman.png', array['Defensores de Sportsman', 'Sportsman']),
  (55, 'Argentino A. Club', 'Argentino', 'Las Parejas', 3,
    '/assets/img/argentino.png', array['Argentino Atlético Club', 'Argentino']),
  (56, 'C.A. Unión C.S.D.', 'Unión', 'Villa Eloísa', 2,
    '/assets/img/union.png', array['Unión de Villa Eloísa', 'Unión CSD']),
  (57, 'C.A. Carcarañá', 'Carcarañá', 'Carcarañá', 1,
    '/assets/img/carcarana.png', array['Atlético Carcarañá', 'Carcarañá']),
  (58, 'C.A. América', 'América', 'Cañada de Gómez', 2,
    '/assets/img/america.png', array['Atlético América', 'América']),
  (59, 'C.A. N.O. Boys', 'Newell''s', 'Cañada de Gómez', 2,
    '/assets/img/newells.png', array['Newell''s Old Boys', 'Newells']),
  (60, 'C.A. San Jerónimo', 'San Jerónimo', 'San Jerónimo Sud', 1,
    '/assets/img/sanjeronimo.png', array['Atlético San Jerónimo', 'San Jerónimo']),
  (61, 'Belgrano A.C.', 'Belgrano', 'Las Rosas', 3,
    '/assets/img/belgrano.png', array['Belgrano Atlético Club', 'Belgrano']),
  (62, 'C.A. Unión Tortugas', 'Unión T.', 'Tortugas', 3,
    '/assets/img/uniont.png', array['Unión de Tortugas', 'Unión Tortugas']),
  (63, 'C.A. Barraca', 'Barraca', 'Armstrong', 2,
    '/assets/img/barraca.png', array['Club Atlético Barraca', 'Barraca'])
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where
      conname = 'partidos_local_club_fk'
      and conrelid = 'public.partidos'::regclass
  ) then
    alter table public.partidos
      add constraint partidos_local_club_fk
      foreign key (local_id)
      references public.clubes(id)
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where
      conname = 'partidos_visitante_club_fk'
      and conrelid = 'public.partidos'::regclass
  ) then
    alter table public.partidos
      add constraint partidos_visitante_club_fk
      foreign key (visitante_id)
      references public.clubes(id)
      not valid;
  end if;

  if
    to_regclass('public.eventos_partido') is not null
    and not exists (
      select 1
      from pg_constraint
      where
        conname = 'eventos_partido_club_fk'
        and conrelid = 'public.eventos_partido'::regclass
    )
  then
    alter table public.eventos_partido
      add constraint eventos_partido_club_fk
      foreign key (equipo_id)
      references public.clubes(id)
      not valid;
  end if;
end;
$$;

alter table public.partidos
  validate constraint partidos_local_club_fk;

alter table public.partidos
  validate constraint partidos_visitante_club_fk;

do $$
begin
  if to_regclass('public.eventos_partido') is not null then
    alter table public.eventos_partido
      validate constraint eventos_partido_club_fk;
  end if;
end;
$$;

create index if not exists clubes_activos_zona_idx
  on public.clubes (activo, zona, nombre_corto);

grant select on table public.clubes to anon, authenticated;
grant select, insert, update on table public.clubes to service_role;

comment on table public.clubes is
  'Ficha central de clubes de la Liga Cañadense utilizada por partidos, incidencias y planteles.';
