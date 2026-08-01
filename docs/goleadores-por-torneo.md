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

La misma auditoria detecto que `anon` conserva privilegios de tabla
innecesarios de INSERT, UPDATE y DELETE. RLS actualmente impide usarlos porque
no hay politicas publicas de escritura aplicables, pero la configuracion debe
ajustarse a minimo privilegio.

La correccion preparada queda en `sql/corregir-permisos-anon-goleadores.sql` y
debe aplicarse manualmente, despues de ejecutar
`sql/auditar-permisos-publicos-goleadores.sql`. La funcion publica de
goleadores requiere unicamente SELECT y seguira funcionando despues de revocar
los privilegios DML innecesarios.

No hacer merge de esta rama hasta ejecutar la correccion manual autorizada,
correr `sql/verificar-permisos-anon-goleadores.sql` y confirmar que la web
publica sigue mostrando la tabla de goleadores.

## Evolucion futura

Cuando los eventos historicos del Apertura tengan identidad completa, se puede
quitar ese torneo de la lista historica que usa snapshot y pasarlo al calculo
desde eventos. La migracion de esos eventos no forma parte de esta tarea.
