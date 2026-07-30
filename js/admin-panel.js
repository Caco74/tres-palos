const API_URL = "/.netlify/functions/admin-partidos";
const ANALYTICS_API_URL = "/.netlify/functions/admin-analytics";
const STAGES_API_URL = "/.netlify/functions/admin-etapas";
const CLUBS_API_URL = "/.netlify/functions/admin-clubes";
const ROSTERS_API_URL = "/.netlify/functions/admin-planteles";
const EVENTS_API_URL = "/.netlify/functions/admin-incidencias";
const EVENT_PLAYER_LIMIT = 8;
const PASSWORD_KEY = "tp_admin_password";
const WORK_TOURNAMENT_KEY = "tp_admin_work_tournament_id";
const PLAYOFF_STAGES = [
  { value: "octavos", label: "Octavos de Final" },
  { value: "cuartos", label: "Cuartos de Final" },
  { value: "semifinal", label: "Semifinales" },
  { value: "final", label: "Final" }
];
const AdminMatchFlow = window.TPAdminFlow;

const authCard = document.getElementById("authCard");
const authForm = document.getElementById("authForm");
const adminPassword = document.getElementById("adminPassword");
const adminApp = document.getElementById("adminApp");
const statusBox = document.getElementById("statusBox");
const workTournamentSelect = document.getElementById("workTournamentSelect");
const workTournamentState = document.getElementById("workTournamentState");
const workTournamentFeedback = document.getElementById(
  "workTournamentFeedback"
);
const matchList = document.getElementById("matchList");
const matchForm = document.getElementById("matchForm");
const emptyEditor = document.getElementById("emptyEditor");
const selectedMatchSummary = document.getElementById("selectedMatchSummary");
const selectedMatchState = document.getElementById("selectedMatchState");
const matchEditorPanel = document.getElementById("matchEditorPanel");
const typeFilter = document.getElementById("typeFilter");
const dateFilter = document.getElementById("dateFilter");
const zoneFilter = document.getElementById("zoneFilter");
const statusFilter = document.getElementById("statusFilter");
const searchInput = document.getElementById("searchInput");
const matchListSummary = document.getElementById("matchListSummary");
const refreshBtn = document.getElementById("refreshBtn");
const logoutBtn = document.getElementById("logoutBtn");
const clearScoreBtn = document.getElementById("clearScoreBtn");
const saveBtn = document.getElementById("saveBtn");
const saveFeedback = document.getElementById("saveFeedback");
const analyticsTotal = document.getElementById("analyticsTotal");
const tabViewsTotal = document.getElementById("tabViewsTotal");
const matchViewsTotal = document.getElementById("matchViewsTotal");
const tabAnalytics = document.getElementById("tabAnalytics");
const matchAnalytics = document.getElementById("matchAnalytics");
const stageAdminSelect = document.getElementById("stageAdminSelect");
const stageNote = document.getElementById("stageNote");
const stageState = document.getElementById("stageState");
const stageMatchesTotal = document.getElementById("stageMatchesTotal");
const stageMatchesReady = document.getElementById("stageMatchesReady");
const stageMatchesPending = document.getElementById("stageMatchesPending");
const stageValidation = document.getElementById("stageValidation");
const stageFeedback = document.getElementById("stageFeedback");
const closeStageBtn = document.getElementById("closeStageBtn");
const reopenStageBtn = document.getElementById("reopenStageBtn");
const backupCount = document.getElementById("backupCount");
const backupList = document.getElementById("backupList");
const clubsTotal = document.getElementById("clubsTotal");
const clubList = document.getElementById("clubList");
const clubForm = document.getElementById("clubForm");
const emptyClubEditor = document.getElementById("emptyClubEditor");
const saveClubBtn = document.getElementById("saveClubBtn");
const clubFeedback = document.getElementById("clubFeedback");
const rosterTotal = document.getElementById("rosterTotal");
const rosterTournament = document.getElementById("rosterTournament");
const rosterClub = document.getElementById("rosterClub");
const newRosterBtn = document.getElementById("newRosterBtn");
const rosterList = document.getElementById("rosterList");
const rosterForm = document.getElementById("rosterForm");
const emptyRosterEditor = document.getElementById("emptyRosterEditor");
const saveRosterBtn = document.getElementById("saveRosterBtn");
const toggleRosterBtn = document.getElementById("toggleRosterBtn");
const rosterFeedback = document.getElementById("rosterFeedback");
const eventsTotal = document.getElementById("eventsTotal");
const eventMatch = document.getElementById("eventMatch");
const newEventBtn = document.getElementById("newEventBtn");
const eventList = document.getElementById("eventList");
const eventForm = document.getElementById("eventForm");
const emptyEventEditor = document.getElementById("emptyEventEditor");
const saveEventBtn = document.getElementById("saveEventBtn");
const deleteEventBtn = document.getElementById("deleteEventBtn");
const eventFeedback = document.getElementById("eventFeedback");
const liveModeState = document.getElementById("liveModeState");
const liveMatch = document.getElementById("liveMatch");
const liveLocalName = document.getElementById("liveLocalName");
const liveScore = document.getElementById("liveScore");
const liveAwayName = document.getElementById("liveAwayName");
const liveGoalProgress = document.getElementById("liveGoalProgress");
const liveConsistencyState = document.getElementById(
  "liveConsistencyState"
);
const liveConsistencyList = document.getElementById(
  "liveConsistencyList"
);
const liveLocalActions = document.getElementById("liveLocalActions");
const liveAwayActions = document.getElementById("liveAwayActions");
const liveEventCount = document.getElementById("liveEventCount");
const liveTimeline = document.getElementById("liveTimeline");
const liveUndoBtn = document.getElementById("liveUndoBtn");
const liveFinishBtn = document.getElementById("liveFinishBtn");
const liveFeedback = document.getElementById("liveFeedback");
const livePicker = document.getElementById("livePicker");
const livePickerEyebrow = document.getElementById("livePickerEyebrow");
const livePickerTitle = document.getElementById("livePickerTitle");
const livePickerHelp = document.getElementById("livePickerHelp");
const livePeriod = document.getElementById("livePeriod");
const liveMinute = document.getElementById("liveMinute");
const livePlayerGrid = document.getElementById("livePlayerGrid");

const fields = {
  id: document.getElementById("partidoId"),
  local: document.getElementById("localInput"),
  visitante: document.getElementById("visitanteInput"),
  fecha: document.getElementById("fechaInput"),
  hora: document.getElementById("horaInput"),
  estado: document.getElementById("estadoInput"),
  estadio: document.getElementById("estadioInput"),
  arbitro: document.getElementById("arbitroInput"),
  golesLocal: document.getElementById("golesLocalInput"),
  golesVisitante: document.getElementById("golesVisitanteInput"),
  penalesLocal: document.getElementById("penalesLocalInput"),
  penalesVisitante: document.getElementById("penalesVisitanteInput"),
  sourceInfo: document.getElementById("sourceInfo")
};

const clubFields = {
  id: document.getElementById("clubId"),
  officialName: document.getElementById("clubOfficialName"),
  shortName: document.getElementById("clubShortName"),
  nickname: document.getElementById("clubNickname"),
  city: document.getElementById("clubCity"),
  province: document.getElementById("clubProvince"),
  stadium: document.getElementById("clubStadium"),
  zone: document.getElementById("clubZone"),
  shield: document.getElementById("clubShield"),
  primaryColor: document.getElementById("clubPrimaryColor"),
  secondaryColor: document.getElementById("clubSecondaryColor"),
  aliases: document.getElementById("clubAliases"),
  active: document.getElementById("clubActive")
};

const rosterFields = {
  enrollmentId: document.getElementById("rosterEnrollmentId"),
  playerId: document.getElementById("rosterPlayerId"),
  searchPanel: document.getElementById("rosterSearchPanel"),
  search: document.getElementById("rosterPlayerSearch"),
  searchState: document.getElementById("rosterSearchState"),
  searchResults: document.getElementById("rosterSearchResults"),
  createNew: document.getElementById("rosterCreateNewBtn"),
  selectedPlayer: document.getElementById("rosterSelectedPlayer"),
  createBlock: document.getElementById("rosterCreatePlayerBlock"),
  playerName: document.getElementById("rosterPlayerName"),
  editName: document.getElementById("rosterPlayerNameEdit"),
  createSummary: document.getElementById("rosterCreateSummary"),
  createConfirm: document.getElementById("rosterCreateConfirm"),
  createPlayer: document.getElementById("rosterCreatePlayerBtn"),
  detailsBlock: document.getElementById("rosterDetailsBlock"),
  extraData: document.getElementById("rosterExtraData"),
  aliases: document.getElementById("rosterAliases"),
  position: document.getElementById("rosterPosition"),
  shirt: document.getElementById("rosterShirt"),
  status: document.getElementById("rosterStatus"),
  from: document.getElementById("rosterFrom"),
  to: document.getElementById("rosterTo"),
  source: document.getElementById("rosterSource"),
  notes: document.getElementById("rosterNotes")
};

const eventFields = {
  id: document.getElementById("eventId"),
  type: document.getElementById("eventType"),
  team: document.getElementById("eventTeam"),
  period: document.getElementById("eventPeriod"),
  minute: document.getElementById("eventMinute"),
  player: document.getElementById("eventPlayer"),
  playerResults: document.getElementById("eventPlayerResults"),
  playerSearch: document.getElementById("eventPlayerSearch"),
  playerState: document.getElementById("eventPlayerState"),
  playerLabel: document.getElementById("eventPlayerLabel"),
  playerMissing: document.getElementById("eventPlayerMissingBtn"),
  relatedWrap: document.getElementById("eventRelatedWrap"),
  relatedPlayer: document.getElementById("eventRelatedPlayer"),
  relatedResults: document.getElementById("eventRelatedPlayerResults"),
  legacyBlock: document.getElementById("eventLegacyBlock"),
  legacyName: document.getElementById("eventLegacyName"),
  linkLegacy: document.getElementById("eventLinkLegacyBtn"),
  missingFlow: document.getElementById("eventMissingFlow"),
  missingName: document.getElementById("eventMissingName"),
  missingSearch: document.getElementById("eventMissingSearchBtn"),
  missingResults: document.getElementById("eventMissingResults"),
  missingClose: document.getElementById("eventMissingCloseBtn"),
  createPlayerBlock: document.getElementById("eventCreatePlayerBlock"),
  createSummary: document.getElementById("eventCreateSummary"),
  createConfirm: document.getElementById("eventCreateConfirm"),
  createPlayer: document.getElementById("eventCreatePlayerBtn"),
  dataStatus: document.getElementById("eventDataStatus"),
  source: document.getElementById("eventSource"),
  notes: document.getElementById("eventNotes")
};

let partidos = [];
let clubes = [];
let torneos = [];
let torneosTrabajo = [];
let jugadores = [];
let inscripcionesJugadores = [];
let inscripcionesIncidencia = [];
let incidencias = [];
let torneoTrabajoId = null;
let torneoTrabajoCargando = false;
let seleccionadoId = null;
let partidoOriginal = null;
let clubSeleccionadoId = null;
let clubOriginal = null;
let inscripcionSeleccionadaId = null;
let incidenciaSeleccionadaId = null;
let etapasEstado = [];
let respaldosEtapa = [];
let etapasDisponibles = [];
let etapasHabilitadas = false;
let etapaProcesando = false;
let liveAction = null;
let liveChangeOutId = null;
let liveBusy = false;
let eventReordering = false;
let recargaDatosEnCurso = false;
let cargaJugadoresIncidenciaId = 0;
let busquedaJugadorEvento = null;
let busquedaPlantelId = 0;
let busquedaPlantelTimer = null;
let busquedaPlantel = null;
let jugadorPlantelSeleccionado = null;

function getPassword() {
  return sessionStorage.getItem(PASSWORD_KEY) || "";
}

function setStatus(message, type = "info") {
  statusBox.textContent = message;
  statusBox.dataset.type = type;
}

function setSaveFeedback(message, type = "info") {
  saveFeedback.textContent = message;
  saveFeedback.dataset.type = type;
}

function setSaving(isSaving) {
  saveBtn.disabled =
    isSaving ||
    !torneoTrabajoValido() ||
    !partidoPerteneceTorneoTrabajo(partidoOriginal) ||
    partidoSeleccionadoCerrado();
  saveBtn.textContent = isSaving ? "Guardando..." : "Guardar cambios";
}

function setClubSaving(isSaving) {
  saveClubBtn.disabled = isSaving;
  saveClubBtn.textContent = isSaving
    ? "Guardando..."
    : "Guardar club";
}

function setClubFeedback(message, type = "info") {
  clubFeedback.textContent = message;
  clubFeedback.dataset.type = type;
}

function setRosterSaving(isSaving) {
  const editandoInscripcion =
    Boolean(rosterFields.enrollmentId.value) &&
    !rosterFields.detailsBlock.classList.contains("hidden");
  saveRosterBtn.disabled = isSaving || !editandoInscripcion;
  toggleRosterBtn.disabled = isSaving || !editandoInscripcion;
  rosterFields.createNew.disabled = isSaving;
  rosterFields.createPlayer.disabled =
    isSaving ||
    !busquedaPlantel ||
    !rosterFields.createConfirm.checked ||
    !valorTexto(rosterFields.playerName);
  saveRosterBtn.textContent = isSaving
    ? "Guardando..."
    : "Guardar inscripción";
}

function setRosterFeedback(message, type = "info") {
  rosterFeedback.textContent = message;
  rosterFeedback.dataset.type = type;
}

function setEventSaving(isSaving) {
  const partido = partidoIncidenciasSeleccionado();
  const etapa = obtenerEtapaPartidoAdmin(partido);
  const etapaCerrada =
    obtenerEstadoEtapa(etapa)?.estado === "cerrada";
  const bloqueado =
    !torneoTrabajoValido() ||
    !partidoPerteneceTorneoTrabajo(partido) ||
    etapaCerrada;
  saveEventBtn.disabled =
    isSaving || bloqueado || incidenciaIncompletaParaGuardar();
  deleteEventBtn.disabled = isSaving || bloqueado || !eventFields.id.value;
  saveEventBtn.textContent = isSaving
    ? "Guardando..."
    : "Guardar incidencia";
}

function setEventFeedback(message, type = "info") {
  eventFeedback.textContent = message;
  eventFeedback.dataset.type = type;
}

function incidenciaActualHistoricaSinVincular() {
  const id = eventFields.id.value;
  if (!id) return false;
  const incidencia = incidencias.find(
    item => String(item.id) === String(id)
  );
  return Boolean(
    incidencia?.jugador &&
    !incidencia.inscripcion_jugador_id &&
    !eventFields.player.value
  );
}

function incidenciaSeleccionadaEsHistoricaSinVincular() {
  const id = eventFields.id.value;
  if (!id) return false;
  const incidencia = incidencias.find(
    item => String(item.id) === String(id)
  );
  return Boolean(incidencia?.jugador && !incidencia.inscripcion_jugador_id);
}

function incidenciaIncompletaParaGuardar() {
  if (eventForm.classList.contains("hidden")) return false;
  if (!eventFields.team.value) return true;
  if (eventFields.type.value === "cambio") {
    if (
      incidenciaActualHistoricaSinVincular() &&
      !eventFields.player.value &&
      !eventFields.relatedPlayer.value
    ) {
      return false;
    }
    return !eventFields.player.value || !eventFields.relatedPlayer.value;
  }
  return !eventFields.player.value &&
    !incidenciaActualHistoricaSinVincular();
}

function setEventReordering(isReordering) {
  eventReordering = isReordering;
  renderIncidenciasAdmin();
}

function setLiveFeedback(message, type = "info") {
  liveFeedback.textContent = message;
  liveFeedback.dataset.type = type;
}

function setLiveBusy(isBusy) {
  liveBusy = isBusy;
  renderModoPartido();
}

function showApp() {
  authCard.classList.add("hidden");
  adminApp.classList.remove("hidden");
}

function showAuth() {
  adminApp.classList.add("hidden");
  authCard.classList.remove("hidden");
  adminPassword.focus();
}

function idTorneoDesdeSesion() {
  return sessionStorage.getItem(WORK_TOURNAMENT_KEY) || "";
}

function torneoTrabajoActual() {
  return torneosTrabajo.find(
    torneo => String(torneo.id) === String(torneoTrabajoId)
  ) || null;
}

function torneoTrabajoValido() {
  return Boolean(torneoTrabajoActual());
}

function etiquetaTorneoTrabajo(torneo = torneoTrabajoActual()) {
  if (!torneo) return "Sin torneo";
  return [
    torneo.nombre || `Torneo #${torneo.id}`,
    torneo.temporada || torneo.anio,
    torneo.estado || (torneo.activo ? "vigente" : "historico")
  ].filter(Boolean).join(" - ");
}

function partidoPerteneceTorneoTrabajo(partido) {
  return Boolean(
    partido &&
    torneoTrabajoValido() &&
    String(partido.torneo_id) === String(torneoTrabajoId)
  );
}

function requerirTorneoTrabajoId() {
  if (!torneoTrabajoValido()) {
    throw new Error("Selecciona un torneo de trabajo valido.");
  }
  return Number(torneoTrabajoId);
}

function setWorkTournamentFeedback(message, type = "info") {
  workTournamentFeedback.textContent = message;
  workTournamentFeedback.dataset.type = type;
}

function setWorkTournamentState(message, type = "") {
  workTournamentState.textContent = message;
  workTournamentState.dataset.state = type;
}

function renderSelectorTorneoTrabajo() {
  if (torneoTrabajoCargando && torneosTrabajo.length === 0) {
    workTournamentSelect.innerHTML =
      `<option value="">Cargando torneos...</option>`;
    workTournamentSelect.disabled = true;
    return;
  }

  if (torneosTrabajo.length === 0) {
    workTournamentSelect.innerHTML =
      `<option value="">No hay torneos disponibles</option>`;
    workTournamentSelect.disabled = true;
    setWorkTournamentState("No disponible", "error");
    setWorkTournamentFeedback(
      "No se pudieron cargar torneos desde Supabase.",
      "error"
    );
    return;
  }

  const valorActual = torneoTrabajoValido()
    ? String(torneoTrabajoId)
    : "";
  workTournamentSelect.innerHTML = `
    <option value="">Seleccionar torneo...</option>
    ${torneosTrabajo.map(torneo => `
      <option value="${torneo.id}">
        ${escapeHtml(etiquetaTorneoTrabajo(torneo))}
      </option>
    `).join("")}
  `;
  workTournamentSelect.value = valorActual;
  workTournamentSelect.disabled = torneoTrabajoCargando;
}

function actualizarBloqueoPorTorneo() {
  const bloqueado = !torneoTrabajoValido() || torneoTrabajoCargando;
  typeFilter.disabled = bloqueado;
  dateFilter.disabled = bloqueado;
  zoneFilter.disabled = bloqueado;
  statusFilter.disabled = bloqueado;
  searchInput.disabled = bloqueado;
  stageAdminSelect.disabled = bloqueado || etapasDisponibles.length === 0;
  stageNote.disabled = bloqueado || etapasDisponibles.length === 0;
  eventMatch.disabled = bloqueado || partidos.length === 0;
  liveMatch.disabled = bloqueado || partidos.length === 0 || liveBusy;

  newEventBtn.disabled =
    bloqueado || !partidoIncidenciasSeleccionado();
  clearScoreBtn.disabled =
    bloqueado || !partidoPerteneceTorneoTrabajo(partidoOriginal);
  saveBtn.disabled =
    bloqueado ||
    !partidoPerteneceTorneoTrabajo(partidoOriginal) ||
    partidoSeleccionadoCerrado();
  closeStageBtn.disabled = bloqueado || closeStageBtn.disabled;
  reopenStageBtn.disabled = bloqueado || reopenStageBtn.disabled;
  liveUndoBtn.disabled = bloqueado || liveUndoBtn.disabled;
  liveFinishBtn.disabled = bloqueado || liveFinishBtn.disabled;
  saveEventBtn.disabled = bloqueado || saveEventBtn.disabled;
  deleteEventBtn.disabled = bloqueado || deleteEventBtn.disabled;
}

function limpiarContextoTorneo(message) {
  partidos = [];
  incidencias = [];
  seleccionadoId = null;
  partidoOriginal = null;
  incidenciaSeleccionadaId = null;
  etapasEstado = [];
  respaldosEtapa = [];
  etapasDisponibles = [];
  etapasHabilitadas = false;
  etapaProcesando = false;
  eventReordering = false;
  liveAction = null;
  liveChangeOutId = null;

  cerrarSelectorModo();
  matchForm.reset();
  matchForm.classList.add("hidden");
  emptyEditor.classList.remove("hidden");
  renderResumenPartidoSeleccionado();
  eventForm.reset();
  eventForm.classList.add("hidden");
  emptyEventEditor.classList.remove("hidden");
  resetJugadoresIncidencia("Selecciona torneo, partido y equipo.");

  matchList.innerHTML = `
    <div class="empty-list">
      ${escapeHtml(message || "Selecciona un torneo para listar partidos.")}
    </div>
  `;
  matchListSummary.textContent =
    message || "Selecciona un torneo para listar partidos.";
  resetearFiltrosPartidos();
  eventsTotal.textContent = "0 incidencias";
  eventMatch.innerHTML = `<option value="">Selecciona un torneo</option>`;
  liveMatch.innerHTML = `<option value="">Selecciona un torneo</option>`;
  eventList.innerHTML = `
    <div class="analytics-empty">
      ${escapeHtml(message || "Selecciona un torneo para listar incidencias.")}
    </div>
  `;
  newEventBtn.disabled = true;

  stageAdminSelect.innerHTML =
    `<option value="">Selecciona un torneo</option>`;
  stageAdminSelect.disabled = true;
  stageState.textContent = "Sin torneo";
  stageState.dataset.state = "";
  stageMatchesTotal.textContent = "0";
  stageMatchesReady.textContent = "0";
  stageMatchesPending.textContent = "0";
  stageValidation.textContent =
    message || "Selecciona un torneo para controlar etapas.";
  stageValidation.dataset.type = "warn";
  closeStageBtn.disabled = true;
  reopenStageBtn.disabled = true;
  backupCount.textContent = "0 copias";
  backupList.innerHTML = `
    <div class="analytics-empty">
      ${escapeHtml(message || "Selecciona un torneo para ver respaldos.")}
    </div>
  `;

  liveLocalName.textContent = "Por definir";
  liveAwayName.textContent = "Por definir";
  liveScore.textContent = "- - -";
  liveGoalProgress.textContent =
    "Selecciona un torneo y un partido para identificar goles.";
  liveGoalProgress.className = "live-goal-progress pending";
  liveConsistencyState.textContent = "Sin revisar";
  liveConsistencyState.dataset.state = "";
  liveConsistencyList.className = "";
  liveConsistencyList.textContent =
    "Selecciona un torneo y un partido para revisar sus incidencias.";
  liveLocalActions.innerHTML = "";
  liveAwayActions.innerHTML = "";
  liveEventCount.textContent = "0 incidencias";
  liveTimeline.textContent = "Selecciona un torneo para comenzar.";
  liveUndoBtn.disabled = true;
  liveFinishBtn.disabled = true;

  setSaveFeedback("Selecciona un torneo para habilitar la edicion.", "warn");
  setEventFeedback("Selecciona un torneo para habilitar incidencias.", "warn");
  actualizarBloqueoPorTorneo();
}

