"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const APP_SOURCE = fs.readFileSync(path.join(ROOT, "js", "app.js"), "utf8");
const STYLE_SOURCE = fs.readFileSync(
  path.join(ROOT, "styles", "main.css"),
  "utf8"
);

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

function buildSandbox() {
  const sandbox = {
    state: { clubes: [] },
    nombre: value => value
  };
  const constants = `
    const ESTADOS_DATO = {
      confirmar: "A confirmar",
      sinDatos: "Sin datos",
      sinIdentificar: "Sin identificar"
    };
    const TIPOS_GOL_PARTIDO = new Set(["gol", "gol-penal", "gol-contra"]);
    const GRUPOS_INCIDENCIAS_DETALLE = [
      { clave: "goles", titulo: "Goles", tipos: ["gol", "gol-penal", "gol-contra"] },
      { clave: "amarillas", titulo: "Tarjetas amarillas", tipos: ["amarilla"] },
      { clave: "rojas", titulo: "Tarjetas rojas", tipos: ["roja", "doble-amarilla"] },
      { clave: "otras", titulo: "Otras incidencias", tipos: ["cambio", "otro"] }
    ];
  `;
  const functions = [
    "renderIncidenciasDetallePartido",
    "renderListadoIncidenciasDetallePartido",
    "agruparIncidenciasDetallePartido",
    "resolverLadoPresentacionIncidencia",
    "obtenerClaveAgrupacionIncidencia",
    "crearItemIncidenciaDetalle",
    "obtenerTextoJugadorIncidencia",
    "ordenarItemsIncidenciaDetalle",
    "invertirLadoPartido",
    "renderGrupoIncidenciasDetallePartido",
    "renderColumnaIncidenciasDetallePartido",
    "renderItemIncidenciaDetallePartido",
    "obtenerDetallesItemIncidencia",
    "obtenerEtiquetasEspecialesIncidencia",
    "obtenerDetalleMinutosIncidencia",
    "resolverLadoEvento",
    "normalizarTipoEvento",
    "limpiarNombreJugador",
    "normalizarClaveGoleador",
    "escaparHtml"
  ].map(name => extractFunction(APP_SOURCE, name)).join("\n\n");

  vm.runInNewContext(
    `${constants}
     ${functions}
     this.renderIncidenciasDetallePartido = renderIncidenciasDetallePartido;
     this.renderListadoIncidenciasDetallePartido = renderListadoIncidenciasDetallePartido;
     this.agruparIncidenciasDetallePartido = agruparIncidenciasDetallePartido;`,
    sandbox,
    { filename: "app-incidencias.js" }
  );

  return sandbox;
}

function sampleMatch() {
  return {
    id: 501,
    torneo_id: 2,
    local_id: 1,
    visitante_id: 2,
    local: "Equipo Local",
    visitante: "Equipo Visitante",
    goles_local: 2,
    goles_visitante: 2
  };
}

function sampleEvents() {
  return [
    eventRow(1, 501, 1, "gol", "Diego Diaz"),
    eventRow(2, 501, 1, "gol_penal", "Diego Diaz"),
    eventRow(3, 501, 2, "gol", "Luis Rojas"),
    eventRow(4, 501, 1, "gol_en_contra", "Nicolas Soto", { minuto: 12 }),
    eventRow(5, 501, 1, "amarilla", "Juan Perez", { minuto: 34 }),
    eventRow(6, 501, 2, "amarilla", "Pedro Gomez"),
    eventRow(7, 501, 2, "roja", "Carlos Vera", { minuto: 88 }),
    eventRow(8, 501, 1, "doble_amarilla", "Mario Luna"),
    eventRow(9, 999, 1, "gol", "Otro Partido")
  ];
}

function eventRow(id, partidoId, equipoId, tipo, jugador, extra = {}) {
  return {
    id,
    partido_id: partidoId,
    equipo_id: equipoId,
    tipo,
    jugador,
    estado_dato: "confirmado",
    minuto: null,
    periodo: null,
    orden: id,
    ...extra
  };
}

function groupByKey(resumen, key) {
  return resumen.grupos.find(grupo => grupo.clave === key);
}

