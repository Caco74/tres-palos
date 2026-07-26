"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const https = require("https");

const preparar = require("./preparar-clausura-2026");

const ROOT = path.resolve(__dirname, "..");
const TORNEO_CLAUSURA_ID = 2;
const TORNEO_APERTURA_ID = 1;
const AUTHORIZATION_PHRASE = "AUTORIZO CARGA CLAUSURA 2026";
const PENDING_AUTHORIZATION = "PENDIENTE_AUTORIZACION";

const DEFAULT_MAP_PATH = path.join(
  ROOT,
  "data",
  "clausura-2026",
  "clubes-map.json"
);
const DEFAULT_SQL_PATH = path.join(ROOT, "sql", "cargar-clausura-2026.sql");
const DEFAULT_REPORT_PATH = path.join(
  ROOT,
  "reports",
  "clausura-2026-pre-carga.md"
);
const DEFAULT_BACKUP_DIR = path.join(ROOT, "respaldos");

const EXPECTED = {
  clausuraMatches: 114,
  clausuraByZone: { 1: 42, 2: 30, 3: 42 },
  mappedClubs: 20,
  aperturaMatches: 140,
  torneo: {
    id: TORNEO_CLAUSURA_ID,
    anio: 2026,
    tipo: "clausura",
    nombre: "Clausura 2026"
  },
  activeTournament: {
    id: TORNEO_APERTURA_ID,
    nombre: "Apertura 2026"
  },
  carcaranaId: 57
};

const SQL_RECORD_FIELDS = [
  "source_fixture_key",
  "torneo_id",
  "tipo",
  "fecha",
  "zona",
  "local_id",
  "visitante_id",
  "local",
  "visitante",
  "fecha_partido",
  "dia",
  "hora",
  "estadio",
  "arbitro",
  "estado",
  "goles_local",
  "goles_visitante",
  "penales_local",
  "penales_visitante",
  "fase",
  "numero_playoff",
  "source_local",
  "source_visitante"
];

const REMOTE_GETS = [
  "torneos",
  "clubes",
  "partidos clausura",
  "partidos apertura",
  "inscripciones clausura"
];

const BLOCKED_FLAGS = [
  "--apply",
  "--apply=",
  "--write-supabase",
  "--write-supabase=",
  "--execute",
  "--execute=",
  "--execute-sql",
  "--execute-sql=",
  "--insert",
  "--insert=",
  "--update",
  "--update=",
  "--delete",
  "--delete=",
  "--upsert",
  "--upsert="
];

function parseArgs(argv) {
  const options = {
    dryRun: true,
    remoteRead: false,
    writeSql: false,
    writeReport: false,
    backup: false,
    help: false,
    fixturePath: null,
    mapPath: DEFAULT_MAP_PATH,
    sqlPath: DEFAULT_SQL_PATH,
    reportPath: DEFAULT_REPORT_PATH,
    backupPath: null,
    torneoId: TORNEO_CLAUSURA_ID,
    authorization: null
  };

  argv.forEach(arg => {
    if (isBlockedFlag(arg)) {
      throw new Error(
        `Flag inseguro bloqueado: ${arg}. ` +
          "La carga no se ejecuta desde este script."
      );
    }
    if (arg === "--dry-run") {
      options.dryRun = true;
      return;
    }
    if (arg === "--remote-read") {
      options.remoteRead = true;
      return;
    }
    if (arg === "--write-sql") {
      options.writeSql = true;
      return;
    }
    if (arg === "--write-report") {
      options.writeReport = true;
      return;
    }
    if (arg === "--backup") {
      options.backup = true;
      options.remoteRead = true;
      return;
    }
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      return;
    }
    if (arg.indexOf("--fixture=") === 0) {
      options.fixturePath = path.resolve(ROOT, arg.slice("--fixture=".length));
      return;
    }
    if (arg.indexOf("--map=") === 0) {
      options.mapPath = path.resolve(ROOT, arg.slice("--map=".length));
      return;
    }
    if (arg.indexOf("--sql=") === 0) {
      options.sqlPath = path.resolve(ROOT, arg.slice("--sql=".length));
      return;
    }
    if (arg.indexOf("--report=") === 0) {
      options.reportPath = path.resolve(ROOT, arg.slice("--report=".length));
      return;
    }
    if (arg.indexOf("--backup-path=") === 0) {
      options.backupPath = path.resolve(
        ROOT,
        arg.slice("--backup-path=".length)
      );
      return;
    }
    if (arg.indexOf("--torneo-id=") === 0) {
      const id = Number(arg.slice("--torneo-id=".length));
      if (!Number.isInteger(id) || id <= 0) {
        throw new Error("El valor de --torneo-id debe ser un entero positivo.");
      }
      options.torneoId = id;
      return;
    }
    if (arg.indexOf("--autorizacion=") === 0) {
      options.authorization = arg.slice("--autorizacion=".length);
      return;
    }

    throw new Error(`Argumento no reconocido: ${arg}`);
  });

  if (options.torneoId !== TORNEO_CLAUSURA_ID) {
    throw new Error("Este mecanismo solo prepara torneo_id=2.");
  }

  return options;
}

function isBlockedFlag(arg) {
  return BLOCKED_FLAGS.some(flag =>
    flag.endsWith("=") ? arg.indexOf(flag) === 0 : arg === flag
  );
}

function usage() {
  return [
    "Uso:",
    "  node scripts/cargar-clausura-2026.js --dry-run --remote-read",
    "  node scripts/cargar-clausura-2026.js --remote-read --backup --write-sql --write-report",
    "",
    "Este script solo prepara artefactos y lecturas GET.",
    "No ejecuta INSERT, UPDATE, DELETE, UPSERT ni RPC de escritura."
  ].join("\n");
}

function requireAuthorizationPhrase(value) {
  if (value !== AUTHORIZATION_PHRASE) {
    throw new Error(
      `Autorizacion exacta requerida: ${AUTHORIZATION_PHRASE}`
    );
  }
  return true;
}

function hashFile(filePath) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(filePath))
    .digest("hex");
}

function normalizePath(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, "/");
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function buildContext(options = {}) {
  const fixturePath = options.fixturePath || preparar.findFixtureJson();
  const mapPath = options.mapPath || DEFAULT_MAP_PATH;
  const fixture = preparar.readJson(fixturePath);
  const mapData = preparar.readJson(mapPath);
  const local = preparar.validateFixture(fixture, mapData, {
    torneoId: TORNEO_CLAUSURA_ID
  });

  if (local.errors.length > 0) {
    const messages = local.errors.map(error => error.message).join("; ");
    throw new Error(`Fixture invalido para carga: ${messages}`);
  }

  const records = local.records.map(record => {
    const output = {};
    SQL_RECORD_FIELDS.forEach(field => {
      output[field] = Object.prototype.hasOwnProperty.call(record, field)
        ? record[field]
        : null;
    });
    return output;
  });

  const fixtureHash = hashFile(fixturePath);

  return {
    fixturePath,
    mapPath,
    fixture,
    mapData,
    local,
    records,
    fixtureInfo: {
      path: normalizePath(fixturePath),
      sha256: fixtureHash,
      size: fs.statSync(fixturePath).size,
      mtime: fs.statSync(fixturePath).mtime.toISOString()
    },
    mapInfo: {
      path: normalizePath(mapPath),
      sha256: hashFile(mapPath)
    }
  };
}

function expectedClubRows(mapData) {
  const rows = Array.isArray(mapData)
    ? mapData
    : Array.isArray(mapData.clubes)
      ? mapData.clubes
      : [];

  return rows.map(row => ({
    nombre_fuente: row.nombre_fuente,
    nombre_en_proyecto: row.nombre_en_proyecto,
    club_id: Number(row.club_id),
    zona_clausura: Number(row.zona),
    estado: row.estado
  }));
}

function extractPublicSupabaseConfig() {
  const text = fs.readFileSync(path.join(ROOT, "js", "config.js"), "utf8");
  const urlMatch = text.match(/SUPABASE_URL\s*=\s*"([^"]+)"/);
  const keyMatch = text.match(/SUPABASE_KEY\s*=\s*"([^"]+)"/);
  if (!urlMatch || !keyMatch) {
    throw new Error("No se pudo leer la configuracion publica de Supabase.");
  }
  return { url: urlMatch[1], key: keyMatch[1] };
}

function supabaseGet(config, restPath) {
  return new Promise((resolve, reject) => {
    const request = https.request(
      new URL(config.url + restPath),
      {
        method: "GET",
        headers: {
          apikey: config.key,
          Authorization: `Bearer ${config.key}`,
          "Content-Type": "application/json"
        }
      },
      response => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", chunk => {
          body += chunk;
        });
        response.on("end", () => {
          let data = null;
          try {
            data = body ? JSON.parse(body) : null;
          } catch (error) {
            reject(
              new Error(`Respuesta remota no JSON: HTTP ${response.statusCode}`)
            );
            return;
          }
          if (response.statusCode < 200 || response.statusCode >= 300) {
            const message = data && (data.message || data.error)
              ? data.message || data.error
              : `HTTP ${response.statusCode}`;
            reject(new Error(`Consulta remota fallida: ${message}`));
            return;
          }
          resolve(data);
        });
      }
    );
    request.on("error", reject);
    request.end();
  });
}

