const fs = require("node:fs");
const path = require("node:path");

const GOAL_TYPES = new Set(["gol", "gol_penal"]);
const PUBLIC_ZONE_KEYS = ["1", "2", "3"];
const SOURCE_EVENTS = "eventos_identificados";
const SOURCE_SNAPSHOT = "goleadores_oficiales";
const SNAPSHOT_TOURNAMENT_KEYS = new Set(["2026:apertura"]);
let publicConfigCache = null;

exports.handler = async event => {
  if (event.httpMethod === "OPTIONS") {
    return json(204, {});
  }
  if (event.httpMethod !== "GET") {
    return json(405, { error: "Metodo no permitido." });
  }

  const envError = getEnvError();
  if (envError) return json(500, { error: envError });

  try {
    const tournamentId = getTournamentId(
      event.queryStringParameters?.torneo_id
    );
    const tournament = await getTournament(tournamentId);

    if (!tournament) {
      return json(404, { error: "Torneo no encontrado." });
    }

    const source = getScorerSource(tournament);
    const result = source === SOURCE_EVENTS
      ? await buildEventScorers(tournament)
      : await buildSnapshotScorers(tournament);

    return json(200, {
      torneo: {
        id: tournament.id,
        nombre: tournament.nombre,
        anio: tournament.anio,
        tipo: tournament.tipo
      },
      fuente: source,
      mensaje_vacio: getEmptyMessage(source, tournament),
      tablas: result.tablas
    });
  } catch (error) {
    const statusCode = Number.isInteger(error.statusCode)
      ? error.statusCode
      : 500;
    console.error("goleadores-publicos error", {
      statusCode,
      code: error.code || null,
      message: error.message
    });

    return json(statusCode, {
      error: error.expose === false
        ? "Error interno."
        : error.message || "Error interno.",
      code: error.code || null
    });
  }
};

function getEnvError() {
  const config = getSupabaseConfig();

  if (!config.url) return "Falta SUPABASE_URL en Netlify.";
  if (!config.key) {
    return "Falta SUPABASE_ANON_KEY o SUPABASE_KEY en Netlify.";
  }
  return null;
}

function getTournamentId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw httpError(400, "VALIDATION", "Falta torneo_id valido.");
  }
  return id;
}

function getScorerSource(tournament) {
  const key = `${Number(tournament?.anio || 0)}:${String(
    tournament?.tipo || ""
  ).toLowerCase()}`;

  return SNAPSHOT_TOURNAMENT_KEYS.has(key)
    ? SOURCE_SNAPSHOT
    : SOURCE_EVENTS;
}

function getEmptyMessage(source, tournament) {
  if (source === SOURCE_EVENTS) {
    return "Todav\u00eda no hay goles cargados para este torneo.";
  }

  const name = tournament?.nombre || "este torneo";
  return `Todav\u00eda no hay snapshot de goleadores para ${name}.`;
}

