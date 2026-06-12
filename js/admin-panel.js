const API_URL = "/.netlify/functions/admin-partidos";
const ANALYTICS_API_URL = "/.netlify/functions/admin-analytics";
const STAGES_API_URL = "/.netlify/functions/admin-etapas";
const CLUBS_API_URL = "/.netlify/functions/admin-clubes";
const ROSTERS_API_URL = "/.netlify/functions/admin-planteles";
const EVENTS_API_URL = "/.netlify/functions/admin-incidencias";
const PASSWORD_KEY = "tp_admin_password";
const PLAYOFF_STAGES = [
  { value: "octavos", label: "Octavos de Final" },
  { value: "cuartos", label: "Cuartos de Final" },
  { value: "semifinal", label: "Semifinales" },
  { value: "final", label: "Final" }
];

const authCard = document.getElementById("authCard");
const authForm = document.getElementById("authForm");
const adminPassword = document.getElementById("adminPassword");
const adminApp = document.getElementById("adminApp");
const statusBox = document.getElementById("statusBox");
const matchList = document.getElementById("matchList");
const matchForm = document.getElementById("matchForm");
const emptyEditor = document.getElementById("emptyEditor");
const typeFilter = document.getElementById("typeFilter");
const searchInput = document.getElementById("searchInput");
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
  playerName: document.getElementById("rosterPlayerName"),
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
  minute: document.getElementById("eventMinute"),
  player: document.getElementById("eventPlayer"),
  playerLabel: document.getElementById("eventPlayerLabel"),
  relatedWrap: document.getElementById("eventRelatedWrap"),
  relatedPlayer: document.getElementById("eventRelatedPlayer"),
  legacyBlock: document.getElementById("eventLegacyBlock"),
  legacyName: document.getElementById("eventLegacyName"),
  createLegacy: document.getElementById("eventCreateLegacy"),
  dataStatus: document.getElementById("eventDataStatus"),
  source: document.getElementById("eventSource"),
  notes: document.getElementById("eventNotes")
};

let partidos = [];
let clubes = [];
let torneos = [];
let jugadores = [];
let inscripcionesJugadores = [];
let incidencias = [];
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
  saveBtn.disabled = isSaving || partidoSeleccionadoCerrado();
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
  saveRosterBtn.disabled = isSaving;
  saveRosterBtn.textContent = isSaving
    ? "Guardando..."
    : "Guardar inscripción";
}

function setRosterFeedback(message, type = "info") {
  rosterFeedback.textContent = message;
  rosterFeedback.dataset.type = type;
}

function setEventSaving(isSaving) {
  saveEventBtn.disabled = isSaving;
  deleteEventBtn.disabled = isSaving;
  saveEventBtn.textContent = isSaving
    ? "Guardando..."
    : "Guardar incidencia";
}

function setEventFeedback(message, type = "info") {
  eventFeedback.textContent = message;
  eventFeedback.dataset.type = type;
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
  const data = await apiRequest("GET", null, STAGES_API_URL);
  etapasEstado = Array.isArray(data.etapas) ? data.etapas : [];
  respaldosEtapa = Array.isArray(data.respaldos) ? data.respaldos : [];
  etapasHabilitadas = true;
  renderControlEtapas();
}

function mostrarEtapasNoDisponibles(message) {
  etapasHabilitadas = false;
  etapasEstado = [];
  respaldosEtapa = [];
  stageAdminSelect.innerHTML =
    `<option>Configuración pendiente</option>`;
  stageAdminSelect.disabled = true;
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
  const fechas = [
    ...new Set(
      partidos
        .filter(partido => partido.tipo === "regular")
        .map(partido => Number(partido.fecha))
        .filter(Number.isFinite)
    )
  ]
    .sort((a, b) => a - b)
    .map(fecha => ({
      key: `regular:${fecha}`,
      tipo: "regular",
      valor: String(fecha),
      etiqueta: `Fecha ${fecha}`
    }));

  const fases = PLAYOFF_STAGES
    .filter(fase =>
      partidos.some(partido =>
        partido.tipo === "playoff" &&
        partido.fase === fase.value
      )
    )
    .map(fase => ({
      key: `playoff:${fase.value}`,
      tipo: "playoff",
      valor: fase.value,
      etiqueta: fase.label
    }));

  return [...fechas, ...fases];
}

