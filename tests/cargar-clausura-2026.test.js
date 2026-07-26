"use strict";

const assert = require("assert").strict;
const fs = require("fs");
const path = require("path");

const cargar = require("../scripts/cargar-clausura-2026");
const preparar = require("../scripts/preparar-clausura-2026");

const ROOT = path.resolve(__dirname, "..");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function assertThrowsMessage(run, pattern) {
  assert.throws(run, error => {
    assert.match(error.message, pattern);
    return true;
  });
}

const PARTIDOS_COMPARISON_TYPES = {
  arbitro: "text",
  dia: "text",
  estado: "text",
  estadio: "text",
  fase: "text",
  fecha: "integer",
  fecha_partido: "date",
  goles_local: "integer",
  goles_visitante: "integer",
  hora: "text",
  local: "text",
  local_id: "bigint",
  numero_playoff: "integer",
  penales_local: "integer",
  penales_visitante: "integer",
  source_local: "text",
  source_visitante: "text",
  tipo: "text",
  torneo_id: "bigint",
  visitante: "text",
  visitante_id: "bigint",
  zona: "text"
};

function extractFixtureRecordsetDeclarations(sql) {
  const declarations = [];
  const recordsetPattern =
    /jsonb_to_recordset\([^)]+\)\s+as\s+\w+\s*\(([\s\S]*?)\n\s*\)/g;
  let match = null;

  while ((match = recordsetPattern.exec(sql)) !== null) {
    const fields = {};
    match[1].split("\n").forEach(rawLine => {
      const line = rawLine.trim().replace(/,$/, "");
      if (!line) return;
      const fieldMatch = line.match(/^([a-z_]+)\s+([a-z ]+)$/);
      if (!fieldMatch) return;
      fields[fieldMatch[1]] = fieldMatch[2].trim();
    });
    if (fields.source_fixture_key) declarations.push(fields);
  }

  return declarations;
}

function extractPartidosFixtureEqualityFields(sql) {
  const fields = new Set();
  const comparisonPattern =
    /\b(?:partido\.([a-z_]+)\s*(?:=|is\s+not\s+distinct\s+from)\s*fixture\.([a-z_]+)|fixture\.([a-z_]+)\s*(?:=|is\s+not\s+distinct\s+from)\s*partido\.([a-z_]+))/gi;
  let match = null;

  while ((match = comparisonPattern.exec(sql)) !== null) {
    const left = match[1] || match[4];
    const right = match[2] || match[3];
    if (left === right && PARTIDOS_COMPARISON_TYPES[left]) {
      fields.add(left);
    }
  }

  return fields;
}

function assertFixtureComparisonTypes(sql) {
  const declarations = extractFixtureRecordsetDeclarations(sql);
  const comparedFields = extractPartidosFixtureEqualityFields(sql);

  assert.equal(declarations.length > 0, true);
  assert.equal(comparedFields.has("zona"), true);

  declarations.forEach(fields => {
    comparedFields.forEach(field => {
      assert.equal(
        fields[field],
        PARTIDOS_COMPARISON_TYPES[field],
        `${field} debe declararse ${PARTIDOS_COMPARISON_TYPES[field]}`
      );
    });
  });
}

function assertNoSqlWriteStatements(sql) {
  assert.equal(/^\s*(insert|update|delete|upsert|merge)\b/im.test(sql), false);
}

function assertSqlFileFixtureTypes(relativePath, options = {}) {
  const sql = fs.readFileSync(path.join(ROOT, relativePath), "utf8");
  const declarations = extractFixtureRecordsetDeclarations(sql);
  const comparedFields = extractPartidosFixtureEqualityFields(sql);

  if (options.fixtureRecordsets === 0) {
    assert.equal(declarations.length, 0, `${relativePath} no debe declarar fixture`);
    return sql;
  }

  assert.equal(declarations.length > 0, true, `${relativePath} debe declarar fixture`);
  assert.equal(comparedFields.has("zona"), true, `${relativePath} debe comparar zona`);
  declarations.forEach(fields => {
    Object.entries(PARTIDOS_COMPARISON_TYPES).forEach(([field, expectedType]) => {
      if (!fields[field]) return;
      assert.equal(
        fields[field],
        expectedType,
        `${relativePath}: ${field} debe declararse ${expectedType}`
      );
    });
  });

  return sql;
}

