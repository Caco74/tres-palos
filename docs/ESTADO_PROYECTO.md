# Tres Palos — Estado del proyecto

Fecha de auditoría original: 2026-08-09, America/Buenos_Aires.

Última actualización operativa: 2026-08-14, cierre de seguridad validado en producción y cambio de foco hacia operación/lanzamiento.

Referencias de auditoría original y actualización actual:

- Rama de trabajo actual: `feat/eventos-publicos-vista`.
- HEAD local al actualizar este documento: `8f80ec04d5907e783900cd0a961ab88dc0b24ecc`.
- Rama documental de la auditoría original: `docs/estado-proyecto-auditoria`.
- Base de la rama documental: `origin/main` actualizado con `git fetch origin`.
- `origin/main` auditado: `1d8b3f8fa539738070fd1cd32bcb07559eaa1df8`.
- Commit base/documental actual: `1d8b3f8fa539738070fd1cd32bcb07559eaa1df8`.
- Rama de código auditada originalmente: `feat/jerarquia-visual-detalle-equipos`.
- HEAD de la rama auditada originalmente: `c7f035006d860b42455b45d63fbf563bb5eef41a`.
- `main` local no fue fast-forwardeado manualmente: `3ca5b33468883663597943d058ff62726863ff62`.
- Validación post-fetch: no hay diferencias de árbol entre `feat/jerarquia-visual-detalle-equipos` (`c7f0350`) y `origin/main` (`1d8b3f8`); la diferencia real es el merge commit de PR #15.
- Nota histórica de la auditoría original: no se hizo `pull`, `merge` manual, deploy ni cambios remotos fuera de `git fetch`, `push` de la rama documental y creación del PR documental.

Marcas usadas:

- ✅ Confirmado
- 🟡 Parcial / verificar
- 🔴 Problema
- ⚪ Pendiente

Alcance original: auditoría estática del repositorio local, `git fetch origin`, lecturas remotas de solo consulta a GitHub y ejecución local segura de tests con mocks. En ese momento no se consultó ni modificó Supabase remoto y no se verificó Netlify remoto ni producción.

## 0. Estado vigente posterior al cierre de seguridad

✅ La auditoría de seguridad quedó formalmente cerrada y validada en producción.

✅ FASE A/B/C cerradas.

✅ Default privileges y FASE D cerrados.

✅ `eventos_partido` quedó corregido:

- `anon` ya no puede leer `public.eventos_partido`.
- `anon` sí puede leer `public.eventos_partido_publicos`.
- `public.eventos_partido_publicos` sólo expone eventos confirmados y columnas públicas.
- PR #17 fue mergeado.
- Deploy Preview OK.
- Producción OK.
- Producción post-revoke OK.
- Post-snapshot final con `all_checks_passed=true`.

✅ Decisión operativa: no volver a auditar ACL, RLS, default privileges ni policies sin un motivo concreto. Motivos válidos: cambio real de schema/permisos/policies, nueva tabla o vista expuesta, nueva función con privilegios, incidente, alerta, evidencia de regresión o preparación de una migración sensible.

Etapa actual del proyecto:

1. Cierre técnico/documental definitivo.
2. Operación y recuperación.
3. Prueba completa de carga, edición, incidencias y publicación.
4. Backup y restauración.
5. Riesgos operativos pendientes.
6. Validación durante el Clausura.
7. SEO y preparación de lanzamiento.
8. Conseguir usuarios reales.

## 1. Qué es Tres Palos

✅ Confirmado: Tres Palos es una web estática de datos de fútbol regional de la Liga Cañadense. La app pública reúne fixture, resultados, posiciones, playoffs, equipos, detalle de partidos, incidencias y goleadores. El panel privado administra partidos, resultados, estados, clubes, planteles, incidencias, etapas y analítica.

✅ Confirmado: el stack es HTML, CSS y JavaScript vanilla, Supabase/Postgres por REST, funciones Netlify para operaciones con privilegios y Google Analytics/analítica propia.

✅ Confirmado: el producto ya es multitorneo por `torneo_id`; el foco pendiente es validar operación real durante Clausura y documentar recuperación, no reabrir la auditoría de permisos.

## 2. Arquitectura actual

✅ Confirmado: no hay `package.json`, bundler ni paso de build versionados. El sitio se sirve desde la raíz (`netlify.toml` con `publish = "."`).

Bloques principales:

- `index.html`: shell de la app pública, SEO base, navegación, secciones Inicio/Partidos/Tabla/Playoffs/Datos/Equipos, footer y carga de scripts.
- `tp-admin-7c9f2026.html`: panel privado no indexable, formularios admin, selector de torneo de trabajo, edición de partidos, modo partido, clubes, planteles, incidencias, etapas y analítica.
- `acerca.html` y `404.html`: página institucional y error 404.
- `styles/main.css`, `styles/admin.css`, `styles/about.css`: estilos públicos, admin y página acerca.
- `js/app.js`: lógica pública principal, ruteo de vistas, carga Supabase, render de Inicio, Partidos, Tabla, Goleadores, Playoffs, Equipos, detalle de partido/equipo, estados e historial.
- `js/public-tournament.js`: helpers testables de torneo público, preview, filtrado por torneo, fechas libres, tablas y estados resueltos.
- `js/admin-panel.js`: lógica del panel privado, autenticación por password, torneo de trabajo, CRUD operativo vía funciones Netlify, validaciones de cliente y UI admin.
- `js/admin-match-flow.js`: helpers testables para ordenar, filtrar y sugerir partidos en admin.
- `js/utils.js`: estado global, mapeos locales de clubes/escudos/nombres y helpers.
- `js/analytics.js`: medición de pestañas y partidos a Netlify + Google Analytics.
- `js/config.js`: URL Supabase y clave pública anon.
- `js/api.js`, `js/router.js`: archivos vacíos cargados por `index.html`.
- `js/state.js`: archivo mínimo con comentario de estado global.
- `netlify/functions/*.js`: endpoints admin, analítica y goleadores públicos.
- `supabase/*.sql`: migraciones/esquemas parciales para torneos, clubes, planteles, incidencias, goleadores, cierre de etapas, analítica y scripts históricos.
- `sql/*.sql`: scripts protegidos de carga/verificación/corrección.
- `scripts/*.js`: preparación, carga protegida, auditoría y respaldo local.
- `data/clausura-2026/*.json`: fixture oficial preparado y mapeo de clubes.
- `respaldos/*.json`: respaldos locales ignorados por Git.
- `docs/`, `reports/`, `README.md`, `ROADMAP.md`, `CHECKLIST_LANZAMIENTO.md`, `AUDITORIA_ESTADO_ACTUAL.md`: documentación y evidencia histórica.
- `assets/`: marca, favicons, imagen social y escudos.

## 3. Infraestructura

✅ Confirmado:

- Netlify publica desde la raíz y usa `netlify/functions`.
- Hay redirect SPA sólo para `/equipos/* -> /index.html`.
- El admin tiene headers Netlify `X-Robots-Tag: noindex, nofollow, noarchive` y `Cache-Control: no-store`.
- `js/admin-panel.js` también tiene `Cache-Control: no-store`.
- `robots.txt` bloquea rutas administrativas y funciones `admin-*`.

🟡 Parcial / verificar:

- En la auditoría original no se verificaron variables Netlify reales: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_PASSWORD`.
- El flujo de PR #17 sí quedó validado en Deploy Preview y producción para la corrección de `eventos_partido`; quedan pendientes verificaciones operativas/SEO de dominio Netlify, redirección hacia `trespalos.com.ar`, headers efectivos y logs.
- No hay headers globales de seguridad como CSP, HSTS, `X-Frame-Options` o `Referrer-Policy` en `netlify.toml`.

## 4. Modelo de datos

✅ Confirmado desde SQL/código:

- `torneos`: `id`, `anio`, `tipo`, `nombre`, `activo`, fechas y unicidad `(anio, tipo)`.
- `clubes`: ficha global de clubes, escudos, colores, aliases, estadio y `zona` global.
- `partidos`: tabla central usada por código y SQL, con `torneo_id`, tipo, fecha, zona, equipos, localía textual/por ID, fecha/hora, estado, estadio, árbitro, goles, penales, fase y fuentes de playoff. El `CREATE TABLE` base no está versionado.
- `eventos_partido`: incidencias por partido, con tipo, equipo, jugador textual legacy, `inscripcion_jugador_id`, período, minuto, orden, `estado_dato`, fuente y observaciones. El `CREATE TABLE` base no está versionado.
- `jugadores`: identidad canónica.
- `inscripciones_jugadores`: jugador + club + torneo; es la identidad operativa esperada para incidencias nuevas.
- `goleadores_oficiales`: snapshot manual por torneo, usado para Apertura 2026.
- `respaldos_etapa` y `etapas_estado`: cierre/restauración por etapa y por `torneo_id`.
- `analytics_eventos`: medición propia de vistas.

🟡 Parcial / verificar:

- No hay tabla versionada de participaciones de clubes por torneo. Las zonas aparecen en `partidos.zona` y también como `clubes.zona` global heredado.
- `partidos` y `eventos_partido` tienen alteraciones, constraints y grants parciales versionados, pero no schema base completo en repo. Esto queda como deuda documental/de reconstrucción, no como auditoría de seguridad pendiente.
- La documentación histórica dice que Apertura es `torneo_id = 1` y Clausura `torneo_id = 2`; para tareas operativas nuevas conviene consultar/confirmar IDs antes de ejecutar cargas o ediciones.

Datos locales relevantes:

- `data/clausura-2026/fixture_clausura_2026_oficial.json`: 114 partidos, 28 fechas libres, 20 clubes, 0 `fixture_key` duplicadas; todos los partidos locales están `programado`.
- Distribución Clausura local: Zona 1 = 42, Zona 2 = 30, Zona 3 = 42.
- `data/clausura-2026/clubes-map.json`: 20 clubes confirmados.
- `respaldos/apertura-2026-respaldo-completo-20260715-165226.json`: backup local con 1 torneo, 21 clubes, 27 jugadores, 27 inscripciones, 140 partidos, 368 eventos y 4 goleadores oficiales; SHA-256 `4445BD09A887D2CF7A4131F95A18395D15A9B6B192A59CF89C7904AD63343D06`.

## 5. Funcionalidades implementadas

| Funcionalidad | Estado | Evidencia / nota |
| --- | --- | --- |
| Inicio | IMPLEMENTADO | `index.html`, `js/app.js`; agenda, estado de torneo, próximos/últimos y campeón cuando corresponde. |
| Agenda | IMPLEMENTADO | Vista dentro de Inicio; commits recientes ajustan título y jerarquía. |
| Partidos | IMPLEMENTADO | Listado por fecha/fase, navegación de etapas, detalle de partido. |
| Tabla | IMPLEMENTADO | Posiciones por zona y general desde `state.partidos`. |
| Goleadores | PARCIAL | Pestaña dentro de Tabla; Apertura usa snapshot, Clausura se calcula desde eventos confirmados con ID cuando existan. |
| Playoffs | IMPLEMENTADO | Llaves, fases, serie final y selector de torneo en playoffs. |
| Estadísticas / Datos | PARCIAL / DUDOSO | Existe sección `tab-datos` y lógica `renderDatos`, pero no está expuesta en nav principal/mobile. |
| Equipos | IMPLEMENTADO | Grilla pública y apertura de detalle. |
| Detalle de equipo | IMPLEMENTADO | Cabecera, escudo/fallback, historial por campeonato, resumen, destacados y partidos por fase. |
| Historial por campeonato | PARCIAL | Fuerte en detalle de equipo y playoffs; no hay selector global para Inicio/Partidos/Tabla. |
| Últimos antecedentes | IMPLEMENTADO | PR #15 agrega antecedentes entre equipos en detalle de partido. |
| Incidencias públicas | IMPLEMENTADO | Se muestran desde `public.eventos_partido_publicos`, sólo con eventos confirmados y columnas públicas. Persisten eventos históricos sin ID de inscripción como deuda de datos, no como problema de exposición pública. |
| Estados de partidos | PARCIAL | Funcionan en público/admin, pero la lógica está duplicada y con variantes. |
| Footer/contacto | IMPLEMENTADO | Footer con contacto, enlaces y Acerca. |
| Error 404 | IMPLEMENTADO | `404.html` con `noindex, follow`. |
| Analítica | PARCIAL | GA4 y endpoint propio existen; no hay observabilidad operacional completa. |

## 6. Administración

✅ Confirmado:

- El admin se autentica con una contraseña compartida guardada en `sessionStorage` y enviada como header `x-admin-password`.
- Las funciones admin verifican `ADMIN_PASSWORD` y usan `SUPABASE_SERVICE_ROLE_KEY` sólo del lado servidor.
- Existe selector obligatorio de torneo de trabajo en UI.
- `admin-partidos` exige `torneo_id`, valida existencia del torneo, lista con `torneo_id=eq`, valida pertenencia del partido y actualiza con condición `id + torneo_id`.
- `admin-incidencias` exige `torneo_id`, valida partido/incidencia contra torneo, valida equipo del partido, inscripción del jugador y etapa.
- `admin-etapas` opera con RPCs que reciben `p_torneo_id`.
- `admin-planteles` guarda inscripciones con `p_torneo_id` vía RPC `admin_guardar_inscripcion_jugador`.
- `admin-clubes` administra ficha global de clubes; no es por torneo.

🟡 Parcial / verificar:

- El aislamiento por `torneo_id` está cubierto por tests locales con mocks. La próxima validación debe ser una prueba operativa completa de carga/edición/incidencias/publicación con datos reales controlados, no una reapertura genérica de ACL/RLS.
- La protección por etapas debe incluirse en el ensayo operativo de cierre, reapertura y restauración.
- Planteles muestra inscripciones conocidas por jugador como contexto global admin; las escrituras sí incluyen torneo, pero conviene revisar UX para evitar selección accidental.
- No hay administración explícita de `goleadores_oficiales`; los goleadores públicos dependen de snapshot o eventos.

🔴 Problema:

- La autenticación admin no tiene usuario individual, sesión firmada, expiración real, rate limit, MFA ni auditoría por operador.
- La ruta admin es oscura y no indexable, pero la seguridad real depende de `ADMIN_PASSWORD` en las funciones.

Posibilidad de modificar accidentalmente otro torneo:

- ✅ Mitigada en código local para partidos, incidencias y etapas mediante `torneo_id`.
- 🟡 Debe validarse como parte de la prueba funcional completa del admin con datos reales controlados.
- 🟡 El cierre de Apertura y la protección por etapas deben quedar cubiertos por el manual operativo y el ensayo de backup/restore.

## 7. Seguridad

Estado: CERRADO / VALIDADO EN PRODUCCIÓN.

Confirmado por la auditoría cerrada:

- ✅ No se encontró `SUPABASE_SERVICE_ROLE_KEY` hardcodeada en frontend.
- ✅ `js/config.js` expone una clave Supabase con rol `anon`, esperable para lectura pública.
- ✅ Funciones admin leen `SUPABASE_SERVICE_ROLE_KEY` desde `process.env`.
- ✅ Las funciones admin exigen `ADMIN_PASSWORD`.
- ✅ Los SQL protegidos de carga/corrección usan literales tipo `PENDIENTE_AUTORIZACION` y frases exactas antes de aplicar cambios.
- ✅ `goleadores-publicos.js` usa anon/public key y no service role.
- ✅ `goleadores-publicos.js` limita CORS a métodos `GET, OPTIONS`.
- ✅ `tp-admin-7c9f2026.html` y `robots.txt` declaran no indexación/bloqueo de rutas admin.
- ✅ FASE A/B/C cerradas.
- ✅ Default privileges y FASE D cerrados.
- ✅ `anon` ya no puede leer `public.eventos_partido`.
- ✅ `anon` sí puede leer `public.eventos_partido_publicos`.
- ✅ `public.eventos_partido_publicos` sólo expone eventos confirmados y columnas públicas.
- ✅ PR #17 mergeado, Deploy Preview OK, producción OK, producción post-revoke OK y post-snapshot final con `all_checks_passed=true`.

Regla vigente:

- ✅ No reabrir auditoría de ACL/RLS/default privileges/policies sin motivo concreto.
- ✅ Mantener evidencia histórica, pero no convertir permisos ya cerrados en trabajo pendiente.
- ✅ Si aparece un cambio sensible o incidente, abrir una tarea nueva con alcance específico, no repetir la auditoría completa.

Riesgos operativos que siguen vivos, fuera del cierre ACL/RLS:

- 🔴 `ADMIN_PASSWORD` compartida enviada en cada request; sin rate limit ni trazabilidad por usuario.
- 🔴 No hay CSP ni headers globales de endurecimiento.
- 🔴 El endpoint público `analytics-event` inserta con service role y no tiene rate limit visible.
- 🔴 Si falla la carga de `torneos`, el público conserva/fallback hacia todos los partidos en algunos caminos.
- 🔴 Backups locales están ignorados por Git y no hay custodia externa documentada.
- 🟡 `partidos` y `eventos_partido` no tienen schema base completo versionado; esto queda como deuda de reconstrucción/operación, no como bloqueo de seguridad ya auditada.

Mejoras recomendadas, no bloqueantes del cierre:

- ⚪ Agregar protección de acceso/rate limiting para admin.
- ⚪ Agregar CSP y headers globales.
- ⚪ Evitar fallback público a datos mezclados.
- ⚪ Formalizar backup/restore y custodia.

## 8. Calidad de datos

✅ Confirmado:

- El fixture local Clausura tiene 114 partidos, todos `programado`, sin resultados iniciales y sin duplicados de `fixture_key`.
- El backup local Apertura tiene 140 partidos y 368 eventos.
- Los goleadores Apertura se conservan como snapshot oficial de 4 filas.
- La identidad de jugadores avanzó hacia `jugadores` + `inscripciones_jugadores`; documentos históricos registran 27 jugadores, 27 inscripciones y 60 eventos vinculados por ID.

🟡 Parcial / verificar:

- 308 eventos históricos siguen documentados como pendientes de vinculación por ID.
- Clausura preparado localmente depende de confirmar IDs remotos y aplicar carga autorizada.
- El modelo usa nombres textuales legacy en eventos y snapshots; no todo está por ID.
- No hay tabla de participación club-torneo; `clubes.zona` es global y puede ser una fuente de confusión entre torneos.
- Los estados deportivos existen como strings libres/semivalidados en varias capas.

🔴 Problema:

- No hay schema base versionado de `partidos`/`eventos_partido`; no se pueden confirmar constraints completas desde el repo.
- Hay documentación desactualizada que contradice el estado posterior del Apertura, por ejemplo `docs/estado-proyecto.md` habla de final pendiente mientras el backup local muestra final cerrada.

## 9. Tests

✅ Confirmado: existen 15 archivos de test locales.

Cobertura principal:

- `tests/admin-goal-indicator.test.js`: indicador de goles y UI admin.
- `tests/admin-match-flow.test.js`: orden/filtros/sugerencia de partidos admin.
- `tests/cargar-clausura-2026.test.js`: SQL protegido, autorización, idempotencia y verificaciones de carga Clausura.
- `tests/cierre-fecha-zona-db.test.js`: SQL de cierre/restauración por fecha/zona.
- `tests/identidad-jugadores-db.test.js`: migración de identidad, secretos, SQL protegido e integridad.
- `tests/permisos-goleadores-sql.test.js`: permisos anon/authenticated, ausencia de service role en frontend y uso server-side.
- `tests/preparar-clausura-2026.test.js`: preparación/dry-run de fixture.
- `tests/public-clausura-zonas.test.js`: reglas públicas de torneo, zonas, estados, historia y UI.
- `tests/public-goleadores-ui.test.js`: UI de goleadores.
- `tests/public-incidencias-ui.test.js`: UI de incidencias públicas.
- `tests/netlify/*.test.js`: funciones admin, planteles, etapas y goleadores públicos con `fetch` mockeado.

Ejecutado en esta auditoría:

- ✅ `nodeRepl` ejecutó los 15 tests exportados: 122 resultados/casos devueltos, todos OK.
- ✅ Parse sintáctico equivalente con `vm.Script` sobre 38 archivos `.js`: 0 fallas.
- 🟡 `node --version` falló en PowerShell: `node` no está en PATH, por lo que no se pudo ejecutar literalmente `node --check`.

Comandos reales previstos si Node está disponible en PATH:

- `node --check js/app.js`
- `node --check js/admin-panel.js`
- `node --check netlify/functions/admin-partidos.js`
- `node tests/public-clausura-zonas.test.js`
- `node tests/netlify/admin-partidos.test.js`
- Ejecutar cada archivo `.test.js` individualmente; no hay runner npm versionado.

No cubierto por tests locales automatizados:

- ⚪ QA visual real desktop/mobile.
- ⚪ Netlify Functions deployadas.
- ⚪ Supabase remoto real.
- ⚪ Pruebas E2E con navegador y datos productivos.
- ⚪ Rate limit, fuerza bruta, CSP y headers efectivos.
- ⚪ Restauración real desde backup.

Riesgo de falsos positivos:

- 🟡 Muchos tests inspeccionan strings, mocks o helpers; pueden pasar aunque el deploy, los datos reales o las variables operativas tengan diferencias.

## 10. SEO

✅ Confirmado:

- `index.html` tiene `<title>`, meta description, canonical `https://trespalos.com.ar/`, Open Graph, Twitter card, favicons, manifest y Schema.org.
- `acerca.html` tiene title, description, canonical, OG, manifest y Schema.org.
- `404.html` tiene `noindex, follow`.
- `robots.txt` permite el sitio público, bloquea admin/rutas privadas y declara sitemap.
- `sitemap.xml` incluye `/` y `/acerca.html`.
- Las secciones internas se tratan como vistas de portada, no páginas indexables separadas.

🟡 Parcial / verificar:

- No se verificó que producción responda desde `trespalos.com.ar`.
- No hay redirect versionado desde URL Netlify a dominio oficial.
- `/equipos/*` renderiza vía SPA, pero los detalles de equipo no figuran en sitemap ni tienen metadata dinámica server-side.
- H1/H2 están presentes en páginas base y vistas dinámicas, pero no se hizo auditoría renderizada completa.

⚪ Pendiente:

- Verificar Search Console/indexación cuando exista operación pública estable.
- Decidir si detalles de equipos deben ser indexables o quedar como experiencia SPA.

## 11. Rendimiento

✅ Confirmado:

- Tamaño versionado aproximado por extensión: PNG 4.76 MB, JS 1.03 MB, SQL 433 KB, CSS 185 KB, JSON 183 KB.
- Archivos grandes: `assets/img/liga.png` 1.13 MB, `js/app.js` 276 KB, `js/admin-panel.js` 197 KB, `styles/main.css` 144 KB.
- La app pública carga scripts sueltos: `config`, `state`, `utils`, `public-tournament`, `api`, `router`, `analytics`, `app`.
- `js/api.js` y `js/router.js` están vacíos pero se cargan.
- Cache busting manual por query string (`?v=`).
- El público refresca datos cada 60 segundos si el documento está visible.

Problemas reales:

- 🔴 Potencial sobrecarga pública: `obtenerPartidos()` carga el torneo actual filtrado, pero también todos los partidos históricos y todos los eventos.
- 🟡 Imágenes/escudos PNG pesados; no hay `srcset` ni estrategia clara de compresión.
- 🟡 No hay cache headers globales para assets públicos.

Optimizaciones no urgentes:

- ⚪ Bundling/minificación.
- ⚪ Dividir `js/app.js`.
- ⚪ Eliminar carga de archivos vacíos.
- ⚪ Lazy-load de vistas no iniciales.

## 12. Accesibilidad

✅ Confirmado:

- HTML base usa `main`, `nav`, `section`, botones reales, headings, `aria-label`, `aria-live` y `aria-current`.
- Imágenes públicas principales tienen `alt`; logos decorativos usan `alt=""` donde corresponde.
- Muchas imágenes dinámicas usan `loading="lazy"` y `decoding="async"`.
- Tablas/filtros usan roles `tablist`/`tab` en varias secciones.
- Admin tiene labels asociados envolviendo inputs/selects.

🟡 Parcial / verificar:

- No se hizo QA con teclado real ni lector de pantalla.
- Combobox/listbox de búsqueda de jugadores y modales admin requieren prueba de foco, escape, flechas y retorno.
- Contraste no fue medido con herramienta.
- Algunos estados usan color e íconos; suelen incluir texto, pero debe verificarse renderizado completo.
- Tamaños táctiles parecen considerados por CSS, pero no se validaron en dispositivos reales.

## 13. Backups y recuperación

✅ Confirmado:

- Existe `respaldos/apertura-2026-respaldo-completo-20260715-165226.json`, ignorado por Git, con conteos completos del Apertura.
- Existen tres respaldos locales pre-carga Clausura.
- `supabase/cierre-etapas.sql` define tablas y RPCs de respaldo/cierre/restauración por `torneo_id`.
- Scripts de respaldo existen: `scripts/respaldar-cierre-etapas.js` y `scripts/respaldar-identidad-jugadores.js`.
- `.gitignore` ignora `respaldos/*.json`.

Respuesta explícita: ¿Podemos recuperar Tres Palos de un error grave de datos hoy?

🔴 No con garantía operacional completa. Hay un backup local valioso del Apertura y SQL/RPCs diseñados para restaurar etapas, pero no hay procedimiento de restore probado y documentado de punta a punta, no hay ensayo reciente con datos controlados, no hay schema base completo versionado para reconstrucción total y no hay custodia externa documentada de `respaldos/`. Ante un error grave hoy, probablemente se podría intentar recuperar parte importante del Apertura desde el JSON local, pero dependería de trabajo manual y verificación cuidadosa.

⚪ Pendiente crítico: documentar y ensayar `BACKUP_RESTORE.md` antes de cargar o editar datos productivos nuevos.

## 14. Observabilidad

✅ Confirmado:

- `js/analytics.js` registra `vista_pestana` y `vista_partido`.
- `analytics-event.js` inserta eventos anonimizados en `analytics_eventos`.
- `admin-analytics.js` permite consultar analítica desde admin con password.
- Las funciones admin devuelven errores JSON y algunas registran contexto sanitizado.

🟡 Parcial / verificar:

- No hay Sentry/PostHog/alertas.
- No hay runbook de incidentes.
- No se verificaron logs Netlify ni retención.
- No hay monitoreo de jobs, backups ni restauraciones.

## 15. PR y trabajo en curso

✅ Confirmado local:

- Rama de trabajo al actualizar este documento: `feat/eventos-publicos-vista`.
- HEAD local al actualizar este documento: `8f80ec04d5907e783900cd0a961ab88dc0b24ecc`.
- Cambio local esperado en esta tarea: `docs/ESTADO_PROYECTO.md`.
- No se tocaron archivos de código en esta actualización documental.

✅ Confirmado Git/GitHub en la auditoría original:

- Ramas remotas reales en GitHub: `main`, `feat/jerarquia-visual-detalle-equipos`, `footer/prelanzamiento`.
- GitHub PRs: 15 totales, 0 abiertos, 0 drafts, 15 cerrados.
- PR #14, `Mejorar goleadores y detalle de clubes`: cerrado y mergeado el 2026-08-05, merge commit `3ca5b33`.
- PR #15, `Mejorar jerarquía visual del detalle de equipos`: cerrado y mergeado el 2026-08-07, merge commit `1d8b3f8`.
- Relación #14/#15: #15 depende secuencialmente de #14; la base de #15 es `3ca5b33`, que es el merge de #14.
- `origin/main` actualizado contiene los merge commits de PR #14 y PR #15.
- Commits de PR #15 confirmados por GitHub: `fe35fb6`, `a3e0d1a`, `73620cf`, `c7f0350`.
- `fe35fb6`: `Mejorar jerarquía visual del detalle de equipos`; está en la rama actual y en PR #15 mergeado.
- `a3e0d1a`: `Mostrar últimos antecedentes entre equipos`; está en la rama actual y en PR #15 mergeado.

✅ Confirmado posterior a la auditoría original:

- PR #17 fue mergeado.
- La corrección de `eventos_partido` quedó validada en Deploy Preview, producción, producción post-revoke y post-snapshot final.
- La auditoría de seguridad quedó formalmente cerrada.

🟡 Parcial / verificar:

- Los datos de conteo total de PRs y ramas remotas listados arriba pertenecen a la auditoría original y pueden estar desactualizados.
- En la auditoría original, `origin/main` local estaba actualizado en `1d8b3f8`; la rama local `main` seguía en `3ca5b33` porque no se hizo fast-forward de `main`.
- La rama auditada `feat/jerarquia-visual-detalle-equipos` contiene 4 commits sobre `main` local: `fe35fb6`, `a3e0d1a`, `73620cf`, `c7f0350`; GitHub ya los integró en `origin/main` vía merge commit `1d8b3f8`.
- La comparación post-fetch no cambió conclusiones técnicas: `origin/main` y la rama auditada tienen el mismo árbol de código.

Ramas locales aparentemente obsoletas o con refs remotas stale:

- `admin/clausura-fecha-zona`
- `admin/jugadores-por-id`
- `data/clausura-2026-carga`
- `data/clausura-2026-dry-run`
- `db/cierre-fecha-zona`
- `db/identidad-jugadores`
- `feat/escudos-goleadores-detalle-club` como remote-tracking stale
- `fix/clausura-2026-carga-tipos`
- `fix/clausura-publico-zonas`
- `test/admin-aislamiento-torneo`
- `ui/fecha-actual-y-recorrido-equipo`

No se borró ninguna rama.

## 16. Problemas conocidos

🔴 Recuperación ante error grave no garantizada operacionalmente.

🔴 Admin con password compartida, sin rate limit ni usuarios.

🔴 Falta prueba operativa completa de carga, edición, incidencias y publicación con datos reales controlados.

🔴 Fallback público puede mostrar datos mezclados si no se determina `torneo_id`.

🟡 Estados de partido duplicados y variantes ambiguas.

🟡 Schema base de `partidos` y `eventos_partido` no versionado de forma completa; deuda de reconstrucción/documentación, no auditoría de permisos pendiente.

🟡 Documentación existente está repartida, parcialmente obsoleta y con contradicciones anteriores al cierre de seguridad.

🟡 Assets y JS públicos son pesados para escala móvil.

🟡 SEO y preparación de lanzamiento todavía no tienen checklist validado.

🟡 Todavía falta validar el comportamiento durante el Clausura con operación real y usuarios reales.

## 17. Deuda técnica priorizada

### CRÍTICA

1. Problema: recuperación no probada ni documentada.
   Evidencia: backup local en `respaldos/`, RPCs en `supabase/cierre-etapas.sql`, pero no runbook probado.
   Riesgo: pérdida o corrupción de datos con recuperación manual incierta.
   Acción recomendada: crear y ensayar procedimiento `BACKUP_RESTORE.md`.
   Urgencia: inmediata, antes de operación productiva regular.

2. Problema: no hay manual operativo definitivo para cargar resultados, editar partidos, registrar incidencias, publicar cambios, cerrar/reabrir etapas y actuar ante incidentes.
   Evidencia: los flujos existen en código/admin, pero no hay procedimiento único, probado y ejecutable por una persona operadora.
   Riesgo: errores manuales, pasos omitidos, datos inconsistentes o publicación incompleta.
   Acción recomendada: crear `MANUAL_OPERACION_TORNEO.md` y usarlo en una prueba completa.
   Urgencia: inmediata.

3. Problema: falta prueba completa de carga/edición/incidencias/publicación.
   Evidencia: hay tests locales y validaciones de seguridad cerradas, pero falta simular la operación real de una fecha/partido de punta a punta.
   Riesgo: fallas funcionales recién detectadas durante el Clausura.
   Acción recomendada: ejecutar un ensayo controlado con checklist, registrar hallazgos y corregir lo que bloquee operación.
   Urgencia: inmediata.

4. Problema: seguridad admin basada en password compartida.
   Evidencia: `js/admin-panel.js` usa `sessionStorage`; funciones validan `x-admin-password`.
   Riesgo: sin trazabilidad, bloqueo, rotación individual ni mitigación de fuerza bruta.
   Acción recomendada: agregar protección de acceso/rate limit o auth real.
   Urgencia: antes de ampliar cantidad de operadores.

### ALTA

5. Problema: fallback público a datos mezclados.
   Evidencia: `js/app.js` avisa "Se muestran todos los partidos" si falla `torneos`.
   Riesgo: tablas/fixture/historia combinados entre torneos.
   Acción recomendada: bloquear vistas deportivas si no hay torneo activo confiable o cargar por torneo explícito.
   Urgencia: antes de publicar Clausura.

6. Problema: estados de partido duplicados.
   Evidencia: `js/app.js`, `js/public-tournament.js`, `js/admin-panel.js`, `js/admin-match-flow.js`, `admin-partidos.js` y SQL tienen reglas propias.
   Riesgo: diferencias entre público, admin, cierre y tests.
   Acción recomendada: definir modelo/catálogo único y adaptar capas.
   Urgencia: alta, durante estabilización operativa.

7. Problema: refs locales desalineadas con GitHub.
   Evidencia: la auditoría original dejó referencias de ramas y PRs ya superadas por PR #17.
   Riesgo: confusión sobre qué está integrado.
   Acción recomendada: hacer limpieza documental/git planificada, sin borrar ramas hasta decidir.
   Urgencia: alta para coordinación, no para runtime.

8. Problema: ausencia de headers globales de seguridad.
   Evidencia: `netlify.toml` sólo define headers admin/no-store.
   Riesgo: superficie innecesaria para XSS/clickjacking/referrer leaks.
   Acción recomendada: agregar CSP y headers adecuados tras prueba.
   Urgencia: alta antes de exposición amplia.

9. Problema: SEO y lanzamiento no tienen checklist operativo actualizado.
   Evidencia: hay SEO base, `robots.txt` y `sitemap.xml`, pero falta validar producción, Search Console, indexación deseada, dominio y contenido previo al lanzamiento.
   Riesgo: lanzamiento público con descubrimiento pobre o señales incorrectas.
   Acción recomendada: actualizar `CHECKLIST_LANZAMIENTO.md` o crear checklist SEO/lanzamiento específico.
   Urgencia: alta antes de buscar usuarios reales.

### MEDIA

10. Problema: overfetch público.
   Evidencia: `obtenerPartidos()` carga todos los partidos históricos y todos los eventos.
   Riesgo: performance y exposición de más datos que los necesarios.
   Acción recomendada: endpoints/vistas filtradas por torneo y carga diferida de histórico.
   Urgencia: media; sube con crecimiento de datos.

11. Problema: documentación dispersa/obsoleta.
    Evidencia: `docs/estado-proyecto.md` contradice backup final; README/ROADMAP son de 2026-07-21.
    Riesgo: decisiones basadas en estado viejo.
    Acción recomendada: usar este documento como fuente maestra y archivar/actualizar documentos viejos.
    Urgencia: media.

12. Problema: schema base de `partidos` y `eventos_partido` no versionado de forma completa.
    Evidencia: no hay `CREATE TABLE public.partidos` ni `CREATE TABLE public.eventos_partido`; sólo alteraciones en `supabase/` y verificaciones en `sql/`.
    Riesgo: reconstrucción total más difícil ante desastre o migración futura.
    Acción recomendada: exportar/versionar schema mínimo real con constraints, índices y contratos de datos relevantes.
    Urgencia: media; tratar como recuperación/documentación, no como reapertura de permisos.

13. Problema: assets/JS pesados y sin pipeline.
    Evidencia: PNG 4.76 MB, `app.js` 276 KB, `main.css` 144 KB.
    Riesgo: carga móvil lenta.
    Acción recomendada: optimizar imágenes, revisar caché y luego evaluar bundling.
    Urgencia: media.

14. Problema: no hay runner de tests versionado.
    Evidencia: no existe `package.json`; `node` no está en PATH en esta máquina.
    Riesgo: ejecución inconsistente entre entornos.
    Acción recomendada: documentar comando mínimo o agregar script npm si se decide adoptar Node local.
    Urgencia: media.

### BAJA

15. Problema: `js/api.js` y `js/router.js` vacíos se cargan en producción.
    Evidencia: archivos 0 bytes y scripts en `index.html`.
    Riesgo: ruido y requests innecesarios menores.
    Acción recomendada: decidir si eliminarlos o llenarlos cuando haya refactor planificado.
    Urgencia: baja.

16. Problema: cache busting manual.
    Evidencia: query strings `?v=` en HTML.
    Riesgo: errores humanos al publicar cambios.
    Acción recomendada: mantener checklist o introducir pipeline cuando el proyecto lo justifique.
    Urgencia: baja.

17. Problema: SEO de vistas dinámicas no indexable.
    Evidencia: sitemap sólo `/` y `/acerca.html`; `/equipos/*` es SPA.
    Riesgo: menos descubrimiento orgánico de equipos.
    Acción recomendada: decidir si es objetivo de producto.
    Urgencia: baja.

## 18. Decisiones de producto vigentes

✅ Confirmado por docs/código:

- Mantener stack vanilla; no migrar a React/TypeScript por ahora.
- No duplicar la app por torneo; mantener una sola app multitorneo con `torneo_id`.
- No agregar selector global público de torneo todavía; historial vive principalmente en detalle de equipo y playoffs.
- Mostrar sólo incidencias confirmadas en público.
- Apertura usa goleadores oficiales por snapshot.
- Clausura y torneos nuevos deben calcular goleadores desde eventos confirmados con `inscripcion_jugador_id`.
- No migrar eventos históricos por similitud textual.
- Una transferencia debe crear otra inscripción, no otro jugador.
- No usar `supabase/final-ida-vuelta.sql` para Clausura sin parametrizar por torneo.

## 19. Próximos pasos

Secuencia vigente, una cosa por vez:

1. Cerrar documentación maestra: actualizar `docs/ESTADO_PROYECTO.md` con el cierre de seguridad y la nueva etapa.
2. Crear/actualizar `BACKUP_RESTORE.md`: procedimiento de backup, custodia y restore.
3. Ensayar recuperación con datos controlados y registrar resultado.
4. Crear/actualizar `MANUAL_OPERACION_TORNEO.md`: carga de resultado, edición, incidencias, publicación, cierre/reapertura y manejo de errores.
5. Ejecutar prueba completa de carga/edición/incidencias/publicación con checklist y evidencia.
6. Corregir bloqueos detectados en la prueba operativa.
7. Reducir riesgos operativos pendientes: fallback público de torneo, estados duplicados, admin con password compartida/rate limit y observabilidad básica.
8. Validar operación durante el Clausura con casos reales, manteniendo registro de incidencias y aprendizajes.
9. Preparar SEO/lanzamiento: producción, dominio, sitemap, Search Console, metadata, rendimiento mínimo y checklist público.
10. Conseguir usuarios reales: difusión controlada, feedback de clubes/periodistas/hinchas y priorización de mejoras por uso real.

Virtudes / no conviene reescribir:

- ✅ Arquitectura simple y entendible para un sitio estático.
- ✅ Separación razonable entre lectura pública y escrituras server-side.
- ✅ No hay service role en frontend.
- ✅ `torneo_id` está integrado en admin, funciones y SQL nuevos.
- ✅ Los SQL sensibles están protegidos por autorización explícita.
- ✅ La suite local cubre muchos flujos críticos sin tocar remoto.
- ✅ La experiencia pública ya tiene Inicio, Tabla, Partidos, Playoffs y Equipos con buen alcance funcional.
- ✅ El modelo de jugadores/inscripciones es la dirección correcta y no conviene volver a nombres libres.
- ✅ Hay backups locales y hashes; falta operación, no partir de cero.

Documentos complementarios propuestos, no creados todavía:

- `BACKLOG.md`: sí, para convertir deuda y próximos pasos en tareas priorizadas.
- `MANUAL_OPERACION_TORNEO.md`: sí, para carga diaria, estados, incidencias y cierre.
- `CHECKLIST_PR.md`: sí, para evitar merges sin tests/seguridad/SEO/status.
- `BACKUP_RESTORE.md`: sí, crítico.
- `DECISIONES_PRODUCTO.md`: sí, para selector global, historial, Datos/Estadísticas y alcance SEO.

Regla de foco:

- No reabrir ACL/RLS/default privileges/policies sin un motivo concreto.
- Tratar seguridad cerrada como base; el foco inmediato es operación, recuperación, validación real y lanzamiento.

## 20. Ideas futuras / fuera de alcance actual

⚪ Pendiente / fuera de alcance de esta auditoría:

- Autenticación admin por usuario o proveedor externo.
- Rate limit y protección de acceso al admin.
- Selector global público de campeonatos, si se decide.
- Fichas públicas de jugadores.
- Goleadores históricos calculados por identidad cuando los eventos estén completos.
- Endpoints públicos filtrados por torneo para reducir overfetch.
- Optimización de imágenes y pipeline de assets.
- Observabilidad con alertas.
- SEO dinámico para equipos si el producto lo requiere.
- Rediseño o eliminación de la vista Datos/Estadísticas.

## 21. Procedimientos que falta documentar

⚪ Pendiente:

- Backup completo manual y/o automático.
- Custodia externa de respaldos.
- Restore completo desde backup local/controlado.
- Prueba de restauración y criterios para declararla exitosa.
- Carga de resultado e incidencias de un partido.
- Corrección/edición de un partido ya publicado.
- Publicación y verificación pública posterior.
- Cierre de fecha/zona/fase.
- Reapertura de etapa.
- Fin de torneo y archivado.
- Manejo de incidente de datos.
- Registro de operación durante el Clausura.
- Deploy/preview/revisión antes de publicar.
- Rotación de `ADMIN_PASSWORD`.
- Revisión de logs/observabilidad básica.
- Checklist SEO/lanzamiento.
- Captura y priorización de feedback de usuarios reales.
- Política para actualizar `main` local y limpiar ramas stale sin borrar accidentalmente trabajo útil.

Procedimientos cerrados:

- Auditoría remota de ACL/RLS/default privileges/policies, salvo motivo concreto para reabrir.

## 22. Preguntas abiertas

- 🟡 ¿El `main` local debe fast-forwardearse desde `origin/main` y cuándo conviene limpiar ramas históricas?
- 🟡 ¿Qué IDs de torneo deben usarse operativamente para Apertura y Clausura antes de ejecutar cargas/ediciones?
- 🟡 ¿Cuál será el procedimiento oficial de backup, dónde se custodiará y quién lo ejecutará?
- 🟡 ¿Cuál será el procedimiento oficial de restore y con qué frecuencia se ensayará?
- 🟡 ¿Cómo se validará que Apertura queda protegido operacionalmente contra ediciones accidentales durante Clausura?
- 🟡 ¿Qué URL de Netlify queda accesible además de `trespalos.com.ar`?
- 🟡 ¿La vista Datos/Estadísticas se mantiene, se rediseña o se retira de la navegación/código?
- 🟡 ¿El historial debe tener selector global o sólo vivir en detalle de equipo/playoffs?
- 🟡 ¿Quién puede operar el admin y cómo se rota la contraseña?
- 🟡 ¿Se debe indexar `/equipos/*` o mantenerlo como SPA no indexable explícita?
- 🟡 ¿Qué clubes, periodistas, delegados o usuarios reales participarán en la primera validación pública?
