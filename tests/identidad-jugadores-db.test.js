"use strict";

const assert = require("assert").strict;
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const auditoria = require("../scripts/auditar-jugadores-historicos");
const respaldo = require("../scripts/respaldar-identidad-jugadores");

const ROOT = path.resolve(__dirname, "..");
const CONFIRMED_PLAYERS = [
  { id: 1, nombre: "F. Pizzichini" },
  { id: 2, nombre: "Astrada" },
  { id: 3, nombre: "B. Mart\u00ednez" },
  { id: 4, nombre: "Mora" },
  { id: 5, nombre: "Beloqui" },
  { id: 6, nombre: "Gimenez" },
  { id: 7, nombre: "Garino" },
  { id: 8, nombre: "Correa" },
  { id: 9, nombre: "Miramontes" },
  { id: 10, nombre: "Galindo" },
  { id: 11, nombre: "S\u00e1nchez" },
  { id: 12, nombre: "Cantiani" },
  { id: 13, nombre: "Angeleti" },
  { id: 14, nombre: "Bulgarelli" },
  { id: 15, nombre: "M. Aguero" },
  { id: 16, nombre: "Zeballos" },
  { id: 17, nombre: "Mauro Castellaro" },
  { id: 18, nombre: "D\u00edaz" },
  { id: 19, nombre: "De Gasperi" },
  { id: 20, nombre: "Sarco" },
  { id: 21, nombre: "Sarco" },
  { id: 22, nombre: "Rojas" },
  { id: 23, nombre: "Godoy" },
  { id: 24, nombre: "Vitali" },
  { id: 25, nombre: "S\u00e1nchez" },
  { id: 26, nombre: "Zanabria" },
  { id: 27, nombre: "Joel Barrios" }
];

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function normalizeSqlModel(value) {
  if (value === null || value === undefined) return null;
  const normalized = auditoria.normalizePlayerName(value);
  return normalized || null;
}

function stripSqlNoise(sql) {
  return sql
    .replace(/--[^\n]*/g, "")
    .replace(/'([^']|'')*'/g, "''")
    .replace(/\$[A-Za-z0-9_]*\$[\s\S]*?\$[A-Za-z0-9_]*\$/g, "$$BODY$$");
}

function stripSqlLineComments(sql) {
  return sql.replace(/--[^\n]*/g, "").trim();
}

function normalizeApplySqlForComparison(sql) {
  return stripSqlLineComments(sql)
    .replace(
      /v_autorizacion constant text := 'AUTORIZO IDENTIDAD JUGADORES';/g,
      "v_autorizacion constant text := 'PENDIENTE_AUTORIZACION';"
    )
    .replace(/\r\n/g, "\n")
    .trim();
}

