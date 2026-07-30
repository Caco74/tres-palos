const EVENT_TYPES = new Set([
  "gol",
  "gol_penal",
  "gol_en_contra",
  "amarilla",
  "doble_amarilla",
  "roja",
  "cambio"
]);

const DATA_STATES = new Set([
  "confirmado",
  "por_verificar"
]);

const PERIODS = new Set([
  "primer_tiempo",
  "segundo_tiempo"
]);

const TOURNAMENT_SELECT = "id,anio,tipo,nombre,activo";
const ENROLLMENT_PLAYER_SELECT = [
  "id",
  "jugador_id",
  "club_id",
  "torneo_id",
  "posicion",
  "dorsal",
  "estado",
  "fecha_desde",
  "fecha_hasta",
  "jugador:jugadores(id,nombre_completo,nombre_normalizado,activo)"
].join(",");
const PLAYER_SELECT =
  "id,nombre_completo,nombre_normalizado,aliases,activo";
const CANDIDATE_LIMIT = 8;

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
      const scope = event.queryStringParameters?.scope || "";
      if (scope === "jugadores") {
        return await listEventPlayers(event);
      }
      if (scope === "buscar-jugador") {
        return await searchPlayerCandidates(event);
      }
      return await listEvents(event);
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
      if (
        event.httpMethod === "PATCH" &&
        body.action === "reordenar"
      ) {
        return await reorderEvents(body);
      }
      return await saveEvent(event, body);
    }

    if (event.httpMethod === "DELETE") {
      return await deleteEvent(event);
    }

    return json(405, { error: "Metodo no permitido." });
  } catch (error) {
    const statusCode = getErrorStatus(error);
    console.error("admin-incidencias error", {
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

function getErrorStatus(error) {
  if (Number.isInteger(error.statusCode)) return error.statusCode;
  if (error.code === "VALIDATION") return 400;
  if (error.code === "FORBIDDEN") return 403;
  if (error.code === "NOT_FOUND") return 404;
  if (["P0001", "23505", "CONFLICT"].includes(error.code)) return 409;
  return 500;
}

function httpError(statusCode, code, message, expose = true) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  error.expose = expose;
  return error;
}

function parseBody(event) {
  try {
    return JSON.parse(event.body || "{}");
  } catch (error) {
    throw validationError("JSON invalido.");
  }
}

function getTournamentId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw validationError("Falta torneo_id valido.");
  }
  return id;
}

