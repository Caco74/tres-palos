# Auditoria de estado actual - Tres Palos

Ultima actualizacion: 2026-07-21

Alcance: inspeccion del repositorio local, implementacion del aislamiento administrativo por torneo, sin consultas a Supabase remoto, sin cambios de base de datos y sin deploy.

Actualizacion 2026-07-21: se implemento en el repositorio un selector obligatorio de torneo de trabajo solo para el panel administrativo privado. Las funciones Netlify de partidos e incidencias ahora exigen `torneo_id`, validan existencia del torneo y verifican pertenencia del recurso antes de modificar datos. La web publica no recibio selector global de torneos y conserva el historial por campeonato dentro del detalle de equipo. Quedan pendientes las pruebas contra Netlify/Supabase reales y la verificacion de RLS remota.

## 1. Resumen ejecutivo

Tres Palos esta en una etapa de cierre tecnico del Apertura 2026 y preparacion del Clausura 2026. La aplicacion publica existe como sitio estatico HTML/CSS/JavaScript vanilla, consume Supabase por REST, tiene panel administrativo privado mediante funciones Netlify y ya incorpora varias piezas multitorneo basadas en `torneo_id`.

El proyecto avanzo respecto de la auditoria inicial: el repositorio ya contiene aislamiento administrativo por torneo para partidos, etapas e incidencias. Aun no conviene empezar a cargar datos productivos del Clausura hasta ejecutar pruebas reales contra Netlify/Supabase, confirmar los IDs remotos de torneos y verificar RLS/grants de `partidos` y `eventos_partido`.

El respaldo completo local del Apertura fue verificado desde `respaldos/apertura-2026-respaldo-completo-20260715-165226.json`: formato `tres-palos-respaldo-torneo-completo`, `torneo_id = 1`, 140 partidos, 368 eventos, 4 goleadores oficiales y 1 torneo incluido. La final en el respaldo tiene dos partidos finalizados: Sportivo A. Club 0-1 C. A. Carcarana y C.A. Carcarana 0-2 Sportivo A. Club, por lo que Sportivo A. Club queda campeon por global 2-1.

Riesgos principales:

- El aislamiento admin fue implementado en codigo, pero todavia no fue probado contra Supabase/Netlify reales.
- No se puede verificar desde el repositorio que Supabase remoto tenga RLS y permisos correctos en `partidos` y `eventos_partido`.
- El script de Clausura existe, pero solo prepara Fecha 1 y no prueba desde el repo que el Clausura remoto sea realmente `torneo_id = 2`.
- La visualizacion historica del Apertura esta implementada parcialmente: existe para playoffs y detalle de equipos, pero no como selector global de torneo para fixture/tabla/inicio.
- El respaldo completo existe como archivo local no trackeado en Git; el proceso reproducible para generarlo no esta guardado en `scripts/`.

## 2. Estado por area

