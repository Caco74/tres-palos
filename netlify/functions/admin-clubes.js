const ALLOWED_FIELDS = new Set([
  "nombre_corto",
  "apodo",
  "ciudad",
  "provincia",
  "zona",
  "escudo_url",
  "color_primario",
  "color_secundario",
  "aliases",
  "activo"
]);

const REQUIRED_TEXT_FIELDS = new Set([
  "nombre_corto",
  "ciudad",
  "provincia"
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
      return await listClubs();
    }

    if (event.httpMethod === "PATCH") {
      return await updateClub(event);
    }

    return json(405, { error: "Metodo no permitido." });
  } catch (error) {
    const statusCode =
      error.code === "VALIDATION"
        ? 400
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

async function listClubs() {
  const response = await supabaseFetch(
    "/rest/v1/clubes?select=*&order=zona.asc,nombre_corto.asc"
  );
  const clubes = await parseSupabaseResponse(response);
  return json(200, { clubes });
}

async function updateClub(event) {
  const body = JSON.parse(event.body || "{}");
  const id = Number(body.id);

  if (!Number.isInteger(id) || id <= 0) {
    return json(400, { error: "ID de club invalido." });
  }

  const patch = sanitizePatch(body.patch || {});
  if (Object.keys(patch).length === 0) {
    return json(400, { error: "No hay campos validos para actualizar." });
  }

  patch.actualizado_en = new Date().toISOString();

  const response = await supabaseFetch(
    `/rest/v1/clubes?id=eq.${id}&select=*`,
    {
      method: "PATCH",
      headers: {
        Prefer: "return=representation"
      },
      body: JSON.stringify(patch)
    }
  );
  const rows = await parseSupabaseResponse(response);
  const club = Array.isArray(rows) ? rows[0] : rows;

  if (!club) {
    return json(404, { error: "Club no encontrado." });
  }

  return json(200, {
    club,
    savedFields: Object.keys(patch)
  });
}

function sanitizePatch(patch) {
  const output = {};

  Object.entries(patch).forEach(([key, raw]) => {
    if (!ALLOWED_FIELDS.has(key)) return;

    if (key === "activo") {
      if (typeof raw !== "boolean") {
        throw validationError("Estado activo invalido.");
      }
      output[key] = raw;
      return;
    }

    if (key === "zona") {
      const zona = Number(raw);
      if (!Number.isInteger(zona) || zona < 1 || zona > 3) {
        throw validationError("Zona invalida.");
      }
      output[key] = zona;
      return;
    }

    if (key === "aliases") {
      const aliases = Array.isArray(raw)
        ? raw
        : String(raw || "").split(",");
      output[key] = [
        ...new Set(
          aliases
            .map(alias => String(alias).trim())
            .filter(Boolean)
        )
      ].slice(0, 20);
      return;
    }

    const value = raw === null ? "" : String(raw).trim();

    if (REQUIRED_TEXT_FIELDS.has(key) && !value) {
      throw validationError(`El campo ${key} es obligatorio.`);
    }

    if (
      ["color_primario", "color_secundario"].includes(key) &&
      value &&
      !/^#[0-9a-f]{6}$/i.test(value)
    ) {
      throw validationError(
        `Color invalido para ${key}. Usa formato #RRGGBB.`
      );
    }

    if (key === "escudo_url" && value && !value.startsWith("/assets/")) {
      throw validationError(
        "El escudo debe ser una ruta local que comience con /assets/."
      );
    }

    output[key] = value || null;
  });

  return output;
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