function mostrarEstadoSinTorneo(message) {
  torneoTrabajoId = null;
  sessionStorage.removeItem(WORK_TOURNAMENT_KEY);
  renderSelectorTorneoTrabajo();
  setWorkTournamentState("Sin seleccionar", "");
  setWorkTournamentFeedback(
    message || "Selecciona un torneo para habilitar partidos e incidencias.",
    "warn"
  );
  limpiarContextoTorneo(message);
}

function resetearFiltrosPartidos() {
  typeFilter.value = "regular";
  dateFilter.innerHTML = `<option value="">Todas</option>`;
  zoneFilter.innerHTML = `<option value="">Todas</option>`;
  statusFilter.innerHTML = `<option value="">Todos</option>`;
  dateFilter.value = "";
  zoneFilter.value = "";
  statusFilter.value = "";
  searchInput.value = "";
}

function renderResumenPartidoSeleccionado(partido = null) {
  const seleccionado = partido || partidos.find(
    item => String(item.id) === String(seleccionadoId)
  );
  const valido =
    Boolean(seleccionado) && partidoPerteneceTorneoTrabajo(seleccionado);

  adminApp.classList.toggle("has-match-selection", valido);

  if (!valido) {
    selectedMatchState.textContent = "Sin seleccionar";
    selectedMatchState.dataset.state = "";
    selectedMatchSummary.innerHTML =
      `<div class="selected-match-empty">Elegí un partido para continuar.</div>`;
    return;
  }

  const visible = resolverPartidoPlayoffAdmin(seleccionado);
  const titulo = seleccionado.tipo === "playoff"
    ? etiquetaPartidoPlayoffAdmin(seleccionado)
    : etiquetaFechaZonaPartido(seleccionado);
  const estado = etiquetaEstadoAdmin(seleccionado.estado || "programado");

  selectedMatchState.textContent = "Seleccionado";
  selectedMatchState.dataset.state = "selected";
  selectedMatchSummary.innerHTML = `
    <div class="selected-match-kicker">
      ${escapeHtml(etiquetaTorneoTrabajo())}
    </div>
    <div class="selected-match-grid">
      <span>${escapeHtml(titulo)}</span>
      <strong>${escapeHtml(nombrePartido(visible))}</strong>
      <small>${escapeHtml(estado)} · ID #${escapeHtml(seleccionado.id)}</small>
    </div>
  `;
}

function desplazarAEditorSiNecesario() {
  if (!matchEditorPanel || typeof matchEditorPanel.scrollIntoView !== "function") {
    return;
  }
  if (window.matchMedia("(min-width: 761px)").matches) return;

  window.requestAnimationFrame(() => {
    const rect = matchEditorPanel.getBoundingClientRect();
    if (rect.top > window.innerHeight * 0.65 || rect.top < 0) {
      matchEditorPanel.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }
  });
}

function opcionesSelect(values, etiquetaTodos, formatter) {
  return [
    `<option value="">${escapeHtml(etiquetaTodos)}</option>`,
    ...values.map(value =>
      `<option value="${escapeHtml(String(value))}">${
        escapeHtml(formatter ? formatter(value) : String(value))
      }</option>`
    )
  ].join("");
}

function filtrosPartidosActuales() {
  return {
    torneoId: torneoTrabajoId,
    tipo: typeFilter.value || "all",
    fecha: dateFilter.value,
    zona: zoneFilter.value,
    estado: statusFilter.value,
    equipo: searchInput.value
  };
}

function capturarEstadoRecarga() {
  return {
    torneoId: torneoTrabajoId,
    tipo: typeFilter.value || "regular",
    fecha: dateFilter.value,
    zona: zoneFilter.value,
    estado: statusFilter.value,
    equipo: searchInput.value,
    seleccionadoId: seleccionadoId ? String(seleccionadoId) : "",
    scrollX: window.scrollX || 0,
    scrollY: window.scrollY || 0
  };
}

function capturarDatosRecarga() {
  return {
    partidos: [...partidos],
    incidencias: [...incidencias],
    etapasEstado: [...etapasEstado],
    respaldosEtapa: [...respaldosEtapa],
    etapasDisponibles: [...etapasDisponibles],
    etapasHabilitadas
  };
}

function partidoSeleccionadoCompatibleConFiltros(id) {
  return AdminMatchFlow.selectedMatchIsCompatible(
    partidos,
    filtrosPartidosActuales(),
    id,
    resolverPartidoPlayoffAdmin,
    partido => partido.tipo === "playoff"
      ? etiquetaPartidoPlayoffAdmin(partido)
      : etiquetaFechaZonaPartido(partido)
  );
}

function restaurarDatosRecarga(datos, estado) {
  partidos = [...datos.partidos];
  incidencias = [...datos.incidencias];
  etapasEstado = [...datos.etapasEstado];
  respaldosEtapa = [...datos.respaldosEtapa];
  etapasDisponibles = [...datos.etapasDisponibles];
  etapasHabilitadas = datos.etapasHabilitadas;
  seleccionadoId = estado.seleccionadoId || null;

  restaurarFiltrosPartidos(estado);
  renderLista();
  if (etapasHabilitadas) renderControlEtapas();
  renderOpcionesPartidosIncidencias(
    estado.seleccionadoId,
    estado.seleccionadoId
  );

  if (
    estado.seleccionadoId &&
    partidoSeleccionadoCompatibleConFiltros(estado.seleccionadoId)
  ) {
    seleccionarPartido(estado.seleccionadoId, {
      desplazarAEditor: false
    });
  } else {
    renderIncidenciasAdmin();
    renderModoPartido();
  }
}

function asignarValorSelectSiExiste(select, value, fallback = "") {
  const valor = value ? String(value) : "";
  if (valor && [...select.options].some(option => option.value === valor)) {
    select.value = valor;
    return;
  }
  select.value = fallback;
}

function restaurarFiltrosPartidos(estado) {
  if (!estado) return;

  asignarValorSelectSiExiste(typeFilter, estado.tipo || "regular", "regular");
  searchInput.value = estado.equipo || "";
  dateFilter.value = estado.fecha || "";
  zoneFilter.value = estado.zona || "";
  statusFilter.value = estado.estado || "";
  renderFiltrosPartidos({ preferirFechaPendiente: false });
  asignarValorSelectSiExiste(dateFilter, estado.fecha);
  asignarValorSelectSiExiste(zoneFilter, estado.zona);
  asignarValorSelectSiExiste(statusFilter, estado.estado);
  searchInput.value = estado.equipo || "";
}

function restaurarPosicionPanel(estado) {
  if (!estado) return;
  window.requestAnimationFrame(() => {
    const maxScroll = Math.max(
      0,
      document.documentElement.scrollHeight - window.innerHeight
    );
    window.scrollTo({
      left: estado.scrollX || 0,
      top: Math.min(estado.scrollY || 0, maxScroll),
      behavior: "auto"
    });
  });
}

function renderFiltrosPartidos(options = {}) {
  const filtros = filtrosPartidosActuales();
  const filtroOpciones = AdminMatchFlow.getFilterOptions(partidos, filtros);
  const fechaAnterior = dateFilter.value;
  const zonaAnterior = zoneFilter.value;
  const estadoAnterior = statusFilter.value;

  dateFilter.innerHTML = opcionesSelect(
    filtroOpciones.fechas,
    "Todas",
    fecha => `Fecha ${fecha}`
  );
  if (
    options.preferirFechaPendiente &&
    !fechaAnterior &&
    filtros.tipo !== "playoff"
  ) {
    dateFilter.value = AdminMatchFlow.getSuggestedPendingDate(
      partidos,
      torneoTrabajoId
    );
  } else if (filtroOpciones.fechas.map(String).includes(fechaAnterior)) {
    dateFilter.value = fechaAnterior;
  }

  const filtrosConFecha = filtrosPartidosActuales();
  const opcionesConFecha = AdminMatchFlow.getFilterOptions(
    partidos,
    filtrosConFecha
  );
  zoneFilter.innerHTML = opcionesSelect(
    opcionesConFecha.zonas,
    "Todas",
    zona => `Zona ${zona}`
  );
  if (opcionesConFecha.zonas.map(String).includes(zonaAnterior)) {
    zoneFilter.value = zonaAnterior;
  }

  statusFilter.innerHTML = opcionesSelect(
    filtroOpciones.estados,
    "Todos",
    etiquetaEstadoAdmin
  );
  if (filtroOpciones.estados.map(String).includes(estadoAnterior)) {
    statusFilter.value = estadoAnterior;
  }
}

function partidosVisiblesSelector() {
  return AdminMatchFlow.filterMatches(
    partidos,
    filtrosPartidosActuales(),
    resolverPartidoPlayoffAdmin,
    partido => partido.tipo === "playoff"
      ? etiquetaPartidoPlayoffAdmin(partido)
      : etiquetaFechaZonaPartido(partido)
  );
}

function limpiarSeleccionPartido(message) {
  seleccionadoId = null;
  partidoOriginal = null;
  incidenciaSeleccionadaId = null;
  matchForm.reset();
  matchForm.classList.add("hidden");
  emptyEditor.classList.remove("hidden");
  renderResumenPartidoSeleccionado();
  eventForm.reset();
  eventForm.classList.add("hidden");
  emptyEventEditor.classList.remove("hidden");
  resetJugadoresIncidencia("Selecciona un partido.");
  if (eventMatch.options.length) eventMatch.value = "";
  if (liveMatch.options.length) liveMatch.value = "";
  if (message) setSaveFeedback(message, "warn");
  renderIncidenciasAdmin();
  renderModoPartido();
  actualizarBloqueoEditor();
}

function limpiarSeleccionIncompatible(visibles, message) {
  if (!seleccionadoId) return;
  const sigueVisible = visibles.some(
    partido => String(partido.id) === String(seleccionadoId)
  );
  if (!sigueVisible) {
    limpiarSeleccionPartido(
      message || "La seleccion se limpio porque ya no coincide con los filtros."
    );
  }
}

async function cargarTorneosTrabajo() {
  torneoTrabajoCargando = true;
  renderSelectorTorneoTrabajo();
  setWorkTournamentState("Cargando", "");
  setWorkTournamentFeedback("Cargando torneos desde Supabase...");

  try {
    const data = await apiRequest(
      "GET",
      null,
      `${API_URL}?scope=torneos`
    );
    torneosTrabajo = Array.isArray(data.torneos) ? data.torneos : [];
    renderSelectorTorneoTrabajo();
    return torneosTrabajo;
  } catch (error) {
    torneosTrabajo = [];
    mostrarEstadoSinTorneo(
      `No se pudieron cargar torneos: ${error.message}`
    );
    throw error;
  } finally {
    torneoTrabajoCargando = false;
    renderSelectorTorneoTrabajo();
  }
}

async function activarTorneoTrabajo(id, options = {}) {
  const torneo = torneosTrabajo.find(
    item => String(item.id) === String(id)
  );
  if (!torneo) {
    mostrarEstadoSinTorneo("El torneo seleccionado ya no existe.");
    throw new Error("Torneo de trabajo no encontrado.");
  }

  torneoTrabajoId = String(torneo.id);
  sessionStorage.setItem(WORK_TOURNAMENT_KEY, torneoTrabajoId);
  workTournamentSelect.value = torneoTrabajoId;
  setWorkTournamentState("Seleccionado", "ok");
  setWorkTournamentFeedback(
    `${etiquetaTorneoTrabajo(torneo)} queda como torneo de trabajo.`,
    "ok"
  );
  limpiarContextoTorneo(
    `Cargando datos de ${etiquetaTorneoTrabajo(torneo)}...`
  );
  setStatus(`Cargando ${etiquetaTorneoTrabajo(torneo)}...`);

  await cargarPartidos();
  await cargarEtapasAdmin().catch(error =>
    mostrarEtapasNoDisponibles(error.message)
  );
  await cargarIncidenciasAdmin().catch(error =>
    mostrarIncidenciasNoDisponibles(error.message)
  );

  if (!options.desdeSesion) {
    setStatus(`Torneo de trabajo: ${etiquetaTorneoTrabajo(torneo)}.`, "ok");
  }
}

async function apiRequest(method, body, url = API_URL) {
  const response = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-admin-password": getPassword()
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const data = await response.json().catch(() => ({}));

  if (response.status === 401) {
    sessionStorage.removeItem(PASSWORD_KEY);
    showAuth();
    throw new Error("Contraseña incorrecta o vencida.");
  }

  if (!response.ok) {
    throw new Error(data.error || "No se pudo completar la operación.");
  }

  return data;
}

async function cargarAnalitica() {
  const data = await apiRequest(
    "GET",
    null,
    ANALYTICS_API_URL
  );

  analyticsTotal.textContent =
    `${data.total_eventos || 0} eventos`;
  tabViewsTotal.textContent = data.total_pestanas || 0;
  matchViewsTotal.textContent = data.total_partidos || 0;
  tabAnalytics.innerHTML = renderConteos(
    data.pestanas,
    item => etiquetaPestana(item.objetivo)
  );
  matchAnalytics.innerHTML = renderConteos(
    data.partidos,
    item => nombrePartidoAnalitica(item.partido_id)
  );
}

function renderConteos(items, getLabel) {
  if (!Array.isArray(items) || items.length === 0) {
    return `<div class="analytics-empty">Todavía no hay consultas.</div>`;
  }

  const maximo = Math.max(...items.map(item => item.consultas));

  return items.slice(0, 8).map(item => `
    <div class="analytics-row">
      <div>
        <span>${getLabel(item)}</span>
        <strong>${item.consultas}</strong>
      </div>
      <i style="width:${Math.max(6, item.consultas / maximo * 100)}%"></i>
    </div>
  `).join("");
}

function etiquetaPestana(pestana) {
  return {
    inicio: "Inicio",
    partidos: "Partidos",
    tabla: "Tabla",
    playoffs: "Playoffs",
    goleadores: "Goleadores",
    equipos: "Equipos"
  }[pestana] || pestana;
}

function nombrePartidoAnalitica(partidoId) {
  const partido = partidos.find(
    item => String(item.id) === String(partidoId)
  );

  return partido
    ? `#${partidoId} · ${nombrePartido(partido)}`
    : `Partido #${partidoId}`;
}

function mostrarAnaliticaNoDisponible(message) {
  analyticsTotal.textContent = "No disponible";
  tabAnalytics.innerHTML =
    `<div class="analytics-empty">${message}</div>`;
  matchAnalytics.innerHTML =
    `<div class="analytics-empty">${message}</div>`;
}

async function cargarEtapasAdmin() {
  const torneoId = requerirTorneoTrabajoId();

  const data = await apiRequest(
    "GET",
    null,
    `${STAGES_API_URL}?torneo_id=${encodeURIComponent(torneoId)}`
  );
  etapasEstado = Array.isArray(data.etapas) ? data.etapas : [];
  respaldosEtapa = Array.isArray(data.respaldos) ? data.respaldos : [];
  etapasHabilitadas = true;
  renderControlEtapas();
}

function mostrarEtapasNoDisponibles(message) {
  etapasHabilitadas = false;
  etapasEstado = [];
  respaldosEtapa = [];
  etapasDisponibles = [];
  stageAdminSelect.innerHTML =
    `<option>Configuración pendiente</option>`;
  stageAdminSelect.disabled = true;
  stageNote.disabled = true;
  closeStageBtn.disabled = true;
  reopenStageBtn.disabled = true;
  stageState.textContent = "No disponible";
  stageState.dataset.state = "";
  stageValidation.textContent =
    "Ejecutá supabase/cierre-etapas.sql en Supabase para habilitar este flujo.";
  stageValidation.dataset.type = "warn";
  stageFeedback.textContent = message;
  stageFeedback.dataset.type = "warn";
  backupCount.textContent = "0 copias";
  backupList.innerHTML =
    `<div class="analytics-empty">El historial se habilitará después de aplicar la migración.</div>`;
}

function obtenerEtapasDisponiblesAdmin() {
  const fechasMap = new Map();

  partidos
    .filter(partido => partido.tipo === "regular")
    .forEach(partido => {
      const torneoId = obtenerTorneoIdPartidoAdmin(partido);
      const fecha = Number(partido.fecha);
      const zona = String(partido.zona || "").trim();
      if (!torneoId || !Number.isFinite(fecha)) return;
      const usaLegacy = torneoUsaEtapasRegularesLegacy(torneoId);
      const valor = usaLegacy
        ? String(fecha)
        : AdminMatchFlow.buildRegularStageValue(fecha, zona);
      if (!valor) return;
      const key = `${torneoId}:regular:${valor}`;
      fechasMap.set(key, {
        key,
        torneoId,
        sort: fecha,
        zoneSort: Number.isFinite(Number(zona)) ? Number(zona) : 999,
        base: usaLegacy ? `regular:${fecha}` : `regular:${fecha}:${zona}`,
        tipo: "regular",
        valor,
        etiquetaBase: usaLegacy
          ? `Fecha ${fecha}`
          : `Fecha ${fecha} · Zona ${zona}`
      });
    });

  const fechas = [...fechasMap.values()]
    .sort((a, b) =>
      Number(a.torneoId) - Number(b.torneoId) ||
      a.sort - b.sort ||
      a.zoneSort - b.zoneSort
    );

  const fases = [];
  obtenerTorneoIdsPartidosAdmin().forEach(torneoId => {
    PLAYOFF_STAGES
      .filter(fase =>
        partidos.some(partido =>
          String(partido.torneo_id) === String(torneoId) &&
          partido.tipo === "playoff" &&
          partido.fase === fase.value
        )
      )
      .forEach((fase, index) => {
        fases.push({
          key: `${torneoId}:playoff:${fase.value}`,
          torneoId,
          sort: index,
          base: `playoff:${fase.value}`,
          tipo: "playoff",
          valor: fase.value,
          etiquetaBase: fase.label
        });
      });
  });

  const etapas = [...fechas, ...fases];
  const repeticiones = etapas.reduce((map, etapa) => {
    map.set(etapa.base, (map.get(etapa.base) || 0) + 1);
    return map;
  }, new Map());

  return etapas.map(etapa => {
    const duplicada = repeticiones.get(etapa.base) > 1;
    return {
      key: etapa.key,
      torneoId: etapa.torneoId,
      tipo: etapa.tipo,
      valor: etapa.valor,
      etiqueta: duplicada
        ? `${etapa.etiquetaBase} · Torneo #${etapa.torneoId}`
        : etapa.etiquetaBase
    };
  });
}

function obtenerTorneoIdPartidoAdmin(partido) {
  const torneoId = Number(partido?.torneo_id);
  return Number.isInteger(torneoId) && torneoId > 0
    ? String(torneoId)
    : null;
}

function obtenerTorneoIdsPartidosAdmin() {
  return [
    ...new Set(
      partidos
        .map(obtenerTorneoIdPartidoAdmin)
        .filter(Boolean)
    )
  ];
}

function torneoUsaEtapasRegularesLegacy(torneoId) {
  const registros = [...etapasEstado, ...respaldosEtapa];
  return registros.some(item =>
    String(item.torneo_id) === String(torneoId) &&
    item.tipo === "regular" &&
    AdminMatchFlow.isLegacyRegularStageValue(item.valor)
  );
}

function renderControlEtapas() {
  etapasDisponibles = obtenerEtapasDisponiblesAdmin();
  const seleccionAnterior = stageAdminSelect.value;

  if (etapasDisponibles.length === 0) {
    stageAdminSelect.innerHTML = `<option>Sin etapas disponibles</option>`;
    stageAdminSelect.disabled = true;
    stageNote.disabled = true;
    closeStageBtn.disabled = true;
    reopenStageBtn.disabled = true;
    stageState.textContent = "Sin datos";
    stageState.dataset.state = "";
    stageValidation.textContent =
      "No hay fechas ni fases cargadas para controlar.";
    stageValidation.dataset.type = "warn";
    renderRespaldos();
    actualizarBloqueoPorTorneo();
    return;
  }

  stageAdminSelect.innerHTML = etapasDisponibles
    .map(etapa =>
      `<option value="${escapeHtml(etapa.key)}">${escapeHtml(etapa.etiqueta)}</option>`
    )
    .join("");
  stageAdminSelect.disabled = false;
  stageNote.disabled = false;

  const seleccionExiste = etapasDisponibles.some(
    etapa => etapa.key === seleccionAnterior
  );
  stageAdminSelect.value = seleccionExiste
    ? seleccionAnterior
    : obtenerEtapaSugerida().key;

  renderEtapaSeleccionada();
  renderRespaldos();
  actualizarBloqueoEditor();
}

function obtenerEtapaSugerida() {
  const abiertas = etapasDisponibles.filter(etapa =>
    obtenerEstadoEtapa(etapa)?.estado !== "cerrada"
  );
  const listasParaCerrar = abiertas.filter(etapa => {
    const partidosEtapa = obtenerPartidosEtapa(etapa);
    return partidosEtapa.length > 0 &&
      partidosEtapa.every(partidoListoParaCierre);
  });

  return listasParaCerrar[listasParaCerrar.length - 1] ||
    abiertas[abiertas.length - 1] ||
    etapasDisponibles[etapasDisponibles.length - 1];
}

function obtenerEtapaSeleccionada() {
  return etapasDisponibles.find(
    etapa => etapa.key === stageAdminSelect.value
  ) || null;
}

function obtenerEstadoEtapa(etapa) {
  if (!etapa) return null;
  return etapasEstado.find(item =>
    String(item.torneo_id) === String(etapa.torneoId) &&
    item.tipo === etapa.tipo &&
    String(item.valor) === String(etapa.valor)
  ) || null;
}

function obtenerEtapaPartidoAdmin(partido) {
  if (!partido) return null;
  const torneoId = obtenerTorneoIdPartidoAdmin(partido);
  if (!torneoId) return null;

  if (
    partido.tipo === "regular" &&
    partido.fecha !== null &&
    partido.fecha !== undefined
  ) {
    const usaLegacy = torneoUsaEtapasRegularesLegacy(torneoId);
    const valor = usaLegacy
      ? String(partido.fecha)
      : AdminMatchFlow.buildRegularStageValue(partido.fecha, partido.zona);
    const etiqueta = usaLegacy
      ? `Fecha ${partido.fecha}`
      : etiquetaFechaZonaPartido(partido);
    return {
      key: `${torneoId}:regular:${valor}`,
      torneoId,
      tipo: "regular",
      valor,
      etiqueta
    };
  }

  if (partido.tipo === "playoff" && partido.fase) {
    const fase = PLAYOFF_STAGES.find(
      item => item.value === partido.fase
    );
    return {
      key: `${torneoId}:playoff:${partido.fase}`,
      torneoId,
      tipo: "playoff",
      valor: String(partido.fase),
      etiqueta: fase?.label || "Playoffs"
    };
  }

  return null;
}

function partidoSeleccionadoCerrado() {
  const partido = partidos.find(
    item => String(item.id) === String(seleccionadoId)
  );
  const etapa = obtenerEtapaPartidoAdmin(partido);
  return obtenerEstadoEtapa(etapa)?.estado === "cerrada";
}

