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

const goleadores = [
  {pos:1,name:'Marcos Alvarez',club:'Cosmo · Zona 1',goles:11},
  {pos:2,name:'Bruno Ferreyra',club:"Newell's · Zona 2",goles:9},
  {pos:3,name:'Diego Molina',club:'Argentino · Zona 3',goles:8},
  {pos:4,name:'Lucas Pereyra',club:'Sportsman · Zona 1',goles:7},
  {pos:5,name:'Facundo Ríos',club:'ADEO · Zona 2',goles:6},
  {pos:6,name:'Ramiro Sosa',club:'Belgrano · Zona 3',goles:6},
];

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
}

function abrirPartido(id) {
  const partido = state.partidos.find(
    item => String(item.id) === String(id)
  );
  if (!partido) return;

  vistaActual = {
    id: "partido",
    partidoId: partido.id,
    navId: vistaActual.navId || "partidos"
  };
  renderDetallePartido(partido.id);
  mostrarVista("partido");
  guardarVistaEnHistorial();
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

  cont.innerHTML = `
    <div class="zona-block playoff-block">
      <div class="zona-head">
        <div class="zona-pip playoff-pip"></div>
        <div class="zona-name">${etapa.etiqueta}</div>
        <div class="zona-count">${partidos.length} partidos</div>
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
  const hora = partido.hora || "A confirmar";
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
      texto: "A confirmar",
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

function obtenerEstadioPartido(partido) {
  return partido.estadio ||
    partido.cancha ||
    partido.sede ||
    (partido.local ? `Cancha de ${nombre(partido.local)}` : null) ||
    "A confirmar";
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
        p.fase === fase.valor &&
        p.local &&
        p.visitante
    )
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
  if (!cont) return;

  if (!cargaPartidosFinalizada) {
    cont.innerHTML = renderSkeletonAgenda();
    return;
  }

  const agenda = obtenerAgendaInicio();
  actualizarResumenTorneo(agenda);

  if (!agenda.fase || agenda.partidos.length === 0) {
    cont.innerHTML = `
      <div class="next-card home-agenda">
        <div class="home-empty">
          No hay próximos partidos confirmados
        </div>
      </div>
    `;
    return;
  }

  cont.innerHTML = `
    <div class="next-card home-agenda">
      <div class="nc-top">
        <div class="nc-badge">
          ${agenda.pendientes ? `<span class="nc-pulse"></span>` : ""}
          ${agenda.pendientes ? "Próximos partidos" : "Últimos resultados"}
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
          ${agenda.partidos.length} partidos
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
}

