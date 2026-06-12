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
      return await listRosters();
    }

    if (["POST", "PATCH"].includes(event.httpMethod)) {
      return await saveRosterEntry(event);
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
  const [tournamentsResponse, playersResponse, entriesResponse] =
    await Promise.all([
      supabaseFetch(
        "/rest/v1/torneos?select=*&order=anio.desc,tipo.asc"
      ),
      supabaseFetch(
        "/rest/v1/jugadores?select=*&order=nombre_completo.asc"
      ),
      supabaseFetch(
        "/rest/v1/inscripciones_jugadores" +
        "?select=*&order=club_id.asc,id.asc"
      )
    ]);

  const [torneos, jugadores, inscripciones] = await Promise.all([
    parseSupabaseResponse(tournamentsResponse),
    parseSupabaseResponse(playersResponse),
    parseSupabaseResponse(entriesResponse)
  ]);

  return json(200, {
    torneos,
    jugadores,
    inscripciones
  });
}

async function saveRosterEntry(event) {
  const input = sanitizeInput(JSON.parse(event.body || "{}"));

  if (event.httpMethod === "PATCH" && !input.p_inscripcion_id) {
    throw validationError("Falta la inscripcion a modificar.");
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
