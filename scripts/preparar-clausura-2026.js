"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const https = require("https");

const ROOT = path.resolve(__dirname, "..");
const FIXTURE_DIRS = [
  path.join(ROOT, "data", "clausura_2026"),
  path.join(ROOT, "data", "clausura-2026")
];
const DEFAULT_MAP_PATH = path.join(
  ROOT,
  "data",
  "clausura-2026",
  "clubes-map.json"
);
const DEFAULT_REPORT_PATH = path.join(
  ROOT,
  "reports",
  "clausura-2026-dry-run.md"
);

const SOURCE_URL =
  "https://www.xn--ligacaadense-fhb.com.ar/fixture.php?idx=2026/1/";
const REMOTE_HTTP_METHODS = ["GET"];

const EXPECTED = {
  teamsTotal: 20,
  matchesTotal: 114,
  matchesByZone: { 1: 42, 2: 30, 3: 42 },
  byesTotal: 28,
  byesByZone: { 1: 14, 2: 0, 3: 14 },
  matchesByDate: {
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
  },
  zone2Dates: [1, 2, 3, 4, 5, 8, 9, 10, 11, 12],
  zone2ForbiddenDates: [6, 7, 13, 14],
  clubsByZone: { 1: 7, 2: 6, 3: 7 },
  matchesPerClubByZone: { 1: 12, 2: 10, 3: 12 },
  homeAwayByZone: { 1: 6, 2: 5, 3: 6 },
  uniquePairsByZone: { 1: 21, 2: 15, 3: 21 }
};

const INSERT_FIELDS = [
  "torneo_id",
  "tipo",
  "fecha",
  "zona",
  "local_id",
  "visitante_id",
  "local",
  "visitante",
  "fecha_partido",
  "dia",
  "hora",
  "estadio",
  "arbitro",
  "estado",
  "goles_local",
  "goles_visitante",
  "penales_local",
  "penales_visitante",
  "fase",
  "numero_playoff",
  "source_local",
  "source_visitante"
];

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function parseArgs(argv) {
  const options = {
    dryRun: true,
    remoteRead: false,
    writeReport: false,
    fixturePath: null,
    mapPath: DEFAULT_MAP_PATH,
    reportPath: DEFAULT_REPORT_PATH,
    torneoId: null,
    help: false
  };

  argv.forEach(arg => {
    if (arg === "--dry-run") {
      options.dryRun = true;
      return;
    }
    if (arg === "--remote-read") {
      options.remoteRead = true;
      return;
    }
    if (arg === "--write-report") {
      options.writeReport = true;
      return;
    }
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      return;
    }
    if (arg.indexOf("--fixture=") === 0) {
      options.fixturePath = path.resolve(ROOT, arg.slice("--fixture=".length));
      return;
    }
    if (arg.indexOf("--map=") === 0) {
      options.mapPath = path.resolve(ROOT, arg.slice("--map=".length));
      return;
    }
    if (arg.indexOf("--report=") === 0) {
      options.reportPath = path.resolve(ROOT, arg.slice("--report=".length));
      return;
    }
    if (arg.indexOf("--torneo-id=") === 0) {
      const id = Number(arg.slice("--torneo-id=".length));
      if (!Number.isInteger(id) || id <= 0) {
        throw new Error("El valor de --torneo-id debe ser un entero positivo.");
      }
      options.torneoId = id;
      return;
    }
    if (
      arg === "--apply" ||
      arg === "--write-supabase" ||
      arg.indexOf("--apply=") === 0
    ) {
      throw new Error(
        "Modo de escritura deshabilitado. Este script solo prepara dry-runs."
      );
    }
    throw new Error(`Argumento no reconocido: ${arg}`);
  });

  return options;
}

function usage() {
  return [
    "Uso:",
    "  node scripts/preparar-clausura-2026.js --dry-run --torneo-id=2",
    "  node scripts/preparar-clausura-2026.js --dry-run --torneo-id=2 --remote-read --write-report",
    "",
    "Este script no ejecuta escrituras en Supabase."
  ].join("\n");
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function sha256(filePath) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(filePath))
    .digest("hex");
}

function findFixtureJson() {
  const candidates = [];

  FIXTURE_DIRS.forEach(dir => {
    if (!fs.existsSync(dir)) return;
    fs.readdirSync(dir)
      .filter(name => /\.json$/i.test(name))
      .forEach(name => {
        const filePath = path.join(dir, name);
        let data = null;
        let fixtureLike = false;
        try {
          data = readJson(filePath);
          fixtureLike = Boolean(
            data &&
            data.metadata &&
            data.zones &&
            Array.isArray(data.matches) &&
            Array.isArray(data.byes)
          );
        } catch (error) {
          fixtureLike = false;
        }
        candidates.push({ filePath, fixtureLike });
      });
  });

  const fixtures = candidates.filter(item => item.fixtureLike);

  if (fixtures.length === 1) return fixtures[0].filePath;
  if (fixtures.length > 1) {
    throw new Error(
      "Hay mas de un JSON con estructura de fixture en data/clausura_2026 o data/clausura-2026."
    );
  }
  if (candidates.length === 1) return candidates[0].filePath;

  throw new Error(
    "No se encontro un JSON de fixture identificable en data/clausura_2026 ni data/clausura-2026."
  );
}

function normalizeClubName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function sortedNumbers(values) {
  return values
    .map(Number)
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
}

