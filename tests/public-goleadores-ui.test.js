"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const APP_SOURCE = fs.readFileSync(path.join(ROOT, "js", "app.js"), "utf8");
const INDEX_SOURCE = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const UTILS_SOURCE = fs.readFileSync(path.join(ROOT, "js", "utils.js"), "utf8");

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
    MAXIMO_GOLEADORES_TABLA: 10,
    LIMITE_ESCUDOS_EAGER_TABLA: 10,
    LIMITE_ESCUDOS_PRIORIDAD_ALTA_TABLA: 4,
    escaparHtml: escapeHtml,
    nombre: value => value,
    obtenerEscudoEquipo: (equipo, clubId) =>
      String(clubId) === "43" || equipo === "Sportivo A. Club"
        ? "assets/img/sportivo.png"
        : "",
    obtenerEscudoEquipoTabla: (equipo, clubId) =>
      String(clubId) === "43" || equipo === "Sportivo A. Club"
        ? "assets/img/tablas/sportivo.png"
        : "",
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
    "obtenerIdListaGoleadoresTabla",
    "obtenerGoleadoresVisiblesTabla",
    "obtenerEscudoTablaEquipo",
    "obtenerInicialesEquipoTabla",
    "obtenerAtributosCargaEscudoTabla",
    "renderImagenEscudoTabla",
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
    /<div class="tabla-scorer">([\s\S]*?<div class="tabla-scorer-goals(?: leader)?">[\s\S]*?<\/div>)\s*<\/div>/g
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
    .filter(row => /<div class="tabla-scorer-goals leader">/.test(row))
    .map(row => {
      const match = /<strong>([^<]+)<\/strong>/.exec(row);
      return match?.[1] || "";
    });
}

function assertLeaders(tablas, filtro, expectedNames) {
  assert.deepEqual(extractLeaderNames(renderGoleadores(tablas, filtro)), expectedNames);
}

function scorer(jugador, club, goles, equipoId = null) {
  return {
    jugador_nombre: jugador,
    equipo_nombre: club,
    equipo_id: equipoId,
    goles
  };
}

function readPngSize(relativePath) {
  const buffer = fs.readFileSync(path.join(ROOT, relativePath));

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  };
}

