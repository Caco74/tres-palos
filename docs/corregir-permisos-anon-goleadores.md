# Corregir permisos anon de goleadores publicos

Esta guia prepara una correccion manual de minimo privilegio para
`public.partidos` y `public.eventos_partido`. No incluye credenciales y no debe
ejecutarse desde Codex.

## 1. Auditar

Ejecutar en Supabase SQL Editor:

`sql/auditar-permisos-publicos-goleadores.sql`

El script es `BEGIN TRANSACTION READ ONLY` y no modifica permisos ni datos.
Descargar el resultado como CSV y revisar si los privilegios vienen de:

- GRANT directo a `anon`;
- GRANT heredable desde `PUBLIC`;
- ambos;
- GRANT directo a `authenticated`.

## 2. Estado confirmado

La auditoria manual de produccion confirmo para `public.partidos` y
`public.eventos_partido`:

- RLS activo;
- politica publica de SELECT en cada tabla;
- ninguna politica publica de INSERT, UPDATE o DELETE;
- sin privilegios heredados desde `PUBLIC`;
- GRANT directo de `postgres` a `anon`;
- GRANT directo de `postgres` a `authenticated`;
- ACL directo `anon=arwdDxtm/postgres`;
- ACL directo `authenticated=arwdDxtm/postgres`.

El conjunto detectado incluye SELECT, INSERT, UPDATE, DELETE, TRUNCATE,
REFERENCES, TRIGGER y MAINTAIN, o su equivalente `m` segun la version de
PostgreSQL.

RLS protege las operaciones por filas al no existir politicas publicas de
escritura, pero no debe usarse como unica barrera para privilegios de tabla que
no operan fila por fila. TRUNCATE y los privilegios administrativos no deben
quedar concedidos al rol publico `anon`.

## 3. Correccion de anon

La correccion protegida versionada esta en:

`sql/corregir-permisos-anon-goleadores.sql`

La variante elegida es intencionalmente amplia sobre los roles publicos
auditados:

```sql
REVOKE ALL PRIVILEGES
ON TABLE public.partidos, public.eventos_partido
FROM anon;

REVOKE ALL PRIVILEGES
ON TABLE public.partidos, public.eventos_partido
FROM PUBLIC;

GRANT SELECT
ON TABLE public.partidos, public.eventos_partido
TO anon;
```

Se eligio `REVOKE ALL PRIVILEGES` porque la auditoria encontro mas que INSERT,
UPDATE y DELETE. Usar una lista parcial dejaria privilegios innecesarios como
TRUNCATE, REFERENCES, TRIGGER o MAINTAIN. El `GRANT SELECT` posterior preserva
exactamente la lectura que necesita la web publica.

La correccion no modifica:

- filas;
- RLS;
- politicas;
- estructura de tablas;
- propietario `postgres`;
- `service_role`;
- `authenticated`.

## 4. Correccion aplicada

La correccion de `anon` fue aplicada manualmente en produccion el 2026-08-01.
Se ejecuto completo el SQL temporal autorizado y la ejecucion termino con
Success.

Resultado registrado:

- verificacion posterior: 28/28 controles OK;
- `anon` quedo solo con SELECT en `public.partidos` y
  `public.eventos_partido`;
- `authenticated` no fue modificado;
- RLS no fue modificado;
- politicas no fueron modificadas;
- no se modificaron filas;
- no se modificaron datos deportivos.

El archivo temporal autorizado fue eliminado de la rama. No debe volver a
versionarse antes del merge.

## 5. authenticated

La busqueda en el repositorio no encontro uso de Supabase Auth:

- `supabase.auth`;
- `signIn`;
- `signUp`;
- `getSession`;
- `onAuthStateChange`;
- tokens de usuario;
- sesiones Supabase en navegador.

El admin usa funciones Netlify con `x-admin-password` y `service_role` del lado
servidor. No depende del rol `authenticated` ni de escrituras directas desde el
navegador para estas tablas.

Por ese motivo se preparo una correccion protegida e independiente:

`sql/corregir-permisos-authenticated-goleadores.sql`

No existe una version temporal autorizada para `authenticated`. Esa correccion
requiere una decision explicita antes de ejecutarse.

## 6. Verificar

Ejecutar:

`sql/verificar-permisos-anon-goleadores.sql`

El resultado debe mostrar `OK` para:

- RLS activo en ambas tablas;
- SELECT efectivo para `anon`;
- INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER y MAINTAIN ausentes para
  `anon`;
- ACL directa de `anon` con solo SELECT;
- sin privilegios heredados desde `PUBLIC`;
- politica publica SELECT presente;
- sin politicas publicas de escritura.

Descargar el resultado como CSV y conservarlo junto con la auditoria.

## 7. Comprobar la web publica

Verificar que la tabla publica de goleadores sigue funcionando:

- Clausura 2026 desde eventos identificados;
- Apertura 2026 desde `goleadores_oficiales`;
- Zona 1 como vista inicial;
- General disponible al final;
- lideres empatados destacados correctamente.

## 8. Cierre local antes del merge

Antes de mergear:

- confirmar que `sql/corregir-permisos-anon-goleadores-autorizado.sql` no esta
  en la rama;
- confirmar que no quedaron credenciales ni capturas con secretos;
- confirmar que no se modificaron datos deportivos;
- conservar la verificacion posterior documentada sin incluir datos sensibles.
