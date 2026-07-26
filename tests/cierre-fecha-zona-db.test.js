"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function stripDollarQuotedBodies(sql) {
  return sql.replace(/\$[A-Za-z0-9_]*\$[\s\S]*?\$[A-Za-z0-9_]*\$/g, "$$BODY$$");
}

function assertReadOnlySql(relativePath) {
  const sql = read(relativePath);
  assert.doesNotMatch(sql, /\b(insert|update|delete|alter|create|drop|truncate|grant|revoke)\b/i);
  assert.doesNotMatch(sql, /\btp_cerrar_etapa\s*\(/i);
  assert.doesNotMatch(sql, /\btp_reabrir_etapa\s*\(/i);
  assert.doesNotMatch(sql, /\btp_restaurar_respaldo\s*\(/i);
}

function runTests() {
  const results = [];
  const cierre = read("supabase/cierre-etapas.sql");
  const aplicar = read("sql/aplicar-cierre-fecha-zona.sql");
  const aplicarSinCuerpos = stripDollarQuotedBodies(aplicar);

  assert.match(cierre, /create or replace function public\.tp_etapa_regular_fecha/);
  assert.match(cierre, /create or replace function public\.tp_etapa_regular_zona/);
  assert.match(cierre, /p_valor ~ '\^fecha:\[0-9\]\+:zona:/);
  assert.match(cierre, /p_valor ~ '\^\[0-9\]\+\$'/);
  assert.equal((cierre.match(/public\.tp_etapa_regular_fecha/g) || []).length >= 8, true);
  assert.equal((cierre.match(/public\.tp_etapa_regular_zona/g) || []).length >= 8, true);
  results.push("cierre-etapas acepta valores legacy y fecha/zona: ok");

  assert.match(cierre, /partido\.fase::text = p_valor/);
  assert.match(cierre, /partido\.fase::text = v_respaldo\.valor/);
  assert.match(cierre, /respaldo\.tipo = 'playoff'[\s\S]*partido\.fase::text = respaldo\.valor/);
  results.push("playoffs siguen por fase: ok");

  assertReadOnlySql("sql/prevalidar-cierre-fecha-zona.sql");
  assertReadOnlySql("sql/verificar-cierre-fecha-zona.sql");
  results.push("prevalidacion y verificacion son solo lectura: ok");

  assert.match(aplicar, /^(?:\s|--[^\n]*\n)*begin;/i);
  assert.match(aplicar, /commit;\s*$/i);
  assert.match(aplicar, /create or replace function public\.tp_guardar_respaldo_etapa/);
  assert.match(aplicar, /create or replace function public\.tp_cerrar_etapa/);
  assert.match(aplicar, /create or replace function public\.tp_restaurar_respaldo/);
  assert.doesNotMatch(aplicarSinCuerpos, /\bcreate\s+table\b/i);
  assert.doesNotMatch(aplicarSinCuerpos, /\balter\s+table\b/i);
  assert.doesNotMatch(aplicarSinCuerpos, /\binsert\s+into\b/i);
  assert.doesNotMatch(aplicarSinCuerpos, /\bupdate\b/i);
  assert.doesNotMatch(aplicarSinCuerpos, /\bdelete\s+from\b/i);
  assert.doesNotMatch(aplicarSinCuerpos, /\btruncate\b/i);
  assert.doesNotMatch(aplicarSinCuerpos, /\b(select|perform|call)\s+(public\.)?tp_cerrar_etapa\s*\(/i);
  assert.doesNotMatch(aplicarSinCuerpos, /\b(select|perform|call)\s+(public\.)?tp_reabrir_etapa\s*\(/i);
  assert.doesNotMatch(aplicarSinCuerpos, /\b(select|perform|call)\s+(public\.)?tp_restaurar_respaldo\s*\(/i);
  results.push("SQL protegido no tiene DDL/DML top-level ni ejecuta RPC: ok");

  const backupScript = read("scripts/respaldar-cierre-etapas.js");
  new vm.Script(backupScript, { filename: "scripts/respaldar-cierre-etapas.js" });
  assert.match(backupScript, /method: "GET"/);
  assert.doesNotMatch(backupScript, /method: "(POST|PATCH|PUT|DELETE)"/);
  assert.match(backupScript, /etapas_estado/);
  assert.match(backupScript, /respaldos_etapa/);
  results.push("script de respaldo previo usa solo GET y tablas de cierre: ok");

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

module.exports = { runTests };
