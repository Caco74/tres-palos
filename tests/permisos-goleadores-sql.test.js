"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function stripSqlNoise(sql) {
  return sql
    .replace(/--[^\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/'([^']|'')*'/g, "''")
    .replace(/\$[A-Za-z0-9_]*\$[\s\S]*?\$[A-Za-z0-9_]*\$/g, "$$BODY$$");
}

function normalizedSql(sql) {
  return stripSqlNoise(sql).replace(/\s+/g, " ").trim().toLowerCase();
}

function normalizedRawSql(sql) {
  return sql
    .replace(/--[^\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function assertReadOnlySql(relativePath) {
  const sql = read(relativePath);
  const stripped = stripSqlNoise(sql);

  assert.match(
    sql,
    /^\s*BEGIN\s+TRANSACTION\s+READ\s+ONLY\s*;/i,
    `${relativePath} debe comenzar con BEGIN TRANSACTION READ ONLY`
  );
  assert.match(sql, /COMMIT\s*;\s*$/i, `${relativePath} debe terminar con COMMIT`);
  assert.doesNotMatch(
    stripped,
    /\b(insert\s+into|update\s+public\.|delete\s+from|alter|create|drop|truncate|grant|revoke|call|execute)\b/i,
    `${relativePath} debe ser completamente de solo lectura`
  );
  assert.doesNotMatch(
    stripped,
    /\b(enable|disable)\s+row\s+level\s+security\b|\b(create|alter|drop)\s+policy\b/i,
    `${relativePath} no debe modificar RLS ni politicas`
  );
}

function grantRevokeStatements(sql) {
  return normalizedSql(sql)
    .match(/\b(?:revoke|grant)\b[^;]+;/g) || [];
}

function assertAuditSql() {
  const sql = read("sql/auditar-permisos-publicos-goleadores.sql");

  assertReadOnlySql("sql/auditar-permisos-publicos-goleadores.sql");
  [
    "public.partidos",
    "public.eventos_partido",
    "grant_directo",
    "privilegio_efectivo",
    "acl_efectiva",
    "propietario",
    "relrowsecurity",
    "pg_policies",
    "policy_command",
    "policy_roles",
    "anon",
    "PUBLIC",
    "authenticated",
    "grantor",
    "privilege_type",
    "is_grantable"
  ].forEach(text => assert.match(sql, new RegExp(text.replace(".", "\\."))));
  assert.match(sql, /has_table_privilege\s*\(\s*grantees\.grantee/i);
  assert.match(sql, /grants\.grantee in \('anon', 'PUBLIC', 'authenticated'\)/);
}

function assertProtectedCorrectionSql() {
  const relativePath = "sql/corregir-permisos-anon-goleadores.sql";
  const sql = read(relativePath);
  const stripped = stripSqlNoise(sql);
  const normalized = normalizedSql(sql);
  const rawNormalized = normalizedRawSql(sql);

  assert.match(
    sql,
    /^\s*begin\s*;/i,
    "el SQL protegido debe comenzar una transaccion"
  );
  assert.match(sql, /commit\s*;\s*$/i);
  assert.equal((normalized.match(/\bcommit\s*;/g) || []).length, 1);
  assert.match(sql, /v_autorizacion constant text := 'PENDIENTE_AUTORIZACION';/);
  assert.match(sql, /AUTORIZO PERMISOS GOLEADORES PUBLICOS/);
  assert.match(sql, /Correccion bloqueada/);
  assert.doesNotMatch(sql, /autorizado/i);

  assert.match(sql, /'public\.partidos'/);
  assert.match(sql, /'public\.eventos_partido'/);
  assert.match(sql, /where to_regclass\(tabla\) is null/);
  assert.match(sql, /relrowsecurity/);
  assert.match(sql, /has_table_privilege\('anon', qualified_name, 'SELECT'\)/);
  assert.match(sql, /policyname = required_policies\.policy_name/);
  assert.match(sql, /'partidos', 'lectura publica'/);
  assert.match(sql, /'eventos_partido', 'public read eventos'/);
  assert.match(sql, /policies\.cmd in \('ALL', 'INSERT', 'UPDATE', 'DELETE'\)/);
  assert.match(sql, /v_endpoint_goleadores_solo_select constant boolean := true;/);

  const firstRevoke = rawNormalized.indexOf("revoke insert, update, delete");
  assert.notEqual(firstRevoke, -1);
  [
    "where to_regclass(tabla) is null",
    "relrowsecurity",
    "has_table_privilege('anon', qualified_name, 'select')",
    "policyname = required_policies.policy_name",
    "v_endpoint_goleadores_solo_select"
  ].forEach(requiredBeforeChange => {
    const index = rawNormalized.indexOf(requiredBeforeChange);
    assert.ok(index >= 0, `falta validacion ${requiredBeforeChange}`);
    assert.ok(index < firstRevoke, `${requiredBeforeChange} debe estar antes del REVOKE`);
  });

  const statements = grantRevokeStatements(sql);
  assert.deepEqual(statements, [
    "revoke insert, update, delete on table public.partidos, public.eventos_partido from anon;",
    "revoke insert, update, delete on table public.partidos, public.eventos_partido from public;",
    "grant select on table public.partidos, public.eventos_partido to anon;"
  ]);
  assert.doesNotMatch(normalized, /revoke all privileges/);
  assert.doesNotMatch(normalized, /\b(to|from)\s+authenticated\b/);
  assert.doesNotMatch(normalized, /\b(to|from)\s+service_role\b/);

  assert.doesNotMatch(
    stripped,
    /\b(insert\s+into|update\s+public\.|delete\s+from|alter\s+table|drop|truncate|create\s+(?:table|index|policy|function|trigger)|alter\s+policy|create\s+policy|drop\s+policy)\b/i,
    "la correccion no debe modificar filas, estructura, RLS ni politicas"
  );
  assert.doesNotMatch(
    stripped,
    /\b(enable|disable)\s+row\s+level\s+security\b/i,
    "la correccion no debe activar ni desactivar RLS"
  );

  const lastGrant = rawNormalized.lastIndexOf(
    "grant select on table public.partidos, public.eventos_partido to anon;"
  );
  const finalValidation = rawNormalized.indexOf("verificacion final fallo", lastGrant);
  const commit = rawNormalized.lastIndexOf("commit;");
  assert.ok(finalValidation > lastGrant);
  assert.ok(finalValidation < commit);
  assert.match(rawNormalized, /anon perdio select/);
  assert.match(rawNormalized, /anon conserva escritura/);
  assert.match(rawNormalized, /public conserva escritura/);
}

function assertVerificationSql() {
  const sql = read("sql/verificar-permisos-anon-goleadores.sql");

  assertReadOnlySql("sql/verificar-permisos-anon-goleadores.sql");
  [
    "RLS activo: partidos",
    "RLS activo: eventos_partido",
    "anon tiene SELECT: partidos",
    "anon tiene SELECT: eventos_partido",
    "anon no tiene INSERT: partidos",
    "anon no tiene UPDATE: partidos",
    "anon no tiene DELETE: partidos",
    "anon no tiene INSERT: eventos_partido",
    "anon no tiene UPDATE: eventos_partido",
    "anon no tiene DELETE: eventos_partido",
    "Politica publica SELECT: partidos",
    "Politica publica SELECT: eventos_partido",
    "Sin politicas publicas de escritura: partidos",
    "Sin politicas publicas de escritura: eventos_partido",
    "Lectura efectiva disponible para anon",
    "Sin escritura heredada desde PUBLIC"
  ].forEach(control => assert.match(sql, new RegExp(control.replace("?", "\\?"))));

  assert.equal((sql.match(/^\s*\d+,\s*'/gm) || []).length, 16);
  assert.match(sql, /case when ok then 'OK' else 'REVISAR' end as resultado/);
  assert.match(sql, /control,\s*\n\s*case when ok then 'OK'/);
  assert.match(sql, /information_schema\.table_privileges/);
}

function assertPublicScorersFunctionIsReadOnly() {
  const source = read("netlify/functions/goleadores-publicos.js");
  const cleaned = source
    .replace(/\/\/[^\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/"([^"\\]|\\.)*"/g, "\"\"")
    .replace(/'([^'\\]|\\.)*'/g, "''")
    .replace(/`[^`]*`/g, "``");

  assert.match(source, /httpMethod !== "GET"/);
  assert.match(source, /Access-Control-Allow-Methods": "GET, OPTIONS"/);
  assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE_KEY|service_role/i);
  assert.doesNotMatch(
    cleaned,
    /\.(insert|update|delete|upsert|rpc)\s*\(|method:\s*(?:''|"")(?:POST|PUT|PATCH|DELETE)/i
  );
  assert.doesNotMatch(cleaned, /\b(insert\s+into|update\s+public\.|delete\s+from)\b/i);
}

function assertScorersCompatibility() {
  const { _private } = require("../netlify/functions/goleadores-publicos");
  const appSource = read("js/app.js");
  const indexSource = read("index.html");
  const filterOrder = [...indexSource.matchAll(
    /data-tabla-posiciones="([^"]+)"/g
  )].map(match => match[1]);

  assert.deepEqual(filterOrder, ["1", "2", "3", "general"]);
  assert.match(appSource, /let tablaPosicionesActual = "1";/);
  assert.match(appSource, /renderFilaGoleadorTabla\(goleador, esLider = false\)/);
  assert.doesNotMatch(appSource, /indice\s*===\s*0/);
  assert.equal(
    _private.getScorerSource({ anio: 2026, tipo: "clausura" }),
    _private.SOURCE_EVENTS
  );
  assert.equal(
    _private.getScorerSource({ anio: 2026, tipo: "apertura" }),
    _private.SOURCE_SNAPSHOT
  );
  assert.equal(_private.isCountableGoalEvent({
    tipo: "gol",
    estado_dato: "confirmado",
    inscripcion_jugador_id: 1
  }), true);
  assert.equal(_private.isCountableGoalEvent({
    tipo: "gol_penal",
    estado_dato: "confirmado",
    inscripcion_jugador_id: 1
  }), true);
  assert.equal(_private.isCountableGoalEvent({
    tipo: "gol_en_contra",
    estado_dato: "confirmado",
    inscripcion_jugador_id: 1
  }), false);
}

function assertDocsAndNoSecrets() {
  const docs = [
    "docs/goleadores-por-torneo.md",
    "docs/corregir-permisos-anon-goleadores.md"
  ].map(read).join("\n");
  const sql = [
    "sql/auditar-permisos-publicos-goleadores.sql",
    "sql/corregir-permisos-anon-goleadores.sql",
    "sql/verificar-permisos-anon-goleadores.sql"
  ].map(read).join("\n");
  const combined = `${docs}\n${sql}`;

  assert.match(docs, /RLS activo en ambas tablas/);
  assert.match(docs, /ninguna politica publica de INSERT, UPDATE o DELETE/);
  assert.match(docs, /privilegios de tabla\s+innecesarios de INSERT, UPDATE y DELETE/);
  assert.match(docs, /RLS actualmente impide usarlos/);
  assert.match(docs, /minimo privilegio/);
  assert.match(docs, /aplicarse manualmente/);
  assert.match(docs, /requiere unicamente SELECT/);
  assert.match(docs, /No hacer merge/);
  assert.match(docs, /eliminar cualquier SQL temporal autorizado/);
  assert.doesNotMatch(
    combined,
    /eyJ[A-Za-z0-9_-]{20,}|postgres(?:ql)?:\/\/|sk-[A-Za-z0-9]|JWT_SECRET|DATABASE_URL|PASSWORD\s*=/i
  );
}

function assertNoAuthorizedSql() {
  const forbidden = path.join(
    ROOT,
    "sql",
    "corregir-permisos-anon-goleadores-autorizado.sql"
  );
  assert.equal(
    fs.existsSync(forbidden),
    false,
    "no debe existir una copia autorizada versionada"
  );
}

function runTests() {
  const results = [];
  assertAuditSql();
  results.push("auditoria SQL READ ONLY y origen de privilegios: ok");
  assertProtectedCorrectionSql();
  results.push("correccion SQL protegida, acotada y sin datos/RLS: ok");
  assertVerificationSql();
  results.push("verificacion SQL READ ONLY con 16 controles: ok");
  assertPublicScorersFunctionIsReadOnly();
  results.push("funcion publica de goleadores solo requiere lectura: ok");
  assertScorersCompatibility();
  results.push("compatibilidad de goleadores, filtros y lideres: ok");
  assertDocsAndNoSecrets();
  results.push("documentacion y ausencia de secretos reales: ok");
  assertNoAuthorizedSql();
  results.push("sin SQL temporal autorizado versionado: ok");
  return results;
}

if (require.main === module) {
  try {
    runTests().forEach(result => console.log(result));
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}

module.exports = {
  runTests
};
