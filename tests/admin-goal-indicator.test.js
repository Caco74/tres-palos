"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const ADMIN_SOURCE = fs.readFileSync(
  path.join(ROOT, "js", "admin-panel.js"),
  "utf8"
);
const ADMIN_CSS = fs.readFileSync(
  path.join(ROOT, "styles", "admin.css"),
  "utf8"
);

function extractFunction(source, name) {
  const match = new RegExp(`function\\s+${name}\\s*\\(`).exec(source);
  assert.ok(match, `No se encontro ${name}`);
  const start = match.index;

  let depth = 0;
  let end = start;
  let opened = false;
  for (; end < source.length; end += 1) {
    if (source[end] === "{") {
      depth += 1;
      opened = true;
    }
    if (source[end] === "}") {
      depth -= 1;
      if (opened && depth === 0) {
        end += 1;
        break;
      }
    }
  }

  return source.slice(start, end);
}

function buildSandbox() {
  const sandbox = {
    clubes: [
      { id: 1, nombre_oficial: "Equipo Local", nombre_corto: "Local" },
      { id: 2, nombre_oficial: "Equipo Visitante", nombre_corto: "Visitante" }
    ],
    incidencias: []
  };
  const functions = [
    "normalizarNombreClubAdmin",
    "resolverClubAdmin",
    "resolverPartidoPlayoffAdmin",
    "resolverEquipoPartidoAdmin",
    "resultadoPartidoCargado",
    "ajustarMarcadorPorIncidencia",
    "contarGolesIdentificados",
    "incidenciasPartidoAdmin",
    "resumenGoleadoresPartidoAdmin",
    "renderIndicadorGoleadoresPartido",
    "escapeHtml"
  ].map(name => extractFunction(ADMIN_SOURCE, name)).join("\n\n");

  vm.runInNewContext(
    `${functions}
     this.resumenGoleadoresPartidoAdmin = resumenGoleadoresPartidoAdmin;
     this.renderIndicadorGoleadoresPartido = renderIndicadorGoleadoresPartido;`,
    sandbox,
    { filename: "admin-goal-indicator.js" }
  );

  return sandbox;
}

function partido(extra = {}) {
  return {
    id: 10,
    torneo_id: 2,
    tipo: "regular",
    local_id: 1,
    visitante_id: 2,
    local: "Equipo Local",
    visitante: "Equipo Visitante",
    goles_local: 0,
    goles_visitante: 0,
    ...extra
  };
}

function evento(id, extra = {}) {
  return {
    id,
    torneo_id: 2,
    partido_id: 10,
    tipo: "gol",
    equipo_id: 1,
    ...extra
  };
}

function assertResumen(sandbox, match, events, expected) {
  sandbox.incidencias = events;
  const resumen = sandbox.resumenGoleadoresPartidoAdmin(match, events);

  assert.equal(resumen.estado, expected.estado);
  assert.deepEqual(
    {
      local: resumen.identificados.local,
      visitante: resumen.identificados.visitante
    },
    expected.identificados
  );
  assert.deepEqual(
    {
      local: resumen.esperados.local,
      visitante: resumen.esperados.visitante
    },
    expected.esperados
  );

  return sandbox.renderIndicadorGoleadoresPartido(match);
}