async function readRemoteSnapshot() {
  const config = extractPublicSupabaseConfig();
  const selectPartidos = [
    "id",
    "torneo_id",
    "tipo",
    "fase",
    "fecha",
    "zona",
    "local",
    "visitante",
    "local_id",
    "visitante_id",
    "estado",
    "goles_local",
    "goles_visitante",
    "penales_local",
    "penales_visitante",
    "fecha_partido",
    "dia",
    "hora",
    "estadio",
    "arbitro",
    "numero_playoff",
    "source_local",
    "source_visitante",
    "actualizado_en"
  ].join(",");

  const [
    torneos,
    clubes,
    clausuraPartidos,
    aperturaPartidos,
    clausuraInscripciones
  ] = await Promise.all([
    supabaseGet(
      config,
      "/rest/v1/torneos?select=id,anio,tipo,nombre,activo,fecha_inicio,fecha_fin,actualizado_en&order=id.asc"
    ),
    supabaseGet(
      config,
      "/rest/v1/clubes?select=id,nombre_oficial,nombre_corto,aliases,activo,zona,actualizado_en&order=id.asc"
    ),
    supabaseGet(
      config,
      `/rest/v1/partidos?select=${selectPartidos}&torneo_id=eq.${TORNEO_CLAUSURA_ID}&order=id.asc`
    ),
    supabaseGet(
      config,
      `/rest/v1/partidos?select=${selectPartidos}&torneo_id=eq.${TORNEO_APERTURA_ID}&order=id.asc`
    ),
    supabaseGet(
      config,
      `/rest/v1/inscripciones_jugadores?select=id,club_id,torneo_id,estado&torneo_id=eq.${TORNEO_CLAUSURA_ID}&order=id.asc`
    )
  ]);

  return {
    method: "GET",
    endpoints: REMOTE_GETS.slice(),
    torneos,
    clubes,
    clausuraPartidos,
    aperturaPartidos,
    clausuraInscripciones
  };
}

function summarizeApertura(partidos) {
  const byTipoFase = {};
  let regular = 0;
  let playoff = 0;
  let regularWithSource = 0;

  partidos.forEach(partido => {
    const tipo = String(partido.tipo || "null");
    const fase = String(partido.fase || "null");
    byTipoFase[`${tipo}|${fase}`] = (byTipoFase[`${tipo}|${fase}`] || 0) + 1;
    if (partido.tipo === "regular") {
      regular += 1;
      if (partido.source_local !== null || partido.source_visitante !== null) {
        regularWithSource += 1;
      }
    }
    if (partido.tipo === "playoff") playoff += 1;
  });

  return {
    total: partidos.length,
    regular,
    playoff,
    byTipoFase,
    regularWithSource
  };
}

function analyzePreload(records, existingRows) {
  const analysis = preparar.analyzeExisting(records, existingRows);
  const expectedKeys = new Set(records.map(preparar.logicalKey));
  const existing = Array.isArray(existingRows) ? existingRows : [];
  const unmatched = existing.filter(row => {
    if (row.tipo !== "regular") return true;
    return !expectedKeys.has(preparar.logicalKey({
      torneo_id: row.torneo_id,
      tipo: row.tipo,
      fecha: row.fecha,
      zona: row.zona,
      local_id: row.local_id,
      visitante_id: row.visitante_id
    }));
  });
  const blocking = [];

  if (analysis.duplicates.length > 0) {
    blocking.push("Hay duplicados remotos para la clave logica.");
  }
  if (analysis.conflicts.length > 0) {
    blocking.push("Hay partidos existentes con diferencias.");
  }
  if (unmatched.length > 0) {
    blocking.push("Hay partidos remotos no esperados para el Clausura.");
  }
  if (
    existing.length > 0 &&
    !(existing.length === records.length && analysis.identical.length === records.length)
  ) {
    blocking.push("El estado remoto parece parcial o no corresponde al fixture completo.");
  }

  return {
    existingCount: existing.length,
    newRecords: analysis.newRecords.length,
    identical: analysis.identical.length,
    conflicts: analysis.conflicts.length,
    duplicates: analysis.duplicates.length,
    unmatched: unmatched.length,
    blocking
  };
}

function validateRemoteSnapshot(remote, context) {
  const errors = [];
  const warnings = [];
  const torneos = Array.isArray(remote.torneos) ? remote.torneos : [];
  const clubes = Array.isArray(remote.clubes) ? remote.clubes : [];
  const aperturaPartidos = Array.isArray(remote.aperturaPartidos)
    ? remote.aperturaPartidos
    : [];
  const clausuraPartidos = Array.isArray(remote.clausuraPartidos)
    ? remote.clausuraPartidos
    : [];
  const torneo = torneos.find(item => Number(item.id) === TORNEO_CLAUSURA_ID);
  const activeTorneos = torneos.filter(item => item.activo === true);
  const apertura = torneos.find(item => Number(item.id) === TORNEO_APERTURA_ID);
  const clubsById = new Map(clubes.map(club => [Number(club.id), club]));
  const expectedClubs = expectedClubRows(context.mapData);
  const mappedRows = [];

  if (!torneo) {
    errors.push("No existe torneo_id=2.");
  } else {
    if (Number(torneo.id) !== EXPECTED.torneo.id) {
      errors.push("El torneo remoto no tiene id 2.");
    }
    if (Number(torneo.anio) !== EXPECTED.torneo.anio) {
      errors.push("El torneo remoto no es anio 2026.");
    }
    if (torneo.tipo !== EXPECTED.torneo.tipo) {
      errors.push("El torneo remoto no es tipo clausura.");
    }
    if (torneo.nombre !== EXPECTED.torneo.nombre) {
      errors.push("El torneo remoto no se llama Clausura 2026.");
    }
    if (torneo.activo !== false) {
      errors.push("El Clausura no debe estar activo todavia.");
    }
  }

  if (
    !apertura ||
    apertura.nombre !== EXPECTED.activeTournament.nombre ||
    apertura.activo !== true
  ) {
    errors.push("El torneo activo actual no es Apertura 2026 id 1.");
  }
  if (
    activeTorneos.length !== 1 ||
    Number(activeTorneos[0].id) !== EXPECTED.activeTournament.id
  ) {
    errors.push("Hay un torneo activo distinto del Apertura 2026 id 1.");
  }

  expectedClubs.forEach(expected => {
    const club = clubsById.get(Number(expected.club_id));
    if (!club) {
      errors.push(`Falta club remoto id ${expected.club_id}.`);
      return;
    }
    mappedRows.push({
      id: club.id,
      nombre_oficial: club.nombre_oficial,
      nombre_esperado: expected.nombre_en_proyecto,
      nombre_fuente: expected.nombre_fuente,
      zona_actual: club.zona,
      zona_clausura: expected.zona_clausura,
      activo: club.activo
    });
    if (
      preparar.normalizeClubName(club.nombre_oficial) !==
      preparar.normalizeClubName(expected.nombre_en_proyecto)
    ) {
      errors.push(`El club remoto ${expected.club_id} no coincide con el mapeo.`);
    }
    if (club.activo === false) {
      errors.push(`El club remoto ${expected.club_id} esta inactivo.`);
    }
  });

  if (mappedRows.length !== EXPECTED.mappedClubs) {
    errors.push(`Clubes mapeados remotos: ${mappedRows.length}.`);
  }

  const carcaranaInFixture = context.records.filter(record =>
    Number(record.local_id) === EXPECTED.carcaranaId ||
    Number(record.visitante_id) === EXPECTED.carcaranaId ||
    preparar.normalizeClubName(record.local).indexOf("carcarana") >= 0 ||
    preparar.normalizeClubName(record.visitante).indexOf("carcarana") >= 0
  );
  if (carcaranaInFixture.length > 0) {
    errors.push("Carcarana aparece en los registros a cargar.");
  }

  const preload = analyzePreload(context.records, clausuraPartidos);
  if (preload.existingCount !== 0) {
    errors.push("El Clausura ya tiene partidos; la primera carga debe iniciar en 0.");
  }
  preload.blocking.forEach(message => errors.push(message));

  const aperturaSummary = summarizeApertura(aperturaPartidos);
  if (aperturaSummary.total !== EXPECTED.aperturaMatches) {
    errors.push(`Apertura tiene ${aperturaSummary.total} partidos; se esperaban 140.`);
  }
  if (aperturaSummary.regularWithSource !== 0) {
    errors.push("La fase regular del Apertura usa source_local/source_visitante.");
  }

  const localZones = context.local.counts.matchesByZone;
  Object.keys(EXPECTED.clausuraByZone).forEach(zone => {
    if ((localZones[zone] || 0) !== EXPECTED.clausuraByZone[zone]) {
      errors.push(`Zona ${zone} tiene conteo local inesperado.`);
    }
  });

  if (context.records.length !== EXPECTED.clausuraMatches) {
    errors.push(`Registros construidos: ${context.records.length}.`);
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    torneo,
    activeTorneos,
    mappedRows,
    preload,
    aperturaSummary,
    clausuraInscripciones: Array.isArray(remote.clausuraInscripciones)
      ? remote.clausuraInscripciones.length
      : null
  };
}

function checksumRows(rows) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(rows))
    .digest("hex");
}

function timestampForFile(date = new Date()) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function defaultBackupPath(date = new Date()) {
  return path.join(
    DEFAULT_BACKUP_DIR,
    `clausura-2026-pre-carga-${timestampForFile(date)}.json`
  );
}

