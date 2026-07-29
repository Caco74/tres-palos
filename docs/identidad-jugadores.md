# Identidad unica de jugadores

Este documento prepara la primera etapa para dejar de usar nombres libres como
identidad principal en incidencias de Tres Palos. No aplica cambios en Supabase,
no modifica el admin productivo y no cambia la web publica.

## Auditoria del esquema actual

La lectura remota con la anon key publica versionada fallo con `Invalid API key`.
No hubo escrituras. El esquema real auditable en esta etapa surge del SQL
versionado y del respaldo local completo del Apertura 2026 generado desde
Supabase REST publico el 2026-07-15.

| tabla | columnas relevantes | claves | uso actual |
|---|---|---|---|
| `torneos` | `id`, `anio`, `tipo`, `nombre`, `activo`, fechas | PK `id`, `unique(anio,tipo)` | Identifica Apertura 2026 (`id=1`) y Clausura 2026 (`id=2`). |
| `clubes` | `id`, `nombre_oficial`, `nombre_corto`, `aliases`, `activo` | PK `id`, `nombre_oficial` unico | Identidad institucional usada por partidos, planteles e incidencias. |
| `partidos` | `id`, `torneo_id`, `local_id`, `visitante_id`, resultado, estado | FK a `torneos` y `clubes` | Apertura tiene 140 partidos; Clausura esperado tiene 114. |
| `jugadores` | `id`, `nombre_completo`, `aliases`, `activo`, timestamps | PK `id` | Ya existe como identidad permanente, pero sin normalizado auditado ni tabla de aliases. |
| `inscripciones_jugadores` | `id`, `jugador_id`, `club_id`, `torneo_id`, `posicion`, `dorsal`, `estado` | PK `id`, FK a jugador/club/torneo, `unique(jugador_id,club_id,torneo_id)` | Representa participacion de una persona en club y torneo. |
| `eventos_partido` | `id`, `partido_id`, `tipo`, `jugador`, `equipo`, `equipo_id`, `inscripcion_jugador_id`, `inscripcion_relacionada_id`, `jugador_relacionado` | PK `id`, FK a partido/club/inscripcion | Incidencias historicas conservan texto en `jugador`; 60/368 eventos de Apertura ya tienen `inscripcion_jugador_id`. |
| `goleadores_oficiales` | `torneo_id`, `posicion`, `equipo_id`, `jugador_nombre`, `goles` | FK a torneo/club, `unique(torneo_id,posicion)` | Snapshot manual destacado; no reemplaza el calculo futuro desde eventos por ID. |
| `respaldos_etapa` | JSON de partidos/incidencias/torneo completo | PK `id`, respaldo inmutable por trigger | Respaldo administrativo de cierres/restauraciones. |
| `etapas_estado` | `torneo_id`, `tipo`, `valor`, `estado` | PK compuesta | Controla etapas cerradas/abiertas para admin. |

No hay tabla `personas` ni `planteles` separada. La estructura reutilizable es
`jugadores` + `inscripciones_jugadores`.

## Modelo propuesto

La identidad canonica debe seguir siendo `public.jugadores`.

Cambios preparados en `sql/aplicar-identidad-jugadores.sql`:

- agregar `jugadores.nombre_normalizado`;
- crear `tp_normalizar_nombre_jugador(text)`;
- crear `jugadores_aliases`;
- migrar aliases existentes del array `jugadores.aliases` hacia la tabla nueva;
- mantener `jugadores.aliases` por compatibilidad durante la transicion;
- reforzar indices de busqueda;
- validar eventos por inscripcion sin exigir que `equipo_id` sea igual al club
  del jugador.

No se agrega `UNIQUE(nombre_normalizado)`. El respaldo ya muestra homonimos
canonicos reales: `Sanchez` y `Sarco` existen como jugadores distintos en
clubes distintos.

## Identidad e inscripciones

`jugadores` identifica a la persona. `inscripciones_jugadores` identifica su
participacion en un club y torneo.

El modelo permite:

- el mismo jugador en Apertura y Clausura;
- cambio de club entre torneos;
- desactivacion logica por `estado = 'inactivo'`;
- correccion de `nombre_completo` en un unico lugar;
- historial sin borrar identidades.

