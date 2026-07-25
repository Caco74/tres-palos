"use strict";

const assert = require("assert").strict;

const cargar = require("../scripts/cargar-clausura-2026");
const preparar = require("../scripts/preparar-clausura-2026");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function assertThrowsMessage(run, pattern) {
  assert.throws(run, error => {
    assert.match(error.message, pattern);
    return true;
  });
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
  results.push("SQL protegido y acotado: ok");

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
