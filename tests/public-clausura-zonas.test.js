"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

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

function matchesByTeam(records, expected) {
  const expectedName = normalize(expected);

  return records.filter(record =>
    normalize(record.local).includes(expectedName) ||
    normalize(record.visitante).includes(expectedName)
  );
}

function freeDatesByTeam(records, derived, expected, zone) {
  const expectedName = normalize(expected);
  const byDate = new Map();

  records
    .filter(record =>
      record.tipo === "regular" &&
      Number(record.zona) === Number(zone)
    )
    .forEach(record => {
      const fecha = Number(record.fecha);
      if (!byDate.has(fecha)) byDate.set(fecha, []);
      byDate.get(fecha).push(record);
    });

  return [...byDate.entries()]
    .filter(([, matches]) =>
      PublicTournament.getFreeParticipants(derived, matches, zone, {
        torneoId: TORNEO_CLAUSURA
      }).teams.some(team => normalize(team).includes(expectedName))
    )
    .map(([fecha]) => fecha)
    .sort((a, b) => a - b);
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

function finishRegularDate(records, date) {
  return records.map((record, index) => {
    if (record.tipo !== "regular" || Number(record.fecha) !== Number(date)) {
      return record;
    }

    return {
      ...record,
      estado: "finalizado",
      goles_local: record.goles_local ?? index % 4,
      goles_visitante: record.goles_visitante ?? (index + 1) % 3
    };
  });
}

function finishAllRegular(records) {
  return records.map((record, index) => {
    if (record.tipo !== "regular") return record;

    return {
      ...record,
      estado: "finalizado",
      goles_local: record.goles_local ?? index % 4,
      goles_visitante: record.goles_visitante ?? (index + 2) % 3
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

function extractSmallTexts(html) {
  return [...html.matchAll(/<small\b[^>]*>([\s\S]*?)<\/small>/g)]
    .map(match => match[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function buildRenderMiniPartido(appSource) {
  const sandbox = {
    JSON,
    partidoResueltoParaVista: partido =>
      ["finalizado", "resuelto"].includes(partido.estado) ||
      (
        !partido.estado &&
        partido.goles_local !== null &&
        partido.goles_local !== undefined &&
        partido.goles_visitante !== null &&
        partido.goles_visitante !== undefined
      ),
    partidoTieneResultado: partido =>
      partido.goles_local !== null &&
      partido.goles_local !== undefined &&
      partido.goles_visitante !== null &&
      partido.goles_visitante !== undefined,
    obtenerEstadoTemporalPartido: partido => ({
      texto: partido.estadoTexto || "A confirmar"
    }),
    ESTADOS_DATO: {
      confirmar: "A confirmar"
    },
    formatearMomentoPartido: partido => partido.estadoTexto || "A confirmar",
    etiquetaFase: fase => ({
      octavos: "Octavos de Final",
      cuartos: "Cuartos de Final",
      semifinal: "Semifinales",
      final: "Final"
    }[fase] || "Playoffs"),
    formatearFechaCompleta: fecha => {
      if (!fecha) return "-";
      const [year, month, day] = fecha.split("-");
      return `${day}/${month}/${year.slice(-2)}`;
    },
    escaparHtml: value => String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;"),
    obtenerNombreLadoPartido: (partido, lado) => partido[lado]
  };

  vm.runInNewContext(
    `${extractFunction(appSource, "partidoFinalizadoRecorridoEquipo")}
     ${extractFunction(appSource, "renderMiniPartido")}
     this.renderMiniPartido = renderMiniPartido;`,
    sandbox
  );

  return sandbox.renderMiniPartido;
}

function buildRenderActividadLibre(appSource) {
  const sandbox = {
    escaparHtml: value => String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;"),
    nombre: value => value
  };

  vm.runInNewContext(
    `${extractFunction(appSource, "renderActividadLibre")}
     this.renderActividadLibre = renderActividadLibre;`,
    sandbox
  );

  return sandbox.renderActividadLibre;
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

  assert.equal(
    PublicTournament.getInitialRegularStageKey(clausura, {
      torneoId: TORNEO_CLAUSURA
    }),
    "fecha:1"
  );
  const fecha1Zonas13Cerradas = applySixLoadedResults(clausura);
  assert.equal(
    PublicTournament.getInitialRegularDate(fecha1Zonas13Cerradas, {
      torneoId: TORNEO_CLAUSURA
    }),
    1
  );
  const fecha1Completa = finishRegularDate(fecha1Zonas13Cerradas, 1);
  assert.equal(
    PublicTournament.getInitialRegularStageKey(fecha1Completa, {
      torneoId: TORNEO_CLAUSURA
    }),
    "fecha:2"
  );
  const otroTorneoPendiente = {
    ...clausura[0],
    id: 90001,
    torneo_id: TORNEO_APERTURA,
    estado: "programado",
    goles_local: null,
    goles_visitante: null
  };
  assert.equal(
    PublicTournament.getInitialRegularStageKey(
      fecha1Completa.concat(otroTorneoPendiente),
      { torneoId: TORNEO_CLAUSURA }
    ),
    "fecha:2"
  );
  results.push("fecha inicial Clausura respeta menor fecha pendiente del torneo visualizado: ok");

  const americaClausura = matchesByTeam(clausura, "C.A. América");
  assert.equal(americaClausura.length, 10);
  assert.equal(americaClausura.every(match => Number(match.zona) === 2), true);
  assert.deepEqual(
    americaClausura.map(match => match.fecha),
    [1, 2, 3, 4, 5, 8, 9, 10, 11, 12]
  );
  assert.deepEqual(freeDatesByTeam(clausura, derived, "C.A. América", 2), []);
  assert.equal(
    americaClausura.every(match => ![6, 7, 13, 14].includes(match.fecha)),
    true
  );
  assert.deepEqual(
    freeDatesByTeam(clausura, derived, "C.A. Almafuerte", 3),
    [2, 9]
  );
  const almafuerteClausura = matchesByTeam(clausura, "C.A. Almafuerte");
  assert.equal(almafuerteClausura[0].fecha, 1);
  assert.equal(almafuerteClausura.at(-1).fecha, 14);
  const sportivoClausura = matchesByTeam(clausura, "Sportivo A. Club");
  const adeoClausura = matchesByTeam(clausura, "AD Everton/Olimpia");
  assert.equal(sportivoClausura.length, 12);
  assert.equal(adeoClausura.length, 12);
  assert.equal(freeDatesByTeam(clausura, derived, "Sportivo A. Club", 1).length, 2);
  assert.equal(freeDatesByTeam(clausura, derived, "AD Everton/Olimpia", 1).length, 2);
  results.push("fichas Clausura: Sportivo/ADEO 12+2, America 10+0 y Almafuerte libres 2/9: ok");

  const calendarioMixtoInicio = [
    {
      id: 1,
      torneo_id: TORNEO_CLAUSURA,
      tipo: "regular",
      fecha: 1,
      fecha_partido: "2026-08-02",
      hora: "16:00",
      estado: "programado"
    },
    {
      id: 2,
      torneo_id: TORNEO_CLAUSURA,
      tipo: "regular",
      fecha: 2,
      fecha_partido: "2026-08-02",
      hora: "15:00",
      estado: "programado"
    },
    {
      id: 3,
      torneo_id: TORNEO_CLAUSURA,
      tipo: "regular",
      fecha: 1,
      fecha_partido: "2026-08-01",
      hora: "16:00",
      estado: "programado"
    },
    {
      id: 4,
      torneo_id: TORNEO_APERTURA,
      tipo: "regular",
      fecha: 1,
      fecha_partido: "2026-07-30",
      hora: "16:00",
      estado: "programado"
    }
  ];
  assert.deepEqual(
    PublicTournament.getUpcomingCalendarMatches(calendarioMixtoInicio, {
      torneoId: TORNEO_CLAUSURA,
      limit: 3
    }).map(match => match.fecha),
    [1, 2, 1]
  );
  results.push("Inicio puede mezclar jornadas por calendario real sin contaminar torneo: ok");

  const recorridoEquipo = [
    {
      id: 10,
      tipo: "regular",
      fecha: 1,
      estado: "finalizado",
      goles_local: 1,
      goles_visitante: 0,
      fecha_partido: "2026-08-01",
      hora: "16:00"
    },
    {
      id: 11,
      tipo: "regular",
      fecha: 2,
      estado: "programado",
      goles_local: null,
      goles_visitante: null,
      fecha_partido: "2026-08-10",
      hora: "16:00"
    },
    {
      id: 12,
      tipo: "regular",
      fecha: 3,
      estado: "programado",
      goles_local: null,
      goles_visitante: null,
      fecha_partido: "2026-08-10",
      hora: "15:00"
    },
    { id: "libre-1", tipoActividad: "libre", fecha: 4 }
  ];
  assert.equal(PublicTournament.isMatchResolved(recorridoEquipo[0]), true);
  assert.equal(PublicTournament.isMatchResolved(recorridoEquipo[1]), false);
  assert.equal(
    PublicTournament.getNextPendingMatch(recorridoEquipo, {
      regularOnly: false
    }).id,
    12
  );
  assert.equal(
    PublicTournament.getNextPendingMatch([
      {
        id: 20,
        tipo: "regular",
        fecha: 1,
        estado: "finalizado",
        goles_local: 0,
        goles_visitante: 0
      },
      {
        id: 21,
        tipo: "playoff",
        fase: "final",
        estado: "resuelto",
        goles_local: 1,
        goles_visitante: 1
      }
    ], { regularOnly: false }),
    null
  );
  assert.deepEqual(
    [...recorridoEquipo]
      .sort((a, b) => Number(a.fecha) - Number(b.fecha))
      .map(item => item.fecha),
    [1, 2, 3, 4]
  );
  results.push("recorrido equipo: orden, proximo interno unico y libre excluida: ok");

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
  assert.equal(
    PublicTournament.getInitialRegularStageKey(apertura, {
      torneoId: TORNEO_APERTURA
    }),
    "fecha:14"
  );
  assert.equal(
    PublicTournament.getInitialRegularStageKey(finishAllRegular(clausura), {
      torneoId: TORNEO_CLAUSURA
    }),
    "fecha:14"
  );
  results.push("Apertura historico no contamina Clausura y conserva Carcarana: ok");

  const appSource = fs.readFileSync(path.join(ROOT, "js", "app.js"), "utf8");
  const utilsSource = fs.readFileSync(path.join(ROOT, "js", "utils.js"), "utf8");
  const styleSource = fs.readFileSync(path.join(ROOT, "styles", "main.css"), "utf8");
  const indexSource = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert.match(indexSource, /\/styles\/main\.css\?v=65/);
  assert.match(indexSource, /\/js\/public-tournament\.js\?v=3/);
  assert.match(indexSource, /\/js\/app\.js\?v=75/);
  assert.match(indexSource, /aria-label="Tabla por zona o general"/);
  assert.match(indexSource, /id="previewTournamentNotice"/);
  assert.match(indexSource, /id="teamsCountLabel"/);
  assert.match(indexSource, /Clasificaci&oacute;n/);
  assert.doesNotMatch(indexSource, /Tabla de posiciones/);
  assert.doesNotMatch(indexSource, />21 clubes</);
  assert.doesNotMatch(indexSource, /preview_torneo[\s\S]{0,160}<select/i);

  const renderMiniPartidoPrueba = buildRenderMiniPartido(appSource);
  const regularFinalizado = renderMiniPartidoPrueba({
    id: 501,
    tipo: "regular",
    fecha: 3,
    estado: "finalizado",
    local: "Montes de Oca",
    visitante: "Sportivo A. Club",
    goles_local: 0,
    goles_visitante: 0,
    fecha_partido: "2026-06-06"
  }, "Sportivo A. Club");
  assert.match(regularFinalizado, /Fecha 3/);
  assert.doesNotMatch(regularFinalizado, /FINALIZADO/);
  assert.match(regularFinalizado, /<strong class="team-match-score">0 - 0<\/strong>/);
  assert.deepEqual(extractSmallTexts(regularFinalizado), ["Fecha 3 Jugado"]);
  assert.doesNotMatch(regularFinalizado, /06\/06\/26/);

  const playoffFinalizado = renderMiniPartidoPrueba({
    id: 502,
    tipo: "playoff",
    fase: "cuartos",
    estado: "resuelto",
    local: "Sportivo A. Club",
    visitante: "C.A. Carcarañá",
    goles_local: 2,
    goles_visitante: 1,
    fecha_partido: "2026-06-06"
  }, "Sportivo A. Club");
  assert.match(playoffFinalizado, /Cuartos de Final/);
  assert.doesNotMatch(playoffFinalizado, /FINALIZADO/);
  assert.match(playoffFinalizado, /<strong class="team-match-score">2 - 1<\/strong>/);
  assert.deepEqual(extractSmallTexts(playoffFinalizado), ["Cuartos de Final Jugado"]);
  assert.doesNotMatch(playoffFinalizado, /06\/06\/26/);

  const finalizadoSinFecha = renderMiniPartidoPrueba({
    id: 503,
    tipo: "regular",
    fecha: 4,
    estado: "finalizado",
    local: "Sportivo A. Club",
    visitante: "ADEO",
    goles_local: 1,
    goles_visitante: 0,
    fecha_partido: null
  }, "Sportivo A. Club");
  assert.doesNotMatch(finalizadoSinFecha, /FINALIZADO/);
  assert.deepEqual(extractSmallTexts(finalizadoSinFecha), ["Fecha 4 Jugado"]);
  assert.doesNotMatch(finalizadoSinFecha, /Partido finalizado|<small>[\s\S]*FINALIZADO[\s\S]*<\/small>/);

  const sportivoAperturaFecha3 = renderMiniPartidoPrueba({
    id: 506,
    tipo: "regular",
    fecha: 3,
    estado: "programado",
    local: "C.A. Montes de Oca",
    visitante: "Sportivo A. Club",
    goles_local: 0,
    goles_visitante: 0,
    fecha_partido: null
  }, "Sportivo A. Club");
  assert.match(sportivoAperturaFecha3, /Fecha 3/);
  assert.doesNotMatch(sportivoAperturaFecha3, /FINALIZADO/);
  assert.match(sportivoAperturaFecha3, /<strong class="team-match-score">0 - 0<\/strong>/);
  assert.deepEqual(extractSmallTexts(sportivoAperturaFecha3), ["Fecha 3 Jugado"]);
  assert.doesNotMatch(sportivoAperturaFecha3, /<small>[\s\S]*FINALIZADO[\s\S]*<\/small>/);

  const futuroNeutral = renderMiniPartidoPrueba({
    id: 504,
    tipo: "regular",
    fecha: 5,
    estado: "programado",
    estadoTexto: "A confirmar",
    local: "Sportivo A. Club",
    visitante: "ADEO",
    goles_local: null,
    goles_visitante: null,
    fecha_partido: null
  }, "Sportivo A. Club");
  assert.doesNotMatch(futuroNeutral, /FINALIZADO/);
  assert.doesNotMatch(futuroNeutral, /PR&Oacute;XIMO/);
  assert.match(futuroNeutral, /<strong class="team-match-pending">A confirmar<\/strong>/);
  assert.deepEqual(extractSmallTexts(futuroNeutral), ["Fecha 5 Pendiente"]);

  const proximo = renderMiniPartidoPrueba({
    id: 505,
    tipo: "regular",
    fecha: 6,
    estado: "programado",
    estadoTexto: "A confirmar",
    local: "Sportivo A. Club",
    visitante: "ADEO",
    goles_local: null,
    goles_visitante: null,
    fecha_partido: null
  }, "Sportivo A. Club", true);
  assert.match(proximo, /team-match-next/);
  assert.doesNotMatch(proximo, /PR&Oacute;XIMO/);
  assert.doesNotMatch(proximo, /FINALIZADO/);
  assert.deepEqual(extractSmallTexts(proximo), ["Fecha 6 Próximo"]);

  const renderActividadLibrePrueba = buildRenderActividadLibre(appSource);
  const libre = renderActividadLibrePrueba({
    tipoActividad: "libre",
    fecha: 4
  }, "Sportivo A. Club");
  assert.match(libre, /team-activity-free/);
  assert.match(libre, /Sportivo A\. Club/);
  assert.match(libre, /<strong>LIBRE<\/strong>/);
  assert.deepEqual(extractSmallTexts(libre), ["Fecha 4 Libre"]);
  assert.doesNotMatch(libre, /<button|onclick|abrirPartido/);
  results.push("recorrido equipo: filas simples con marcador, A confirmar, fecha y libre compacto: ok");

  assert.match(appSource, /previewTorneoIdSolicitado[\s\S]{0,120}getPreviewTournamentId/);
  assert.match(extractFunction(appSource, "agregarParametroPreviewTorneo"), /preview_torneo/);
  assert.match(
    extractFunction(appSource, "agregarParametroPreviewTorneo"),
    /state\.torneoPreview\?\.id \|\| previewTorneoIdSolicitado/
  );
  assert.match(extractFunction(appSource, "obtenerTorneoPreview"), /isNetlifyPreviewHost/);
  assert.match(extractFunction(appSource, "obtenerTorneoSeleccionado"), /obtenerTorneoPreview/);
  assert.match(extractFunction(appSource, "actualizarAvisoPreviewTorneo"), /Vista de prueba:/);
  assert.match(extractFunction(appSource, "abrirEquipo"), /obtenerTorneoVisualizacionActual/);
  assert.doesNotMatch(extractFunction(appSource, "abrirEquipo"), /torneoEquipoId:\s*state\.torneoVigente/);
  assert.match(extractFunction(appSource, "obtenerTorneoVisualizacionActual"), /state\.torneoPreview/);
  assert.match(extractFunction(appSource, "obtenerTorneoVisualizacionActual"), /state\.torneoVigente/);
  assert.match(extractFunction(appSource, "resolverSeleccionTorneoDetalleEquipo"), /obtenerTorneoVisualizacionDetalleEquipo/);
  assert.match(extractFunction(appSource, "resolverSeleccionTorneoDetalleEquipo"), /torneoEquipoManual/);
  assert.match(extractFunction(appSource, "seleccionarTorneoDetalleEquipo"), /torneoEquipoManual = true/);
  assert.match(extractFunction(appSource, "renderSelectorTorneosDetalleEquipo"), /esTorneoVigente\(torneo\)/);
  assert.match(extractFunction(appSource, "renderDetalleEquipo"), /torneoSeleccionado && esTorneoVigente\(torneoSeleccionado\)/);
  assert.match(extractFunction(appSource, "renderDetalleEquipo"), /actividadesEquipo/);
  assert.match(extractFunction(appSource, "renderDetalleEquipo"), /calcularRendimientoEquipoTorneo\(partidosEquipo/);
  assert.match(extractFunction(appSource, "obtenerFechasLibresEquipoTorneo"), /getFreeParticipants/);
  assert.doesNotMatch(extractFunction(appSource, "obtenerFechasLibresEquipoTorneo"), /state\.partidos/);
  assert.match(extractFunction(appSource, "ordenarPartidosCronologicamente"), /fechaTorneoA/);
  assert.match(extractFunction(appSource, "ordenarPartidosCronologicamente"), /fecha_partido/);
  assert.match(extractFunction(appSource, "ordenarPartidosCronologicamente"), /horaA/);
  assert.match(extractFunction(appSource, "obtenerEquiposZonaTorneo"), /getTeamsByZone/);
  assert.match(extractFunction(appSource, "obtenerEquipoLibre"), /getFreeParticipants/);
  assert.match(extractFunction(appSource, "calcularTablaZona"), /buildZoneTable/);
  assert.match(extractFunction(appSource, "renderTablaGoleadores"), /obtenerGoleadoresTablaPublicables/);
  assert.match(extractFunction(appSource, "actualizarNavegacionTabla"), /goleadores/);
  assert.match(appSource, /\/\.netlify\/functions\/goleadores-publicos/);
  assert.doesNotMatch(appSource, /goleadores_oficiales\?select/);
  assert.match(extractFunction(appSource, "renderTeams"), /buildTeamList/);
  assert.match(extractFunction(appSource, "obtenerEtapaInicial"), /getInitialRegularStageKey/);
  assert.match(extractFunction(appSource, "actualizarNavegacionEtapas"), /etapa\.clave === etapaActual/);
  assert.match(extractFunction(appSource, "selectStage"), /etapaActual = clave/);
  assert.match(extractFunction(appSource, "changeStage"), /indexActual \+ dir/);
  assert.match(extractFunction(appSource, "obtenerAgendaRegularInicio"), /getUpcomingCalendarMatches/);
  assert.match(extractFunction(appSource, "actualizarEncabezadoPartidos"), /etapaVisible\.etiqueta/);
  assert.match(extractFunction(appSource, "renderDetallePartido"), /home-featured-venue[\s\S]*obtenerEstadioPartido\(partido\)/);
  assert.match(extractFunction(appSource, "renderDetallePartido"), /home-featured-time[\s\S]*obtenerHoraPartido\(partido\)/);
  assert.match(extractFunction(appSource, "torneoPermiteProximoEquipo"), /esTorneoVigente\(torneo\)/);
  assert.match(extractFunction(appSource, "torneoPermiteProximoEquipo"), /state\.torneoPreview\?\.id/);
  assert.match(extractFunction(appSource, "obtenerProximoPartidoEquipo"), /torneoPermiteProximoEquipo\(torneo\)/);
  assert.match(extractFunction(appSource, "obtenerProximoPartidoEquipo"), /partidoPendienteParaVista\(partido\)/);
  assert.match(extractFunction(appSource, "obtenerProximoPartidoEquipo"), /getNextPendingMatch/);
  assert.match(extractFunction(appSource, "renderPartidosEquipoPorFase"), /proximoId/);
  assert.match(extractFunction(appSource, "renderPartidosEquipoPorFase"), /obtenerProximoPartidoEquipo\(partidosEquipo, torneo\)/);
  assert.match(extractFunction(appSource, "partidoFinalizadoRecorridoEquipo"), /partidoResueltoParaVista\(partido\) \|\| partidoTieneResultado\(partido\)/);
  assert.match(extractFunction(appSource, "renderMiniPartido"), /team-match-finished/);
  assert.match(extractFunction(appSource, "renderMiniPartido"), /const esProximo = proximo && !finalizado/);
  assert.match(extractFunction(appSource, "renderMiniPartido"), /ESTADOS_DATO\.confirmar/);
  assert.match(extractFunction(appSource, "renderMiniPartido"), /team-match-pending/);
  assert.doesNotMatch(extractFunction(appSource, "renderMiniPartido"), /FINALIZADO/);
  assert.doesNotMatch(extractFunction(appSource, "renderMiniPartido"), /PR&Oacute;XIMO|PRÓXIMO/);
  assert.match(extractFunction(appSource, "renderMiniPartido"), /team-match-meta/);
  assert.match(extractFunction(appSource, "renderMiniPartido"), /team-match-state/);
  assert.match(extractFunction(appSource, "renderMiniPartido"), /team-match-future/);
  assert.doesNotMatch(extractFunction(appSource, "renderMiniPartido"), /Partido finalizado|\? "Finalizado"/);
  assert.doesNotMatch(extractFunction(appSource, "renderActividadLibre"), /<button|onclick|abrirPartido/);
  assert.match(extractFunction(appSource, "renderActividadLibre"), /team-activity-free/);
  assert.match(extractFunction(appSource, "renderActividadLibre"), /team-free-line/);
  assert.match(extractFunction(appSource, "renderActividadLibre"), /team-match-state free/);
  assert.match(extractFunction(appSource, "renderActividadLibre"), /team-match-meta/);
  assert.match(extractFunction(appSource, "renderResumenGrupoPartidosEquipo"), /cantidadFechas/);
  assert.match(extractFunction(appSource, "renderResumenGrupoPartidosEquipo"), /grupo\.clave === "regular"/);
  assert.match(extractFunction(appSource, "renderResumenGrupoPartidosEquipo"), /detalle \? `<small>\$\{detalle\}<\/small>` : ""/);
  assert.match(extractFunction(appSource, "renderDetalleEquipo"), /team-detail-identity/);
  assert.match(extractFunction(appSource, "renderDetalleEquipo"), /renderResumenTorneoEquipo/);
  assert.match(extractFunction(appSource, "renderResumenTorneoEquipo"), /Resumen del torneo/);
  assert.match(extractFunction(appSource, "renderCampaniaEquipo"), /Goles a favor/);
  assert.match(extractFunction(appSource, "renderCampaniaEquipo"), /Goles en contra/);
  assert.match(extractFunction(appSource, "renderDestacadosEquipoTorneo"), /Destacados/);
  assert.match(extractFunction(appSource, "renderDestacadosEquipoTorneo"), /Goleadores/);
  assert.match(extractFunction(appSource, "renderIndicadoresFormaTabla"), /Number\(fila\.pj\) === 0/);
  assert.match(extractFunction(appSource, "renderIndicadoresFormaTabla"), /aria-label="&Uacute;ltimo resultado: \$\{etiqueta\}"/);
  assert.match(extractFunction(appSource, "renderTablaPosiciones"), /dots \? `<div class="form-row">\$\{dots\}<\/div>` : ""/);
  assert.match(extractFunction(appSource, "renderTablaGeneral"), /<h3>Tabla general<\/h3>/);
  assert.match(extractFunction(appSource, "renderTablaGeneral"), /\$\{data\.length\} equipos/);
  assert.doesNotMatch(extractFunction(appSource, "renderTablaGeneral"), /tabla-general-kicker">General/);
  assert.doesNotMatch(extractFunction(appSource, "renderTablaGeneral"), /Tabla general de puntos/);
  assert.match(extractFunction(appSource, "aplicarDatosTorneo"), /filtrarPartidosPorTorneo/);
  assert.match(extractFunction(appSource, "obtenerPartidos"), /torneo_id=eq\.\$\{encodeURIComponent/);
  assert.doesNotMatch(extractFunction(utilsSource, "aplicarClubes"), /\.zona\b/);
  assert.match(styleSource, /\.team-match-line[\s\S]*minmax\(0, 1fr\)/);
  assert.match(styleSource, /\.team-match-row \{[\s\S]*padding: 11px 12px 14px/);
  assert.match(styleSource, /\.team-match-row \{[\s\S]*border-bottom: 1px solid rgba\(255, 255, 255, \.09\)/);
  assert.match(styleSource, /\.team-match-line > span[\s\S]*text-overflow: ellipsis/);
  assert.match(styleSource, /\.team-match-next[\s\S]*border-left/);
  assert.match(styleSource, /\.team-activity-free[\s\S]*cursor: default/);
  assert.match(styleSource, /\.team-match-row \.team-match-pending[\s\S]*font-size: clamp/);
  assert.match(styleSource, /\.mr-time\.tbd[\s\S]*font-size: clamp/);
  assert.match(styleSource, /\.match-detail-featured-state[\s\S]*max-width/);
  assert.match(styleSource, /\.match-detail-featured-meta \.home-featured-time strong[\s\S]*clamp/);
  assert.match(styleSource, /\.team-match-row small[\s\S]*white-space: normal/);
  assert.match(styleSource, /\.team-match-row small[\s\S]*letter-spacing: 0\.02em/);
  assert.match(styleSource, /\.t-pts[\s\S]*font-weight: 700/);
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