function actualizarBloqueoEditor(partido) {
  const seleccionado = partido || partidos.find(
    item => String(item.id) === String(seleccionadoId)
  );
  if (!seleccionado || matchForm.classList.contains("hidden")) {
    actualizarBloqueoPorTorneo();
    return;
  }

  const etapa = obtenerEtapaPartidoAdmin(seleccionado);
  const cerrada = obtenerEstadoEtapa(etapa)?.estado === "cerrada";
  const fueraDeTorneo = !partidoPerteneceTorneoTrabajo(seleccionado);
  const bloqueado = cerrada || fueraDeTorneo || !torneoTrabajoValido();
  [
    fields.local,
    fields.visitante,
    fields.fecha,
    fields.hora,
    fields.estado,
    fields.estadio,
    fields.arbitro,
    fields.golesLocal,
    fields.golesVisitante,
    fields.penalesLocal,
    fields.penalesVisitante
  ].forEach(control => {
    control.disabled = bloqueado;
  });
  clearScoreBtn.disabled = bloqueado;
  saveBtn.disabled = bloqueado;

  if (fueraDeTorneo) {
    setSaveFeedback(
      "Este partido no pertenece al torneo de trabajo.",
      "error"
    );
    actualizarBloqueoPorTorneo();
    return;
  }

  if (!torneoTrabajoValido()) {
    setSaveFeedback(
      "Selecciona un torneo para habilitar la edicion.",
      "warn"
    );
    actualizarBloqueoPorTorneo();
    return;
  }

  if (cerrada) {
    setSaveFeedback(
      `${etapa.etiqueta} está cerrada. Reabrila desde el control de etapas para editar.`,
      "warn"
    );
  }
  actualizarBloqueoPorTorneo();
}

function obtenerPartidosEtapa(etapa) {
  if (!etapa) return [];
  return partidos.filter(partido => {
    if (String(partido.torneo_id) !== String(etapa.torneoId)) {
      return false;
    }

    if (etapa.tipo === "regular") {
      const regular = AdminMatchFlow.parseRegularStageValue(etapa.valor);
      if (!regular.fecha) return false;
      return partido.tipo === "regular" &&
        String(partido.fecha) === String(regular.fecha) &&
        (!regular.zona || String(partido.zona) === String(regular.zona));
    }
    return partido.tipo === "playoff" &&
      String(partido.fase) === String(etapa.valor);
  });
}

function partidoListoParaCierre(partido) {
  const equiposCompletos =
    String(partido.local || "").trim() &&
    String(partido.visitante || "").trim();
  const resultadoCompleto =
    partido.goles_local !== null &&
    partido.goles_local !== undefined &&
    partido.goles_visitante !== null &&
    partido.goles_visitante !== undefined;
  const estadoPendiente = [
    "en_vivo",
    "pendiente_resultado",
    "suspendido",
    "postergado"
  ].includes(partido.estado);

  return Boolean(
    equiposCompletos &&
    resultadoCompleto &&
    !estadoPendiente
  );
}

function renderEtapaSeleccionada() {
  const etapa = obtenerEtapaSeleccionada();
  if (!etapa) {
    stageMatchesTotal.textContent = "0";
    stageMatchesReady.textContent = "0";
    stageMatchesPending.textContent = "0";
    stageState.textContent = torneoTrabajoValido()
      ? "Sin etapa"
      : "Sin torneo";
    stageState.dataset.state = "";
    stageValidation.textContent = torneoTrabajoValido()
      ? "No hay etapas disponibles para el torneo seleccionado."
      : "Selecciona un torneo para controlar etapas.";
    stageValidation.dataset.type = "warn";
    closeStageBtn.disabled = true;
    reopenStageBtn.disabled = true;
    actualizarBloqueoPorTorneo();
    return;
  }
  const estado = obtenerEstadoEtapa(etapa);
  const partidosEtapa = obtenerPartidosEtapa(etapa);
  const completos = partidosEtapa.filter(partidoListoParaCierre);
  const faltantes = partidosEtapa.filter(
    partido => !partidoListoParaCierre(partido)
  );
  const advertenciasIncidencias = partidosEtapa.filter(partido => {
    const eventos = incidencias.filter(evento =>
      String(evento.partido_id) === String(partido.id)
    );
    return analizarConsistenciaIncidencias(
      partido,
      eventos
    ).state !== "ok";
  });
  const notaIncidencias = advertenciasIncidencias.length > 0
    ? ` ${advertenciasIncidencias.length} partido(s) tienen advertencias ` +
      "de incidencias; no bloquean el cierre."
    : "";
  const cerrada = estado?.estado === "cerrada";

  stageMatchesTotal.textContent = partidosEtapa.length;
  stageMatchesReady.textContent = completos.length;
  stageMatchesPending.textContent = faltantes.length;
  stageState.textContent = cerrada ? "Etapa cerrada" : "Etapa abierta";
  stageState.dataset.state = cerrada ? "closed" : "open";

  if (partidosEtapa.length === 0) {
    stageValidation.textContent =
      etapa.tipo === "regular"
        ? "Esta zona no tiene partidos en esta fecha."
        : "La etapa no tiene partidos para respaldar.";
    stageValidation.dataset.type = "warn";
  } else if (cerrada) {
    stageValidation.textContent =
      `Cerrada el ${formatearActualizacion(estado.cerrada_en)}. ` +
      "Sus partidos están bloqueados para edición.";
    stageValidation.dataset.type = "ok";
  } else if (faltantes.length === 0 && partidosEtapa.length > 0) {
    stageValidation.textContent =
      "Control de partidos completo. La etapa está lista para cerrar y " +
      `respaldar.${notaIncidencias}`;
    stageValidation.dataset.type =
      advertenciasIncidencias.length > 0 ? "warn" : "ok";
  } else {
    const ids = faltantes.slice(0, 6).map(
      resumenPartidoAdvertencia
    ).join(", ");
    stageValidation.textContent =
      `${faltantes.length} partido(s) todavía requieren equipos, ` +
      `resultado o resolver su estado${ids ? `: ${ids}.` : "."}` +
      notaIncidencias;
    stageValidation.dataset.type = "warn";
  }

  closeStageBtn.disabled =
    etapaProcesando ||
    !etapasHabilitadas ||
    cerrada ||
    partidosEtapa.length === 0 ||
    faltantes.length > 0;
  reopenStageBtn.disabled =
    etapaProcesando ||
    !etapasHabilitadas ||
    !cerrada;
}

function renderRespaldos() {
  backupCount.textContent =
    `${respaldosEtapa.length} ${respaldosEtapa.length === 1 ? "copia" : "copias"}`;

  if (respaldosEtapa.length === 0) {
    backupList.innerHTML =
      `<div class="analytics-empty">Todavía no hay respaldos.</div>`;
    return;
  }

  backupList.innerHTML = respaldosEtapa.slice(0, 12)
    .map(respaldo => {
      const motivo = respaldo.motivo === "cierre"
        ? "Cierre"
        : "Antes de restaurar";
      const nota = respaldo.nota
        ? `<small>${escapeHtml(respaldo.nota)}</small>`
        : "";

      return `
        <div class="backup-item">
          <div>
            <strong>${escapeHtml(respaldo.etiqueta)} · v${respaldo.version}</strong>
            <span>
              ${motivo} · ${respaldo.cantidad_partidos} partidos ·
              ${formatearActualizacion(respaldo.creado_en)}
            </span>
            ${nota}
          </div>
          <div class="backup-actions">
            <button
              type="button"
              data-download-backup="${respaldo.id}"
              ${etapaProcesando ? "disabled" : ""}
            >
              Descargar JSON
            </button>
            <button
              type="button"
              data-restore-backup="${respaldo.id}"
              ${etapaProcesando ? "disabled" : ""}
            >
              Restaurar
            </button>
          </div>
        </div>
      `;
    })
    .join("");
}

function setEtapaProcesando(procesando, message) {
  etapaProcesando = procesando;
  closeStageBtn.textContent = procesando
    ? "Procesando..."
    : "Cerrar y respaldar";
  if (message) {
    stageFeedback.textContent = message;
    stageFeedback.dataset.type = "info";
  }
  renderEtapaSeleccionada();
  renderRespaldos();
}

async function cerrarEtapaSeleccionada() {
  const etapa = obtenerEtapaSeleccionada();
  if (!etapa) return;

  const confirmado = window.confirm(
    `¿Cerrar ${etapa.etiqueta}? Se creará un respaldo inmutable ` +
    "y sus partidos quedarán bloqueados."
  );
  if (!confirmado) return;

  setEtapaProcesando(true, `Cerrando ${etapa.etiqueta}...`);

  try {
    const data = await apiRequest(
      "POST",
      {
        action: "cerrar",
        torneo_id: etapa.torneoId,
        tipo: etapa.tipo,
        valor: etapa.valor,
        etiqueta: etapa.etiqueta,
        nota: stageNote.value
      },
      STAGES_API_URL
    );
    stageNote.value = "";
    await recargarDespuesDeEtapa();
    stageFeedback.textContent =
      `${etapa.etiqueta} cerrada. Respaldo #` +
      `${data.resultado?.respaldo_id || "creado"}.`;
    stageFeedback.dataset.type = "ok";
  } finally {
    setEtapaProcesando(false);
  }
}

async function reabrirEtapaSeleccionada() {
  const etapa = obtenerEtapaSeleccionada();
  if (!etapa) return;

  const confirmado = window.confirm(
    `¿Reabrir ${etapa.etiqueta}? El respaldo existente se conserva, ` +
    "pero sus partidos volverán a poder editarse."
  );
  if (!confirmado) return;

  setEtapaProcesando(true, `Reabriendo ${etapa.etiqueta}...`);

  try {
    await apiRequest(
      "POST",
      {
        action: "reabrir",
        torneo_id: etapa.torneoId,
        tipo: etapa.tipo,
        valor: etapa.valor,
        etiqueta: etapa.etiqueta
      },
      STAGES_API_URL
    );
    await recargarDespuesDeEtapa();
    stageFeedback.textContent = `${etapa.etiqueta} quedó abierta.`;
    stageFeedback.dataset.type = "ok";
  } finally {
    setEtapaProcesando(false);
  }
}

async function restaurarRespaldo(respaldoId) {
  const respaldo = respaldosEtapa.find(
    item => String(item.id) === String(respaldoId)
  );
  if (!respaldo) return;

  const confirmado = window.confirm(
    `¿Restaurar ${respaldo.etiqueta} v${respaldo.version}? ` +
    "Antes se guardará una copia del estado actual. " +
    "La etapa quedará abierta para revisión."
  );
  if (!confirmado) return;

  setEtapaProcesando(
    true,
    `Restaurando ${respaldo.etiqueta} v${respaldo.version}...`
  );

  try {
    const data = await apiRequest(
      "POST",
      {
        action: "restaurar",
        torneo_id: respaldo.torneo_id,
        respaldo_id: respaldo.id
      },
      STAGES_API_URL
    );
    await recargarDespuesDeEtapa();
    stageFeedback.textContent =
      `${respaldo.etiqueta} restaurada. Copia preventiva #` +
      `${data.resultado?.respaldo_previo_id || "creada"}.`;
    stageFeedback.dataset.type = "ok";
  } finally {
    setEtapaProcesando(false);
  }
}

async function descargarRespaldo(respaldoId) {
  const respaldo = respaldosEtapa.find(
    item => String(item.id) === String(respaldoId)
  );
  if (!respaldo) return;

  const data = await apiRequest(
    "GET",
    null,
    `${STAGES_API_URL}?respaldo_id=${encodeURIComponent(respaldo.id)}` +
      `&torneo_id=${encodeURIComponent(respaldo.torneo_id)}`
  );
  const blob = new Blob(
    [JSON.stringify(data, null, 2)],
    { type: "application/json" }
  );
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const etapa = `torneo-${respaldo.torneo_id}-${respaldo.tipo}-${respaldo.valor}`
    .replace(/[^a-z0-9-]+/gi, "-")
    .toLowerCase();

  link.href = url;
  link.download =
    `tres-palos-${etapa}-v${respaldo.version}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  stageFeedback.textContent =
    `${respaldo.etiqueta} v${respaldo.version} descargada en JSON.`;
  stageFeedback.dataset.type = "ok";
}

async function recargarDespuesDeEtapa() {
  await cargarPartidos();
  await cargarEtapasAdmin();
  renderModoPartido();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function cargarClubesAdmin() {
  const data = await apiRequest("GET", null, CLUBS_API_URL);
  clubes = Array.isArray(data.clubes) ? data.clubes : [];
  vincularClubesPartidosAdmin();
  renderClubesAdmin();
}

function mostrarClubesNoDisponibles(message) {
  clubes = [];
  clubsTotal.textContent = "No disponible";
  clubList.innerHTML = `
    <div class="analytics-empty">
      Ejecutá supabase/clubes.sql en Supabase para habilitar las fichas.
      <br><br>${escapeHtml(message)}
    </div>
  `;
  clubForm.classList.add("hidden");
  emptyClubEditor.classList.remove("hidden");
}

function renderClubesAdmin() {
  clubsTotal.textContent =
    `${clubes.length} ${clubes.length === 1 ? "club" : "clubes"}`;

  if (clubes.length === 0) {
    clubList.innerHTML =
      `<div class="analytics-empty">No hay clubes cargados.</div>`;
    return;
  }

  clubList.innerHTML = clubes.map(club => `
    <button
      type="button"
      class="club-item ${club.activo ? "" : "inactive"} ${
        String(club.id) === String(clubSeleccionadoId) ? "on" : ""
      }"
      data-club-id="${club.id}"
    >
      <span>
        <strong>${escapeHtml(club.nombre_corto)}</strong>
        <small>
          ${escapeHtml(club.ciudad)} · Zona ${club.zona}
          ${club.apodo ? ` · ${escapeHtml(club.apodo)}` : ""}
        </small>
      </span>
      <span>#${club.id}</span>
    </button>
  `).join("");
}

function seleccionarClub(id) {
  const club = clubes.find(item => String(item.id) === String(id));
  if (!club) return;

  clubSeleccionadoId = club.id;
  clubFields.id.value = club.id;
  clubFields.officialName.value = club.nombre_oficial || "";
  clubFields.shortName.value = club.nombre_corto || "";
  clubFields.nickname.value = club.apodo || "";
  clubFields.city.value = club.ciudad || "";
  clubFields.province.value = club.provincia || "Santa Fe";
  clubFields.stadium.value = club.estadio || "";
  clubFields.zone.value = String(club.zona || 1);
  clubFields.shield.value = club.escudo_url || "";
  clubFields.primaryColor.value = club.color_primario || "";
  clubFields.secondaryColor.value = club.color_secundario || "";
  clubFields.aliases.value = Array.isArray(club.aliases)
    ? club.aliases.join(", ")
    : "";
  clubFields.active.checked = club.activo !== false;
  clubOriginal = { ...club };

  emptyClubEditor.classList.add("hidden");
  clubForm.classList.remove("hidden");
  setClubFeedback("Modificá la ficha y guardá los cambios.");
  renderClubesAdmin();
}

function valoresFormularioClub() {
  return {
    nombre_corto: valorTexto(clubFields.shortName),
    apodo: valorTexto(clubFields.nickname),
    ciudad: valorTexto(clubFields.city),
    provincia: valorTexto(clubFields.province),
    estadio: valorTexto(clubFields.stadium),
    zona: Number(clubFields.zone.value),
    escudo_url: valorTexto(clubFields.shield),
    color_primario: valorTexto(clubFields.primaryColor),
    color_secundario: valorTexto(clubFields.secondaryColor),
    aliases: clubFields.aliases.value
      .split(",")
      .map(alias => alias.trim())
      .filter(Boolean),
    activo: clubFields.active.checked
  };
}

function validarClub(valores) {
  if (!valores.nombre_corto || !valores.ciudad || !valores.provincia) {
    throw new Error(
      "Nombre corto, ciudad y provincia son obligatorios."
    );
  }

  ["color_primario", "color_secundario"].forEach(campo => {
    if (valores[campo] && !/^#[0-9a-f]{6}$/i.test(valores[campo])) {
      throw new Error("Los colores deben usar formato #RRGGBB.");
    }
  });

  if (
    valores.escudo_url &&
    !valores.escudo_url.startsWith("/assets/")
  ) {
    throw new Error(
      "La ruta del escudo debe comenzar con /assets/."
    );
  }
}

function obtenerCambiosClub(original, valores) {
  if (!original) return valores;

  return Object.fromEntries(
    Object.entries(valores).filter(([campo, valor]) =>
      JSON.stringify(valor) !== JSON.stringify(original[campo])
    )
  );
}

async function guardarClub(event) {
  event.preventDefault();

  const id = Number(clubFields.id.value);
  if (!id) return;

  const valores = valoresFormularioClub();
  validarClub(valores);
  const patch = obtenerCambiosClub(clubOriginal, valores);

  if (Object.keys(patch).length === 0) {
    setClubFeedback("No modificaste ningún dato.", "warn");
    return;
  }

  setClubSaving(true);
  setClubFeedback("Guardando ficha...");

  try {
    const data = await apiRequest(
      "PATCH",
      { id, patch },
      CLUBS_API_URL
    );
    const actualizado = data.club;
    clubes = clubes.map(club =>
      String(club.id) === String(id) ? actualizado : club
    );
    seleccionarClub(id);
    setClubFeedback(
      "Ficha guardada. La web pública tomará estos datos al recargarse.",
      "ok"
    );
    setStatus(`Club #${id} actualizado.`, "ok");
  } finally {
    setClubSaving(false);
  }
}

async function cargarPlantelesAdmin() {
  const torneoSeleccionado = rosterTournament.value;
  const clubSeleccionado = rosterClub.value;
  const data = await apiRequest("GET", null, ROSTERS_API_URL);

  torneos = Array.isArray(data.torneos) ? data.torneos : [];
  jugadores = Array.isArray(data.jugadores) ? data.jugadores : [];
  inscripcionesJugadores = Array.isArray(data.inscripciones)
    ? data.inscripciones
    : [];

  renderFiltrosPlantel(torneoSeleccionado, clubSeleccionado);
  renderPlantel();
  renderModoPartido();
}

function mostrarPlantelesNoDisponibles(message) {
  torneos = [];
  jugadores = [];
  inscripcionesJugadores = [];
  rosterTotal.textContent = "No disponible";
  rosterTournament.innerHTML = "";
  rosterClub.innerHTML = "";
  rosterList.innerHTML = `
    <div class="analytics-empty">
      Ejecutá supabase/planteles.sql en Supabase para habilitar planteles.
      <br><br>${escapeHtml(message)}
    </div>
  `;
  newRosterBtn.disabled = true;
  toggleRosterBtn.classList.add("hidden");
  rosterForm.classList.add("hidden");
  emptyRosterEditor.classList.remove("hidden");
  renderModoPartido();
}

function renderFiltrosPlantel(torneoPrevio = "", clubPrevio = "") {
  rosterTournament.innerHTML = torneos.map(torneo => `
    <option value="${torneo.id}">
      ${escapeHtml(torneo.nombre)}
    </option>
  `).join("");

  const clubesActivos = clubes
    .filter(club => club.activo !== false)
    .sort((a, b) =>
      Number(a.zona) - Number(b.zona) ||
      String(a.nombre_corto).localeCompare(
        String(b.nombre_corto),
        "es",
        { sensitivity: "base" }
      )
    );

  rosterClub.innerHTML = clubesActivos.map(club => `
    <option value="${club.id}">
      ${escapeHtml(club.nombre_corto)} · Zona ${club.zona}
    </option>
  `).join("");

  const torneoDefault =
    torneos.find(torneo => String(torneo.id) === String(torneoPrevio)) ||
    torneos.find(torneo => torneo.activo) ||
    torneos[0];
  const clubDefault =
    clubesActivos.find(club => String(club.id) === String(clubPrevio)) ||
    clubesActivos[0];

  rosterTournament.value = torneoDefault
    ? String(torneoDefault.id)
    : "";
  rosterClub.value = clubDefault ? String(clubDefault.id) : "";
  newRosterBtn.disabled = !torneoDefault || !clubDefault;
}

function inscripcionesVisibles() {
  return inscripcionesJugadores
    .filter(inscripcion =>
      String(inscripcion.torneo_id) === rosterTournament.value &&
      String(inscripcion.club_id) === rosterClub.value
    )
    .sort((a, b) => {
      const estadoA = a.estado === "inactivo" ? 1 : 0;
      const estadoB = b.estado === "inactivo" ? 1 : 0;
      if (estadoA !== estadoB) return estadoA - estadoB;

      const jugadorA = obtenerJugadorPlantel(a.jugador_id);
      const jugadorB = obtenerJugadorPlantel(b.jugador_id);
      return String(jugadorA?.nombre_completo || "").localeCompare(
        String(jugadorB?.nombre_completo || ""),
        "es",
        { sensitivity: "base" }
      );
    });
}

function renderPlantel() {
  const visibles = inscripcionesVisibles();
  rosterTotal.textContent =
    `${visibles.length} ${visibles.length === 1 ? "jugador" : "jugadores"}`;

  if (!rosterTournament.value || !rosterClub.value) {
    rosterList.innerHTML = `
      <div class="analytics-empty">
        No hay torneo o club disponible.
      </div>
    `;
    return;
  }

  if (visibles.length === 0) {
    rosterList.innerHTML = `
      <div class="analytics-empty">
        Todavía no hay jugadores cargados para este club y torneo.
      </div>
    `;
    return;
  }

  rosterList.innerHTML = visibles.map(inscripcion => {
    const jugador = obtenerJugadorPlantel(inscripcion.jugador_id);
    const estadoClase = {
      confirmado: "confirmed",
      por_verificar: "pending",
      inactivo: ""
    }[inscripcion.estado] || "";
    const datos = [
      etiquetaPosicion(inscripcion.posicion),
      inscripcion.dorsal ? `#${inscripcion.dorsal}` : null
    ].filter(Boolean).join(" · ");

    return `
      <button
        type="button"
        class="roster-item ${
          inscripcion.estado === "inactivo" ? "inactive" : ""
        } ${
          String(inscripcion.id) === String(inscripcionSeleccionadaId)
            ? "on"
            : ""
        }"
        data-enrollment-id="${inscripcion.id}"
      >
        <span>
          <strong>
            ${escapeHtml(jugador?.nombre_completo || "Jugador sin nombre")}
          </strong>
          <small>${escapeHtml(datos || "Posición sin definir")}</small>
        </span>
        <span class="roster-state ${estadoClase}">
          ${escapeHtml(etiquetaEstadoPlantel(inscripcion.estado))}
        </span>
      </button>
    `;
  }).join("");
}

function obtenerJugadorPlantel(jugadorId) {
  const inscripcion = inscripcionesJugadores.find(item =>
    String(item.jugador_id) === String(jugadorId) && item.jugador
  );
  if (inscripcion?.jugador) return inscripcion.jugador;

  return jugadores.find(
    jugador => String(jugador.id) === String(jugadorId)
  ) || null;
}

function etiquetaPosicion(posicion) {
  return {
    arquero: "Arquero",
    defensor: "Defensor",
    mediocampista: "Mediocampista",
    delantero: "Delantero",
    sin_definir: "Sin definir"
  }[posicion] || "Sin definir";
}

function etiquetaEstadoPlantel(estado) {
  return {
    confirmado: "Confirmado",
    por_verificar: "Por verificar",
    inactivo: "Inactivo"
  }[estado] || estado;
}

function etiquetaInscripcionCandidato(inscripcion) {
  return [
    inscripcion.club_nombre,
    inscripcion.torneo_nombre,
    etiquetaEstadoPlantel(inscripcion.estado)
  ].filter(Boolean).join(" - ");
}

function detalleInscripcionesCandidato(candidato) {
  const inscripciones = Array.isArray(candidato?.inscripciones)
    ? candidato.inscripciones
    : [];
  if (inscripciones.length === 0) {
    return "Sin inscripciones registradas";
  }
  return inscripciones
    .map(etiquetaInscripcionCandidato)
    .filter(Boolean)
    .join(" | ");
}

