const VALID_STAGE_TYPES = new Set(["regular", "playoff"]);
const VALID_ACTIONS = new Set(["cerrar", "reabrir", "restaurar"]);

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
      const backupId = Number(
        event.queryStringParameters?.respaldo_id || 0
      );
      if (backupId) {
        return await getBackupExport(backupId);
      }
      return await listStageData();
    }

    if (event.httpMethod === "POST") {
      return await runStageAction(event);
    }

    return json(405, { error: "Metodo no permitido." });
  } catch (error) {
    const statusCode = error.code === "P0001" ? 409 : 500;
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

async function listStageData() {
  const [statesResponse, backupsResponse] = await Promise.all([
    supabaseFetch(
      "/rest/v1/etapas_estado" +
      "?select=tipo,valor,etiqueta,estado,respaldo_cierre_id," +
      "cerrada_en,reabierta_en,actualizado_en" +
      "&order=actualizado_en.desc"
    ),
    supabaseFetch(
      "/rest/v1/respaldos_etapa" +
      "?select=id,tipo,valor,etiqueta,version,motivo,nota," +
      "cantidad_partidos,creado_en" +
      "&order=creado_en.desc&limit=30"
    )
  ]);

  const [etapas, respaldos] = await Promise.all([
    parseSupabaseResponse(statesResponse),
    parseSupabaseResponse(backupsResponse)
  ]);

  return json(200, { etapas, respaldos });
}

async function getBackupExport(backupId) {
  if (!Number.isInteger(backupId) || backupId <= 0) {
    return json(400, { error: "Respaldo invalido." });
  }

  const response = await supabaseFetch(
    "/rest/v1/respaldos_etapa" +
    "?select=*" +
    `&id=eq.${backupId}` +
    "&limit=1"
  );
  const rows = await parseSupabaseResponse(response);
  const respaldo = Array.isArray(rows) ? rows[0] : null;

  if (!respaldo) {
    return json(404, { error: "Respaldo no encontrado." });
  }

  return json(200, {
    formato: "tres-palos-respaldo-etapa-v1",
    exportado_en: new Date().toISOString(),
    respaldo
  });
}

async function runStageAction(event) {
  const body = JSON.parse(event.body || "{}");
  const action = String(body.action || "").trim();

  if (!VALID_ACTIONS.has(action)) {
    return json(400, { error: "Accion de etapa invalida." });
  }

  if (action === "restaurar") {
    const backupId = Number(body.respaldo_id);
    if (!Number.isInteger(backupId) || backupId <= 0) {
      return json(400, { error: "Respaldo invalido." });
    }

    const result = await callRpc(
      "tp_restaurar_respaldo",
      { p_respaldo_id: backupId }
    );
    return json(200, { resultado: result });
  }

  const stage = sanitizeStage(body);
  const rpc = action === "cerrar"
    ? "tp_cerrar_etapa"
    : "tp_reabrir_etapa";
  const parameters = {
    p_tipo: stage.tipo,
    p_valor: stage.valor,
    p_etiqueta: stage.etiqueta
  };

  if (action === "cerrar") {
    parameters.p_nota = sanitizeNote(body.nota);
  }

  const result = await callRpc(rpc, parameters);
  return json(200, { resultado: result });
}

function sanitizeStage(body) {
  const tipo = String(body.tipo || "").trim();
  const valor = String(body.valor || "").trim();
  const etiqueta = String(body.etiqueta || "").trim();

  if (!VALID_STAGE_TYPES.has(tipo)) {
    throw new Error("Tipo de etapa invalido.");
  }
  if (!valor || valor.length > 60) {
    throw new Error("Identificador de etapa invalido.");
  }
  if (!etiqueta || etiqueta.length > 100) {
    throw new Error("Nombre de etapa invalido.");
  }

  return { tipo, valor, etiqueta };
}

function sanitizeNote(note) {
  const value = String(note || "").trim();
  if (value.length > 500) {
    throw new Error("La nota no puede superar los 500 caracteres.");
  }
  return value || null;
}

async function callRpc(name, parameters) {
  const response = await supabaseFetch(`/rest/v1/rpc/${name}`, {
    method: "POST",
    body: JSON.stringify(parameters)
  });
  return parseSupabaseResponse(response);
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
