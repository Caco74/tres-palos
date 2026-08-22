"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { handler } = require("../../netlify/functions/admin-incidencias");

const ROOT = path.resolve(__dirname, "..", "..");
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

function adminEvent(method, body = null, query = {}) {
  return {
    httpMethod: method,
    headers: { "x-admin-password": DEFAULT_ENV.ADMIN_PASSWORD },
    queryStringParameters: query,
    body: body ? JSON.stringify(body) : null
  };
}

function jsonBody(options) {
  return options?.body ? JSON.parse(options.body) : null;
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

function tournamentRow(id = 2) {
  return {
    id,
    anio: 2026,
    tipo: "clausura",
    nombre: "Clausura 2026",
    activo: true
  };
}

function matchRow(overrides = {}) {
  return {
    id: 10,
    tipo: "regular",
    fecha: 1,
    fase: null,
    local: "Local",
    visitante: "Visitante",
    local_id: 1,
    visitante_id: 2,
    torneo_id: 2,
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
    estado: "confirmado",
    jugador: {
      id: 77,
      nombre_completo: "Joaquin Carrizo",
      nombre_normalizado: "joaquin carrizo",
      activo: true
    },
    ...overrides
  };
}

function baseRoute(extra = {}) {
  return call => {
    if (call.url.includes("/rest/v1/torneos")) {
      return mockResponse(200, [tournamentRow()]);
    }
    if (call.url.includes("/rest/v1/partidos")) {
      return mockResponse(200, [matchRow()]);
    }
    if (call.url.includes("/rest/v1/etapas_estado")) {
      return mockResponse(200, []);
    }
    if (extra[call.url]) return extra[call.url](call);
    throw new Error(`Ruta no mockeada: ${call.method} ${call.url}`);
  };
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

async function runAdminIncidenciasTests() {
  const results = [];

  results.push(await runCase(
    "listado de jugadores filtra torneo, club y habilitados",
    async () => {
      const calls = installFetch(call => {
        if (call.url.includes("/rest/v1/torneos")) {
          return mockResponse(200, [tournamentRow()]);
        }
        if (call.url.includes("/rest/v1/partidos")) {
          return mockResponse(200, [matchRow()]);
        }
        if (call.url.includes("/rest/v1/inscripciones_jugadores")) {
          assert.match(call.url, /torneo_id=eq\.2/);
          assert.match(call.url, /club_id=eq\.1/);
          return mockResponse(200, [
            enrollmentRow({
              id: 2,
              jugador: {
                id: 2,
                nombre_completo: "Beto Alvarez",
                nombre_normalizado: "beto alvarez",
                activo: true
              }
            }),
            enrollmentRow({
              id: 1,
              estado: "inactivo",
              jugador: {
                id: 1,
                nombre_completo: "Activo Viejo",
                nombre_normalizado: "activo viejo",
                activo: true
              }
            }),
            enrollmentRow({
              id: 3,
              jugador: {
                id: 3,
                nombre_completo: "Jugador Baja",
                nombre_normalizado: "jugador baja",
                activo: false
              }
            }),
            enrollmentRow({
              id: 4,
              jugador: {
                id: 4,
                nombre_completo: "Alan Gomez",
                nombre_normalizado: "alan gomez",
                activo: true
              }
            })
          ]);
        }
        throw new Error(call.url);
      });

      const result = await handler(adminEvent("GET", null, {
        scope: "jugadores",
        torneo_id: "2",
        partido_id: "10",
        equipo_id: "1"
      }));
      const body = bodyOf(result);
      assert.equal(result.statusCode, 200, JSON.stringify(bodyOf(result)));
      assert.deepEqual(
        body.inscripciones.map(item => item.id),
        [4, 2]
      );
      assert.equal(
        calls.some(call => call.url.includes("jugadores_aliases")),
        false
      );
    }
  ));

  results.push(await runCase(
    "evento nuevo guarda ID y snapshot canonico sin confiar en nombre cliente",
    async () => {
      let inserted = null;
      const calls = installFetch(call => {
        if (call.url.includes("/rest/v1/torneos")) {
          return mockResponse(200, [tournamentRow()]);
        }
        if (call.url.includes("/rest/v1/partidos")) {
          return mockResponse(200, [matchRow()]);
        }
        if (call.url.includes("/rest/v1/etapas_estado")) {
          return mockResponse(200, []);
        }
        if (
          call.url.includes("/rest/v1/inscripciones_jugadores") &&
          call.url.includes("id=eq.154")
        ) {
          return mockResponse(200, [
            enrollmentRow({
              jugador: {
                id: 77,
                nombre_completo: "Joaquin Carrizo",
                nombre_normalizado: "joaquin carrizo",
                activo: true
              }
            })
          ]);
        }
        if (
          call.url.includes("/rest/v1/eventos_partido") &&
          call.url.includes("select=orden")
        ) {
          return mockResponse(200, []);
        }
        if (
          call.url.endsWith("/rest/v1/eventos_partido?select=*") &&
          call.method === "POST"
        ) {
          inserted = call.body;
          return mockResponse(200, [{ id: 900, ...call.body }]);
        }
        throw new Error(call.url);
      });

      const result = await handler(adminEvent("POST", {
        torneo_id: 2,
        partido_id: 10,
        equipo_id: 1,
        tipo: "gol_en_contra",
        minuto: 67,
        inscripcion_jugador_id: 154,
        jugador: "Nombre adulterado",
        estado_dato: "confirmado",
        fuente: null
      }));

      assert.equal(result.statusCode, 201);
      assert.equal(inserted.inscripcion_jugador_id, 154);
      assert.equal(inserted.jugador, "Joaquin Carrizo");
      assert.equal(inserted.equipo_id, 1);
      assert.equal(inserted.tipo, "gol_en_contra");
      assert.equal(inserted.estado_dato, "confirmado");
      assert.equal(inserted.fuente, null);
      assert.equal(
        calls.some(call =>
          call.url.includes("/rest/v1/partidos") &&
          call.method === "PATCH"
        ),
        false
      );
    }
  ));

  results.push(await runCase(
    "rechaza inscripcion de otro torneo, otro club y equipo ajeno",
    async () => {
      for (const [name, request, enrollment, expected] of [
        [
          "otro torneo",
          { equipo_id: 1, inscripcion_jugador_id: 154 },
          enrollmentRow({ torneo_id: 3 }),
          "torneo"
        ],
        [
          "otro club",
          { equipo_id: 1, inscripcion_jugador_id: 154 },
          enrollmentRow({ club_id: 2 }),
          "equipo"
        ],
        [
          "equipo ajeno",
          { equipo_id: 99, inscripcion_jugador_id: 154 },
          enrollmentRow(),
          "local o visitante"
        ]
      ]) {
        installFetch(call => {
          if (call.url.includes("/rest/v1/torneos")) {
            return mockResponse(200, [tournamentRow()]);
          }
          if (call.url.includes("/rest/v1/partidos")) {
            return mockResponse(200, [matchRow()]);
          }
          if (call.url.includes("/rest/v1/etapas_estado")) {
            return mockResponse(200, []);
          }
          if (call.url.includes("/rest/v1/inscripciones_jugadores")) {
            return mockResponse(200, [enrollment]);
          }
          throw new Error(`${name}: ${call.url}`);
        });
        const result = await handler(adminEvent("POST", {
          torneo_id: 2,
          partido_id: 10,
          tipo: "gol",
          minuto: 10,
          estado_dato: "por_verificar",
          ...request
        }));
        assert.equal(result.statusCode, 400, name);
        assert.match(bodyOf(result).error, new RegExp(expected, "i"));
      }
    }
  ));

  results.push(await runCase(
    "evento historico sin ID edita otros campos sin vincular ni borrar texto",
    async () => {
      let patched = null;
      installFetch(call => {
        if (call.url.includes("/rest/v1/torneos")) {
          return mockResponse(200, [tournamentRow()]);
        }
        if (
          call.url.includes("/rest/v1/eventos_partido?select=*") &&
          call.url.includes("id=eq.5")
        ) {
          return mockResponse(200, [{
            id: 5,
            partido_id: 10,
            equipo_id: 1,
            tipo: "gol",
            jugador: "Historico Sin ID",
            inscripcion_jugador_id: null,
            orden: 1
          }]);
        }
        if (call.url.includes("/rest/v1/partidos")) {
          return mockResponse(200, [matchRow()]);
        }
        if (call.url.includes("/rest/v1/etapas_estado")) {
          return mockResponse(200, []);
        }
        if (
          call.url.includes("/rest/v1/eventos_partido?id=eq.5") &&
          call.method === "PATCH"
        ) {
          patched = call.body;
          return mockResponse(200, [{ id: 5, ...call.body }]);
        }
        throw new Error(call.url);
      });

      const result = await handler(adminEvent("PATCH", {
        id: 5,
        torneo_id: 2,
        partido_id: 10,
        equipo_id: 1,
        tipo: "gol",
        minuto: 22,
        inscripcion_jugador_id: null,
        estado_dato: "por_verificar"
      }));

      assert.equal(result.statusCode, 200, JSON.stringify(bodyOf(result)));
      assert.equal(patched.inscripcion_jugador_id, null);
      assert.equal(patched.jugador, "Historico Sin ID");
      assert.equal(patched.estado_dato, "por_verificar");
    }
  ));

  results.push(await runCase(
    "cambio historico sin ID conserva ambos textos al editar otro campo",
    async () => {
      let patched = null;
      installFetch(call => {
        if (call.url.includes("/rest/v1/torneos")) {
          return mockResponse(200, [tournamentRow()]);
        }
        if (
          call.url.includes("/rest/v1/eventos_partido?select=*") &&
          call.url.includes("id=eq.8")
        ) {
          return mockResponse(200, [{
            id: 8,
            partido_id: 10,
            equipo_id: 1,
            tipo: "cambio",
            jugador: "Sale Historico",
            jugador_relacionado: "Entra Historico",
            inscripcion_jugador_id: null,
            inscripcion_relacionada_id: null,
            orden: 3
          }]);
        }
        if (call.url.includes("/rest/v1/partidos")) {
          return mockResponse(200, [matchRow()]);
        }
        if (call.url.includes("/rest/v1/etapas_estado")) {
          return mockResponse(200, []);
        }
        if (
          call.url.includes("/rest/v1/eventos_partido?id=eq.8") &&
          call.method === "PATCH"
        ) {
          patched = call.body;
          return mockResponse(200, [{ id: 8, ...call.body }]);
        }
        throw new Error(call.url);
      });

      const result = await handler(adminEvent("PATCH", {
        id: 8,
        torneo_id: 2,
        partido_id: 10,
        equipo_id: 1,
        tipo: "cambio",
        minuto: 61,
        inscripcion_jugador_id: null,
        inscripcion_relacionada_id: null,
        estado_dato: "por_verificar"
      }));

      assert.equal(result.statusCode, 200, JSON.stringify(bodyOf(result)));
      assert.equal(patched.inscripcion_jugador_id, null);
      assert.equal(patched.inscripcion_relacionada_id, null);
      assert.equal(patched.jugador, "Sale Historico");
      assert.equal(patched.jugador_relacionado, "Entra Historico");
    }
  ));

  results.push(await runCase(
    "evento vinculado preserva su inscripcion si el cliente omite el ID",
    async () => {
      let patched = null;
      installFetch(call => {
        if (call.url.includes("/rest/v1/torneos")) {
          return mockResponse(200, [tournamentRow()]);
        }
        if (
          call.url.includes("/rest/v1/eventos_partido?select=*") &&
          call.url.includes("id=eq.6")
        ) {
          return mockResponse(200, [{
            id: 6,
            partido_id: 10,
            equipo_id: 1,
            tipo: "gol",
            jugador: "Snapshot anterior",
            inscripcion_jugador_id: 154,
            estado_dato: "confirmado",
            fuente: "Acta oficial Liga",
            orden: 2
          }]);
        }
        if (call.url.includes("/rest/v1/partidos")) {
          return mockResponse(200, [matchRow()]);
        }
        if (call.url.includes("/rest/v1/etapas_estado")) {
          return mockResponse(200, []);
        }
        if (call.url.includes("/rest/v1/inscripciones_jugadores")) {
          return mockResponse(200, [enrollmentRow()]);
        }
        if (
          call.url.includes("/rest/v1/eventos_partido?id=eq.6") &&
          call.method === "PATCH"
        ) {
          patched = call.body;
          return mockResponse(200, [{ id: 6, ...call.body }]);
        }
        throw new Error(call.url);
      });

      const result = await handler(adminEvent("PATCH", {
        id: 6,
        torneo_id: 2,
        partido_id: 10,
        equipo_id: 1,
        tipo: "gol",
        minuto: 33,
        estado_dato: "confirmado",
        fuente: null
      }));

      assert.equal(result.statusCode, 200);
      assert.equal(patched.inscripcion_jugador_id, 154);
      assert.equal(patched.jugador, "Joaquin Carrizo");
      assert.equal(patched.estado_dato, "confirmado");
      assert.equal(patched.fuente, "Acta oficial Liga");
    }
  ));

  results.push(await runCase(
    "crear inscripcion existente es idempotente y no duplica",
    async () => {
      const calls = installFetch(call => {
        if (call.url.includes("/rest/v1/torneos")) {
          return mockResponse(200, [tournamentRow()]);
        }
        if (call.url.includes("/rest/v1/partidos")) {
          return mockResponse(200, [matchRow()]);
        }
        if (
          call.url.includes("/rest/v1/jugadores") &&
          call.url.includes("id=eq.77")
        ) {
          return mockResponse(200, [{
            id: 77,
            nombre_completo: "Joaquin Carrizo",
            nombre_normalizado: "joaquin carrizo",
            aliases: [],
            activo: true
          }]);
        }
        if (call.url.includes("/rest/v1/inscripciones_jugadores")) {
          return mockResponse(200, [enrollmentRow()]);
        }
        throw new Error(call.url);
      });

      const result = await handler(adminEvent("POST", {
        action: "crear-inscripcion-jugador",
        torneo_id: 2,
        partido_id: 10,
        equipo_id: 1,
        jugador_id: 77,
        busqueda_previa: true,
        confirmar_inscripcion: true
      }));

      assert.equal(result.statusCode, 200);
      assert.equal(bodyOf(result).existente, true);
      assert.equal(
        calls.some(call =>
          call.url.endsWith("/rest/v1/inscripciones_jugadores?select=*") &&
          call.method === "POST"
        ),
        false
      );
    }
  ));

  results.push(await runCase(
    "jugador nuevo requiere busqueda, confirmacion y operacion atomica",
    async () => {
      let rpcBody = null;
      installFetch(call => {
        if (call.url.includes("/rest/v1/torneos")) {
          return mockResponse(200, [tournamentRow()]);
        }
        if (call.url.includes("/rest/v1/partidos")) {
          return mockResponse(200, [matchRow()]);
        }
        if (call.url.includes("/rpc/tp_normalizar_nombre_jugador")) {
          return mockResponse(200, "\"nuevo jugador\"");
        }
        if (
          call.url.includes("/rest/v1/jugadores?") ||
          call.url.includes("/rest/v1/jugadores_aliases")
        ) {
          return mockResponse(200, []);
        }
        if (call.url.includes("/rest/v1/rpc/admin_guardar_inscripcion_jugador")) {
          rpcBody = call.body;
          return mockResponse(200, {
            jugador: {
              id: 300,
              nombre_completo: "Nuevo Jugador",
              nombre_normalizado: "nuevo jugador",
              activo: true
            },
            inscripcion: {
              id: 400,
              jugador_id: 300,
              club_id: 1,
              torneo_id: 2,
              posicion: "sin_definir",
              dorsal: null,
              estado: "por_verificar"
            }
          });
        }
        throw new Error(call.url);
      });

      const rejected = await handler(adminEvent("POST", {
        action: "crear-jugador-inscripcion",
        torneo_id: 2,
        partido_id: 10,
        equipo_id: 1,
        nombre_completo: "Nuevo Jugador",
        busqueda_previa: true
      }));
      assert.equal(rejected.statusCode, 400);

      const result = await handler(adminEvent("POST", {
        action: "crear-jugador-inscripcion",
        torneo_id: 2,
        partido_id: 10,
        equipo_id: 1,
        nombre_completo: "Nuevo Jugador",
        busqueda_previa: true,
        confirmar_creacion: true
      }));
      assert.equal(result.statusCode, 201, JSON.stringify(bodyOf(result)));
      assert.equal(rpcBody.p_jugador_id, null);
      assert.equal(rpcBody.p_nombre_completo, "Nuevo Jugador");
      assert.equal(rpcBody.p_club_id, 1);
      assert.equal(rpcBody.p_torneo_id, 2);
    }
  ));

  results.push(await runCase(
    "busqueda muestra homonimos separados y no fusiona Sanchez ni Sarco",
    async () => {
      async function search(name, normalized, players) {
        installFetch(call => {
          if (call.url.includes("/rest/v1/torneos")) {
            return mockResponse(200, [tournamentRow()]);
          }
          if (call.url.includes("/rest/v1/partidos")) {
            return mockResponse(200, [matchRow()]);
          }
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
            return mockResponse(200, []);
          }
          throw new Error(call.url);
        });
        const result = await handler(adminEvent("GET", null, {
          scope: "buscar-jugador",
          torneo_id: "2",
          partido_id: "10",
          equipo_id: "1",
          nombre: name
        }));
        return bodyOf(result).candidatos.map(item => item.jugador.id);
      }

      assert.deepEqual(
        await search("Sanchez", "sanchez", [
          {
            id: 11,
            nombre_completo: "Sanchez",
            nombre_normalizado: "sanchez",
            aliases: [],
            activo: true
          },
          {
            id: 25,
            nombre_completo: "Sanchez",
            nombre_normalizado: "sanchez",
            aliases: [],
            activo: true
          }
        ]),
        [11, 25]
      );
      assert.deepEqual(
        await search("Sarco", "sarco", [
          {
            id: 20,
            nombre_completo: "Sarco",
            nombre_normalizado: "sarco",
            aliases: [],
            activo: true
          },
          {
            id: 21,
            nombre_completo: "Sarco",
            nombre_normalizado: "sarco",
            aliases: [],
            activo: true
          }
        ]),
        [20, 21]
      );
    }
  ));

  results.push(await runCase(
    "eliminar incidencia no elimina jugador ni inscripcion",
    async () => {
      const calls = installFetch(call => {
        if (call.url.includes("/rest/v1/torneos")) {
          return mockResponse(200, [tournamentRow()]);
        }
        if (
          call.url.includes("/rest/v1/eventos_partido?select=*") &&
          call.url.includes("id=eq.8")
        ) {
          return mockResponse(200, [{
            id: 8,
            partido_id: 10,
            equipo_id: 1,
            tipo: "gol",
            jugador: "Joaquin Carrizo",
            inscripcion_jugador_id: 154
          }]);
        }
        if (call.url.includes("/rest/v1/partidos")) {
          return mockResponse(200, [matchRow()]);
        }
        if (call.url.includes("/rest/v1/etapas_estado")) {
          return mockResponse(200, []);
        }
        if (
          call.url.includes("/rest/v1/eventos_partido?id=eq.8") &&
          call.method === "DELETE"
        ) {
          return mockResponse(200, [{ id: 8 }]);
        }
        throw new Error(call.url);
      });

      const result = await handler(adminEvent("DELETE", {
        id: 8,
        torneo_id: 2
      }));
      assert.equal(result.statusCode, 200);
      assert.equal(
        calls.some(call =>
          /\/rest\/v1\/(jugadores|inscripciones_jugadores)/.test(call.url) &&
          call.method === "DELETE"
        ),
        false
      );
    }
  ));

  results.push(await runCase(
    "alcance cliente: sin texto libre, sin service role, sin goleadores",
    async () => {
      const html = fs.readFileSync(
        path.join(ROOT, "tp-admin-7c9f2026.html"),
        "utf8"
      );
      const js = fs.readFileSync(
        path.join(ROOT, "js", "admin-panel.js"),
        "utf8"
      );
      const css = fs.readFileSync(
        path.join(ROOT, "styles", "admin.css"),
        "utf8"
      );
      assert.match(html, /id="eventPlayerSearch"/);
      assert.match(html, /id="eventPlayerResults"[\s\S]*?role="listbox"/);
      assert.match(html, /id="eventPlayerMissingBtn"/);
      assert.match(html, /id="eventMissingFlow"/);
      assert.doesNotMatch(html, /<select[^>]+id="eventPlayer"/);
      assert.doesNotMatch(html, /<select[^>]+id="eventRelatedPlayer"/);
      assert.doesNotMatch(html + js, /eventCreateLegacy|crear_desde_texto/);
      assert.match(js, /EVENT_PLAYER_LIMIT = 8/);
      assert.match(js, /data-event-player/);
      assert.match(js, /eventFields\.player\.value = button\.dataset\.eventPlayer/);
      assert.match(js, /scope:\s*"jugadores"/);
      assert.match(js, /confirmar_creacion:\s*true/);
      assert.match(js, /confirmar_inscripcion:\s*true/);
      assert.match(js, /EVENT_PLAYER_LIMIT/);
      assert.match(css, /\.event-player-picker/);
      assert.match(css, /@media \(max-width: 820px\)/);
      assert.doesNotMatch(html + js, /SUPABASE_SERVICE_ROLE_KEY|test-service-role/);
      assert.doesNotMatch(html + js, /goleadores_oficiales/);
    }
  ));

  return results;
}

if (require.main === module) {
  runAdminIncidenciasTests()
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
  runAdminIncidenciasTests
};
