# Identidad unica de jugadores

Este documento resume la base tecnica preparada para dejar de usar nombres
libres como identidad principal en incidencias de Tres Palos. En esta etapa no
se aplica SQL remoto, no se modifica el admin productivo y no se cambia la web
publica.

## Esquema real confirmado

La prevalidacion manual fue ejecutada en Supabase produccion desde SQL Editor
con `sql/prevalidar-identidad-jugadores.sql`, dentro de una transaccion
`READ ONLY`.

| tabla | estado confirmado | uso actual |
|---|---:|---|
| `jugadores` | 27 filas, 27 activos, 0 inactivos | Identidad canonica existente. Todavia no tiene `nombre_normalizado`. |
| `inscripciones_jugadores` | 27 filas, todas de Apertura 2026 (`torneo_id = 1`) | Vincula jugador, club y torneo. Tiene restriccion `unique(jugador_id, club_id, torneo_id)`. |
| `eventos_partido` | 368 filas, 60 con `inscripcion_jugador_id`, 308 pendientes | Conserva texto historico en `jugador` para los 368 eventos. |
| `goleadores_oficiales` | 4 filas | Snapshot manual por texto en `jugador_nombre`. |

Referencias rotas confirmadas: 0. Autogoles confirmados: 1.

Estructura auxiliar aun ausente en produccion:

- `jugadores.nombre_normalizado`;
- `jugadores_aliases`;
- `tp_normalizar_nombre_jugador(text)`;
- triggers de normalizacion;
- triggers nuevos de validacion de eventos.

## Modelo

La identidad canonica sigue siendo `public.jugadores`.

La inscripcion sigue siendo `public.inscripciones_jugadores`, con la relacion
jugador + club + torneo. Esto permite que una persona aparezca en torneos
distintos y que cambie de club entre campeonatos sin perder su identidad.

Los eventos usan `eventos_partido.inscripcion_jugador_id` como referencia por
ID cuando esta disponible. `eventos_partido.jugador` se conserva como snapshot
historico y fallback de transicion.

No se agrega `UNIQUE(nombre_normalizado)`. La prevalidacion confirmo homonimos
reales que deben mantenerse separados:

- IDs 11 y 25: `Sanchez`;
- IDs 20 y 21: `Sarco`.

## Normalizacion

`tp_normalizar_nombre_jugador(text)` se prepara para:

- devolver `NULL` si recibe `NULL`;
- pasar a minusculas;
- eliminar tildes y diacriticos esperados;
- eliminar puntos y puntuacion prevista;
- reducir espacios interiores;
- aplicar `btrim` final despues de todas las transformaciones.

Ejemplo esperado:

`JOAQUIN  CARRIZO.` con tilde en la I -> `joaquin carrizo`

La normalizacion se usa para busqueda y candidatos, no como identidad global.

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

El array actual `jugadores.aliases` se conserva. En el respaldo local de
Apertura, coincidente con la estructura confirmada, la copia prevista es:

| metrica | valor |
|---|---:|
| valores totales en `jugadores.aliases` | 0 |
| valores vacios | 0 |
| aliases validos | 0 |
| duplicados exactos | 0 |
| duplicados normalizados | 0 |
| filas nuevas previstas en `jugadores_aliases` | 0 |

La copia preparada usa la normalizacion y `ON CONFLICT DO NOTHING` para no
duplicar filas en una ejecucion controlada.

## Eventos y autogoles

La migracion no modifica eventos:

- eventos modificados: 0;
- eventos insertados: 0;
- eventos eliminados: 0;
- vinculos automaticos nuevos: 0;
- eventos vinculados conservados: 60;
- eventos pendientes conservados: 308;
- textos historicos conservados: 368.

Tipos confirmados:

- `gol`: 363;
- `gol_en_contra`: 1;
- `gol_penal`: 1;
- `roja`: 3.

El autogol historico confirmado es `gol_en_contra` con jugador
`ANGELETTI JOAQUIN` en Carcarana vs Sportivo. El dato actual debe quedar sin
cambios. El trigger preparado valida que una inscripcion informada pertenezca
al torneo del partido y a uno de los clubes participantes, pero no exige
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

`jugadores_aliases` queda con RLS habilitado, sin lectura publica anonima y sin
escritura publica. No se otorgan permisos directos a `anon` ni a
`authenticated`; las operaciones administrativas deben pasar por servidor
seguro con `service_role`.

La lectura publica necesaria de `jugadores` e `inscripciones_jugadores` puede
mantenerse segun las reglas existentes de la web publica.

## Admin futuro

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

## Estado de aplicacion

- escrituras Supabase: 0;
- inserts remotos: 0;
- updates remotos: 0;
- deletes remotos: 0;
- jugadores reales creados: 0;
- inscripciones modificadas: 0;
- eventos modificados: 0;
- goleadores modificados: 0;
- resultados modificados: 0;
- frontend publico modificado: 0;
- admin productivo modificado: 0.
