let etapaActual = null;
let zonaActual = 1;
let tablaVistaActual = "posiciones";
let tablaPosicionesActual = "1";
let fasePlayoffActiva = null;
let vistaActual = { id: "inicio", navId: "inicio" };
let actualizandoDatos = false;
let cargaPartidosFinalizada = false;
let errorCargaDatos = false;
let mensajeErrorCargaDatos = "";
let ultimaCargaDatos = 0;
let alcanceDatosActual = null;
let equiposComparadorDatos = {
  equipoA: null,
  equipoB: null
};
let torneoTemporalDetalleEquipo = false;
let firmaConflictosParticipantes = "";
let previewTorneoIdSolicitado =
  window.TPPublicTournament?.getPreviewTournamentId(
    window.location.search,
    window.location.hostname
  ) || null;

const VISTAS_PRINCIPALES = [
  "inicio",
  "partidos",
  "tabla",
  "playoffs",
  "equipos"
];

function obtenerVistaDesdeHash() {
  const id = window.location.hash.slice(1).toLowerCase();
  return VISTAS_PRINCIPALES.includes(id) ? id : "inicio";
}

function normalizarSegmentoRuta(valor) {
  if (typeof normalizarSegmentoGoogle === "function") {
    return normalizarSegmentoGoogle(valor);
  }

  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function obtenerParametroTorneoDetalleEquipo() {
  return new URLSearchParams(window.location.search).get("torneo");
}

function obtenerSegmentoEquipoRuta() {
  const partes = window.location.pathname
    .split("/")
    .map(parte => parte.trim())
    .filter(Boolean);

  if (partes[0] !== "equipos" || !partes[1]) return null;

  try {
    return decodeURIComponent(partes[1]);
  } catch (error) {
    return partes[1];
  }
}

function crearCandidatosEquiposRuta() {
  const candidatos = new Map();
  const agregar = (equipo, etiquetas = []) => {
    if (!equipo) return;

    [
      equipo,
      nombre(equipo),
      nombresCortos[equipo],
      ...etiquetas
    ].filter(Boolean).forEach(etiqueta => {
      const slug = normalizarSegmentoRuta(etiqueta);
      if (slug && !candidatos.has(slug)) {
        candidatos.set(slug, equipo);
      }
    });
  };

  Object.keys(nombresCortos).forEach(equipo => {
    agregar(equipo, [nombresCortos[equipo]]);
  });
  Object.values(equiposPorZona).flat().forEach(equipo => agregar(equipo));
  state.clubes.forEach(club => {
    agregar(club.nombre_oficial, [
      club.nombre_corto,
      ...(Array.isArray(club.aliases) ? club.aliases : [])
    ]);
  });
  state.partidosTodos.forEach(partido => {
    agregar(partido.local);
    agregar(partido.visitante);
  });

  return candidatos;
}

function resolverEquipoDesdeSegmentoRuta(segmento) {
  const slug = normalizarSegmentoRuta(segmento);
  if (!slug) return null;

  return crearCandidatosEquiposRuta().get(slug) || null;
}

function obtenerVistaInicialDesdeUrl() {
  const segmentoEquipo = obtenerSegmentoEquipoRuta();

  if (segmentoEquipo) {
    const torneoEquipoClave = obtenerParametroTorneoDetalleEquipo();

    return {
      id: "equipo",
      equipo: resolverEquipoDesdeSegmentoRuta(segmentoEquipo),
      equipoSlug: segmentoEquipo,
      navId: "equipos",
      torneoEquipoClave,
      torneoEquipoManual: Boolean(torneoEquipoClave)
    };
  }

  const id = obtenerVistaDesdeHash();
  return { id, navId: id };
}

vistaActual = obtenerVistaInicialDesdeUrl();

const FASES_PLAYOFF = [
  { valor: "octavos", etiqueta: "Octavos de Final" },
  { valor: "cuartos", etiqueta: "Cuartos de Final" },
  { valor: "semifinal", etiqueta: "Semifinales" },
  { valor: "final", etiqueta: "Final" }
];

const TORNEOS_SIN_CRONOLOGIA_CONFIABLE = new Set([1]);
const LISTADO_NEUTRAL_INCIDENCIAS_PUBLICAS = true;
const MENSAJE_TORNEO_PUBLICO_INVALIDO =
  "No se pudo determinar el torneo actual. Intentá nuevamente más tarde.";
const MAXIMO_GOLEADORES_TABLA = 10;
const LIMITE_ESCUDOS_EAGER_TABLA = 10;
const LIMITE_ESCUDOS_PRIORIDAD_ALTA_TABLA = 4;

const TIPOS_GOL_PARTIDO = new Set(["gol", "gol-penal", "gol-contra"]);
const EVENTOS_PUBLICOS_SELECT = [
  "id",
  "partido_id",
  "tipo",
  "equipo_id",
  "equipo",
  "jugador",
  "jugador_relacionado",
  "inscripcion_jugador_id",
  "orden",
  "periodo",
  "minuto",
  "estado_dato"
].join(",");

const GRUPOS_INCIDENCIAS_DETALLE = [
  {
    clave: "goles",
    titulo: "Goles",
    tipos: ["gol", "gol-penal", "gol-contra"]
  },
  {
    clave: "amarillas",
    titulo: "Tarjetas amarillas",
    tipos: ["amarilla"]
  },
  {
    clave: "rojas",
    titulo: "Tarjetas rojas",
    tipos: ["roja", "doble-amarilla"]
  },
  {
    clave: "otras",
    titulo: "Otras incidencias",
    tipos: ["cambio", "otro"]
  }
];

const ESTADOS_DATO = {
  confirmar: "A confirmar",
  sinDatos: "Sin datos",
  sinIdentificar: "Sin identificar"
};

function activarPistasScrollHorizontal(root, animar = false) {
  if (!root) return;

  const desplazables = root.querySelectorAll(
    ".cat-row, .zona-tab-bar, .tabla-wrap"
  );

  desplazables.forEach(elemento => {
    const actualizarEstado = () => {
      const desborda = elemento.scrollWidth > elemento.clientWidth + 4;
      const llegoAlFinal =
        elemento.scrollLeft + elemento.clientWidth >=
        elemento.scrollWidth - 4;

      elemento.classList.toggle("horizontal-scroll-cue", desborda);
      elemento.classList.toggle(
        "is-at-scroll-end",
        !desborda || llegoAlFinal
      );
    };

    if (!elemento.dataset.scrollCueReady) {
      elemento.addEventListener("scroll", actualizarEstado, {
        passive: true
      });
      elemento.dataset.scrollCueReady = "true";
    }

    actualizarEstado();
  });

  if (
    animar &&
    !document.body.dataset.tableScrollHintShown &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    const tabla = root.querySelector(
      ".tabla-wrap.horizontal-scroll-cue"
    );

    if (tabla) {
      document.body.dataset.tableScrollHintShown = "true";
      tabla.classList.add("scroll-nudge");
    }
  }
}

function mostrarVista(id) {
  document.body.classList.toggle(
    "detail-mode",
    !VISTAS_PRINCIPALES.includes(id)
  );
  document.querySelectorAll('.tab-content').forEach(p => p.classList.remove('on'));
  document.querySelectorAll('.tab, .bn-item, .sb-link').forEach(t => {
    t.classList.remove('on');
    t.removeAttribute('aria-current');
  });

  const target = document.getElementById('tab-' + id);
  if (target) target.classList.add('on');

  if (id === "tabla") {
    activarPistasScrollHorizontal(target, true);
  }

  const vistaNavegacion = vistaActual.navId ||
    (VISTAS_PRINCIPALES.includes(id) ? id : null);

  document.querySelectorAll(`[data-tab="${vistaNavegacion}"]`).forEach(t => {
    t.classList.add('on');
    t.setAttribute('aria-current', 'page');
  });
  document.querySelectorAll('.bn-item').forEach(t => {
    if (
      vistaNavegacion &&
      t.getAttribute('onclick') &&
      t.getAttribute('onclick').includes(`'${vistaNavegacion}'`)
    ) {
      t.classList.add('on');
      t.setAttribute('aria-current', 'page');
    }
  });
  document.querySelectorAll('.sb-link').forEach(t => {
    if (
      vistaNavegacion &&
      t.getAttribute('onclick') &&
      t.getAttribute('onclick').includes(`'${vistaNavegacion}'`)
    ) {
      t.classList.add('on');
      t.setAttribute('aria-current', 'page');
    }
  });

  const reduceMovimiento = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;
  window.scrollTo({
    top: 0,
    behavior: reduceMovimiento ? "auto" : "smooth"
  });
}

function switchTab(id) {
  if (!VISTAS_PRINCIPALES.includes(id)) {
    id = "inicio";
  }

  if (
    state.torneoSeleccionadoId &&
    (
      id !== "playoffs" ||
      torneoTemporalDetalleEquipo
    )
  ) {
    restaurarTorneoVigente();
  }
  torneoTemporalDetalleEquipo = false;

  vistaActual = { id, navId: id };
  mostrarVista(id);
  actualizarEncabezadoVistaActual();
  guardarVistaEnHistorial();
  registrarVistaPestana(id);
}

function abrirPartido(id) {
  let partido = state.partidos.find(
    item => String(item.id) === String(id)
  );

  if (!partido) {
    const partidoTodos = state.partidosTodos.find(
      item => String(item.id) === String(id)
    );
    const torneoPartido = partidoTodos
      ? state.torneos.find(
          torneo => String(torneo.id) === String(partidoTodos.torneo_id)
        )
      : null;

    if (torneoPartido) {
      torneoTemporalDetalleEquipo = vistaActual.id === "equipo";
      state.torneoSeleccionadoId = torneoPartido.activo
        ? null
        : String(torneoPartido.id);
      aplicarDatosTorneo(torneoPartido, false);
      partido = state.partidos.find(
        item => String(item.id) === String(id)
      );
    }
  }

  if (!partido) return;
  const origen = vistaActual.navId || "partidos";

  vistaActual = {
    id: "partido",
    partidoId: partido.id,
    navId: origen,
    torneoId: state.torneoActivo?.id || null
  };
  renderDetallePartido(partido.id);
  mostrarVista("partido");
  guardarVistaEnHistorial();
  registrarVistaPartido(partido.id, origen);
}

function abrirEquipo(equipo) {
  if (!equipo) return;

  const origen = vistaActual.navId || "equipos";
  torneoTemporalDetalleEquipo = false;

  if (state.torneoSeleccionadoId && obtenerTorneoVisualizacionActual()) {
    state.torneoSeleccionadoId = null;
    aplicarDatosTorneo(obtenerTorneoVisualizacionActual(), false);
  }

  const torneoVisualizacion = obtenerTorneoVisualizacionActual();

  vistaActual = {
    id: "equipo",
    equipo,
    navId: origen,
    torneoEquipoId: torneoVisualizacion?.id || null,
    torneoEquipoManual: false
  };
  renderDetalleEquipo(equipo);
  mostrarVista("equipo");
  guardarVistaEnHistorial();
  registrarVistaEquipo(equipo, origen);
}

function volverDetalle() {
  if (window.history.state?.tresPalos) {
    window.history.back();
    return;
  }

  switchTab(vistaActual.navId || "partidos");
}

function guardarVistaEnHistorial(reemplazar = false) {
  const metodo = reemplazar ? "replaceState" : "pushState";
  window.history[metodo](
    {
      tresPalos: true,
      vista: {
        ...vistaActual,
        torneoId: state.torneoActivo?.id || null
      }
    },
    "",
    construirUrlVistaActual()
  );
}

function construirUrlVistaActual() {
  if (vistaActual.id === "equipo" && vistaActual.equipo) {
    const slug = obtenerSlugEquipoUrl(vistaActual.equipo);
    const torneo = obtenerTorneoVistaDetalleEquipo();
    const params = new URLSearchParams();

    if (torneo && !esTorneoVigente(torneo)) {
      params.set("torneo", crearClaveTorneoUrl(torneo));
    }
    agregarParametroPreviewTorneo(params);

    const search = params.toString();
    return `/equipos/${slug}${search ? `?${search}` : ""}`;
  }

  const vistaUrl = VISTAS_PRINCIPALES.includes(vistaActual.id)
    ? vistaActual.id
    : vistaActual.navId;
  const hash = vistaUrl && vistaUrl !== "inicio" ? `#${vistaUrl}` : "";
  const params = new URLSearchParams();
  agregarParametroPreviewTorneo(params);
  const search = params.toString();
  return `/${search ? `?${search}` : ""}${hash}`;
}

function agregarParametroPreviewTorneo(params) {
  const id = state.torneoPreview?.id || previewTorneoIdSolicitado;

  if (
    id &&
    window.TPPublicTournament?.isNetlifyPreviewHost(
      window.location.hostname
    )
  ) {
    params.set("preview_torneo", String(id));
  }
}

function obtenerSlugEquipoUrl(equipo) {
  const club = obtenerClub(equipo);
  return normalizarSegmentoRuta(
    club?.nombre_corto ||
    nombresCortos[equipo] ||
    nombre(equipo) ||
    equipo
  ) || "equipo";
}

function crearClaveTorneoUrl(torneo) {
  if (torneo?.tipo && torneo?.anio) {
    return `${normalizarSegmentoRuta(torneo.tipo)}-${torneo.anio}`;
  }

  return String(torneo?.id || "");
}

function buscarTorneoPorClaveUrl(clave, torneos = state.torneos) {
  const valor = String(clave || "").trim();
  if (!valor) return null;
  const normalizado = normalizarSegmentoRuta(valor);

  return torneos.find(torneo =>
    String(torneo.id) === valor ||
    crearClaveTorneoUrl(torneo) === normalizado ||
    normalizarSegmentoRuta(torneo.nombre) === normalizado
  ) || null;
}

function esTorneoVigente(torneo) {
  if (!torneo) return false;
  if (state.torneoVigente?.id) {
    return String(torneo.id) === String(state.torneoVigente.id);
  }
  return Boolean(torneo.activo);
}

function obtenerTorneoVisualizacionActual() {
  return state.torneoPreview ||
    state.torneoActivo ||
    state.torneoVigente ||
    obtenerTorneoActivo(state.torneos);
}

function obtenerTorneoVistaDetalleEquipo() {
  const torneoId = vistaActual.torneoEquipoId;
  if (!torneoId) return null;

  return state.torneos.find(
    torneo => String(torneo.id) === String(torneoId)
  ) || null;
}

function restaurarVistaDesdeHistorial(vista) {
  if (!vista?.id) return;

  if (
    !VISTAS_PRINCIPALES.includes(vista.id) &&
    !["partido", "equipo"].includes(vista.id)
  ) {
    vista = { id: "inicio", navId: "inicio" };
  }

  if (vista.id === "equipo" && !vista.equipo && vista.equipoSlug) {
    vista.equipo = resolverEquipoDesdeSegmentoRuta(vista.equipoSlug);
  }

  const conservaContextoPlayoff =
    vista.id === "playoffs" ||
    vista.navId === "playoffs";
  const conservaContextoPartido =
    vista.id === "partido" &&
    vista.torneoId;
  const torneoVista = conservaContextoPlayoff && vista.torneoId
    ? state.torneos.find(
        torneo => String(torneo.id) === String(vista.torneoId)
      )
    : conservaContextoPartido
      ? state.torneos.find(
          torneo => String(torneo.id) === String(vista.torneoId)
        )
    : null;

  if (torneoVista) {
    state.torneoSeleccionadoId = torneoVista.activo
      ? null
      : String(torneoVista.id);
    aplicarDatosTorneo(torneoVista);
  } else if (conservaContextoPlayoff && vista.torneoId) {
    state.torneoSeleccionadoId = String(vista.torneoId);
  }

  if (
    state.torneoSeleccionadoId &&
    VISTAS_PRINCIPALES.includes(vista.id) &&
    vista.id !== "playoffs"
  ) {
    restaurarTorneoVigente();
  }

  vistaActual = vista;

  if (vista.id === "partido") {
    renderDetallePartido(vista.partidoId);
  }
  if (vista.id === "equipo") {
    renderDetalleEquipo(vista.equipo);
  }

  mostrarVista(vista.id);
  actualizarEncabezadoVistaActual();

  if (VISTAS_PRINCIPALES.includes(vista.id)) {
    registrarVistaPestana(vista.id, "historial");
  }
  if (vista.id === "partido" && vista.partidoId) {
    registrarVistaPartido(
      vista.partidoId,
      vista.navId || "partidos"
    );
  }
  if (vista.id === "equipo" && vista.equipo) {
    registrarVistaEquipo(
      vista.equipo,
      vista.navId || "equipos"
    );
  }
}

document.querySelectorAll('.tab').forEach(t => {
  t.addEventListener('click', () => switchTab(t.dataset.tab));
});

window.addEventListener("popstate", event => {
  if (event.state?.tresPalos) {
    restaurarVistaDesdeHistorial(event.state.vista);
    return;
  }

  const id = obtenerVistaDesdeHash();
  vistaActual = { id, navId: id };
  mostrarVista(id);
  registrarVistaPestana(id, "historial");
});

function renderEstadoVista(tipo, titulo, mensaje, reintentar = false) {
  const cargando = tipo === "cargando";
  const rol = tipo === "error" ? "alert" : "status";

  return `
    <div
      class="view-state view-state-${tipo}"
      role="${rol}"
      ${cargando ? 'aria-busy="true"' : ""}
    >
      ${cargando ? '<span class="view-state-spinner" aria-hidden="true"></span>' : ""}
      <strong>${escaparHtml(titulo)}</strong>
      <p>${escaparHtml(mensaje)}</p>
      ${reintentar
        ? '<button type="button" onclick="reintentarCargaDatos()">Reintentar</button>'
        : ""}
    </div>
  `;
}

function obtenerMensajeErrorCargaDatos(fallback) {
  return mensajeErrorCargaDatos || fallback;
}

function reintentarCargaDatos() {
  if (actualizandoDatos) return;

  errorCargaDatos = false;
  mensajeErrorCargaDatos = "";
  cargaPartidosFinalizada = false;
  renderMatches();
  renderTabla(zonaActual);
  renderInicio();
  renderPlayoffs();
  renderTeams();
  obtenerPartidos();
}

function renderMatches() {
  const cont = document.getElementById("matchContent");
  if (!cont) return;

  if (errorCargaDatos && state.partidos.length === 0) {
    cont.innerHTML = renderEstadoVista(
      "error",
      "No pudimos cargar los partidos",
      obtenerMensajeErrorCargaDatos("Revisá tu conexión e intentá nuevamente."),
      true
    );
    return;
  }

  if (!cargaPartidosFinalizada) {
    cont.innerHTML = renderSkeletonPartidos();
    return;
  }

  const etapa = obtenerEtapasDisponibles().find(
    item => item.clave === etapaActual
  );

  if (!etapa) {
    cont.innerHTML = renderEstadoVista(
      "vacio",
      "Sin partidos",
      "Todavía no hay partidos disponibles para esta etapa."
    );
    return;
  }

  actualizarEncabezadoPartidos(etapa);

  if (etapa.tipo === "playoff") {
    renderPartidosPlayoff(etapa);
    return;
  }

  renderPartidosRegulares(etapa);
}

function renderSkeletonAgenda() {
  return `
    <div
      class="next-card home-agenda skeleton-shell"
      role="status"
      aria-busy="true"
    >
      <span class="skeleton-status">Cargando agenda</span>
      <div class="skeleton-card-head" aria-hidden="true">
        <span class="skeleton skeleton-line skeleton-line-sm"></span>
        <span class="skeleton skeleton-line skeleton-line-xs"></span>
      </div>
      <div class="skeleton-match-list" aria-hidden="true">
        ${renderSkeletonMatchRows(3)}
      </div>
      <div class="skeleton-card-footer" aria-hidden="true">
        <span class="skeleton skeleton-line skeleton-line-xs"></span>
        <span class="skeleton skeleton-line skeleton-line-sm"></span>
      </div>
    </div>
  `;
}

function renderSkeletonPartidos() {
  return `
    <div
      class="zona-block skeleton-shell skeleton-zone"
      role="status"
      aria-busy="true"
    >
      <span class="skeleton-status">Cargando partidos</span>
      <div class="skeleton-zone-head" aria-hidden="true">
        <span class="skeleton skeleton-dot"></span>
        <span class="skeleton skeleton-line skeleton-line-sm"></span>
        <span class="skeleton skeleton-line skeleton-line-xs"></span>
      </div>
      <div aria-hidden="true">
        ${renderSkeletonMatchRows(4)}
      </div>
    </div>
  `;
}

function renderSkeletonMatchRows(cantidad) {
  return Array.from({ length: cantidad }, (_, indice) => `
    <div class="skeleton-match-row skeleton-match-row-${indice % 3}">
      <span class="skeleton skeleton-line skeleton-team-name"></span>
      <span class="skeleton skeleton-shield"></span>
      <span class="skeleton skeleton-score"></span>
      <span class="skeleton skeleton-shield"></span>
      <span class="skeleton skeleton-line skeleton-team-name"></span>
    </div>
  `).join("");
}

function renderSkeletonTabla() {
  const filas = Array.from({ length: 7 }, (_, indice) => `
    <div class="skeleton-table-row skeleton-table-row-${indice % 3}">
      <span class="skeleton skeleton-table-pos"></span>
      <span class="skeleton skeleton-shield"></span>
      <span class="skeleton skeleton-line skeleton-table-team"></span>
      <span class="skeleton skeleton-table-stat"></span>
      <span class="skeleton skeleton-table-stat"></span>
      <span class="skeleton skeleton-table-stat"></span>
    </div>
  `).join("");

  return `
    <div
      class="skeleton-table-wrap skeleton-shell"
      role="status"
      aria-busy="true"
    >
      <span class="skeleton-status">Cargando tabla</span>
      <div class="skeleton-table-head" aria-hidden="true">
        <span class="skeleton skeleton-line skeleton-line-md"></span>
        <span class="skeleton skeleton-line skeleton-line-sm"></span>
      </div>
      <div aria-hidden="true">${filas}</div>
    </div>
  `;
}

function renderSkeletonPlayoffs() {
  const cruces = Array.from({ length: 3 }, () => `
    <div class="skeleton-playoff-card">
      <div class="skeleton-playoff-head">
        <span class="skeleton skeleton-line skeleton-line-sm"></span>
        <span class="skeleton skeleton-line skeleton-line-xs"></span>
      </div>
      <div class="skeleton-playoff-team">
        <span class="skeleton skeleton-shield"></span>
        <span class="skeleton skeleton-line skeleton-table-team"></span>
        <span class="skeleton skeleton-table-stat"></span>
      </div>
      <div class="skeleton-playoff-team">
        <span class="skeleton skeleton-shield"></span>
        <span class="skeleton skeleton-line skeleton-table-team"></span>
        <span class="skeleton skeleton-table-stat"></span>
      </div>
    </div>
  `).join("");

  return `
    <div
      class="skeleton-playoffs skeleton-shell"
      role="status"
      aria-busy="true"
    >
      <span class="skeleton-status">Cargando playoffs</span>
      <div class="skeleton-playoffs-title" aria-hidden="true">
        <span class="skeleton skeleton-line skeleton-line-md"></span>
        <span class="skeleton skeleton-line skeleton-line-sm"></span>
      </div>
      <div class="skeleton-playoff-grid" aria-hidden="true">${cruces}</div>
    </div>
  `;
}

function renderPartidosRegulares(etapa) {
  const cont = document.getElementById("matchContent");
  const partidosFecha = state.partidos.filter(
    p =>
      p.tipo === "regular" &&
      Number(p.fecha) === etapa.valor
  );

  const zonas = {
    zona1: partidosFecha
      .filter(p => Number(p.zona) === 1)
      .sort(compararPartidosParaListado),
    zona2: partidosFecha
      .filter(p => Number(p.zona) === 2)
      .sort(compararPartidosParaListado),
    zona3: partidosFecha
      .filter(p => Number(p.zona) === 3)
      .sort(compararPartidosParaListado)
  };

  const zColors = {
    zona1: "var(--zone1)",
    zona2: "var(--zone2)",
    zona3: "var(--zone3)"
  };

  const zNames = {
    zona1: "Zona 1",
    zona2: "Zona 2",
    zona3: "Zona 3"
  };

  let html = "";

  ["zona1", "zona2", "zona3"].forEach(z => {
    const partidosZona = zonas[z];
    const numeroZona = Number(z.replace("zona", ""));

    if (partidosZona.length === 0) return;

    html += `
      <div class="zona-block" style="--zona-color:${zColors[z]}">
        <div class="zona-head">
          <div class="zona-pip"></div>
          <div class="zona-name">${zNames[z]}</div>
          <div class="zona-count">${obtenerEquiposZonaTorneo(numeroZona).length} equipos</div>
        </div>
    `;

    partidosZona.forEach(p => {
      html += renderPartido(p);
    });

    const equipoLibre = obtenerEquipoLibre(numeroZona, partidosZona);
    if (equipoLibre) {
      html += renderEquipoLibre(equipoLibre);
    }

    html += "</div>";
  });

  cont.innerHTML = html || renderEstadoVista(
    "vacio",
    "Sin partidos",
    "Todavía no hay partidos disponibles para esta fecha."
  );
}

function obtenerEquipoLibre(zona, partidos) {
  const derivados = obtenerParticipantesRegularesTorneo();

  if (derivados.regularMatches.length > 0 && window.TPPublicTournament) {
    const libres = window.TPPublicTournament.getFreeParticipants(
      derivados,
      partidos,
      zona,
      obtenerOpcionesParticipantesTorneo()
    );

    if (!libres.valid && libres.found > 0) {
      console.error(
        "Libre inconsistente para fecha/zona.",
        { zona, esperados: libres.expected, encontrados: libres.found }
      );
    }

    return libres.teams[0] || null;
  }

  const participantes = new Set(
    partidos.flatMap(p => [
      obtenerNombreOficialEquipo(p.local, p.local_id),
      obtenerNombreOficialEquipo(p.visitante, p.visitante_id)
    ])
  );

  const equiposZona = obtenerEquiposZonaLegacy(zona);
  if (equiposZona.length % 2 === 0) return null;

  const libres = equiposZona.filter(
    equipo => !participantes.has(equipo)
  );

  return libres.length === 1 ? libres[0] : null;
}

function renderEquipoLibre(equipo) {
  const nombreEquipo = nombre(equipo);
  const escudo = obtenerEscudoEquipo(equipo);
  const escudoEquipo = escudo
    ? `<img src="${escudo}" alt="Escudo de ${nombreEquipo}" width="48" height="48" loading="lazy" decoding="async">`
    : nombreEquipo.slice(0, 2).toUpperCase();

  return `
    <div class="match-libre">
      <div class="libre-tag">Libre</div>
      <div class="libre-team">
        <div class="libre-shield">${escudoEquipo}</div>
        ${nombreEquipo}
      </div>
    </div>
  `;
}

function renderPartidosPlayoff(etapa) {
  const cont = document.getElementById("matchContent");
  const partidos = state.partidos
    .filter(
      p =>
        p.tipo === "playoff" &&
        p.fase === etapa.valor
    )
    .sort(compararPartidosParaListado);

  if (partidos.length === 0) {
    cont.innerHTML = renderEstadoVista(
      "vacio",
      "Sin partidos",
      "Todavía no hay partidos disponibles para esta fase."
    );
    return;
  }

  const estadoFase = obtenerEstadoFasePlayoff(
    partidos,
    etapa.valor === obtenerFaseActualPlayoffs()
  );

  cont.innerHTML = `
    <div class="zona-block playoff-block">
      <div class="zona-head">
        <div class="zona-pip playoff-pip"></div>
        <div class="zona-name">${etapa.etiqueta}</div>
        <div class="zona-count state-${estadoFase.clase}">
          ${estadoFase.texto} · ${partidos.length}
          ${partidos.length === 1 ? "partido" : "partidos"}
        </div>
      </div>
      ${partidos
        .map(p => renderPartido(resolverPartidoPlayoff(p)))
        .join("")}
    </div>
  `;
}

function renderPartido(p) {
  const jugado =
    p.goles_local !== null &&
    p.goles_visitante !== null;
  const estado = obtenerEstadoTemporalPartido(p);
  const tienePenales =
    p.penales_local !== null &&
    p.penales_visitante !== null;

  const localGano =
    jugado &&
    (
      p.goles_local > p.goles_visitante ||
      (
        p.goles_local === p.goles_visitante &&
        tienePenales &&
        p.penales_local > p.penales_visitante
      )
    );
  const visitanteGano =
    jugado &&
    (
      p.goles_visitante > p.goles_local ||
      (
        p.goles_local === p.goles_visitante &&
        tienePenales &&
        p.penales_visitante > p.penales_local
      )
    );

  const center = jugado
    ? `
      <div class="mr-score">
        ${p.goles_local} - ${p.goles_visitante}
        ${
          tienePenales
            ? `<span class="mr-penales">Pen. ${p.penales_local} - ${p.penales_visitante}</span>`
            : estado.tipo === "penales"
              ? `<span class="mr-penales">Penales</span>`
            : ""
        }
      </div>
    `
    : renderMomentoPartido(p, estado, "mr-time");

  return `
    <button
      type="button"
      class="match-row ${estado.clase}"
      onclick="abrirPartido(${JSON.stringify(p.id)})"
      aria-label="Ver ${nombre(p.local, p.local_id)} contra ${nombre(
        p.visitante,
        p.visitante_id
      )}"
    >
      ${renderEquipoPartido(p.local, p.local_id, visitanteGano)}
      ${center}
      ${renderEquipoPartido(
        p.visitante,
        p.visitante_id,
        localGano,
        true
      )}

      <div class="mr-chev" aria-hidden="true">›</div>
    </button>
  `;
}

function renderEquipoPartido(
  equipo,
  clubId,
  perdio,
  visitante = false
) {
  const nombreEquipo = equipo ? nombre(equipo, clubId) : "Por definir";
  const escudoEquipo = obtenerEscudoEquipo(equipo, clubId);
  const escudo = equipo && escudoEquipo
    ? `<img src="${escudoEquipo}" alt="Escudo de ${nombreEquipo}" width="48" height="48" loading="lazy" decoding="async">`
    : `<span>${equipo ? nombreEquipo.slice(0, 2).toUpperCase() : "?"}</span>`;

  return `
    <div class="mr-team ${visitante ? "away" : ""} ${perdio ? "loser" : ""}">
      <span class="name">${nombreEquipo}</span>
      <div class="shield">${escudo}</div>
    </div>
  `;
}

function obtenerDetallePartido(p) {
  const partes = [];

  if (p.numero_playoff) partes.push(`Llave ${p.numero_playoff}`);

  const jugado =
    p.goles_local !== null &&
    p.goles_visitante !== null;
  const diferencia = diferenciaDiasConHoy(p.fecha_partido);

  if (
    p.fecha_partido &&
    (jugado || diferencia < 0 || diferencia > 1)
  ) {
    const [year, month, day] = p.fecha_partido.split("-");
    if (year && month && day) partes.push(`${day}/${month}`);
  }

  return partes.join(" · ");
}

function diferenciaDiasConHoy(fecha) {
  if (!fecha) return null;

  const [year, month, day] = fecha.split("-").map(Number);
  if (!year || !month || !day) return null;

  const hoy = new Date();
  const hoyUtc = Date.UTC(
    hoy.getFullYear(),
    hoy.getMonth(),
    hoy.getDate()
  );
  const fechaUtc = Date.UTC(year, month - 1, day);

  return Math.round((fechaUtc - hoyUtc) / 86400000);
}

function formatearMomentoPartido(partido) {
  const hora = partido.hora || ESTADOS_DATO.confirmar;
  const diferencia = diferenciaDiasConHoy(partido.fecha_partido);

  if (diferencia === 0) return `Hoy ${hora}`;
  if (diferencia === 1) return `Mañana ${hora}`;

  if (partido.fecha_partido) {
    const [year, month, day] = partido.fecha_partido.split("-");
    if (year && month && day) return `${day}/${month} · ${hora}`;
  }

  return hora;
}

function obtenerEstadoTemporalPartido(partido, ahora = new Date()) {
  const jugado =
    partido.goles_local !== null &&
    partido.goles_visitante !== null;

  if (
    partido.tipo === "playoff" &&
    jugado &&
    partido.goles_local === partido.goles_visitante &&
    (
      partido.penales_local === null ||
      partido.penales_visitante === null
    )
  ) {
    return {
      tipo: "penales",
      clase: "live",
      texto: "Penales",
      detalle: "Definición por penales"
    };
  }

  if (jugado) {
    return {
      tipo: "final",
      clase: "final",
      texto: "Finalizado",
      detalle: "Partido finalizado"
    };
  }

  const estadoManual = obtenerEstadoManualPartido(partido);
  if (estadoManual) return estadoManual;

  const inicio = crearFechaHoraPartido(partido);

  if (!inicio) {
    return {
      tipo: "sin-fecha",
      clase: "tbd",
      texto: ESTADOS_DATO.confirmar,
      detalle: "Fecha y hora a confirmar"
    };
  }

  const finEstimado = new Date(
    inicio.getTime() + 2 * 60 * 60 * 1000
  );

  if (ahora >= inicio && ahora <= finEstimado) {
    return {
      tipo: "en-juego",
      clase: "live",
      texto: "En vivo",
      detalle: "En vivo · Estado estimado por horario"
    };
  }

  if (ahora > finEstimado) {
    return {
      tipo: "esperando",
      clase: "waiting",
      texto: "Esperando resultado",
      detalle: "Partido terminado · Esperando resultado oficial"
    };
  }

  const diferencia = diferenciaDiasConHoy(partido.fecha_partido);

  return {
    tipo: "programado",
    clase: diferencia === 0 ? "today" : "scheduled",
    texto: formatearMomentoPartido(partido),
    detalle: formatearMomentoPartido(partido)
  };
}

function obtenerEstadoManualPartido(partido) {
  const valor = normalizarEstadoPartidoValor(partido?.estado);

  if (!valor || valor === "programado") return null;

  const estados = {
    en_vivo: {
      tipo: "en-juego",
      clase: "live",
      texto: "En vivo",
      detalle: "En vivo · Estado cargado"
    },
    en_juego: {
      tipo: "en-juego",
      clase: "live",
      texto: "En vivo",
      detalle: "En vivo · Estado cargado"
    },
    suspendido: {
      tipo: "suspendido",
      clase: "suspended",
      texto: "Suspendido",
      detalle: "Partido suspendido"
    },
    postergado: {
      tipo: "postergado",
      clase: "postponed",
      texto: "Postergado",
      detalle: "Partido postergado"
    },
    finalizado: {
      tipo: "esperando",
      clase: "waiting",
      texto: "Esperando resultado",
      detalle: "Partido finalizado · Esperando resultado oficial"
    },
    pendiente_resultado: {
      tipo: "esperando",
      clase: "waiting",
      texto: "Esperando resultado",
      detalle: "Partido finalizado · Esperando resultado oficial"
    }
  };

  return estados[valor] || null;
}

function normalizarEstadoPartidoValor(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function obtenerEstadoTorneo(ahora = new Date()) {
  const faseActual = obtenerFaseActualPlayoffs();
  const fase = FASES_PLAYOFF.find(
    item => item.valor === faseActual
  );
  const serieFinal = obtenerResultadoSerieFinal();

  if (serieFinal.ganador) {
    const campeon = serieFinal.ganador;

    return {
      tipo: "finalizado",
      clase: "completed",
      etiqueta: "Torneo finalizado",
      titulo: campeon ? `${nombre(campeon)} campeón` : "Torneo finalizado",
      agenda: "Últimos resultados",
      animado: false
    };
  }

  const partidosEtapa = fase
    ? state.partidos
        .filter(
          partido =>
            partido.tipo === "playoff" &&
            partido.fase === fase.valor
        )
        .map(resolverPartidoPlayoff)
    : obtenerPartidosRegularesVigentes();
  const estados = partidosEtapa.map(
    partido => obtenerEstadoTemporalPartido(partido, ahora)
  );

  if (estados.some(estado => estado.tipo === "penales")) {
    return crearEstadoTorneo(
      "penales",
      "live",
      "Definición en curso",
      fase?.etiqueta || "Partido decisivo",
      "Definición por penales",
      true
    );
  }

  if (estados.some(estado => estado.tipo === "en-juego")) {
    return crearEstadoTorneo(
      "en-juego",
      "live",
      "Torneo en vivo",
      fase?.etiqueta || "Fecha en juego",
      "Partidos en vivo",
      true
    );
  }

  if (estados.some(estado => estado.tipo === "esperando")) {
    return crearEstadoTorneo(
      "esperando",
      "waiting",
      "Actualización pendiente",
      fase?.etiqueta || "Fecha finalizada",
      "Esperando resultados",
      true
    );
  }

  const alterado = estados.find(
    estado =>
      estado.tipo === "suspendido" ||
      estado.tipo === "postergado"
  );

  if (alterado) {
    return crearEstadoTorneo(
      alterado.tipo,
      "disrupted",
      "Programación alterada",
      fase?.etiqueta || "Calendario del torneo",
      alterado.texto,
      false
    );
  }

  const partidosConEquipos = partidosEtapa.filter(
    partido => partido.local && partido.visitante
  );
  const partidosFinalizados = estados.filter(
    estado => estado.tipo === "final"
  ).length;
  const partidosPendientes = estados.filter(
    estado => estado.tipo !== "final"
  );

  if (
    partidosFinalizados > 0 &&
    partidosPendientes.length > 0
  ) {
    return crearEstadoTorneo(
      "en-curso",
      "active",
      "Etapa en curso",
      fase?.etiqueta || "Fase regular",
      "Próximos partidos",
      false
    );
  }

  if (
    partidosConEquipos.length === 0 ||
    partidosPendientes.some(estado => estado.tipo === "sin-fecha")
  ) {
    return crearEstadoTorneo(
      "sin-programar",
      "pending",
      "Programación pendiente",
      fase?.etiqueta || "Próxima fecha",
      "A confirmar",
      false
    );
  }

  if (partidosPendientes.length > 0) {
    return crearEstadoTorneo(
      "programado",
      "scheduled",
      "Próxima etapa",
      fase?.etiqueta || "Fase regular",
      "Próximos partidos",
      false
    );
  }

  return crearEstadoTorneo(
    "sin-actividad",
    "pending",
    "Sin actividad programada",
    fase?.etiqueta || "Torneo",
    "Últimos resultados",
    false
  );
}

function crearEstadoTorneo(
  tipo,
  clase,
  etiqueta,
  titulo,
  agenda,
  animado
) {
  return { tipo, clase, etiqueta, titulo, agenda, animado };
}

function obtenerTorneoActivo(torneos) {
  if (!Array.isArray(torneos) || torneos.length === 0) return null;

  const activos = torneos.filter(torneo => torneo?.id && torneo.activo);
  if (activos.length === 0) return null;

  const ordenados = [...activos].sort(
    (a, b) =>
      Number(b.anio || 0) - Number(a.anio || 0) ||
      String(b.fecha_inicio || "").localeCompare(
        String(a.fecha_inicio || "")
      ) ||
      String(b.tipo || "").localeCompare(String(a.tipo || ""))
  );

  return ordenados[0] || null;
}

function filtrarPartidosPorTorneo(partidos, torneo) {
  if (!Array.isArray(partidos)) return [];
  if (!torneo?.id) return partidos;

  return partidos.filter(
    partido => String(partido.torneo_id) === String(torneo.id)
  );
}

function filtrarGoleadoresPorTorneo(goleadores, torneo) {
  if (!Array.isArray(goleadores)) return [];
  if (!torneo?.id) return goleadores;

  return goleadores
    .filter(
      goleador => String(goleador.torneo_id) === String(torneo.id)
    )
    .sort(
      (a, b) =>
        Number(a.posicion || 0) - Number(b.posicion || 0) ||
        Number(b.goles || 0) - Number(a.goles || 0)
    );
}

function crearTablaGoleadoresVacia() {
  return {
    fuente: null,
    mensaje_vacio: "",
    tablas: {
      "1": [],
      "2": [],
      "3": [],
      general: []
    }
  };
}

function normalizarRespuestaGoleadoresTabla(data) {
  const tablas = data?.tablas || {};

  return {
    fuente: data?.fuente || null,
    mensaje_vacio: data?.mensaje_vacio || "",
    tablas: {
      "1": normalizarFilasGoleadoresTabla(tablas["1"]),
      "2": normalizarFilasGoleadoresTabla(tablas["2"]),
      "3": normalizarFilasGoleadoresTabla(tablas["3"]),
      general: normalizarFilasGoleadoresTabla(tablas.general)
    }
  };
}

function normalizarFilasGoleadoresTabla(filas) {
  return (Array.isArray(filas) ? filas : [])
    .filter(goleador => Number(goleador.goles) > 0)
    .map(goleador => ({
      torneo_id: goleador.torneo_id ?? null,
      posicion: Number(goleador.posicion || 0),
      equipo_id: goleador.equipo_id ?? null,
      equipo_nombre: goleador.equipo_nombre || "",
      jugador_nombre: goleador.jugador_nombre || "",
      goles: Number(goleador.goles || 0)
    }))
    .sort(compararGoleadoresTabla);
}

function compararGoleadoresTabla(a, b) {
  return (
    Number(b.goles || 0) - Number(a.goles || 0) ||
    String(a.jugador_nombre || "").localeCompare(
      String(b.jugador_nombre || ""),
      "es",
      { sensitivity: "base" }
    ) ||
    String(a.equipo_nombre || "").localeCompare(
      String(b.equipo_nombre || ""),
      "es",
      { sensitivity: "base" }
    ) ||
    Number(a.posicion || 0) - Number(b.posicion || 0)
  );
}

function obtenerClaveFiltroGoleadoresTabla() {
  return tablaPosicionesActual === "general"
    ? "general"
    : String(Number(tablaPosicionesActual) || zonaActual || 1);
}

function obtenerEtiquetaFiltroGoleadoresTabla() {
  return tablaPosicionesActual === "general"
    ? "General"
    : `Zona ${Number(tablaPosicionesActual) || zonaActual || 1}`;
}

function obtenerTorneoSeleccionado(torneos, torneoVigente) {
  const lista = Array.isArray(torneos) ? torneos : [];
  const preview = obtenerTorneoPreview(lista);

  if (preview) {
    state.torneoSeleccionadoId = null;
    return preview;
  }

  const seleccionado = state.torneoSeleccionadoId
    ? lista.find(
        torneo =>
          String(torneo.id) === String(state.torneoSeleccionadoId)
      )
    : null;

  if (seleccionado) {
    if (seleccionado.activo) state.torneoSeleccionadoId = null;
    return seleccionado;
  }

  state.torneoSeleccionadoId = null;
  return torneoVigente;
}

function obtenerTorneoPreview(torneos) {
  const helper = window.TPPublicTournament;

  if (
    !helper?.isNetlifyPreviewHost(window.location.hostname) ||
    !previewTorneoIdSolicitado
  ) {
    state.torneoPreview = null;
    previewTorneoIdSolicitado = null;
    return null;
  }

  const torneo = Array.isArray(torneos)
    ? torneos.find(
        item => String(item.id) === String(previewTorneoIdSolicitado)
      )
    : null;

  state.torneoPreview = torneo || null;

  if (!torneo) {
    previewTorneoIdSolicitado = null;
    return null;
  }

  previewTorneoIdSolicitado = String(torneo.id);
  return torneo;
}

function actualizarAvisoPreviewTorneo(torneo) {
  const aviso = document.getElementById("previewTournamentNotice");
  if (!aviso) return;

  if (
    !state.torneoPreview?.id ||
    String(torneo?.id) !== String(state.torneoPreview.id)
  ) {
    aviso.hidden = true;
    aviso.textContent = "";
    return;
  }

  aviso.textContent = `Vista de prueba: ${torneo.nombre || torneo.id}`;
  aviso.hidden = false;
}

function aplicarDatosTorneo(torneo, renderizar = false) {
  state.torneoActivo = torneo || null;
  actualizarAvisoPreviewTorneo(torneo);
  state.partidos = torneo
    ? filtrarPartidosPorTorneo(state.partidosTodos, torneo)
    : [...state.partidosTodos];
  state.eventos = filtrarEventosPorPartidos(
    state.eventosTodos,
    state.partidos
  );
  state.goleadoresOficiales = filtrarGoleadoresPorTorneo(
    state.goleadoresOficialesTodos,
    torneo
  );
  vincularClubesPartidos();

  etapaActual = null;
  fasePlayoffActiva = null;
  alcanceDatosActual = null;

  if (renderizar) renderizarTorneoSeleccionado();
}

function renderizarTorneoSeleccionado() {
  actualizarNavegacionEtapas();
  renderMatches();
  renderTabla(zonaActual);
  renderInicio();
  renderPlayoffs();
  renderDatos();
  renderTeams();
}

function seleccionarTorneoPlayoffs(torneoId) {
  if (state.torneoPreview?.id) {
    state.torneoSeleccionadoId = null;
    aplicarDatosTorneo(state.torneoPreview, true);
    guardarVistaEnHistorial(true);
    return;
  }

  const torneo = state.torneos.find(
    item => String(item.id) === String(torneoId)
  );
  if (!torneo) return;

  state.torneoSeleccionadoId = torneo.activo
    ? null
    : String(torneo.id);
  aplicarDatosTorneo(torneo, true);
  guardarVistaEnHistorial(true);
}

function restaurarTorneoVigente() {
  const torneo = state.torneoPreview || state.torneoVigente;
  if (!torneo) return;

  state.torneoSeleccionadoId = null;
  aplicarDatosTorneo(torneo, true);
}

function filtrarEventosPorPartidos(eventos, partidos) {
  if (!Array.isArray(eventos)) return [];

  const idsPartidos = new Set(
    partidos.map(partido => String(partido.id))
  );

  return eventos.filter(
    evento => idsPartidos.has(String(evento.partido_id))
  );
}

function obtenerPartidosRegularesVigentes() {
  const fechasPendientes = state.partidos
    .filter(
      partido =>
        partido.tipo === "regular" &&
        partidoPendienteParaVista(partido)
    )
    .map(partido => Number(partido.fecha))
    .filter(Number.isFinite);
  const fecha = fechasPendientes.length > 0
    ? Math.min(...fechasPendientes)
    : Math.max(
        ...state.partidos
          .filter(partido => partido.tipo === "regular")
          .map(partido => Number(partido.fecha))
          .filter(Number.isFinite),
        0
      );

  return state.partidos.filter(
    partido =>
      partido.tipo === "regular" &&
      Number(partido.fecha) === fecha
  );
}

function obtenerEstadioPartido(partido) {
  const estadioCargado =
    partido.estadio ||
    partido.cancha ||
    partido.sede;

  if (estadioCargado) {
    return estadioCargado;
  }

  const clubLocal = state.clubes.find(
    club => String(club.id) === String(partido.local_id)
  ) || obtenerClub(partido.local);

  if (clubLocal?.estadio) return clubLocal.estadio;

  return obtenerDatoFaltantePartido(partido);
}

function partidoTieneResultado(partido) {
  return (
    partido.goles_local !== null &&
    partido.goles_local !== undefined &&
    partido.goles_visitante !== null &&
    partido.goles_visitante !== undefined
  );
}

function partidoResueltoParaVista(partido) {
  if (window.TPPublicTournament?.isMatchResolved) {
    return window.TPPublicTournament.isMatchResolved(partido);
  }

  return partidoTieneResultado(partido);
}

function partidoPendienteParaVista(partido) {
  return !partidoResueltoParaVista(partido);
}

function obtenerDatoFaltantePartido(partido) {
  return partidoTieneResultado(partido)
    ? ESTADOS_DATO.sinDatos
    : ESTADOS_DATO.confirmar;
}

function obtenerHoraPartido(partido) {
  return partido.hora || obtenerDatoFaltantePartido(partido);
}

function obtenerArbitroPartido(partido) {
  return partido.arbitro ||
    partido.arbitro_principal ||
    obtenerDatoFaltantePartido(partido);
}

function esEventoPublicable(evento) {
  return evento.estado_dato === "confirmado";
}

function crearFechaHoraPartido(partido) {
  if (!partido.fecha_partido || !partido.hora) return null;

  const [year, month, day] = partido.fecha_partido
    .split("-")
    .map(Number);
  const [hour, minute] = partido.hora
    .split(":")
    .map(Number);

  if (
    !year || !month || !day ||
    !Number.isFinite(hour) ||
    !Number.isFinite(minute)
  ) {
    return null;
  }

  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

function renderMomentoPartido(partido, estado, clase) {
  if (estado.tipo === "en-juego") {
    return `
      <div class="${clase} live">
        <span class="live-indicator"></span>
        En vivo
        <small>Estimado</small>
      </div>
    `;
  }

  if (estado.tipo === "esperando") {
    return `
      <div class="${clase} waiting">
        Esperando
        <small>resultado</small>
      </div>
    `;
  }

  return `<div class="${clase} ${estado.clase}">${estado.texto}</div>`;
}

function obtenerOpcionesParticipantesTorneo() {
  return {
    torneoId: state.torneoActivo?.id || null,
    getOfficialName: (equipo, clubId) =>
      obtenerNombreOficialEquipo(equipo, clubId)
  };
}

function reportarConflictosParticipantes(derivados) {
  const conflictos = derivados?.conflicts || [];
  const firma = conflictos
    .map(conflicto => `${conflicto.key}:${conflicto.zonas.join(",")}`)
    .sort()
    .join("|");

  if (!firma || firma === firmaConflictosParticipantes) return;
  firmaConflictosParticipantes = firma;
  console.error(
    "Datos inconsistentes: clubes en mas de una zona del torneo.",
    conflictos
  );
}

function obtenerParticipantesRegularesTorneo() {
  if (!window.TPPublicTournament) {
    return {
      participants: [],
      participantsByKey: new Map(),
      byZone: new Map(),
      zones: [],
      conflicts: [],
      regularMatches: []
    };
  }

  const derivados = window.TPPublicTournament.deriveRegularParticipants(
    state.partidos,
    obtenerOpcionesParticipantesTorneo()
  );
  reportarConflictosParticipantes(derivados);
  return derivados;
}

function obtenerEquiposZonaLegacy(zona) {
  return (equiposPorZona[zona] || []).slice().sort((a, b) =>
    nombre(a).localeCompare(nombre(b), "es", { sensitivity: "base" })
  );
}

function obtenerZonasLegacy() {
  return Object.keys(equiposPorZona)
    .map(Number)
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
}

function obtenerEquiposZonaTorneo(zona) {
  const derivados = obtenerParticipantesRegularesTorneo();

  if (derivados.regularMatches.length > 0 && window.TPPublicTournament) {
    return window.TPPublicTournament.getTeamsByZone(derivados, zona);
  }

  return obtenerEquiposZonaLegacy(zona);
}

function obtenerZonasTorneo() {
  const derivados = obtenerParticipantesRegularesTorneo();

  if (derivados.regularMatches.length > 0 && window.TPPublicTournament) {
    return window.TPPublicTournament.getZones(derivados);
  }

  return obtenerZonasLegacy();
}

function calcularTablaZonaLegacy(zona) {
  const equiposZona = obtenerEquiposZonaLegacy(zona);
  const tabla = Object.fromEntries(
    equiposZona.map(equipo => [equipo, crearFilaTabla(equipo)])
  );

  state.partidos
    .filter(
      p =>
        p.tipo === "regular" &&
        Number(p.zona) === Number(zona)
    )
    .sort(
      (a, b) =>
        Number(a.fecha || 0) - Number(b.fecha || 0) ||
        Number(a.id || 0) - Number(b.id || 0)
    )
    .forEach(p => {
      const localNombre = obtenerNombreOficialEquipo(p.local, p.local_id);
      const visitanteNombre = obtenerNombreOficialEquipo(
        p.visitante,
        p.visitante_id
      );

      if (!localNombre || !visitanteNombre) return;
      if (!tabla[localNombre]) tabla[localNombre] = crearFilaTabla(localNombre);
      if (!tabla[visitanteNombre]) {
        tabla[visitanteNombre] = crearFilaTabla(visitanteNombre);
      }

      if (
        p.goles_local === null ||
        p.goles_visitante === null
      ) {
        return;
      }

      const golesLocal = Number(p.goles_local);
      const golesVisitante = Number(p.goles_visitante);
      if (!Number.isFinite(golesLocal) || !Number.isFinite(golesVisitante)) return;

      const local = tabla[localNombre];
      const visitante = tabla[visitanteNombre];

      local.pj++;
      visitante.pj++;
      local.gf += golesLocal;
      local.gc += golesVisitante;
      visitante.gf += golesVisitante;
      visitante.gc += golesLocal;

      if (golesLocal > golesVisitante) {
        local.pg++;
        local.pts += 3;
        visitante.pp++;
        local.forma.push("w");
        visitante.forma.push("l");
      } else if (golesLocal < golesVisitante) {
        visitante.pg++;
        visitante.pts += 3;
        local.pp++;
        local.forma.push("l");
        visitante.forma.push("w");
      } else {
        local.pe++;
        visitante.pe++;
        local.pts++;
        visitante.pts++;
        local.forma.push("e");
        visitante.forma.push("e");
      }

      local.dg = local.gf - local.gc;
      visitante.dg = visitante.gf - visitante.gc;
    });

  return Object.values(tabla)
    .map(fila => ({
      ...fila,
      forma: fila.forma.slice(-5)
    }))
    .sort(compararPosiciones);
}

function calcularTablaZona(zona) {
  const derivados = obtenerParticipantesRegularesTorneo();

  if (derivados.regularMatches.length > 0 && window.TPPublicTournament) {
    return window.TPPublicTournament.buildZoneTable(
      state.partidos,
      zona,
      {
        ...obtenerOpcionesParticipantesTorneo(),
        derived: derivados,
        compareRows: compararPosiciones
      }
    );
  }

  return calcularTablaZonaLegacy(zona);
}

function calcularTablaGeneral() {
  const derivados = obtenerParticipantesRegularesTorneo();

  if (derivados.regularMatches.length > 0 && window.TPPublicTournament) {
    return window.TPPublicTournament.buildGeneralTable(
      state.partidos,
      {
        ...obtenerOpcionesParticipantesTorneo(),
        derived: derivados,
        compareRows: compararPosiciones
      }
    );
  }

  return obtenerZonasLegacy()
    .flatMap(zona =>
      calcularTablaZonaLegacy(zona).map(fila => ({
        ...fila,
        zona
      }))
    )
    .sort(compararPosiciones);
}

function crearFilaTabla(equipo) {
  return {
    equipo,
    pj: 0,
    pg: 0,
    pe: 0,
    pp: 0,
    gf: 0,
    gc: 0,
    dg: 0,
    pts: 0,
    forma: []
  };
}

function compararPosiciones(a, b) {
  return (
    b.pts - a.pts ||
    b.dg - a.dg ||
    b.gf - a.gf ||
    nombre(a.equipo).localeCompare(nombre(b.equipo), "es")
  );
}

function calcularClasificados() {
  const tablas = [1, 2, 3].map(zona =>
    calcularTablaZona(zona).map((fila, indice) => ({
      ...fila,
      zona,
      puesto: indice + 1
    }))
  );

  const primeros = tablas
    .map(tabla => tabla[0])
    .filter(Boolean)
    .sort(compararPosiciones);
  const quintos = tablas
    .map(tabla => tabla[4])
    .filter(Boolean)
    .sort(compararPosiciones);

  const cuartos = new Set(
    primeros.slice(0, 2).map(fila => fila.equipo)
  );
  const octavos = new Set([
    ...primeros.slice(2).map(fila => fila.equipo),
    ...tablas.flatMap(tabla =>
      tabla.slice(1, 4).map(fila => fila.equipo)
    ),
    ...quintos.slice(0, 2).map(fila => fila.equipo)
  ]);

  return { cuartos, octavos };
}

function claseClasificacion(equipo, clasificados) {
  if (clasificados.cuartos.has(equipo)) return "t-pos-cuartos";
  if (clasificados.octavos.has(equipo)) return "t-pos-octavos";
  return "";
}

function obtenerGanadorPlayoff(partido) {
  if (
    partido.goles_local === null ||
    partido.goles_visitante === null
  ) {
    return null;
  }

  if (partido.goles_local > partido.goles_visitante) return "local";
  if (partido.goles_visitante > partido.goles_local) return "visitante";

  if (
    partido.penales_local !== null &&
    partido.penales_visitante !== null
  ) {
    if (partido.penales_local > partido.penales_visitante) return "local";
    if (partido.penales_visitante > partido.penales_local) return "visitante";
  }

  return null;
}

function obtenerPartidosFinal() {
  return state.partidos
    .filter(
      partido =>
        partido.tipo === "playoff" &&
        partido.fase === "final"
    )
    .map(resolverPartidoPlayoff)
    .sort(
      (a, b) =>
        Number(a.numero_playoff || 0) -
          Number(b.numero_playoff || 0) ||
        compararFechaPartido(a, b)
    );
}

function obtenerResultadoSerieFinal() {
  const partidos = obtenerPartidosFinal();
  const jugados = partidos.filter(
    partido =>
      partido.goles_local !== null &&
      partido.goles_visitante !== null
  );
  const equipos = [
    ...new Set(
      partidos.flatMap(partido => [
        partido.local,
        partido.visitante
      ]).filter(Boolean)
    )
  ];
  const completa =
    partidos.length >= 2 &&
    jugados.length === partidos.length &&
    equipos.length === 2;
  const goles = new Map(equipos.map(equipo => [equipo, 0]));

  jugados.forEach(partido => {
    goles.set(
      partido.local,
      (goles.get(partido.local) || 0) + Number(partido.goles_local)
    );
    goles.set(
      partido.visitante,
      (goles.get(partido.visitante) || 0) +
        Number(partido.goles_visitante)
    );
  });

  let ganador = null;
  if (completa) {
    const [equipoA, equipoB] = equipos;
    const golesA = goles.get(equipoA) || 0;
    const golesB = goles.get(equipoB) || 0;

    if (golesA > golesB) ganador = equipoA;
    if (golesB > golesA) ganador = equipoB;

    if (!ganador) {
      const definicion = [...partidos].reverse().find(
        partido =>
          partido.penales_local !== null &&
          partido.penales_visitante !== null
      );
      if (definicion) {
        if (definicion.penales_local > definicion.penales_visitante) {
          ganador = definicion.local;
        }
        if (definicion.penales_visitante > definicion.penales_local) {
          ganador = definicion.visitante;
        }
      }
    }
  }

  return {
    partidos,
    equipos,
    goles,
    completa,
    ganador,
    definicionPendiente: completa && !ganador
  };
}

function obtenerEquipoGanadorPlayoff(partido) {
  if (!partido) return null;

  const ladoGanador = obtenerGanadorPlayoff(partido);
  return ladoGanador
    ? resolverEquipoPlayoff(partido, ladoGanador)
    : null;
}

function resolverEquipoPlayoff(partido, lado) {
  if (!partido || !lado) return null;
  if (partido[lado]) return partido[lado];

  const partidoOrigenSource = obtenerPartidoOrigenPlayoff(partido, lado);
  if (partidoOrigenSource) {
    return obtenerEquipoGanadorPlayoff(partidoOrigenSource);
  }

  const partidoOrigenLlave = obtenerPartidoOrigenPorLlave(partido, lado);
  return obtenerEquipoGanadorPlayoff(partidoOrigenLlave);
}

function obtenerPartidoOrigenPlayoff(partido, lado) {
  const source = lado === "local"
    ? partido.source_local
    : partido.source_visitante;

  return buscarPartidoDesdeSource(source);
}

function buscarPartidoDesdeSource(source) {
  if (source === null || source === undefined || source === "") return null;

  const valor = String(source).trim();

  if (/^\d+$/.test(valor)) {
    return state.partidos.find(
      partido => String(partido.id) === valor
    ) || null;
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

  if (fase && Number.isFinite(numero)) {
    return state.partidos.find(
      partido =>
        partido.tipo === "playoff" &&
        partido.fase === fase &&
        Number(partido.numero_playoff) === numero
    ) || null;
  }

  return null;
}

function obtenerPartidoOrigenPorLlave(partido, lado) {
  const numero = Number(partido.numero_playoff || 1);
  let faseAnterior = null;
  let numeroAnterior = null;

  if (partido.fase === "semifinal") {
    faseAnterior = "cuartos";
    numeroAnterior = lado === "local"
      ? numero * 2 - 1
      : numero * 2;
  }

  if (partido.fase === "final") {
    faseAnterior = "semifinal";
    numeroAnterior = lado === "local" ? 1 : 2;
  }

  if (!faseAnterior || !numeroAnterior) return null;

  const partidoAnterior = state.partidos.find(
    item =>
      item.tipo === "playoff" &&
      item.fase === faseAnterior &&
      Number(item.numero_playoff) === numeroAnterior
  );

  return partidoAnterior || null;
}

function resolverPartidoPlayoff(partido) {
  if (!partido || partido.tipo !== "playoff") return partido;

  const localiaPendientePorSorteo =
    partido.fase === "final" &&
    !Boolean(partido.local && partido.visitante);
  const local = resolverEquipoPlayoff(partido, "local");
  const visitante = resolverEquipoPlayoff(partido, "visitante");
  const clubLocal = obtenerClub(local, partido.local_id);
  const clubVisitante = obtenerClub(visitante, partido.visitante_id);
  const localOficial = clubLocal?.nombre_oficial || local;
  const visitanteOficial =
    clubVisitante?.nombre_oficial || visitante;
  const invertirVueltaProvisional =
    localiaPendientePorSorteo &&
    Number(partido.numero_playoff) === 2;
  const localResuelto = invertirVueltaProvisional
    ? visitanteOficial
    : localOficial;
  const visitanteResuelto = invertirVueltaProvisional
    ? localOficial
    : visitanteOficial;
  const localIdOriginal = clubLocal?.id || partido.local_id || null;
  const visitanteIdOriginal =
    clubVisitante?.id || partido.visitante_id || null;
  const partidoResuelto = {
    ...partido,
    local: localResuelto,
    visitante: visitanteResuelto,
    local_id: invertirVueltaProvisional
      ? visitanteIdOriginal
      : localIdOriginal,
    visitante_id: invertirVueltaProvisional
      ? localIdOriginal
      : visitanteIdOriginal,
    localia_pendiente: localiaPendientePorSorteo
  };

  return ordenarLocaliaPlayoff(partidoResuelto);
}

function ordenarLocaliaPlayoff(partido) {
  const jugado =
    partido.goles_local !== null &&
    partido.goles_visitante !== null;

  if (
    partido.tipo !== "playoff" ||
    jugado ||
    !partido.local ||
    !partido.visitante
  ) {
    return {
      ...partido,
      localia_pendiente:
        partido.localia_pendiente ||
        partido.tipo === "playoff" &&
        !jugado &&
        Boolean(partido.local || partido.visitante) &&
        !Boolean(partido.local && partido.visitante)
    };
  }

  if (partido.fase === "final") {
    return partido;
  }

  const comparacion = compararLocaliaEquipos(
    partido.local,
    partido.visitante
  );

  if (comparacion <= 0) {
    return { ...partido, localia_pendiente: false };
  }

  return {
    ...partido,
    local: partido.visitante,
    visitante: partido.local,
    local_id: partido.visitante_id,
    visitante_id: partido.local_id,
    source_local: partido.source_visitante,
    source_visitante: partido.source_local,
    localia_pendiente: false
  };
}

function compararLocaliaEquipos(equipoA, equipoB) {
  const seedA = obtenerSeedPlayoffEquipo(equipoA);
  const seedB = obtenerSeedPlayoffEquipo(equipoB);

  if (seedA !== seedB) return seedA - seedB;

  return nombre(equipoA).localeCompare(nombre(equipoB), "es");
}

function obtenerSeedPlayoffEquipo(equipo) {
  const clasificados = calcularClasificados();
  const filas = [1, 2, 3]
    .flatMap(zona =>
      calcularTablaZona(zona).map((fila, indice) => ({
        ...fila,
        zona,
        puesto: indice + 1,
        paseDirecto: clasificados.cuartos.has(fila.equipo),
        clasificado:
          clasificados.cuartos.has(fila.equipo) ||
          clasificados.octavos.has(fila.equipo)
      }))
    )
    .filter(fila => fila.clasificado)
    .sort(
      (a, b) =>
        Number(b.paseDirecto) - Number(a.paseDirecto) ||
        compararPosiciones(a, b)
    );

  const indice = filas.findIndex(fila => fila.equipo === equipo);
  return indice >= 0 ? indice + 1 : Number.MAX_SAFE_INTEGER;
}

function obtenerEstadoPlayoffEquipo(equipo) {
  const serieFinal = obtenerResultadoSerieFinal();
  if (serieFinal.equipos.includes(equipo)) {
    if (serieFinal.ganador) {
      return {
        texto: serieFinal.ganador === equipo ? "Campeón" : "Subcampeón",
        clase:
          serieFinal.ganador === equipo ? "champion" : "runner-up"
      };
    }
    if (serieFinal.definicionPendiente) {
      return {
        texto: "Definición pendiente",
        clase: "pending"
      };
    }
    return {
      texto: "Clasificado a la final",
      clase: "final"
    };
  }

  const fases = [
    {
      valor: "semifinal",
      pendiente: "Clasificado a semifinales",
      eliminado: "Eliminado en semifinales"
    },
    {
      valor: "cuartos",
      pendiente: "Clasificado a cuartos de final",
      eliminado: "Eliminado en cuartos de final"
    },
    {
      valor: "octavos",
      pendiente: "Clasificado a octavos de final",
      eliminado: "Eliminado en octavos de final"
    }
  ];

  for (const fase of fases) {
    const partido = state.partidos
      .filter(
        item =>
          item.tipo === "playoff" &&
          item.fase === fase.valor
      )
      .map(resolverPartidoPlayoff)
      .find(
        item =>
          item.local === equipo ||
          item.visitante === equipo
      );

    if (!partido) continue;

    const ladoGanador = obtenerGanadorPlayoff(partido);
    const ganador = ladoGanador
      ? partido[ladoGanador]
      : null;
    const jugado =
      partido.goles_local !== null &&
      partido.goles_visitante !== null;

    if (ganador && ganador !== equipo) {
      return {
        texto: fase.eliminado,
        clase: fase.valor === "final" ? "runner-up" : "eliminated"
      };
    }
    if (fase.valor === "final" && ganador === equipo) {
      return {
        texto: "Campeón",
        clase: "champion"
      };
    }
    if (jugado && !ganador) {
      return {
        texto: "Definición pendiente",
        clase: "pending"
      };
    }

    return {
      texto: fase.pendiente,
      clase: fase.valor
    };
  }

  const hayPlayoffs = state.partidos.some(
    partido => partido.tipo === "playoff"
  );

  if (hayPlayoffs) {
    const clasificados = calcularClasificados();

    if (clasificados.cuartos.has(equipo)) {
      return {
        texto: "Clasificado a cuartos de final",
        clase: "cuartos"
      };
    }
    if (clasificados.octavos.has(equipo)) {
      return {
        texto: "Clasificado a octavos de final",
        clase: "octavos"
      };
    }

    return {
      texto: "No clasificó a playoffs",
      clase: "not-qualified"
    };
  }

  return null;
}

function obtenerFaseActualPlayoffs() {
  for (let indice = 0; indice < FASES_PLAYOFF.length; indice++) {
    const fase = FASES_PLAYOFF[indice];
    const partidos = state.partidos.filter(
      p =>
        p.tipo === "playoff" &&
        p.fase === fase.valor
    );
    const tieneEquipos = partidos.some(p => p.local || p.visitante);
    const tienePendientes = partidos.some(
      p =>
        p.goles_local === null ||
        p.goles_visitante === null
    );

    if (tieneEquipos && tienePendientes) return fase.valor;

    const faseAnterior = FASES_PLAYOFF[indice - 1];
    if (!tieneEquipos && tienePendientes && faseAnterior) {
      const partidosAnteriores = state.partidos.filter(
        p =>
          p.tipo === "playoff" &&
          p.fase === faseAnterior.valor
      );
      const faseAnteriorTerminada =
        partidosAnteriores.length > 0 &&
        partidosAnteriores.every(p => obtenerGanadorPlayoff(p));

      if (faseAnteriorTerminada) return fase.valor;
    }
  }

  const ultimaFaseConDatos = [...FASES_PLAYOFF]
    .reverse()
    .find(fase =>
      state.partidos.some(
        p =>
          p.tipo === "playoff" &&
          p.fase === fase.valor &&
          (p.local || p.visitante)
      )
    );

  return ultimaFaseConDatos?.valor || null;
}

function obtenerClasificadosDirectos() {
  const clasificados = calcularClasificados();

  return [1, 2, 3]
    .flatMap(zona =>
      calcularTablaZona(zona).map((fila, indice) => ({
        ...fila,
        zona,
        puesto: indice + 1
      }))
    )
    .filter(fila => clasificados.cuartos.has(fila.equipo))
    .sort(compararPosiciones);
}

function obtenerPosicionesEquipo(equipo) {
  const zona = obtenerZonaEquipo(equipo);
  const tablaZona = zona ? calcularTablaZona(zona) : [];
  const puestoZona = tablaZona.findIndex(
    fila => fila.equipo === equipo
  );
  const tablaGeneral = calcularTablaGeneral();
  const puestoGeneral = tablaGeneral.findIndex(
    fila => fila.equipo === equipo
  );

  return {
    zona,
    puestoZona: puestoZona >= 0 ? puestoZona + 1 : null,
    puestoGeneral: puestoGeneral >= 0 ? puestoGeneral + 1 : null
  };
}

function renderMetaPosicionesEquipo(equipo, clase = "") {
  const posiciones = obtenerPosicionesEquipo(equipo);
  const items = [
    posiciones.zona && posiciones.puestoZona
      ? `Zona ${posiciones.zona} #${posiciones.puestoZona}`
      : "",
    posiciones.puestoGeneral
      ? `General #${posiciones.puestoGeneral}`
      : ""
  ].filter(Boolean);

  if (items.length === 0) return "";

  return `<span class="${clase}">${items.join(" · ")}</span>`;
}

function obtenerAnioPlayoffs() {
  const fecha = state.partidos.find(
    p => p.tipo === "playoff" && p.fecha_partido
  )?.fecha_partido;

  return fecha?.split("-")[0] || obtenerAnioTorneo();
}

function obtenerAnioTorneo() {
  if (state.torneoActivo?.anio) return state.torneoActivo.anio;

  const fecha = state.partidos.find(
    partido => partido.fecha_partido
  )?.fecha_partido;

  return fecha?.split("-")[0] || new Date().getFullYear();
}

function obtenerNombreTorneoActivo() {
  return state.torneoActivo?.nombre ||
    `Liga Cañadense ${obtenerAnioTorneo()}`;
}

function obtenerAgendaInicio() {
  const faseActual = obtenerFaseActualPlayoffs();
  const fase = FASES_PLAYOFF.find(
    item => item.valor === faseActual
  );

  if (!fase) {
    return obtenerAgendaRegularInicio();
  }

  const partidosFase = state.partidos
    .filter(
      p =>
        p.tipo === "playoff" &&
        p.fase === fase.valor
    )
    .map(resolverPartidoPlayoff)
    .filter(p => p.local && p.visitante)
    .sort(compararPartidosParaListado);
  const pendientes = partidosFase.filter(
    p =>
      p.goles_local === null ||
      p.goles_visitante === null
  );

  if (pendientes.length > 0) {
    return {
      tipo: "playoff",
      fase,
      clave: `fase:${fase.valor}`,
      partidos: pendientes.slice(0, 4),
      pendientes: true
    };
  }

  return {
    tipo: "playoff",
    fase,
    clave: `fase:${fase.valor}`,
    partidos: partidosFase.slice(-4).reverse(),
    pendientes: false
  };
}

function obtenerAgendaRegularInicio() {
  const partidosRegulares = state.partidos
    .filter(
      partido =>
        partido.tipo === "regular" &&
        partido.local &&
        partido.visitante
    )
    .sort(compararPartidosParaListado);

  if (partidosRegulares.length === 0) {
    return { tipo: "regular", fase: null, partidos: [], pendientes: false };
  }

  const proximosCalendario = window.TPPublicTournament
    ?.getUpcomingCalendarMatches(
      partidosRegulares,
      {
        torneoId: state.torneoActivo?.id || null,
        limit: 4
      }
    ) || [];

  if (proximosCalendario.length > 0) {
    const fechasAgenda = [
      ...new Set(
        proximosCalendario
          .map(partido => Number(partido.fecha))
          .filter(Number.isFinite)
      )
    ].sort((a, b) => a - b);
    const fechaPrincipal = fechasAgenda[0] || Number(proximosCalendario[0].fecha);
    const etiqueta = fechasAgenda.length === 1
      ? `Fecha ${fechasAgenda[0]}`
      : "Próximos partidos";

    return {
      tipo: "regular",
      fase: { valor: "regular", etiqueta },
      clave: Number.isFinite(fechaPrincipal)
        ? `fecha:${fechaPrincipal}`
        : "fecha:1",
      partidos: proximosCalendario,
      pendientes: true,
      mezclaFechas: fechasAgenda.length > 1
    };
  }

  const pendientes = partidosRegulares.filter(
    partido => partidoPendienteParaVista(partido)
  );
  const fechas = (pendientes.length > 0 ? pendientes : partidosRegulares)
    .map(partido => Number(partido.fecha))
    .filter(Number.isFinite);

  if (fechas.length === 0) {
    return { tipo: "regular", fase: null, partidos: [], pendientes: false };
  }

  const fecha = pendientes.length > 0
    ? Math.min(...fechas)
    : Math.max(...fechas);
  const partidosFecha = partidosRegulares.filter(
    partido => Number(partido.fecha) === fecha
  );
  const pendientesFecha = partidosFecha.filter(
    partido => partidoPendienteParaVista(partido)
  );
  const partidosAgenda = pendientesFecha.length > 0
    ? pendientesFecha
    : partidosFecha.slice(-4).reverse();

  return {
    tipo: "regular",
    fase: { valor: "regular", etiqueta: `Fecha ${fecha}` },
    clave: `fecha:${fecha}`,
    partidos: partidosAgenda.slice(0, 4),
    pendientes: pendientesFecha.length > 0
  };
}

function compararFechaPartido(a, b) {
  const fechaA = `${a.fecha_partido || "9999-12-31"}T${a.hora || "23:59"}`;
  const fechaB = `${b.fecha_partido || "9999-12-31"}T${b.hora || "23:59"}`;
  return fechaA.localeCompare(fechaB);
}

function compararPartidosParaListado(a, b) {
  const prioridadA = prioridadPartidoListado(a);
  const prioridadB = prioridadPartidoListado(b);

  if (prioridadA !== prioridadB) {
    return prioridadA - prioridadB;
  }

  return compararFechaPartido(a, b) ||
    Number(a.numero_playoff || a.id || 0) -
    Number(b.numero_playoff || b.id || 0);
}

function prioridadPartidoListado(partido) {
  return {
    "en-juego": 0,
    penales: 0,
    esperando: 1,
    programado: 2,
    "sin-fecha": 3,
    final: 4
  }[obtenerEstadoTemporalPartido(partido).tipo] ?? 5;
}

function obtenerPartidoDestacadoInicio() {
  const torneoId = state.torneoActivo?.id;
  if (!torneoId) return null;

  return state.partidos
    .filter(
      partido =>
        partido?.destacado_inicio === true &&
        String(partido.torneo_id) === String(torneoId)
    )
    .map(partido =>
      partido.tipo === "playoff" ? resolverPartidoPlayoff(partido) : partido
    )
    .filter(
      partido =>
        partido.local &&
        partido.visitante &&
        String(partido.torneo_id) === String(torneoId)
    )
    .sort(compararPartidosParaListado)[0] || null;
}

function obtenerTituloPartidoDestacadoInicio(
  partido,
  nombreLocal,
  nombreVisitante
) {
  const titulo = String(partido.destacado_titulo || "").trim();
  return titulo || `${nombreLocal} vs ${nombreVisitante}`;
}

function renderBloquePartidoDestacadoInicio(partido) {
  const estado = obtenerEstadoTemporalPartido(partido);
  const jugado =
    partido.goles_local !== null &&
    partido.goles_visitante !== null;
  const nombreLocal =
    obtenerNombreOficialEquipo(partido.local, partido.local_id) ||
    nombre(partido.local, partido.local_id);
  const nombreVisitante =
    obtenerNombreOficialEquipo(partido.visitante, partido.visitante_id) ||
    nombre(partido.visitante, partido.visitante_id);
  const titulo = obtenerTituloPartidoDestacadoInicio(
    partido,
    nombreLocal,
    nombreVisitante
  );

  return `
    <section class="next-card home-highlight-card" aria-label="Partido destacado">
      <div class="home-highlight-heading">
        <span>Partido destacado</span>
        <strong>${escaparHtml(titulo)}</strong>
      </div>
      ${renderPartidoDestacadoInicio(
        partido,
        estado,
        nombreLocal,
        nombreVisitante,
        jugado,
        { callToAction: "Ver partido" }
      )}
    </section>
  `;
}

function renderInicio() {
  const cont = document.getElementById("homeContent");
  const contVivo = document.getElementById("homeLiveContent");
  const contDestacado = document.getElementById("homeFeaturedContent");
  if (!cont) return;

  if (errorCargaDatos && state.partidos.length === 0) {
    if (contDestacado) contDestacado.innerHTML = "";
    cont.innerHTML = renderEstadoVista(
      "error",
      "No pudimos cargar la agenda",
      obtenerMensajeErrorCargaDatos("Revisá tu conexión e intentá nuevamente."),
      true
    );
    if (contVivo) contVivo.innerHTML = "";
    return;
  }

  if (!cargaPartidosFinalizada) {
    if (contDestacado) contDestacado.innerHTML = "";
    cont.innerHTML = renderSkeletonAgenda();
    if (contVivo) contVivo.innerHTML = "";
    return;
  }

  const agenda = obtenerAgendaInicio();
  const estadoTorneo = obtenerEstadoTorneo();
  const serieFinal = obtenerResultadoSerieFinal();
  const partidoDestacado = obtenerPartidoDestacadoInicio();
  if (contDestacado) {
    contDestacado.innerHTML = partidoDestacado
      ? renderBloquePartidoDestacadoInicio(partidoDestacado)
      : "";
  }
  actualizarResumenTorneo(agenda);

  if (serieFinal.ganador) {
    cont.innerHTML = renderCampeonInicio(serieFinal);
    renderPulsoInicio();
    return;
  }

  if (!agenda.fase || agenda.partidos.length === 0) {
    cont.innerHTML = `
      <div class="next-card home-agenda">
        <div class="home-empty">
          <strong>${estadoTorneo.etiqueta}</strong>
          <span>
            ${estadoTorneo.tipo === "finalizado"
              ? estadoTorneo.titulo
              : "No hay partidos confirmados para mostrar"}
          </span>
        </div>
      </div>
    `;
    renderPulsoInicio();
    return;
  }

  const textoLinkAgenda = agenda.tipo === "regular"
    ? "Ver partidos"
    : "Ver fase completa";
  const claveAgenda = agenda.clave || `fase:${agenda.fase.valor}`;

  cont.innerHTML = `
    <div class="next-card home-agenda">
      <div class="nc-top">
        <div class="nc-badge state-${estadoTorneo.clase}">
          ${estadoTorneo.animado ? `<span class="nc-pulse"></span>` : ""}
          ${estadoTorneo.agenda}
        </div>
      </div>

      <div class="home-match-list">
        ${agenda.partidos.map(partido =>
          renderPartidoInicio(partido, agenda.partidos.length === 1)
        ).join("")}
      </div>

      <div class="nc-footer">
        <button
          class="nc-footer-link"
          onclick="abrirEtapaPartidos('${claveAgenda}')"
        >
          ${textoLinkAgenda} →
        </button>
      </div>
    </div>
  `;

  renderPulsoInicio();
}

function renderCampeonInicio(serieFinal) {
  const campeon = serieFinal.ganador;
  if (!campeon) return "";

  const rival = serieFinal.equipos.find(equipo => equipo !== campeon);
  const club = obtenerClub(campeon);
  const golesCampeon = serieFinal.goles.get(campeon) || 0;
  const golesRival = serieFinal.goles.get(rival) || 0;
  const definicion = [...serieFinal.partidos].reverse().find(
    partido =>
      partido.penales_local !== null &&
      partido.penales_visitante !== null
  );
  const definicionPenales = definicion && golesCampeon === golesRival;
  const penalesCampeon = definicionPenales
    ? Number(
        definicion.local === campeon
          ? definicion.penales_local
          : definicion.penales_visitante
      )
    : null;
  const penalesRival = definicionPenales
    ? Number(
        definicion.local === campeon
          ? definicion.penales_visitante
          : definicion.penales_local
      )
    : null;

  return `
    <article class="home-champion">
      <div class="home-champion-main">
        <div class="home-champion-shield">
          ${renderEscudoInicio(campeon, club?.id)}
        </div>
        <div class="home-champion-copy">
          <span>Campeón · ${escaparHtml(obtenerNombreTorneoActivo())}</span>
          <h2>${escaparHtml(nombre(campeon, club?.id))}</h2>
          ${club?.nombre_oficial
            ? `<p>${escaparHtml(club.nombre_oficial)}</p>`
            : ""}
        </div>
      </div>

      <div class="home-champion-final">
        <div>
          <span>Resultado global</span>
          <strong>${golesCampeon} - ${golesRival}</strong>
        </div>
        <div>
          <span>Finalista</span>
          <strong>${escaparHtml(rival ? nombre(rival) : "-")}</strong>
        </div>
        ${definicionPenales
          ? `<div>
              <span>Definición</span>
              <strong>Penales ${penalesCampeon} - ${penalesRival}</strong>
            </div>`
          : ""}
      </div>

      <button type="button" onclick="switchTab('playoffs')">
        Ver recorrido en playoffs →
      </button>
    </article>
  `;
}

function actualizarResumenTorneo(agenda) {
  const etiquetaFase = agenda.fase?.etiqueta || "Fase eliminatoria";
  const etiquetaHero = agenda.tipo === "regular"
    ? "Fase regular"
    : etiquetaFase;
  const anio = obtenerAnioTorneo();
  const estadoTorneo = obtenerEstadoTorneo();
  const campeon = obtenerResultadoSerieFinal().ganador;
  const equipos = new Set(
    agenda.partidos.flatMap(p => [p.local, p.visitante]).filter(Boolean)
  );

  if (vistaActual.id === "inicio") {
    document.getElementById("heroLabel").textContent = campeon
    ? `${obtenerNombreTorneoActivo()} · Torneo finalizado`
    : `${obtenerNombreTorneoActivo()} · ${etiquetaHero} · ${anio}`;
  const heroTitle = document.getElementById("heroTitle");
  if (heroTitle) {
    heroTitle.innerHTML = campeon
      ? `${escaparHtml(nombre(campeon))}<br><em>campeón</em>`
      : obtenerTituloHeroInicio(agenda.fase?.valor);
  }
  }
  const tituloSeccion = document.getElementById("homeSectionTitle");
  if (tituloSeccion) {
    tituloSeccion.textContent = campeon
      ? "Campeón del torneo"
      : "Agenda";
  }
  document.getElementById("sidebarEye").textContent =
    estadoTorneo.etiqueta;
  document.getElementById("sidebarTitle").textContent =
    estadoTorneo.tipo === "finalizado"
      ? estadoTorneo.titulo
      : etiquetaFase;
  document.getElementById("sidebarMatches").textContent =
    agenda.partidos.length || "–";
  document.getElementById("sidebarTeams").textContent =
    equipos.size || "–";
  document.getElementById("sidebarYear").textContent = anio;
  actualizarPieTorneo(campeon ? "Torneo finalizado" : etiquetaFase, anio);
}

function actualizarEncabezadoPartidos(etapa = null) {
  if (vistaActual.id !== "partidos") return;

  const etapaVisible = etapa || obtenerEtapasDisponibles().find(
    item => item.clave === etapaActual
  );
  if (!etapaVisible) return;

  const anio = obtenerAnioTorneo();
  const heroLabel = document.getElementById("heroLabel");
  const heroTitle = document.getElementById("heroTitle");

  if (heroLabel) {
    heroLabel.textContent =
      `${obtenerNombreTorneoActivo()} · ${etapaVisible.etiqueta} · ${anio}`;
  }
  if (heroTitle) {
    heroTitle.innerHTML =
      `Partidos<br><em>${escaparHtml(etapaVisible.etiqueta)}</em>`;
  }

  actualizarPieTorneo(etapaVisible.etiqueta, anio);
}

function actualizarEncabezadoVistaActual() {
  if (!cargaPartidosFinalizada || errorCargaDatos) return;

  if (vistaActual.id === "inicio") {
    actualizarResumenTorneo(obtenerAgendaInicio());
  }

  if (vistaActual.id === "partidos") {
    actualizarEncabezadoPartidos();
  }
}

function obtenerTituloHeroInicio(fase) {
  return {
    octavos: "Empieza el<br><em>camino final</em>",
    cuartos: "Ocho equipos,<br><em>cuatro lugares</em>",
    semifinal: "Cuatro equipos,<br><em>dos lugares</em>",
    final: "El título,<br><em>en juego</em>"
  }[fase] || "El torneo<br><em>en datos</em>";
}

function actualizarPieTorneo(etiquetaFase, anio) {
  const torneo = document.getElementById("footer-tournament");
  const etapa = document.getElementById("footer-stage");

  if (torneo) torneo.textContent = obtenerNombreTorneoActivo();
  if (etapa) etapa.textContent = etiquetaFase;
}

function actualizarFechaPie() {
  const fecha = document.getElementById("footer-last-update");
  if (!fecha) return;

  const hoy = new Date();
  const meses = [
    "ene", "feb", "mar", "abr", "may", "jun",
    "jul", "ago", "sep", "oct", "nov", "dic"
  ];

  fecha.textContent =
    `${hoy.getDate()} ${meses[hoy.getMonth()]} ${hoy.getFullYear()}`;
}

function renderPartidoInicio(partido, destacado = false) {
  const jugado =
    partido.goles_local !== null &&
    partido.goles_visitante !== null;
  const estado = obtenerEstadoTemporalPartido(partido);
  const nombreLocal = nombre(partido.local, partido.local_id);
  const nombreVisitante = nombre(
    partido.visitante,
    partido.visitante_id
  );
  const centro = jugado
    ? `${partido.goles_local} - ${partido.goles_visitante}`
    : renderMomentoPartido(partido, estado, "home-moment");

  if (destacado) {
    return renderPartidoDestacadoInicio(
      partido,
      estado,
      nombreLocal,
      nombreVisitante,
      jugado
    );
  }

  return `
    <button
      type="button"
      class="home-match-row ${estado.clase}"
      onclick="abrirPartido(${JSON.stringify(partido.id)})"
      aria-label="Ver ${nombreLocal} contra ${nombreVisitante}"
    >
      <div class="home-match-primary">
        <div class="home-team local">
          <span>${nombreLocal}</span>
          ${renderEscudoInicio(partido.local, partido.local_id)}
        </div>
        <div class="home-match-center">
          ${jugado ? `<strong>${centro}</strong>` : centro}
          <small>
            ${estado.tipo === "penales"
              ? "Penales"
              : etiquetaInstanciaPartido(partido)}
          </small>
        </div>
        <div class="home-team away">
          ${renderEscudoInicio(
            partido.visitante,
            partido.visitante_id
          )}
          <span>${nombreVisitante}</span>
        </div>
        <span class="home-match-chev" aria-hidden="true">›</span>
      </div>
    </button>
  `;
}

function renderPartidoDestacadoInicio(
  partido,
  estado,
  nombreLocal,
  nombreVisitante,
  jugado,
  options
) {
  const opciones = options || {};
  const instancia = partido.tipo === "regular"
    ? [
        `Fecha ${partido.fecha || ""}`.trim(),
        partido.zona ? `Zona ${partido.zona}` : ""
      ].filter(Boolean).join(" · ")
    : [etiquetaFase(partido.fase), etiquetaInstanciaPartido(partido)]
        .filter(Boolean)
        .join(" · ");
  const tienePenales =
    partido.penales_local !== null &&
    partido.penales_visitante !== null;
  const centro = renderCentroPartidoDestacado(
    partido,
    jugado,
    tienePenales
  );
  const estadio = escaparHtml(obtenerEstadioPartido(partido));
  const etiquetaDia = obtenerEtiquetaDiaPartido(partido.fecha_partido);
  const hora = escaparHtml(obtenerHoraPartido(partido));
  const callToAction = String(opciones.callToAction || "").trim();
  const actionMarkup = callToAction
    ? `<span class="home-featured-cta">${escaparHtml(callToAction)} →</span>`
    : `<span class="home-featured-chevron" aria-hidden="true">›</span>`;
  const nombreLocalHtml = escaparHtml(nombreLocal);
  const nombreVisitanteHtml = escaparHtml(nombreVisitante);

  return `
    <button
      type="button"
      class="home-featured-match ${estado.clase}"
      onclick="abrirPartido(${JSON.stringify(partido.id)})"
      aria-label="Ver ${nombreLocalHtml} contra ${nombreVisitanteHtml}"
    >
      <span class="home-featured-context">
        <span class="home-featured-context-label">
          <span class="home-featured-dot" aria-hidden="true"></span>
          ${escaparHtml(instancia)}
        </span>
        ${actionMarkup}
      </span>

      <span class="home-featured-matchup">
        <span class="home-featured-team">
          ${renderEscudoInicio(partido.local, partido.local_id)}
          <strong>${nombreLocalHtml}</strong>
        </span>

        <span class="home-featured-center">
          ${centro}
        </span>

        <span class="home-featured-team">
          ${renderEscudoInicio(partido.visitante, partido.visitante_id)}
          <strong>${nombreVisitanteHtml}</strong>
        </span>
      </span>

      <span class="home-featured-meta">
        <span class="home-featured-venue">
          <small>Estadio</small>
          <strong>${estadio}</strong>
        </span>
        <span class="home-featured-time">
          <small>${etiquetaDia}</small>
          <strong>${hora}</strong>
        </span>
      </span>
    </button>
  `;
}

function renderCentroPartidoDestacado(
  partido,
  jugado,
  tienePenales,
  estado = null
) {
  if (jugado) {
    return `
      <strong class="home-featured-score">
        ${partido.goles_local} - ${partido.goles_visitante}
      </strong>
      ${tienePenales
        ? `<span class="home-featured-penalties">
            Pen. ${partido.penales_local} - ${partido.penales_visitante}
          </span>`
        : estado?.tipo === "penales"
        ? `<span class="home-featured-penalties">Penales</span>`
        : ""}
    `;
  }

  if (
    estado &&
    ["en-juego", "esperando", "suspendido", "postergado"].includes(
      estado.tipo
    )
  ) {
    return renderMomentoPartido(partido, estado, "home-featured-status");
  }

  const partidoIda = obtenerPartidoIdaSerie(partido);

  return `
    <span class="home-featured-vs">VS</span>
    ${partidoIda
      ? `<span class="home-featured-first-leg">
          <small>Ida</small>
          <strong>
            ${partidoIda.goles_local} - ${partidoIda.goles_visitante}
          </strong>
        </span>`
      : ""}
  `;
}

function obtenerPartidoIdaSerie(partido) {
  if (
    partido.tipo !== "playoff" ||
    partido.fase !== "final" ||
    Number(partido.numero_playoff) !== 2
  ) {
    return null;
  }

  const ida = obtenerPartidosFinal().find(
    item => Number(item.numero_playoff) === 1
  );

  return ida && partidoTieneResultado(ida) ? ida : null;
}

function obtenerEtiquetaDiaPartido(fecha) {
  const diferencia = diferenciaDiasConHoy(fecha);

  if (diferencia === 0) return "Hoy";
  if (diferencia === 1) return "Mañana";
  if (!fecha) return "Fecha";

  const [year, month, day] = fecha.split("-").map(Number);
  const meses = [
    "ene", "feb", "mar", "abr", "may", "jun",
    "jul", "ago", "sep", "oct", "nov", "dic"
  ];

  if (!year || !month || !day || !meses[month - 1]) return "Fecha";

  return `${day} ${meses[month - 1]}`;
}

function etiquetaInstanciaPartido(partido) {
  if (partido.tipo === "regular") {
    return `Fecha ${partido.fecha || ""}`.trim();
  }

  if (partido.fase === "final") {
    const instancia = Number(partido.numero_playoff) === 2
      ? "Vuelta"
      : "Ida";
    return partido.localia_pendiente
      ? `${instancia} · Localía a definir`
      : instancia;
  }

  return `Llave ${partido.numero_playoff || 1}`;
}

function resumirAntecedenteInicio(partido) {
  const antecedentes = obtenerAntecedentesRegulares(
    partido.local,
    partido.visitante
  );

  if (antecedentes.partidos.length === 0) {
    return "Sin cruces en fase regular";
  }

  return `${antecedentes.partidos.length} ${
    antecedentes.partidos.length === 1 ? "antecedente" : "antecedentes"
  } · ${resumirAntecedentesRegulares(antecedentes)}`;
}

function renderEscudoInicio(equipo, clubId = null) {
  const nombreEquipo = nombre(equipo, clubId);
  const escudo = obtenerEscudoEquipo(equipo, clubId);
  const contenido = escudo
    ? `<img src="${escudo}" alt="Escudo de ${nombreEquipo}" width="72" height="72" decoding="async">`
    : nombreEquipo.slice(0, 2).toUpperCase();

  return `<span class="home-shield">${contenido}</span>`;
}

function renderPulsoInicio() {
  const cont = document.getElementById("homeLiveContent");
  if (!cont) return;

  const campeon = obtenerResultadoSerieFinal().ganador;
  const faseActual = campeon
    ? "final"
    : obtenerFaseActualPlayoffs();
  const fase = FASES_PLAYOFF.find(
    item => item.valor === faseActual
  );
  const partidosFase = state.partidos
    .filter(
      partido =>
        partido.tipo === "playoff" &&
        partido.fase === faseActual
    )
    .map(resolverPartidoPlayoff)
    .filter(partido => partido.local && partido.visitante)
    .sort(
      (a, b) =>
        Number(a.numero_playoff || 0) -
        Number(b.numero_playoff || 0)
    );

  if (!fase || partidosFase.length === 0) {
    cont.innerHTML = "";
    return;
  }

  const protagonistas = [
    ...new Set(
      partidosFase.flatMap(partido => [
        partido.local,
        partido.visitante
      ])
    )
  ];
  const anio = obtenerAnioPlayoffs();
  const ultimosResultados = renderUltimosResultadosPlayoff(
    faseActual
  );

  if (campeon) {
    cont.innerHTML = `
      <div class="home-live">
        ${ultimosResultados}
      </div>
    `;
    return;
  }

  cont.innerHTML = `
    <div class="home-live">
      ${ultimosResultados}

      ${renderSeccionPulso(
        protagonistas.length === 2
          ? "Comparación de protagonistas"
          : "Datos de los protagonistas",
        `Playoffs ${anio}`,
        renderComparacionProtagonistasInicio(
          protagonistas,
          faseActual
        )
      )}
    </div>
  `;
}

function obtenerGoleadoresTablaPublicables() {
  const clave = obtenerClaveFiltroGoleadoresTabla();
  const tablas = state.goleadoresTabla?.tablas || {};

  return normalizarFilasGoleadoresTabla(tablas[clave]);
}

function obtenerMensajeVacioGoleadoresTabla() {
  return state.goleadoresTabla?.mensaje_vacio ||
    "Todav\u00eda no hay snapshot de goleadores para este torneo.";
}

function obtenerIdListaGoleadoresTabla() {
  return `tablaGoleadoresList-${obtenerClaveFiltroGoleadoresTabla()}`;
}

function obtenerGoleadoresVisiblesTabla(goleadores) {
  return goleadores.slice(0, MAXIMO_GOLEADORES_TABLA);
}

function obtenerEscudoTablaEquipo(equipo, clubId = null) {
  if (typeof obtenerEscudoEquipoTabla === "function") {
    return obtenerEscudoEquipoTabla(equipo, clubId);
  }

  if (typeof obtenerEscudoEquipo === "function") {
    return obtenerEscudoEquipo(equipo, clubId);
  }

  return "";
}

function obtenerInicialesEquipoTabla(equipo) {
  return String(equipo || "Equipo")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(parte => parte.charAt(0))
    .join("")
    .toUpperCase() || "EQ";
}

function obtenerAtributosCargaEscudoTabla(indice = 0) {
  const fila = Number(indice);
  const esFilaInicial =
    Number.isFinite(fila) &&
    fila >= 0 &&
    fila < LIMITE_ESCUDOS_EAGER_TABLA;
  const prioridadAlta =
    esFilaInicial &&
    fila < LIMITE_ESCUDOS_PRIORIDAD_ALTA_TABLA;

  return [
    `loading="${esFilaInicial ? "eager" : "lazy"}"`,
    'decoding="async"',
    prioridadAlta ? 'fetchpriority="high"' : ""
  ].filter(Boolean).join(" ");
}

function renderImagenEscudoTabla(
  escudo,
  alt,
  tamanio,
  indice = 0,
  onerror = ""
) {
  const manejadorError = onerror ? ` onerror="${onerror}"` : "";

  return `<img
    src="${escaparHtml(escudo)}"
    alt="${escaparHtml(alt)}"
    width="${tamanio}"
    height="${tamanio}"
    ${obtenerAtributosCargaEscudoTabla(indice)}${manejadorError}
  >`;
}

function renderFilaGoleadorTabla(goleador, esLider = false, indice = 0) {
  const goles = Number(goleador.goles || 0);
  const equipo =
    nombre(goleador.equipo_nombre, goleador.equipo_id) ||
    goleador.equipo_nombre ||
    "Equipo";
  const escudo = obtenerEscudoTablaEquipo(
    goleador.equipo_nombre,
    goleador.equipo_id
  );
  const inicialesEquipo = obtenerInicialesEquipoTabla(equipo);
  const claseEscudo = `tabla-scorer-shield${escudo ? "" : " is-missing"}`;
  const escudoEquipo = `
    <span
      class="${claseEscudo}"
      aria-hidden="true"
    >
      <span class="tabla-scorer-shield-fallback">
        ${escaparHtml(inicialesEquipo)}
      </span>
      ${escudo
        ? renderImagenEscudoTabla(
            escudo,
            "",
            30,
            indice,
            "this.hidden=true;this.parentElement.classList.add('is-missing')"
          )
        : ""}
    </span>
  `;

  return `
    <div class="tabla-scorer">
      ${escudoEquipo}
      <div class="tabla-scorer-player">
        <strong>${escaparHtml(goleador.jugador_nombre || "Jugador")}</strong>
        <small class="tabla-scorer-team">
          <span class="tabla-scorer-team-name">
            ${escaparHtml(equipo)}
          </span>
        </small>
      </div>
      <div class="tabla-scorer-goals${esLider ? " leader" : ""}">
        <span class="tabla-scorer-goals-number">${goles}</span>
        <span class="tabla-scorer-goals-unit">
          ${goles === 1 ? "GOL" : "GOLES"}
        </span>
      </div>
    </div>
  `;
}

function obtenerFaseAnteriorPlayoff(faseActual) {
  const indice = FASES_PLAYOFF.findIndex(
    fase => fase.valor === faseActual
  );

  return indice > 0 ? FASES_PLAYOFF[indice - 1] : null;
}

function obtenerPartidosFasePlayoff(fase) {
  if (!fase) return [];

  return state.partidos
    .filter(
      partido =>
        partido.tipo === "playoff" &&
        partido.fase === fase
    )
    .map(resolverPartidoPlayoff)
    .filter(
      partido =>
        partido.local &&
        partido.visitante &&
        partido.goles_local !== null &&
        partido.goles_visitante !== null
    )
    .sort(
      (a, b) =>
        Number(a.numero_playoff || 0) -
        Number(b.numero_playoff || 0)
    );
}

function renderUltimosResultadosPlayoff(faseActual) {
  const fase = FASES_PLAYOFF.find(
    item => item.valor === faseActual
  );
  const partidosFaseActual = obtenerPartidosFasePlayoff(faseActual);
  const faseAnterior = obtenerFaseAnteriorPlayoff(faseActual);
  const usarFaseActual = partidosFaseActual.length > 0;
  const faseResultados = usarFaseActual ? fase : faseAnterior;
  const partidos = (usarFaseActual
    ? partidosFaseActual
    : obtenerPartidosFasePlayoff(faseAnterior?.valor)
  )
    .sort(compararResultadosRecientesPlayoff)
    .slice(0, 2);

  if (!faseResultados || partidos.length === 0) return "";

  return renderSeccionPulso(
    "Últimos resultados",
    faseResultados.etiqueta,
    `
      <div class="home-live__results-grid">
        ${partidos.map(renderResultadoPlayoffInicio).join("")}
      </div>
    `
  );
}

function compararResultadosRecientesPlayoff(a, b) {
  return compararFechaPartido(b, a) ||
    Number(b.numero_playoff || b.id || 0) -
    Number(a.numero_playoff || a.id || 0);
}

function renderResultadoPlayoffInicio(partido) {
  const ganador = obtenerGanadorPlayoff(partido);
  const tienePenales =
    partido.penales_local !== null &&
    partido.penales_visitante !== null;
  const incidencias = obtenerResumenIncidenciasResultado(partido);

  return `
    <button
      type="button"
      class="home-live__result-card"
      onclick="abrirPartido(${JSON.stringify(partido.id)})"
      aria-label="Ver resultado de ${nombre(partido.local)} contra ${nombre(partido.visitante)}"
    >
      <div class="home-live__result-meta">
        <span>${etiquetaInstanciaPartido(partido)}</span>
        <strong>Ver detalle</strong>
      </div>
      <div class="home-live__result-score">
        <div class="${ganador === "local" ? "winner" : ""}">
          ${renderEscudoPulso(partido.local, partido.local_id)}
          <span>${nombre(partido.local, partido.local_id)}</span>
        </div>
        <strong>
          ${partido.goles_local} - ${partido.goles_visitante}
          ${tienePenales
            ? `<small>Penales ${partido.penales_local} - ${partido.penales_visitante}</small>`
            : ""}
        </strong>
        <div class="${ganador === "visitante" ? "winner" : ""}">
          ${renderEscudoPulso(
            partido.visitante,
            partido.visitante_id
          )}
          <span>${nombre(partido.visitante, partido.visitante_id)}</span>
        </div>
      </div>
      ${incidencias
        ? `<div class="home-live__result-events">${incidencias}</div>`
        : ""}
    </button>
  `;
}

function obtenerResumenIncidenciasResultado(partido) {
  const eventos = state.eventos.filter(
    evento =>
      String(evento.partido_id) === String(partido.id) &&
      esEventoPublicable(evento)
  );
  const goles = resumirJugadoresIncidencias(
    eventos.filter(evento =>
      ["gol", "gol-penal", "gol-contra"].includes(
        normalizarTipoEvento(evento.tipo)
      )
    )
  );
  const expulsados = resumirJugadoresIncidencias(
    eventos.filter(evento =>
      ["roja", "doble-amarilla"].includes(
        normalizarTipoEvento(evento.tipo)
      )
    )
  );
  const lineas = [];

  if (goles) lineas.push(`<span><b>Goles:</b> ${goles}</span>`);
  if (expulsados) {
    lineas.push(`<span><b>Expulsados:</b> ${expulsados}</span>`);
  }

  return lineas.join("");
}

function resumirJugadoresIncidencias(eventos) {
  const conteos = new Map();

  eventos.forEach(evento => {
    const jugador = limpiarNombreJugador(evento.jugador);
    if (!jugador) return;
    conteos.set(jugador, (conteos.get(jugador) || 0) + 1);
  });

  return [...conteos.entries()]
    .map(([jugador, cantidad]) =>
      escaparHtml(
        cantidad > 1 ? `${jugador} (${cantidad})` : jugador
      )
    )
    .join(" · ");
}

function renderComparacionProtagonistasInicio(
  protagonistas,
  faseObjetivo
) {
  if (protagonistas.length === 0) {
    return `
      <div class="home-live__missing">
        <strong>Sin protagonistas definidos</strong>
        <span>La comparación se habilitará cuando se resuelvan las llaves.</span>
      </div>
    `;
  }

  if (protagonistas.length !== 2) {
    return `
      <div class="home-live__arrival-grid">
        ${protagonistas.map(equipo =>
          renderLlegadaPulso(
            equipo,
            protagonistas,
            faseObjetivo
          )
        ).join("")}
      </div>
    `;
  }

  const [equipoA, equipoB] = protagonistas;
  const datosA = calcularLlegadaPlayoff(equipoA, faseObjetivo);
  const datosB = calcularLlegadaPlayoff(equipoB, faseObjetivo);
  const posicionesA = obtenerPosicionesEquipo(equipoA);
  const posicionesB = obtenerPosicionesEquipo(equipoB);
  const antecedentes = obtenerAntecedentesRegulares(
    equipoA,
    equipoB
  );
  const filas = [
    {
      etiqueta: "Puesto zona",
      valorA: posicionesA.puestoZona || 0,
      valorB: posicionesB.puestoZona || 0,
      formato: "puesto",
      menorEsMejor: true,
      comparar: Boolean(posicionesA.puestoZona && posicionesB.puestoZona)
    },
    {
      etiqueta: "Puesto general",
      valorA: posicionesA.puestoGeneral || 0,
      valorB: posicionesB.puestoGeneral || 0,
      formato: "puesto",
      menorEsMejor: true,
      comparar: Boolean(
        posicionesA.puestoGeneral &&
        posicionesB.puestoGeneral
      )
    },
    {
      etiqueta: "Partidos",
      valorA: datosA.partidos,
      valorB: datosB.partidos,
      comparar: false
    },
    {
      etiqueta: "Goles a favor",
      valorA: datosA.golesFavor,
      valorB: datosB.golesFavor
    },
    {
      etiqueta: "Goles recibidos",
      valorA: datosA.golesContra,
      valorB: datosB.golesContra,
      menorEsMejor: true
    },
    {
      etiqueta: "Vallas invictas",
      valorA: datosA.vallasInvictas,
      valorB: datosB.vallasInvictas
    },
    {
      etiqueta: "Series superadas",
      valorA: datosA.seriesGanadas,
      valorB: datosB.seriesGanadas
    },
    {
      etiqueta: "Definiciones por penales",
      valorA: datosA.seriesPorPenales,
      valorB: datosB.seriesPorPenales,
      comparar: false
    }
  ];

  return `
    <div class="home-live__head-to-head">
      <div class="home-live__compare-team">
        ${renderEscudoPulso(equipoA)}
        <strong>${nombre(equipoA)}</strong>
        ${renderMetaPosicionesEquipo(
          equipoA,
          "home-live__compare-seed"
        )}
        ${renderFormaPulso(equipoA)}
      </div>
      <div class="home-live__compare-title">VS</div>
      <div class="home-live__compare-team">
        ${renderEscudoPulso(equipoB)}
        <strong>${nombre(equipoB)}</strong>
        ${renderMetaPosicionesEquipo(
          equipoB,
          "home-live__compare-seed"
        )}
        ${renderFormaPulso(equipoB)}
      </div>
    </div>

    <div class="home-live__compare-list">
      ${filas.map(renderFilaComparacionInicio).join("")}
    </div>

    <div class="home-live__compare-note">
      <span>Antecedentes en fase regular</span>
      <strong>
        ${antecedentes.partidos.length > 0
          ? `${antecedentes.partidos.length} ${
              antecedentes.partidos.length === 1
                ? "partido"
                : "partidos"
            } · ${resumirAntecedentesRegulares(antecedentes)}`
          : "Sin enfrentamientos registrados"}
      </strong>
      <small>Cálculos sobre los partidos previos de playoffs.</small>
    </div>
  `;
}

function renderFilaComparacionInicio({
  etiqueta,
  valorA,
  valorB,
  formato = "numero",
  menorEsMejor = false,
  comparar = true
}) {
  const claseA = comparar
    ? claseComparador(valorA, valorB, "a", menorEsMejor)
    : "neutral";
  const claseB = comparar
    ? claseComparador(valorA, valorB, "b", menorEsMejor)
    : "neutral";

  return `
    <div class="home-live__compare-row">
      <strong class="${claseA}">
        ${formatearValorComparador(valorA, formato)}
      </strong>
      <span>${etiqueta}</span>
      <strong class="${claseB}">
        ${formatearValorComparador(valorB, formato)}
      </strong>
    </div>
  `;
}

function renderSeccionPulso(titulo, detalle, contenido) {
  return `
    <section class="home-live__section">
      <div class="home-live__section-head">
        <h2>${titulo}</h2>
        ${detalle ? `<span>${detalle}</span>` : ""}
      </div>
      ${contenido}
    </section>
  `;
}

function generarAnalisisPulso(
  partidosFase,
  protagonistas,
  faseObjetivo
) {
  const estadisticas = new Map(
    protagonistas.map(equipo => [
      equipo,
      calcularLlegadaPlayoff(equipo, faseObjetivo)
    ])
  );
  const equiposConDatos = protagonistas.filter(
    equipo => estadisticas.get(equipo)?.partidos > 0
  );

  if (equiposConDatos.length === 0) {
    return {
      titulo: "Sin datos suficientes para comparar a los protagonistas.",
      parrafos: [
        "El análisis se generará cuando existan partidos de playoffs finalizados y cargados."
      ]
    };
  }

  if (faseObjetivo === "final" && protagonistas.length === 2) {
    const [equipoA, equipoB] = protagonistas;
    return {
      titulo:
        `${nombre(equipoA)} y ${nombre(equipoB)}, ` +
        "frente a frente por el título.",
      parrafos: [
        generarParrafoCrucePulso(
          { local: equipoA, visitante: equipoB },
          estadisticas.get(equipoA),
          estadisticas.get(equipoB)
        ),
        "La final se define a ida y vuelta; la serie sigue abierta " +
        "hasta completar ambos partidos."
      ]
    };
  }

  const maximoGoles = Math.max(
    ...equiposConDatos.map(
      equipo => estadisticas.get(equipo).golesFavor
    )
  );
  const minimoGolesContra = Math.min(
    ...equiposConDatos.map(
      equipo => estadisticas.get(equipo).golesContra
    )
  );
  const mejoresAtaques = equiposConDatos.filter(
    equipo =>
      estadisticas.get(equipo).golesFavor === maximoGoles
  );
  const mejoresDefensas = equiposConDatos.filter(
    equipo =>
      estadisticas.get(equipo).golesContra === minimoGolesContra
  );
  const titulo = generarTituloAnalisisPulso(
    mejoresAtaques,
    mejoresDefensas
  );
  const parrafos = partidosFase.map(partido =>
    generarParrafoCrucePulso(
      partido,
      estadisticas.get(partido.local),
      estadisticas.get(partido.visitante)
    )
  );

  return { titulo, parrafos };
}

function generarTituloAnalisisPulso(mejoresAtaques, mejoresDefensas) {
  const ataque = unirNombresEquipos(mejoresAtaques);
  const defensa = unirNombresEquipos(mejoresDefensas);
  const mismoLider =
    mejoresAtaques.length === 1 &&
    mejoresDefensas.length === 1 &&
    mejoresAtaques[0] === mejoresDefensas[0];

  if (mismoLider) {
    return `${ataque} lidera los registros de ataque y defensa.`;
  }

  if (
    mejoresAtaques.length === 1 &&
    mejoresDefensas.includes(mejoresAtaques[0])
  ) {
    const otrasDefensas = mejoresDefensas.filter(
      equipo => equipo !== mejoresAtaques[0]
    );

    if (otrasDefensas.length > 0) {
      return `${ataque} lidera en ataque y comparte la mejor defensa con ${unirNombresEquipos(otrasDefensas)}.`;
    }
  }

  const fraseAtaque = mejoresAtaques.length === 1
    ? `${ataque} lidera en ataque`
    : `${ataque} comparten el mejor ataque`;
  const fraseDefensa = mejoresDefensas.length === 1
    ? `${defensa} tiene la mejor defensa`
    : `${defensa} comparten la mejor defensa`;

  return `${fraseAtaque}; ${fraseDefensa}.`;
}

function unirNombresEquipos(equipos) {
  const nombres = equipos.map(nombre);

  if (nombres.length <= 1) return nombres[0] || "";
  if (nombres.length === 2) return `${nombres[0]} y ${nombres[1]}`;

  return `${nombres.slice(0, -1).join(", ")} y ${nombres.at(-1)}`;
}

function generarParrafoCrucePulso(
  partido,
  datosLocal,
  datosVisitante
) {
  const local = nombre(partido.local);
  const visitante = nombre(partido.visitante);
  const descripcionLocal = describirEquipoAnalisisPulso(
    partido.local,
    datosLocal
  );
  const descripcionVisitante = describirEquipoAnalisisPulso(
    partido.visitante,
    datosVisitante
  );
  const antecedentes = describirAntecedentesAnalisisPulso(
    partido.local,
    partido.visitante
  );

  return `<strong>${local}</strong> ${descripcionLocal} <strong>${visitante}</strong> ${descripcionVisitante} ${antecedentes}`;
}

function describirEquipoAnalisisPulso(equipo, datos) {
  if (!datos || datos.partidos === 0) {
    return "figura sin datos de partidos previos en estos playoffs.";
  }

  const forma = obtenerFormaReciente(equipo, 5);
  const victoriasRecientes = forma.filter(
    item => item.resultado === "G"
  ).length;
  const series = datos.seriesGanadas === 1
    ? "una serie ganada"
    : `${datos.seriesGanadas} series ganadas`;
  const reciente = forma.length > 0
    ? ` En sus últimos ${forma.length} partidos registra ${victoriasRecientes} ${victoriasRecientes === 1 ? "victoria" : "victorias"}.`
    : "";

  return `llega con ${datos.golesFavor} goles a favor, ${datos.golesContra} en contra y ${series}.${reciente}`;
}

function describirAntecedentesAnalisisPulso(equipoA, equipoB) {
  const antecedentes = obtenerAntecedentesRegulares(
    equipoA,
    equipoB
  );

  if (antecedentes.partidos.length === 0) {
    return "No registran enfrentamientos entre sí en la fase regular.";
  }

  const resultados = antecedentes.partidos.map(item => {
    if (item.golesEquipoA === item.golesEquipoB) {
      return `empate ${item.golesEquipoA}–${item.golesEquipoB}`;
    }

    if (item.golesEquipoA > item.golesEquipoB) {
      return `victoria ${item.golesEquipoA}–${item.golesEquipoB} de ${nombre(equipoA)}`;
    }

    return `victoria ${item.golesEquipoB}–${item.golesEquipoA} de ${nombre(equipoB)}`;
  });

  return `En la fase regular hubo ${unirFrases(resultados)}.`;
}

function unirFrases(frases) {
  if (frases.length <= 1) return frases[0] || "";
  if (frases.length === 2) return `${frases[0]} y ${frases[1]}`;

  return `${frases.slice(0, -1).join(", ")} y ${frases.at(-1)}`;
}

function renderCrucePulso(partido, indice) {
  const jugado =
    partido.goles_local !== null &&
    partido.goles_visitante !== null;
  const momento = jugado
    ? `${partido.goles_local} - ${partido.goles_visitante}`
    : formatearFechaHoraPulso(partido);
  const cuenta = obtenerCuentaRegresivaPulso(partido);

  return `
    <button
      type="button"
      class="home-live__semi-card"
      onclick="abrirPartido(${JSON.stringify(partido.id)})"
      aria-label="Ver semifinal entre ${nombre(partido.local)} y ${nombre(partido.visitante)}"
    >
      <div class="home-live__semi-top">
        <span>Semifinal</span>
        <small>${indice + 1} de ${Math.max(2, indice + 1)}</small>
      </div>

      <div class="home-live__match">
        ${renderEquipoCrucePulso(partido.local)}
        <div class="home-live__versus">
          <strong>${jugado ? momento : "VS"}</strong>
          <span>${obtenerAntecedentePulso(partido)}</span>
        </div>
        ${renderEquipoCrucePulso(partido.visitante)}
      </div>

      <div class="home-live__semi-footer">
        <span class="home-live__match-time">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="9"/>
            <polyline points="12,6 12,12 15.5,14"/>
          </svg>
          ${momento}
        </span>
        <strong>${cuenta}</strong>
      </div>
    </button>
  `;
}

function renderEquipoCrucePulso(equipo) {
  const datos = calcularLlegadaPlayoff(equipo);

  return `
    <div class="home-live__team">
      ${renderEscudoPulso(equipo)}
      <div class="home-live__team-name">${nombre(equipo)}</div>
      <div class="home-live__team-meta">
        ${resumirLlegadaPlayoff(datos)}
      </div>
      ${renderFormaPulso(equipo)}
    </div>
  `;
}

function renderEscudoPulso(equipo, clubId = null) {
  const nombreEquipo = nombre(equipo, clubId);
  const escudo = obtenerEscudoEquipo(equipo, clubId);
  const contenido = escudo
    ? `<img src="${escudo}" alt="Escudo de ${nombreEquipo}" width="48" height="48" loading="lazy" decoding="async">`
    : `<span>${nombreEquipo.slice(0, 2).toUpperCase()}</span>`;

  return `<div class="home-live__shield">${contenido}</div>`;
}

function obtenerAntecedentePulso(partido) {
  const antecedentes = obtenerAntecedentesRegulares(
    partido.local,
    partido.visitante
  );

  if (antecedentes.partidos.length === 0) {
    return "Sin cruces<br>en fase regular";
  }

  const marcadores = antecedentes.partidos
    .map(item => `${item.golesEquipoA}-${item.golesEquipoB}`)
    .join(" / ");
  const balance = resumirAntecedentesRegulares(antecedentes);

  return `FR: ${marcadores}<br>${balance}`;
}

function obtenerAntecedentesRegulares(
  equipoA,
  equipoB,
  partidoExcluidoId = null
) {
  const partidos = state.partidos
    .filter(partido => {
      if (
        partido.tipo !== "regular" ||
        partido.goles_local === null ||
        partido.goles_visitante === null
      ) {
        return false;
      }
      if (
        partidoExcluidoId !== null &&
        String(partido.id) === String(partidoExcluidoId)
      ) {
        return false;
      }

      return (
        (partido.local === equipoA && partido.visitante === equipoB) ||
        (partido.local === equipoB && partido.visitante === equipoA)
      );
    })
    .sort(ordenarPartidosCronologicamente)
    .map(partido => {
      const equipoAEsLocal = partido.local === equipoA;
      const golesEquipoA = Number(
        equipoAEsLocal
          ? partido.goles_local
          : partido.goles_visitante
      );
      const golesEquipoB = Number(
        equipoAEsLocal
          ? partido.goles_visitante
          : partido.goles_local
      );

      return {
        partido,
        golesEquipoA,
        golesEquipoB
      };
    });
  const resumen = partidos.reduce(
    (acumulado, item) => {
      if (item.golesEquipoA > item.golesEquipoB) {
        acumulado.victoriasA += 1;
      } else if (item.golesEquipoA < item.golesEquipoB) {
        acumulado.victoriasB += 1;
      } else {
        acumulado.empates += 1;
      }

      return acumulado;
    },
    { victoriasA: 0, victoriasB: 0, empates: 0 }
  );

  return {
    equipoA,
    equipoB,
    partidos,
    ...resumen
  };
}

function ordenarPartidosCronologicamente(a, b) {
  const fechaTorneoA = Number(a.fecha || 0);
  const fechaTorneoB = Number(b.fecha || 0);
  const porFechaTorneo = fechaTorneoA - fechaTorneoB;

  if (porFechaTorneo !== 0) return porFechaTorneo;

  const fechaPartidoA = a.fecha_partido || "9999-12-31";
  const fechaPartidoB = b.fecha_partido || "9999-12-31";
  const porFechaPartido = fechaPartidoA.localeCompare(fechaPartidoB);

  if (porFechaPartido !== 0) return porFechaPartido;

  const horaA = a.hora || "23:59";
  const horaB = b.hora || "23:59";
  return horaA.localeCompare(horaB) ||
    Number(a.id || 0) - Number(b.id || 0);
}

function resumirAntecedentesRegulares(antecedentes) {
  const {
    equipoA,
    equipoB,
    victoriasA,
    victoriasB,
    empates
  } = antecedentes;

  if (victoriasA > victoriasB) {
    return `${nombre(equipoA)}: ${victoriasA}G ${empates}E`;
  }

  if (victoriasB > victoriasA) {
    return `${nombre(equipoB)}: ${victoriasB}G ${empates}E`;
  }

  if (victoriasA === 0) {
    return `${empates} ${empates === 1 ? "empate" : "empates"}`;
  }

  return `Igualado: ${victoriasA}G c/u`;
}

function obtenerFormaReciente(equipo, limite = 5) {
  return state.partidos
    .map(resolverPartidoPlayoff)
    .filter(
      partido =>
        (partido.local === equipo || partido.visitante === equipo) &&
        partido.goles_local !== null &&
        partido.goles_visitante !== null
    )
    .sort(ordenarPartidosRecientes)
    .slice(0, limite)
    .map(partido => ({
      partido,
      resultado: resultadoEquipoDetalle(partido, equipo)
    }));
}

function renderFormaPulso(equipo) {
  const forma = obtenerFormaReciente(equipo);

  if (forma.length === 0) {
    return `
      <div class="home-live__form home-live__form--empty">
        ${ESTADOS_DATO.sinDatos}
      </div>
    `;
  }

  const etiquetas = {
    G: "Victoria",
    E: "Empate",
    P: "Derrota"
  };
  const descripcion = forma
    .map(item => etiquetas[item.resultado])
    .join(", ");

  return `
    <div class="home-live__form" aria-label="Forma reciente: ${descripcion}">
      ${forma.map(item => `
        <span
          class="form-${item.resultado.toLowerCase()}"
          title="${etiquetas[item.resultado]}"
          aria-hidden="true"
        ></span>
      `).join("")}
    </div>
  `;
}

function formatearFechaHoraPulso(partido) {
  if (!partido.fecha_partido) {
    return obtenerHoraPartido(partido);
  }

  return `${formatearFechaCompleta(partido.fecha_partido)} · ${
    obtenerHoraPartido(partido)
  }`;
}

function obtenerCuentaRegresivaPulso(partido) {
  const inicio = crearFechaHoraPartido(partido);
  if (!inicio) return ESTADOS_DATO.confirmar;

  const diferencia = inicio.getTime() - Date.now();
  if (diferencia <= 0) {
    return partido.goles_local !== null ? "Finalizado" : "Hoy";
  }

  const dias = Math.floor(diferencia / 86400000);
  const horas = Math.floor((diferencia % 86400000) / 3600000);
  const minutos = Math.floor((diferencia % 3600000) / 60000);

  return dias > 0
    ? `En ${dias}d ${horas}h`
    : `En ${horas}h ${minutos}m`;
}

function renderDatosPartidosPulso(partidos) {
  const fechaHora = obtenerValorComunPulso(
    partidos,
    formatearFechaHoraPulso
  );
  const estadio = obtenerValorComunPulso(
    partidos,
    obtenerEstadioPartido
  );
  const arbitro = obtenerValorComunPulso(
    partidos,
    obtenerArbitroPartido
  );
  const transmision = obtenerValorComunPulso(
    partidos,
    partido => partido.transmision || partido.canal
  );
  const definicion = obtenerValorComunPulso(
    partidos,
    partido => partido.definicion_empate
  );

  return renderSeccionPulso(
    "Datos del partido",
    "Confirmados y pendientes",
    `
      <div class="home-live__data-grid">
        ${renderDatoPulso(
          "Fecha y hora",
          fechaHora,
          `<circle cx="12" cy="12" r="9"/><polyline points="12,6 12,12 15.5,14"/>`
        )}
        ${renderDatoPulso(
          "Estadio",
          estadio,
          `<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>`
        )}
        ${renderDatoPulso(
          "Árbitro",
          arbitro,
          `<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/>`
        )}
        ${renderDatoPulso(
          "Transmisión",
          transmision,
          `<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>`
        )}
        ${renderDatoPulso(
          "Definición en caso de empate",
          definicion,
          `<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>`,
          true
        )}
      </div>
      <p class="home-live__data-help">
        “A confirmar” indica información futura que todavía no fue
        publicada. “Sin datos” indica un registro histórico no cargado.
      </p>
    `
  );
}

function obtenerValorComunPulso(
  partidos,
  obtenerValor,
  valorVacio = ESTADOS_DATO.confirmar
) {
  const valores = partidos
    .map(obtenerValor)
    .filter(Boolean);

  if (valores.length === 0) return valorVacio;

  const unicos = [...new Set(valores)];
  return unicos.length === 1 ? unicos[0] : "Ver cada cruce";
}

function renderDatoPulso(etiqueta, valor, icono, anchoCompleto = false) {
  const estado = obtenerEstadoDato(valor);

  return `
    <div class="home-live__data-card ${anchoCompleto ? "wide" : ""}">
      <svg viewBox="0 0 24 24" aria-hidden="true">${icono}</svg>
      <span>${etiqueta}</span>
      <strong class="${estado ? `data-${estado}` : ""}">${valor}</strong>
    </div>
  `;
}

function obtenerEstadoDato(valor) {
  if (valor === ESTADOS_DATO.confirmar) return "pending";
  if (valor === ESTADOS_DATO.sinDatos) return "missing";
  if (
    valor === ESTADOS_DATO.sinIdentificar ||
    String(valor).toLowerCase().includes("sin identificar")
  ) {
    return "incomplete";
  }

  return "";
}

function calcularLlegadaPlayoff(equipo, faseObjetivo = "semifinal") {
  const indiceFase = FASES_PLAYOFF.findIndex(
    fase => fase.valor === faseObjetivo
  );
  const fasesPrevias = new Set(
    FASES_PLAYOFF
      .slice(0, Math.max(indiceFase, 0))
      .map(fase => fase.valor)
  );
  const partidos = state.partidos
    .filter(
      partido =>
        partido.tipo === "playoff" &&
        fasesPrevias.has(partido.fase) &&
        partido.goles_local !== null &&
        partido.goles_visitante !== null
    )
    .map(resolverPartidoPlayoff)
    .filter(
      partido =>
        partido.local === equipo ||
        partido.visitante === equipo
    );
  const estadisticas = {
    partidos: partidos.length,
    golesFavor: 0,
    golesContra: 0,
    victorias: 0,
    empates: 0,
    derrotas: 0,
    seriesGanadas: 0,
    seriesPorPenales: 0,
    vallasInvictas: 0
  };

  partidos.forEach(partido => {
    const esLocal = partido.local === equipo;
    const favor = Number(
      esLocal ? partido.goles_local : partido.goles_visitante
    );
    const contra = Number(
      esLocal ? partido.goles_visitante : partido.goles_local
    );
    const ladoGanador = obtenerGanadorPlayoff(partido);
    const ganador = ladoGanador ? partido[ladoGanador] : null;
    const definidoPorPenales =
      favor === contra &&
      partido.penales_local !== null &&
      partido.penales_visitante !== null;

    estadisticas.golesFavor += favor;
    estadisticas.golesContra += contra;

    if (favor > contra) estadisticas.victorias += 1;
    if (favor === contra) estadisticas.empates += 1;
    if (favor < contra) estadisticas.derrotas += 1;
    if (contra === 0) estadisticas.vallasInvictas += 1;

    if (ganador === equipo) {
      estadisticas.seriesGanadas += 1;
      if (definidoPorPenales) {
        estadisticas.seriesPorPenales += 1;
      }
    }
  });

  return estadisticas;
}

function resumirLlegadaPlayoff(datos) {
  if (datos.partidos === 0) return ESTADOS_DATO.sinDatos;

  const goles = datos.golesFavor === 1 ? "gol" : "goles";
  return `${datos.golesFavor} ${goles} · ${datos.golesContra} en contra`;
}

function obtenerNotaLlegadaPlayoff(
  datos,
  equipos,
  faseObjetivo
) {
  if (datos.partidos === 0) {
    return "Sin datos de partidos previos en estos playoffs.";
  }

  const comparables = equipos
    .map(item => ({
      datos: calcularLlegadaPlayoff(item, faseObjetivo)
    }))
    .filter(item => item.datos.partidos > 0);
  const maximoGoles = Math.max(
    ...comparables.map(item => item.datos.golesFavor)
  );
  const minimoContra = Math.min(
    ...comparables.map(item => item.datos.golesContra)
  );
  const mejoresAtaques = comparables.filter(
    item => item.datos.golesFavor === maximoGoles
  ).length;
  const mejoresDefensas = comparables.filter(
    item => item.datos.golesContra === minimoContra
  ).length;

  if (datos.golesFavor === maximoGoles) {
    return mejoresAtaques === 1
      ? "Mayor producción ofensiva entre los protagonistas."
      : "Comparte la mayor producción ofensiva de la etapa.";
  }

  if (datos.golesContra === minimoContra) {
    return mejoresDefensas === 1
      ? "Mejor registro defensivo entre los protagonistas."
      : "Comparte el mejor registro defensivo de la etapa.";
  }

  if (datos.seriesPorPenales > 0) {
    const cantidad = datos.seriesPorPenales;
    return `${cantidad} ${cantidad === 1 ? "serie definida" : "series definidas"} por penales.`;
  }

  return `${datos.victorias} ${datos.victorias === 1 ? "victoria" : "victorias"} y ${datos.seriesGanadas} ${datos.seriesGanadas === 1 ? "serie ganada" : "series ganadas"}.`;
}

function renderLlegadaPulso(
  equipo,
  protagonistas,
  faseObjetivo
) {
  const datos = calcularLlegadaPlayoff(equipo, faseObjetivo);
  const nota = obtenerNotaLlegadaPlayoff(
    datos,
    protagonistas,
    faseObjetivo
  );
  const resumen = datos.partidos === 0
    ? `
      <div class="home-live__arrival-empty data-missing">
        Sin partidos previos en estos playoffs
      </div>
    `
    : `
      <div class="home-live__stat">
        <strong>${datos.golesFavor}</strong>
        <span>goles a favor</span>
      </div>
      <div class="home-live__stat">
        <strong class="neutral">${datos.golesContra}</strong>
        <span>goles en contra</span>
      </div>
      <p>${nota}</p>
    `;

  return `
    <article class="home-live__arrival-card">
      <div class="home-live__arrival-team">
        ${renderEscudoPulso(equipo)}
        <h3>${nombre(equipo)}</h3>
      </div>
      ${renderFormaPulso(equipo)}
      ${resumen}
    </article>
  `;
}

function renderClasificacionPulso() {
  const cuartos = state.partidos
    .filter(
      partido =>
        partido.tipo === "playoff" &&
        partido.fase === "cuartos" &&
        partido.goles_local !== null &&
        partido.goles_visitante !== null
    )
    .map(resolverPartidoPlayoff)
    .sort(
      (a, b) =>
        Number(a.numero_playoff || 0) -
        Number(b.numero_playoff || 0)
    );

  if (cuartos.length === 0) return "";

  return renderSeccionPulso(
    "Así se clasificaron",
    "Cuartos de final",
    `
      <div class="home-live__qualified-list">
        ${cuartos.map(partido => {
          const ganador = obtenerGanadorPlayoff(partido);
          const tienePenales =
            partido.penales_local !== null &&
            partido.penales_visitante !== null;

          return `
            <button
              type="button"
              class="home-live__qualified-row"
              onclick="abrirPartido(${JSON.stringify(partido.id)})"
            >
              <span class="${ganador === partido.local ? "winner" : ""}">
                ${nombre(partido.local)}
              </span>
              <strong>
                ${partido.goles_local} — ${partido.goles_visitante}
              </strong>
              <span class="right ${ganador === partido.visitante ? "winner" : ""}">
                ${nombre(partido.visitante)}
              </span>
              <small class="${tienePenales ? "" : "classified"}">
                ${tienePenales
                  ? `Pen ${partido.penales_local}–${partido.penales_visitante}`
                  : "CLF"}
              </small>
            </button>
          `;
        }).join("")}
      </div>
    `
  );
}

function renderCaminoPulso(equipo) {
  const fases = [
    { valor: "octavos", etiqueta: "Oct" },
    { valor: "cuartos", etiqueta: "Cto" }
  ];
  const pasos = fases.map(fase => {
    const partido = state.partidos
      .filter(
        item =>
          item.tipo === "playoff" &&
          item.fase === fase.valor
      )
      .map(resolverPartidoPlayoff)
      .find(
        item =>
          item.local === equipo ||
          item.visitante === equipo
      );

    if (!partido) {
      return fase.valor === "octavos"
        ? `
          <div class="home-live__path-item">
            <span>${fase.etiqueta}</span>
            <strong>Pase directo</strong>
          </div>
        `
        : "";
    }

    const rival = partido.local === equipo
      ? partido.visitante
      : partido.local;

    return `
      <div class="home-live__path-item">
        <span>${fase.etiqueta}</span>
        <strong>${rival ? nombre(rival) : "Por definir"}</strong>
      </div>
    `;
  }).join("");

  return `
    <article class="home-live__path-card">
      <h3>${nombre(equipo)}</h3>
      <div>${pasos}</div>
    </article>
  `;
}

function obtenerGoleadoresReales() {
  const equiposPorId = new Map();
  const partidosPorId = new Map();

  state.partidos.forEach(partido => {
    partidosPorId.set(String(partido.id), partido);

    if (partido.local_id !== null && partido.local_id !== undefined) {
      equiposPorId.set(String(partido.local_id), partido.local);
    }
    if (
      partido.visitante_id !== null &&
      partido.visitante_id !== undefined
    ) {
      equiposPorId.set(
        String(partido.visitante_id),
        partido.visitante
      );
    }
  });

  const acumulados = new Map();

  state.eventos.forEach(evento => {
    if (!esGolComputable(evento)) return;

    const jugador = limpiarNombreJugador(evento.jugador);
    const equipo = resolverEquipoEventoGoleador(
      evento,
      equiposPorId,
      partidosPorId
    );
    const claveJugador = normalizarClaveGoleador(jugador);
    const claveEquipo = equipo || `id:${evento.equipo_id || "sin-equipo"}`;
    const clave = `${claveJugador}|${claveEquipo}`;
    const actual = acumulados.get(clave) || {
      jugador,
      equipo,
      goles: 0
    };

    actual.goles += 1;
    acumulados.set(clave, actual);
  });

  const ordenados = [...acumulados.values()].sort(
    (a, b) =>
      b.goles - a.goles ||
      a.jugador.localeCompare(
        b.jugador,
        "es",
        { sensitivity: "base" }
      )
  );
  let posicionAnterior = 0;
  let golesAnteriores = null;

  return ordenados.map((goleador, indice) => {
    if (goleador.goles !== golesAnteriores) {
      posicionAnterior = indice + 1;
      golesAnteriores = goleador.goles;
    }

    return {
      ...goleador,
      posicion: posicionAnterior,
      club: goleador.equipo
        ? nombre(goleador.equipo)
        : `Club ${ESTADOS_DATO.sinIdentificar.toLowerCase()}`
    };
  });
}

function resolverEquipoEventoGoleador(
  evento,
  equiposPorId,
  partidosPorId
) {
  const equipoId = String(evento.equipo_id ?? "");
  const equipoDirecto = equiposPorId.get(equipoId);
  if (equipoDirecto) return equipoDirecto;

  const partido = partidosPorId.get(String(evento.partido_id));
  if (!partido || !equipoId) return null;

  if (equipoId === String(partido.local)) return partido.local;
  if (equipoId === String(partido.visitante)) return partido.visitante;

  const claveEquipo = normalizarClaveGoleador(equipoId);
  const candidatos = [partido.local, partido.visitante].filter(Boolean);

  return candidatos.find(equipo =>
    [
      normalizarClaveGoleador(equipo),
      normalizarClaveGoleador(nombre(equipo))
    ].includes(claveEquipo)
  ) || null;
}

function esGolComputable(evento) {
  const tipo = String(evento.tipo || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[_-]+/g, " ");

  return (
    tipo.includes("gol") &&
    !tipo.includes("anulado") &&
    !tipo.includes("autogol") &&
    !tipo.includes("en contra") &&
    Boolean(limpiarNombreJugador(evento.jugador))
  );
}

function limpiarNombreJugador(jugador) {
  const nombreJugador = String(jugador || "")
    .trim()
    .replace(/\s+/g, " ");
  const clave = normalizarClaveGoleador(nombreJugador);
  const valoresInvalidos = new Set([
    "",
    "jugador no informado",
    "sin informar",
    "no informado",
    "desconocido"
  ]);

  return valoresInvalidos.has(clave) ? "" : nombreJugador;
}

function normalizarClaveGoleador(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function escaparHtml(valor) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatearFechaPulso(fecha) {
  const meses = [
    "ene", "feb", "mar", "abr", "may", "jun",
    "jul", "ago", "sep", "oct", "nov", "dic"
  ];

  return `${fecha.getDate()} ${meses[fecha.getMonth()]} ${fecha.getFullYear()}`;
}

function abrirEtapaPartidos(clave) {
  selectStage(clave);
  switchTab("partidos");
}

function renderPlayoffs() {
  const cont = document.getElementById("playoffsContent");
  if (!cont) return;

  if (errorCargaDatos && state.partidos.length === 0) {
    cont.innerHTML = renderEstadoVista(
      "error",
      "No pudimos cargar los playoffs",
      obtenerMensajeErrorCargaDatos("Revisá tu conexión e intentá nuevamente."),
      true
    );
    return;
  }

  if (!cargaPartidosFinalizada) {
    cont.innerHTML = renderSkeletonPlayoffs();
    return;
  }

  const faseActual = obtenerFaseActualPlayoffs();
  const fasesDisponibles = obtenerFasesPlayoffDisponibles();
  const nombreTorneo = obtenerNombreTorneoActivo();
  const campeon = obtenerResultadoSerieFinal().ganador;
  const tituloBanner = campeon
    ? `${nombre(campeon)} campeón`
    : "Playoffs";
  const banner = `
    <div class="po-banner">
      <div class="po-banner-icon">🏆</div>
      <div class="po-banner-tournament">${escaparHtml(nombreTorneo)}</div>
      <div class="po-banner-title">${escaparHtml(tituloBanner)}</div>
      <div class="po-banner-sub">Liga Cañadense · Primera División</div>
    </div>
  `;
  const selectorTorneos = renderSelectorTorneosPlayoffs();

  if (fasesDisponibles.length === 0) {
    cont.innerHTML = `
      ${banner}
      ${selectorTorneos}
      ${renderPlayoffsSinCruces(nombreTorneo)}
    `;
    return;
  }

  const faseActiva = obtenerFaseActivaPlayoff(
    fasesDisponibles,
    faseActual
  );

  cont.innerHTML = `
    ${banner}
    ${selectorTorneos}

    ${renderTabsPlayoff(
      fasesDisponibles,
      faseActiva,
      faseActual
    )}

    ${renderClasificadosDirectosPlayoff(faseActiva)}

    ${faseActiva
      ? renderFasePlayoff(
          FASES_PLAYOFF.find(fase => fase.valor === faseActiva),
          faseActual
        )
      : ""}
    ${renderCaminosPlayoff(faseActiva)}
  `;
}

function renderSelectorTorneosPlayoffs() {
  const idsConPartidos = new Set(
    state.partidosTodos.map(partido => String(partido.torneo_id))
  );
  const torneos = state.torneos
    .filter(
      torneo =>
        torneo.activo || idsConPartidos.has(String(torneo.id))
    )
    .sort(
      (a, b) =>
        Number(b.anio || 0) - Number(a.anio || 0) ||
        String(b.fecha_inicio || "").localeCompare(
          String(a.fecha_inicio || "")
        ) ||
        String(b.tipo || "").localeCompare(String(a.tipo || ""))
    );

  if (torneos.length <= 1) return "";

  return `
    <label class="po-tournament-switch">
      <span>Torneo</span>
      <select
        aria-label="Seleccionar torneo de playoffs"
        onchange="seleccionarTorneoPlayoffs(this.value)"
      >
        ${torneos.map(torneo => `
          <option
            value="${torneo.id}"
            ${String(torneo.id) === String(state.torneoActivo?.id)
              ? "selected"
              : ""}
          >
            ${escaparHtml(torneo.nombre)}${torneo.activo ? " · Actual" : ""}
          </option>
        `).join("")}
      </select>
    </label>
  `;
}

function renderPlayoffsSinCruces(nombreTorneo) {
  return `
    <section class="po-empty-state">
      <span>Fase regular en curso</span>
      <strong>Los playoffs todavía no comenzaron</strong>
      <p>
        Los cruces de ${escaparHtml(nombreTorneo)} aparecerán cuando queden
        definidos.
      </p>
      <button type="button" onclick="switchTab('tabla')">Ver tabla</button>
    </section>
  `;
}

function renderClasificadosDirectosPlayoff(faseActiva) {
  if (faseActiva !== "cuartos") return "";

  const directos = obtenerClasificadosDirectos();

  return `
    <div class="po-phase">
      <div class="po-phase-title">Clasificados directos</div>
      <span class="po-phase-tag">Cuartos de Final</span>
    </div>

    <div class="po-qualified">
      <div class="po-q-head">Mejores primeros de zona</div>
      ${directos.map((fila, indice) =>
        renderClasificadoDirecto(fila, indice)
      ).join("")}
    </div>
  `;
}

function obtenerFasesPlayoffDisponibles() {
  return FASES_PLAYOFF.filter(fase =>
    state.partidos.some(
      partido =>
        partido.tipo === "playoff" &&
        partido.fase === fase.valor
    )
  );
}

function obtenerFaseActivaPlayoff(fasesDisponibles, faseActual) {
  const disponibles = new Set(
    fasesDisponibles.map(fase => fase.valor)
  );

  if (fasePlayoffActiva && disponibles.has(fasePlayoffActiva)) {
    return fasePlayoffActiva;
  }
  if (faseActual && disponibles.has(faseActual)) {
    fasePlayoffActiva = faseActual;
    return faseActual;
  }

  fasePlayoffActiva =
    fasesDisponibles[fasesDisponibles.length - 1]?.valor || null;
  return fasePlayoffActiva;
}

function seleccionarFasePlayoff(fase) {
  if (!FASES_PLAYOFF.some(item => item.valor === fase)) return;

  fasePlayoffActiva = fase;
  renderPlayoffs();
}

function renderTabsPlayoff(fasesDisponibles, faseActiva, faseActual) {
  if (fasesDisponibles.length <= 1) return "";

  return `
    <div class="po-stage-tabs" role="tablist" aria-label="Fases de playoffs">
      ${fasesDisponibles.map(fase => {
        const partidos = obtenerPartidosPlayoffPorFase(fase.valor);
        const estado = obtenerEstadoFasePlayoff(
          partidos,
          fase.valor === faseActual
        );
        const activa = fase.valor === faseActiva;

        return `
          <button
            type="button"
            class="po-stage-tab ${activa ? "active" : ""} ${fase.valor === faseActual ? "current" : ""} state-${estado.clase}"
            onclick="seleccionarFasePlayoff('${fase.valor}')"
            aria-pressed="${activa}"
          >
            <span>${obtenerEtiquetaCortaFase(fase.valor)}</span>
            <small>${estado.texto}</small>
          </button>
        `;
      }).join("")}
    </div>
  `;
}

function obtenerEtiquetaCortaFase(fase) {
  return {
    octavos: "Octavos",
    cuartos: "Cuartos",
    semifinal: "Semis",
    final: "Final"
  }[fase] || etiquetaFase(fase);
}

function obtenerPartidosPlayoffPorFase(fase) {
  return state.partidos
    .filter(
      partido =>
        partido.tipo === "playoff" &&
        partido.fase === fase
    )
    .sort(
      (a, b) =>
        Number(a.numero_playoff || 0) -
        Number(b.numero_playoff || 0)
    );
}

function renderClasificadoDirecto(fila, indice) {
  const nombreEquipo = nombre(fila.equipo);

  return `
    <div class="po-q-row">
      <div class="po-q-pos">${indice + 1}</div>
      ${renderEscudoPlayoff(fila.equipo, "shield")}
      <div class="po-q-name">
        ${nombreEquipo}
        <span>· Zona ${fila.zona}</span>
      </div>
      <div class="po-q-pts">${fila.pts}</div>
      <div class="po-q-tag direct">Cuartos</div>
    </div>
  `;
}

function renderFasePlayoff(fase, faseActual) {
  if (!fase) return "";

  const partidos = obtenerPartidosPlayoffPorFase(fase.valor);

  if (partidos.length === 0) return "";

  const esActual = fase.valor === faseActual;
  const estado = obtenerEstadoFasePlayoff(
    partidos,
    esActual
  );

  return `
    <section class="po-stage ${esActual ? "current" : ""} state-${estado.clase}">
      <div class="po-phase">
        <div class="po-phase-title">${fase.etiqueta}</div>
        <span class="po-phase-tag state-${estado.clase}">
          ${estado.texto}
        </span>
      </div>
      ${fase.valor === "final" ? renderResumenSerieFinal() : ""}
      ${renderProgresoFasePlayoff(partidos)}
      <div class="po-bracket">
        ${partidos.map(partido =>
          renderCrucePlayoff(partido)
        ).join("")}
      </div>
    </section>
  `;
}

function renderResumenSerieFinal() {
  const serie = obtenerResultadoSerieFinal();
  if (serie.equipos.length !== 2) return "";

  const [equipoA, equipoB] = serie.equipos;
  const golesA = serie.goles.get(equipoA) || 0;
  const golesB = serie.goles.get(equipoB) || 0;
  const jugados = serie.partidos.filter(partidoTieneResultado).length;
  const definicionPorPenales =
    serie.ganador && golesA === golesB;
  const estado = serie.ganador
    ? `${nombre(serie.ganador)} campeón`
    : serie.definicionPendiente
      ? "Definición pendiente"
      : jugados === 0
        ? "Serie por comenzar"
        : "Serie abierta";

  return `
    <div class="po-series-summary">
      <div class="po-series-head">
        <span>Resultado global</span>
        <strong>${escaparHtml(estado)}</strong>
      </div>
      <div class="po-series-score">
        ${renderEquipoResumenSerie(equipoA)}
        <div class="po-series-total">
          <strong>${golesA} - ${golesB}</strong>
          <span>${definicionPorPenales ? "Definida por penales" : "Global"}</span>
        </div>
        ${renderEquipoResumenSerie(equipoB, true)}
      </div>
    </div>
  `;
}

function renderEquipoResumenSerie(equipo, visitante = false) {
  return `
    <button
      type="button"
      class="po-series-team ${visitante ? "away" : ""}"
      onclick='abrirEquipo(${JSON.stringify(equipo)})'
      aria-label="Ver equipo ${escaparHtml(nombre(equipo))}"
    >
      ${renderEscudoPlayoff(equipo, "po-series-shield")}
      <strong>${escaparHtml(nombre(equipo))}</strong>
    </button>
  `;
}

function renderProgresoFasePlayoff(partidos) {
  const total = partidos.length;
  if (total === 0) return "";

  const jugados = partidos
    .map(resolverPartidoPlayoff)
    .filter(
      partido =>
        partido.goles_local !== null &&
        partido.goles_visitante !== null
    ).length;
  const porcentaje = Math.round((jugados / total) * 100);

  return `
    <div class="po-progress-block">
      <div class="po-progress-label">
        <span>Progreso</span>
        <strong>${jugados} de ${total} partidos</strong>
      </div>
      <div class="po-progress" aria-label="${jugados} de ${total} partidos con resultado cargado">
        <div class="po-progress-fill" style="width:${porcentaje}%"></div>
      </div>
    </div>
  `;
}

function obtenerEstadoFasePlayoff(partidos, esActual) {
  const resueltos = partidos.map(resolverPartidoPlayoff);
  const esFinal = resueltos.some(partido => partido.fase === "final");
  if (esFinal) {
    const serieFinal = obtenerResultadoSerieFinal();

    if (serieFinal.ganador) {
      return { texto: "Finalizada", clase: "completed" };
    }
    if (serieFinal.definicionPendiente) {
      return { texto: "Definición pendiente", clase: "waiting" };
    }
  }

  const terminada =
    !esFinal &&
    resueltos.every(partido => obtenerGanadorPlayoff(partido));

  if (terminada) {
    return { texto: "Finalizada", clase: "completed" };
  }

  const estados = resueltos.map(
    partido => obtenerEstadoTemporalPartido(partido)
  );

  if (estados.some(estado => estado.tipo === "penales")) {
    return { texto: "En definición", clase: "live" };
  }
  if (estados.some(estado => estado.tipo === "en-juego")) {
    return { texto: "En juego", clase: "live" };
  }
  if (estados.some(estado => estado.tipo === "esperando")) {
    return { texto: "Esperando resultado", clase: "waiting" };
  }
  if (
    estados.some(
      estado =>
        estado.tipo === "suspendido" ||
        estado.tipo === "postergado"
    )
  ) {
    return { texto: "Programación alterada", clase: "disrupted" };
  }
  if (!esActual) {
    return { texto: "Pendiente", clase: "pending" };
  }

  const tieneEquipos = resueltos.some(
    partido => partido.local || partido.visitante
  );
  const tieneFinalizados = estados.some(
    estado => estado.tipo === "final"
  );

  if (!tieneEquipos) {
    return { texto: "Llaves por definir", clase: "pending" };
  }
  if (
    estados.some(estado => estado.tipo === "sin-fecha")
  ) {
    return { texto: "Programación pendiente", clase: "pending" };
  }
  if (tieneFinalizados) {
    return { texto: "En curso", clase: "active" };
  }

  return { texto: "Programada", clase: "scheduled" };
}

function renderCrucePlayoff(partido) {
  partido = resolverPartidoPlayoff(partido);

  const jugado =
    partido.goles_local !== null &&
    partido.goles_visitante !== null;
  const tieneEquipos = Boolean(partido.local || partido.visitante);
  const ganador = obtenerGanadorPlayoff(partido);
  const estadoTemporal = obtenerEstadoTemporalPartido(partido);
  const estado = obtenerEtiquetaEstadoCruce(
    estadoTemporal,
    tieneEquipos
  );
  const codigoFase = {
    octavos: "OF",
    cuartos: "QF",
    semifinal: "SF",
    final: "F"
  }[partido.fase] || "";
  const codigoPartido = partido.fase === "final"
    ? `${codigoFase} · ${
        Number(partido.numero_playoff) === 2 ? "Vuelta" : "Ida"
      }`
    : `${codigoFase} · ${partido.numero_playoff || 1}`;
  const detalle = [
    obtenerDetallePlayoff(partido),
    partido.localia_pendiente ? "Localía a definir" : ""
  ].filter(Boolean).join(" · ");

  return `
    <button
      type="button"
      class="po-match ${tieneEquipos ? "" : "pending"}"
      onclick="abrirPartido(${JSON.stringify(partido.id)})"
      ${tieneEquipos ? "" : "disabled"}
    >
      <div class="po-match-hd">
        <div class="po-match-id">
          ${codigoPartido}
          ${detalle ? `<span>${detalle}</span>` : ""}
        </div>
        <div class="po-match-meta">
          <div class="po-st state-${estadoTemporal.clase} ${jugado && estadoTemporal.tipo === "final" ? "done" : ""}">
            ${estado}
          </div>
          ${tieneEquipos
            ? `<span class="po-match-chev" aria-hidden="true">›</span>`
            : ""}
        </div>
      </div>
      ${renderEquipoPlayoff(
        partido,
        "local",
        ganador,
        obtenerPlaceholderPlayoff(partido, "local")
      )}
      ${renderEquipoPlayoff(
        partido,
        "visitante",
        ganador,
        obtenerPlaceholderPlayoff(partido, "visitante")
      )}
    </button>
  `;
}

function obtenerEtiquetaEstadoCruce(estado, tieneEquipos) {
  if (!tieneEquipos) return "Pendiente";

  return {
    final: "Final",
    penales: "Penales",
    "en-juego": "En vivo",
    esperando: "Esperando",
    suspendido: "Suspendido",
    postergado: "Postergado",
    "sin-fecha": ESTADOS_DATO.confirmar,
    programado: "Próximo"
  }[estado.tipo] || estado.texto;
}

function renderEquipoPlayoff(partido, lado, ganador, placeholder) {
  const equipo = partido[lado];
  const esGanador = ganador === lado;
  const esPerdedor = ganador && ganador !== lado;
  const goles = lado === "local"
    ? partido.goles_local
    : partido.goles_visitante;
  const penales = lado === "local"
    ? partido.penales_local
    : partido.penales_visitante;

  if (!equipo) {
    return `
      <div class="po-tbd-row">
        <div class="po-tbd-sh"></div>
        <div class="po-tbd-n">${placeholder}</div>
        <div class="po-ts tbd">–</div>
      </div>
    `;
  }

  return `
    <div class="po-trow ${esGanador ? "winner" : ""} ${esPerdedor ? "loser" : ""}">
      ${renderEscudoPlayoff(equipo, "po-tshield")}
      <div class="po-tn">${nombre(equipo)}</div>
      <div class="po-result">
        <div class="po-ts">${goles ?? "–"}</div>
        ${penales !== null ? `<div class="po-pen">Pen. ${penales}</div>` : ""}
      </div>
    </div>
  `;
}

function renderCaminosPlayoff(faseActiva) {
  if (faseActiva !== "final") return "";

  const equipos = obtenerEquiposCaminoPlayoff(faseActiva);
  if (equipos.length === 0) return "";

  return `
    <section class="po-paths">
      <div class="po-phase">
        <div class="po-phase-title">Camino a la final</div>
        <span class="po-phase-tag">${equipos.length} equipos</span>
      </div>
      <div class="po-path-grid">
        ${equipos.map(equipo =>
          renderCaminoPlayoffEquipo(equipo, faseActiva)
        ).join("")}
      </div>
    </section>
  `;
}

function obtenerEquiposCaminoPlayoff(faseActiva) {
  const partidos = obtenerPartidosPlayoffPorFase(faseActiva)
    .map(resolverPartidoPlayoff);
  let equipos = [];

  if (faseActiva === "final") {
    equipos = obtenerResultadoSerieFinal().equipos;
    if (equipos.length === 0) {
      equipos = obtenerGanadoresFasePlayoff("semifinal");
    }
  } else {
    equipos = obtenerGanadoresFasePlayoff(faseActiva);
    if (equipos.length === 0) {
      equipos = partidos
        .flatMap(partido => [partido.local, partido.visitante])
        .filter(Boolean);
    }
  }

  return [...new Set(equipos)].slice(
    0,
    faseActiva === "final" ? 2 : 4
  );
}

function obtenerGanadoresFasePlayoff(fase) {
  return obtenerPartidosPlayoffPorFase(fase)
    .map(resolverPartidoPlayoff)
    .map(partido => {
      const ganador = obtenerGanadorPlayoff(partido);
      return ganador ? partido[ganador] : null;
    })
    .filter(Boolean);
}

function renderCaminoPlayoffEquipo(equipo, faseActiva) {
  const pasos = obtenerFasesCaminoPlayoff(faseActiva)
    .map(fase => renderPasoCaminoPlayoff(equipo, fase))
    .filter(Boolean)
    .join("");

  if (!pasos) return "";

  return `
    <article class="po-path-card">
      <div class="po-path-head">
        <span>Equipo</span>
        <strong>${nombre(equipo)}</strong>
      </div>
      ${pasos}
    </article>
  `;
}

function obtenerFasesCaminoPlayoff(faseActiva) {
  const indice = FASES_PLAYOFF.findIndex(
    fase => fase.valor === faseActiva
  );
  if (indice < 0) return [];

  const limite = faseActiva === "final" ? indice : indice + 1;
  return FASES_PLAYOFF.slice(
    0,
    Math.min(limite, FASES_PLAYOFF.length - 1)
  );
}

function renderPasoCaminoPlayoff(equipo, fase) {
  const partido = obtenerPartidosPlayoffPorFase(fase.valor)
    .map(resolverPartidoPlayoff)
    .find(
      item =>
        item.local === equipo ||
        item.visitante === equipo
    );

  if (!partido) {
    if (
      fase.valor === "octavos" &&
      obtenerClasificadosDirectos().some(fila => fila.equipo === equipo)
    ) {
      return `
        <div class="po-path-step">
          <span>${obtenerEtiquetaCortaFase(fase.valor)}</span>
          <strong>Pase directo</strong>
          <em class="po-path-badge direct">Cuartos</em>
        </div>
      `;
    }

    return "";
  }

  const rival = partido.local === equipo
    ? partido.visitante
    : partido.local;
  const resultado = obtenerResultadoCaminoPlayoff(equipo, partido);

  return `
    <button
      type="button"
      class="po-path-step"
      onclick="abrirPartido(${JSON.stringify(partido.id)})"
    >
      <span>${obtenerEtiquetaCortaFase(fase.valor)}</span>
      <strong>vs ${rival ? nombre(rival) : "Por definir"}</strong>
      <em class="po-path-badge ${resultado.clase}">${resultado.texto}</em>
      <span class="po-path-chev" aria-hidden="true">›</span>
    </button>
  `;
}

function obtenerResultadoCaminoPlayoff(equipo, partido) {
  const jugado =
    partido.goles_local !== null &&
    partido.goles_visitante !== null;

  if (!jugado) {
    return {
      texto: partido.fecha_partido
        ? formatearFechaCompleta(partido.fecha_partido)
        : "Pend.",
      clase: "pending"
    };
  }

  const esLocal = partido.local === equipo;
  const favor = Number(
    esLocal ? partido.goles_local : partido.goles_visitante
  );
  const contra = Number(
    esLocal ? partido.goles_visitante : partido.goles_local
  );
  const penalesFavor = esLocal
    ? partido.penales_local
    : partido.penales_visitante;
  const penalesContra = esLocal
    ? partido.penales_visitante
    : partido.penales_local;
  const ladoGanador = obtenerGanadorPlayoff(partido);
  const ganador = ladoGanador ? partido[ladoGanador] : null;
  const textoPenales =
    penalesFavor !== null &&
    penalesFavor !== undefined &&
    penalesContra !== null &&
    penalesContra !== undefined
      ? ` Pen ${penalesFavor}-${penalesContra}`
      : "";

  if (!ganador && favor === contra) {
    return {
      texto: `${favor}-${contra}${textoPenales}`,
      clase: "draw"
    };
  }

  return {
    texto: `${favor}-${contra}${textoPenales}`,
    clase: ganador === equipo ? "win" : "loss"
  };
}

function renderEscudoPlayoff(equipo, clase) {
  const nombreEquipo = nombre(equipo);
  const escudo = obtenerEscudoEquipo(equipo);
  const contenido = escudo
    ? `<img src="${escudo}" alt="Escudo de ${nombreEquipo}" width="48" height="48" loading="lazy" decoding="async">`
    : nombreEquipo.slice(0, 2).toUpperCase();

  return `<span class="${clase}">${contenido}</span>`;
}

function obtenerDetallePlayoff(partido) {
  const partes = [];

  if (partido.fecha_partido) {
    const [year, month, day] = partido.fecha_partido.split("-");
    if (year && month && day) partes.push(`${day}/${month}`);
  }
  if (partido.hora) partes.push(partido.hora);

  return partes.join(" · ");
}

function obtenerPlaceholderPlayoff(partido, lado) {
  const placeholderSource = obtenerPlaceholderSourcePlayoff(partido, lado);
  if (placeholderSource) return placeholderSource;

  const numero = Number(partido.numero_playoff || 1);

  if (partido.fase === "semifinal") {
    const cuarto = lado === "local"
      ? numero * 2 - 1
      : numero * 2;
    return `Ganador Cuartos ${cuarto}`;
  }

  if (partido.fase === "final") {
    return `Ganador Semifinal ${lado === "local" ? 1 : 2}`;
  }

  return "Por definir";
}

function obtenerPlaceholderSourcePlayoff(partido, lado) {
  const origen = obtenerPartidoOrigenPlayoff(partido, lado);

  if (!origen) return null;

  return `Ganador ${etiquetaFaseOrigen(origen.fase)} ${
    origen.numero_playoff || 1
  }`;
}

function etiquetaFaseOrigen(fase) {
  return {
    octavos: "Octavos",
    cuartos: "Cuartos",
    semifinal: "Semifinal"
  }[fase] || etiquetaFase(fase);
}

function renderTabla() {
  const cont = document.getElementById('tablaContent');
  if (!cont) return;

  actualizarNavegacionTabla();

  if (tablaVistaActual === "goleadores") {
    renderTablaGoleadores(cont);
    return;
  }

  renderTablaPosiciones(cont);
}

function renderTablaPosiciones(cont) {
  if (errorCargaDatos && state.partidos.length === 0) {
    cont.innerHTML = renderEstadoVista(
      "error",
      "No pudimos cargar la tabla",
      obtenerMensajeErrorCargaDatos("Revisá tu conexión e intentá nuevamente."),
      true
    );
    return;
  }

  if (!cargaPartidosFinalizada) {
    cont.innerHTML = renderSkeletonTabla();
    return;
  }

  if (state.partidos.length === 0) {
    cont.innerHTML = renderEstadoVista(
      "vacio",
      "Sin tabla disponible",
      "Todavía no hay resultados suficientes para calcular posiciones."
    );
    return;
  }

  if (tablaPosicionesActual === "general") {
    cont.innerHTML = renderTablaGeneral(true);
    activarPistasScrollHorizontal(cont, vistaActual.id === "tabla");
    return;
  }

  const zona = Number(tablaPosicionesActual) || zonaActual || 1;
  zonaActual = zona;
  const data = calcularTablaZona(zona);
  const clasificados = calcularClasificados();
  let html = `
    <div class="tabla-referencias">
      <div class="tabla-ref">
        <span class="tabla-ref-color ref-cuartos"></span>
        Cuartos directo
      </div>
      <div class="tabla-ref">
        <span class="tabla-ref-color ref-octavos"></span>
        Octavos
      </div>
    </div>
    <div class="tabla-wrap">
      <table class="tabla">
        <thead>
          <tr>
            <th>#</th>
            <th>Equipo</th>
            <th>PTS</th>
            <th>PJ</th>
            <th>PG</th>
            <th>PE</th>
            <th>PP</th>
            <th>DG</th>
          </tr>
        </thead>
        <tbody>
  `;

  data.forEach((t, i) => {
    const nombreEquipo = nombre(t.equipo);
    const escudo = obtenerEscudoTablaEquipo(t.equipo);
    const escudoEquipo = escudo
      ? renderImagenEscudoTabla(
          escudo,
          `Escudo de ${nombreEquipo}`,
          40,
          i
        )
      : obtenerInicialesEquipoTabla(nombreEquipo);
    const diferencia = t.dg > 0 ? `+${t.dg}` : String(t.dg);
    const clasePosicion = claseClasificacion(
      t.equipo,
      clasificados
    );

    html += `
      <tr>
        <td class="t-pos ${clasePosicion}">${i + 1}</td>
        <td>
          <div class="t-name">
            <div class="sm-badge">${escudoEquipo}</div>
            ${nombreEquipo}
          </div>
        </td>
        <td class="t-pts">${t.pts}</td>
        <td>${t.pj}</td>
        <td>${t.pg}</td>
        <td>${t.pe}</td>
        <td>${t.pp}</td>
        <td class="${t.dg > 0 ? 't-dg' : ''}">${diferencia}</td>
      </tr>
    `;
  });

  html += `</tbody></table></div>`;
  cont.innerHTML = html;
  activarPistasScrollHorizontal(cont, vistaActual.id === "tabla");
}

function renderTablaGoleadores(cont) {
  if (
    (errorCargaDatos || state.errorGoleadoresTabla) &&
    obtenerGoleadoresTablaPublicables().length === 0
  ) {
    cont.innerHTML = renderEstadoVista(
      "error",
      "No pudimos cargar goleadores",
      obtenerMensajeErrorCargaDatos("Revisá tu conexión e intentá nuevamente."),
      true
    );
    return;
  }

  if (!cargaPartidosFinalizada) {
    cont.innerHTML = renderSkeletonTabla();
    return;
  }

  const goleadores = obtenerGoleadoresTablaPublicables();
  const maximoGoles = Math.max(
    0,
    ...goleadores.map(goleador => Number(goleador.goles || 0))
  );
  const filtro = obtenerEtiquetaFiltroGoleadoresTabla();
  const idLista = obtenerIdListaGoleadoresTabla();
  const goleadoresVisibles = obtenerGoleadoresVisiblesTabla(goleadores);

  if (goleadores.length === 0) {
    cont.innerHTML = renderEstadoVista(
      "vacio",
      "Sin goleadores cargados",
      obtenerMensajeVacioGoleadoresTabla()
    );
    return;
  }

  cont.innerHTML = `
    <div class="tabla-general tabla-general--standalone tabla-scorers">
      <div class="tabla-general-head">
        <div>
          <h3>Goleadores</h3>
        </div>
        <span>${escaparHtml(filtro)} &middot; Top ${MAXIMO_GOLEADORES_TABLA}</span>
      </div>
      <div class="tabla-scorers-list" id="${escaparHtml(idLista)}">
        ${goleadoresVisibles
          .map((goleador, indice) => renderFilaGoleadorTabla(
            goleador,
            Number(goleador.goles || 0) === maximoGoles,
            indice
          ))
          .join("")}
      </div>
    </div>
  `;
}

function renderTablaGeneral(standalone = false) {
  const data = calcularTablaGeneral();
  const clases = standalone
    ? "tabla-general tabla-general--standalone"
    : "tabla-general";

  return `
    <div class="${clases}">
      <div class="tabla-referencias tabla-referencias--general">
        <div class="tabla-ref tabla-ref-general">
          Tabla general &middot; ${data.length} equipos
        </div>
      </div>
      <div class="tabla-wrap tabla-wrap-general">
        <table class="tabla tabla-general-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Equipo</th>
              <th aria-label="Zona">Z</th>
              <th>PTS</th>
              <th>PJ</th>
              <th>PG</th>
              <th>PE</th>
              <th>PP</th>
              <th>DG</th>
            </tr>
          </thead>
          <tbody>
            ${data.map((t, i) => renderFilaTablaGeneral(t, i)).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderFilaTablaGeneral(t, indice) {
  const nombreEquipo = nombre(t.equipo);
  const escudo = obtenerEscudoTablaEquipo(t.equipo);
  const escudoEquipo = escudo
    ? renderImagenEscudoTabla(
        escudo,
        `Escudo de ${nombreEquipo}`,
        40,
        indice
      )
    : obtenerInicialesEquipoTabla(nombreEquipo);
  const diferencia = t.dg > 0 ? `+${t.dg}` : String(t.dg);

  return `
    <tr>
      <td class="t-pos">${indice + 1}</td>
      <td>
        <div class="t-name">
          <div class="sm-badge">${escudoEquipo}</div>
          ${nombreEquipo}
        </div>
      </td>
      <td class="t-zone">
        <span class="t-zone-pill" aria-label="Zona ${t.zona}" title="Zona ${t.zona}">Z${t.zona}</span>
      </td>
      <td class="t-pts">${t.pts}</td>
      <td>${t.pj}</td>
      <td>${t.pg}</td>
      <td>${t.pe}</td>
      <td>${t.pp}</td>
      <td class="${t.dg > 0 ? 't-dg' : ''}">${diferencia}</td>
    </tr>
  `;
}

function obtenerEtapasDisponibles() {
  const fechas = [
    ...new Set(
      state.partidos
        .filter(p => p.tipo === "regular")
        .map(p => Number(p.fecha))
        .filter(Number.isFinite)
    )
  ]
    .sort((a, b) => a - b)
    .map(fecha => ({
      clave: `fecha:${fecha}`,
      tipo: "regular",
      valor: fecha,
      etiqueta: `Fecha ${fecha}`
    }));

  const fases = FASES_PLAYOFF
    .filter(fase =>
      state.partidos.some(
        p =>
          p.tipo === "playoff" &&
          p.fase === fase.valor
      )
    )
    .map(fase => ({
      clave: `fase:${fase.valor}`,
      tipo: "playoff",
      valor: fase.valor,
      etiqueta: fase.etiqueta
    }));

  return [...fechas, ...fases];
}

function obtenerEtapaInicial(etapas) {
  const etapaRegularInicial = window.TPPublicTournament
    ?.getInitialRegularStageKey(
      state.partidos,
      obtenerOpcionesParticipantesTorneo()
    );

  if (
    etapaRegularInicial &&
    etapas.some(etapa => etapa.clave === etapaRegularInicial)
  ) {
    return etapaRegularInicial;
  }

  const fasesConEquipos = FASES_PLAYOFF.filter(fase =>
    state.partidos.some(
      p =>
        p.tipo === "playoff" &&
        p.fase === fase.valor &&
        (p.local || p.visitante)
    )
  );

  if (fasesConEquipos.length > 0) {
    const faseActual = fasesConEquipos[fasesConEquipos.length - 1];
    return `fase:${faseActual.valor}`;
  }

  return etapas[etapas.length - 1]?.clave || null;
}

function actualizarNavegacionEtapas() {
  const etapas = obtenerEtapasDisponibles();
  const stageSelect = document.getElementById("stageSelect");
  const btnPrev = document.getElementById("btnPrev");
  const btnNext = document.getElementById("btnNext");

  if (etapas.length === 0) {
    etapaActual = null;
    stageSelect.innerHTML = `<option>Sin etapas disponibles</option>`;
    stageSelect.disabled = true;
    btnPrev.disabled = true;
    btnNext.disabled = true;
    return;
  }

  if (!etapas.some(etapa => etapa.clave === etapaActual)) {
    etapaActual = obtenerEtapaInicial(etapas);
  }

  stageSelect.innerHTML = etapas
    .map(
      etapa =>
        `<option value="${etapa.clave}">${etapa.etiqueta}</option>`
    )
    .join("");
  stageSelect.value = etapaActual;
  stageSelect.disabled = false;

  const indexActual = etapas.findIndex(
    etapa => etapa.clave === etapaActual
  );

  btnPrev.disabled = indexActual === 0;
  btnNext.disabled = indexActual === etapas.length - 1;
}

function selectStage(clave) {
  const etapas = obtenerEtapasDisponibles();
  if (!etapas.some(etapa => etapa.clave === clave)) return;

  etapaActual = clave;
  actualizarNavegacionEtapas();
  renderMatches();
}

function changeStage(dir) {
  const etapas = obtenerEtapasDisponibles();
  if (etapas.length === 0) return;

  const indexActual = etapas.findIndex(
    etapa => etapa.clave === etapaActual
  );
  const nuevoIndex = Math.min(
    Math.max(indexActual + dir, 0),
    etapas.length - 1
  );

  etapaActual = etapas[nuevoIndex].clave;
  actualizarNavegacionEtapas();
  renderMatches();
}

function actualizarNavegacionTabla() {
  document.querySelectorAll("[data-tabla-vista]").forEach(btn => {
    const activa = btn.dataset.tablaVista === tablaVistaActual;
    btn.classList.toggle("on", activa);
    btn.setAttribute("aria-selected", activa ? "true" : "false");
  });

  const tabsPosiciones = document.getElementById("tablaPosicionesTabs");
  if (tabsPosiciones) {
    tabsPosiciones.hidden = !["posiciones", "goleadores"].includes(
      tablaVistaActual
    );
  }

  document.querySelectorAll("[data-tabla-posiciones]").forEach(btn => {
    const activa = btn.dataset.tablaPosiciones === tablaPosicionesActual;
    btn.classList.toggle("on", activa);
    btn.setAttribute("aria-selected", activa ? "true" : "false");
  });
}

document.querySelectorAll("[data-tabla-vista]").forEach(btn => {
  btn.addEventListener('click', () => {
    const vista = btn.dataset.tablaVista;
    if (!["posiciones", "goleadores"].includes(vista)) return;

    if (vista === "goleadores" && tablaVistaActual !== "goleadores") {
      tablaPosicionesActual = "general";
    }
    tablaVistaActual = vista;
    renderTabla();
  });
});

document.querySelectorAll("[data-tabla-posiciones]").forEach(btn => {
  btn.addEventListener('click', () => {
    const valor = btn.dataset.tablaPosiciones;
    if (!["1", "2", "3", "general"].includes(valor)) return;

    tablaPosicionesActual = valor;
    if (valor !== "general") zonaActual = Number(valor);
    renderTabla();
  });
});

function renderDetallePartido(id) {
  const cont = document.getElementById("matchDetail");
  const partidoBase = state.partidos.find(
    item => String(item.id) === String(id)
  );

  if (!partidoBase) {
    if (!cargaPartidosFinalizada) {
      cont.innerHTML = renderDetalleVacio("Cargando partido...");
      return;
    }

    if (errorCargaDatos && state.partidos.length === 0) {
      cont.innerHTML = renderEstadoVista(
        "error",
        "No pudimos cargar el partido",
        obtenerMensajeErrorCargaDatos("Revisá tu conexión e intentá nuevamente."),
        true
      );
      return;
    }

    cont.innerHTML = renderDetalleVacio("Partido no encontrado");
    return;
  }

  const partido = resolverPartidoPlayoff(partidoBase);
  const jugado =
    partido.goles_local !== null &&
    partido.goles_visitante !== null;
  const tienePenales =
    partido.penales_local !== null &&
    partido.penales_visitante !== null;
  const eventosPublicables = state.eventos.filter(
    evento =>
      String(evento.partido_id) === String(partido.id) &&
      esEventoPublicable(evento)
  );
  const analisisEventos = analizarSecuenciaEventosPublica(
    eventosPublicables,
    partido
  );
  const usaListadoNeutralIncidencias = debeUsarListadoNeutralIncidencias(
    partido,
    analisisEventos
  );
  const secuenciaEventos = usaListadoNeutralIncidencias
    ? {
        eventos: eventosPublicables,
        secuenciaPublicable: false
      }
    : prepararSecuenciaEventos(
        eventosPublicables,
        partido,
        analisisEventos
      );
  const contextoPartido = partido.tipo === "playoff"
    ? `${etiquetaFase(partido.fase)} · ${etiquetaInstanciaPartido(partido)}`
    : `Fecha ${partido.fecha} · Zona ${partido.zona}`;
  const etiquetaContexto = partido.tipo === "playoff"
    ? "Instancia"
    : "Jornada";
  const contextoTorneo = escaparHtml(obtenerNombreTorneoActivo());
  const estado = obtenerEstadoTemporalPartido(partido);
  const etiquetaEstado = {
    programado: "Programado",
    "sin-fecha": "A confirmar"
  }[estado.tipo] || estado.texto;
  const antecedentes = renderAntecedentesDetallePartido(partido);
  const incidencias = renderIncidenciasDetallePartido(
    partido,
    eventosPublicables,
    secuenciaEventos,
    estado,
    usaListadoNeutralIncidencias
  );
  const priorizarIncidencias =
    jugado ||
    ["en-juego", "penales", "esperando"].includes(estado.tipo);
  const centro = renderCentroPartidoDestacado(
    partido,
    jugado,
    tienePenales,
    estado
  );

  cont.innerHTML = `
    <div class="detail-topbar">
      <button type="button" class="detail-back" onclick="volverDetalle()">
        ← Volver
      </button>
      <span class="detail-context">Detalle del partido</span>
    </div>

    <article class="match-detail-card match-detail-card-featured ${estado.clase}">
      <div class="home-featured-context match-detail-featured-context">
        <span class="home-featured-context-label">
          <span class="home-featured-dot" aria-hidden="true"></span>
          ${contextoTorneo}
        </span>
        <span class="match-detail-featured-state ${estado.clase}">
          ${etiquetaEstado}
        </span>
      </div>

      <div class="match-detail-scoreboard">
        ${renderEquipoDetallePartido(
          partido.local,
          partido.local_id,
          partido,
          "local"
        )}

        <div class="match-detail-result home-featured-center">
          ${centro}
        </div>

        ${renderEquipoDetallePartido(
          partido.visitante,
          partido.visitante_id,
          partido,
          "visitante"
        )}
        <span class="match-form-label">ÚLTIMOS RESULTADOS</span>
      </div>

      <div class="home-featured-meta match-detail-featured-meta">
        <div class="home-featured-venue">
          <small>Estadio</small>
          <strong>${escaparHtml(obtenerEstadioPartido(partido))}</strong>
        </div>
        <div class="home-featured-time">
          <small>${obtenerEtiquetaDiaPartido(partido.fecha_partido)}</small>
          <strong>${escaparHtml(obtenerHoraPartido(partido))}</strong>
        </div>
      </div>

      <div class="match-detail-support">
        ${renderValorDetalle(
          etiquetaContexto,
          escaparHtml(contextoPartido)
        )}
        ${renderValorDetalle(
          "Árbitro",
          obtenerArbitroPartido(partido)
        )}
      </div>
    </article>

    ${priorizarIncidencias
      ? `${incidencias}${antecedentes}`
      : `${antecedentes}${incidencias}`}
  `;
}

function renderIncidenciasDetallePartido(
  partido,
  eventos,
  secuenciaEventos,
  estado,
  usaListadoNeutralIncidencias
) {
  if (usaListadoNeutralIncidencias) {
    return renderListadoIncidenciasDetallePartido(partido, eventos, estado);
  }

  return renderCronologiaIncidenciasDetallePartido(
    partido,
    secuenciaEventos.eventos,
    secuenciaEventos,
    estado
  );
}

function debeUsarListadoNeutralIncidencias(partido, analisisEventos) {
  const torneoSinCronologia = TORNEOS_SIN_CRONOLOGIA_CONFIABLE.has(
    Number(partido?.torneo_id)
  );

  return (
    LISTADO_NEUTRAL_INCIDENCIAS_PUBLICAS ||
    torneoSinCronologia ||
    !analisisEventos?.secuenciaPublicable
  );
}

function renderListadoIncidenciasDetallePartido(partido, eventos, estado) {
  const resumen = agruparIncidenciasDetallePartido(partido, eventos);
  const etiquetaCantidad = resumen.total === 1
    ? "1 registro"
    : resumen.total > 1
      ? `${resumen.total} registros`
      : "Sin registros";

  return `
    <section class="detail-section detail-events detail-incidents">
      <div class="detail-section-head">
        <h2>Incidencias</h2>
        <span>${etiquetaCantidad}</span>
      </div>
      ${resumen.total === 0
        ? `
          <div class="detail-empty">
            ${estado.tipo === "en-juego"
              ? "Sin incidencias cargadas por el momento."
              : "No hay incidencias cargadas para este partido."}
          </div>
        `
        : `<div class="incident-groups">${resumen.grupos.map(grupo =>
            renderGrupoIncidenciasDetallePartido(partido, grupo)
          ).join("")}</div>`}
    </section>
  `;
}

function agruparIncidenciasDetallePartido(partido, eventos) {
  const grupos = GRUPOS_INCIDENCIAS_DETALLE.map(grupo => ({
    ...grupo,
    equipos: {
      local: new Map(),
      visitante: new Map(),
      sinEquipo: new Map()
    },
    total: 0
  }));
  const gruposPorTipo = new Map();

  grupos.forEach(grupo => {
    grupo.tipos.forEach(tipo => gruposPorTipo.set(tipo, grupo));
  });

  eventos.forEach((evento, indice) => {
    const tipo = normalizarTipoEvento(evento.tipo);
    const grupo = gruposPorTipo.get(tipo) || gruposPorTipo.get("otro");
    const lado = resolverLadoPresentacionIncidencia(evento, partido, tipo);
    const equipo = grupo.equipos[lado] || grupo.equipos.sinEquipo;
    const clave = obtenerClaveAgrupacionIncidencia(evento, tipo, indice);
    const existente = equipo.get(clave);

    grupo.total += 1;

    if (existente) {
      existente.cantidad += 1;
      existente.eventos.push(evento);
      return;
    }

    equipo.set(clave, crearItemIncidenciaDetalle(evento, tipo, indice));
  });

  return {
    total: eventos.length,
    grupos: grupos
      .filter(grupo => grupo.total > 0)
      .map(grupo => ({
        clave: grupo.clave,
        titulo: grupo.titulo,
        total: grupo.total,
        equipos: {
          local: ordenarItemsIncidenciaDetalle(grupo.equipos.local),
          visitante: ordenarItemsIncidenciaDetalle(grupo.equipos.visitante),
          sinEquipo: ordenarItemsIncidenciaDetalle(grupo.equipos.sinEquipo)
        }
      }))
  };
}

function resolverLadoPresentacionIncidencia(evento, partido, tipo) {
  const lado = resolverLadoEvento(evento, partido);

  if (tipo === "gol-contra") {
    return invertirLadoPartido(lado) || lado;
  }

  return lado;
}

function obtenerClaveAgrupacionIncidencia(evento, tipo, indice) {
  if (!TIPOS_GOL_PARTIDO.has(tipo)) {
    return `evento:${evento.id ?? indice}`;
  }

  const jugador = limpiarNombreJugador(evento.jugador) ||
    `Jugador ${ESTADOS_DATO.sinIdentificar.toLowerCase()}`;
  const identidad = evento.inscripcion_jugador_id
    ? `inscripcion:${evento.inscripcion_jugador_id}`
    : `nombre:${normalizarClaveGoleador(jugador)}`;

  return `gol:${identidad}`;
}

function crearItemIncidenciaDetalle(evento, tipo, indice) {
  const jugadorIdentificado = Boolean(limpiarNombreJugador(evento.jugador));

  return {
    cantidad: 1,
    eventos: [evento],
    indice,
    jugador: obtenerTextoJugadorIncidencia(evento, tipo),
    jugadorIdentificado
  };
}

function obtenerTextoJugadorIncidencia(evento, tipo) {
  const jugadorPrincipal = limpiarNombreJugador(evento.jugador) ||
    `Jugador ${ESTADOS_DATO.sinIdentificar.toLowerCase()}`;

  if (tipo !== "cambio") return jugadorPrincipal;

  const jugadorRelacionado = limpiarNombreJugador(evento.jugador_relacionado) ||
    `Jugador ${ESTADOS_DATO.sinIdentificar.toLowerCase()}`;

  return `${jugadorPrincipal} -> ${jugadorRelacionado}`;
}

function ordenarItemsIncidenciaDetalle(items) {
  return [...items.values()].sort((a, b) =>
    a.jugador.localeCompare(b.jugador, "es", { sensitivity: "base" }) ||
    a.indice - b.indice
  );
}

function invertirLadoPartido(lado) {
  if (lado === "local") return "visitante";
  if (lado === "visitante") return "local";
  return null;
}

function renderGrupoIncidenciasDetallePartido(partido, grupo) {
  return `
    <section class="incident-group incident-group-${grupo.clave}">
      <div class="incident-group-head">
        <span class="incident-kind-mark incident-kind-${grupo.clave}" aria-hidden="true"></span>
        <h3>${grupo.titulo}</h3>
        <small>${grupo.total}</small>
      </div>
      <div class="incident-teams">
        ${renderColumnaIncidenciasDetallePartido(
          partido.local,
          "local",
          grupo.equipos.local
        )}
        ${renderColumnaIncidenciasDetallePartido(
          partido.visitante,
          "visitante",
          grupo.equipos.visitante
        )}
        ${grupo.equipos.sinEquipo.length > 0
          ? renderColumnaIncidenciasDetallePartido(
              "Equipo sin identificar",
              "sin-equipo",
              grupo.equipos.sinEquipo
            )
          : ""}
      </div>
    </section>
  `;
}

function renderColumnaIncidenciasDetallePartido(equipo, lado, items) {
  return `
    <section class="incident-team incident-team-${lado}">
      <h4>${escaparHtml(nombre(equipo))}</h4>
      ${items.length > 0
        ? `
          <ul class="incident-list">
            ${items.map(renderItemIncidenciaDetallePartido).join("")}
          </ul>
        `
        : `<p class="incident-empty">Sin registros</p>`}
    </section>
  `;
}

function renderItemIncidenciaDetallePartido(item) {
  const detalles = obtenerDetallesItemIncidencia(item);

  return `
    <li>
      <span class="incident-player">
        <strong class="${item.jugadorIdentificado ? "" : "data-incomplete"}">
          ${escaparHtml(item.jugador)}
        </strong>
        ${item.cantidad > 1
          ? `<b>&times;${item.cantidad}</b>`
          : ""}
      </span>
      ${detalles ? `<small>${detalles}</small>` : ""}
    </li>
  `;
}

function obtenerDetallesItemIncidencia(item) {
  return [
    ...obtenerEtiquetasEspecialesIncidencia(item),
    obtenerDetalleMinutosIncidencia(item)
  ].filter(Boolean).join(" &middot; ");
}

function obtenerEtiquetasEspecialesIncidencia(item) {
  const conteos = item.eventos.reduce((tipos, evento) => {
    const tipo = normalizarTipoEvento(evento.tipo);
    tipos.set(tipo, (tipos.get(tipo) || 0) + 1);
    return tipos;
  }, new Map());
  const etiquetas = [];

  if (conteos.has("gol-penal")) {
    etiquetas.push(
      conteos.get("gol-penal") > 1
        ? `${conteos.get("gol-penal")} de penal`
        : "Gol de penal"
    );
  }
  if (conteos.has("gol-contra")) {
    etiquetas.push(
      conteos.get("gol-contra") > 1
        ? `${conteos.get("gol-contra")} en contra`
        : "Gol en contra"
    );
  }
  if (conteos.has("roja")) {
    etiquetas.push("Expulsi&oacute;n");
  }
  if (conteos.has("doble-amarilla")) {
    etiquetas.push("Doble amarilla + expulsi&oacute;n");
  }
  if (conteos.has("cambio")) {
    etiquetas.push("Cambio");
  }
  if (conteos.has("otro")) {
    etiquetas.push("Incidencia");
  }

  return etiquetas;
}

function obtenerDetalleMinutosIncidencia(item) {
  const minutos = item.eventos
    .map(evento => Number(evento.minuto))
    .filter(minuto => Number.isInteger(minuto) && minuto > 0);

  if (minutos.length !== item.eventos.length) return "";

  return minutos.map(minuto => `${minuto}'`).join(", ");
}

function renderCronologiaIncidenciasDetallePartido(
  partido,
  eventos,
  secuenciaEventos,
  estado
) {
  return `
    <section class="detail-section detail-events">
      <div class="detail-section-head">
        <h2>Incidencias</h2>
        <span>${eventos.length || "Sin"} registros</span>
      </div>
      ${eventos.length > 0
        ? `
          <div class="event-team-head">
            <strong>${escaparHtml(nombre(partido.local))}</strong>
            <span>
              ${secuenciaEventos.secuenciaPublicable
                ? "Marcador"
                : "Orden"}
            </span>
            <strong>${escaparHtml(nombre(partido.visitante))}</strong>
          </div>
          <div class="event-list">${eventos.map(evento =>
            renderEventoPartido(evento, partido)
          ).join("")}</div>
        `
        : `
          <div class="detail-empty">
            ${estado.tipo === "en-juego"
              ? "Sin incidencias cargadas por el momento."
              : "Sin incidencias cargadas para este partido."}
          </div>
        `}
    </section>
  `;
}

function renderValorDetalle(etiqueta, valor) {
  const estado = obtenerEstadoDato(valor);

  return `
    <div>
      <span>${etiqueta}</span>
      <strong class="${estado ? `data-${estado}` : ""}">
        ${valor}
      </strong>
    </div>
  `;
}

function obtenerReferenciaEquipoFormaPartido(partido, lado) {
  const equipo = partido?.[lado];
  const clubId = partido?.[`${lado}_id`];
  const club = obtenerClub(equipo, clubId);

  return club?.nombre_oficial || equipo || "";
}

function partidoEsAnteriorAReferenciaForma(antecedente, partidoActual) {
  const fechaActual = obtenerFechaCalendarioPartido(partidoActual);
  const fechaAntecedente = obtenerFechaCalendarioPartido(antecedente);

  if (!fechaActual || !fechaAntecedente) return false;
  if (fechaAntecedente < fechaActual) return true;
  if (fechaAntecedente > fechaActual) return false;

  const momentoActual = crearFechaHoraPartido(partidoActual);
  const momentoAntecedente = crearFechaHoraPartido(antecedente);

  return Boolean(
    momentoActual &&
    momentoAntecedente &&
    momentoAntecedente.getTime() < momentoActual.getTime()
  );
}

function obtenerNumeroFechaFormaPartido(partido) {
  const fecha = Number(partido?.fecha);
  return Number.isFinite(fecha) && fecha > 0 ? fecha : null;
}

function partidoEsAnteriorPorFechaTorneoForma(antecedente, partidoActual) {
  const fechaActual = obtenerNumeroFechaFormaPartido(partidoActual);
  const fechaAntecedente = obtenerNumeroFechaFormaPartido(antecedente);

  return fechaActual !== null &&
    fechaAntecedente !== null &&
    fechaAntecedente < fechaActual;
}

function partidoEsProximoSinFechaConfiableForma(partido) {
  if (obtenerFechaCalendarioPartido(partido)) return false;
  if (partidoTieneResultado(partido)) return false;
  if (partidoTieneEstadoFinalizadoOficial(partido)) return false;

  return !obtenerEstadoManualPartido(partido);
}

function partidoCuentaComoAntecedenteForma(antecedente, partidoActual) {
  if (partidoEsAnteriorAReferenciaForma(antecedente, partidoActual)) {
    return true;
  }

  if (!partidoEsProximoSinFechaConfiableForma(partidoActual)) {
    return false;
  }

  const fechaActual = obtenerNumeroFechaFormaPartido(partidoActual);
  if (fechaActual !== null) {
    return partidoEsAnteriorPorFechaTorneoForma(antecedente, partidoActual);
  }

  return true;
}

function obtenerResultadoFormaEquipoPartido(partido, equipo) {
  return {
    win: "G",
    draw: "E",
    loss: "P"
  }[clasificarResultadoEquipoPartido(partido, equipo)] || "";
}

function obtenerFormaRecienteEquipoAntesPartido(
  partidoActual,
  equipo,
  limite = 5
) {
  if (!partidoActual?.torneo_id || !equipo) return [];

  const torneo = state.torneos.find(
    item => String(item.id) === String(partidoActual.torneo_id)
  ) || { id: partidoActual.torneo_id };
  const maximo = Math.max(0, Number(limite) || 0);
  if (maximo === 0) return [];

  return obtenerPartidosEquipoTorneo(equipo, torneo)
    .filter(
      partido =>
        partido.tipoActividad !== "libre" &&
        String(partido.id) !== String(partidoActual.id) &&
        partidoTieneResultadoVisualConfirmado(partido) &&
        partidoCuentaComoAntecedenteForma(partido, partidoActual)
    )
    .sort(ordenarPartidosCronologicamente)
    .slice(-maximo)
    .map(partido => ({
      partido,
      resultado: obtenerResultadoFormaEquipoPartido(partido, equipo)
    }))
    .filter(item => item.resultado);
}

function renderResultadoFormaRecienteDetallePartido(item) {
  const etiqueta = {
    G: "Ganado",
    E: "Empatado",
    P: "Perdido"
  }[item.resultado] || "Resultado";

  return `
    <span
      class="match-form-result team-form-${item.resultado.toLowerCase()}"
      title="${etiqueta}"
      aria-label="${etiqueta}"
    >
      ${item.resultado}
    </span>
  `;
}

function renderFormaRecienteCabeceraPartido(partido, lado, nombreEquipo) {
  const equipo = partido?.[lado];
  if (!equipo) return "";

  const referenciaEquipo = obtenerReferenciaEquipoFormaPartido(partido, lado);
  const forma = obtenerFormaRecienteEquipoAntesPartido(
    partido,
    referenciaEquipo,
    5
  );

  return `
    <span
      class="match-form-results"
      aria-label="Forma reciente de ${escaparHtml(nombreEquipo)}"
    >
      ${forma.length > 0
        ? forma.map(renderResultadoFormaRecienteDetallePartido).join("")
        : `<span class="match-form-empty">Sin antecedentes recientes</span>`}
    </span>
  `;
}

function renderAntecedentesDetallePartido(partido) {
  if (!partido.local || !partido.visitante) return "";

  if (!cargaPartidosFinalizada) {
    return `
      <section class="detail-section detail-history">
        <div class="detail-section-head">
          <h2>&Uacute;ltimos antecedentes</h2>
          <span>CARGANDO</span>
        </div>
        <div class="detail-empty" role="status" aria-busy="true">
          Cargando antecedentes entre estos equipos...
        </div>
      </section>
    `;
  }

  const antecedentes = obtenerUltimosAntecedentesPartido(partido);
  const cantidad = antecedentes.partidos.length;
  const etiquetaCantidad = cantidad === 0
    ? "SIN ANTECEDENTES"
    : `${cantidad} ${cantidad === 1 ? "PARTIDO" : "PARTIDOS"}`;

  return `
    <section class="detail-section detail-history">
      <div class="detail-section-head">
        <h2>&Uacute;ltimos antecedentes</h2>
        <span>${etiquetaCantidad}</span>
      </div>
      ${cantidad > 0
        ? `
          <div class="detail-history-list">
            ${antecedentes.partidos.map(item =>
              renderAntecedenteDetallePartido(item)
            ).join("")}
          </div>
        `
        : `
          <div class="detail-empty">
            No hay enfrentamientos anteriores cargados entre estos equipos.
          </div>
        `}
    </section>
  `;
}

function obtenerClubIdLadoPartido(partido, lado) {
  const id = partido?.[`${lado}_id`];
  if (id !== null && id !== undefined && id !== "") {
    return String(id);
  }

  const club = obtenerClub(partido?.[lado]);
  return club?.id !== null && club?.id !== undefined
    ? String(club.id)
    : null;
}

function obtenerParejaClubesPartido(partido) {
  const localId = obtenerClubIdLadoPartido(partido, "local");
  const visitanteId = obtenerClubIdLadoPartido(partido, "visitante");

  if (!localId || !visitanteId || localId === visitanteId) return null;

  return { localId, visitanteId };
}

function partidoCoincideConParejaClubes(partido, pareja) {
  if (!pareja) return false;

  const localId = obtenerClubIdLadoPartido(partido, "local");
  const visitanteId = obtenerClubIdLadoPartido(partido, "visitante");

  if (!localId || !visitanteId) return false;

  return (
    (localId === pareja.localId && visitanteId === pareja.visitanteId) ||
    (localId === pareja.visitanteId && visitanteId === pareja.localId)
  );
}

function obtenerFechaCalendarioPartido(partido) {
  const fecha = String(partido?.fecha_partido || "").trim();
  if (!fecha) return "";

  if (window.TPPublicTournament?.isValidMatchDate) {
    return window.TPPublicTournament.isValidMatchDate(fecha) ? fecha : "";
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : "";
}

function antecedenteEsAnteriorAlPartido(antecedente, partidoActual) {
  const fechaActual = obtenerFechaCalendarioPartido(partidoActual);
  if (!fechaActual) return true;

  const fechaAntecedente = obtenerFechaCalendarioPartido(antecedente);
  return Boolean(fechaAntecedente && fechaAntecedente < fechaActual);
}

function obtenerPartidosHistoricosDetallePartido() {
  const partidosBase = Array.isArray(state.partidosTodos) &&
    state.partidosTodos.length > 0
    ? state.partidosTodos
    : state.partidos;
  const torneoIds = [
    ...new Set(
      partidosBase
        .map(partido => partido.torneo_id)
        .filter(id => id !== null && id !== undefined && id !== "")
        .map(String)
    )
  ];

  if (torneoIds.length === 0) {
    return partidosBase.map(partido => resolverPartidoPlayoff(partido));
  }

  return torneoIds.flatMap(torneoId => {
    const torneo = state.torneos.find(
      item => String(item.id) === torneoId
    ) || { id: torneoId };

    return obtenerPartidosResueltosTorneoHistorial(torneo);
  });
}

function compararAntecedentesRecientes(a, b) {
  const fechaA = obtenerFechaCalendarioPartido(a.partido);
  const fechaB = obtenerFechaCalendarioPartido(b.partido);
  const porFecha = fechaB.localeCompare(fechaA);

  if (porFecha !== 0) return porFecha;

  const idA = Number(a.partido.id);
  const idB = Number(b.partido.id);

  if (Number.isFinite(idA) && Number.isFinite(idB) && idA !== idB) {
    return idB - idA;
  }

  return String(b.partido.id || "").localeCompare(
    String(a.partido.id || "")
  );
}

function obtenerUltimosAntecedentesPartido(partido, limite = 3) {
  const pareja = obtenerParejaClubesPartido(partido);
  if (!pareja) {
    return { partidos: [] };
  }

  const partidos = obtenerPartidosHistoricosDetallePartido()
    .filter(antecedente => {
      if (String(antecedente.id) === String(partido.id)) return false;
      if (!partidoCoincideConParejaClubes(antecedente, pareja)) return false;
      if (!partidoTieneResultadoVisualConfirmado(antecedente)) return false;
      return antecedenteEsAnteriorAlPartido(antecedente, partido);
    })
    .map(antecedente => ({ partido: antecedente }))
    .sort(compararAntecedentesRecientes);

  return {
    partidos: partidos.slice(0, Math.max(0, Number(limite) || 0))
  };
}

function obtenerTorneoPartidoHistorial(partido) {
  return state.torneos.find(
    torneo => String(torneo.id) === String(partido?.torneo_id)
  ) || null;
}

function obtenerEtiquetaTorneoPartido(partido) {
  const torneo = obtenerTorneoPartidoHistorial(partido);
  if (torneo?.nombre) return torneo.nombre;
  if (partido?.torneo_id) return `Torneo ${partido.torneo_id}`;
  return "Torneo";
}

function obtenerEtiquetaInstanciaAntecedente(partido) {
  if (partido.tipo === "regular") {
    return partido.fecha ? `Fecha ${partido.fecha}` : "Fase regular";
  }

  if (partido.tipo === "playoff") {
    return [etiquetaFase(partido.fase), etiquetaInstanciaPartido(partido)]
      .filter(Boolean)
      .join(" - ");
  }

  return partido.fase || partido.tipo || "";
}

function formatearFechaAntecedente(fecha) {
  const [year, month, day] = String(fecha || "").split("-").map(Number);
  const meses = [
    "ENE", "FEB", "MAR", "ABR", "MAY", "JUN",
    "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"
  ];

  if (!year || !month || !day || !meses[month - 1]) return "";

  return `${String(day).padStart(2, "0")} ${meses[month - 1]} ${year}`;
}

function renderAntecedenteDetallePartido(item) {
  const partido = item.partido;
  const ganaLocal = Number(partido.goles_local) > Number(partido.goles_visitante);
  const ganaVisitante = Number(partido.goles_visitante) > Number(partido.goles_local);
  const torneo = escaparHtml(obtenerEtiquetaTorneoPartido(partido));
  const instancia = escaparHtml(obtenerEtiquetaInstanciaAntecedente(partido));
  const contexto = instancia ? `${torneo} &middot; ${instancia}` : torneo;
  const fecha = formatearFechaAntecedente(
    obtenerFechaCalendarioPartido(partido)
  );
  const nombreLocal = nombre(partido.local, partido.local_id);
  const nombreVisitante = nombre(partido.visitante, partido.visitante_id);
  const marcador = `${partido.goles_local} - ${partido.goles_visitante}`;

  return `
    <button
      type="button"
      class="detail-history-row"
      onclick="abrirPartido(${JSON.stringify(partido.id)})"
      aria-label="${escaparHtml(
        `${obtenerEtiquetaTorneoPartido(partido)}. ` +
        `${obtenerEtiquetaInstanciaAntecedente(partido)}. ` +
        `${nombreLocal} ${marcador} ${nombreVisitante}.`
      )}"
    >
      <span class="detail-history-context">${contexto}</span>
      ${fecha ? `<span class="detail-history-date">${fecha}</span>` : ""}
      <span class="detail-history-scoreline">
        <strong class="${ganaLocal ? "winner" : ""}">
          ${escaparHtml(nombreLocal)}
        </strong>
        <b>${marcador}</b>
        <strong class="${ganaVisitante ? "winner" : ""}">
          ${escaparHtml(nombreVisitante)}
        </strong>
      </span>
    </button>
  `;
}

function renderEquipoDetallePartido(
  equipo,
  clubId = null,
  partido = null,
  lado = null
) {
  const nombreEquipo = equipo ? nombre(equipo, clubId) : "Por definir";
  const escudo = obtenerEscudoEquipo(equipo, clubId);
  const escudoEquipo = equipo && escudo
    ? `<img src="${escudo}" alt="Escudo de ${nombreEquipo}" width="72" height="72" decoding="async">`
    : `<span>${equipo ? nombreEquipo.slice(0, 2).toUpperCase() : "?"}</span>`;
  const formaReciente = partido && lado
    ? renderFormaRecienteCabeceraPartido(partido, lado, nombreEquipo)
    : "";

  return `
    <button
      type="button"
      class="match-detail-team"
      ${equipo ? `onclick='abrirEquipo(${JSON.stringify(equipo)})'` : "disabled"}
    >
      <span class="match-detail-shield">${escudoEquipo}</span>
      <strong>${nombreEquipo}</strong>
      ${formaReciente}
    </button>
  `;
}

function analizarSecuenciaEventosPublica(eventos, partido) {
  const goles = eventos.filter(evento =>
    ["gol", "gol-penal", "gol-contra"].includes(
      normalizarTipoEvento(evento.tipo)
    )
  );
  const resultadoCargado =
    partido.goles_local !== null &&
    partido.goles_local !== undefined &&
    partido.goles_visitante !== null &&
    partido.goles_visitante !== undefined;
  const conteo = goles.reduce(
    (resultado, evento) => {
      const tipo = normalizarTipoEvento(evento.tipo);
      const lado = resolverLadoEvento(evento, partido);

      if (["gol", "gol-penal"].includes(tipo)) {
        if (lado === "local") resultado.local += 1;
        if (lado === "visitante") resultado.visitante += 1;
      }
      if (tipo === "gol-contra") {
        if (lado === "local") resultado.visitante += 1;
        if (lado === "visitante") resultado.local += 1;
      }
      return resultado;
    },
    { local: 0, visitante: 0 }
  );
  const golesCoinciden =
    resultadoCargado &&
    conteo.local === Number(partido.goles_local) &&
    conteo.visitante === Number(partido.goles_visitante);
  const golesConfirmados =
    goles.length > 0 &&
    goles.every(evento => evento.estado_dato === "confirmado");
  const ordenes = eventos.map(evento => evento.orden);
  const valoresOrden = ordenes.map(orden => Number(orden));
  const ordenCompletoValido =
    eventos.length > 0 &&
    ordenes.every((orden, indice) => {
      if (orden === null || orden === undefined || orden === "") {
        return false;
      }

      return Number.isInteger(valoresOrden[indice]) && valoresOrden[indice] > 0;
    }) &&
    new Set(valoresOrden).size === valoresOrden.length;
  const secuenciaPublicable =
    goles.length > 0 &&
    golesCoinciden &&
    golesConfirmados &&
    ordenCompletoValido;

  return { secuenciaPublicable };
}

function prepararSecuenciaEventos(
  eventos,
  partido,
  analisis = analizarSecuenciaEventosPublica(eventos, partido)
) {
  let golesLocal = 0;
  let golesVisitante = 0;

  if (!analisis.secuenciaPublicable) {
    return {
      eventos: [...eventos],
      secuenciaPublicable: false
    };
  }

  const ordenados = [...eventos]
    .sort((a, b) => Number(a.orden) - Number(b.orden))
    .map(evento => {
      const tipo = normalizarTipoEvento(evento.tipo);
      const lado = resolverLadoEvento(evento, partido);
      const esLocal = lado === "local";
      const esVisitante = lado === "visitante";
      let marcador = null;

      if (
        analisis.secuenciaPublicable &&
        ["gol", "gol-penal"].includes(tipo)
      ) {
        if (esLocal) golesLocal += 1;
        if (esVisitante) golesVisitante += 1;
        if (esLocal || esVisitante) {
          marcador = `${golesLocal}–${golesVisitante}`;
        }
      }

      if (
        analisis.secuenciaPublicable &&
        tipo === "gol-contra"
      ) {
        if (esLocal) golesVisitante += 1;
        if (esVisitante) golesLocal += 1;
        if (esLocal || esVisitante) {
          marcador = `${golesLocal}–${golesVisitante}`;
        }
      }

      return {
        ...evento,
        marcador
      };
    });

  return {
    eventos: ordenados,
    secuenciaPublicable: analisis.secuenciaPublicable
  };
}

function renderEventoPartido(evento, partido) {
  const lado = resolverLadoEvento(evento, partido);
  const esLocal = lado === "local";
  const tipo = normalizarTipoEvento(evento.tipo);
  const jugadorIdentificado = Boolean(
    limpiarNombreJugador(evento.jugador)
  );
  const jugadorPrincipal = jugadorIdentificado
    ? evento.jugador
    : `Jugador ${ESTADOS_DATO.sinIdentificar.toLowerCase()}`;
  const jugador = tipo === "cambio"
    ? `${jugadorPrincipal} → ${
        evento.jugador_relacionado ||
        `Jugador ${ESTADOS_DATO.sinIdentificar.toLowerCase()}`
      }`
    : jugadorPrincipal;
  const equipo = resolverEquipoEvento(evento, partido);
  const nombreEquipo = equipo
    ? nombre(equipo)
    : "Equipo sin identificar";
  const momento = formatearMomentoIncidencia(evento);
  const contenido = `
    <strong class="${jugadorIdentificado ? "" : "data-incomplete"}">
      ${escaparHtml(jugador)}
    </strong>
    <small>
      <b>${escaparHtml(nombreEquipo)}</b>
      <span class="event-type event-type-${tipo}">
        ${etiquetaEvento(tipo)}${momento ? ` · ${momento}` : ""}
      </span>
    </small>
  `;

  return `
    <div class="event-row ${esLocal ? "event-local" : "event-away"}">
      <div class="event-side event-side-local">
        ${esLocal ? contenido : ""}
      </div>
      <div class="event-axis">
        ${evento.marcador
          ? renderMarcadorIncidencia(evento.marcador)
          : `<span class="event-mark event-${tipo}"></span>`}
      </div>
      <div class="event-side event-side-away">
        ${esLocal ? "" : contenido}
      </div>
    </div>
  `;
}

function renderMarcadorIncidencia(marcador) {
  const [local = "0", visitante = "0"] = String(marcador).split("–");

  return `
    <strong class="event-score">
      <span>${local}</span>
      <i>-</i>
      <span>${visitante}</span>
    </strong>
  `;
}

function resolverEquipoEvento(evento, partido) {
  const lado = resolverLadoEvento(evento, partido);
  if (lado === "local") {
    return partido.local;
  }
  if (lado === "visitante") {
    return partido.visitante;
  }

  return state.clubes.find(
    club => String(club.id) === String(evento.equipo_id)
  )?.nombre_oficial || null;
}

function resolverLadoEvento(evento, partido) {
  if (String(evento.equipo_id) === String(partido.local_id)) {
    return "local";
  }
  if (String(evento.equipo_id) === String(partido.visitante_id)) {
    return "visitante";
  }

  const tipo = normalizarTipoEvento(evento.tipo);
  if (
    ["gol", "gol-penal", "gol-contra"].includes(tipo) &&
    Number(partido.goles_local) === 0 &&
    Number(partido.goles_visitante) > 0
  ) {
    return "visitante";
  }
  if (
    ["gol", "gol-penal", "gol-contra"].includes(tipo) &&
    Number(partido.goles_visitante) === 0 &&
    Number(partido.goles_local) > 0
  ) {
    return "local";
  }

  return null;
}

function normalizarTipoEvento(tipo) {
  const valor = String(tipo || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (valor.includes("gol") && valor.includes("contra")) {
    return "gol-contra";
  }
  if (valor.includes("gol") && valor.includes("penal")) {
    return "gol-penal";
  }
  if (valor.includes("gol")) return "gol";
  if (valor.includes("doble") && valor.includes("amarilla")) {
    return "doble-amarilla";
  }
  if (valor.includes("amarilla")) return "amarilla";
  if (valor.includes("roja")) return "roja";
  if (valor.includes("cambio")) return "cambio";
  return "otro";
}

function etiquetaEvento(tipo) {
  return {
    gol: "Gol",
    "gol-penal": "Gol de penal",
    "gol-contra": "Gol en contra",
    amarilla: "Tarjeta amarilla",
    "doble-amarilla": "Segunda amarilla · Expulsión",
    roja: "Tarjeta roja",
    cambio: "Cambio",
    otro: "Incidencia"
  }[tipo];
}

function formatearMomentoIncidencia(evento) {
  const periodo = {
    primer_tiempo: "1T",
    segundo_tiempo: "2T"
  }[evento.periodo] || "";
  const minuto = Number(evento.minuto);

  return [
    periodo,
    Number.isInteger(minuto) && minuto > 0 ? `${minuto}'` : ""
  ].filter(Boolean).join(" · ");
}

function etiquetaFase(fase) {
  return FASES_PLAYOFF.find(item => item.valor === fase)?.etiqueta ||
    "Playoffs";
}

function formatearFechaCompleta(fecha) {
  if (!fecha) return "-";

  const [year, month, day] = fecha.split("-").map(Number);
  if (!year || !month || !day) return "-";

  return [
    String(day).padStart(2, "0"),
    String(month).padStart(2, "0"),
    String(year).slice(-2)
  ].join("/");
}

function obtenerPartidosTorneoHistorial(torneo) {
  if (!torneo?.id) return [];

  return state.partidosTodos.filter(
    partido => String(partido.torneo_id) === String(torneo.id)
  );
}

function crearResolutorPlayoffHistorial(partidosReferencia) {
  const porId = new Map(
    partidosReferencia.map(partido => [String(partido.id), partido])
  );
  const cache = new Map();

  const buscarDesdeSource = source => {
    if (source === null || source === undefined || source === "") return null;

    const valor = String(source).trim();
    if (/^\d+$/.test(valor)) return porId.get(valor) || null;

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

    return partidosReferencia.find(
      item =>
        item.tipo === "playoff" &&
        item.fase === fase &&
        Number(item.numero_playoff) === numero
    ) || null;
  };

  const buscarOrigenPorLlave = (partido, lado) => {
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

    return partidosReferencia.find(
      item =>
        item.tipo === "playoff" &&
        item.fase === faseAnterior &&
        Number(item.numero_playoff) === numeroAnterior
    ) || null;
  };

  const resolver = partido => {
    if (!partido || partido.tipo !== "playoff") return partido;

    const clave = String(partido.id);
    if (cache.has(clave)) return cache.get(clave);

    cache.set(clave, { ...partido });

    const resolverEquipo = lado => {
      if (partido[lado]) {
        return obtenerNombreOficialEquipo(
          partido[lado],
          partido[`${lado}_id`]
        );
      }

      const source = lado === "local"
        ? partido.source_local
        : partido.source_visitante;
      const origen =
        buscarDesdeSource(source) ||
        buscarOrigenPorLlave(partido, lado);
      if (!origen) return null;

      const origenResuelto = resolver(origen);
      const ladoGanador = obtenerGanadorPlayoff(origenResuelto);
      return ladoGanador ? origenResuelto[ladoGanador] : null;
    };

    const local = resolverEquipo("local");
    const visitante = resolverEquipo("visitante");
    const clubLocal = obtenerClub(local, partido.local_id);
    const clubVisitante = obtenerClub(visitante, partido.visitante_id);
    const resuelto = {
      ...partido,
      local: clubLocal?.nombre_oficial || local,
      visitante: clubVisitante?.nombre_oficial || visitante,
      local_id: clubLocal?.id || partido.local_id || null,
      visitante_id: clubVisitante?.id || partido.visitante_id || null,
      localia_pendiente:
        partido.fase === "final" &&
        !Boolean(partido.local && partido.visitante)
    };

    cache.set(clave, resuelto);
    return resuelto;
  };

  return resolver;
}

function obtenerPartidosResueltosTorneoHistorial(torneo) {
  const partidos = obtenerPartidosTorneoHistorial(torneo);
  const resolver = crearResolutorPlayoffHistorial(partidos);
  return partidos.map(partido => resolver(partido));
}

function equipoCoincideConLado(partido, lado, equipo) {
  if (!partido || !equipo) return false;

  const clubEquipo = obtenerClub(equipo);
  const ladoId = partido[`${lado}_id`];

  if (
    clubEquipo?.id &&
    ladoId !== null &&
    ladoId !== undefined &&
    String(ladoId) === String(clubEquipo.id)
  ) {
    return true;
  }

  const clubLado = obtenerClub(partido[lado], ladoId);
  const candidatosEquipo = [
    equipo,
    clubEquipo?.nombre_oficial,
    clubEquipo?.nombre_corto,
    nombre(equipo, clubEquipo?.id)
  ].map(normalizarNombreClub).filter(Boolean);
  const candidatosLado = [
    partido[lado],
    clubLado?.nombre_oficial,
    clubLado?.nombre_corto,
    nombre(partido[lado], ladoId)
  ].map(normalizarNombreClub).filter(Boolean);

  return candidatosEquipo.some(valor => candidatosLado.includes(valor));
}

function obtenerLadoEquipoPartido(partido, equipo) {
  if (equipoCoincideConLado(partido, "local", equipo)) return "local";
  if (equipoCoincideConLado(partido, "visitante", equipo)) return "visitante";
  return null;
}

function equipoParticipaEnPartido(partido, equipo) {
  return Boolean(obtenerLadoEquipoPartido(partido, equipo));
}

function obtenerPartidosEquipoTorneo(equipo, torneo) {
  if (!equipo || !torneo?.id) return [];

  return obtenerPartidosResueltosTorneoHistorial(torneo)
    .filter(partido => equipoParticipaEnPartido(partido, equipo))
    .sort(ordenarPartidosCronologicamente);
}

function compararTorneosHistorialEquipo(a, b) {
  return Number(esTorneoVigente(b)) - Number(esTorneoVigente(a)) ||
    Number(b.anio || 0) - Number(a.anio || 0) ||
    String(b.fecha_inicio || "").localeCompare(String(a.fecha_inicio || "")) ||
    String(b.tipo || "").localeCompare(String(a.tipo || ""));
}

function obtenerTorneosDisponiblesEquipo(equipo) {
  if (!equipo || !Array.isArray(state.torneos)) return [];

  return state.torneos
    .filter(torneo => obtenerPartidosEquipoTorneo(equipo, torneo).length > 0)
    .sort(compararTorneosHistorialEquipo);
}

function obtenerTorneoEnLista(torneoReferencia, torneos) {
  if (!torneoReferencia?.id || !Array.isArray(torneos)) return null;

  return torneos.find(
    torneo => String(torneo.id) === String(torneoReferencia.id)
  ) || null;
}

function obtenerTorneoVisualizacionDetalleEquipo(torneosEquipo) {
  return obtenerTorneoEnLista(
    obtenerTorneoVisualizacionActual(),
    torneosEquipo
  );
}

function resolverSeleccionTorneoDetalleEquipo(torneosEquipo) {
  const torneoVista = torneosEquipo.find(
    torneo => String(torneo.id) === String(vistaActual.torneoEquipoId)
  );
  const claveUrl =
    vistaActual.torneoEquipoClave ||
    obtenerParametroTorneoDetalleEquipo();
  const torneoUrl = !torneoVista
    ? buscarTorneoPorClaveUrl(claveUrl, torneosEquipo)
    : null;
  const seleccionManual = Boolean(vistaActual.torneoEquipoManual);
  const torneoVisualizacion = !seleccionManual && !torneoUrl
    ? obtenerTorneoVisualizacionDetalleEquipo(torneosEquipo)
    : null;
  const torneoVigenteEquipo = torneosEquipo.find(esTorneoVigente);
  const torneo = torneoUrl ||
    (seleccionManual ? torneoVista : null) ||
    torneoVisualizacion ||
    torneoVista ||
    torneoVigenteEquipo ||
    torneosEquipo[0] || null;

  if (torneo) vistaActual.torneoEquipoId = torneo.id;
  vistaActual.torneoEquipoManual = Boolean(torneoUrl || seleccionManual);
  vistaActual.torneoEquipoClave = null;

  return {
    torneo,
    fallbackAplicado: Boolean(claveUrl && !torneoUrl && !torneoVista),
    desdeUrl: Boolean(claveUrl && torneoUrl && !torneoVista)
  };
}

function seleccionarTorneoDetalleEquipo(claveTorneo) {
  if (vistaActual.id !== "equipo" || !vistaActual.equipo) return;

  const torneosEquipo = obtenerTorneosDisponiblesEquipo(vistaActual.equipo);
  const torneo = buscarTorneoPorClaveUrl(claveTorneo, torneosEquipo);
  if (!torneo) return;

  vistaActual.torneoEquipoId = torneo.id;
  vistaActual.torneoEquipoClave = null;
  vistaActual.torneoEquipoManual = true;
  renderDetalleEquipo(vistaActual.equipo);
  guardarVistaEnHistorial();
}

function renderSelectorTorneosDetalleEquipo(torneosEquipo, torneoActivo) {
  if (!torneoActivo) return "";

  return `
    <label class="team-season-switch">
      <span>Historial por campeonato</span>
      <select
        aria-label="Seleccionar campeonato del equipo"
        onchange="seleccionarTorneoDetalleEquipo(this.value)"
        ${torneosEquipo.length <= 1 ? "disabled" : ""}
      >
        ${torneosEquipo.map(torneo => `
          <option
            value="${escaparHtml(crearClaveTorneoUrl(torneo))}"
            ${String(torneo.id) === String(torneoActivo.id) ? "selected" : ""}
          >
            ${escaparHtml(torneo.nombre)}${esTorneoVigente(torneo)
              ? " &middot; Actual"
              : ""}
          </option>
        `).join("")}
      </select>
    </label>
  `;
}

function partidoFinalizadoParaRendimiento(partido) {
  const estadoManual = obtenerEstadoManualPartido(partido);
  if (
    estadoManual &&
    ["suspendido", "postergado"].includes(estadoManual.tipo)
  ) {
    return false;
  }

  return partidoTieneResultado(partido) &&
    Number.isFinite(Number(partido.goles_local)) &&
    Number.isFinite(Number(partido.goles_visitante));
}

const ESTADOS_PARTIDO_FINALIZADO_OFICIAL = new Set([
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
]);

function partidoTieneEstadoFinalizadoOficial(partido) {
  const estado = normalizarEstadoPartidoValor(partido?.estado);
  if (!estado) return false;

  if (
    typeof window !== "undefined" &&
    window.TPPublicTournament?.isMatchResolved
  ) {
    return window.TPPublicTournament.isMatchResolved({ estado });
  }

  return ESTADOS_PARTIDO_FINALIZADO_OFICIAL.has(estado);
}

function partidoTieneResultadoVisualConfirmado(partido) {
  return partidoTieneEstadoFinalizadoOficial(partido) &&
    partidoTieneResultado(partido) &&
    Number.isFinite(Number(partido.goles_local)) &&
    Number.isFinite(Number(partido.goles_visitante));
}

function clasificarResultadoEquipoPartido(partido, equipo) {
  if (!partidoTieneResultadoVisualConfirmado(partido)) return "neutral";

  const lado = obtenerLadoEquipoPartido(partido, equipo);
  if (!lado) return "neutral";

  const esLocal = lado === "local";
  const favor = Number(esLocal
    ? partido.goles_local
    : partido.goles_visitante);
  const contra = Number(esLocal
    ? partido.goles_visitante
    : partido.goles_local);

  if (favor > contra) return "win";
  if (favor < contra) return "loss";
  return "draw";
}

function obtenerClaseResultadoEquipoPartido(partido, equipo) {
  return `team-match--${clasificarResultadoEquipoPartido(partido, equipo)}`;
}

function crearStatsRendimientoEquipo() {
  return {
    pj: 0,
    pg: 0,
    pe: 0,
    pp: 0,
    gf: 0,
    gc: 0,
    dg: 0,
    pts: 0,
    efectividad: 0,
    promedioGf: 0,
    vallasInvictas: 0,
    local: { pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, pts: 0 },
    visitante: { pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, pts: 0 }
  };
}

function acumularResultadoRendimiento(stats, favor, contra, condicion) {
  stats.pj++;
  stats.gf += favor;
  stats.gc += contra;
  stats.dg = stats.gf - stats.gc;
  if (contra === 0) stats.vallasInvictas++;

  const parcial = stats[condicion];
  parcial.pj++;
  parcial.gf += favor;
  parcial.gc += contra;

  if (favor > contra) {
    stats.pg++;
    stats.pts += 3;
    parcial.pg++;
    parcial.pts += 3;
  } else if (favor < contra) {
    stats.pp++;
    parcial.pp++;
  } else {
    stats.pe++;
    stats.pts++;
    parcial.pe++;
    parcial.pts++;
  }
}

function completarDerivadosRendimiento(stats) {
  stats.efectividad = stats.pj > 0
    ? Math.round((stats.pts / (stats.pj * 3)) * 100)
    : 0;
  stats.promedioGf = stats.pj > 0 ? stats.gf / stats.pj : 0;
  return stats;
}

function calcularRendimientoEquipoTorneo(partidosEquipo, equipo) {
  const stats = crearStatsRendimientoEquipo();

  partidosEquipo
    .filter(partidoFinalizadoParaRendimiento)
    .forEach(partido => {
      const lado = obtenerLadoEquipoPartido(partido, equipo);
      if (!lado) return;

      const esLocal = lado === "local";
      const favor = Number(esLocal
        ? partido.goles_local
        : partido.goles_visitante);
      const contra = Number(esLocal
        ? partido.goles_visitante
        : partido.goles_local);

      acumularResultadoRendimiento(
        stats,
        favor,
        contra,
        esLocal ? "local" : "visitante"
      );
    });

  return completarDerivadosRendimiento(stats);
}

function obtenerZonaEquipoTorneo(equipo, partidosTorneo) {
  const partidoRegular = partidosTorneo.find(
    partido =>
      partido.tipo === "regular" &&
      equipoParticipaEnPartido(partido, equipo) &&
      Number.isFinite(Number(partido.zona))
  );

  return partidoRegular ? Number(partidoRegular.zona) : obtenerZonaEquipo(equipo);
}

function calcularTablaZonaHistorial(partidosTorneo, zona) {
  const equipos = new Set();

  partidosTorneo
    .filter(
      partido =>
        partido.tipo === "regular" &&
        Number(partido.zona) === Number(zona)
    )
    .forEach(partido => {
      const local = obtenerNombreOficialEquipo(partido.local, partido.local_id);
      const visitante = obtenerNombreOficialEquipo(
        partido.visitante,
        partido.visitante_id
      );
      if (local) equipos.add(local);
      if (visitante) equipos.add(visitante);
    });

  const tabla = Object.fromEntries(
    [...equipos].map(equipo => [equipo, crearFilaTabla(equipo)])
  );

  partidosTorneo
    .filter(
      partido =>
        partido.tipo === "regular" &&
        Number(partido.zona) === Number(zona) &&
        partidoFinalizadoParaRendimiento(partido)
    )
    .forEach(partido => {
      const localNombre = obtenerNombreOficialEquipo(
        partido.local,
        partido.local_id
      );
      const visitanteNombre = obtenerNombreOficialEquipo(
        partido.visitante,
        partido.visitante_id
      );
      if (!localNombre || !visitanteNombre) return;

      if (!tabla[localNombre]) tabla[localNombre] = crearFilaTabla(localNombre);
      if (!tabla[visitanteNombre]) {
        tabla[visitanteNombre] = crearFilaTabla(visitanteNombre);
      }

      const golesLocal = Number(partido.goles_local);
      const golesVisitante = Number(partido.goles_visitante);
      const local = tabla[localNombre];
      const visitante = tabla[visitanteNombre];

      local.pj++;
      visitante.pj++;
      local.gf += golesLocal;
      local.gc += golesVisitante;
      visitante.gf += golesVisitante;
      visitante.gc += golesLocal;

      if (golesLocal > golesVisitante) {
        local.pg++;
        local.pts += 3;
        visitante.pp++;
      } else if (golesLocal < golesVisitante) {
        visitante.pg++;
        visitante.pts += 3;
        local.pp++;
      } else {
        local.pe++;
        visitante.pe++;
        local.pts++;
        visitante.pts++;
      }

      local.dg = local.gf - local.gc;
      visitante.dg = visitante.gf - visitante.gc;
    });

  return Object.values(tabla).sort(
    (a, b) =>
      b.pts - a.pts ||
      b.dg - a.dg ||
      b.gf - a.gf ||
      nombre(a.equipo).localeCompare(nombre(b.equipo), "es")
  );
}

function obtenerDatosTablaEquipoTorneo(equipo, partidosTorneo) {
  const zona = obtenerZonaEquipoTorneo(equipo, partidosTorneo);
  const tablaZona = zona ? calcularTablaZonaHistorial(partidosTorneo, zona) : [];
  const indice = tablaZona.findIndex(fila =>
    equipoCoincideConNombre(fila.equipo, equipo)
  );

  return {
    zona,
    posicionZona: indice >= 0 ? indice + 1 : null
  };
}

function obtenerResultadoSerieFinalHistorial(partidosTorneo) {
  const partidos = partidosTorneo
    .filter(partido => partido.tipo === "playoff" && partido.fase === "final")
    .sort(
      (a, b) =>
        Number(a.numero_playoff || 0) - Number(b.numero_playoff || 0) ||
        compararFechaPartido(a, b)
    );
  const jugados = partidos.filter(partidoFinalizadoParaRendimiento);
  const equipos = [
    ...new Set(
      partidos.flatMap(partido => [partido.local, partido.visitante])
        .filter(Boolean)
    )
  ];
  const completa =
    partidos.length > 0 &&
    jugados.length === partidos.length &&
    equipos.length === 2;
  const goles = new Map(equipos.map(equipo => [equipo, 0]));

  jugados.forEach(partido => {
    goles.set(
      partido.local,
      (goles.get(partido.local) || 0) + Number(partido.goles_local)
    );
    goles.set(
      partido.visitante,
      (goles.get(partido.visitante) || 0) +
        Number(partido.goles_visitante)
    );
  });

  let ganador = null;
  if (completa) {
    const [equipoA, equipoB] = equipos;
    const golesA = goles.get(equipoA) || 0;
    const golesB = goles.get(equipoB) || 0;

    if (golesA > golesB) ganador = equipoA;
    if (golesB > golesA) ganador = equipoB;

    if (!ganador) {
      const definicion = [...partidos].reverse().find(
        partido =>
          partido.penales_local !== null &&
          partido.penales_visitante !== null
      );
      if (definicion) {
        if (definicion.penales_local > definicion.penales_visitante) {
          ganador = definicion.local;
        }
        if (definicion.penales_visitante > definicion.penales_local) {
          ganador = definicion.visitante;
        }
      }
    }
  }

  return {
    partidos,
    equipos,
    completa,
    ganador,
    definicionPendiente: completa && !ganador
  };
}

function equipoCoincideConNombre(a, b) {
  return normalizarNombreClub(a) === normalizarNombreClub(b);
}

function obtenerEstadoEquipoTorneoHistorial(equipo, partidosTorneo) {
  const serieFinal = obtenerResultadoSerieFinalHistorial(partidosTorneo);

  if (serieFinal.equipos.some(item => equipoCoincideConNombre(item, equipo))) {
    if (serieFinal.ganador) {
      const campeon = equipoCoincideConNombre(serieFinal.ganador, equipo);
      return {
        texto: campeon ? "Campe\u00f3n" : "Subcampe\u00f3n",
        clase: campeon ? "champion" : "runner-up"
      };
    }
    if (serieFinal.definicionPendiente) {
      return { texto: "Definicion pendiente", clase: "pending" };
    }
    return { texto: "Clasificado a la final", clase: "final" };
  }

  const fases = [
    ["semifinal", "Clasificado a semifinales", "Eliminado en semifinales"],
    ["cuartos", "Clasificado a cuartos", "Eliminado en cuartos"],
    ["octavos", "Clasificado a octavos", "Eliminado en octavos"]
  ];

  for (const [fase, pendiente, eliminado] of fases) {
    const partido = partidosTorneo.find(
      item =>
        item.tipo === "playoff" &&
        item.fase === fase &&
        equipoParticipaEnPartido(item, equipo)
    );

    if (!partido) continue;

    const ladoGanador = obtenerGanadorPlayoff(partido);
    const ganador = ladoGanador ? partido[ladoGanador] : null;
    const jugado = partidoFinalizadoParaRendimiento(partido);

    if (ganador && !equipoCoincideConNombre(ganador, equipo)) {
      return { texto: eliminado, clase: "eliminated" };
    }
    if (jugado && !ganador) {
      return { texto: "Definicion pendiente", clase: "pending" };
    }

    return { texto: pendiente, clase: fase };
  }

  return partidosTorneo.some(partido => partido.tipo === "playoff")
    ? { texto: "No clasifico a playoffs", clase: "not-qualified" }
    : null;
}

function obtenerEventosPartidosHistorial(partidos) {
  const ids = new Set(partidos.map(partido => String(partido.id)));
  return state.eventosTodos.filter(
    evento => ids.has(String(evento.partido_id))
  );
}

function esEventoPublicableHistorial(evento) {
  return !Object.prototype.hasOwnProperty.call(evento, "estado_dato") ||
    evento.estado_dato === null ||
    evento.estado_dato === undefined ||
    esEventoPublicable(evento);
}

function resolverEquipoEventoHistorial(evento, partido) {
  if (String(evento.equipo_id) === String(partido.local_id)) {
    return partido.local;
  }
  if (String(evento.equipo_id) === String(partido.visitante_id)) {
    return partido.visitante;
  }
  if (evento.equipo) {
    if (equipoCoincideConNombre(evento.equipo, partido.local)) {
      return partido.local;
    }
    if (equipoCoincideConNombre(evento.equipo, partido.visitante)) {
      return partido.visitante;
    }
  }

  return resolverEquipoEvento(evento, partido);
}

function calcularMaximosGoleadoresEquipo(equipo, partidosEquipo, eventos) {
  const partidosPorId = new Map(
    partidosEquipo.map(partido => [String(partido.id), partido])
  );
  const goles = new Map();

  eventos
    .filter(esEventoPublicableHistorial)
    .forEach(evento => {
      const partido = partidosPorId.get(String(evento.partido_id));
      if (!partido) return;

      const tipo = normalizarTipoEvento(evento.tipo);
      if (!["gol", "gol-penal"].includes(tipo)) return;

      const equipoEvento = resolverEquipoEventoHistorial(evento, partido);
      if (!equipoCoincideConNombre(equipoEvento, equipo)) return;

      const jugador = limpiarNombreJugador(evento.jugador);
      if (!jugador) return;

      const clave = normalizarClaveGoleador(jugador);
      const actual = goles.get(clave) || { jugador, goles: 0 };
      actual.goles++;
      goles.set(clave, actual);
    });

  const ordenados = [...goles.values()].sort(
    (a, b) =>
      b.goles - a.goles ||
      a.jugador.localeCompare(b.jugador, "es", { sensitivity: "base" })
  );
  const maximo = ordenados[0]?.goles || 0;

  return {
    goles: maximo,
    jugadores: ordenados.filter(item => item.goles === maximo)
  };
}

function describirPartidoDesdeEquipo(partido, equipo) {
  const lado = obtenerLadoEquipoPartido(partido, equipo);
  const rival = lado === "local" ? partido.visitante : partido.local;
  const favor = lado === "local" ? partido.goles_local : partido.goles_visitante;
  const contra = lado === "local" ? partido.goles_visitante : partido.goles_local;
  const contexto = partido.tipo === "playoff"
    ? etiquetaFase(partido.fase)
    : `Fecha ${partido.fecha || "-"}`;
  const marcador = `${favor}-${contra}`;
  const rivalNombre = nombre(rival);

  return {
    marcador,
    rival: rivalNombre,
    titulo: `${marcador} ante ${rivalNombre}`,
    detalle: contexto
  };
}

function calcularDestacadosEquipoTorneo(equipo, partidosEquipo, eventos) {
  const jugados = partidosEquipo.filter(partidoFinalizadoParaRendimiento);
  let mayorMargen = 0;
  let mayorTotal = 0;
  const mayoresVictorias = [];
  const partidosMasGoles = [];

  jugados.forEach(partido => {
    const lado = obtenerLadoEquipoPartido(partido, equipo);
    if (!lado) return;

    const favor = Number(lado === "local"
      ? partido.goles_local
      : partido.goles_visitante);
    const contra = Number(lado === "local"
      ? partido.goles_visitante
      : partido.goles_local);
    const margen = favor - contra;
    const total = favor + contra;

    if (margen > 0 && margen > mayorMargen) {
      mayorMargen = margen;
      mayoresVictorias.length = 0;
      mayoresVictorias.push(partido);
    } else if (margen > 0 && margen === mayorMargen) {
      mayoresVictorias.push(partido);
    }

    if (total > mayorTotal) {
      mayorTotal = total;
      partidosMasGoles.length = 0;
      partidosMasGoles.push(partido);
    } else if (total === mayorTotal && total > 0) {
      partidosMasGoles.push(partido);
    }
  });

  return {
    mayorMargen,
    mayorTotal,
    jugados: jugados.length,
    mayoresVictorias,
    partidosMasGoles,
    goleadores: calcularMaximosGoleadoresEquipo(equipo, partidosEquipo, eventos)
  };
}

function renderCampaniaEquipo(stats) {
  const sinPartidosJugados = stats.pj === 0;

  return `
    <div class="team-season-campaign" aria-label="Resumen de campania">
      <div class="team-season-stat--points">
        <span>Puntos</span>
        <strong>${stats.pts}</strong>
        ${sinPartidosJugados ? "<small>A&uacute;n sin partidos jugados</small>" : ""}
      </div>
      <div>
        <span>Campa&ntilde;a</span>
        <strong>${stats.pg}G &middot; ${stats.pe}E &middot; ${stats.pp}P</strong>
        ${sinPartidosJugados ? "<small>Sin datos todav&iacute;a</small>" : ""}
      </div>
      <div>
        <span>Goles a favor</span>
        <strong>${stats.gf}</strong>
        ${sinPartidosJugados ? "<small>Sin goles registrados</small>" : ""}
      </div>
      <div>
        <span>Goles en contra</span>
        <strong>${stats.gc}</strong>
        ${sinPartidosJugados ? "<small>Sin goles recibidos</small>" : ""}
      </div>
    </div>
  `;
}

function renderDestacadosEquipoTorneo(destacados, equipo) {
  const items = [];

  if (destacados.goleadores.jugadores.length > 0) {
    const nombresGoleadores = destacados.goleadores.jugadores
      .map(item => escaparHtml(item.jugador))
      .filter(Boolean);
    const goles = destacados.goleadores.goles;
    const textoGoles = `${goles} ${goles === 1 ? "gol" : "goles"}`;

    items.push(`
      <div class="team-season-note team-season-note--scorers">
        <span class="team-season-note-icon team-season-note-icon--scorers" aria-hidden="true"></span>
        <div>
          <span>Goleadores</span>
          <strong>${unirFrases(nombresGoleadores)}</strong>
          <small>
            ${destacados.goleadores.jugadores.length > 1
              ? `${textoGoles} cada uno`
              : textoGoles}
          </small>
        </div>
      </div>
    `);
  }

  if (destacados.mayoresVictorias.length > 0) {
    const partido = destacados.mayoresVictorias[0];
    const descripcion = describirPartidoDesdeEquipo(partido, equipo);

    items.push(`
      <div class="team-season-note team-season-note--big-win">
        <span class="team-season-note-icon team-season-note-icon--big-win" aria-hidden="true"></span>
        <div>
          <span>Mayor victoria</span>
          <strong>
            ${escaparHtml(descripcion.marcador)}
            ante ${escaparHtml(descripcion.rival)}
          </strong>
          <small>
            ${escaparHtml(descripcion.detalle)}
            ${destacados.mayoresVictorias.length > 1
              ? " &middot; compartida"
              : ""}
          </small>
        </div>
      </div>
    `);
  }

  if (items.length === 0) {
    const detalle = destacados.jugados > 0
      ? "No hay registros destacados para este campeonato"
      : "A&uacute;n sin partidos jugados";

    items.push(`
      <div class="team-season-note team-season-note--scorers team-season-note--empty">
        <span class="team-season-note-icon team-season-note-icon--scorers" aria-hidden="true"></span>
        <div>
          <span>Goleadores</span>
          <strong>Sin goles registrados</strong>
          <small>${detalle}</small>
        </div>
      </div>
      <div class="team-season-note team-season-note--big-win team-season-note--empty">
        <span class="team-season-note-icon team-season-note-icon--big-win" aria-hidden="true"></span>
        <div>
          <span>Mayor victoria</span>
          <strong>Sin datos todav&iacute;a</strong>
          <small>${detalle}</small>
        </div>
      </div>
    `);
  }

  return `
    <section class="team-season-block team-season-highlights">
      <div class="team-season-block-head">
        <h2>Destacados</h2>
      </div>
      <div class="team-season-notes">
        ${items.join("")}
      </div>
    </section>
  `;
}

function renderResumenTablaEquipo(datosTabla, estadoTorneoEquipo) {
  const items = [];

  if (datosTabla.zona && datosTabla.posicionZona) {
    items.push(
      `<span class="team-season-position">${datosTabla.posicionZona}.&ordm; en Zona ${datosTabla.zona}</span>`
    );
  }

  if (estadoTorneoEquipo?.texto) {
    items.push(renderInsigniaEstadoEquipoTorneo(estadoTorneoEquipo));
  }

  if (items.length === 0) return "";

  return `
    <div class="team-season-outcome">
      ${items.join("")}
    </div>
  `;
}

function renderInsigniaEstadoEquipoTorneo(estadoTorneoEquipo) {
  if (!estadoTorneoEquipo?.texto) return "";

  const claseEstado = String(estadoTorneoEquipo.clase || "neutral")
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "");
  const esCampeon = claseEstado === "champion";
  const claseLogro = esCampeon
    ? "team-detail-achievement--champion"
    : "team-detail-achievement--neutral";
  const icono = esCampeon
    ? '<span class="team-detail-achievement-icon" aria-hidden="true">&#9733;</span>'
    : "";
  const texto = escaparHtml(estadoTorneoEquipo.texto);
  const etiquetaAccesible = esCampeon ? "Logro" : "Estado del torneo";

  return `
    <span
      class="team-stage-badge team-detail-achievement ${claseLogro} team-stage-badge-${claseEstado}"
      aria-label="${etiquetaAccesible}: ${texto}"
    >
      ${icono}<span>${texto}</span>
    </span>
  `;
}

function renderResumenTorneoEquipo(stats, datosTabla, estadoTorneoEquipo) {
  return `
    <section class="team-season-block team-season-tournament">
      <div class="team-season-block-head">
        <h2>Resumen del torneo</h2>
      </div>
      ${renderResumenTablaEquipo(datosTabla, estadoTorneoEquipo)}
      ${renderCampaniaEquipo(stats)}
    </section>
  `;
}

function agruparPartidosEquipoPorFase(partidosEquipo) {
  const grupos = new Map();
  const orden = [
    ["regular", "Fase regular"],
    ["octavos", "Octavos"],
    ["cuartos", "Cuartos"],
    ["semifinal", "Semifinales"],
    ["final", "Final"]
  ];

  partidosEquipo.forEach(partido => {
    const clave = partido.tipoActividad === "libre" ||
      partido.tipo === "regular"
      ? "regular"
      : partido.fase || "playoffs";
    if (!grupos.has(clave)) grupos.set(clave, []);
    grupos.get(clave).push(partido);
  });

  return [
    ...orden
      .filter(([clave]) => grupos.has(clave))
      .map(([clave, titulo]) => ({
        clave,
        titulo,
        partidos: grupos.get(clave).sort(ordenarPartidosCronologicamente)
      })),
    ...[...grupos.entries()]
      .filter(([clave]) => !orden.some(([item]) => item === clave))
      .map(([clave, partidos]) => ({
        clave,
        titulo: clave === "playoffs" ? "Playoffs" : clave,
        partidos: partidos.sort(ordenarPartidosCronologicamente)
      }))
  ];
}

function torneoPermiteProximoEquipo(torneo) {
  if (!torneo) return false;
  if (esTorneoVigente(torneo)) return true;

  return (
    state.torneoPreview?.id &&
    String(state.torneoPreview.id) === String(torneo.id)
  );
}

function obtenerProximoPartidoEquipo(partidosEquipo, torneo) {
  if (!torneoPermiteProximoEquipo(torneo)) return null;

  const partidosReales = partidosEquipo.filter(
    partido =>
      partido.tipoActividad !== "libre" &&
      partidoPendienteParaVista(partido)
  );

  if (window.TPPublicTournament?.getNextPendingMatch) {
    return window.TPPublicTournament.getNextPendingMatch(
      partidosReales,
      { regularOnly: false }
    );
  }

  return partidosReales.sort(ordenarPartidosCronologicamente)[0] || null;
}

function renderResumenGrupoPartidosEquipo(grupo) {
  const cantidadPartidos = grupo.partidos.filter(
    partido => partido.tipoActividad !== "libre"
  ).length;
  const cantidadLibres = grupo.partidos.length - cantidadPartidos;
  const cantidadFechas = new Set(
    grupo.partidos
      .map(partido => Number(partido.fecha))
      .filter(Number.isFinite)
  ).size;
  const titulo = grupo.clave === "regular" && cantidadFechas > 0
    ? `${cantidadFechas} ${cantidadFechas === 1 ? "fecha" : "fechas"}`
    : `${cantidadPartidos} ${cantidadPartidos === 1 ? "partido" : "partidos"}`;
  const detalle = grupo.clave === "regular"
    ? [
        `${cantidadPartidos} ${cantidadPartidos === 1 ? "partido" : "partidos"}`,
        cantidadLibres > 0
          ? `${cantidadLibres} ${cantidadLibres === 1 ? "libre" : "libres"}`
          : ""
      ].filter(Boolean).join(" · ")
    : "";

  return `
    <span class="team-season-summary">
      <strong>${titulo}</strong>
      ${detalle ? `<small>${detalle}</small>` : ""}
    </span>
  `;
}

function renderPartidosEquipoPorFase(partidosEquipo, equipo, torneo) {
  if (partidosEquipo.length === 0) {
    return `
      <section class="detail-section">
        <div class="detail-section-head">
          <h2>Partidos del campeonato</h2>
        </div>
        <div class="detail-empty">
          No hay partidos registrados para este equipo en el campeonato seleccionado.
        </div>
      </section>
    `;
  }

  const proximoPartido = obtenerProximoPartidoEquipo(partidosEquipo, torneo);
  const proximoId = proximoPartido ? String(proximoPartido.id) : null;

  return agruparPartidosEquipoPorFase(partidosEquipo)
    .map(grupo => {
      return `
        <section class="detail-section team-season-matches">
          <div class="detail-section-head">
            <h2>${escaparHtml(grupo.titulo)}</h2>
            ${renderResumenGrupoPartidosEquipo(grupo)}
          </div>
          <div class="team-match-list">
            ${grupo.partidos.map(partido =>
              partido.tipoActividad === "libre"
                ? renderActividadLibre(partido, equipo)
                : renderMiniPartido(
                    partido,
                    equipo,
                    proximoId !== null && String(partido.id) === proximoId
                  )
            ).join("")}
          </div>
        </section>
      `;
    })
    .join("");
}

function renderDetalleEquipo(equipo) {
  const cont = document.getElementById("teamDetail");
  if (!cont) return;

  if (!equipo && vistaActual.equipoSlug && !cargaPartidosFinalizada) {
    cont.innerHTML = renderDetalleVacio("Cargando equipo...");
    return;
  }

  if (!equipo && vistaActual.equipoSlug) {
    equipo = resolverEquipoDesdeSegmentoRuta(vistaActual.equipoSlug);
    vistaActual.equipo = equipo;
  }

  if (!equipo) {
    cont.innerHTML = renderDetalleVacio("Equipo no encontrado");
    return;
  }

  if (errorCargaDatos && state.partidosTodos.length === 0) {
    cont.innerHTML = `
      <div class="detail-topbar">
        <button type="button" class="detail-back" onclick="volverDetalle()">
          ← Volver
        </button>
        <span class="detail-context">Detalle del equipo</span>
      </div>
      ${renderEstadoVista(
        "error",
        "No pudimos cargar el equipo",
        obtenerMensajeErrorCargaDatos("Revisa tu conexion e intenta nuevamente."),
        true
      )}
    `;
    return;
  }

  if (!cargaPartidosFinalizada) {
    cont.innerHTML = `
      <div class="detail-topbar">
        <button type="button" class="detail-back" onclick="volverDetalle()">
          ← Volver
        </button>
        <span class="detail-context">Detalle del equipo</span>
      </div>
      ${renderEstadoVista(
        "cargando",
        "Cargando equipo",
        "Estamos preparando el historial del club."
      )}
    `;
    return;
  }

  const club = obtenerClub(equipo);
  const torneosEquipo = obtenerTorneosDisponiblesEquipo(equipo);
  const seleccion = resolverSeleccionTorneoDetalleEquipo(torneosEquipo);
  const torneoSeleccionado = seleccion.torneo;
  const partidosTorneo = torneoSeleccionado
    ? obtenerPartidosResueltosTorneoHistorial(torneoSeleccionado)
    : [];
  const partidosEquipo = torneoSeleccionado
    ? partidosTorneo
        .filter(partido => equipoParticipaEnPartido(partido, equipo))
        .sort(ordenarPartidosCronologicamente)
    : [];
  const libresEquipo = torneoSeleccionado
    ? obtenerFechasLibresEquipoTorneo(equipo, partidosTorneo, torneoSeleccionado)
    : [];
  const actividadesEquipo = partidosEquipo
    .concat(libresEquipo)
    .sort(ordenarPartidosCronologicamente);
  const stats = calcularRendimientoEquipoTorneo(partidosEquipo, equipo);
  const datosTabla = obtenerDatosTablaEquipoTorneo(equipo, partidosTorneo);
  const eventosEquipo = obtenerEventosPartidosHistorial(partidosEquipo);
  const destacados = calcularDestacadosEquipoTorneo(
    equipo,
    partidosEquipo,
    eventosEquipo
  );
  const estadoTorneoEquipo = torneoSeleccionado
    ? obtenerEstadoEquipoTorneoHistorial(equipo, partidosTorneo)
    : null;
  const nombreEquipo = nombre(equipo);
  const nombreOficial = club?.nombre_oficial || equipo || nombreEquipo;
  const apodo = club?.apodo?.trim();
  const ciudad = club?.ciudad?.trim();
  const zonaDetalle = datosTabla.zona ? `Zona ${datosTabla.zona}` : "";
  const escudo = obtenerEscudoEquipo(equipo, club?.id);
  const escudoEquipo = escudo
    ? `<img src="${escudo}" alt="Escudo de ${escaparHtml(nombreOficial)}" width="96" height="96" decoding="async">`
    : `<span aria-hidden="true">${escaparHtml(
        (nombreEquipo || "?").trim().slice(0, 2).toUpperCase()
      )}</span>`;
  const claseEscudoEquipo = escudo
    ? "team-detail-shield"
    : "team-detail-shield is-missing";

  if (
    (seleccion.fallbackAplicado || seleccion.desdeUrl) &&
    vistaActual.id === "equipo"
  ) {
    guardarVistaEnHistorial(true);
  }

  cont.innerHTML = `
    <div class="detail-topbar">
      <button type="button" class="detail-back" onclick="volverDetalle()">
        ← Volver
      </button>
      <span class="detail-context">Detalle del equipo</span>
    </div>

    <article class="team-detail-card">
      <section class="team-detail-identity team-detail-header">
        <div class="team-detail-head">
          <div class="${claseEscudoEquipo}">${escudoEquipo}</div>
          <div class="team-detail-copy">
            <h1>${escaparHtml(nombreOficial)}</h1>
            ${apodo
              ? `<p class="team-detail-nickname">${escaparHtml(apodo)}</p>`
              : ""}
            ${ciudad || zonaDetalle
              ? `
                <div class="team-detail-meta-line">
                  ${ciudad
                    ? `<span class="team-detail-origin">${escaparHtml(ciudad)}</span>`
                    : ""}
                  ${zonaDetalle
                    ? `<span class="team-detail-zone-line">${escaparHtml(zonaDetalle)}</span>`
                    : ""}
                </div>
              `
              : ""}
          </div>
        </div>
      </section>
      ${renderSelectorTorneosDetalleEquipo(torneosEquipo, torneoSeleccionado)}
      ${renderResumenTorneoEquipo(stats, datosTabla, estadoTorneoEquipo)}
      ${renderDestacadosEquipoTorneo(destacados, equipo)}
    </article>

    ${torneosEquipo.length === 0
      ? `
        <section class="detail-section">
          <div class="detail-empty">
            No hay campeonatos con partidos registrados para este equipo.
          </div>
        </section>
      `
      : `
        ${renderPartidosEquipoPorFase(
          actividadesEquipo,
          equipo,
          torneoSeleccionado
        )}
      `}
  `;
  return;
}

function renderFormaEquipo(partidos, equipo) {
  if (partidos.length === 0) return "";

  return `
    <div class="team-form" aria-label="Forma reciente">
      ${partidos.map(partido => {
        const resultado = resultadoEquipoDetalle(partido, equipo);
        return `<span class="team-form-${resultado.toLowerCase()}">${resultado}</span>`;
      }).join("")}
    </div>
  `;
}

function resultadoEquipoDetalle(partido, equipo) {
  const esLocal = partido.local === equipo;
  const favor = esLocal ? partido.goles_local : partido.goles_visitante;
  const contra = esLocal ? partido.goles_visitante : partido.goles_local;

  if (favor > contra) return "G";
  if (favor < contra) return "P";

  return "E";
}

function partidoFinalizadoRecorridoEquipo(partido) {
  return partidoTieneResultadoVisualConfirmado(partido);
}

function renderMiniPartido(partido, equipo, proximo = false) {
  const finalizado = partidoFinalizadoRecorridoEquipo(partido);
  const esProximo = proximo && !finalizado;
  const tieneMarcador = partidoTieneResultado(partido);
  const centro = tieneMarcador
    ? `${partido.goles_local} - ${partido.goles_visitante}`
    : ESTADOS_DATO.confirmar;
  const contexto = partido.tipo === "playoff"
    ? etiquetaFase(partido.fase)
    : `Fecha ${partido.fecha}`;
  const claseEstado = finalizado
    ? "team-match-finished"
    : esProximo
      ? "team-match-next"
      : "team-match-future";
  const etiquetaEstado = finalizado
    ? "Jugado"
    : esProximo
      ? "Próximo"
      : "Pendiente";
  const claseEtiqueta = finalizado
    ? "played"
    : esProximo
      ? "next"
      : "pending";
  const ladoEquipo = obtenerLadoEquipoPartido(partido, equipo);
  const claseResultado = obtenerClaseResultadoEquipoPartido(partido, equipo);
  const nombreLocal = obtenerNombreLadoPartido(partido, "local");
  const nombreVisitante = obtenerNombreLadoPartido(partido, "visitante");

  return `
    <button
      type="button"
      class="team-match-row ${claseEstado} ${claseResultado}"
      onclick="abrirPartido(${JSON.stringify(partido.id)})"
      aria-label="${escaparHtml(
        `${contexto}: ${nombreLocal} vs ${nombreVisitante}. ${tieneMarcador ? `Resultado ${centro}` : centro}. ${etiquetaEstado}.`
      )}"
    >
      <span class="team-match-line">
      <span class="${ladoEquipo === "local" ? "focus-team" : ""}">
        ${nombreLocal}
      </span>
      <strong class="${tieneMarcador ? "team-match-score" : "team-match-pending"}">${centro}</strong>
      <span class="${ladoEquipo === "visitante" ? "focus-team" : ""}">
        ${nombreVisitante}
      </span>
      </span>
      <small class="team-match-meta">
        <span>${contexto}</span>
        <span class="team-match-state ${claseEtiqueta}">
          ${etiquetaEstado}
        </span>
      </small>
    </button>
  `;
}

function renderProximoPartidoEquipo(partido, equipo) {
  const estadio = obtenerEstadioPartido(partido);

  return `
    <div class="team-next-match">
      ${renderMiniPartido(partido, equipo, true)}
      <div class="team-next-meta">
        ${renderDatoProximoPartido(
          "Fecha",
          formatearFechaCompleta(partido.fecha_partido)
        )}
        ${renderDatoProximoPartido(
          "Hora",
          obtenerHoraPartido(partido)
        )}
        ${renderDatoProximoPartido("Estadio", estadio)}
      </div>
    </div>
  `;
}

function renderDatoProximoPartido(etiqueta, valor) {
  const estado = obtenerEstadoDato(valor);

  return `
    <div>
      <span>${etiqueta}</span>
      <strong class="${estado ? `data-${estado}` : ""}">${valor}</strong>
    </div>
  `;
}

function obtenerNombreLadoPartido(partido, lado) {
  if (partido[lado]) return nombre(partido[lado]);
  if (partido.tipo === "playoff") {
    return obtenerPlaceholderPlayoff(partido, lado);
  }
  return "Por definir";
}

function obtenerFechasLibresEquipoTorneo(equipo, partidosTorneo, torneo) {
  if (!equipo || !torneo?.id || !window.TPPublicTournament) return [];

  const opciones = {
    torneoId: torneo.id,
    getOfficialName: (nombreEquipo, clubId) =>
      obtenerNombreOficialEquipo(nombreEquipo, clubId)
  };
  const derivados = window.TPPublicTournament.deriveRegularParticipants(
    partidosTorneo,
    opciones
  );
  const participante = derivados.participants.find(item =>
    !item.conflictoZona && equipoCoincideConNombre(item.equipo, equipo)
  );
  const zona = participante?.zona ||
    obtenerZonaEquipoTorneo(equipo, partidosTorneo);
  const equiposZona = zona
    ? window.TPPublicTournament.getTeamsByZone(derivados, zona)
    : [];

  if (!zona || equiposZona.length % 2 === 0) return [];

  const fechasZona = new Map();

  partidosTorneo
    .filter(
      partido =>
        partido.tipo === "regular" &&
        Number(partido.zona) === Number(zona) &&
        partido.fecha !== null
    )
    .forEach(partido => {
      const fecha = Number(partido.fecha);
      if (!fechasZona.has(fecha)) fechasZona.set(fecha, []);
      fechasZona.get(fecha).push(partido);
    });

  return [...fechasZona.entries()]
    .map(([fecha, partidos]) => {
      const libres = window.TPPublicTournament.getFreeParticipants(
        derivados,
        partidos,
        zona,
        opciones
      );
      const esLibre = libres.valid && libres.teams.some(item =>
        equipoCoincideConNombre(item, equipo)
      );

      if (!esLibre) return null;

      return {
        tipoActividad: "libre",
        tipo: "regular",
        id: `libre-${torneo.id}-${zona}-${fecha}`,
        fecha,
        fecha_partido:
          partidos.find(partido => partido.fecha_partido)?.fecha_partido ||
          null
      };
    })
    .filter(Boolean);
}

function renderActividadLibre(actividad, equipo) {
  const equipoLibre = escaparHtml(nombre(equipo));

  return `
    <div
      class="team-match-row team-activity-free team-match--bye"
      aria-label="Fecha ${actividad.fecha} libre de ${equipoLibre}"
    >
      <span class="team-free-line">
        <span>${equipoLibre}</span>
        <strong>LIBRE</strong>
      </span>
      <small class="team-match-meta">
        <span>Fecha ${actividad.fecha}</span>
        <span class="team-match-state free">Libre</span>
      </small>
    </div>
  `;
}

function obtenerZonaEquipo(equipo) {
  const zona = obtenerZonasTorneo().find(
    numeroZona => obtenerEquiposZonaTorneo(numeroZona).includes(equipo)
  );
  return zona || null;
}

function ordenarPartidosRecientes(a, b) {
  const fechaA = `${a.fecha_partido || "0000-00-00"} ${a.hora || "00:00"}`;
  const fechaB = `${b.fecha_partido || "0000-00-00"} ${b.hora || "00:00"}`;
  return fechaB.localeCompare(fechaA) || Number(b.id) - Number(a.id);
}

function ordenarActividadReciente(a, b) {
  const fechaA = a.fecha_partido || "0000-00-00";
  const fechaB = b.fecha_partido || "0000-00-00";
  const porFecha = fechaB.localeCompare(fechaA);

  if (porFecha !== 0) return porFecha;
  if (a.tipoActividad === "libre") return 1;
  if (b.tipoActividad === "libre") return -1;
  return Number(b.id || 0) - Number(a.id || 0);
}

function ordenarPartidosProximos(a, b) {
  const fechaA = `${a.fecha_partido || "9999-12-31"} ${a.hora || "23:59"}`;
  const fechaB = `${b.fecha_partido || "9999-12-31"} ${b.hora || "23:59"}`;
  return fechaA.localeCompare(fechaB) || Number(a.id) - Number(b.id);
}

function renderDetalleVacio(mensaje) {
  return `
    <div class="detail-topbar">
      <button type="button" class="detail-back" onclick="volverDetalle()">
        ← Volver
      </button>
    </div>
    <div class="detail-empty">${mensaje}</div>
  `;
}

function obtenerPartidosParaDatos(alcance = alcanceDatosActual) {
  return state.partidos
    .map(resolverPartidoPlayoff)
    .filter(partido => {
      const tieneResultado =
        partido.goles_local !== null &&
        partido.goles_visitante !== null &&
        Number.isFinite(Number(partido.goles_local)) &&
        Number.isFinite(Number(partido.goles_visitante));
      const tieneEquipos = Boolean(partido.local && partido.visitante);
      const coincideAlcance =
        alcance === "completo" ||
        alcance === "regular" && partido.tipo === "regular" ||
        alcance === "playoffs" && partido.tipo === "playoff";

      return tieneResultado && tieneEquipos && coincideAlcance;
    })
    .sort(ordenarPartidosCronologicamente);
}

function crearEstadisticaEquipo(equipo) {
  return {
    equipo,
    pj: 0,
    pg: 0,
    pe: 0,
    pp: 0,
    gf: 0,
    gc: 0,
    dg: 0,
    pts: 0,
    vallasInvictas: 0,
    pjLocal: 0,
    pgLocal: 0,
    resultados: []
  };
}

function calcularEstadisticasDatos(alcance = alcanceDatosActual) {
  const estadisticas = new Map();

  obtenerPartidosParaDatos(alcance).forEach(partido => {
    if (!estadisticas.has(partido.local)) {
      estadisticas.set(
        partido.local,
        crearEstadisticaEquipo(partido.local)
      );
    }
    if (!estadisticas.has(partido.visitante)) {
      estadisticas.set(
        partido.visitante,
        crearEstadisticaEquipo(partido.visitante)
      );
    }

    const local = estadisticas.get(partido.local);
    const visitante = estadisticas.get(partido.visitante);
    const golesLocal = Number(partido.goles_local);
    const golesVisitante = Number(partido.goles_visitante);

    local.pj += 1;
    visitante.pj += 1;
    local.pjLocal += 1;
    local.gf += golesLocal;
    local.gc += golesVisitante;
    visitante.gf += golesVisitante;
    visitante.gc += golesLocal;

    if (golesVisitante === 0) local.vallasInvictas += 1;
    if (golesLocal === 0) visitante.vallasInvictas += 1;

    if (golesLocal > golesVisitante) {
      local.pg += 1;
      local.pts += 3;
      local.pgLocal += 1;
      visitante.pp += 1;
      local.resultados.push("G");
      visitante.resultados.push("P");
    } else if (golesLocal < golesVisitante) {
      visitante.pg += 1;
      visitante.pts += 3;
      local.pp += 1;
      local.resultados.push("P");
      visitante.resultados.push("G");
    } else {
      local.pe += 1;
      visitante.pe += 1;
      local.pts += 1;
      visitante.pts += 1;
      local.resultados.push("E");
      visitante.resultados.push("E");
    }
  });

  return [...estadisticas.values()]
    .map(item => ({
      ...item,
      dg: item.gf - item.gc,
      promedioGoles: item.pj > 0 ? item.gf / item.pj : 0,
      promedioRecibidos: item.pj > 0 ? item.gc / item.pj : 0,
      promedioDiferencia:
        item.pj > 0
          ? (item.gf - item.gc) / item.pj
          : 0,
      porcentajeVictorias:
        item.pj > 0
          ? item.pg / item.pj * 100
          : 0,
      porcentajeVallasInvictas:
        item.pj > 0
          ? item.vallasInvictas / item.pj * 100
          : 0,
      porcentajeVictoriasLocal:
        item.pjLocal > 0
          ? item.pgLocal / item.pjLocal * 100
          : 0,
      rachaSinPerder: calcularRachaSinPerder(item.resultados)
    }))
    .sort((a, b) =>
      b.porcentajeVictorias - a.porcentajeVictorias ||
      b.promedioDiferencia - a.promedioDiferencia ||
      nombre(a.equipo).localeCompare(nombre(b.equipo), "es")
    );
}

function calcularRachaSinPerder(resultados) {
  let racha = 0;

  for (let indice = resultados.length - 1; indice >= 0; indice -= 1) {
    if (resultados[indice] === "P") break;
    racha += 1;
  }

  return racha;
}

function obtenerMuestraMinimaDatos(
  estadisticas,
  campo = "pj"
) {
  const maximo = Math.max(
    ...estadisticas.map(item => Number(item[campo]) || 0),
    0
  );

  return Math.max(2, Math.ceil(maximo / 2));
}

function obtenerLideresDatos(
  estadisticas,
  campo,
  modo = "max",
  campoMuestra = "pj"
) {
  if (estadisticas.length === 0) return [];

  const muestraMinima = obtenerMuestraMinimaDatos(
    estadisticas,
    campoMuestra
  );
  const elegibles = estadisticas.filter(
    item => Number(item[campoMuestra]) >= muestraMinima
  );

  if (elegibles.length === 0) return [];

  const valorLider = elegibles.reduce(
    (valor, item) =>
      modo === "min"
        ? Math.min(valor, item[campo])
        : Math.max(valor, item[campo]),
    modo === "min" ? Infinity : -Infinity
  );

  return elegibles.filter(
    item => Math.abs(item[campo] - valorLider) < 0.000001
  );
}

function listarLideresDatos(lideres) {
  const nombres = lideres.map(item => nombre(item.equipo));

  if (nombres.length <= 3) {
    return nombres.join(" · ");
  }

  return `${nombres.slice(0, 3).join(" · ")} +${nombres.length - 3}`;
}

function renderTarjetaLiderDatos({
  etiqueta,
  valor,
  lideres,
  detalle,
  clase = ""
}) {
  return `
    <article class="datos-leader-card ${clase}">
      <span class="datos-leader-label">${etiqueta}</span>
      <strong class="datos-leader-value">${valor}</strong>
      <div class="datos-leader-team">${escaparHtml(listarLideresDatos(lideres))}</div>
      <p>${detalle}</p>
    </article>
  `;
}

function renderTarjetaSinMuestraDatos(etiqueta) {
  return `
    <article class="datos-leader-card unavailable">
      <span class="datos-leader-label">${etiqueta}</span>
      <strong class="datos-leader-value">Sin muestra</strong>
      <div class="datos-leader-team">Aún no comparable</div>
      <p>Se necesitan más partidos jugados.</p>
    </article>
  `;
}

function formatearDecimalDatos(valor, decimales = 2) {
  return Number(valor)
    .toFixed(decimales)
    .replace(".", ",");
}

function formatearPorcentajeDatos(valor) {
  return `${Math.round(Number(valor))}%`;
}

function detalleLiderDatos(lideres, detalle) {
  return lideres.length > 1
    ? `${lideres.length} equipos igualados`
    : detalle(lideres[0]);
}

function renderLideresDatos(estadisticas) {
  const ataques = obtenerLideresDatos(
    estadisticas,
    "promedioGoles"
  );
  const defensas = obtenerLideresDatos(
    estadisticas,
    "promedioRecibidos",
    "min"
  );
  const victorias = obtenerLideresDatos(
    estadisticas,
    "porcentajeVictorias"
  );
  const diferencias = obtenerLideresDatos(
    estadisticas,
    "promedioDiferencia"
  );
  const vallas = obtenerLideresDatos(
    estadisticas,
    "porcentajeVallasInvictas"
  );
  const locales = obtenerLideresDatos(
    estadisticas,
    "porcentajeVictoriasLocal",
    "max",
    "pjLocal"
  );
  const ataque = ataques[0];
  const defensa = defensas[0];
  const ganador = victorias[0];
  const diferencia = diferencias[0];
  const valla = vallas[0];
  const local = locales[0];
  const muestra = obtenerMuestraMinimaDatos(estadisticas);
  const tarjetaAtaque = ataque
    ? renderTarjetaLiderDatos({
        etiqueta: "Mejor ataque",
        valor: `${formatearDecimalDatos(ataque.promedioGoles)} por partido`,
        lideres: ataques,
        detalle: detalleLiderDatos(
          ataques,
          item => `${item.gf} goles en ${item.pj} partidos`
        ),
        clase: "featured"
      })
    : renderTarjetaSinMuestraDatos("Mejor ataque");
  const tarjetaDefensa = defensa
    ? renderTarjetaLiderDatos({
        etiqueta: "Mejor defensa",
        valor: `${formatearDecimalDatos(defensa.promedioRecibidos)} por partido`,
        lideres: defensas,
        detalle: detalleLiderDatos(
          defensas,
          item => `${item.gc} recibidos en ${item.pj} partidos`
        )
      })
    : renderTarjetaSinMuestraDatos("Mejor defensa");
  const tarjetaVictorias = ganador
    ? renderTarjetaLiderDatos({
        etiqueta: "Mayor porcentaje de victorias",
        valor: formatearPorcentajeDatos(
          ganador.porcentajeVictorias
        ),
        lideres: victorias,
        detalle: detalleLiderDatos(
          victorias,
          item => `${item.pg} triunfos en ${item.pj} partidos`
        )
      })
    : renderTarjetaSinMuestraDatos(
        "Mayor porcentaje de victorias"
      );
  const tarjetaDiferencia = diferencia
    ? renderTarjetaLiderDatos({
        etiqueta: "Mejor diferencia por partido",
        valor: `${
          diferencia.promedioDiferencia > 0 ? "+" : ""
        }${formatearDecimalDatos(diferencia.promedioDiferencia)}`,
        lideres: diferencias,
        detalle: detalleLiderDatos(
          diferencias,
          item => `${item.dg > 0 ? "+" : ""}${item.dg} en total`
        )
      })
    : renderTarjetaSinMuestraDatos(
        "Mejor diferencia por partido"
      );
  const tarjetaVallas = valla
    ? renderTarjetaLiderDatos({
        etiqueta: "Mayor porcentaje de vallas invictas",
        valor: formatearPorcentajeDatos(
          valla.porcentajeVallasInvictas
        ),
        lideres: vallas,
        detalle: detalleLiderDatos(
          vallas,
          item => `${item.vallasInvictas} en ${item.pj} partidos`
        )
      })
    : renderTarjetaSinMuestraDatos(
        "Mayor porcentaje de vallas invictas"
      );
  const tarjetaLocal = local
    ? renderTarjetaLiderDatos({
        etiqueta: "Mejor local",
        valor: formatearPorcentajeDatos(
          local.porcentajeVictoriasLocal
        ),
        lideres: locales,
        detalle: detalleLiderDatos(
          locales,
          item => `${item.pgLocal} triunfos en ${item.pjLocal} partidos`
        )
      })
    : renderTarjetaSinMuestraDatos("Mejor local");

  return `
    <div class="datos-leaders-grid">
      ${tarjetaAtaque}
      ${tarjetaDefensa}
      ${tarjetaVictorias}
      ${tarjetaDiferencia}
      ${tarjetaVallas}
      ${tarjetaLocal}
    </div>
    <p class="datos-sample-note">
      Liderazgos calculados entre equipos con al menos ${muestra}
      partidos en este alcance.
    </p>
  `;
}

function seleccionarEquiposComparador(estadisticas) {
  const disponibles = new Set(
    estadisticas.map(item => item.equipo)
  );
  const protagonistas = obtenerProtagonistasActualesParaDatos()
    .filter(equipo => disponibles.has(equipo));
  const equipoPreferidoA = protagonistas[0] || null;
  const equipoPreferidoB = protagonistas[1] || null;

  if (!disponibles.has(equiposComparadorDatos.equipoA)) {
    equiposComparadorDatos.equipoA =
      equipoPreferidoA ||
      estadisticas[0]?.equipo ||
      null;
  }
  if (
    !disponibles.has(equiposComparadorDatos.equipoB) ||
    equiposComparadorDatos.equipoB === equiposComparadorDatos.equipoA
  ) {
    equiposComparadorDatos.equipoB =
      (
        equipoPreferidoB !== equiposComparadorDatos.equipoA
          ? equipoPreferidoB
          : null
      ) ||
      estadisticas.find(
        item => item.equipo !== equiposComparadorDatos.equipoA
      )?.equipo || null;
  }
}

function obtenerProtagonistasActualesParaDatos() {
  const faseActual = obtenerFaseActualPlayoffs();

  return [
    ...new Set(
      state.partidos
        .filter(
          partido =>
            partido.tipo === "playoff" &&
            partido.fase === faseActual
        )
        .map(resolverPartidoPlayoff)
        .flatMap(partido => [
          partido.local,
          partido.visitante
        ])
        .filter(Boolean)
    )
  ];
}

function renderOpcionesComparador(estadisticas, seleccionado) {
  return estadisticas
    .slice()
    .sort((a, b) =>
      nombre(a.equipo).localeCompare(nombre(b.equipo), "es")
    )
    .map(item => `
      <option
        value="${escaparHtml(item.equipo)}"
        ${item.equipo === seleccionado ? "selected" : ""}
      >
        ${escaparHtml(nombre(item.equipo))}
      </option>
    `)
    .join("");
}

function claseComparador(valorA, valorB, lado, menorEsMejor = false) {
  if (valorA === valorB) return "tie";
  const ganaA = menorEsMejor
    ? valorA < valorB
    : valorA > valorB;
  const gana = lado === "a" ? ganaA : !ganaA;
  return gana ? "winner" : "loser";
}

function formatearValorComparador(valor, formato) {
  if (formato === "puesto") return valor > 0 ? `#${valor}` : "-";
  if (formato === "porcentaje") return `${Math.round(valor)}%`;
  if (formato === "decimal") {
    return Number(valor).toFixed(2).replace(".", ",");
  }
  if (formato === "diferencia" && valor > 0) return `+${valor}`;
  if (formato === "diferencia-decimal") {
    return `${
      valor > 0 ? "+" : ""
    }${Number(valor).toFixed(2).replace(".", ",")}`;
  }
  return String(valor);
}

function renderFilaComparador({
  etiqueta,
  valorA,
  valorB,
  formato = "numero",
  menorEsMejor = false,
  comparar = true,
  mostrarBarras = true
}) {
  const maximo = Math.max(Math.abs(valorA), Math.abs(valorB), 1);
  const anchoA = Math.max(Math.abs(valorA) / maximo * 100, 4);
  const anchoB = Math.max(Math.abs(valorB) / maximo * 100, 4);
  const claseA = comparar
    ? claseComparador(
        valorA,
        valorB,
        "a",
        menorEsMejor
      )
    : "neutral";
  const claseB = comparar
    ? claseComparador(
        valorA,
        valorB,
        "b",
        menorEsMejor
      )
    : "neutral";

  return `
    <div class="datos-compare-row">
      <div class="datos-compare-row-head">
        <strong class="${claseA}">
          ${formatearValorComparador(valorA, formato)}
        </strong>
        <span>${etiqueta}</span>
        <strong class="${claseB}">
          ${formatearValorComparador(valorB, formato)}
        </strong>
      </div>
      ${mostrarBarras
        ? `
          <div class="datos-compare-bars">
            <div class="datos-bar-track left">
              <span class="${claseA}" style="width:${anchoA}%"></span>
            </div>
            <div class="datos-bar-track">
              <span class="${claseB}" style="width:${anchoB}%"></span>
            </div>
          </div>
        `
        : ""}
    </div>
  `;
}

function crearLecturasComparador(statsA, statsB) {
  const equipoA = nombre(statsA.equipo);
  const equipoB = nombre(statsB.equipo);
  const antecedentes = obtenerAntecedentesRegulares(
    statsA.equipo,
    statsB.equipo
  );
  const lecturas = [];

  if (antecedentes.partidos.length === 0) {
    lecturas.push(
      `${equipoA} y ${equipoB} no registran cruces en la fase regular cargada.`
    );
  } else {
    const marcadores = antecedentes.partidos
      .map(item => `${item.golesEquipoA}-${item.golesEquipoB}`)
      .join(" y ");
    const balance =
      antecedentes.victoriasA > antecedentes.victoriasB
        ? `${equipoA} ganó más veces`
        : antecedentes.victoriasB > antecedentes.victoriasA
          ? `${equipoB} ganó más veces`
          : "el historial está igualado";

    lecturas.push(
      `En fase regular jugaron ${antecedentes.partidos.length} ${
        antecedentes.partidos.length === 1 ? "vez" : "veces"
      }: ${marcadores}; ${balance}.`
    );
  }

  if (statsA.promedioGoles === statsB.promedioGoles) {
    lecturas.push(
      `Los dos promedian ${statsA.promedioGoles.toFixed(2).replace(".", ",")} goles por partido.`
    );
  } else {
    const mejorAtaque =
      statsA.promedioGoles > statsB.promedioGoles ? statsA : statsB;
    lecturas.push(
      `${nombre(mejorAtaque.equipo)} tiene mayor producción ofensiva: ${
        mejorAtaque.promedioGoles.toFixed(2).replace(".", ",")
      } goles por partido.`
    );
  }

  if (statsA.promedioRecibidos === statsB.promedioRecibidos) {
    lecturas.push(
      `Ambos reciben ${statsA.promedioRecibidos.toFixed(2).replace(".", ",")} goles por partido.`
    );
  } else {
    const mejorDefensa =
      statsA.promedioRecibidos < statsB.promedioRecibidos
        ? statsA
        : statsB;
    lecturas.push(
      `${nombre(mejorDefensa.equipo)} concede menos: ${
        mejorDefensa.promedioRecibidos.toFixed(2).replace(".", ",")
      } goles por partido.`
    );
  }

  return lecturas;
}

function renderComparadorDatos(estadisticas) {
  seleccionarEquiposComparador(estadisticas);
  const statsA = estadisticas.find(
    item => item.equipo === equiposComparadorDatos.equipoA
  );
  const statsB = estadisticas.find(
    item => item.equipo === equiposComparadorDatos.equipoB
  );

  if (!statsA || !statsB) {
    return `
      <div class="datos-empty">
        Se necesitan al menos dos equipos con partidos jugados.
      </div>
    `;
  }

  const posicionesA = obtenerPosicionesEquipo(statsA.equipo);
  const posicionesB = obtenerPosicionesEquipo(statsB.equipo);
  const filas = [
    {
      etiqueta: "Puesto zona",
      valorA: posicionesA.puestoZona || 0,
      valorB: posicionesB.puestoZona || 0,
      formato: "puesto",
      menorEsMejor: true,
      comparar: Boolean(posicionesA.puestoZona && posicionesB.puestoZona),
      mostrarBarras: false
    },
    {
      etiqueta: "Puesto general",
      valorA: posicionesA.puestoGeneral || 0,
      valorB: posicionesB.puestoGeneral || 0,
      formato: "puesto",
      menorEsMejor: true,
      comparar: Boolean(
        posicionesA.puestoGeneral &&
        posicionesB.puestoGeneral
      ),
      mostrarBarras: false
    },
    {
      etiqueta: "Partidos",
      valorA: statsA.pj,
      valorB: statsB.pj,
      comparar: false
    },
    {
      etiqueta: "% victorias",
      valorA: statsA.porcentajeVictorias,
      valorB: statsB.porcentajeVictorias,
      formato: "porcentaje"
    },
    {
      etiqueta: "Goles por partido",
      valorA: statsA.promedioGoles,
      valorB: statsB.promedioGoles,
      formato: "decimal"
    },
    {
      etiqueta: "Recibidos por partido",
      valorA: statsA.promedioRecibidos,
      valorB: statsB.promedioRecibidos,
      formato: "decimal",
      menorEsMejor: true
    },
    {
      etiqueta: "Diferencia por partido",
      valorA: statsA.promedioDiferencia,
      valorB: statsB.promedioDiferencia,
      formato: "diferencia-decimal"
    },
    {
      etiqueta: "Vallas invictas",
      valorA: statsA.porcentajeVallasInvictas,
      valorB: statsB.porcentajeVallasInvictas,
      formato: "porcentaje"
    },
    {
      etiqueta: "Racha sin perder",
      valorA: statsA.rachaSinPerder,
      valorB: statsB.rachaSinPerder
    }
  ];
  const lecturas = crearLecturasComparador(statsA, statsB);

  return `
    <section class="datos-block datos-compare">
      <div class="datos-block-head">
        <div>
          <span>Comparador</span>
          <h2>Equipo contra equipo</h2>
        </div>
        <small>Promedios por partido · penales no alteran el resultado</small>
      </div>

      <div class="datos-selectors">
        <label>
          <span>Equipo A</span>
          <select onchange="actualizarEquipoComparadorDatos('equipoA', this.value)">
            ${renderOpcionesComparador(estadisticas, statsA.equipo)}
          </select>
          ${renderMetaPosicionesEquipo(
            statsA.equipo,
            "datos-selector-meta"
          )}
        </label>
        <span class="datos-versus">VS</span>
        <label>
          <span>Equipo B</span>
          <select onchange="actualizarEquipoComparadorDatos('equipoB', this.value)">
            ${renderOpcionesComparador(estadisticas, statsB.equipo)}
          </select>
          ${renderMetaPosicionesEquipo(
            statsB.equipo,
            "datos-selector-meta"
          )}
        </label>
      </div>

      <div class="datos-compare-list">
        ${filas.map(renderFilaComparador).join("")}
      </div>

      <div class="datos-readings">
        <div class="datos-readings-label">Lecturas rápidas</div>
        <ul>
          ${lecturas.map(lectura => `
            <li>${escaparHtml(lectura)}</li>
          `).join("")}
        </ul>
      </div>
    </section>
  `;
}

function etiquetaAlcanceDatos(alcance) {
  return {
    regular: "Fase regular",
    playoffs: "Playoffs",
    completo: "Todos los partidos"
  }[alcance] || "Todos los partidos";
}

function descripcionAlcanceDatos(alcance) {
  return {
    regular:
      "Resultados de la fase regular.",
    playoffs:
      "Resultados de playoffs. Los liderazgos exigen una muestra mínima.",
    completo:
      "Fase regular y playoffs combinados. No representa una tabla oficial."
  }[alcance] || "";
}

function obtenerAlcanceDatosInicial() {
  return obtenerFaseActualPlayoffs()
    ? "playoffs"
    : "regular";
}

function renderDatos() {
  const cont = document.getElementById("datosContent");
  if (!cont) return;

  if (errorCargaDatos && state.partidos.length === 0) {
    cont.innerHTML = renderEstadoVista(
      "error",
      "No pudimos calcular las estadísticas",
      obtenerMensajeErrorCargaDatos("Revisá tu conexión e intentá nuevamente."),
      true
    );
    return;
  }

  if (!cargaPartidosFinalizada) {
    cont.innerHTML = `
      <div class="datos-loading">Calculando estadísticas...</div>
    `;
    return;
  }

  if (!alcanceDatosActual) {
    alcanceDatosActual = obtenerAlcanceDatosInicial();
  }

  const partidos = obtenerPartidosParaDatos();
  const estadisticas = calcularEstadisticasDatos();

  if (partidos.length === 0 || estadisticas.length === 0) {
    cont.innerHTML = `
      <div class="datos-empty">
        Todavía no hay resultados para ${etiquetaAlcanceDatos(
          alcanceDatosActual
        ).toLowerCase()}.
      </div>
    `;
    return;
  }

  cont.innerHTML = `
    <div class="datos-scope" role="group" aria-label="Alcance de las estadísticas">
      ${["regular", "playoffs", "completo"].map(alcance => `
        <button
          type="button"
          class="${alcance === alcanceDatosActual ? "on" : ""}"
          onclick="actualizarAlcanceDatos('${alcance}')"
        >
          ${etiquetaAlcanceDatos(alcance)}
        </button>
      `).join("")}
    </div>

    <section class="datos-block">
      <div class="datos-block-head">
        <div>
          <span>Líderes</span>
          <h2>${etiquetaAlcanceDatos(alcanceDatosActual)}</h2>
        </div>
        <small>${partidos.length} partidos jugados</small>
      </div>
      <p class="datos-method-note">
        ${descripcionAlcanceDatos(alcanceDatosActual)}
      </p>
      ${renderLideresDatos(estadisticas)}
    </section>

    ${renderComparadorDatos(estadisticas)}
  `;
}

function actualizarAlcanceDatos(alcance) {
  if (!["regular", "playoffs", "completo"].includes(alcance)) return;
  alcanceDatosActual = alcance;
  renderDatos();
}

function actualizarEquipoComparadorDatos(lado, equipo) {
  if (!["equipoA", "equipoB"].includes(lado)) return;
  equiposComparadorDatos[lado] = equipo;
  renderDatos();
}

function renderTeams() {
  const cont = document.getElementById('teamsContent');
  const countLabel = document.getElementById('teamsCountLabel');
  if (!cont) return;

  if (errorCargaDatos && state.partidos.length === 0) {
    if (countLabel) countLabel.textContent = "Clubes";
    cont.innerHTML = renderEstadoVista(
      "error",
      "No pudimos cargar los equipos",
      obtenerMensajeErrorCargaDatos("Revisá tu conexión e intentá nuevamente."),
      true
    );
    return;
  }

  if (!cargaPartidosFinalizada) {
    if (countLabel) countLabel.textContent = "Clubes";
    cont.innerHTML = renderEstadoVista(
      "cargando",
      "Cargando equipos",
      "Estamos preparando la información de los clubes."
    );
    return;
  }

  const derivados = obtenerParticipantesRegularesTorneo();
  const equiposBase =
    derivados.regularMatches.length > 0 && window.TPPublicTournament
      ? window.TPPublicTournament.buildTeamList(derivados)
      : obtenerZonasLegacy().flatMap(zona =>
          obtenerEquiposZonaLegacy(zona).map(equipo => ({ equipo, zona }))
        );
  const tablasPorZona = new Map(
    obtenerZonasTorneo().map(zona => [
      zona,
      new Map(calcularTablaZona(zona).map(fila => [fila.equipo, fila]))
    ])
  );
  const equiposLiga = equiposBase
    .map(({ equipo, zona }) => ({
      equipo,
      zona,
      stats: tablasPorZona.get(zona)?.get(equipo)
    }))
    .sort((a, b) =>
      nombre(a.equipo).localeCompare(
        nombre(b.equipo),
        "es",
        { sensitivity: "base" }
      )
    );

  if (equiposLiga.length === 0) {
    if (countLabel) countLabel.textContent = "0 clubes";
    cont.innerHTML = renderEstadoVista(
      "vacio",
      "Sin equipos",
      "Todavía no hay clubes disponibles para este torneo."
    );
    return;
  }

  if (countLabel) {
    countLabel.textContent =
      `${equiposLiga.length} ${equiposLiga.length === 1 ? "club" : "clubes"}`;
  }

  cont.innerHTML = equiposLiga
    .map(({ equipo, zona, stats }) => {
      const nombreEquipo = nombre(equipo);
      const club = obtenerClub(equipo);
      const escudo = obtenerEscudoEquipo(equipo, club?.id);
      const escudoEquipo = escudo
        ? `<img src="${escudo}" alt="Escudo de ${nombreEquipo}" width="72" height="72" loading="lazy" decoding="async">`
        : nombreEquipo.slice(0, 2).toUpperCase();
      const puntos = state.partidos.length > 0
        ? ` · ${stats?.pts || 0} pts`
        : "";

      return `
        <button
          type="button"
          class="team-card"
          onclick='abrirEquipo(${JSON.stringify(equipo)})'
          aria-label="Ver información de ${nombreEquipo}"
        >
          <div class="tc-shield">${escudoEquipo}</div>
          <div class="tc-name">${nombreEquipo}</div>
          ${club?.ciudad
            ? `<div class="tc-city">${escaparHtml(club.ciudad)}</div>`
            : ""}
          <div class="tc-pts">Zona ${zona}${puntos}</div>
          <span class="tc-chev" aria-hidden="true">›</span>
        </button>
      `;
    })
    .join("");
}

document.getElementById('btnPrev').disabled = true;
document.getElementById('btnNext').disabled = true;

actualizarFechaPie();
renderMatches();
renderTabla(1);
renderInicio();
renderPlayoffs();
renderDatos();
renderTeams();

if (window.history.state?.tresPalos) {
  restaurarVistaDesdeHistorial(window.history.state.vista);
} else {
  mostrarVista(vistaActual.id);
  guardarVistaEnHistorial(true);
  registrarVistaPestana(vistaActual.id, "carga");
}

function crearErrorTorneoPublicoInvalido() {
  const error = new Error(MENSAJE_TORNEO_PUBLICO_INVALIDO);
  error.code = "TORNEO_PUBLICO_INVALIDO";
  return error;
}

async function obtenerPartidos() {
  if (actualizandoDatos) return;
  actualizandoDatos = true;

  try {
    const headers = {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`
    };
    const resTorneos = await fetch(
      `${SUPABASE_URL}/rest/v1/torneos?select=*&order=anio.desc,tipo.desc`,
      { headers }
    );
    const torneos = resTorneos.ok
      ? await resTorneos.json()
      : state.torneos;
    const torneoVigente = obtenerTorneoActivo(torneos);
    const torneoSeleccionado = obtenerTorneoSeleccionado(
      torneos,
      torneoVigente
    );
    const torneoIdPublico = torneoSeleccionado?.id;
    if (!torneoIdPublico) {
      throw crearErrorTorneoPublicoInvalido();
    }

    const torneoIdPublicoParam = encodeURIComponent(torneoIdPublico);
    const filtroTorneoActual = `&torneo_id=eq.${torneoIdPublicoParam}`;
    const urlGoleadores =
      `/.netlify/functions/goleadores-publicos?torneo_id=${torneoIdPublicoParam}`;
    const [
      res,
      resPartidosTodos,
      resEventos,
      resClubes,
      resGoleadores
    ] = await Promise.all([
      fetch(
        `${SUPABASE_URL}/rest/v1/partidos?select=*${filtroTorneoActual}&order=id.asc`,
        { headers }
      ),
      fetch(
        `${SUPABASE_URL}/rest/v1/partidos?select=*&order=id.asc`,
        { headers }
      ),
      fetch(
        `${SUPABASE_URL}/rest/v1/eventos_partido_publicos?select=${EVENTOS_PUBLICOS_SELECT}&order=id.asc`,
        { headers }
      ),
      fetch(
        `${SUPABASE_URL}/rest/v1/clubes?select=*&order=zona.asc,nombre_corto.asc`,
        { headers }
      ),
      urlGoleadores ? fetch(urlGoleadores) : Promise.resolve(null)
    ]);

    if (!res.ok) {
      throw new Error(`Supabase respondió con estado ${res.status}`);
    }

    const data = await res.json();
    const dataTodos = resPartidosTodos.ok
      ? await resPartidosTodos.json()
      : data;

    if (!Array.isArray(data)) {
      throw new Error("La respuesta de partidos no tiene el formato esperado");
    }
    if (!Array.isArray(dataTodos)) {
      throw new Error(
        "La respuesta de partidos historicos no tiene el formato esperado"
      );
    }

    const eventos = resEventos.ok
      ? await resEventos.json()
      : state.eventosTodos;
    const goleadoresTabla = resGoleadores?.ok
      ? normalizarRespuestaGoleadoresTabla(await resGoleadores.json())
      : crearTablaGoleadoresVacia();

    cargaPartidosFinalizada = true;
    errorCargaDatos = false;
    mensajeErrorCargaDatos = "";
    ultimaCargaDatos = Date.now();
    state.torneos = Array.isArray(torneos) ? torneos : state.torneos;
    state.torneoVigente = torneoVigente;
    state.partidosTodos = dataTodos;
    state.eventosTodos = Array.isArray(eventos) ? eventos : [];
    state.goleadoresTabla = goleadoresTabla;
    state.errorGoleadoresTabla = Boolean(resGoleadores && !resGoleadores.ok);
    state.goleadoresOficialesTodos = [];
    aplicarDatosTorneo(torneoSeleccionado);
    if (resClubes.ok) {
      aplicarClubes(await resClubes.json());
    }

    if (!resEventos.ok) {
      console.warn(
        `No se pudieron cargar las incidencias: ${resEventos.status}`
      );
    }
    if (!resPartidosTodos.ok) {
      console.warn(
        `No se pudieron cargar los partidos historicos: ${resPartidosTodos.status}. ` +
        "El historial queda limitado al torneo actual."
      );
    }
    if (!resClubes.ok) {
      console.warn(
        `No se pudieron cargar los clubes: ${resClubes.status}. ` +
        "Se usan los datos locales."
      );
    }
    if (!resTorneos.ok) {
      console.warn(
        `No se pudieron cargar los torneos: ${resTorneos.status}. ` +
        "Se conserva el torneo publico previamente determinado."
      );
    }
    if (resGoleadores && !resGoleadores.ok) {
      console.warn(
        `No se pudieron cargar los goleadores publicos: ${resGoleadores.status}.`
      );
    }

    actualizarNavegacionEtapas();
    renderMatches();
    renderTabla(zonaActual);
    renderInicio();
    renderPlayoffs();
    renderDatos();
    renderTeams();

    if (vistaActual.id === "partido") {
      renderDetallePartido(vistaActual.partidoId);
    }
    if (vistaActual.id === "equipo") {
      renderDetalleEquipo(vistaActual.equipo);
    }
  } catch (error) {
    console.error("No se pudieron cargar los partidos:", error);

    if (
      state.partidos.length > 0 &&
      error.code !== "TORNEO_PUBLICO_INVALIDO"
    ) {
      return;
    }

    cargaPartidosFinalizada = true;
    errorCargaDatos = true;
    mensajeErrorCargaDatos = error.code === "TORNEO_PUBLICO_INVALIDO"
      ? MENSAJE_TORNEO_PUBLICO_INVALIDO
      : "";
    state.partidos = [];
    state.partidosTodos = [];
    state.eventos = [];
    state.eventosTodos = [];
    state.goleadoresOficiales = [];
    state.goleadoresOficialesTodos = [];
    state.goleadoresTabla = crearTablaGoleadoresVacia();
    state.errorGoleadoresTabla = true;
    etapaActual = null;
    actualizarNavegacionEtapas();
    renderMatches();
    renderTabla(zonaActual);
    renderInicio();
    renderPlayoffs();
    renderDatos();
    renderTeams();
  } finally {
    actualizandoDatos = false;
  }
}

obtenerPartidos();

setInterval(() => {
  if (document.hidden) return;

  if (state.partidos.length > 0) {
    actualizarNavegacionEtapas();
    renderMatches();
    renderInicio();
    renderDatos();

    if (vistaActual.id === "partido") {
      renderDetallePartido(vistaActual.partidoId);
    }
  }

  obtenerPartidos();
}, 60000);

document.addEventListener("visibilitychange", () => {
  if (
    !document.hidden &&
    Date.now() - ultimaCargaDatos >= 60000
  ) {
    obtenerPartidos();
  }
});
