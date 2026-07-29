# Prevalidacion remota - identidad de jugadores

Fecha: 2026-07-29
Zona horaria: America/Buenos_Aires
Rama: `db/identidad-jugadores`
Entorno: workspace local `C:\Users\franc\Desktop\2026\Project003`

## Resultado

Estado: **REQUIERE CONFIGURACION SEGURA**

No se ejecuto `sql/prevalidar-identidad-jugadores.sql` contra Supabase
produccion porque el entorno local no tiene credenciales seguras ni cliente SQL
disponible.

## Conexion remota

Revision de credenciales disponibles:

| variable / herramienta | estado |
|---|---|
| `SUPABASE_URL` | no disponible en entorno local |
| `SUPABASE_SERVICE_ROLE_KEY` | no disponible en entorno local |
| `SUPABASE_DB_URL` | no disponible en entorno local |
| `DATABASE_URL` | no disponible en entorno local |
| `POSTGRES_URL` | no disponible en entorno local |
| `NETLIFY_AUTH_TOKEN` | no disponible en entorno local |
| `NETLIFY_SITE_ID` | no disponible en entorno local |
| `ADMIN_PASSWORD` | no disponible en entorno local |
| `.env*` local | no presente |
| `psql` | no instalado o no disponible en PATH |
| `netlify` CLI | no instalado o no disponible en PATH |

