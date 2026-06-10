const API_URL = "/.netlify/functions/admin-partidos";
const ANALYTICS_API_URL = "/.netlify/functions/admin-analytics";
const PASSWORD_KEY = "tp_admin_password";

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
  saveBtn.disabled = isSaving;
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

async function cargarPanel() {
  await cargarPartidos();

  try {
    await cargarAnalitica();
  } catch (error) {
    mostrarAnaliticaNoDisponible(error.message);
  }
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
        <small>${resultado} · ${etiquetaEstadoAdmin(estado)}</small>
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

if (getPassword()) {
  showApp();
  cargarPanel().catch(error => setStatus(error.message, "error"));
} else {
  showAuth();
}