function makeRemote(context, overrides = {}) {
  const mapped = context.local.mappings.map(mapping => ({
    id: mapping.club_id,
    nombre_oficial: mapping.nombre_en_proyecto,
    nombre_corto: mapping.nombre_en_proyecto,
    aliases: [],
    activo: true,
    zona: mapping.zona,
    actualizado_en: "2026-07-25T00:00:00.000Z"
  }));

  const apertura = Array.from({ length: 140 }, (_, index) => ({
    id: index + 1,
    torneo_id: 1,
    tipo: index < 126 ? "regular" : "playoff",
    fase: index < 126 ? null : "test",
    fecha: index < 126 ? Math.floor(index / 9) + 1 : null,
    zona: index < 126 ? (index % 3) + 1 : null,
    local_id: 43,
    visitante_id: 44,
    local: "Sportivo A. Club",
    visitante: "C.A. Defensores",
    source_local: null,
    source_visitante: null,
    actualizado_en: "2026-07-25T00:00:00.000Z"
  }));

  return {
    method: "GET",
    torneos: [
      {
        id: 1,
        anio: 2026,
        tipo: "apertura",
        nombre: "Apertura 2026",
        activo: true
      },
      {
        id: 2,
        anio: 2026,
        tipo: "clausura",
        nombre: "Clausura 2026",
        activo: false
      }
    ],
    clubes: mapped.concat({
      id: 57,
      nombre_oficial: "C.A. Carcarana",
      nombre_corto: "Carcarana",
      aliases: [],
      activo: true,
      zona: 1
    }),
    clausuraPartidos: [],
    aperturaPartidos: apertura,
    clausuraInscripciones: [],
    ...overrides
  };
}