| Area | Categoria | Evidencia | Estado |
| --- | --- | --- | --- |
| Web publica | Implementado | `index.html` define Inicio, Partidos, Tabla, Playoffs y Equipos; `js/app.js` renderiza cada vista. | Sitio publico funcional por estructura y codigo. No se hizo QA visual en navegador. |
| Panel administrativo | Implementado parcialmente | `tp-admin-7c9f2026.html`; `js/admin-panel.js`; funciones en `netlify/functions/admin-*.js`. | Permite cargar/editar partidos, clubes, planteles, incidencias, etapas y analitica. Ahora exige torneo de trabajo para partidos/incidencias; falta QA remoto. |
| Supabase | Implementado parcialmente | SQL en `supabase/`; REST en `js/app.js`; service role solo en Netlify. | Hay scripts para clubes, torneos, planteles, incidencias, goleadores y cierre de etapas. Falta schema base versionado de `partidos` y `eventos_partido`. |
| Autenticacion y seguridad | Riesgo o bloqueo | `js/admin-panel.js:268-275`; funciones Netlify `isAuthorized`; `tp-admin-7c9f2026.html:20-35`. | El admin usa una contrasena compartida enviada como header. Escritura validada en servidor, pero sin usuario, sesion firmada, rate limit ni permisos granulares. |
| Separacion entre torneos | Implementado parcialmente | `js/app.js:1281-1335`, `js/admin-panel.js`, `admin-partidos.js`, `admin-incidencias.js`, `admin-etapas.js:61-78`, `cierre-etapas.sql:318-986`. | Lectura publica filtra en memoria por `torneo_id`; cierre/restauracion usa `torneo_id`. Admin de partidos/incidencias fue aislado por torneo en codigo; falta prueba remota y revisar fallback publico. |
| Apertura historico | Implementado parcialmente | Respaldo local; `js/app.js:4389-4427`; `js/app.js:6371-6436`. | Respaldo completo verificado. UI historica existe para playoffs y detalle de equipos, no como selector global de todas las vistas. |
| Preparacion Clausura | Implementado parcialmente | `supabase/clausura-2026.sql`. | Script activa Clausura, cambia zonas y carga Fecha 1. No completa fixture 2-14 ni verifica remotamente que el id sea 2. |
| Partidos | Implementado parcialmente | Publico: `js/app.js:8343-8400`; admin: `admin-partidos.js`. | Se leen y editan partidos existentes. Admin lista por `torneo_id` y PATCH valida pertenencia. No hay alta admin general de fixture; Clausura depende de SQL. |
| Incidencias y goles | Implementado parcialmente | `admin-incidencias.js`, `js/admin-panel.js`, `js/app.js:5507-5798`. | Admin lista incidencias por partidos del torneo seleccionado y valida POST/PATCH/DELETE/reordenamiento contra `torneo_id`. Falta prueba remota con datos reales. |
| Tablas | Implementado | `js/app.js:1558-1696`, `js/app.js:5104-5220`. | Las posiciones se calculan sobre `state.partidos`, que se deriva del torneo activo/seleccionado. |
| Goleadores | Implementado parcialmente | `supabase/goleadores-oficiales.sql`; `js/app.js:1290-1303`, `js/app.js:5222-5263`. | Snapshot manual por torneo. Hay datos del Apertura; Clausura aparecera vacio hasta cargar snapshot/fuente. |
| Playoffs | Implementado parcialmente | `js/app.js:1734-2219`, `js/app.js:4317-4427`; `supabase/final-ida-vuelta.sql`. | UI y resolucion de llaves existen. El script historico de final no es seguro para multiples torneos porque infiere torneo desde la primera final. |
| Respaldos | Implementado parcialmente | `supabase/cierre-etapas.sql`; `respaldos/apertura-2026-respaldo-completo-20260715-165226.json`. | RPC de cierre/restauracion por etapa esta disenada con `torneo_id`. El respaldo completo local esta verificado, pero el proceso de generacion no esta versionado. |
| Deploy | No verificable desde el repositorio | `netlify.toml`, `robots.txt`, `sitemap.xml`. | Config Netlify existe. No se verificaron variables, deploy real ni estado de produccion. |
| Documentacion | Implementado parcialmente | `docs/estado-proyecto.md`. | Habia documentacion, pero estaba desactualizada respecto del cierre real del Apertura. Se agregan documentos de estado actual. |

## 3. Hallazgos concretos

### H1 - El frontend publico consulta tablas completas y filtra en memoria

- Archivo: `js/app.js`
- Funcion o seccion: carga de datos en `obtenerPartidos`, lineas `8343-8360`; aplicacion de filtro, lineas `1323-1335`.
- Problema detectado: las consultas REST publicas piden todos los registros de `partidos`, `eventos_partido`, `clubes`, `torneos` y `goleadores_oficiales`. El filtrado por torneo ocurre despues, en memoria.
- Impacto: para lectura publica puede funcionar, pero si falla la carga de `torneos` el codigo advierte que se muestran todos los partidos (`js/app.js:8416-8419`). Tambien expone mas datos de los necesarios al cliente.
- Prioridad: Alta antes de publicar Clausura.
- Solucion recomendada: mantener soporte historico, pero no degradar a "todos los partidos" si falla `torneos`; definir una carga por torneo activo y una carga historica explicita cuando el usuario seleccione historico.

### H2 - El aislamiento publico por torneo existe, pero depende de que `torneos` cargue bien