function firstMatchIndex(value, patterns) {
  return patterns
    .map(pattern => {
      const match = value.match(pattern);
      return match ? match.index : -1;
    })
    .filter(index => index >= 0)
    .reduce((minimum, index) => Math.min(minimum, index), Infinity);
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
  assert.match(sql, /'estado_esperado_post_fallo'/);
  assert.match(sql, /'jugadores_nombre_normalizado'/);
  assert.match(sql, /'jugadores_aliases'/);
  assert.match(sql, /'tp_normalizar_nombre_jugador'/);
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

function assertSingleJsonReadOnlySql(relativePath, columnName) {
  const sql = read(relativePath);
  const stripped = stripSqlNoise(sql);
  assert.match(
    sql,
    /^(?:\s|--[^\n]*\n)*BEGIN\s+TRANSACTION\s+READ\s+ONLY\s*;/i,
    `${relativePath} debe iniciar con transaccion READ ONLY`
  );
  assert.match(sql, /COMMIT\s*;\s*$/i);
  assert.equal(
    (stripped.match(new RegExp(`\\bas\\s+${columnName}\\b`, "gi")) || []).length,
    1,
    `${relativePath} debe devolver una sola columna ${columnName}`
  );
  assert.match(stripped, /\bjsonb_build_object\s*\(/i);
  assertReadOnlySql(relativePath);
}

function assertCatalogNameTypeSafety() {
  const sqlFiles = [
    "sql/aplicar-identidad-jugadores.sql",
    "sql/aplicar-identidad-jugadores-autorizado.sql",
    "sql/prevalidar-identidad-jugadores.sql",
    "sql/verificar-identidad-jugadores.sql",
    "sql/respaldar-identidad-jugadores-manual.sql"
  ];

  sqlFiles.forEach(relativePath => {
    const sql = read(relativePath);
    assert.doesNotMatch(
      sql,
      /array_agg\s*\(\s*att\.attname\s+order\b/i,
      `${relativePath} no debe agregar pg_attribute.attname como name[]`
    );
    assert.doesNotMatch(
      sql,
      /array_agg\s*\(\s*att\.attname(?!::text)[\s\S]{0,220}\)\s*=\s*array\[/i,
      `${relativePath} no debe comparar name[] con arrays literales`
    );
    assert.doesNotMatch(
      sql,
      /att\.attname\s*=\s*[^'\n;]+::text\b/i,
      `${relativePath} no debe comparar pg_attribute.attname directamente con text`
    );
  });

  [
    "sql/aplicar-identidad-jugadores.sql",
    "sql/aplicar-identidad-jugadores-autorizado.sql"
  ].forEach(relativePath => {
    const sql = read(relativePath);
    assert.match(
      sql,
      /array_agg\s*\(\s*att\.attname::text\s+order by key_row\.ordinalidad\s*\)[\s\S]{0,260}=\s*array\['jugador_id', 'club_id', 'torneo_id'\]::text\[\]/i,
      `${relativePath} debe validar la constraint de inscripciones como text[] ordenado`
    );
  });

  assert.match(
    read("sql/prevalidar-identidad-jugadores.sql"),
    /jsonb_agg\s*\(\s*att\.attname::text\s+order by key_row\.ordinalidad\s*\)/i
  );
  assert.match(
    read("sql/respaldar-identidad-jugadores-manual.sql"),
    /jsonb_agg\s*\(\s*att\.attname::text\s+order by key_row\.ordinalidad\s*\)/i
  );
}

function assertManualBackupSql() {
  const sql = read("sql/respaldar-identidad-jugadores-manual.sql");
  assertSingleJsonReadOnlySql(
    "sql/respaldar-identidad-jugadores-manual.sql",
    "backup_identidad_jugadores"
  );
  assert.match(sql, /'metadata'/);
  assert.match(sql, /'jugadores'/);
  assert.match(sql, /'inscripciones_jugadores'/);
  assert.match(sql, /'eventos_partido'/);
  assert.match(sql, /'goleadores_oficiales'/);
  assert.match(sql, /'estructura_previa'/);
  assert.match(sql, /'hashes'/);
  assert.match(sql, /md5\s*\(/i);
  assert.match(sql, /jsonb_agg\s*\([\s\S]*order by id/i);
  assert.doesNotMatch(
    sql,
    /\b(SUPABASE_[A-Z0-9_]*KEY|SERVICE_ROLE|ANON_KEY|JWT_SECRET|PASSWORD|DATABASE_URL)\b\s*[:=]/i
  );
}

function assertAuthorizedApplySql() {
  const protectedSql = read("sql/aplicar-identidad-jugadores.sql");
  const authorizedSql = read("sql/aplicar-identidad-jugadores-autorizado.sql");
  const stripped = stripSqlNoise(authorizedSql);

  assert.match(authorizedSql, /ARCHIVO TEMPORAL AUTORIZADO PARA APLICACION MANUAL/);
  assert.match(authorizedSql, /debe eliminarse del repositorio antes del merge/i);
  assert.match(authorizedSql, /Ejecutar solo despues de descargar el respaldo/i);
  assert.match(authorizedSql, /No seleccionar ni ejecutar fragmentos/i);
  assert.match(authorizedSql, /no volver a ejecutarlo/i);
  assert.match(authorizedSql, /v_autorizacion constant text := 'AUTORIZO IDENTIDAD JUGADORES';/);
  assert.doesNotMatch(authorizedSql, /PENDIENTE_AUTORIZACION/);
  assert.match(
    authorizedSql,
    /^(?:\s|--[^\n]*\n)*begin\s*;/i,
    "el SQL autorizado debe iniciar una transaccion"
  );
  assert.match(authorizedSql, /commit\s*;\s*$/i);
  assert.equal((stripped.match(/\bcommit\s*;/gi) || []).length, 1);
  assert.match(protectedSql, /PENDIENTE_AUTORIZACION/);
  assert.match(protectedSql, /Aplicacion bloqueada/);
  assert.equal(
    normalizeApplySqlForComparison(authorizedSql),
    normalizeApplySqlForComparison(protectedSql),
    "el SQL autorizado debe mantener la misma logica que el protegido"
  );

  const constraintValidationIndex = authorizedSql.indexOf(
    "select array_agg(att.attname::text order by key_row.ordinalidad)"
  );
  const firstStructuralIndex = firstMatchIndex(authorizedSql, [
    /\ncreate\s+or\s+replace\s+function\b/i,
    /\nalter\s+table\b/i,
    /\ncreate\s+table\b/i,
    /\ncreate\s+(?:unique\s+)?index\b/i,
    /\ncreate\s+trigger\b/i,
    /\ngrant\b/i,
    /\nrevoke\b/i
  ]);
  const commitIndex = authorizedSql.toLowerCase().lastIndexOf("commit;");

  assert.notEqual(constraintValidationIndex, -1);
  assert.ok(
    constraintValidationIndex < firstStructuralIndex,
    "la validacion de constraint debe ejecutarse antes de cambios estructurales"
  );
  assert.ok(
    constraintValidationIndex < commitIndex,
    "la validacion de constraint debe ejecutarse antes del COMMIT"
  );

  [
    /v_jugadores_total <> 27/,
    /v_inscripciones_total <> 27/,
    /v_eventos_total <> 368/,
    /v_eventos_vinculados <> 60/,
    /v_eventos_pendientes <> 308/,
    /v_goleadores_total <> 4/,
    /v_eventos_referencias_rotas <> 0/,
    /jugadores\.nombre_normalizado ya existe/,
    /jugadores_aliases ya existe/,
    /tp_normalizar_nombre_jugador\(text\) ya existe/,
    /Validacion final fallo: jugadores normalizados no es 27/,
    /Validacion final fallo: eventos vinculados no es 60/,
    /Validacion final fallo: eventos pendientes no es 308/,
    /Validacion final fallo: autogol historico no preservado/,
    /Validacion final fallo: homonimos Sanchez no preservados/,
    /Validacion final fallo: homonimos Sarco no preservados/
  ].forEach(pattern => assert.match(authorizedSql, pattern));

  assert.doesNotMatch(
    authorizedSql,
    /\b(update|insert\s+into|delete\s+from)\s+public\.(eventos_partido|partidos|torneos|clubes|inscripciones_jugadores|goleadores_oficiales)\b/i
  );
  assert.doesNotMatch(
    authorizedSql,
    /\binsert\s+into\s+public\.jugadores\b/i
  );
  assert.doesNotMatch(
    authorizedSql,
    /\bdelete\s+from\s+public\.jugadores\b/i
  );
  assert.doesNotMatch(
    authorizedSql,
    /unique\s*\(\s*nombre_normalizado\s*\)/i
  );
  assert.doesNotMatch(
    authorizedSql,
    /create\s+unique\s+index[\s\S]{0,160}nombre_normalizado/i
  );
  assert.doesNotMatch(
    authorizedSql,
    /grant\s+.*on\s+table\s+public\.jugadores_aliases\s+to\s+(anon|authenticated)/i
  );
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
    const normalizationCases = [
      ["JOAQU\u00cdN  CARRIZO.", "joaquin carrizo"],
      [" J. Carrizo ", "j carrizo"],
      ["Joaqu\u00edn     Carrizo", "joaquin carrizo"],
      ["Joaqu\u00edn Carrizo.", "joaquin carrizo"],
      [".Joaqu\u00edn Carrizo", "joaquin carrizo"],
      ["   Joaqu\u00edn Carrizo   ", "joaquin carrizo"],
      ["Joaqu\u00edn     Carrizo", "joaquin carrizo"],
      ["D\u00edaz S\u00e1nchez", "diaz sanchez"],
      ["", null],
      ["     ", null],
      [null, null],
      ["joaquin carrizo", "joaquin carrizo"]
    ];

    normalizationCases.forEach(([input, expected]) => {
      const normalized = normalizeSqlModel(input);
      assert.equal(normalized, expected);
      assert.equal(normalizeSqlModel(normalized), expected);
      if (normalized) {
        assert.equal(normalized, normalized.trim());
        assert.equal(/\s{2,}/.test(normalized), false);
        assert.equal(normalized.includes("."), false);
      }
    });
    assert.equal(
      CONFIRMED_PLAYERS.map(player => normalizeSqlModel(player.nombre)).filter(Boolean).length,
      27
    );
    results.push("normalizacion SQL esperada cubre trim, tildes, puntos, NULL e idempotencia: ok");
  }

  {
    const byNormalized = new Map();
    CONFIRMED_PLAYERS.forEach(player => {
      const normalized = normalizeSqlModel(player.nombre);
      if (!byNormalized.has(normalized)) byNormalized.set(normalized, []);
      byNormalized.get(normalized).push(player.id);
    });

    assert.deepEqual(byNormalized.get("sanchez"), [11, 25]);
    assert.deepEqual(byNormalized.get("sarco"), [20, 21]);
    assert.equal(byNormalized.get("sanchez").length, 2);
    assert.equal(byNormalized.get("sarco").length, 2);
    results.push("Sanchez y Sarco permanecen como homonimos separados: ok");
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
    assertManualBackupSql();
    assertManualPrevalidationSql();
    assertAuthorizedApplySql();
    assertSingleJsonReadOnlySql(
      "sql/verificar-identidad-jugadores.sql",
      "verificacion_identidad_jugadores"
    );
    assertCatalogNameTypeSafety();
    assertReadOnlySql("sql/prevalidar-identidad-jugadores.sql");
    assertReadOnlySql("sql/verificar-identidad-jugadores.sql");

    const aplicar = read("sql/aplicar-identidad-jugadores.sql");
    assert.match(aplicar, /^\s*begin;/i);
    assert.match(aplicar, /PENDIENTE_AUTORIZACION/);
    assert.match(aplicar, /AUTORIZO IDENTIDAD JUGADORES/);
    assert.match(aplicar, /returns null on null input/i);
    assert.match(aplicar, /set search_path = pg_catalog/i);
    assert.match(aplicar, /nullif\s*\(\s*btrim\s*\(/i);
    assert.doesNotMatch(aplicar, /coalesce\s*\(\s*p_nombre\s*,/i);
    assert.match(aplicar, /v_backfill_jugadores <> 27/);
    assert.match(aplicar, /v_jugadores_total <> 27/);
    assert.match(aplicar, /v_inscripciones_total <> 27/);
    assert.match(aplicar, /v_eventos_total <> 368/);
    assert.match(aplicar, /v_eventos_vinculados <> 60/);
    assert.match(aplicar, /v_eventos_pendientes <> 308/);
    assert.match(aplicar, /v_goleadores_total <> 4/);
    assert.match(aplicar, /Homonimo Sanchez/);
    assert.match(aplicar, /Homonimo Sarco/);
    assert.match(aplicar, /on delete restrict/i);
    assert.doesNotMatch(
      aplicar,
      /unique\s*\(\s*nombre_normalizado\s*\)/i
    );
    assert.doesNotMatch(
      aplicar,
      /create\s+unique\s+index[\s\S]{0,160}nombre_normalizado/i
    );
    assert.doesNotMatch(
      aplicar,
      /\b(update|insert\s+into|delete\s+from)\s+public\.(eventos_partido|partidos|torneos|clubes|inscripciones_jugadores|goleadores_oficiales)\b/i
    );
    const backfillBlock = aplicar.match(
      /update\s+public\.jugadores[\s\S]*?get diagnostics/i
    )[0];
    assert.doesNotMatch(backfillBlock, /actualizado_en/i);
    assert.doesNotMatch(aplicar, /\bexecute\s+format\b/i);
    assert.match(aplicar, /tp_validar_evento_inscripcion_jugador/);
    assert.match(aplicar, /los eventos historicos pueden conservar solo texto/);
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
    assert.match(
      read("sql/verificar-identidad-jugadores.sql"),
      /aliases_desde_array_0/
    );
    assert.match(
      read("sql/verificar-identidad-jugadores.sql"),
      /eventos_pendientes_308/
    );
    assert.match(
      read("sql/verificar-identidad-jugadores.sql"),
      /hashes_posteriores/
    );
    assert.match(
      read("sql/verificar-identidad-jugadores.sql"),
      /jugadores_historico/
    );
    assert.match(
      read("sql/verificar-identidad-jugadores.sql"),
      /inscripciones_jugadores/
    );
    assert.match(
      read("sql/verificar-identidad-jugadores.sql"),
      /eventos_partido/
    );
    assert.match(
      read("sql/verificar-identidad-jugadores.sql"),
      /goleadores_oficiales/
    );
    const guide = read("docs/aplicar-identidad-jugadores-manualmente.md");
    assert.match(guide, /respaldar-identidad-jugadores-manual\.sql/);
    assert.match(guide, /aplicar-identidad-jugadores-autorizado\.sql/);
    assert.match(guide, /verificar-identidad-jugadores\.sql/);
    assert.match(guide, /eliminar del repositorio `sql\/aplicar-identidad-jugadores-autorizado\.sql`/);
    assert.match(guide, /No hacer merge/);
    results.push("prevalidacion manual READ ONLY genera un unico JSON sin efectos laterales: ok");
    results.push("respaldo, aplicacion autorizada temporal y verificacion manual quedan probados: ok");
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
