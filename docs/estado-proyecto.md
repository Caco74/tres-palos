# Estado de Tres Palos

Fecha de revisión: 21 de junio de 2026.

## Objetivo actual

Cubrir la Primera División de la Liga Cañadense con resultados, posiciones,
playoffs y datos verificables. La prioridad sigue siendo publicar menos
información antes que mostrar datos dudosos.

## Qué está funcionando

- Sitio público adaptable a móvil y escritorio.
- Inicio automático con agenda, últimos resultados y comparación de protagonistas.
- Fixture regular, tabla por zona, tabla general, playoffs y detalle de partidos.
- Playoffs con octavos, cuartos, semifinales y final ida/vuelta.
- Filtro público de incidencias: sólo se muestran eventos confirmados.
- Panel privado para programación, resultados, clubes, planteles e incidencias.
- Estados de partidos y etapas.
- Cierre y respaldo inmutable por fecha o fase.
- Medición de pestañas y partidos consultados.
- Base central de 21 clubes.
- Torneos Apertura y Clausura separados.
- Jugadores permanentes e inscripciones por club y torneo.

## Estado de los datos

- 140 partidos cargados.
- 126 partidos de fase regular.
- 14 registros de playoffs.
- 139 partidos con resultado.
- Final ida jugada: Sportivo A. Club 0-1 C. A. Carcarañá, 20 de junio de 2026.
- Final vuelta pendiente: C.A. Carcarañá vs Sportivo A. Club, 28 de junio de 2026, 15:00, Gigante de la 9.
- 21 clubes activos.
- 4 clubes con estadio cargado y 17 pendientes.
- 27 jugadores cargados.
- 27 inscripciones de jugadores cargadas.
- 26 incidencias cargadas: 19 confirmadas y 7 por verificar.
- Los 140 partidos pertenecen al Apertura 2026.

## Incidencias

Las incidencias `por_verificar` se conservan para trabajo interno, pero no se
muestran en el sitio público. Para que una incidencia aparezca en el detalle de
partido o en resúmenes públicos debe tener `estado_dato = confirmado`.

Estado actual:

- 22 goles cargados: 16 confirmados y 6 por verificar.
- 3 rojas cargadas: 2 confirmadas y 1 por verificar.
- 1 gol penal cargado y confirmado.

La tabla pública de goleadores debe seguir oculta hasta que los eventos estén
vinculados a jugadores/inscripciones y tengan una fuente confiable.

## Faltantes importantes

1. Los árbitros de las dos finales no están cargados.
2. Hay 136 partidos sin estadio propio cargado y 138 sin árbitro; muchos son
   registros históricos, pero no conviene mostrarlos como dato fuerte.
3. Quedan 7 incidencias `por_verificar` para conciliar o descartar.
4. La vista Datos está oculta y pendiente de rediseño de valor.
5. No existe todavía un cierre integral del Apertura.
6. No hay pruebas automatizadas ni validación visual estable en el despliegue.

## Decisiones de producto

- La app pública muestra sólo incidencias confirmadas.
- Los datos faltantes se diferencian por contexto: futuro como `A confirmar`,
  histórico como `Sin datos`.
- Goleadores permanece oculto hasta trabajar con jugadores vinculados.
- La pestaña Datos queda fuera de navegación hasta rediseñar qué aporta.
- La forma reciente toma el resultado del partido; los penales no convierten un
  empate en victoria o derrota para la racha.
- El Hero no muestra un estado secundario si no aporta una acción clara.
- Un jugador confirmado requiere una fuente.
- Una transferencia crea otra inscripción, no otro jugador.

## Orden recomendado

1. Completar o confirmar árbitros de la final.
2. Conciliar las 7 incidencias `por_verificar`.
3. Revisar qué estadios/árbitros históricos vale la pena completar antes del cierre.
4. Preparar validación visual mínima para Inicio, Partidos, Tabla, Playoffs y detalle.
5. Definir si Datos se rediseña, se congela o se elimina del código público.
6. Implementar cierre integral del Apertura después de la final.
7. Preparar el Clausura copiando inscripciones como borrador.