function increment(object, key, amount) {
  object[key] = (object[key] || 0) + (amount || 1);
}

function countBy(rows, keyFn) {
  return rows.reduce((acc, row) => {
    increment(acc, keyFn(row), 1);
    return acc;
  }, {});
}

function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let index = 0; index < a.length; index += 1) {
    if (String(a[index]) !== String(b[index])) return false;
  }
  return true;
}

function pushError(errors, message, context) {
  errors.push({ message, context: context || null });
}

function listZoneTeams(zones) {
  const rows = [];
  Object.keys(zones || {}).forEach(zone => {
    (zones[zone] || []).forEach(team => {
      rows.push({ zone: Number(zone), team });
    });
  });
  return rows;
}

function collectMatchTeams(matches) {
  const teams = new Set();
  matches.forEach(match => {
    if (match.local_source) teams.add(match.local_source);
    if (match.visitante_source) teams.add(match.visitante_source);
  });
  return Array.from(teams).sort((a, b) =>
    normalizeClubName(a).localeCompare(normalizeClubName(b))
  );
}

function buildMapIndex(mapData) {
  const rows = Array.isArray(mapData)
    ? mapData
    : Array.isArray(mapData.clubes)
      ? mapData.clubes
      : [];
  const errors = [];
  const bySource = {};
  const duplicateKeys = {};

  rows.forEach(row => {
    const key = normalizeClubName(row.nombre_fuente);
    if (!key) {
      pushError(errors, "Mapeo con nombre_fuente vacio.", row);
      return;
    }
    if (!bySource[key]) bySource[key] = [];
    bySource[key].push(row);
    if (bySource[key].length > 1) duplicateKeys[key] = bySource[key];
  });

  Object.keys(duplicateKeys).forEach(key => {
    pushError(errors, `Mapeo ambiguo para clave normalizada ${key}.`);
  });

  const duplicatedClubIds = {};
  rows.forEach(row => {
    const id = Number(row.club_id);
    if (!Number.isInteger(id) || id <= 0) {
      pushError(errors, `club_id invalido para ${row.nombre_fuente}.`, row);
      return;
    }
    duplicatedClubIds[id] = (duplicatedClubIds[id] || 0) + 1;
  });
  Object.keys(duplicatedClubIds).forEach(id => {
    if (duplicatedClubIds[id] > 1) {
      pushError(errors, `club_id duplicado en mapeo: ${id}.`);
    }
  });

  function resolve(sourceName) {
    const key = normalizeClubName(sourceName);
    const matches = bySource[key] || [];
    if (matches.length === 0) {
      return {
        sourceName,
        status: "no encontrado",
        error: `Club no encontrado en mapeo: ${sourceName}.`
      };
    }
    if (matches.length > 1) {
      return {
        sourceName,
        status: "ambiguo",
        error: `Club ambiguo en mapeo: ${sourceName}.`
      };
    }
    const row = matches[0];
    if (row.estado !== "confirmado") {
      return {
        sourceName,
        row,
        status: row.estado || "no confirmado",
        error: `Club no confirmado en mapeo: ${sourceName}.`
      };
    }
    return { sourceName, row, status: "confirmado", error: null };
  }

  return { rows, errors, resolve };
}

