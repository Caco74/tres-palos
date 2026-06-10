alter table public.partidos
  add column if not exists arbitro text;

comment on column public.partidos.arbitro is
  'Arbitro principal del partido. Se muestra como A confirmar cuando queda vacio.';