async function getTournament(id) {
  const response = await supabaseFetch(
    "/rest/v1/torneos" +
    "?select=id,anio,tipo,nombre,activo" +
    `&id=eq.${encodeURIComponent(id)}` +
    "&limit=1"
  );
  const rows = await parseSupabaseResponse(response);
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function buildEventScorers(tournament) {
  const matches = await getTournamentMatches(tournament.id);
  const matchIds = matches.map(match => match.id);
  const matchById = new Map(
    matches.map(match => [String(match.id), match])
  );
  const events = await getConfirmedGoalEvents(matchIds);
  const enrollmentIds = uniqueIds(
    events.map(event => event.inscripcion_jugador_id)
  );
  const enrollments = await getEnrollments(enrollmentIds);

  return buildEventScorerTables({
    tournament,
    matchesById: matchById,
    events,
    enrollments
  });
}

async function buildSnapshotScorers(tournament) {
  const [matches, scorers] = await Promise.all([
    getTournamentMatches(tournament.id),
    getSnapshotScorers(tournament.id)
  ]);

  return buildSnapshotScorerTables({
    tournament,
    matches,
    scorers
  });
}

async function getTournamentMatches(tournamentId) {
  const response = await supabaseFetch(
    "/rest/v1/partidos" +
    "?select=id,torneo_id,tipo,zona,local_id,visitante_id,local,visitante" +
    `&torneo_id=eq.${encodeURIComponent(tournamentId)}` +
    "&order=id.asc"
  );
  const rows = await parseSupabaseResponse(response);
  return Array.isArray(rows) ? rows : [];
}

async function getConfirmedGoalEvents(matchIds) {
  const ids = uniqueIds(matchIds);
  if (ids.length === 0) return [];

  const responses = await Promise.all(
    chunk(ids, 120).map(group =>
      supabaseFetch(
        "/rest/v1/eventos_partido" +
        "?select=id,partido_id,tipo,estado_dato,inscripcion_jugador_id,jugador" +
        `&partido_id=in.(${group.map(encodeURIComponent).join(",")})` +
        "&tipo=in.(gol,gol_penal)" +
        "&estado_dato=eq.confirmado" +
        "&inscripcion_jugador_id=not.is.null" +
        "&order=id.asc"
      )
    )
  );
  const groups = await Promise.all(responses.map(parseSupabaseResponse));

  return groups.flatMap(rows => Array.isArray(rows) ? rows : []);
}

async function getEnrollments(enrollmentIds) {
  const ids = uniqueIds(enrollmentIds);
  if (ids.length === 0) return [];

  const responses = await Promise.all(
    chunk(ids, 120).map(group =>
      supabaseFetch(
        "/rest/v1/inscripciones_jugadores" +
        "?select=id,jugador_id,club_id,torneo_id," +
        "jugador:jugadores(id,nombre_completo)," +
        "club:clubes(id,nombre_corto,nombre_oficial)" +
        `&id=in.(${group.map(encodeURIComponent).join(",")})` +
        "&order=id.asc"
      )
    )
  );
  const groups = await Promise.all(responses.map(parseSupabaseResponse));

  return groups.flatMap(rows => Array.isArray(rows) ? rows : []);
}

async function getSnapshotScorers(tournamentId) {
  const response = await supabaseFetch(
    "/rest/v1/goleadores_oficiales" +
    "?select=id,torneo_id,posicion,equipo_id,equipo_nombre,jugador_nombre,goles" +
    `&torneo_id=eq.${encodeURIComponent(tournamentId)}` +
    "&order=posicion.asc"
  );
  const rows = await parseSupabaseResponse(response);
  return Array.isArray(rows) ? rows : [];
}

function buildEventScorerTables({
  tournament,
  matchesById,
  events,
  enrollments
}) {
  const enrollmentsById = new Map(
    (enrollments || []).map(enrollment => [
      String(enrollment.id),
      enrollment
    ])
  );
  const general = new Map();
  const byZone = createZoneMaps();

  (events || []).forEach(event => {
    if (!isCountableGoalEvent(event)) return;

    const match = matchesById.get(String(event.partido_id));
    const enrollment = enrollmentsById.get(
      String(event.inscripcion_jugador_id)
    );
    const scorer = resolveScorerFromEnrollment(enrollment, tournament);

    if (!match || !scorer) return;

    addGoal(general, scorer);

    const zoneKey = getMatchZoneKey(match);
    if (zoneKey && byZone.has(zoneKey)) {
      addGoal(byZone.get(zoneKey), scorer);
    }
  });

  return {
    tablas: finalizeTables(general, byZone)
  };
}

function buildSnapshotScorerTables({ tournament, matches, scorers }) {
  const byZone = createZoneMaps();
  const zonesByClubId = getZonesByClubId(matches);
  const generalRows = normalizeSnapshotRows(scorers, tournament);

  generalRows.forEach(row => {
    const zones = zonesByClubId.get(String(row.equipo_id)) || new Set();
    zones.forEach(zoneKey => {
      if (byZone.has(zoneKey)) {
        byZone.get(zoneKey).set(row.key, { ...row });
      }
    });
  });

  return {
    tablas: {
      general: generalRows.map(stripInternalScorerKey),
      ...Object.fromEntries(
        PUBLIC_ZONE_KEYS.map(zoneKey => [
          zoneKey,
          sortSnapshotRows([...byZone.get(zoneKey).values()])
            .map(stripInternalScorerKey)
        ])
      )
    }
  };
}

function resolveScorerFromEnrollment(enrollment, tournament) {
  if (!enrollment) return null;
  if (String(enrollment.torneo_id) !== String(tournament.id)) return null;
  if (!enrollment.jugador_id || !enrollment.club_id) return null;

  const playerName = cleanText(enrollment.jugador?.nombre_completo);
  if (!playerName) return null;

  const clubName = cleanText(
    enrollment.club?.nombre_corto ||
    enrollment.club?.nombre_oficial
  ) || `Club #${enrollment.club_id}`;

  return {
    key: [
      `jugador:${enrollment.jugador_id}`,
      `club:${enrollment.club_id}`,
      `torneo:${enrollment.torneo_id}`
    ].join("|"),
    torneo_id: Number(tournament.id),
    equipo_id: Number(enrollment.club_id),
    equipo_nombre: clubName,
    jugador_nombre: playerName
  };
}

function addGoal(map, scorer) {
  const current = map.get(scorer.key) || {
    ...scorer,
    goles: 0
  };
  current.goles += 1;
  map.set(scorer.key, current);
}

function finalizeTables(general, byZone) {
  return {
    general: finalizeRows([...general.values()]),
    ...Object.fromEntries(
      PUBLIC_ZONE_KEYS.map(zoneKey => [
        zoneKey,
        finalizeRows([...byZone.get(zoneKey).values()])
      ])
    )
  };
}

function finalizeRows(rows) {
  return sortRows(rows)
    .filter(row => Number(row.goles) > 0)
    .map((row, index) => ({
      torneo_id: row.torneo_id,
      posicion: index + 1,
      equipo_id: row.equipo_id,
      equipo_nombre: row.equipo_nombre,
      jugador_nombre: row.jugador_nombre,
      goles: Number(row.goles)
    }));
}

function normalizeSnapshotRows(rows, tournament) {
  return sortSnapshotRows(
    (Array.isArray(rows) ? rows : [])
      .filter(row => Number(row.goles) > 0)
      .map(row => ({
        key: `snapshot:${row.id ?? row.posicion}`,
        torneo_id: Number(row.torneo_id || tournament.id),
        posicion: Number(row.posicion || 0),
        equipo_id: row.equipo_id === null || row.equipo_id === undefined
          ? null
          : Number(row.equipo_id),
        equipo_nombre: cleanText(row.equipo_nombre) || "Equipo",
        jugador_nombre: cleanText(row.jugador_nombre) || "Jugador",
        goles: Number(row.goles || 0)
      }))
  ).map((row, index) => ({
    torneo_id: row.torneo_id,
    posicion: row.posicion || index + 1,
    equipo_id: row.equipo_id,
    equipo_nombre: row.equipo_nombre,
    jugador_nombre: row.jugador_nombre,
    goles: row.goles,
    key: row.key
  }));
}

function sortRows(rows) {
  return [...rows].sort(
    (a, b) =>
      Number(b.goles || 0) - Number(a.goles || 0) ||
      compareText(a.jugador_nombre, b.jugador_nombre) ||
      compareText(a.equipo_nombre, b.equipo_nombre) ||
      Number(a.posicion || 0) - Number(b.posicion || 0)
  );
}

function sortSnapshotRows(rows) {
  return [...rows].sort(
    (a, b) =>
      Number(b.goles || 0) - Number(a.goles || 0) ||
      Number(a.posicion || 0) - Number(b.posicion || 0) ||
      compareText(a.jugador_nombre, b.jugador_nombre) ||
      compareText(a.equipo_nombre, b.equipo_nombre)
  );
}

function stripInternalScorerKey(row) {
  const { key, ...publicRow } = row;
  return publicRow;
}

function isCountableGoalEvent(event) {
  return GOAL_TYPES.has(String(event?.tipo || "").toLowerCase()) &&
    event?.estado_dato === "confirmado" &&
    event?.inscripcion_jugador_id !== null &&
    event?.inscripcion_jugador_id !== undefined;
}

function getZonesByClubId(matches) {
  const zonesByClubId = new Map();

  (Array.isArray(matches) ? matches : []).forEach(match => {
    if (String(match.tipo || "") !== "regular") return;

    const zoneKey = getMatchZoneKey(match);
    if (!zoneKey) return;

    [match.local_id, match.visitante_id].forEach(clubId => {
      if (clubId === null || clubId === undefined || clubId === "") return;

      const key = String(clubId);
      if (!zonesByClubId.has(key)) zonesByClubId.set(key, new Set());
      zonesByClubId.get(key).add(zoneKey);
    });
  });

  return zonesByClubId;
}

function getMatchZoneKey(match) {
  const zone = Number(match?.zona);
  if (!Number.isInteger(zone)) return null;

  const key = String(zone);
  return PUBLIC_ZONE_KEYS.includes(key) ? key : null;
}

function createZoneMaps() {
  return new Map(PUBLIC_ZONE_KEYS.map(zoneKey => [zoneKey, new Map()]));
}

function uniqueIds(values) {
  return [...new Set(
    (Array.isArray(values) ? values : [])
      .map(value => Number(value))
      .filter(value => Number.isInteger(value) && value > 0)
  )];
}

function chunk(values, size) {
  const chunks = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function cleanText(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function compareText(a, b) {
  return String(a ?? "").localeCompare(String(b ?? ""), "es", {
    sensitivity: "base"
  });
}

function httpError(statusCode, code, message, expose = true) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  error.expose = expose;
  return error;
}

async function supabaseFetch(path, options = {}) {
  const config = getSupabaseConfig();
  const url = config.url.replace(/\/+$/, "");
  const key = config.key;

  return fetch(`${url}${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
      ...(options.headers || {})
    }
  });
}

async function parseSupabaseResponse(response) {
  const text = await response.text();
  let body = null;

  if (text) {
    try {
      body = JSON.parse(text);
    } catch (error) {
      throw httpError(502, "SUPABASE_BAD_JSON", "Respuesta invalida.");
    }
  }

  if (!response.ok) {
    throw httpError(
      response.status || 502,
      body?.code || "SUPABASE_ERROR",
      body?.message || `Supabase respondio con estado ${response.status}.`,
      false
    );
  }

  return body;
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    },
    body: statusCode === 204 ? "" : JSON.stringify(body)
  };
}

function getSupabaseConfig() {
  return {
    url: process.env.SUPABASE_URL ||
      getPublicConfigValue("SUPABASE_URL"),
    key: process.env.SUPABASE_ANON_KEY ||
      process.env.SUPABASE_KEY ||
      getPublicConfigValue("SUPABASE_KEY")
  };
}

function getPublicConfigValue(name) {
  if (!publicConfigCache) {
    publicConfigCache = readPublicConfig();
  }

  return publicConfigCache[name] || "";
}

function readPublicConfig() {
  const configPath = path.resolve(__dirname, "..", "..", "js", "config.js");

  try {
    const source = fs.readFileSync(configPath, "utf8");
    return ["SUPABASE_URL", "SUPABASE_KEY"].reduce((config, name) => {
      const pattern = new RegExp(`const\\s+${name}\\s*=\\s*"([^"]+)"`);
      const match = pattern.exec(source);
      if (match) config[name] = match[1];
      return config;
    }, {});
  } catch (error) {
    return {};
  }
}

exports._private = {
  SOURCE_EVENTS,
  SOURCE_SNAPSHOT,
  getScorerSource,
  getEmptyMessage,
  buildEventScorerTables,
  buildSnapshotScorerTables,
  isCountableGoalEvent,
  getZonesByClubId
};