- Archivo: `js/app.js`
- Funcion o seccion: `filtrarPartidosPorTorneo`, `filtrarGoleadoresPorTorneo`, `filtrarEventosPorPartidos`, lineas `1281-1384`.
- Problema detectado: el aislamiento se aplica en la capa cliente y no en la consulta REST. Si no hay torneo activo verificable, el fallback puede dejar datos combinados.
- Impacto: tablas, goleadores y fixtures usan `state.partidos`/`state.goleadoresOficiales`, por lo que funcionan cuando `torneoActivo` esta definido; el riesgo esta en el fallback.
- Prioridad: Alta.
- Solucion recomendada: tratar la falta de `torneos` como error bloqueante para vistas deportivas, no como permiso para mostrar todo.

### H3 - El panel administrativo carga todos los partidos sin filtro de torneo

- Archivo: `netlify/functions/admin-partidos.js`
- Funcion o seccion: `listMatches`.
- Problema detectado: el endpoint admin devolvia `/rest/v1/partidos?select=*&order=id.asc` sin `torneo_id`.
- Impacto: al comenzar Clausura, el operador podia ver Apertura y Clausura juntos y editar un partido historico por error.
- Prioridad: Bloqueante obligatorio antes de cargar datos del Clausura.
- Estado 2026-07-21: corregido en codigo. `listMatches(event)` exige `torneo_id`, verifica que el torneo exista y consulta `partidos` con `torneo_id=eq.<id>`. No hay fallback a todos los partidos.
- Solucion recomendada: probar en Netlify/Supabase reales con Apertura y Clausura antes de cargar datos productivos.

### H4 - La actualizacion de partidos valida campos, pero no valida el torneo esperado

- Archivo: `netlify/functions/admin-partidos.js`
- Funcion o seccion: `updateMatch`; `getExistingMatch`; `assertMatchTournament`.
- Problema detectado: el PATCH buscaba y actualizaba por `id`; no recibia ni comprobaba un `torneo_id` esperado. El campo `torneo_id` no estaba en `ALLOWED_FIELDS`, lo cual evitaba mover partidos entre torneos, pero no evitaba editar el torneo equivocado.
- Impacto: si se seleccionaba un ID del Apertura, se podia modificar el historico mientras se trabajaba en Clausura.
- Prioridad: Bloqueante obligatorio antes de cargar datos.
- Estado 2026-07-21: corregido en codigo. El frontend envia `torneo_id`; el servidor exige torneo valido, busca el partido y rechaza con 403 si `partido.torneo_id` no coincide. El PATCH final tambien condiciona por `id` y `torneo_id`.
- Solucion recomendada: ejecutar pruebas manipulando requests contra una funcion Netlify real.

### H5 - El panel administrativo carga todas las incidencias sin filtro de torneo

- Archivo: `netlify/functions/admin-incidencias.js`
- Funcion o seccion: `listEvents`; `getTournamentMatchIds`.
- Problema detectado: devolvia todas las filas de `eventos_partido`, ordenadas por partido, sin recorte por torneo.
- Impacto: las incidencias de Apertura y Clausura quedaban en la misma superficie de trabajo; aumentaba riesgo de editar o borrar datos historicos.
- Prioridad: Bloqueante obligatorio antes de cargar goles/incidencias del Clausura.
- Estado 2026-07-21: corregido en codigo. `listEvents(event)` exige `torneo_id`, valida el torneo y consulta incidencias solo para `partido_id` pertenecientes a partidos de ese torneo.
- Solucion recomendada: probar con torneos con y sin partidos para confirmar estado vacio y ausencia de fallback global.

### H6 - Las eliminaciones de incidencias operan por ID y no por torneo esperado

- Archivo: `netlify/functions/admin-incidencias.js`
- Funcion o seccion: `saveEvent`, `deleteEvent`, `reorderEvents`, `patchEventOrder`.
- Problema detectado: el delete recibia solo `id`, buscaba la incidencia y borraba por `id`. Validaba etapa cerrada mediante el partido, pero no exigia que el request declare el torneo activo.
- Impacto: una incidencia historica podia borrarse si el operador la seleccionaba desde el listado global y su etapa estaba abierta o no existia en `etapas_estado`.
- Prioridad: Alta.
- Estado 2026-07-21: corregido en codigo. POST/PATCH/DELETE/reordenamiento exigen `torneo_id`; el servidor valida incidencia, partido original, partido nuevo si corresponde y pertenencia al torneo. Las escrituras finales de eventos condicionan por `id` y `partido_id`.
- Solucion recomendada: ejecutar pruebas manuales de requests cruzados Apertura/Clausura.

