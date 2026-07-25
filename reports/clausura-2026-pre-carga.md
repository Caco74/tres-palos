# Pre-carga Clausura 2026

## Estado

- Resultado: PREPARADO PARA AUTORIZACION
- Escrituras en Supabase en esta etapa: 0
- Inserts: 0
- Updates: 0
- Deletes: 0
- Upserts: 0
- RPC de escritura: 0

## Fuente

- Fixture: `data/clausura-2026/fixture_clausura_2026_oficial.json`
- Fixture SHA-256: `bfc0dfb956a33a8395d5927aad11df41758fb1ad68b41f7f62de735ea2d6b705`
- Registros construidos: 114
- Partidos por zona: Zona 1 42, Zona 2 30, Zona 3 42
- Fechas libres: 28
- Carcarana en fixture: 0

## Remoto GET

- Torneo Clausura: id 2, Clausura 2026, anio 2026, tipo clausura, activo false
- Partidos existentes Clausura: 0
- Nuevos esperados: 114
- Identicos existentes: 0
- Conflictos: 0
- Duplicados remotos: 0
- Clubes mapeados: 20/20
- Apertura total: 140
- Apertura desglose remoto: regular 126, playoff 14
- Source en regular Apertura: 0

## Metodo recomendado

- Metodo: Supabase SQL Editor.
- Archivo de carga: `sql/cargar-clausura-2026.sql`
- Motivo: no hay ruta local existente que cree fixtures completos en una transaccion; la funcion admin actual solo actualiza partidos existentes y el anon key publico no debe asumirse apto para insertar.
- Proteccion: el SQL falla por defecto porque contiene `PENDIENTE_AUTORIZACION` y valida la frase exacta antes de insertar.
- Transaccion: `begin` + bloque `do` + `commit`; cualquier excepcion aborta y revierte toda la operacion.
- Idempotencia: clave logica `torneo_id`, `tipo`, `fecha`, `zona`, `local_id`, `visitante_id`; re-ejecucion con los 114 registros identicos no duplica.

## Respaldo

- Archivo local: `respaldos/clausura-2026-pre-carga-20260725T140731Z.json`
- Contenido minimo: torneo Clausura, partidos actuales del Clausura, conteo de Apertura, clubes mapeados, timestamp y hash del fixture.
- Credenciales incluidas: 0
- Versionado: no debe agregarse al commit; `respaldos/*.json` esta ignorado.

## Ejecucion futura

1. Confirmar que el PR fue revisado.
2. Generar o conservar un respaldo local inmediatamente antes de la carga.
3. Reemplazar `PENDIENTE_AUTORIZACION` por la frase exacta autorizada en el SQL.
4. Ejecutar el SQL completo en Supabase SQL Editor.
5. Ejecutar `sql/verificar-clausura-2026-post-carga.sql`.

## Rollback

- Si el SQL falla, no hay commit y la transaccion queda revertida automaticamente.
- Si una carga autorizada ya fue confirmada y debe deshacerse, usar el respaldo local y preparar un rollback separado y explicito antes de borrar datos.

## Errores

- Ninguno.

## Warnings

- Ninguno.