function validateFixture(data, mapData, options) {
  const errors = [];
  const warnings = [];
  const matches = Array.isArray(data.matches) ? data.matches : [];
  const byes = Array.isArray(data.byes) ? data.byes : [];
  const zones = data.zones || {};
  const torneoId = options.torneoId || null;
  const mapIndex = buildMapIndex(mapData);
  const mappingErrors = mapIndex.errors.slice();

  if (!data || typeof data !== "object") {
    pushError(errors, "El JSON raiz debe ser un objeto.");
  }
  if (!data.metadata || typeof data.metadata !== "object") {
    pushError(errors, "Falta metadata del fixture.");
  }
  if (!data.zones || typeof data.zones !== "object") {
    pushError(errors, "Faltan zonas del fixture.");
  }
  if (!Array.isArray(data.matches)) {
    pushError(errors, "matches debe ser un arreglo.");
  }
  if (!Array.isArray(data.byes)) {
    pushError(errors, "byes debe ser un arreglo.");
  }
  if (!torneoId) {
    pushError(
      errors,
      "Falta --torneo-id. No se asigna torneo_id por suposicion."
    );
  }

  mappingErrors.forEach(error => errors.push(error));

  const zoneTeams = listZoneTeams(zones);
  const teamsByNormalized = {};
  const zoneByTeam = {};

  zoneTeams.forEach(row => {
    const key = normalizeClubName(row.team);
    if (!key) {
      pushError(errors, `Equipo vacio en zona ${row.zone}.`);
      return;
    }
    if (!teamsByNormalized[key]) {
      teamsByNormalized[key] = { team: row.team, zones: [] };
    }
    teamsByNormalized[key].zones.push(row.zone);
    zoneByTeam[key] = row.zone;
  });

  Object.keys(teamsByNormalized).forEach(key => {
    const uniqueZones = Array.from(new Set(teamsByNormalized[key].zones));
    if (uniqueZones.length > 1) {
      pushError(
        errors,
        `El club ${teamsByNormalized[key].team} aparece en mas de una zona.`,
        uniqueZones
      );
    }
  });

  if (Object.keys(teamsByNormalized).length !== EXPECTED.teamsTotal) {
    pushError(
      errors,
      `Cantidad de clubes unicos invalida: ${Object.keys(teamsByNormalized).length}.`
    );
  }

  Object.keys(EXPECTED.clubsByZone).forEach(zone => {
    const count = (zones[zone] || []).length;
    if (count !== EXPECTED.clubsByZone[zone]) {
      pushError(
        errors,
        `Zona ${zone} tiene ${count} clubes; se esperaban ${EXPECTED.clubsByZone[zone]}.`
      );
    }
  });

  const sourceTeams = collectMatchTeams(matches);
  sourceTeams.forEach(team => {
    const key = normalizeClubName(team);
    if (!zoneByTeam[key]) {
      pushError(errors, `El club ${team} aparece en partidos pero no en zonas.`);
    }
  });

  const carcaranaHits = []
    .concat(zoneTeams.map(row => row.team))
    .concat(sourceTeams)
    .concat(byes.map(item => item.equipo))
    .filter(team => normalizeClubName(team).indexOf("carcarana") >= 0);

  if (carcaranaHits.length > 0) {
    pushError(errors, "Carcarana aparece en el fixture del Clausura.", carcaranaHits);
  }

  if (matches.length !== EXPECTED.matchesTotal) {
    pushError(
      errors,
      `Cantidad total de partidos invalida: ${matches.length}.`
    );
  }

  const matchesByZone = countBy(matches, match => Number(match.zona));
  Object.keys(EXPECTED.matchesByZone).forEach(zone => {
    if ((matchesByZone[zone] || 0) !== EXPECTED.matchesByZone[zone]) {
      pushError(
        errors,
        `Zona ${zone} tiene ${matchesByZone[zone] || 0} partidos; se esperaban ${EXPECTED.matchesByZone[zone]}.`
      );
    }
  });

  const matchesByDate = countBy(matches, match => Number(match.fecha));
  Object.keys(EXPECTED.matchesByDate).forEach(date => {
    if ((matchesByDate[date] || 0) !== EXPECTED.matchesByDate[date]) {
      pushError(
        errors,
        `Fecha ${date} tiene ${matchesByDate[date] || 0} partidos; se esperaban ${EXPECTED.matchesByDate[date]}.`
      );
    }
  });

  const zone2Dates = sortedNumbers(
    Array.from(new Set(matches.filter(match => Number(match.zona) === 2)
      .map(match => match.fecha)))
  );
  if (!arraysEqual(zone2Dates, EXPECTED.zone2Dates)) {
    pushError(
      errors,
      `Fechas de Zona 2 invalidas: ${zone2Dates.join(", ")}.`
    );
  }

  const fixtureKeys = {};
  const logicalSourceKeys = {};
  matches.forEach(match => {
    if (!match.fixture_key) {
      pushError(errors, "Partido sin fixture_key.", match);
    } else {
      increment(fixtureKeys, match.fixture_key, 1);
    }

    const fecha = Number(match.fecha);
    const zona = Number(match.zona);
    const local = String(match.local_source || "").trim();
    const visitante = String(match.visitante_source || "").trim();
    const localKey = normalizeClubName(local);
    const visitanteKey = normalizeClubName(visitante);
    const logicalKey = [
      fecha,
      zona,
      localKey,
      visitanteKey
    ].join("|");
    increment(logicalSourceKeys, logicalKey, 1);

    if (!Number.isInteger(fecha) || fecha < 1 || fecha > 14) {
      pushError(errors, `Fecha fuera de rango en ${match.fixture_key}.`, match);
    }
    if (![1, 2, 3].includes(zona)) {
      pushError(errors, `Zona invalida en ${match.fixture_key}.`, match);
    }
    if (
      zona === 2 &&
      EXPECTED.zone2ForbiddenDates.indexOf(fecha) >= 0
    ) {
      pushError(errors, `Zona 2 tiene partido en Fecha ${fecha}.`, match);
    }
    if (!local || !visitante) {
      pushError(errors, `Rival vacio en ${match.fixture_key}.`, match);
    }
    if (localKey === visitanteKey) {
      pushError(errors, `Local igual a visitante en ${match.fixture_key}.`, match);
    }
    if (localKey === "libre" || visitanteKey === "libre") {
      pushError(errors, `Aparece LIBRE como partido en ${match.fixture_key}.`, match);
    }
    if (zoneByTeam[localKey] !== zona) {
      pushError(errors, `Local fuera de zona en ${match.fixture_key}.`, match);
    }
    if (zoneByTeam[visitanteKey] !== zona) {
      pushError(errors, `Visitante fuera de zona en ${match.fixture_key}.`, match);
    }
    if (match.goles_local !== null || match.goles_visitante !== null) {
      pushError(errors, `Resultado inicial no nulo en ${match.fixture_key}.`, match);
    }
    if (
      (hasOwn(match, "penales_local") && match.penales_local !== null) ||
      (hasOwn(match, "penales_visitante") && match.penales_visitante !== null)
    ) {
      pushError(errors, `Penales iniciales no nulos en ${match.fixture_key}.`, match);
    }
    if (match.estado !== "programado") {
      pushError(errors, `Estado inicial invalido en ${match.fixture_key}.`, match);
    }
  });

  Object.keys(fixtureKeys).forEach(key => {
    if (fixtureKeys[key] > 1) {
      pushError(errors, `fixture_key duplicado: ${key}.`);
    }
  });
  Object.keys(logicalSourceKeys).forEach(key => {
    if (logicalSourceKeys[key] > 1) {
      pushError(errors, `Partido duplicado en fuente: ${key}.`);
    }
  });

  validateRoundRobin(matches, zones, errors);
  validateByes(byes, zones, errors);

  const mappings = sourceTeams.map(team => {
    const resolved = mapIndex.resolve(team);
    if (resolved.error) pushError(errors, resolved.error, resolved.row || team);
    return {
      nombre_fuente: team,
      nombre_en_proyecto: resolved.row ? resolved.row.nombre_en_proyecto : null,
      club_id: resolved.row ? Number(resolved.row.club_id) : null,
      metodo: resolved.row ? resolved.row.metodo : null,
      estado: resolved.row ? resolved.row.estado : resolved.status,
      zona: resolved.row ? Number(resolved.row.zona) : null
    };
  });

  const records = matches.map(match => buildRecord(match, mapIndex, torneoId));
  const recordErrors = validateRecords(records);
  recordErrors.forEach(error => errors.push(error));

  return {
    errors,
    warnings,
    mappings,
    records,
    counts: {
      matchesTotal: matches.length,
      sourceTeamsTotal: sourceTeams.length,
      byesTotal: byes.length,
      matchesByZone,
      matchesByDate,
      zone2Dates,
      byesByZone: countBy(byes, item => Number(item.zona))
    }
  };
}

