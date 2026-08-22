"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const AdminMatchFlow = require("../js/admin-match-flow");

const ROOT = path.resolve(__dirname, "..");

function loadClausuraMatches() {
  const fixturePath = path.join(
    ROOT,
    "data",
    "clausura-2026",
    "fixture_clausura_2026_oficial.json"
  );
  const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
  return fixture.matches.map((match, index) => ({
    id: 1000 - index,
    torneo_id: 2,
    tipo: "regular",
    fase: null,
    numero_playoff: null,
    fecha: match.fecha,
    zona: match.zona,
    local: match.local_source,
    visitante: match.visitante_source,
    local_id: match.local_id,
    visitante_id: match.visitante_id,
    fecha_partido: match.fecha_partido,
    hora: match.hora,
    estado: match.estado,
    goles_local: match.goles_local,
    goles_visitante: match.goles_visitante
  }));
}

function countByFilter(matches, filter) {
  return AdminMatchFlow.filterMatches(matches, {
    torneoId: 2,
    tipo: "regular",
    ...filter
  }).length;
}

function extractFunction(source, name) {
  const match = new RegExp(`function\\s+${name}\\s*\\(`).exec(source);
  assert.ok(match, `No se encontro ${name}`);
  const asyncStart = source.lastIndexOf("async ", match.index);
  const start =
    asyncStart !== -1 &&
    source.slice(asyncStart + "async ".length, match.index).trim() === ""
      ? asyncStart
      : match.index;
  const paramsOpen = source.indexOf("(", start);
  let paramsDepth = 0;
  let open = -1;

  for (let index = paramsOpen; index < source.length; index += 1) {
    if (source[index] === "(") paramsDepth += 1;
    else if (source[index] === ")") {
      paramsDepth -= 1;
      if (paramsDepth === 0) {
        open = source.indexOf("{", index);
        break;
      }
    }
  }

  assert.notEqual(open, -1, `No se encontro cuerpo de ${name}`);
  let depth = 0;

  for (let index = open; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    else if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }

  throw new Error(`No se pudo extraer ${name}`);
}

function createClassList(initial = []) {
  const classes = new Set(initial);
  return {
    add: (...names) => names.forEach(name => classes.add(name)),
    remove: (...names) => names.forEach(name => classes.delete(name)),
    toggle: (name, force) => {
      const active = force === undefined ? !classes.has(name) : Boolean(force);
      if (active) classes.add(name);
      else classes.delete(name);
      return active;
    },
    contains: name => classes.has(name),
    has: name => classes.has(name),
    toString: () => [...classes].join(" ")
  };
}