function runTests() {
  const results = [];
  const sandbox = buildSandbox();
  const partido = sampleMatch();
  const eventos = sampleEvents().filter(
    evento => String(evento.partido_id) === String(partido.id)
  );
  const snapshot = JSON.stringify(eventos);
  const resumen = sandbox.agruparIncidenciasDetallePartido(partido, eventos);

  assert.equal(resumen.total, eventos.length);
  assert.equal(JSON.stringify(eventos), snapshot);
  assert.deepEqual(
    Array.from(resumen.grupos.map(grupo => grupo.clave)),
    ["goles", "amarillas", "rojas"]
  );
  assert.equal(groupByKey(resumen, "goles").total, 4);
  assert.equal(groupByKey(resumen, "amarillas").total, 2);
  assert.equal(groupByKey(resumen, "rojas").total, 2);
  assert.equal(
    groupByKey(resumen, "goles").equipos.local.find(
      item => item.jugador === "Diego Diaz"
    ).cantidad,
    2
  );
  assert.equal(
    groupByKey(resumen, "goles").equipos.visitante.some(
      item => item.jugador === "Nicolas Soto"
    ),
    true
  );
  results.push("agrupacion: goles repetidos, tarjetas y gol en contra conservan registros: ok");

  const html = sandbox.renderIncidenciasDetallePartido(
    partido,
    eventos,
    { eventos, secuenciaPublicable: true },
    { tipo: "finalizado" },
    true
  );

  assert.match(html, /<h3>Goles<\/h3>/);
  assert.match(html, /<h3>Tarjetas amarillas<\/h3>/);
  assert.match(html, /<h3>Tarjetas rojas<\/h3>/);
  assert.match(html, /Diego Diaz/);
  assert.match(html, /&times;2/);
  assert.match(html, /Gol de penal/);
  assert.match(html, /Gol en contra/);
  assert.match(html, /Juan Perez[\s\S]*34'/);
  assert.doesNotMatch(html, /Pedro Gomez[\s\S]{0,80}\d+'/);
  assert.match(html, /Carlos Vera[\s\S]*Expulsi&oacute;n[\s\S]*88'/);
  assert.match(html, /Mario Luna[\s\S]*Doble amarilla \+ expulsi&oacute;n/);
  assert.doesNotMatch(html, /Otro Partido/);
  assert.doesNotMatch(html, /event-axis|event-team-head|event-score/);
  assert.doesNotMatch(html, /\b\d+\s*[-\u2013]\s*\d+\b/);
  results.push("render: listado compacto por tipo/equipo sin parciales ni eje temporal: ok");

  const empty = sandbox.renderListadoIncidenciasDetallePartido(
    partido,
    [],
    { tipo: "finalizado" }
  );
  assert.match(empty, /No hay incidencias cargadas para este partido\./);
  assert.doesNotMatch(empty, /incident-group/);
  results.push("estado vacio: conserva mensaje breve sin grupos: ok");

  assert.match(APP_SOURCE, /const LISTADO_NEUTRAL_INCIDENCIAS_PUBLICAS = true;/);
  assert.match(
    extractFunction(APP_SOURCE, "renderDetallePartido"),
    /String\(evento\.partido_id\) === String\(partido\.id\)/
  );
  assert.doesNotMatch(
    extractFunction(APP_SOURCE, "renderListadoIncidenciasDetallePartido"),
    /renderMarcadorIncidencia|event-axis|event-team-head|event-score/
  );
  assert.match(APP_SOURCE, /function renderCronologiaIncidenciasDetallePartido/);
  assert.match(APP_SOURCE, /function prepararSecuenciaEventos/);
  results.push("alcance: filtrado por partido y cronologia futura quedan verificables: ok");

  assert.match(
    STYLE_SOURCE,
    /\.incident-teams[\s\S]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/
  );
  assert.match(
    STYLE_SOURCE,
    /@media \(max-width: 390px\)[\s\S]*\.incident-teams[\s\S]*grid-template-columns: 1fr/
  );
  assert.match(STYLE_SOURCE, /\.incident-kind-amarillas[\s\S]*var\(--draw\)/);
  assert.match(STYLE_SOURCE, /\.incident-kind-rojas[\s\S]*var\(--loss\)/);
  results.push("responsive: dos columnas escritorio y una columna movil: ok");

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

module.exports = { runTests };