function runTests() {
  const results = [];
  const sandbox = buildSandbox();

  {
    const match = partido({ goles_local: 0, goles_visitante: 0 });
    const html = assertResumen(sandbox, match, [], {
      estado: "complete",
      identificados: { local: 0, visitante: 0 },
      esperados: { local: 0, visitante: 0 }
    });
    assert.match(html, /Goleadores completos/);
    assert.match(html, /Goles 0\/0 \u00b7 0\/0/);
    results.push("resultado 0-0 completo sin incidencias: ok");
  }

  {
    assertResumen(sandbox, partido({ goles_local: 3, goles_visitante: 1 }), [], {
      estado: "pending",
      identificados: { local: 0, visitante: 0 },
      esperados: { local: 3, visitante: 1 }
    });
    results.push("partido sin goles identificados queda pendiente: ok");
  }

  {
    const events = [
      evento(1),
      evento(2),
      evento(3, { equipo_id: 2 })
    ];
    assertResumen(sandbox, partido({ goles_local: 3, goles_visitante: 1 }), events, {
      estado: "pending",
      identificados: { local: 2, visitante: 1 },
      esperados: { local: 3, visitante: 1 }
    });
    results.push("partido parcialmente identificado queda pendiente: ok");
  }

  {
    const events = [
      evento(1),
      evento(2),
      evento(3),
      evento(4, { equipo_id: 2 })
    ];
    const html = assertResumen(
      sandbox,
      partido({ goles_local: 3, goles_visitante: 1 }),
      events,
      {
        estado: "complete",
        identificados: { local: 3, visitante: 1 },
        esperados: { local: 3, visitante: 1 }
      }
    );
    assert.match(html, /class="match-goal-indicator complete"/);
    results.push("partido completamente identificado queda completo: ok");
  }

  {
    const events = [
      evento(1, { tipo: "gol_penal" }),
      evento(2, { equipo_id: 2 })
    ];
    assertResumen(sandbox, partido({ goles_local: 1, goles_visitante: 1 }), events, {
      estado: "complete",
      identificados: { local: 1, visitante: 1 },
      esperados: { local: 1, visitante: 1 }
    });
    results.push("gol de penal cuenta como gol identificado: ok");
  }

  {
    const events = [
      evento(1, { tipo: "gol_en_contra", equipo_id: 2 })
    ];
    assertResumen(sandbox, partido({ goles_local: 1, goles_visitante: 0 }), events, {
      estado: "complete",
      identificados: { local: 1, visitante: 0 },
      esperados: { local: 1, visitante: 0 }
    });
    results.push("gol en contra se acredita al equipo beneficiado: ok");
  }

  {
    const events = [evento(1), evento(2)];
    const html = assertResumen(sandbox, partido({ goles_local: 1, goles_visitante: 0 }), events, {
      estado: "review",
      identificados: { local: 2, visitante: 0 },
      esperados: { local: 1, visitante: 0 }
    });
    assert.match(html, /Revisar goleadores/);
    results.push("cantidad identificada superior al resultado queda en revision: ok");
  }

  {
    const match = partido({ goles_local: 1, goles_visitante: 0 });
    assertResumen(sandbox, match, [evento(1)], {
      estado: "complete",
      identificados: { local: 1, visitante: 0 },
      esperados: { local: 1, visitante: 0 }
    });
    assertResumen(sandbox, match, [], {
      estado: "pending",
      identificados: { local: 0, visitante: 0 },
      esperados: { local: 1, visitante: 0 }
    });
    results.push("eliminacion de gol previamente cargado actualiza a pendiente: ok");
  }

  {
    const match = partido({ id: 10, torneo_id: 2, goles_local: 1, goles_visitante: 0 });
    const events = [
      evento(1, { partido_id: 10, torneo_id: 2 }),
      evento(2, { partido_id: 11, torneo_id: 2 }),
      evento(3, { partido_id: 10, torneo_id: 3 })
    ];
    assertResumen(sandbox, match, events, {
      estado: "complete",
      identificados: { local: 1, visitante: 0 },
      esperados: { local: 1, visitante: 0 }
    });
    results.push("aislamiento entre partidos y torneos: ok");
  }

  {
    assert.match(
      ADMIN_SOURCE,
      /function renderLista[\s\S]*renderIndicadorGoleadoresPartido\(partido\)[\s\S]*function seleccionarPartido/
    );
    assert.match(
      extractFunction(ADMIN_SOURCE, "cargarIncidenciasAdmin"),
      /renderLista\(\)/
    );
    assert.doesNotMatch(ADMIN_SOURCE, /localStorage|goleadores_completos|estado_manual/i);
    assert.match(ADMIN_CSS, /\.match-goal-indicator\.complete[\s\S]*var\(--green\)/);
    assert.match(ADMIN_CSS, /\.match-goal-indicator[\s\S]*var\(--yellow\)/);
    assert.match(ADMIN_CSS, /\.match-goal-indicator\.review[\s\S]*var\(--red\)/);
    results.push("render y estilos del indicador automatico: ok");
  }

  return results;
}

if (require.main === module) {
  try {
    runTests().forEach(result => console.log(result));
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}

module.exports = { runTests };