async function runTests() {
  const results = [];
  const context = cargar.buildContext();
  const records = context.records;

  assert.equal(records.length, 114);
  assert.deepEqual(context.local.counts.matchesByZone, { 1: 42, 2: 30, 3: 42 });
  assert.equal(new Set(records.map(preparar.logicalKey)).size, 114);
  assert.equal(records.every(record => record.torneo_id === 2), true);
  assert.equal(records.every(record => record.tipo === "regular"), true);
  assert.equal(records.every(record => record.fase === null), true);
  assert.equal(records.every(record => record.estado === "programado"), true);
  assert.equal(records.every(record => record.goles_local === null), true);
  assert.equal(records.every(record => record.goles_visitante === null), true);
  assert.equal(records.every(record => record.penales_local === null), true);
  assert.equal(records.every(record => record.penales_visitante === null), true);
  assert.equal(records.every(record => record.source_local === null), true);
  assert.equal(records.every(record => record.source_visitante === null), true);
  assert.equal(
    records.some(record => record.local_id === 57 || record.visitante_id === 57),
    false
  );
  results.push("construccion 114 registros: ok");

  assertThrowsMessage(() => cargar.requireAuthorizationPhrase(), /Autorizacion exacta/);
  assertThrowsMessage(
    () => cargar.requireAuthorizationPhrase("AUTORIZO"),
    /Autorizacion exacta/
  );
  assert.equal(
    cargar.requireAuthorizationPhrase("AUTORIZO CARGA CLAUSURA 2026"),
    true
  );
  results.push("bloqueo por frase de autorizacion: ok");

  ["--apply", "--apply=true", "--write-supabase", "--execute-sql", "--upsert"].forEach(flag => {
    assertThrowsMessage(() => cargar.parseArgs([flag]), /Flag inseguro bloqueado/);
  });
  results.push("rechazo de flags inseguros: ok");

  const identical = clone(records[0]);
  identical.id = 9001;
  const existingAnalysis = cargar.analyzePreload(records, [identical]);
  assert.equal(existingAnalysis.existingCount, 1);
  assert.equal(existingAnalysis.identical, 1);
  assert.equal(existingAnalysis.blocking.length > 0, true);
  results.push("deteccion de partido existente parcial: ok");

  const conflict = clone(records[0]);
  conflict.id = 9002;
  conflict.estado = "finalizado";
  const conflictAnalysis = cargar.analyzePreload(records, [conflict]);
  assert.equal(conflictAnalysis.conflicts, 1);
  assert.equal(conflictAnalysis.blocking.length > 0, true);
  results.push("deteccion de conflicto existente: ok");

  const duplicateRecords = clone(records);
  duplicateRecords.push(clone(records[0]));
  const duplicateRollback = cargar.simulateTransactionalLoad({
    records: duplicateRecords,
    existingRows: [],
    aperturaCount: 140,
    clubZones: context.local.mappings.map(mapping => ({
      id: mapping.club_id,
      zona: mapping.zona
    }))
  });
  assert.equal(duplicateRollback.committed, false);
  assert.equal(duplicateRollback.rolledBack, true);
  assert.match(duplicateRollback.error, /Total Clausura|duplicados/);
  results.push("deteccion de duplicados: ok");

  const badMap = clone(context.mapData);
  badMap.clubes[0].club_id = records[0].visitante_id;
  const badMapResult = preparar.validateFixture(context.fixture, badMap, {
    torneoId: 2
  });
  assert.equal(badMapResult.errors.length > 0, true);
  results.push("deteccion de conflicto de club: ok");

  const wrongTournament = makeRemote(context, {
    torneos: [
      {
        id: 1,
        anio: 2026,
        tipo: "apertura",
        nombre: "Apertura 2026",
        activo: true
      },
      {
        id: 2,
        anio: 2026,
        tipo: "apertura",
        nombre: "Apertura 2026",
        activo: false
      }
    ]
  });
  const wrongTournamentValidation = cargar.validateRemoteSnapshot(
    wrongTournament,
    context
  );
  assert.equal(wrongTournamentValidation.ok, false);
  assert.equal(
    wrongTournamentValidation.errors.some(message =>
      message.indexOf("tipo clausura") >= 0
    ),
    true
  );
  results.push("deteccion de torneo incorrecto: ok");

  const rollback = cargar.simulateTransactionalLoad({
    records,
    existingRows: [],
    failAfterInsert: true,
    aperturaCount: 140,
    clubZones: context.local.mappings.map(mapping => ({
      id: mapping.club_id,
      zona: mapping.zona
    }))
  });
  assert.equal(rollback.committed, false);
  assert.equal(rollback.rolledBack, true);
  assert.equal(rollback.state.clausuraPartidos.length, 0);
  results.push("rollback simulado: ok");

  const success = cargar.simulateTransactionalLoad({
    records,
    existingRows: [],
    aperturaCount: 140,
    clubZones: context.local.mappings.map(mapping => ({
      id: mapping.club_id,
      zona: mapping.zona
    }))
  });
  assert.equal(success.committed, true);
  assert.equal(success.inserted, 114);
  assert.equal(success.state.aperturaCount, 140);
  assert.deepEqual(success.state.clubZonesAfter, success.state.clubZonesBefore);
  results.push("Apertura y clubes.zona sin modificaciones: ok");

  const remoteValidation = cargar.validateRemoteSnapshot(makeRemote(context), context);
  assert.equal(remoteValidation.ok, true);
  assert.equal(remoteValidation.preload.newRecords, 114);
  assert.equal(remoteValidation.aperturaSummary.total, 140);
  assert.equal(remoteValidation.aperturaSummary.regularWithSource, 0);
  results.push("precondiciones remotas simuladas: ok");

  const sql = cargar.buildLoadSql(context);
  assert.equal(sql.includes("PENDIENTE_AUTORIZACION"), true);
  assert.equal(sql.includes("insert into public.partidos"), true);
  assert.equal(sql.includes("update public.clubes"), false);
  assert.equal(sql.includes("update public.torneos"), false);
  assert.equal(sql.includes("insert into public.inscripciones_jugadores"), false);
  assert.equal(/\bzona\s*=\s*[123]\b/.test(sql), false);
  assertFixtureComparisonTypes(sql);
  results.push("SQL protegido y acotado: ok");

  const prevalidationSql = cargar.buildPrevalidationSql(context);
  assert.equal(prevalidationSql.includes("AUTORIZO CARGA CLAUSURA 2026"), false);
  assert.equal(prevalidationSql.includes("PENDIENTE_AUTORIZACION"), false);
  assert.equal(/^\s*do\s+\$\$/im.test(prevalidationSql), false);
  assert.equal(/^\s*with\s+/im.test(prevalidationSql), true);
  assert.equal(prevalidationSql.includes("fixture_total"), true);
  assert.equal(prevalidationSql.includes("existentes_clausura"), true);
  assert.equal(prevalidationSql.includes("conflictos"), true);
  assert.equal(prevalidationSql.includes("zonas_validas"), true);
  assert.equal(prevalidationSql.includes("tipos_validos"), true);
  assert.equal(prevalidationSql.includes("resultado_final"), true);
  assert.equal(prevalidationSql.includes("jsonb_to_recordset(fixture_json.data)"), true);
  assert.equal(prevalidationSql.includes("jsonb_to_recordset(v_fixture)"), false);
  assertNoSqlWriteStatements(prevalidationSql);
  assertFixtureComparisonTypes(prevalidationSql);
  assert.equal(prevalidationSql.includes("pg_typeof(partido.zona)"), true);
  results.push("prevalidacion SQL read-only y tipos: ok");

  const postVerificationSql = cargar.buildPostVerificationSql();
  assertNoSqlWriteStatements(postVerificationSql);
  assert.equal(/\bzona\s*=\s*[123]\b/.test(postVerificationSql), false);
  results.push("verificacion posterior read-only y zona text: ok");

  const versionedLoadSql = assertSqlFileFixtureTypes("sql/cargar-clausura-2026.sql");
  const versionedPrevalidationSql = assertSqlFileFixtureTypes(
    "sql/prevalidar-clausura-2026-carga.sql"
  );
  const versionedPostSql = assertSqlFileFixtureTypes(
    "sql/verificar-clausura-2026-post-carga.sql",
    { fixtureRecordsets: 0 }
  );
  assert.equal(versionedLoadSql.includes("PENDIENTE_AUTORIZACION"), true);
  assert.equal(versionedPrevalidationSql.includes("jsonb_to_recordset(fixture_json.data)"), true);
  assert.equal(versionedPrevalidationSql.includes("jsonb_to_recordset(v_fixture)"), false);
  assertNoSqlWriteStatements(versionedPrevalidationSql);
  assertNoSqlWriteStatements(versionedPostSql);
  results.push("SQL versionados con tipos de fixture compatibles: ok");

  return results;
}

if (require.main === module) {
  runTests()
    .then(results => {
      results.forEach(result => console.log(result));
    })
    .catch(error => {
      console.error(error);
      process.exitCode = 1;
    });
}

module.exports = { runTests };
