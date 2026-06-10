create table if not exists public.analytics_eventos (
  id bigint generated always as identity primary key,
  evento text not null check (
    evento in ('vista_pestana', 'vista_partido')
  ),
  objetivo text not null,
  partido_id bigint null,
  origen text null,
  dispositivo text not null check (
    dispositivo in ('movil', 'tablet', 'escritorio')
  ),
  ruta text not null default '/',
  creado_en timestamptz not null default now()
);

alter table public.analytics_eventos enable row level security;

create index if not exists analytics_eventos_creado_en_idx
  on public.analytics_eventos (creado_en desc);

create index if not exists analytics_eventos_evento_objetivo_idx
  on public.analytics_eventos (evento, objetivo);

create index if not exists analytics_eventos_partido_id_idx
  on public.analytics_eventos (partido_id)
  where partido_id is not null;

comment on table public.analytics_eventos is
  'Medicion anonima de pestañas y partidos consultados en Tres Palos.';
