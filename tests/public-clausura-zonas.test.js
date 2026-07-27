"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const PublicTournament = require("../js/public-tournament");
const cargar = require("../scripts/cargar-clausura-2026");
const preparar = require("../scripts/preparar-clausura-2026");

const ROOT = path.resolve(__dirname, "..");
const TORNEO_CLAUSURA = 2;
const TORNEO_APERTURA = 1;
const CARCARANA_ID = 57;

function normalize(value) {
  return preparar.normalizeClubName(value);
}

function loadClausuraRecords() {
  return cargar.buildContext().records.map((record, index) => ({
    ...record,
    id: 1000 + index
  }));
}

function makeAperturaHistory() {
  return Array.from({ length: 140 }, (_, index) => ({
    id: 1 + index,
    torneo_id: TORNEO_APERTURA,
    tipo: index < 126 ? "regular" : "playoff",
    fase: index < 126 ? null : "octavos",
    fecha: index < 126 ? Math.floor(index / 9) + 1 : null,
    zona: index < 126 ? 1 : null,
    local_id: CARCARANA_ID,
    visitante_id: 43,
    local: "C.A. Carcarana",
    visitante: "Sportivo A. Club",
    estado: "finalizado",
    goles_local: index < 126 ? 1 : null,
    goles_visitante: index < 126 ? 1 : null,
    penales_local: null,
    penales_visitante: null
  }));
}

function participantsByZone(derived, zone) {
  return PublicTournament.getTeamsByZone(derived, zone).map(normalize);
}

function assertIncludesTeam(teams, expected) {
  assert.equal(
    teams.some(team => team.includes(normalize(expected))),
    true,
    `${expected} debe estar presente`
  );
}

function applySixLoadedResults(records) {
  const results = {
    "C2026-F01-Z1-01": [2, 1],
    "C2026-F01-Z1-02": [0, 0],
    "C2026-F01-Z1-03": [1, 3],
    "C2026-F01-Z3-01": [1, 0],
    "C2026-F01-Z3-02": [2, 2],
    "C2026-F01-Z3-03": [0, 1]
  };

  return records.map(record => {
    const score = results[record.source_fixture_key];
    if (!score) return record;
    return {
      ...record,
      estado: "finalizado",
      goles_local: score[0],
      goles_visitante: score[1]
    };
  });
}

function rowByName(table, expected) {
  const expectedName = normalize(expected);
  const row = table.find(item => normalize(item.equipo).includes(expectedName));
  assert.ok(row, `${expected} debe estar en la tabla`);
  return row;
}

function extractFunction(source, name) {
  const match = new RegExp(`function\\s+${name}\\s*\\(`).exec(source);
  assert.ok(match, `No se encontro ${name}`);
  const start = match.index;

  let depth = 0;
  let end = start;
  let opened = false;
  for (; end < source.length; end += 1) {
    if (source[end] === "{") {
      depth += 1;
      opened = true;
    }
    if (source[end] === "}") {
      depth -= 1;
      if (opened && depth === 0) {
        end += 1;
        break;
      }
    }
  }

  return source.slice(start, end);
}

