# Prevalidacion manual - identidad de jugadores

Fecha del informe: 2026-07-29
Zona horaria: America/Buenos_Aires
Rama: `db/identidad-jugadores`
Entorno validado: Supabase produccion
Ejecucion: manual desde Supabase SQL Editor
SQL usado: `sql/prevalidar-identidad-jugadores.sql`

## Resultado

Estado: **PREVALIDACION MANUAL CONFIRMADA**

El SQL se ejecuto dentro de una transaccion `READ ONLY` y devolvio una unica
fila JSON. No se adjunta CSV porque la validacion fue reportada desde telefono;
este informe registra los resultados confirmados por el usuario.

## Esquema remoto confirmado

| area | resultado |
|---|---|
| `jugadores` | 27 registros, 27 activos, 0 inactivos. |
| `inscripciones_jugadores` | 27 registros, todos en Apertura 2026 (`torneo_id = 1`). |
| `eventos_partido` | 368 registros, 60 vinculados por ID, 308 pendientes. |
| `goleadores_oficiales` | 4 registros, snapshot manual textual. |
| referencias rotas | 0. |
| autogoles | 1. |

Estructura auxiliar ausente en produccion:

- `jugadores.nombre_normalizado`;
- `jugadores_aliases`;
- `tp_normalizar_nombre_jugador(text)`;
- triggers auxiliares de normalizacion;
- triggers nuevos de validacion relacionados con esta migracion.

## Jugadores

- total: 27;
- activos: 27;
- inactivos: 0;
- `nombre_normalizado`: no existe aun;
- homonimos reales preservados: IDs 11 y 25 (`Sanchez`), IDs 20 y 21 (`Sarco`).

Conclusion: `nombre_normalizado` no puede tener unicidad global. Debe servir
para busqueda, candidatos y auditoria, no para fusionar identidades.

La migracion ajustada:

- agrega solo la columna `jugadores.nombre_normalizado`;
- no recrea la tabla;
- preserva IDs, `nombre_completo`, `aliases`, `activo`, `creado_en` y
  `actualizado_en`;
- hace backfill de `nombre_normalizado` para exactamente 27 jugadores;
- no fusiona ni elimina jugadores.

## Inscripciones

- total: 27;
- duplicadas: 0;
- incompletas: 0;
- todas pertenecen a `torneo_id = 1`;
- existe restriccion equivalente a `UNIQUE(jugador_id, club_id, torneo_id)`.

La migracion ajustada:

- no inserta inscripciones;
- no actualiza inscripciones;
- no elimina inscripciones;
- no cambia `jugador_id`, `club_id`, `torneo_id`, `dorsal` ni `estado`;
- conserva el modelo jugador + club + torneo;
- no impone una restriccion nueva que bloquee cambios de club entre torneos.

## Eventos historicos

- total: 368;
- con texto historico en `jugador`: 368;
- con `inscripcion_jugador_id`: 60;
- sin `inscripcion_jugador_id`: 308;
- referencias rotas: 0;
- nuevos vinculos automaticos seguros: 0;
- revision manual futura: 308.

Tipos:

| tipo | cantidad |
|---|---:|
| `gol` | 363 |
| `gol_en_contra` | 1 |
| `gol_penal` | 1 |
| `roja` | 3 |

La migracion ajustada:

- modifica 0 eventos;
- inserta 0 eventos;
- elimina 0 eventos;
- crea 0 vinculos automaticos;
- conserva los 60 vinculos existentes;
- conserva los 308 pendientes;
- conserva el texto historico de los 368;
- conserva `inscripcion_relacionada_id`;
- conserva tipos, partidos, equipos, minutos, resultados e IDs.

## Autogol

Autogol historico confirmado:

- tipo: `gol_en_contra`;
- jugador: `ANGELETTI JOAQUIN`;
- partido: Carcarana vs Sportivo.

La validacion futura no asume `inscripcion.club_id =
eventos_partido.equipo_id`. El trigger preparado valida torneo y pertenencia a
uno de los clubes del partido cuando hay una inscripcion por ID, y tolera
eventos historicos que aun tienen solo texto.

## Goleadores oficiales

- filas totales: 4;
- snapshot manual;
- dependencia textual: `jugador_nombre`;
- uso de identidad por ID: todavia no.

La migracion ajustada no convierte, elimina, recalcula ni mezcla estas filas
con estadisticas futuras.

## Aliases existentes

Conteo calculado desde el respaldo local Apertura 2026, consistente con la
estructura confirmada de 27 jugadores:

| metrica | valor |
|---|---:|
| valores totales en `jugadores.aliases` | 0 |
| valores vacios | 0 |
| aliases validos | 0 |
| duplicados exactos | 0 |
| duplicados normalizados | 0 |
| filas nuevas previstas | 0 |

No se inventan aliases, iniciales ni abreviaturas. El array original
`jugadores.aliases` no se elimina.

## Problema corregido