function scorers(cantidad, club = "Club") {
  return Array.from({ length: cantidad }, (_, index) =>
    scorer(
      `Jugador ${String(index + 1).padStart(2, "0")}`,
      club,
      cantidad - index
    )
  );
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
  const viewListener = /document\.querySelectorAll\("\[data-tabla-vista\]"\)\.forEach\(btn => \{\s*btn\.addEventListener\('click'[\s\S]*?renderTabla\(\);\s*\}\);\s*\}\);/.exec(APP_SOURCE);

  assert.deepEqual(filterOrder, ["1", "2", "3", "general"]);
  assert.deepEqual(viewButtons, ["posiciones", "goleadores"]);
  assert.match(INDEX_SOURCE, /class="zt on" data-tabla-posiciones="1" role="tab" aria-selected="true"/);
  assert.match(APP_SOURCE, /let tablaPosicionesActual = "1";/);
  assert.ok(viewListener, "No se encontro listener de pestanas de tabla");
  assert.match(viewListener[0], /vista === "goleadores"[\s\S]*tablaPosicionesActual = "general"/);
  assert.match(
    extractFunction(APP_SOURCE, "actualizarNavegacionTabla"),
    /\["posiciones", "goleadores"\]\.includes\(\s*tablaVistaActual\s*\)/
  );
  results.push("filtros: Posiciones conserva Zona 1 y Goleadores entra en General: ok");

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
  assert.doesNotMatch(renderGoleadores(unico, "1"), /Jugador B[\s\S]*?tabla-scorer-goals leader/);
  assert.doesNotMatch(renderGoleadores(unico, "1"), /Jugador C[\s\S]*?tabla-scorer-goals leader/);
  results.push("lider unico: jugadores por debajo del maximo no se destacan: ok");

  assert.match(extractFunction(APP_SOURCE, "compararGoleadoresTabla"), /jugador_nombre/);
  assert.match(extractFunction(APP_SOURCE, "compararGoleadoresTabla"), /equipo_nombre/);
  assert.doesNotMatch(
    extractFunction(APP_SOURCE, "renderFilaGoleadorTabla"),
    /indice\s*===\s*0/
  );
  results.push("orden alfabetico: organiza empatados sin crear lider falso: ok");

  const tablaEscudo = {
    "1": [scorer("Jugador Escudo", "Sportivo A. Club", 2, 43)],
    "2": [],
    "3": [],
    general: []
  };
  const htmlEscudo = renderGoleadores(tablaEscudo, "1");
  const rowEscudo = extractRows(htmlEscudo)[0];
  assert.match(htmlEscudo, /class="tabla-scorer-shield\s*"/);
  assert.match(htmlEscudo, /<img[\s\S]*src="assets\/img\/tablas\/sportivo\.png"[\s\S]*alt=""/);
  assert.match(htmlEscudo, /loading="eager"/);
  assert.match(htmlEscudo, /fetchpriority="high"/);
  assert.match(htmlEscudo, /class="tabla-scorer-team-name"[\s\S]*Sportivo A\. Club/);
  assert.ok(
    rowEscudo.indexOf("tabla-scorer-shield") <
      rowEscudo.indexOf("tabla-scorer-player"),
    "El escudo debe renderizarse antes del bloque textual"
  );
  assert.ok(
    rowEscudo.indexOf("tabla-scorer-player") <
      rowEscudo.indexOf("tabla-scorer-goals"),
    "Los goles deben renderizarse despues del bloque textual"
  );
  assert.match(rowEscudo, /tabla-scorer-goals-number">2<\/span>/);
  assert.match(rowEscudo, /tabla-scorer-goals-unit">\s*GOLES\s*<\/span>/);

  const tablaSinEscudo = {
    "1": [scorer("Jugador Fallback", "Sin Escudo", 1)],
    "2": [],
    "3": [],
    general: []
  };
  const htmlSinEscudo = renderGoleadores(tablaSinEscudo, "1");
  const rowSinEscudo = extractRows(htmlSinEscudo)[0];
  assert.match(htmlSinEscudo, /class="tabla-scorer-shield is-missing"/);
  assert.match(htmlSinEscudo, /tabla-scorer-shield-fallback[\s\S]*SE/);
  assert.doesNotMatch(htmlSinEscudo, /<img/);
  assert.ok(
    rowSinEscudo.indexOf("tabla-scorer-shield is-missing") <
      rowSinEscudo.indexOf("tabla-scorer-player"),
    "El fallback debe ocupar la columna previa al texto"
  );
  assert.match(rowSinEscudo, /tabla-scorer-goals-number">1<\/span>/);
  assert.match(rowSinEscudo, /tabla-scorer-goals-unit">\s*GOL\s*<\/span>/);

  const sandboxPlural = buildSandbox(tablaSinEscudo, "1");
  const htmlCero = sandboxPlural.renderFilaGoleadorTabla(
    scorer("Jugador Cero", "Sin Escudo", 0),
    false
  );
  const htmlDoce = sandboxPlural.renderFilaGoleadorTabla(
    scorer("Jugador Doce", "Sin Escudo", 12),
    false
  );
  assert.match(htmlCero, /tabla-scorer-goals-number">0<\/span>/);
  assert.match(htmlCero, /tabla-scorer-goals-unit">\s*GOLES\s*<\/span>/);
  assert.match(htmlDoce, /tabla-scorer-goals-number">12<\/span>/);
  assert.match(htmlDoce, /tabla-scorer-goals-unit">\s*GOLES\s*<\/span>/);
  const htmlLazy = sandboxPlural.renderFilaGoleadorTabla(
    scorer("Jugador Lazy", "Sportivo A. Club", 2, 43),
    false,
    10
  );
  assert.match(htmlLazy, /loading="lazy"/);
  assert.doesNotMatch(htmlLazy, /fetchpriority="high"/);
  results.push("escudos y goles: ruta optimizada, fallback, carga y plural separados: ok");

  const escudosTabla = fs.readdirSync(path.join(ROOT, "assets", "img", "tablas"))
    .filter(file => file.endsWith(".png"))
    .sort();
  assert.equal(escudosTabla.length, 21);
  assert.match(UTILS_SOURCE, /function obtenerEscudoEquipoTabla/);
  assert.match(UTILS_SOURCE, /assets\/img\/tablas/);
  escudosTabla.forEach(file => {
    const original = path.join(ROOT, "assets", "img", file);
    const optimizado = path.join(ROOT, "assets", "img", "tablas", file);
    const dimensiones = readPngSize(path.join("assets", "img", "tablas", file));

    assert.equal(fs.existsSync(original), true, `${file} debe conservar original`);
    assert.equal(dimensiones.width, 80);
    assert.equal(dimensiones.height, 80);
    assert.ok(
      fs.statSync(optimizado).size < fs.statSync(original).size,
      `${file} optimizado debe pesar menos que el original`
    );
  });
  results.push("assets: derivados de escudos para tablas existen, son 80x80 y no rompen originales: ok");

  const tablasResumen = {
    "1": [],
    "2": scorers(1, "Club Uno"),
    "3": scorers(5, "Club Cinco"),
    general: scorers(6, "Club Seis")
  };

  assert.equal(extractRows(renderGoleadores(tablasResumen, "1")).length, 0);
  assert.doesNotMatch(renderGoleadores(tablasResumen, "1"), /data-goleadores-toggle/);
  assert.equal(extractRows(renderGoleadores(tablasResumen, "2")).length, 1);
  assert.doesNotMatch(renderGoleadores(tablasResumen, "2"), /data-goleadores-toggle/);
  assert.equal(extractRows(renderGoleadores(tablasResumen, "3")).length, 5);
  assert.doesNotMatch(renderGoleadores(tablasResumen, "3"), /data-goleadores-toggle/);

  const htmlSeis = renderGoleadores(tablasResumen, "general");
  assert.equal(extractRows(htmlSeis).length, 6);
  assert.match(htmlSeis, /<h3>Goleadores<\/h3>/);
  assert.match(htmlSeis, /General\s*&middot;\s*Top 10/);
  assert.doesNotMatch(htmlSeis, /Ver todos los goleadores|Ver menos|aria-expanded|jugadores/);
  results.push("resumen: menos de 10 muestra todos y no ofrece expansion: ok");

  const tablasVistas = {
    "1": scorers(11, "Zona Uno").map((item, index) => ({
      ...item,
      jugador_nombre: `Zona 1 ${index + 1}`
    })),
    "2": scorers(12, "Zona Dos").map((item, index) => ({
      ...item,
      jugador_nombre: `Zona 2 ${index + 1}`
    })),
    "3": scorers(13, "Zona Tres").map((item, index) => ({
      ...item,
      jugador_nombre: `Zona 3 ${index + 1}`
    })),
    general: scorers(14, "General").map((item, index) => ({
      ...item,
      jugador_nombre: `General ${index + 1}`
    }))
  };

  ["1", "2", "3", "general"].forEach(filtro => {
    const html = renderGoleadores(tablasVistas, filtro);
    const nombres = extractNames(html);
    const etiqueta = filtro === "general" ? "General" : `Zona ${filtro}`;

    assert.equal(nombres.length, 10);
    assert.deepEqual(
      nombres,
      Array.from({ length: 10 }, (_, index) => `${etiqueta} ${index + 1}`)
    );
    assert.match(html, new RegExp(`${etiqueta}\\s*&middot;\\s*Top 10`));
    assert.doesNotMatch(html, /Ver todos los goleadores|data-goleadores-toggle|aria-expanded/);
    assert.equal(
      nombres.every(nombre => nombre.startsWith(etiqueta)),
      true,
      `El filtro ${filtro} no debe mezclar otras zonas`
    );
  });

  const viewClickListener = /document\.querySelectorAll\("\[data-tabla-vista\]"\)\.forEach\(btn => \{\s*btn\.addEventListener\('click'[\s\S]*?renderTabla\(\);\s*\}\);\s*\}\);/.exec(APP_SOURCE);
  const filterClickListener = /document\.querySelectorAll\("\[data-tabla-posiciones\]"\)\.forEach\(btn => \{\s*btn\.addEventListener\('click'[\s\S]*?renderTabla\(\);\s*\}\);\s*\}\);/.exec(APP_SOURCE);
  assert.ok(viewClickListener, "No se encontro listener de click de vista");
  assert.ok(filterClickListener, "No se encontro listener de click de filtro");
  assert.match(viewClickListener[0], /tablaPosicionesActual = "general"/);
  assert.doesNotMatch(APP_SOURCE, /data-goleadores-toggle|Ver todos los goleadores|Ver menos goleadores/);
  results.push("top 10: cuatro filtros limitan, mantienen orden y no mezclan listas: ok");

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
