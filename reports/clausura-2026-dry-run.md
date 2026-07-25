# Dry-run Clausura 2026

## Fuente

- Archivo: `data/clausura-2026/fixture_clausura_2026_oficial.json`
- Tamaño: 87291 bytes
- SHA-256: `5924104aeb764e13640fe17d247b5db1ad5c14239f7784855b73e17099599145`
- Fecha de preparacion local del archivo: 2026-07-25T08:20:30.041Z
- URL oficial: https://www.xn--ligacaadense-fhb.com.ar/fixture.php?idx=2026/1/
- Trazabilidad: el PDF citado en metadata es referencia de fuente original; no se requiere para este dry-run.
- Nota: los 0-0 de la fuente oficial eran placeholders y se preparan como resultados nulos.
- Nota: Zona 2 no tiene partidos en fechas 6, 7, 13 y 14 e inicia una semana mas tarde.

## Validacion local

- Clubes fuente: 20
- Partidos fuente: 114
- Fechas libres: 28
- Partidos por zona: Zona 1: 42, Zona 2: 30, Zona 3: 42
- Fechas libres por zona: Zona 1: 14, Zona 2: 0, Zona 3: 14
- Partidos por fecha: Fecha 1: 9, Fecha 2: 9, Fecha 3: 9, Fecha 4: 9, Fecha 5: 9, Fecha 6: 6, Fecha 7: 6, Fecha 8: 9, Fecha 9: 9, Fecha 10: 9, Fecha 11: 9, Fecha 12: 9, Fecha 13: 6, Fecha 14: 6
- Fechas de Zona 2: 1, 2, 3, 4, 5, 8, 9, 10, 11, 12
- Errores locales: 0
- Warnings locales: 0

## Torneo y remoto

- Torneo: Confirmado: id 2, Clausura 2026, anio 2026, tipo clausura, activo false.
- Acceso remoto usado: Supabase REST publico, solo GET
- Partidos existentes Clausura: 0
- Nuevos esperados: 114
- Existentes identicos: 0
- Conflictos: 0
- Duplicados remotos: 0
- Participaciones: No hay tabla versionada de participaciones de clubes por torneo. El proyecto representa zonas por partidos regulares y conserva clubes.zona como campo global heredado.
- Inscripciones de jugadores Clausura consultadas: 0

## Mapeo de clubes

| nombre_fuente | nombre_en_proyecto | club_id | metodo | estado |
|---|---|---:|---|---|
| AD.EVERTON/OLIMPIA | AD Everton/Olimpia | 46 | normalización confirmada | confirmado |
| ARGENTINO A. CLUB | Argentino A. Club | 55 | normalización confirmada | confirmado |
| BELGRANO A.C. | Belgrano A.C. | 61 | normalización confirmada | confirmado |
| C.A. ALMAFUERTE | C.A. Almafuerte | 50 | normalización confirmada | confirmado |
| C.A. AMERICA | C.A. América | 58 | normalización confirmada | confirmado |
| C.A. BARRACA | C.A. Barraca | 63 | normalización confirmada | confirmado |
| C.A. CAMPAÑA | C.A. Campaña | 52 | normalización confirmada | confirmado |
| C.A. CORREA | C.A. Correa | 53 | normalización confirmada | confirmado |
| C.A. COSMOPOLITA | C.A. Cosmopolita | 49 | normalización confirmada | confirmado |
| C.A. DEFENSORES | C.A. Defensores | 44 | normalización confirmada | confirmado |
| C.A. EL PORVENIR DEL NORTE | C.A. El Porvenir del Norte | 45 | normalización confirmada | confirmado |
| C.A. MONTES DE OCA | C.A. Montes de Oca | 48 | normalización confirmada | confirmado |
| C.A. N.O. BOYS | C.A. N.O. Boys | 59 | normalización confirmada | confirmado |
| C.A. SAN JERONIMO | C.A. San Jerónimo | 60 | normalización confirmada | confirmado |
| C.A. UNION C.S.D. | C.A. Unión C.S.D. | 56 | normalización confirmada | confirmado |
| C.A. UNION TORTUGAS | C.A. Unión Tortugas | 62 | normalización confirmada | confirmado |
| C.A.WILLIAMS KEMMIS | C.A. Williams Kemmis | 51 | normalización confirmada | confirmado |
| DEF. SPORTSMAN | Def. Sportsman | 54 | normalización confirmada | confirmado |
| SPORT C. CAÑADENSE | Sport C. Cañadense | 47 | normalización confirmada | confirmado |
| SPORTIVO A. CLUB | Sportivo A. Club | 43 | normalización confirmada | confirmado |

## Idempotencia

- Clave logica: `torneo_id`, `tipo`, `fecha`, `zona`, `local_id`, `visitante_id`.
- No se usa `fixture_key` como ID de base.
- El dry-run clasifica nuevos, existentes identicos, conflictos y duplicados.

## Desfase de Zona 2

- La web publica filtra la vista de Partidos por numero de `fecha` oficial.
- Una misma Fecha 1 puede contener partidos jugados en fines de semana distintos si sus `fecha_partido` reales difieren.
- El inicio elige la menor fecha oficial pendiente; no ordena la fecha destacada por calendario real.
- Los listados internos ordenan por `fecha_partido` cuando existe; si esta nula, quedan como fecha/hora a confirmar.
- Cuando Zona 1 y Zona 3 esten en Fecha 2 y Zona 2 juegue Fecha 1, la interfaz actual no puede expresar bien el desfase solo con `fecha`.
- No conviene crear partidos ficticios ni selector global de torneos.
- Ajuste minimo recomendado futuro: agregar una pequena agrupacion/etiqueta por `fecha_partido` en agenda y detalle de fecha, manteniendo `fecha` como jornada oficial y ocultando Zona 2 en fechas sin partidos reales.

## Resultado

- Estado local: APROBADO LOCALMENTE
- Estado remoto: aprobado
- Estado final: APROBADO PARA REVISIÓN REMOTA

## Seguridad

- Escrituras en Supabase: 0
- Inserts: 0
- Updates: 0
- Deletes: 0
- Cambios de RLS: 0
- Cambios de produccion: 0
- Credenciales agregadas: 0

## Errores

- Ninguno.

## Warnings

- Ninguno.