function validateRoundRobin(matches, zones, errors) {
  Object.keys(EXPECTED.clubsByZone).forEach(zoneText => {
    const zone = Number(zoneText);
    const teams = (zones[zoneText] || []).map(normalizeClubName);
    const stats = {};
    const pairs = {};
    teams.forEach(team => {
      stats[team] = { total: 0, home: 0, away: 0 };
    });

    matches
      .filter(match => Number(match.zona) === zone)
      .forEach(match => {
        const local = normalizeClubName(match.local_source);
        const visitante = normalizeClubName(match.visitante_source);
        if (!stats[local]) stats[local] = { total: 0, home: 0, away: 0 };
        if (!stats[visitante]) stats[visitante] = { total: 0, home: 0, away: 0 };
        stats[local].total += 1;
        stats[local].home += 1;
        stats[visitante].total += 1;
        stats[visitante].away += 1;

        const pairKey = [local, visitante].sort().join("|");
        if (!pairs[pairKey]) pairs[pairKey] = [];
        pairs[pairKey].push({ local, visitante, fixture_key: match.fixture_key });
      });

    Object.keys(stats).forEach(team => {
      const expectedMatches = EXPECTED.matchesPerClubByZone[zone];
      const expectedHomeAway = EXPECTED.homeAwayByZone[zone];
      if (stats[team].total !== expectedMatches) {
        pushError(
          errors,
          `Zona ${zone}: ${team} tiene ${stats[team].total} partidos; se esperaban ${expectedMatches}.`
        );
      }
      if (
        stats[team].home !== expectedHomeAway ||
        stats[team].away !== expectedHomeAway
      ) {
        pushError(
          errors,
          `Zona ${zone}: ${team} tiene ${stats[team].home} localias y ${stats[team].away} visitas; se esperaban ${expectedHomeAway}/${expectedHomeAway}.`
        );
      }
    });

    if (Object.keys(pairs).length !== EXPECTED.uniquePairsByZone[zone]) {
      pushError(
        errors,
        `Zona ${zone}: ${Object.keys(pairs).length} parejas; se esperaban ${EXPECTED.uniquePairsByZone[zone]}.`
      );
    }

    Object.keys(pairs).forEach(pairKey => {
      const games = pairs[pairKey];
      if (games.length !== 2) {
        pushError(
          errors,
          `Zona ${zone}: pareja ${pairKey} juega ${games.length} veces.`
        );
        return;
      }
      const homes = Array.from(new Set(games.map(game => game.local)));
      if (homes.length !== 2) {
        pushError(
          errors,
          `Zona ${zone}: pareja ${pairKey} no invierte localias.`,
          games
        );
      }
    });
  });
}

function validateByes(byes, zones, errors) {
  if (byes.length !== EXPECTED.byesTotal) {
    pushError(errors, `Cantidad total de fechas libres invalida: ${byes.length}.`);
  }

  const byesByZone = countBy(byes, bye => Number(bye.zona));
  Object.keys(EXPECTED.byesByZone).forEach(zone => {
    if ((byesByZone[zone] || 0) !== EXPECTED.byesByZone[zone]) {
      pushError(
        errors,
        `Zona ${zone} tiene ${byesByZone[zone] || 0} libres; se esperaban ${EXPECTED.byesByZone[zone]}.`
      );
    }
  });

  const teamZone = {};
  Object.keys(zones || {}).forEach(zone => {
    (zones[zone] || []).forEach(team => {
      teamZone[normalizeClubName(team)] = Number(zone);
    });
  });

  const byeKeys = {};
  const byTeam = {};
  byes.forEach(bye => {
    const zone = Number(bye.zona);
    const date = Number(bye.fecha);
    const team = normalizeClubName(bye.equipo);
    const key = `${date}|${zone}|${team}`;
    increment(byeKeys, key, 1);
    increment(byTeam, `${zone}|${team}`, 1);

    if (!Number.isInteger(date) || date < 1 || date > 14) {
      pushError(errors, "Fecha libre fuera de rango.", bye);
    }
    if (zone === 2) {
      pushError(errors, "Zona 2 no debe tener fechas libres.", bye);
    }
    if (teamZone[team] !== zone) {
      pushError(errors, "Fecha libre con equipo fuera de zona.", bye);
    }
    if (team === "libre") {
      pushError(errors, "Aparece equipo ficticio LIBRE en fechas libres.", bye);
    }
  });

  Object.keys(byeKeys).forEach(key => {
    if (byeKeys[key] > 1) {
      pushError(errors, `Fecha libre duplicada: ${key}.`);
    }
  });

  [1, 3].forEach(zone => {
    (zones[String(zone)] || []).forEach(teamName => {
      const key = `${zone}|${normalizeClubName(teamName)}`;
      if ((byTeam[key] || 0) !== 2) {
        pushError(
          errors,
          `Zona ${zone}: ${teamName} tiene ${byTeam[key] || 0} fechas libres; se esperaban 2.`
        );
      }
    });
  });
}

