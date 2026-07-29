-- Verificacion posterior de identidad de jugadores.
-- Solo lectura. Ejecutar despues de una aplicacion futura autorizada.

with checks as (
  select
    'jugadores_nombre_normalizado_columna' as chequeo,
    exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'jugadores'
        and column_name = 'nombre_normalizado'
    ) as ok,
    'public.jugadores.nombre_normalizado' as detalle
  union all
  select
    'jugadores_aliases_tabla',
    to_regclass('public.jugadores_aliases') is not null,
    'tabla de aliases historicos'
  union all
  select
    'normalizador_funcion',
    to_regprocedure('public.tp_normalizar_nombre_jugador(text)') is not null,
    'funcion reutilizable de normalizacion'
  union all
  select
    'sin_unique_global_nombre_normalizado',
    not exists (
      select 1
      from pg_indexes
      where schemaname = 'public'
        and tablename = 'jugadores'
        and indexdef ilike '%unique%'
        and indexdef ilike '%nombre_normalizado%'
    ),
    'nombre_normalizado no debe ser identidad unica global'
  union all
  select
    'eventos_fk_inscripcion',
    exists (
      select 1
      from pg_constraint
      where conname = 'eventos_partido_inscripcion_fk'
        and conrelid = 'public.eventos_partido'::regclass
        and contype = 'f'
    ),
    'eventos_partido.inscripcion_jugador_id protegido por FK'
  union all
  select
    'eventos_texto_historico_conservado',
    exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'eventos_partido'
        and column_name = 'jugador'
    ),
    'columna jugador sigue disponible como snapshot'
  union all
  select
    'apertura_partidos_conservados',
    (
      select count(*)
      from public.partidos
      where torneo_id = 1
    ) = 140,
    (
      select count(*)::text
      from public.partidos
      where torneo_id = 1
    )
  union all
  select
    'apertura_eventos_conservados',
    (
      select count(*)
      from public.eventos_partido evento
      join public.partidos partido
        on partido.id = evento.partido_id
      where partido.torneo_id = 1
    ) >= 300,
    (
      select count(*)::text
      from public.eventos_partido evento
      join public.partidos partido
        on partido.id = evento.partido_id
      where partido.torneo_id = 1
    )
  union all
  select
    'clausura_partidos_conservados',
    (
      select count(*)
      from public.partidos
      where torneo_id = 2
    ) in (0, 114),
    (
      select count(*)::text
      from public.partidos
      where torneo_id = 2
    )
  union all
  select
    'clausura_sin_eventos_de_jugadores_si_corresponde',
    (
      select count(*)
      from public.eventos_partido evento
      join public.partidos partido
        on partido.id = evento.partido_id
      where partido.torneo_id = 2
        and (
          evento.inscripcion_jugador_id is not null
          or btrim(coalesce(evento.jugador, '')) <> ''
        )
    ) = 0,
    (
      select count(*)::text
      from public.eventos_partido evento
      join public.partidos partido
        on partido.id = evento.partido_id
      where partido.torneo_id = 2
        and (
          evento.inscripcion_jugador_id is not null
          or btrim(coalesce(evento.jugador, '')) <> ''
        )
    )
  union all
  select
    'rls_aliases_habilitado',
    coalesce((
      select relrowsecurity
      from pg_class cls
      join pg_namespace ns
        on ns.oid = cls.relnamespace
      where ns.nspname = 'public'
        and cls.relname = 'jugadores_aliases'
    ), false),
    'RLS en jugadores_aliases'
  union all
  select
    'sin_escrituras_publicas_aliases',
    not exists (
      select 1
      from information_schema.role_table_grants grant_row
      where grant_row.table_schema = 'public'
        and grant_row.table_name = 'jugadores_aliases'
        and grant_row.grantee in ('anon', 'authenticated', 'public')
        and grant_row.privilege_type in (
          'INSERT',
          'UPDATE',
          'DELETE',
          'TRUNCATE'
        )
    ),
    'anon/authenticated/public no deben escribir aliases'
  union all
  select
    'trigger_evento_inscripcion',
    exists (
      select 1
      from pg_trigger trigger_row
      where trigger_row.tgname = 'eventos_partido_validar_inscripcion_jugador'
        and trigger_row.tgrelid = 'public.eventos_partido'::regclass
        and not trigger_row.tgisinternal
    ),
    'valida torneo y club participante sin exigir equipo_id = club_id'
),
conteos as (
  select
    'conteos' as chequeo,
    true as ok,
    jsonb_build_object(
      'jugadores',
      (select count(*) from public.jugadores),
      'jugadores_sin_normalizar',
      (
        select count(*)
        from public.jugadores
        where nombre_normalizado is null
          or btrim(nombre_normalizado) = ''
      ),
      'aliases',
      coalesce((
        select count(*)
        from public.jugadores_aliases
      ), 0),
      'eventos_apertura',
      (
        select count(*)
        from public.eventos_partido evento
        join public.partidos partido
          on partido.id = evento.partido_id
        where partido.torneo_id = 1
      ),
      'eventos_apertura_vinculados',
      (
        select count(*)
        from public.eventos_partido evento
        join public.partidos partido
          on partido.id = evento.partido_id
        where partido.torneo_id = 1
          and evento.inscripcion_jugador_id is not null
      ),
      'autogoles',
      (
        select count(*)
        from public.eventos_partido evento
        where lower(coalesce(evento.tipo, '')) in ('gol_en_contra', 'autogol')
      )
    )::text as detalle
)
select chequeo, ok, detalle
from checks
union all
select chequeo, ok, detalle
from conteos
order by chequeo;