function renderResumenJugadorCandidato(candidato) {
  const jugador = candidato?.jugador || {};
  return `
    <strong>${escapeHtml(jugador.nombre_completo || "Jugador sin nombre")}</strong>
    <small>${escapeHtml(detalleInscripcionesCandidato(candidato))}</small>
    <small>
      ${escapeHtml((candidato?.coincidencias || []).join(", "))}
    </small>
  `;
}

function obtenerInscripcionPlantelActual(jugadorId) {
  return inscripcionesJugadores.find(inscripcion =>
    String(inscripcion.jugador_id) === String(jugadorId) &&
    String(inscripcion.club_id) === rosterClub.value &&
    String(inscripcion.torneo_id) === rosterTournament.value
  ) || null;
}

function contextoPlantelActual() {
  const torneo = torneos.find(
    item => String(item.id) === rosterTournament.value
  );
  const club = clubes.find(
    item => String(item.id) === rosterClub.value
  );

  if (!torneo || !club) {
    throw new Error("Selecciona club y torneo para buscar jugadores.");
  }

  return {
    torneoId: Number(torneo.id),
    clubId: Number(club.id),
    torneoNombre: torneo.nombre || `Torneo #${torneo.id}`,
    clubNombre: club.nombre_corto || club.nombre_oficial || `Club #${club.id}`
  };
}

function setRosterSearchState(message, type = "info") {
  rosterFields.searchState.textContent = message;
  rosterFields.searchState.dataset.type = type;
}

function limpiarSeleccionJugadorPlantel() {
  jugadorPlantelSeleccionado = null;
  rosterFields.playerId.value = "";
  rosterFields.selectedPlayer.classList.add("hidden");
  rosterFields.selectedPlayer.innerHTML = "";
}

function cerrarCreacionJugadorPlantel() {
  rosterFields.createBlock.classList.add("hidden");
  rosterFields.createConfirm.checked = false;
  rosterFields.createPlayer.disabled = true;
}

function mostrarBloqueBusquedaPlantel() {
  rosterFields.searchPanel.classList.remove("hidden");
  rosterFields.detailsBlock.classList.add("hidden");
  toggleRosterBtn.classList.add("hidden");
  saveRosterBtn.disabled = true;
  limpiarSeleccionJugadorPlantel();
  cerrarCreacionJugadorPlantel();
}

function resetBusquedaPlantel(message = "Escribí al menos 2 letras") {
  busquedaPlantel = null;
  busquedaPlantelId += 1;
  if (busquedaPlantelTimer) {
    window.clearTimeout(busquedaPlantelTimer);
    busquedaPlantelTimer = null;
  }
  rosterFields.searchResults.innerHTML = "";
  rosterFields.search.setAttribute("aria-expanded", "false");
  rosterFields.createNew.classList.add("hidden");
  setRosterSearchState(message, "warn");
}

function renderResultadosBusquedaPlantel() {
  const candidatos = Array.isArray(busquedaPlantel?.candidatos)
    ? busquedaPlantel.candidatos.slice(0, 8)
    : [];

  rosterFields.searchResults.innerHTML = candidatos.map(candidato => {
    const jugador = candidato.jugador || {};
    return `
      <button
        type="button"
        class="player-candidate"
        role="option"
        data-roster-candidate="${escapeHtml(jugador.id || "")}"
      >
        ${renderResumenJugadorCandidato(candidato)}
      </button>
    `;
  }).join("");

  rosterFields.search.setAttribute(
    "aria-expanded",
    candidatos.length > 0 ? "true" : "false"
  );
  rosterFields.createNew.classList.remove("hidden");

  if (candidatos.length === 0) {
    setRosterSearchState(
      "No encontramos jugadores con ese nombre",
      "warn"
    );
  } else {
    setRosterSearchState(
      `${candidatos.length} resultado(s). Elegí la persona correcta.`,
      "ok"
    );
  }
}

async function buscarJugadoresPlantel() {
  const query = rosterFields.search.value.trim();
  limpiarSeleccionJugadorPlantel();
  cerrarCreacionJugadorPlantel();

  if (query.length < 2) {
    resetBusquedaPlantel("Escribí al menos 2 letras");
    return;
  }

  const contexto = contextoPlantelActual();
  const requestId = ++busquedaPlantelId;
  const params = new URLSearchParams({
    scope: "buscar-jugador",
    torneo_id: String(contexto.torneoId),
    club_id: String(contexto.clubId),
    nombre: query
  });

  setRosterSearchState("Buscando jugadores...");
  rosterFields.searchResults.innerHTML = "";
  rosterFields.search.setAttribute("aria-expanded", "false");
  rosterFields.createNew.classList.add("hidden");

  try {
    const data = await apiRequest(
      "GET",
      null,
      `${ROSTERS_API_URL}?${params.toString()}`
    );
    if (requestId !== busquedaPlantelId) return;
    busquedaPlantel = data;
    renderResultadosBusquedaPlantel();
  } catch (error) {
    if (requestId !== busquedaPlantelId) return;
    busquedaPlantel = null;
    rosterFields.searchResults.innerHTML = "";
    rosterFields.createNew.classList.add("hidden");
    setRosterSearchState(error.message, "error");
  }
}

function programarBusquedaPlantel() {
  if (busquedaPlantelTimer) window.clearTimeout(busquedaPlantelTimer);
  busquedaPlantelTimer = window.setTimeout(() => {
    buscarJugadoresPlantel().catch(error => {
      setRosterSearchState(error.message, "error");
    });
  }, 180);
}

function enfocarResultadoPlantel(direccion = 1) {
  const resultados = [
    ...rosterFields.searchResults.querySelectorAll(".player-candidate")
  ];
  if (resultados.length === 0) return;

  const actual = resultados.indexOf(document.activeElement);
  const siguiente = actual < 0
    ? 0
    : (actual + direccion + resultados.length) % resultados.length;
  resultados[siguiente].focus();
}

function candidatoPlantelPorId(jugadorId) {
  return (busquedaPlantel?.candidatos || []).find(candidato =>
    String(candidato.jugador?.id) === String(jugadorId)
  ) || null;
}

function renderSeleccionJugadorPlantel(candidato) {
  const contexto = contextoPlantelActual();
  const jugador = candidato.jugador || {};
  const existente = candidato.inscripcion_contexto ||
    obtenerInscripcionPlantelActual(jugador.id);
  const accion = existente
    ? `
      <button
        type="button"
        class="ghost"
        data-roster-open-existing="${existente.id}"
      >
        Ver inscripción
      </button>
    `
    : `
      <button type="button" data-roster-create-enrollment>
        Agregar al plantel
      </button>
    `;

  rosterFields.selectedPlayer.innerHTML = `
    <div>
      <span class="eyebrow">Persona seleccionada</span>
      ${renderResumenJugadorCandidato(candidato)}
      <small>
        Plantel: ${escapeHtml(contexto.clubNombre)} - ${escapeHtml(contexto.torneoNombre)}
      </small>
    </div>
    <div class="event-player-state" data-type="${existente ? "warn" : "ok"}">
      ${existente
        ? "Este jugador ya pertenece al plantel"
        : "Listo para crear la inscripción de esta persona."}
    </div>
    <div class="event-candidate-actions">
      ${accion}
    </div>
  `;
  rosterFields.selectedPlayer.classList.remove("hidden");
}

function seleccionarCandidatoPlantel(jugadorId) {
  const candidato = candidatoPlantelPorId(jugadorId);
  if (!candidato) return;
  jugadorPlantelSeleccionado = candidato;
  rosterFields.playerId.value = String(candidato.jugador.id);
  cerrarCreacionJugadorPlantel();
  renderSeleccionJugadorPlantel(candidato);
  setRosterFeedback(
    "Revisa la persona seleccionada antes de agregarla al plantel."
  );
}

function abrirCreacionJugadorPlantel() {
  if (!busquedaPlantel) {
    setRosterFeedback("Busca jugadores antes de crear una persona nueva.", "warn");
    rosterFields.search.focus();
    return;
  }
  limpiarSeleccionJugadorPlantel();
  rosterFields.playerName.value = busquedaPlantel.nombre || rosterFields.search.value.trim();
  rosterFields.createConfirm.checked = false;
  actualizarResumenCreacionPlantel();
  rosterFields.createBlock.classList.remove("hidden");
  rosterFields.createPlayer.disabled = true;
  rosterFields.playerName.focus();
}

function actualizarResumenCreacionPlantel() {
  let contexto = null;
  try {
    contexto = contextoPlantelActual();
  } catch (error) {
    rosterFields.createSummary.textContent = error.message;
    return;
  }
  const nombre = valorTexto(rosterFields.playerName) || "Sin nombre";
  rosterFields.createSummary.textContent = [
    `Nombre: ${nombre}`,
    `Club: ${contexto.clubNombre}`,
    `Torneo: ${contexto.torneoNombre}`
  ].join(" | ");
}

function actualizarBotonCrearJugadorPlantel() {
  rosterFields.createPlayer.disabled =
    !busquedaPlantel ||
    !rosterFields.createConfirm.checked ||
    !valorTexto(rosterFields.playerName);
}

async function crearInscripcionPlantelSeleccionado() {
  if (!jugadorPlantelSeleccionado?.jugador?.id) return;
  const contexto = contextoPlantelActual();
  setRosterSaving(true);
  setRosterFeedback("Guardando inscripción...");

  try {
    const data = await apiRequest("POST", {
      action: "crear-inscripcion-jugador",
      torneo_id: contexto.torneoId,
      club_id: contexto.clubId,
      jugador_id: Number(jugadorPlantelSeleccionado.jugador.id),
      busqueda_previa: true,
      confirmar_inscripcion: true
    }, ROSTERS_API_URL);
    const inscripcionId = data.inscripcion?.id;
    await cargarPlantelesAdmin();
    if (inscripcionId) seleccionarInscripcion(inscripcionId);
    setRosterFeedback(
      data.existente
        ? "Este jugador ya pertenece al plantel."
        : "Inscripción guardada. Ya queda disponible para futuras incidencias.",
      data.existente ? "warn" : "ok"
    );
    setStatus("Plantel actualizado.", "ok");
  } finally {
    setRosterSaving(false);
  }
}

async function crearJugadorPlantelNuevo() {
  if (!busquedaPlantel) {
    throw new Error("Busca jugadores antes de crear una persona nueva.");
  }
  const nombre = valorTexto(rosterFields.playerName);
  if (!nombre) {
    throw new Error("El nombre del jugador es obligatorio.");
  }
  if (!rosterFields.createConfirm.checked) {
    throw new Error("Confirma que no corresponde a los candidatos.");
  }

  const contexto = contextoPlantelActual();
  setRosterSaving(true);
  setRosterFeedback("Creando jugador e inscripción...");

  try {
    const data = await apiRequest("POST", {
      action: "crear-jugador-inscripcion",
      torneo_id: contexto.torneoId,
      club_id: contexto.clubId,
      nombre_completo: nombre,
      busqueda_previa: true,
      confirmar_creacion: true,
      confirmar_homonimo:
        Array.isArray(busquedaPlantel.candidatos) &&
        busquedaPlantel.candidatos.length > 0
    }, ROSTERS_API_URL);
    const inscripcionId = data.inscripcion?.id;
    await cargarPlantelesAdmin();
    if (inscripcionId) seleccionarInscripcion(inscripcionId);
    setRosterFeedback(
      "Jugador e inscripción creados. Ya queda disponible para incidencias.",
      "ok"
    );
    setStatus("Plantel actualizado.", "ok");
  } finally {
    setRosterSaving(false);
  }
}

function iniciarNuevaInscripcion() {
  if (!rosterTournament.value || !rosterClub.value) return;

  inscripcionSeleccionadaId = null;
  rosterForm.reset();
  rosterFields.enrollmentId.value = "";
  rosterFields.playerId.value = "";
  rosterFields.search.value = "";
  rosterFields.position.value = "sin_definir";
  rosterFields.status.value = "por_verificar";
  toggleRosterBtn.classList.add("hidden");
  resetBusquedaPlantel();
  mostrarBloqueBusquedaPlantel();

  emptyRosterEditor.classList.add("hidden");
  rosterForm.classList.remove("hidden");
  setRosterFeedback("Busca primero una persona existente.");
  renderPlantel();
  window.requestAnimationFrame(() => rosterFields.search.focus());
}

function seleccionarInscripcion(id) {
  const inscripcion = inscripcionesJugadores.find(
    item => String(item.id) === String(id)
  );
  if (!inscripcion) return;

  const jugador = obtenerJugadorPlantel(inscripcion.jugador_id);
  inscripcionSeleccionadaId = inscripcion.id;
  rosterFields.enrollmentId.value = inscripcion.id;
  rosterFields.playerId.value = String(inscripcion.jugador_id);
  rosterFields.searchPanel.classList.add("hidden");
  rosterFields.selectedPlayer.classList.add("hidden");
  cerrarCreacionJugadorPlantel();
  rosterFields.detailsBlock.classList.remove("hidden");
  rosterFields.editName.value = jugador?.nombre_completo || "";
  rosterFields.aliases.value = Array.isArray(jugador?.aliases)
    ? jugador.aliases.join(", ")
    : "";
  rosterFields.position.value = inscripcion.posicion || "sin_definir";
  rosterFields.shirt.value = valorInput(inscripcion.dorsal);
  rosterFields.status.value = inscripcion.estado || "por_verificar";
  rosterFields.from.value = inscripcion.fecha_desde || "";
  rosterFields.to.value = inscripcion.fecha_hasta || "";
  rosterFields.source.value = inscripcion.fuente || "";
  rosterFields.notes.value = inscripcion.observaciones || "";
  toggleRosterBtn.classList.remove("hidden");
  toggleRosterBtn.textContent = inscripcion.estado === "inactivo"
    ? "Reactivar en el plantel"
    : "Quitar del plantel";
  toggleRosterBtn.classList.toggle(
    "danger",
    inscripcion.estado !== "inactivo"
  );

  emptyRosterEditor.classList.add("hidden");
  rosterForm.classList.remove("hidden");
  setRosterFeedback(
    "Edita la inscripción. Los datos adicionales son opcionales."
  );
  setRosterSaving(false);
  renderPlantel();
}

function valoresFormularioPlantel() {
  return {
    inscripcion_id: rosterFields.enrollmentId.value || null,
    jugador_id: rosterFields.playerId.value || null,
    nombre_completo: valorTexto(rosterFields.editName),
    aliases: rosterFields.aliases.value
      .split(",")
      .map(alias => alias.trim())
      .filter(Boolean),
    club_id: Number(rosterClub.value),
    torneo_id: Number(rosterTournament.value),
    posicion: rosterFields.position.value,
    dorsal: valorNumero(rosterFields.shirt),
    estado: rosterFields.status.value,
    fecha_desde: valorTexto(rosterFields.from),
    fecha_hasta: valorTexto(rosterFields.to),
    fuente: valorTexto(rosterFields.source),
    observaciones: valorTexto(rosterFields.notes)
  };
}

function validarInscripcionJugador(valores) {
  if (!valores.nombre_completo) {
    throw new Error("El nombre del jugador es obligatorio.");
  }
  if (!valores.club_id || !valores.torneo_id) {
    throw new Error("Club y torneo son obligatorios.");
  }
  if (valores.estado === "confirmado" && !valores.fuente) {
    throw new Error(
      "Un jugador confirmado debe tener una fuente."
    );
  }
  if (
    valores.dorsal !== null &&
    (
      !Number.isInteger(valores.dorsal) ||
      valores.dorsal < 1 ||
      valores.dorsal > 99
    )
  ) {
    throw new Error("El dorsal debe estar entre 1 y 99.");
  }
  if (
    valores.fecha_desde &&
    valores.fecha_hasta &&
    valores.fecha_hasta < valores.fecha_desde
  ) {
    throw new Error(
      "La fecha hasta no puede ser anterior a la fecha desde."
    );
  }
}

async function guardarInscripcionJugador(event) {
  event.preventDefault();
  const valores = valoresFormularioPlantel();
  if (!valores.inscripcion_id) {
    throw new Error("Elegí una inscripción para editar.");
  }
  validarInscripcionJugador(valores);

  setRosterSaving(true);
  setRosterFeedback("Guardando inscripción...");

  try {
    const method = valores.inscripcion_id ? "PATCH" : "POST";
    const data = await apiRequest(
      method,
      valores,
      ROSTERS_API_URL
    );
    const inscripcionId = data.resultado?.inscripcion?.id;

    await cargarPlantelesAdmin();
    if (inscripcionId) seleccionarInscripcion(inscripcionId);

    setRosterFeedback(
      "Inscripción guardada. Ya queda disponible para futuras incidencias.",
      "ok"
    );
    setStatus("Plantel actualizado.", "ok");
  } finally {
    setRosterSaving(false);
  }
}

function fechaLocalInput(fecha = new Date()) {
  return [
    fecha.getFullYear(),
    String(fecha.getMonth() + 1).padStart(2, "0"),
    String(fecha.getDate()).padStart(2, "0")
  ].join("-");
}

async function cambiarEstadoInscripcionJugador() {
  const inscripcion = inscripcionesJugadores.find(
    item =>
      String(item.id) === String(rosterFields.enrollmentId.value)
  );
  if (!inscripcion) return;

  const estaInactivo = inscripcion.estado === "inactivo";
  const confirmado = window.confirm(
    estaInactivo
      ? "¿Reactivar este jugador en el plantel actual?"
      : "¿Quitar este jugador del plantel? Sus incidencias históricas se conservarán."
  );
  if (!confirmado) return;

  const valores = valoresFormularioPlantel();
  valores.estado = estaInactivo ? "por_verificar" : "inactivo";
  valores.fecha_hasta = estaInactivo
    ? null
    : valores.fecha_hasta || fechaLocalInput();
  validarInscripcionJugador(valores);

  setRosterSaving(true);
  setRosterFeedback(
    estaInactivo ? "Reactivando jugador..." : "Quitando del plantel..."
  );

  try {
    await apiRequest("PATCH", valores, ROSTERS_API_URL);
    await cargarPlantelesAdmin();
    seleccionarInscripcion(inscripcion.id);
    setRosterFeedback(
      estaInactivo
        ? "Jugador reactivado. Ya está disponible para nuevas incidencias."
        : "Jugador fuera del plantel. Se conserva su historial.",
      "ok"
    );
    setStatus(
      estaInactivo ? "Jugador reactivado." : "Jugador fuera del plantel.",
      "ok"
    );
  } finally {
    setRosterSaving(false);
  }
}

async function cargarIncidenciasAdmin() {
  const torneoId = requerirTorneoTrabajoId();
  const partidoPrevio = eventMatch.value;
  const partidoRapidoPrevio = liveMatch.value;
  const data = await apiRequest(
    "GET",
    null,
    `${EVENTS_API_URL}?torneo_id=${encodeURIComponent(torneoId)}`
  );
  incidencias = Array.isArray(data.incidencias)
    ? data.incidencias
    : [];
  const partidosValidos = new Set(partidos.map(partido => String(partido.id)));
  const incidenciaFueraDeTorneo = incidencias.find(
    evento => !partidosValidos.has(String(evento.partido_id))
  );
  if (incidenciaFueraDeTorneo) {
    incidencias = [];
    throw new Error(
      "La respuesta de incidencias contiene datos fuera del torneo de trabajo."
    );
  }

  renderOpcionesPartidosIncidencias(
    partidoPrevio,
    partidoRapidoPrevio
  );
  renderIncidenciasAdmin();
  renderModoPartido();
  if (etapasHabilitadas) renderEtapaSeleccionada();
}

function mostrarIncidenciasNoDisponibles(message) {
  incidencias = [];
  eventsTotal.textContent = "No disponible";
  eventMatch.innerHTML = "";
  eventList.innerHTML = `
    <div class="analytics-empty">
      Ejecutá supabase/incidencias.sql en Supabase para habilitar el editor.
      <br><br>${escapeHtml(message)}
    </div>
  `;
  newEventBtn.disabled = true;
  eventForm.classList.add("hidden");
  emptyEventEditor.classList.remove("hidden");
  liveMatch.innerHTML = "";
  renderModoPartido();
}

function renderOpcionesPartidosIncidencias(
  partidoPrevio = "",
  partidoRapidoPrevio = ""
) {
  if (!torneoTrabajoValido()) {
    eventMatch.innerHTML = `<option value="">Selecciona un torneo</option>`;
    liveMatch.innerHTML = eventMatch.innerHTML;
    eventMatch.disabled = true;
    liveMatch.disabled = true;
    newEventBtn.disabled = true;
    return;
  }

  const ordenados = AdminMatchFlow.sortMatchesForSelector(
    partidos,
    resolverPartidoPlayoffAdmin
  );

  eventMatch.innerHTML = `
    <option value="">Elegí un partido</option>
    ${ordenados.map(partido => `
      <option value="${partido.id}">
        ${escapeHtml(
          partido.tipo === "playoff"
            ? etiquetaPartidoPlayoffAdmin(partido)
            : etiquetaFechaZonaPartido(partido)
        )} · ${escapeHtml(nombrePartido(partido))}
        ${partido.fecha_partido
          ? ` · ${formatearFechaAdmin(partido.fecha_partido)}`
          : ""}
        · ID #${partido.id}
      </option>
    `).join("")}
  `;

  const seleccionado = seleccionadoId
    ? ordenados.find(item => String(item.id) === String(seleccionadoId))
    : null;
  const sugerido = seleccionado;

  eventMatch.value = sugerido ? String(sugerido.id) : "";
  newEventBtn.disabled = !sugerido || !torneoTrabajoValido();

  liveMatch.innerHTML = eventMatch.innerHTML;
  const sugeridoRapido = seleccionado || sugerido;
  liveMatch.value = sugeridoRapido
    ? String(sugeridoRapido.id)
    : "";
  actualizarBloqueoPorTorneo();
}

function partidoIncidenciasSeleccionado() {
  const partido = partidos.find(
    partido => String(partido.id) === eventMatch.value
  ) || null;
  return partidoPerteneceTorneoTrabajo(partido) ? partido : null;
}

function incidenciasVisibles() {
  return incidencias
    .filter(evento =>
      String(evento.partido_id) === eventMatch.value
    )
    .sort(
      (a, b) =>
        Number(a.orden ?? a.id) - Number(b.orden ?? b.id) ||
        Number(a.id) - Number(b.id)
    );
}