function buildRecord(match, mapIndex, torneoId) {
  const local = mapIndex.resolve(match.local_source);
  const visitante = mapIndex.resolve(match.visitante_source);

  return {
    source_fixture_key: match.fixture_key,
    torneo_id: torneoId || null,
    tipo: "regular",
    fecha: Number(match.fecha),
    zona: Number(match.zona),
    local_id: local.row ? Number(local.row.club_id) : null,
    visitante_id: visitante.row ? Number(visitante.row.club_id) : null,
    local: local.row ? local.row.nombre_en_proyecto : null,
    visitante: visitante.row ? visitante.row.nombre_en_proyecto : null,
    fecha_partido: null,
    dia: null,
    hora: null,
    estadio: null,
    arbitro: null,
    estado: "programado",
    goles_local: null,
    goles_visitante: null,
    penales_local: null,
    penales_visitante: null,
    fase: null,
    numero_playoff: null,
    source_local: null,
    source_visitante: null
  };
}

function validateRecords(records) {
  const errors = [];
  const keys = {};

  records.forEach(record => {
    if (!record.local_id || !record.visitante_id) {
      pushError(errors, `Record sin IDs resueltos: ${record.source_fixture_key}.`, record);
    }
    if (record.local_id === record.visitante_id) {
      pushError(errors, `Record con local_id igual a visitante_id: ${record.source_fixture_key}.`, record);
    }
    if (
      record.goles_local !== null ||
      record.goles_visitante !== null ||
      record.penales_local !== null ||
      record.penales_visitante !== null
    ) {
      pushError(errors, `Record con resultado inicial no nulo: ${record.source_fixture_key}.`, record);
    }
    if (record.estado !== "programado") {
      pushError(errors, `Record con estado inicial invalido: ${record.source_fixture_key}.`, record);
    }

    const key = logicalKey(record);
    increment(keys, key, 1);
  });

  Object.keys(keys).forEach(key => {
    if (keys[key] > 1) {
      pushError(errors, `Clave idempotente duplicada en salida: ${key}.`);
    }
  });

  return errors;
}

function logicalKey(record) {
  return [
    record.torneo_id,
    record.tipo,
    Number(record.fecha),
    Number(record.zona),
    Number(record.local_id),
    Number(record.visitante_id)
  ].join("|");
}

function normalizeComparable(value, field) {
  if (value === undefined || value === "") return null;
  if (
    [
      "torneo_id",
      "fecha",
      "zona",
      "local_id",
      "visitante_id",
      "goles_local",
      "goles_visitante",
      "penales_local",
      "penales_visitante",
      "numero_playoff"
    ].indexOf(field) >= 0
  ) {
    if (value === null) return null;
    return Number(value);
  }
  return value;
}

function compareRecordToExisting(record, existing) {
  const differences = [];

  INSERT_FIELDS.forEach(field => {
    const expected = normalizeComparable(record[field], field);
    const current = normalizeComparable(existing[field], field);
    if (expected !== current) {
      differences.push({ field, expected, current });
    }
  });

  return differences;
}

function analyzeExisting(records, existingRows) {
  const existing = Array.isArray(existingRows) ? existingRows : [];
  const byKey = {};
  const duplicates = [];

  existing.forEach(row => {
    if (row.tipo !== "regular") return;
    const key = logicalKey({
      torneo_id: row.torneo_id,
      tipo: row.tipo,
      fecha: row.fecha,
      zona: row.zona,
      local_id: row.local_id,
      visitante_id: row.visitante_id
    });
    if (!byKey[key]) byKey[key] = [];
    byKey[key].push(row);
  });

  Object.keys(byKey).forEach(key => {
    if (byKey[key].length > 1) {
      duplicates.push({ key, rows: byKey[key].map(row => row.id) });
    }
  });

  const newRecords = [];
  const identical = [];
  const conflicts = [];

  records.forEach(record => {
    const key = logicalKey(record);
    const rows = byKey[key] || [];
    if (rows.length === 0) {
      newRecords.push(record);
      return;
    }
    const differences = compareRecordToExisting(record, rows[0]);
    if (differences.length === 0) {
      identical.push({ record, existing: rows[0] });
    } else {
      conflicts.push({ record, existing: rows[0], differences });
    }
  });

  return {
    existingCount: existing.length,
    newRecords,
    identical,
    conflicts,
    duplicates,
    skipped: []
  };
}

