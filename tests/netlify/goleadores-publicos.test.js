"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { handler, _private } = require("../../netlify/functions/goleadores-publicos");

const ROOT = path.resolve(__dirname, "..", "..");
const ORIGINAL_ENV = {
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  SUPABASE_KEY: process.env.SUPABASE_KEY
};
const ORIGINAL_FETCH = global.fetch;
const ORIGINAL_ERROR = console.error;

const DEFAULT_ENV = {
  SUPABASE_URL: "https://supabase.test",
  SUPABASE_ANON_KEY: "test-anon-key"
};

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
  console.error = ORIGINAL_ERROR;
}

function mockResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () =>
      typeof body === "string" ? body : JSON.stringify(body)
  };
}

function installFetch(route) {
  const calls = [];
  global.fetch = async (url, options = {}) => {
    const call = {
      url: String(url),
      method: options.method || "GET",
      headers: options.headers || {}
    };
    calls.push(call);
    return route(call);
  };
  return calls;
}

function publicEvent(tournamentId) {
  return {
    httpMethod: "GET",
    queryStringParameters: { torneo_id: String(tournamentId) }
  };
}

function bodyOf(result) {
  return JSON.parse(result.body || "{}");
}

function tournament(overrides = {}) {
  return {
    id: 2,
    nombre: "Clausura 2026",
    anio: 2026,
    tipo: "clausura",
    activo: true,
    ...overrides
  };
}

function match(overrides = {}) {
  return {
    id: 301,
    torneo_id: 2,
    tipo: "regular",
    zona: 1,
    local_id: 43,
    visitante_id: 57,
    local: "Sportivo A. Club",
    visitante: "C.A. Correa",
    ...overrides
  };
}

function eventRow(overrides = {}) {
  return {
    id: 501,
    partido_id: 301,
    tipo: "gol",
    estado_dato: "confirmado",
    inscripcion_jugador_id: 401,
    jugador: "Snapshot",
    ...overrides
  };
}

function enrollment(overrides = {}) {
  return {
    id: 401,
    jugador_id: 701,
    club_id: 43,
    torneo_id: 2,
    jugador: { id: 701, nombre_completo: "Genaro Onega" },
    club: {
      id: 43,
      nombre_corto: "Sportivo",
      nombre_oficial: "Sportivo A. Club"
    },
    ...overrides
  };
}

async function runCase(name, fn) {
  setEnv();
  console.error = () => {};
  try {
    await fn();
    return `${name}: ok`;
  } finally {
    restoreGlobals();
  }
}

function assertOnlyGetRequests(calls) {
  assert.equal(
    calls.every(call => call.method === "GET"),
    true,
    "la funcion publica no debe escribir"
  );
}

function assertNoEndpoint(calls, endpoint) {
  assert.equal(
    calls.some(call => call.url.includes(endpoint)),
    false,
    `no debe llamar ${endpoint}`
  );
}

function assertPublicScorerPayload(body) {
  assert.deepEqual(
    Object.keys(body).sort(),
    ["fuente", "mensaje_vacio", "tablas"]
  );
  assert.deepEqual(Object.keys(body.tablas).sort(), ["1", "2", "3", "general"]);

  Object.values(body.tablas).flat().forEach(row => {
    assert.deepEqual(
      Object.keys(row).sort(),
      ["equipo_nombre", "goles", "jugador_nombre"]
    );
    [
      "id",
      "torneo_id",
      "equipo_id",
      "posicion",
      "key",
      "alias",
      "metadata",
      "admin"
    ].forEach(field => {
      assert.equal(Object.hasOwn(row, field), false);
    });
  });
}