function renderIncidenciasAdmin() {
  if (!torneoTrabajoValido()) {
    eventsTotal.textContent = "0 incidencias";
    eventList.innerHTML = `
      <div class="analytics-empty">
        Selecciona un torneo para listar incidencias.
      </div>
    `;
    newEventBtn.disabled = true;
    actualizarBloqueoPorTorneo();
    return;
  }

  const visibles = incidenciasVisibles();
  const partido = partidoIncidenciasSeleccionado();
  const etapa = obtenerEtapaPartidoAdmin(partido);
  const etapaCerrada =
    obtenerEstadoEtapa(etapa)?.estado === "cerrada";
  eventsTotal.textContent =
    `${visibles.length} ${
      visibles.length === 1 ? "incidencia" : "incidencias"
    }`;
  newEventBtn.disabled = !partido || etapaCerrada || !torneoTrabajoValido();

  if (!eventMatch.value) {
    eventList.innerHTML = `
      <div class="analytics-empty">No hay partidos disponibles.</div>
    `;
    return;
  }

  if (visibles.length === 0) {
    eventList.innerHTML = `
      <div class="analytics-empty">
        Este partido todavía no tiene incidencias.
      </div>
    `;
    return;
  }

  eventList.innerHTML = visibles.map((evento, indice) => {
    const sinVincular =
      Boolean(evento.jugador) &&
      !evento.inscripcion_jugador_id;
    const estadoClase = sinVincular
      ? "unlinked"
      : evento.estado_dato === "confirmado"
        ? "confirmed"
        : "";
    const estado = sinVincular
      ? "Sin vincular"
      : evento.estado_dato === "confirmado"
        ? "Confirmado"
        : "Por verificar";
    const participante = evento.tipo === "cambio"
      ? [
          evento.jugador || "Sale sin informar",
          evento.jugador_relacionado || "Entra sin informar"
        ].join(" → ")
      : evento.jugador || "Jugador no informado";

    return `
      <div
        class="event-admin-item ${
          String(evento.id) === String(incidenciaSeleccionadaId)
            ? "on"
            : ""
        }"
      >
        <button
          type="button"
          class="event-admin-main"
          data-event-id="${evento.id}"
        >
          <span class="event-admin-order">
            ${indice + 1}
          </span>
          <span>
            <strong>${escapeHtml(participante)}</strong>
            <small>
              ${escapeHtml(nombreEquipoIncidenciaAdmin(evento))} ·
              ${escapeHtml(etiquetaTipoIncidencia(evento.tipo))}
              ${momentoIncidencia(evento)
                ? ` · ${escapeHtml(momentoIncidencia(evento))}`
                : ""}
            </small>
          </span>
          <span class="event-admin-state ${estadoClase}">
            ${estado}
          </span>
        </button>
        <span class="event-order-actions">
          <button
            type="button"
            data-move-event="${evento.id}"
            data-direction="up"
            aria-label="Subir incidencia"
            title="Subir"
            ${
              indice === 0 || etapaCerrada || eventReordering
                ? "disabled"
                : ""
            }
          >↑</button>
          <button
            type="button"
            data-move-event="${evento.id}"
            data-direction="down"
            aria-label="Bajar incidencia"
            title="Bajar"
            ${
              indice === visibles.length - 1 ||
              etapaCerrada ||
              eventReordering
                ? "disabled"
                : ""
            }
          >↓</button>
        </span>
      </div>
    `;
  }).join("");
}

function nombreEquipoIncidenciaAdmin(evento) {
  const club = clubes.find(item =>
    String(item.id) === String(evento.equipo_id)
  );
  return club?.nombre_corto || "Equipo sin identificar";
}

function etiquetaTipoIncidencia(tipo) {
  return {
    gol: "Gol",
    gol_penal: "Gol de penal",
    gol_en_contra: "Gol en contra",
    amarilla: "Tarjeta amarilla",
    doble_amarilla: "Segunda amarilla · Expulsión",
    roja: "Tarjeta roja",
    cambio: "Cambio"
  }[tipo] || tipo || "Incidencia";
}

function etiquetaPeriodoIncidencia(periodo) {
  return {
    primer_tiempo: "1T",
    segundo_tiempo: "2T"
  }[periodo] || "";
}

function momentoIncidencia(evento) {
  return [
    etiquetaPeriodoIncidencia(evento.periodo),
    Number.isInteger(Number(evento.minuto)) && Number(evento.minuto) > 0
      ? `${Number(evento.minuto)}'`
      : ""
  ].filter(Boolean).join(" · ");
}

function partidoModoSeleccionado() {
  const partido = partidos.find(
    partido => String(partido.id) === liveMatch.value
  ) || null;
  return partidoPerteneceTorneoTrabajo(partido) ? partido : null;
}

function incidenciasModoPartido() {
  return incidencias
    .filter(evento =>
      String(evento.partido_id) === liveMatch.value
    )
    .sort(
      (a, b) =>
        Number(a.orden ?? a.id) - Number(b.orden ?? b.id) ||
        Number(a.id) - Number(b.id)
    );
}

function ajustarMarcadorPorIncidencia(
  marcador,
  evento,
  partido,
  cantidad = 1
) {
  if (!["gol", "gol_penal", "gol_en_contra"].includes(evento.tipo)) {
    return marcador;
  }

  const local = resolverEquipoPartidoAdmin(partido, "local");
  const visitante = resolverEquipoPartidoAdmin(partido, "visitante");
  const equipoGol = ["gol", "gol_penal"].includes(evento.tipo)
    ? evento.equipo_id
    : String(evento.equipo_id) === String(local.id)
      ? visitante.id
      : local.id;

  if (String(equipoGol) === String(local.id)) {
    marcador.local = Math.max(0, marcador.local + cantidad);
  } else if (String(equipoGol) === String(visitante.id)) {
    marcador.visitante = Math.max(
      0,
      marcador.visitante + cantidad
    );
  }

  return marcador;
}

function calcularMarcadorModo(partido) {
  if (resultadoPartidoCargado(partido)) {
    return {
      local: Number(partido.goles_local) || 0,
      visitante: Number(partido.goles_visitante) || 0
    };
  }

  return incidenciasModoPartido().reduce(
    (marcador, evento) =>
      ajustarMarcadorPorIncidencia(marcador, evento, partido),
    { local: 0, visitante: 0 }
  );
}

function resultadoPartidoCargado(partido) {
  return Boolean(
    partido &&
    partido.goles_local !== null &&
    partido.goles_local !== undefined &&
    partido.goles_visitante !== null &&
    partido.goles_visitante !== undefined
  );
}

function contarGolesIdentificados(partido, eventos) {
  return eventos.reduce(
    (marcador, evento) =>
      ajustarMarcadorPorIncidencia(marcador, evento, partido),
    { local: 0, visitante: 0 }
  );
}

function esGolIncidencia(tipo) {
  return ["gol", "gol_penal", "gol_en_contra"].includes(tipo);
}

function incidenciaSinVincular(evento) {
  if (!evento.inscripcion_jugador_id) return true;
  return evento.tipo === "cambio" &&
    !evento.inscripcion_relacionada_id;
}

function analizarTarjetasIncidencias(eventos) {
  const jugadores = new Map();
  const advertencias = [];

  eventos.forEach(evento => {
    if (!["amarilla", "doble_amarilla", "roja"].includes(evento.tipo)) {
      return;
    }

    const identidad = evento.inscripcion_jugador_id;
    if (!identidad) return;

    const estado = jugadores.get(identidad) || {
      amarillas: 0,
      expulsado: false,
      nombre: evento.jugador || "Jugador sin identificar"
    };

    if (estado.expulsado) {
      advertencias.push(
        `${estado.nombre} tiene una tarjeta cargada después de su expulsión.`
      );
    } else if (evento.tipo === "amarilla") {
      estado.amarillas += 1;
      if (estado.amarillas > 1) {
        advertencias.push(
          `${estado.nombre} tiene dos amarillas comunes; la segunda debe marcarse como expulsión.`
        );
      }
    } else if (evento.tipo === "doble_amarilla") {
      if (estado.amarillas === 0) {
        advertencias.push(
          `${estado.nombre} tiene una segunda amarilla sin una primera amarilla previa.`
        );
      }
      estado.expulsado = true;
    } else if (evento.tipo === "roja") {
      estado.expulsado = true;
    }

    jugadores.set(identidad, estado);
  });

  return advertencias;
}

function analizarConsistenciaIncidencias(partido, eventos) {
  const resultadoCargado = resultadoPartidoCargado(partido);
  const identificados = partido
    ? contarGolesIdentificados(partido, eventos)
    : { local: 0, visitante: 0 };
  const esperados = resultadoCargado
    ? {
        local: Number(partido.goles_local) || 0,
        visitante: Number(partido.goles_visitante) || 0
      }
    : { local: 0, visitante: 0 };
  const goles = eventos.filter(evento =>
    esGolIncidencia(evento.tipo)
  );
  const sinVincular = eventos.filter(incidenciaSinVincular).length;
  const porVerificar = eventos.filter(
    evento => evento.estado_dato !== "confirmado"
  ).length;
  const advertenciasTarjetas =
    analizarTarjetasIncidencias(eventos);
  const ordenes = eventos.map(evento => Number(evento.orden));
  const ordenValido =
    ordenes.every(orden => Number.isInteger(orden) && orden > 0) &&
    new Set(ordenes).size === ordenes.length;
  const golesCoinciden =
    resultadoCargado &&
    identificados.local === esperados.local &&
    identificados.visitante === esperados.visitante;
  const excesoGoles =
    resultadoCargado &&
    (
      identificados.local > esperados.local ||
      identificados.visitante > esperados.visitante
    );
  const golesConfirmados =
    goles.length > 0 &&
    goles.every(evento => evento.estado_dato === "confirmado");
  const secuenciaPublicable =
    goles.length > 0 &&
    golesCoinciden &&
    golesConfirmados &&
    ordenValido;
  const items = [];

  if (!resultadoCargado) {
    items.push({
      type: "warn",
      text: "Falta cargar el resultado del partido."
    });
  } else if (excesoGoles) {
    items.push({
      type: "error",
      text:
        `Hay más goles cargados (${identificados.local}-${identificados.visitante}) ` +
        `que en el resultado (${esperados.local}-${esperados.visitante}).`
    });
  } else if (!golesCoinciden) {
    items.push({
      type: "warn",
      text:
        `Resultado ${esperados.local}-${esperados.visitante}; ` +
        `goles identificados ${identificados.local}-${identificados.visitante}.`
    });
  } else {
    items.push({
      type: "ok",
      text: "La cantidad de goles coincide con el resultado."
    });
  }

  items.push({
    type: sinVincular > 0 ? "warn" : "ok",
    text: sinVincular > 0
      ? `${sinVincular} incidencia(s) tienen jugadores sin vincular.`
      : "Todos los protagonistas están vinculados al plantel."
  });
  items.push({
    type: porVerificar > 0 ? "warn" : "ok",
    text: porVerificar > 0
      ? `${porVerificar} incidencia(s) siguen por verificar.`
      : "Todas las incidencias están confirmadas."
  });
  advertenciasTarjetas.forEach(text => {
    items.push({ type: "warn", text });
  });

  if (goles.length === 0 && resultadoCargado) {
    items.push({
      type: esperados.local + esperados.visitante === 0 ? "ok" : "warn",
      text: esperados.local + esperados.visitante === 0
        ? "El partido no tuvo goles."
        : "Todavía no hay goles cargados para construir la secuencia."
    });
  } else if (secuenciaPublicable) {
    items.push({
      type: "ok",
      text: "La web puede mostrar la evolución del marcador."
    });
  } else if (goles.length > 0) {
    items.push({
      type: "warn",
      text:
        "La web listará los goles sin evolución del marcador hasta completar, " +
        "ordenar y confirmar la secuencia."
    });
  }

  const state = items.some(item => item.type === "error")
    ? "error"
    : items.some(item => item.type === "warn")
      ? "warn"
      : "ok";

  return {
    identificados,
    esperados,
    goles,
    golesCoinciden,
    ordenValido,
    secuenciaPublicable,
    items,
    state
  };
}

function renderConsistenciaModo(partido, eventos) {
  if (!partido) {
    liveConsistencyState.textContent = "Sin revisar";
    liveConsistencyState.dataset.state = "";
    liveConsistencyList.className = "";
    liveConsistencyList.textContent =
      "Elegí un partido para revisar sus incidencias.";
    return;
  }

  const analisis = analizarConsistenciaIncidencias(
    partido,
    eventos
  );
  liveConsistencyState.textContent = {
    ok: "Consistente",
    warn: "Con advertencias",
    error: "Revisar"
  }[analisis.state];
  liveConsistencyState.dataset.state = analisis.state;
  liveConsistencyList.className = "live-consistency-list";
  liveConsistencyList.innerHTML = analisis.items.map(item => `
    <div class="live-consistency-item ${item.type}">
      ${escapeHtml(item.text)}
    </div>
  `).join("");
}

function ladoGolAccion(lado, tipo) {
  if (["gol", "gol_penal"].includes(tipo)) return lado;
  if (tipo === "gol_en_contra") {
    return lado === "local" ? "visitante" : "local";
  }
  return null;
}

function accionGolDisponible(partido, eventos, lado, tipo) {
  const ladoMarcador = ladoGolAccion(lado, tipo);
  if (!ladoMarcador) return true;
  if (!resultadoPartidoCargado(partido)) return false;

  const identificados = contarGolesIdentificados(partido, eventos);
  const limite = ladoMarcador === "local"
    ? Number(partido.goles_local) || 0
    : Number(partido.goles_visitante) || 0;
  return identificados[ladoMarcador] < limite;
}

function renderAccionesEquipoModo(
  container,
  lado,
  disabled,
  partido,
  eventos
) {
  const acciones = [
    ["gol", "Gol"],
    ["gol_penal", "Gol de penal"],
    ["gol_en_contra", "En contra"],
    ["amarilla", "Amarilla"],
    ["doble_amarilla", "2da amarilla + roja"],
    ["roja", "Roja"],
    ["cambio", "Cambio"]
  ];

  container.innerHTML = acciones.map(([tipo, etiqueta]) => {
    const sinCupoGol =
      ["gol", "gol_penal", "gol_en_contra"].includes(tipo) &&
      !accionGolDisponible(partido, eventos, lado, tipo);
    const title = sinCupoGol
      ? resultadoPartidoCargado(partido)
        ? "Ya se identificaron todos los goles de ese lado."
        : "Cargá primero el resultado del partido."
      : "";

    return `
    <button
      type="button"
      class="live-action"
      data-live-action="${tipo}"
      data-live-side="${lado}"
      ${disabled || sinCupoGol ? "disabled" : ""}
      ${title ? `title="${escapeHtml(title)}"` : ""}
    >
      ${etiqueta}
    </button>
  `;
  }).join("");
}

function nombreParticipanteModo(evento) {
  if (evento.tipo === "cambio") {
    return [
      evento.jugador || "Sale sin identificar",
      evento.jugador_relacionado || "Entra sin identificar"
    ].join(" -> ");
  }

  return evento.jugador || "Jugador sin identificar";
}

function renderTimelineModo(partido, eventos) {
  liveEventCount.textContent =
    `${eventos.length} ${
      eventos.length === 1 ? "incidencia" : "incidencias"
    }`;

  if (!partido) {
    liveTimeline.textContent = "Elegí un partido para comenzar.";
    return;
  }
  if (eventos.length === 0) {
    liveTimeline.textContent =
      "Todavía no hay acciones cargadas en este partido.";
    return;
  }

  const local = resolverEquipoPartidoAdmin(partido, "local");
  const analisis = analizarConsistenciaIncidencias(
    partido,
    eventos
  );
  const marcador = { local: 0, visitante: 0 };
  const filas = eventos.map((evento, indice) => {
    ajustarMarcadorPorIncidencia(marcador, evento, partido);
    const esLocal =
      String(evento.equipo_id) === String(local.id);
    const detalle = `${etiquetaTipoIncidencia(evento.tipo)} · ${
      nombreParticipanteModo(evento)
    }${momentoIncidencia(evento)
      ? ` · ${momentoIncidencia(evento)}`
      : ""}`;
    const centro =
      analisis.secuenciaPublicable && esGolIncidencia(evento.tipo)
        ? `${marcador.local} - ${marcador.visitante}`
        : `#${indice + 1}`;

    return `
      <div class="live-timeline-row">
        <span class="live-timeline-team local">
          ${esLocal ? escapeHtml(detalle) : ""}
        </span>
        <span class="live-timeline-score">
          ${centro}
        </span>
        <span class="live-timeline-team away">
          ${esLocal ? "" : escapeHtml(detalle)}
        </span>
      </div>
    `;
  });
  liveTimeline.innerHTML = filas.slice(-8).join("");
}

function renderModoPartido() {
  const partido = partidoModoSeleccionado();
  const eventos = incidenciasModoPartido();
  const sinTorneo = !torneoTrabajoValido();
  const local = resolverEquipoPartidoAdmin(partido, "local");
  const visitante = resolverEquipoPartidoAdmin(partido, "visitante");
  const etapa = obtenerEtapaPartidoAdmin(partido);
  const etapaCerrada =
    obtenerEstadoEtapa(etapa)?.estado === "cerrada";
  const finalizado = partido?.estado === "finalizado";
  const sinEquipos = !local.id || !visitante.id;
  const bloqueado =
    sinTorneo || !partido || etapaCerrada || sinEquipos;
  const marcador = partido
    ? calcularMarcadorModo(partido)
    : { local: 0, visitante: 0 };
  const resultadoCargado = resultadoPartidoCargado(partido);
  const identificados = partido
    ? contarGolesIdentificados(partido, eventos)
    : { local: 0, visitante: 0 };

  liveLocalName.textContent = local.nombre || "Por definir";
  liveAwayName.textContent = visitante.nombre || "Por definir";
  liveScore.textContent = resultadoCargado
    ? `${marcador.local} - ${marcador.visitante}`
    : "- - -";
  if (resultadoCargado) {
    const completo =
      identificados.local === marcador.local &&
      identificados.visitante === marcador.visitante;
    liveGoalProgress.textContent =
      `Goles identificados: ${identificados.local}/${marcador.local}` +
      ` local · ${identificados.visitante}/${marcador.visitante} visitante`;
    liveGoalProgress.className =
      `live-goal-progress ${completo ? "complete" : "pending"}`;
  } else {
    liveGoalProgress.textContent =
      "Cargá primero el resultado para identificar sus goles.";
    liveGoalProgress.className = "live-goal-progress pending";
  }

  let estado = "Preparado";
  let estadoClave = "";
  if (sinTorneo) {
    estado = "Sin torneo";
  } else if (!partido) {
    estado = "Sin seleccionar";
  } else if (etapaCerrada) {
    estado = "Etapa cerrada";
    estadoClave = "locked";
  } else if (finalizado) {
    estado = "Finalizado";
    estadoClave = "finished";
  } else if (partido.estado === "en_vivo") {
    estado = "En vivo";
    estadoClave = "live";
  } else if (sinEquipos) {
    estado = "Equipos pendientes";
    estadoClave = "locked";
  }
  liveModeState.textContent = estado;
  liveModeState.dataset.state = estadoClave;

  renderAccionesEquipoModo(
    liveLocalActions,
    "local",
    bloqueado || liveBusy,
    partido,
    eventos
  );
  renderAccionesEquipoModo(
    liveAwayActions,
    "visitante",
    bloqueado || liveBusy,
    partido,
    eventos
  );
  renderTimelineModo(partido, eventos);
  renderConsistenciaModo(partido, eventos);

  liveMatch.disabled =
    liveBusy || sinTorneo || partidos.length === 0;
  liveUndoBtn.disabled =
    liveBusy || bloqueado || eventos.length === 0;
  liveFinishBtn.disabled =
    liveBusy || bloqueado || finalizado || !resultadoCargado;
  liveUndoBtn.textContent = liveBusy
    ? "Procesando..."
    : "Deshacer última";
}

function inscripcionesModoEquipo(equipoId, torneoId) {
  return inscripcionesJugadores
    .filter(inscripcion => {
      const jugador = obtenerJugadorPlantel(inscripcion.jugador_id);
      return String(inscripcion.club_id) === String(equipoId) &&
        String(inscripcion.torneo_id) === String(torneoId) &&
        inscripcion.estado !== "inactivo" &&
        jugador?.activo !== false;
    })
    .sort((a, b) => {
      const jugadorA = obtenerJugadorPlantel(a.jugador_id);
      const jugadorB = obtenerJugadorPlantel(b.jugador_id);
      return String(jugadorA?.nombre_completo || "").localeCompare(
        String(jugadorB?.nombre_completo || ""),
        "es",
        { sensitivity: "base" }
      );
    });
}

function abrirSelectorModo(lado, tipo) {
  const partido = partidoModoSeleccionado();
  if (!partido || liveBusy) return;
  if (!torneoTrabajoValido()) {
    setLiveFeedback("Selecciona un torneo antes de cargar incidencias.", "error");
    return;
  }

  const etapa = obtenerEtapaPartidoAdmin(partido);
  if (obtenerEstadoEtapa(etapa)?.estado === "cerrada") {
    setLiveFeedback(
      `${etapa.etiqueta} está cerrada. Reabrila para cargar.`,
      "warn"
    );
    return;
  }
  const equipo = resolverEquipoPartidoAdmin(partido, lado);
  if (!equipo.id) {
    setLiveFeedback("El equipo todavía no está vinculado.", "error");
    return;
  }
  if (
    ["gol", "gol_penal", "gol_en_contra"].includes(tipo) &&
    !accionGolDisponible(
      partido,
      incidenciasModoPartido(),
      lado,
      tipo
    )
  ) {
    setLiveFeedback(
      resultadoPartidoCargado(partido)
        ? "Ya se identificaron todos los goles de ese lado."
        : "Cargá primero el resultado del partido.",
      "warn"
    );
    return;
  }

  const disponibles = inscripcionesModoEquipo(
    equipo.id,
    partido.torneo_id
  );
  if (disponibles.length === 0) {
    setLiveFeedback(
      `No hay jugadores inscriptos para ${equipo.nombre} en este torneo.`,
      "warn"
    );
    return;
  }
  if (tipo === "cambio" && disponibles.length < 2) {
    setLiveFeedback(
      `Cargá al menos dos jugadores de ${equipo.nombre} para registrar un cambio.`,
      "warn"
    );
    return;
  }

  liveAction = {
    lado,
    tipo,
    equipoId: equipo.id,
    equipoNombre: equipo.nombre,
    partidoId: partido.id
  };
  liveChangeOutId = null;
  liveMinute.value = "";
  renderSelectorJugadoresModo();
  livePicker.classList.remove("hidden");
  livePicker.setAttribute("aria-hidden", "false");
  document.body.classList.add("live-picker-open");
}

function renderSelectorJugadoresModo() {
  const partido = partidoModoSeleccionado();
  if (!partido || !liveAction) return;

  const disponibles = inscripcionesModoEquipo(
    liveAction.equipoId,
    partido.torneo_id
  ).filter(inscripcion =>
    !liveChangeOutId ||
    String(inscripcion.id) !== String(liveChangeOutId)
  );
  const esCambio = liveAction.tipo === "cambio";
  const eligeEntrada = esCambio && liveChangeOutId;

  livePickerEyebrow.textContent =
    `${liveAction.equipoNombre} · ${
      etiquetaTipoIncidencia(liveAction.tipo)
    }`;
  livePickerTitle.textContent = esCambio
    ? eligeEntrada
      ? "Elegí quién entra"
      : "Elegí quién sale"
    : "Elegí al jugador";
  livePickerHelp.textContent = esCambio
    ? eligeEntrada
      ? "Al tocar el reemplazante se guardará el cambio."
      : "Después vas a elegir al jugador que entra."
    : "La incidencia se guardará al tocar un jugador.";

  livePlayerGrid.innerHTML = disponibles.map(inscripcion => {
      const jugador = obtenerJugadorPlantel(inscripcion.jugador_id);
      const dorsal = inscripcion.dorsal
        ? `Dorsal ${inscripcion.dorsal}`
        : "Sin dorsal";
      return `
        <button
          type="button"
          class="live-player"
          data-live-player="${inscripcion.id}"
        >
          <strong>
            ${escapeHtml(
              jugador?.nombre_completo || "Jugador sin nombre"
            )}
          </strong>
          <small>${escapeHtml(dorsal)}</small>
        </button>
      `;
    }).join("");
}