function writeBackup(remote, validation, context, backupPath = null) {
  const target = backupPath || defaultBackupPath();
  const payload = {
    metadata: {
      tipo: "pre-carga-clausura-2026",
      generado_en: new Date().toISOString(),
      metodo: "Supabase REST publico, solo GET",
      escrituras_supabase: 0,
      fixture: context.fixtureInfo,
      map: context.mapInfo
    },
    torneo_clausura: validation.torneo || null,
    partidos_clausura: {
      count: remote.clausuraPartidos.length,
      rows: remote.clausuraPartidos
    },
    apertura: {
      count: validation.aperturaSummary.total,
      regular: validation.aperturaSummary.regular,
      playoff: validation.aperturaSummary.playoff,
      by_tipo_fase: validation.aperturaSummary.byTipoFase,
      checksum: checksumRows(remote.aperturaPartidos)
    },
    clubes_mapeados: {
      count: validation.mappedRows.length,
      rows: validation.mappedRows
    },
    checks: {
      clausura_sin_partidos: remote.clausuraPartidos.length === 0,
      apertura_140: validation.aperturaSummary.total === EXPECTED.aperturaMatches,
      clubes_20: validation.mappedRows.length === EXPECTED.mappedClubs,
      carcarana_en_fixture: false,
      fixture_sha256: context.fixtureInfo.sha256
    }
  };

  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return target;
}

function sqlJson(value) {
  return JSON.stringify(value, null, 2).replace(/[^\x00-\x7F]/g, char => {
    const code = char.codePointAt(0);
    if (code <= 0xffff) return `\\u${code.toString(16).padStart(4, "0")}`;
    const offset = code - 0x10000;
    const high = 0xd800 + (offset >> 10);
    const low = 0xdc00 + (offset & 0x3ff);
    return `\\u${high.toString(16).padStart(4, "0")}\\u${low
      .toString(16)
      .padStart(4, "0")}`;
  });
}