### H7 - El cierre/restauracion de etapas esta bien orientado por torneo, pero no se verifica que este aplicado en Supabase remoto

- Archivo: `supabase/cierre-etapas.sql`
- Funcion o seccion: `tp_cerrar_etapa`, `tp_reabrir_etapa`, `tp_restaurar_respaldo`, lineas `543-986`.
- Problema detectado: el SQL esta preparado con `p_torneo_id`, locks por torneo y validaciones contra backups de otro torneo. Sin conexion a Supabase remoto no se puede comprobar que ya este ejecutado.
- Impacto: el panel puede mostrar "ejecuta cierre-etapas.sql" si las tablas/RPC no existen; y si Apertura no quedo cerrado por etapa, el admin podria editar historico.
- Prioridad: Alta.
- Solucion recomendada: verificar en Supabase remoto existencia de `etapas_estado`, `respaldos_etapa` y RPC; confirmar que las etapas del Apertura esten cerradas antes de abrir carga Clausura.

### H8 - No hay schema base versionado para `partidos`

- Archivo: `supabase/`
- Funcion o seccion: busqueda en SQL del repositorio.
- Problema detectado: no existe `create table public.partidos` en los scripts; solo alteraciones e inserts (`planteles.sql`, `clausura-2026.sql`, `final-ida-vuelta.sql`).
- Impacto: no se puede reconstruir o auditar completamente la tabla central desde el repositorio. Tampoco se verifica desde repo RLS, constraints de estado/tipo/fase ni grants de lectura publica.
- Prioridad: Alta antes de tocar datos nuevos.
- Solucion recomendada: documentar o versionar el schema real de `partidos`, incluyendo RLS, grants, constraints e indices.

### H9 - RLS/permisos de `partidos` y `eventos_partido` no son verificables desde el repo

- Archivo: `supabase/`
- Funcion o seccion: busqueda de `alter table public.partidos enable row level security`, `create policy` y grants.
- Problema detectado: no hay politica RLS versionada para `partidos`; para `eventos_partido` el repo solo muestra grant a `service_role` en `supabase/incidencias.sql:124-125`, aunque el frontend lee esa tabla con anon key.
- Impacto: la seguridad real depende de configuracion remota no versionada. Puede haber lecturas publicas previstas, pero no se puede auditar si hay escrituras anonimas bloqueadas.
- Prioridad: Bloqueante antes de publicar.
- Solucion recomendada: exportar/verificar politicas reales y dejar un SQL de seguridad minimo para `partidos` y `eventos_partido`.

### H10 - El script de Clausura prepara solo el arranque

- Archivo: `supabase/clausura-2026.sql`
- Funcion o seccion: alta/activacion de torneo, lineas `7-30`; fixture Fecha 1, lineas `76-133`; copia de planteles, lineas `140-170`.
- Problema detectado: activa Clausura, desactiva otros torneos, actualiza zonas globales de clubes y carga solo Fecha 1.
- Impacto: permite iniciar la competencia, pero no deja fixture completo ni prueba que el torneo remoto resultante sea `torneo_id = 2`.
- Prioridad: Alta.
- Solucion recomendada: verificar primero filas de `torneos`; luego preparar carga incremental de fixture completo con fuente confirmada.

### H11 - El script historico de final no es seguro para multiples torneos

- Archivo: `supabase/final-ida-vuelta.sql`
- Funcion o seccion: seleccion de `v_torneo_id`, lineas `8-13`.
- Problema detectado: toma el `torneo_id` desde el primer partido `playoff/final` que encuentre.
- Impacto: con Apertura y Clausura en la misma tabla, rerunear este script puede apuntar al torneo equivocado.
- Prioridad: Media.
- Solucion recomendada: no usarlo para Clausura; si vuelve a necesitarse, parametrizar por `p_torneo_id`.

### H12 - La visualizacion historica no cubre todas las vistas principales

- Archivo: `js/app.js`
- Funcion o seccion: `switchTab`, lineas `243-257`; restauracion de vista, lineas `461-467`; selector playoffs, lineas `4389-4427`; historial de equipos, lineas `6371-6436`.
- Problema detectado: la seleccion historica se conserva en Playoffs y detalle de equipos, pero al navegar a Inicio, Partidos, Tabla o Equipos se restaura el torneo vigente.
- Impacto: el Apertura queda parcialmente disponible como historico, no como campeonato completo navegable desde todas las vistas.
- Prioridad: Media antes de publicacion completa del historico; no bloquea carga inicial si admin esta protegido.
- Solucion recomendada: definir una politica de UI historica: selector global o solo historico limitado, pero documentarlo y evitar inconsistencias.

