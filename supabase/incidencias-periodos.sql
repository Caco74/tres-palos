begin;

alter table public.eventos_partido
  add column if not exists periodo text null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where
      conname = 'eventos_partido_periodo_check'
      and conrelid = 'public.eventos_partido'::regclass
  ) then
    alter table public.eventos_partido
      add constraint eventos_partido_periodo_check
      check (
        periodo is null
        or periodo in ('primer_tiempo', 'segundo_tiempo')
      )
      not valid;
  end if;
end;
$$;

alter table public.eventos_partido
  validate constraint eventos_partido_periodo_check;

comment on column public.eventos_partido.periodo is
  'Periodo del partido: primer_tiempo o segundo_tiempo.';

comment on column public.eventos_partido.minuto is
  'Minuto total del partido, opcional cuando la fuente lo informa.';

commit;
