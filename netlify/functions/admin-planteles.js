const POSITIONS = new Set([
  "arquero",
  "defensor",
  "mediocampista",
  "delantero",
  "sin_definir"
]);

const STATUSES = new Set([
  "confirmado",
  "por_verificar",
  "inactivo"
]);
const PLAYER_SELECT =
  "id,nombre_completo,nombre_normalizado,aliases,activo";
const SEARCH_LIMIT = 8;

exports.handler = async event => {
  if (event.httpMethod === "OPTIONS") {
    return json(204, {});
  }

  const envError = getEnvError();
  if (envError) return json(500, { error: envError });

  if (!isAuthorized(event)) {
    return json(401, { error: "No autorizado." });
  }

  try {
    if (event.httpMethod === "GET") {
      if (event.queryStringParameters?.scope === "buscar-jugador") {
        return await searchPlayers(event);
      }
      return await listRosters();
    }

    if (["POST", "PATCH"].includes(event.httpMethod)) {
      const body = parseBody(event);
      if (
        event.httpMethod === "POST" &&
        body.action === "crear-inscripcion-jugador"
      ) {
        return await createEnrollmentForExistingPlayer(body);
      }
      if (
        event.httpMethod === "POST" &&
        body.action === "crear-jugador-inscripcion"
      ) {
        return await createPlayerAndEnrollment(body);
      }
      return await saveRosterEntry(event, body);
    }

    return json(405, { error: "Metodo no permitido." });
  } catch (error) {
    const statusCode =
      ["VALIDATION", "P0001"].includes(error.code)
        ? 400
        : error.code === "23505"
          ? 409
          : 500;

    return json(statusCode, {
      error: readableError(error),
      code: error.code || null
    });
  }
};

function getEnvError() {
  if (!process.env.SUPABASE_URL) return "Falta SUPABASE_URL en Netlify.";
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return "Falta SUPABASE_SERVICE_ROLE_KEY en Netlify.";
  }
  if (!process.env.ADMIN_PASSWORD) return "Falta ADMIN_PASSWORD en Netlify.";
  return null;
}

function isAuthorized(event) {
  const password = event.headers["x-admin-password"] ||
    event.headers["X-Admin-Password"];
  return password && password === process.env.ADMIN_PASSWORD;
}

async function listRosters() {
  const [tournamentsResponse, entriesResponse] =
    await Promise.all([
      supabaseFetch(
        "/rest/v1/torneos?select=*&order=anio.desc,tipo.asc"
      ),
      supabaseFetch(
        "/rest/v1/inscripciones_jugadores" +
        "?select=*," +
        "jugador:jugadores(id,nombre_completo,nombre_normalizado,aliases,activo)" +
        "&order=club_id.asc,id.asc"
      )
    ]);

  const [torneos, inscripciones] = await Promise.all([
    parseSupabaseResponse(tournamentsResponse),
    parseSupabaseResponse(entriesResponse)
  ]);

  return json(200, {
    torneos,
    jugadores: [],
    inscripciones
  });
}

function parseBody(event) {
  try {
    return JSON.parse(event.body || "{}");
  } catch (error) {
    throw validationError("JSON invalido.");
  }
}

async function saveRosterEntry(event, body = null) {
  const input = sanitizeInput(body || parseBody(event));

  if (event.httpMethod === "PATCH" && !input.p_inscripcion_id) {
    throw validationError("Falta la inscripción a modificar.");
  }

  const response = await supabaseFetch(
    "/rest/v1/rpc/admin_guardar_inscripcion_jugador",
    {
      method: "POST",
      body: JSON.stringify(input)
    }
  );
  const resultado = await parseSupabaseResponse(response);

  return json(200, { resultado });
}

async function searchPlayers(event) {
  const params = event.queryStringParameters || {};
  const context = await getRosterContext(params);
  const name = cleanText(params.nombre || params.q);

  if (!name || name.length < 2) {
    throw validationError("Escribí al menos 2 letras.");
  }

  const result = await findPlayerCandidates({
    name,
    tournamentId: context.tournamentId,
    clubId: context.clubId
  });

  return json(200, {
    torneo_id: context.tournamentId,
    club_id: context.clubId,
    nombre: name,
    nombre_normalizado: result.normalized,
    candidatos: result.candidates
  });
}

