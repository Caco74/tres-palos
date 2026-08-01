# Goleadores por torneo

## Navegacion publica

La seccion Tabla mantiene las pestanas Posiciones y Goleadores con el mismo
orden de filtros:

1. Zona 1
2. Zona 2
3. Zona 3
4. General

Zona 1 sigue siendo la vista inicial tanto en Posiciones como en Goleadores.
General queda disponible al final como vista consolidada del torneo, sin
seleccionarse automaticamente al abrir Goleadores.

## Fuente por torneo

La tabla publica de goleadores no mezcla fuentes dentro de un mismo torneo.

- Apertura 2026 usa `goleadores_oficiales`, porque los eventos historicos del
  torneo todavia tienen cobertura incompleta de `inscripcion_jugador_id`.
- Clausura 2026 y torneos nuevos usan calculo desde `eventos_partido` con
  jugadores identificados por `inscripcion_jugador_id`.

## Eventos que cuentan

Para torneos calculados desde eventos solo suman incidencias confirmadas con
tipo exacto:

- `gol`;
- `gol_penal`.

No suman `gol_en_contra`, tarjetas, cambios ni otras incidencias.

## Identidad

La clave deportiva del calculo sale de la inscripcion del evento:

- `eventos_partido.inscripcion_jugador_id`;
- `inscripciones_jugadores.jugador_id`;
- `inscripciones_jugadores.club_id`;
- `inscripciones_jugadores.torneo_id`.

El nombre mostrado sale de `jugadores.nombre_completo`. El snapshot textual
`eventos_partido.jugador` queda solo como referencia historica de la incidencia
y no se usa como clave de agrupacion.

## Zonas

Las zonas se resuelven desde `partidos.zona` para el torneo consultado. El
filtro General junta todos los goles del torneo; Zona 1, Zona 2 y Zona 3 solo
muestran goles de partidos de esa zona.

## Lideres empatados

El destacado visual de lider se calcula dentro del filtro activo. Todos los
jugadores que compartan el maximo de goles de esa vista reciben el mismo
tratamiento visual. El orden de la lista sigue siendo:

1. goles descendente;
2. nombre del jugador;
3. club.

El orden alfabetico solo ordena filas empatadas y no define un lider unico.

## Seguridad publica

`netlify/functions/goleadores-publicos.js` usa configuracion publica `anon` o su
equivalente para lecturas deportivas. No usa `service_role` ni operaciones de
escritura.

La respuesta publica se limita a:

- `fuente`;
- `mensaje_vacio`;
- tablas por Zona 1, Zona 2, Zona 3 y General;
- por fila: `jugador_nombre`, `equipo_nombre` y `goles`.

La funcion consulta directa o indirectamente estas tablas segun la fuente del
torneo:

- Siempre: `torneos` y `partidos`.
- Torneos calculados: `eventos_partido`, `inscripciones_jugadores`, `jugadores`
  y `clubes`.
- Torneos historicos: `goleadores_oficiales`.

La seguridad depende de RLS y permisos minimos en Supabase. El SQL versionado
confirma RLS y lectura `anon` para `torneos`, `jugadores`,
`inscripciones_jugadores`, `clubes` y `goleadores_oficiales`.

La auditoria manual de produccion del 2026-08-01 confirmo para `partidos` y
`eventos_partido`:

- RLS activo en ambas tablas;
- `anon` con SELECT en ambas tablas;
- politicas publicas de SELECT presentes:
  - `lectura publica` en `partidos`;
  - `public read eventos` en `eventos_partido`;
- ninguna politica publica de INSERT, UPDATE o DELETE.

La auditoria posterior confirmo que esos permisos no vienen de `PUBLIC`, sino
de GRANT directos realizados por `postgres`. En ambas tablas el ACL directo era:

- `anon=arwdDxtm/postgres`;
- `authenticated=arwdDxtm/postgres`.

Esto representa privilegios directos de SELECT, INSERT, UPDATE, DELETE,
TRUNCATE, REFERENCES, TRIGGER y MAINTAIN, o su equivalente `m` segun la version
de PostgreSQL.

RLS actualmente impide las escrituras por filas porque no hay politicas
publicas de escritura aplicables. Aun asi, no debe confiarse en RLS para
privilegios que no operan fila por fila, como TRUNCATE. La configuracion debe
ajustarse a minimo privilegio para que `anon` conserve solo SELECT.

La correccion preparada queda en `sql/corregir-permisos-anon-goleadores.sql` y
debe aplicarse manualmente, despues de ejecutar
`sql/auditar-permisos-publicos-goleadores.sql`. La variante elegida usa
`REVOKE ALL PRIVILEGES` sobre `anon` y `PUBLIC`, seguido por `GRANT SELECT` a
`anon`. Asi se elimina el conjunto completo de privilegios innecesarios sin
usar una lista incompleta, se preserva la lectura publica y no se modifican
propietario, `service_role`, RLS, politicas ni filas.

Se creo tambien `sql/corregir-permisos-authenticated-goleadores.sql` como
correccion protegida e independiente porque el repositorio no muestra uso de
Supabase Auth ni sesiones de usuario. No debe autorizarse ni ejecutarse junto
con la correccion de `anon` sin una decision explicita sobre `authenticated`.

La funcion publica de goleadores requiere unicamente SELECT y seguira
funcionando despues de revocar los privilegios innecesarios de `anon`.

No hacer merge de esta rama hasta ejecutar la correccion manual autorizada,
correr `sql/verificar-permisos-anon-goleadores.sql` y confirmar que la web
publica sigue mostrando la tabla de goleadores. El archivo temporal autorizado
`sql/corregir-permisos-anon-goleadores-autorizado.sql` debe eliminarse antes
del merge.

## Evolucion futura

Cuando los eventos historicos del Apertura tengan identidad completa, se puede
quitar ese torneo de la lista historica que usa snapshot y pasarlo al calculo
desde eventos. La migracion de esos eventos no forma parte de esta tarea.
