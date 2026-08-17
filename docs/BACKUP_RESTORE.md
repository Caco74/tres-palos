# Backup y restauracion

Estado: VALIDADO end-to-end en agosto de 2026.

Este procedimiento sirve para generar un backup completo de PostgreSQL y probar su restauracion en un entorno aislado. Nunca restaurar primero sobre produccion.

## Objetivo

- Tener backup completo de PostgreSQL.
- Poder restaurarlo en un proyecto Supabase TEST separado y descartable.
- Validar datos, vista publica, RLS, policies y ACL antes de considerar cualquier recuperacion productiva.

## Herramientas

- Docker Desktop.
- WSL 2.
- Node.js/npm.
- Supabase CLI via `npx`.
- Imagen Docker `postgres:17` para ejecutar `psql`.

## Generar Backup

Las credenciales se cargan solo localmente mediante variables de entorno. No guardar ni pegar passwords, connection strings, hosts reales, tokens, project refs ni claves Supabase en Git o documentacion.

Comandos conceptuales:

```bash
npx supabase db dump --db-url "$SUPABASE_DB_URL" --role-only --file roles.sql
npx supabase db dump --db-url "$SUPABASE_DB_URL" --file schema.sql
npx supabase db dump --db-url "$SUPABASE_DB_URL" --data-only --file data.sql
```

Archivos resultantes:

- `roles.sql`
- `schema.sql`
- `data.sql`

Ubicacion usada en la validacion: `TresPalos_Backups/2026-08-15`.

## Restaurar En TEST

Destino obligatorio: proyecto Supabase separado y descartable. Produccion no se usa como destino de restauracion.

Orden obligatorio:

```bash
docker run --rm -i postgres:17 psql "$TEST_DB_URL" -v ON_ERROR_STOP=1 < roles.sql
docker run --rm -i postgres:17 psql "$TEST_DB_URL" -v ON_ERROR_STOP=1 < schema.sql
{ echo "SET session_replication_role = replica;"; cat data.sql; } | docker run --rm -i postgres:17 psql "$TEST_DB_URL" -v ON_ERROR_STOP=1
```

Los comandos son ejemplos bash/WSL sin credenciales reales. Usar variables de entorno locales para `TEST_DB_URL`. El `SET session_replication_role = replica` debe ejecutarse en la misma sesion que la carga de `data.sql`.

## Validar

Criterios comprobados en TEST:

- `public.eventos_partido = 447`
- `public.eventos_partido_publicos = 440`
- Eventos no confirmados visibles en la vista publica: `0`
- RLS activo en `public.eventos_partido`
- `force_rls = false`
- Policy `"public read eventos"` presente
- `anon` puede leer `public.eventos_partido_publicos`
- `anon` no puede leer `public.eventos_partido`
- `authenticated` no puede leer `public.eventos_partido`

## Hardening Post-Restore

Una restauracion logica no debe darse por terminada hasta revisar ACL.

En la prueba de agosto de 2026 el dump restauro privilegios directos amplios sobre `public.eventos_partido`. Para alinear TEST con el estado seguro conocido fue necesario reaplicar, solo en TEST:

```sql
REVOKE ALL PRIVILEGES ON TABLE public.eventos_partido FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.eventos_partido FROM authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.eventos_partido FROM PUBLIC;
```

Estos comandos corresponden al estado seguro conocido actual. Revisarlos si cambia la arquitectura publica, la vista `eventos_partido_publicos` o el modelo de permisos.

## Custodia

- Mantener al menos 2 copias.
- Mantener al menos 1 copia fuera del disco principal de la PC.
- Nunca versionar backups con datos reales ni secretos en Git.
- `respaldos/*.json` sigue ignorado por Git.

## Checklist De Recuperacion Real

1. Crear entorno aislado y descartable.
2. Comprobar conexion al destino.
3. Comprobar que el destino este limpio.
4. Restaurar `roles.sql`, `schema.sql` y `data.sql` en el orden definido.
5. Validar conteos.
6. Validar `public.eventos_partido_publicos`.
7. Validar RLS y policies.
8. Validar ACL.
9. Aplicar hardening post-restore si corresponde.
10. Validar nuevamente.
11. Recien despues considerar una recuperacion productiva.
