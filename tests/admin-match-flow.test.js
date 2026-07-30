"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
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

function runTests() {
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
    assert.ok(indexOfId("matchList") < indexOfId("selectedMatchSummary"));
    assert.ok(indexOfId("selectedMatchSummary") < indexOfId("matchForm"));
    assert.ok(indexOfId("matchForm") < indexOfId("liveMatch"));
    assert.ok(indexOfId("liveLocalName") < indexOfId("liveTeamPickerTitle"));
    assert.match(html, /id="liveTeamPickerTitle"[\s\S]*?¿PARA QUÉ EQUIPO\?/);
    assert.match(html, /id="liveTeamLocalBtn"[\s\S]*?LOCAL/);
    assert.match(html, /id="liveTeamAwayBtn"[\s\S]*?VISITANTE/);
    assert.match(html, /id="liveSelectedTeamState"[\s\S]*?aria-live="polite"/);
    assert.match(html, /id="liveActionGrid"/);
    assert.match(html, /id="livePlayerSearch"/);
    assert.match(html, /id="livePlayerState"[\s\S]*?aria-live="polite"/);
    assert.match(html, /id="liveSaveActionBtn" disabled/);
    assert.doesNotMatch(html, /live-action-columns|liveLocalActions|liveAwayActions/);
    assert.ok(indexOfId("matchForm") < indexOfId("eventMatch"));
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
    assert.doesNotMatch(html, /eventCreateLegacy/);
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
    assert.match(js, /function guardarSeleccionModo\(\)/);
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
    const css = fs.readFileSync(path.join(ROOT, "styles", "admin.css"), "utf8");
    assert.equal(css.includes("overflow-x: hidden;"), true);
    assert.match(css, /\.status\s*\{[\s\S]*?position:\s*static;/);
    assert.equal(css.includes("overflow-wrap: anywhere;"), true);
    assert.match(css, /\.match-workflow\s*\{[\s\S]*?order:\s*40;/);
    assert.match(css, /\.events-panel\s*\{[\s\S]*?order:\s*60;/);
    assert.match(css, /\.roster-panel\s*\{[\s\S]*?order:\s*70;/);
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
    assert.match(css, /\.live-picker-actions\s*\{/);
    assert.doesNotMatch(css, /live-action-columns|live-actions-side/);
    assert.match(css, /\.event-candidate-actions button,[\s\S]*?width:\s*100%;/);
    results.push("CSS movil sin overflow, superposicion ni bloques altos vacios: ok");
  }

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
