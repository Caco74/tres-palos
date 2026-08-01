"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const APP_SOURCE = fs.readFileSync(path.join(ROOT, "js", "app.js"), "utf8");
const INDEX_SOURCE = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

function extractFunction(source, name) {
  const match = new RegExp(`function\\s+${name}\\s*\\(`).exec(source);
  assert.ok(match, `No se encontro ${name}`);
  const start = match.index;

  let depth = 0;
  let end = start;
  let opened = false;
  for (; end < source.length; end += 1) {
    if (source[end] === "{") {
      depth += 1;
      opened = true;
    }
    if (source[end] === "}") {
      depth -= 1;
      if (opened && depth === 0) {
        end += 1;
        break;
      }
    }
  }

  return source.slice(start, end);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildSandbox(tablas, filtro) {
  const sandbox = {
    state: {
      goleadoresTabla: {
        fuente: "eventos_identificados",
        mensaje_vacio: "Todavia no hay goles cargados para este torneo.",
        tablas
      },
      errorGoleadoresTabla: false
    },
    tablaPosicionesActual: filtro,
    zonaActual: 1,
    errorCargaDatos: false,
    cargaPartidosFinalizada: true,
    escaparHtml: escapeHtml,
    nombre: value => value,
    obtenerNombreTorneoActivo: () => "Clausura 2026",
    renderEstadoVista: () => "<estado></estado>",
    renderSkeletonTabla: () => "<skeleton></skeleton>"
  };

  const functions = [
    "normalizarFilasGoleadoresTabla",
    "compararGoleadoresTabla",
    "obtenerClaveFiltroGoleadoresTabla",
    "obtenerEtiquetaFiltroGoleadoresTabla",
    "obtenerGoleadoresTablaPublicables",
    "obtenerMensajeVacioGoleadoresTabla",
    "renderFilaGoleadorTabla",
    "renderTablaGoleadores"
  ].map(name => extractFunction(APP_SOURCE, name)).join("\n\n");

  vm.runInNewContext(functions, sandbox, { filename: "app-goleadores.js" });
  return sandbox;
}

function renderGoleadores(tablas, filtro) {
  const sandbox = buildSandbox(tablas, filtro);
  const container = { innerHTML: "" };
  sandbox.renderTablaGoleadores(container);
  return container.innerHTML;
}

function extractRows(html) {
  return [...html.matchAll(
    /<div class="tabla-scorer">([\s\S]*?)<\/b>\s*<\/div>/g
  )].map(match => match[1]);
}

function extractNames(html) {
  return extractRows(html).map(row => {
    const match = /<strong>([^<]+)<\/strong>/.exec(row);
    return match?.[1] || "";
  });
}

function extractLeaderNames(html) {
  return extractRows(html)
    .filter(row => /<b class="leader">/.test(row))
    .map(row => {
      const match = /<strong>([^<]+)<\/strong>/.exec(row);
      return match?.[1] || "";
    });
}

function assertLeaders(tablas, filtro, expectedNames) {
  assert.deepEqual(extractLeaderNames(renderGoleadores(tablas, filtro)), expectedNames);
}

function scorer(jugador, club, goles) {
  return {
    jugador_nombre: jugador,
    equipo_nombre: club,
    goles
  };
}

function sampleTables() {
  return {
    "1": [
      scorer("Gino Toia", "Sportivo", 1),
      scorer("Facundo Astrada", "Sportivo", 1),
      scorer("Genaro Onega", "Sportivo", 1)
    ],
    "2": [
      scorer("Jugador C", "Club C", 3),
      scorer("Jugador B", "Club B", 4),
      scorer("Jugador A", "Club A", 4)
    ],
    "3": [
      scorer("Jugador C", "Club C", 2),
      scorer("Jugador A", "Club A", 4),
      scorer("Jugador B", "Club B", 3)
    ],
    general: [
      scorer("Jugador C", "Club C", 4),
      scorer("Jugador B", "Club B", 5),
      scorer("Jugador A", "Club A", 5)
    ]
  };
}

function runTests() {
  const results = [];
  const filterOrder = [...INDEX_SOURCE.matchAll(
    /data-tabla-posiciones="([^"]+)"/g
  )].map(match => match[1]);
  const viewButtons = [...INDEX_SOURCE.matchAll(
    /data-tabla-vista="([^"]+)"/g
  )].map(match => match[1]);
  const viewListener = /document\.querySelectorAll\("\[data-tabla-vista\]"\)[\s\S]*?document\.querySelectorAll\("\[data-tabla-posiciones\]"\)/.exec(APP_SOURCE);

  assert.deepEqual(filterOrder, ["1", "2", "3", "general"]);
  assert.deepEqual(viewButtons, ["posiciones", "goleadores"]);
  assert.match(INDEX_SOURCE, /class="zt on" data-tabla-posiciones="1" role="tab" aria-selected="true"/);
  assert.match(APP_SOURCE, /let tablaPosicionesActual = "1";/);
  assert.ok(viewListener, "No se encontro listener de pestanas de tabla");
  assert.doesNotMatch(viewListener[0], /tablaPosicionesActual\s*=/);
  assert.match(
    extractFunction(APP_SOURCE, "actualizarNavegacionTabla"),
    /\["posiciones", "goleadores"\]\.includes\(\s*tablaVistaActual\s*\)/
  );
  results.push("filtros: Zona 1 inicial, orden compartido y General sin seleccion automatica: ok");

  const tablas = sampleTables();
  assert.deepEqual(
    extractNames(renderGoleadores(tablas, "1")),
    ["Facundo Astrada", "Genaro Onega", "Gino Toia"]
  );
  assertLeaders(
    tablas,
    "1",
    ["Facundo Astrada", "Genaro Onega", "Gino Toia"]
  );
  assertLeaders(tablas, "2", ["Jugador A", "Jugador B"]);
  assertLeaders(tablas, "3", ["Jugador A"]);
  assertLeaders(tablas, "general", ["Jugador A", "Jugador B"]);
  results.push("lideres empatados: Zona 1, Zona 2, Zona 3 y General calculan maximo activo: ok");

  const unico = {
    "1": [
      scorer("Jugador A", "Club A", 4),
      scorer("Jugador B", "Club B", 3),
      scorer("Jugador C", "Club C", 2)
    ],
    "2": [],
    "3": [],
    general: []
  };
  assertLeaders(unico, "1", ["Jugador A"]);
  assert.doesNotMatch(renderGoleadores(unico, "1"), /Jugador B[\s\S]*?<b class="leader">/);
  assert.doesNotMatch(renderGoleadores(unico, "1"), /Jugador C[\s\S]*?<b class="leader">/);
  results.push("lider unico: jugadores por debajo del maximo no se destacan: ok");

  assert.match(extractFunction(APP_SOURCE, "compararGoleadoresTabla"), /jugador_nombre/);
  assert.match(extractFunction(APP_SOURCE, "compararGoleadoresTabla"), /equipo_nombre/);
  assert.doesNotMatch(
    extractFunction(APP_SOURCE, "renderFilaGoleadorTabla"),
    /indice\s*===\s*0/
  );
  results.push("orden alfabetico: organiza empatados sin crear lider falso: ok");

  return results;
}

if (require.main === module) {
  try {
    runTests().forEach(result => console.log(result));
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}

module.exports = {
  runTests
};