async function createEnrollmentForExistingPlayer(body) {
  const context = await getRosterContext(body);
  if (body.busqueda_previa !== true) {
    throw validationError("Busca la persona antes de crear la inscripción.");
  }
  if (body.confirmar_inscripcion !== true) {
    throw validationError("Confirma la creación de la inscripción.");
  }

  const playerId = requiredId(body.jugador_id, "Jugador invalido.");
  const player = await getPlayer(playerId);
  if (!player) throw validationError("Jugador no encontrado.");
  if (player.activo === false) {
    throw validationError("El jugador no esta habilitado.");
  }

  const existing = await findEnrollment(
    playerId,
    context.clubId,
    context.tournamentId
  );
  if (existing) {
    return json(200, {
      mensaje: "Este jugador ya pertenece al plantel.",
      existente: true,
      jugador: player,
      inscripcion: normalizeEnrollment({
        ...existing,
        jugador: player
      })
    });
  }

  const inserted = await insertEnrollmentForPlayer({
    playerId,
    clubId: context.clubId,
    tournamentId: context.tournamentId
  });

  return json(201, {
    mensaje: "Inscripción creada.",
    existente: false,
    jugador: player,
    inscripcion: normalizeEnrollment({
      ...inserted,
      jugador: player
    })
  });
}

async function createPlayerAndEnrollment(body) {
  const context = await getRosterContext(body);
  if (body.busqueda_previa !== true) {
    throw validationError("Busca jugadores antes de crear una persona nueva.");
  }
  if (body.confirmar_creacion !== true) {
    throw validationError("Confirma la creación del jugador.");
  }

  const name = cleanText(body.nombre_completo);
  if (!name) {
    throw validationError("El nombre del jugador es obligatorio.");
  }

  const candidates = await findPlayerCandidates({
    name,
    tournamentId: context.tournamentId,
    clubId: context.clubId
  });
  if (
    candidates.candidates.length > 0 &&
    body.confirmar_homonimo !== true
  ) {
    throw validationError(
      "Puede existir un jugador con un nombre similar. Revisa los candidatos antes de crear otra persona."
    );
  }

  const response = await supabaseFetch(
    "/rest/v1/rpc/admin_guardar_inscripcion_jugador",
    {
      method: "POST",
      body: JSON.stringify({
        p_inscripcion_id: null,
        p_jugador_id: null,
        p_nombre_completo: name,
        p_aliases: [],
        p_club_id: context.clubId,
        p_torneo_id: context.tournamentId,
        p_posicion: "sin_definir",
        p_dorsal: null,
        p_estado: "por_verificar",
        p_fecha_desde: null,
        p_fecha_hasta: null,
        p_fuente: null,
        p_observaciones: "Creado desde búsqueda progresiva de planteles."
      })
    }
  );
  const result = await parseSupabaseResponse(response);

  return json(201, {
    mensaje: "Jugador e inscripción creados.",
    jugador: result.jugador,
    inscripcion: normalizeEnrollment({
      ...result.inscripcion,
      jugador: result.jugador
    })
  });
}

function sanitizeInput(body) {
  const nombre = cleanText(body.nombre_completo);
  const inscripcionId = optionalId(body.inscripcion_id);
  const jugadorId = optionalId(body.jugador_id);
  const clubId = requiredId(body.club_id, "Club invalido.");
  const torneoId = requiredId(body.torneo_id, "Torneo invalido.");
  const posicion = String(body.posicion || "sin_definir");
  const estado = String(body.estado || "por_verificar");
  const dorsal = optionalNumber(body.dorsal);
  const fechaDesde = optionalDate(body.fecha_desde);
  const fechaHasta = optionalDate(body.fecha_hasta);
  const fuente = cleanText(body.fuente);

  if (!nombre) {
    throw validationError("El nombre del jugador es obligatorio.");
  }
  if (!POSITIONS.has(posicion)) {
    throw validationError("Posicion invalida.");
  }
  if (!STATUSES.has(estado)) {
    throw validationError("Estado invalido.");
  }
  if (estado === "confirmado" && !fuente) {
    throw validationError(
      "Un jugador confirmado debe tener una fuente."
    );
  }
  if (dorsal !== null && (dorsal < 1 || dorsal > 99)) {
    throw validationError("El dorsal debe estar entre 1 y 99.");
  }
  if (fechaDesde && fechaHasta && fechaHasta < fechaDesde) {
    throw validationError(
      "La fecha hasta no puede ser anterior a fecha desde."
    );
  }

  return {
    p_inscripcion_id: inscripcionId,
    p_jugador_id: jugadorId,
    p_nombre_completo: nombre,
    p_aliases: sanitizeAliases(body.aliases),
    p_club_id: clubId,
    p_torneo_id: torneoId,
    p_posicion: posicion,
    p_dorsal: dorsal,
    p_estado: estado,
    p_fecha_desde: fechaDesde,
    p_fecha_hasta: fechaHasta,
    p_fuente: fuente,
    p_observaciones: cleanText(body.observaciones)
  };
}