function extractPublicSupabaseConfig() {
  const configPath = path.join(ROOT, "js", "config.js");
  const text = fs.readFileSync(configPath, "utf8");
  const urlMatch = text.match(/SUPABASE_URL\s*=\s*"([^"]+)"/);
  const keyMatch = text.match(/SUPABASE_KEY\s*=\s*"([^"]+)"/);
  if (!urlMatch || !keyMatch) {
    throw new Error("No se pudo leer SUPABASE_URL/SUPABASE_KEY publicos.");
  }
  return { url: urlMatch[1], key: keyMatch[1] };
}

function supabaseGet(config, restPath) {
  return new Promise((resolve, reject) => {
    const url = new URL(config.url + restPath);
    const req = https.request(
      url,
      {
        method: "GET",
        headers: {
          apikey: config.key,
          Authorization: `Bearer ${config.key}`,
          "Content-Type": "application/json"
        }
      },
      res => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", chunk => {
          body += chunk;
        });
        res.on("end", () => {
          let data = null;
          try {
            data = body ? JSON.parse(body) : null;
          } catch (error) {
            reject(new Error(`Respuesta remota no JSON: HTTP ${res.statusCode}`));
            return;
          }
          if (res.statusCode < 200 || res.statusCode >= 300) {
            const message = data && (data.message || data.error)
              ? data.message || data.error
              : `HTTP ${res.statusCode}`;
            reject(new Error(`Consulta remota fallida: ${message}`));
            return;
          }
          resolve(data);
        });
      }
    );
    req.on("error", reject);
    req.end();
  });
}

async function readRemote(options) {
  const config = extractPublicSupabaseConfig();
  const torneoId = options.torneoId;
  const selectPartidos = [
    "id",
    "fecha",
    "zona",
    "local",
    "visitante",
    "goles_local",
    "goles_visitante",
    "dia",
    "hora",
    "fecha_partido",
    "local_id",
    "visitante_id",
    "tipo",
    "fase",
    "numero_playoff",
    "source_local",
    "source_visitante",
    "penales_local",
    "penales_visitante",
    "estado",
    "estadio",
    "arbitro",
    "torneo_id",
    "actualizado_en"
  ].join(",");

  const torneos = await supabaseGet(
    config,
    "/rest/v1/torneos?select=id,anio,tipo,nombre,activo,fecha_inicio,fecha_fin,actualizado_en&order=id.asc"
  );
  const clubes = await supabaseGet(
    config,
    "/rest/v1/clubes?select=id,nombre_oficial,nombre_corto,aliases,activo,zona&order=id.asc"
  );
  const partidos = await supabaseGet(
    config,
    `/rest/v1/partidos?select=${selectPartidos}&torneo_id=eq.${encodeURIComponent(torneoId)}&order=id.asc`
  );
  const inscripciones = await supabaseGet(
    config,
    `/rest/v1/inscripciones_jugadores?select=id,club_id,torneo_id,estado&torneo_id=eq.${encodeURIComponent(torneoId)}&order=id.asc`
  );

  return {
    torneos,
    clubes,
    partidos,
    inscripciones
  };
}

function validateRemote(remote, local, options) {
  const errors = [];
  const warnings = [];
  const torneoId = Number(options.torneoId);
  const torneos = Array.isArray(remote.torneos) ? remote.torneos : [];
  const clubes = Array.isArray(remote.clubes) ? remote.clubes : [];
  const torneo = torneos.find(item => Number(item.id) === torneoId) || null;

  if (!torneo) {
    pushError(errors, `No existe torneo remoto id ${torneoId}.`);
  } else {
    if (torneo.anio !== 2026) pushError(errors, "El torneo remoto no es anio 2026.", torneo);
    if (torneo.tipo !== "clausura") pushError(errors, "El torneo remoto no es tipo clausura.", torneo);
    if (torneo.nombre !== "Clausura 2026") {
      pushError(errors, "El torneo remoto no se llama Clausura 2026.", torneo);
    }
  }

  const clubesById = {};
  clubes.forEach(club => {
    clubesById[Number(club.id)] = club;
  });

  local.mappings.forEach(mapping => {
    const club = clubesById[Number(mapping.club_id)];
    if (!club) {
      pushError(errors, `Club remoto no encontrado para id ${mapping.club_id}.`, mapping);
      return;
    }
    if (normalizeClubName(club.nombre_oficial) !== normalizeClubName(mapping.nombre_en_proyecto)) {
      pushError(
        errors,
        `Club remoto ${mapping.club_id} no coincide con el mapeo.`,
        { mapping, remoto: club.nombre_oficial }
      );
    }
    if (club.activo === false) {
      pushError(errors, `Club remoto inactivo: ${club.nombre_oficial}.`, club);
    }
  });

  const carcarana = clubes.find(club =>
    normalizeClubName(club.nombre_oficial).indexOf("carcarana") >= 0
  );
  if (!carcarana) {
    warnings.push("Carcarana no se encontro como club remoto historico.");
  }

  const existingAnalysis = analyzeExisting(local.records, remote.partidos);
  if (existingAnalysis.conflicts.length > 0) {
    pushError(errors, "Hay partidos existentes con diferencias.", existingAnalysis.conflicts);
  }
  if (existingAnalysis.duplicates.length > 0) {
    pushError(errors, "Hay duplicados remotos para la clave idempotente.", existingAnalysis.duplicates);
  }

  return {
    errors,
    warnings,
    torneo,
    clubes,
    partidos: remote.partidos,
    inscripciones: remote.inscripciones,
    existingAnalysis,
    participaciones: {
      modelo:
        "No hay tabla versionada de participaciones de clubes por torneo. El proyecto representa zonas por partidos regulares y conserva clubes.zona como campo global heredado.",
      inscripcionesJugadoresClausura: Array.isArray(remote.inscripciones)
        ? remote.inscripciones.length
        : null
    }
  };
}

