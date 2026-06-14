begin;

do $$
declare
  v_torneo_id bigint;
  v_semifinal_1 bigint;
  v_semifinal_2 bigint;
  v_final_1 bigint;
begin
  select torneo_id
  into v_torneo_id
  from public.partidos
  where tipo = 'playoff' and fase = 'final'
  order by id
  limit 1;

  select id
  into v_semifinal_1
  from public.partidos
  where
    tipo = 'playoff'
    and fase = 'semifinal'
    and numero_playoff = 1
    and torneo_id = v_torneo_id
  order by id desc
  limit 1;

  select id
  into v_semifinal_2
  from public.partidos
  where
    tipo = 'playoff'
    and fase = 'semifinal'
    and numero_playoff = 2
    and torneo_id = v_torneo_id
  order by id desc
  limit 1;

  if v_torneo_id is null or v_semifinal_1 is null or v_semifinal_2 is null then
    raise exception 'No se encontraron el torneo y sus dos semifinales.';
  end if;

  select id
  into v_final_1
  from public.partidos
  where
    tipo = 'playoff'
    and fase = 'final'
    and torneo_id = v_torneo_id
  order by numero_playoff nulls last, id
  limit 1;

  if v_final_1 is null then
    insert into public.partidos (
      tipo,
      fase,
      numero_playoff,
      source_local,
      source_visitante,
      estado,
      torneo_id
    )
    values (
      'playoff',
      'final',
      1,
      v_semifinal_1::text,
      v_semifinal_2::text,
      'programado',
      v_torneo_id
    )
    returning id into v_final_1;
  else
    update public.partidos
    set
      numero_playoff = 1,
      source_local = v_semifinal_1::text,
      source_visitante = v_semifinal_2::text,
      actualizado_en = now()
    where id = v_final_1;
  end if;

  if not exists (
    select 1
    from public.partidos
    where
      tipo = 'playoff'
      and fase = 'final'
      and numero_playoff = 2
      and torneo_id = v_torneo_id
  ) then
    insert into public.partidos (
      tipo,
      fase,
      numero_playoff,
      source_local,
      source_visitante,
      estado,
      torneo_id
    )
    values (
      'playoff',
      'final',
      2,
      v_semifinal_1::text,
      v_semifinal_2::text,
      'programado',
      v_torneo_id
    );
  end if;
end;
$$;

commit;