function renderControlEtapas() {
  etapasDisponibles = obtenerEtapasDisponiblesAdmin();
  const seleccionAnterior = stageAdminSelect.value;

  if (etapasDisponibles.length === 0) {
    stageAdminSelect.innerHTML = `<option>Sin etapas disponibles</option>`;
    stageAdminSelect.disabled = true;
    closeStageBtn.disabled = true;
    reopenStageBtn.disabled = true;
    stageState.textContent = "Sin datos";
    stageState.dataset.state = "";
    stageValidation.textContent =
      "No hay fechas ni fases cargadas para controlar.";
    stageValidation.dataset.type = "warn";
    renderRespaldos();
    return;
  }

  stageAdminSelect.innerHTML = etapasDisponibles
    .map(etapa =>
      `<option value="${etapa.key}">${etapa.etiqueta}</option>`
    )
    .join("");
  stageAdminSelect.disabled = false;

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
    item.tipo === etapa.tipo &&
    String(item.valor) === String(etapa.valor)
  ) || null;
}

function obtenerEtapaPartidoAdmin(partido) {
  if (!partido) return null;

  if (
    partido.tipo === "regular" &&
    partido.fecha !== null &&
    partido.fecha !== undefined
  ) {
    return {
      tipo: "regular",
      valor: String(partido.fecha),
      etiqueta: `Fecha ${partido.fecha}`
    };
  }

  if (partido.tipo === "playoff" && partido.fase) {
    const fase = PLAYOFF_STAGES.find(
      item => item.value === partido.fase
    );
    return {
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
  if (!seleccionado || matchForm.classList.contains("hidden")) return;

  const etapa = obtenerEtapaPartidoAdmin(seleccionado);
  const cerrada = obtenerEstadoEtapa(etapa)?.estado === "cerrada";
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
    control.disabled = cerrada;
  });
  clearScoreBtn.disabled = cerrada;
  saveBtn.disabled = cerrada;

  if (cerrada) {
    setSaveFeedback(
      `${etapa.etiqueta} está cerrada. Reabrila desde el control de etapas para editar.`,
      "warn"
    );
  }
}

