const ALLOWED_FIELDS = new Set([
  "local",
  "visitante",
  "fecha_partido",
  "hora",
  "estado",
  "estadio",
  "arbitro",
  "goles_local",
  "goles_visitante",
  "penales_local",
  "penales_visitante",
  "source_local",
  "source_visitante"
]);

const NUMBER_FIELDS = new Set([
  "goles_local",
  "goles_visitante",
  "penales_local",
  "penales_visitante"
]);

const VALID_STATES = new Set([
  "programado",
  "en_vivo",
  "suspendido",
  "postergado",
  "finalizado",
  "pendiente_resultado"
]);

const TOURNAMENT_SELECT = "id,anio,tipo,nombre,activo";

exports.handler = async event => {
  if (event.httpMethod === "OPTIONS") {
    return json(204, {});
  }

  const envError = getEnvError();
  if (envError) {
    logSafeError({
      operation: "handler",
      stage: "validate_environment",
      statusCode: 500,
      code: "ENV_MISSING",
      message: envError
    });
    return json(500, { error: envError, code: "ENV_MISSING" });
  }

  if (!isAuthorized(event)) {
    return json(401, { error: "No autorizado." });
  }

  try {
    if (event.httpMethod === "GET") {
      if (event.queryStringParameters?.scope === "torneos") {
        return await listTournaments();
      }
      return await listMatches(event);
    }

    if (event.httpMethod === "PATCH") {
      return await updateMatch(event);
    }

    return json(405, { error: "Metodo no permitido." });
  } catch (error) {
    const statusCode = getErrorStatus(error);
    logSafeError({
      operation: error.operation || "handler",
      stage: error.stage || "unknown",
      statusCode,
      error
    });
    return json(statusCode, {
      error: error.expose === false
        ? "Error interno."
        : error.message || "Error interno.",
      code: getPublicErrorCode(error)
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

function validationError(message) {
  return httpError(400, "VALIDATION", message);
}

function annotateError(error, context = {}) {
  error.operation = error.operation || context.operation || null;
  error.stage = error.stage || context.stage || null;
  error.publicCode = error.publicCode || context.publicCode || null;
  return error;
}

function getPublicErrorCode(error) {
  return error.publicCode || error.code || null;
}

function sanitizeLogText(value) {
  if (value === null || value === undefined) return null;
  return String(value)
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [redacted]")
    .replace(/(apikey|authorization)\s*[:=]\s*[^,\s}]+/gi, "$1=[redacted]")
    .slice(0, 500);
}

function logSafeError({
  operation,
  stage,
  statusCode,
  error = null,
  code = null,
  message = null
}) {
  console.error("admin-partidos safe error", {
    function: "admin-partidos",
    operation,
    stage,
    statusCode,
    code: code || error?.code || null,
    message: sanitizeLogText(message || error?.message),
    supabaseStatus: error?.supabaseStatus || null,
    supabaseStatusText: sanitizeLogText(error?.supabaseStatusText),
    supabaseCode: sanitizeLogText(error?.supabaseCode),
    supabaseMessage: sanitizeLogText(error?.supabaseMessage)
  });
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
  const operation = "getTournament";
  try {
    const response = await supabaseFetch(
      "/rest/v1/torneos" +
      `?select=${TOURNAMENT_SELECT}` +
      `&id=eq.${encodeURIComponent(id)}` +
      "&limit=1"
    );
    const rows = await parseSupabaseResponse(response, {
      operation,
      stage: "query_torneo",
      publicCode: "TORNEO_QUERY_FAILED"
    });
    return Array.isArray(rows) ? rows[0] || null : null;
  } catch (error) {
    throw annotateError(error, {
      operation,
      stage: error.stage || "query_torneo",
      publicCode: "TORNEO_QUERY_FAILED"
    });
  }
}

function assertMatchTournament(match, tournamentId) {
  if (!match?.torneo_id) {
    throw validationError("El partido no tiene torneo_id asignado.");
  }
  if (String(match.torneo_id) !== String(tournamentId)) {
    throw httpError(
      403,
      "FORBIDDEN",
      "El partido pertenece a otro torneo."
    );
  }
}

async function listTournaments() {
  const operation = "listTournaments";
  try {
    const response = await supabaseFetch(
      "/rest/v1/torneos" +
      `?select=${TOURNAMENT_SELECT}` +
      "&order=anio.desc,tipo.asc"
    );
    const torneos = await parseSupabaseResponse(response, {
      operation,
      stage: "query_torneos",
      publicCode: "TORNEOS_QUERY_FAILED"
    });
    return json(200, { torneos });
  } catch (error) {
    throw annotateError(error, {
      operation,
      stage: error.stage || "query_torneos",
      publicCode: "TORNEOS_QUERY_FAILED"
    });
  }
}

async function listMatches(event) {
  const torneoId = getTournamentId(
    event.queryStringParameters?.torneo_id
  );
  const torneo = await getTournament(torneoId);
  if (!torneo) throw httpError(404, "NOT_FOUND", "Torneo no encontrado.");

  const response = await supabaseFetch(
    "/rest/v1/partidos" +
    "?select=*" +
    `&torneo_id=eq.${encodeURIComponent(torneoId)}` +
    "&order=torneo_id.asc,fecha.asc,zona.asc,fecha_partido.asc.nullslast," +
      "hora.asc.nullslast,local.asc,id.asc"
  );
  const partidos = await parseSupabaseResponse(response);
  return json(200, { partidos, torneo });
}

async function updateMatch(event) {
  const body = parseBody(event);
  const id = Number(body.id);
  const torneoId = getTournamentId(body.torneo_id);

  if (!Number.isInteger(id) || id <= 0) {
    return json(400, { error: "ID de partido invalido." });
  }

  const patch = sanitizePatch(body.patch || {});
  const torneo = await getTournament(torneoId);
  if (!torneo) throw httpError(404, "NOT_FOUND", "Torneo no encontrado.");
  const { existing, columns } = await getExistingMatch(id);
  if (!existing) throw httpError(404, "NOT_FOUND", "Partido no encontrado.");
  assertMatchTournament(existing, torneoId);

  const closedStage = await getClosedStage(existing);
  if (closedStage) {
    return json(409, {
      error:
        `${closedStage.etiqueta || "La etapa"} esta cerrada. ` +
        "Reabrila antes de editar sus partidos."
    });
  }

  const filtered = {};
  const ignoredFields = [];

  Object.entries(patch).forEach(([key, value]) => {
    if (columns.has(key)) filtered[key] = value;
    else ignoredFields.push(key);
  });

  Object.assign(
    filtered,
    await resolveClubIdentityPatch(existing, filtered, columns)
  );

  if (Object.keys(filtered).length === 0) {
    return json(400, {
      error: "No hay campos validos para actualizar.",
      ignoredFields
    });
  }

  if (columns.has("actualizado_en")) {
    filtered.actualizado_en = new Date().toISOString();
  }

  const response = await supabaseFetch(
    `/rest/v1/partidos?id=eq.${id}` +
      `&torneo_id=eq.${encodeURIComponent(torneoId)}&select=*`,
    {
      method: "PATCH",
      headers: {
        Prefer: "return=representation"
      },
      body: JSON.stringify(filtered)
    }
  );
  const updated = await parseSupabaseResponse(response);
  const partidoActualizado = Array.isArray(updated) ? updated[0] : updated;
  if (!partidoActualizado) {
    throw httpError(
      404,
      "NOT_FOUND",
      "Partido no encontrado para el torneo indicado."
    );
  }

  return json(200, {
    partido: partidoActualizado,
    torneo,
    ignoredFields,
    savedFields: Object.keys(filtered)
  });
}

async function resolveClubIdentityPatch(existing, patch, columns) {
  const needsLocal =
    columns.has("local_id") &&
    (
      Object.hasOwn(patch, "local") ||
      (!existing.local_id && existing.local)
    );
  const needsVisitor =
    columns.has("visitante_id") &&
    (
      Object.hasOwn(patch, "visitante") ||
      (!existing.visitante_id && existing.visitante)
    );

  if (!needsLocal && !needsVisitor) return {};

  const response = await supabaseFetch(
    "/rest/v1/clubes" +
    "?select=id,nombre_oficial,nombre_corto,aliases"
  );
  const clubs = await parseSupabaseResponse(response);
  const identityPatch = {};

  if (needsLocal) {
    const name = Object.hasOwn(patch, "local")
      ? patch.local
      : existing.local;
    identityPatch.local_id = resolveClubId(clubs, name, "local");
  }

  if (needsVisitor) {
    const name = Object.hasOwn(patch, "visitante")
      ? patch.visitante
      : existing.visitante;
    identityPatch.visitante_id = resolveClubId(
      clubs,
      name,
      "visitante"
    );
  }

  return identityPatch;
}

function resolveClubId(clubs, teamName, side) {
  if (!teamName) return null;

  const key = normalizeClubName(teamName);
  const club = clubs.find(item =>
    [
      item.nombre_oficial,
      item.nombre_corto,
      ...(Array.isArray(item.aliases) ? item.aliases : [])
    ].some(name => normalizeClubName(name) === key)
  );

  if (!club) {
    const error = new Error(
      `No se encontro el club ${side}: ${teamName}.`
    );
    error.code = "VALIDATION";
    throw error;
  }

  return club.id;
}

function normalizeClubName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function sanitizePatch(patch) {
  const output = {};

  Object.entries(patch).forEach(([key, raw]) => {
    if (!ALLOWED_FIELDS.has(key)) return;

    if (raw === "" || raw === undefined) {
      output[key] = null;
      return;
    }

    if (raw === null) {
      output[key] = null;
      return;
    }

    if (NUMBER_FIELDS.has(key)) {
      const number = Number(raw);
      if (!Number.isInteger(number) || number < 0) {
        throw validationError(`Valor numerico invalido para ${key}.`);
      }
      output[key] = number;
      return;
    }

    if (key === "estado") {
      const estado = String(raw).trim();
      if (!VALID_STATES.has(estado)) {
        throw validationError("Estado invalido.");
      }
      output[key] = estado;
      return;
    }

    if (key === "fecha_partido") {
      const fecha = String(raw).trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
        throw validationError("Fecha invalida.");
      }
      output[key] = fecha;
      return;
    }

    if (key === "hora") {
      const hora = String(raw).trim();
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) {
        throw validationError("Hora invalida.");
      }
      output[key] = hora;
      return;
    }

    output[key] = String(raw).trim() || null;
  });

  return output;
}

async function getExistingMatch(id) {
  const response = await supabaseFetch(
    `/rest/v1/partidos?select=*&id=eq.${id}&limit=1`
  );
  const rows = await parseSupabaseResponse(response);
  const existing = Array.isArray(rows) ? rows[0] : null;

  return {
    existing,
    columns: new Set(existing ? Object.keys(existing) : [])
  };
}

async function getClosedStage(match) {
  const stage = getMatchStage(match);
  if (!stage) return null;
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
    return Array.isArray(rows) ? rows[0] || null : null;
  } catch (error) {
    if (["42P01", "PGRST205"].includes(error.code)) {
      return null;
    }
    throw error;
  }
}

function getMatchStage(match) {
  if (
    match.tipo === "regular" &&
    match.fecha !== null &&
    match.fecha !== undefined
  ) {
    return { tipo: "regular", valor: String(match.fecha) };
  }
  if (match.tipo === "playoff" && match.fase) {
    return { tipo: "playoff", valor: String(match.fase) };
  }
  return null;
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

async function parseSupabaseResponse(response, context = {}) {
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (parseError) {
    const error = httpError(
      500,
      context.publicCode || "SUPABASE_RESPONSE_INVALID",
      "Respuesta invalida de Supabase.",
      false
    );
    error.supabaseStatus = response.status || null;
    error.supabaseStatusText = response.statusText || null;
    error.supabaseMessage = sanitizeLogText(text);
    throw annotateError(error, context);
  }

  if (!response.ok) {
    const error = httpError(
      500,
      context.publicCode || "SUPABASE_REQUEST_FAILED",
      "Error de Supabase.",
      false
    );
    error.supabaseStatus = response.status || null;
    error.supabaseStatusText = response.statusText || null;
    error.supabaseCode = data?.code || null;
    error.supabaseMessage =
      data?.message || data?.error || data?.details || null;
    throw annotateError(error, context);
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