async function getTournament(id) {
  const response = await supabaseFetch(
    "/rest/v1/torneos" +
    `?select=${TOURNAMENT_SELECT}` +
    `&id=eq.${encodeURIComponent(id)}` +
    "&limit=1"
  );
  const rows = await parseSupabaseResponse(response);
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function assertTournamentExists(tournamentId) {
  const tournament = await getTournament(tournamentId);
  if (!tournament) {
    throw httpError(404, "NOT_FOUND", "Torneo no encontrado.");
  }
  return tournament;
}

function assertMatchTournament(match, tournamentId) {
  if (!match?.torneo_id) {
    throw validationError("El partido no tiene torneo_id asignado.");
  }
  if (String(match.torneo_id) !== String(tournamentId)) {
    throw httpError(
      403,
      "FORBIDDEN",
      "El recurso pertenece a otro torneo."
    );
  }
}

async function listEvents(event) {
  const tournamentId = getTournamentId(
    event.queryStringParameters?.torneo_id
  );
  const tournament = await assertTournamentExists(tournamentId);
  const matchIds = await getTournamentMatchIds(tournamentId);
  if (matchIds.length === 0) {
    return json(200, { incidencias: [], torneo: tournament });
  }

  const response = await supabaseFetch(
    "/rest/v1/eventos_partido" +
    "?select=*" +
    `&partido_id=in.(${matchIds.map(encodeURIComponent).join(",")})` +
    "&order=partido_id.desc,orden.asc,id.asc"
  );
  const incidencias = await parseSupabaseResponse(response);
  return json(200, { incidencias, torneo: tournament });
}

async function listEventPlayers(event) {
  const context = await getEventContext(event.queryStringParameters || {});
  const includeIds = parseIncludeIds(
    event.queryStringParameters?.include_ids
  );
  const enrollments = await getEnrollmentsForEventContext(
    context,
    includeIds
  );

  return json(200, {
    torneo_id: context.tournamentId,
    partido_id: context.match.id,
    equipo_id: context.teamId,
    inscripciones: enrollments
  });
}

async function searchPlayerCandidates(event) {
  const params = event.queryStringParameters || {};
  const context = await getEventContext(params);
  const name = cleanText(params.nombre || params.q);

  if (!name) {
    throw validationError("Ingresa un nombre para buscar.");
  }

  const result = await findPlayerCandidates({
    name,
    tournamentId: context.tournamentId,
    teamId: context.teamId
  });

  return json(200, {
    torneo_id: context.tournamentId,
    partido_id: context.match.id,
    equipo_id: context.teamId,
    nombre: name,
    nombre_normalizado: result.normalized,
    candidatos: result.candidates,
    advertencia: result.candidates.length > 0
      ? "Puede existir un jugador con un nombre similar."
      : null
  });
}

async function getEventContext(source) {
  const tournamentId = getTournamentId(source.torneo_id);
  const tournament = await assertTournamentExists(tournamentId);
  const matchId = requiredId(source.partido_id, "Partido invalido.");
  const match = await getMatch(matchId);

  if (!match) throw httpError(404, "NOT_FOUND", "Partido no encontrado.");
  assertMatchTournament(match, tournamentId);

  const teamId = requiredId(source.equipo_id, "Equipo invalido.");
  assertTeamBelongsToMatch(match, teamId);

  return {
    tournament,
    tournamentId,
    match,
    teamId
  };
}

function assertTeamBelongsToMatch(match, teamId) {
  if (![match.local_id, match.visitante_id].some(
    id => String(id) === String(teamId)
  )) {
    throw validationError(
      "El equipo debe ser local o visitante del partido."
    );
  }
}

function parseIncludeIds(value) {
  if (!value) return [];
  return String(value)
    .split(",")
    .map(item => optionalId(item))
    .filter(Boolean);
}

async function getEnrollmentsForEventContext(context, includeIds = []) {
  const response = await supabaseFetch(
    "/rest/v1/inscripciones_jugadores" +
    `?select=${ENROLLMENT_PLAYER_SELECT}` +
    `&torneo_id=eq.${encodeURIComponent(context.tournamentId)}` +
    `&club_id=eq.${encodeURIComponent(context.teamId)}` +
    "&order=id.asc"
  );
  const rows = await parseSupabaseResponse(response);
  const include = new Set(includeIds.map(id => String(id)));

  return (Array.isArray(rows) ? rows : [])
    .filter(enrollment =>
      enrollmentIsAvailableForSelection(enrollment, include)
    )
    .map(normalizeEnrollment)
    .sort(compareEnrollmentsByPlayerName);
}

function enrollmentIsAvailableForSelection(enrollment, includeIds) {
  const included = includeIds.has(String(enrollment?.id));
  if (included) return true;
  return enrollment?.estado !== "inactivo" &&
    enrollment?.jugador?.activo !== false;
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

function compareEnrollmentsByPlayerName(a, b) {
  return String(a?.jugador?.nombre_completo || "").localeCompare(
    String(b?.jugador?.nombre_completo || ""),
    "es",
    { sensitivity: "base" }
  ) || Number(a?.id || 0) - Number(b?.id || 0);
}

async function saveEvent(event, parsedBody = null) {
  const body = parsedBody || parseBody(event);
  const tournamentId = getTournamentId(body.torneo_id);
  await assertTournamentExists(tournamentId);
  const eventId = optionalId(body.id);
  const existing = eventId ? await getEvent(eventId) : null;

  if (event.httpMethod === "PATCH" && !existing) {
    throw httpError(404, "NOT_FOUND", "Incidencia no encontrada.");
  }

  if (existing) {
    const currentMatch = await getMatch(existing.partido_id);
    if (!currentMatch) {
      throw httpError(
        404,
        "NOT_FOUND",
        "Partido de la incidencia no encontrado."
      );
    }
    assertMatchTournament(currentMatch, tournamentId);
  }

  const matchId = requiredId(
    body.partido_id ?? existing?.partido_id,
    "Partido invalido."
  );
  const match = await getMatch(matchId);
  if (!match) throw httpError(404, "NOT_FOUND", "Partido no encontrado.");
  assertMatchTournament(match, tournamentId);

  await assertStageOpen(match);

  const input = sanitizeInput(body, match, existing);
  let enrollment = null;
  const legacyWithoutEnrollment = Boolean(
    eventId &&
    !existing?.inscripcion_jugador_id &&
    cleanText(existing?.jugador) &&
    !input.inscripcion_jugador_id
  );

  if (input.inscripcion_jugador_id) {
    enrollment = await getEnrollment(
      input.inscripcion_jugador_id,
      match,
      input.equipo_id,
      {
        allowInactive:
          existing &&
          String(existing.inscripcion_jugador_id || "") ===
            String(input.inscripcion_jugador_id)
      }
    );
  } else if (!legacyWithoutEnrollment) {
    throw validationError(
      "Selecciona una inscripcion de jugador para la incidencia."
    );
  }

  const relatedEnrollment = input.inscripcion_relacionada_id
    ? await getEnrollment(
        input.inscripcion_relacionada_id,
        match,
        input.equipo_id,
        {
          allowInactive:
            existing &&
            String(existing.inscripcion_relacionada_id || "") ===
              String(input.inscripcion_relacionada_id)
        }
      )
    : null;

  input.orden = Number(existing?.orden) ||
    await getNextEventOrder(match.id);
  const tipoOriginal = input.tipo;
  input.tipo = await resolveAutomaticCardType(
    input,
    eventId
  );
  input.jugador = enrollment
    ? enrollment.jugador.nombre_completo
    : cleanText(existing?.jugador);
  input.jugador_relacionado = relatedEnrollment
    ? relatedEnrollment.jugador.nombre_completo
    : legacyWithoutEnrollment
      ? cleanText(existing?.jugador_relacionado)
      : null;
  input.actualizado_en = new Date().toISOString();

  const method = eventId ? "PATCH" : "POST";
  const path = eventId
    ? `/rest/v1/eventos_partido?id=eq.${eventId}` +
      `&partido_id=eq.${encodeURIComponent(existing.partido_id)}` +
      "&select=*"
    : "/rest/v1/eventos_partido?select=*";
  const {
    rows,
    periodoOmitido
  } = await persistEvent(path, method, input);
  const incidencia = Array.isArray(rows) ? rows[0] : rows;
  if (!incidencia) {
    throw httpError(
      404,
      "NOT_FOUND",
      "Incidencia no encontrada para el torneo indicado."
    );
  }

  return json(eventId ? 200 : 201, {
    incidencia,
    periodo_omitido: periodoOmitido,
    ajuste_tipo:
      tipoOriginal !== input.tipo
        ? {
            de: tipoOriginal,
            a: input.tipo,
            motivo: "segunda_amarilla"
          }
        : null
  });
}

async function persistEvent(path, method, input) {
  try {
    const response = await supabaseFetch(path, {
      method,
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(input)
    });
    return {
      rows: await parseSupabaseResponse(response),
      periodoOmitido: false
    };
  } catch (error) {
    const columnaPeriodoFaltante =
      error.code === "PGRST204" &&
      String(error.message).toLowerCase().includes("periodo");

    if (!columnaPeriodoFaltante) throw error;

    const fallback = { ...input };
    delete fallback.periodo;
    const response = await supabaseFetch(path, {
      method,
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(fallback)
    });

    return {
      rows: await parseSupabaseResponse(response),
      periodoOmitido: true
    };
  }
}

async function createEnrollmentForExistingPlayer(body) {
  const context = await getEventContext(body);
  if (body.busqueda_previa !== true) {
    throw validationError("Busca la persona antes de crear la inscripcion.");
  }
  if (body.confirmar_inscripcion !== true) {
    throw validationError("Confirma la creacion de la inscripcion.");
  }

  const playerId = requiredId(body.jugador_id, "Jugador invalido.");
  const player = await getPlayer(playerId);
  if (!player) throw httpError(404, "NOT_FOUND", "Jugador no encontrado.");
  if (player.activo === false) {
    throw validationError("El jugador no esta habilitado.");
  }

  const existing = await findEnrollment(
    playerId,
    context.teamId,
    context.tournamentId
  );
  if (existing) {
    return json(200, {
      mensaje: "Ya existe una inscripcion para este jugador.",
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
    clubId: context.teamId,
    tournamentId: context.tournamentId,
    source: cleanText(body.fuente),
    notes: "Creado desde Jugador no encontrado en incidencias."
  });

  return json(201, {
    mensaje: "Inscripcion creada.",
    existente: false,
    jugador: player,
    inscripcion: normalizeEnrollment({
      ...inserted,
      jugador: player
    })
  });
}

async function createPlayerAndEnrollment(body) {
  const context = await getEventContext(body);
  if (body.busqueda_previa !== true) {
    throw validationError("Busca la persona antes de crear un jugador nuevo.");
  }
  if (body.confirmar_creacion !== true) {
    throw validationError("Confirma la creacion del jugador.");
  }

  const name = cleanText(body.nombre_completo);
  if (!name) {
    throw validationError("El nombre del jugador es obligatorio.");
  }

  const candidates = await findPlayerCandidates({
    name,
    tournamentId: context.tournamentId,
    teamId: context.teamId
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
        p_club_id: context.teamId,
        p_torneo_id: context.tournamentId,
        p_posicion: "sin_definir",
        p_dorsal: null,
        p_estado: "por_verificar",
        p_fecha_desde: null,
        p_fecha_hasta: null,
        p_fuente: cleanText(body.fuente),
        p_observaciones:
          "Creado desde Jugador no encontrado en incidencias."
      })
    }
  );
  const result = await parseSupabaseResponse(response);

  return json(201, {
    mensaje: "Jugador e inscripcion creados.",
    jugador: result.jugador,
    inscripcion: normalizeEnrollment({
      ...result.inscripcion,
      jugador: result.jugador
    })
  });
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

async function insertEnrollmentForPlayer({
  playerId,
  clubId,
  tournamentId,
  source,
  notes
}) {
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
          fuente: source,
          observaciones: notes
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

async function findPlayerCandidates({ name, tournamentId, teamId }) {
  const normalized = await normalizePlayerNameWithDatabase(name);
  if (!normalized) {
    return { normalized: null, candidates: [] };
  }

  const [
    exactPlayers,
    partialPlayers,
    exactAliases,
    partialAliases
  ] = await Promise.all([
    fetchPlayers(
      `&nombre_normalizado=eq.${encodeURIComponent(normalized)}`
    ),
    normalized.length >= 3
      ? fetchPlayers(
          `&nombre_normalizado=ilike.*${encodeURIComponent(normalized)}*`
        )
      : [],
    fetchAliases(
      `&alias_normalizado=eq.${encodeURIComponent(normalized)}`
    ),
    normalized.length >= 3
      ? fetchAliases(
          `&alias_normalizado=ilike.*${encodeURIComponent(normalized)}*`
        )
      : []
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
        String(enrollment.club_id) === String(teamId)
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
    .slice(0, CANDIDATE_LIMIT);

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
    `&limit=${CANDIDATE_LIMIT}`
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
    `&limit=${CANDIDATE_LIMIT}`
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
  return (Array.isArray(rows) ? rows : []).map(enrollment => ({
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
  }));
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

async function deleteEvent(event) {
  const body = parseBody(event);
  const tournamentId = getTournamentId(body.torneo_id);
  await assertTournamentExists(tournamentId);
  const eventId = requiredId(body.id, "Incidencia invalida.");
  const existing = await getEvent(eventId);

  if (!existing) {
    throw httpError(404, "NOT_FOUND", "Incidencia no encontrada.");
  }

  const match = await getMatch(existing.partido_id);
  if (!match) {
    throw httpError(
      404,
      "NOT_FOUND",
      "Partido de la incidencia no encontrado."
    );
  }
  assertMatchTournament(match, tournamentId);
  await assertStageOpen(match);

  const response = await supabaseFetch(
    `/rest/v1/eventos_partido?id=eq.${eventId}` +
      `&partido_id=eq.${encodeURIComponent(existing.partido_id)}`,
    {
      method: "DELETE",
      headers: { Prefer: "return=representation" }
    }
  );
  const deleted = await parseSupabaseResponse(response);
  if (Array.isArray(deleted) && deleted.length === 0) {
    throw httpError(
      404,
      "NOT_FOUND",
      "Incidencia no encontrada para el torneo indicado."
    );
  }

  return json(200, { eliminado: eventId });
}

async function reorderEvents(body) {
  const tournamentId = getTournamentId(body.torneo_id);
  await assertTournamentExists(tournamentId);
  const matchId = requiredId(
    body.partido_id,
    "Partido invalido."
  );
  const ids = Array.isArray(body.ids)
    ? body.ids.map(id => requiredId(id, "Incidencia invalida."))
    : [];

  if (ids.length === 0 || new Set(ids).size !== ids.length) {
    throw validationError(
      "El nuevo orden debe incluir incidencias unicas."
    );
  }

  const match = await getMatch(matchId);
  if (!match) throw httpError(404, "NOT_FOUND", "Partido no encontrado.");
  assertMatchTournament(match, tournamentId);
  await assertStageOpen(match);

  const existing = await getMatchEvents(matchId);
  const existingIds = existing.map(item => Number(item.id));
  const sameEvents =
    existingIds.length === ids.length &&
    existingIds.every(id => ids.includes(id));

  if (!sameEvents) {
    throw validationError(
      "El orden debe incluir todas las incidencias del partido."
    );
  }

  const original = new Map(
    existing.map(item => [Number(item.id), Number(item.orden) || null])
  );

  try {
    for (let index = 0; index < ids.length; index += 1) {
      await patchEventOrder(ids[index], 100000 + index, matchId);
    }
    for (let index = 0; index < ids.length; index += 1) {
      await patchEventOrder(ids[index], index + 1, matchId);
    }
  } catch (error) {
    for (const [id, order] of original.entries()) {
      try {
        await patchEventOrder(id, order, matchId);
      } catch (rollbackError) {
        console.error(
          "No se pudo restaurar el orden de incidencia:",
          rollbackError
        );
      }
    }
    throw error;
  }

  return json(200, {
    partido_id: matchId,
    ids
  });
}

async function getMatchEvents(matchId) {
  const response = await supabaseFetch(
    "/rest/v1/eventos_partido" +
    "?select=id,orden" +
    `&partido_id=eq.${matchId}` +
    "&order=orden.asc.nullslast,id.asc"
  );
  const rows = await parseSupabaseResponse(response);
  return Array.isArray(rows) ? rows : [];
}

async function patchEventOrder(id, order, matchId) {
  const response = await supabaseFetch(
    `/rest/v1/eventos_partido?id=eq.${id}` +
      `&partido_id=eq.${encodeURIComponent(matchId)}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        orden: order,
        actualizado_en: new Date().toISOString()
      })
    }
  );
  const updated = await parseSupabaseResponse(response);
  if (Array.isArray(updated) && updated.length === 0) {
    throw httpError(
      404,
      "NOT_FOUND",
      "Incidencia no encontrada para el partido indicado."
    );
  }
}

function sanitizeInput(body, match, existing = null) {
  const tipo = String(body.tipo || "").trim();
  const equipoId = requiredId(body.equipo_id, "Equipo invalido.");
  const estadoDato = String(
    body.estado_dato || "por_verificar"
  ).trim();
  const fuente = cleanText(body.fuente);
  let inscriptionId = optionalId(body.inscripcion_jugador_id);
  let relatedId = optionalId(body.inscripcion_relacionada_id);
  const periodo = cleanText(body.periodo);
  const minuto = optionalInteger(body.minuto);

  if (!EVENT_TYPES.has(tipo)) {
    throw validationError("Tipo de incidencia invalido.");
  }
  if (!DATA_STATES.has(estadoDato)) {
    throw validationError("Estado de verificacion invalido.");
  }
  if (periodo && !PERIODS.has(periodo)) {
    throw validationError("Periodo invalido.");
  }
  if (minuto !== null && (minuto < 1 || minuto > 130)) {
    throw validationError("El minuto debe estar entre 1 y 130.");
  }
  assertTeamBelongsToMatch(match, equipoId);
  if (!match.torneo_id) {
    throw validationError("El partido no tiene torneo asignado.");
  }
  if (!inscriptionId && existing?.inscripcion_jugador_id) {
    inscriptionId = optionalId(existing.inscripcion_jugador_id);
  }
  if (
    tipo === "cambio" &&
    !relatedId &&
    existing?.inscripcion_relacionada_id
  ) {
    relatedId = optionalId(existing.inscripcion_relacionada_id);
  }
  const legacyWithoutEnrollment = Boolean(
    existing?.jugador &&
    !existing?.inscripcion_jugador_id &&
    !inscriptionId &&
    !relatedId
  );
  if (estadoDato === "confirmado" && !fuente) {
    throw validationError(
      "Una incidencia confirmada debe tener una fuente."
    );
  }
  if (
    tipo === "cambio" &&
    (!inscriptionId || !relatedId) &&
    !legacyWithoutEnrollment
  ) {
    throw validationError(
      "Para un cambio selecciona al jugador que sale y al que entra."
    );
  }
  if (tipo !== "cambio" && relatedId) {
    throw validationError(
      "El segundo jugador solo corresponde a un cambio."
    );
  }
  if (inscriptionId && relatedId && inscriptionId === relatedId) {
    throw validationError(
      "Los jugadores del cambio deben ser diferentes."
    );
  }

  return {
    partido_id: match.id,
    tipo,
    equipo_id: equipoId,
    inscripcion_jugador_id: inscriptionId,
    inscripcion_relacionada_id: relatedId,
    periodo,
    minuto,
    estado_dato: estadoDato,
    fuente,
    observaciones: cleanText(body.observaciones)
  };
}

async function resolveAutomaticCardType(input, eventId) {
  if (
    input.tipo !== "amarilla" ||
    !input.inscripcion_jugador_id
  ) {
    return input.tipo;
  }

  const response = await supabaseFetch(
    "/rest/v1/eventos_partido" +
    "?select=id,tipo,orden" +
    `&partido_id=eq.${input.partido_id}` +
    `&equipo_id=eq.${input.equipo_id}` +
    `&inscripcion_jugador_id=eq.${input.inscripcion_jugador_id}` +
    "&tipo=in.(amarilla,doble_amarilla)"
  );
  const rows = await parseSupabaseResponse(response);
  const anteriores = (Array.isArray(rows) ? rows : []).filter(
    item =>
      String(item.id) !== String(eventId || "") &&
      (
        !eventId ||
        Number(item.orden) < Number(input.orden)
      )
  );

  if (anteriores.some(item => item.tipo === "doble_amarilla")) {
    throw validationError(
      "El jugador ya fue expulsado por doble amarilla en este partido."
    );
  }

  return anteriores.some(item => item.tipo === "amarilla")
    ? "doble_amarilla"
    : "amarilla";
}

async function getNextEventOrder(matchId) {
  const response = await supabaseFetch(
    "/rest/v1/eventos_partido" +
    "?select=orden" +
    `&partido_id=eq.${matchId}` +
    "&order=orden.desc.nullslast,id.desc" +
    "&limit=1"
  );
  const rows = await parseSupabaseResponse(response);
  const current = Array.isArray(rows) ? rows[0]?.orden : null;
  return Number(current || 0) + 1;
}

async function getEvent(id) {
  const response = await supabaseFetch(
    `/rest/v1/eventos_partido?select=*&id=eq.${id}&limit=1`
  );
  const rows = await parseSupabaseResponse(response);
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function getMatch(id) {
  const response = await supabaseFetch(
    "/rest/v1/partidos" +
    "?select=id,tipo,fecha,fase,local,visitante," +
    "local_id,visitante_id,torneo_id" +
    `&id=eq.${id}&limit=1`
  );
  const rows = await parseSupabaseResponse(response);
  const match = Array.isArray(rows) ? rows[0] || null : null;
  return match ? await resolveMatchClubIds(match) : null;
}

async function getTournamentMatchIds(tournamentId) {
  const response = await supabaseFetch(
    "/rest/v1/partidos" +
    "?select=id" +
    `&torneo_id=eq.${encodeURIComponent(tournamentId)}` +
    "&order=id.asc"
  );
  const rows = await parseSupabaseResponse(response);
  return (Array.isArray(rows) ? rows : [])
    .map(match => Number(match.id))
    .filter(id => Number.isInteger(id) && id > 0);
}

async function resolveMatchClubIds(match) {
  if (match.local_id && match.visitante_id) return match;

  const response = await supabaseFetch(
    "/rest/v1/clubes" +
    "?select=id,nombre_oficial,nombre_corto,aliases" +
    "&activo=eq.true"
  );
  const clubs = await parseSupabaseResponse(response);

  return {
    ...match,
    local_id:
      match.local_id || findClubId(clubs, match.local),
    visitante_id:
      match.visitante_id || findClubId(clubs, match.visitante)
  };
}

function findClubId(clubs, teamName) {
  const key = normalizeClubName(teamName);
  if (!key || !Array.isArray(clubs)) return null;

  const club = clubs.find(item =>
    [
      item.nombre_oficial,
      item.nombre_corto,
      ...(Array.isArray(item.aliases) ? item.aliases : [])
    ].some(name => normalizeClubName(name) === key)
  );

  return club?.id || null;
}

function normalizeClubName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function getEnrollment(id, match, teamId, options = {}) {
  const response = await supabaseFetch(
    "/rest/v1/inscripciones_jugadores" +
    "?select=*,jugador:jugadores(id,nombre_completo,nombre_normalizado,activo)" +
    `&id=eq.${id}&limit=1`
  );
  const rows = await parseSupabaseResponse(response);
  const enrollment = Array.isArray(rows) ? rows[0] || null : null;

  if (!enrollment) {
    throw validationError("Inscripcion de jugador no encontrada.");
  }
  if (String(enrollment.club_id) !== String(teamId)) {
    throw validationError("El jugador no pertenece al equipo elegido.");
  }
  if (String(enrollment.torneo_id) !== String(match.torneo_id)) {
    throw validationError("El jugador no pertenece al torneo del partido.");
  }
  if (!enrollment.jugador?.id) {
    throw validationError("El jugador de la inscripcion no existe.");
  }
  if (!options.allowInactive) {
    if (enrollment.estado === "inactivo") {
      throw validationError("La inscripcion del jugador no esta habilitada.");
    }
    if (enrollment.jugador.activo === false) {
      throw validationError("El jugador no esta habilitado.");
    }
  }

  return enrollment;
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

async function assertStageOpen(match) {
  const stage = getMatchStage(match);
  if (!stage) return;
  if (!match.torneo_id) {
    const error = new Error(
      "El partido no tiene torneo_id; no se puede validar su etapa."
    );
    error.code = "VALIDATION";
    throw error;
  }

  try {
    const response = await supabaseFetch(
      "/rest/v1/etapas_estado" +
      "?select=estado,etiqueta" +
      `&torneo_id=eq.${encodeURIComponent(match.torneo_id)}` +
      `&tipo=eq.${encodeURIComponent(stage.tipo)}` +
      `&valor=eq.${encodeURIComponent(stage.valor)}` +
      "&estado=eq.cerrada&limit=1"
    );
    const rows = await parseSupabaseResponse(response);
    const closed = Array.isArray(rows) ? rows[0] || null : null;

    if (closed) {
      const error = new Error(
        `${closed.etiqueta || "La etapa"} esta cerrada. ` +
        "Reabrila antes de editar incidencias."
      );
      error.code = "P0001";
      throw error;
    }
  } catch (error) {
    if (["42P01", "PGRST205"].includes(error.code)) return;
    throw error;
  }
}

function getMatchStage(match) {
  if (match.tipo === "regular" && match.fecha !== null) {
    return { tipo: "regular", valor: String(match.fecha) };
  }
  if (match.tipo === "playoff" && match.fase) {
    return { tipo: "playoff", valor: String(match.fase) };
  }
  return null;
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

function optionalInteger(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  if (!Number.isInteger(number)) {
    throw validationError("Valor numerico invalido.");
  }
  return number;
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
    error.statusCode = 500;
    error.expose = false;
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
