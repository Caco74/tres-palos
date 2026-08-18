"use strict";

const assert = require("node:assert/strict");
const { handler } = require("../../netlify/functions/admin-partidos");

const DEFAULT_ENV = {
  SUPABASE_URL: "https://supabase.test",
  SUPABASE_SERVICE_ROLE_KEY: "test-service-role",
  ADMIN_PASSWORD: "secret"
};

const ORIGINAL_ENV = {
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD
};
const ORIGINAL_FETCH = global.fetch;
const ORIGINAL_ERROR = console.error;

function setEnv(overrides = {}) {
  Object.keys(DEFAULT_ENV).forEach(key => {
    process.env[key] = DEFAULT_ENV[key];
  });
  Object.entries(overrides).forEach(([key, value]) => {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  });
}

function restoreGlobals() {
  Object.entries(ORIGINAL_ENV).forEach(([key, value]) => {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  });
  global.fetch = ORIGINAL_FETCH;
  console.error = ORIGINAL_ERROR;
}

function adminEvent() {
  return {
    httpMethod: "GET",
    headers: {
      "x-admin-password": DEFAULT_ENV.ADMIN_PASSWORD
    },
    queryStringParameters: {
      scope: "torneos"
    },
    body: null
  };
}

function matchesEvent(torneoId = 2) {
  return {
    httpMethod: "GET",
    headers: {
      "x-admin-password": DEFAULT_ENV.ADMIN_PASSWORD
    },
    queryStringParameters: {
      torneo_id: String(torneoId)
    },
    body: null
  };
}

function patchEvent(body) {
  return {
    httpMethod: "PATCH",
    headers: {
      "x-admin-password": DEFAULT_ENV.ADMIN_PASSWORD
    },
    queryStringParameters: {},
    body: JSON.stringify(body)
  };
}

function mockResponse(status, body, statusText = "") {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    text: async () =>
      typeof body === "string" ? body : JSON.stringify(body)
  };
}

async function captureLogs(run) {
  const logs = [];
  console.error = (...args) => logs.push(args);
  try {
    const result = await run(logs);
    return { result, logs };
  } finally {
    console.error = ORIGINAL_ERROR;
  }
}

function bodyOf(result) {
  return JSON.parse(result.body || "{}");
}

function assertNoSecretInLogs(logs) {
  const text = JSON.stringify(logs);
  assert.equal(text.includes(DEFAULT_ENV.SUPABASE_SERVICE_ROLE_KEY), false);
  assert.equal(text.includes("Bearer"), false);
  assert.equal(text.toLowerCase().includes("apikey"), false);
}

async function runCase(name, run) {
  try {
    await run();
    return `${name}: ok`;
  } finally {
    restoreGlobals();
  }
}

