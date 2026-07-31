# Goleadores por torneo

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

## Evolucion futura

Cuando los eventos historicos del Apertura tengan identidad completa, se puede
quitar ese torneo de la lista historica que usa snapshot y pasarlo al calculo
desde eventos. La migracion de esos eventos no forma parte de esta tarea.