### H13 - Goleadores oficiales son un snapshot manual por torneo

- Archivo: `supabase/goleadores-oficiales.sql`
- Funcion o seccion: tabla y carga Apertura, lineas `3-151`; frontend, `js/app.js:1290-1303` y `js/app.js:5222-5263`.
- Problema detectado: hay 4 goleadores destacados del Apertura con `torneo_id = 1`; no hay proceso automatico de goleadores por eventos ni datos de Clausura.
- Impacto: la pestana Goleadores del Clausura aparecera vacia hasta cargar snapshot confiable.
- Prioridad: Media; no bloquea cargar partidos, si se acepta estado vacio.
- Solucion recomendada: cargar snapshot oficial del Clausura solo cuando exista fuente confiable; no intentar calcularlo desde incidencias incompletas.

### H14 - El respaldo completo del Apertura esta verificado, pero no versionado como procedimiento

- Archivo: `respaldos/apertura-2026-respaldo-completo-20260715-165226.json`; carpeta `scripts/`.
- Funcion o seccion: metadata del JSON, lineas `3-19`; `scripts/` sin archivos.
- Problema detectado: el artefacto existe y fue validado, pero no hay script reproducible en el repo para regenerar respaldo completo.
- Impacto: ante una restauracion futura, la evidencia existe, pero el proceso depende de conocimiento externo.
- Prioridad: Media.
- Solucion recomendada: documentar procedimiento de export completo en una tarea posterior; no tocar ahora el backup.

### H15 - El respaldo local figura como no trackeado en Git

- Archivo: estado Git.
- Funcion o seccion: `git status --short` devolvio `?? respaldos/`.
- Problema detectado: el respaldo esta presente en disco, pero no aparece trackeado por Git.
- Impacto: otro entorno o deploy no necesariamente tendra el respaldo.
- Prioridad: Media.
- Solucion recomendada: decidir si el respaldo se versiona, se guarda en almacenamiento privado o se ignora explicitamente; no borrar.

### H16 - La seguridad admin depende de una contrasena compartida

- Archivo: `js/admin-panel.js`, `netlify/functions/admin-*.js`, `tp-admin-7c9f2026.html`.
- Funcion o seccion: storage/header admin, `js/admin-panel.js:185-186` y `js/admin-panel.js:268-275`; validacion `isAuthorized` en funciones Netlify.
- Problema detectado: la contrasena se guarda en `sessionStorage` y se envia en cada request como `x-admin-password`; las funciones comparan contra `ADMIN_PASSWORD`.
- Impacto: no expone service role, pero no hay auditoria de usuarios, vencimiento, rotacion por usuario ni rate limiting.
- Prioridad: Alta antes de publicar con carga activa.
- Solucion recomendada: minimo reforzar acceso externo al panel y rotacion de secreto; idealmente usar auth real o proteccion de acceso de Netlify.

### H17 - `node --check` local no esta disponible

- Archivo: entorno local.
- Funcion o seccion: intento de `node --check`.
- Problema detectado: `node` no esta instalado o no esta en PATH en este entorno.
- Impacto: no se puede usar el comando local `node --check`.
- Prioridad: Baja para documentacion; media para release.
- Estado 2026-07-21: se uso el runtime Node de herramientas con `vm.Script` para compilar `js/admin-panel.js`, `netlify/functions/admin-partidos.js` y `netlify/functions/admin-incidencias.js`; los tres pasaron sintaxis.
- Solucion recomendada: ejecutar igualmente `node --check` o una prueba equivalente en el entorno de desarrollo/deploy antes de publicar.

## 3.1 Actualizacion implementada - aislamiento admin por torneo

Archivos modificados:

- `tp-admin-7c9f2026.html`: agrega selector obligatorio de torneo de trabajo solo en el panel privado y actualiza version de assets admin.
- `styles/admin.css`: agrega estilos minimos para estado/selector de torneo de trabajo.
- `js/admin-panel.js`: carga torneos desde `admin-partidos?scope=torneos`, conserva seleccion solo en `sessionStorage` tras revalidarla, limpia partido/incidencias/formularios al cambiar de torneo y bloquea operaciones sensibles sin torneo.
- `netlify/functions/admin-partidos.js`: lista partidos solo con `torneo_id`, agrega listado de torneos, valida torneo existente y pertenencia del partido antes de PATCH.
- `netlify/functions/admin-incidencias.js`: lista incidencias por partidos del torneo seleccionado y valida POST/PATCH/DELETE/reordenamiento contra torneo, partido e incidencia.

Nuevo flujo administrativo:

1. El admin se autentica con `ADMIN_PASSWORD`.
2. El panel carga torneos desde la tabla `torneos`.
3. Sin torneo seleccionado, partidos, etapas, modo partido e incidencias quedan en estado vacio/bloqueado.
4. Al elegir torneo, se limpian partido seleccionado, incidencias, formularios, etapas, resultados y estados temporales.
5. Recién entonces se cargan partidos con `partidos.torneo_id = torneoSeleccionadoId` y eventos vinculados a partidos de ese torneo.

Validaciones agregadas:

- `admin-partidos` devuelve 400 si falta `torneo_id`, 404 si el torneo o partido no existe y 403 si el partido pertenece a otro torneo.
- `admin-incidencias` devuelve 400 si falta `torneo_id`, 404 si torneo/partido/incidencia no existe y 403 si el recurso pertenece a otro torneo.
- Las escrituras finales de partidos condicionan por `id` + `torneo_id`.
- Las escrituras finales de incidencias condicionan por `id` + `partido_id` despues de validar que ese partido pertenece al torneo de trabajo.

Pruebas realizadas:

- `git diff --check`: aprobado; solo advierte normalizacion LF/CRLF.
- Runtime Node de herramientas con `vm.Script`: sintaxis OK en `js/admin-panel.js`, `netlify/functions/admin-partidos.js` y `netlify/functions/admin-incidencias.js`.
- Pruebas unitarias locales con `fetch` simulado para funciones Netlify: `admin-partidos` responde 400 sin `torneo_id`, 404 con torneo inexistente, 403 si el partido pertenece a otro torneo y 200 en PATCH valido.
- Pruebas unitarias locales con `fetch` simulado para `admin-incidencias`: GET sin torneo 400, GET de torneo valido 200, POST en partido de otro torneo 403, POST valido 201, PATCH de incidencia de otro torneo 403, PATCH valido 200, DELETE de otro torneo 403, DELETE valido 200, DELETE sin torneo 400, DELETE con torneo inexistente 404, reordenamiento valido 200 y reordenamiento de otro torneo 403.
- Busqueda estatica: no quedan llamadas `apiRequest("GET")` para `admin-partidos` sin URL con `torneo_id`.
- Busqueda estatica: no queda el endpoint admin de partidos con `/rest/v1/partidos?select=*&order=id.asc`.
- Busqueda estatica: no queda el endpoint admin de incidencias con listado global `/rest/v1/eventos_partido?select=*&order=partido_id.desc,orden.asc,id.asc`.

Pruebas no ejecutables en este entorno:

- `node --check` local: no ejecutable porque `node` no esta instalado o no esta en PATH.
- Pruebas reales contra Supabase/Netlify: no ejecutables desde el repositorio local sin credenciales/entorno remoto.
- Casos con Apertura/Clausura reales, interfaz en navegador, requests manipulados contra Netlify real y fallos de carga de torneos: quedan como verificacion manual pendiente.

## 4. Bloqueantes del Clausura

### Bloqueantes obligatorios antes de cargar datos

1. Verificar Supabase remoto: `torneos` debe tener Apertura `id = 1` historico y Clausura `id = 2` activo o preparado para activarse.
2. Probar en entorno real que el panel admin implementado trabaja contra un torneo seleccionado y no contra todos los partidos/incidencias.
3. Probar requests manipulados contra funciones Netlify: sin `torneo_id`, torneo inexistente y recursos de otro torneo.
4. Verificar que `partidos` y `eventos_partido` tengan RLS/grants adecuados: lectura publica necesaria, escritura solo via service role.
5. Confirmar que el Apertura esta bloqueado/cerrado o protegido contra ediciones accidentales.