async function runTests() {
  const results = [];
  const clausura = loadClausuraMatches();

  {
    const ordered = AdminMatchFlow.sortMatchesForSelector(clausura);
    assert.equal(ordered[0].fecha, 1);
    assert.equal(ordered[0].zona, 1);
    assert.equal(ordered[3].zona, 2);
    assert.equal(ordered[6].zona, 3);
    assert.notEqual(ordered[0].id, Math.min(...clausura.map(match => match.id)));
    results.push("orden deportivo por fecha/zona sin depender de ID: ok");
  }

  {
    const mixed = [
      ...clausura,
      { ...clausura[0], id: 1, torneo_id: 1, local: "Historico" }
    ];
    const withStatus = clausura.map((match, index) =>
      index === 0 ? { ...match, estado: "finalizado" } : match
    );
    assert.equal(countByFilter(mixed, { fecha: "1", zona: "1" }), 3);
    assert.equal(countByFilter(mixed, { fecha: "1", zona: "2" }), 3);
    assert.equal(countByFilter(mixed, { fecha: "1", zona: "3" }), 3);
    assert.equal(
      AdminMatchFlow.filterMatches(withStatus, {
        torneoId: 2,
        tipo: "regular",
        estado: "finalizado"
      }).length,
      1
    );
    assert.equal(
      AdminMatchFlow.filterMatches(mixed, {
        torneoId: 2,
        tipo: "regular",
        fecha: "1",
        zona: "1"
      }).every(match => match.torneo_id === 2),
      true
    );
    results.push("filtros de torneo, fecha, zona y estado: ok");
  }

  {
    const sample = [
      ...clausura,
      {
        id: 3000,
        torneo_id: 2,
        tipo: "regular",
        fecha: 1,
        zona: 2,
        local: "C.A. Newell's Old Boys",
        visitante: "C.A. Montes de Oca",
        estado: "programado"
      }
    ];
    assert.equal(
      AdminMatchFlow.filterMatches(sample, {
        torneoId: 2,
        tipo: "regular",
        equipo: "sportivo"
      }).some(match => match.local === "SPORTIVO A. CLUB"),
      true
    );
    assert.equal(
      AdminMatchFlow.filterMatches(sample, {
        torneoId: 2,
        tipo: "regular",
        equipo: "CORREA"
      }).some(match => match.visitante === "C.A. CORREA"),
      true
    );
    assert.equal(
      AdminMatchFlow.filterMatches(sample, {
        torneoId: 2,
        tipo: "regular",
        equipo: "montes"
      }).some(match => /Montes/i.test(match.visitante)),
      true
    );
    assert.equal(
      AdminMatchFlow.filterMatches(sample, {
        torneoId: 2,
        tipo: "regular",
        equipo: "newells"
      }).some(match => match.local.includes("Newell")),
      true
    );
    results.push("busqueda por fragmento sin mayusculas ni acentos exactos: ok");
  }

  {
    const mixed = [
      ...clausura,
      { ...clausura[0], id: 2001, torneo_id: 1, local: "Apertura Club" }
    ];
    const aperturaResults = AdminMatchFlow.filterMatches(mixed, {
      torneoId: 1,
      tipo: "regular",
      equipo: "apertura"
    });
    const clausuraResults = AdminMatchFlow.filterMatches(mixed, {
      torneoId: 2,
      tipo: "regular",
      equipo: "apertura"
    });
    assert.equal(aperturaResults.length, 1);
    assert.equal(clausuraResults.length, 0);
    results.push("cambio de torneo no conserva resultados incompatibles: ok");
  }

  {
    [6, 7, 13, 14].forEach(fecha => {
      assert.equal(countByFilter(clausura, { fecha: String(fecha), zona: "2" }), 0);
    });
    results.push("Zona 2 fechas 6, 7, 13 y 14 devuelve 0 sin error: ok");
  }

  {
    const stage = {
      torneoId: 2,
      tipo: "regular",
      valor: AdminMatchFlow.buildRegularStageValue(1, 1)
    };
    const partidosZona1 = AdminMatchFlow.filterMatches(clausura, {
      torneoId: 2,
      tipo: "regular",
      fecha: "1",
      zona: "1"
    });
    assert.equal(AdminMatchFlow.countMatchesForStage(clausura, stage), 3);
    assert.equal(partidosZona1.every(match => String(match.zona) === "1"), true);
    results.push("cierre de Zona 1 no incluye Zona 2 o Zona 3: ok");
  }

  {
    const filtros = {
      torneoId: 2,
      tipo: "regular",
      fecha: "1",
      zona: "1",
      estado: "programado",
      equipo: "sportivo"
    };
    const seleccionado = clausura.find(match =>
      match.fecha === 1 &&
      match.zona === 1 &&
      /sportivo/i.test(match.local)
    );
    assert.equal(
      AdminMatchFlow.selectedMatchIsCompatible(
        clausura,
        filtros,
        seleccionado.id
      ),
      true
    );
    assert.equal(
      AdminMatchFlow.selectedMatchIsCompatible(
        clausura,
        { ...filtros, zona: "2" },
        seleccionado.id
      ),
      false
    );
    assert.equal(
      AdminMatchFlow.selectedMatchIsCompatible(
        clausura,
        { ...filtros, torneoId: 1 },
        seleccionado.id
      ),
      false
    );
    results.push("recarga conserva seleccion solo si sigue compatible: ok");
  }

  {
    const apertura = [
      { id: 1, torneo_id: 1, tipo: "regular", fecha: 1, zona: 1 },
      { id: 2, torneo_id: 1, tipo: "regular", fecha: 1, zona: 2 },
      { id: 3, torneo_id: 1, tipo: "playoff", fase: "octavos" },
      { id: 4, torneo_id: 1, tipo: "playoff", fase: "cuartos" }
    ];
    assert.equal(
      AdminMatchFlow.countMatchesForStage(apertura, {
        torneoId: 1,
        tipo: "regular",
        valor: "1"
      }),
      2
    );
    assert.equal(
      AdminMatchFlow.countMatchesForStage(apertura, {
        torneoId: 1,
        tipo: "playoff",
        valor: "octavos"
      }),
      1
    );
    assert.deepEqual(AdminMatchFlow.parseRegularStageValue("1"), {
      fecha: "1",
      zona: null,
      legacy: true
    });
    results.push("Apertura legacy, playoffs y respaldos anteriores legibles: ok");
  }

  {
    const html = fs.readFileSync(
      path.join(ROOT, "tp-admin-7c9f2026.html"),
      "utf8"
    );
    const indexOfId = id => {
      const index = html.indexOf(`id="${id}"`);
      assert.notEqual(index, -1, `No se encontro #${id}`);
      return index;
    };

    assert.ok(indexOfId("refreshBtn") < indexOfId("matchList"));
    assert.match(html, /id="refreshBtn" class="ghost"[\s\S]*?Recargar datos/);
    assert.ok(indexOfId("adminViewPartidosTab") < indexOfId("adminViewPartidos"));
    assert.ok(indexOfId("adminViewJugadoresTab") < indexOfId("adminViewJugadores"));
    assert.match(html, /role="tablist"[\s\S]*?PARTIDOS[\s\S]*?JUGADORES/);
    assert.match(html, /id="adminViewPartidosTab"[\s\S]*?aria-selected="true"/);
    assert.match(html, /id="adminViewJugadoresTab"[\s\S]*?aria-selected="false"/);
    assert.match(html, /id="adminViewJugadores"[\s\S]*?hidden/);
    assert.ok(indexOfId("adminViewPartidos") < indexOfId("workTournamentSelect"));
    assert.ok(indexOfId("workTournamentSelect") < indexOfId("typeFilter"));
    assert.ok(indexOfId("matchList") < indexOfId("selectedMatchSummary"));
    assert.ok(indexOfId("selectedMatchSummary") < indexOfId("matchForm"));
    assert.ok(indexOfId("arbitroInput") < indexOfId("destacadoInicioInput"));
    assert.ok(indexOfId("destacadoInicioInput") < indexOfId("destacadoTituloInput"));
    assert.ok(indexOfId("destacadoTituloInput") < indexOfId("golesLocalInput"));
    assert.match(html, /id="destacadoInicioInput" type="checkbox"/);
    assert.match(html, /Destacar en Inicio/);
    assert.match(html, /id="destacadoTituloInput"[\s\S]*?Clásico de Las Parejas/);
    assert.ok(indexOfId("matchForm") < indexOfId("liveMatch"));
    assert.ok(indexOfId("liveLocalName") < indexOfId("liveTeamPickerTitle"));
    assert.match(html, /id="liveTeamPickerTitle"[\s\S]*?¿PARA QUÉ EQUIPO\?/);
    assert.match(html, /id="liveTeamLocalBtn"[\s\S]*?LOCAL/);
    assert.match(html, /id="liveTeamAwayBtn"[\s\S]*?VISITANTE/);
    assert.match(html, /id="liveSelectedTeamState"[\s\S]*?aria-live="polite"/);
    assert.match(html, /id="liveActionGrid"/);
    assert.match(html, /id="livePickerCloseBtn"[\s\S]*?data-live-close/);
    assert.ok(indexOfId("liveEmptyRoster") < indexOfId("livePlayerSearchWrap"));
    assert.match(html, /id="liveEmptyRoster"[\s\S]*?Todavía no hay jugadores cargados para este club y torneo/);
    assert.match(html, /id="liveEmptyAddPlayerBtn"[\s\S]*?Agregar jugador al plantel/);
    assert.match(html, /id="liveEmptyRoster"[\s\S]*?data-live-close[\s\S]*?Cerrar/);
    assert.match(html, /id="livePlayerSearch"/);
    assert.match(html, /id="livePickerMoment"/);
    assert.match(html, /id="livePlayerState"[\s\S]*?aria-live="polite"/);
    assert.match(html, /id="livePickerActions"/);
    assert.match(html, /id="liveSaveActionBtn" disabled/);
    assert.doesNotMatch(html, /live-action-columns|liveLocalActions|liveAwayActions/);
    assert.ok(indexOfId("matchForm") < indexOfId("eventMatch"));
    assert.ok(indexOfId("eventMatch") < indexOfId("adminViewJugadores"));
    assert.ok(indexOfId("matchForm") < indexOfId("stageAdminSelect"));
    assert.match(html, /id="rosterPlayerSearch"/);
    assert.match(html, /id="rosterSearchResults"[\s\S]*?role="listbox"/);
    assert.match(html, /id="rosterCreateNewBtn"/);
    assert.match(html, /class="event-create-player hidden"\s+id="rosterCreatePlayerBlock"/);
    assert.match(html, /id="rosterExtraData"[\s\S]*?id="rosterAliases"/);
    assert.doesNotMatch(html, /<select[^>]+id="rosterPlayerId"/);
    assert.doesNotMatch(html, /<select[^>]+id="eventPlayer"/);
    assert.doesNotMatch(html, /<select[^>]+id="eventRelatedPlayer"/);
    assert.ok(indexOfId("eventPlayerSearch") < indexOfId("eventPlayer"));
    assert.ok(indexOfId("eventPlayer") < indexOfId("eventPlayerResults"));
    assert.ok(indexOfId("eventPlayerMissingBtn") < indexOfId("eventMissingFlow"));
    assert.match(html, /id="eventPlayerState"[\s\S]*?aria-live="polite"/);
    assert.match(html, /id="eventMissingResults"[\s\S]*?aria-live="polite"/);
    assert.match(html, /id="eventCreateConfirm" type="checkbox"/);
    assert.doesNotMatch(html, /id="eventDataStatus"/);
    assert.doesNotMatch(html, /id="eventSource"/);
    assert.doesNotMatch(html, /eventCreateLegacy/);
    const partidosPanel = html.slice(
      indexOfId("adminViewPartidos"),
      indexOfId("adminViewJugadores")
    );
    const jugadoresPanel = html.slice(indexOfId("adminViewJugadores"));
    assert.match(partidosPanel, /id="workTournamentSelect"/);
    assert.doesNotMatch(partidosPanel, /class="admin-card roster-panel"/);
    assert.match(partidosPanel, /class="match-dependent-detail"/);
    assert.match(partidosPanel, /Elegí un partido para continuar/);
    assert.match(jugadoresPanel, /class="admin-card roster-panel"/);
    assert.doesNotMatch(jugadoresPanel, /id="workTournamentSelect"/);
    assert.doesNotMatch(jugadoresPanel, /class="match-dependent-detail"/);
    assert.doesNotMatch(jugadoresPanel, /class="match-required-message"/);
    assert.doesNotMatch(
      jugadoresPanel,
      /Elegí un partido para continuar/
    );
    results.push("resultados y seleccion quedan antes de edicion/incidencias/cierre: ok");
  }

  {
    const js = fs.readFileSync(path.join(ROOT, "js", "admin-panel.js"), "utf8");
    const seleccionarStart = js.indexOf("function seleccionarPartido");
    const seleccionarEnd = js.indexOf("function obtenerEstadioClubLocal", seleccionarStart);
    const seleccionarBody = js.slice(seleccionarStart, seleccionarEnd);
    const refreshHandlerStart = js.indexOf('refreshBtn.addEventListener("click"');
    const refreshHandlerEnd = js.indexOf('logoutBtn.addEventListener("click"', refreshHandlerStart);
    const refreshHandler = js.slice(refreshHandlerStart, refreshHandlerEnd);
    const recargaStart = js.indexOf("async function recargarDatosPanel");
    const recargaEnd = js.indexOf("async function cargarPanel", recargaStart);
    const recargaBody = js.slice(recargaStart, recargaEnd);

    assert.match(js, /adminApp\.classList\.toggle\("has-match-selection", valido\)/);
    assert.match(js, /destacado_inicio/);
    assert.match(js, /columnaDestacadoDisponible\(partidoOriginal\)/);
    assert.match(js, /fields\.destacadoInicio\.checked/);
    assert.match(js, /fields\.destacadoTitulo\.disabled = !activo/);
    assert.match(js, /selectedMatchSummary\.innerHTML = `/);
    assert.match(js, /scrollIntoView\(\{\s*behavior: "smooth"/);
    assert.match(js, /<option value="">Elegí un partido<\/option>/);
    assert.match(refreshHandler, /recargarDatosPanel\(\)/);
    assert.doesNotMatch(refreshHandler, /cargarPanel\(\)/);
    assert.match(recargaBody, /capturarEstadoRecarga\(\)/);
    assert.match(recargaBody, /restaurarFiltrosPartidos\(estado\)/);
    assert.match(recargaBody, /partidoSeleccionadoCompatibleConFiltros/);
    assert.match(js, /selectedMatchIsCompatible/);
    assert.match(recargaBody, /El partido seleccionado ya no está disponible con estos filtros\./);
    assert.match(recargaBody, /if \(recargaDatosEnCurso\) return;/);
    assert.match(recargaBody, /restaurarPosicionPanel\(estado\)/);
    assert.match(recargaBody, /capturarDatosRecarga\(\)/);
    assert.match(recargaBody, /restaurarDatosRecarga\(datosPrevios, estado\)/);
    assert.match(recargaBody, /adminViewActual === "jugadores"/);
    assert.match(recargaBody, /Planteles actualizados\./);
    assert.match(recargaBody, /await cargarPlantelesAdmin\(\)/);
    assert.match(js, /function restaurarDatosRecarga/);
    assert.doesNotMatch(recargaBody, /cargarPanel\(\)/);
    assert.doesNotMatch(recargaBody, /limpiarContextoTorneo|mostrarEstadoSinTorneo/);
    assert.doesNotMatch(recargaBody, /apiRequest\("(POST|PATCH|DELETE)"/);
    assert.match(js, /scope:\s*"jugadores"/);
    assert.match(js, /EVENT_PLAYER_LIMIT = 8/);
    assert.match(js, /const visibles = filtradas\.slice\(0, EVENT_PLAYER_LIMIT\)/);
    assert.match(js, /busquedaPlantel\.candidatos\.slice\(0, 8\)/);
    assert.match(js, /rosterFields\.search\.value\.trim\(\)\.length < 2/);
    assert.match(js, /scope:\s*"buscar-jugador"/);
    assert.match(js, /data-event-player/);
    assert.match(js, /eventFields\.player\.value = button\.dataset\.eventPlayer/);
    assert.match(js, /data-roster-candidate/);
    assert.match(js, /crear-jugador-inscripcion/);
    assert.match(js, /function seleccionarEquipoModo\(lado\)/);
    assert.match(js, /Equipo seleccionado: \$\{equipo\.nombre\}/);
    assert.match(js, /function renderAccionesModo\(disabled, partido, eventos\)/);
    assert.match(js, /liveActionGrid\.innerHTML = LIVE_ACTIONS\.map/);
    assert.match(js, /abrirSelectorModo\(button\.dataset\.liveAction\)/);
    assert.match(js, /function setLivePickerEmptyMode\(isEmpty\)/);
    assert.match(js, /function plantelModoEquipoActual\(\)/);
    assert.match(js, /if \(plantel\.length === 0\)/);
    assert.match(js, /liveEmptyRoster\.classList\.toggle\("hidden", !isEmpty\)/);
    assert.match(js, /livePickerCloseBtn\.classList\.toggle\("hidden", isEmpty\)/);
    assert.match(js, /livePlayerSearchWrap\.classList\.toggle\("hidden", isEmpty\)/);
    assert.match(js, /livePickerMoment\.classList\.toggle\("hidden", isEmpty\)/);
    assert.match(js, /livePickerActions\.classList\.toggle\("hidden", isEmpty\)/);
    assert.match(js, /function volverAIncidenciaDesdePlantel\(inscripcionId\)/);
    assert.match(js, /liveRosterReturnContext = \{/);
    assert.match(js, /cerrarSelectorModo\(\{ preservarRegresoPlantel: true \}\)/);
    assert.match(js, /function setAdminView\(view, options = \{\}\)/);
    assert.match(js, /adminViewTabs\.forEach\(tab =>/);
    assert.match(js, /adminViewPanels\.forEach\(panel =>/);
    assert.match(js, /panel\.dataset\.adminViewPanel === nextView/);
    assert.match(js, /const cambiaVista = nextView !== adminViewActual/);
    assert.match(js, /const preservarRegresoPlantel = Boolean\(options\.preservarRegresoPlantel\)/);
    assert.match(js, /if \(cambiaVista && !preservarRegresoPlantel\) \{/);
    assert.match(js, /liveRosterReturnContext = null;/);
    assert.match(js, /setAdminView\("jugadores", \{ preservarRegresoPlantel: true \}\)/);
    assert.match(js, /setAdminView\("partidos", \{ preservarRegresoPlantel: true \}\)/);
    assert.match(js, /adminViewTabs\.forEach\(tab => \{/);
    assert.match(js, /setAdminView\(tab\.dataset\.adminView\)/);
    assert.match(js, /preservarRegresoPlantel: Boolean\(liveRosterReturnContext\)/);
    assert.match(js, /liveSelectedPlayerId = Number\(inscripcion\.id\)/);
    assert.match(js, /function guardarSeleccionModo\(\)/);
    assert.match(js, /function verificacionFormularioIncidencia\(\)/);
    assert.doesNotMatch(js, /eventFields\.(dataStatus|source)/);
    assert.match(js, /liveEmptyAddPlayerBtn\.addEventListener\("click", abrirPlantelDesdeModo\)/);
    assert.match(js, /liveSaveActionBtn\.addEventListener\("click"/);
    assert.match(js, /El jugador seleccionado no pertenece al equipo elegido/);
    assert.doesNotMatch(js, /liveLocalActions|liveAwayActions|data-live-side="\$\{lado\}"/);
    assert.doesNotMatch(js, /renderOpcionesJugadores|seleccionarJugadorExistente/);
    assert.match(js, /Selecciona una inscripción de jugador/);
    assert.match(js, /busqueda_previa:\s*true/);
    assert.match(js, /confirmar_creacion:\s*true/);
    assert.match(js, /confirmar_inscripcion:\s*true/);
    assert.match(
      js,
      /incidenciaActualHistoricaSinVincular\(\)[\s\S]*?!eventFields\.relatedPlayer\.value/
    );
    assert.doesNotMatch(js, /crear_desde_texto|eventCreateLegacy/);
    assert.match(js, /refreshBtn\.disabled = isReloading;/);
    assert.match(js, /Actualizando…/);
    assert.doesNotMatch(
      seleccionarBody,
      /\b(typeFilter|dateFilter|zoneFilter|statusFilter|searchInput)\.value\s*=/
    );
    results.push("recarga manual conserva filtros, seleccion y posicion: ok");
  }

  {
    const js = fs.readFileSync(path.join(ROOT, "js", "admin-panel.js"), "utf8");
    const tabPartidos = {
      dataset: { adminView: "partidos" },
      classList: createClassList(["on"]),
      attributes: {},
      setAttribute(name, value) {
        this.attributes[name] = value;
      },
      tabIndex: 0
    };
    const tabJugadores = {
      dataset: { adminView: "jugadores" },
      classList: createClassList(),
      attributes: {},
      setAttribute(name, value) {
        this.attributes[name] = value;
      },
      tabIndex: -1
    };
    const panelPartidos = {
      dataset: { adminViewPanel: "partidos" },
      classList: createClassList(),
      hidden: false
    };
    const panelJugadores = {
      dataset: { adminViewPanel: "jugadores" },
      classList: createClassList(["hidden"]),
      hidden: true
    };

    const sandbox = {
      adminViewActual: "partidos",
      adminApp: { dataset: {} },
      adminViewTabs: [tabPartidos, tabJugadores],
      adminViewPanels: [panelPartidos, panelJugadores],
      liveRosterReturnContext: { partidoId: 10 },
      livePicker: {
        classList: createClassList(["hidden"]),
        attributes: {},
        setAttribute(name, value) {
          this.attributes[name] = value;
        }
      },
      closedPickerOptions: null,
      cerrarSelectorModo(options) {
        sandbox.closedPickerOptions = options || null;
      },
      liveAction: {
        partidoId: 10,
        lado: "local",
        tipo: "gol",
        equipoId: 1,
        equipoNombre: "Campaña"
      },
      partidoModoSeleccionado: () => ({ id: 10, torneo_id: 2 }),
      torneoTrabajoId: "2",
      rosterTournament: { value: "" },
      rosterClub: { value: "" },
      rosterRendered: false,
      renderPlantel() {
        sandbox.rosterRendered = true;
      },
      rosterStarted: false,
      iniciarNuevaInscripcion() {
        sandbox.rosterStarted = true;
      },
      scrolledRoster: null,
      document: {
        body: { classList: createClassList() },
        querySelector(selector) {
          if (selector !== ".roster-panel") return null;
          return {
            scrollIntoView(options) {
              sandbox.scrolledRoster = options;
            }
          };
        }
      },
      partidos: [{ id: 10, torneo_id: 2 }],
      seleccionadoId: null,
      selectedMatch: null,
      seleccionarPartido(id, options) {
        sandbox.selectedMatch = { id, options };
        sandbox.seleccionadoId = id;
      },
      liveSelectedSide: null,
      liveChangeOutId: 99,
      liveSelectedPlayerId: null,
      inscripcionDisponibleParaModo: (id, contexto) =>
        contexto.equipoId === 1 && Number(id) === 154
          ? { id: 154, estado: "por_verificar" }
          : null,
      livePlayerSearch: {
        value: "sanchez",
        focused: false,
        focus() {
          this.focused = true;
        }
      },
      liveMinute: { value: "33" },
      modeRendered: false,
      renderModoPartido() {
        sandbox.modeRendered = true;
      },
      pickerRendered: false,
      renderSelectorJugadoresModo() {
        sandbox.pickerRendered = true;
      },
      feedback: null,
      setLiveFeedback(message, type) {
        sandbox.feedback = { message, type };
      },
      window: {
        requestAnimationFrame(callback) {
          callback();
        }
      },
      liveSaveActionBtn: {
        focused: false,
        focus() {
          this.focused = true;
        }
      },
      livePlayerSearchWrap: { classList: createClassList() },
      String,
      Number,
      Boolean
    };

    vm.createContext(sandbox);
    vm.runInContext(
      [
        extractFunction(js, "setAdminView"),
        extractFunction(js, "abrirPlantelDesdeModo"),
        extractFunction(js, "volverAIncidenciaDesdePlantel")
      ].join("\n"),
      sandbox
    );

    sandbox.setAdminView("jugadores");
    assert.equal(sandbox.adminViewActual, "jugadores");
    assert.equal(sandbox.adminApp.dataset.adminView, "jugadores");
    assert.equal(tabPartidos.classList.contains("on"), false);
    assert.equal(tabJugadores.classList.contains("on"), true);
    assert.equal(tabPartidos.attributes["aria-selected"], "false");
    assert.equal(tabJugadores.attributes["aria-selected"], "true");
    assert.equal(tabPartidos.tabIndex, -1);
    assert.equal(tabJugadores.tabIndex, 0);
    assert.equal(panelPartidos.hidden, true);
    assert.equal(panelJugadores.hidden, false);
    assert.equal(panelJugadores.classList.contains("hidden"), false);
    assert.equal(sandbox.liveRosterReturnContext, null);

    sandbox.liveRosterReturnContext = { partidoId: 22 };
    sandbox.setAdminView("jugadores");
    assert.equal(sandbox.adminViewActual, "jugadores");
    assert.deepEqual(sandbox.liveRosterReturnContext, { partidoId: 22 });

    sandbox.liveRosterReturnContext = null;
    sandbox.closedPickerOptions = null;
    sandbox.setAdminView("partidos");
    sandbox.abrirPlantelDesdeModo();
    assert.equal(sandbox.adminViewActual, "jugadores");
    assert.equal(sandbox.closedPickerOptions.preservarRegresoPlantel, true);
    assert.equal(sandbox.liveRosterReturnContext.partidoId, 10);
    assert.equal(sandbox.liveRosterReturnContext.torneoId, 2);
    assert.equal(sandbox.liveRosterReturnContext.equipoId, 1);
    assert.equal(sandbox.rosterTournament.value, "2");
    assert.equal(sandbox.rosterClub.value, "1");
    assert.equal(sandbox.rosterRendered, true);
    assert.equal(sandbox.rosterStarted, true);
    assert.equal(sandbox.scrolledRoster.behavior, "smooth");
    assert.equal(sandbox.scrolledRoster.block, "start");

    const restored = sandbox.volverAIncidenciaDesdePlantel(154);
    assert.equal(restored, true);
    assert.equal(sandbox.adminViewActual, "partidos");
    assert.equal(panelPartidos.hidden, false);
    assert.equal(panelJugadores.hidden, true);
    assert.equal(sandbox.selectedMatch.id, 10);
    assert.equal(sandbox.selectedMatch.options.desplazarAEditor, false);
    assert.equal(sandbox.liveSelectedSide, "local");
    assert.equal(sandbox.liveAction.tipo, "gol");
    assert.equal(sandbox.liveChangeOutId, null);
    assert.equal(sandbox.liveSelectedPlayerId, 154);
    assert.equal(sandbox.liveRosterReturnContext, null);
    assert.equal(sandbox.livePlayerSearch.value, "");
    assert.equal(sandbox.liveMinute.value, "");
    assert.equal(sandbox.modeRendered, true);
    assert.equal(sandbox.pickerRendered, true);
    assert.equal(sandbox.livePicker.classList.contains("hidden"), false);
    assert.equal(sandbox.livePicker.attributes["aria-hidden"], "false");
    assert.equal(sandbox.document.body.classList.contains("live-picker-open"), true);
    assert.equal(sandbox.feedback.type, "ok");
    assert.equal(sandbox.liveSaveActionBtn.focused, true);
    results.push("tabs y retorno plantel/incidencias funcionan por estado: ok");
  }

  {
    const js = fs.readFileSync(path.join(ROOT, "js", "admin-panel.js"), "utf8");
    const sandbox = {
      eventFields: {
        id: { value: "" },
        type: { value: "gol" },
        team: { value: "1" },
        period: { value: "" },
        minute: { value: "12" },
        player: { value: "154" },
        relatedPlayer: { value: "" },
        notes: { value: "" }
      },
      eventMatch: { value: "10" },
      incidencias: [],
      requerirTorneoTrabajoId: () => 2,
      valorTexto(input) {
        const value = input.value.trim();
        return value === "" ? null : value;
      },
      valorNumero(input) {
        const value = input.value.trim();
        return value === "" ? null : Number(value);
      },
      String,
      Number,
      Boolean
    };

    vm.createContext(sandbox);
    vm.runInContext(
      [
        extractFunction(js, "incidenciaOriginalFormulario"),
        extractFunction(js, "textoIncidenciaExistente"),
        extractFunction(js, "incidenciaFormularioConInscripcionSeleccionada"),
        extractFunction(js, "verificacionFormularioIncidencia"),
        extractFunction(js, "valoresFormularioIncidencia")
      ].join("\n"),
      sandbox
    );

    const nueva = sandbox.valoresFormularioIncidencia();
    assert.equal(nueva.estado_dato, "confirmado");
    assert.equal(nueva.fuente, null);
    assert.equal(nueva.inscripcion_jugador_id, "154");

    sandbox.eventFields.id.value = "6";
    sandbox.incidencias = [{
      id: 6,
      jugador: "Joaquin Carrizo",
      inscripcion_jugador_id: 154,
      estado_dato: "confirmado",
      fuente: "Acta oficial Liga"
    }];
    const editadaConFuente = sandbox.valoresFormularioIncidencia();
    assert.equal(editadaConFuente.estado_dato, "confirmado");
    assert.equal(editadaConFuente.fuente, "Acta oficial Liga");

    sandbox.eventFields.id.value = "5";
    sandbox.eventFields.player.value = "";
    sandbox.incidencias = [{
      id: 5,
      jugador: "Historico Sin ID",
      inscripcion_jugador_id: null,
      estado_dato: "por_verificar",
      fuente: null
    }];
    const historicaSinVinculo = sandbox.valoresFormularioIncidencia();
    assert.equal(historicaSinVinculo.estado_dato, "por_verificar");
    assert.equal(historicaSinVinculo.fuente, null);
    assert.equal(historicaSinVinculo.inscripcion_jugador_id, null);

    sandbox.eventFields.id.value = "";
    sandbox.eventFields.type.value = "cambio";
    sandbox.eventFields.player.value = "154";
    sandbox.eventFields.relatedPlayer.value = "155";
    const cambio = sandbox.valoresFormularioIncidencia();
    assert.equal(cambio.estado_dato, "confirmado");
    assert.equal(cambio.fuente, null);
    assert.equal(cambio.inscripcion_relacionada_id, "155");
    results.push("formulario de incidencias confirma vinculos y preserva fuentes: ok");
  }

  {
    const js = fs.readFileSync(path.join(ROOT, "js", "admin-panel.js"), "utf8");
    const sandbox = {
      liveAction: {
        partidoId: 10,
        tipo: "gol",
        equipoId: 1
      },
      liveBusy: false,
      seleccionJugadorListaModo: () => true,
      requerirTorneoTrabajoId: () => 2,
      partidos: [{ id: 10, torneo_id: 2 }],
      partidoPerteneceTorneoTrabajo: () => true,
      inscripcionesModoEquipo: () => [{ id: 154 }, { id: 155 }],
      liveChangeOutId: null,
      liveSelectedPlayerId: 154,
      livePeriod: { value: "" },
      liveMinute: { value: "33" },
      valorNumero(input) {
        const value = input.value.trim();
        return value === "" ? null : Number(value);
      },
      apiCalls: [],
      async apiRequest(method, body, url) {
        sandbox.apiCalls.push({ method, body, url });
        return {};
      },
      EVENTS_API_URL: "/.netlify/functions/admin-incidencias",
      cerrarSelectorModo() {},
      async cargarPartidos() {},
      liveMatch: { value: "" },
      eventMatch: { value: "" },
      async cargarIncidenciasAdmin() {},
      setLiveFeedback() {},
      setStatus() {},
      setLiveBusy(value) {
        sandbox.liveBusy = value;
      },
      String,
      Number,
      Set
    };

    vm.createContext(sandbox);
    vm.runInContext(extractFunction(js, "guardarSeleccionModo"), sandbox);

    await sandbox.guardarSeleccionModo();
    assert.equal(sandbox.apiCalls[0].method, "POST");
    assert.equal(sandbox.apiCalls[0].body.estado_dato, "confirmado");
    assert.equal(sandbox.apiCalls[0].body.fuente, null);
    assert.equal(sandbox.apiCalls[0].body.inscripcion_jugador_id, 154);

    sandbox.apiCalls = [];
    sandbox.liveAction = {
      partidoId: 10,
      tipo: "cambio",
      equipoId: 1
    };
    sandbox.liveChangeOutId = 154;
    sandbox.liveSelectedPlayerId = 155;
    await sandbox.guardarSeleccionModo();
    assert.equal(sandbox.apiCalls[0].body.estado_dato, "confirmado");
    assert.equal(sandbox.apiCalls[0].body.fuente, null);
    assert.equal(sandbox.apiCalls[0].body.inscripcion_jugador_id, 154);
    assert.equal(sandbox.apiCalls[0].body.inscripcion_relacionada_id, 155);
    results.push("modo partido guarda incidencias vinculadas como confirmadas: ok");
  }

  {
    const js = fs.readFileSync(path.join(ROOT, "js", "admin-panel.js"), "utf8");
    const sandbox = {
      contextoJugadorEvento: () => ({
        torneoId: 2,
        partido: { id: 10 },
        equipoId: 1
      }),
      busyStates: [],
      setBusquedaJugadorBusy(value) {
        sandbox.busyStates.push(value);
      },
      eventFields: {
        missingResults: {
          insertAdjacentHTML() {}
        },
        createConfirm: { checked: true }
      },
      apiCalls: [],
      async apiRequest(method, body, url) {
        sandbox.apiCalls.push({ method, body, url });
        return {
          existente: false,
          inscripcion: { id: 400 }
        };
      },
      EVENTS_API_URL: "/.netlify/functions/admin-incidencias",
      async cargarPlantelesAdmin() {},
      async usarInscripcionJugadorEvento() {},
      busquedaJugadorEvento: {
        nombre: "Nuevo Jugador",
        candidatos: []
      },
      Array,
      Number,
      Boolean
    };

    vm.createContext(sandbox);
    vm.runInContext(
      [
        extractFunction(js, "crearInscripcionParaCandidato"),
        extractFunction(js, "crearJugadorDesdeBusqueda")
      ].join("\n"),
      sandbox
    );

    await sandbox.crearInscripcionParaCandidato(77);
    assert.equal(sandbox.apiCalls[0].body.torneo_id, 2);
    assert.equal(sandbox.apiCalls[0].body.partido_id, 10);
    assert.equal(sandbox.apiCalls[0].body.equipo_id, 1);
    assert.equal(sandbox.apiCalls[0].body.jugador_id, 77);
    assert.equal(sandbox.apiCalls[0].body.fuente, null);

    await sandbox.crearJugadorDesdeBusqueda();
    assert.equal(sandbox.apiCalls[1].body.torneo_id, 2);
    assert.equal(sandbox.apiCalls[1].body.partido_id, 10);
    assert.equal(sandbox.apiCalls[1].body.equipo_id, 1);
    assert.equal(sandbox.apiCalls[1].body.nombre_completo, "Nuevo Jugador");
    assert.equal(sandbox.apiCalls[1].body.fuente, null);
    results.push("alta desde incidencia usa contexto y no exige fuente: ok");
  }

  {
    const css = fs.readFileSync(path.join(ROOT, "styles", "admin.css"), "utf8");
    assert.equal(css.includes("overflow-x: hidden;"), true);
    assert.match(css, /\.status\s*\{[\s\S]*?position:\s*static;/);
    assert.equal(css.includes("overflow-wrap: anywhere;"), true);
    assert.match(css, /\.featured-admin-box\s*\{/);
    assert.match(css, /\.featured-toggle input\s*\{[\s\S]*?accent-color:\s*var\(--red\)/);
    assert.match(css, /\.admin-navigation\s*\{[\s\S]*?order:\s*20;[\s\S]*?display:\s*flex;/);
    assert.match(css, /\.admin-view-tabs\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(118px, 1fr\)\);/);
    assert.match(css, /\.admin-view-tab\.on\s*\{[\s\S]*?box-shadow:\s*inset 0 -2px 0 var\(--red\);/);
    assert.match(css, /\.admin-view-panel\s*\{[\s\S]*?display:\s*grid;[\s\S]*?gap:\s*14px;/);
    assert.match(css, /\.toolbar\s*\{[\s\S]*?grid-template-columns:\s*130px 105px 105px 145px minmax\(180px, 1fr\);/);
    assert.match(css, /\.match-workflow\s*\{[\s\S]*?order:\s*40;/);
    assert.match(css, /\.events-panel\s*\{[\s\S]*?order:\s*60;/);
    assert.match(css, /\.roster-panel\s*\{[\s\S]*?order:\s*40;/);
    assert.match(css, /\.stage-panel\s*\{[\s\S]*?order:\s*90;/);
    assert.match(
      css,
      /\.admin-app:not\(\.has-match-selection\)\s+\.match-dependent-detail\s*\{[\s\S]*?display:\s*none;/
    );
    assert.match(
      css,
      /\.admin-app\.has-match-selection\s+\.match-required-message\s*\{[\s\S]*?display:\s*none;/
    );
    assert.match(css, /\.event-player-picker\s*\{/);
    assert.match(css, /\.event-missing-flow\s*\{/);
    assert.match(css, /\.player-search-results\s*\{[\s\S]*?max-height:/);
    assert.match(css, /\.player-candidate\s*\{[\s\S]*?min-height:\s*52px;/);
    assert.match(css, /\.optional-details\s*\{/);
    assert.match(css, /\.live-team-options\s*\{/);
    assert.match(css, /\.live-action-grid\s*\{/);
    assert.match(css, /\.live-team-option\.selected\s*\{/);
    assert.match(css, /\.live-player\.selected\s*\{/);
    assert.match(css, /\.live-picker-empty\s*\{/);
    assert.match(css, /\.live-picker-empty-actions\s*\{/);
    assert.match(css, /\.live-picker-actions\s*\{/);
    assert.doesNotMatch(css, /live-action-columns|live-actions-side/);
    assert.match(css, /\.event-candidate-actions button,[\s\S]*?width:\s*100%;/);
    assert.match(css, /@media \(max-width: 820px\) \{[\s\S]*?\.admin-navigation\s*\{[\s\S]*?flex-direction:\s*column;/);
    results.push("CSS movil sin overflow, superposicion ni bloques altos vacios: ok");
  }

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