function buildLoadSql(context) {
  const recordsJson = sqlJson(context.records);
  const clubsJson = sqlJson(expectedClubRows(context.mapData));

  return `begin;

-- Carga transaccional Clausura 2026.
-- Estado inicial requerido: torneo_id=2 sin partidos y Apertura id=1 con 140 partidos.
-- Proteccion: este SQL falla hasta reemplazar el literal PENDIENTE_AUTORIZACION
-- por la frase exacta autorizada por el usuario.

do $$
declare
  v_autorizacion constant text := '${PENDING_AUTHORIZATION}';
  v_fixture constant jsonb := $fixture_json$
${recordsJson}
$fixture_json$::jsonb;
  v_expected_clubs constant jsonb := $clubs_json$
${clubsJson}
$clubs_json$::jsonb;
  v_torneo public.torneos%rowtype;
  v_inserted integer := 0;
  v_total_before integer := 0;
  v_total_after integer := 0;
  v_existing_matched integer := 0;
  v_existing_identical integer := 0;
  v_existing_unmatched integer := 0;
  v_existing_duplicate_keys integer := 0;
  v_conflicts integer := 0;
  v_bad integer := 0;
  v_apertura_total_before integer := 0;
  v_apertura_total_after integer := 0;
  v_historical_checksum_before text := '';
  v_historical_checksum_after text := '';
  v_clubes_zona_checksum_before text := '';
  v_clubes_zona_checksum_after text := '';
begin
  if v_autorizacion is distinct from '${AUTHORIZATION_PHRASE}' then
    raise exception 'Autorizacion exacta requerida antes de cargar Clausura 2026.';
  end if;

  perform pg_advisory_xact_lock(hashtext('tres-palos:cargar-clausura-2026:torneo:2'));

  select *
  into v_torneo
  from public.torneos
  where id = 2
  for update;

  if not found then
    raise exception 'No existe torneo_id=2.';
  end if;

  if v_torneo.anio <> 2026
    or v_torneo.tipo <> 'clausura'
    or v_torneo.nombre <> 'Clausura 2026'
  then
    raise exception 'torneo_id=2 no corresponde a Clausura 2026.';
  end if;

  if v_torneo.activo is not false then
    raise exception 'El Clausura no debe estar activo antes de esta carga.';
  end if;

  if not exists (
    select 1
    from public.torneos
    where id = 1
      and anio = 2026
      and tipo = 'apertura'
      and nombre = 'Apertura 2026'
      and activo is true
  ) then
    raise exception 'El torneo activo actual no es Apertura 2026 id 1.';
  end if;

  select count(*)
  into v_bad
  from jsonb_to_recordset(v_expected_clubs) as expected(
    nombre_fuente text,
    nombre_en_proyecto text,
    club_id bigint,
    zona_clausura integer,
    estado text
  )
  left join public.clubes club
    on club.id = expected.club_id
  where club.id is null
    or club.nombre_oficial is distinct from expected.nombre_en_proyecto
    or club.activo is false
    or expected.estado is distinct from 'confirmado';

  if v_bad <> 0 then
    raise exception 'Hay % club(es) esperados sin mapeo remoto confirmado.', v_bad;
  end if;

  select count(*)
  into v_bad
  from jsonb_to_recordset(v_expected_clubs) as expected(
    nombre_fuente text,
    nombre_en_proyecto text,
    club_id bigint,
    zona_clausura integer,
    estado text
  );

  if v_bad <> 20 then
    raise exception 'Se esperaban 20 clubes mapeados y hay %.', v_bad;
  end if;

  select count(*)
  into v_bad
  from jsonb_to_recordset(v_fixture) as fixture(
    source_fixture_key text,
    torneo_id bigint,
    tipo text,
    fecha integer,
    zona text,
    local_id integer,
    visitante_id integer,
    local text,
    visitante text,
    fecha_partido date,
    dia text,
    hora text,
    estadio text,
    arbitro text,
    estado text,
    goles_local integer,
    goles_visitante integer,
    penales_local integer,
    penales_visitante integer,
    fase text,
    numero_playoff integer,
    source_local text,
    source_visitante text
  )
  where fixture.torneo_id <> 2
    or fixture.tipo <> 'regular'
    or fixture.fecha is null
    or fixture.zona not in ('1', '2', '3')
    or fixture.local_id is null
    or fixture.visitante_id is null
    or fixture.local_id = fixture.visitante_id
    or fixture.local is null
    or fixture.visitante is null
    or fixture.local = fixture.visitante
    or fixture.fecha_partido is not null
    or fixture.dia is not null
    or fixture.hora is not null
    or fixture.estadio is not null
    or fixture.arbitro is not null
    or fixture.estado <> 'programado'
    or fixture.goles_local is not null
    or fixture.goles_visitante is not null
    or fixture.penales_local is not null
    or fixture.penales_visitante is not null
    or fixture.fase is not null
    or fixture.numero_playoff is not null
    or fixture.source_local is not null
    or fixture.source_visitante is not null
    or fixture.local_id = 57
    or fixture.visitante_id = 57;

  if v_bad <> 0 then
    raise exception 'Hay % registro(s) del fixture con campos iniciales invalidos.', v_bad;
  end if;

  select count(*)
  into v_bad
  from jsonb_to_recordset(v_fixture) as fixture(
    source_fixture_key text,
    torneo_id bigint,
    tipo text,
    fecha integer,
    zona text,
    local_id integer,
    visitante_id integer,
    local text,
    visitante text,
    fecha_partido date,
    dia text,
    hora text,
    estadio text,
    arbitro text,
    estado text,
    goles_local integer,
    goles_visitante integer,
    penales_local integer,
    penales_visitante integer,
    fase text,
    numero_playoff integer,
    source_local text,
    source_visitante text
  );

  if v_bad <> 114 then
    raise exception 'Se esperaban 114 registros del fixture y hay %.', v_bad;
  end if;

  select count(*)
  into v_bad
  from (
    select torneo_id, tipo, fecha, zona, local_id, visitante_id
    from jsonb_to_recordset(v_fixture) as fixture(
      source_fixture_key text,
      torneo_id bigint,
      tipo text,
      fecha integer,
      zona text,
      local_id integer,
      visitante_id integer,
      local text,
      visitante text,
      fecha_partido date,
      dia text,
      hora text,
      estadio text,
      arbitro text,
      estado text,
      goles_local integer,
      goles_visitante integer,
      penales_local integer,
      penales_visitante integer,
      fase text,
      numero_playoff integer,
      source_local text,
      source_visitante text
    )
    group by torneo_id, tipo, fecha, zona, local_id, visitante_id
    having count(*) > 1
  ) duplicated_fixture;

  if v_bad <> 0 then
    raise exception 'El fixture contiene % clave(s) logicas duplicadas.', v_bad;
  end if;

  select count(*)
  into v_apertura_total_before
  from public.partidos
  where torneo_id = 1;

  if v_apertura_total_before <> 140 then
    raise exception 'Apertura 2026 debe tener 140 partidos antes de cargar; tiene %.', v_apertura_total_before;
  end if;

  if (
    select count(*)
    from public.partidos
    where torneo_id = 1
      and tipo = 'regular'
      and (
        source_local is not null
        or source_visitante is not null
      )
  ) <> 0 then
    raise exception 'La fase regular del Apertura usa source_local/source_visitante; revisar convencion antes de cargar.';
  end if;

  select md5(coalesce(string_agg(to_jsonb(partido)::text, '|' order by partido.id), ''))
  into v_historical_checksum_before
  from public.partidos partido
  where partido.torneo_id is distinct from 2;

  select md5(coalesce(string_agg((club.id::text || ':' || club.zona::text), '|' order by club.id), ''))
  into v_clubes_zona_checksum_before
  from public.clubes club;

  select count(*)
  into v_total_before
  from public.partidos
  where torneo_id = 2;

  select count(*)
  into v_existing_duplicate_keys
  from (
    select torneo_id, tipo, fecha, zona, local_id, visitante_id
    from public.partidos
    where torneo_id = 2
      and tipo = 'regular'
    group by torneo_id, tipo, fecha, zona, local_id, visitante_id
    having count(*) > 1
  ) duplicated_existing;

  if v_existing_duplicate_keys <> 0 then
    raise exception 'El Clausura ya tiene % clave(s) logicas duplicadas.', v_existing_duplicate_keys;
  end if;

  with fixture as (
    select *
    from jsonb_to_recordset(v_fixture) as item(
      source_fixture_key text,
      torneo_id bigint,
      tipo text,
      fecha integer,
      zona text,
      local_id integer,
      visitante_id integer,
      local text,
      visitante text,
      fecha_partido date,
      dia text,
      hora text,
      estadio text,
      arbitro text,
      estado text,
      goles_local integer,
      goles_visitante integer,
      penales_local integer,
      penales_visitante integer,
      fase text,
      numero_playoff integer,
      source_local text,
      source_visitante text
    )
  ),
  matched as (
    select
      fixture.*,
      partido.id as partido_id,
      partido.fecha_partido as p_fecha_partido,
      partido.dia as p_dia,
      partido.hora as p_hora,
      partido.estadio as p_estadio,
      partido.arbitro as p_arbitro,
      partido.estado as p_estado,
      partido.goles_local as p_goles_local,
      partido.goles_visitante as p_goles_visitante,
      partido.penales_local as p_penales_local,
      partido.penales_visitante as p_penales_visitante,
      partido.fase as p_fase,
      partido.numero_playoff as p_numero_playoff,
      partido.local as p_local,
      partido.visitante as p_visitante,
      partido.source_local as p_source_local,
      partido.source_visitante as p_source_visitante
    from fixture
    join public.partidos partido
      on partido.torneo_id = fixture.torneo_id
      and partido.tipo = fixture.tipo
      and partido.fecha = fixture.fecha
      and partido.zona = fixture.zona
      and partido.local_id = fixture.local_id
      and partido.visitante_id = fixture.visitante_id
  )
  select
    count(*),
    count(*) filter (
      where p_local is not distinct from local
        and p_visitante is not distinct from visitante
        and p_fecha_partido is not distinct from fecha_partido
        and p_dia is not distinct from dia
        and p_hora is not distinct from hora
        and p_estadio is not distinct from estadio
        and p_arbitro is not distinct from arbitro
        and p_estado is not distinct from estado
        and p_goles_local is not distinct from goles_local
        and p_goles_visitante is not distinct from goles_visitante
        and p_penales_local is not distinct from penales_local
        and p_penales_visitante is not distinct from penales_visitante
        and p_fase is not distinct from fase
        and p_numero_playoff is not distinct from numero_playoff
        and p_source_local is not distinct from source_local
        and p_source_visitante is not distinct from source_visitante
    )
  into v_existing_matched, v_existing_identical
  from matched;

  v_conflicts := v_existing_matched - v_existing_identical;

  with fixture as (
    select *
    from jsonb_to_recordset(v_fixture) as item(
      source_fixture_key text,
      torneo_id bigint,
      tipo text,
      fecha integer,
      zona text,
      local_id integer,
      visitante_id integer,
      local text,
      visitante text,
      fecha_partido date,
      dia text,
      hora text,
      estadio text,
      arbitro text,
      estado text,
      goles_local integer,
      goles_visitante integer,
      penales_local integer,
      penales_visitante integer,
      fase text,
      numero_playoff integer,
      source_local text,
      source_visitante text
    )
  )
  select count(*)
  into v_existing_unmatched
  from public.partidos partido
  where partido.torneo_id = 2
    and not exists (
      select 1
      from fixture
      where fixture.torneo_id = partido.torneo_id
        and fixture.tipo = partido.tipo
        and fixture.fecha = partido.fecha
        and fixture.zona = partido.zona
        and fixture.local_id = partido.local_id
        and fixture.visitante_id = partido.visitante_id
    );

  if v_conflicts <> 0 then
    raise exception 'Hay % partido(s) existentes con diferencias.', v_conflicts;
  end if;

  if v_existing_unmatched <> 0 then
    raise exception 'Hay % partido(s) no esperados en Clausura.', v_existing_unmatched;
  end if;

  if v_total_before not in (0, 114) then
    raise exception 'Estado parcial del Clausura: % partido(s) antes de cargar.', v_total_before;
  end if;

  if v_total_before = 114 and v_existing_identical <> 114 then
    raise exception 'El Clausura tiene 114 partidos, pero no coinciden exactamente con el fixture.';
  end if;

  if v_total_before = 0 then
    insert into public.partidos (
      torneo_id,
      tipo,
      fecha,
      zona,
      local_id,
      visitante_id,
      local,
      visitante,
      fecha_partido,
      dia,
      hora,
      estadio,
      arbitro,
      estado,
      goles_local,
      goles_visitante,
      penales_local,
      penales_visitante,
      fase,
      numero_playoff,
      source_local,
      source_visitante
    )
    select
      fixture.torneo_id,
      fixture.tipo,
      fixture.fecha,
      fixture.zona,
      fixture.local_id,
      fixture.visitante_id,
      fixture.local,
      fixture.visitante,
      fixture.fecha_partido,
      fixture.dia,
      fixture.hora,
      fixture.estadio,
      fixture.arbitro,
      fixture.estado,
      fixture.goles_local,
      fixture.goles_visitante,
      fixture.penales_local,
      fixture.penales_visitante,
      fixture.fase,
      fixture.numero_playoff,
      fixture.source_local,
      fixture.source_visitante
    from jsonb_to_recordset(v_fixture) as fixture(
      source_fixture_key text,
      torneo_id bigint,
      tipo text,
      fecha integer,
      zona text,
      local_id integer,
      visitante_id integer,
      local text,
      visitante text,
      fecha_partido date,
      dia text,
      hora text,
      estadio text,
      arbitro text,
      estado text,
      goles_local integer,
      goles_visitante integer,
      penales_local integer,
      penales_visitante integer,
      fase text,
      numero_playoff integer,
      source_local text,
      source_visitante text
    )
    where not exists (
      select 1
      from public.partidos partido
      where partido.torneo_id = fixture.torneo_id
        and partido.tipo = fixture.tipo
        and partido.fecha = fixture.fecha
        and partido.zona = fixture.zona
        and partido.local_id = fixture.local_id
        and partido.visitante_id = fixture.visitante_id
    );

    get diagnostics v_inserted = row_count;

    if v_inserted <> 114 then
      raise exception 'La insercion debia crear 114 partidos y creo %.', v_inserted;
    end if;
  end if;

  if v_total_before = 114 and v_inserted <> 0 then
    raise exception 'La re-ejecucion idempotente no debe insertar registros.';
  end if;

  select count(*)
  into v_total_after
  from public.partidos
  where torneo_id = 2;

  if v_total_after <> 114 then
    raise exception 'Post-carga invalida: Clausura tiene % partidos.', v_total_after;
  end if;

  select count(*)
  into v_bad
  from public.partidos
  where torneo_id = 2
    and tipo = 'regular'
    and (
      fase is not null
      or estado <> 'programado'
      or goles_local is not null
      or goles_visitante is not null
      or penales_local is not null
      or penales_visitante is not null
      or fecha_partido is not null
      or dia is not null
      or hora is not null
      or estadio is not null
      or arbitro is not null
      or numero_playoff is not null
      or source_local is not null
      or source_visitante is not null
      or local_id = visitante_id
      or local = visitante
    );

  if v_bad <> 0 then
    raise exception 'Post-carga invalida: % partido(s) tienen campos no esperados.', v_bad;
  end if;

  if (select count(*) from public.partidos where torneo_id = 2 and tipo = 'regular') <> 114 then
    raise exception 'Post-carga invalida: no todos los partidos son regulares.';
  end if;

  if (select count(*) from public.partidos where torneo_id = 2 and zona = '1') <> 42 then
    raise exception 'Post-carga invalida: Zona 1 no tiene 42 partidos.';
  end if;

  if (select count(*) from public.partidos where torneo_id = 2 and zona = '2') <> 30 then
    raise exception 'Post-carga invalida: Zona 2 no tiene 30 partidos.';
  end if;

  if (select count(*) from public.partidos where torneo_id = 2 and zona = '3') <> 42 then
    raise exception 'Post-carga invalida: Zona 3 no tiene 42 partidos.';
  end if;

  if (
    select count(*)
    from (
      select torneo_id, tipo, fecha, zona, local_id, visitante_id
      from public.partidos
      where torneo_id = 2
        and tipo = 'regular'
      group by torneo_id, tipo, fecha, zona, local_id, visitante_id
      having count(*) > 1
    ) duplicated_after
  ) <> 0 then
    raise exception 'Post-carga invalida: hay duplicados por clave logica.';
  end if;

  if (
    select count(*)
    from public.partidos
    where torneo_id = 2
      and (
        local_id = 57
        or visitante_id = 57
        or local ilike '%Carcara%'
        or visitante ilike '%Carcara%'
      )
  ) <> 0 then
    raise exception 'Post-carga invalida: Carcarana aparece en Clausura.';
  end if;

  with fixture as (
    select *
    from jsonb_to_recordset(v_fixture) as item(
      source_fixture_key text,
      torneo_id bigint,
      tipo text,
      fecha integer,
      zona text,
      local_id integer,
      visitante_id integer,
      local text,
      visitante text,
      fecha_partido date,
      dia text,
      hora text,
      estadio text,
      arbitro text,
      estado text,
      goles_local integer,
      goles_visitante integer,
      penales_local integer,
      penales_visitante integer,
      fase text,
      numero_playoff integer,
      source_local text,
      source_visitante text
    )
  )
  select count(*)
  into v_bad
  from fixture
  where not exists (
    select 1
    from public.partidos partido
    where partido.torneo_id = fixture.torneo_id
      and partido.tipo = fixture.tipo
      and partido.fecha = fixture.fecha
      and partido.zona = fixture.zona
      and partido.local_id = fixture.local_id
      and partido.visitante_id = fixture.visitante_id
      and partido.local is not distinct from fixture.local
      and partido.visitante is not distinct from fixture.visitante
      and partido.estado is not distinct from fixture.estado
      and partido.goles_local is not distinct from fixture.goles_local
      and partido.goles_visitante is not distinct from fixture.goles_visitante
      and partido.penales_local is not distinct from fixture.penales_local
      and partido.penales_visitante is not distinct from fixture.penales_visitante
      and partido.fase is not distinct from fixture.fase
      and partido.numero_playoff is not distinct from fixture.numero_playoff
      and partido.fecha_partido is not distinct from fixture.fecha_partido
      and partido.dia is not distinct from fixture.dia
      and partido.hora is not distinct from fixture.hora
      and partido.estadio is not distinct from fixture.estadio
      and partido.arbitro is not distinct from fixture.arbitro
      and partido.source_local is not distinct from fixture.source_local
      and partido.source_visitante is not distinct from fixture.source_visitante
  );

  if v_bad <> 0 then
    raise exception 'Post-carga invalida: faltan % partido(s) esperados.', v_bad;
  end if;

  select count(*)
  into v_apertura_total_after
  from public.partidos
  where torneo_id = 1;

  if v_apertura_total_after <> 140
    or v_apertura_total_after <> v_apertura_total_before
  then
    raise exception 'Apertura fue alterado: antes %, despues %.', v_apertura_total_before, v_apertura_total_after;
  end if;

  select md5(coalesce(string_agg(to_jsonb(partido)::text, '|' order by partido.id), ''))
  into v_historical_checksum_after
  from public.partidos partido
  where partido.torneo_id is distinct from 2;

  if v_historical_checksum_after is distinct from v_historical_checksum_before then
    raise exception 'Algun partido historico fue actualizado.';
  end if;

  select md5(coalesce(string_agg((club.id::text || ':' || club.zona::text), '|' order by club.id), ''))
  into v_clubes_zona_checksum_after
  from public.clubes club;

  if v_clubes_zona_checksum_after is distinct from v_clubes_zona_checksum_before then
    raise exception 'clubes.zona fue modificado.';
  end if;

  raise notice 'Carga Clausura 2026 verificada. Insertados: %, total Clausura: %, Apertura: %.',
    v_inserted,
    v_total_after,
    v_apertura_total_after;
end;
$$;

commit;
`;
}

