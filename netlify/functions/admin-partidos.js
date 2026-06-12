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
      return await listMatches();
    }

    if (event.httpMethod === "PATCH") {
      return await updateMatch(event);
    }

    return json(405, { error: "Metodo no permitido." });
  } catch (error) {
    const statusCode = error.code === "VALIDATION" ? 400 : 500;
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

async function listMatches() {
  const response = await supabaseFetch(
    "/rest/v1/partidos?select=*&order=id.asc"
  );
  const partidos = await parseSupabaseResponse(response);
  return json(200, { partidos });
}

async function updateMatch(event) {
  const body = JSON.parse(event.body || "{}");
  const id = Number(body.id);

  if (!Number.isInteger(id) || id <= 0) {
    return json(400, { error: "ID de partido invalido." });
  }

  const patch = sanitizePatch(body.patch || {});
  const { existing, columns } = await getExistingMatch(id);
  if (!existing) return json(404, { error: "Partido no encontrado." });

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
    `/rest/v1/partidos?id=eq.${id}&select=*`,
    {
      method: "PATCH",
      headers: {
        Prefer: "return=representation"
      },
      body: JSON.stringify(filtered)
    }
  );
  const updated = await parseSupabaseResponse(response);

  return json(200, {
    partido: Array.isArray(updated) ? updated[0] : updated,
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
        throw new Error(`Valor numerico invalido para ${key}.`);
      }
      output[key] = number;
      return;
    }

    if (key === "estado") {
      const estado = String(raw).trim();
      if (!VALID_STATES.has(estado)) {
        throw new Error("Estado invalido.");
      }
      output[key] = estado;
      return;
    }

    if (key === "fecha_partido") {
      const fecha = String(raw).trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
        throw new Error("Fecha invalida.");
      }
      output[key] = fecha;
      return;
    }

    if (key === "hora") {
      const hora = String(raw).trim();
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) {
        throw new Error("Hora invalida.");
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

  try {
    const response = await supabaseFetch(
      "/rest/v1/etapas_estado" +
      "?select=estado,etiqueta" +
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
