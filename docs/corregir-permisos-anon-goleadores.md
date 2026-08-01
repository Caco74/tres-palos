# Corregir permisos anon de goleadores publicos

Esta guia prepara una correccion manual de minimo privilegio para
`public.partidos` y `public.eventos_partido`. No incluye credenciales ni debe
ejecutarse desde Codex.

## 1. Auditar

Ejecutar en Supabase SQL Editor:

`sql/auditar-permisos-publicos-goleadores.sql`

El script es `BEGIN TRANSACTION READ ONLY` y no modifica permisos ni datos.
Descargar el resultado como CSV y revisar si los privilegios de escritura
vienen de:

- GRANT directo a `anon`;
- GRANT heredable desde `PUBLIC`;
- ambos.

## 2. Revisar el origen

Confirmar que el estado coincide con la auditoria esperada:

- RLS activo en `partidos`;
- RLS activo en `eventos_partido`;
- SELECT disponible para `anon`;
- politicas publicas de SELECT presentes;
- sin politicas publicas de escritura;
- privilegios DML innecesarios para `anon` detectados por privilegios de tabla.

Si aparece una politica publica de escritura o una tabla sin RLS, detener el
proceso y auditar antes de corregir permisos.

## 3. Autorizar una copia temporal

No editar el archivo protegido versionado directamente para aplicarlo. Crear
una copia temporal fuera del commit o en un archivo local ignorado, reemplazar
`PENDIENTE_AUTORIZACION` por:

`AUTORIZO PERMISOS GOLEADORES PUBLICOS`

No agregar esa copia temporal al repositorio.

## 4. Ejecutar la correccion

Ejecutar la copia autorizada completa en Supabase SQL Editor. La correccion:

- conserva SELECT para `anon`;
- revoca INSERT, UPDATE y DELETE de `anon`;
- revoca INSERT, UPDATE y DELETE de `PUBLIC`;
- no cambia politicas RLS;
- no desactiva RLS;
- no modifica filas;
- no modifica permisos directos de `authenticated`;
- no modifica permisos directos de `service_role`.

Se eligio `REVOKE INSERT, UPDATE, DELETE` especifico en lugar de
`REVOKE ALL PRIVILEGES` para preservar la lectura publica y limitar el cambio a
los privilegios DML auditados.

## 5. Verificar

Ejecutar:

`sql/verificar-permisos-anon-goleadores.sql`

El resultado debe mostrar `OK` en todos los controles. Descargar el CSV y
conservarlo con la auditoria.

## 6. Comprobar la web publica

Verificar que la tabla publica de goleadores sigue funcionando:

- Clausura 2026 desde eventos identificados;
- Apertura 2026 desde `goleadores_oficiales`;
- Zona 1 como vista inicial;
- General disponible al final;
- lideres empatados destacados correctamente.

## 7. Limpiar antes del merge

Antes de mergear:

- eliminar cualquier SQL temporal autorizado;
- confirmar que el archivo autorizado no quedo en Git;
- confirmar que no se agregaron credenciales ni capturas con secretos;
- confirmar que no se modificaron datos deportivos.