function buildPostVerificationSql() {
  return `-- Verificacion posterior solo lectura - Clausura 2026.
-- Ejecutar despues de una carga autorizada.

with partidos_clausura as (
  select *
  from public.partidos
  where torneo_id = 2
)
select 'total_clausura_114' as chequeo, count(*)::text as valor, count(*) = 114 as ok
from partidos_clausura
union all
select 'zona_1_42', count(*) filter (where zona = '1')::text, count(*) filter (where zona = '1') = 42
from partidos_clausura
union all
select 'zona_2_30', count(*) filter (where zona = '2')::text, count(*) filter (where zona = '2') = 30
from partidos_clausura
union all
select 'zona_3_42', count(*) filter (where zona = '3')::text, count(*) filter (where zona = '3') = 42
from partidos_clausura
union all
select 'todos_torneo_id_2', count(*) filter (where torneo_id = 2)::text, count(*) filter (where torneo_id = 2) = 114
from partidos_clausura
union all
select 'todos_regular', count(*) filter (where tipo = 'regular')::text, count(*) filter (where tipo = 'regular') = 114
from partidos_clausura
union all
select 'todos_fase_null', count(*) filter (where fase is null)::text, count(*) filter (where fase is null) = 114
from partidos_clausura
union all
select 'todos_programados', count(*) filter (where estado = 'programado')::text, count(*) filter (where estado = 'programado') = 114
from partidos_clausura
union all
select 'todos_sin_goles', count(*) filter (where goles_local is null and goles_visitante is null)::text, count(*) filter (where goles_local is null and goles_visitante is null) = 114
from partidos_clausura
union all
select 'todos_sin_penales', count(*) filter (where penales_local is null and penales_visitante is null)::text, count(*) filter (where penales_local is null and penales_visitante is null) = 114
from partidos_clausura
union all
select 'todos_sin_fecha_hora_estadio', count(*) filter (
  where fecha_partido is null and dia is null and hora is null and estadio is null and arbitro is null
)::text, count(*) filter (
  where fecha_partido is null and dia is null and hora is null and estadio is null and arbitro is null
) = 114
from partidos_clausura
union all
select 'todos_source_null', count(*) filter (where source_local is null and source_visitante is null)::text, count(*) filter (where source_local is null and source_visitante is null) = 114
from partidos_clausura
union all
select 'sin_local_igual_visitante', count(*) filter (where local_id = visitante_id or local = visitante)::text, count(*) filter (where local_id = visitante_id or local = visitante) = 0
from partidos_clausura
union all
select 'carcarana_0', count(*) filter (
  where local_id = 57 or visitante_id = 57 or local ilike '%Carcara%' or visitante ilike '%Carcara%'
)::text, count(*) filter (
  where local_id = 57 or visitante_id = 57 or local ilike '%Carcara%' or visitante ilike '%Carcara%'
) = 0
from partidos_clausura
union all
select 'duplicados_0', count(*)::text, count(*) = 0
from (
  select torneo_id, tipo, fecha, zona, local_id, visitante_id
  from public.partidos
  where torneo_id = 2
    and tipo = 'regular'
  group by torneo_id, tipo, fecha, zona, local_id, visitante_id
  having count(*) > 1
) duplicados
union all
select 'apertura_140', count(*)::text, count(*) = 140
from public.partidos
where torneo_id = 1
union all
select 'clausura_no_activo', count(*)::text, count(*) = 1
from public.torneos
where id = 2
  and anio = 2026
  and tipo = 'clausura'
  and nombre = 'Clausura 2026'
  and activo is false
union all
select 'apertura_activo', count(*)::text, count(*) = 1
from public.torneos
where id = 1
  and anio = 2026
  and tipo = 'apertura'
  and nombre = 'Apertura 2026'
  and activo is true;
`;
}

function buildFixtureRecordsetSql(aliasName, sourceExpression = "v_fixture") {
  return `jsonb_to_recordset(${sourceExpression}) as ${aliasName}(
    source_fixture_key text,
    torneo_id bigint,
    tipo text,
    fecha integer,
    zona text,
    local_id integer,
    visitante_id integer,
    local text,
    visitante text,
    fecha_partido date,
    dia text,
    hora text,
    estadio text,
    arbitro text,
    estado text,
    goles_local integer,
    goles_visitante integer,
    penales_local integer,
    penales_visitante integer,
    fase text,
    numero_playoff integer,
    source_local text,
    source_visitante text
  )`;
}