function runTests() {
  const results = [];
  const torneos = [
    { id: TORNEO_APERTURA, nombre: "Apertura 2026", activo: true },
    { id: TORNEO_CLAUSURA, nombre: "Clausura 2026", activo: false }
  ];
  const clausura = loadClausuraRecords();
  const derived = PublicTournament.deriveRegularParticipants(clausura, {
    torneoId: TORNEO_CLAUSURA
  });

  assert.equal(
    PublicTournament.isNetlifyPreviewHost(
      "deploy-preview-42--tres-palos.netlify.app"
    ),
    true
  );
  assert.equal(
    PublicTournament.isNetlifyPreviewHost("w-6--tres-palos.netlify.app"),
    true
  );
  assert.equal(
    PublicTournament.resolvePreviewTournament(
      torneos,
      "?preview_torneo=2",
      "deploy-preview-42--tres-palos.netlify.app"
    )?.nombre,
    "Clausura 2026"
  );
  assert.equal(
    PublicTournament.resolvePreviewTournament(
      torneos,
      "",
      "deploy-preview-42--tres-palos.netlify.app"
    ),
    null
  );
  assert.equal(
    PublicTournament.resolvePreviewTournament(
      torneos,
      "?preview_torneo=2",
      "trespalos.com.ar"
    ),
    null
  );
  assert.equal(
    PublicTournament.resolvePreviewTournament(
      torneos,
      "?preview_torneo=2",
      "www.trespalos.com.ar"
    ),
    null
  );
  assert.equal(
    PublicTournament.resolvePreviewTournament(
      torneos,
      "?preview_torneo=2",
      "tres-palos.netlify.app"
    ),
    null
  );
  assert.equal(
    PublicTournament.resolvePreviewTournament(
      torneos,
      "?preview_torneo=999",
      "deploy-preview-42--tres-palos.netlify.app"
    ),
    null
  );
  results.push("override preview_torneo limitado a previews Netlify: ok");

  assert.equal(derived.participants.length, 20);
  assert.equal(PublicTournament.buildTeamList(derived).length, 20);
  assert.equal(new Set(PublicTournament.buildTeamList(derived).map(item => item.key)).size, 20);
  results.push("Clausura deriva 20 clubes unicos y 20 tarjetas: ok");

  assert.equal(PublicTournament.getTeamsByZone(derived, 1).length, 7);
  assert.equal(PublicTournament.getTeamsByZone(derived, 2).length, 6);
  assert.equal(PublicTournament.getTeamsByZone(derived, 3).length, 7);
  assert.deepEqual(PublicTournament.getZones(derived), [1, 2, 3]);
  results.push("zonas Clausura 7/6/7 desde partidos regulares: ok");

  const allParticipantsText = derived.participants.map(item => normalize(item.equipo)).join(" ");
  assert.equal(allParticipantsText.includes("carcarana"), false);
  assert.equal(
    derived.participants.some(item => Number(item.club_id) === CARCARANA_ID),
    false
  );
  assert.equal(derived.conflicts.length, 0);
  results.push("Carcarana ausente y ningun club en dos zonas Clausura: ok");

  const fecha1Zona1 = clausura.filter(
    match => match.fecha === 1 && Number(match.zona) === 1
  );
  const fecha1Zona2 = clausura.filter(
    match => match.fecha === 1 && Number(match.zona) === 2
  );
  const fecha1Zona3 = clausura.filter(
    match => match.fecha === 1 && Number(match.zona) === 3
  );
  const libreZona1 = PublicTournament.getFreeParticipants(derived, fecha1Zona1, 1, {
    torneoId: TORNEO_CLAUSURA
  });
  const libreZona2 = PublicTournament.getFreeParticipants(derived, fecha1Zona2, 2, {
    torneoId: TORNEO_CLAUSURA
  });
  const libreZona3 = PublicTournament.getFreeParticipants(derived, fecha1Zona3, 3, {
    torneoId: TORNEO_CLAUSURA
  });
  assert.deepEqual(libreZona1.teams.map(normalize), ["argentino a club"]);
  assert.deepEqual(libreZona2.teams, []);
  assert.deepEqual(libreZona3.teams.map(normalize), ["c a williams kemmis"]);
  results.push("Fecha 1 libres Argentino / ninguno / Kemmis: ok");

  const withResults = applySixLoadedResults(clausura);
  const derivedWithResults = PublicTournament.deriveRegularParticipants(withResults, {
    torneoId: TORNEO_CLAUSURA
  });
  const table1 = PublicTournament.buildZoneTable(withResults, 1, {
    torneoId: TORNEO_CLAUSURA,
    derived: derivedWithResults
  });
  const table2 = PublicTournament.buildZoneTable(withResults, 2, {
    torneoId: TORNEO_CLAUSURA,
    derived: derivedWithResults
  });
  const table3 = PublicTournament.buildZoneTable(withResults, 3, {
    torneoId: TORNEO_CLAUSURA,
    derived: derivedWithResults
  });
  assert.equal(table1.length, 7);
  assert.equal(table2.length, 6);
  assert.equal(table3.length, 7);
  assert.equal(
    PublicTournament.buildGeneralTable(withResults, {
      torneoId: TORNEO_CLAUSURA,
      derived: derivedWithResults
    }).length,
    20
  );
  assert.equal(table2.every(row => row.pj === 0 && row.pts === 0), true);
  results.push("tablas devuelven filas 7/6/7 y Zona 2 queda 0 PJ: ok");

  assert.deepEqual(
    {
      cosmo: rowByName(table1, "C.A. Cosmopolita").pts,
      adeo: rowByName(table1, "AD Everton/Olimpia").pj,
      sport: rowByName(table1, "Sport C.").pe,
      correa: rowByName(table1, "C.A. Correa").pts,
      argentino: rowByName(table1, "Argentino").pj
    },
    {
      cosmo: 3,
      adeo: 1,
      sport: 1,
      correa: 3,
      argentino: 0
    }
  );
  assert.deepEqual(
    {
      almafuerte: rowByName(table3, "C.A. Almafuerte").pts,
      defensores: rowByName(table3, "C.A. Defensores").pe,
      barraca: rowByName(table3, "C.A. Barraca").pts,
      kemmis: rowByName(table3, "Williams Kemmis").pj
    },
    {
      almafuerte: 3,
      defensores: 1,
      barraca: 3,
      kemmis: 0
    }
  );
  results.push("seis resultados cargados impactan Zonas 1 y 3: ok");

  const apertura = makeAperturaHistory();
  const mixed = clausura.concat(apertura);
  const mixedClausura = PublicTournament.deriveRegularParticipants(mixed, {
    torneoId: TORNEO_CLAUSURA
  });
  const mixedApertura = PublicTournament.deriveRegularParticipants(mixed, {
    torneoId: TORNEO_APERTURA
  });
  assert.equal(apertura.length, 140);
  assert.equal(mixedClausura.participants.length, 20);
  assert.equal(participantsByZone(mixedClausura, 1).length, 7);
  assertIncludesTeam(mixedApertura.participants.map(item => normalize(item.equipo)), "carcarana");
  results.push("Apertura historico no contamina Clausura y conserva Carcarana: ok");

  const appSource = fs.readFileSync(path.join(ROOT, "js", "app.js"), "utf8");
  const utilsSource = fs.readFileSync(path.join(ROOT, "js", "utils.js"), "utf8");
  const indexSource = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert.match(indexSource, /\/js\/public-tournament\.js\?v=2/);
  assert.match(indexSource, /id="previewTournamentNotice"/);
  assert.match(indexSource, /id="teamsCountLabel"/);
  assert.doesNotMatch(indexSource, />21 clubes</);
  assert.doesNotMatch(indexSource, /preview_torneo[\s\S]{0,160}<select/i);
  assert.match(appSource, /previewTorneoIdSolicitado[\s\S]{0,120}getPreviewTournamentId/);
  assert.match(extractFunction(appSource, "agregarParametroPreviewTorneo"), /preview_torneo/);
  assert.match(
    extractFunction(appSource, "agregarParametroPreviewTorneo"),
    /state\.torneoPreview\?\.id \|\| previewTorneoIdSolicitado/
  );
  assert.match(extractFunction(appSource, "obtenerTorneoPreview"), /isNetlifyPreviewHost/);
  assert.match(extractFunction(appSource, "obtenerTorneoSeleccionado"), /obtenerTorneoPreview/);
  assert.match(extractFunction(appSource, "actualizarAvisoPreviewTorneo"), /Vista de prueba:/);
  assert.match(extractFunction(appSource, "obtenerEquiposZonaTorneo"), /getTeamsByZone/);
  assert.match(extractFunction(appSource, "obtenerEquipoLibre"), /getFreeParticipants/);
  assert.match(extractFunction(appSource, "calcularTablaZona"), /buildZoneTable/);
  assert.match(extractFunction(appSource, "renderTeams"), /buildTeamList/);
  assert.match(extractFunction(appSource, "aplicarDatosTorneo"), /filtrarPartidosPorTorneo/);
  assert.match(extractFunction(appSource, "obtenerPartidos"), /torneo_id=eq\.\$\{encodeURIComponent/);
  assert.doesNotMatch(extractFunction(utilsSource, "aplicarClubes"), /\.zona\b/);
  assert.doesNotMatch(
    fs.readFileSync(path.join(ROOT, "js", "public-tournament.js"), "utf8"),
    /\b(fetch|insert|update|delete|upsert|rpc)\b/i
  );
  results.push("vistas publicas usan helper por torneo y no escriben datos: ok");

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
