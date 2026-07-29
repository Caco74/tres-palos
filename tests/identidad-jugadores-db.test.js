"use strict";

const assert = require("assert").strict;
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const auditoria = require("../scripts/auditar-jugadores-historicos");
const respaldo = require("../scripts/respaldar-identidad-jugadores");

const ROOT = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function stripSqlNoise(sql) {
  return sql
    .replace(/--[^\n]*/g, "")
    .replace(/'([^']|'')*'/g, "''")
    .replace(/\$[A-Za-z0-9_]*\$[\s\S]*?\$[A-Za-z0-9_]*\$/g, "$$BODY$$");
}

function assertReadOnlySql(relativePath) {
  const stripped = stripSqlNoise(read(relativePath));
  assert.doesNotMatch(
    stripped,
    /\b(insert|update|delete|alter|create|drop|truncate|grant|revoke|call|execute)\b/i,
    `${relativePath} debe ser solo lectura`
  );
  assert.doesNotMatch(
    stripped,
    /\b(enable|disable)\s+row\s+level\s+security\b|\b(create|alter|drop)\s+policy\b/i,
    `${relativePath} no debe cambiar RLS`
  );
  assert.doesNotMatch(
    stripped,
    /\b(setval|nextval|alter\s+sequence|set\s+(role|session|local|search_path))\b/i,
    `${relativePath} no debe cambiar secuencias, roles ni configuracion`
  );
}

