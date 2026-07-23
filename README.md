# Tres Palos

## Estado actual

Ultima actualizacion: 2026-07-21

Fase actual:
Cierre tecnico del Apertura 2026 y preparacion del Clausura 2026.

Ultimo hito cerrado:
Respaldo completo y verificado del Apertura 2026. 140 partidos. Torneo archivado como `torneo_id = 1`.

Trabajo actual:
Aislamiento del panel administrativo por torneo implementado en el repositorio. Validacion remota pendiente antes de cargar datos reales del Clausura 2026.

## Que es

Tres Palos es una web de estadisticas de futbol regional para la Liga Canadense. Reune fixture, resultados, tablas, playoffs, equipos, detalle de partidos, incidencias y datos administrativos de carga.

## Stack tecnologico

- HTML, CSS y JavaScript vanilla.
- Supabase/Postgres por API REST.
- Funciones Netlify para operaciones administrativas y analitica propia.
- Panel administrativo privado por ruta no indexable.
- Google Analytics 4 configurado desde frontend.
- Sistema multitorneo mediante `torneo_id`.

## Estructura general

- `index.html`: aplicacion publica.
- `tp-admin-7c9f2026.html`: panel administrativo.
- `js/`: logica publica, estado global, analitica y panel admin.
- `styles/`: estilos publicos, admin y pagina acerca.
- `netlify/functions/`: endpoints privados de administracion y medicion.
- `supabase/`: scripts SQL versionados.
- `assets/`: marca, favicons y escudos.
- `respaldos/`: respaldo local completo del Apertura 2026.
- `docs/`: documentacion historica existente.

## Estado tecnico resumido

Implementado:

- Web publica con Inicio, Partidos, Tabla, Playoffs y Equipos.
- Carga publica de datos desde Supabase REST.
- Calculo de posiciones sobre el torneo seleccionado.
- Goleadores oficiales desde snapshot por torneo.
- Panel admin para partidos, clubes, planteles, incidencias, etapas y analitica.
- Selector obligatorio de torneo de trabajo en el panel admin para partidos, etapas e incidencias.
- Funciones admin de partidos/incidencias con validacion de `torneo_id` antes de modificar datos.
- Funciones Netlify con `SUPABASE_SERVICE_ROLE_KEY` en entorno, no en frontend.
- SQL de cierre/restauracion de etapas con `torneo_id`.
- Respaldo completo local del Apertura 2026.

Implementado parcialmente:

- Soporte multitorneo: el admin queda aislado por torneo en codigo; falta validarlo contra Supabase/Netlify reales.
- Historico del Apertura: disponible en respaldo, playoffs y detalle de equipos; no hay selector global para todas las vistas.
- Clausura 2026: hay script de preparacion para activar torneo y cargar Fecha 1, pero falta verificar Supabase remoto y completar fixture.

No verificable desde el repositorio:

- Estado real de Supabase remoto.
- Politicas RLS efectivas de `partidos` y `eventos_partido`.
- Variables configuradas en Netlify.
- Deploy actual de produccion.

## Torneos

- Torneo historico: Apertura 2026, `torneo_id = 1`.
- Torneo activo esperado para el proximo trabajo: Clausura 2026, `torneo_id = 2`.

Antes de cargar datos del Clausura hay que confirmar en Supabase remoto que esos IDs son reales y que solo Clausura queda activo.

El selector nuevo de torneo existe solo en el panel administrativo. La web publica mantiene el torneo vigente automatico y el historial por campeonato dentro del detalle de cada equipo; no hay selector global publico.

## Bloqueantes actuales

- Falta probar el aislamiento admin contra Supabase/Netlify reales.
- RLS/grants de `partidos` y `eventos_partido` no estan versionados de forma verificable en el repo.
- El fixture del Clausura esta incompleto: el SQL existente carga solo Fecha 1.
- El respaldo completo del Apertura existe localmente, pero el proceso reproducible de generacion no esta versionado.

## Documentacion

- [Auditoria de estado actual](AUDITORIA_ESTADO_ACTUAL.md)
- [Roadmap](ROADMAP.md)
- [Checklist de lanzamiento Clausura 2026](CHECKLIST_LANZAMIENTO.md)
- [Estado historico previo](docs/estado-proyecto.md)

Los documentos `MANUAL_CARGA_DATOS.md`, `DECISIONES_PRODUCTO.md` y `PROMPTS_CODEX.md` no estan presentes en este repositorio al momento de esta auditoria.

## Ejecucion local

No hay `package.json`, dependencias ni paso de build versionados. El sitio es estatico.

Para inspeccion local basica puede abrirse `index.html` desde el navegador o servirse la raiz con cualquier servidor estatico. La carga de datos requiere conectividad a Supabase y la clave anon publica definida en `js/config.js`.

## Deploy

El archivo `netlify.toml` configura:

- publicacion desde la raiz (`publish = "."`);
- funciones en `netlify/functions`;
- fallback SPA para `/equipos/*`;
- cabeceras `no-store` y `noindex` para el panel admin.

No se ejecuto deploy ni se verificaron variables de entorno en esta auditoria.
