# Estado de Tres Palos

Fecha de revisión: 12 de junio de 2026.

## Objetivo actual

Cubrir la Primera División de la Liga Cañadense con resultados, posiciones,
playoffs y datos verificables. La prioridad es que el sitio publique menos
información antes que mostrar datos dudosos.

## Qué está funcionando

- Sitio público adaptable a móvil y escritorio.
- Fixture regular, tabla, playoffs, agenda y detalle de partidos.
- Inicio generado desde los partidos reales.
- Panel privado para programación y resultados.
- Estados de partidos y etapas.
- Cierre y respaldo inmutable por fecha o fase.
- Medición de pestañas y partidos consultados.
- Base central de 21 clubes.
- Estadio, ciudad, apodo, escudo y aliases editables por club.
- Torneos Apertura y Clausura separados.
- Jugadores permanentes e inscripciones por club y torneo.

## Estado de los datos

- 139 partidos cargados.
- 126 partidos de fase regular.
- 13 registros de playoffs.
- 136 partidos con resultado.
- 2 semifinales pendientes y una final todavía sin equipos.
- 21 clubes activos.
- 0 estadios cargados en las fichas de clubes.
- 0 jugadores e inscripciones cargados.
- 5 incidencias históricas, todas goles y todas sin vínculo a una inscripción.
- Los 139 partidos pertenecen al Apertura 2026.

## Incidencias históricas

Las cinco incidencias pueden conservarse y vincularse:

- Tres ya tienen club identificado.
- Dos no tienen `equipo_id`, pero corresponden a un partido terminado 0-2.
  Por el resultado, ambos goles pertenecen al visitante.
- Los nombres deben crearse inicialmente como `por_verificar`.
- No deben volver a alimentar una tabla pública de goleadores hasta confirmar
  fuente y vincular `inscripcion_jugador_id`.

La migración debe ser supervisada: normalizar nombre, elegir club y torneo,
crear o reutilizar jugador, crear inscripción y recién entonces enlazar el
evento. No conviene hacer coincidencias automáticas sólo por texto cuando
existan homónimos.

## Faltantes importantes

1. El editor de incidencias requiere ejecutar `supabase/incidencias.sql`.
2. La columna `arbitro` no está activa en la base, aunque el panel la muestra.
3. El respaldo por etapa no incluye clubes, torneos, jugadores ni planteles.
4. No existe todavía un cierre integral del Apertura.
5. Los estadios, fuentes y planteles están prácticamente vacíos.
6. No hay pruebas automatizadas ni validación visual estable en el despliegue.

## Decisiones de producto

- Goleadores permanece oculto hasta trabajar con jugadores vinculados.
- La forma reciente no se muestra en la agenda porque exige interpretación.
- El Hero no muestra un estado secundario si no aporta una acción clara.
- Un jugador confirmado requiere una fuente.
- Una transferencia crea otra inscripción, no otro jugador.
- Las incidencias antiguas no se eliminan: se preservan para su conciliación.

## Orden recomendado

1. Activar la columna de árbitro y completar estadios de semifinales.
2. Ejecutar `supabase/incidencias.sql`.
3. Conciliar las cinco incidencias históricas desde el editor.
4. Ampliar los respaldos a clubes, torneos, jugadores e inscripciones.
5. Implementar cierre integral del Apertura.
6. Preparar el Clausura copiando inscripciones como borrador.
