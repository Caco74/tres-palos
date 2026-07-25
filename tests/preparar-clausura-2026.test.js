"use strict";

const assert = require("assert").strict;
const path = require("path");

const preparar = require("../scripts/preparar-clausura-2026");

const ROOT = path.resolve(__dirname, "..");
const FIXTURE_PATH = preparar.findFixtureJson();
const MAP_PATH = path.join(ROOT, "data", "clausura-2026", "clubes-map.json");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadFixture() {
  return preparar.readJson(FIXTURE_PATH);
}

function loadMap() {
  return preparar.readJson(MAP_PATH);
}

function runValidation(fixture, mapData) {
  return preparar.validateFixture(fixture, mapData, { torneoId: 2 });
}

function assertNoValidationErrors(result) {
  assert.deepEqual(result.errors, []);
}

async function runTests() {
  const fixture = loadFixture();
  const mapData = loadMap();
  const result = runValidation(fixture, mapData);

  assertNoValidationErrors(result);

  assert.equal(result.counts.sourceTeamsTotal, 20);
  assert.equal(result.counts.matchesTotal, 114);
  assert.deepEqual(result.counts.matchesByZone, { 1: 42, 2: 30, 3: 42 });
  assert.deepEqual(result.counts.matchesByDate, {
    1: 9,
    2: 9,
    3: 9,
    4: 9,
    5: 9,
    6: 6,
    7: 6,
    8: 9,
    9: 9,
    10: 9,
    11: 9,
    12: 9,
    13: 6,
    14: 6
  });
  assert.deepEqual(result.counts.zone2Dates, [1, 2, 3, 4, 5, 8, 9, 10, 11, 12]);
  assert.equal(result.counts.byesTotal, 28);
  assert.deepEqual(result.counts.byesByZone, { 1: 14, 3: 14 });

  const names = JSON.stringify(fixture);
  assert.equal(preparar.normalizeClubName(names).includes("carcarana"), false);
  assert.equal(result.records.length, 114);
  assert.equal(result.records.every(record => record.estado === "programado"), true);
  assert.equal(result.records.every(record => record.goles_local === null), true);
  assert.equal(result.records.every(record => record.goles_visitante === null), true);
  assert.equal(result.records.every(record => record.penales_local === null), true);
  assert.equal(result.records.every(record => record.penales_visitante === null), true);
  assert.equal(result.records.every(record => record.fecha_partido === null), true);
  assert.equal(result.records.every(record => record.dia === null), true);
  assert.equal(result.records.every(record => record.hora === null), true);
  assert.equal(result.records.every(record => record.estadio === null), true);
  assert.equal(result.records.every(record => record.arbitro === null), true);
  assert.equal(result.records.every(record => record.fase === null), true);
  assert.equal(result.records.every(record => record.numero_playoff === null), true);

  const keys = result.records.map(preparar.logicalKey);
  assert.equal(new Set(keys).size, 114);
  assert.deepEqual(keys, runValidation(fixture, mapData).records.map(preparar.logicalKey));

  const noExisting = preparar.analyzeExisting(result.records, []);
  assert.equal(noExisting.newRecords.length, 114);
  assert.equal(noExisting.identical.length, 0);
  assert.equal(noExisting.conflicts.length, 0);

  const existingIdentical = clone(result.records[0]);
  existingIdentical.id = 999;
  const withIdentical = preparar.analyzeExisting(result.records, [existingIdentical]);
  assert.equal(withIdentical.newRecords.length, 113);
  assert.equal(withIdentical.identical.length, 1);
  assert.equal(withIdentical.conflicts.length, 0);

  const existingConflict = clone(result.records[0]);
  existingConflict.id = 1000;
  existingConflict.estado = "finalizado";
  const withConflict = preparar.analyzeExisting(result.records, [existingConflict]);
  assert.equal(withConflict.conflicts.length, 1);
  assert.equal(withConflict.conflicts[0].differences[0].field, "estado");

  const duplicateFixture = clone(fixture);
  duplicateFixture.matches.push({
    ...duplicateFixture.matches[0],
    fixture_key: "C2026-DUPLICADO-TEST"
  });
  const duplicateResult = runValidation(duplicateFixture, mapData);
  assert.equal(
    duplicateResult.errors.some(error =>
      error.message.indexOf("Partido duplicado en fuente") >= 0
    ),
    true
  );

  const ambiguousMap = clone(mapData);
  ambiguousMap.clubes.push({
    ...ambiguousMap.clubes[0],
    club_id: 999,
    nombre_en_proyecto: "Club ambiguo de prueba"
  });
  const ambiguousResult = runValidation(fixture, ambiguousMap);
  assert.equal(
    ambiguousResult.errors.some(error =>
      error.message.indexOf("Mapeo ambiguo") >= 0
    ),
    true
  );

  assert.throws(
    () => preparar.parseArgs(["--apply"]),
    /Modo de escritura deshabilitado/
  );
  assert.deepEqual(preparar.REMOTE_HTTP_METHODS, ["GET"]);

  const dryRun = await preparar.run({
    dryRun: true,
    remoteRead: false,
    writeReport: false,
    fixturePath: FIXTURE_PATH,
    mapPath: MAP_PATH,
    reportPath: path.join(ROOT, "reports", "test-no-write.md"),
    torneoId: 2
  });
  assert.equal(dryRun.summary.writes, 0);
  assert.equal(dryRun.summary.reportPath, null);

  return [
    "json sintaxis: ok",
    "fixture schema: ok",
    "conteos por zona/fecha/equipo/localia: ok",
    "ida y vuelta: ok",
    "fechas libres: ok",
    "Carcarana ausente: ok",
    "resultados iniciales nulos: ok",
    "idempotencia: ok",
    "duplicados detectados: ok",
    "alias ambiguos detectados: ok",
    "dry-run sin escrituras: ok"
  ];
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
