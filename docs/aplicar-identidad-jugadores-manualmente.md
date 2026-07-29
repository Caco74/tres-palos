# Aplicar identidad de jugadores manualmente

Esta guia queda como registro operativo de la aplicacion manual ya realizada en
Supabase produccion. No usar credenciales en el chat y no ejecutar comandos SQL
desde Codex.

## Estado final

La migracion fue aplicada manualmente desde Supabase SQL Editor.

Despues se ejecuto:

`sql/verificar-identidad-jugadores.sql`

La verificacion posterior devolvio `ok: true`; los 30 controles pasaron y no
hubo controles fallidos.

## Archivos del PR

Conservar:

- `sql/aplicar-identidad-jugadores.sql`;
- `sql/prevalidar-identidad-jugadores.sql`;
- `sql/verificar-identidad-jugadores.sql`;
- `sql/respaldar-identidad-jugadores-manual.sql`;
- scripts de auditoria y respaldo;
- tests;
- documentacion;
- informes tecnicos.

El archivo temporal autorizado fue eliminado del repositorio despues de la
verificacion exitosa. El SQL protegido sigue existiendo y permanece bloqueado
contra ejecucion accidental mediante `PENDIENTE_AUTORIZACION`.

## Resultado verificado

| control | resultado |
|---|---:|
| `ok` | `true` |
| controles ejecutados | 30 |
| controles fallidos | 0 |
| jugadores | 27 |
| jugadores normalizados | 27 |
| inscripciones | 27 |
| eventos | 368 |
| eventos vinculados | 60 |
| eventos pendientes | 308 |
| goleadores oficiales | 4 |
| autogoles | 1 |
| referencias rotas | 0 |

No se modificaron eventos, inscripciones, resultados ni goleadores.

## Hashes posteriores registrados

| area | hash |
|---|---|
| `eventos_partido` | `eaccea24a78762ecea616417356660c7` |
| `inscripciones_jugadores` | `09b3ea7a7e94e4c0fb505c40b762e09a` |
| `goleadores_oficiales` | `c40a4eb88526fbb6bb377f2ab9507916` |
| jugadores historicos | `593ed9ecd9ca732561c6a313ca9c3ba9` |
| jugadores con nombre normalizado | `5471416c0a96d480bb64fe5dfd24e88d` |

## Confirmaciones de integridad

La verificacion confirmo:

- IDs de jugadores preservados;
- nombres publicos preservados;
- `Sanchez` IDs 11 y 25 preservados;
- `Sarco` IDs 20 y 21 preservados;
- inscripciones intactas;
- eventos intactos;
- tipos de eventos intactos;
- texto historico intacto;
- goleadores oficiales intactos;
- autogol de `ANGELETTI JOAQUIN` preservado;
- `UNIQUE(nombre_normalizado)` global: no;
- `jugadores_aliases` con RLS habilitado;
- aliases sin lectura publica;
- aliases sin escritura publica.

## Pendientes operativos

Los 308 eventos historicos continuan pendientes de vinculacion manual. No
migrarlos por similitud textual.

Los nuevos eventos del Clausura deberan crearse por `inscripcion_jugador_id`.
El panel administrativo todavia no fue adaptado. No se deben cargar nombres
libres del Clausura hasta completar el siguiente PR del admin.

## Respaldo y verificacion

Los CSV de respaldo y verificacion no deben guardarse en Git.

No guardar en Git:

- CSV del respaldo;
- CSV de verificacion;
- datos exportados;
- secretos;
- credenciales.

## Cierre del PR

Antes de merge:

- confirmar que `sql/aplicar-identidad-jugadores.sql` sigue protegido;
- confirmar que el archivo temporal autorizado fue eliminado;
- confirmar que respaldo, prevalidacion y verificacion siguen siendo
  `READ ONLY`;
- ejecutar suite completa y pruebas de identidad;
- revisar secretos;
- revisar alcance.

No hacer merge hasta que el Draft PR sea aprobado.
