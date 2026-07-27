"use strict";

const assert = require("node:assert/strict");
const { handler } = require("../../netlify/functions/admin-etapas");

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

function setEnv() {
  Object.entries(DEFAULT_ENV).forEach(([key, value]) => {
    process.env[key] = value;
  });
}

function restoreGlobals() {
  Object.entries(ORIGINAL_ENV).forEach(([key, value]) => {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  });
  global.fetch = ORIGINAL_FETCH;
}

function mockResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: "",
    text: async () => JSON.stringify(body)
  };
}

function backupEvent() {
  return {
    httpMethod: "GET",
    headers: {
      "x-admin-password": DEFAULT_ENV.ADMIN_PASSWORD
    },
    queryStringParameters: {
      torneo_id: "1",
      respaldo_id: "10"
    },
    body: null
  };
}

function bodyOf(result) {
  return JSON.parse(result.body || "{}");
}

async function runCase(name, run) {
  try {
    await run();
    return `${name}: ok`;
  } finally {
    restoreGlobals();
  }
}

async function runAdminEtapasTests() {
  const results = [];

  results.push(await runCase("respaldo regular legacy exportable", async () => {
    setEnv();
    const urls = [];
    global.fetch = async url => {
      urls.push(url);
      return mockResponse(200, [
        {
          id: 10,
          torneo_id: 1,
          tipo: "regular",
          valor: "1",
          etiqueta: "Fecha 1",
          version: 1,
          motivo: "cierre",
          nota: "historico",
          cantidad_partidos: 9,
          partidos: [{ id: 1, torneo_id: 1, fecha: 1, zona: 1 }],
          incidencias: [],
          torneo_completo: {
            metadata: {
              torneo_id: 1,
              torneo: "Apertura 2026"
            }
          },
          creado_en: "2026-07-15T16:52:26.000Z"
        }
      ]);
    };

    const result = await handler(backupEvent());
    const body = bodyOf(result);
    assert.equal(result.statusCode, 200);
    assert.equal(body.formato, "tres-palos-respaldo-etapa-v2");
    assert.equal(body.etapa.torneo, "Apertura 2026");
    assert.equal(body.etapa.fecha, 1);
    assert.equal(body.etapa.zona, null);
    assert.equal(body.etapa.legacy, true);
    assert.equal(body.integridad.algoritmo, "sha256");
    assert.match(body.integridad.hash, /^[a-f0-9]{64}$/);
    assert.equal(
      urls[0],
      "https://supabase.test/rest/v1/respaldos_etapa" +
        "?select=*&id=eq.10&torneo_id=eq.1&limit=1"
    );
  }));

  return results;
}

if (require.main === module) {
  runAdminEtapasTests()
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
  runAdminEtapasTests
};