La restriccion actual `unique(jugador_id, club_id, torneo_id)` se conserva. Si
se confirma transferencia dentro del mismo torneo, antes de aplicar una regla
mas fuerte hay que decidir si una persona puede tener dos inscripciones activas
con fechas no solapadas.

## Eventos y autogoles

El repositorio ya usa `eventos_partido.inscripcion_jugador_id` como referencia
principal para el protagonista. Es preferible no agregar `jugador_id` directo al
evento para evitar redundancia: el jugador se obtiene desde la inscripcion.

`eventos_partido.jugador` se conserva como snapshot historico y fallback.

Autogol auditado:

- evento `384`;
- partido `235`, Carcarana 0-2 Sportivo;
- `tipo = gol_en_contra`;
- `jugador = ANGELETTI JOAQUIN`;
- `equipo_id = 57`, Carcarana;
- observacion: autor de Carcarana, beneficia a Sportivo.

En el dato real actual, `equipo_id` representa el club del autor para el
autogol, y la UI publica invierte el beneficiado al mostrar. La preparacion no
impone `inscripcion.club_id = evento.equipo_id`; solo exige que la inscripcion
pertenezca al torneo del partido y a uno de los clubes participantes. Esto
permite mantener la convencion actual o cambiar a `equipo_id` beneficiado en
una etapa futura sin romper identidad.

## Alias y normalizacion

`jugadores_aliases` queda preparado con:

- `jugador_id`;
- `alias`;
- `alias_normalizado`;
- `club_id` opcional;
- `torneo_id` opcional;
- `origen`;
- `confirmado`.

La normalizacion:

- pasa a minusculas;
- elimina tildes;
- elimina puntos;
- colapsa espacios;
- conserva siempre el texto original en eventos y aliases.

Una coincidencia por similitud textual no crea ni fusiona jugadores. Produce
candidatos para revision.

## Admin futuro

Flujo esperado, sin implementar todavia:

1. seleccionar torneo;
2. seleccionar partido;
3. seleccionar equipo;
4. listar inscriptos de ese club y torneo;
5. elegir jugador;
6. elegir incidencia;
7. guardar `inscripcion_jugador_id`.

Accion separada: `Jugador no encontrado`.

Ese flujo debe buscar persona existente, permitir crear identidad canonica solo
con confirmacion, crear inscripcion y evitar duplicados. No debe crear jugadores
automaticamente por escribir un nombre.

## Goleadores y tarjetas

Hoy existen agrupaciones por texto en la web publica (`evento.jugador`) y un
snapshot `goleadores_oficiales`. Durante la transicion:

- eventos con `inscripcion_jugador_id` se agrupan por ID;
- eventos sin ID se agrupan por texto normalizado + club como fallback;
- cada evento se cuenta una sola vez;
- autogoles no suman a goleadores;
- tarjetas usan la misma identidad, no un modelo separado.

## RLS y seguridad

El SQL preparado:

- habilita RLS en `jugadores_aliases`;
- no permite lectura anonima publica de aliases;
- no permite escrituras publicas anonimas;
- deja lectura/escritura de aliases a `service_role`;
- no expone claves;
- no modifica politicas existentes de tablas productivas.

La creacion/edicion sigue protegida por funciones Netlify con
`SUPABASE_SERVICE_ROLE_KEY` en entorno.

## Archivos de esta etapa

- `sql/prevalidar-identidad-jugadores.sql`
- `sql/aplicar-identidad-jugadores.sql`
- `sql/verificar-identidad-jugadores.sql`
- `scripts/auditar-jugadores-historicos.js`
- `scripts/respaldar-identidad-jugadores.js`
- `reports/identidad-jugadores-dry-run.md`
- `reports/identidad-jugadores-mapeo-propuesto.json`
- `tests/identidad-jugadores-db.test.js`

## Estado de aplicacion

- escrituras Supabase: 0;
- inserts remotos: 0;
- updates remotos: 0;
- deletes remotos: 0;
- jugadores reales creados: 0;
- eventos modificados: 0;
- resultados modificados: 0;
- frontend publico modificado: 0;
- admin productivo modificado: 0.
