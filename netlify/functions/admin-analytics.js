exports.handler = async event => {
  if (event.httpMethod === "OPTIONS") {
    return json(204);
  }

  if (event.httpMethod !== "GET") {
    return json(405, { error: "Metodo no permitido." });
  }

  const envError = getEnvError();
  if (envError) return json(500, { error: envError });

  if (!isAuthorized(event)) {
    return json(401, { error: "No autorizado." });
  }

  try {
    const desde = new Date();
    desde.setUTCDate(desde.getUTCDate() - 30);
    const query = new URLSearchParams({
      select: "evento,objetivo,partido_id,origen,dispositivo,creado_en",
      creado_en: `gte.${desde.toISOString()}`,
      order: "creado_en.desc",
      limit: "10000"
    });
    const response = await supabaseFetch(
      `/rest/v1/analytics_eventos?${query}`
    );
    const eventos = await parseSupabaseResponse(response);

    return json(200, resumirEventos(eventos, desde));
  } catch (error) {
    return json(500, {
      error: error.message || "No se pudo cargar la medicion."
    });
  }
};

function resumirEventos(eventos, desde) {
  const pestanas = new Map();
  const partidos = new Map();
  const dispositivos = new Map();

  eventos.forEach(evento => {
    sumar(dispositivos, evento.dispositivo || "sin_dato");

    if (evento.evento === "vista_pestana") {
      sumar(pestanas, evento.objetivo);
    }

    if (
      evento.evento === "vista_partido" &&
      evento.partido_id !== null
    ) {
      sumar(partidos, String(evento.partido_id));
    }
  });

  return {
    periodo_desde: desde.toISOString(),
    total_eventos: eventos.length,
    total_pestanas: contarEvento(eventos, "vista_pestana"),
    total_partidos: contarEvento(eventos, "vista_partido"),
    pestanas: ordenarConteos(pestanas, "objetivo"),
    partidos: ordenarConteos(partidos, "partido_id").map(item => ({
      ...item,
      partido_id: Number(item.partido_id)
    })),
    dispositivos: ordenarConteos(dispositivos, "dispositivo")
  };
}

function sumar(map, key) {
  if (!key) return;
  map.set(key, (map.get(key) || 0) + 1);
}

function contarEvento(eventos, tipo) {
  return eventos.filter(evento => evento.evento === tipo).length;
}

function ordenarConteos(map, key) {
  return [...map.entries()]
    .map(([value, consultas]) => ({
      [key]: value,
      consultas
    }))
    .sort(
      (a, b) =>
        b.consultas - a.consultas ||
        String(a[key]).localeCompare(String(b[key]), "es")
    );
}

function getEnvError() {
  if (!process.env.SUPABASE_URL) {
    return "Falta SUPABASE_URL en Netlify.";
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return "Falta SUPABASE_SERVICE_ROLE_KEY en Netlify.";
  }
  if (!process.env.ADMIN_PASSWORD) {
    return "Falta ADMIN_PASSWORD en Netlify.";
  }
  return null;
}

function isAuthorized(event) {
  const password = event.headers["x-admin-password"] ||
    event.headers["X-Admin-Password"];
  return password && password === process.env.ADMIN_PASSWORD;
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

async function parseSupabaseResponse(response) {
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(
      data?.message ||
      data?.error ||
      "Error de Supabase."
    );
  }

  return Array.isArray(data) ? data : [];
}

function json(statusCode, body = null) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    },
    body: statusCode === 204 ? "" : JSON.stringify(body)
  };
}
