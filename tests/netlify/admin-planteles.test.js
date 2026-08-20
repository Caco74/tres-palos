"use strict";

const assert = require("node:assert/strict");
const { handler } = require("../../netlify/functions/admin-planteles");

const DEFAULT_ENV = {
  SUPABASE_URL: "https://supabase.test",
  SUPABASE_SERVICE_ROLE_KEY: "dummy-test-key",
  ADMIN_PASSWORD: "secret"
};
const ORIGINAL_ENV = {
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD
};
const ORIGINAL_FETCH = global.fetch;
const ORIGINAL_ERROR = console.error;

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
    statusText: "",
    text: async () =>
      typeof body === "string" ? body : JSON.stringify(body)
  };
}

function bodyOf(result) {
  return JSON.parse(result.body || "{}");
}

function jsonBody(options) {
  return options?.body ? JSON.parse(options.body) : null;
}

function adminEvent(method, body = null, query = {}) {
  return {
    httpMethod: method,
    headers: { "x-admin-password": DEFAULT_ENV.ADMIN_PASSWORD },
    queryStringParameters: query,
    body: body ? JSON.stringify(body) : null
  };
}

function tournamentRow(id = 2) {
  return {
    id,
    nombre: "Apertura 2026",
    anio: 2026,
    tipo: "apertura",
    activo: true
  };
}

function clubRow(id = 1, name = "Campaña") {
  return {
    id,
    nombre_corto: name,
    nombre_oficial: `Club ${name}`,
    activo: true
  };
}

function playerRow(overrides = {}) {
  return {
    id: 77,
    nombre_completo: "Sanchez",
    nombre_normalizado: "sanchez",
    aliases: [],
    activo: true,
    ...overrides
  };
}

function enrollmentRow(overrides = {}) {
  return {
    id: 154,
    jugador_id: 77,
    club_id: 1,
    torneo_id: 2,
    posicion: "sin_definir",
    dorsal: null,
    estado: "por_verificar",
    fecha_desde: null,
    fecha_hasta: null,
    jugador: playerRow(),
    ...overrides
  };
}

function installFetch(route) {
  const calls = [];
  global.fetch = async (url, options = {}) => {
    const call = {
      url: String(url),
      method: options.method || "GET",
      body: jsonBody(options),
      headers: options.headers || {}
    };
    calls.push(call);
    return route(call);
  };
  return calls;
}

async function runCase(name, run) {
  try {
    setEnv();
    console.error = () => {};
    await run();
    return `${name}: ok`;
  } catch (error) {
    error.message = `${name}: ${error.message}`;
    throw error;
  } finally {
    restoreGlobals();
  }
}

function contextRoute(call) {
  if (call.url.includes("/rest/v1/torneos")) {
    return mockResponse(200, [tournamentRow()]);
  }
  if (call.url.includes("/rest/v1/clubes")) {
    return mockResponse(200, [clubRow()]);
  }
  return null;
}