function getFileInfo(filePath) {
  const stat = fs.statSync(filePath);
  return {
    path: path.relative(ROOT, filePath).replace(/\\/g, "/"),
    size: stat.size,
    mtime: stat.mtime,
    sha256: sha256(filePath)
  };
}

function formatObjectCounts(counts) {
  return Object.keys(counts)
    .sort((a, b) => Number(a) - Number(b))
    .map(key => `Fecha ${key}: ${counts[key]}`)
    .join(", ");
}

function formatZoneCounts(counts) {
  return [1, 2, 3]
    .map(zone => `Zona ${zone}: ${counts[zone] || 0}`)
    .join(", ");
}

function mappingTable(rows) {
  return [
    "| nombre_fuente | nombre_en_proyecto | club_id | metodo | estado |",
    "|---|---|---:|---|---|"
  ].concat(rows.map(row => [
    row.nombre_fuente,
    row.nombre_en_proyecto || "",
    row.club_id || "",
    row.metodo || "",
    row.estado || ""
  ].join(" | ").replace(/^/, "| ").replace(/$/, " |"))).join("\n");
}

function buildReport(context) {
  const fixtureInfo = context.fixtureInfo;
  const local = context.local;
  const remote = context.remoteValidation;
  const remoteRequested = context.remoteRequested;
  const existing = remote && remote.existingAnalysis
    ? remote.existingAnalysis
    : analyzeExisting(local.records, []);
  const localOk = local.errors.length === 0;
  const remoteOk =
    remoteRequested &&
    remote &&
    remote.errors.length === 0 &&
    existing.conflicts.length === 0 &&
    existing.duplicates.length === 0;
  const finalState = !localOk
    ? "BLOQUEADO"
    : remoteRequested
      ? remoteOk
        ? "APROBADO PARA REVISIÓN REMOTA"
        : "BLOQUEADO"
      : "APROBADO LOCALMENTE";

  const torneoText = remote && remote.torneo
    ? `Confirmado: id ${remote.torneo.id}, ${remote.torneo.nombre}, anio ${remote.torneo.anio}, tipo ${remote.torneo.tipo}, activo ${remote.torneo.activo}.`
    : "Pendiente: no se ejecuto lectura remota.";

  const remoteStatus = remoteRequested
    ? remoteOk
      ? "aprobado"
      : "bloqueado"
    : "pendiente";

  return [
    "# Dry-run Clausura 2026",
    "",
    "## Fuente",
    "",
    `- Archivo: \`${fixtureInfo.path}\``,
    `- Tamaño: ${fixtureInfo.size} bytes`,
    `- SHA-256: \`${fixtureInfo.sha256}\``,
    `- Fecha de preparacion local del archivo: ${fixtureInfo.mtime.toISOString()}`,
    `- URL oficial: ${SOURCE_URL}`,
    "- Trazabilidad: el PDF citado en metadata es referencia de fuente original; no se requiere para este dry-run.",
    "- Nota: los 0-0 de la fuente oficial eran placeholders y se preparan como resultados nulos.",
    "- Nota: Zona 2 no tiene partidos en fechas 6, 7, 13 y 14 e inicia una semana mas tarde.",
    "",
    "## Validacion local",
    "",
    `- Clubes fuente: ${local.counts.sourceTeamsTotal}`,
    `- Partidos fuente: ${local.counts.matchesTotal}`,
    `- Fechas libres: ${local.counts.byesTotal}`,
    `- Partidos por zona: ${formatZoneCounts(local.counts.matchesByZone)}`,
    `- Fechas libres por zona: ${formatZoneCounts(local.counts.byesByZone)}`,
    `- Partidos por fecha: ${formatObjectCounts(local.counts.matchesByDate)}`,
    `- Fechas de Zona 2: ${local.counts.zone2Dates.join(", ")}`,
    `- Errores locales: ${local.errors.length}`,
    `- Warnings locales: ${local.warnings.length}`,
    "",
    "## Torneo y remoto",
    "",
    `- Torneo: ${torneoText}`,
    `- Acceso remoto usado: ${remoteRequested ? "Supabase REST publico, solo GET" : "no"}`,
    `- Partidos existentes Clausura: ${existing.existingCount}`,
    `- Nuevos esperados: ${existing.newRecords.length}`,
    `- Existentes identicos: ${existing.identical.length}`,
    `- Conflictos: ${existing.conflicts.length}`,
    `- Duplicados remotos: ${existing.duplicates.length}`,
    `- Participaciones: ${remote ? remote.participaciones.modelo : "pendiente"}`,
    `- Inscripciones de jugadores Clausura consultadas: ${remote ? remote.participaciones.inscripcionesJugadoresClausura : "pendiente"}`,
    "",
    "## Mapeo de clubes",
    "",
    mappingTable(local.mappings),
    "",
    "## Idempotencia",
    "",
    "- Clave logica: `torneo_id`, `tipo`, `fecha`, `zona`, `local_id`, `visitante_id`.",
    "- No se usa `fixture_key` como ID de base.",
    "- El dry-run clasifica nuevos, existentes identicos, conflictos y duplicados.",
    "",
    "## Desfase de Zona 2",
    "",
    "- La web publica filtra la vista de Partidos por numero de `fecha` oficial.",
    "- Una misma Fecha 1 puede contener partidos jugados en fines de semana distintos si sus `fecha_partido` reales difieren.",
    "- El inicio elige la menor fecha oficial pendiente; no ordena la fecha destacada por calendario real.",
    "- Los listados internos ordenan por `fecha_partido` cuando existe; si esta nula, quedan como fecha/hora a confirmar.",
    "- Cuando Zona 1 y Zona 3 esten en Fecha 2 y Zona 2 juegue Fecha 1, la interfaz actual no puede expresar bien el desfase solo con `fecha`.",
    "- No conviene crear partidos ficticios ni selector global de torneos.",
    "- Ajuste minimo recomendado futuro: agregar una pequena agrupacion/etiqueta por `fecha_partido` en agenda y detalle de fecha, manteniendo `fecha` como jornada oficial y ocultando Zona 2 en fechas sin partidos reales.",
    "",
    "## Resultado",
    "",
    `- Estado local: ${localOk ? "APROBADO LOCALMENTE" : "BLOQUEADO"}`,
    `- Estado remoto: ${remoteStatus}`,
    `- Estado final: ${finalState}`,
    "",
    "## Seguridad",
    "",
    "- Escrituras en Supabase: 0",
    "- Inserts: 0",
    "- Updates: 0",
    "- Deletes: 0",
    "- Cambios de RLS: 0",
    "- Cambios de produccion: 0",
    "- Credenciales agregadas: 0",
    "",
    "## Errores",
    "",
    local.errors.concat(remote ? remote.errors : []).length === 0
      ? "- Ninguno."
      : local.errors.concat(remote ? remote.errors : []).map(error =>
          `- ${error.message}`
        ).join("\n"),
    "",
    "## Warnings",
    "",
    local.warnings.concat(remote ? remote.warnings : []).length === 0
      ? "- Ninguno."
      : local.warnings.concat(remote ? remote.warnings : []).map(warning =>
          typeof warning === "string" ? `- ${warning}` : `- ${warning.message}`
        ).join("\n"),
    ""
  ].join("\n");
}

