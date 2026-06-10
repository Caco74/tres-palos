const ANALYTICS_ENDPOINT = "/.netlify/functions/analytics-event";
const ANALYTICS_EVENTOS = new Set([
  "vista_pestana",
  "vista_partido"
]);

let ultimaMetrica = {
  clave: "",
  enviadaEn: 0
};

function registrarVistaPestana(pestana, origen = "navegacion") {
  registrarMetrica("vista_pestana", {
    objetivo: pestana,
    origen
  });
}

function registrarVistaPartido(partidoId, origen = "partidos") {
  registrarMetrica("vista_partido", {
    objetivo: "partido",
    partidoId,
    origen
  });
}

function registrarMetrica(evento, datos = {}) {
  if (!ANALYTICS_EVENTOS.has(evento)) return;

  const payload = {
    evento,
    objetivo: String(datos.objetivo || "").slice(0, 50),
    partido_id: normalizarPartidoMetrica(datos.partidoId),
    origen: String(datos.origen || "").slice(0, 50),
    dispositivo: obtenerTipoDispositivo(),
    ruta: window.location.pathname.slice(0, 120)
  };
  const clave = JSON.stringify(payload);
  const ahora = Date.now();

  if (
    ultimaMetrica.clave === clave &&
    ahora - ultimaMetrica.enviadaEn < 800
  ) {
    return;
  }

  ultimaMetrica = { clave, enviadaEn: ahora };
  enviarMetrica(payload);
}

function normalizarPartidoMetrica(partidoId) {
  const numero = Number(partidoId);
  return Number.isInteger(numero) && numero > 0 ? numero : null;
}

function obtenerTipoDispositivo() {
  if (window.innerWidth <= 600) return "movil";
  if (window.innerWidth <= 1024) return "tablet";
  return "escritorio";
}

function enviarMetrica(payload) {
  const body = JSON.stringify(payload);

  if (navigator.sendBeacon) {
    const data = new Blob([body], { type: "application/json" });
    if (navigator.sendBeacon(ANALYTICS_ENDPOINT, data)) return;
  }

  fetch(ANALYTICS_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body,
    keepalive: true
  }).catch(() => {
    // La medicion nunca debe interrumpir la navegacion.
  });
}