function assertManualPrevalidationSql() {
  const sql = read("sql/prevalidar-identidad-jugadores.sql");
  const stripped = stripSqlNoise(sql);

  assert.match(
    sql,
    /^(?:\s|--[^\n]*\n)*BEGIN\s+TRANSACTION\s+READ\s+ONLY\s*;/i,
    "la prevalidacion manual debe iniciar una transaccion READ ONLY"
  );
  assert.match(
    sql,
    /COMMIT\s*;\s*$/i,
    "la prevalidacion manual debe finalizar con COMMIT"
  );
  assert.equal(
    (stripped.match(/\bas\s+prevalidacion_identidad_jugadores\b/gi) || []).length,
    1,
    "la prevalidacion manual debe devolver una sola columna JSON final"
  );
  assert.equal(
    (stripped.match(/\bselect\b/gi) || []).filter(Boolean).length > 0,
    true,
    "la prevalidacion manual debe producir una consulta SELECT"
  );
  assert.match(stripped, /\bjsonb_build_object\s*\(/i);
  assert.match(sql, /'jugadores'/);
  assert.match(sql, /'inscripciones_jugadores'/);
  assert.match(sql, /'eventos_partido'/);
  assert.match(sql, /'goleadores_oficiales'/);
  assert.match(sql, /'estructura_auxiliar'/);
  assert.match(sql, /'comparacion'/);
  assert.match(sql, /'maximo_registros_por_muestra',\s*10/);
  assert.doesNotMatch(
    sql,
    /\b(pg_get_constraintdef|indexdef|pg_indexes)\b/i,
    "la prevalidacion manual no debe volcar DDL crudo de catalogos"
  );
  assert.doesNotMatch(
    sql,
    /[^\x00-\x7F]/,
    "la prevalidacion manual debe mantenerse en ASCII para copia manual"
  );
  assert.doesNotMatch(
    sql,
    /\b(SUPABASE_[A-Z0-9_]*KEY|SERVICE_ROLE|ANON_KEY|JWT_SECRET|PASSWORD|DATABASE_URL)\b\s*[:=]/i,
    "la prevalidacion manual no debe imprimir ni declarar secretos"
  );
  assert.doesNotMatch(
    sql,
    /eyJ[A-Za-z0-9_-]{20,}|postgres(?:ql)?:\/\/|@.*supabase\.(?:co|in)/i,
    "la prevalidacion manual no debe incluir JWT ni connection strings"
  );
  assertReadOnlySql("sql/prevalidar-identidad-jugadores.sql");
}

function makeBaseData(overrides = {}) {
  const data = {
    torneos: [
      { id: 1, anio: 2026, tipo: "apertura", nombre: "Apertura 2026" },
      { id: 2, anio: 2026, tipo: "clausura", nombre: "Clausura 2026" }
    ],
    clubes: [
      { id: 1, nombre_corto: "Club A", nombre_oficial: "Club A" },
      { id: 2, nombre_corto: "Club B", nombre_oficial: "Club B" },
      { id: 3, nombre_corto: "Club C", nombre_oficial: "Club C" },
      { id: 4, nombre_corto: "Club D", nombre_oficial: "Club D" }
    ],
    jugadores: [
      {
        id: 1,
        nombre_completo: "Joaquin Carrizo",
        aliases: ["J. Carrizo", "JOAQUIN CARRIZO"],
        activo: true
      }
    ],
    inscripciones_jugadores: [
      {
        id: 10,
        jugador_id: 1,
        club_id: 1,
        torneo_id: 1,
        estado: "confirmado"
      },
      {
        id: 11,
        jugador_id: 1,
        club_id: 3,
        torneo_id: 2,
        estado: "confirmado"
      }
    ],
    partidos: [
      {
        id: 100,
        torneo_id: 1,
        local_id: 1,
        visitante_id: 2,
        local: "Club A",
        visitante: "Club B"
      },
      {
        id: 200,
        torneo_id: 2,
        local_id: 3,
        visitante_id: 4,
        local: "Club C",
        visitante: "Club D"
      }
    ],
    eventos_partido: [],
    ...overrides
  };

  return data;
}

function byEventId(analysis, id) {
  return analysis.classified.find(item => String(item.id) === String(id));
}

function runTests() {
  const results = [];

  {
    assert.equal(
      auditoria.normalizePlayerName("JOAQUIN  CARRIZO"),
      "joaquin carrizo"
    );
    assert.equal(
      auditoria.normalizePlayerName("J. Carrizo"),
      "j carrizo"
    );
    results.push("normalizacion reusable sin tildes, puntos ni dobles espacios: ok");
  }

  {
    const data = makeBaseData({
      eventos_partido: [
        {
          id: 1,
          partido_id: 100,
          tipo: "gol",
          jugador: "J. Carrizo",
          equipo_id: 1
        },
        {
          id: 2,
          partido_id: 100,
          tipo: "gol",
          jugador: "JOAQUIN  CARRIZO",
          equipo_id: 1
        }
      ]
    });
    const analysis = auditoria.analyzeHistoricalPlayers(data, {
      tournamentId: 1
    });

    assert.equal(byEventId(analysis, 1).status, "coincidencia_alias_confirmado");
    assert.equal(byEventId(analysis, 2).status, "coincidencia_alias_confirmado");
    assert.equal(byEventId(analysis, 1).candidates[0].jugador_id, 1);
    assert.equal(byEventId(analysis, 2).candidates[0].jugador_id, 1);
    results.push("dos variantes textuales pueden vincularse al mismo jugador: ok");
  }

  {
    const data = makeBaseData({
      jugadores: [
        {
          id: 1,
          nombre_completo: "Joaquin Carrizo",
          aliases: ["J. Carrizo"]
        },
        {
          id: 2,
          nombre_completo: "Juan Carrizo",
          aliases: ["J. Carrizo"]
        }
      ],
      inscripciones_jugadores: [
        { id: 10, jugador_id: 1, club_id: 1, torneo_id: 1 },
        { id: 20, jugador_id: 2, club_id: 2, torneo_id: 1 }
      ],
      eventos_partido: [
        {
          id: 3,
          partido_id: 100,
          tipo: "gol",
          jugador: "J. Carrizo",
          equipo_id: 1
        }
      ]
    });
    const analysis = auditoria.analyzeHistoricalPlayers(data, {
      tournamentId: 1
    });

    assert.equal(byEventId(analysis, 3).status, "ambiguo");
    assert.equal(byEventId(analysis, 3).canAutoMigrate, false);
    results.push("dos homonimos distintos no se fusionan automaticamente: ok");
  }

  {
    const data = makeBaseData();
    const playerInscriptions = data.inscripciones_jugadores.filter(
      row => row.jugador_id === 1
    );
    assert.deepEqual(playerInscriptions.map(row => row.torneo_id), [1, 2]);
    assert.deepEqual(playerInscriptions.map(row => row.club_id), [1, 3]);
    results.push("una persona puede tener torneos distintos y cambiar de club: ok");
  }

  {
    const data = makeBaseData({
      eventos_partido: [
        {
          id: 4,
          partido_id: 100,
          tipo: "gol",
          jugador: "J. Carrizo",
          equipo_id: 1,
          inscripcion_jugador_id: 10
        }
      ]
    });
    const analysis = auditoria.analyzeHistoricalPlayers(data, {
      tournamentId: 1
    });
    const row = byEventId(analysis, 4);

    assert.equal(row.status, "ya_vinculado");
    assert.equal(row.jugador, "J. Carrizo");
    assert.equal(row.inscripcion_jugador_id, 10);
    results.push("evento vinculado por ID conserva texto historico: ok");
  }

  {
    const data = makeBaseData({
      eventos_partido: [
        {
          id: 5,
          partido_id: 100,
          tipo: "gol_en_contra",
          jugador: "Joaquin Carrizo",
          equipo_id: 2
        }
      ]
    });
    const analysis = auditoria.analyzeHistoricalPlayers(data, {
      tournamentId: 1
    });
    const row = byEventId(analysis, 5);

    assert.equal(row.status, "coincidencia_exacta_segura");
    assert.equal(row.candidates[0].club_id, 1);
    assert.equal(row.equipo_id, 2);
    assert.notEqual(String(row.candidates[0].club_id), String(row.equipo_id));
    results.push("autogol mantiene jugador real y equipo beneficiado separados: ok");
  }

  {
    const grouped = auditoria.groupScorersTransition([
      {
        id: 10,
        tipo: "gol",
        jugador: "J. Carrizo",
        equipo_id: 1,
        inscripcion_jugador_id: 10
      },
      {
        id: 10,
        tipo: "gol",
        jugador: "J. Carrizo",
        equipo_id: 1,
        inscripcion_jugador_id: 10
      },
      {
        id: 11,
        tipo: "gol_penal",
        jugador: "JOAQUIN CARRIZO",
        equipo_id: 1,
        inscripcion_jugador_id: 10
      },
      {
        id: 12,
        tipo: "gol",
        jugador: "Historico Sin ID",
        equipo_id: 1,
        inscripcion_jugador_id: null
      }
    ]);

    const byKey = new Map(grouped.map(row => [row.identityKey, row]));
    assert.equal(byKey.get("inscripcion:10").goles, 2);
    assert.equal(
      byKey.get("texto:historico sin id:club:1").eventos_pendientes_vincular,
      1
    );
    results.push("goleadores futuros agrupan por ID sin duplicar eventos: ok");
  }

  {
    assert.throws(
      () => auditoria.parseArgs(["--apply"]),
      /Flag inseguro bloqueado/
    );
    assert.throws(
      () => auditoria.parseArgs(["--update"]),
      /Flag inseguro bloqueado/
    );
    assert.deepEqual(auditoria.REMOTE_HTTP_METHODS, ["GET"]);
    assert.deepEqual(respaldo.REMOTE_HTTP_METHODS, ["GET"]);
    assert.equal(
      respaldo.TABLES.some(table => table.name === "eventos_partido"),
      true
    );
    results.push("scripts bloquean escrituras Supabase y respaldo usa GET: ok");
  }

  {
    new vm.Script(read("scripts/auditar-jugadores-historicos.js"));
    new vm.Script(read("scripts/respaldar-identidad-jugadores.js"));
    new vm.Script(read("tests/identidad-jugadores-db.test.js"));
    results.push("sintaxis JS nueva: ok");
  }

  {
    assertManualPrevalidationSql();
    assertReadOnlySql("sql/prevalidar-identidad-jugadores.sql");
    assertReadOnlySql("sql/verificar-identidad-jugadores.sql");

    const aplicar = read("sql/aplicar-identidad-jugadores.sql");
    assert.match(aplicar, /^\s*begin;/i);
    assert.match(aplicar, /PENDIENTE_AUTORIZACION/);
    assert.match(aplicar, /AUTORIZO IDENTIDAD JUGADORES/);
    assert.match(aplicar, /on delete restrict/i);
    assert.doesNotMatch(
      aplicar,
      /unique\s*\(\s*nombre_normalizado\s*\)/i
    );
    assert.doesNotMatch(
      aplicar,
      /\b(update|insert\s+into|delete\s+from)\s+public\.(eventos_partido|partidos|torneos|clubes)\b/i
    );
    assert.match(aplicar, /tp_validar_evento_inscripcion_jugador/);
    assert.match(aplicar, /sin exigir que coincida con equipo_id/);
    assert.doesNotMatch(
      aplicar,
      /create\s+policy\s+jugadores_aliases_lectura_publica/i
    );
    assert.doesNotMatch(
      aplicar,
      /grant\s+select\s+on\s+table\s+public\.jugadores_aliases\s+to\s+anon/i
    );
    assert.match(
      read("sql/verificar-identidad-jugadores.sql"),
      /sin_lectura_publica_aliases/
    );
    results.push("prevalidacion manual READ ONLY genera un unico JSON sin efectos laterales: ok");
    results.push("SQL protegido conserva Apertura/Clausura y restringe borrados: ok");
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