function actualizarResumenTorneo(agenda) {
  const etiquetaFase = agenda.fase?.etiqueta || "Fase eliminatoria";
  const anio = obtenerAnioPlayoffs();
  const equipos = new Set(
    agenda.partidos.flatMap(p => [p.local, p.visitante]).filter(Boolean)
  );

  document.getElementById("heroLabel").textContent =
    `Liga Cañadense · ${etiquetaFase} · ${anio}`;
  document.getElementById("sidebarTitle").textContent = etiquetaFase;
  document.getElementById("sidebarMatches").textContent =
    agenda.partidos.length || "–";
  document.getElementById("sidebarTeams").textContent =
    equipos.size || "–";
  document.getElementById("sidebarYear").textContent = anio;
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
    </button>
  `;
}

function renderEscudoInicio(equipo) {
  const nombreEquipo = nombre(equipo);
  const contenido = escudos[equipo]
    ? `<img src="${escudos[equipo]}" alt="${nombreEquipo}">`
    : nombreEquipo.slice(0, 2).toUpperCase();

  return `<div class="home-shield">${contenido}</div>`;
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

  const terminada = partidos.every(
    p =>
      p.goles_local !== null &&
      p.goles_visitante !== null &&
      obtenerGanadorPlayoff(p)
  );
  const esActual = fase.valor === faseActual;
  const estado = terminada
    ? "Finalizada"
    : esActual
      ? "Fase actual"
      : "Pendiente";

  return `
    <section class="po-stage ${esActual ? "current" : ""}">
      <div class="po-phase">
        <div class="po-phase-title">${fase.etiqueta}</div>
        <span class="po-phase-tag">${estado}</span>
      </div>
      <div class="po-bracket">
        ${partidos.map(partido =>
          renderCrucePlayoff(partido)
        ).join("")}
      </div>
    </section>
  `;
}

function renderCrucePlayoff(partido) {
  partido = resolverPartidoPlayoff(partido);

  const jugado =
    partido.goles_local !== null &&
    partido.goles_visitante !== null;
  const tieneEquipos = Boolean(partido.local || partido.visitante);
  const ganador = obtenerGanadorPlayoff(partido);
  const estado = jugado
    ? "Final"
    : tieneEquipos
      ? "Próximo"
      : "Pendiente";
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
        <div class="po-st ${jugado ? "done" : ""}">${estado}</div>
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
            <th>PJ</th>
            <th>PG</th>
            <th>PE</th>
            <th>PP</th>
            <th>DG</th>
            <th>Forma</th>
            <th>PTS</th>
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
        <td>${t.pj}</td>
        <td>${t.pg}</td>
        <td>${t.pe}</td>
        <td>${t.pp}</td>
        <td class="${t.dg > 0 ? 't-dg' : ''}">${diferencia}</td>
        <td><div class="form-row">${dots}</div></td>
        <td class="t-pts">${t.pts}</td>
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
        <div>
          <span>Fecha</span>
          <strong>${formatearFechaCompleta(partido.fecha_partido)}</strong>
        </div>
        <div>
          <span>Hora</span>
          <strong>${partido.hora || "A confirmar"}</strong>
        </div>
        <div>
          <span>Estadio</span>
          <strong>${obtenerEstadioPartido(partido)}</strong>
        </div>
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
              ? "No hay minuto a minuto cargado. El estado en juego se estima por el horario."
              : "No hay incidencias cargadas para este partido."}
          </div>
        `}
    </section>
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
  const jugador = evento.jugador || "Jugador no informado";
  const minuto = evento.minuto !== null && evento.minuto !== undefined
    ? `${evento.minuto}'`
    : "–";

  return `
    <div class="event-row ${esLocal ? "event-local" : "event-away"}">
      <span class="event-minute">${minuto}</span>
      <span class="event-mark event-${tipo}"></span>
      <div>
        <strong>${jugador}</strong>
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
  if (!fecha) return "A confirmar";

  const [year, month, day] = fecha.split("-").map(Number);
  if (!year || !month || !day) return "A confirmar";

  const meses = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
  ];

  return `${day} de ${meses[month - 1]} de ${year}`;
}

function renderDetalleEquipo(equipo) {
  const cont = document.getElementById("teamDetail");
  const zona = obtenerZonaEquipo(equipo);

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
        : `<div class="detail-empty">Todavía no hay actividad cargada.</div>`
      }
    </section>

    <section class="detail-section">
      <div class="detail-section-head">
        <h2>Próximo partido</h2>
      </div>
      ${proximo
        ? renderProximoPartidoEquipo(proximo, equipo)
        : `<div class="detail-empty">No hay un próximo partido confirmado.</div>`
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
          partido.hora || "A confirmar"
        )}
        ${renderDatoProximoPartido("Estadio", estadio)}
      </div>
    </div>
  `;
}

function renderDatoProximoPartido(etiqueta, valor) {
  return `
    <div>
      <span>${etiqueta}</span>
      <strong>${valor}</strong>
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
  document.getElementById('scorersContent').innerHTML = goleadores.map(g => `
    <div class="scorer">
      <div class="sc-pos ${g.pos <= 3 ? 'gold' : ''}">${g.pos}</div>
      <div class="sc-info">
        <div class="sc-name">${g.name}</div>
        <div class="sc-club">${g.club}</div>
      </div>
      <div class="sc-n">${g.goles}<small>goles</small></div>
    </div>
  `).join('');
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
          <div class="tc-pts">Zona ${zona}${puntos}</div>
        </button>
      `;
    })
    .join("");
}

document.getElementById('btnPrev').disabled = true;
document.getElementById('btnNext').disabled = true;

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
}

async function obtenerPartidos() {
  if (actualizandoDatos) return;
  actualizandoDatos = true;

  try {
    const headers = {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`
    };
    const [res, resEventos] = await Promise.all([
      fetch(
        `${SUPABASE_URL}/rest/v1/partidos?select=*&order=id.asc`,
        { headers }
      ),
      fetch(
        `${SUPABASE_URL}/rest/v1/eventos_partido?select=partido_id,tipo,equipo_id,jugador,minuto&order=minuto.asc`,
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

    if (!resEventos.ok) {
      console.warn(
        `No se pudieron cargar las incidencias: ${resEventos.status}`
      );
    }

    actualizarNavegacionEtapas();
    renderMatches();
    renderTabla(zonaActual);
    renderInicio();
    renderPlayoffs();
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