async function runAdminPartidosTests() {
  const results = [];

  for (const key of Object.keys(DEFAULT_ENV)) {
    results.push(await runCase(`env ausente ${key}`, async () => {
      setEnv({ [key]: undefined });
      let calledFetch = false;
      global.fetch = async () => {
        calledFetch = true;
        throw new Error("fetch no deberia ejecutarse");
      };

      const { result, logs } = await captureLogs(() => handler(adminEvent()));
      assert.equal(result.statusCode, 500);
      assert.equal(bodyOf(result).code, "ENV_MISSING");
      assert.equal(calledFetch, false);
      assert.equal(logs[0][1].stage, "validate_environment");
      assertNoSecretInLogs(logs);
    }));
  }

  results.push(await runCase("torneos respuesta exitosa", async () => {
    setEnv();
    const urls = [];
    global.fetch = async url => {
      urls.push(url);
      return mockResponse(200, [
        {
          id: 2,
          anio: 2026,
          tipo: "clausura",
          nombre: "Clausura 2026",
          activo: true
        }
      ], "OK");
    };

    const result = await handler(adminEvent());
    assert.equal(result.statusCode, 200);
    assert.equal(bodyOf(result).torneos[0].id, 2);
    assert.equal(
      urls[0],
      "https://supabase.test/rest/v1/torneos" +
        "?select=id,anio,tipo,nombre,activo&order=anio.desc,tipo.asc"
    );
  }));

  results.push(await runCase("partidos orden deportivo", async () => {
    setEnv();
    const urls = [];
    global.fetch = async url => {
      urls.push(url);
      if (String(url).includes("/rest/v1/torneos")) {
        return mockResponse(200, [
          {
            id: 2,
            anio: 2026,
            tipo: "clausura",
            nombre: "Clausura 2026",
            activo: false
          }
        ], "OK");
      }
      return mockResponse(200, [
        {
          id: 279,
          torneo_id: 2,
          fecha: 1,
          zona: 1,
          local: "Sportivo A. Club",
          visitante: "C.A. Correa"
        }
      ], "OK");
    };

    const result = await handler(matchesEvent());
    assert.equal(result.statusCode, 200);
    assert.equal(bodyOf(result).partidos[0].id, 279);
    assert.equal(
      urls[1],
      "https://supabase.test/rest/v1/partidos" +
        "?select=*" +
        "&torneo_id=eq.2" +
        "&order=torneo_id.asc,fecha.asc,zona.asc," +
        "fecha_partido.asc.nullslast,hora.asc.nullslast,local.asc,id.asc"
    );
  }));

  results.push(await runCase("PATCH marca destacado y limpia anterior del torneo", async () => {
    setEnv();
    const calls = [];
    global.fetch = async (url, options = {}) => {
      calls.push({
        url: String(url),
        method: options.method || "GET",
        body: options.body ? JSON.parse(options.body) : null
      });

      const text = String(url);
      if (text.includes("/rest/v1/torneos")) {
        return mockResponse(200, [
          {
            id: 2,
            anio: 2026,
            tipo: "clausura",
            nombre: "Clausura 2026",
            activo: true
          }
        ]);
      }
      if (text.includes("/rest/v1/partidos?select=*&id=eq.301&limit=1")) {
        return mockResponse(200, [
          {
            id: 301,
            torneo_id: 2,
            tipo: "regular",
            fecha: 5,
            zona: 3,
            local: "Sportivo A. Club",
            visitante: "Argentino A. Club",
            local_id: 20,
            visitante_id: 21,
            estado: "programado",
            destacado_inicio: false,
            destacado_titulo: null
          }
        ]);
      }
      if (text.includes("/rest/v1/etapas_estado")) {
        return mockResponse(200, []);
      }
      if (
        text.includes("/rest/v1/partidos?torneo_id=eq.2") &&
        text.includes("&destacado_inicio=eq.true") &&
        text.includes("&id=neq.301")
      ) {
        return mockResponse(204, "");
      }
      if (
        text.includes("/rest/v1/partidos?id=eq.301") &&
        text.includes("&torneo_id=eq.2&select=*")
      ) {
        return mockResponse(200, [
          {
            id: 301,
            torneo_id: 2,
            destacado_inicio: true,
            destacado_titulo: "Clasico de Las Parejas"
          }
        ]);
      }

      throw new Error(`URL inesperada: ${text}`);
    };

    const result = await handler(patchEvent({
      id: 301,
      torneo_id: 2,
      patch: {
        destacado_inicio: true,
        destacado_titulo: "Clasico de Las Parejas"
      }
    }));
    const body = bodyOf(result);
    const clearCall = calls.find(call =>
      call.method === "PATCH" &&
      call.url.includes("destacado_inicio=eq.true")
    );
    const updateCall = calls.find(call =>
      call.method === "PATCH" &&
      call.url.includes("id=eq.301")
    );

    assert.equal(result.statusCode, 200);
    assert.deepEqual(clearCall.body, {
      destacado_inicio: false,
      destacado_titulo: null
    });
    assert.match(clearCall.url, /torneo_id=eq\.2/);
    assert.doesNotMatch(clearCall.url, /torneo_id=eq\.1/);
    assert.deepEqual(updateCall.body, {
      destacado_inicio: true,
      destacado_titulo: "Clasico de Las Parejas"
    });
    assert.deepEqual(body.savedFields, [
      "destacado_inicio",
      "destacado_titulo"
    ]);
  }));

  results.push(await runCase("PATCH desmarca destacado y permite torneo sin destacado", async () => {
    setEnv();
    const calls = [];
    global.fetch = async (url, options = {}) => {
      calls.push({
        url: String(url),
        method: options.method || "GET",
        body: options.body ? JSON.parse(options.body) : null
      });

      const text = String(url);
      if (text.includes("/rest/v1/torneos")) {
        return mockResponse(200, [
          { id: 2, anio: 2026, tipo: "clausura", nombre: "Clausura 2026" }
        ]);
      }
      if (text.includes("/rest/v1/partidos?select=*&id=eq.301&limit=1")) {
        return mockResponse(200, [
          {
            id: 301,
            torneo_id: 2,
            tipo: "regular",
            fecha: 5,
            zona: 3,
            local_id: 20,
            visitante_id: 21,
            estado: "programado",
            destacado_inicio: true,
            destacado_titulo: "Clasico de Las Parejas"
          }
        ]);
      }
      if (text.includes("/rest/v1/etapas_estado")) {
        return mockResponse(200, []);
      }
      if (
        text.includes("/rest/v1/partidos?id=eq.301") &&
        text.includes("&torneo_id=eq.2&select=*")
      ) {
        return mockResponse(200, [
          {
            id: 301,
            torneo_id: 2,
            destacado_inicio: false,
            destacado_titulo: null
          }
        ]);
      }

      throw new Error(`URL inesperada: ${text}`);
    };

    const result = await handler(patchEvent({
      id: 301,
      torneo_id: 2,
      patch: {
        destacado_inicio: false
      }
    }));
    const updateCalls = calls.filter(call => call.method === "PATCH");

    assert.equal(result.statusCode, 200);
    assert.equal(
      calls.some(call => call.url.includes("destacado_inicio=eq.true")),
      false
    );
    assert.equal(updateCalls.length, 1);
    assert.deepEqual(updateCalls[0].body, {
      destacado_inicio: false,
      destacado_titulo: null
    });
  }));

  results.push(await runCase("PATCH rechaza destacado de partido de otro torneo", async () => {
    setEnv();
    const calls = [];
    global.fetch = async (url, options = {}) => {
      calls.push({
        url: String(url),
        method: options.method || "GET"
      });

      const text = String(url);
      if (text.includes("/rest/v1/torneos")) {
        return mockResponse(200, [
          { id: 2, anio: 2026, tipo: "clausura", nombre: "Clausura 2026" }
        ]);
      }
      if (text.includes("/rest/v1/partidos?select=*&id=eq.301&limit=1")) {
        return mockResponse(200, [
          {
            id: 301,
            torneo_id: 1,
            tipo: "regular",
            fecha: 5,
            zona: 3,
            local_id: 20,
            visitante_id: 21,
            estado: "programado",
            destacado_inicio: false,
            destacado_titulo: null
          }
        ]);
      }

      throw new Error(`URL inesperada: ${text}`);
    };

    const { result, logs } = await captureLogs(() => handler(patchEvent({
      id: 301,
      torneo_id: 2,
      patch: {
        destacado_inicio: true,
        destacado_titulo: "No corresponde"
      }
    })));

    assert.equal(result.statusCode, 403);
    assert.equal(bodyOf(result).code, "FORBIDDEN");
    assert.equal(calls.some(call => call.method === "PATCH"), false);
    assertNoSecretInLogs(logs);
  }));

  for (const [status, statusText] of [
    [400, "Bad Request"],
    [401, "Unauthorized"],
    [403, "Forbidden"],
    [404, "Not Found"]
  ]) {
    results.push(await runCase(`Supabase ${status}`, async () => {
      setEnv();
      global.fetch = async () => mockResponse(status, {
        code: `PG${status}`,
        message: `Supabase ${status}`
      }, statusText);

      const { result, logs } = await captureLogs(() => handler(adminEvent()));
      assert.equal(result.statusCode, 500);
      assert.equal(bodyOf(result).error, "Error interno.");
      assert.equal(bodyOf(result).code, "TORNEOS_QUERY_FAILED");
      assert.equal(logs[0][1].operation, "listTournaments");
      assert.equal(logs[0][1].stage, "query_torneos");
      assert.equal(logs[0][1].supabaseStatus, status);
      assert.equal(logs[0][1].supabaseStatusText, statusText);
      assert.equal(logs[0][1].supabaseCode, `PG${status}`);
      assert.equal(logs[0][1].supabaseMessage, `Supabase ${status}`);
      assertNoSecretInLogs(logs);
    }));
  }

  results.push(await runCase("excepcion de red", async () => {
    setEnv();
    global.fetch = async () => {
      throw new Error("network unavailable");
    };

    const { result, logs } = await captureLogs(() => handler(adminEvent()));
    assert.equal(result.statusCode, 500);
    assert.equal(bodyOf(result).code, "TORNEOS_QUERY_FAILED");
    assert.equal(logs[0][1].operation, "listTournaments");
    assert.equal(logs[0][1].stage, "query_torneos");
    assert.equal(logs[0][1].message, "network unavailable");
    assertNoSecretInLogs(logs);
  }));

  results.push(await runCase("respuesta no JSON", async () => {
    setEnv();
    global.fetch = async () => mockResponse(200, "<html>bad gateway</html>", "OK");

    const { result, logs } = await captureLogs(() => handler(adminEvent()));
    assert.equal(result.statusCode, 500);
    assert.equal(bodyOf(result).code, "TORNEOS_QUERY_FAILED");
    assert.equal(logs[0][1].operation, "listTournaments");
    assert.equal(logs[0][1].stage, "query_torneos");
    assert.equal(logs[0][1].supabaseStatus, 200);
    assert.equal(logs[0][1].supabaseMessage, "<html>bad gateway</html>");
    assertNoSecretInLogs(logs);
  }));

  return results;
}

if (require.main === module) {
  runAdminPartidosTests()
    .then(results => {
      results.forEach(result => console.log(result));
    })
    .catch(error => {
      restoreGlobals();
      console.error(error);
      process.exitCode = 1;
    });
}

module.exports = {
  runAdminPartidosTests
};