function buildPrevalidationSqlLegacy(context) {
  const recordsJson = sqlJson(context.records);
  const clubsJson = sqlJson(expectedClubRows(context.mapData));
  const fixtureRecordset = buildFixtureRecordsetSql("item", "fixture_json.data");

  return `-- Prevalidacion solo lectura - Clausura 2026.
-- Ejecutar en Supabase SQL Editor antes de reintentar la carga.
-- No modifica datos remotos.

do $$
declare
  v_fixture constant jsonb := $fixture_json$
${recordsJson}
$fixture_json$::jsonb;
  v_expected_clubs constant jsonb := $clubs_json$
${clubsJson}
$clubs_json$::jsonb;
  v_bad integer := 0;
  v_type_errors text := null;
begin
  if not exists (
    select 1
    from public.torneos
    where id = 2
      and anio = 2026
      and tipo = 'clausura'
      and nombre = 'Clausura 2026'
      and activo is false
  ) then
    raise exception 'Prevalidacion: torneo_id=2 no corresponde a Clausura 2026 inactivo.';
  end if;

  if not exists (
    select 1
    from public.torneos
    where id = 1
      and anio = 2026
      and tipo = 'apertura'
      and nombre = 'Apertura 2026'
      and activo is true
  ) then
    raise exception 'Prevalidacion: Apertura 2026 id 1 no es el torneo activo.';
  end if;

  select count(*)
  into v_bad
  from public.partidos
  where torneo_id = 2;

  if v_bad <> 0 then
    raise exception 'Prevalidacion: Clausura ya tiene % partido(s).', v_bad;
  end if;

  select count(*)
  into v_bad
  from public.partidos
  where torneo_id = 1;

  if v_bad <> 140 then
    raise exception 'Prevalidacion: Apertura debe tener 140 partidos y tiene %.', v_bad;
  end if;

  select count(*)
  into v_bad
  from public.partidos
  where torneo_id = 1
    and tipo = 'regular'
    and (
      source_local is not null
      or source_visitante is not null
    );

  if v_bad <> 0 then
    raise exception 'Prevalidacion: la fase regular del Apertura usa source_local/source_visitante.';
  end if;

  select count(*)
  into v_bad
  from jsonb_to_recordset(v_expected_clubs) as expected(
    nombre_fuente text,
    nombre_en_proyecto text,
    club_id bigint,
    zona_clausura integer,
    estado text
  )
  left join public.clubes club
    on club.id = expected.club_id
  where club.id is null
    or club.nombre_oficial is distinct from expected.nombre_en_proyecto
    or club.activo is false
    or expected.estado is distinct from 'confirmado';

  if v_bad <> 0 then
    raise exception 'Prevalidacion: hay % club(es) esperados sin mapeo remoto confirmado.', v_bad;
  end if;

  with fixture as (
    select *
    from ${fixtureRecordset}
  )
  select count(*)
  into v_bad
  from fixture;

  if v_bad <> 114 then
    raise exception 'Prevalidacion: el fixture debe tener 114 registros y tiene %.', v_bad;
  end if;

  with fixture as (
    select *
    from ${fixtureRecordset}
  )
  select count(*)
  into v_bad
  from fixture
  where torneo_id <> 2
    or tipo <> 'regular'
    or fecha is null
    or zona not in ('1', '2', '3')
    or local_id is null
    or visitante_id is null
    or local_id = visitante_id
    or local is null
    or visitante is null
    or fecha_partido is not null
    or dia is not null
    or hora is not null
    or estadio is not null
    or arbitro is not null
    or estado <> 'programado'
    or goles_local is not null
    or goles_visitante is not null
    or penales_local is not null
    or penales_visitante is not null
    or fase is not null
    or numero_playoff is not null
    or source_local is not null
    or source_visitante is not null
    or local_id = 57
    or visitante_id = 57;

  if v_bad <> 0 then
    raise exception 'Prevalidacion: hay % registro(s) del fixture con campos invalidos.', v_bad;
  end if;

  with fixture as (
    select *
    from ${fixtureRecordset}
  )
  select count(*)
  into v_bad
  from (
    select torneo_id, tipo, fecha, zona, local_id, visitante_id
    from fixture
    group by torneo_id, tipo, fecha, zona, local_id, visitante_id
    having count(*) > 1
  ) duplicated_fixture;

  if v_bad <> 0 then
    raise exception 'Prevalidacion: el fixture contiene % clave(s) logicas duplicadas.', v_bad;
  end if;

  with fixture as (
    select *
    from ${fixtureRecordset}
  )
  select string_agg(
    campo || ': partidos=' || tipo_partidos || ', fixture=' || tipo_fixture,
    '; '
    order by campo
  )
  into v_type_errors
  from (
    select
      'fecha' as campo,
      pg_typeof(partido.fecha)::text as tipo_partidos,
      pg_typeof(fixture.fecha)::text as tipo_fixture
    from (select * from public.partidos where torneo_id = 1 limit 1) partido
    cross join (select * from fixture limit 1) fixture
    union all
    select 'local_id', pg_typeof(partido.local_id)::text, pg_typeof(fixture.local_id)::text
    from (select * from public.partidos where torneo_id = 1 limit 1) partido
    cross join (select * from fixture limit 1) fixture
    union all
    select 'tipo', pg_typeof(partido.tipo)::text, pg_typeof(fixture.tipo)::text
    from (select * from public.partidos where torneo_id = 1 limit 1) partido
    cross join (select * from fixture limit 1) fixture
    union all
    select 'torneo_id', pg_typeof(partido.torneo_id)::text, pg_typeof(fixture.torneo_id)::text
    from (select * from public.partidos where torneo_id = 1 limit 1) partido
    cross join (select * from fixture limit 1) fixture
    union all
    select 'visitante_id', pg_typeof(partido.visitante_id)::text, pg_typeof(fixture.visitante_id)::text
    from (select * from public.partidos where torneo_id = 1 limit 1) partido
    cross join (select * from fixture limit 1) fixture
    union all
    select 'zona', pg_typeof(partido.zona)::text, pg_typeof(fixture.zona)::text
    from (select * from public.partidos where torneo_id = 1 limit 1) partido
    cross join (select * from fixture limit 1) fixture
  ) type_check
  where tipo_partidos is distinct from tipo_fixture;

  if v_type_errors is not null then
    raise exception 'Prevalidacion: tipos incompatibles: %.', v_type_errors;
  end if;

  with fixture as (
    select *
    from ${fixtureRecordset}
  )
  select count(*)
  into v_bad
  from fixture
  where exists (
    select 1
    from public.partidos partido
    where partido.torneo_id = fixture.torneo_id
      and partido.tipo = fixture.tipo
      and partido.fecha = fixture.fecha
      and partido.zona = fixture.zona
      and partido.local_id = fixture.local_id
      and partido.visitante_id = fixture.visitante_id
  );

  if v_bad <> 0 then
    raise exception 'Prevalidacion: hay % partido(s) del Clausura ya existentes.', v_bad;
  end if;

  with fixture as (
    select *
    from ${fixtureRecordset}
  ),
  sample as (
    select *
    from public.partidos
    where torneo_id = 1
    limit 1
  )
  select count(*)
  into v_bad
  from sample partido
  cross join (select * from fixture limit 1) fixture
  where partido.torneo_id = fixture.torneo_id
    and partido.tipo = fixture.tipo
    and partido.fecha = fixture.fecha
    and partido.zona = fixture.zona
    and partido.local_id = fixture.local_id
    and partido.visitante_id = fixture.visitante_id
    and partido.local is not distinct from fixture.local
    and partido.visitante is not distinct from fixture.visitante
    and partido.estado is not distinct from fixture.estado
    and partido.goles_local is not distinct from fixture.goles_local
    and partido.goles_visitante is not distinct from fixture.goles_visitante
    and partido.penales_local is not distinct from fixture.penales_local
    and partido.penales_visitante is not distinct from fixture.penales_visitante
    and partido.fase is not distinct from fixture.fase
    and partido.numero_playoff is not distinct from fixture.numero_playoff
    and partido.fecha_partido is not distinct from fixture.fecha_partido
    and partido.dia is not distinct from fixture.dia
    and partido.hora is not distinct from fixture.hora
    and partido.estadio is not distinct from fixture.estadio
    and partido.arbitro is not distinct from fixture.arbitro
    and partido.source_local is not distinct from fixture.source_local
    and partido.source_visitante is not distinct from fixture.source_visitante;

  raise notice 'Prevalidacion Clausura 2026 aprobada: fixture 114, Clausura 0, Apertura 140, tipos compatibles.';
end;
$$;
`;
}

