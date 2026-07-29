# Identidad unica de jugadores

Este documento resume el cierre tecnico de la migracion para dejar de usar
nombres libres como identidad principal en incidencias de Tres Palos.

La migracion fue aplicada manualmente en Supabase produccion desde SQL Editor.
Codex no ejecuto SQL remoto en esta tarea. No se modifico frontend publico,
admin productivo ni Netlify.

## Estado verificado en produccion

La verificacion posterior devolvio `ok: true`.

| control | resultado |
|---|---:|
| controles ejecutados | 30 |
| controles fallidos | 0 |
| jugadores | 27 |
| jugadores normalizados | 27 |
| inscripciones | 27 |
| eventos | 368 |
| eventos vinculados por ID | 60 |
| eventos pendientes | 308 |
| goleadores oficiales | 4 |
| autogoles | 1 |
| referencias rotas | 0 |

Los 30 controles pasaron. No se modificaron eventos, inscripciones, resultados
ni goleadores.

## Integridad preservada

La verificacion confirmo:

- IDs de jugadores preservados;
- nombres publicos preservados;
- IDs 11 y 25 de `Sanchez` preservados;
- IDs 20 y 21 de `Sarco` preservados;
- inscripciones intactas;
- eventos intactos;
- tipos de eventos intactos;
- texto historico intacto;
- goleadores oficiales intactos;
- autogol de `ANGELETTI JOAQUIN` preservado.

## Estructura nueva confirmada

La verificacion confirmo:

- `jugadores.nombre_normalizado` existe;
- jugadores normalizados: 27;
- normalizados con espacios iniciales o finales: 0;
- `tp_normalizar_nombre_jugador(text)` existe;
- `jugadores_aliases` existe;
- filas de aliases: 0;
- RLS de aliases habilitado;
- lectura publica de aliases: no;
- escritura publica de aliases: no;
- indices esperados: 8;
- triggers esperados: 3;
- FKs esperadas en eventos: 2;
- `UNIQUE(nombre_normalizado)` global: no.

## Modelo

La identidad canonica sigue siendo `public.jugadores`.

La inscripcion sigue siendo `public.inscripciones_jugadores`, con la relacion
jugador + club + torneo. Esto permite que una persona aparezca en torneos
distintos y que cambie de club entre campeonatos sin perder su identidad.

Los eventos deben usar `eventos_partido.inscripcion_jugador_id` como referencia
por ID cuando esta disponible. `eventos_partido.jugador` se conserva como
snapshot historico y fallback de transicion.

No existe `UNIQUE(nombre_normalizado)`. La normalizacion sirve para busqueda,
candidatos y auditoria; no fusiona identidades.

## Normalizacion

`tp_normalizar_nombre_jugador(text)`:

- devuelve `NULL` si recibe `NULL`;
- pasa a minusculas;
- elimina tildes y diacriticos esperados;
- elimina puntos y puntuacion prevista;
- reduce espacios interiores;
- aplica `btrim` final despues de todas las transformaciones.

Ejemplo esperado:

`JOAQUIN  CARRIZO.` con tilde en la I -> `joaquin carrizo`

## Aliases

`jugadores_aliases` queda preparada para variantes historicas o externas:

- `jugador_id`;
- `alias`;
- `alias_normalizado`;
- `club_id` opcional;
- `torneo_id` opcional;
- `origen`;
- `confirmado`;
- auditoria basica.

No hay unicidad global por `alias_normalizado`. Un alias puede ser ambiguo y
debe resolverse con contexto de jugador, club, torneo y revision manual.

El array actual `jugadores.aliases` se conserva. La verificacion posterior
confirmo 0 filas nuevas en `jugadores_aliases`.

## Eventos y autogoles

La migracion no modifico eventos:

- eventos modificados: 0;
- eventos insertados: 0;
- eventos eliminados: 0;
- vinculos automaticos nuevos: 0;
- eventos vinculados conservados: 60;
- eventos historicos continuan pendientes de vinculacion manual: 308;
- textos historicos conservados: 368.

Tipos confirmados:

- `gol`: 363;
- `gol_en_contra`: 1;
- `gol_penal`: 1;
- `roja`: 3.

El autogol historico confirmado es `gol_en_contra` con jugador
`ANGELETTI JOAQUIN` en Carcarana vs Sportivo. El dato actual quedo sin cambios.

El trigger valida que una inscripcion informada pertenezca al torneo del
partido y a uno de los clubes participantes, pero no exige
`inscripcion.club_id = eventos_partido.equipo_id`. Esto evita romper autogoles
u otras incidencias donde la semantica de `equipo_id` no coincide con el club
del protagonista.

Durante la transicion, el trigger tolera:

- eventos con `inscripcion_jugador_id IS NULL`;
- eventos historicos con texto libre;
- eventos sin jugador aplicable;
- tarjetas;
- autogoles;
- incidencias futuras con `inscripcion_relacionada_id`.

## Goleadores oficiales

`goleadores_oficiales` se conserva exactamente como snapshot manual:

- filas modificadas: 0;
- filas recalculadas: 0;
- filas convertidas a ID: 0.

Puede coexistir con estadisticas futuras por ID, siempre que no se mezclen dos
fuentes para contar el mismo dato dos veces.

## RLS y seguridad

`jugadores_aliases` quedo con RLS habilitado, sin lectura publica anonima y sin
escritura publica. No se otorgan permisos directos a `anon` ni a
`authenticated`; las operaciones administrativas deben pasar por servidor
seguro con `service_role`.

La lectura publica necesaria de `jugadores` e `inscripciones_jugadores` puede
mantenerse segun las reglas existentes de la web publica.

## Admin futuro

El panel administrativo todavia no fue adaptado.

Los nuevos eventos del Clausura deberan crearse por `inscripcion_jugador_id`.
No se deben cargar nombres libres del Clausura hasta completar el siguiente PR
del admin.

Flujo esperado, aun no implementado:

1. seleccionar torneo;
2. seleccionar partido;
3. seleccionar equipo;
4. listar jugadores inscriptos en ese club y torneo;
5. elegir jugador;
6. elegir incidencia;
7. guardar la referencia por ID.

Accion separada: `Jugador no encontrado`. Debe permitir buscar una persona
existente, crear una identidad canonica solo con confirmacion, crear la
inscripcion y evitar duplicados. No debe crear jugadores automaticamente por
escribir un nombre.

## Hashes posteriores registrados

| area | hash |
|---|---|
| `eventos_partido` | `eaccea24a78762ecea616417356660c7` |
| `inscripciones_jugadores` | `09b3ea7a7e94e4c0fb505c40b762e09a` |
| `goleadores_oficiales` | `c40a4eb88526fbb6bb377f2ab9507916` |
| jugadores historicos | `593ed9ecd9ca732561c6a313ca9c3ba9` |
| jugadores con nombre normalizado | `5471416c0a96d480bb64fe5dfd24e88d` |

## Estado de aplicacion

- migracion fue aplicada manualmente: si;
- verificacion posterior devolvio `ok: true`;
- 30 controles pasaron;
- SQL remoto ejecutado por Codex en esta tarea: 0;
- inserts remotos desde Codex: 0;
- updates remotos desde Codex: 0;
- deletes remotos desde Codex: 0;
- jugadores reales creados en esta tarea: 0;
- inscripciones modificadas en esta tarea: 0;
- eventos modificados en esta tarea: 0;
- goleadores modificados en esta tarea: 0;
- resultados modificados en esta tarea: 0;
- datos deportivos modificados en esta tarea: 0;
- frontend publico modificado: 0;
- admin productivo modificado: 0;
- Netlify modificado: 0.
