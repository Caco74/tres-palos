# Aplicar identidad de jugadores manualmente

Esta guia es para ejecutar la migracion desde Supabase SQL Editor. No usar
credenciales en el chat y no ejecutar comandos desde Codex.

## Paso 1: respaldo

Ejecutar completo:

`sql/respaldar-identidad-jugadores-manual.sql`

Descargar el resultado como CSV y guardarlo fuera de Git. No continuar si el
respaldo no se pudo descargar.

## Paso 2: aplicacion

Ejecutar completo:

`sql/aplicar-identidad-jugadores-autorizado.sql`

No seleccionar fragmentos.

Si aparece un error:

- no volver a ejecutarlo;
- copiar unicamente el mensaje del error;
- detener el proceso.

## Paso 3: verificacion

Ejecutar completo:

`sql/verificar-identidad-jugadores.sql`

Descargar el resultado como CSV.

## Paso 4: comparar

Comparar las cantidades y hashes del respaldo con la verificacion posterior.

Valores esperados:

- jugadores: 27;
- inscripciones: 27;
- eventos: 368;
- eventos vinculados: 60;
- eventos pendientes: 308;
- goleadores oficiales: 4;
- autogoles: 1;
- referencias rotas: 0.

No hacer merge hasta que la verificacion sea aprobada.

## Paso 5: limpieza

Despues de una verificacion exitosa:

- eliminar del repositorio `sql/aplicar-identidad-jugadores-autorizado.sql`;
- conservar `sql/aplicar-identidad-jugadores.sql`;
- conservar los SQL de respaldo y verificacion;
- conservar documentacion y tests;
- hacer un commit de limpieza;
- recien entonces dejar el PR listo para revision.