async function runAdminPlantelesTests() {
  const results = [];

  results.push(await runCase(
    "listado inicial no carga todos los jugadores globales",
    async () => {
      const calls = installFetch(call => {
        if (call.url.includes("/rest/v1/torneos")) {
          return mockResponse(200, [tournamentRow()]);
        }
        if (call.url.includes("/rest/v1/inscripciones_jugadores")) {
          assert.match(call.url, /jugador:jugadores/);
          return mockResponse(200, [enrollmentRow()]);
        }
        throw new Error(call.url);
      });

      const result = await handler(adminEvent("GET"));
      const body = bodyOf(result);
      assert.equal(result.statusCode, 200, JSON.stringify(body));
      assert.deepEqual(body.jugadores, []);
      assert.equal(body.inscripciones[0].jugador.nombre_completo, "Sanchez");
      assert.equal(
        calls.some(call =>
          call.url.includes("/rest/v1/jugadores?select=*")
        ),
        false
      );
    }
  ));

  results.push(await runCase(
    "busqueda requiere 2 letras y limita candidatos a 8",
    async () => {
      const calls = installFetch(call => {
        const context = contextRoute(call);
        if (context) return context;
        if (call.url.includes("/rpc/tp_normalizar_nombre_jugador")) {
          assert.equal(call.body.p_nombre, "SÁnchez");
          return mockResponse(200, JSON.stringify("sanchez"));
        }
        if (
          call.url.includes("/rest/v1/jugadores?") &&
          call.url.includes("nombre_normalizado=eq.sanchez")
        ) {
          return mockResponse(200, Array.from({ length: 10 }, (_, index) =>
            playerRow({
              id: 100 + index,
              nombre_completo: `Sanchez ${index + 1}`
            })
          ));
        }
        if (
          call.url.includes("/rest/v1/jugadores?") ||
          call.url.includes("/rest/v1/jugadores_aliases")
        ) {
          assert.match(call.url, /limit=8/);
          return mockResponse(200, []);
        }
        if (call.url.includes("/rest/v1/inscripciones_jugadores")) {
          return mockResponse(200, []);
        }
        throw new Error(call.url);
      });

      const rejected = await handler(adminEvent("GET", null, {
        scope: "buscar-jugador",
        torneo_id: "2",
        club_id: "1",
        nombre: "S"
      }));
      assert.equal(rejected.statusCode, 400);
      assert.equal(
        calls.some(call =>
          call.url.includes("/rest/v1/jugadores?") ||
          call.url.includes("/rest/v1/jugadores_aliases")
        ),
        false
      );

      const result = await handler(adminEvent("GET", null, {
        scope: "buscar-jugador",
        torneo_id: "2",
        club_id: "1",
        nombre: "SÁnchez"
      }));
      const body = bodyOf(result);
      assert.equal(result.statusCode, 200, JSON.stringify(body));
      assert.equal(body.nombre_normalizado, "sanchez");
      assert.equal(body.candidatos.length, 8);
      assert.equal(
        calls.some(call =>
          call.url.includes("/rpc/tp_normalizar_nombre_jugador")
        ),
        true
      );
    }
  ));

  results.push(await runCase(
    "homonimos se devuelven separados con club y torneo",
    async () => {
      async function search(name, normalized, players) {
        installFetch(call => {
          const context = contextRoute(call);
          if (context) return context;
          if (call.url.includes("/rpc/tp_normalizar_nombre_jugador")) {
            return mockResponse(200, JSON.stringify(normalized));
          }
          if (
            call.url.includes("/rest/v1/jugadores?") &&
            call.url.includes(`nombre_normalizado=eq.${normalized}`)
          ) {
            return mockResponse(200, players);
          }
          if (
            call.url.includes("/rest/v1/jugadores?") ||
            call.url.includes("/rest/v1/jugadores_aliases")
          ) {
            return mockResponse(200, []);
          }
          if (call.url.includes("/rest/v1/inscripciones_jugadores")) {
            return mockResponse(200, [
              {
                id: 201,
                jugador_id: players[0].id,
                club_id: 1,
                torneo_id: 2,
                posicion: "sin_definir",
                dorsal: null,
                estado: "confirmado",
                club: clubRow(1, "Campaña"),
                torneo: tournamentRow()
              },
              {
                id: 202,
                jugador_id: players[1].id,
                club_id: 4,
                torneo_id: 2,
                posicion: "sin_definir",
                dorsal: null,
                estado: "confirmado",
                club: clubRow(4, "Sportivo"),
                torneo: tournamentRow()
              }
            ]);
          }
          throw new Error(call.url);
        });
        const result = await handler(adminEvent("GET", null, {
          scope: "buscar-jugador",
          torneo_id: "2",
          club_id: "1",
          nombre: name
        }));
        return bodyOf(result).candidatos;
      }

      const sanchez = await search("Sanchez", "sanchez", [
        playerRow({ id: 11, nombre_completo: "Sanchez" }),
        playerRow({ id: 25, nombre_completo: "Sanchez" })
      ]);
      assert.deepEqual(sanchez.map(item => item.jugador.id), [11, 25]);
      assert.equal(sanchez[0].inscripciones[0].club_nombre, "Campaña");
      assert.equal(sanchez[1].inscripciones[0].club_nombre, "Sportivo");
      assert.equal(sanchez[0].inscripciones[0].torneo_nombre, "Apertura 2026");

      const sarco = await search("Sarco", "sarco", [
        playerRow({ id: 30, nombre_completo: "Sarco" }),
        playerRow({ id: 31, nombre_completo: "Sarco" })
      ]);
      assert.deepEqual(sarco.map(item => item.jugador.id), [30, 31]);
    }
  ));

  results.push(await runCase(
    "persona existente crea solo inscripcion y no duplica existente",
    async () => {
      const calls = installFetch(call => {
        const context = contextRoute(call);
        if (context) return context;
        if (
          call.url.includes("/rest/v1/jugadores?") &&
          call.url.includes("id=eq.77")
        ) {
          return mockResponse(200, [playerRow()]);
        }
        if (
          call.url.includes("/rest/v1/inscripciones_jugadores") &&
          call.url.includes("jugador_id=eq.77")
        ) {
          return mockResponse(200, [enrollmentRow()]);
        }
        throw new Error(call.url);
      });

      const result = await handler(adminEvent("POST", {
        action: "crear-inscripcion-jugador",
        torneo_id: 2,
        club_id: 1,
        jugador_id: 77,
        busqueda_previa: true,
        confirmar_inscripcion: true
      }));
      const body = bodyOf(result);
      assert.equal(result.statusCode, 200, JSON.stringify(body));
      assert.equal(body.existente, true);
      assert.equal(body.mensaje, "Este jugador ya pertenece al plantel.");
      assert.equal(
        calls.some(call =>
          call.method === "POST" &&
          call.url.includes("/rest/v1/inscripciones_jugadores?select=*")
        ),
        false
      );
    }
  ));

  results.push(await runCase(
    "persona existente sin inscripcion crea solo la inscripcion",
    async () => {
      let insertBody = null;
      installFetch(call => {
        const context = contextRoute(call);
        if (context) return context;
        if (
          call.url.includes("/rest/v1/jugadores?") &&
          call.url.includes("id=eq.77")
        ) {
          return mockResponse(200, [playerRow()]);
        }
        if (
          call.url.includes("/rest/v1/inscripciones_jugadores") &&
          call.method === "GET"
        ) {
          return mockResponse(200, []);
        }
        if (
          call.url.includes("/rest/v1/inscripciones_jugadores?select=*") &&
          call.method === "POST"
        ) {
          insertBody = call.body;
          return mockResponse(201, [enrollmentRow()]);
        }
        throw new Error(call.url);
      });

      const result = await handler(adminEvent("POST", {
        action: "crear-inscripcion-jugador",
        torneo_id: 2,
        club_id: 1,
        jugador_id: 77,
        busqueda_previa: true,
        confirmar_inscripcion: true
      }));
      const body = bodyOf(result);
      assert.equal(result.statusCode, 201, JSON.stringify(body));
      assert.equal(body.existente, false);
      assert.equal(insertBody.jugador_id, 77);
      assert.equal(insertBody.club_id, 1);
      assert.equal(insertBody.torneo_id, 2);
    }
  ));

  results.push(await runCase(
    "jugador nuevo exige busqueda y revalida duplicados normalizados",
    async () => {
      const calls = installFetch(call => {
        const context = contextRoute(call);
        if (context) return context;
        if (call.url.includes("/rpc/tp_normalizar_nombre_jugador")) {
          return mockResponse(200, JSON.stringify("sanchez"));
        }
        if (
          call.url.includes("/rest/v1/jugadores?") &&
          call.url.includes("nombre_normalizado=eq.sanchez")
        ) {
          return mockResponse(200, [playerRow({ id: 11 })]);
        }
        if (
          call.url.includes("/rest/v1/jugadores?") ||
          call.url.includes("/rest/v1/jugadores_aliases")
        ) {
          return mockResponse(200, []);
        }
        if (call.url.includes("/rest/v1/inscripciones_jugadores")) {
          return mockResponse(200, []);
        }
        if (call.url.includes("/rest/v1/rpc/admin_guardar_inscripcion_jugador")) {
          throw new Error("No debe crear jugador con candidato sin confirmacion.");
        }
        throw new Error(call.url);
      });

      const noSearch = await handler(adminEvent("POST", {
        action: "crear-jugador-inscripcion",
        torneo_id: 2,
        club_id: 1,
        nombre_completo: "Sanchez",
        confirmar_creacion: true
      }));
      assert.equal(noSearch.statusCode, 400);

      const duplicate = await handler(adminEvent("POST", {
        action: "crear-jugador-inscripcion",
        torneo_id: 2,
        club_id: 1,
        nombre_completo: "Sanchez",
        busqueda_previa: true,
        confirmar_creacion: true
      }));
      assert.equal(duplicate.statusCode, 400);
      assert.match(bodyOf(duplicate).error, /Puede existir un jugador/);
      assert.equal(
        calls.some(call =>
          call.url.includes("/rest/v1/rpc/admin_guardar_inscripcion_jugador")
        ),
        false
      );
    }
  ));

  results.push(await runCase(
    "jugador nuevo usa operacion atomica y aliases no obligatorios",
    async () => {
      let rpcBody = null;
      installFetch(call => {
        const context = contextRoute(call);
        if (context) return context;
        if (call.url.includes("/rpc/tp_normalizar_nombre_jugador")) {
          return mockResponse(200, JSON.stringify("nuevo jugador"));
        }
        if (
          call.url.includes("/rest/v1/jugadores?") ||
          call.url.includes("/rest/v1/jugadores_aliases")
        ) {
          return mockResponse(200, []);
        }
        if (call.url.includes("/rest/v1/inscripciones_jugadores")) {
          return mockResponse(200, []);
        }
        if (call.url.includes("/rest/v1/rpc/admin_guardar_inscripcion_jugador")) {
          rpcBody = call.body;
          return mockResponse(200, {
            jugador: playerRow({
              id: 300,
              nombre_completo: "Nuevo Jugador",
              nombre_normalizado: "nuevo jugador"
            }),
            inscripcion: enrollmentRow({
              id: 400,
              jugador_id: 300,
              jugador: playerRow({
                id: 300,
                nombre_completo: "Nuevo Jugador",
                nombre_normalizado: "nuevo jugador"
              })
            })
          });
        }
        throw new Error(call.url);
      });

      const result = await handler(adminEvent("POST", {
        action: "crear-jugador-inscripcion",
        torneo_id: 2,
        club_id: 1,
        nombre_completo: "Nuevo Jugador",
        busqueda_previa: true,
        confirmar_creacion: true
      }));
      const body = bodyOf(result);
      assert.equal(result.statusCode, 201, JSON.stringify(body));
      assert.equal(rpcBody.p_jugador_id, null);
      assert.equal(rpcBody.p_nombre_completo, "Nuevo Jugador");
      assert.deepEqual(rpcBody.p_aliases, []);
      assert.equal(rpcBody.p_club_id, 1);
      assert.equal(rpcBody.p_torneo_id, 2);
    }
  ));

  results.push(await runCase(
    "baja y reactivacion actualizan estado con PATCH sin DELETE",
    async () => {
      const rpcBodies = [];
      const calls = installFetch(call => {
        if (call.url.includes("/rest/v1/rpc/admin_guardar_inscripcion_jugador")) {
          rpcBodies.push(call.body);
          return mockResponse(200, {
            jugador: playerRow(),
            inscripcion: enrollmentRow({
              id: call.body.p_inscripcion_id,
              estado: call.body.p_estado,
              fecha_hasta: call.body.p_fecha_hasta
            })
          });
        }
        throw new Error(call.url);
      });

      const inactive = await handler(adminEvent("PATCH", {
        inscripcion_id: 154,
        jugador_id: 77,
        nombre_completo: "Sanchez",
        aliases: [],
        club_id: 1,
        torneo_id: 2,
        posicion: "sin_definir",
        dorsal: null,
        estado: "inactivo",
        fecha_desde: null,
        fecha_hasta: "2026-08-20",
        fuente: null,
        observaciones: "Baja administrativa"
      }));
      assert.equal(inactive.statusCode, 200, inactive.body);
      assert.equal(rpcBodies[0].p_inscripcion_id, 154);
      assert.equal(rpcBodies[0].p_jugador_id, 77);
      assert.equal(rpcBodies[0].p_estado, "inactivo");
      assert.equal(rpcBodies[0].p_fecha_hasta, "2026-08-20");

      const reactivated = await handler(adminEvent("PATCH", {
        inscripcion_id: 154,
        jugador_id: 77,
        nombre_completo: "Sanchez",
        aliases: [],
        club_id: 1,
        torneo_id: 2,
        posicion: "sin_definir",
        dorsal: null,
        estado: "por_verificar",
        fecha_desde: null,
        fecha_hasta: null,
        fuente: null,
        observaciones: "Reactivacion administrativa"
      }));
      assert.equal(reactivated.statusCode, 200, reactivated.body);
      assert.equal(rpcBodies[1].p_estado, "por_verificar");
      assert.equal(rpcBodies[1].p_fecha_hasta, null);
      assert.equal(
        calls.some(call => call.method === "DELETE"),
        false
      );
    }
  ));

  return results;
}

if (require.main === module) {
  runAdminPlantelesTests()
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
  runAdminPlantelesTests
};