function cerrarSelectorModo() {
  livePicker.classList.add("hidden");
  livePicker.setAttribute("aria-hidden", "true");
  document.body.classList.remove("live-picker-open");
  liveAction = null;
  liveChangeOutId = null;
}

async function seleccionarJugadorModo(valor) {
  if (!liveAction || liveBusy) return;
  const torneoId = requerirTorneoTrabajoId();

  const inscripcionId = Number(valor);
  if (!Number.isInteger(inscripcionId) || inscripcionId <= 0) {
    throw new Error("Selecciona una inscripcion de jugador.");
  }
  if (liveAction.tipo === "cambio" && !liveChangeOutId) {
    liveChangeOutId = inscripcionId;
    renderSelectorJugadoresModo();
    return;
  }

  const partidoId = liveAction.partidoId;
  const partido = partidos.find(
    item => String(item.id) === String(partidoId)
  );
  if (!partidoPerteneceTorneoTrabajo(partido)) {
    throw new Error("El partido no pertenece al torneo de trabajo.");
  }
  const valores = {
    torneo_id: torneoId,
    partido_id: partidoId,
    tipo: liveAction.tipo,
    equipo_id: liveAction.equipoId,
    inscripcion_jugador_id:
      liveAction.tipo === "cambio"
        ? liveChangeOutId
        : inscripcionId,
    inscripcion_relacionada_id:
      liveAction.tipo === "cambio"
        ? inscripcionId
        : null,
    periodo: livePeriod.value || null,
    minuto: valorNumero(liveMinute),
    estado_dato: "por_verificar",
    fuente: null,
    observaciones: "Carga rápida de incidencias del partido."
  };

  cerrarSelectorModo();
  setLiveBusy(true);
  setLiveFeedback("Guardando acción...");

  try {
    const data = await apiRequest("POST", valores, EVENTS_API_URL);
    await cargarPartidos();
    liveMatch.value = String(partidoId);
    eventMatch.value = String(partidoId);
    await cargarIncidenciasAdmin();
    setLiveFeedback(
      data.periodo_omitido
        ? "Acción guardada sin el tiempo. Ejecutá incidencias-periodos.sql."
        : data.ajuste_tipo?.motivo === "segunda_amarilla"
        ? "Segunda amarilla detectada: se registró la expulsión."
        : "Acción guardada.",
      data.periodo_omitido ? "warn" : "ok"
    );
    setStatus("Modo Partido actualizado.", "ok");
  } finally {
    setLiveBusy(false);
  }
}

async function deshacerUltimaAccionModo() {
  const torneoId = requerirTorneoTrabajoId();
  const eventos = incidenciasModoPartido();
  const ultima = eventos[eventos.length - 1];
  if (!ultima || liveBusy) return;
  const partido = partidoModoSeleccionado();

  const confirmar = window.confirm(
    `¿Deshacer ${etiquetaTipoIncidencia(ultima.tipo)} de ${
      nombreParticipanteModo(ultima)
    } en ${partido ? nombrePartido(partido) : "el partido"} ` +
    `(${etiquetaTorneoTrabajo()})?`
  );
  if (!confirmar) return;

  const partidoId = Number(liveMatch.value);
  setLiveBusy(true);
  setLiveFeedback("Deshaciendo última acción...");

  try {
    await apiRequest(
      "DELETE",
      { id: ultima.id, torneo_id: torneoId },
      EVENTS_API_URL
    );
    await cargarPartidos();
    liveMatch.value = String(partidoId);
    eventMatch.value = String(partidoId);
    await cargarIncidenciasAdmin();
    setLiveFeedback("Última acción deshecha.", "ok");
    setStatus("Última incidencia eliminada.", "ok");
  } finally {
    setLiveBusy(false);
  }
}

async function finalizarPartidoModo() {
  const partido = partidoModoSeleccionado();
  if (!partido || liveBusy) return;
  const torneoId = requerirTorneoTrabajoId();

  const marcador = calcularMarcadorModo(partido);
  const confirmar = window.confirm(
    `¿Finalizar ${nombrePartido(partido)} ${marcador.local} - ${
      marcador.visitante
    } en ${etiquetaTorneoTrabajo()}?`
  );
  if (!confirmar) return;

  setLiveBusy(true);
  setLiveFeedback("Finalizando partido...");

  try {
    await apiRequest("PATCH", {
      torneo_id: torneoId,
      id: partido.id,
      patch: {
        estado: "finalizado",
        goles_local: marcador.local,
        goles_visitante: marcador.visitante
      }
    });
    await cargarPartidos();
    liveMatch.value = String(partido.id);
    eventMatch.value = String(partido.id);
    await cargarIncidenciasAdmin();
    setLiveFeedback(
      `Partido finalizado ${marcador.local} - ${marcador.visitante}.`,
      "ok"
    );
    setStatus("Partido finalizado desde Modo Partido.", "ok");
  } finally {
    setLiveBusy(false);
  }
}

function renderEquiposIncidencia(equipoPreferido = "") {
  const partido = partidoIncidenciasSeleccionado();
  if (!partido) {
    eventFields.team.innerHTML = "";
    eventFields.team.disabled = true;
    return;
  }

  const opciones = [
    resolverEquipoPartidoAdmin(partido, "local"),
    resolverEquipoPartidoAdmin(partido, "visitante")
  ].filter(item => item.id && item.nombre);

  eventFields.team.innerHTML = opciones.map(item => `
    <option value="${item.id}">
      ${escapeHtml(item.nombre)}
    </option>
  `).join("");
  eventFields.team.disabled = opciones.length === 0;

  if (opciones.some(item =>
    String(item.id) === String(equipoPreferido)
  )) {
    eventFields.team.value = String(equipoPreferido);
  }
}

function contextoJugadoresIncidenciaDisponible() {
  const partido = partidoIncidenciasSeleccionado();
  return Boolean(
    torneoTrabajoValido() &&
    partido &&
    eventFields.team.value
  );
}

function setEventPlayerState(message, type = "info") {
  eventFields.playerState.textContent = message;
  eventFields.playerState.dataset.type = type;
}

function resetJugadoresIncidencia(message) {
  inscripcionesIncidencia = [];
  eventFields.player.value = "";
  eventFields.relatedPlayer.value = "";
  eventFields.playerSearch.value = "";
  eventFields.playerSearch.disabled = true;
  eventFields.playerSearch.setAttribute("aria-expanded", "false");
  eventFields.playerResults.innerHTML = "";
  eventFields.relatedResults.innerHTML = "";
  eventFields.player.disabled = true;
  eventFields.relatedPlayer.disabled = true;
  eventFields.playerMissing.disabled = true;
  eventFields.playerMissing.textContent = "Jugador no encontrado";
  setEventPlayerState(message, "warn");
  cerrarFlujoJugadorNoEncontrado({ devolverFoco: false });
  setEventSaving(false);
}

async function cargarJugadoresIncidencia(
  jugadorPreferido = "",
  relacionadoPreferido = ""
) {
  if (!torneoTrabajoValido()) {
    resetJugadoresIncidencia("Selecciona un torneo.");
    return;
  }

  const partido = partidoIncidenciasSeleccionado();
  if (!partido) {
    resetJugadoresIncidencia("Selecciona un partido.");
    return;
  }

  if (!eventFields.team.value) {
    resetJugadoresIncidencia("Selecciona equipo para cargar jugadores.");
    return;
  }

  const requestId = ++cargaJugadoresIncidenciaId;
  const includeIds = [
    jugadorPreferido,
    relacionadoPreferido
  ].filter(Boolean);
  const params = new URLSearchParams({
    scope: "jugadores",
    torneo_id: String(requerirTorneoTrabajoId()),
    partido_id: String(partido.id),
    equipo_id: String(eventFields.team.value)
  });
  if (includeIds.length > 0) {
    params.set("include_ids", includeIds.join(","));
  }

  inscripcionesIncidencia = [];
  eventFields.player.value = "";
  eventFields.relatedPlayer.value = "";
  eventFields.player.disabled = true;
  eventFields.relatedPlayer.disabled = true;
  eventFields.playerSearch.disabled = true;
  eventFields.playerSearch.setAttribute("aria-expanded", "false");
  eventFields.playerMissing.disabled = true;
  eventFields.playerResults.innerHTML = "";
  eventFields.relatedResults.innerHTML = "";
  setEventPlayerState("Cargando jugadores...");

  try {
    const data = await apiRequest(
      "GET",
      null,
      `${EVENTS_API_URL}?${params.toString()}`
    );
    if (requestId !== cargaJugadoresIncidenciaId) return;
    inscripcionesIncidencia = Array.isArray(data.inscripciones)
      ? data.inscripciones
      : [];
    renderJugadoresIncidencia(jugadorPreferido, relacionadoPreferido);
  } catch (error) {
    if (requestId !== cargaJugadoresIncidenciaId) return;
    resetJugadoresIncidencia(error.message);
    setEventPlayerState(error.message, "error");
  }
}

function normalizarBusquedaJugadorAdmin(value) {
  return AdminMatchFlow.normalizeSearchText(value);
}

function inscripcionesParaIncidencia() {
  const query = normalizarBusquedaJugadorAdmin(
    eventFields.playerSearch.value
  );
  const seleccionadas = new Set([
    eventFields.player.value,
    eventFields.relatedPlayer.value
  ].filter(Boolean).map(String));

  const filtradas = inscripcionesIncidencia.filter(inscripcion => {
    if (seleccionadas.has(String(inscripcion.id))) return true;
    if (!query) return true;
    return normalizarBusquedaJugadorAdmin(
      inscripcion.jugador?.nombre_completo || ""
    ).includes(query);
  });

  const visibles = filtradas.slice(0, EVENT_PLAYER_LIMIT);
  const seleccionadasFuera = inscripcionesIncidencia.filter(inscripcion =>
    seleccionadas.has(String(inscripcion.id)) &&
    !visibles.some(item => String(item.id) === String(inscripcion.id))
  );

  return {
    query,
    total: inscripcionesIncidencia.length,
    visibles: [...seleccionadasFuera, ...visibles],
    recortadas:
      filtradas.length > EVENT_PLAYER_LIMIT
      ? filtradas.length - EVENT_PLAYER_LIMIT
      : 0
  };
}

function renderBotonesInscripcionesIncidencia(
  target,
  visibles,
  seleccionado
) {
  const atributo = target === "related"
    ? "data-event-related-player"
    : "data-event-player";
  return visibles.map(inscripcion => {
    const jugador = inscripcion.jugador;
    const estado = {
      confirmado: "",
      por_verificar: "Por verificar",
      inactivo: "Fuera del plantel"
    }[inscripcion.estado] || "";
    const elegido = String(inscripcion.id) === String(seleccionado);
    return `
      <button
        type="button"
        class="player-candidate ${elegido ? "selected" : ""}"
        role="option"
        aria-selected="${elegido ? "true" : "false"}"
        ${atributo}="${inscripcion.id}"
      >
        <strong>${escapeHtml(jugador?.nombre_completo || "Sin nombre")}</strong>
        <small>${escapeHtml(estado || "Inscripto en este plantel")}</small>
      </button>
    `;
  }).join("");
}

function renderJugadoresIncidencia(
  jugadorPreferido = "",
  relacionadoPreferido = ""
) {
  const partido = partidoIncidenciasSeleccionado();
  const puedeBuscar = contextoJugadoresIncidenciaDisponible();
  const {
    query,
    total,
    visibles,
    recortadas
  } = inscripcionesParaIncidencia();
  eventFields.playerSearch.disabled = !puedeBuscar;
  eventFields.playerMissing.disabled = !puedeBuscar;
  eventFields.playerMissing.textContent =
    total === 0
      ? "Agregar jugador al plantel"
      : "Jugador no encontrado";
  eventFields.player.disabled = !puedeBuscar || total === 0;
  eventFields.relatedPlayer.disabled = !puedeBuscar || total === 0;

  if (inscripcionesIncidencia.some(item =>
    String(item.id) === String(jugadorPreferido)
  )) {
    eventFields.player.value = String(jugadorPreferido);
  }
  if (inscripcionesIncidencia.some(item =>
    String(item.id) === String(relacionadoPreferido)
  )) {
    eventFields.relatedPlayer.value = String(relacionadoPreferido);
  }
  eventFields.playerResults.innerHTML =
    renderBotonesInscripcionesIncidencia(
      "player",
      visibles,
      eventFields.player.value
    );
  eventFields.relatedResults.innerHTML =
    renderBotonesInscripcionesIncidencia(
      "related",
      visibles,
      eventFields.relatedPlayer.value
    );
  eventFields.playerSearch.setAttribute(
    "aria-expanded",
    visibles.length > 0 ? "true" : "false"
  );

  if (visibles.length === 0) {
    eventFields.playerResults.innerHTML = `
      <div class="analytics-empty">${escapeHtml(
        query
          ? "Sin resultados en el plantel elegido."
          : "Busca dentro del plantel para elegir jugador."
      )}</div>
    `;
    eventFields.relatedResults.innerHTML = eventFields.playerResults.innerHTML;
  }

  if (!partido) {
    setEventPlayerState("Selecciona un partido.", "warn");
  } else if (!eventFields.team.value) {
    setEventPlayerState("Selecciona equipo para cargar jugadores.", "warn");
  } else if (total === 0) {
    setEventPlayerState(
      "Todavía no hay jugadores cargados para este club y torneo.",
      "warn"
    );
  } else if (query && visibles.length === 0) {
    setEventPlayerState(
      "Sin resultados. Usa Jugador no encontrado.",
      "warn"
    );
  } else {
    const detalle = recortadas > 0
      ? ` Mostrando ${EVENT_PLAYER_LIMIT}; ajusta la búsqueda.`
      : "";
    setEventPlayerState(
      `${total} ${total === 1 ? "jugador inscripto" : "jugadores inscriptos"}.${detalle}`,
      "ok"
    );
  }

  setEventSaving(false);
}

function contextoJugadorEvento() {
  const partido = partidoIncidenciasSeleccionado();
  if (!torneoTrabajoValido()) {
    throw new Error("Selecciona un torneo de trabajo.");
  }
  if (!partido) {
    throw new Error("Selecciona un partido.");
  }
  if (!eventFields.team.value) {
    throw new Error("Selecciona el equipo del jugador.");
  }

  const equipo = clubes.find(
    club => String(club.id) === String(eventFields.team.value)
  );
  return {
    torneoId: requerirTorneoTrabajoId(),
    partido,
    equipoId: Number(eventFields.team.value),
    equipoNombre: equipo?.nombre_corto || equipo?.nombre_oficial || "Equipo",
    torneoNombre: etiquetaTorneoTrabajo()
  };
}

function abrirFlujoJugadorNoEncontrado(nombreInicial = "") {
  try {
    contextoJugadorEvento();
  } catch (error) {
    setEventFeedback(error.message, "error");
    return;
  }

  busquedaJugadorEvento = null;
  eventFields.missingName.value =
    nombreInicial ||
    eventFields.playerSearch.value ||
    "";
  eventFields.missingResults.textContent =
    "Ingresa un nombre y busca candidatos antes de crear.";
  eventFields.createPlayerBlock.classList.add("hidden");
  eventFields.createConfirm.checked = false;
  eventFields.createPlayer.disabled = true;
  eventFields.missingFlow.classList.remove("hidden");
  eventFields.missingName.focus();
}

function cerrarFlujoJugadorNoEncontrado(options = {}) {
  if (!eventFields.missingFlow) return;
  eventFields.missingFlow.classList.add("hidden");
  busquedaJugadorEvento = null;
  if (options.devolverFoco !== false && eventFields.playerMissing) {
    eventFields.playerMissing.focus();
  }
}

function setBusquedaJugadorBusy(isBusy) {
  eventFields.missingSearch.disabled = isBusy;
  eventFields.createPlayer.disabled =
    isBusy || !busquedaJugadorEvento || !eventFields.createConfirm.checked;
  eventFields.missingClose.disabled = isBusy;
}

async function buscarJugadorNoEncontrado() {
  const contexto = contextoJugadorEvento();
  const nombre = eventFields.missingName.value.trim();
  if (!nombre) {
    throw new Error("Ingresa un nombre para buscar.");
  }

  const params = new URLSearchParams({
    scope: "buscar-jugador",
    torneo_id: String(contexto.torneoId),
    partido_id: String(contexto.partido.id),
    equipo_id: String(contexto.equipoId),
    nombre
  });

  setBusquedaJugadorBusy(true);
  eventFields.missingResults.textContent = "Buscando candidatos...";
  eventFields.createPlayerBlock.classList.add("hidden");

  try {
    const data = await apiRequest(
      "GET",
      null,
      `${EVENTS_API_URL}?${params.toString()}`
    );
    busquedaJugadorEvento = {
      ...data,
      contexto
    };
    renderResultadosJugadorNoEncontrado();
  } finally {
    setBusquedaJugadorBusy(false);
  }
}

function renderResultadosJugadorNoEncontrado() {
  const data = busquedaJugadorEvento;
  const candidatos = Array.isArray(data?.candidatos)
    ? data.candidatos
    : [];

  if (!data) {
    eventFields.missingResults.textContent =
      "Busca candidatos antes de crear.";
    eventFields.createPlayerBlock.classList.add("hidden");
    return;
  }

  if (candidatos.length === 0) {
    eventFields.missingResults.innerHTML = `
      <div class="analytics-empty">
        No hay candidatos para ${escapeHtml(data.nombre)}.
      </div>
    `;
  } else {
    eventFields.missingResults.innerHTML = `
      <div class="event-player-state" data-type="warn">
        Puede existir un jugador con un nombre similar.
      </div>
      ${candidatos.map(renderCandidatoJugadorEvento).join("")}
    `;
  }

  eventFields.createSummary.textContent = [
    `Nombre canonico: ${data.nombre}`,
    `Club: ${data.contexto.equipoNombre}`,
    `Torneo: ${data.contexto.torneoNombre}`
  ].join(" | ");
  eventFields.createPlayerBlock.classList.remove("hidden");
  actualizarBotonCrearJugadorEvento();
}

function renderCandidatoJugadorEvento(candidato) {
  const jugador = candidato.jugador || {};
  const inscripcionContexto = candidato.inscripcion_contexto;
  const accion = inscripcionContexto
    ? `
      <button
        type="button"
        data-event-use-inscription="${inscripcionContexto.id}"
      >
        Seleccionar inscripcion
      </button>
    `
    : `
      <button
        type="button"
        data-event-create-enrollment="${jugador.id}"
        ${jugador.activo === false ? "disabled" : ""}
      >
        Crear inscripcion
      </button>
    `;

  return `
    <div class="event-candidate">
      ${renderResumenJugadorCandidato(candidato)}
      <div class="event-candidate-actions">
        ${accion}
      </div>
    </div>
  `;
}

function actualizarBotonCrearJugadorEvento() {
  eventFields.createPlayer.disabled =
    !busquedaJugadorEvento || !eventFields.createConfirm.checked;
}

async function usarInscripcionJugadorEvento(inscripcionId, message) {
  await cargarJugadoresIncidencia(
    inscripcionId,
    eventFields.relatedPlayer.value
  );
  eventFields.player.value = String(inscripcionId);
  cerrarFlujoJugadorNoEncontrado({ devolverFoco: false });
  eventFields.playerSearch.focus();
  setEventFeedback(message || "Jugador seleccionado.", "ok");
  setEventSaving(false);
}

async function crearInscripcionParaCandidato(jugadorId) {
  const contexto = contextoJugadorEvento();
  setBusquedaJugadorBusy(true);
  eventFields.missingResults.insertAdjacentHTML(
    "afterbegin",
    `<div class="event-player-state">Creando inscripcion...</div>`
  );

  try {
    const data = await apiRequest("POST", {
      action: "crear-inscripcion-jugador",
      torneo_id: contexto.torneoId,
      partido_id: contexto.partido.id,
      equipo_id: contexto.equipoId,
      jugador_id: Number(jugadorId),
      busqueda_previa: true,
      confirmar_inscripcion: true,
      fuente: valorTexto(eventFields.source)
    }, EVENTS_API_URL);
    await cargarPlantelesAdmin();
    await usarInscripcionJugadorEvento(
      data.inscripcion.id,
      data.existente
        ? "Ya existe una inscripcion para este jugador."
        : "Inscripcion creada."
    );
  } finally {
    setBusquedaJugadorBusy(false);
  }
}

async function crearJugadorDesdeBusqueda() {
  const contexto = contextoJugadorEvento();
  if (!busquedaJugadorEvento) {
    throw new Error("Busca candidatos antes de crear.");
  }
  if (!eventFields.createConfirm.checked) {
    throw new Error("Confirma que no corresponde a los candidatos.");
  }

  setBusquedaJugadorBusy(true);
  try {
    const data = await apiRequest("POST", {
      action: "crear-jugador-inscripcion",
      torneo_id: contexto.torneoId,
      partido_id: contexto.partido.id,
      equipo_id: contexto.equipoId,
      nombre_completo: busquedaJugadorEvento.nombre,
      busqueda_previa: true,
      confirmar_creacion: true,
      confirmar_homonimo:
        Array.isArray(busquedaJugadorEvento.candidatos) &&
        busquedaJugadorEvento.candidatos.length > 0,
      fuente: valorTexto(eventFields.source)
    }, EVENTS_API_URL);
    await cargarPlantelesAdmin();
    await usarInscripcionJugadorEvento(
      data.inscripcion.id,
      "Jugador e inscripcion creados."
    );
  } finally {
    setBusquedaJugadorBusy(false);
  }
}

function actualizarCamposTipoIncidencia() {
  const esCambio = eventFields.type.value === "cambio";
  eventFields.relatedWrap.classList.toggle("hidden", !esCambio);
  eventFields.playerLabel.textContent = esCambio
    ? "Jugador que sale"
    : "Jugador";

  if (!esCambio) {
    eventFields.relatedPlayer.value = "";
  }
  setEventSaving(false);
}

function inferirEquipoIncidencia(evento, partido) {
  const local = resolverEquipoPartidoAdmin(partido, "local");
  const visitante = resolverEquipoPartidoAdmin(partido, "visitante");

  if (
    [local.id, visitante.id].some(id =>
      String(id) === String(evento.equipo_id)
    )
  ) {
    return evento.equipo_id;
  }

  if (
    String(evento.tipo || "").includes("gol") &&
    partido.goles_local === 0 &&
    Number(partido.goles_visitante) > 0
  ) {
    return visitante.id;
  }

  if (
    String(evento.tipo || "").includes("gol") &&
    partido.goles_visitante === 0 &&
    Number(partido.goles_local) > 0
  ) {
    return local.id;
  }

  return local.id || visitante.id || "";
}

async function iniciarNuevaIncidencia() {
  const partido = partidoIncidenciasSeleccionado();
  if (!partido) {
    setEventFeedback(
      "Selecciona un partido del torneo de trabajo.",
      "error"
    );
    return;
  }

  incidenciaSeleccionadaId = null;
  eventForm.reset();
  eventFields.id.value = "";
  eventFields.type.value = "gol";
  eventFields.period.value = "";
  eventFields.minute.value = "";
  eventFields.dataStatus.value = "por_verificar";
  renderEquiposIncidencia(
    resolverEquipoPartidoAdmin(partido, "local").id
  );
  eventFields.playerSearch.value = "";
  await cargarJugadoresIncidencia();
  actualizarCamposTipoIncidencia();
  eventFields.legacyBlock.classList.add("hidden");
  cerrarFlujoJugadorNoEncontrado({ devolverFoco: false });
  deleteEventBtn.classList.add("hidden");

  emptyEventEditor.classList.add("hidden");
  eventForm.classList.remove("hidden");
  setEventFeedback(
    "Se agregará al final de la secuencia del partido."
  );
  renderIncidenciasAdmin();
  setEventSaving(false);
}