El proyecto obtiene credenciales seguras en produccion desde variables de
entorno de Netlify. Las funciones administrativas esperan
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` y `ADMIN_PASSWORD`. Los scripts de
respaldo que requieren service role tambien leen variables de entorno, sin
guardarlas en Git.

La anon key versionada en `js/config.js` no es una credencial segura y en la
tarea anterior fallo para lectura remota con `Invalid API key`. No se uso para
esta prevalidacion.

## Esquema remoto confirmado

No confirmado. Bloqueante: falta una de estas rutas seguras:

- conexion Postgres de solo lectura o credencial de base (`DATABASE_URL`,
  `SUPABASE_DB_URL` o `POSTGRES_URL`) mas cliente SQL disponible;
- o variables `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` junto con un
  mecanismo seguro que ejecute exclusivamente la SQL de lectura;
- o CLI/conector seguro de Netlify/Supabase que permita leer las variables de
  entorno sin imprimirlas.

## Comparacion disponible sin conexion remota

| fuente | estado | observacion |
|---|---|---|
| SQL versionado | auditado | `supabase/planteles.sql`, `supabase/incidencias.sql`, RLS/grants versionados y funciones Netlify. |
| respaldo local Apertura 2026 | auditado | `respaldos/apertura-2026-respaldo-completo-20260715-165226.json`, fuera de Git. |
| modelo propuesto | auditado | reutiliza `jugadores` e `inscripciones_jugadores`; agrega normalizacion y aliases. |
| Supabase remoto real | no confirmado | bloqueado por credenciales seguras faltantes. |

## Cantidades desde respaldo local Apertura

| metrica | valor |
|---|---:|
| partidos Apertura | 140 |
| eventos Apertura | 368 |
| jugadores existentes | 27 |
| inscripciones existentes | 27 |
| goleadores oficiales snapshot | 4 |
| eventos con `inscripcion_jugador_id` | 60 |
| eventos sin `inscripcion_jugador_id` | 308 |
| eventos con texto `jugador` | 368 |
| nombres unicos exactos | 177 |
| nombres unicos normalizados | 177 |
| autogoles | 1 |
| migrables automaticamente nuevos | 0 |
| revision manual requerida | 308 |

Homónimos canónicos ya existentes en el respaldo:

- `Sanchez`: dos jugadores distintos en Porvenir y Carcarañá.
- `Sarco`: dos jugadores distintos en Carcarañá y Montes de Oca.

## Jugadores

Pendiente de confirmar remoto:

- columnas actuales y tipos;
- claves e indices efectivos;
- politicas RLS efectivas;
- cantidad actual;
- nombres vacios;
- duplicados exactos;
- duplicados normalizados;
- registros inactivos.

Evidencia local/versionada:

- `jugadores` existe con `id`, `nombre_completo`, `aliases`, `activo`,
  `creado_en`, `actualizado_en`;
- no existe `nombre_normalizado` en el respaldo local;
- el modelo no usa `nombre_normalizado` como identidad unica global.

## Inscripciones

Pendiente de confirmar remoto:

- claves foraneas reales;
- restriccion unica vigente;
- cantidades por torneo y club;
- duplicados;
- filas sin jugador/club/torneo;
- cambios de club entre torneos.

Evidencia local/versionada:

- `inscripciones_jugadores` existe y referencia jugador, club y torneo;
- la restriccion versionada actual es `unique(jugador_id, club_id, torneo_id)`;
- una persona puede tener multiples inscripciones por torneo/club.

## Eventos historicos

Pendiente de confirmar remoto:

- cantidad total real actual;
- cantidad por torneo;
- referencias rotas;
- uso real actual de `inscripcion_relacionada_id`;
- tipos de incidencia actuales;
- semantica remota actual de autogoles.

Evidencia local/versionada:

- Apertura respaldo: 368 eventos, 60 vinculados, 308 sin ID;
- todos conservan texto `jugador`;
- tipos detectados: `gol`, `gol_penal`, `gol_en_contra`, `roja`;
- autogol historico auditado: evento `384`, Carcarañá 0-2 Sportivo,
  `ANGELETTI JOAQUIN`, `equipo_id=57`, observacion indica que beneficia a
  Sportivo.

## Goleadores oficiales

Pendiente de confirmar remoto:

- estructura real actual;
- cantidad por torneo;
- coexistencia con futuras vistas por ID.

Evidencia local/versionada:

- `goleadores_oficiales` es snapshot manual;
- depende de `jugador_nombre` textual;
- puede coexistir temporalmente con goleadores calculados por eventos si se
  evita contar ambas fuentes en una misma vista.

## Cambios exactos que aplicaria `sql/aplicar-identidad-jugadores.sql`

Bloqueos y validaciones:

- abre transaccion con `begin`;
- falla hasta reemplazar `PENDIENTE_AUTORIZACION` por
  `AUTORIZO IDENTIDAD JUGADORES`;
- valida existencia de tablas requeridas;
- valida columnas requeridas;
- exige Apertura con 140 partidos;
- exige al menos 300 eventos historicos de Apertura;
- bloquea si hay mas de un torneo activo.

Funciones:

- crea o reemplaza `public.tp_normalizar_nombre_jugador(text)`;
- crea trigger function `public.tp_jugadores_normalizar_trigger()`;
- crea trigger function `public.tp_jugadores_aliases_normalizar_trigger()`;
- crea trigger function `public.tp_validar_evento_inscripcion_jugador()`.

Columnas:

- agrega `public.jugadores.nombre_normalizado`.

Backfills:

- completa `jugadores.nombre_normalizado` desde `nombre_completo`;
- copia aliases existentes de `jugadores.aliases` a `jugadores_aliases`.

Tablas:

- crea `public.jugadores_aliases`.

Indices:

- `jugadores_nombre_normalizado_idx`;
- `jugadores_aliases_jugador_idx`;
- `jugadores_aliases_busqueda_idx`;
- `jugadores_aliases_contexto_unico_idx`;
- `eventos_partido_inscripcion_idx`;
- `eventos_partido_inscripcion_relacionada_idx`;
- `inscripciones_jugador_torneo_idx`;
- `inscripciones_torneo_club_estado_idx`.

Claves y restricciones:

- FK `eventos_partido.inscripcion_jugador_id` a
  `inscripciones_jugadores(id)` con `ON DELETE RESTRICT`;
- FK `eventos_partido.inscripcion_relacionada_id` a
  `inscripciones_jugadores(id)` con `ON DELETE RESTRICT`;
- FKs de `jugadores_aliases` a jugador, club y torneo con
  `ON DELETE RESTRICT`;
- check de `jugadores.nombre_normalizado`;
- checks de alias no vacio.

Triggers:

- normaliza `jugadores.nombre_normalizado` antes de insert/update;
- normaliza `jugadores_aliases.alias_normalizado` antes de insert/update;
- valida que la inscripcion de un evento corresponda al torneo del partido y a
  uno de los clubes participantes.

RLS y permisos:

- habilita RLS en `jugadores_aliases`;
- no crea politica de lectura publica para aliases;
- revoca permisos de `public`, `anon` y `authenticated`;
- otorga lectura/escritura de aliases solo a `service_role`;
- no expone service role.

Confirmaciones del SQL:

- no borra datos;
- no modifica resultados;
- no cambia clubes;
- no cambia torneos;
- no cambia el torneo activo;
- no vincula automaticamente los 308 casos manuales;
- conserva `eventos_partido.jugador`;
- no crea `UNIQUE(nombre_normalizado)` global;
- soporta homonimos;
- soporta cambios de club entre torneos mediante inscripciones separadas;
- contempla autogol porque no exige `inscripcion.club_id = evento.equipo_id`.

## RLS y aliases

Decision revisada: `jugadores_aliases` no debe tener lectura anonima publica.
No hay necesidad documentada del frontend publico para mostrar aliases. El
frontend puede seguir leyendo `jugadores.nombre_completo` cuando corresponda;
los aliases quedan como herramienta administrativa para conciliacion.

## Diferencias encontradas

Confirmadas localmente:

- la tarea anterior habia propuesto lectura publica de aliases; se corrigio a
  acceso solo administrativo;
- el respaldo local contiene homonimos canonicos, por lo que
  `UNIQUE(nombre_normalizado)` global seria incorrecto.

No confirmadas remotamente por bloqueo:

- si el esquema remoto actual ya tiene columnas nuevas o restricciones
  distintas;
- si los conteos remotos coinciden con el respaldo local;
- si Clausura remoto ya tiene eventos cargados;
- si existen aliases o normalizaciones aplicadas fuera del respaldo local.

## Riesgos

- Aplicar sin prevalidacion remota real podria fallar por drift de esquema.
- Si el remoto tiene eventos Clausura ya cargados, la verificacion local queda
  desactualizada.
- Si existen transferencias dentro del mismo torneo, la restriccion actual de
  inscripciones puede requerir revision antes de endurecer reglas.

## Bloqueantes

1. Falta credencial segura o conexion SQL para ejecutar
   `sql/prevalidar-identidad-jugadores.sql`.
2. Falta cliente SQL (`psql`) o herramienta equivalente disponible en el
   entorno.
3. No hay acceso local a variables Netlify para reutilizar service role sin
   imprimir secretos.

## Recomendacion final

No autorizar `sql/aplicar-identidad-jugadores.sql` todavia.

Configurar una ruta segura de prevalidacion remota y reintentar. No pegar
valores de credenciales en el chat; deben quedar en variables de entorno
locales ignoradas por Git, en un gestor seguro o en el entorno de Netlify.

## Seguridad

- INSERT remotos: 0
- UPDATE remotos: 0
- DELETE remotos: 0
- ALTER remoto: 0
- CREATE remoto: 0
- cambios RLS remotos: 0
- eventos modificados: 0
- jugadores creados: 0
- datos deportivos modificados: 0