La prevalidacion mostro que la normalizacion simulada devolvia:

`joaquin carrizo `

con espacio final.

La funcion preparada se ajusto para aplicar `btrim` despues de todas las
transformaciones. Resultado esperado:

`JOAQUIN CARRIZO.` con tilde en la I -> `joaquin carrizo`

## Cambios exactos que aplicaria la migracion protegida

Tablas nuevas:

- `jugadores_aliases`.

Columnas nuevas:

- `jugadores.nombre_normalizado`.

Funciones nuevas o reemplazadas:

- `tp_normalizar_nombre_jugador(text)`;
- `tp_jugadores_normalizar_trigger()`;
- `tp_jugadores_aliases_normalizar_trigger()`;
- `tp_validar_evento_inscripcion_jugador()`.

Triggers nuevos:

- `jugadores_normalizar_nombre`;
- `jugadores_aliases_normalizar`;
- `eventos_partido_validar_inscripcion_jugador`.

Indices nuevos:

- `jugadores_nombre_normalizado_idx`;
- `jugadores_aliases_jugador_idx`;
- `jugadores_aliases_busqueda_idx`;
- `jugadores_aliases_contexto_unico_idx`;
- `eventos_partido_inscripcion_idx`;
- `eventos_partido_inscripcion_relacionada_idx`;
- `inscripciones_jugador_torneo_idx`;
- `inscripciones_torneo_club_estado_idx`.

RLS y permisos:

- habilita RLS en `jugadores_aliases`;
- no crea politica de lectura publica;
- revoca permisos directos a `public`, `anon` y `authenticated`;
- otorga acceso directo solo a `service_role`;
- no modifica politicas de otras tablas.

Backfill:

- completa `jugadores.nombre_normalizado` en 27 jugadores existentes;
- no actualiza `actualizado_en`;
- no toca eventos, inscripciones ni goleadores oficiales.

## Riesgos

- La aplicacion sigue requiriendo autorizacion manual explicita.
- Los 308 eventos pendientes necesitan revision manual futura; no deben
  migrarse por similitud textual.
- Los homonimos confirmados exigen evitar cualquier unicidad global por nombre
  normalizado.

## Aplicacion manual posterior

La migracion fue aplicada manualmente en Supabase produccion desde SQL Editor.
Codex no ejecuto SQL remoto en esta tarea.

Despues de la aplicacion se ejecuto `sql/verificar-identidad-jugadores.sql`.
La verificacion posterior devolvio `ok: true`; los 30 controles pasaron y los
controles fallidos fueron 0.

Resultado confirmado:

| control | resultado |
|---|---:|
| jugadores | 27 |
| jugadores normalizados | 27 |
| inscripciones | 27 |
| eventos | 368 |
| eventos vinculados | 60 |
| eventos pendientes | 308 |
| goleadores oficiales | 4 |
| autogoles | 1 |
| referencias rotas | 0 |

No se modificaron eventos, inscripciones, resultados ni goleadores. Los 308
eventos historicos continuan pendientes de vinculacion manual.

La estructura nueva quedo confirmada:

- `jugadores.nombre_normalizado` existe;
- `tp_normalizar_nombre_jugador(text)` existe;
- `jugadores_aliases` existe;
- filas de aliases: 0;
- RLS de aliases habilitado;
- aliases sin lectura publica;
- aliases sin escritura publica;
- indices esperados: 8;
- triggers esperados: 3;
- FKs esperadas en eventos: 2;
- `UNIQUE(nombre_normalizado)` global: no.

Hashes posteriores registrados:

| area | hash |
|---|---|
| `eventos_partido` | `eaccea24a78762ecea616417356660c7` |
| `inscripciones_jugadores` | `09b3ea7a7e94e4c0fb505c40b762e09a` |
| `goleadores_oficiales` | `c40a4eb88526fbb6bb377f2ab9507916` |
| jugadores historicos | `593ed9ecd9ca732561c6a313ca9c3ba9` |
| jugadores con nombre normalizado | `5471416c0a96d480bb64fe5dfd24e88d` |

El archivo temporal autorizado fue eliminado del repositorio. El SQL protegido
`sql/aplicar-identidad-jugadores.sql` se conserva bloqueado contra ejecucion
accidental.

## Recomendacion final

Dejar el Draft PR listo para revision final. El panel administrativo todavia no
fue adaptado; los nuevos eventos del Clausura deberan crearse por
`inscripcion_jugador_id` y no se deben cargar nombres libres del Clausura hasta
completar el siguiente PR del admin.

## Seguridad

- INSERT remotos: 0
- UPDATE remotos: 0
- DELETE remotos: 0
- ALTER remoto: 0
- CREATE remoto: 0
- DROP remoto: 0
- cambios RLS remotos: 0
- eventos modificados: 0
- jugadores creados: 0
- inscripciones modificadas: 0
- goleadores modificados: 0
- datos deportivos modificados: 0