function obtenerPartidosEtapa(etapa) {
  if (!etapa) return [];
  return partidos.filter(partido => {
    if (etapa.tipo === "regular") {
      return partido.tipo === "regular" &&
        String(partido.fecha) === String(etapa.valor);
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
  const estado = obtenerEstadoEtapa(etapa);
  const partidosEtapa = obtenerPartidosEtapa(etapa);
  const completos = partidosEtapa.filter(partidoListoParaCierre);
  const faltantes = partidosEtapa.filter(
    partido => !partidoListoParaCierre(partido)
  );
  const cerrada = estado?.estado === "cerrada";

  stageMatchesTotal.textContent = partidosEtapa.length;
  stageMatchesReady.textContent = completos.length;
  stageMatchesPending.textContent = faltantes.length;
  stageState.textContent = cerrada ? "Etapa cerrada" : "Etapa abierta";
  stageState.dataset.state = cerrada ? "closed" : "open";

  if (cerrada) {
    stageValidation.textContent =
      `Cerrada el ${formatearActualizacion(estado.cerrada_en)}. ` +
      "Sus partidos están bloqueados para edición.";
    stageValidation.dataset.type = "ok";
  } else if (faltantes.length === 0 && partidosEtapa.length > 0) {
    stageValidation.textContent =
      "Control completo. La etapa está lista para cerrar y respaldar.";
    stageValidation.dataset.type = "ok";
  } else {
    const ids = faltantes.slice(0, 6).map(
      partido => `#${partido.id}`
    ).join(", ");
    stageValidation.textContent =
      `${faltantes.length} partido(s) todavía requieren equipos, ` +
      `resultado o resolver su estado${ids ? `: ${ids}` : "."}`;
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
    `${STAGES_API_URL}?respaldo_id=${encodeURIComponent(respaldo.id)}`
  );
  const blob = new Blob(
    [JSON.stringify(data, null, 2)],
    { type: "application/json" }
  );
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const etapa = `${respaldo.tipo}-${respaldo.valor}`
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
  renderOpcionesJugadores();
  renderPlantel();
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
  rosterForm.classList.add("hidden");
  emptyRosterEditor.classList.remove("hidden");
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

function renderOpcionesJugadores() {
  const valorActual = rosterFields.playerId.value;
  rosterFields.playerId.innerHTML = `
    <option value="">Crear jugador nuevo</option>
    ${jugadores.map(jugador => `
      <option value="${jugador.id}">
        ${escapeHtml(jugador.nombre_completo)}
      </option>
    `).join("")}
  `;

  if (
    valorActual &&
    jugadores.some(jugador => String(jugador.id) === String(valorActual))
  ) {
    rosterFields.playerId.value = valorActual;
  }
}

function inscripcionesVisibles() {
  return inscripcionesJugadores
    .filter(inscripcion =>
      String(inscripcion.torneo_id) === rosterTournament.value &&
      String(inscripcion.club_id) === rosterClub.value
    )
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

function iniciarNuevaInscripcion() {
  if (!rosterTournament.value || !rosterClub.value) return;

  inscripcionSeleccionadaId = null;
  rosterForm.reset();
  rosterFields.enrollmentId.value = "";
  rosterFields.playerId.disabled = false;
  rosterFields.playerId.value = "";
  rosterFields.playerName.readOnly = false;
  rosterFields.position.value = "sin_definir";
  rosterFields.status.value = "por_verificar";

  emptyRosterEditor.classList.add("hidden");
  rosterForm.classList.remove("hidden");
  setRosterFeedback(
    "Creá una persona nueva o elegí una existente para otra inscripción."
  );
  renderPlantel();
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
  rosterFields.playerId.disabled = true;
  rosterFields.playerName.readOnly = false;
  rosterFields.playerName.value = jugador?.nombre_completo || "";
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

  emptyRosterEditor.classList.add("hidden");
  rosterForm.classList.remove("hidden");
  setRosterFeedback(
    "Los cambios de nombre afectan la identidad del jugador en todos los torneos."
  );
  renderPlantel();
}

function seleccionarJugadorExistente() {
  const jugador = obtenerJugadorPlantel(rosterFields.playerId.value);

  if (!jugador) {
    rosterFields.playerName.readOnly = false;
    rosterFields.playerName.value = "";
    rosterFields.aliases.value = "";
    rosterFields.playerName.focus();
    return;
  }

  rosterFields.playerName.value = jugador.nombre_completo || "";
  rosterFields.aliases.value = Array.isArray(jugador.aliases)
    ? jugador.aliases.join(", ")
    : "";
  rosterFields.playerName.readOnly = true;
}

function valoresFormularioPlantel() {
  return {
    inscripcion_id: rosterFields.enrollmentId.value || null,
    jugador_id: rosterFields.playerId.value || null,
    nombre_completo: valorTexto(rosterFields.playerName),
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

async function cargarIncidenciasAdmin() {
  const partidoPrevio = eventMatch.value;
  const data = await apiRequest("GET", null, EVENTS_API_URL);
  incidencias = Array.isArray(data.incidencias)
    ? data.incidencias
    : [];

  renderOpcionesPartidosIncidencias(partidoPrevio);
  renderIncidenciasAdmin();
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
}

function renderOpcionesPartidosIncidencias(partidoPrevio = "") {
  const ordenados = [...partidos].sort(
    (a, b) =>
      String(b.fecha_partido || "").localeCompare(
        String(a.fecha_partido || "")
      ) ||
      Number(b.id) - Number(a.id)
  );

  eventMatch.innerHTML = ordenados.map(partido => `
    <option value="${partido.id}">
      #${partido.id} · ${escapeHtml(nombrePartido(partido))}
      ${partido.fecha_partido
        ? ` · ${formatearFechaAdmin(partido.fecha_partido)}`
        : ""}
    </option>
  `).join("");

  const sugerido =
    ordenados.find(item =>
      String(item.id) === String(partidoPrevio)
    ) ||
    ordenados.find(item =>
      String(item.id) === String(seleccionadoId)
    ) ||
    ordenados.find(item =>
      incidencias.some(evento =>
        String(evento.partido_id) === String(item.id)
      )
    ) ||
    ordenados[0];

  eventMatch.value = sugerido ? String(sugerido.id) : "";
  newEventBtn.disabled = !sugerido;
}

function partidoIncidenciasSeleccionado() {
  return partidos.find(
    partido => String(partido.id) === eventMatch.value
  ) || null;
}

function incidenciasVisibles() {
  return incidencias
    .filter(evento =>
      String(evento.partido_id) === eventMatch.value
    )
    .sort(
      (a, b) =>
        Number(a.minuto ?? 999) - Number(b.minuto ?? 999) ||
        Number(a.id) - Number(b.id)
    );
}

function renderIncidenciasAdmin() {
  const visibles = incidenciasVisibles();
  eventsTotal.textContent =
    `${visibles.length} ${
      visibles.length === 1 ? "incidencia" : "incidencias"
    }`;

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

  eventList.innerHTML = visibles.map(evento => {
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
      <button
        type="button"
        class="event-admin-item ${
          String(evento.id) === String(incidenciaSeleccionadaId)
            ? "on"
            : ""
        }"
        data-event-id="${evento.id}"
      >
        <span class="event-admin-minute">
          ${evento.minuto ?? "–"}'
        </span>
        <span>
          <strong>${escapeHtml(participante)}</strong>
          <small>
            ${escapeHtml(etiquetaTipoIncidencia(evento.tipo))}
          </small>
        </span>
        <span class="event-admin-state ${estadoClase}">
          ${estado}
        </span>
      </button>
    `;
  }).join("");
}

function etiquetaTipoIncidencia(tipo) {
  return {
    gol: "Gol",
    gol_en_contra: "Gol en contra",
    amarilla: "Tarjeta amarilla",
    doble_amarilla: "Doble amarilla",
    roja: "Tarjeta roja",
    cambio: "Cambio"
  }[tipo] || tipo || "Incidencia";
}

function renderEquiposIncidencia(equipoPreferido = "") {
  const partido = partidoIncidenciasSeleccionado();
  if (!partido) {
    eventFields.team.innerHTML = "";
    return;
  }

  const opciones = [
    { id: partido.local_id, nombre: partido.local },
    { id: partido.visitante_id, nombre: partido.visitante }
  ].filter(item => item.id && item.nombre);

  eventFields.team.innerHTML = opciones.map(item => `
    <option value="${item.id}">
      ${escapeHtml(item.nombre)}
    </option>
  `).join("");

  if (opciones.some(item =>
    String(item.id) === String(equipoPreferido)
  )) {
    eventFields.team.value = String(equipoPreferido);
  }
}

function inscripcionesParaIncidencia() {
  const partido = partidoIncidenciasSeleccionado();
  if (!partido) return [];

  return inscripcionesJugadores
    .filter(inscripcion =>
      String(inscripcion.club_id) === eventFields.team.value &&
      String(inscripcion.torneo_id) === String(partido.torneo_id)
    )
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

function renderJugadoresIncidencia(
  jugadorPreferido = "",
  relacionadoPreferido = ""
) {
  const disponibles = inscripcionesParaIncidencia();
  const opciones = `
    <option value="">Jugador no informado</option>
    ${disponibles.map(inscripcion => {
      const jugador = obtenerJugadorPlantel(inscripcion.jugador_id);
      const estado = inscripcion.estado === "confirmado"
        ? ""
        : " · por verificar";
      return `
        <option value="${inscripcion.id}">
          ${escapeHtml(jugador?.nombre_completo || "Sin nombre")}${estado}
        </option>
      `;
    }).join("")}
  `;

  eventFields.player.innerHTML = opciones;
  eventFields.relatedPlayer.innerHTML = opciones;

  if (disponibles.some(item =>
    String(item.id) === String(jugadorPreferido)
  )) {
    eventFields.player.value = String(jugadorPreferido);
  }
  if (disponibles.some(item =>
    String(item.id) === String(relacionadoPreferido)
  )) {
    eventFields.relatedPlayer.value = String(relacionadoPreferido);
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
}

function inferirEquipoIncidencia(evento, partido) {
  if (
    [partido.local_id, partido.visitante_id].some(id =>
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
    return partido.visitante_id;
  }

  if (
    String(evento.tipo || "").includes("gol") &&
    partido.goles_visitante === 0 &&
    Number(partido.goles_local) > 0
  ) {
    return partido.local_id;
  }

  return partido.local_id || partido.visitante_id || "";
}

function iniciarNuevaIncidencia() {
  const partido = partidoIncidenciasSeleccionado();
  if (!partido) return;

  incidenciaSeleccionadaId = null;
  eventForm.reset();
  eventFields.id.value = "";
  eventFields.type.value = "gol";
  eventFields.dataStatus.value = "por_verificar";
  renderEquiposIncidencia(partido.local_id);
  renderJugadoresIncidencia();
  actualizarCamposTipoIncidencia();
  eventFields.legacyBlock.classList.add("hidden");
  deleteEventBtn.classList.add("hidden");

  emptyEventEditor.classList.add("hidden");
  eventForm.classList.remove("hidden");
  setEventFeedback(
    "Elegí un jugador del plantel o dejalo como no informado."
  );
  renderIncidenciasAdmin();
}

function seleccionarIncidencia(id) {
  const incidencia = incidencias.find(
    item => String(item.id) === String(id)
  );
  if (!incidencia) return;

  const partido = partidos.find(
    item => String(item.id) === String(incidencia.partido_id)
  );
  if (!partido) return;

  incidenciaSeleccionadaId = incidencia.id;
  eventMatch.value = String(incidencia.partido_id);
  eventFields.id.value = incidencia.id;
  eventFields.type.value = incidencia.tipo || "gol";
  eventFields.minute.value = valorInput(incidencia.minuto);
  eventFields.dataStatus.value =
    incidencia.estado_dato || "por_verificar";
  eventFields.source.value = incidencia.fuente || "";
  eventFields.notes.value = incidencia.observaciones || "";

  const equipoId = inferirEquipoIncidencia(incidencia, partido);
  renderEquiposIncidencia(equipoId);
  renderJugadoresIncidencia(
    incidencia.inscripcion_jugador_id,
    incidencia.inscripcion_relacionada_id
  );
  actualizarCamposTipoIncidencia();

  const esHistorica =
    Boolean(incidencia.jugador) &&
    !incidencia.inscripcion_jugador_id;
  eventFields.legacyBlock.classList.toggle("hidden", !esHistorica);
  eventFields.legacyName.textContent = incidencia.jugador || "";
  eventFields.createLegacy.checked = false;
  deleteEventBtn.classList.remove("hidden");

  emptyEventEditor.classList.add("hidden");
  eventForm.classList.remove("hidden");
  setEventFeedback(
    esHistorica
      ? "Elegí el equipo y conciliá el nombre histórico."
      : "Modificá los datos disponibles y guardá."
  );
  renderIncidenciasAdmin();
}

function valoresFormularioIncidencia() {
  return {
    id: eventFields.id.value || null,
    partido_id: Number(eventMatch.value),
    tipo: eventFields.type.value,
    equipo_id: Number(eventFields.team.value),
    minuto: valorNumero(eventFields.minute),
    inscripcion_jugador_id: eventFields.player.value || null,
    inscripcion_relacionada_id:
      eventFields.type.value === "cambio"
        ? eventFields.relatedPlayer.value || null
        : null,
    estado_dato: eventFields.dataStatus.value,
    fuente: valorTexto(eventFields.source),
    observaciones: valorTexto(eventFields.notes),
    crear_desde_texto: eventFields.createLegacy.checked
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
      valores.minuto < 0 ||
      valores.minuto > 130
    )
  ) {
    throw new Error("El minuto debe estar entre 0 y 130.");
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
    valores.tipo === "cambio" &&
    (
      !valores.inscripcion_jugador_id ||
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

    if (valores.crear_desde_texto) {
      await cargarPlantelesAdmin();
    }
    await cargarIncidenciasAdmin();
    if (incidenciaId) seleccionarIncidencia(incidenciaId);

    setEventFeedback("Incidencia guardada.", "ok");
    setStatus("Incidencias actualizadas.", "ok");
  } finally {
    setEventSaving(false);
  }
}

async function eliminarIncidencia() {
  const id = Number(eventFields.id.value);
  if (!id) return;

  const confirmar = window.confirm(
    "¿Eliminar esta incidencia? Esta acción no modifica el resultado."
  );
  if (!confirmar) return;

  setEventSaving(true);
  setEventFeedback("Eliminando incidencia...");

  try {
    await apiRequest(
      "DELETE",
      { id },
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

async function cargarPanel() {
  await cargarPartidos();

  await Promise.all([
    cargarAnalitica().catch(error =>
      mostrarAnaliticaNoDisponible(error.message)
    ),
    cargarEtapasAdmin().catch(error =>
      mostrarEtapasNoDisponibles(error.message)
    ),
    cargarClubesAdmin().catch(error =>
      mostrarClubesNoDisponibles(error.message)
    )
  ]);

  await cargarPlantelesAdmin().catch(error =>
    mostrarPlantelesNoDisponibles(error.message)
  );

  await cargarIncidenciasAdmin().catch(error =>
    mostrarIncidenciasNoDisponibles(error.message)
  );
}

async function cargarPartidos() {
  setStatus("Cargando partidos...");
  const data = await apiRequest("GET");
  partidos = Array.isArray(data.partidos) ? data.partidos : [];
  renderLista();
  setStatus(`${partidos.length} partidos cargados.`, "ok");
}

function renderLista() {
  const tipo = typeFilter.value;
  const busqueda = searchInput.value.trim().toLowerCase();

  const visibles = partidos.filter(partido => {
    const coincideTipo = tipo === "all" || partido.tipo === tipo;
    const texto = [
      partido.id,
      partido.fase,
      partido.fecha,
      partido.local,
      partido.visitante
    ].join(" ").toLowerCase();

    return coincideTipo && (!busqueda || texto.includes(busqueda));
  });

  if (visibles.length === 0) {
    matchList.innerHTML = `<div class="empty-list">Sin partidos para mostrar.</div>`;
    return;
  }

  matchList.innerHTML = visibles.map(partido => {
    const titulo = partido.tipo === "playoff"
      ? `${etiquetaFase(partido.fase)} ${partido.numero_playoff || ""}`.trim()
      : `Fecha ${partido.fecha} · Zona ${partido.zona}`;
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
        <span>#${partido.id} · ${titulo}</span>
        <strong>${nombrePartido(partido)}</strong>
        <small>${programacion}</small>
        <small>
          ${resultado} · ${etiquetaEstadoAdmin(estado)}
          ${etapaCerrada ? " · Etapa cerrada" : ""}
        </small>
      </button>
    `;
  }).join("");
}

function seleccionarPartido(id) {
  const partido = partidos.find(item => String(item.id) === String(id));
  if (!partido) return;

  const estadioClubLocal = obtenerEstadioClubLocal(partido);
  const estadioSugerido = !partido.estadio && estadioClubLocal;

  seleccionadoId = partido.id;
  fields.id.value = partido.id;
  fields.local.value = partido.local || "";
  fields.visitante.value = partido.visitante || "";
  fields.fecha.value = partido.fecha_partido || "";
  fields.hora.value = partido.hora || "";
  fields.estado.value = partido.estado || "programado";
  fields.estadio.value = partido.estadio || estadioClubLocal || "";
  fields.arbitro.value = partido.arbitro || "";
  fields.golesLocal.value = valorInput(partido.goles_local);
  fields.golesVisitante.value = valorInput(partido.goles_visitante);
  fields.penalesLocal.value = valorInput(partido.penales_local);
  fields.penalesVisitante.value = valorInput(partido.penales_visitante);
  fields.sourceInfo.textContent = [
    `Origen: ${partido.source_local || "-"} / ${partido.source_visitante || "-"}`,
    partido.actualizado_en
      ? `Última actualización: ${formatearActualizacion(partido.actualizado_en)}`
      : ""
  ].filter(Boolean).join(" · ");
  partidoOriginal = { ...partido };
  setSaveFeedback(
    estadioSugerido
      ? "Se sugirió el estadio del club local. Guardá para confirmarlo."
      : "Modificá uno o más campos y guardá los cambios."
  );

  emptyEditor.classList.add("hidden");
  matchForm.classList.remove("hidden");
  actualizarBloqueoEditor(partido);
  renderLista();

  if ([...eventMatch.options].some(option =>
    String(option.value) === String(partido.id)
  )) {
    eventMatch.value = String(partido.id);
    incidenciaSeleccionadaId = null;
    eventForm.classList.add("hidden");
    emptyEventEditor.classList.remove("hidden");
    renderIncidenciasAdmin();
  }
}

function obtenerEstadioClubLocal(partido) {
  const club = clubes.find(item =>
    String(item.id) === String(partido.local_id) ||
    item.nombre_oficial === partido.local
  );
  return club?.estadio || "";
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

function nombrePartido(partido) {
  return `${partido.local || "Por definir"} vs ${partido.visitante || "Por definir"}`;
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

function limpiarResultado() {
  fields.golesLocal.value = "";
  fields.golesVisitante.value = "";
  fields.penalesLocal.value = "";
  fields.penalesVisitante.value = "";
}

async function guardarPartido(event) {
  event.preventDefault();

  const id = fields.id.value;
  if (!id) return;

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
    const data = await apiRequest("PATCH", { id, patch });
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
    seleccionarPartido(id);
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
      valores.goles_local !== valores.goles_visitante
    )
  ) {
    throw new Error(
      "Los penales solo corresponden cuando el resultado está empatado."
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
    penales_visitante: "penales visitante"
  }[campo] || campo;
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

typeFilter.addEventListener("change", renderLista);
searchInput.addEventListener("input", renderLista);
refreshBtn.addEventListener("click", () => {
  cargarPanel().catch(error => setStatus(error.message, "error"));
});
logoutBtn.addEventListener("click", () => {
  sessionStorage.removeItem(PASSWORD_KEY);
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
  rosterForm.classList.add("hidden");
  emptyRosterEditor.classList.remove("hidden");
  renderPlantel();
});
rosterClub.addEventListener("change", () => {
  inscripcionSeleccionadaId = null;
  rosterForm.classList.add("hidden");
  emptyRosterEditor.classList.remove("hidden");
  renderPlantel();
});
newRosterBtn.addEventListener("click", iniciarNuevaInscripcion);
rosterList.addEventListener("click", event => {
  const item = event.target.closest("[data-enrollment-id]");
  if (item) seleccionarInscripcion(item.dataset.enrollmentId);
});
rosterFields.playerId.addEventListener(
  "change",
  seleccionarJugadorExistente
);
rosterForm.addEventListener("submit", event => {
  guardarInscripcionJugador(event).catch(error => {
    setRosterFeedback(error.message, "error");
    setStatus(error.message, "error");
    setRosterSaving(false);
  });
});
eventMatch.addEventListener("change", () => {
  incidenciaSeleccionadaId = null;
  eventForm.classList.add("hidden");
  emptyEventEditor.classList.remove("hidden");
  renderIncidenciasAdmin();
});
newEventBtn.addEventListener("click", iniciarNuevaIncidencia);
eventList.addEventListener("click", event => {
  const item = event.target.closest("[data-event-id]");
  if (item) seleccionarIncidencia(item.dataset.eventId);
});
eventFields.team.addEventListener("change", () => {
  renderJugadoresIncidencia();
});
eventFields.type.addEventListener(
  "change",
  actualizarCamposTipoIncidencia
);
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
