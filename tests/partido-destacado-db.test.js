"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");

function runTests() {
  const results = [];
  const sql = fs.readFileSync(
    path.join(ROOT, "supabase", "partidos-destacado-inicio.sql"),
    "utf8"
  );

  assert.match(
    sql,
    /alter table public\.partidos[\s\S]*add column if not exists destacado_inicio boolean not null default false/
  );
  assert.match(
    sql,
    /add column if not exists destacado_titulo text/
  );
  assert.match(
    sql,
    /create unique index if not exists partidos_destacado_inicio_torneo_idx[\s\S]*on public\.partidos \(torneo_id\)[\s\S]*where destacado_inicio = true/
  );
  assert.doesNotMatch(
    sql,
    /\b(create policy|alter policy|drop policy|enable row level security|disable row level security|grant|revoke|service_role|authenticated|anon)\b/i
  );
  results.push("SQL destacado Inicio: columnas e indice unico parcial sin permisos/RLS: ok");

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