async function runGoleadoresPublicosTests() {
  const results = [];

  results.push(await runCase(
    "calculo por eventos: tipos, confirmacion, texto e identidad",
    async () => {
      const clausura = tournament();
      const matchesById = new Map([
        ["301", match({ id: 301, zona: 1 })],
        ["302", match({ id: 302, zona: 2, local_id: 44 })]
      ]);
      const result = _private.buildEventScorerTables({
        tournament: clausura,
        matchesById,
        events: [
          eventRow({
            id: 1,
            tipo: "gol",
            inscripcion_jugador_id: 401,
            jugador: "G. Onega"
          }),
          eventRow({
            id: 2,
            tipo: "gol_penal",
            inscripcion_jugador_id: 401,
            jugador: "Genaro O."
          }),
          eventRow({
            id: 3,
            tipo: "gol_en_contra",
            inscripcion_jugador_id: 401
          }),
          eventRow({
            id: 4,
            tipo: "amarilla",
            inscripcion_jugador_id: 401
          }),
          eventRow({
            id: 5,
            tipo: "roja",
            inscripcion_jugador_id: 401
          }),
          eventRow({
            id: 6,
            tipo: "gol",
            estado_dato: "por_verificar",
            inscripcion_jugador_id: 401
          }),
          eventRow({
            id: 7,
            partido_id: 302,
            tipo: "gol",
            inscripcion_jugador_id: 402,
            jugador: "Genaro Onega"
          })
        ],
        enrollments: [
          enrollment({ id: 401, jugador_id: 701, club_id: 43 }),
          enrollment({
            id: 402,
            jugador_id: 702,
            club_id: 44,
            jugador: { id: 702, nombre_completo: "Genaro Onega" },
            club: {
              id: 44,
              nombre_corto: "Correa",
              nombre_oficial: "C.A. Correa"
            }
          })
        ]
      });

      assert.deepEqual(
        result.tablas.general.map(row => [
          row.jugador_nombre,
          row.equipo_nombre,
          row.goles
        ]),
        [
          ["Genaro Onega", "Sportivo", 2],
          ["Genaro Onega", "Correa", 1]
        ]
      );
      assert.equal(result.tablas["1"].length, 1);
      assert.equal(result.tablas["1"][0].goles, 2);
      assert.equal(result.tablas["2"].length, 1);
      assert.equal(_private.isCountableGoalEvent(eventRow({ tipo: "gol" })), true);
      assert.equal(
        _private.isCountableGoalEvent(eventRow({ tipo: "gol_penal" })),
        true
      );
      assert.equal(
        _private.isCountableGoalEvent(eventRow({ tipo: "gol_en_contra" })),
        false
      );
      assert.equal(
        _private.isCountableGoalEvent(eventRow({ tipo: "amarilla" })),
        false
      );
      assert.equal(
        _private.isCountableGoalEvent(eventRow({ tipo: "doble_amarilla" })),
        false
      );
      assert.equal(
        _private.isCountableGoalEvent(eventRow({ tipo: "roja" })),
        false
      );
      assert.equal(
        _private.isCountableGoalEvent(eventRow({ estado_dato: "por_verificar" })),
        false
      );
    }
  ));

  results.push(await runCase(
    "handler Clausura usa eventos, zonas reales y sin N+1",
    async () => {
      const calls = installFetch(call => {
        if (call.url.includes("/rest/v1/torneos")) {
          return mockResponse(200, [tournament()]);
        }
        if (call.url.includes("/rest/v1/partidos")) {
          return mockResponse(200, [
            match({
              id: 301,
              zona: 1,
              local_id: 43,
              visitante_id: 57,
              local: "Sportivo A. Club",
              visitante: "C.A. Correa"
            }),
            match({
              id: 302,
              zona: 2,
              local_id: 47,
              visitante_id: 48,
              local: "Sport C. Canadense",
              visitante: "AD Everton/Olimpia"
            })
          ]);
        }
        if (call.url.includes("/rest/v1/eventos_partido")) {
          assert.match(call.url, /tipo=in\.\(gol,gol_penal\)/);
          assert.match(call.url, /estado_dato=eq\.confirmado/);
          assert.match(call.url, /inscripcion_jugador_id=not\.is\.null/);
          return mockResponse(200, [
            eventRow({
              id: 601,
              partido_id: 301,
              inscripcion_jugador_id: 401,
              jugador: "Genaro Onega"
            }),
            eventRow({
              id: 602,
              partido_id: 301,
              inscripcion_jugador_id: 402,
              jugador: "Facu Astrada"
            }),
            eventRow({
              id: 603,
              partido_id: 301,
              inscripcion_jugador_id: 403,
              jugador: "Gino Toia"
            }),
            eventRow({
              id: 604,
              partido_id: 302,
              inscripcion_jugador_id: 404,
              jugador: "Laureano Carrizo"
            })
          ]);
        }
        if (call.url.includes("/rest/v1/inscripciones_jugadores")) {
          return mockResponse(200, [
            enrollment({
              id: 401,
              jugador_id: 701,
              club_id: 43,
              jugador: { id: 701, nombre_completo: "Genaro Onega" }
            }),
            enrollment({
              id: 402,
              jugador_id: 702,
              club_id: 43,
              jugador: { id: 702, nombre_completo: "Facundo Astrada" }
            }),
            enrollment({
              id: 403,
              jugador_id: 703,
              club_id: 43,
              jugador: { id: 703, nombre_completo: "Gino Toia" }
            }),
            enrollment({
              id: 404,
              jugador_id: 704,
              club_id: 47,
              jugador: { id: 704, nombre_completo: "Laureano Carrizo" },
              club: {
                id: 47,
                nombre_corto: "Sport",
                nombre_oficial: "Sport C. Canadense"
              }
            })
          ]);
        }
        throw new Error(call.url);
      });

      const result = await handler(publicEvent(2));
      const body = bodyOf(result);

      assert.equal(result.statusCode, 200);
      assert.equal(body.fuente, _private.SOURCE_EVENTS);
      assertPublicScorerPayload(body);
      assert.deepEqual(
        body.tablas["1"].map(row => [
          row.jugador_nombre,
          row.equipo_nombre,
          row.goles
        ]),
        [
          ["Facundo Astrada", "Sportivo", 1],
          ["Genaro Onega", "Sportivo", 1],
          ["Gino Toia", "Sportivo", 1]
        ]
      );
      assert.equal(body.tablas["2"].length, 1);
      assert.equal(body.tablas.general.length, 4);
      assert.equal(
        body.mensaje_vacio,
        "Todav\u00eda no hay goles cargados para este torneo."
      );
      assertOnlyGetRequests(calls);
      assertNoEndpoint(calls, "/rest/v1/goleadores_oficiales");
      assert.equal(
        calls.filter(call =>
          call.url.includes("/rest/v1/inscripciones_jugadores")
        ).length,
        1
      );
      assert.equal(
        calls.some(call => /\/rest\/v1\/jugadores\?/.test(call.url)),
        false
      );
      assert.doesNotMatch(result.body, /test-anon-key/);
    }
  ));

  results.push(await runCase(
    "handler Apertura conserva snapshot y no mezcla eventos",
    async () => {
      const calls = installFetch(call => {
        if (call.url.includes("/rest/v1/torneos")) {
          return mockResponse(200, [
            tournament({
              id: 1,
              nombre: "Apertura 2026",
              tipo: "apertura",
              activo: false
            })
          ]);
        }
        if (call.url.includes("/rest/v1/partidos")) {
          return mockResponse(200, [
            match({
              id: 101,
              torneo_id: 1,
              zona: 1,
              local_id: 47,
              visitante_id: 43,
              local: "Sport C. Canadense",
              visitante: "Sportivo A. Club"
            }),
            match({
              id: 102,
              torneo_id: 1,
              zona: 2,
              local_id: 46,
              visitante_id: 48,
              local: "AD Everton/Olimpia",
              visitante: "Defensores"
            })
          ]);
        }
        if (call.url.includes("/rest/v1/goleadores_oficiales")) {
          return mockResponse(200, [
            {
              id: 17,
              torneo_id: 1,
              posicion: 1,
              equipo_id: 47,
              equipo_nombre: "SPORT C. CANADENSE",
              jugador_nombre: "TOMBOLINI CARLOS DAMIAN",
              goles: 13
            },
            {
              id: 18,
              torneo_id: 1,
              posicion: 2,
              equipo_id: 46,
              equipo_nombre: "AD. EVERTON/OLIMPIA",
              jugador_nombre: "BORINI JULIO CESAR",
              goles: 7
            }
          ]);
        }
        throw new Error(call.url);
      });

      const result = await handler(publicEvent(1));
      const body = bodyOf(result);

      assert.equal(result.statusCode, 200);
      assert.equal(body.fuente, _private.SOURCE_SNAPSHOT);
      assertPublicScorerPayload(body);
      assert.deepEqual(
        body.tablas.general.map(row => row.jugador_nombre),
        ["TOMBOLINI CARLOS DAMIAN", "BORINI JULIO CESAR"]
      );
      assert.equal(
        body.tablas.general.some(row => Object.hasOwn(row, "key")),
        false
      );
      assert.deepEqual(
        body.tablas["1"].map(row => row.jugador_nombre),
        ["TOMBOLINI CARLOS DAMIAN"]
      );
      assert.deepEqual(
        body.tablas["2"].map(row => row.jugador_nombre),
        ["BORINI JULIO CESAR"]
      );
      assert.match(body.mensaje_vacio, /snapshot de goleadores/);
      assertOnlyGetRequests(calls);
      assertNoEndpoint(calls, "/rest/v1/eventos_partido");
      assertNoEndpoint(calls, "/rest/v1/inscripciones_jugadores");
    }
  ));

  results.push(await runCase(
    "torneo calculado sin goles devuelve estado vacio correcto",
    async () => {
      installFetch(call => {
        if (call.url.includes("/rest/v1/torneos")) {
          return mockResponse(200, [tournament({ id: 3, anio: 2027 })]);
        }
        if (call.url.includes("/rest/v1/partidos")) {
          return mockResponse(200, [match({ id: 401, torneo_id: 3 })]);
        }
        if (call.url.includes("/rest/v1/eventos_partido")) {
          return mockResponse(200, []);
        }
        throw new Error(call.url);
      });

      const result = await handler(publicEvent(3));
      const body = bodyOf(result);

      assert.equal(result.statusCode, 200);
      assert.equal(body.fuente, _private.SOURCE_EVENTS);
      assertPublicScorerPayload(body);
      assert.deepEqual(body.tablas.general, []);
      assert.equal(
        body.mensaje_vacio,
        "Todav\u00eda no hay goles cargados para este torneo."
      );
    }
  ));

  results.push(await runCase(
    "seguridad endpoint: sin service role, escrituras ni campos sensibles",
    async () => {
      const functionSource = fs.readFileSync(
        path.join(ROOT, "netlify", "functions", "goleadores-publicos.js"),
        "utf8"
      );

      assert.doesNotMatch(
        functionSource,
        /SUPABASE_SERVICE_ROLE_KEY|service_role/i
      );
      assert.doesNotMatch(
        functionSource,
        /\.(insert|update|delete|upsert|rpc)\s*\(|method:\s*["'](?:POST|PUT|PATCH|DELETE)["']/i
      );
      assert.match(functionSource, /SUPABASE_ANON_KEY/);
      assert.match(functionSource, /Access-Control-Allow-Methods": "GET, OPTIONS"/);

      const badRequest = await handler({
        httpMethod: "GET",
        queryStringParameters: { torneo_id: "sin-id" }
      });
      const badBody = bodyOf(badRequest);

      assert.equal(badRequest.statusCode, 400);
      assert.deepEqual(Object.keys(badBody).sort(), ["error"]);
      assert.doesNotMatch(badRequest.body, /SUPABASE|service|token|key/i);
    }
  ));

  results.push(await runCase(
    "alcance publico: cliente sin snapshot directo ni service role expuesto",
    async () => {
      const appSource = fs.readFileSync(
        path.join(ROOT, "js", "app.js"),
        "utf8"
      );
      const utilsSource = fs.readFileSync(
        path.join(ROOT, "js", "utils.js"),
        "utf8"
      );
      const indexSource = fs.readFileSync(
        path.join(ROOT, "index.html"),
        "utf8"
      );
      const styleSource = fs.readFileSync(
        path.join(ROOT, "styles", "main.css"),
        "utf8"
      );

      assert.match(appSource, /\/\.netlify\/functions\/goleadores-publicos/);
      assert.doesNotMatch(appSource, /goleadores_oficiales\?select/);
      const serviceRoleName = ["SUPABASE", "SERVICE", "ROLE", "KEY"].join("_");
      assert.equal(
        (appSource + utilsSource + indexSource).includes(serviceRoleName),
        false
      );
      assert.match(indexSource, /\/js\/app\.js\?v=76/);
      assert.match(indexSource, /aria-label="Tabla por zona o general"/);
      assert.match(styleSource, /\.tabla-scorer[\s\S]*30px minmax\(0, 1fr\) minmax\(78px, auto\)/);
      assert.match(styleSource, /\.tabla-scorer-player strong,[\s\S]*text-overflow: ellipsis/);
      assert.match(styleSource, /\.tabla-scorer-shield[\s\S]*object-fit: contain/);
      assert.match(styleSource, /\.tabla-scorer-goals[\s\S]*grid-template-columns: 2ch 5ch/);
      assert.match(styleSource, /@media \(max-width: 420px\)[\s\S]*\.tabla-scorer/);
    }
  ));

  return results;
}

if (require.main === module) {
  runGoleadoresPublicosTests()
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
  runGoleadoresPublicosTests
};
