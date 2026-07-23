# Roadmap - Tres Palos

Ultima actualizacion: 2026-07-21

## 1. Ahora - bloqueantes

| Tarea | Estado | Prioridad | Dependencia | Criterio de finalizacion |
| --- | --- | --- | --- | --- |
| Verificar IDs reales de torneos en Supabase (`Apertura = 1`, `Clausura = 2`) | Pendiente | Alta | Acceso a Supabase remoto | Consulta remota documentada con ambos torneos y estado `activo` esperado. |
| Limitar panel admin por torneo de trabajo | Implementado en repo | Alta | QA remoto pendiente | `tp-admin-7c9f2026.html` y `js/admin-panel.js` exigen seleccionar torneo antes de listar partidos/incidencias. Termina cuando se pruebe contra Netlify/Supabase reales. |
| Agregar validacion servidor de `torneo_id` esperado en partidos | Implementado en repo | Alta | QA remoto pendiente | `admin-partidos` exige `torneo_id`, valida existencia del torneo y rechaza PATCH si el partido pertenece a otro torneo. |
| Agregar validacion servidor de `torneo_id` esperado en incidencias | Implementado en repo | Alta | QA remoto pendiente | `admin-incidencias` filtra eventos por partidos del torneo y valida POST/PATCH/DELETE/reordenamiento contra el torneo enviado. |
| Probar aislamiento admin con peticiones manipuladas | Pendiente | Alta | Netlify/Supabase disponibles | Requests sin `torneo_id`, con torneo inexistente o con recursos de otro torneo devuelven 400/403/404 sin modificar datos. |
| Verificar RLS y grants de `partidos` y `eventos_partido` | Pendiente | Alta | Acceso a Supabase remoto | Lectura publica permitida solo donde corresponde y escritura anonima bloqueada. |
| Proteger Apertura historico contra ediciones accidentales | Pendiente | Alta | Etapas/torneos verificados | Intentos de modificar Apertura desde modo Clausura devuelven error. |
| Probar `supabase/clausura-2026.sql` en entorno controlado | Pendiente | Alta | Backup Apertura preservado; IDs confirmados | Clausura activo, Fecha 1 creada sin duplicados y Apertura sin cambios deportivos. |

## 2. Despues - necesarias para el lanzamiento

| Tarea | Estado | Prioridad | Dependencia | Criterio de finalizacion |
| --- | --- | --- | --- | --- |
| Completar fixture del Clausura con fuente confirmada | Pendiente | Alta | Torneo Clausura creado | Fechas 1 a 14 cargadas con `torneo_id = 2` y conteos por zona revisados. |
| Probar flujo completo de carga | Pendiente | Alta | Admin aislado por torneo | Un partido Clausura pasa por programacion, resultado, incidencias, cierre y visualizacion publica sin afectar Apertura. |
| Revisar fallback publico cuando falla `torneos` | Pendiente | Alta | Auditoria H1/H2 | La web no muestra partidos mezclados si no puede determinar torneo activo. |
| Verificar variables Netlify | Pendiente | Alta | Acceso Netlify | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` y `ADMIN_PASSWORD` presentes y correctas. |
| Ejecutar QA visual minimo | Pendiente | Media | Datos Clausura iniciales | Inicio, Partidos, Tabla, Playoffs, Equipos y detalle de partido revisados en desktop/mobile. |
| Validar sintaxis JavaScript en entorno con Node | Pendiente | Media | Node disponible | `node --check` o equivalente corre sin errores sobre JS publico y funciones Netlify. |
| Definir alcance publico del historico Apertura | Pendiente | Media | Clausura preparado | Queda documentado si el historico completo tendra selector global o solo vistas parciales. |
| Decidir custodia del respaldo Apertura | Pendiente | Media | Politica de archivos | Backup queda versionado, almacenado externamente o ignorado explicitamente con decision documentada. |

## 3. Mas adelante - mejoras

| Tarea | Estado | Prioridad | Dependencia | Criterio de finalizacion |
| --- | --- | --- | --- | --- |
| Documentar procedimiento reproducible de respaldo completo | Pendiente | Media | Definir custodia de backups | Existe guia paso a paso para exportar, validar conteos y conservar respaldo. |
| Mejorar autenticacion admin | Pendiente | Media | Panel estable para Clausura | Acceso con usuario/sesion o proteccion equivalente, mas trazabilidad que una contrasena compartida. |
| Automatizar goleadores desde incidencias confirmadas | Pendiente | Baja | Incidencias completas y confiables | Tabla de goleadores calculada sin depender de snapshot manual. |
| Completar datos historicos de estadios/arbitros utiles | Pendiente | Baja | Clausura funcionando | Campos historicos se completan solo si hay fuente confiable. |
| Revisar vista Datos | Pendiente | Baja | Producto estable | La vista aporta valor claro o queda fuera sin deuda visible. |

## 4. No hacer por ahora

| Tarea | Estado | Prioridad | Dependencia | Criterio de finalizacion |
| --- | --- | --- | --- | --- |
| Migrar a React, TypeScript o frameworks | No hacer | Baja | Ninguna | Se conserva stack vanilla mientras el problema principal sea seguridad/datos. |
| Redisenar visualmente la web | No hacer | Baja | Ninguna | No se abre redisenio hasta terminar Clausura seguro. |
| Agregar estadisticas decorativas nuevas | No hacer | Baja | Incidencias confiables | Se posterga hasta estabilizar datos base. |
| Crear funciones sociales avanzadas | No hacer | Baja | Producto estable | No se prioriza antes del flujo deportivo. |
| Monetizacion | No hacer | Baja | Audiencia/producto validados | Fuera de alcance actual. |
| Expansion a otras ligas | No hacer | Baja | Clausura cerrado y modelo probado | No se duplica complejidad antes de cerrar Liga Canadense. |
| Copiar la aplicacion por torneo | No hacer | Alta | Ninguna | Se mantiene una sola app multitorneo con `torneo_id`. |
| Rerunear scripts historicos sin parametrizar | No hacer | Alta | Auditoria H11 | `supabase/final-ida-vuelta.sql` no se usa para Clausura sin ajuste por `torneo_id`. |
