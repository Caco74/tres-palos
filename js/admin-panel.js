const API_URL = "/.netlify/functions/admin-partidos";
const ANALYTICS_API_URL = "/.netlify/functions/admin-analytics";
const STAGES_API_URL = "/.netlify/functions/admin-etapas";
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

let partidos = [];
let seleccionadoId = null;
let partidoOriginal = null;
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

async function cargarPanel() {
  await cargarPartidos();

  await Promise.all([
    cargarAnalitica().catch(error =>
      mostrarAnaliticaNoDisponible(error.message)
    ),
    cargarEtapasAdmin().catch(error =>
      mostrarEtapasNoDisponibles(error.message)
    )
  ]);
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

  seleccionadoId = partido.id;
  fields.id.value = partido.id;
  fields.local.value = partido.local || "";
  fields.visitante.value = partido.visitante || "";
  fields.fecha.value = partido.fecha_partido || "";
  fields.hora.value = partido.hora || "";
  fields.estado.value = partido.estado || "programado";
  fields.estadio.value = partido.estadio || "";
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
  setSaveFeedback("Modificá uno o más campos y guardá los cambios.");

  emptyEditor.classList.add("hidden");
  matchForm.classList.remove("hidden");
  actualizarBloqueoEditor(partido);
  renderLista();
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

if (getPassword()) {
  showApp();
  cargarPanel().catch(error => setStatus(error.message, "error"));
} else {
  showAuth();
}
