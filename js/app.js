let etapaActual = null;
let zonaActual = 1;
let vistaActual = { id: "inicio", navId: "inicio" };
let actualizandoDatos = false;
let cargaPartidosFinalizada = false;

const VISTAS_PRINCIPALES = [
  "inicio",
  "partidos",
  "tabla",
  "playoffs",
  "goleadores",
  "equipos"
];

const FASES_PLAYOFF = [
  { valor: "octavos", etiqueta: "Octavos de Final" },
  { valor: "cuartos", etiqueta: "Cuartos de Final" },
  { valor: "semifinal", etiqueta: "Semifinales" },
  { valor: "final", etiqueta: "Final" }
];

const ESTADOS_DATO = {
  confirmar: "A confirmar",
  sinDatos: "Sin datos",
  sinIdentificar: "Sin identificar"
};

function mostrarVista(id) {
  document.body.classList.toggle(
    "detail-mode",
    !VISTAS_PRINCIPALES.includes(id)
  );
  document.querySelectorAll('.tab-content').forEach(p => p.classList.remove('on'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('on'));
  document.querySelectorAll('.bn-item').forEach(t => t.classList.remove('on'));
  document.querySelectorAll('.sb-link').forEach(t => t.classList.remove('on'));

  const target = document.getElementById('tab-' + id);
  if (target) target.classList.add('on');

  const vistaNavegacion = vistaActual.navId ||
    (VISTAS_PRINCIPALES.includes(id) ? id : null);

  document.querySelectorAll(`[data-tab="${vistaNavegacion}"]`).forEach(t => t.classList.add('on'));
  document.querySelectorAll('.bn-item').forEach(t => {
    if (
      vistaNavegacion &&
      t.getAttribute('onclick') &&
      t.getAttribute('onclick').includes(`'${vistaNavegacion}'`)
    ) {
      t.classList.add('on');
    }
  });
  document.querySelectorAll('.sb-link').forEach(t => {
    if (
      vistaNavegacion &&
      t.getAttribute('onclick') &&
      t.getAttribute('onclick').includes(`'${vistaNavegacion}'`)
    ) {
      t.classList.add('on');
    }
  });

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function switchTab(id) {
  vistaActual = { id, navId: id };
  mostrarVista(id);
  guardarVistaEnHistorial();
  registrarVistaPestana(id);
}

function abrirPartido(id) {
  const partido = state.partidos.find(
    item => String(item.id) === String(id)
  );
  if (!partido) return;
  const origen = vistaActual.navId || "partidos";

  vistaActual = {
    id: "partido",
    partidoId: partido.id,
    navId: origen
  };
  renderDetallePartido(partido.id);
  mostrarVista("partido");
  guardarVistaEnHistorial();
  registrarVistaPartido(partido.id, origen);
}

function abrirEquipo(equipo) {
  if (!equipo) return;

  vistaActual = {
    id: "equipo",
    equipo,
    navId: vistaActual.navId || "equipos"
  };
  renderDetalleEquipo(equipo);
  mostrarVista("equipo");
  guardarVistaEnHistorial();
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
      vista: { ...vistaActual }
    },
    "",
    window.location.href
  );
}

function restaurarVistaDesdeHistorial(vista) {
  if (!vista?.id) return;

  vistaActual = vista;

  if (vista.id === "partido") {
    renderDetallePartido(vista.partidoId);
  }
  if (vista.id === "equipo") {
    renderDetalleEquipo(vista.equipo);
  }

  mostrarVista(vista.id);

  if (VISTAS_PRINCIPALES.includes(vista.id)) {
    registrarVistaPestana(vista.id, "historial");
  }
  if (vista.id === "partido" && vista.partidoId) {
    registrarVistaPartido(
      vista.partidoId,
      vista.navId || "partidos"
    );
  }
}

document.querySelectorAll('.tab').forEach(t => {
  t.addEventListener('click', () => switchTab(t.dataset.tab));
});

window.addEventListener("popstate", event => {
  if (!event.state?.tresPalos) return;
  restaurarVistaDesdeHistorial(event.state.vista);
});

function renderMatches() {
  const cont = document.getElementById("matchContent");
  if (!cont) return;

  if (!cargaPartidosFinalizada) {
    cont.innerHTML = renderSkeletonPartidos();
    return;
  }

  const etapa = obtenerEtapasDisponibles().find(
    item => item.clave === etapaActual
  );

  if (!etapa) {
    cont.innerHTML = `
      <div style="padding:2rem;text-align:center;color:var(--muted)">
        Sin datos para esta etapa
      </div>
    `;
    return;
  }

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
          <div class="zona-count">${equiposPorZona[numeroZona].length} equipos</div>
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

  cont.innerHTML = html;
}

function obtenerEquipoLibre(zona, partidos) {
  const participantes = new Set(
    partidos.flatMap(p => [p.local, p.visitante])
  );

  return (equiposPorZona[zona] || []).find(
    equipo => !participantes.has(equipo)
  ) || null;
}