function buildPrevalidationSql(context) {
  const recordsJson = sqlJson(context.records);
  const clubsJson = sqlJson(expectedClubRows(context.mapData));
  const fixtureRecordset = buildFixtureRecordsetSql("item", "fixture_json.data");

  return `-- Prevalidacion solo lectura - Clausura 2026.
-- Ejecutar en Supabase SQL Editor antes de reintentar la carga.
-- Devuelve una fila; no modifica datos remotos.

with fixture_json as (
  select $fixture_json$
${recordsJson}
$fixture_json$::jsonb as data
),
expected_clubs_json as (
  select $clubs_json$
${clubsJson}
$clubs_json$::jsonb as data
),
fixture as (
  select item.*
  from fixture_json
  cross join lateral ${fixtureRecordset}
),
expected_clubs as (
  select expected.*
  from expected_clubs_json
  cross join lateral jsonb_to_recordset(expected_clubs_json.data) as expected(
    nombre_fuente text,
    nombre_en_proyecto text,
    club_id bigint,
    zona_clausura integer,
    estado text
  )
),
apertura as (
  select count(*) as total
  from public.partidos
  where torneo_id = 1
),
clausura as (
  select count(*) as total
  from public.partidos
  where torneo_id = 2
),
fixture_total as (
  select count(*) as total
  from fixture
),
fixture_invalidos as (
  select count(*) as total
  from fixture
  where torneo_id <> 2
    or tipo <> 'regular'
    or fecha is null
    or zona not in ('1', '2', '3')
    or local_id is null
    or visitante_id is null
    or local_id = visitante_id
    or local is null
    or visitante is null
    or fecha_partido is not null
    or dia is not null
    or hora is not null
    or estadio is not null
    or arbitro is not null
    or estado <> 'programado'
    or goles_local is not null
    or goles_visitante is not null
    or penales_local is not null
    or penales_visitante is not null
    or fase is not null
    or numero_playoff is not null
    or source_local is not null
    or source_visitante is not null
    or local_id = 57
    or visitante_id = 57
),
fixture_duplicados as (
  select count(*) as total
  from (
    select torneo_id, tipo, fecha, zona, local_id, visitante_id
    from fixture
    group by torneo_id, tipo, fecha, zona, local_id, visitante_id
    having count(*) > 1
  ) duplicados
),
clubes_invalidos as (
  select count(*) as total
  from expected_clubs expected
  left join public.clubes club
    on club.id = expected.club_id
  where club.id is null
    or club.nombre_oficial is distinct from expected.nombre_en_proyecto
    or club.activo is false
    or expected.estado is distinct from 'confirmado'
),
existing_matches as (
  select
    fixture.*,
    partido.id as partido_id,
    partido.fecha_partido as p_fecha_partido,
    partido.dia as p_dia,
    partido.hora as p_hora,
    partido.estadio as p_estadio,
    partido.arbitro as p_arbitro,
    partido.estado as p_estado,
    partido.goles_local as p_goles_local,
    partido.goles_visitante as p_goles_visitante,
    partido.penales_local as p_penales_local,
    partido.penales_visitante as p_penales_visitante,
    partido.fase as p_fase,
    partido.numero_playoff as p_numero_playoff,
    partido.local as p_local,
    partido.visitante as p_visitante,
    partido.source_local as p_source_local,
    partido.source_visitante as p_source_visitante
  from fixture
  join public.partidos partido
    on partido.torneo_id = fixture.torneo_id
    and partido.tipo = fixture.tipo
    and partido.fecha = fixture.fecha
    and partido.zona = fixture.zona
    and partido.local_id = fixture.local_id
    and partido.visitante_id = fixture.visitante_id
),
conflictos as (
  select count(*) as total
  from existing_matches
  where not (
    p_local is not distinct from local
      and p_visitante is not distinct from visitante
      and p_fecha_partido is not distinct from fecha_partido
      and p_dia is not distinct from dia
      and p_hora is not distinct from hora
      and p_estadio is not distinct from estadio
      and p_arbitro is not distinct from arbitro
      and p_estado is not distinct from estado
      and p_goles_local is not distinct from goles_local
      and p_goles_visitante is not distinct from goles_visitante
      and p_penales_local is not distinct from penales_local
      and p_penales_visitante is not distinct from penales_visitante
      and p_fase is not distinct from fase
      and p_numero_playoff is not distinct from numero_playoff
      and p_source_local is not distinct from source_local
      and p_source_visitante is not distinct from source_visitante
  )
),
type_checks as (
  select
    campo,
    tipo_partidos,
    tipo_fixture,
    tipo_partidos = tipo_fixture as ok
  from (
    select 'arbitro' as campo, pg_typeof(partido.arbitro)::text as tipo_partidos, pg_typeof(fixture.arbitro)::text as tipo_fixture
    from (select * from public.partidos where torneo_id = 1 limit 1) partido cross join (select * from fixture limit 1) fixture
    union all
    select 'dia', pg_typeof(partido.dia)::text, pg_typeof(fixture.dia)::text
    from (select * from public.partidos where torneo_id = 1 limit 1) partido cross join (select * from fixture limit 1) fixture
    union all
    select 'estado', pg_typeof(partido.estado)::text, pg_typeof(fixture.estado)::text
    from (select * from public.partidos where torneo_id = 1 limit 1) partido cross join (select * from fixture limit 1) fixture
    union all
    select 'estadio', pg_typeof(partido.estadio)::text, pg_typeof(fixture.estadio)::text
    from (select * from public.partidos where torneo_id = 1 limit 1) partido cross join (select * from fixture limit 1) fixture
    union all
    select 'fase', pg_typeof(partido.fase)::text, pg_typeof(fixture.fase)::text
    from (select * from public.partidos where torneo_id = 1 limit 1) partido cross join (select * from fixture limit 1) fixture
    union all
    select 'fecha', pg_typeof(partido.fecha)::text, pg_typeof(fixture.fecha)::text
    from (select * from public.partidos where torneo_id = 1 limit 1) partido cross join (select * from fixture limit 1) fixture
    union all
    select 'fecha_partido', pg_typeof(partido.fecha_partido)::text, pg_typeof(fixture.fecha_partido)::text
    from (select * from public.partidos where torneo_id = 1 limit 1) partido cross join (select * from fixture limit 1) fixture
    union all
    select 'goles_local', pg_typeof(partido.goles_local)::text, pg_typeof(fixture.goles_local)::text
    from (select * from public.partidos where torneo_id = 1 limit 1) partido cross join (select * from fixture limit 1) fixture
    union all
    select 'goles_visitante', pg_typeof(partido.goles_visitante)::text, pg_typeof(fixture.goles_visitante)::text
    from (select * from public.partidos where torneo_id = 1 limit 1) partido cross join (select * from fixture limit 1) fixture
    union all
    select 'hora', pg_typeof(partido.hora)::text, pg_typeof(fixture.hora)::text
    from (select * from public.partidos where torneo_id = 1 limit 1) partido cross join (select * from fixture limit 1) fixture
    union all
    select 'local', pg_typeof(partido.local)::text, pg_typeof(fixture.local)::text
    from (select * from public.partidos where torneo_id = 1 limit 1) partido cross join (select * from fixture limit 1) fixture
    union all
    select 'local_id', pg_typeof(partido.local_id)::text, pg_typeof(fixture.local_id)::text
    from (select * from public.partidos where torneo_id = 1 limit 1) partido cross join (select * from fixture limit 1) fixture
    union all
    select 'numero_playoff', pg_typeof(partido.numero_playoff)::text, pg_typeof(fixture.numero_playoff)::text
    from (select * from public.partidos where torneo_id = 1 limit 1) partido cross join (select * from fixture limit 1) fixture
    union all
    select 'penales_local', pg_typeof(partido.penales_local)::text, pg_typeof(fixture.penales_local)::text
    from (select * from public.partidos where torneo_id = 1 limit 1) partido cross join (select * from fixture limit 1) fixture
    union all
    select 'penales_visitante', pg_typeof(partido.penales_visitante)::text, pg_typeof(fixture.penales_visitante)::text
    from (select * from public.partidos where torneo_id = 1 limit 1) partido cross join (select * from fixture limit 1) fixture
    union all
    select 'source_local', pg_typeof(partido.source_local)::text, pg_typeof(fixture.source_local)::text
    from (select * from public.partidos where torneo_id = 1 limit 1) partido cross join (select * from fixture limit 1) fixture
    union all
    select 'source_visitante', pg_typeof(partido.source_visitante)::text, pg_typeof(fixture.source_visitante)::text
    from (select * from public.partidos where torneo_id = 1 limit 1) partido cross join (select * from fixture limit 1) fixture
    union all
    select 'tipo', pg_typeof(partido.tipo)::text, pg_typeof(fixture.tipo)::text
    from (select * from public.partidos where torneo_id = 1 limit 1) partido cross join (select * from fixture limit 1) fixture
    union all
    select 'torneo_id', pg_typeof(partido.torneo_id)::text, pg_typeof(fixture.torneo_id)::text
    from (select * from public.partidos where torneo_id = 1 limit 1) partido cross join (select * from fixture limit 1) fixture
    union all
    select 'visitante', pg_typeof(partido.visitante)::text, pg_typeof(fixture.visitante)::text
    from (select * from public.partidos where torneo_id = 1 limit 1) partido cross join (select * from fixture limit 1) fixture
    union all
    select 'visitante_id', pg_typeof(partido.visitante_id)::text, pg_typeof(fixture.visitante_id)::text
    from (select * from public.partidos where torneo_id = 1 limit 1) partido cross join (select * from fixture limit 1) fixture
    union all
    select 'zona', pg_typeof(partido.zona)::text, pg_typeof(fixture.zona)::text
    from (select * from public.partidos where torneo_id = 1 limit 1) partido cross join (select * from fixture limit 1) fixture
  ) typed
),
type_summary as (
  select
    count(*) filter (where not ok) as invalidos,
    coalesce(
      string_agg(campo || ':' || tipo_partidos || '<>' || tipo_fixture, '; ' order by campo)
        filter (where not ok),
      ''
    ) as detalle
  from type_checks
),
resumen as (
  select
    (select total from fixture_total) as fixture_total,
    (select total from clausura) as existentes_clausura,
    (select total from conflictos) as conflictos,
    (
      (select total from fixture_invalidos) = 0
      and (select total from fixture_duplicados) = 0
      and (select total from clubes_invalidos) = 0
      and (select total from apertura) = 140
    ) as zonas_validas,
    (select invalidos from type_summary) = 0 as tipos_validos,
    (select detalle from type_summary) as detalle_tipos
)
select
  fixture_total,
  existentes_clausura,
  conflictos,
  zonas_validas,
  tipos_validos,
  case
    when fixture_total = 114
      and existentes_clausura = 0
      and conflictos = 0
      and zonas_validas
      and tipos_validos
    then 'OK'
    else 'BLOQUEADO'
  end as resultado_final,
  detalle_tipos
from resumen;
`;
}

function writeTextFile(filePath, contents) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents, "utf8");
}

