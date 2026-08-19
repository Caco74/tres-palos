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

function grantRevokeStatements(sql) {
  return normalizedSql(sql).match(/\b(?:revoke|grant)\b[^;]+;/g) || [];
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

function assertCorrectionDoesNotModifyRowsOrRls(relativePath) {
  const sql = read(relativePath);
  const stripped = stripSqlNoise(sql);

  assert.doesNotMatch(
    stripped,
    /\b(insert\s+into|update\s+public\.|delete\s+from|alter\s+table|drop|truncate|create\s+(?:table|index|policy|function|trigger)|alter\s+policy|create\s+policy|drop\s+policy)\b/i,
    `${relativePath} no debe modificar filas, estructura, RLS ni politicas`
  );
  assert.doesNotMatch(
    stripped,
    /\b(enable|disable)\s+row\s+level\s+security\b/i,
    `${relativePath} no debe activar ni desactivar RLS`
  );
}

function assertAuditSql() {
  const sql = read("sql/auditar-permisos-publicos-goleadores.sql");

  assertReadOnlySql("sql/auditar-permisos-publicos-goleadores.sql");
  [
    "public.partidos",
    "public.eventos_partido",
    "acl_directa",
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
  assert.match(sql, /aclexplode\s*\(/);
  assert.match(sql, /has_table_privilege\s*\(\s*grantees\.grantee/i);
  assert.match(sql, /grants\.grantee in \('anon', 'PUBLIC', 'authenticated'\)/);
}

function assertAnonCorrectionSql() {
  const relativePath = "sql/corregir-permisos-anon-goleadores.sql";
  const sql = read(relativePath);
  const normalized = normalizedSql(sql);
  const rawNormalized = normalizedRawSql(sql);

  assert.match(sql, /^\s*begin\s*;/i, "el SQL protegido debe comenzar una transaccion");
  assert.match(sql, /commit\s*;\s*$/i);
  assert.equal((normalized.match(/\bcommit\s*;/g) || []).length, 1);
  assert.match(sql, /v_autorizacion constant text := 'PENDIENTE_AUTORIZACION';/);
  assert.match(sql, /AUTORIZO PERMISOS GOLEADORES PUBLICOS/);
  assert.match(sql, /Correccion bloqueada/);
  assert.doesNotMatch(sql, /ARCHIVO TEMPORAL AUTORIZADO/i);

  [
    "'public.partidos'",
    "'public.eventos_partido'",
    "relrowsecurity",
    "has_table_privilege('anon', qualified_name, 'SELECT')",
    "'partidos', 'lectura publica'",
    "'eventos_partido', 'public read eventos'",
    "v_endpoint_goleadores_solo_select constant boolean := true;",
    "anon=arwdDxtm/postgres",
    "authenticated=arwdDxtm/postgres",
    "aclexplode",
    "'TRUNCATE'",
    "'REFERENCES'",
    "'TRIGGER'",
    "'MAINTAIN'",
    "SELECT WITH GRANT OPTION",
    "is_grantable"
  ].forEach(text => assert.match(sql, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))));
  assert.match(sql, /grantor is distinct from 'postgres'/);
  assert.match(sql, /grantee = 'PUBLIC'/);
  assert.match(sql, /privilege_type <> 'SELECT'/);
  assert.match(sql, /has_table_privilege\('anon', targets\.qualified_name, standard_privileges\.privilege_type\)/);
  assert.match(sql, /where privilege_type = 'SELECT'\s+and is_grantable/i);

  const firstChange = rawNormalized.indexOf(
    "revoke all privileges on table public.partidos, public.eventos_partido from anon;"
  );
  assert.notEqual(firstChange, -1);
  [
    "where to_regclass(tabla) is null",
    "relrowsecurity",
    "has_table_privilege('anon', qualified_name, 'select')",
    "policyname = required_policies.policy_name",
    "v_endpoint_goleadores_solo_select",
    "grantor is distinct from 'postgres'",
    "required_privileges"
  ].forEach(requiredBeforeChange => {
    const index = rawNormalized.indexOf(requiredBeforeChange);
    assert.ok(index >= 0, `falta validacion ${requiredBeforeChange}`);
    assert.ok(index < firstChange, `${requiredBeforeChange} debe estar antes del REVOKE`);
  });

  assert.deepEqual(grantRevokeStatements(sql), [
    "revoke all privileges on table public.partidos, public.eventos_partido from anon;",
    "revoke all privileges on table public.partidos, public.eventos_partido from public;",
    "grant select on table public.partidos, public.eventos_partido to anon;"
  ]);
  assert.doesNotMatch(normalized, /\b(to|from)\s+authenticated\b/);
  assert.doesNotMatch(normalized, /\b(to|from)\s+service_role\b/);
  assertCorrectionDoesNotModifyRowsOrRls(relativePath);

  const lastGrant = rawNormalized.lastIndexOf(
    "grant select on table public.partidos, public.eventos_partido to anon;"
  );
  const finalValidation = rawNormalized.indexOf("verificacion final fallo", lastGrant);
  const commit = rawNormalized.lastIndexOf("commit;");
  assert.ok(finalValidation > lastGrant);
  assert.ok(finalValidation < commit);
  assert.match(rawNormalized, /anon perdio select/);
  assert.match(rawNormalized, /quedaron privilegios anonimos innecesarios/);
  assert.match(rawNormalized, /anon conserva privilegios efectivos/);
}

function assertNoAuthorizedAnonSql() {
  assert.equal(
    fs.existsSync(path.join(ROOT, "sql", "corregir-permisos-anon-goleadores-autorizado.sql")),
    false,
    "el SQL temporal autorizado de anon debe estar eliminado antes del merge"
  );
}

function assertAuthenticatedCorrectionSql() {
  const relativePath = "sql/corregir-permisos-authenticated-goleadores.sql";
  const sql = read(relativePath);
  const normalized = normalizedSql(sql);

  assert.match(sql, /^\s*begin\s*;/i);
  assert.match(sql, /commit\s*;\s*$/i);
  assert.match(sql, /v_autorizacion constant text := 'PENDIENTE_AUTORIZACION';/);
  assert.match(sql, /AUTORIZO PERMISOS AUTHENTICATED GOLEADORES/);
  assert.match(sql, /v_authenticated_sin_uso_en_repo constant boolean := true;/);
  assert.match(sql, /authenticated no conserva SELECT/);
  assert.match(sql, /authenticated ya no tiene privilegios innecesarios/);
  assert.match(sql, /authenticated conserva privilegios efectivos/);
  assert.match(sql, /grantor is distinct from 'postgres'/);
  assert.match(sql, /relrowsecurity/);
  assert.match(sql, /aclexplode\s*\(/);

  assert.deepEqual(grantRevokeStatements(sql), [
    "revoke all privileges on table public.partidos, public.eventos_partido from authenticated;",
    "grant select on table public.partidos, public.eventos_partido to authenticated;"
  ]);
  assert.doesNotMatch(normalized, /\b(to|from)\s+anon\b/);
  assert.doesNotMatch(normalized, /\b(to|from)\s+public\b/);
  assert.doesNotMatch(normalized, /\b(to|from)\s+service_role\b/);
  assertCorrectionDoesNotModifyRowsOrRls(relativePath);

  assert.equal(
    fs.existsSync(path.join(ROOT, "sql", "corregir-permisos-authenticated-goleadores-autorizado.sql")),
    false,
    "no debe existir un SQL autorizado para authenticated"
  );
}

function assertVerificationSql() {
  const sql = read("sql/verificar-permisos-anon-goleadores.sql");

  assertReadOnlySql("sql/verificar-permisos-anon-goleadores.sql");
  [
    "RLS activo: partidos",
    "RLS activo: eventos_partido",
    "anon tiene SELECT efectivo:",
    "'anon no tiene ' || privileges_to_check.privilege_type || ' efectivo: '",
    "anon sin SELECT WITH GRANT OPTION:",
    "ACL directa anon solo SELECT:",
    "Sin privilegios heredados desde PUBLIC:",
    "Politica publica SELECT:",
    "Sin politicas publicas de escritura:"
  ].forEach(control => assert.match(sql, new RegExp(control.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))));
  [
    "'SELECT'",
    "'INSERT'",
    "'UPDATE'",
    "'DELETE'",
    "'TRUNCATE'",
    "'REFERENCES'",
    "'TRIGGER'",
    "'MAINTAIN'"
  ].forEach(privilege => assert.match(sql, new RegExp(privilege)));
  assert.match(sql, /direct_acl as \(/);
  assert.match(sql, /anon_effective_acl as \(/);
  assert.match(sql, /aclexplode\s*\(/);
  assert.match(sql, /has_table_privilege\(\s*'anon',\s*table_state\.qualified_name,\s*privileges_to_check\.privilege_type\s*\)/);
  assert.match(sql, /acl\.privilege_type = 'SELECT'\s+and acl\.is_grantable/i);
  assert.match(sql, /case when ok then 'OK' else 'REVISAR' end as resultado/);
  assert.match(sql, /control,\s*\n\s*case when ok then 'OK'/);
  assert.doesNotMatch(sql, /information_schema\.table_privileges/);
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
  assert.match(source, /\/rest\/v1\/eventos_partido_publicos/);
  assert.doesNotMatch(source, /\/rest\/v1\/eventos_partido["?]/);
  assert.match(
    source,
    /\?select=id,partido_id,tipo,estado_dato,inscripcion_jugador_id,jugador/
  );
  assert.doesNotMatch(
    source,
    /eventos_partido_publicos[\s\S]{0,160}(?:fuente|observaciones)/
  );
  assert.doesNotMatch(
    cleaned,
    /\.(insert|update|delete|upsert|rpc)\s*\(|method:\s*(?:''|"")(?:POST|PUT|PATCH|DELETE)/i
  );
  assert.doesNotMatch(cleaned, /\b(insert\s+into|update\s+public\.|delete\s+from)\b/i);
}

function collectFiles(relativePaths) {
  const files = [];

  relativePaths.forEach(relativePath => {
    const absolutePath = path.join(ROOT, relativePath);
    if (!fs.existsSync(absolutePath)) return;
    const stat = fs.statSync(absolutePath);
    if (stat.isDirectory()) {
      fs.readdirSync(absolutePath, { withFileTypes: true }).forEach(entry => {
        const child = path.join(relativePath, entry.name);
        if (entry.isDirectory()) {
          files.push(...collectFiles([child]));
        } else {
          files.push(child);
        }
      });
    } else {
      files.push(relativePath);
    }
  });

  return files;
}

function assertSupabaseAuthAudit() {
  const applicationFiles = collectFiles([
    "js",
    "netlify",
    "scripts",
    "index.html",
    "tp-admin-7c9f2026.html"
  ]).filter(file => /\.(?:js|html)$/.test(file));
  const applicationSource = applicationFiles
    .map(file => `\n/* ${file} */\n${read(file)}`)
    .join("\n");

  [
    /supabase\.auth/i,
    /\bsignIn\b/,
    /\bsignUp\b/,
    /\bgetSession\b/,
    /\bonAuthStateChange\b/,
    /\baccess_token\b/,
    /\brefresh_token\b/,
    /\buser_metadata\b/
  ].forEach(pattern => assert.doesNotMatch(applicationSource, pattern));

  const browserSource = collectFiles(["js", "index.html", "tp-admin-7c9f2026.html"])
    .filter(file => /\.(?:js|html)$/.test(file))
    .map(read)
    .join("\n");
  assert.doesNotMatch(browserSource, /\.(insert|update|delete|upsert|rpc)\s*\(/i);

  const adminPanel = read("js/admin-panel.js");
  const adminFunctions = collectFiles(["netlify/functions"])
    .filter(file => /admin-.*\.js$/.test(file))
    .map(read)
    .join("\n");
  assert.match(adminPanel, /x-admin-password/);
  assert.match(adminFunctions, /SUPABASE_SERVICE_ROLE_KEY/);
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
    assert.match(appSource, /renderFilaGoleadorTabla\(goleador, esLider = false, indice = 0\)/);
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
    "sql/corregir-permisos-authenticated-goleadores.sql",
    "sql/verificar-permisos-anon-goleadores.sql"
  ].map(read).join("\n");
  const combined = `${docs}\n${sql}`;

  [
    /RLS activo en ambas tablas/,
    /GRANT directos? realizados? por `postgres`/,
    /anon=arwdDxtm\/postgres/,
    /authenticated=arwdDxtm\/postgres/,
    /TRUNCATE, REFERENCES, TRIGGER y MAINTAIN/,
    /no debe confiarse en RLS[\s\S]*privilegios/,
    /REVOKE ALL PRIVILEGES/,
    /GRANT SELECT/,
    /conserve solo SELECT/,
    /se aplico en produccion el 2026-08-01/,
    /28\/28 controles OK/,
    /anon` quedo solo con SELECT/,
    /authenticated` no fue modificado/,
    /RLS no fue modificado/,
    /politicas no fueron modificadas/,
    /no se modificaron filas/,
    /no se modificaron datos deportivos/,
    /archivo temporal autorizado fue eliminado/,
    /no encontro uso de Supabase Auth/,
    /correccion protegida e independiente/,
    /requiere unicamente SELECT/
  ].forEach(pattern => assert.match(docs, pattern));
  assert.doesNotMatch(
    combined,
    /eyJ[A-Za-z0-9_-]{20,}|postgres(?:ql)?:\/\/|sk-[A-Za-z0-9]|JWT_SECRET|DATABASE_URL|PASSWORD\s*=/i
  );
}

function runTests() {
  const results = [];
  assertAuditSql();
  results.push("auditoria SQL READ ONLY y ACL directa: ok");
  assertAnonCorrectionSql();
  results.push("correccion anon usa REVOKE ALL y conserva solo SELECT: ok");
  assertNoAuthorizedAnonSql();
  results.push("SQL temporal autorizado de anon eliminado: ok");
  assertAuthenticatedCorrectionSql();
  results.push("correccion authenticated protegida e independiente: ok");
  assertVerificationSql();
  results.push("verificacion SQL READ ONLY contempla todos los privilegios: ok");
  assertPublicScorersFunctionIsReadOnly();
  results.push("funcion publica de goleadores solo requiere lectura: ok");
  assertSupabaseAuthAudit();
  results.push("auditoria de Supabase Auth y escrituras directas: ok");
  assertScorersCompatibility();
  results.push("compatibilidad de goleadores, filtros y lideres: ok");
  assertDocsAndNoSecrets();
  results.push("documentacion y ausencia de secretos reales: ok");
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
