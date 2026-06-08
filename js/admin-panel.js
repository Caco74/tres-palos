const API_URL = "/.netlify/functions/admin-partidos";
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

const fields = {
  id: document.getElementById("partidoId"),
  local: document.getElementById("localInput"),
  visitante: document.getElementById("visitanteInput"),
  fecha: document.getElementById("fechaInput"),
  hora: document.getElementById("horaInput"),
  estado: document.getElementById("estadoInput"),
  estadio: document.getElementById("estadioInput"),
  golesLocal: document.getElementById("golesLocalInput"),
  golesVisitante: document.getElementById("golesVisitanteInput"),
  penalesLocal: document.getElementById("penalesLocalInput"),
  penalesVisitante: document.getElementById("penalesVisitanteInput"),
  sourceInfo: document.getElementById("sourceInfo")
};

let partidos = [];
let seleccionadoId = null;

function getPassword() {
  return sessionStorage.getItem(PASSWORD_KEY) || "";
}

function setStatus(message, type = "info") {
  statusBox.textContent = message;
  statusBox.dataset.type = type;
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

async function apiRequest(method, body) {
  const response = await fetch(API_URL, {
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

    return `
      <button
        type="button"
        class="match-item ${String(partido.id) === String(seleccionadoId) ? "on" : ""}"
        data-id="${partido.id}"
      >
        <span>#${partido.id} · ${titulo}</span>
        <strong>${nombrePartido(partido)}</strong>
        <small>${resultado} · ${estado}</small>
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
  fields.golesLocal.value = valorInput(partido.goles_local);
  fields.golesVisitante.value = valorInput(partido.goles_visitante);
  fields.penalesLocal.value = valorInput(partido.penales_local);
  fields.penalesVisitante.value = valorInput(partido.penales_visitante);
  fields.sourceInfo.textContent = `Origen: ${partido.source_local || "-"} / ${partido.source_visitante || "-"}`;

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

  const patch = {
    local: valorTexto(fields.local),
    visitante: valorTexto(fields.visitante),
    fecha_partido: valorTexto(fields.fecha),
    hora: valorTexto(fields.hora),
    estado: fields.estado.value,
    estadio: valorTexto(fields.estadio),
    goles_local: valorNumero(fields.golesLocal),
    goles_visitante: valorNumero(fields.golesVisitante),
    penales_local: valorNumero(fields.penalesLocal),
    penales_visitante: valorNumero(fields.penalesVisitante)
  };

  setStatus("Guardando...");
  const data = await apiRequest("PATCH", { id, patch });
  const ignorados = data.ignoredFields?.length
    ? ` Campos ignorados porque no existen en DB: ${data.ignoredFields.join(", ")}.`
    : "";

  setStatus(`Partido #${id} guardado.${ignorados}`, data.ignoredFields?.length ? "warn" : "ok");
  await cargarPartidos();
  seleccionarPartido(id);
}

authForm.addEventListener("submit", async event => {
  event.preventDefault();
  sessionStorage.setItem(PASSWORD_KEY, adminPassword.value);
  showApp();

  try {
    await cargarPartidos();
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
  });
});

typeFilter.addEventListener("change", renderLista);
searchInput.addEventListener("input", renderLista);
refreshBtn.addEventListener("click", () => {
  cargarPartidos().catch(error => setStatus(error.message, "error"));
});
logoutBtn.addEventListener("click", () => {
  sessionStorage.removeItem(PASSWORD_KEY);
  showAuth();
});
clearScoreBtn.addEventListener("click", limpiarResultado);

if (getPassword()) {
  showApp();
  cargarPartidos().catch(error => setStatus(error.message, "error"));
} else {
  showAuth();
}