function renderEquipoLibre(equipo) {
  const nombreEquipo = nombre(equipo);
  const escudoEquipo = escudos[equipo]
    ? `<img src="${escudos[equipo]}" alt="${nombreEquipo}">`
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
    cont.innerHTML = `
      <div style="padding:2rem;text-align:center;color:var(--muted)">
        Sin partidos para esta fase
      </div>
    `;
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
      aria-label="Ver ${nombre(p.local)} contra ${nombre(p.visitante)}"
    >
      ${renderEquipoPartido(p.local, visitanteGano)}
      ${center}
      ${renderEquipoPartido(p.visitante, localGano, true)}

      <div class="mr-chev">›</div>
    </button>
  `;
}

function renderEquipoPartido(equipo, perdio, visitante = false) {
  const nombreEquipo = equipo ? nombre(equipo) : "Por definir";
  const escudo = equipo && escudos[equipo]
    ? `<img src="${escudos[equipo]}" alt="${nombreEquipo}">`
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
  const valor = String(partido.estado || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

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

function obtenerEstadoTorneo(ahora = new Date()) {
  const faseActual = obtenerFaseActualPlayoffs();
  const fase = FASES_PLAYOFF.find(
    item => item.valor === faseActual
  );
  const final = state.partidos
    .filter(
      partido =>
        partido.tipo === "playoff" &&
        partido.fase === "final"
    )
    .map(resolverPartidoPlayoff)
    .find(partido => obtenerGanadorPlayoff(partido));

  if (final) {
    const ladoGanador = obtenerGanadorPlayoff(final);
    const campeon = ladoGanador ? final[ladoGanador] : null;

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

function obtenerPartidosRegularesVigentes() {
  const fechasPendientes = state.partidos
    .filter(
      partido =>
        partido.tipo === "regular" &&
        (
          partido.goles_local === null ||
          partido.goles_visitante === null
        )
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
  return partido.estadio ||
    partido.cancha ||
    partido.sede ||
    ESTADOS_DATO.confirmar;
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

function calcularTablaZona(zona) {
  const equiposZona = equiposPorZona[zona] || [];
  const tabla = Object.fromEntries(
    equiposZona.map(equipo => [
      equipo,
      {
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
      }
    ])
  );

  const partidos = state.partidos
    .filter(
      p =>
        p.tipo === "regular" &&
        Number(p.zona) === Number(zona)
    )
    .sort(
      (a, b) =>
        Number(a.fecha || 0) - Number(b.fecha || 0) ||
        Number(a.id || 0) - Number(b.id || 0)
    );

  partidos.forEach(p => {
    if (!tabla[p.local]) tabla[p.local] = crearFilaTabla(p.local);
    if (!tabla[p.visitante]) tabla[p.visitante] = crearFilaTabla(p.visitante);

    if (
      p.goles_local === null ||
      p.goles_visitante === null
    ) {
      return;
    }

    const golesLocal = Number(p.goles_local);
    const golesVisitante = Number(p.goles_visitante);
    if (!Number.isFinite(golesLocal) || !Number.isFinite(golesVisitante)) return;

    const local = tabla[p.local];
    const visitante = tabla[p.visitante];

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
    .sort(
      (a, b) =>
        b.pts - a.pts ||
        b.dg - a.dg ||
        b.gf - a.gf ||
        nombre(a.equipo).localeCompare(nombre(b.equipo), "es")
    );
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

  const partidoResuelto = {
    ...partido,
    local: resolverEquipoPlayoff(partido, "local"),
    visitante: resolverEquipoPlayoff(partido, "visitante")
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
        partido.tipo === "playoff" &&
        !jugado &&
        Boolean(partido.local || partido.visitante) &&
        !Boolean(partido.local && partido.visitante)
    };
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
  const fases = [
    {
      valor: "final",
      pendiente: "Clasificado a la final",
      eliminado: "Subcampeón"
    },
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

function obtenerAnioPlayoffs() {
  const fecha = state.partidos.find(
    p => p.tipo === "playoff" && p.fecha_partido
  )?.fecha_partido;

  return fecha?.split("-")[0] || new Date().getFullYear();
}

function obtenerAgendaInicio() {
  const faseActual = obtenerFaseActualPlayoffs();
  const fase = FASES_PLAYOFF.find(
    item => item.valor === faseActual
  );

  if (!fase) {
    return { fase: null, partidos: [], pendientes: false };
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
      fase,
      partidos: pendientes.slice(0, 4),
      pendientes: true
    };
  }

  return {
    fase,
    partidos: partidosFase.slice(-4).reverse(),
    pendientes: false
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

function renderInicio() {
  const cont = document.getElementById("homeContent");
  const contVivo = document.getElementById("homeLiveContent");
  if (!cont) return;

  if (!cargaPartidosFinalizada) {
    cont.innerHTML = renderSkeletonAgenda();
    if (contVivo) contVivo.innerHTML = "";
    return;
  }

  const agenda = obtenerAgendaInicio();
  const estadoTorneo = obtenerEstadoTorneo();
  actualizarResumenTorneo(agenda);

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

  cont.innerHTML = `
    <div class="next-card home-agenda">
      <div class="nc-top">
        <div class="nc-badge state-${estadoTorneo.clase}">
          ${estadoTorneo.animado ? `<span class="nc-pulse"></span>` : ""}
          ${estadoTorneo.agenda}
        </div>
        <div class="nc-round">${agenda.fase.etiqueta}</div>
      </div>

      <div class="home-match-list">
        ${agenda.partidos.map(partido =>
          renderPartidoInicio(partido)
        ).join("")}
      </div>

      <div class="nc-footer">
        <div class="nc-footer-label">
          ${agenda.partidos.length}
          ${agenda.partidos.length === 1 ? "partido" : "partidos"}
        </div>
        <button
          class="nc-footer-link"
          onclick="abrirEtapaPartidos('fase:${agenda.fase.valor}')"
        >
          Ver fase completa →
        </button>
      </div>
    </div>
  `;

  renderPulsoInicio();
}

function actualizarResumenTorneo(agenda) {
  const etiquetaFase = agenda.fase?.etiqueta || "Fase eliminatoria";
  const anio = obtenerAnioPlayoffs();
  const estadoTorneo = obtenerEstadoTorneo();
  const equipos = new Set(
    agenda.partidos.flatMap(p => [p.local, p.visitante]).filter(Boolean)
  );

  document.getElementById("heroLabel").textContent =
    `Liga Cañadense · ${etiquetaFase} · ${anio}`;
  const heroTitle = document.getElementById("heroTitle");
  if (heroTitle) {
    heroTitle.innerHTML = obtenerTituloHeroInicio(agenda.fase?.valor);
  }
  const heroState = document.getElementById("heroState");
  const heroStateText = document.getElementById("heroStateText");
  if (heroState) {
    heroState.className = `hero-state ${estadoTorneo.clase}`;
  }
  if (heroStateText) {
    heroStateText.textContent = estadoTorneo.etiqueta;
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
  actualizarPieTorneo(etiquetaFase, anio);
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

  if (torneo) torneo.textContent = `Liga Cañadense ${anio}`;
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

function renderPartidoInicio(partido) {
  const jugado =
    partido.goles_local !== null &&
    partido.goles_visitante !== null;
  const estado = obtenerEstadoTemporalPartido(partido);
  const centro = jugado
    ? `${partido.goles_local} - ${partido.goles_visitante}`
    : renderMomentoPartido(partido, estado, "home-moment");

  return `
    <button
      type="button"
      class="home-match-row ${estado.clase}"
      onclick="abrirPartido(${JSON.stringify(partido.id)})"
      aria-label="Ver ${nombre(partido.local)} contra ${nombre(partido.visitante)}"
    >
      <div class="home-match-primary">
        <div class="home-team local">
          <span>${nombre(partido.local)}</span>
          ${renderEscudoInicio(partido.local)}
        </div>
        <div class="home-match-center">
          ${jugado ? `<strong>${centro}</strong>` : centro}
          <small>
            ${estado.tipo === "penales"
              ? "Penales"
              : `Llave ${partido.numero_playoff || 1}`}
          </small>
        </div>
        <div class="home-team away">
          ${renderEscudoInicio(partido.visitante)}
          <span>${nombre(partido.visitante)}</span>
        </div>
      </div>
      <div class="home-match-insights">
        <span class="home-match-form">
          <b>Forma</b>
          ${renderFormaCompactaInicio(partido.local)}
          <i>·</i>
          ${renderFormaCompactaInicio(partido.visitante)}
        </span>
        <span class="home-match-history">
          ${resumirAntecedenteInicio(partido)}
        </span>
      </div>
    </button>
  `;
}

function renderFormaCompactaInicio(equipo) {
  const forma = obtenerFormaReciente(equipo, 5);

  if (forma.length === 0) {
    return `<span class="home-form-empty">${ESTADOS_DATO.sinDatos}</span>`;
  }

  const etiquetas = {
    G: "Victoria",
    E: "Empate",
    P: "Derrota"
  };

  return `
    <span
      class="home-form-dots"
      aria-label="${nombre(equipo)}: ${forma.map(item => etiquetas[item.resultado]).join(", ")}"
    >
      ${forma.map(item => `
        <i
          class="form-${item.resultado.toLowerCase()}"
          title="${etiquetas[item.resultado]}"
          aria-hidden="true"
        ></i>
      `).join("")}
    </span>
  `;
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

function renderEscudoInicio(equipo) {
  const nombreEquipo = nombre(equipo);
  const contenido = escudos[equipo]
    ? `<img src="${escudos[equipo]}" alt="${nombreEquipo}">`
    : nombreEquipo.slice(0, 2).toUpperCase();

  return `<div class="home-shield">${contenido}</div>`;
}

function renderPulsoInicio() {
  const cont = document.getElementById("homeLiveContent");
  if (!cont) return;

  const faseActual = obtenerFaseActualPlayoffs();
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
  const analisis = generarAnalisisPulso(
    partidosFase,
    protagonistas,
    faseActual
  );

  cont.innerHTML = `
    <div class="home-live">
      ${renderSeccionPulso(
        "Lectura de los datos",
        fase.etiqueta,
        `
          <article class="home-live__note">
            <div class="home-live__note-eyebrow">
              Las claves de la etapa actual
            </div>
            <h3 class="home-live__note-title">
              ${analisis.titulo}
            </h3>
            <div class="home-live__note-copy">
              ${analisis.parrafos.map(parrafo =>
                `<p>${parrafo}</p>`
              ).join("")}
            </div>
          </article>
        `
      )}

      ${renderSeccionPulso(
        "Cómo llegan",
        `Playoffs ${anio}`,
        `
          <div class="home-live__arrival-grid">
            ${protagonistas.map(equipo =>
              renderLlegadaPulso(
                equipo,
                protagonistas,
                faseActual
              )
            ).join("")}
          </div>
        `
      )}

      ${renderSeccionGoleadoresPulso()}
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

function renderEscudoPulso(equipo) {
  const contenido = escudos[equipo]
    ? `<img src="${escudos[equipo]}" alt="${nombre(equipo)}">`
    : `<span>${nombre(equipo).slice(0, 2).toUpperCase()}</span>`;

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

function obtenerAntecedentesRegulares(equipoA, equipoB) {
  const partidos = state.partidos
    .filter(partido => {
      if (
        partido.tipo !== "regular" ||
        partido.goles_local === null ||
        partido.goles_visitante === null
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
  const fechaA = a.fecha_partido || "0000-00-00";
  const fechaB = b.fecha_partido || "0000-00-00";
  const porFecha = fechaA.localeCompare(fechaB);

  if (porFecha !== 0) return porFecha;

  const fechaTorneoA = Number(a.fecha || 0);
  const fechaTorneoB = Number(b.fecha || 0);
  return fechaTorneoA - fechaTorneoB ||
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
    return partido.hora || ESTADOS_DATO.confirmar;
  }

  const [, mes, dia] = partido.fecha_partido.split("-").map(Number);
  const meses = [
    "ene", "feb", "mar", "abr", "may", "jun",
    "jul", "ago", "sep", "oct", "nov", "dic"
  ];

  return `${dia} ${meses[mes - 1]} · ${partido.hora || ESTADOS_DATO.confirmar}`;
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
    partido => partido.estadio || partido.cancha || partido.sede
  );
  const arbitro = obtenerValorComunPulso(
    partidos,
    partido => partido.arbitro || partido.arbitro_principal
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

function obtenerValorComunPulso(partidos, obtenerValor) {
  const valores = partidos
    .map(obtenerValor)
    .filter(Boolean);

  if (valores.length === 0) return ESTADOS_DATO.confirmar;

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
    .toLowerCase();

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

function renderSeccionGoleadoresPulso() {
  const goleadores = obtenerGoleadoresReales().slice(0, 5);
  const listado = goleadores.length > 0
    ? renderGoleadoresPulso(goleadores)
    : renderFaltantePulso(
        "Sin datos de goleadores",
        "No hay eventos de gol con jugador identificado."
      );

  return renderSeccionPulso(
    "Goleadores registrados",
    "Top 5",
    `
      ${listado}
      <button
        type="button"
        class="home-live__section-link"
        onclick="switchTab('goleadores')"
      >
        Ver tabla completa →
      </button>
    `
  );
}

function renderGoleadoresPulso(goleadores) {
  return `
    <div class="home-live__scorers">
      ${goleadores.map(goleador => `
        <div class="home-live__scorer">
          <span class="${goleador.posicion <= 2 ? "top" : ""}">
            ${goleador.posicion}
          </span>
          <div>
            <strong>${escaparHtml(goleador.jugador)}</strong>
            <small class="${obtenerEstadoDato(goleador.club) ? "data-incomplete" : ""}">
              ${escaparHtml(goleador.club)}
            </small>
          </div>
          <b class="${goleador.posicion === 1 ? "leader" : ""}">
            ${goleador.goles}<small>gol</small>
          </b>
        </div>
      `).join("")}
    </div>
  `;
}

function renderFaltantePulso(titulo, detalle) {
  return `
    <div class="home-live__missing" role="status">
      <strong>${titulo}</strong>
      <span>${detalle}</span>
    </div>
  `;
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

  if (!cargaPartidosFinalizada) {
    cont.innerHTML = renderSkeletonPlayoffs();
    return;
  }

  if (state.partidos.length === 0) {
    cont.innerHTML = `
      <div style="padding:2rem;text-align:center;color:var(--muted)">
        No hay datos de playoffs disponibles
      </div>
    `;
    return;
  }

  const directos = obtenerClasificadosDirectos();
  const faseActual = obtenerFaseActualPlayoffs();

  cont.innerHTML = `
    <div class="po-banner">
      <div class="po-banner-icon">🏆</div>
      <div class="po-banner-title">Playoffs ${obtenerAnioPlayoffs()}</div>
      <div class="po-banner-sub">Liga Cañadense · Primera División</div>
    </div>

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

    ${FASES_PLAYOFF.map(fase =>
      renderFasePlayoff(fase, faseActual)
    ).join("")}
  `;
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
  const partidos = state.partidos
    .filter(
      p =>
        p.tipo === "playoff" &&
        p.fase === fase.valor
    )
    .sort(
      (a, b) =>
        Number(a.numero_playoff || 0) -
        Number(b.numero_playoff || 0)
    );

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
      <div class="po-bracket">
        ${partidos.map(partido =>
          renderCrucePlayoff(partido)
        ).join("")}
      </div>
    </section>
  `;
}

function obtenerEstadoFasePlayoff(partidos, esActual) {
  const resueltos = partidos.map(resolverPartidoPlayoff);
  const terminada = resueltos.every(
    partido => obtenerGanadorPlayoff(partido)
  );

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
          ${codigoFase} · ${partido.numero_playoff || 1}
          ${detalle ? `<span>${detalle}</span>` : ""}
        </div>
        <div class="po-st state-${estadoTemporal.clase} ${jugado && estadoTemporal.tipo === "final" ? "done" : ""}">
          ${estado}
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

function renderEscudoPlayoff(equipo, clase) {
  const nombreEquipo = nombre(equipo);
  const contenido = escudos[equipo]
    ? `<img src="${escudos[equipo]}" alt="${nombreEquipo}">`
    : nombreEquipo.slice(0, 2).toUpperCase();

  return `<div class="${clase}">${contenido}</div>`;
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

function renderTabla(zona) {
  const cont = document.getElementById('tablaContent');

  if (!cargaPartidosFinalizada) {
    cont.innerHTML = renderSkeletonTabla();
    return;
  }

  if (state.partidos.length === 0) {
    cont.innerHTML = `
      <div style="padding:2rem;text-align:center;color:var(--muted)">
        No hay datos de tabla disponibles
      </div>
    `;
    return;
  }

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
            <th>Forma</th>
          </tr>
        </thead>
        <tbody>
  `;

  data.forEach((t, i) => {
    const dots = t.forma
      .map(f => `<span class="fd f${f}"></span>`)
      .join('');
    const nombreEquipo = nombre(t.equipo);
    const escudoEquipo = escudos[t.equipo]
      ? `<img src="${escudos[t.equipo]}" alt="${nombreEquipo}">`
      : nombreEquipo.slice(0, 2).toUpperCase();
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
        <td><div class="form-row">${dots}</div></td>
      </tr>
    `;
  });

  html += '</tbody></table></div>';
  cont.innerHTML = html;
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

document.querySelectorAll('.zt').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.zt').forEach(x => x.classList.remove('on'));
    btn.classList.add('on');
    zonaActual = parseInt(btn.dataset.zona, 10);
    renderTabla(zonaActual);
  });
});

function renderDetallePartido(id) {
  const cont = document.getElementById("matchDetail");
  const partidoBase = state.partidos.find(
    item => String(item.id) === String(id)
  );

  if (!partidoBase) {
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
  const eventos = state.eventos
    .filter(evento => String(evento.partido_id) === String(partido.id))
    .sort(
      (a, b) =>
        Number(a.minuto || 0) - Number(b.minuto || 0)
    );
  const contexto = partido.tipo === "playoff"
    ? `${etiquetaFase(partido.fase)} · Llave ${partido.numero_playoff || 1}`
    : `Fecha ${partido.fecha} · Zona ${partido.zona}`;
  const estado = obtenerEstadoTemporalPartido(partido);

  cont.innerHTML = `
    <div class="detail-topbar">
      <button type="button" class="detail-back" onclick="volverDetalle()">
        ← Volver
      </button>
      <span class="detail-context">${contexto}</span>
    </div>

    <article class="match-detail-card">
      <div class="match-detail-status ${estado.clase}">
        ${["en-juego", "penales"].includes(estado.tipo)
          ? `<span class="live-indicator"></span>`
          : ""}
        ${estado.detalle}
      </div>

      <div class="match-detail-scoreboard">
        ${renderEquipoDetallePartido(partido.local)}

        <div class="match-detail-result">
          <strong>
            ${jugado
              ? `${partido.goles_local} - ${partido.goles_visitante}`
              : "VS"}
          </strong>
          ${tienePenales
            ? `<span>Penales ${partido.penales_local} - ${partido.penales_visitante}</span>`
            : ""}
        </div>

        ${renderEquipoDetallePartido(partido.visitante)}
      </div>

      <div class="match-detail-meta">
        ${renderValorDetalle(
          "Fecha",
          formatearFechaCompleta(partido.fecha_partido)
        )}
        ${renderValorDetalle(
          "Hora",
          partido.hora || ESTADOS_DATO.confirmar
        )}
        ${renderValorDetalle(
          "Estadio",
          obtenerEstadioPartido(partido)
        )}
        ${renderValorDetalle(
          "Árbitro",
          partido.arbitro ||
            partido.arbitro_principal ||
            ESTADOS_DATO.confirmar
        )}
      </div>
    </article>

    <section class="detail-section">
      <div class="detail-section-head">
        <h2>Incidencias</h2>
        <span>${eventos.length || "Sin"} registros</span>
      </div>
      ${eventos.length > 0
        ? `<div class="event-list">${eventos.map(evento =>
            renderEventoPartido(evento, partido)
          ).join("")}</div>`
        : `
          <div class="detail-empty">
            ${estado.tipo === "en-juego"
              ? "Sin datos de minuto a minuto. El estado en juego se estima por el horario."
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

function renderEquipoDetallePartido(equipo) {
  const nombreEquipo = equipo ? nombre(equipo) : "Por definir";
  const escudoEquipo = equipo && escudos[equipo]
    ? `<img src="${escudos[equipo]}" alt="${nombreEquipo}">`
    : `<span>${equipo ? nombreEquipo.slice(0, 2).toUpperCase() : "?"}</span>`;

  return `
    <button
      type="button"
      class="match-detail-team"
      ${equipo ? `onclick='abrirEquipo(${JSON.stringify(equipo)})'` : "disabled"}
    >
      <span class="match-detail-shield">${escudoEquipo}</span>
      <strong>${nombreEquipo}</strong>
      <small>${equipo || ""}</small>
    </button>
  `;
}

function renderEventoPartido(evento, partido) {
  const esLocal =
    String(evento.equipo_id) === String(partido.local_id);
  const tipo = normalizarTipoEvento(evento.tipo);
  const jugadorIdentificado = Boolean(evento.jugador);
  const jugador = evento.jugador ||
    `Jugador ${ESTADOS_DATO.sinIdentificar.toLowerCase()}`;
  const minuto = evento.minuto !== null && evento.minuto !== undefined
    ? `${evento.minuto}'`
    : "–";

  return `
    <div class="event-row ${esLocal ? "event-local" : "event-away"}">
      <span class="event-minute">${minuto}</span>
      <span class="event-mark event-${tipo}"></span>
      <div>
        <strong class="${jugadorIdentificado ? "" : "data-incomplete"}">
          ${jugador}
        </strong>
        <small>${etiquetaEvento(tipo)}</small>
      </div>
    </div>
  `;
}

function normalizarTipoEvento(tipo) {
  const valor = String(tipo || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (valor.includes("gol")) return "gol";
  if (valor.includes("amarilla")) return "amarilla";
  if (valor.includes("roja")) return "roja";
  if (valor.includes("cambio")) return "cambio";
  return "otro";
}

function etiquetaEvento(tipo) {
  return {
    gol: "Gol",
    amarilla: "Tarjeta amarilla",
    roja: "Tarjeta roja",
    cambio: "Cambio",
    otro: "Incidencia"
  }[tipo];
}

function etiquetaFase(fase) {
  return FASES_PLAYOFF.find(item => item.valor === fase)?.etiqueta ||
    "Playoffs";
}

function formatearFechaCompleta(fecha) {
  if (!fecha) return ESTADOS_DATO.confirmar;

  const [year, month, day] = fecha.split("-").map(Number);
  if (!year || !month || !day) return ESTADOS_DATO.confirmar;

  const meses = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
  ];

  return `${day} de ${meses[month - 1]} de ${year}`;
}

function renderDetalleEquipo(equipo) {
  const cont = document.getElementById("teamDetail");
  const zona = obtenerZonaEquipo(equipo);
  const club = obtenerClub(equipo);

  if (!zona) {
    cont.innerHTML = renderDetalleVacio("Equipo no encontrado");
    return;
  }

  const stats = calcularTablaZona(zona).find(
    fila => fila.equipo === equipo
  ) || {
    pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, pts: 0, forma: []
  };
  const partidosEquipo = state.partidos
    .map(resolverPartidoPlayoff)
    .filter(
      partido =>
        partido.local === equipo ||
        partido.visitante === equipo
    );
  const partidosJugados = partidosEquipo
    .filter(
      partido =>
        partido.goles_local !== null &&
        partido.goles_visitante !== null
    )
    .sort(ordenarPartidosRecientes);
  const jugados = partidosJugados.slice(0, 5);
  const actividadReciente = [
    ...partidosJugados,
    ...obtenerFechasLibresEquipo(equipo, zona)
  ]
    .sort(ordenarActividadReciente)
    .slice(0, 6);
  const proximo = partidosEquipo
    .filter(
      partido =>
        partido.goles_local === null ||
        partido.goles_visitante === null
    )
    .filter(
      partido =>
        !partido.fecha_partido ||
        diferenciaDiasConHoy(partido.fecha_partido) >= 0
    )
    .sort(ordenarPartidosProximos)[0];
  const nombreEquipo = nombre(equipo);
  const escudoEquipo = escudos[equipo]
    ? `<img src="${escudos[equipo]}" alt="${nombreEquipo}">`
    : nombreEquipo.slice(0, 2).toUpperCase();
  const estadoPlayoff = obtenerEstadoPlayoffEquipo(equipo);
  const identidad = [
    club?.ciudad,
    club?.apodo ? `Apodo: ${club.apodo}` : null
  ].filter(Boolean).join(" · ");

  cont.innerHTML = `
    <div class="detail-topbar">
      <button type="button" class="detail-back" onclick="volverDetalle()">
        ← Volver
      </button>
      <span class="detail-context">Zona ${zona}</span>
    </div>

    <article class="team-detail-card">
      <div class="team-detail-head">
        <div class="team-detail-shield">${escudoEquipo}</div>
        <div>
          <span>Zona ${zona} · ${stats.pts} puntos</span>
          <h1>${nombreEquipo}</h1>
          <p>${equipo}</p>
          ${identidad
            ? `<div class="team-detail-origin">${escaparHtml(identidad)}</div>`
            : ""}
          ${estadoPlayoff
            ? `<div class="team-stage-badge ${estadoPlayoff.clase}">
                ${estadoPlayoff.texto}
              </div>`
            : ""}
        </div>
      </div>

      <div class="team-stats-caption">
        <span>Estadísticas</span>
        <strong>Fase regular</strong>
      </div>
      <div class="team-detail-stats">
        ${renderStatEquipo("PJ", stats.pj)}
        ${renderStatEquipo("PG", stats.pg)}
        ${renderStatEquipo("PE", stats.pe)}
        ${renderStatEquipo("PP", stats.pp)}
        ${renderStatEquipo("GF", stats.gf)}
        ${renderStatEquipo("GC", stats.gc)}
      </div>
    </article>

    <section class="detail-section">
      <div class="detail-section-head">
        <h2>Actividad reciente</h2>
        ${renderFormaEquipo(jugados, equipo)}
      </div>
      ${actividadReciente.length > 0
        ? `<div class="team-match-list">${actividadReciente.map(actividad =>
            actividad.tipoActividad === "libre"
              ? renderActividadLibre(actividad, equipo)
              : renderMiniPartido(actividad, equipo)
          ).join("")}</div>`
        : `<div class="detail-empty">Sin datos de actividad cargados.</div>`
      }
    </section>

    <section class="detail-section">
      <div class="detail-section-head">
        <h2>Próximo partido</h2>
      </div>
      ${proximo
        ? renderProximoPartidoEquipo(proximo, equipo)
        : `<div class="detail-empty">Próximo partido: ${ESTADOS_DATO.confirmar}.</div>`
      }
    </section>
  `;
}

function renderStatEquipo(etiqueta, valor) {
  return `
    <div>
      <span>${etiqueta}</span>
      <strong>${valor}</strong>
    </div>
  `;
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

  if (
    partido.penales_local !== null &&
    partido.penales_visitante !== null
  ) {
    const penalesFavor = esLocal
      ? partido.penales_local
      : partido.penales_visitante;
    const penalesContra = esLocal
      ? partido.penales_visitante
      : partido.penales_local;
    return penalesFavor > penalesContra ? "G" : "P";
  }

  return "E";
}

function renderMiniPartido(partido, equipo, proximo = false) {
  const jugado =
    partido.goles_local !== null &&
    partido.goles_visitante !== null;
  const centro = jugado
    ? `${partido.goles_local} - ${partido.goles_visitante}`
    : formatearMomentoPartido(partido);
  const contexto = partido.tipo === "playoff"
    ? etiquetaFase(partido.fase)
    : `Fecha ${partido.fecha}`;
  const nombreLocal = obtenerNombreLadoPartido(partido, "local");
  const nombreVisitante = obtenerNombreLadoPartido(partido, "visitante");
  const contextoCompleto = [
    contexto,
    partido.localia_pendiente ? "Localía a definir" : ""
  ].filter(Boolean).join(" · ");

  return `
    <button
      type="button"
      class="team-match-row ${proximo ? "next" : ""}"
      onclick="abrirPartido(${JSON.stringify(partido.id)})"
    >
      <span class="${partido.local === equipo ? "focus-team" : ""}">
        ${nombreLocal}
      </span>
      <strong>${centro}</strong>
      <span class="${partido.visitante === equipo ? "focus-team" : ""}">
        ${nombreVisitante}
      </span>
      <small>${contextoCompleto}</small>
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
          partido.hora || ESTADOS_DATO.confirmar
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

function obtenerFechasLibresEquipo(equipo, zona) {
  const fechasZona = new Map();

  state.partidos
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
      const participantes = new Set(
        partidos
          .flatMap(partido => [partido.local, partido.visitante])
          .filter(Boolean)
      );
      const cantidadEsperada = (equiposPorZona[zona] || []).length - 1;

      if (
        participantes.size !== cantidadEsperada ||
        obtenerEquipoLibre(zona, partidos) !== equipo
      ) {
        return null;
      }

      return {
        tipoActividad: "libre",
        fecha,
        fecha_partido:
          partidos.find(partido => partido.fecha_partido)?.fecha_partido ||
          null
      };
    })
    .filter(Boolean);
}

function renderActividadLibre(actividad, equipo) {
  return `
    <div class="team-match-row team-activity-free">
      <span class="focus-team">${nombre(equipo)}</span>
      <strong>Libre</strong>
      <span>Sin partido</span>
      <small>Fecha ${actividad.fecha}</small>
    </div>
  `;
}

function obtenerZonaEquipo(equipo) {
  const entrada = Object.entries(equiposPorZona).find(
    ([, equipos]) => equipos.includes(equipo)
  );
  return entrada ? Number(entrada[0]) : null;
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

function renderScorers() {
  const cont = document.getElementById("scorersContent");
  if (!cont) return;

  if (!cargaPartidosFinalizada) {
    cont.innerHTML = `
      <div class="home-empty">Cargando goleadores...</div>
    `;
    return;
  }

  const goleadores = obtenerGoleadoresReales();

  if (goleadores.length === 0) {
    cont.innerHTML = `
      <div class="home-empty">
        Sin datos de goleadores: no hay eventos de gol con jugador identificado.
      </div>
    `;
    return;
  }

  cont.innerHTML = goleadores.map(goleador => `
    <div class="scorer">
      <div class="sc-pos ${goleador.posicion <= 3 ? "gold" : ""}">
        ${goleador.posicion}
      </div>
      <div class="sc-info">
        <div class="sc-name">${escaparHtml(goleador.jugador)}</div>
        <div class="sc-club">${escaparHtml(goleador.club)}</div>
      </div>
      <div class="sc-n">
        ${goleador.goles}
        <small>${goleador.goles === 1 ? "gol" : "goles"}</small>
      </div>
    </div>
  `).join("");
}

function renderTeams() {
  const equiposLiga = Object.entries(equiposPorZona)
    .flatMap(([zona, equiposZona]) => {
      const tablaZona = calcularTablaZona(Number(zona));
      const posiciones = new Map(
        tablaZona.map(fila => [fila.equipo, fila])
      );

      return equiposZona.map(equipo => ({
        equipo,
        zona: Number(zona),
        stats: posiciones.get(equipo)
      }));
    })
    .sort((a, b) =>
      nombre(a.equipo).localeCompare(
        nombre(b.equipo),
        "es",
        { sensitivity: "base" }
      )
    );

  document.getElementById('teamsContent').innerHTML = equiposLiga
    .map(({ equipo, zona, stats }) => {
      const nombreEquipo = nombre(equipo);
      const club = obtenerClub(equipo);
      const escudoEquipo = escudos[equipo]
        ? `<img src="${escudos[equipo]}" alt="${nombreEquipo}">`
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
renderScorers();
renderTeams();

if (window.history.state?.tresPalos) {
  restaurarVistaDesdeHistorial(window.history.state.vista);
} else {
  guardarVistaEnHistorial(true);
  registrarVistaPestana("inicio", "carga");
}

async function obtenerPartidos() {
  if (actualizandoDatos) return;
  actualizandoDatos = true;

  try {
    const headers = {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`
    };
    const [res, resEventos, resClubes] = await Promise.all([
      fetch(
        `${SUPABASE_URL}/rest/v1/partidos?select=*&order=id.asc`,
        { headers }
      ),
      fetch(
        `${SUPABASE_URL}/rest/v1/eventos_partido?select=partido_id,tipo,equipo_id,jugador,minuto&order=minuto.asc`,
        { headers }
      ),
      fetch(
        `${SUPABASE_URL}/rest/v1/clubes?select=*&order=zona.asc,nombre_corto.asc`,
        { headers }
      )
    ]);

    if (!res.ok) {
      throw new Error(`Supabase respondió con estado ${res.status}`);
    }

    const data = await res.json();

    if (!Array.isArray(data)) {
      throw new Error("La respuesta de partidos no tiene el formato esperado");
    }

    cargaPartidosFinalizada = true;
    state.partidos = data;
    state.eventos = resEventos.ok
      ? await resEventos.json()
      : state.eventos;
    if (resClubes.ok) {
      aplicarClubes(await resClubes.json());
    }

    if (!resEventos.ok) {
      console.warn(
        `No se pudieron cargar las incidencias: ${resEventos.status}`
      );
    }
    if (!resClubes.ok) {
      console.warn(
        `No se pudieron cargar los clubes: ${resClubes.status}. ` +
        "Se usan los datos locales."
      );
    }

    actualizarNavegacionEtapas();
    renderMatches();
    renderTabla(zonaActual);
    renderInicio();
    renderPlayoffs();
    renderScorers();
    renderTeams();

    if (vistaActual.id === "partido") {
      renderDetallePartido(vistaActual.partidoId);
    }
    if (vistaActual.id === "equipo") {
      renderDetalleEquipo(vistaActual.equipo);
    }
  } catch (error) {
    console.error("No se pudieron cargar los partidos:", error);

    if (state.partidos.length > 0) {
      return;
    }

    cargaPartidosFinalizada = true;
    state.partidos = [];
    state.eventos = [];
    etapaActual = null;
    actualizarNavegacionEtapas();
    document.getElementById("tablaContent").innerHTML = `
      <div style="padding:2rem;text-align:center;color:var(--muted)">
        No se pudo cargar la tabla
      </div>
    `;
    document.getElementById("playoffsContent").innerHTML = `
      <div style="padding:2rem;text-align:center;color:var(--muted)">
        No se pudieron cargar los playoffs
      </div>
    `;
    document.getElementById("homeContent").innerHTML = `
      <div style="padding:2rem;text-align:center;color:var(--muted)">
        No se pudo cargar la agenda
      </div>
    `;

    document.getElementById("matchContent").innerHTML = `
      <div style="padding:2rem;text-align:center;color:var(--muted)">
        No se pudieron cargar los partidos
      </div>
    `;
  } finally {
    actualizandoDatos = false;
  }
}

obtenerPartidos();

setInterval(() => {
  if (state.partidos.length > 0) {
    actualizarNavegacionEtapas();
    renderMatches();
    renderInicio();

    if (vistaActual.id === "partido") {
      renderDetallePartido(vistaActual.partidoId);
    }
  }

  obtenerPartidos();
}, 60000);
