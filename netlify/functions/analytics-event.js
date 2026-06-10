const EVENT_TYPES = new Set([
  "vista_pestana",
  "vista_partido"
]);
const DEVICES = new Set([
  "movil",
  "tablet",
  "escritorio"
]);

exports.handler = async event => {
  if (event.httpMethod === "OPTIONS") {
    return response(204);
  }

  if (event.httpMethod !== "POST") {
    return response(405, { error: "Metodo no permitido." });
  }

  if (
    !process.env.SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return response(503, { error: "Medicion no configurada." });
  }

  if (isLikelyBot(event.headers["user-agent"])) {
    return response(204);
  }

  try {
    const payload = sanitizePayload(
      JSON.parse(event.body || "{}")
    );
    const result = await supabaseFetch(
      "/rest/v1/analytics_eventos",
      {
        method: "POST",
        headers: {
          Prefer: "return=minimal"
        },
        body: JSON.stringify(payload)
      }
    );

    if (!result.ok) {
      const detail = await result.text();
      console.error("No se pudo registrar la metrica:", detail);
      return response(503, { error: "Medicion no disponible." });
    }

    return response(204);
  } catch (error) {
    return response(400, {
      error: error.message || "Evento invalido."
    });
  }
};

function sanitizePayload(input) {
  const evento = String(input.evento || "").trim();
  const objetivo = cleanText(input.objetivo, 50);
  const origen = cleanText(input.origen, 50) || null;
  const ruta = cleanText(input.ruta, 120) || "/";
  const dispositivo = DEVICES.has(input.dispositivo)
    ? input.dispositivo
    : "escritorio";
  const partidoId = Number(input.partido_id);

  if (!EVENT_TYPES.has(evento)) {
    throw new Error("Tipo de evento invalido.");
  }
  if (!objetivo) {
    throw new Error("Falta el objetivo del evento.");
  }
  if (
    evento === "vista_partido" &&
    (!Number.isInteger(partidoId) || partidoId <= 0)
  ) {
    throw new Error("ID de partido invalido.");
  }

  return {
    evento,
    objetivo,
    partido_id: evento === "vista_partido" ? partidoId : null,
    origen,
    dispositivo,
    ruta
  };
}

function cleanText(value, maxLength) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);
}

function isLikelyBot(userAgent = "") {
  return /bot|crawler|spider|preview|headless/i.test(userAgent);
}

function supabaseFetch(path, options = {}) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  return fetch(`${process.env.SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
}

function response(statusCode, body = null) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    },
    body: statusCode === 204 ? "" : JSON.stringify(body)
  };
}