async function seleccionarIncidencia(id) {
  const incidencia = incidencias.find(
    item => String(item.id) === String(id)
  );
  if (!incidencia) return;

  const partido = partidos.find(
    item => String(item.id) === String(incidencia.partido_id)
  );
  if (!partidoPerteneceTorneoTrabajo(partido)) {
    setEventFeedback(
      "La incidencia no pertenece al torneo de trabajo.",
      "error"
    );
    return;
  }

  incidenciaSeleccionadaId = incidencia.id;
  eventMatch.value = String(incidencia.partido_id);
  liveMatch.value = String(incidencia.partido_id);
  eventFields.id.value = incidencia.id;
  eventFields.type.value = incidencia.tipo || "gol";
  eventFields.period.value = incidencia.periodo || "";
  eventFields.minute.value = valorInput(incidencia.minuto);
  eventFields.dataStatus.value =
    incidencia.estado_dato || "por_verificar";
  eventFields.source.value = incidencia.fuente || "";
  eventFields.notes.value = incidencia.observaciones || "";

  const equipoId = inferirEquipoIncidencia(incidencia, partido);
  renderEquiposIncidencia(equipoId);
  eventFields.playerSearch.value = "";
  await cargarJugadoresIncidencia(
    incidencia.inscripcion_jugador_id,
    incidencia.inscripcion_relacionada_id
  );
  actualizarCamposTipoIncidencia();

  const esHistorica =
    Boolean(incidencia.jugador) &&
    !incidencia.inscripcion_jugador_id;
  eventFields.legacyBlock.classList.toggle("hidden", !esHistorica);
  eventFields.legacyName.textContent = incidencia.jugador || "";
  cerrarFlujoJugadorNoEncontrado({ devolverFoco: false });
  deleteEventBtn.classList.remove("hidden");

  emptyEventEditor.classList.add("hidden");
  eventForm.classList.remove("hidden");
  setEventFeedback(
    esHistorica
      ? "Evento historico sin jugador vinculado. Podes editar otros campos o vincularlo manualmente."
      : "Modifica los datos disponibles y guarda."
  );
  renderIncidenciasAdmin();
  setEventSaving(false);
}

function valoresFormularioIncidencia() {
  return {
    torneo_id: requerirTorneoTrabajoId(),
    id: eventFields.id.value || null,
    partido_id: Number(eventMatch.value),
    tipo: eventFields.type.value,
    equipo_id: Number(eventFields.team.value),
    periodo: eventFields.period.value || null,
    minuto: valorNumero(eventFields.minute),
    inscripcion_jugador_id: eventFields.player.value || null,
    inscripcion_relacionada_id:
      eventFields.type.value === "cambio"
        ? eventFields.relatedPlayer.value || null
        : null,
    estado_dato: eventFields.dataStatus.value,
    fuente: valorTexto(eventFields.source),
    observaciones: valorTexto(eventFields.notes)
  };
}

function validarIncidencia(valores) {
  if (!valores.partido_id || !valores.equipo_id) {
    throw new Error("Partido y equipo son obligatorios.");
  }
  if (
    valores.minuto !== null &&
    (
      !Number.isInteger(valores.minuto) ||
      valores.minuto < 1 ||
      valores.minuto > 130
    )
  ) {
    throw new Error("El minuto debe estar entre 1 y 130.");
  }
  if (
    valores.estado_dato === "confirmado" &&
    !valores.fuente
  ) {
    throw new Error(
      "Una incidencia confirmada debe tener una fuente."
    );
  }
  if (
    valores.tipo !== "cambio" &&
    !valores.inscripcion_jugador_id &&
    !incidenciaActualHistoricaSinVincular()
  ) {
    throw new Error(
      "Selecciona una inscripcion de jugador."
    );
  }
  if (
    valores.tipo === "cambio" &&
    (
      !valores.inscripcion_jugador_id ||
      !valores.inscripcion_relacionada_id
    ) &&
    !(
      incidenciaActualHistoricaSinVincular() &&
      !valores.inscripcion_jugador_id &&
      !valores.inscripcion_relacionada_id
    )
  ) {
    throw new Error(
      "Seleccioná al jugador que sale y al que entra."
    );
  }
  if (
    valores.inscripcion_jugador_id &&
    valores.inscripcion_jugador_id ===
      valores.inscripcion_relacionada_id
  ) {
    throw new Error(
      "Los jugadores del cambio deben ser diferentes."
    );
  }
}

async function guardarIncidencia(event) {
  event.preventDefault();
  const partido = partidoIncidenciasSeleccionado();
  if (!partido) {
    throw new Error("Selecciona un partido del torneo de trabajo.");
  }
  const valores = valoresFormularioIncidencia();
  validarIncidencia(valores);

  setEventSaving(true);
  setEventFeedback("Guardando incidencia...");

  try {
    const method = valores.id ? "PATCH" : "POST";
    const data = await apiRequest(
      method,
      valores,
      EVENTS_API_URL
    );
    const incidenciaId = data.incidencia?.id;

    await cargarIncidenciasAdmin();
    if (incidenciaId) await seleccionarIncidencia(incidenciaId);

    setEventFeedback(
      data.periodo_omitido
        ? "Incidencia guardada sin el tiempo. Ejecutá incidencias-periodos.sql."
        : data.ajuste_tipo?.motivo === "segunda_amarilla"
        ? "Segunda amarilla detectada: se registró como expulsión."
        : "Incidencia guardada.",
      data.periodo_omitido ? "warn" : "ok"
    );
    setStatus("Incidencias actualizadas.", "ok");
  } finally {
    setEventSaving(false);
  }
}

async function eliminarIncidencia() {
  const torneoId = requerirTorneoTrabajoId();
  const id = Number(eventFields.id.value);
  if (!id) return;
  const incidencia = incidencias.find(
    item => String(item.id) === String(id)
  );
  const partido = incidencia
    ? partidos.find(item =>
        String(item.id) === String(incidencia.partido_id)
      )
    : null;
  if (!partidoPerteneceTorneoTrabajo(partido)) {
    throw new Error("La incidencia no pertenece al torneo de trabajo.");
  }

  const confirmar = window.confirm(
    `Eliminar ${etiquetaTipoIncidencia(incidencia.tipo)} de ` +
    `${nombreParticipanteModo(incidencia)} en ${nombrePartido(partido)} ` +
    `(${etiquetaTorneoTrabajo()})? Esta accion no modifica el resultado.`
  );
  if (!confirmar) return;

  setEventSaving(true);
  setEventFeedback("Eliminando incidencia...");

  try {
    await apiRequest(
      "DELETE",
      { id, torneo_id: torneoId },
      EVENTS_API_URL
    );
    incidenciaSeleccionadaId = null;
    eventForm.classList.add("hidden");
    emptyEventEditor.classList.remove("hidden");
    await cargarIncidenciasAdmin();
    setStatus("Incidencia eliminada.", "ok");
  } finally {
    setEventSaving(false);
  }
}

async function moverIncidencia(id, direction) {
  if (eventReordering) return;

  const visibles = incidenciasVisibles();
  const currentIndex = visibles.findIndex(
    evento => String(evento.id) === String(id)
  );
  const targetIndex = direction === "up"
    ? currentIndex - 1
    : currentIndex + 1;

  if (
    currentIndex < 0 ||
    targetIndex < 0 ||
    targetIndex >= visibles.length
  ) {
    return;
  }

  const partido = partidoIncidenciasSeleccionado();
  if (!partido) return;
  const torneoId = requerirTorneoTrabajoId();

  const ids = visibles.map(evento => Number(evento.id));
  [ids[currentIndex], ids[targetIndex]] =
    [ids[targetIndex], ids[currentIndex]];

  setEventReordering(true);
  setEventFeedback("Guardando nuevo orden...");

  try {
    await apiRequest(
      "PATCH",
      {
        torneo_id: torneoId,
        action: "reordenar",
        partido_id: partido.id,
        ids
      },
      EVENTS_API_URL
    );
    await cargarIncidenciasAdmin();
    setEventFeedback(
      "Orden actualizado. Revisá la secuencia antes de confirmar.",
      "ok"
    );
    setStatus("Secuencia de incidencias actualizada.", "ok");
  } finally {
    setEventReordering(false);
  }
}

function setRecargandoDatos(isReloading) {
  recargaDatosEnCurso = isReloading;
  refreshBtn.disabled = isReloading;
  refreshBtn.textContent = isReloading
    ? "Actualizando…"
    : "Recargar datos";
  refreshBtn.setAttribute("aria-busy", isReloading ? "true" : "false");
}

async function recargarDatosPanel() {
  if (recargaDatosEnCurso) return;
  if (!torneoTrabajoValido()) {
    setStatus("Selecciona un torneo de trabajo antes de recargar.", "warn");
    return;
  }

  const estado = capturarEstadoRecarga();
  const datosPrevios = capturarDatosRecarga();
  const mensajeSeleccionIncompatible =
    "El partido seleccionado ya no está disponible con estos filtros.";

  setRecargandoDatos(true);
  setStatus("Actualizando…");

  try {
    restaurarFiltrosPartidos(estado);
    await cargarPartidos({
      preferirFechaPendiente: false,
      mostrarEstado: false,
      seleccionIncompatibleMensaje: mensajeSeleccionIncompatible
    });
    restaurarFiltrosPartidos(estado);

    await cargarEtapasAdmin();
    await cargarIncidenciasAdmin();

    const sigueDisponible = partidoSeleccionadoCompatibleConFiltros(
      estado.seleccionadoId
    );

    if (sigueDisponible) {
      seleccionarPartido(estado.seleccionadoId, {
        desplazarAEditor: false
      });
    } else if (estado.seleccionadoId) {
      limpiarSeleccionPartido(mensajeSeleccionIncompatible);
      renderLista();
    } else {
      renderLista();
    }

    setStatus(
      `Datos actualizados para ${etiquetaTorneoTrabajo()}.`,
      "ok"
    );
  } catch (error) {
    restaurarDatosRecarga(datosPrevios, estado);
    setStatus(
      `No se pudieron recargar los datos: ${error.message}`,
      "error"
    );
  } finally {
    setRecargandoDatos(false);
    restaurarPosicionPanel(estado);
  }
}

async function cargarPanel() {
  const torneoGuardado = idTorneoDesdeSesion();
  mostrarEstadoSinTorneo(
    "Selecciona un torneo para habilitar partidos e incidencias."
  );
  await cargarTorneosTrabajo();

  await Promise.all([
    cargarAnalitica().catch(error =>
      mostrarAnaliticaNoDisponible(error.message)
    ),
    cargarClubesAdmin().catch(error =>
      mostrarClubesNoDisponibles(error.message)
    )
  ]);

  await cargarPlantelesAdmin().catch(error =>
    mostrarPlantelesNoDisponibles(error.message)
  );

  if (
    torneoGuardado &&
    torneosTrabajo.some(torneo =>
      String(torneo.id) === String(torneoGuardado)
    )
  ) {
    await activarTorneoTrabajo(torneoGuardado, { desdeSesion: true });
    setStatus(
      `Torneo de trabajo: ${etiquetaTorneoTrabajo()}.`,
      "ok"
    );
    return;
  }

  mostrarEstadoSinTorneo(
    "Selecciona un torneo para habilitar partidos e incidencias."
  );
  setStatus("Selecciona un torneo de trabajo.", "warn");
}

async function cargarPartidos(options = {}) {
  const torneoId = requerirTorneoTrabajoId();
  const mostrarEstado = options.mostrarEstado !== false;
  if (mostrarEstado) setStatus("Cargando partidos...");
  const data = await apiRequest(
    "GET",
    null,
    `${API_URL}?torneo_id=${encodeURIComponent(torneoId)}`
  );
  partidos = AdminMatchFlow.sortMatchesForSelector(
    Array.isArray(data.partidos) ? data.partidos : [],
    resolverPartidoPlayoffAdmin
  );
  const partidoFueraDeTorneo = partidos.find(
    partido => !partidoPerteneceTorneoTrabajo(partido)
  );
  if (partidoFueraDeTorneo) {
    partidos = [];
    throw new Error(
      "La respuesta de partidos contiene datos fuera del torneo de trabajo."
    );
  }
  renderFiltrosPartidos({
    preferirFechaPendiente: options.preferirFechaPendiente !== false
  });
  renderLista({
    seleccionIncompatibleMensaje: options.seleccionIncompatibleMensaje
  });
  if (mostrarEstado) {
    setStatus(
      `${partidos.length} partidos cargados para ${etiquetaTorneoTrabajo()}.`,
      "ok"
    );
  }
}

function renderLista(options = {}) {
  if (!torneoTrabajoValido()) {
    matchListSummary.textContent = "Selecciona un torneo para listar partidos.";
    matchList.innerHTML = `
      <div class="empty-list">
        Selecciona un torneo para listar partidos.
      </div>
    `;
    return;
  }

  const visibles = partidosVisiblesSelector();
  limpiarSeleccionIncompatible(
    visibles,
    options.seleccionIncompatibleMensaje
  );
  renderResumenPartidoSeleccionado();
  matchListSummary.textContent =
    `${visibles.length} de ${partidos.length} partido(s) del torneo de trabajo.`;

  if (visibles.length === 0) {
    const sinZona = dateFilter.value && zoneFilter.value
      ? "Esta zona no tiene partidos en esta fecha."
      : "Sin partidos para mostrar con estos filtros.";
    matchList.innerHTML =
      `<div class="empty-list">${escapeHtml(sinZona)}</div>`;
    return;
  }

  matchList.innerHTML = visibles.map(partido => {
    const partidoVisible = resolverPartidoPlayoffAdmin(partido);
    const titulo = partido.tipo === "playoff"
      ? etiquetaPartidoPlayoffAdmin(partido)
      : etiquetaFechaZonaPartido(partido);
    const resultado = tieneResultado(partido)
      ? `${partido.goles_local} - ${partido.goles_visitante}`
      : "Pendiente";
    const estado = partido.estado || "programado";
    const etapaPartido = obtenerEtapaPartidoAdmin(partido);
    const etapaCerrada =
      obtenerEstadoEtapa(etapaPartido)?.estado === "cerrada";
    const programacion = [
      formatearFechaAdmin(partido.fecha_partido),
      partido.hora
    ].filter(Boolean).join(" · ") || "Programación pendiente";

    return `
      <button
        type="button"
        class="match-item ${String(partido.id) === String(seleccionadoId) ? "on" : ""}"
        data-id="${partido.id}"
      >
        <span>${escapeHtml(titulo)}</span>
        <strong>${escapeHtml(nombrePartido(partidoVisible))}</strong>
        <small>${programacion}</small>
        <small>
          ${etiquetaEstadoAdmin(estado)} · ${resultado} · ID #${partido.id}
          ${etapaCerrada ? " · Etapa cerrada" : ""}
        </small>
      </button>
    `;
  }).join("");
}

function seleccionarPartido(id, options = {}) {
  const partido = partidos.find(item => String(item.id) === String(id));
  if (!partido) return;
  if (!partidoPerteneceTorneoTrabajo(partido)) {
    setStatus("El partido no pertenece al torneo de trabajo.", "error");
    setSaveFeedback("Selecciona un partido del torneo de trabajo.", "error");
    return;
  }

  const partidoVisible = resolverPartidoPlayoffAdmin(partido);
  const tieneEquiposSugeridos =
    (!partido.local || !partido.visitante) &&
    partidoVisible.local &&
    partidoVisible.visitante;
  const estadioClubLocal = obtenerEstadioClubLocal(partido);
  const estadioSugerido = !partido.estadio && estadioClubLocal;

  seleccionadoId = partido.id;
  fields.id.value = partido.id;
  fields.local.value = partido.local || partidoVisible.local || "";
  fields.visitante.value =
    partido.visitante || partidoVisible.visitante || "";
  fields.fecha.value = partido.fecha_partido || "";
  fields.hora.value = partido.hora || "";
  fields.estado.value = partido.estado || "programado";
  fields.estadio.value = partido.estadio || estadioClubLocal || "";
  fields.arbitro.value = partido.arbitro || "";
  fields.golesLocal.value = valorInput(partido.goles_local);
  fields.golesVisitante.value = valorInput(partido.goles_visitante);
  fields.penalesLocal.value = valorInput(partido.penales_local);
  fields.penalesVisitante.value = valorInput(partido.penales_visitante);
  const datosSecundarios = [
    `Origen: ${partido.source_local || "-"} / ${partido.source_visitante || "-"}`,
    tieneEquiposSugeridos
      ? "Equipos sugeridos desde las llaves; guardá para fijarlos."
      : "",
    partido.actualizado_en
      ? `Última actualización: ${formatearActualizacion(partido.actualizado_en)}`
      : ""
  ].filter(Boolean).join(" · ");
  fields.sourceInfo.innerHTML = `
    <strong>${escapeHtml(etiquetaTorneoFechaZonaId(partido))}</strong>
    <span>${escapeHtml(nombrePartido(partidoVisible))}</span>
    ${datosSecundarios ? `<small>${escapeHtml(datosSecundarios)}</small>` : ""}
  `;
  partidoOriginal = { ...partido };
  renderResumenPartidoSeleccionado(partido);
  setSaveFeedback(
    estadioSugerido
      ? "Se sugirió el estadio del club local. Guardá para confirmarlo."
      : "Modificá uno o más campos y guardá los cambios."
  );

  if (tieneEquiposSugeridos) {
    setSaveFeedback(
      "El panel completó los equipos desde las llaves. Guardá para dejarlos fijos en la DB."
    );
  }

  emptyEditor.classList.add("hidden");
  matchForm.classList.remove("hidden");
  actualizarBloqueoEditor(partido);
  renderLista();

  if ([...eventMatch.options].some(option =>
    String(option.value) === String(partido.id)
  )) {
    eventMatch.value = String(partido.id);
    liveMatch.value = String(partido.id);
    incidenciaSeleccionadaId = null;
    eventForm.classList.add("hidden");
    emptyEventEditor.classList.remove("hidden");
    resetJugadoresIncidencia("Agrega o elegi una incidencia.");
    renderIncidenciasAdmin();
    renderModoPartido();
  }

  if (options.desplazarAEditor !== false) {
    desplazarAEditorSiNecesario();
  }
}

function obtenerEstadioClubLocal(partido) {
  const club = resolverClubAdmin(partido.local, partido.local_id);
  return club?.estadio || "";
}

