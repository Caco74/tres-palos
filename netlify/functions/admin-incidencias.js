const EVENT_TYPES = new Set([
  "gol",
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
      return await listEvents();
    }

    if (["POST", "PATCH"].includes(event.httpMethod)) {
      return await saveEvent(event);
    }

    if (event.httpMethod === "DELETE") {
      return await deleteEvent(event);
    }

    return json(405, { error: "Metodo no permitido." });
  } catch (error) {
    const statusCode =
      error.code === "VALIDATION"
        ? 400
        : error.code === "P0001"
          ? 409
        : error.code === "23505"
          ? 409
          : 500;

    return json(statusCode, {
      error: error.message || "Error interno.",
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

async function listEvents() {
  const response = await supabaseFetch(
    "/rest/v1/eventos_partido" +
    "?select=id,partido_id,tipo,equipo_id,jugador,minuto,orden," +
    "inscripcion_jugador_id,inscripcion_relacionada_id," +
    "jugador_relacionado,estado_dato,fuente,observaciones,actualizado_en" +
    "&order=partido_id.desc,orden.asc,id.asc"
  );
  const incidencias = await parseSupabaseResponse(response);
  return json(200, { incidencias });
}

async function saveEvent(event) {
  const body = JSON.parse(event.body || "{}");
  const eventId = optionalId(body.id);
  const existing = eventId ? await getEvent(eventId) : null;
  const adjustScore = body.ajustar_resultado === true;

  if (event.httpMethod === "PATCH" && !existing) {
    return json(404, { error: "Incidencia no encontrada." });
  }
  if (eventId && adjustScore) {
    throw validationError(
      "El ajuste automatico de resultado solo admite incidencias nuevas."
    );
  }

  const matchId = requiredId(
    body.partido_id ?? existing?.partido_id,
    "Partido invalido."
  );
  const match = await getMatch(matchId);
  if (!match) return json(404, { error: "Partido no encontrado." });

  await assertStageOpen(match);
  if (adjustScore && match.estado === "finalizado") {
    throw validationError(
      "El partido esta finalizado. Reabrilo antes de cargar incidencias."
    );
  }

  const input = sanitizeInput(body, match);
  const scoreBefore = adjustScore && isGoalType(input.tipo)
    ? await getMatchScore(match)
    : null;
  let enrollment = null;

  if (input.inscripcion_jugador_id) {
    enrollment = await getEnrollment(
      input.inscripcion_jugador_id,
      match,
      input.equipo_id
    );
  } else if (
    body.crear_desde_texto === true &&
    cleanText(existing?.jugador)
  ) {
    enrollment = await createProvisionalEnrollment({
      name: cleanText(existing.jugador),
      clubId: input.equipo_id,
      tournamentId: match.torneo_id,
      source: input.fuente
    });
    input.inscripcion_jugador_id = enrollment.id;
  }

  const relatedEnrollment = input.inscripcion_relacionada_id
    ? await getEnrollment(
        input.inscripcion_relacionada_id,
        match,
        input.equipo_id
      )
    : null;

  input.jugador = enrollment
    ? enrollment.jugador.nombre_completo
    : cleanText(existing?.jugador);
  input.jugador_relacionado = relatedEnrollment
    ? relatedEnrollment.jugador.nombre_completo
    : null;
  input.orden = Number(existing?.orden) ||
    await getNextEventOrder(match.id);
  input.actualizado_en = new Date().toISOString();

  if (!eventId) {
    input.jugador = enrollment
      ? enrollment.jugador.nombre_completo
      : adjustScore
        ? "Jugador sin identificar"
        : "Jugador no informado";
  }

  const method = eventId ? "PATCH" : "POST";
  const path = eventId
    ? `/rest/v1/eventos_partido?id=eq.${eventId}&select=*`
    : "/rest/v1/eventos_partido?select=*";
  const response = await supabaseFetch(path, {
    method,
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(input)
  });
  const rows = await parseSupabaseResponse(response);
  const incidencia = Array.isArray(rows) ? rows[0] : rows;
  let updatedMatch = match;

  if (scoreBefore) {
    const scoreAfter = applyEventToScore(
      { ...scoreBefore },
      input,
      match,
      1
    );

    try {
      updatedMatch = await patchMatch(match.id, {
        goles_local: scoreAfter.local,
        goles_visitante: scoreAfter.visitante,
        estado: match.estado === "finalizado"
          ? "finalizado"
          : "en_vivo"
      });
    } catch (error) {
      try {
        const rollback = await supabaseFetch(
          `/rest/v1/eventos_partido?id=eq.${incidencia.id}`,
          { method: "DELETE" }
        );
        await parseSupabaseResponse(rollback);
      } catch (rollbackError) {
        console.error(
          "No se pudo revertir la incidencia:",
          rollbackError
        );
      }
      throw error;
    }
  }

  return json(eventId ? 200 : 201, {
    incidencia,
    partido: updatedMatch
  });
}

async function deleteEvent(event) {
  const body = JSON.parse(event.body || "{}");
  const eventId = requiredId(body.id, "Incidencia invalida.");
  const adjustScore = body.ajustar_resultado === true;
  const existing = await getEvent(eventId);

  if (!existing) {
    return json(404, { error: "Incidencia no encontrada." });
  }

  const match = await getMatch(existing.partido_id);
  if (match) await assertStageOpen(match);
  if (adjustScore && match?.estado === "finalizado") {
    throw validationError(
      "El partido esta finalizado. Reabrilo antes de deshacer."
    );
  }

  if (adjustScore) {
    const lastEvent = await getLastEvent(existing.partido_id);
    if (!lastEvent || String(lastEvent.id) !== String(eventId)) {
      throw validationError(
        "Solo se puede deshacer la ultima incidencia del partido."
      );
    }
  }

  const scoreBefore =
    adjustScore && match && isGoalType(existing.tipo)
      ? await getMatchScore(match)
      : null;
  const scoreAfter = scoreBefore
    ? applyEventToScore(
        { ...scoreBefore },
        existing,
        match,
        -1
      )
    : null;
  let updatedMatch = match;

  if (scoreAfter) {
    updatedMatch = await patchMatch(match.id, {
      goles_local: scoreAfter.local,
      goles_visitante: scoreAfter.visitante,
      estado: match.estado
    });
  }

  try {
    const response = await supabaseFetch(
      `/rest/v1/eventos_partido?id=eq.${eventId}`,
      { method: "DELETE" }
    );
    await parseSupabaseResponse(response);
  } catch (error) {
    if (scoreBefore) {
      await patchMatch(match.id, {
        goles_local: scoreBefore.local,
        goles_visitante: scoreBefore.visitante,
        estado: match.estado
      });
    }
    throw error;
  }

  return json(200, {
    eliminado: eventId,
    partido: updatedMatch
  });
}

function sanitizeInput(body, match) {
  const tipo = String(body.tipo || "").trim();
  const equipoId = requiredId(body.equipo_id, "Equipo invalido.");
  const estadoDato = String(
    body.estado_dato || "por_verificar"
  ).trim();
  const fuente = cleanText(body.fuente);
  const inscriptionId = optionalId(body.inscripcion_jugador_id);
  const relatedId = optionalId(body.inscripcion_relacionada_id);

  if (!EVENT_TYPES.has(tipo)) {
    throw validationError("Tipo de incidencia invalido.");
  }
  if (!DATA_STATES.has(estadoDato)) {
    throw validationError("Estado de verificacion invalido.");
  }
  if (![match.local_id, match.visitante_id].some(
    id => String(id) === String(equipoId)
  )) {
    throw validationError(
      "El equipo debe ser local o visitante del partido."
    );
  }
  if (!match.torneo_id) {
    throw validationError("El partido no tiene torneo asignado.");
  }
  if (estadoDato === "confirmado" && !fuente) {
    throw validationError(
      "Una incidencia confirmada debe tener una fuente."
    );
  }
  if (tipo === "cambio" && (!inscriptionId || !relatedId)) {
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
    estado_dato: estadoDato,
    fuente,
    observaciones: cleanText(body.observaciones)
  };
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

async function getLastEvent(matchId) {
  const response = await supabaseFetch(
    "/rest/v1/eventos_partido" +
    "?select=*" +
    `&partido_id=eq.${matchId}` +
    "&order=orden.desc.nullslast,id.desc" +
    "&limit=1"
  );
  const rows = await parseSupabaseResponse(response);
  return Array.isArray(rows) ? rows[0] || null : null;
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
    "local_id,visitante_id,torneo_id," +
    "goles_local,goles_visitante,estado" +
    `&id=eq.${id}&limit=1`
  );
  const rows = await parseSupabaseResponse(response);
  const match = Array.isArray(rows) ? rows[0] || null : null;
  return match ? await resolveMatchClubIds(match) : null;
}

function isGoalType(type) {
  return ["gol", "gol_en_contra"].includes(type);
}

async function getMatchScore(match) {
  const hasScore =
    match.goles_local !== null &&
    match.goles_local !== undefined &&
    match.goles_visitante !== null &&
    match.goles_visitante !== undefined;

  if (hasScore) {
    return {
      local: Number(match.goles_local) || 0,
      visitante: Number(match.goles_visitante) || 0
    };
  }

  const response = await supabaseFetch(
    "/rest/v1/eventos_partido" +
    "?select=tipo,equipo_id" +
    `&partido_id=eq.${match.id}` +
    "&order=orden.asc.nullslast,id.asc"
  );
  const rows = await parseSupabaseResponse(response);
  return (Array.isArray(rows) ? rows : []).reduce(
    (score, item) => applyEventToScore(score, item, match, 1),
    { local: 0, visitante: 0 }
  );
}

function applyEventToScore(score, item, match, amount) {
  if (!isGoalType(item.tipo)) return score;

  const scoringTeam = item.tipo === "gol"
    ? item.equipo_id
    : String(item.equipo_id) === String(match.local_id)
      ? match.visitante_id
      : match.local_id;

  if (String(scoringTeam) === String(match.local_id)) {
    score.local = Math.max(0, score.local + amount);
  } else if (
    String(scoringTeam) === String(match.visitante_id)
  ) {
    score.visitante = Math.max(0, score.visitante + amount);
  }

  return score;
}

async function patchMatch(matchId, patch) {
  const response = await supabaseFetch(
    `/rest/v1/partidos?id=eq.${matchId}&select=*`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(patch)
    }
  );
  const rows = await parseSupabaseResponse(response);
  return Array.isArray(rows) ? rows[0] || null : rows;
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

async function getEnrollment(id, match, teamId) {
  const response = await supabaseFetch(
    "/rest/v1/inscripciones_jugadores" +
    "?select=*,jugador:jugadores(id,nombre_completo,aliases)" +
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

  return enrollment;
}

async function createProvisionalEnrollment({
  name,
  clubId,
  tournamentId,
  source
}) {
  const existingPlayer = await findPlayerByName(name);
  const existingEnrollment = existingPlayer
    ? await findEnrollment(
        existingPlayer.id,
        clubId,
        tournamentId
      )
    : null;

  if (existingEnrollment) {
    return {
      ...existingEnrollment,
      jugador: existingPlayer
    };
  }

  const response = await supabaseFetch(
    "/rest/v1/rpc/admin_guardar_inscripcion_jugador",
    {
      method: "POST",
      body: JSON.stringify({
        p_inscripcion_id: null,
        p_jugador_id: existingPlayer?.id || null,
        p_nombre_completo: name,
        p_aliases: [],
        p_club_id: clubId,
        p_torneo_id: tournamentId,
        p_posicion: "sin_definir",
        p_dorsal: null,
        p_estado: "por_verificar",
        p_fecha_desde: null,
        p_fecha_hasta: null,
        p_fuente: source,
        p_observaciones:
          "Creado al conciliar una incidencia historica."
      })
    }
  );
  const result = await parseSupabaseResponse(response);
  return {
    ...result.inscripcion,
    jugador: result.jugador
  };
}

async function findPlayerByName(name) {
  const response = await supabaseFetch(
    "/rest/v1/jugadores" +
    "?select=id,nombre_completo,aliases" +
    `&nombre_completo=eq.${encodeURIComponent(name)}` +
    "&limit=1"
  );
  const rows = await parseSupabaseResponse(response);
  return Array.isArray(rows) ? rows[0] || null : null;
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

  try {
    const response = await supabaseFetch(
      "/rest/v1/etapas_estado" +
      "?select=estado,etiqueta" +
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
