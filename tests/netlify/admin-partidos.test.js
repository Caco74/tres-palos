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
