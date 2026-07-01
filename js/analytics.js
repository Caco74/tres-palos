const ANALYTICS_ENDPOINT = "/.netlify/functions/analytics-event";
const ANALYTICS_EVENTOS = new Set([
  "vista_pestana",
  "vista_partido"
]);
const GOOGLE_ANALYTICS_ID_ACTIVO =
  typeof GOOGLE_ANALYTICS_ID === "string"
    ? GOOGLE_ANALYTICS_ID.trim()
    : "";

let ultimaMetrica = {
  clave: "",
  enviadaEn: 0
};
let ultimaPaginaGoogle = {
  ruta: "",
  enviadaEn: 0
};

inicializarGoogleAnalytics();

function registrarVistaPestana(pestana, origen = "navegacion") {
  registrarMetrica("vista_pestana", {
    objetivo: pestana,
    origen
  });
  registrarPaginaGoogle(
    `/${normalizarSegmentoGoogle(pestana) || "inicio"}`,
    `${tituloVistaGoogle(pestana)} | Tres Palos`
  );
}

function registrarVistaPartido(partidoId, origen = "partidos") {
  const id = normalizarPartidoMetrica(partidoId);

  registrarMetrica("vista_partido", {
    objetivo: "partido",
    partidoId,
    origen
  });

  if (!id) return;

  registrarPaginaGoogle(
    `/partidos/${id}`,
    "Detalle de partido | Tres Palos"
  );
  registrarEventoGoogle("ver_partido", {
    partido_id: id,
    origen: String(origen || "partidos").slice(0, 50)
  });
}

function registrarVistaEquipo(equipo, origen = "equipos") {
  const nombreEquipo = String(equipo || "").trim();
  const segmento = normalizarSegmentoGoogle(nombreEquipo);

  if (!segmento) return;

  registrarPaginaGoogle(
    `/equipos/${segmento}`,
    `${nombreEquipo} | Tres Palos`
  );
  registrarEventoGoogle("ver_equipo", {
    equipo: nombreEquipo.slice(0, 80),
    origen: String(origen || "equipos").slice(0, 50)
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

function inicializarGoogleAnalytics() {
  if (!/^G-[A-Z0-9]+$/i.test(GOOGLE_ANALYTICS_ID_ACTIVO)) return;

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag() {
    window.dataLayer.push(arguments);
  };

  window.gtag("js", new Date());
  window.gtag("config", GOOGLE_ANALYTICS_ID_ACTIVO, {
    send_page_view: false,
    allow_google_signals: false,
    allow_ad_personalization_signals: false
  });

  const script = document.createElement("script");
  script.async = true;
  script.src =
    "https://www.googletagmanager.com/gtag/js?id=" +
    encodeURIComponent(GOOGLE_ANALYTICS_ID_ACTIVO);
  document.head.appendChild(script);
}

function registrarPaginaGoogle(ruta, titulo) {
  if (typeof window.gtag !== "function") return;

  const ahora = Date.now();
  if (
    ultimaPaginaGoogle.ruta === ruta &&
    ahora - ultimaPaginaGoogle.enviadaEn < 800
  ) {
    return;
  }

  ultimaPaginaGoogle = { ruta, enviadaEn: ahora };
  const ubicacion = new URL(window.location.href);
  ubicacion.pathname = ruta;
  ubicacion.search = "";
  ubicacion.hash = "";

  window.gtag("event", "page_view", {
    page_title: titulo,
    page_location: ubicacion.href,
    page_path: ruta
  });
}

function registrarEventoGoogle(evento, parametros = {}) {
  if (typeof window.gtag !== "function") return;
  window.gtag("event", evento, parametros);
}

function normalizarSegmentoGoogle(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function tituloVistaGoogle(vista) {
  return {
    inicio: "Inicio",
    partidos: "Partidos",
    tabla: "Tabla",
    playoffs: "Playoffs",
    equipos: "Equipos"
  }[vista] || "Tres Palos";
}
