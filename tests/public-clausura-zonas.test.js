"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const PublicTournament = require("../js/public-tournament");
const cargar = require("../scripts/cargar-clausura-2026");
const preparar = require("../scripts/preparar-clausura-2026");

const ROOT = path.resolve(__dirname, "..");
const TORNEO_CLAUSURA = 2;
const TORNEO_APERTURA = 1;
const CARCARANA_ID = 57;

function normalize(value) {
  return preparar.normalizeClubName(value);
}

function loadClausuraRecords() {
  return cargar.buildContext().records.map((record, index) => ({
    ...record,
    id: 1000 + index
  }));
}

function makeAperturaHistory() {
  return Array.from({ length: 140 }, (_, index) => ({
    id: 1 + index,
    torneo_id: TORNEO_APERTURA,
    tipo: index < 126 ? "regular" : "playoff",
    fase: index < 126 ? null : "octavos",
    fecha: index < 126 ? Math.floor(index / 9) + 1 : null,
    zona: index < 126 ? 1 : null,
    local_id: CARCARANA_ID,
    visitante_id: 43,
    local: "C.A. Carcarana",
    visitante: "Sportivo A. Club",
    estado: "finalizado",
    goles_local: index < 126 ? 1 : null,
    goles_visitante: index < 126 ? 1 : null,
    penales_local: null,
    penales_visitante: null
  }));
}

function participantsByZone(derived, zone) {
  return PublicTournament.getTeamsByZone(derived, zone).map(normalize);
}

function matchesByTeam(records, expected) {
  const expectedName = normalize(expected);

  return records.filter(record =>
    normalize(record.local).includes(expectedName) ||
    normalize(record.visitante).includes(expectedName)
  );
}

function freeDatesByTeam(records, derived, expected, zone) {
  const expectedName = normalize(expected);
  const byDate = new Map();

  records
    .filter(record =>
      record.tipo === "regular" &&
      Number(record.zona) === Number(zone)
    )
    .forEach(record => {
      const fecha = Number(record.fecha);
      if (!byDate.has(fecha)) byDate.set(fecha, []);
      byDate.get(fecha).push(record);
    });

  return [...byDate.entries()]
    .filter(([, matches]) =>
      PublicTournament.getFreeParticipants(derived, matches, zone, {
        torneoId: TORNEO_CLAUSURA
      }).teams.some(team => normalize(team).includes(expectedName))
    )
    .map(([fecha]) => fecha)
    .sort((a, b) => a - b);
}

function assertIncludesTeam(teams, expected) {
  assert.equal(
    teams.some(team => team.includes(normalize(expected))),
    true,
    `${expected} debe estar presente`
  );
}

function applySixLoadedResults(records) {
  const results = {
    "C2026-F01-Z1-01": [2, 1],
    "C2026-F01-Z1-02": [0, 0],
    "C2026-F01-Z1-03": [1, 3],
    "C2026-F01-Z3-01": [1, 0],
    "C2026-F01-Z3-02": [2, 2],
    "C2026-F01-Z3-03": [0, 1]
  };

  return records.map(record => {
    const score = results[record.source_fixture_key];
    if (!score) return record;
    return {
      ...record,
      estado: "finalizado",
      goles_local: score[0],
      goles_visitante: score[1]
    };
  });
}

function finishRegularDate(records, date) {
  return records.map((record, index) => {
    if (record.tipo !== "regular" || Number(record.fecha) !== Number(date)) {
      return record;
    }

    return {
      ...record,
      estado: "finalizado",
      goles_local: record.goles_local ?? index % 4,
      goles_visitante: record.goles_visitante ?? (index + 1) % 3
    };
  });
}

function finishAllRegular(records) {
  return records.map((record, index) => {
    if (record.tipo !== "regular") return record;

    return {
      ...record,
      estado: "finalizado",
      goles_local: record.goles_local ?? index % 4,
      goles_visitante: record.goles_visitante ?? (index + 2) % 3
    };
  });
}

function rowByName(table, expected) {
  const expectedName = normalize(expected);
  const row = table.find(item => normalize(item.equipo).includes(expectedName));
  assert.ok(row, `${expected} debe estar en la tabla`);
  return row;
}

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

