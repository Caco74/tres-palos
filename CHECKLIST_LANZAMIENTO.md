# Checklist de lanzamiento - Clausura 2026

Ultima actualizacion: 2026-07-21

Marcar como completado solo lo verificado directamente.

## Base de datos

- [ ] Confirmar en Supabase remoto que Apertura es `torneo_id = 1`.
- [ ] Confirmar en Supabase remoto que Clausura es `torneo_id = 2`.
- [ ] Confirmar que solo Clausura queda activo para la web publica.
- [ ] Versionar o documentar schema real de `partidos`.
- [ ] Versionar o documentar schema real de `eventos_partido`.
- [ ] Ejecutar/verificar `supabase/clausura-2026.sql` sin duplicados.
- [ ] Confirmar conteo de partidos Clausura por fecha y zona.

## Seguridad

- [x] No hay `SUPABASE_SERVICE_ROLE_KEY` hardcodeada en frontend.
- [x] Las funciones admin verifican `ADMIN_PASSWORD` antes de operar.
- [ ] Verificar RLS/grants de `partidos`.
- [ ] Verificar RLS/grants de `eventos_partido`.
- [ ] Bloquear escritura anonima directa sobre tablas deportivas.
- [x] Implementar selector obligatorio de torneo de trabajo en el panel admin.
- [x] Validar `torneo_id` esperado en funciones admin de partidos e incidencias.
- [ ] Probar aislamiento admin contra Netlify/Supabase reales.
- [ ] Revisar acceso externo al panel admin y riesgo de fuerza bruta.

## Datos deportivos

- [x] Respaldo local del Apertura contiene 140 partidos.
- [x] Respaldo local del Apertura contiene solo partidos con `torneo_id = 1`.
- [x] Campeon Apertura verificado desde respaldo: Sportivo A. Club.
- [ ] Cargar Fecha 1 del Clausura en `torneo_id = 2`.
- [ ] Cargar fixture completo del Clausura con fuente confirmada.
- [ ] Revisar equipos libres por fecha/zona.
- [ ] Validar que no haya partidos Clausura sin `torneo_id`.

## Panel administrativo

- [x] Existe panel admin en `tp-admin-7c9f2026.html`.
- [x] Existen funciones Netlify para partidos, clubes, planteles, incidencias, etapas y analitica.
- [x] Agregar selector de torneo de trabajo.
- [x] Listar partidos admin con filtro `torneo_id` desde origen.
- [x] Listar incidencias admin por partidos del torneo seleccionado.
- [ ] Confirmar que el panel no permite editar Apertura desde modo Clausura.
- [ ] Probar edicion de programacion de un partido Clausura.
- [ ] Probar carga de resultado de un partido Clausura.
- [ ] Probar carga de incidencia confirmada con fuente.
- [ ] Probar borrado/reordenamiento sin afectar otro torneo.

## Web publica

- [x] Existe web publica en `index.html`.
- [x] Existen secciones Inicio, Partidos, Tabla, Playoffs y Equipos.
- [x] La tabla publica calcula sobre `state.partidos`, derivado del torneo seleccionado.
- [ ] Confirmar que la web muestra Clausura como torneo activo.
- [ ] Confirmar que la tabla no mezcla Apertura y Clausura.
- [ ] Confirmar que incidencias publicas no mezclan torneos.
- [ ] Confirmar que goleadores Clausura vacio se muestra como estado valido.
- [ ] Probar detalle de partido Clausura.

## Historico del Apertura

- [x] Existe respaldo completo local del Apertura 2026.
- [x] El respaldo incluye 140 partidos, 368 eventos y 4 goleadores oficiales.
- [x] Playoffs tiene selector de torneos cuando hay mas de un torneo con partidos.
- [x] Detalle de equipos tiene selector/historial por campeonato.
- [ ] Confirmar Apertura inactivo/historico en Supabase remoto.
- [ ] Confirmar que Apertura no se puede editar accidentalmente desde admin.
- [ ] Definir si habra selector global de torneo para fixture/tabla/inicio.

## Pruebas

- [x] Validar sintaxis de JS modificados (`admin-panel.js`, `admin-partidos.js`, `admin-incidencias.js`) con runtime Node de herramientas.
- [x] Probar validaciones servidor de partidos/incidencias con funciones Netlify y `fetch` simulado.
- [ ] Ejecutar validacion sintactica JS en entorno con Node.
- [ ] Probar carga publica con datos reales de Clausura.
- [ ] Probar admin con Clausura activo.
- [ ] Probar fallback cuando falla carga de `torneos`.
- [ ] Probar mobile y desktop.
- [ ] Registrar evidencia de prueba manual.

## Respaldo

- [x] Respaldo local Apertura verificado por conteos.
- [ ] Decidir si `respaldos/` queda versionado o almacenado fuera del repo.
- [ ] Documentar procedimiento reproducible de respaldo completo.
- [ ] Generar respaldo inicial del Clausura despues de preparar Fecha 1.
- [ ] Validar que restauracion por etapa no toque otro torneo.

## SEO y deploy

- [x] Existe `netlify.toml` con publish raiz y funciones.
- [x] Admin tiene `noindex` en HTML y headers Netlify.
- [x] Existe `robots.txt`.
- [x] Existe `sitemap.xml`.
- [ ] Verificar dominio definitivo.
- [ ] Verificar variables Netlify.
- [ ] Ejecutar deploy de prueba o preview.
- [ ] Revisar indexacion solo de paginas publicas.

## Revision final

- [ ] Apertura preservado como historico.
- [ ] Clausura activo y sin mezcla de datos.
- [ ] Panel admin aislado por torneo.
- [ ] Seguridad de Supabase verificada.
- [ ] Flujo completo de carga probado.
- [ ] Backup posterior a preparacion Clausura generado.