function normalizarNombreClubAdmin(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function resolverClubAdmin(nombreClub, clubId = null) {
  const porId = clubes.find(
    club => clubId && String(club.id) === String(clubId)
  );
  if (porId) return porId;

  const clave = normalizarNombreClubAdmin(nombreClub);
  if (!clave) return null;

  return clubes.find(club =>
    [
      club.nombre_oficial,
      club.nombre_corto,
      ...(Array.isArray(club.aliases) ? club.aliases : [])
    ].some(nombre =>
      normalizarNombreClubAdmin(nombre) === clave
    )
  ) || null;
}

function resolverEquipoPartidoAdmin(partido, lado) {
  const partidoVisible = resolverPartidoPlayoffAdmin(partido);
  const nombreEquipo = partidoVisible?.[lado] || "";
  const campoId = lado === "local" ? "local_id" : "visitante_id";
  const club = resolverClubAdmin(nombreEquipo, partidoVisible?.[campoId]);

  return {
    id: club?.id || partidoVisible?.[campoId] || null,
    nombre: nombreEquipo || club?.nombre_oficial || ""
  };
}

function resolverPartidoPlayoffAdmin(partido) {
  if (!partido || partido.tipo !== "playoff") return partido || {};

  const local = partido.local ||
    resolverEquipoOrigenPlayoffAdmin(partido, "local");
  const visitante = partido.visitante ||
    resolverEquipoOrigenPlayoffAdmin(partido, "visitante");
  const invertirFinalVuelta =
    partido.fase === "final" &&
    Number(partido.numero_playoff) === 2 &&
    !partido.local &&
    !partido.visitante;
  const localResuelto = invertirFinalVuelta ? visitante : local;
  const visitanteResuelto = invertirFinalVuelta ? local : visitante;
  const localId =
    partido.local_id ||
    resolverClubAdmin(localResuelto)?.id ||
    null;
  const visitanteId =
    partido.visitante_id ||
    resolverClubAdmin(visitanteResuelto)?.id ||
    null;

  return {
    ...partido,
    local: localResuelto || partido.local || null,
    visitante: visitanteResuelto || partido.visitante || null,
    local_id: localId,
    visitante_id: visitanteId
  };
}

function resolverEquipoOrigenPlayoffAdmin(partido, lado) {
  const origen = buscarPartidoDesdeSourceAdmin(
    lado === "local" ? partido.source_local : partido.source_visitante
  ) || obtenerPartidoOrigenPorLlaveAdmin(partido, lado);

  return obtenerEquipoGanadorPlayoffAdmin(origen);
}

function buscarPartidoDesdeSourceAdmin(source) {
  if (source === null || source === undefined || source === "") {
    return null;
  }

  const valor = String(source).trim();
  if (/^\d+$/.test(valor)) {
    return partidos.find(partido => String(partido.id) === valor) || null;
  }

  const normalizado = valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const fase = [
    ["octavos", "octavos"],
    ["cuartos", "cuartos"],
    ["semifinal", "semifinal"],
    ["semis", "semifinal"],
    ["final", "final"]
  ].find(([texto]) => normalizado.includes(texto))?.[1];
  const numero = Number(normalizado.match(/\d+/)?.[0]);

  if (!fase || !Number.isFinite(numero)) return null;

  return partidos.find(
    partido =>
      partido.tipo === "playoff" &&
      partido.fase === fase &&
      Number(partido.numero_playoff) === numero
  ) || null;
}

function obtenerPartidoOrigenPorLlaveAdmin(partido, lado) {
  if (!partido || partido.tipo !== "playoff") return null;

  const numero = Number(partido.numero_playoff || 1);
  let faseAnterior = null;
  let numeroAnterior = null;

  if (partido.fase === "semifinal") {
    faseAnterior = "cuartos";
    numeroAnterior = lado === "local" ? numero * 2 - 1 : numero * 2;
  }

  if (partido.fase === "final") {
    faseAnterior = "semifinal";
    numeroAnterior = lado === "local" ? 1 : 2;
  }

  if (!faseAnterior || !numeroAnterior) return null;

  return partidos.find(
    item =>
      item.tipo === "playoff" &&
      item.fase === faseAnterior &&
      Number(item.numero_playoff) === numeroAnterior
  ) || null;
}

function obtenerEquipoGanadorPlayoffAdmin(partido) {
  if (
    !partido ||
    partido.goles_local === null ||
    partido.goles_visitante === null
  ) {
    return null;
  }

  if (partido.goles_local > partido.goles_visitante) {
    return partido.local;
  }
  if (partido.goles_visitante > partido.goles_local) {
    return partido.visitante;
  }

  if (
    partido.penales_local !== null &&
    partido.penales_visitante !== null
  ) {
    if (partido.penales_local > partido.penales_visitante) {
      return partido.local;
    }
    if (partido.penales_visitante > partido.penales_local) {
      return partido.visitante;
    }
  }

  return null;
}

function vincularClubesPartidosAdmin() {
  partidos = partidos.map(partido => {
    const local = resolverEquipoPartidoAdmin(partido, "local");
    const visitante = resolverEquipoPartidoAdmin(partido, "visitante");

    return {
      ...partido,
      local_id: local.id,
      visitante_id: visitante.id
    };
  });
}

function valorInput(valor) {
  return valor === null || valor === undefined ? "" : String(valor);
}

function valorTexto(input) {
  const valor = input.value.trim();
  return valor === "" ? null : valor;
}

function valorNumero(input) {
  const valor = input.value.trim();
  return valor === "" ? null : Number(valor);
}

function tieneResultado(partido) {
  return partido.goles_local !== null && partido.goles_visitante !== null;
}

function etiquetaFechaZonaPartido(partido) {
  const fecha = partido?.fecha !== null && partido?.fecha !== undefined
    ? `Fecha ${partido.fecha}`
    : "Fecha pendiente";
  const zona = partido?.zona !== null && partido?.zona !== undefined
    ? `Zona ${partido.zona}`
    : "Zona pendiente";
  return `${fecha} · ${zona}`;
}

function etiquetaTorneoFechaZonaId(partido) {
  return [
    etiquetaTorneoTrabajo(),
    partido?.tipo === "playoff"
      ? etiquetaPartidoPlayoffAdmin(partido)
      : etiquetaFechaZonaPartido(partido),
    partido?.id ? `ID #${partido.id}` : ""
  ].filter(Boolean).join(" · ");
}

function resumenPartidoAdvertencia(partido) {
  const visible = resolverPartidoPlayoffAdmin(partido);
  return `#${partido.id} · ${nombrePartido(visible)}`;
}

function nombrePartido(partido) {
  const partidoVisible = resolverPartidoPlayoffAdmin(partido);
  return `${partidoVisible.local || "Por definir"} vs ${
    partidoVisible.visitante || "Por definir"
  }`;
}

function formatearFechaAdmin(fecha) {
  if (!fecha) return "";
  const [year, month, day] = fecha.split("-");
  return year && month && day ? `${day}/${month}/${year}` : fecha;
}

function formatearActualizacion(fecha) {
  const valor = new Date(fecha);
  if (Number.isNaN(valor.getTime())) return fecha;

  return valor.toLocaleString("es-AR", {
    dateStyle: "short",
    timeStyle: "short"
  });
}

function etiquetaEstadoAdmin(estado) {
  return {
    programado: "Programado",
    en_vivo: "En vivo",
    finalizado: "Finalizado",
    pendiente_resultado: "Pendiente resultado",
    suspendido: "Suspendido",
    postergado: "Postergado"
  }[estado] || estado;
}

function etiquetaFase(fase) {
  return {
    octavos: "Octavos",
    cuartos: "Cuartos",
    semifinal: "Semifinal",
    final: "Final"
  }[fase] || "Playoffs";
}

function etiquetaPartidoPlayoffAdmin(partido) {
  if (partido.fase === "final") {
    return `Final · ${
      Number(partido.numero_playoff) === 2 ? "Vuelta" : "Ida"
    }`;
  }

  return `${etiquetaFase(partido.fase)} ${
    partido.numero_playoff || ""
  }`.trim();
}

function limpiarResultado() {
  fields.golesLocal.value = "";
  fields.golesVisitante.value = "";
  fields.penalesLocal.value = "";
  fields.penalesVisitante.value = "";
}

async function guardarPartido(event) {
  event.preventDefault();
  const torneoId = requerirTorneoTrabajoId();

  const id = fields.id.value;
  if (!id) return;
  if (!partidoPerteneceTorneoTrabajo(partidoOriginal)) {
    throw new Error("El partido no pertenece al torneo de trabajo.");
  }

  const valores = {
    local: valorTexto(fields.local),
    visitante: valorTexto(fields.visitante),
    fecha_partido: valorTexto(fields.fecha),
    hora: valorTexto(fields.hora),
    estado: fields.estado.value,
    estadio: valorTexto(fields.estadio),
    arbitro: valorTexto(fields.arbitro),
    goles_local: valorNumero(fields.golesLocal),
    goles_visitante: valorNumero(fields.golesVisitante),
    penales_local: valorNumero(fields.penalesLocal),
    penales_visitante: valorNumero(fields.penalesVisitante)
  };
  validarCargaPartido(valores);
  ajustarEstadoPorResultado(valores);

  const patch = obtenerCambiosPartido(
    partidoOriginal,
    valores
  );

  if (Object.keys(patch).length === 0) {
    setStatus("No hay cambios para guardar.", "warn");
    setSaveFeedback("No modificaste ningún dato.", "warn");
    return;
  }

  setSaving(true);
  setStatus("Guardando...");
  setSaveFeedback("Guardando cambios...");

  try {
    const data = await apiRequest("PATCH", { id, torneo_id: torneoId, patch });
    const partidoGuardado = data.partido || {};
    const ignorados = data.ignoredFields?.length
      ? ` Campos ignorados porque no existen en DB: ${data.ignoredFields.join(", ")}.`
      : "";
    const estadoDevuelto = partidoGuardado.estado ?? "sin valor";
    const advertenciaEstado =
      Object.hasOwn(patch, "estado") &&
      estadoDevuelto !== patch.estado
      ? ` Estado pedido: ${patch.estado}. Estado en DB: ${estadoDevuelto}.`
      : "";
    const hora = new Date().toLocaleTimeString("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
    const tipo = data.ignoredFields?.length || estadoDevuelto !== patch.estado
      ? "warn"
      : "ok";

    const camposGuardados = (data.savedFields || [])
      .filter(campo => campo !== "actualizado_en")
      .map(etiquetaCampoAdmin)
      .join(", ");
    setStatus(
      `Partido #${id} guardado: ${camposGuardados || "cambios aplicados"}.${advertenciaEstado}${ignorados}`,
      tipo
    );
    setSaveFeedback(
      `Guardado a las ${hora}: ${camposGuardados || "cambios aplicados"}.${advertenciaEstado}${ignorados}`,
      tipo
    );
    await cargarPartidos();
    seleccionarPartido(id, { desplazarAEditor: false });
    setSaveFeedback(
      `Guardado a las ${hora}: ${camposGuardados || "cambios aplicados"}.${advertenciaEstado}${ignorados}`,
      tipo
    );
  } finally {
    setSaving(false);
  }
}

function validarCargaPartido(valores) {
  const golesCargados = [
    valores.goles_local,
    valores.goles_visitante
  ].filter(valor => valor !== null).length;
  const penalesCargados = [
    valores.penales_local,
    valores.penales_visitante
  ].filter(valor => valor !== null).length;

  if (golesCargados === 1) {
    throw new Error(
      "Cargá los goles de ambos equipos o dejá ambos vacíos."
    );
  }
  if (penalesCargados === 1) {
    throw new Error(
      "Cargá los penales de ambos equipos o dejá ambos vacíos."
    );
  }
  if (
    penalesCargados === 2 &&
    (
      golesCargados !== 2 ||
      (
        valores.goles_local !== valores.goles_visitante &&
        !(
          partidoOriginal?.fase === "final" &&
          Number(partidoOriginal?.numero_playoff) === 2
        )
      )
    )
  ) {
    throw new Error(
      "Los penales solo corresponden a un partido empatado o a la vuelta de la final."
    );
  }
  if (
    valores.estado === "finalizado" &&
    golesCargados !== 2
  ) {
    throw new Error(
      "Para marcar el partido como finalizado cargá el resultado."
    );
  }
}

function ajustarEstadoPorResultado(valores) {
  const tieneResultado =
    valores.goles_local !== null &&
    valores.goles_visitante !== null;

  if (tieneResultado && valores.estado === "programado") {
    valores.estado = "finalizado";
    fields.estado.value = "finalizado";
  }
  if (!tieneResultado && valores.estado === "finalizado") {
    valores.estado = "programado";
    fields.estado.value = "programado";
  }
}

function obtenerCambiosPartido(original, valores) {
  if (!original) return valores;

  return Object.fromEntries(
    Object.entries(valores).filter(([campo, valor]) =>
      normalizarComparacion(valor) !==
      normalizarComparacion(original[campo])
    )
  );
}

function normalizarComparacion(valor) {
  return valor === undefined || valor === "" ? null : valor;
}

function etiquetaCampoAdmin(campo) {
  return {
    local: "local",
    visitante: "visitante",
    fecha_partido: "fecha",
    hora: "horario",
    estado: "estado",
    estadio: "estadio",
    arbitro: "árbitro",
    goles_local: "goles local",
    goles_visitante: "goles visitante",
    penales_local: "penales local",
    penales_visitante: "penales visitante",
    local_id: "vínculo del local",
    visitante_id: "vínculo del visitante"
  }[campo] || campo;
}

function cambiarTipoFiltroPartidos() {
  dateFilter.value = "";
  zoneFilter.value = "";
  renderFiltrosPartidos();
  renderLista();
}

function cambiarFechaFiltroPartidos() {
  zoneFilter.value = "";
  renderFiltrosPartidos();
  renderLista();
}

function cambiarFiltroPartidos() {
  renderFiltrosPartidos();
  renderLista();
}

authForm.addEventListener("submit", async event => {
  event.preventDefault();
  sessionStorage.setItem(PASSWORD_KEY, adminPassword.value);
  showApp();

  try {
    await cargarPanel();
  } catch (error) {
    setStatus(error.message, "error");
  }
});

matchList.addEventListener("click", event => {
  const item = event.target.closest("[data-id]");
  if (item) seleccionarPartido(item.dataset.id);
});

matchForm.addEventListener("submit", event => {
  guardarPartido(event).catch(error => {
    setStatus(error.message, "error");
    setSaveFeedback(error.message, "error");
    setSaving(false);
  });
});

typeFilter.addEventListener("change", cambiarTipoFiltroPartidos);
dateFilter.addEventListener("change", cambiarFechaFiltroPartidos);
zoneFilter.addEventListener("change", cambiarFiltroPartidos);
statusFilter.addEventListener("change", cambiarFiltroPartidos);
searchInput.addEventListener("input", renderLista);
workTournamentSelect.addEventListener("change", () => {
  const torneoId = workTournamentSelect.value;
  if (!torneoId) {
    mostrarEstadoSinTorneo(
      "Selecciona un torneo para habilitar partidos e incidencias."
    );
    setStatus("Selecciona un torneo de trabajo.", "warn");
    return;
  }

  activarTorneoTrabajo(torneoId).catch(error => {
    setStatus(error.message, "error");
    setWorkTournamentFeedback(error.message, "error");
    mostrarEstadoSinTorneo(error.message);
  });
});
refreshBtn.addEventListener("click", () => {
  recargarDatosPanel().catch(error => setStatus(error.message, "error"));
});
logoutBtn.addEventListener("click", () => {
  sessionStorage.removeItem(PASSWORD_KEY);
  sessionStorage.removeItem(WORK_TOURNAMENT_KEY);
  showAuth();
});
clearScoreBtn.addEventListener("click", limpiarResultado);
stageAdminSelect.addEventListener("change", renderEtapaSeleccionada);
closeStageBtn.addEventListener("click", () => {
  cerrarEtapaSeleccionada().catch(error => {
    stageFeedback.textContent = error.message;
    stageFeedback.dataset.type = "error";
    setStatus(error.message, "error");
    setEtapaProcesando(false);
  });
});
reopenStageBtn.addEventListener("click", () => {
  reabrirEtapaSeleccionada().catch(error => {
    stageFeedback.textContent = error.message;
    stageFeedback.dataset.type = "error";
    setStatus(error.message, "error");
    setEtapaProcesando(false);
  });
});
backupList.addEventListener("click", event => {
  const downloadButton = event.target.closest("[data-download-backup]");
  if (downloadButton) {
    descargarRespaldo(downloadButton.dataset.downloadBackup).catch(error => {
      stageFeedback.textContent = error.message;
      stageFeedback.dataset.type = "error";
      setStatus(error.message, "error");
    });
    return;
  }

  const button = event.target.closest("[data-restore-backup]");
  if (!button) return;

  restaurarRespaldo(button.dataset.restoreBackup).catch(error => {
    stageFeedback.textContent = error.message;
    stageFeedback.dataset.type = "error";
    setStatus(error.message, "error");
    setEtapaProcesando(false);
  });
});
clubList.addEventListener("click", event => {
  const item = event.target.closest("[data-club-id]");
  if (item) seleccionarClub(item.dataset.clubId);
});
clubForm.addEventListener("submit", event => {
  guardarClub(event).catch(error => {
    setClubFeedback(error.message, "error");
    setStatus(error.message, "error");
    setClubSaving(false);
  });
});
rosterTournament.addEventListener("change", () => {
  inscripcionSeleccionadaId = null;
  resetBusquedaPlantel();
  toggleRosterBtn.classList.add("hidden");
  rosterForm.classList.add("hidden");
  emptyRosterEditor.classList.remove("hidden");
  renderPlantel();
});
rosterClub.addEventListener("change", () => {
  inscripcionSeleccionadaId = null;
  resetBusquedaPlantel();
  toggleRosterBtn.classList.add("hidden");
  rosterForm.classList.add("hidden");
  emptyRosterEditor.classList.remove("hidden");
  renderPlantel();
});
newRosterBtn.addEventListener("click", iniciarNuevaInscripcion);
rosterList.addEventListener("click", event => {
  const item = event.target.closest("[data-enrollment-id]");
  if (item) seleccionarInscripcion(item.dataset.enrollmentId);
});
rosterFields.search.addEventListener("input", () => {
  if (rosterFields.search.value.trim().length < 2) {
    resetBusquedaPlantel("Escribí al menos 2 letras");
    return;
  }
  programarBusquedaPlantel();
});
rosterFields.search.addEventListener("keydown", event => {
  if (event.key === "ArrowDown") {
    event.preventDefault();
    enfocarResultadoPlantel(1);
  }
});
rosterFields.searchResults.addEventListener("keydown", event => {
  if (event.key === "ArrowDown") {
    event.preventDefault();
    enfocarResultadoPlantel(1);
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    enfocarResultadoPlantel(-1);
  }
});
rosterFields.searchResults.addEventListener("click", event => {
  const button = event.target.closest("[data-roster-candidate]");
  if (button) seleccionarCandidatoPlantel(button.dataset.rosterCandidate);
});
rosterFields.selectedPlayer.addEventListener("click", event => {
  const existing = event.target.closest("[data-roster-open-existing]");
  if (existing) {
    seleccionarInscripcion(existing.dataset.rosterOpenExisting);
    return;
  }

  if (event.target.closest("[data-roster-create-enrollment]")) {
    crearInscripcionPlantelSeleccionado().catch(error => {
      setRosterFeedback(error.message, "error");
      setStatus(error.message, "error");
      setRosterSaving(false);
    });
  }
});
rosterFields.createNew.addEventListener("click", abrirCreacionJugadorPlantel);
rosterFields.playerName.addEventListener("input", () => {
  actualizarResumenCreacionPlantel();
  actualizarBotonCrearJugadorPlantel();
});
rosterFields.createConfirm.addEventListener(
  "change",
  actualizarBotonCrearJugadorPlantel
);
rosterFields.createPlayer.addEventListener("click", () => {
  crearJugadorPlantelNuevo().catch(error => {
    setRosterFeedback(error.message, "error");
    setStatus(error.message, "error");
    setRosterSaving(false);
  });
});
rosterForm.addEventListener("submit", event => {
  guardarInscripcionJugador(event).catch(error => {
    setRosterFeedback(error.message, "error");
    setStatus(error.message, "error");
    setRosterSaving(false);
  });
});
toggleRosterBtn.addEventListener("click", () => {
  cambiarEstadoInscripcionJugador().catch(error => {
    setRosterFeedback(error.message, "error");
    setStatus(error.message, "error");
    setRosterSaving(false);
  });
});
eventMatch.addEventListener("change", () => {
  if (eventMatch.value && String(eventMatch.value) !== String(seleccionadoId)) {
    seleccionarPartido(eventMatch.value, { desplazarAEditor: false });
    return;
  }
  if (!eventMatch.value) {
    limpiarSeleccionPartido("Elegí un partido para continuar.");
    return;
  }
  incidenciaSeleccionadaId = null;
  eventForm.classList.add("hidden");
  emptyEventEditor.classList.remove("hidden");
  resetJugadoresIncidencia("Agrega o elegi una incidencia.");
  liveMatch.value = eventMatch.value;
  renderIncidenciasAdmin();
  renderModoPartido();
});
liveMatch.addEventListener("change", () => {
  if (liveMatch.value && String(liveMatch.value) !== String(seleccionadoId)) {
    seleccionarPartido(liveMatch.value, { desplazarAEditor: false });
    return;
  }
  if (!liveMatch.value) {
    limpiarSeleccionPartido("Elegí un partido para continuar.");
    return;
  }
  eventMatch.value = liveMatch.value;
  incidenciaSeleccionadaId = null;
  eventForm.classList.add("hidden");
  emptyEventEditor.classList.remove("hidden");
  resetJugadoresIncidencia("Agrega o elegi una incidencia.");
  renderIncidenciasAdmin();
  renderModoPartido();
});
liveLocalActions.addEventListener("click", event => {
  const button = event.target.closest("[data-live-action]");
  if (button) {
    abrirSelectorModo(
      button.dataset.liveSide,
      button.dataset.liveAction
    );
  }
});
liveAwayActions.addEventListener("click", event => {
  const button = event.target.closest("[data-live-action]");
  if (button) {
    abrirSelectorModo(
      button.dataset.liveSide,
      button.dataset.liveAction
    );
  }
});
livePlayerGrid.addEventListener("click", event => {
  const button = event.target.closest("[data-live-player]");
  if (!button) return;

  seleccionarJugadorModo(button.dataset.livePlayer).catch(error => {
    setLiveFeedback(error.message, "error");
    setStatus(error.message, "error");
    setLiveBusy(false);
  });
});
livePicker.addEventListener("click", event => {
  if (event.target.closest("[data-live-close]")) {
    cerrarSelectorModo();
  }
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && !livePicker.classList.contains("hidden")) {
    cerrarSelectorModo();
  } else if (
    event.key === "Escape" &&
    !eventFields.missingFlow.classList.contains("hidden")
  ) {
    cerrarFlujoJugadorNoEncontrado();
  }
});
liveUndoBtn.addEventListener("click", () => {
  deshacerUltimaAccionModo().catch(error => {
    setLiveFeedback(error.message, "error");
    setStatus(error.message, "error");
    setLiveBusy(false);
  });
});
liveFinishBtn.addEventListener("click", () => {
  finalizarPartidoModo().catch(error => {
    setLiveFeedback(error.message, "error");
    setStatus(error.message, "error");
    setLiveBusy(false);
  });
});
newEventBtn.addEventListener("click", () => {
  iniciarNuevaIncidencia().catch(error => {
    setEventFeedback(error.message, "error");
    setStatus(error.message, "error");
    setEventSaving(false);
  });
});
eventList.addEventListener("click", event => {
  const moveButton = event.target.closest("[data-move-event]");
  if (moveButton) {
    moverIncidencia(
      moveButton.dataset.moveEvent,
      moveButton.dataset.direction
    ).catch(error => {
      setEventFeedback(error.message, "error");
      setStatus(error.message, "error");
      setEventReordering(false);
    });
    return;
  }

  const item = event.target.closest("[data-event-id]");
  if (item) {
    seleccionarIncidencia(item.dataset.eventId).catch(error => {
      setEventFeedback(error.message, "error");
      setStatus(error.message, "error");
      setEventSaving(false);
    });
  }
});
eventFields.team.addEventListener("change", () => {
  eventFields.playerSearch.value = "";
  cargarJugadoresIncidencia().catch(error => {
    setEventFeedback(error.message, "error");
    setStatus(error.message, "error");
    setEventSaving(false);
  });
});
eventFields.playerSearch.addEventListener("input", () => {
  renderJugadoresIncidencia(
    eventFields.player.value,
    eventFields.relatedPlayer.value
  );
});
eventFields.playerResults.addEventListener("click", event => {
  const button = event.target.closest("[data-event-player]");
  if (!button) return;
  eventFields.player.value = button.dataset.eventPlayer;
  renderJugadoresIncidencia(
    eventFields.player.value,
    eventFields.relatedPlayer.value
  );
});
eventFields.relatedResults.addEventListener("click", event => {
  const button = event.target.closest("[data-event-related-player]");
  if (!button) return;
  eventFields.relatedPlayer.value = button.dataset.eventRelatedPlayer;
  renderJugadoresIncidencia(
    eventFields.player.value,
    eventFields.relatedPlayer.value
  );
});
eventFields.player.addEventListener("change", () => setEventSaving(false));
eventFields.relatedPlayer.addEventListener(
  "change",
  () => setEventSaving(false)
);
eventFields.type.addEventListener(
  "change",
  actualizarCamposTipoIncidencia
);
eventFields.playerMissing.addEventListener("click", () => {
  abrirFlujoJugadorNoEncontrado();
});
eventFields.linkLegacy.addEventListener("click", () => {
  abrirFlujoJugadorNoEncontrado(eventFields.legacyName.textContent);
});
eventFields.missingClose.addEventListener("click", () => {
  cerrarFlujoJugadorNoEncontrado();
});
eventFields.missingSearch.addEventListener("click", () => {
  buscarJugadorNoEncontrado().catch(error => {
    eventFields.missingResults.textContent = error.message;
    setEventFeedback(error.message, "error");
    setBusquedaJugadorBusy(false);
  });
});
eventFields.missingName.addEventListener("keydown", event => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  buscarJugadorNoEncontrado().catch(error => {
    eventFields.missingResults.textContent = error.message;
    setEventFeedback(error.message, "error");
    setBusquedaJugadorBusy(false);
  });
});
eventFields.missingResults.addEventListener("click", event => {
  const useButton = event.target.closest("[data-event-use-inscription]");
  if (useButton) {
    usarInscripcionJugadorEvento(
      useButton.dataset.eventUseInscription,
      "Jugador seleccionado."
    ).catch(error => {
      eventFields.missingResults.textContent = error.message;
      setEventFeedback(error.message, "error");
      setBusquedaJugadorBusy(false);
    });
    return;
  }

  const createButton = event.target.closest("[data-event-create-enrollment]");
  if (createButton) {
    crearInscripcionParaCandidato(
      createButton.dataset.eventCreateEnrollment
    ).catch(error => {
      eventFields.missingResults.textContent = error.message;
      setEventFeedback(error.message, "error");
      setBusquedaJugadorBusy(false);
    });
  }
});
eventFields.createConfirm.addEventListener(
  "change",
  actualizarBotonCrearJugadorEvento
);
eventFields.createPlayer.addEventListener("click", () => {
  crearJugadorDesdeBusqueda().catch(error => {
    eventFields.missingResults.textContent = error.message;
    setEventFeedback(error.message, "error");
    setBusquedaJugadorBusy(false);
  });
});
eventForm.addEventListener("submit", event => {
  guardarIncidencia(event).catch(error => {
    setEventFeedback(error.message, "error");
    setStatus(error.message, "error");
    setEventSaving(false);
  });
});
deleteEventBtn.addEventListener("click", () => {
  eliminarIncidencia().catch(error => {
    setEventFeedback(error.message, "error");
    setStatus(error.message, "error");
    setEventSaving(false);
  });
});

if (getPassword()) {
  showApp();
  cargarPanel().catch(error => setStatus(error.message, "error"));
} else {
  showAuth();
}
