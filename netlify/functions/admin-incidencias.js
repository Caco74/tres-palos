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
      const body = JSON.parse(event.body || "{}");
      if (
        event.httpMethod === "PATCH" &&
        body.action === "reordenar"
      ) {
        return await reorderEvents(body);
      }
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
    "?select=*" +
    "&order=partido_id.desc,orden.asc,id.asc"
  );
  const incidencias = await parseSupabaseResponse(response);
  return json(200, { incidencias });
}

async function saveEvent(event) {
  const body = JSON.parse(event.body || "{}");
  const eventId = optionalId(body.id);
  const existing = eventId ? await getEvent(eventId) : null;

  if (event.httpMethod === "PATCH" && !existing) {
    return json(404, { error: "Incidencia no encontrada." });
  }

  const matchId = requiredId(
    body.partido_id ?? existing?.partido_id,
    "Partido invalido."
  );
  const match = await getMatch(matchId);
  if (!match) return json(404, { error: "Partido no encontrado." });

  await assertStageOpen(match);

  const input = sanitizeInput(body, match);
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
    : null;
  input.actualizado_en = new Date().toISOString();

  if (!eventId) {
    input.jugador = enrollment
      ? enrollment.jugador.nombre_completo
      : "Jugador no informado";
  }

  const method = eventId ? "PATCH" : "POST";
  const path = eventId
    ? `/rest/v1/eventos_partido?id=eq.${eventId}&select=*`
    : "/rest/v1/eventos_partido?select=*";
  const {
    rows,
    periodoOmitido
  } = await persistEvent(path, method, input);
  const incidencia = Array.isArray(rows) ? rows[0] : rows;

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

async function deleteEvent(event) {
  const body = JSON.parse(event.body || "{}");
  const eventId = requiredId(body.id, "Incidencia invalida.");
  const existing = await getEvent(eventId);

  if (!existing) {
    return json(404, { error: "Incidencia no encontrada." });
  }

  const match = await getMatch(existing.partido_id);
  if (match) await assertStageOpen(match);

  const response = await supabaseFetch(
    `/rest/v1/eventos_partido?id=eq.${eventId}`,
    { method: "DELETE" }
  );
  await parseSupabaseResponse(response);

  return json(200, { eliminado: eventId });
}

async function reorderEvents(body) {
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
  if (!match) return json(404, { error: "Partido no encontrado." });
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
      await patchEventOrder(ids[index], 100000 + index);
    }
    for (let index = 0; index < ids.length; index += 1) {
      await patchEventOrder(ids[index], index + 1);
    }
  } catch (error) {
    for (const [id, order] of original.entries()) {
      try {
        await patchEventOrder(id, order);
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

async function patchEventOrder(id, order) {
  const response = await supabaseFetch(
    `/rest/v1/eventos_partido?id=eq.${id}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        orden: order,
        actualizado_en: new Date().toISOString()
      })
    }
  );
  await parseSupabaseResponse(response);
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