function buildPreloadReport(context, remoteValidation, backupPath, sqlPath) {
  const preload = remoteValidation
    ? remoteValidation.preload
    : analyzePreload(context.records, []);
  const apertura = remoteValidation
    ? remoteValidation.aperturaSummary
    : { total: "pendiente", regular: "pendiente", playoff: "pendiente" };
  const torneo = remoteValidation && remoteValidation.torneo
    ? `id ${remoteValidation.torneo.id}, ${remoteValidation.torneo.nombre}, anio ${remoteValidation.torneo.anio}, tipo ${remoteValidation.torneo.tipo}, activo ${remoteValidation.torneo.activo}`
    : "pendiente de lectura remota";
  const errors = remoteValidation ? remoteValidation.errors : [];
  const warnings = remoteValidation ? remoteValidation.warnings : [];
  const status = errors.length === 0 ? "PREPARADO PARA AUTORIZACION" : "BLOQUEADO";

  return [
    "# Pre-carga Clausura 2026",
    "",
    "## Estado",
    "",
    `- Resultado: ${status}`,
    "- Escrituras en Supabase en esta etapa: 0",
    "- Inserts: 0",
    "- Updates: 0",
    "- Deletes: 0",
    "- Upserts: 0",
    "- RPC de escritura: 0",
    "",
    "## Fuente",
    "",
    `- Fixture: \`${context.fixtureInfo.path}\``,
    `- Fixture SHA-256: \`${context.fixtureInfo.sha256}\``,
    `- Registros construidos: ${context.records.length}`,
    `- Partidos por zona: Zona 1 ${context.local.counts.matchesByZone[1] || 0}, Zona 2 ${context.local.counts.matchesByZone[2] || 0}, Zona 3 ${context.local.counts.matchesByZone[3] || 0}`,
    `- Fechas libres: ${context.local.counts.byesTotal}`,
    "- Carcarana en fixture: 0",
    "",
    "## Remoto GET",
    "",
    `- Torneo Clausura: ${torneo}`,
    `- Partidos existentes Clausura: ${preload.existingCount}`,
    `- Nuevos esperados: ${preload.newRecords}`,
    `- Identicos existentes: ${preload.identical}`,
    `- Conflictos: ${preload.conflicts}`,
    `- Duplicados remotos: ${preload.duplicates}`,
    `- Clubes mapeados: ${remoteValidation ? remoteValidation.mappedRows.length : "pendiente"}/20`,
    `- Apertura total: ${apertura.total}`,
    `- Apertura desglose remoto: regular ${apertura.regular}, playoff ${apertura.playoff}`,
    `- Source en regular Apertura: ${apertura.regularWithSource || 0}`,
    "",
    "## Metodo recomendado",
    "",
    "- Metodo: Supabase SQL Editor.",
    `- Archivo de carga: \`${normalizePath(sqlPath)}\``,
    "- Motivo: no hay ruta local existente que cree fixtures completos en una transaccion; la funcion admin actual solo actualiza partidos existentes y el anon key publico no debe asumirse apto para insertar.",
    "- Proteccion: el SQL falla por defecto porque contiene `PENDIENTE_AUTORIZACION` y valida la frase exacta antes de insertar.",
    "- Transaccion: `begin` + bloque `do` + `commit`; cualquier excepcion aborta y revierte toda la operacion.",
    "- Idempotencia: clave logica `torneo_id`, `tipo`, `fecha`, `zona`, `local_id`, `visitante_id`; re-ejecucion con los 114 registros identicos no duplica.",
    "",
    "## Respaldo",
    "",
    `- Archivo local: ${backupPath ? `\`${normalizePath(backupPath)}\`` : "pendiente"}`,
    "- Contenido minimo: torneo Clausura, partidos actuales del Clausura, conteo de Apertura, clubes mapeados, timestamp y hash del fixture.",
    "- Credenciales incluidas: 0",
    "- Versionado: no debe agregarse al commit; `respaldos/*.json` esta ignorado.",
    "",
    "## Ejecucion futura",
    "",
    "1. Confirmar que el PR fue revisado.",
    "2. Generar o conservar un respaldo local inmediatamente antes de la carga.",
    "3. Reemplazar `PENDIENTE_AUTORIZACION` por la frase exacta autorizada en el SQL.",
    "4. Ejecutar el SQL completo en Supabase SQL Editor.",
    "5. Ejecutar `sql/verificar-clausura-2026-post-carga.sql`.",
    "",
    "## Rollback",
    "",
    "- Si el SQL falla, no hay commit y la transaccion queda revertida automaticamente.",
    "- Si una carga autorizada ya fue confirmada y debe deshacerse, usar el respaldo local y preparar un rollback separado y explicito antes de borrar datos.",
    "",
    "## Errores",
    "",
    errors.length === 0 ? "- Ninguno." : errors.map(error => `- ${error}`).join("\n"),
    "",
    "## Warnings",
    "",
    warnings.length === 0 ? "- Ninguno." : warnings.map(warning => `- ${warning}`).join("\n"),
    ""
  ].join("\n");
}

function validatePostLoadState(state, expectedRecords) {
  const rows = state.clausuraPartidos || [];
  const errors = [];
  const byZone = {};
  const keys = {};

  rows.forEach(row => {
    byZone[row.zona] = (byZone[row.zona] || 0) + 1;
    keys[preparar.logicalKey(row)] = (keys[preparar.logicalKey(row)] || 0) + 1;
  });

  if (rows.length !== EXPECTED.clausuraMatches) {
    errors.push(`Total Clausura invalido: ${rows.length}.`);
  }
  Object.keys(EXPECTED.clausuraByZone).forEach(zone => {
    if ((byZone[zone] || 0) !== EXPECTED.clausuraByZone[zone]) {
      errors.push(`Zona ${zone} invalida: ${byZone[zone] || 0}.`);
    }
  });
  if (Object.values(keys).some(count => count > 1)) {
    errors.push("Hay duplicados por clave logica.");
  }
  rows.forEach(row => {
    if (row.torneo_id !== TORNEO_CLAUSURA_ID) errors.push("torneo_id invalido.");
    if (row.tipo !== "regular") errors.push("tipo invalido.");
    if (row.fase !== null) errors.push("fase no nula.");
    if (row.estado !== "programado") errors.push("estado invalido.");
    if (row.goles_local !== null || row.goles_visitante !== null) {
      errors.push("goles no nulos.");
    }
    if (row.penales_local !== null || row.penales_visitante !== null) {
      errors.push("penales no nulos.");
    }
    if (row.local_id === row.visitante_id || row.local === row.visitante) {
      errors.push("local igual a visitante.");
    }
    if (row.local_id === EXPECTED.carcaranaId || row.visitante_id === EXPECTED.carcaranaId) {
      errors.push("Carcarana aparece en Clausura.");
    }
  });

  expectedRecords.forEach(record => {
    const key = preparar.logicalKey(record);
    if (!keys[key]) errors.push(`Falta registro esperado ${key}.`);
  });

  if (state.aperturaCount !== EXPECTED.aperturaMatches) {
    errors.push(`Apertura modificado: ${state.aperturaCount}.`);
  }
  if (
    JSON.stringify(state.clubZonesBefore || []) !==
    JSON.stringify(state.clubZonesAfter || state.clubZonesBefore || [])
  ) {
    errors.push("clubes.zona modificado.");
  }

  return {
    ok: errors.length === 0,
    errors
  };
}

function simulateTransactionalLoad(options) {
  const records = clone(options.records || []);
  const initialRows = clone(options.existingRows || []);
  const beforeState = {
    clausuraPartidos: clone(initialRows),
    aperturaCount: options.aperturaCount,
    clubZonesBefore: clone(options.clubZones || []),
    clubZonesAfter: clone(options.clubZones || [])
  };
  const working = clone(beforeState);

  try {
    const preload = analyzePreload(records, working.clausuraPartidos);
    if (preload.blocking.length > 0) {
      throw new Error(preload.blocking.join(" "));
    }
    if (preload.existingCount === 0) {
      working.clausuraPartidos = working.clausuraPartidos.concat(records);
    }
    if (options.failAfterInsert) {
      throw new Error("Falla simulada posterior a insert.");
    }
    const post = validatePostLoadState(working, records);
    if (!post.ok) throw new Error(post.errors.join(" "));
    return {
      committed: true,
      rolledBack: false,
      inserted: preload.existingCount === 0 ? records.length : 0,
      state: working
    };
  } catch (error) {
    return {
      committed: false,
      rolledBack: true,
      inserted: 0,
      error: error.message,
      state: beforeState
    };
  }
}

async function run(options = {}) {
  const context = buildContext(options);
  let remote = null;
  let remoteValidation = null;
  let backupPath = null;

  if (options.remoteRead || options.backup) {
    remote = await readRemoteSnapshot();
    remoteValidation = validateRemoteSnapshot(remote, context);
    if (!remoteValidation.ok) {
      throw new Error(`Precondiciones remotas fallidas: ${remoteValidation.errors.join("; ")}`);
    }
  }

  if (options.writeSql) {
    writeTextFile(options.sqlPath || DEFAULT_SQL_PATH, buildLoadSql(context));
    writeTextFile(
      path.join(ROOT, "sql", "verificar-clausura-2026-post-carga.sql"),
      buildPostVerificationSql()
    );
    writeTextFile(
      path.join(ROOT, "sql", "prevalidar-clausura-2026-carga.sql"),
      buildPrevalidationSql(context)
    );
  }

  if (options.backup) {
    backupPath = writeBackup(remote, remoteValidation, context, options.backupPath);
  }

  if (options.writeReport) {
    writeTextFile(
      options.reportPath || DEFAULT_REPORT_PATH,
      buildPreloadReport(
        context,
        remoteValidation,
        backupPath,
        options.sqlPath || DEFAULT_SQL_PATH
      )
    );
  }

  return {
    writesSupabase: 0,
    records: context.records.length,
    matchesByZone: context.local.counts.matchesByZone,
    backupPath: backupPath ? normalizePath(backupPath) : null,
    sqlPath: options.writeSql ? normalizePath(options.sqlPath || DEFAULT_SQL_PATH) : null,
    reportPath: options.writeReport
      ? normalizePath(options.reportPath || DEFAULT_REPORT_PATH)
      : null,
    remote: remoteValidation
      ? {
          torneo: remoteValidation.torneo,
          preload: remoteValidation.preload,
          apertura: remoteValidation.aperturaSummary,
          mappedClubs: remoteValidation.mappedRows.length
        }
      : null
  };
}

async function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
      console.log(usage());
      return;
    }
    if (options.authorization !== null) {
      requireAuthorizationPhrase(options.authorization);
    }
    const result = await run(options);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  AUTHORIZATION_PHRASE,
  EXPECTED,
  PENDING_AUTHORIZATION,
  analyzePreload,
  buildContext,
  buildLoadSql,
  buildPostVerificationSql,
  buildPrevalidationSql,
  buildPreloadReport,
  parseArgs,
  readRemoteSnapshot,
  requireAuthorizationPhrase,
  run,
  simulateTransactionalLoad,
  summarizeApertura,
  validatePostLoadState,
  validateRemoteSnapshot,
  writeBackup
};
