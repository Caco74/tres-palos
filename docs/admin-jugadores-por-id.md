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
5. Buscar dentro del plantel del club.
6. Elegir una inscripcion de jugador.
7. Guardar incidencia.

El navegador envia `inscripcion_jugador_id`. La funcion Netlify resuelve en
servidor el jugador, club, torneo y nombre canonico antes de insertar o
actualizar.

El selector de incidencias no muestra jugadores globales. La lista se limita a
las inscripciones del torneo y club seleccionados, se filtra por nombre en el
navegador y muestra un maximo visible reducido para evitar errores en movil.

## Carga posterior del partido

El modo rapido de incidencias usa el mismo criterio de identidad por
inscripcion, pero la seleccion se hace en pasos explicitos:

1. Elegir el equipo local o visitante con botones identificados como `LOCAL` y
   `VISITANTE`.
2. Elegir un unico tipo de incidencia desde una sola grilla de acciones.
3. Buscar al jugador dentro del plantel del equipo seleccionado.
4. Completar tiempo o minuto cuando corresponda.
5. Guardar la incidencia con el boton de confirmacion.

Al cambiar de equipo se limpian el tipo y el jugador seleccionados. En un
`gol_en_contra`, el equipo seleccionado sigue siendo el club del jugador que
convirtio en contra; no se cambia al equipo beneficiado.

## Planteles

La accion `Agregar jugador` empieza con una busqueda progresiva de persona
existente. No se muestra un selector global de jugadores ni el formulario de
alta antes de buscar.

La busqueda comienza desde 2 caracteres, usa normalizacion de base para ignorar
mayusculas y tildes, y devuelve como maximo 8 candidatos. Cada candidato muestra
el nombre canonico y sus inscripciones conocidas con club y torneo. Si no tiene
inscripciones conocidas, se indica `Sin inscripciones registradas`.

## Jugador existente sin inscripcion

La accion `Jugador no encontrado` en incidencias y la busqueda de `Planteles`
comparten el mismo criterio: primero se busca el nombre recibido desde la
fuente. Si la persona existe pero no tiene inscripcion para el club y torneo
elegidos, el admin puede crear solo esa inscripcion.

La operacion es idempotente: si la inscripcion ya existe, se devuelve la fila
existente y se selecciona en el formulario.

## Jugador nuevo

Solo se puede crear una persona nueva despues de buscar candidatos y confirmar
explicitamente que no corresponde a los resultados mostrados. El formulario pide
solo `nombre_completo`.

`Nombres alternativos` no forma parte del flujo principal ni es obligatorio. Si
se edita una inscripcion existente, queda dentro de `Datos adicionales`.

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