function extractSmallTexts(html) {
  return [...html.matchAll(/<small\b[^>]*>([\s\S]*?)<\/small>/g)]
    .map(match => match[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function mockJsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  };
}

function buildObtenerPartidosSandbox(appSource, overrides = {}) {
  const calls = [];
  const elements = {};
  const rendered = [];
  const warnings = [];
  const errors = [];
  const mensajeFailClosed =
    "No se pudo determinar el torneo actual. Intentá nuevamente más tarde.";
  const defaultTorneos = [
    {
      id: TORNEO_APERTURA,
      nombre: "Apertura 2026",
      anio: 2026,
      tipo: "apertura",
      activo: false
    },
    {
      id: TORNEO_CLAUSURA,
      nombre: "Clausura 2026",
      anio: 2026,
      tipo: "clausura",
      activo: true
    }
  ];
  const currentPartidos = overrides.currentPartidos || [
    { id: 20, torneo_id: TORNEO_CLAUSURA, tipo: "regular", fecha: 1 }
  ];
  const partidosTodos = overrides.partidosTodos || [
    { id: 10, torneo_id: TORNEO_APERTURA, tipo: "regular", fecha: 1 },
    ...currentPartidos
  ];
  const torneosResponse = Object.prototype.hasOwnProperty.call(
    overrides,
    "torneosResponse"
  )
    ? overrides.torneosResponse
    : defaultTorneos;

  const sandbox = {
    JSON,
    Date,
    encodeURIComponent,
    SUPABASE_URL: "https://supabase.test",
    SUPABASE_KEY: "anon",
    EVENTOS_PUBLICOS_SELECT: "id,partido_id",
    MENSAJE_TORNEO_PUBLICO_INVALIDO: mensajeFailClosed,
    actualizandoDatos: false,
    cargaPartidosFinalizada: false,
    errorCargaDatos: false,
    mensajeErrorCargaDatos: "",
    ultimaCargaDatos: 0,
    etapaActual: "fecha:1",
    zonaActual: 1,
    vistaActual: overrides.vistaActual || { id: "inicio", navId: "inicio" },
    previewTorneoIdSolicitado: overrides.previewTorneoIdSolicitado || null,
    state: {
      torneos: overrides.initialTorneos || [],
      torneoSeleccionadoId: overrides.torneoSeleccionadoId || null,
      torneoPreview: null,
      torneoVigente: null,
      torneoActivo: null,
      partidos: overrides.initialPartidos || [],
      partidosTodos: [],
      eventos: [],
      eventosTodos: [],
      goleadoresOficiales: [],
      goleadoresOficialesTodos: [],
      goleadoresTabla: null,
      errorGoleadoresTabla: false
    },
    window: {
      location: {
        hostname: overrides.hostname || "trespalos.com.ar",
        search: overrides.search || ""
      },
      TPPublicTournament: {
        isNetlifyPreviewHost: () => Boolean(overrides.previewHost)
      }
    },
    document: {
      getElementById: id => {
        if (!elements[id]) elements[id] = { innerHTML: "" };
        return elements[id];
      }
    },
    console: {
      warn: (...args) => warnings.push(args.map(String).join(" ")),
      error: (...args) => errors.push(args.map(String).join(" "))
    },
    escaparHtml: value => String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;"),
    crearTablaGoleadoresVacia: () => ({
      fuente: null,
      mensaje_vacio: "",
      tablas: { "1": [], "2": [], "3": [], general: [] }
    }),
    normalizarRespuestaGoleadoresTabla: data => data,
    aplicarClubes: clubes => {
      sandbox.clubesAplicados = clubes;
    },
    actualizarNavegacionEtapas: () => rendered.push("nav"),
    renderMatches: () => rendered.push("partidos"),
    renderTabla: zona => rendered.push(`tabla:${zona}`),
    renderInicio: () => rendered.push("inicio"),
    renderPlayoffs: () => rendered.push("playoffs"),
    renderTeams: () => rendered.push("equipos"),
    renderDetallePartido: id => rendered.push(`partido:${id}`),
    renderDetalleEquipo: equipo => rendered.push(`equipo:${equipo}`),
    fetch: async url => {
      const text = String(url);
      calls.push(text);

      if (text.includes("/rest/v1/torneos?")) {
        return mockJsonResponse(overrides.torneosStatus || 200, torneosResponse);
      }
      if (
        text.includes("/rest/v1/partidos?select=*") &&
        text.includes("torneo_id=eq.")
      ) {
        return mockJsonResponse(overrides.partidosStatus || 200, currentPartidos);
      }
      if (text.includes("/rest/v1/partidos?select=*&order=id.asc")) {
        return mockJsonResponse(overrides.partidosTodosStatus || 200, partidosTodos);
      }
      if (text.includes("/rest/v1/eventos_partido_publicos?")) {
        return mockJsonResponse(overrides.eventosStatus || 200, overrides.eventos || []);
      }
      if (text.includes("/rest/v1/clubes?")) {
        return mockJsonResponse(overrides.clubesStatus || 200, overrides.clubes || []);
      }
      if (text.includes("/.netlify/functions/goleadores-publicos?")) {
        return mockJsonResponse(
          overrides.goleadoresStatus || 200,
          overrides.goleadores || {
            fuente: "eventos_identificados",
            mensaje_vacio: "",
            tablas: { "1": [], "2": [], "3": [], general: [] }
          }
        );
      }

      throw new Error(`Fetch inesperado: ${text}`);
    }
  };

  sandbox.aplicarDatosTorneo = torneo => {
    sandbox.appliedTournament = torneo || null;
    sandbox.state.torneoActivo = torneo || null;
    sandbox.state.partidos = torneo?.id
      ? sandbox.state.partidosTodos.filter(
          partido => String(partido.torneo_id) === String(torneo.id)
        )
      : [...sandbox.state.partidosTodos];
    const partidosIds = new Set(sandbox.state.partidos.map(partido => String(partido.id)));
    sandbox.state.eventos = sandbox.state.eventosTodos.filter(evento =>
      partidosIds.has(String(evento.partido_id))
    );
  };

  const obtenerPartidosSource = extractFunction(appSource, "obtenerPartidos")
    .replace(/^function\s+obtenerPartidos/, "async function obtenerPartidos");

  vm.runInNewContext(
    `${extractFunction(appSource, "renderEstadoVista")}
     ${extractFunction(appSource, "obtenerMensajeErrorCargaDatos")}
     ${extractFunction(appSource, "obtenerTorneoActivo")}
     ${extractFunction(appSource, "obtenerTorneoPreview")}
     ${extractFunction(appSource, "obtenerTorneoSeleccionado")}
     ${extractFunction(appSource, "crearErrorTorneoPublicoInvalido")}
     ${extractFunction(appSource, "renderDatos")}
     ${obtenerPartidosSource}
     this.obtenerPartidos = obtenerPartidos;`,
    sandbox
  );

  if (!overrides.usarRenderDatosReal) {
    sandbox.renderDatos = () => rendered.push("datos");
  }

  return {
    run: async () => {
      await sandbox.obtenerPartidos();
      return { calls, elements, rendered, warnings, errors, sandbox };
    }
  };
}

function buildRenderMiniPartido(appSource) {
  const sandbox = {
    JSON,
    window: {
      TPPublicTournament: PublicTournament
    },
    partidoResueltoParaVista: partido =>
      ["finalizado", "resuelto"].includes(partido.estado) ||
      (
        !partido.estado &&
        partido.goles_local !== null &&
        partido.goles_local !== undefined &&
        partido.goles_visitante !== null &&
        partido.goles_visitante !== undefined
      ),
    partidoTieneResultado: partido =>
      partido.goles_local !== null &&
      partido.goles_local !== undefined &&
      partido.goles_visitante !== null &&
      partido.goles_visitante !== undefined,
    ESTADOS_PARTIDO_FINALIZADO_OFICIAL: new Set([
      "finalizado",
      "finalizada",
      "resuelto",
      "resuelta",
      "cerrado",
      "cerrada",
      "terminado",
      "terminada",
      "completado",
      "completada",
      "homologado",
      "homologada"
    ]),
    obtenerLadoEquipoPartido: (partido, equipo) => {
      if (partido.local === equipo || String(partido.local_id) === String(equipo)) {
        return "local";
      }
      if (
        partido.visitante === equipo ||
        String(partido.visitante_id) === String(equipo)
      ) {
        return "visitante";
      }
      return null;
    },
    obtenerEstadoTemporalPartido: partido => ({
      texto: partido.estadoTexto || "A confirmar"
    }),
    ESTADOS_DATO: {
      confirmar: "A confirmar"
    },
    formatearMomentoPartido: partido => partido.estadoTexto || "A confirmar",
    etiquetaFase: fase => ({
      octavos: "Octavos de Final",
      cuartos: "Cuartos de Final",
      semifinal: "Semifinales",
      final: "Final"
    }[fase] || "Playoffs"),
    formatearFechaCompleta: fecha => {
      if (!fecha) return "-";
      const [year, month, day] = fecha.split("-");
      return `${day}/${month}/${year.slice(-2)}`;
    },
    escaparHtml: value => String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;"),
    obtenerNombreLadoPartido: (partido, lado) => partido[lado]
  };

  vm.runInNewContext(
    `${extractFunction(appSource, "normalizarEstadoPartidoValor")}
     ${extractFunction(appSource, "partidoTieneEstadoFinalizadoOficial")}
     ${extractFunction(appSource, "partidoTieneResultadoVisualConfirmado")}
     ${extractFunction(appSource, "clasificarResultadoEquipoPartido")}
     ${extractFunction(appSource, "obtenerClaseResultadoEquipoPartido")}
     ${extractFunction(appSource, "partidoFinalizadoRecorridoEquipo")}
     ${extractFunction(appSource, "renderMiniPartido")}
     this.renderMiniPartido = renderMiniPartido;`,
    sandbox
  );

  return sandbox.renderMiniPartido;
}

function buildRenderActividadLibre(appSource) {
  const sandbox = {
    escaparHtml: value => String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;"),
    nombre: value => value
  };

  vm.runInNewContext(
    `${extractFunction(appSource, "renderActividadLibre")}
     this.renderActividadLibre = renderActividadLibre;`,
    sandbox
  );

  return sandbox.renderActividadLibre;
}

function buildRenderResumenTablaEquipo(appSource) {
  const sandbox = {
    escaparHtml: value => String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
  };

  vm.runInNewContext(
    `${extractFunction(appSource, "renderInsigniaEstadoEquipoTorneo")}
     ${extractFunction(appSource, "renderResumenTablaEquipo")}
     this.renderResumenTablaEquipo = renderResumenTablaEquipo;`,
    sandbox
  );

  return sandbox.renderResumenTablaEquipo;
}

function buildAntecedentesDetallePartido(appSource, overrides = {}) {
  const clubes = overrides.clubes || [
    { id: 101, nombre_oficial: "Club Atletico Norte", nombre_corto: "Norte" },
    { id: 202, nombre_oficial: "Club Social Sur", nombre_corto: "Sur" },
    { id: 303, nombre_oficial: "Club Atletico Este", nombre_corto: "Este" }
  ];
  const sandbox = {
    JSON,
    window: {
      TPPublicTournament: PublicTournament
    },
    state: {
      partidosTodos: overrides.partidosTodos || [],
      partidos: overrides.partidos || [],
      torneos: overrides.torneos || [
        { id: 1, nombre: "Apertura 2026" },
        { id: 2, nombre: "Clausura 2026" },
        { id: 3, nombre: "Copa 2025" }
      ]
    },
    cargaPartidosFinalizada:
      overrides.cargaPartidosFinalizada !== undefined
        ? overrides.cargaPartidosFinalizada
        : true,
    obtenerClub: (equipo, clubId = null) => {
      if (clubId !== null && clubId !== undefined && clubId !== "") {
        return clubes.find(club => String(club.id) === String(clubId)) || null;
      }
      const normalizado = String(equipo || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
      return clubes.find(club =>
        [club.nombre_oficial, club.nombre_corto]
          .filter(Boolean)
          .map(nombreClub => String(nombreClub)
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase())
          .includes(normalizado)
      ) || null;
    },
    nombre: (equipo, clubId = null) => {
      const club = sandbox.obtenerClub(equipo, clubId);
      return club?.nombre_corto || equipo;
    },
    partidoTieneResultado: partido =>
      partido.goles_local !== null &&
      partido.goles_local !== undefined &&
      partido.goles_visitante !== null &&
      partido.goles_visitante !== undefined,
    resolverPartidoPlayoff: partido => partido,
    obtenerPartidosResueltosTorneoHistorial: torneo =>
      sandbox.state.partidosTodos.filter(
        partido => String(partido.torneo_id) === String(torneo.id)
      ),
    etiquetaFase: fase => ({
      octavos: "Octavos de Final",
      cuartos: "Cuartos de Final",
      semifinal: "Semifinales",
      final: "Final"
    }[fase] || "Playoffs"),
    etiquetaInstanciaPartido: partido => {
      if (partido.tipo === "regular") return `Fecha ${partido.fecha || ""}`.trim();
      if (partido.fase === "final") {
        return Number(partido.numero_playoff) === 2 ? "Vuelta" : "Ida";
      }
      return `Llave ${partido.numero_playoff || 1}`;
    },
    escaparHtml: value => String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;")
  };

  vm.runInNewContext(
    `${extractFunction(appSource, "normalizarEstadoPartidoValor")}
     ${extractFunction(appSource, "partidoTieneEstadoFinalizadoOficial")}
     ${extractFunction(appSource, "partidoTieneResultadoVisualConfirmado")}
     ${extractFunction(appSource, "obtenerClubIdLadoPartido")}
     ${extractFunction(appSource, "obtenerParejaClubesPartido")}
     ${extractFunction(appSource, "partidoCoincideConParejaClubes")}
     ${extractFunction(appSource, "obtenerFechaCalendarioPartido")}
     ${extractFunction(appSource, "antecedenteEsAnteriorAlPartido")}
     ${extractFunction(appSource, "obtenerPartidosHistoricosDetallePartido")}
     ${extractFunction(appSource, "compararAntecedentesRecientes")}
     ${extractFunction(appSource, "obtenerUltimosAntecedentesPartido")}
     ${extractFunction(appSource, "obtenerTorneoPartidoHistorial")}
     ${extractFunction(appSource, "obtenerEtiquetaTorneoPartido")}
     ${extractFunction(appSource, "obtenerEtiquetaInstanciaAntecedente")}
     ${extractFunction(appSource, "formatearFechaAntecedente")}
     ${extractFunction(appSource, "renderAntecedenteDetallePartido")}
     ${extractFunction(appSource, "renderAntecedentesDetallePartido")}
     this.obtenerUltimosAntecedentesPartido = obtenerUltimosAntecedentesPartido;
     this.renderAntecedentesDetallePartido = renderAntecedentesDetallePartido;`,
    sandbox
  );

  return {
    obtener: (partido, limite) =>
      sandbox.obtenerUltimosAntecedentesPartido(partido, limite),
    render: partido => sandbox.renderAntecedentesDetallePartido(partido),
    sandbox
  };
}

function buildFormaRecienteDetallePartido(appSource, overrides = {}) {
  const clubes = overrides.clubes || [
    {
      id: 101,
      nombre_oficial: "Equipo Central",
      nombre_corto: "Central",
      escudo_url: "central.svg"
    },
    {
      id: 202,
      nombre_oficial: "Club Norte",
      nombre_corto: "Norte",
      escudo_url: "norte.svg"
    }
  ];
  const sandbox = {
    window: {
      TPPublicTournament: PublicTournament
    },
    state: {
      torneos: overrides.torneos || [
        { id: TORNEO_APERTURA, nombre: "Apertura 2026" },
        { id: TORNEO_CLAUSURA, nombre: "Clausura 2026" }
      ],
      partidosTodos: overrides.partidosTodos || []
    },
    ESTADOS_PARTIDO_FINALIZADO_OFICIAL: new Set([
      "finalizado",
      "finalizada",
      "resuelto",
      "resuelta",
      "cerrado",
      "cerrada",
      "terminado",
      "terminada",
      "completado",
      "completada",
      "homologado",
      "homologada"
    ]),
    obtenerClub: (equipo, clubId = null) => {
      if (clubId !== null && clubId !== undefined && clubId !== "") {
        return clubes.find(club => String(club.id) === String(clubId)) || null;
      }
      const normalizado = String(equipo || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
      return clubes.find(club =>
        [club.nombre_oficial, club.nombre_corto]
          .filter(Boolean)
          .map(nombreClub => String(nombreClub)
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase())
          .includes(normalizado)
      ) || null;
    },
    nombre: (equipo, clubId = null) => {
      const club = sandbox.obtenerClub(equipo, clubId);
      return club?.nombre_corto || equipo;
    },
    obtenerEscudoEquipo: (equipo, clubId = null) =>
      sandbox.obtenerClub(equipo, clubId)?.escudo_url || "",
    obtenerLadoEquipoPartido: (partido, equipo) => {
      const clubEquipo = sandbox.obtenerClub(equipo);
      if (
        partido.local === equipo ||
        String(partido.local_id) === String(equipo) ||
        (
          clubEquipo?.id &&
          String(partido.local_id) === String(clubEquipo.id)
        )
      ) {
        return "local";
      }
      if (
        partido.visitante === equipo ||
        String(partido.visitante_id) === String(equipo) ||
        (
          clubEquipo?.id &&
          String(partido.visitante_id) === String(clubEquipo.id)
        )
      ) {
        return "visitante";
      }
      return null;
    },
    obtenerPartidosEquipoTorneo: (equipo, torneo) =>
      sandbox.state.partidosTodos
        .filter(partido =>
          String(partido.torneo_id) === String(torneo.id) &&
          sandbox.obtenerLadoEquipoPartido(partido, equipo)
        )
        .sort(sandbox.ordenarPartidosCronologicamente),
    ordenarPartidosCronologicamente: (a, b) => {
      const fechaA = `${a.fecha_partido || "9999-12-31"} ${a.hora || "23:59"}`;
      const fechaB = `${b.fecha_partido || "9999-12-31"} ${b.hora || "23:59"}`;
      return fechaA.localeCompare(fechaB) || Number(a.id || 0) - Number(b.id || 0);
    },
    escaparHtml: value => String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;")
  };

  vm.runInNewContext(
    `${extractFunction(appSource, "normalizarEstadoPartidoValor")}
     ${extractFunction(appSource, "partidoTieneResultado")}
     ${extractFunction(appSource, "obtenerEstadoManualPartido")}
     ${extractFunction(appSource, "crearFechaHoraPartido")}
     ${extractFunction(appSource, "partidoTieneEstadoFinalizadoOficial")}
     ${extractFunction(appSource, "partidoTieneResultadoVisualConfirmado")}
     ${extractFunction(appSource, "clasificarResultadoEquipoPartido")}
     ${extractFunction(appSource, "ordenarPartidosRecientes")}
     ${extractFunction(appSource, "ordenarPartidosCronologicamente")}
     ${extractFunction(appSource, "obtenerFechaCalendarioPartido")}
     ${extractFunction(appSource, "obtenerReferenciaEquipoFormaPartido")}
     ${extractFunction(appSource, "partidoEsAnteriorAReferenciaForma")}
     ${extractFunction(appSource, "obtenerNumeroFechaFormaPartido")}
     ${extractFunction(appSource, "partidoEsAnteriorPorFechaTorneoForma")}
     ${extractFunction(appSource, "partidoEsProximoSinFechaConfiableForma")}
     ${extractFunction(appSource, "partidoCuentaComoAntecedenteForma")}
     ${extractFunction(appSource, "obtenerResultadoFormaEquipoPartido")}
     ${extractFunction(appSource, "obtenerFormaRecienteEquipoAntesPartido")}
     ${extractFunction(appSource, "renderResultadoFormaRecienteDetallePartido")}
     ${extractFunction(appSource, "renderFormaRecienteCabeceraPartido")}
     ${extractFunction(appSource, "renderEquipoDetallePartido")}
     this.obtenerFormaRecienteEquipoAntesPartido = obtenerFormaRecienteEquipoAntesPartido;
     this.renderCabeceraFormaDetallePartido = partido =>
       '<div class="match-detail-scoreboard">' +
       renderEquipoDetallePartido(partido.local, partido.local_id, partido, "local") +
       '<div class="match-detail-result">VS</div>' +
       renderEquipoDetallePartido(
         partido.visitante,
         partido.visitante_id,
         partido,
         "visitante"
       ) +
      '<span class="match-form-label">ÚLTIMOS RESULTADOS</span>' +
       '</div>';`,
    sandbox
  );

  return {
    obtener: (partido, equipo, limite) =>
      sandbox.obtenerFormaRecienteEquipoAntesPartido(partido, equipo, limite),
    render: partido => sandbox.renderCabeceraFormaDetallePartido(partido),
    sandbox
  };
}

function buildRenderDetalleEquipo(appSource, overrides = {}) {
  const container = { innerHTML: "" };
  const torneo = overrides.torneo ||
    { id: 901, nombre: "Torneo de prueba", activo: true };
  const torneosEquipo = Object.prototype.hasOwnProperty.call(
    overrides,
    "torneosEquipo"
  )
    ? overrides.torneosEquipo
    : [torneo];
  const torneoSeleccionado = Object.prototype.hasOwnProperty.call(
    overrides,
    "torneoSeleccionado"
  )
    ? overrides.torneoSeleccionado
    : torneosEquipo[0] || null;
  const stats = { pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0 };
  const sandbox = {
    document: {
      getElementById: id => (id === "teamDetail" ? container : null)
    },
    vistaActual: { id: "equipo", equipo: overrides.equipo || "Equipo" },
    cargaPartidosFinalizada: true,
    errorCargaDatos: false,
    state: { partidosTodos: [] },
    renderDetalleVacio: mensaje => `<p>${mensaje}</p>`,
    resolverEquipoDesdeSegmentoRuta: () => null,
    renderEstadoVista: () => "",
    volverDetalle: () => {},
    obtenerClub: () => overrides.club || null,
    obtenerTorneosDisponiblesEquipo: () => torneosEquipo,
    resolverSeleccionTorneoDetalleEquipo: () => ({
      torneo: torneoSeleccionado,
      fallbackAplicado: false,
      desdeUrl: false
    }),
    obtenerPartidosResueltosTorneoHistorial: item =>
      overrides.partidosPorTorneo?.[String(item?.id)] ||
      overrides.partidosTorneo ||
      [],
    equipoParticipaEnPartido: (partido, nombreEquipo) =>
      partido.local === nombreEquipo ||
      partido.visitante === nombreEquipo ||
      String(partido.local_id) === String(nombreEquipo) ||
      String(partido.visitante_id) === String(nombreEquipo),
    ordenarPartidosCronologicamente: (a, b) =>
      Number(a.fecha || 0) - Number(b.fecha || 0) ||
      Number(a.id || 0) - Number(b.id || 0),
    obtenerFechasLibresEquipoTorneo: () => overrides.libresEquipo || [],
    calcularRendimientoEquipoTorneo: () => stats,
    obtenerDatosTablaEquipoTorneo: () => ({ zona: overrides.zona || null }),
    obtenerEventosPartidosHistorial: () => [],
    calcularDestacadosEquipoTorneo: () => ({ jugados: 0 }),
    obtenerEstadoEquipoTorneoHistorial: () => null,
    nombre: value => overrides.nombre || value,
    obtenerEscudoEquipo: () => overrides.escudo || "",
    escaparHtml: value => String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;"),
    guardarVistaEnHistorial: () => {},
    renderSelectorTorneosDetalleEquipo: () => "",
    renderResumenTorneoEquipo: () => "",
    renderDestacadosEquipoTorneo: () => "",
    renderPartidosEquipoPorFase: (partidos, nombreEquipo, torneoRender) => {
      sandbox.partidosPorFaseRecibidos = {
        partidos,
        nombreEquipo,
        torneo: torneoRender
      };
      return `
        <section class="team-season-matches">
          ${partidos.map(partido =>
            partido.tipoActividad === "libre"
              ? `<div class="team-activity-free">Fecha ${partido.fecha} libre</div>`
              : `<button type="button" onclick="abrirPartido(${JSON.stringify(partido.id)})">${partido.id}</button>`
          ).join("")}
        </section>
      `;
    }
  };

  vm.runInNewContext(
    `${extractFunction(appSource, "renderDetalleEquipo")}
     this.renderDetalleEquipo = renderDetalleEquipo;`,
    sandbox
  );

  return {
    render: equipo => {
      sandbox.renderDetalleEquipo(equipo);
      return container.innerHTML;
    },
    sandbox
  };
}

function buildActualizarResumenTorneo(appSource) {
  const elements = new Map();
  const sandbox = {
    vistaActual: { id: "inicio" },
    document: {
      getElementById: id => {
        if (!elements.has(id)) {
          elements.set(id, { textContent: "", innerHTML: "" });
        }
        return elements.get(id);
      }
    },
    obtenerAnioTorneo: () => 2026,
    obtenerEstadoTorneo: () => ({
      tipo: "sin-programar",
      etiqueta: "Programacion pendiente",
      titulo: "Programacion pendiente"
    }),
    obtenerResultadoSerieFinal: () => ({ ganador: null }),
    obtenerNombreTorneoActivo: () => "Clausura 2026",
    obtenerTituloHeroInicio: fase => ({
      octavos: "Empieza el<br><em>camino final</em>",
      cuartos: "Ocho equipos,<br><em>cuatro lugares</em>",
      semifinal: "Cuatro equipos,<br><em>dos lugares</em>",
      final: "El titulo,<br><em>en juego</em>"
    }[fase] || "El torneo<br><em>en datos</em>"),
    actualizarPieTorneo: (etiqueta, anio) => {
      sandbox.footer = { etiqueta, anio };
    },
    nombre: value => value,
    escaparHtml: value => String(value)
  };

  vm.runInNewContext(
    `${extractFunction(appSource, "actualizarResumenTorneo")}
     this.actualizarResumenTorneo = actualizarResumenTorneo;`,
    sandbox
  );

  return agenda => {
    sandbox.actualizarResumenTorneo(agenda);
    return {
      heroLabel: elements.get("heroLabel")?.textContent || "",
      heroTitle: elements.get("heroTitle")?.innerHTML || "",
      sidebarTitle: elements.get("sidebarTitle")?.textContent || "",
      footer: sandbox.footer
    };
  };
}

function renderInicioAgendaDeApp(appSource, agenda) {
  const elements = {
    homeFeaturedContent: { innerHTML: "" },
    homeContent: { innerHTML: "" },
    homeLiveContent: { innerHTML: "" }
  };
  const sandbox = {
    document: {
      getElementById: id => elements[id] || null
    },
    errorCargaDatos: false,
    cargaPartidosFinalizada: true,
    state: {
      partidos: agenda.partidos
    },
    renderEstadoVista: () => "",
    obtenerMensajeErrorCargaDatos: fallback => fallback,
    renderSkeletonAgenda: () => "<skeleton></skeleton>",
    obtenerAgendaInicio: () => agenda,
    obtenerPartidoDestacadoInicio: () => null,
    renderBloquePartidoDestacadoInicio: () => "",
    obtenerEstadoTorneo: () => ({
      clase: "scheduled",
      animado: false,
      agenda: "PRÓXIMOS PARTIDOS",
      etiqueta: "Fase regular",
      tipo: "programado",
      titulo: "Fase regular"
    }),
    obtenerResultadoSerieFinal: () => ({ ganador: null }),
    actualizarResumenTorneo: agendaRenderizada => {
      sandbox.agendaRenderizada = agendaRenderizada;
    },
    renderCampeonInicio: () => "",
    renderPulsoInicio: () => {},
    renderPartidoInicio: partido => `
      <article class="home-match-card-test" data-match-id="${partido.id}">
        <span>Fecha ${partido.fecha}</span>
        <strong>${partido.local} - ${partido.visitante}</strong>
      </article>
    `
  };

  vm.runInNewContext(
    `${extractFunction(appSource, "renderInicio")}
     this.renderInicio = renderInicio;`,
    sandbox
  );

  sandbox.renderInicio();
  return {
    featuredHtml: elements.homeFeaturedContent.innerHTML,
    html: elements.homeContent.innerHTML,
    agendaRenderizada: sandbox.agendaRenderizada
  };
}

function buildDestacadoInicio(appSource, overrides = {}) {
  const sandbox = {
    state: {
      torneoActivo: Object.prototype.hasOwnProperty.call(
        overrides,
        "torneoActivo"
      )
        ? overrides.torneoActivo
        : { id: TORNEO_CLAUSURA },
      partidos: overrides.partidos || []
    },
    resolverPartidoPlayoff: partido => partido,
    compararPartidosParaListado: (a, b) =>
      Number(a.id || 0) - Number(b.id || 0),
    obtenerEstadoTemporalPartido: partido =>
      overrides.estados?.[partido.id] || {
        tipo: "programado",
        clase: "scheduled",
        texto: "23/08 · 16:00",
        detalle: "23/08 · 16:00"
      },
    obtenerNombreOficialEquipo: value => value || null,
    nombre: value => value || "",
    obtenerEstadioPartido: partido => partido.estadio || "A confirmar",
    obtenerHoraPartido: partido => partido.hora || "A confirmar",
    obtenerEtiquetaDiaPartido: fecha =>
      fecha === "2026-08-23" ? "23 ago" : "Fecha",
    etiquetaFase: fase => ({
      octavos: "Octavos",
      cuartos: "Cuartos",
      semifinal: "Semifinal",
      final: "Final"
    }[fase] || "Playoffs"),
    etiquetaInstanciaPartido: partido =>
      partido.tipo === "regular"
        ? `Fecha ${partido.fecha || ""}`.trim()
        : `Llave ${partido.numero_playoff || 1}`,
    renderEscudoInicio: (equipo, clubId) =>
      `<span class="home-shield" data-club-id="${clubId || ""}">${String(equipo || "").slice(0, 2)}</span>`,
    renderMomentoPartido: (partido, estado, clase) =>
      `<div class="${clase} ${estado.clase}">${estado.texto}<small>${estado.detalle}</small></div>`,
    obtenerPartidoIdaSerie: () => null,
    escaparHtml: value => String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
  };

  vm.runInNewContext(
    `${extractFunction(appSource, "obtenerPartidoDestacadoInicio")}
     ${extractFunction(appSource, "obtenerTituloPartidoDestacadoInicio")}
     ${extractFunction(appSource, "renderBloquePartidoDestacadoInicio")}
     ${extractFunction(appSource, "renderPartidoDestacadoInicio")}
     ${extractFunction(appSource, "renderCentroPartidoDestacado")}
     this.obtenerPartidoDestacadoInicio = obtenerPartidoDestacadoInicio;
     this.renderBloquePartidoDestacadoInicio = renderBloquePartidoDestacadoInicio;`,
    sandbox
  );

  return {
    obtener: () => sandbox.obtenerPartidoDestacadoInicio(),
    render: partido => sandbox.renderBloquePartidoDestacadoInicio(partido),
    sandbox
  };
}

function obtenerAgendaRegularInicioDeApp(appSource, partidos) {
  const sandbox = {
    state: {
      torneoActivo: { id: TORNEO_CLAUSURA },
      partidos
    },
    window: {
      TPPublicTournament: PublicTournament
    },
    compararPartidosParaListado: (a, b) =>
      PublicTournament.compareMatchesByCalendar(a, b) ||
      Number(a.id || 0) - Number(b.id || 0),
    partidoPendienteParaVista: partido =>
      !PublicTournament.isMatchResolved(partido)
  };

  vm.runInNewContext(
    `${extractFunction(appSource, "obtenerAgendaRegularInicio")}
     this.obtenerAgendaRegularInicio = obtenerAgendaRegularInicio;`,
    sandbox
  );

  return sandbox.obtenerAgendaRegularInicio();
}

function construirEscenarioAgendaDesfasada() {
  return cargar.buildContext().records
    .filter(record => record.tipo === "regular")
    .map((record, index) => {
      const fecha = Number(record.fecha);
      const zona = Number(record.zona);
      const jugado =
        (zona === 1 && fecha <= 4) ||
        (zona === 3 && fecha <= 4) ||
        (zona === 2 && fecha <= 3);

      return {
        ...record,
        id: 5000 + index,
        torneo_id: TORNEO_CLAUSURA,
        fecha_partido: null,
        hora: null,
        estado: jugado ? "finalizado" : "programado",
        goles_local: jugado ? 1 : null,
        goles_visitante: jugado ? 0 : null
      };
    });
}

function cargarFechasRealesDesfasadas(partidos) {
  return partidos.map(partido => {
    const fecha = Number(partido.fecha);
    const zona = Number(partido.zona);

    if (fecha === 5 && (zona === 1 || zona === 3)) {
      return { ...partido, fecha_partido: "2026-08-23", hora: "16:00" };
    }

    if (fecha === 4 && zona === 2) {
      return { ...partido, fecha_partido: "2026-08-30", hora: "16:00" };
    }

    return partido;
  });
}

async function runTests() {
  const results = [];
  const torneos = [
    { id: TORNEO_APERTURA, nombre: "Apertura 2026", activo: true },
    { id: TORNEO_CLAUSURA, nombre: "Clausura 2026", activo: false }
  ];
  const clausura = loadClausuraRecords();
  const derived = PublicTournament.deriveRegularParticipants(clausura, {
    torneoId: TORNEO_CLAUSURA
  });

  assert.equal(
    PublicTournament.isNetlifyPreviewHost(
      "deploy-preview-42--tres-palos.netlify.app"
    ),
    true
  );
  assert.equal(
    PublicTournament.isNetlifyPreviewHost("w-6--tres-palos.netlify.app"),
    true
  );
  assert.equal(
    PublicTournament.resolvePreviewTournament(
      torneos,
      "?preview_torneo=2",
      "deploy-preview-42--tres-palos.netlify.app"
    )?.nombre,
    "Clausura 2026"
  );
  assert.equal(
    PublicTournament.resolvePreviewTournament(
      torneos,
      "",
      "deploy-preview-42--tres-palos.netlify.app"
    ),
    null
  );
  assert.equal(
    PublicTournament.resolvePreviewTournament(
      torneos,
      "?preview_torneo=2",
      "trespalos.com.ar"
    ),
    null
  );
  assert.equal(
    PublicTournament.resolvePreviewTournament(
      torneos,
      "?preview_torneo=2",
      "www.trespalos.com.ar"
    ),
    null
  );
  assert.equal(
    PublicTournament.resolvePreviewTournament(
      torneos,
      "?preview_torneo=2",
      "tres-palos.netlify.app"
    ),
    null
  );
  assert.equal(
    PublicTournament.resolvePreviewTournament(
      torneos,
      "?preview_torneo=999",
      "deploy-preview-42--tres-palos.netlify.app"
    ),
    null
  );
  results.push("override preview_torneo limitado a previews Netlify: ok");

  assert.equal(derived.participants.length, 20);
  assert.equal(PublicTournament.buildTeamList(derived).length, 20);
  assert.equal(new Set(PublicTournament.buildTeamList(derived).map(item => item.key)).size, 20);
  results.push("Clausura deriva 20 clubes unicos y 20 tarjetas: ok");

  assert.equal(PublicTournament.getTeamsByZone(derived, 1).length, 7);
  assert.equal(PublicTournament.getTeamsByZone(derived, 2).length, 6);
  assert.equal(PublicTournament.getTeamsByZone(derived, 3).length, 7);
  assert.deepEqual(PublicTournament.getZones(derived), [1, 2, 3]);
  results.push("zonas Clausura 7/6/7 desde partidos regulares: ok");

  const allParticipantsText = derived.participants.map(item => normalize(item.equipo)).join(" ");
  assert.equal(allParticipantsText.includes("carcarana"), false);
  assert.equal(
    derived.participants.some(item => Number(item.club_id) === CARCARANA_ID),
    false
  );
  assert.equal(derived.conflicts.length, 0);
  results.push("Carcarana ausente y ningun club en dos zonas Clausura: ok");

  const fecha1Zona1 = clausura.filter(
    match => match.fecha === 1 && Number(match.zona) === 1
  );
  const fecha1Zona2 = clausura.filter(
    match => match.fecha === 1 && Number(match.zona) === 2
  );
  const fecha1Zona3 = clausura.filter(
    match => match.fecha === 1 && Number(match.zona) === 3
  );
  const libreZona1 = PublicTournament.getFreeParticipants(derived, fecha1Zona1, 1, {
    torneoId: TORNEO_CLAUSURA
  });
  const libreZona2 = PublicTournament.getFreeParticipants(derived, fecha1Zona2, 2, {
    torneoId: TORNEO_CLAUSURA
  });
  const libreZona3 = PublicTournament.getFreeParticipants(derived, fecha1Zona3, 3, {
    torneoId: TORNEO_CLAUSURA
  });
  assert.deepEqual(libreZona1.teams.map(normalize), ["argentino a club"]);
  assert.deepEqual(libreZona2.teams, []);
  assert.deepEqual(libreZona3.teams.map(normalize), ["c a williams kemmis"]);
  results.push("Fecha 1 libres Argentino / ninguno / Kemmis: ok");

  assert.equal(
    PublicTournament.getInitialRegularStageKey(clausura, {
      torneoId: TORNEO_CLAUSURA
    }),
    "fecha:1"
  );
  const fecha1Zonas13Cerradas = applySixLoadedResults(clausura);
  assert.equal(
    PublicTournament.getInitialRegularDate(fecha1Zonas13Cerradas, {
      torneoId: TORNEO_CLAUSURA
    }),
    1
  );
  const fecha1Completa = finishRegularDate(fecha1Zonas13Cerradas, 1);
  assert.equal(
    PublicTournament.getInitialRegularStageKey(fecha1Completa, {
      torneoId: TORNEO_CLAUSURA
    }),
    "fecha:2"
  );
  const otroTorneoPendiente = {
    ...clausura[0],
    id: 90001,
    torneo_id: TORNEO_APERTURA,
    estado: "programado",
    goles_local: null,
    goles_visitante: null
  };
  assert.equal(
    PublicTournament.getInitialRegularStageKey(
      fecha1Completa.concat(otroTorneoPendiente),
      { torneoId: TORNEO_CLAUSURA }
    ),
    "fecha:2"
  );
  results.push("fecha inicial Clausura respeta menor fecha pendiente del torneo visualizado: ok");

  const americaClausura = matchesByTeam(clausura, "C.A. América");
  assert.equal(americaClausura.length, 10);
  assert.equal(americaClausura.every(match => Number(match.zona) === 2), true);
  assert.deepEqual(
    americaClausura.map(match => match.fecha),
    [1, 2, 3, 4, 5, 8, 9, 10, 11, 12]
  );
  assert.deepEqual(freeDatesByTeam(clausura, derived, "C.A. América", 2), []);
  assert.equal(
    americaClausura.every(match => ![6, 7, 13, 14].includes(match.fecha)),
    true
  );
  assert.deepEqual(
    freeDatesByTeam(clausura, derived, "C.A. Almafuerte", 3),
    [2, 9]
  );
  const almafuerteClausura = matchesByTeam(clausura, "C.A. Almafuerte");
  assert.equal(almafuerteClausura[0].fecha, 1);
  assert.equal(almafuerteClausura.at(-1).fecha, 14);
  const sportivoClausura = matchesByTeam(clausura, "Sportivo A. Club");
  const adeoClausura = matchesByTeam(clausura, "AD Everton/Olimpia");
  assert.equal(sportivoClausura.length, 12);
  assert.equal(adeoClausura.length, 12);
  assert.equal(freeDatesByTeam(clausura, derived, "Sportivo A. Club", 1).length, 2);
  assert.equal(freeDatesByTeam(clausura, derived, "AD Everton/Olimpia", 1).length, 2);
  results.push("fichas Clausura: Sportivo/ADEO 12+2, America 10+0 y Almafuerte libres 2/9: ok");

  const calendarioMixtoInicio = [
    {
      id: 1,
      torneo_id: TORNEO_CLAUSURA,
      tipo: "regular",
      fecha: 1,
      fecha_partido: "2026-08-02",
      hora: "16:00",
      estado: "programado"
    },
    {
      id: 2,
      torneo_id: TORNEO_CLAUSURA,
      tipo: "regular",
      fecha: 2,
      fecha_partido: "2026-08-02",
      hora: "15:00",
      estado: "programado"
    },
    {
      id: 3,
      torneo_id: TORNEO_CLAUSURA,
      tipo: "regular",
      fecha: 1,
      fecha_partido: "2026-08-01",
      hora: "16:00",
      estado: "programado"
    },
    {
      id: 4,
      torneo_id: TORNEO_APERTURA,
      tipo: "regular",
      fecha: 1,
      fecha_partido: "2026-07-30",
      hora: "16:00",
      estado: "programado"
    }
  ];
  assert.deepEqual(
    PublicTournament.getUpcomingCalendarMatches(calendarioMixtoInicio, {
      torneoId: TORNEO_CLAUSURA,
      limit: 3
    }).map(match => match.fecha),
    [1, 2, 1]
  );
  results.push("Inicio puede mezclar jornadas por calendario real sin contaminar torneo: ok");

  const recorridoEquipo = [
    {
      id: 10,
      tipo: "regular",
      fecha: 1,
      estado: "finalizado",
      goles_local: 1,
      goles_visitante: 0,
      fecha_partido: "2026-08-01",
      hora: "16:00"
    },
    {
      id: 11,
      tipo: "regular",
      fecha: 2,
      estado: "programado",
      goles_local: null,
      goles_visitante: null,
      fecha_partido: "2026-08-10",
      hora: "16:00"
    },
    {
      id: 12,
      tipo: "regular",
      fecha: 3,
      estado: "programado",
      goles_local: null,
      goles_visitante: null,
      fecha_partido: "2026-08-10",
      hora: "15:00"
    },
    { id: "libre-1", tipoActividad: "libre", fecha: 4 }
  ];
  assert.equal(PublicTournament.isMatchResolved(recorridoEquipo[0]), true);
  assert.equal(PublicTournament.isMatchResolved(recorridoEquipo[1]), false);
  assert.equal(
    PublicTournament.getNextPendingMatch(recorridoEquipo, {
      regularOnly: false
    }).id,
    12
  );
  assert.equal(
    PublicTournament.getNextPendingMatch([
      {
        id: 20,
        tipo: "regular",
        fecha: 1,
        estado: "finalizado",
        goles_local: 0,
        goles_visitante: 0
      },
      {
        id: 21,
        tipo: "playoff",
        fase: "final",
        estado: "resuelto",
        goles_local: 1,
        goles_visitante: 1
      }
    ], { regularOnly: false }),
    null
  );
  assert.deepEqual(
    [...recorridoEquipo]
      .sort((a, b) => Number(a.fecha) - Number(b.fecha))
      .map(item => item.fecha),
    [1, 2, 3, 4]
  );
  results.push("recorrido equipo: orden, proximo interno unico y libre excluida: ok");

  const withResults = applySixLoadedResults(clausura);
  const derivedWithResults = PublicTournament.deriveRegularParticipants(withResults, {
    torneoId: TORNEO_CLAUSURA
  });
  const table1 = PublicTournament.buildZoneTable(withResults, 1, {
    torneoId: TORNEO_CLAUSURA,
    derived: derivedWithResults
  });
  const table2 = PublicTournament.buildZoneTable(withResults, 2, {
    torneoId: TORNEO_CLAUSURA,
    derived: derivedWithResults
  });
  const table3 = PublicTournament.buildZoneTable(withResults, 3, {
    torneoId: TORNEO_CLAUSURA,
    derived: derivedWithResults
  });
  assert.equal(table1.length, 7);
  assert.equal(table2.length, 6);
  assert.equal(table3.length, 7);
  assert.equal(
    PublicTournament.buildGeneralTable(withResults, {
      torneoId: TORNEO_CLAUSURA,
      derived: derivedWithResults
    }).length,
    20
  );
  assert.equal(table2.every(row => row.pj === 0 && row.pts === 0), true);
  results.push("tablas devuelven filas 7/6/7 y Zona 2 queda 0 PJ: ok");

  assert.deepEqual(
    {
      cosmo: rowByName(table1, "C.A. Cosmopolita").pts,
      adeo: rowByName(table1, "AD Everton/Olimpia").pj,
      sport: rowByName(table1, "Sport C.").pe,
      correa: rowByName(table1, "C.A. Correa").pts,
      argentino: rowByName(table1, "Argentino").pj
    },
    {
      cosmo: 3,
      adeo: 1,
      sport: 1,
      correa: 3,
      argentino: 0
    }
  );
  assert.deepEqual(
    {
      almafuerte: rowByName(table3, "C.A. Almafuerte").pts,
      defensores: rowByName(table3, "C.A. Defensores").pe,
      barraca: rowByName(table3, "C.A. Barraca").pts,
      kemmis: rowByName(table3, "Williams Kemmis").pj
    },
    {
      almafuerte: 3,
      defensores: 1,
      barraca: 3,
      kemmis: 0
    }
  );
  results.push("seis resultados cargados impactan Zonas 1 y 3: ok");

  const apertura = makeAperturaHistory();
  const mixed = clausura.concat(apertura);
  const mixedClausura = PublicTournament.deriveRegularParticipants(mixed, {
    torneoId: TORNEO_CLAUSURA
  });
  const mixedApertura = PublicTournament.deriveRegularParticipants(mixed, {
    torneoId: TORNEO_APERTURA
  });
  assert.equal(apertura.length, 140);
  assert.equal(mixedClausura.participants.length, 20);
  assert.equal(participantsByZone(mixedClausura, 1).length, 7);
  assertIncludesTeam(mixedApertura.participants.map(item => normalize(item.equipo)), "carcarana");
  assert.equal(
    PublicTournament.getInitialRegularStageKey(apertura, {
      torneoId: TORNEO_APERTURA
    }),
    "fecha:14"
  );
  assert.equal(
    PublicTournament.getInitialRegularStageKey(finishAllRegular(clausura), {
      torneoId: TORNEO_CLAUSURA
    }),
    "fecha:14"
  );
  results.push("Apertura historico no contamina Clausura y conserva Carcarana: ok");

  const appSource = fs.readFileSync(path.join(ROOT, "js", "app.js"), "utf8");
  const utilsSource = fs.readFileSync(path.join(ROOT, "js", "utils.js"), "utf8");
  const styleSource = fs.readFileSync(path.join(ROOT, "styles", "main.css"), "utf8");
  const indexSource = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert.match(indexSource, /\/styles\/main\.css\?v=77/);

  const renderResumenInicio = buildActualizarResumenTorneo(appSource);
  const resumenRegular = renderResumenInicio({
    tipo: "regular",
    fase: { valor: "regular", etiqueta: "Fecha 4" },
    partidos: [
      { local: "Belgrano A.C.", visitante: "C.A. Union C.S.D." },
      { local: "C.A. America", visitante: "C.A. N.O. Boys" }
    ]
  });
  assert.match(resumenRegular.heroLabel.toUpperCase(), /FASE REGULAR/);
  assert.doesNotMatch(resumenRegular.heroLabel.toUpperCase(), /FECHA 4|FECHA 5/);

  const resumenPlayoff = renderResumenInicio({
    tipo: "playoff",
    fase: { valor: "cuartos", etiqueta: "Cuartos de Final" },
    partidos: [
      { local: "Equipo A", visitante: "Equipo B" }
    ]
  });
  assert.match(resumenPlayoff.heroLabel, /Cuartos de Final/);
  results.push("Inicio: hero regular usa fase regular y playoffs conservan fase: ok");

  const agendaSinFechas = obtenerAgendaRegularInicioDeApp(
    appSource,
    construirEscenarioAgendaDesfasada()
  );
  assert.equal(agendaSinFechas.fase.etiqueta, "Fecha 4");
  assert.equal(agendaSinFechas.partidos.length, 3);
  assert.deepEqual(
    [...new Set(agendaSinFechas.partidos.map(partido => Number(partido.zona)))],
    [2]
  );
  assert.equal(agendaSinFechas.pendientes, true);

  const agendaConFechas = obtenerAgendaRegularInicioDeApp(
    appSource,
    cargarFechasRealesDesfasadas(construirEscenarioAgendaDesfasada())
  );
  assert.equal(agendaConFechas.fase.etiqueta, "Fecha 5");
  assert.equal(agendaConFechas.partidos.length, 4);
  assert.equal(
    agendaConFechas.partidos.every(
      partido => partido.fecha_partido === "2026-08-23"
    ),
    true
  );
  assert.deepEqual(
    [...new Set(agendaConFechas.partidos.map(partido => Number(partido.fecha)))],
    [5]
  );
  assert.equal(agendaConFechas.partidos.some(partido => Number(partido.zona) === 1), true);
  assert.equal(agendaConFechas.partidos.some(partido => Number(partido.zona) === 3), true);

  const inicioAgendaConFechas = renderInicioAgendaDeApp(appSource, agendaConFechas);
  assert.equal(inicioAgendaConFechas.agendaRenderizada, agendaConFechas);
  assert.equal(inicioAgendaConFechas.featuredHtml, "");
  assert.doesNotMatch(inicioAgendaConFechas.html, /home-highlight-card/);
  assert.equal(
    (inicioAgendaConFechas.html.match(/home-match-card-test/g) || []).length,
    4
  );
  agendaConFechas.partidos.forEach(partido => {
    assert.match(
      inicioAgendaConFechas.html,
      new RegExp(`data-match-id="${partido.id}"`)
    );
  });
  assert.match(inicioAgendaConFechas.html, /PRÓXIMOS PARTIDOS/);
  assert.match(inicioAgendaConFechas.html, /Ver partidos\s*→/);
  assert.doesNotMatch(inicioAgendaConFechas.html, /\b\d+\s+partidos?\b/i);
  assert.doesNotMatch(inicioAgendaConFechas.html, /nc-round|nc-footer-label/);

  const agendaRegularSource = extractFunction(appSource, "obtenerAgendaRegularInicio");
  assert.match(agendaRegularSource, /getUpcomingCalendarMatches/);
  assert.match(agendaRegularSource, /limit:\s*4/);
  assert.match(agendaRegularSource, /Math\.min\(\.\.\.fechas\)/);

  const renderInicioSource = extractFunction(appSource, "renderInicio");
  assert.match(
    renderInicioSource,
    /const textoLinkAgenda = agenda\.tipo === "regular"\s*\?\s*"Ver partidos"\s*:\s*"Ver fase completa";/
  );
  assert.doesNotMatch(renderInicioSource, /etiquetaCantidadAgenda/);
  assert.doesNotMatch(renderInicioSource, /nc-round|nc-footer-label/);
  assert.doesNotMatch(renderInicioSource, /Ver fecha completa/);
  results.push("Inicio: agenda conserva seleccion, limite y CTA sin contador: ok");

  const destacadoBase = {
    id: 880,
    torneo_id: TORNEO_CLAUSURA,
    tipo: "regular",
    fecha: 5,
    zona: 3,
    local: "Sportivo A. Club",
    visitante: "Argentino A. Club",
    local_id: 20,
    visitante_id: 21,
    fecha_partido: "2026-08-23",
    hora: "16:00",
    estadio: "Estadio Las Parejas",
    estado: "programado",
    goles_local: null,
    goles_visitante: null,
    penales_local: null,
    penales_visitante: null,
    destacado_inicio: true,
    destacado_titulo: "Clasico de Las Parejas"
  };
  const destacadoInicio = buildDestacadoInicio(appSource, {
    partidos: [
      { ...destacadoBase, destacado_inicio: false },
      { ...destacadoBase, id: 881, destacado_inicio: true }
    ]
  });
  const partidoDestacado = destacadoInicio.obtener();
  const htmlDestacado = destacadoInicio.render(partidoDestacado);

  assert.equal(partidoDestacado.id, 881);
  assert.match(htmlDestacado, /home-highlight-card/);
  assert.match(htmlDestacado, /Partido destacado/);
  assert.match(htmlDestacado, /Clasico de Las Parejas/);
  assert.match(htmlDestacado, /Sportivo A\. Club/);
  assert.match(htmlDestacado, /Argentino A\. Club/);
  assert.match(htmlDestacado, /23 ago/);
  assert.match(htmlDestacado, /16:00/);
  assert.match(htmlDestacado, /Estadio Las Parejas/);
  assert.match(htmlDestacado, /abrirPartido\(881\)/);
  assert.match(htmlDestacado, /Ver partido\s*→/);

  const destacadoOtroTorneo = buildDestacadoInicio(appSource, {
    partidos: [
      {
        ...destacadoBase,
        id: 990,
        torneo_id: TORNEO_APERTURA,
        destacado_inicio: true
      }
    ]
  });
  assert.equal(destacadoOtroTorneo.obtener(), null);

  const destacadoSinTorneo = buildDestacadoInicio(appSource, {
    torneoActivo: null,
    partidos: [destacadoBase]
  });
  assert.equal(destacadoSinTorneo.obtener(), null);
  assert.doesNotMatch(
    extractFunction(appSource, "obtenerPartidos"),
    /destacado_inicio=eq\.true/
  );
  assert.doesNotMatch(
    extractFunction(appSource, "obtenerPartidoDestacadoInicio"),
    /partidosTodos/
  );
  assert.match(
    extractFunction(appSource, "obtenerPartidoDestacadoInicio"),
    /state\.torneoActivo\?\.id/
  );
  results.push("Inicio: partido destacado manual renderiza y respeta aislamiento: ok");

  assert.match(indexSource, /\/js\/public-tournament\.js\?v=3/);
  assert.match(indexSource, /\/js\/app\.js\?v=86/);
  assert.match(indexSource, /aria-label="Tabla por zona o general"/);
  assert.match(indexSource, /id="previewTournamentNotice"/);
  assert.match(indexSource, /id="teamsCountLabel"/);
  assert.match(indexSource, /Clasificaci&oacute;n/);
  assert.doesNotMatch(indexSource, /Tabla de posiciones/);
  assert.doesNotMatch(indexSource, />21 clubes</);
  assert.doesNotMatch(indexSource, /preview_torneo[\s\S]{0,160}<select/i);

  assert.doesNotMatch(appSource, /Se muestran todos los partidos\./);
  assert.match(
    extractFunction(appSource, "obtenerPartidos"),
    /throw crearErrorTorneoPublicoInvalido\(\)/
  );

  const cargaPublicaValida = await buildObtenerPartidosSandbox(appSource).run();
  assert.equal(cargaPublicaValida.sandbox.errorCargaDatos, false);
  assert.equal(cargaPublicaValida.sandbox.appliedTournament.id, TORNEO_CLAUSURA);
  assert.deepEqual(
    cargaPublicaValida.sandbox.state.partidos.map(partido => partido.id),
    [20]
  );
  assert.equal(
    cargaPublicaValida.sandbox.state.partidos.every(
      partido => Number(partido.torneo_id) === TORNEO_CLAUSURA
    ),
    true
  );
  assert.equal(
    cargaPublicaValida.calls.some(url =>
      url.includes(`/rest/v1/partidos?select=*&torneo_id=eq.${TORNEO_CLAUSURA}&order=id.asc`)
    ),
    true
  );
  assert.equal(
    cargaPublicaValida.calls.some(url =>
      url.endsWith("/rest/v1/partidos?select=*&order=id.asc")
    ),
    true
  );
  assert.equal(
    cargaPublicaValida.calls.some(url =>
      url === `/.netlify/functions/goleadores-publicos?torneo_id=${TORNEO_CLAUSURA}`
    ),
    true
  );
  results.push("carga publica con torneo valido conserva filtro por torneo_id: ok");

  const cargaSinTorneoValido = await buildObtenerPartidosSandbox(appSource, {
    torneosResponse: [
      {
        id: TORNEO_APERTURA,
        nombre: "Apertura 2026",
        anio: 2026,
        tipo: "apertura",
        activo: false
      },
      {
        id: TORNEO_CLAUSURA,
        nombre: "Clausura 2026",
        anio: 2026,
        tipo: "clausura",
        activo: false
      }
    ],
    usarRenderDatosReal: true
  }).run();
  assert.equal(cargaSinTorneoValido.sandbox.errorCargaDatos, true);
  assert.equal(cargaSinTorneoValido.sandbox.state.partidos.length, 0);
  assert.equal(cargaSinTorneoValido.sandbox.state.partidosTodos.length, 0);
  assert.equal(cargaSinTorneoValido.calls.length, 1);
  assert.match(cargaSinTorneoValido.calls[0], /\/rest\/v1\/torneos\?/);
  assert.equal(
    cargaSinTorneoValido.calls.some(url => url.includes("/rest/v1/partidos?select=*")),
    false
  );
  assert.equal(
    cargaSinTorneoValido.calls.some(url => url.includes("goleadores-publicos")),
    false
  );
  assert.equal(
    cargaSinTorneoValido.calls.some(url => url.includes("eventos_partido_publicos")),
    false
  );
  assert.match(
    cargaSinTorneoValido.elements.datosContent.innerHTML,
    /No se pudo determinar el torneo actual/
  );
  assert.doesNotMatch(
    cargaSinTorneoValido.elements.datosContent.innerHTML,
    /Se muestran todos los partidos/
  );
  results.push("carga publica sin torneo valido falla cerrada sin consultar partidos globales: ok");

  const cargaTorneoSeleccionado = await buildObtenerPartidosSandbox(appSource, {
    torneosResponse: [
      {
        id: TORNEO_APERTURA,
        nombre: "Apertura 2026",
        anio: 2026,
        tipo: "apertura",
        activo: false
      },
      {
        id: TORNEO_CLAUSURA,
        nombre: "Clausura 2026",
        anio: 2026,
        tipo: "clausura",
        activo: false
      }
    ],
    torneoSeleccionadoId: String(TORNEO_APERTURA),
    currentPartidos: [
      { id: 11, torneo_id: TORNEO_APERTURA, tipo: "regular", fecha: 1 }
    ],
    partidosTodos: [
      { id: 11, torneo_id: TORNEO_APERTURA, tipo: "regular", fecha: 1 },
      { id: 22, torneo_id: TORNEO_CLAUSURA, tipo: "regular", fecha: 1 }
    ]
  }).run();
  assert.equal(cargaTorneoSeleccionado.sandbox.errorCargaDatos, false);
  assert.equal(
    cargaTorneoSeleccionado.sandbox.appliedTournament.id,
    TORNEO_APERTURA
  );
  assert.deepEqual(
    cargaTorneoSeleccionado.sandbox.state.partidos.map(partido => partido.id),
    [11]
  );
  assert.equal(
    cargaTorneoSeleccionado.calls.some(url =>
      url.includes(`/rest/v1/partidos?select=*&torneo_id=eq.${TORNEO_APERTURA}&order=id.asc`)
    ),
    true
  );
  results.push("torneo historico seleccionado con id valido no queda bloqueado: ok");

  const renderResumenTablaEquipoPrueba = buildRenderResumenTablaEquipo(appSource);
  const resumenCampeon = renderResumenTablaEquipoPrueba(
    { zona: 3, posicionZona: 2 },
    { texto: "Campe\u00f3n", clase: "champion" }
  );
  assert.match(resumenCampeon, /team-season-position/);
  assert.match(resumenCampeon, /2\.&ordm; en Zona 3/);
  assert.match(resumenCampeon, /team-detail-achievement--champion/);
  assert.match(resumenCampeon, /team-stage-badge-champion/);
  assert.match(resumenCampeon, /&#9733;/);
  assert.match(resumenCampeon, /aria-label="Logro: Campe\u00f3n"/);

  const resumenNoCampeon = renderResumenTablaEquipoPrueba(
    { zona: 1, posicionZona: 4 },
    { texto: "Subcampe\u00f3n", clase: "runner-up" }
  );
  assert.match(resumenNoCampeon, /team-detail-achievement--neutral/);
  assert.match(resumenNoCampeon, /team-stage-badge-runner-up/);
  assert.doesNotMatch(resumenNoCampeon, /team-detail-achievement--champion/);
  assert.doesNotMatch(resumenNoCampeon, /&#9733;/);

  const funcionesDetalleEquipo = [
    "renderInsigniaEstadoEquipoTorneo",
    "partidoTieneResultadoVisualConfirmado",
    "clasificarResultadoEquipoPartido",
    "obtenerClaseResultadoEquipoPartido",
    "renderMiniPartido",
    "renderDetalleEquipo"
  ].map(name => extractFunction(appSource, name)).join("\n");
  assert.doesNotMatch(funcionesDetalleEquipo, /Sportivo/i);
  results.push("detalle equipo: insignia campeon estructurada y sin hardcode de club: ok");

  const renderMiniPartidoPrueba = buildRenderMiniPartido(appSource);
  const regularFinalizado = renderMiniPartidoPrueba({
    id: 501,
    tipo: "regular",
    fecha: 3,
    estado: "finalizado",
    local: "Montes de Oca",
    visitante: "Sportivo A. Club",
    goles_local: 0,
    goles_visitante: 0,
    fecha_partido: "2026-06-06"
  }, "Sportivo A. Club");
  assert.match(regularFinalizado, /Fecha 3/);
  assert.doesNotMatch(regularFinalizado, /FINALIZADO/);
  assert.match(regularFinalizado, /<strong class="team-match-score">0 - 0<\/strong>/);
  assert.deepEqual(extractSmallTexts(regularFinalizado), ["Fecha 3 Jugado"]);
  assert.doesNotMatch(regularFinalizado, /06\/06\/26/);

  const playoffFinalizado = renderMiniPartidoPrueba({
    id: 502,
    tipo: "playoff",
    fase: "cuartos",
    estado: "resuelto",
    local: "Sportivo A. Club",
    visitante: "C.A. Carcarañá",
    goles_local: 2,
    goles_visitante: 1,
    fecha_partido: "2026-06-06"
  }, "Sportivo A. Club");
  assert.match(playoffFinalizado, /Cuartos de Final/);
  assert.doesNotMatch(playoffFinalizado, /FINALIZADO/);
  assert.match(playoffFinalizado, /<strong class="team-match-score">2 - 1<\/strong>/);
  assert.deepEqual(extractSmallTexts(playoffFinalizado), ["Cuartos de Final Jugado"]);
  assert.doesNotMatch(playoffFinalizado, /06\/06\/26/);

  const finalizadoSinFecha = renderMiniPartidoPrueba({
    id: 503,
    tipo: "regular",
    fecha: 4,
    estado: "finalizado",
    local: "Sportivo A. Club",
    visitante: "ADEO",
    goles_local: 1,
    goles_visitante: 0,
    fecha_partido: null
  }, "Sportivo A. Club");
  assert.doesNotMatch(finalizadoSinFecha, /FINALIZADO/);
  assert.deepEqual(extractSmallTexts(finalizadoSinFecha), ["Fecha 4 Jugado"]);
  assert.doesNotMatch(finalizadoSinFecha, /Partido finalizado|<small>[\s\S]*FINALIZADO[\s\S]*<\/small>/);

  const sportivoAperturaFecha3 = renderMiniPartidoPrueba({
    id: 506,
    tipo: "regular",
    fecha: 3,
    estado: "programado",
    local: "C.A. Montes de Oca",
    visitante: "Sportivo A. Club",
    goles_local: 0,
    goles_visitante: 0,
    fecha_partido: null
  }, "Sportivo A. Club");
  assert.match(sportivoAperturaFecha3, /Fecha 3/);
  assert.doesNotMatch(sportivoAperturaFecha3, /FINALIZADO/);
  assert.match(sportivoAperturaFecha3, /<strong class="team-match-score">0 - 0<\/strong>/);
  assert.deepEqual(extractSmallTexts(sportivoAperturaFecha3), ["Fecha 3 Pendiente"]);
  assert.doesNotMatch(sportivoAperturaFecha3, /<small>[\s\S]*FINALIZADO[\s\S]*<\/small>/);

  const futuroNeutral = renderMiniPartidoPrueba({
    id: 504,
    tipo: "regular",
    fecha: 5,
    estado: "programado",
    estadoTexto: "A confirmar",
    local: "Sportivo A. Club",
    visitante: "ADEO",
    goles_local: null,
    goles_visitante: null,
    fecha_partido: null
  }, "Sportivo A. Club");
  assert.doesNotMatch(futuroNeutral, /FINALIZADO/);
  assert.doesNotMatch(futuroNeutral, /PR&Oacute;XIMO/);
  assert.match(futuroNeutral, /<strong class="team-match-pending">A confirmar<\/strong>/);
  assert.deepEqual(extractSmallTexts(futuroNeutral), ["Fecha 5 Pendiente"]);

  const proximo = renderMiniPartidoPrueba({
    id: 505,
    tipo: "regular",
    fecha: 6,
    estado: "programado",
    estadoTexto: "A confirmar",
    local: "Sportivo A. Club",
    visitante: "ADEO",
    goles_local: null,
    goles_visitante: null,
    fecha_partido: null
  }, "Sportivo A. Club", true);
  assert.match(proximo, /team-match-next/);
  assert.doesNotMatch(proximo, /PR&Oacute;XIMO/);
  assert.doesNotMatch(proximo, /FINALIZADO/);
  assert.deepEqual(extractSmallTexts(proximo), ["Fecha 6 Próximo"]);

  const assertResultadoVisual = (html, claseEsperada) => {
    assert.match(html, new RegExp(`team-match--${claseEsperada}`));
    ["win", "draw", "loss", "neutral"].forEach(clase => {
      if (clase !== claseEsperada) {
        assert.doesNotMatch(html, new RegExp(`team-match--${clase}`));
      }
    });
  };
  const equipoBase = "Equipo Central";
  const rivalBase = "Club Norte";
  assertResultadoVisual(renderMiniPartidoPrueba({
    id: 601,
    tipo: "regular",
    fecha: 1,
    estado: "finalizado",
    local: equipoBase,
    visitante: rivalBase,
    goles_local: 2,
    goles_visitante: 0
  }, equipoBase), "win");
  assertResultadoVisual(renderMiniPartidoPrueba({
    id: 602,
    tipo: "regular",
    fecha: 2,
    estado: "finalizado",
    local: rivalBase,
    visitante: equipoBase,
    goles_local: 0,
    goles_visitante: 1
  }, equipoBase), "win");
  assertResultadoVisual(renderMiniPartidoPrueba({
    id: 603,
    tipo: "regular",
    fecha: 3,
    estado: "finalizado",
    local: equipoBase,
    visitante: rivalBase,
    goles_local: 0,
    goles_visitante: 3
  }, equipoBase), "loss");
  assertResultadoVisual(renderMiniPartidoPrueba({
    id: 604,
    tipo: "regular",
    fecha: 4,
    estado: "finalizado",
    local: rivalBase,
    visitante: equipoBase,
    goles_local: 2,
    goles_visitante: 1
  }, equipoBase), "loss");
  assertResultadoVisual(renderMiniPartidoPrueba({
    id: 605,
    tipo: "regular",
    fecha: 5,
    estado: "finalizado",
    local: equipoBase,
    visitante: rivalBase,
    goles_local: 1,
    goles_visitante: 1
  }, equipoBase), "draw");
  assertResultadoVisual(renderMiniPartidoPrueba({
    id: 610,
    tipo: "playoff",
    fase: "final",
    estado: "resuelto",
    local: equipoBase,
    visitante: rivalBase,
    goles_local: 3,
    goles_visitante: 1
  }, equipoBase), "win");
  assertResultadoVisual(renderMiniPartidoPrueba({
    id: 611,
    tipo: "regular",
    fecha: 10,
    estado: "programado",
    local: equipoBase,
    visitante: rivalBase,
    goles_local: 0,
    goles_visitante: 0
  }, equipoBase), "neutral");
  assertResultadoVisual(renderMiniPartidoPrueba({
    id: 612,
    tipo: "regular",
    fecha: 11,
    estado: "en_vivo",
    local: equipoBase,
    visitante: rivalBase,
    goles_local: 1,
    goles_visitante: 0
  }, equipoBase), "neutral");
  assertResultadoVisual(renderMiniPartidoPrueba({
    id: 613,
    tipo: "regular",
    fecha: 12,
    estado: "en_juego",
    local: equipoBase,
    visitante: rivalBase,
    goles_local: 2,
    goles_visitante: 1
  }, equipoBase), "neutral");
  assertResultadoVisual(renderMiniPartidoPrueba({
    id: 614,
    tipo: "regular",
    fecha: 13,
    estado: "estado_nuevo",
    local: equipoBase,
    visitante: rivalBase,
    goles_local: 4,
    goles_visitante: 4
  }, equipoBase), "neutral");
  assertResultadoVisual(futuroNeutral, "neutral");
  assertResultadoVisual(renderMiniPartidoPrueba({
    id: 606,
    tipo: "regular",
    fecha: 6,
    estado: "postergado",
    local: equipoBase,
    visitante: rivalBase,
    goles_local: 2,
    goles_visitante: 0
  }, equipoBase), "neutral");
  assertResultadoVisual(renderMiniPartidoPrueba({
    id: 607,
    tipo: "regular",
    fecha: 7,
    estado: "suspendido",
    local: equipoBase,
    visitante: rivalBase,
    goles_local: 2,
    goles_visitante: 0
  }, equipoBase), "neutral");
  assertResultadoVisual(renderMiniPartidoPrueba({
    id: 608,
    tipo: "regular",
    fecha: 8,
    estado: "finalizado",
    local: equipoBase,
    visitante: rivalBase,
    goles_local: null,
    goles_visitante: null
  }, equipoBase), "neutral");
  assertResultadoVisual(renderMiniPartidoPrueba({
    id: 609,
    tipo: "regular",
    fecha: 9,
    estado: "pendiente_resultado",
    local: equipoBase,
    visitante: rivalBase,
    goles_local: 1,
    goles_visitante: 0
  }, equipoBase), "neutral");
  assertResultadoVisual(renderMiniPartidoPrueba({
    id: 615,
    tipo: "regular",
    fecha: 14,
    estado: "programado",
    local: equipoBase,
    visitante: rivalBase,
    goles_local: 0,
    goles_visitante: 0,
    fecha_partido: "2030-01-01"
  }, equipoBase), "neutral");
  assertResultadoVisual(renderMiniPartidoPrueba({
    id: 616,
    tipo: "regular",
    fecha: 15,
    estado: "finalizado",
    local: "Club Sur",
    visitante: rivalBase,
    goles_local: 2,
    goles_visitante: 0
  }, equipoBase), "neutral");
  results.push("detalle equipo: clases resultado local/visitante y neutrales: ok");

  const detalleEquipoTorneoSeleccionado = buildRenderDetalleEquipo(appSource, {
    equipo: equipoBase,
    torneosEquipo: [
      { id: TORNEO_APERTURA, nombre: "Apertura 2026", activo: false },
      { id: TORNEO_CLAUSURA, nombre: "Clausura 2026", activo: true }
    ],
    torneoSeleccionado: {
      id: TORNEO_APERTURA,
      nombre: "Apertura 2026",
      activo: false
    },
    partidosPorTorneo: {
      [TORNEO_APERTURA]: Array.from({ length: 6 }, (_, index) => ({
        id: 730 + index,
        torneo_id: TORNEO_APERTURA,
        tipo: "regular",
        fecha: index + 1,
        local: index % 2 === 0 ? equipoBase : `Rival Apertura ${index}`,
        visitante: index % 2 === 0 ? `Rival Apertura ${index}` : equipoBase
      })),
      [TORNEO_CLAUSURA]: [
        {
          id: 799,
          torneo_id: TORNEO_CLAUSURA,
          tipo: "regular",
          fecha: 1,
          local: equipoBase,
          visitante: "Historial Clausura"
        }
      ]
    },
    libresEquipo: [
      { tipoActividad: "libre", fecha: 7 }
    ]
  });
  const htmlDetalleEquipoTorneoSeleccionado =
    detalleEquipoTorneoSeleccionado.render(equipoBase);
  const partidosRenderizados =
    detalleEquipoTorneoSeleccionado.sandbox.partidosPorFaseRecibidos.partidos;
  assert.equal(partidosRenderizados.filter(partido => !partido.tipoActividad).length, 6);
  assert.equal(partidosRenderizados.some(partido => partido.tipoActividad === "libre"), true);
  assert.equal(
    detalleEquipoTorneoSeleccionado.sandbox.partidosPorFaseRecibidos.torneo.id,
    TORNEO_APERTURA
  );
  assert.match(htmlDetalleEquipoTorneoSeleccionado, /team-season-matches/);
  assert.equal(
    (htmlDetalleEquipoTorneoSeleccionado.match(/abrirPartido\(/g) || []).length,
    6
  );
  [730, 731, 732, 733, 734, 735].forEach(id => {
    assert.match(htmlDetalleEquipoTorneoSeleccionado, new RegExp(`abrirPartido\\(${id}\\)`));
  });
  assert.doesNotMatch(htmlDetalleEquipoTorneoSeleccionado, /799/);
  assert.doesNotMatch(
    htmlDetalleEquipoTorneoSeleccionado,
    /team-season-recent|&Uacute;ltimos 5|<small>PJ<\/small>/
  );
  results.push("detalle equipo: listado completo restaurado por campeonato: ok");

  const partidoActualForma = {
    id: 900,
    torneo_id: TORNEO_CLAUSURA,
    tipo: "regular",
    fecha: 6,
    estado: "programado",
    local: "Equipo Central",
    visitante: "Club Norte",
    local_id: 101,
    visitante_id: 202,
    goles_local: null,
    goles_visitante: null,
    fecha_partido: "2026-08-06",
    hora: "16:00"
  };
  const partidosForma = [
    {
      id: 790,
      torneo_id: TORNEO_CLAUSURA,
      tipo: "regular",
      fecha: 0,
      estado: "finalizado",
      local: "Rival Viejo",
      visitante: "Equipo Central",
      local_id: 301,
      visitante_id: 101,
      goles_local: 2,
      goles_visitante: 0,
      fecha_partido: "2026-07-31"
    },
    {
      id: 801,
      torneo_id: TORNEO_CLAUSURA,
      tipo: "regular",
      fecha: 1,
      estado: "finalizado",
      local: "Equipo Central",
      visitante: "Rival Uno",
      local_id: 101,
      visitante_id: 301,
      goles_local: 2,
      goles_visitante: 1,
      fecha_partido: "2026-08-01"
    },
    {
      id: 802,
      torneo_id: TORNEO_CLAUSURA,
      tipo: "regular",
      fecha: 2,
      estado: "finalizado",
      local: "Rival Dos",
      visitante: "Equipo Central",
      local_id: 302,
      visitante_id: 101,
      goles_local: 0,
      goles_visitante: 0,
      fecha_partido: "2026-08-02"
    },
    {
      id: 803,
      torneo_id: TORNEO_CLAUSURA,
      tipo: "regular",
      fecha: 3,
      estado: "finalizado",
      local: "Rival Tres",
      visitante: "Equipo Central",
      local_id: 303,
      visitante_id: 101,
      goles_local: 3,
      goles_visitante: 1,
      fecha_partido: "2026-08-03"
    },
    {
      id: 804,
      torneo_id: TORNEO_CLAUSURA,
      tipo: "regular",
      fecha: 4,
      estado: "finalizado",
      local: "Equipo Central",
      visitante: "Rival Cuatro",
      local_id: 101,
      visitante_id: 304,
      goles_local: 1,
      goles_visitante: 0,
      fecha_partido: "2026-08-04"
    },
    {
      id: 805,
      torneo_id: TORNEO_CLAUSURA,
      tipo: "regular",
      fecha: 5,
      estado: "finalizado",
      local: "Rival Cinco",
      visitante: "Equipo Central",
      local_id: 305,
      visitante_id: 101,
      goles_local: 0,
      goles_visitante: 2,
      fecha_partido: "2026-08-05"
    },
    {
      ...partidoActualForma,
      estado: "finalizado",
      goles_local: 4,
      goles_visitante: 0
    },
    {
      id: 806,
      torneo_id: TORNEO_CLAUSURA,
      tipo: "regular",
      fecha: 7,
      estado: "finalizado",
      local: "Equipo Central",
      visitante: "Rival Futuro",
      local_id: 101,
      visitante_id: 306,
      goles_local: 5,
      goles_visitante: 0,
      fecha_partido: "2026-08-07"
    },
    {
      id: 807,
      torneo_id: TORNEO_CLAUSURA,
      tipo: "regular",
      fecha: 2,
      estado: "programado",
      local: "Equipo Central",
      visitante: "Rival Pendiente",
      local_id: 101,
      visitante_id: 307,
      goles_local: 9,
      goles_visitante: 0,
      fecha_partido: "2026-08-02"
    },
    {
      id: 808,
      torneo_id: TORNEO_CLAUSURA,
      tipo: "regular",
      fecha: 3,
      estado: "suspendido",
      local: "Equipo Central",
      visitante: "Rival Suspendido",
      local_id: 101,
      visitante_id: 308,
      goles_local: 3,
      goles_visitante: 0,
      fecha_partido: "2026-08-03"
    },
    {
      id: 809,
      torneo_id: TORNEO_CLAUSURA,
      tipo: "regular",
      fecha: 4,
      estado: "postergado",
      local: "Rival Postergado",
      visitante: "Equipo Central",
      local_id: 309,
      visitante_id: 101,
      goles_local: 0,
      goles_visitante: 3,
      fecha_partido: "2026-08-04"
    },
    {
      id: 810,
      torneo_id: TORNEO_APERTURA,
      tipo: "regular",
      fecha: 5,
      estado: "finalizado",
      local: "Equipo Central",
      visitante: "Rival Apertura",
      local_id: 101,
      visitante_id: 310,
      goles_local: 7,
      goles_visitante: 0,
      fecha_partido: "2026-08-05"
    },
    {
      id: 821,
      torneo_id: TORNEO_CLAUSURA,
      tipo: "regular",
      fecha: 1,
      estado: "finalizado",
      local: "Club Norte",
      visitante: "Rival A",
      local_id: 202,
      visitante_id: 401,
      goles_local: 0,
      goles_visitante: 2,
      fecha_partido: "2026-08-01"
    },
    {
      id: 822,
      torneo_id: TORNEO_CLAUSURA,
      tipo: "regular",
      fecha: 2,
      estado: "finalizado",
      local: "Rival B",
      visitante: "Club Norte",
      local_id: 402,
      visitante_id: 202,
      goles_local: 0,
      goles_visitante: 1,
      fecha_partido: "2026-08-02"
    },
    {
      id: 823,
      torneo_id: TORNEO_CLAUSURA,
      tipo: "regular",
      fecha: 3,
      estado: "finalizado",
      local: "Club Norte",
      visitante: "Rival C",
      local_id: 202,
      visitante_id: 403,
      goles_local: 2,
      goles_visitante: 1,
      fecha_partido: "2026-08-03"
    },
    {
      id: 824,
      torneo_id: TORNEO_CLAUSURA,
      tipo: "regular",
      fecha: 4,
      estado: "finalizado",
      local: "Rival D",
      visitante: "Club Norte",
      local_id: 404,
      visitante_id: 202,
      goles_local: 1,
      goles_visitante: 1,
      fecha_partido: "2026-08-04"
    },
    {
      id: 825,
      torneo_id: TORNEO_CLAUSURA,
      tipo: "regular",
      fecha: 5,
      estado: "finalizado",
      local: "Club Norte",
      visitante: "Rival E",
      local_id: 202,
      visitante_id: 405,
      goles_local: 4,
      goles_visitante: 0,
      fecha_partido: "2026-08-05"
    }
  ];
  const formaPartidoPrueba = buildFormaRecienteDetallePartido(appSource, {
    partidosTodos: partidosForma
  });
  const formaEquipoCentral = formaPartidoPrueba.obtener(
    partidoActualForma,
    "Equipo Central",
    5
  );
  assert.deepEqual(
    formaEquipoCentral.map(item => [item.partido.id, item.resultado]),
    [[801, "G"], [802, "E"], [803, "P"], [804, "G"], [805, "G"]]
  );
  const formaClubNorte = formaPartidoPrueba.obtener(
    partidoActualForma,
    "Club Norte",
    5
  );
  assert.deepEqual(
    formaClubNorte.map(item => [item.partido.id, item.resultado]),
    [[821, "P"], [822, "G"], [823, "G"], [824, "E"], [825, "G"]]
  );

  const htmlFormaRecientePartido =
    formaPartidoPrueba.render(partidoActualForma);
  const extraerResultadosForma = (html, equipo) => {
    const inicio = html.indexOf(`<strong>${equipo}</strong>`);
    assert.ok(inicio >= 0, `${equipo} debe renderizarse`);
    const bloque = html.slice(inicio, html.indexOf("</div>", html.indexOf("match-form-results", inicio)));
    return [...bloque.matchAll(/class="match-form-result[^"]*"[^>]*>\s*([GEP])\s*<\/span>/g)]
      .map(match => match[1]);
  };
  assert.match(htmlFormaRecientePartido, /match-detail-scoreboard/);
  assert.doesNotMatch(htmlFormaRecientePartido, /detail-match-form|match-form-grid|match-form-team|Previa/);
  assert.match(htmlFormaRecientePartido, /match-form-label">ÚLTIMOS RESULTADOS<\/span>/);
  assert.equal((htmlFormaRecientePartido.match(/ÚLTIMOS RESULTADOS/g) || []).length, 1);
  assert.match(htmlFormaRecientePartido, /central\.svg/);
  assert.match(htmlFormaRecientePartido, /norte\.svg/);
  assert.equal((htmlFormaRecientePartido.match(/class="match-detail-shield"/g) || []).length, 2);
  assert.equal((htmlFormaRecientePartido.match(/class="match-form-shield/g) || []).length, 0);
  assert.equal((htmlFormaRecientePartido.match(/<strong>Central<\/strong>/g) || []).length, 1);
  assert.equal((htmlFormaRecientePartido.match(/<strong>Norte<\/strong>/g) || []).length, 1);
  assert.equal(
    (htmlFormaRecientePartido.match(/class="match-form-result team-form-/g) || []).length,
    10
  );
  assert.deepEqual(extraerResultadosForma(htmlFormaRecientePartido, "Central"), ["G", "E", "P", "G", "G"]);
  assert.deepEqual(extraerResultadosForma(htmlFormaRecientePartido, "Norte"), ["P", "G", "G", "E", "G"]);
  assert.doesNotMatch(htmlFormaRecientePartido, /PJ|GF|GC|PTS|7 - 0|5 - 0/);

  const partidoHistoricoForma = {
    ...partidoActualForma,
    id: 904,
    fecha: 4,
    fecha_partido: "2026-08-04"
  };
  assert.deepEqual(
    formaPartidoPrueba.obtener(partidoHistoricoForma, "Equipo Central", 5)
      .map(item => item.partido.id),
    [790, 801, 802, 803]
  );
  const partidoProximoSinFechaForma = {
    ...partidoActualForma,
    fecha_partido: null,
    hora: null
  };
  assert.deepEqual(
    formaPartidoPrueba.obtener(partidoProximoSinFechaForma, "Equipo Central", 5)
      .map(item => [item.partido.id, item.resultado]),
    [[801, "G"], [802, "E"], [803, "P"], [804, "G"], [805, "G"]]
  );
  assert.deepEqual(
    formaPartidoPrueba.obtener(partidoProximoSinFechaForma, "Club Norte", 5)
      .map(item => [item.partido.id, item.resultado]),
    [[821, "P"], [822, "G"], [823, "G"], [824, "E"], [825, "G"]]
  );
  const partidoProximoFechaCincoSinFecha = {
    ...partidoActualForma,
    id: 907,
    fecha: 5,
    fecha_partido: null,
    hora: null
  };
  assert.deepEqual(
    formaPartidoPrueba.obtener(
      partidoProximoFechaCincoSinFecha,
      "Equipo Central",
      5
    ).map(item => [item.partido.id, item.resultado]),
    [[801, "G"], [802, "E"], [803, "P"], [804, "G"]]
  );

  const partidoHistoricoSinCronologiaForma = {
    ...partidoActualForma,
    id: 905,
    estado: "finalizado",
    goles_local: 1,
    goles_visitante: 1,
    fecha_partido: null,
    hora: null
  };
  assert.deepEqual(
    formaPartidoPrueba.obtener(
      partidoHistoricoSinCronologiaForma,
      "Equipo Central",
      5
    ),
    []
  );
  const partidoConDosPrevios = {
    ...partidoActualForma,
    id: 906,
    fecha: 3,
    fecha_partido: "2026-08-03"
  };
  assert.deepEqual(
    formaPartidoPrueba.obtener(partidoConDosPrevios, "Equipo Central", 5)
      .map(item => item.partido.id),
    [790, 801, 802]
  );

  const htmlSinForma = buildFormaRecienteDetallePartido(appSource, {
    partidosTodos: partidosForma.filter(partido =>
      Number(partido.id) >= 806 && Number(partido.id) <= 810
    )
  }).render(partidoActualForma);
  assert.match(htmlSinForma, /Sin antecedentes recientes/);
  assert.doesNotMatch(htmlSinForma, /class="match-form-result team-form-/);
  results.push("detalle partido: forma reciente previa sin informacion futura: ok");

  const renderActividadLibrePrueba = buildRenderActividadLibre(appSource);
  const libre = renderActividadLibrePrueba({
    tipoActividad: "libre",
    fecha: 4
  }, "Sportivo A. Club");
  assert.match(libre, /team-activity-free/);
  assert.match(libre, /team-match--bye/);
  assert.doesNotMatch(libre, /team-match--win|team-match--draw|team-match--loss/);
  assert.match(libre, /Sportivo A\. Club/);
  assert.match(libre, /<strong>LIBRE<\/strong>/);
  assert.deepEqual(extractSmallTexts(libre), ["Fecha 4 Libre"]);
  assert.doesNotMatch(libre, /<button|onclick|abrirPartido/);

  const partidoActualAntecedentes = {
    id: 2000,
    torneo_id: 2,
    tipo: "regular",
    fecha: 4,
    estado: "programado",
    local: "Club Atletico Norte",
    visitante: "Club Social Sur",
    local_id: 101,
    visitante_id: 202,
    goles_local: null,
    goles_visitante: null,
    fecha_partido: "2026-07-20"
  };
  const partidosAntecedentes = [
    {
      id: 2000,
      torneo_id: 2,
      tipo: "regular",
      fecha: 4,
      estado: "finalizado",
      local: "Club Atletico Norte",
      visitante: "Club Social Sur",
      local_id: 101,
      visitante_id: 202,
      goles_local: 5,
      goles_visitante: 0,
      fecha_partido: "2026-07-20"
    },
    {
      id: 100,
      torneo_id: 2,
      tipo: "regular",
      fecha: 1,
      estado: "finalizado",
      local: "Club Atletico Norte",
      visitante: "Club Social Sur",
      local_id: 101,
      visitante_id: 202,
      goles_local: 2,
      goles_visitante: 1,
      fecha_partido: "2026-07-01"
    },
    {
      id: 101,
      torneo_id: 2,
      tipo: "regular",
      fecha: 2,
      estado: "finalizado",
      local: "Club Social Sur",
      visitante: "Club Atletico Norte",
      local_id: 202,
      visitante_id: 101,
      goles_local: 0,
      goles_visitante: 3,
      fecha_partido: "2026-07-05"
    },
    {
      id: 102,
      torneo_id: 1,
      tipo: "playoff",
      fase: "final",
      numero_playoff: 2,
      estado: "resuelto",
      local: "Club Social Sur",
      visitante: "Club Atletico Norte",
      local_id: 202,
      visitante_id: 101,
      goles_local: 0,
      goles_visitante: 2,
      fecha_partido: "2026-06-28"
    },
    {
      id: 103,
      torneo_id: 3,
      tipo: "regular",
      fecha: 9,
      estado: "finalizado",
      local: "Club Atletico Norte",
      visitante: "Club Social Sur",
      local_id: 101,
      visitante_id: 202,
      goles_local: 1,
      goles_visitante: 1,
      fecha_partido: "2025-10-01"
    },
    {
      id: 104,
      torneo_id: 2,
      tipo: "regular",
      fecha: 3,
      estado: "finalizado",
      local: "Club Atletico Norte",
      visitante: "Club Social Sur",
      local_id: 101,
      visitante_id: 202,
      goles_local: 4,
      goles_visitante: 2,
      fecha_partido: "2026-07-15"
    },
    {
      id: 105,
      torneo_id: 1,
      tipo: "playoff",
      fase: "semifinal",
      numero_playoff: 1,
      estado: "finalizado",
      local: "Club Atletico Norte",
      visitante: "Club Social Sur",
      local_id: 101,
      visitante_id: 202,
      goles_local: 2,
      goles_visitante: 2,
      fecha_partido: "2026-07-10"
    },
    {
      id: 106,
      torneo_id: 2,
      tipo: "regular",
      fecha: 5,
      estado: "finalizado",
      local: "Club Atletico Norte",
      visitante: "Club Social Sur",
      local_id: 101,
      visitante_id: 202,
      goles_local: 1,
      goles_visitante: 0,
      fecha_partido: "2026-07-21"
    },
    {
      id: 107,
      torneo_id: 2,
      tipo: "regular",
      fecha: 6,
      estado: "programado",
      local: "Club Atletico Norte",
      visitante: "Club Social Sur",
      local_id: 101,
      visitante_id: 202,
      goles_local: 0,
      goles_visitante: 0,
      fecha_partido: "2026-07-18"
    },
    {
      id: 108,
      torneo_id: 2,
      tipo: "regular",
      fecha: 7,
      estado: "en_vivo",
      local: "Club Atletico Norte",
      visitante: "Club Social Sur",
      local_id: 101,
      visitante_id: 202,
      goles_local: 1,
      goles_visitante: 0,
      fecha_partido: "2026-07-17"
    },
    {
      id: 109,
      torneo_id: 2,
      tipo: "regular",
      fecha: 8,
      estado: "en_juego",
      local: "Club Social Sur",
      visitante: "Club Atletico Norte",
      local_id: 202,
      visitante_id: 101,
      goles_local: 1,
      goles_visitante: 2,
      fecha_partido: "2026-07-16"
    },
    {
      id: 110,
      torneo_id: 2,
      tipo: "regular",
      fecha: 9,
      estado: "postergado",
      local: "Club Atletico Norte",
      visitante: "Club Social Sur",
      local_id: 101,
      visitante_id: 202,
      goles_local: 3,
      goles_visitante: 3,
      fecha_partido: "2026-07-14"
    },
    {
      id: 111,
      torneo_id: 2,
      tipo: "regular",
      fecha: 10,
      estado: "suspendido",
      local: "Club Social Sur",
      visitante: "Club Atletico Norte",
      local_id: 202,
      visitante_id: 101,
      goles_local: 4,
      goles_visitante: 1,
      fecha_partido: "2026-07-13"
    },
    {
      id: 112,
      torneo_id: 2,
      tipo: "regular",
      fecha: 11,
      estado: "finalizado",
      local: "Club Atletico Norte",
      visitante: "Club Social Sur",
      local_id: 101,
      visitante_id: 202,
      goles_local: null,
      goles_visitante: null,
      fecha_partido: "2026-07-12"
    },
    {
      id: 113,
      torneo_id: 2,
      tipo: "regular",
      fecha: 12,
      estado: "estado_nuevo",
      local: "Club Atletico Norte",
      visitante: "Club Social Sur",
      local_id: 101,
      visitante_id: 202,
      goles_local: 1,
      goles_visitante: 1,
      fecha_partido: "2026-07-11"
    },
    {
      id: 114,
      torneo_id: 2,
      tipo: "regular",
      fecha: 13,
      estado: "finalizado",
      local: "Club Atletico Norte",
      visitante: "Club Atletico Este",
      local_id: 101,
      visitante_id: 303,
      goles_local: 2,
      goles_visitante: 0,
      fecha_partido: "2026-07-09"
    }
  ];
  const antecedentesPrueba = buildAntecedentesDetallePartido(appSource, {
    partidosTodos: partidosAntecedentes
  });
  const todosLosAntecedentes = Array.from(
    antecedentesPrueba.obtener(
      partidoActualAntecedentes,
      10
    ).partidos,
    item => item.partido.id
  );
  assert.deepEqual(todosLosAntecedentes, [104, 105, 101, 100, 102, 103]);
  assert.ok(todosLosAntecedentes.includes(100));
  assert.ok(todosLosAntecedentes.includes(101));
  assert.ok(todosLosAntecedentes.includes(102));
  assert.ok(todosLosAntecedentes.includes(103));
  [2000, 106, 107, 108, 109, 110, 111, 112, 113, 114].forEach(id => {
    assert.equal(todosLosAntecedentes.includes(id), false);
  });
  assert.deepEqual(
    Array.from(
      antecedentesPrueba.obtener(partidoActualAntecedentes).partidos,
      item => item.partido.id
    ),
    [104, 105, 101]
  );
  assert.deepEqual(
    Array.from(
      antecedentesPrueba.obtener({
        ...partidoActualAntecedentes,
        local: "Club Social Sur",
        visitante: "Club Atletico Norte",
        local_id: 202,
        visitante_id: 101
      }).partidos,
      item => item.partido.id
    ),
    [104, 105, 101]
  );

  const renderAntecedentes = antecedentesPrueba.render(partidoActualAntecedentes);
  assert.match(renderAntecedentes, /&Uacute;ltimos antecedentes/);
  assert.match(renderAntecedentes, /3 PARTIDOS/);
  assert.match(renderAntecedentes, /Clausura 2026 &middot; Fecha 3/);
  assert.match(renderAntecedentes, /Apertura 2026 &middot; Semifinales/);
  assert.match(renderAntecedentes, /15 JUL 2026/);
  assert.match(renderAntecedentes, /Norte/);
  assert.match(renderAntecedentes, /Sur/);
  assert.match(renderAntecedentes, /4 - 2/);
  assert.match(renderAntecedentes, /type="button"/);
  assert.match(renderAntecedentes, /onclick="abrirPartido\(104\)"/);
  assert.match(
    renderAntecedentes,
    /aria-label="Clausura 2026\. Fecha 3\. Norte 4 - 2 Sur\."/
  );
  assert.doesNotMatch(renderAntecedentes, /Â/);

  const antecedentesCargando = buildAntecedentesDetallePartido(appSource, {
    cargaPartidosFinalizada: false,
    partidosTodos: []
  }).render(partidoActualAntecedentes);
  assert.match(antecedentesCargando, /CARGANDO/);
  assert.match(antecedentesCargando, /Cargando antecedentes entre estos equipos/);
  assert.doesNotMatch(antecedentesCargando, /SIN ANTECEDENTES/);

  const antecedentesTrasCarga = buildAntecedentesDetallePartido(appSource, {
    cargaPartidosFinalizada: true,
    partidosTodos: partidosAntecedentes
  }).render(partidoActualAntecedentes);
  assert.match(antecedentesTrasCarga, /3 PARTIDOS/);
  assert.doesNotMatch(antecedentesTrasCarga, /CARGANDO/);

  const antecedentesDos = buildAntecedentesDetallePartido(appSource, {
    partidosTodos: partidosAntecedentes.filter(partido =>
      [100, 101].includes(partido.id)
    )
  }).render(partidoActualAntecedentes);
  assert.match(antecedentesDos, /2 PARTIDOS/);
  assert.doesNotMatch(antecedentesDos, /3 PARTIDOS/);

  const antecedentesUno = buildAntecedentesDetallePartido(appSource, {
    partidosTodos: partidosAntecedentes.filter(partido => partido.id === 100)
  }).render(partidoActualAntecedentes);
  assert.match(antecedentesUno, /1 PARTIDO/);

  const antecedentesSinFechaActual = Array.from(
    buildAntecedentesDetallePartido(appSource, {
    partidosTodos: [
      ...partidosAntecedentes.filter(partido => [100, 106].includes(partido.id)),
      {
        id: 130,
        torneo_id: 1,
        tipo: "regular",
        fecha: 14,
        estado: "finalizado",
        local: "Club Atletico Norte",
        visitante: "Club Social Sur",
        local_id: 101,
        visitante_id: 202,
        goles_local: 1,
        goles_visitante: 2,
        fecha_partido: null
      }
    ]
    }).obtener({ ...partidoActualAntecedentes, fecha_partido: null }, 10)
      .partidos,
    item => item.partido.id
  );
  assert.deepEqual(antecedentesSinFechaActual, [106, 100, 130]);

  const antecedentesVacio = buildAntecedentesDetallePartido(appSource, {
    partidosTodos: []
  }).render(partidoActualAntecedentes);
  assert.match(antecedentesVacio, /SIN ANTECEDENTES/);
  assert.match(
    antecedentesVacio,
    /No hay enfrentamientos anteriores cargados entre estos equipos\./
  );
  assert.doesNotMatch(antecedentesVacio, /Sin cruces/);

  const funcionesAntecedentes = [
    "renderAntecedentesDetallePartido",
    "obtenerUltimosAntecedentesPartido",
    "obtenerPartidosHistoricosDetallePartido",
    "partidoCoincideConParejaClubes"
  ].map(name => extractFunction(appSource, name)).join("\n");
  assert.doesNotMatch(funcionesAntecedentes, /Sportivo|Sport C|C\.A\./i);
  assert.doesNotMatch(funcionesAntecedentes, /\bfetch\b|SUPABASE|netlify/i);
  assert.match(
    extractFunction(appSource, "obtenerPartidosHistoricosDetallePartido"),
    /obtenerPartidosResueltosTorneoHistorial/
  );
  assert.match(
    extractFunction(appSource, "obtenerFechaCalendarioPartido"),
    /isValidMatchDate/
  );
  assert.match(
    extractFunction(appSource, "obtenerUltimosAntecedentesPartido"),
    /partidoTieneResultadoVisualConfirmado/
  );
  assert.match(
    extractFunction(appSource, "renderDetallePartido"),
    /Cargando partido/
  );
  assert.match(
    extractFunction(appSource, "obtenerPartidos"),
    /state\.partidosTodos = dataTodos[\s\S]*renderDetallePartido\(vistaActual\.partidoId\)/
  );
  results.push("detalle partido: ultimos antecedentes historicos compactos: ok");

  const renderDetalleSinEscudo = buildRenderDetalleEquipo(appSource, {
    equipo: "Club Deportivo Social y Cultural Barrio Central Unido",
    club: {
      nombre_oficial: "Club Deportivo Social y Cultural Barrio Central Unido",
      apodo: "",
      ciudad: "Las Rosas"
    },
    zona: 2
  }).render("Club Deportivo Social y Cultural Barrio Central Unido");
  assert.match(renderDetalleSinEscudo, /team-detail-header/);
  assert.match(renderDetalleSinEscudo, /team-detail-shield is-missing/);
  assert.match(
    renderDetalleSinEscudo,
    /Club Deportivo Social y Cultural Barrio Central Unido/
  );
  assert.match(renderDetalleSinEscudo, /team-detail-origin/);
  assert.match(renderDetalleSinEscudo, /team-detail-zone-line/);
  assert.doesNotMatch(renderDetalleSinEscudo, /team-detail-nickname/);
  results.push("recorrido equipo: filas simples con marcador, A confirmar, fecha y libre compacto: ok");

  assert.match(appSource, /previewTorneoIdSolicitado[\s\S]{0,120}getPreviewTournamentId/);
  assert.match(extractFunction(appSource, "agregarParametroPreviewTorneo"), /preview_torneo/);
  assert.match(
    extractFunction(appSource, "agregarParametroPreviewTorneo"),
    /state\.torneoPreview\?\.id \|\| previewTorneoIdSolicitado/
  );
  assert.match(extractFunction(appSource, "obtenerTorneoPreview"), /isNetlifyPreviewHost/);
  assert.match(extractFunction(appSource, "obtenerTorneoSeleccionado"), /obtenerTorneoPreview/);
  assert.match(extractFunction(appSource, "actualizarAvisoPreviewTorneo"), /Vista de prueba:/);
  assert.match(extractFunction(appSource, "abrirEquipo"), /obtenerTorneoVisualizacionActual/);
  assert.doesNotMatch(extractFunction(appSource, "abrirEquipo"), /torneoEquipoId:\s*state\.torneoVigente/);
  assert.match(extractFunction(appSource, "obtenerTorneoVisualizacionActual"), /state\.torneoPreview/);
  assert.match(extractFunction(appSource, "obtenerTorneoVisualizacionActual"), /state\.torneoVigente/);
  assert.match(extractFunction(appSource, "resolverSeleccionTorneoDetalleEquipo"), /obtenerTorneoVisualizacionDetalleEquipo/);
  assert.match(extractFunction(appSource, "resolverSeleccionTorneoDetalleEquipo"), /torneoEquipoManual/);
  assert.match(extractFunction(appSource, "seleccionarTorneoDetalleEquipo"), /torneoEquipoManual = true/);
  assert.match(extractFunction(appSource, "seleccionarTorneoDetalleEquipo"), /renderDetalleEquipo\(vistaActual\.equipo\)/);
  assert.match(extractFunction(appSource, "renderSelectorTorneosDetalleEquipo"), /esTorneoVigente\(torneo\)/);
  assert.doesNotMatch(
    appSource,
    /function renderUltimosPartidosEquipo|function obtenerUltimosPartidosFinalizadosEquipo/
  );
  assert.match(extractFunction(appSource, "renderDetalleEquipo"), /const libresEquipo/);
  assert.match(extractFunction(appSource, "renderDetalleEquipo"), /const actividadesEquipo/);
  assert.match(
    extractFunction(appSource, "renderDetalleEquipo"),
    /renderPartidosEquipoPorFase\(\s*actividadesEquipo,\s*equipo,\s*torneoSeleccionado\s*\)/
  );
  assert.match(extractFunction(appSource, "renderDetalleEquipo"), /calcularRendimientoEquipoTorneo\(partidosEquipo/);
  assert.match(extractFunction(appSource, "obtenerFechasLibresEquipoTorneo"), /getFreeParticipants/);
  assert.doesNotMatch(extractFunction(appSource, "obtenerFechasLibresEquipoTorneo"), /state\.partidos/);
  assert.match(extractFunction(appSource, "ordenarPartidosCronologicamente"), /fechaTorneoA/);
  assert.match(extractFunction(appSource, "ordenarPartidosCronologicamente"), /fecha_partido/);
  assert.match(extractFunction(appSource, "ordenarPartidosCronologicamente"), /horaA/);
  assert.match(extractFunction(appSource, "obtenerEquiposZonaTorneo"), /getTeamsByZone/);
  assert.match(extractFunction(appSource, "obtenerEquipoLibre"), /getFreeParticipants/);
  assert.match(extractFunction(appSource, "calcularTablaZona"), /buildZoneTable/);
  assert.match(extractFunction(appSource, "renderTablaGoleadores"), /obtenerGoleadoresTablaPublicables/);
  assert.match(extractFunction(appSource, "actualizarNavegacionTabla"), /goleadores/);
  assert.match(appSource, /\/\.netlify\/functions\/goleadores-publicos/);
  assert.doesNotMatch(appSource, /goleadores_oficiales\?select/);
  assert.match(appSource, /eventos_partido_publicos\?select=\$\{EVENTOS_PUBLICOS_SELECT\}&order=id\.asc/);
  assert.doesNotMatch(appSource, /\/rest\/v1\/eventos_partido\?select=\*/);
  assert.match(appSource, /const EVENTOS_PUBLICOS_SELECT = \[/);
  assert.match(extractFunction(appSource, "renderTeams"), /buildTeamList/);
  assert.match(extractFunction(appSource, "obtenerEtapaInicial"), /getInitialRegularStageKey/);
  assert.match(extractFunction(appSource, "actualizarNavegacionEtapas"), /etapa\.clave === etapaActual/);
  assert.match(extractFunction(appSource, "selectStage"), /etapaActual = clave/);
  assert.match(extractFunction(appSource, "changeStage"), /indexActual \+ dir/);
  assert.match(extractFunction(appSource, "obtenerAgendaRegularInicio"), /getUpcomingCalendarMatches/);
  assert.match(extractFunction(appSource, "actualizarEncabezadoPartidos"), /etapaVisible\.etiqueta/);
  assert.match(extractFunction(appSource, "renderDetallePartido"), /home-featured-venue[\s\S]*obtenerEstadioPartido\(partido\)/);
  assert.match(extractFunction(appSource, "renderDetallePartido"), /home-featured-time[\s\S]*obtenerHoraPartido\(partido\)/);
  assert.match(extractFunction(appSource, "renderDetallePartido"), /renderEquipoDetallePartido\([\s\S]*partido,[\s\S]*"local"/);
  assert.match(extractFunction(appSource, "renderDetallePartido"), /renderEquipoDetallePartido\([\s\S]*partido,[\s\S]*"visitante"/);
  assert.match(extractFunction(appSource, "renderDetallePartido"), /match-form-label">ÚLTIMOS RESULTADOS<\/span>/);
  assert.doesNotMatch(appSource, /function renderFormaRecienteDetallePartido|detail-match-form|match-form-grid|match-form-shield/);
  assert.match(extractFunction(appSource, "renderEquipoDetallePartido"), /renderFormaRecienteCabeceraPartido\(partido, lado, nombreEquipo\)/);
  assert.match(extractFunction(appSource, "renderFormaRecienteCabeceraPartido"), /class="match-form-results"/);
  assert.match(extractFunction(appSource, "obtenerFormaRecienteEquipoAntesPartido"), /obtenerPartidosEquipoTorneo\(equipo, torneo\)/);
  assert.match(extractFunction(appSource, "obtenerFormaRecienteEquipoAntesPartido"), /partidoCuentaComoAntecedenteForma\(partido, partidoActual\)/);
  assert.match(extractFunction(appSource, "partidoEsAnteriorAReferenciaForma"), /if \(!fechaActual \|\| !fechaAntecedente\) return false/);
  assert.match(extractFunction(appSource, "partidoEsAnteriorAReferenciaForma"), /fechaAntecedente < fechaActual/);
  assert.match(extractFunction(appSource, "partidoEsProximoSinFechaConfiableForma"), /if \(partidoTieneResultado\(partido\)\) return false/);
  assert.match(extractFunction(appSource, "partidoCuentaComoAntecedenteForma"), /partidoEsAnteriorPorFechaTorneoForma\(antecedente, partidoActual\)/);
  assert.match(extractFunction(appSource, "partidoCuentaComoAntecedenteForma"), /return true/);
  assert.match(extractFunction(appSource, "obtenerResultadoFormaEquipoPartido"), /win: "G"/);
  assert.match(extractFunction(appSource, "torneoPermiteProximoEquipo"), /esTorneoVigente\(torneo\)/);
  assert.match(extractFunction(appSource, "torneoPermiteProximoEquipo"), /state\.torneoPreview\?\.id/);
  assert.match(extractFunction(appSource, "obtenerProximoPartidoEquipo"), /torneoPermiteProximoEquipo\(torneo\)/);
  assert.match(extractFunction(appSource, "obtenerProximoPartidoEquipo"), /partidoPendienteParaVista\(partido\)/);
  assert.match(extractFunction(appSource, "obtenerProximoPartidoEquipo"), /getNextPendingMatch/);
  assert.match(extractFunction(appSource, "renderPartidosEquipoPorFase"), /proximoId/);
  assert.match(extractFunction(appSource, "renderPartidosEquipoPorFase"), /obtenerProximoPartidoEquipo\(partidosEquipo, torneo\)/);
  assert.match(extractFunction(appSource, "partidoFinalizadoRecorridoEquipo"), /partidoTieneResultadoVisualConfirmado\(partido\)/);
  assert.match(appSource, /ESTADOS_PARTIDO_FINALIZADO_OFICIAL/);
  assert.match(extractFunction(appSource, "partidoTieneEstadoFinalizadoOficial"), /TPPublicTournament\?\.isMatchResolved/);
  assert.match(extractFunction(appSource, "partidoTieneResultadoVisualConfirmado"), /partidoTieneEstadoFinalizadoOficial\(partido\)/);
  assert.doesNotMatch(extractFunction(appSource, "partidoTieneResultadoVisualConfirmado"), /ESTADOS_RESULTADO_VISUAL_NEUTRAL/);
  assert.match(extractFunction(appSource, "clasificarResultadoEquipoPartido"), /obtenerLadoEquipoPartido\(partido, equipo\)/);
  assert.match(extractFunction(appSource, "obtenerClaseResultadoEquipoPartido"), /team-match--/);
  assert.match(extractFunction(appSource, "renderMiniPartido"), /team-match-finished/);
  assert.match(extractFunction(appSource, "renderMiniPartido"), /obtenerClaseResultadoEquipoPartido\(partido, equipo\)/);
  assert.match(extractFunction(appSource, "renderMiniPartido"), /const esProximo = proximo && !finalizado/);
  assert.match(extractFunction(appSource, "renderMiniPartido"), /ESTADOS_DATO\.confirmar/);
  assert.match(extractFunction(appSource, "renderMiniPartido"), /team-match-pending/);
  assert.doesNotMatch(extractFunction(appSource, "renderMiniPartido"), /FINALIZADO/);
  assert.doesNotMatch(extractFunction(appSource, "renderMiniPartido"), /PR&Oacute;XIMO|PRÓXIMO/);
  assert.match(extractFunction(appSource, "renderMiniPartido"), /team-match-meta/);
  assert.match(extractFunction(appSource, "renderMiniPartido"), /team-match-state/);
  assert.match(extractFunction(appSource, "renderMiniPartido"), /team-match-future/);
  assert.doesNotMatch(extractFunction(appSource, "renderMiniPartido"), /Partido finalizado|\? "Finalizado"/);
  assert.doesNotMatch(extractFunction(appSource, "renderActividadLibre"), /<button|onclick|abrirPartido/);
  assert.match(extractFunction(appSource, "renderActividadLibre"), /team-activity-free/);
  assert.match(extractFunction(appSource, "renderActividadLibre"), /team-free-line/);
  assert.match(extractFunction(appSource, "renderActividadLibre"), /team-match-state free/);
  assert.match(extractFunction(appSource, "renderActividadLibre"), /team-match-meta/);
  assert.match(extractFunction(appSource, "renderResumenGrupoPartidosEquipo"), /cantidadFechas/);
  assert.match(extractFunction(appSource, "renderResumenGrupoPartidosEquipo"), /grupo\.clave === "regular"/);
  assert.match(extractFunction(appSource, "renderResumenGrupoPartidosEquipo"), /detalle \? `<small>\$\{detalle\}<\/small>` : ""/);
  assert.match(extractFunction(appSource, "renderDetalleEquipo"), /team-detail-identity/);
  assert.match(extractFunction(appSource, "renderDetalleEquipo"), /team-detail-header/);
  assert.doesNotMatch(extractFunction(appSource, "renderDetalleEquipo"), /Identidad del equipo/);
  assert.match(extractFunction(appSource, "renderDetalleEquipo"), /team-detail-zone-line/);
  assert.match(extractFunction(appSource, "renderDetalleEquipo"), /team-detail-shield is-missing/);
  assert.doesNotMatch(extractFunction(appSource, "renderDetalleEquipo"), /team-detail-meta-grid/);
  assert.doesNotMatch(extractFunction(appSource, "renderDetalleEquipo"), /<span>Campeonato<\/span>|<span>Estado<\/span>/);
  assert.match(extractFunction(appSource, "renderDetalleEquipo"), /renderResumenTorneoEquipo/);
  assert.match(extractFunction(appSource, "renderResumenTorneoEquipo"), /Resumen del torneo/);
  assert.match(extractFunction(appSource, "renderCampaniaEquipo"), /Goles a favor/);
  assert.match(extractFunction(appSource, "renderCampaniaEquipo"), /Goles en contra/);
  assert.match(extractFunction(appSource, "renderDestacadosEquipoTorneo"), /Destacados/);
  assert.match(extractFunction(appSource, "renderDestacadosEquipoTorneo"), /Goleadores/);
  assert.match(extractFunction(appSource, "renderDestacadosEquipoTorneo"), /team-season-note--scorers/);
  assert.match(extractFunction(appSource, "renderDestacadosEquipoTorneo"), /team-season-note--big-win/);
  assert.doesNotMatch(appSource, /function renderIndicadoresFormaTabla|function obtenerEtiquetaFormaTabla/);
  assert.doesNotMatch(extractFunction(appSource, "renderTablaPosiciones"), /<th>Forma<\/th>|form-row|renderIndicadoresFormaTabla/);
  assert.doesNotMatch(extractFunction(appSource, "renderTablaGeneral"), /<th>Forma<\/th>/);
  assert.doesNotMatch(extractFunction(appSource, "renderFilaTablaGeneral"), /form-row|renderIndicadoresFormaTabla/);
  assert.match(extractFunction(appSource, "claseClasificacion"), /t-pos-cuartos/);
  assert.match(extractFunction(appSource, "claseClasificacion"), /t-pos-octavos/);
  assert.match(extractFunction(appSource, "renderTablaPosiciones"), /Cuartos directo[\s\S]*Octavos/);
  assert.doesNotMatch(extractFunction(appSource, "renderTablaPosiciones"), /<tr class=/);
  assert.match(extractFunction(appSource, "renderTablaPosiciones"), /<th>PTS<\/th>[\s\S]*<th>DG<\/th>/);
  assert.match(extractFunction(appSource, "renderTablaPosiciones"), /obtenerEscudoTablaEquipo/);
  assert.match(extractFunction(appSource, "renderTablaPosiciones"), /renderImagenEscudoTabla/);
  assert.match(extractFunction(appSource, "renderTablaGeneral"), /<th>Zona<\/th>[\s\S]*<th>PTS<\/th>[\s\S]*<th>DG<\/th>/);
  assert.match(extractFunction(appSource, "renderTablaGeneral"), /<h3>Tabla general<\/h3>/);
  assert.match(extractFunction(appSource, "renderTablaGeneral"), /\$\{data\.length\} equipos/);
  assert.doesNotMatch(extractFunction(appSource, "renderTablaGeneral"), /tabla-general-kicker">General/);
  assert.doesNotMatch(extractFunction(appSource, "renderTablaGeneral"), /Tabla general de puntos/);
  assert.match(extractFunction(appSource, "renderFilaTablaGeneral"), /renderImagenEscudoTabla/);
  assert.match(extractFunction(appSource, "obtenerAtributosCargaEscudoTabla"), /eager/);
  assert.match(extractFunction(appSource, "obtenerAtributosCargaEscudoTabla"), /lazy/);
  assert.match(extractFunction(appSource, "aplicarDatosTorneo"), /filtrarPartidosPorTorneo/);
  assert.match(
    extractFunction(appSource, "obtenerPartidos"),
    /torneoIdPublicoParam[\s\S]*torneo_id=eq\.\$\{torneoIdPublicoParam\}/
  );
  assert.doesNotMatch(extractFunction(utilsSource, "aplicarClubes"), /\.zona\b/);
  assert.match(styleSource, /\.team-match-line[\s\S]*minmax\(0, 1fr\)/);
  assert.doesNotMatch(styleSource, /team-recent|\.form-row|\.fd\b|\.fw\b|\.fe\b|\.fl\b/);
  assert.match(styleSource, /\.tabla \{[\s\S]*min-width: 320px/);
  assert.match(styleSource, /\.tabla-general-table \{[\s\S]*min-width: 460px/);
  assert.match(styleSource, /@media \(max-width: 420px\)[\s\S]*\.tabla,[\s\S]*\.tabla-general-table[\s\S]*table-layout: fixed/);
  assert.match(styleSource, /--classify-cuartos: #2bd67f/);
  assert.match(styleSource, /--classify-octavos: #f2c94c/);
  assert.match(styleSource, /\.tabla-ref[\s\S]*border-radius: 999px/);
  assert.match(styleSource, /\.t-pos-cuartos::before[\s\S]*\.t-pos-octavos::before/);
  assert.match(styleSource, /\.t-pos-cuartos::before[\s\S]*var\(--classify-cuartos\)/);
  assert.match(styleSource, /\.t-pos-octavos::before[\s\S]*var\(--classify-octavos\)/);
  assert.doesNotMatch(styleSource, /detail-match-form|match-form-grid|match-form-team|match-form-shield/);
  assert.match(styleSource, /\.match-detail-team \.match-form-results[\s\S]*margin-top: -1px/);
  assert.match(styleSource, /\.match-detail-scoreboard \{[\s\S]*position: relative/);
  assert.match(styleSource, /\.match-form-label \{[\s\S]*position: absolute/);
  assert.match(styleSource, /\.match-form-label \{[\s\S]*bottom: 7px/);
  assert.match(styleSource, /\.match-form-label \{[\s\S]*font-size: \.52rem/);
  assert.match(styleSource, /\.match-form-results[\s\S]*justify-content: center/);
  assert.match(styleSource, /\.match-form-result[\s\S]*clamp\(23px, 6\.4vw, 25px\)/);
  assert.match(styleSource, /\.match-form-result[\s\S]*border-radius: 6px/);
  assert.match(styleSource, /\.match-form-result[\s\S]*font-family: 'DM Mono'/);
  assert.match(styleSource, /\.match-form-empty[\s\S]*Sin antecedentes recientes|\.match-form-empty[\s\S]*text-transform: uppercase/);
  assert.match(styleSource, /\.team-match-row \{[\s\S]*padding: 11px 12px 14px/);
  assert.match(styleSource, /\.team-match-row \{[\s\S]*border-bottom: 1px solid rgba\(255, 255, 255, \.09\)/);
  assert.match(styleSource, /\.team-match--win[\s\S]*--team-result-win/);
  assert.match(styleSource, /\.team-match--draw[\s\S]*--team-result-draw/);
  assert.match(styleSource, /\.team-match--loss[\s\S]*--team-result-loss/);
  assert.match(styleSource, /\.team-match--bye[\s\S]*box-shadow: none/);
  assert.match(styleSource, /\.team-match-line > span[\s\S]*text-overflow: ellipsis/);
  assert.match(styleSource, /\.team-match-next[\s\S]*border-left/);
  assert.match(styleSource, /\.team-activity-free[\s\S]*cursor: default/);
  assert.match(styleSource, /\.team-match-row \.team-match-pending[\s\S]*font-size: clamp/);
  assert.match(styleSource, /\.mr-time\.tbd[\s\S]*font-size: clamp/);
  assert.match(styleSource, /\.match-detail-featured-state[\s\S]*max-width/);
  assert.match(styleSource, /\.match-detail-featured-meta \.home-featured-time strong[\s\S]*clamp/);
  assert.match(styleSource, /\.team-match-row small[\s\S]*white-space: normal/);
  assert.match(styleSource, /\.team-match-row small[\s\S]*letter-spacing: 0\.02em/);
  assert.match(styleSource, /\.team-detail-identity::before[\s\S]*linear-gradient/);
  assert.match(styleSource, /\.team-detail-achievement--champion[\s\S]*--team-achievement-bg/);
  assert.match(styleSource, /\.team-season-note-icon--scorers::before/);
  assert.match(styleSource, /\.team-season-note-icon--big-win::before/);
  assert.match(styleSource, /\.t-pts[\s\S]*font-weight: 700/);
  assert.doesNotMatch(
    fs.readFileSync(path.join(ROOT, "js", "public-tournament.js"), "utf8"),
    /\b(fetch|insert|update|delete|upsert|rpc)\b/i
  );
  results.push("vistas publicas usan helper por torneo y no escriben datos: ok");

  return results;
}

if (require.main === module) {
  runTests()
    .then(results => {
      results.forEach(result => console.log(result));
    })
    .catch(error => {
      console.error(error);
      process.exitCode = 1;
    });
}

module.exports = { runTests };
