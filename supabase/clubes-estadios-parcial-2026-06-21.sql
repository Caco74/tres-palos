update public.clubes
set estadio = 'Centenario',
    actualizado_en = now()
where nombre_corto = 'Campaña';

update public.clubes
set estadio = 'Juan Rodolfo Bolla',
    actualizado_en = now()
where nombre_corto = 'Correa';

update public.clubes
set estadio = 'Raúl Fiori',
    actualizado_en = now()
where nombre_corto = 'San Jerónimo';

update public.clubes
set estadio = 'Jacinto Loesi',
    actualizado_en = now()
where nombre_corto = 'ADEO';

update public.clubes
set apodo = 'La Cebra',
    actualizado_en = now()
where nombre_corto = 'Sportsman';

update public.clubes
set apodo = 'Barraque',
    actualizado_en = now()
where nombre_corto = 'Barraca';

update public.clubes
set apodo = 'Rojinegro',
    actualizado_en = now()
where nombre_corto = 'Defensores';

update public.clubes
set apodo = 'La Topadora',
    actualizado_en = now()
where nombre_corto = 'Newell''s';

update public.clubes
set apodo = 'El Celeste',
    actualizado_en = now()
where nombre_corto = 'Sport';

update public.clubes
set apodo = 'El Rojo',
    actualizado_en = now()
where nombre_corto = 'Unión';