### Bloqueantes antes de publicar

1. Probar flujo completo Clausura: crear/cargar partido, editar resultado, cargar incidencia, confirmar fuente, ver tabla y goleadores vacios sin romper UI.
2. Confirmar que el fallback publico no muestra datos mezclados si falla `torneos`.
3. Verificar deploy real de Netlify con variables `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` y `ADMIN_PASSWORD`.
4. Ejecutar QA visual minimo de Inicio, Partidos, Tabla, Playoffs, Equipos y detalle de partido.
5. Definir como se accede al Apertura historico en UI y documentar lo que quede fuera.

### Mejoras que pueden esperar

1. Automatizar goleadores desde incidencias.
2. Redisenar la vista Datos.
3. Agregar estadisticas decorativas.
4. Migrar stack a frameworks o TypeScript.
5. Crear funciones sociales, monetizacion o expansion a otras ligas.

## 5. Proximos pasos

1. Objetivo: validar aislamiento admin en entorno real.
   - Archivos/areas: `tp-admin-7c9f2026.html`, `js/admin-panel.js`, `netlify/functions/admin-partidos.js`, `netlify/functions/admin-incidencias.js`.
   - Resultado esperado: el admin carga y edita solo el torneo seleccionado.
   - Criterio de terminado: listados, PATCH, DELETE, POST y reordenamiento rechazan datos de otro `torneo_id` en Netlify/Supabase reales.

2. Objetivo: verificar seguridad real de Supabase.
   - Archivos/areas: Supabase remoto, SQL de politicas.
   - Resultado esperado: `partidos` y `eventos_partido` permiten lectura publica necesaria y bloquean escritura anonima.
   - Criterio de terminado: queries de politicas/grants guardadas o documentadas con evidencia.

3. Objetivo: confirmar IDs reales de torneos.
   - Archivos/areas: tabla `torneos`, `supabase/clausura-2026.sql`.
   - Resultado esperado: Apertura = `torneo_id = 1`, Clausura = `torneo_id = 2`.
   - Criterio de terminado: consulta remota validada antes de insertar fixture.

4. Objetivo: proteger Apertura historico.
   - Archivos/areas: `etapas_estado`, `respaldos_etapa`, admin.
   - Resultado esperado: Apertura no se puede editar por accidente desde el panel.
   - Criterio de terminado: intento de editar partido/incidencia de Apertura desde modo Clausura devuelve error.

5. Objetivo: probar `supabase/clausura-2026.sql` en entorno controlado.
   - Archivos/areas: SQL Clausura, tabla `torneos`, tabla `partidos`, tabla `inscripciones_jugadores`.
   - Resultado esperado: Clausura activo, Fecha 1 cargada sin duplicados, planteles copiados como `por_verificar`.
   - Criterio de terminado: conteos y muestras verificadas por `torneo_id = 2`.

6. Objetivo: definir alcance historico publico del Apertura.
   - Archivos/areas: `js/app.js`, README/ROADMAP.
   - Resultado esperado: decision clara entre selector global o historico limitado.
   - Criterio de terminado: comportamiento documentado y sin datos mezclados.

7. Objetivo: completar fixture Clausura con fuente confirmada.
   - Archivos/areas: SQL o panel admin, tabla `partidos`.
   - Resultado esperado: fechas 2 a 14 cargadas para `torneo_id = 2`.
   - Criterio de terminado: conteo por fecha/zona validado.

8. Objetivo: ejecutar prueba completa de carga.
   - Archivos/areas: panel admin, funciones Netlify, web publica.
   - Resultado esperado: un partido de Clausura puede pasar de programado a finalizado con incidencias y reflejarse en tabla.
   - Criterio de terminado: checklist de flujo completado sin tocar Apertura.

9. Objetivo: verificar sintaxis y despliegue.
   - Archivos/areas: JavaScript, Netlify.
   - Resultado esperado: sin errores sintacticos y deploy preparado.
   - Criterio de terminado: `node --check` o equivalente ejecutado y variables verificadas.

10. Objetivo: decidir gestion del respaldo completo.
    - Archivos/areas: `respaldos/`, almacenamiento externo o Git.
    - Resultado esperado: respaldo preservado de forma intencional.
    - Criterio de terminado: backup versionado o ubicado en almacenamiento seguro documentado.