async function run(options) {
  const fixturePath = options.fixturePath || findFixtureJson();
  const mapPath = options.mapPath;
  const fixture = readJson(fixturePath);
  const mapData = readJson(mapPath);
  const fixtureInfo = getFileInfo(fixturePath);
  const local = validateFixture(fixture, mapData, options);

  let remoteValidation = null;
  let remoteError = null;
  if (options.remoteRead) {
    try {
      const remote = await readRemote(options);
      remoteValidation = validateRemote(remote, local, options);
    } catch (error) {
      remoteError = error;
      remoteValidation = {
        errors: [{ message: `No se pudo completar lectura remota: ${error.message}` }],
        warnings: [],
        torneo: null,
        existingAnalysis: analyzeExisting(local.records, []),
        participaciones: {
          modelo: "Pendiente por error de lectura remota.",
          inscripcionesJugadoresClausura: null
        }
      };
    }
  }

  const report = buildReport({
    fixtureInfo,
    local,
    remoteValidation,
    remoteRequested: options.remoteRead
  });

  if (options.writeReport) {
    fs.mkdirSync(path.dirname(options.reportPath), { recursive: true });
    fs.writeFileSync(options.reportPath, report, "utf8");
  }

  const existing = remoteValidation && remoteValidation.existingAnalysis
    ? remoteValidation.existingAnalysis
    : analyzeExisting(local.records, []);
  const localOk = local.errors.length === 0;
  const remoteOk = options.remoteRead &&
    remoteValidation &&
    remoteValidation.errors.length === 0 &&
    existing.conflicts.length === 0 &&
    existing.duplicates.length === 0;

  return {
    fixtureInfo,
    local,
    remoteValidation,
    remoteError,
    report,
    summary: {
      localStatus: localOk ? "APROBADO LOCALMENTE" : "BLOQUEADO",
      remoteStatus: !options.remoteRead
        ? "PENDIENTE"
        : remoteOk
          ? "APROBADO PARA REVISIÓN REMOTA"
          : "BLOQUEADO",
      matches: local.counts.matchesTotal,
      records: local.records.length,
      newRecords: existing.newRecords.length,
      identical: existing.identical.length,
      conflicts: existing.conflicts.length,
      duplicates: existing.duplicates.length,
      writes: 0,
      reportPath: options.writeReport
        ? path.relative(ROOT, options.reportPath).replace(/\\/g, "/")
        : null
    }
  };
}

async function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
      console.log(usage());
      return;
    }
    const result = await run(options);
    console.log(JSON.stringify(result.summary, null, 2));
    if (
      result.summary.localStatus === "BLOQUEADO" ||
      result.summary.remoteStatus === "BLOQUEADO"
    ) {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  EXPECTED,
  INSERT_FIELDS,
  REMOTE_HTTP_METHODS,
  analyzeExisting,
  buildMapIndex,
  buildRecord,
  buildReport,
  compareRecordToExisting,
  findFixtureJson,
  logicalKey,
  normalizeClubName,
  parseArgs,
  readJson,
  run,
  validateFixture
};
