# Admin: jugadores por ID en incidencias

## Identidad vs inscripcion

`jugadores` representa la identidad permanente de una persona.
`inscripciones_jugadores` representa a esa persona en un club y torneo. Las
incidencias del admin deben usar `inscripciones_jugadores.id` como identidad
operativa del evento.

`eventos_partido.jugador` queda como snapshot historico del nombre canonico
actual al momento de guardar. No es la identidad principal.

## Flujo normal de carga

1. Seleccionar torneo de trabajo.
2. Seleccionar partido.
3. Seleccionar equipo del jugador.
4. Seleccionar tipo de incidencia.
5. Buscar y elegir una inscripcion de jugador.
6. Guardar incidencia.

El navegador envia `inscripcion_jugador_id`. La funcion Netlify resuelve en
servidor el jugador, club, torneo y nombre canonico antes de insertar o
actualizar.

## Jugador existente sin inscripcion

La accion `Jugador no encontrado` abre un flujo separado. Primero se busca el
nombre recibido desde la fuente. Si la persona existe pero no tiene inscripcion
para el club y torneo del partido, el admin puede crear solo esa inscripcion.

La operacion es idempotente: si la inscripcion ya existe, se devuelve la fila
existente y se selecciona en el formulario.

## Jugador nuevo

Solo se puede crear una persona nueva despues de buscar candidatos y confirmar
explicitamente que no corresponde a los resultados mostrados. El formulario pide
solo `nombre_completo`.

La creacion de jugador + inscripcion se hace desde la funcion Netlify mediante
la operacion administrativa controlada `admin_guardar_inscripcion_jugador`.
Si falla, no debe quedar una creacion parcial.

## Prevencion de duplicados

La busqueda usa el nombre normalizado de base (`tp_normalizar_nombre_jugador`) y
aliases confirmados. Los homonimos se muestran como candidatos separados. Un
nombre normalizado coincidente no fusiona identidades automaticamente.

## Eventos historicos

Los eventos sin `inscripcion_jugador_id` siguen editables. El admin muestra el
texto historico y permite guardar otros campos sin vincular. La vinculacion es
manual y puntual; no se migran eventos masivamente en este flujo.

## Autogoles

En `gol_en_contra`, `equipo_id` sigue representando el club del jugador que
convirtio en contra. No se cambia automaticamente al equipo beneficiado.

## Seguridad

Las lecturas y escrituras de jugadores, inscripciones y eventos pasan por las
funciones Netlify con la validacion administrativa existente. El frontend no
recibe ni usa `SUPABASE_SERVICE_ROLE_KEY`, no escribe directo a Supabase y no se
debilita RLS.

## Pendiente

- Migrar los 308 eventos historicos sin ID.
- Crear fichas publicas de jugadores.
- Calcular estadisticas historicas nuevas por identidad.
- Importar planteles de forma masiva.
- Rehacer goleadores oficiales.