async function getRosterContext(source) {
  const tournamentId = requiredId(source.torneo_id, "Torneo invalido.");
  const clubId = requiredId(source.club_id, "Club invalido.");
  const [tournament, club] = await Promise.all([
    getTournament(tournamentId),
    getClub(clubId)
  ]);

  if (!tournament) throw validationError("Torneo no encontrado.");
  if (!club) throw validationError("Club no encontrado.");

  return {
    tournamentId,
    clubId,
    tournament,
    club
  };
}

async function getTournament(id) {
  const response = await supabaseFetch(
    "/rest/v1/torneos" +
    "?select=id,nombre,anio,tipo,activo" +
    `&id=eq.${encodeURIComponent(id)}` +
    "&limit=1"
  );
  const rows = await parseSupabaseResponse(response);
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function getClub(id) {
  const response = await supabaseFetch(
    "/rest/v1/clubes" +
    "?select=id,nombre_corto,nombre_oficial,activo" +
    `&id=eq.${encodeURIComponent(id)}` +
    "&limit=1"
  );
  const rows = await parseSupabaseResponse(response);
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function getPlayer(id) {
  const response = await supabaseFetch(
    "/rest/v1/jugadores" +
    `?select=${PLAYER_SELECT}` +
    `&id=eq.${encodeURIComponent(id)}` +
    "&limit=1"
  );
  const rows = await parseSupabaseResponse(response);
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function findPlayerCandidates({ name, tournamentId, clubId }) {
  const normalized = await normalizePlayerNameWithDatabase(name);
  if (!normalized) return { normalized: null, candidates: [] };

  const [
    exactPlayers,
    partialPlayers,
    exactAliases,
    partialAliases
  ] = await Promise.all([
    fetchPlayers(
      `&nombre_normalizado=eq.${encodeURIComponent(normalized)}`
    ),
    fetchPlayers(
      `&nombre_normalizado=ilike.*${encodeURIComponent(normalized)}*`
    ),
    fetchAliases(
      `&alias_normalizado=eq.${encodeURIComponent(normalized)}`
    ),
    fetchAliases(
      `&alias_normalizado=ilike.*${encodeURIComponent(normalized)}*`
    )
  ]);

  const byPlayer = new Map();
  exactPlayers.forEach(player =>
    addCandidate(byPlayer, player, "nombre normalizado", true)
  );
  partialPlayers.forEach(player =>
    addCandidate(byPlayer, player, "nombre similar", false)
  );
  exactAliases.forEach(alias =>
    addAliasCandidate(byPlayer, alias, "alias confirmado", true)
  );
  partialAliases.forEach(alias =>
    addAliasCandidate(byPlayer, alias, "alias similar", false)
  );

  const playerIds = [...byPlayer.keys()];
  const inscriptions = await getInscriptionsForPlayers(playerIds);
  const byPlayerInscriptions = groupInscriptionsByPlayer(inscriptions);

  const candidates = [...byPlayer.values()]
    .map(candidate => {
      const playerInscriptions =
        byPlayerInscriptions.get(String(candidate.jugador.id)) || [];
      const contextEnrollment = playerInscriptions.find(enrollment =>
        String(enrollment.torneo_id) === String(tournamentId) &&
        String(enrollment.club_id) === String(clubId)
      ) || null;

      return {
        jugador: candidate.jugador,
        coincidencias: [...candidate.coincidencias],
        coincidencia_exacta: candidate.coincidencia_exacta,
        inscripcion_contexto: contextEnrollment,
        inscripciones: playerInscriptions
      };
    })
    .sort(compareCandidates)
    .slice(0, SEARCH_LIMIT);

  return {
    normalized,
    candidates
  };
}

async function normalizePlayerNameWithDatabase(name) {
  const response = await supabaseFetch(
    "/rest/v1/rpc/tp_normalizar_nombre_jugador",
    {
      method: "POST",
      body: JSON.stringify({ p_nombre: name })
    }
  );
  const result = await parseSupabaseResponse(response);
  return cleanText(
    typeof result === "string"
      ? result
      : result?.tp_normalizar_nombre_jugador || result
  );
}

async function fetchPlayers(filter) {
  const response = await supabaseFetch(
    "/rest/v1/jugadores" +
    `?select=${PLAYER_SELECT}` +
    filter +
    "&order=nombre_completo.asc" +
    `&limit=${SEARCH_LIMIT}`
  );
  const rows = await parseSupabaseResponse(response);
  return Array.isArray(rows) ? rows : [];
}

async function fetchAliases(filter) {
  const response = await supabaseFetch(
    "/rest/v1/jugadores_aliases" +
    "?select=id,jugador_id,alias,alias_normalizado,club_id,torneo_id," +
    "confirmado,jugador:jugadores(id,nombre_completo,nombre_normalizado,activo)" +
    "&confirmado=eq.true" +
    filter +
    `&limit=${SEARCH_LIMIT}`
  );
  const rows = await parseSupabaseResponse(response);
  return Array.isArray(rows) ? rows : [];
}

function addAliasCandidate(map, alias, reason, exact) {
  if (!alias?.jugador) return;
  addCandidate(map, alias.jugador, reason, exact);
}

function addCandidate(map, player, reason, exact) {
  if (!player?.id) return;
  const key = String(player.id);
  const current = map.get(key) || {
    jugador: {
      id: player.id,
      nombre_completo: player.nombre_completo,
      nombre_normalizado: player.nombre_normalizado || null,
      activo: player.activo !== false
    },
    coincidencias: new Set(),
    coincidencia_exacta: false
  };

  current.coincidencias.add(reason);
  current.coincidencia_exacta = current.coincidencia_exacta || exact;
  map.set(key, current);
}

async function getInscriptionsForPlayers(playerIds) {
  if (playerIds.length === 0) return [];
  const response = await supabaseFetch(
    "/rest/v1/inscripciones_jugadores" +
    "?select=id,jugador_id,club_id,torneo_id,posicion,dorsal,estado," +
    "club:clubes(id,nombre_corto,nombre_oficial)," +
    "torneo:torneos(id,nombre,anio,tipo)" +
    `&jugador_id=in.(${playerIds.map(encodeURIComponent).join(",")})` +
    "&order=torneo_id.desc,club_id.asc,id.asc"
  );
  const rows = await parseSupabaseResponse(response);
  return (Array.isArray(rows) ? rows : []).map(normalizeKnownEnrollment);
}

function normalizeKnownEnrollment(enrollment) {
  return {
    id: enrollment.id,
    jugador_id: enrollment.jugador_id,
    club_id: enrollment.club_id,
    torneo_id: enrollment.torneo_id,
    posicion: enrollment.posicion || "sin_definir",
    dorsal: enrollment.dorsal ?? null,
    estado: enrollment.estado || "por_verificar",
    club_nombre:
      enrollment.club?.nombre_corto ||
      enrollment.club?.nombre_oficial ||
      `Club #${enrollment.club_id}`,
    torneo_nombre:
      enrollment.torneo?.nombre ||
      [
        enrollment.torneo?.tipo,
        enrollment.torneo?.anio
      ].filter(Boolean).join(" ") ||
      `Torneo #${enrollment.torneo_id}`
  };
}

function groupInscriptionsByPlayer(inscriptions) {
  return inscriptions.reduce((map, enrollment) => {
    const key = String(enrollment.jugador_id);
    const current = map.get(key) || [];
    current.push(enrollment);
    map.set(key, current);
    return map;
  }, new Map());
}

function compareCandidates(a, b) {
  const contextA = a.inscripcion_contexto ? 0 : 1;
  const contextB = b.inscripcion_contexto ? 0 : 1;
  if (contextA !== contextB) return contextA - contextB;
  if (a.coincidencia_exacta !== b.coincidencia_exacta) {
    return a.coincidencia_exacta ? -1 : 1;
  }
  if (a.jugador.activo !== b.jugador.activo) {
    return a.jugador.activo ? -1 : 1;
  }
  return String(a.jugador.nombre_completo || "").localeCompare(
    String(b.jugador.nombre_completo || ""),
    "es",
    { sensitivity: "base" }
  ) || Number(a.jugador.id || 0) - Number(b.jugador.id || 0);
}

async function findEnrollment(playerId, clubId, tournamentId) {
  const response = await supabaseFetch(
    "/rest/v1/inscripciones_jugadores" +
    "?select=*" +
    `&jugador_id=eq.${playerId}` +
    `&club_id=eq.${clubId}` +
    `&torneo_id=eq.${tournamentId}` +
    "&limit=1"
  );
  const rows = await parseSupabaseResponse(response);
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function insertEnrollmentForPlayer({ playerId, clubId, tournamentId }) {
  try {
    const response = await supabaseFetch(
      "/rest/v1/inscripciones_jugadores?select=*",
      {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          jugador_id: playerId,
          club_id: clubId,
          torneo_id: tournamentId,
          posicion: "sin_definir",
          dorsal: null,
          estado: "por_verificar",
          fecha_desde: null,
          fecha_hasta: null,
          fuente: null,
          observaciones: "Creado desde búsqueda progresiva de planteles."
        })
      }
    );
    const rows = await parseSupabaseResponse(response);
    return Array.isArray(rows) ? rows[0] || null : rows;
  } catch (error) {
    if (error.code !== "23505") throw error;
    return await findEnrollment(playerId, clubId, tournamentId);
  }
}

function normalizeEnrollment(enrollment) {
  return {
    id: enrollment.id,
    jugador_id: enrollment.jugador_id,
    club_id: enrollment.club_id,
    torneo_id: enrollment.torneo_id,
    posicion: enrollment.posicion || "sin_definir",
    dorsal: enrollment.dorsal ?? null,
    estado: enrollment.estado || "por_verificar",
    fecha_desde: enrollment.fecha_desde || null,
    fecha_hasta: enrollment.fecha_hasta || null,
    jugador: enrollment.jugador
      ? {
          id: enrollment.jugador.id,
          nombre_completo: enrollment.jugador.nombre_completo,
          nombre_normalizado: enrollment.jugador.nombre_normalizado || null,
          activo: enrollment.jugador.activo !== false
        }
      : null
  };
}

function optionalId(value) {
  if (value === null || value === undefined || value === "") return null;
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw validationError("ID invalido.");
  }
  return id;
}

function requiredId(value, message) {
  const id = optionalId(value);
  if (!id) throw validationError(message);
  return id;
}

function optionalNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  if (!Number.isInteger(number)) {
    throw validationError("Valor numerico invalido.");
  }
  return number;
}

function optionalDate(value) {
  const date = cleanText(value);
  if (!date) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw validationError("Fecha invalida.");
  }
  return date;
}

function sanitizeAliases(value) {
  const aliases = Array.isArray(value)
    ? value
    : String(value || "").split(",");

  return [
    ...new Set(
      aliases
        .map(alias => cleanText(alias))
        .filter(Boolean)
    )
  ].slice(0, 20);
}

function cleanText(value) {
  if (value === null || value === undefined) return null;
  return String(value).trim() || null;
}

function validationError(message) {
  const error = new Error(message);
  error.code = "VALIDATION";
  return error;
}

function readableError(error) {
  if (error.code === "23505") {
    return "Ese jugador ya esta inscripto en el club y torneo elegidos.";
  }
  return error.message || "Error interno.";
}

async function supabaseFetch(path, options = {}) {
  const url = `${process.env.SUPABASE_URL}${path}`;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  return fetch(url, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
}

async function parseSupabaseResponse(response) {
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const error = new Error(
      data?.message || data?.error || "Error de Supabase."
    );
    error.code = data?.code || null;
    throw error;
  }

  return data;
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    },
    body: statusCode === 204 ? "" : JSON.stringify(body)
  };
}
