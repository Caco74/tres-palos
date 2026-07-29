"use strict";

const fs = require("fs");
const path = require("path");
const https = require("https");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_BACKUP_PATH = path.join(
  ROOT,
  "respaldos",
  "apertura-2026-respaldo-completo-20260715-165226.json"
);
const DEFAULT_REPORT_PATH = path.join(
  ROOT,
  "reports",
  "identidad-jugadores-dry-run.md"
);
const DEFAULT_MAPPING_PATH = path.join(
  ROOT,
  "reports",
  "identidad-jugadores-mapeo-propuesto.json"
);
const DEFAULT_TOURNAMENT_ID = 1;

const PERSON_EVENT_TYPES = new Set([
  "gol",
  "gol_penal",
  "gol_en_contra",
  "amarilla",
  "doble_amarilla",
  "roja",
  "cambio"
]);
const SCORER_TYPES = new Set(["gol", "gol_penal"]);
const INVALID_PLAYER_NAMES = new Set([
  "",
  "jugador no informado",
  "sin informar",
  "no informado",
  "desconocido"
]);
const REMOTE_HTTP_METHODS = ["GET"];
const ORDERED_STATUSES = [
  "coincidencia_exacta_segura",
  "coincidencia_alias_confirmado",
  "candidato_probable",
  "ambiguo",
  "sin_coincidencia",
  "texto_vacio",
  "evento_sin_jugador_aplicable",
  "ya_vinculado",
  "vinculo_roto"
];
const BLOCKED_FLAGS = [
  "--apply",
  "--apply=",
  "--write-supabase",
  "--write-supabase=",
  "--execute",
  "--execute=",
  "--insert",
  "--insert=",
  "--update",
  "--update=",
  "--delete",
  "--delete=",
  "--upsert",
  "--upsert=",
  "--rpc",
  "--rpc="
];

function isBlockedFlag(arg) {
  return BLOCKED_FLAGS.some(flag =>
    flag.endsWith("=") ? arg.indexOf(flag) === 0 : arg === flag
  );
}

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    backupPath: DEFAULT_BACKUP_PATH,
    reportPath: DEFAULT_REPORT_PATH,
    mappingPath: DEFAULT_MAPPING_PATH,
    tournamentId: DEFAULT_TOURNAMENT_ID,
    remoteRead: false,
    writeReport: false,
    writeMapping: false,
    help: false
  };

  argv.forEach(arg => {
    if (isBlockedFlag(arg)) {
      throw new Error(
        `Flag inseguro bloqueado: ${arg}. ` +
          "La auditoria solo hace lecturas y genera archivos locales."
      );
    }
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      return;
    }
    if (arg === "--remote-read") {
      options.remoteRead = true;
      return;
    }
    if (arg === "--write-report") {
      options.writeReport = true;
      return;
    }
    if (arg === "--write-mapping") {
      options.writeMapping = true;
      return;
    }
    if (arg.startsWith("--backup=")) {
      options.backupPath = path.resolve(ROOT, arg.slice("--backup=".length));
      return;
    }
    if (arg.startsWith("--report=")) {
      options.reportPath = path.resolve(ROOT, arg.slice("--report=".length));
      return;
    }
    if (arg.startsWith("--mapping=")) {
      options.mappingPath = path.resolve(ROOT, arg.slice("--mapping=".length));
      return;
    }
    if (arg.startsWith("--torneo-id=")) {
      const id = Number(arg.slice("--torneo-id=".length));
      if (!Number.isInteger(id) || id <= 0) {
        throw new Error("--torneo-id debe ser un entero positivo.");
      }
      options.tournamentId = id;
      return;
    }

    throw new Error(`Argumento no reconocido: ${arg}`);
  });

  return options;
}

function usage() {
  return [
    "Uso:",
    "  node scripts/auditar-jugadores-historicos.js",
    "  node scripts/auditar-jugadores-historicos.js --write-report --write-mapping",
    "  node scripts/auditar-jugadores-historicos.js --remote-read --torneo-id=1",
    "",
    "No ejecuta escrituras remotas. Metodos HTTP remotos permitidos: GET."
  ].join("\n");
}

function readJson(filePath) {
  const text = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  return JSON.parse(text);
}

function normalizePlayerName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[.]/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanPlayerName(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function hasPlayerText(value) {
  return !INVALID_PLAYER_NAMES.has(normalizePlayerName(value));
}

function normalizeEventType(value) {
  const normalized = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[-\s]+/g, "_")
    .trim();

  if (normalized.includes("autogol") || normalized.includes("contra")) {
    return "gol_en_contra";
  }
  if (normalized === "gol_penal" || normalized.includes("penal")) {
    return "gol_penal";
  }
  if (normalized.includes("doble") && normalized.includes("amarilla")) {
    return "doble_amarilla";
  }
  return normalized;
}

function isPersonEvent(event) {
  return PERSON_EVENT_TYPES.has(normalizeEventType(event.tipo));
}

function isScorerEvent(event) {
  return SCORER_TYPES.has(normalizeEventType(event.tipo));
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function indexById(rows) {
  return new Map(asArray(rows).map(row => [String(row.id), row]));
}

function uniqueValues(values) {
  return [...new Set(values.filter(value => value !== null && value !== undefined))];
}

function getDataScope(data) {
  return data.data || data;
}

function buildIndexes(data) {
  const scope = getDataScope(data);
  return {
    torneosById: indexById(scope.torneos),
    clubesById: indexById(scope.clubes),
    jugadoresById: indexById(scope.jugadores),
    inscripcionesById: indexById(scope.inscripciones_jugadores),
    partidosById: indexById(scope.partidos),
    jugadores: asArray(scope.jugadores),
    inscripciones: asArray(scope.inscripciones_jugadores),
    eventos: asArray(scope.eventos_partido),
    partidos: asArray(scope.partidos),
    clubes: asArray(scope.clubes),
    aliases: asArray(scope.jugadores_aliases)
  };
}

function playerInscriptions(indexes, playerId) {
  return indexes.inscripciones.filter(
    inscription => String(inscription.jugador_id) === String(playerId)
  );
}

function matchParticipantClubIds(match, event) {
  return uniqueValues([
    match?.local_id,
    match?.visitante_id,
    event?.equipo_id
  ]).map(String);
}

function buildIdentityEntries(indexes) {
  const entries = [];

  indexes.jugadores.forEach(player => {
    const inscriptions = playerInscriptions(indexes, player.id);
    const canonical = cleanPlayerName(player.nombre_completo);
    if (canonical) {
      entries.push({
        jugador_id: player.id,
        text: canonical,
        normalized: normalizePlayerName(canonical),
        source: "nombre_completo",
        confirmed: true,
        exactOnly: true,
        inscriptions
      });
    }

    asArray(player.aliases).forEach(alias => {
      const cleanAlias = cleanPlayerName(alias);
      if (!cleanAlias) return;
      entries.push({
        jugador_id: player.id,
        text: cleanAlias,
        normalized: normalizePlayerName(cleanAlias),
        source: "jugadores.aliases",
        confirmed: true,
        exactOnly: false,
        inscriptions
      });
    });
  });

  indexes.aliases.forEach(alias => {
    const player = indexes.jugadoresById.get(String(alias.jugador_id));
    if (!player) return;
    const cleanAlias = cleanPlayerName(alias.alias);
    if (!cleanAlias) return;
    entries.push({
      jugador_id: player.id,
      text: cleanAlias,
      normalized: alias.alias_normalizado || normalizePlayerName(cleanAlias),
      source: "jugadores_aliases",
      confirmed: alias.confirmado !== false,
      club_id: alias.club_id || null,
      torneo_id: alias.torneo_id || null,
      exactOnly: false,
      inscriptions: playerInscriptions(indexes, player.id)
    });
  });

  return entries;
}

function candidateMatchesEvent(entry, inscription, event, match) {
  if (!match || !inscription) return false;
  if (String(inscription.torneo_id) !== String(match.torneo_id)) return false;
  if (entry.torneo_id && String(entry.torneo_id) !== String(match.torneo_id)) {
    return false;
  }
  if (entry.club_id && String(entry.club_id) !== String(inscription.club_id)) {
    return false;
  }

  const participantClubs = matchParticipantClubIds(match, event);
  return participantClubs.includes(String(inscription.club_id));
}

function candidateRank(candidate) {
  if (candidate.exact) return 3;
  if (candidate.confirmed && candidate.source !== "nombre_completo") return 2;
  if (candidate.confirmed) return 1;
  return 0;
}

function findCandidatesForEvent(event, indexes, identityEntries) {
  const text = cleanPlayerName(event.jugador);
  const normalized = normalizePlayerName(text);
  if (!hasPlayerText(text)) return [];

  const match = indexes.partidosById.get(String(event.partido_id));
  const candidates = [];

  identityEntries
    .filter(entry => entry.normalized === normalized)
    .forEach(entry => {
      entry.inscriptions.forEach(inscription => {
        if (!candidateMatchesEvent(entry, inscription, event, match)) return;
        const player = indexes.jugadoresById.get(String(entry.jugador_id));
        candidates.push({
          jugador_id: entry.jugador_id,
          inscripcion_jugador_id: inscription.id,
          club_id: inscription.club_id,
          torneo_id: inscription.torneo_id,
          nombre_completo: player?.nombre_completo || entry.text,
          matched_text: entry.text,
          source: entry.source,
          confirmed: entry.confirmed,
          exact: entry.source === "nombre_completo" && text === entry.text,
          normalized_match: true
        });
      });
    });

  const byInscription = new Map();
  candidates.forEach(candidate => {
    const key = String(candidate.inscripcion_jugador_id);
    const current = byInscription.get(key);
    if (
      !current ||
      candidateRank(candidate) > candidateRank(current)
    ) {
      byInscription.set(key, candidate);
    }
  });
  return [...byInscription.values()];
}

function classifyEvent(event, indexes, identityEntries) {
  if (!isPersonEvent(event)) {
    return {
      status: "evento_sin_jugador_aplicable",
      candidates: [],
      canAutoMigrate: false
    };
  }

  if (!hasPlayerText(event.jugador)) {
    return {
      status: "texto_vacio",
      candidates: [],
      canAutoMigrate: false
    };
  }

  if (event.inscripcion_jugador_id) {
    const inscription = indexes.inscripcionesById.get(
      String(event.inscripcion_jugador_id)
    );
    const player = inscription
      ? indexes.jugadoresById.get(String(inscription.jugador_id))
      : null;
    return {
      status: inscription ? "ya_vinculado" : "vinculo_roto",
      candidates: inscription
        ? [{
            jugador_id: inscription.jugador_id,
            inscripcion_jugador_id: inscription.id,
            club_id: inscription.club_id,
            torneo_id: inscription.torneo_id,
            nombre_completo: player?.nombre_completo || null,
            source: "inscripcion_jugador_id"
          }]
        : [],
      canAutoMigrate: false
    };
  }

  const candidates = findCandidatesForEvent(event, indexes, identityEntries);
  if (candidates.length === 0) {
    return {
      status: "sin_coincidencia",
      candidates,
      canAutoMigrate: false
    };
  }

  const uniquePlayerIds = new Set(candidates.map(candidate => String(candidate.jugador_id)));
  if (candidates.length > 1 || uniquePlayerIds.size > 1) {
    return {
      status: "ambiguo",
      candidates,
      canAutoMigrate: false
    };
  }

  const [candidate] = candidates;
  if (candidate.exact) {
    return {
      status: "coincidencia_exacta_segura",
      candidates,
      canAutoMigrate: true
    };
  }
  if (candidate.confirmed && candidate.source !== "nombre_completo") {
    return {
      status: "coincidencia_alias_confirmado",
      candidates,
      canAutoMigrate: true
    };
  }

  return {
    status: "candidato_probable",
    candidates,
    canAutoMigrate: false
  };
}

function increment(map, key, amount = 1) {
  map.set(key, (map.get(key) || 0) + amount);
}

function objectFromSortedMap(map) {
  return Object.fromEntries([...map.entries()].sort((a, b) =>
    String(a[0]).localeCompare(String(b[0]), "es", { sensitivity: "base" })
  ));
}

function groupUniqueNamesByNormalization(names) {
  const groups = new Map();
  names.forEach(name => {
    const normalized = normalizePlayerName(name);
    if (!groups.has(normalized)) groups.set(normalized, []);
    groups.get(normalized).push(name);
  });
  return [...groups.entries()]
    .filter(([, group]) => group.length > 1)
    .map(([normalized, group]) => ({ normalized, names: group.sort() }));
}

function surnameKey(name) {
  const tokens = normalizePlayerName(name).split(" ").filter(Boolean);
  if (tokens[0] === "de" && tokens[1]) return `${tokens[0]} ${tokens[1]}`;
  return tokens[0] || "";
}

function groupProbableNameFamilies(names) {
  const groups = new Map();
  names.forEach(name => {
    const key = surnameKey(name);
    if (!key) return;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(name);
  });
  return [...groups.entries()]
    .filter(([, group]) => group.length > 1)
    .map(([key, group]) => ({ key, names: group.sort() }))
    .sort((a, b) => b.names.length - a.names.length || a.key.localeCompare(b.key));
}

function findCanonicalHomonyms(indexes) {
  const groups = new Map();
  indexes.jugadores.forEach(player => {
    const normalized = normalizePlayerName(player.nombre_completo);
    if (!groups.has(normalized)) groups.set(normalized, []);
    groups.get(normalized).push(player);
  });

  return [...groups.entries()]
    .filter(([, players]) => players.length > 1)
    .map(([normalized, players]) => ({
      normalized,
      players: players.map(player => ({
        id: player.id,
        nombre_completo: player.nombre_completo,
        inscripciones: playerInscriptions(indexes, player.id).map(inscription => ({
          id: inscription.id,
          club_id: inscription.club_id,
          torneo_id: inscription.torneo_id,
          club: indexes.clubesById.get(String(inscription.club_id))?.nombre_corto || null
        }))
      }))
    }));
}

function distributionKeyForClub(event, indexes) {
  const club = indexes.clubesById.get(String(event.equipo_id));
  if (club) return `${club.id} ${club.nombre_corto || club.nombre_oficial}`;
  return String(event.equipo_id || event.equipo || "sin_equipo");
}

function analyzeHistoricalPlayers(data, options = {}) {
  const tournamentId = options.tournamentId || DEFAULT_TOURNAMENT_ID;
  const indexes = buildIndexes(data);
  const identityEntries = buildIdentityEntries(indexes);
  const statusCounts = new Map();
  const typeCounts = new Map();
  const clubCounts = new Map();
  const tournamentCounts = new Map();
  const classified = [];
  const uniqueExactNames = new Set();
  const uniqueNormalizedNames = new Set();

  const historicalEvents = indexes.eventos.filter(event => {
    const match = indexes.partidosById.get(String(event.partido_id));
    return String(match?.torneo_id) === String(tournamentId);
  });

  historicalEvents.forEach(event => {
    const match = indexes.partidosById.get(String(event.partido_id));
    const type = normalizeEventType(event.tipo);
    const playerText = cleanPlayerName(event.jugador);
    if (hasPlayerText(playerText)) {
      uniqueExactNames.add(playerText);
      uniqueNormalizedNames.add(normalizePlayerName(playerText));
    }

    increment(typeCounts, type || "sin_tipo");
    increment(clubCounts, distributionKeyForClub(event, indexes));
    increment(tournamentCounts, String(match?.torneo_id || "sin_torneo"));

    const classification = classifyEvent(event, indexes, identityEntries);
    increment(statusCounts, classification.status);
    classified.push({
      id: event.id,
      partido_id: event.partido_id,
      tipo: event.tipo,
      tipo_normalizado: type,
      jugador: playerText || null,
      jugador_normalizado: normalizePlayerName(playerText),
      equipo_id: event.equipo_id || null,
      equipo: event.equipo || null,
      torneo_id: match?.torneo_id || null,
      fecha: match?.fecha || null,
      fase: match?.fase || null,
      local_id: match?.local_id || null,
      visitante_id: match?.visitante_id || null,
      inscripcion_jugador_id: event.inscripcion_jugador_id || null,
      status: classification.status,
      canAutoMigrate: classification.canAutoMigrate,
      candidates: classification.candidates
    });
  });

  const names = [...uniqueExactNames].sort((a, b) =>
    a.localeCompare(b, "es", { sensitivity: "base" })
  );
  const autogoles = classified.filter(item => item.tipo_normalizado === "gol_en_contra");
  const autoRows = classified.filter(item => item.canAutoMigrate);
  const reviewRows = classified.filter(item =>
    !["ya_vinculado", "evento_sin_jugador_aplicable"].includes(item.status) &&
    !item.canAutoMigrate
  );

  return {
    metadata: {
      generated_at: new Date().toISOString(),
      tournament_id: tournamentId,
      source: options.source || "local_backup",
      remote_http_methods: REMOTE_HTTP_METHODS,
      remote_writes: 0
    },
    totals: {
      eventos_historicos: historicalEvents.length,
      eventos_con_jugador_textual: classified.filter(item => hasPlayerText(item.jugador)).length,
      nombres_unicos_exactos: uniqueExactNames.size,
      nombres_unicos_normalizados: uniqueNormalizedNames.size,
      coincidencias_exactas_seguras: classified.filter(
        item => item.status === "coincidencia_exacta_segura"
      ).length,
      coincidencias_alias_confirmado: classified.filter(
        item => item.status === "coincidencia_alias_confirmado"
      ).length,
      candidatos_probables: classified.filter(
        item => item.status === "candidato_probable"
      ).length,
      ambiguos: classified.filter(item => item.status === "ambiguo").length,
      sin_coincidencia: classified.filter(
        item => item.status === "sin_coincidencia"
      ).length,
      eventos_sin_jugador: classified.filter(item => item.status === "texto_vacio").length,
      eventos_sin_jugador_aplicable: classified.filter(
        item => item.status === "evento_sin_jugador_aplicable"
      ).length,
      autogoles: autogoles.length,
      migrables_automaticamente: autoRows.length,
      requieren_revision: reviewRows.length,
      ya_vinculados: classified.filter(item => item.status === "ya_vinculado").length
    },
    statusCounts: objectFromSortedMap(statusCounts),
    typeCounts: objectFromSortedMap(typeCounts),
    clubDistribution: Object.fromEntries(
      [...clubCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    ),
    tournamentDistribution: objectFromSortedMap(tournamentCounts),
    possibleExactDuplicates: groupUniqueNamesByNormalization(names),
    probableNameFamilies: groupProbableNameFamilies(names),
    canonicalHomonyms: findCanonicalHomonyms(indexes),
    autogoles,
    classified,
    autoRows,
    reviewRows
  };
}

function summarizeReviewByName(rows) {
  const groups = new Map();
  rows.forEach(row => {
    const key = row.jugador || "(sin jugador)";
    if (!groups.has(key)) {
      groups.set(key, {
        jugador: key,
        jugador_normalizado: row.jugador_normalizado,
        status: row.status,
        eventos: 0,
        clubes: new Set(),
        ejemplos: []
      });
    }
    const group = groups.get(key);
    group.eventos += 1;
    if (row.equipo) group.clubes.add(row.equipo);
    if (group.ejemplos.length < 3) {
      group.ejemplos.push({
        evento_id: row.id,
        partido_id: row.partido_id,
        tipo: row.tipo,
        equipo_id: row.equipo_id,
        equipo: row.equipo
      });
    }
  });

  return [...groups.values()]
    .map(group => ({
      ...group,
      clubes: [...group.clubes].sort()
    }))
    .sort((a, b) =>
      b.eventos - a.eventos ||
      a.jugador.localeCompare(b.jugador, "es", { sensitivity: "base" })
    );
}

function buildMappingProposal(analysis) {
  return {
    metadata: {
      ...analysis.metadata,
      nota:
        "Propuesta de mapeo para revision. No fusiona ni crea jugadores por similitud textual."
    },
    resumen: {
      eventos_migrables_automaticamente: analysis.autoRows.length,
      eventos_requieren_revision: analysis.reviewRows.length,
      jugadores_reales_creados: 0,
      eventos_modificados: 0
    },
    auto_vinculables: analysis.autoRows.map(row => ({
      evento_id: row.id,
      partido_id: row.partido_id,
      jugador_original: row.jugador,
      status: row.status,
      inscripcion_jugador_id: row.candidates[0]?.inscripcion_jugador_id || null,
      jugador_id: row.candidates[0]?.jugador_id || null,
      nombre_canonico: row.candidates[0]?.nombre_completo || null
    })),
    revision_manual: summarizeReviewByName(analysis.reviewRows),
    homonimos_canonicos_existentes: analysis.canonicalHomonyms,
    autogoles: analysis.autogoles
  };
}

function markdownTable(rows, columns) {
  const header = `| ${columns.map(column => column.label).join(" | ")} |`;
  const divider = `| ${columns.map(() => "---").join(" | ")} |`;
  const body = rows.map(row =>
    `| ${columns.map(column => String(column.value(row) ?? "")).join(" | ")} |`
  );
  return [header, divider, ...body].join("\n");
}

function buildReport(analysis) {
  const totals = analysis.totals;
  const statusRows = ORDERED_STATUSES
    .map(status => ({ status, count: analysis.statusCounts[status] || 0 }))
    .filter(row => row.count > 0 || row.status !== "vinculo_roto");
  const typeRows = Object.entries(analysis.typeCounts)
    .map(([type, count]) => ({ type, count }));
  const clubRows = Object.entries(analysis.clubDistribution)
    .map(([club, count]) => ({ club, count }));
  const reviewExamples = summarizeReviewByName(analysis.reviewRows).slice(0, 25);

  return [
    "# Identidad de jugadores - dry-run historico",
    "",
    `Generado: ${analysis.metadata.generated_at}`,
    `Torneo analizado: ${analysis.metadata.tournament_id}`,
    "",
    "## Resumen",
    "",
    markdownTable([
      ["Eventos historicos", totals.eventos_historicos],
      ["Eventos con jugador textual", totals.eventos_con_jugador_textual],
      ["Nombres unicos exactos", totals.nombres_unicos_exactos],
      ["Nombres unicos normalizados", totals.nombres_unicos_normalizados],
      ["Posibles duplicados normalizados", analysis.possibleExactDuplicates.length],
      ["Homonimos canonicos existentes", analysis.canonicalHomonyms.length],
      ["Coincidencias exactas seguras nuevas", totals.coincidencias_exactas_seguras],
      ["Coincidencias por alias confirmado", totals.coincidencias_alias_confirmado],
      ["Candidatos probables", totals.candidatos_probables],
      ["Ambiguos", totals.ambiguos],
      ["Sin coincidencia", totals.sin_coincidencia],
      ["Migrables automaticamente", analysis.autoRows.length],
      ["Ya vinculados por inscripcion", totals.ya_vinculados],
      ["Requieren revision", totals.requieren_revision],
      ["Eventos sin jugador textual", totals.eventos_sin_jugador],
      ["Eventos sin jugador aplicable", totals.eventos_sin_jugador_aplicable],
      ["Autogoles", totals.autogoles]
    ].map(([metric, value]) => ({ metric, value })), [
      { label: "metrica", value: row => row.metric },
      { label: "valor", value: row => row.value }
    ]),
    "",
    "## Clasificacion",
    "",
    markdownTable(statusRows, [
      { label: "estado", value: row => row.status },
      { label: "eventos", value: row => row.count }
    ]),
    "",
    "## Tipos de incidencia",
    "",
    markdownTable(typeRows, [
      { label: "tipo", value: row => row.type },
      { label: "eventos", value: row => row.count }
    ]),
    "",
    "## Distribucion por club",
    "",
    markdownTable(clubRows, [
      { label: "club", value: row => row.club },
      { label: "eventos", value: row => row.count }
    ]),
    "",
    "## Distribucion por torneo",
    "",
    markdownTable(Object.entries(analysis.tournamentDistribution).map(([torneo, count]) => ({
      torneo,
      count
    })), [
      { label: "torneo_id", value: row => row.torneo },
      { label: "eventos", value: row => row.count }
    ]),
    "",
    "## Autogoles",
    "",
    analysis.autogoles.length > 0
      ? markdownTable(analysis.autogoles, [
          { label: "evento_id", value: row => row.id },
          { label: "partido_id", value: row => row.partido_id },
          { label: "jugador", value: row => row.jugador },
          { label: "equipo_id", value: row => row.equipo_id },
          { label: "equipo", value: row => row.equipo },
          { label: "estado", value: row => row.status }
        ])
      : "No se detectaron autogoles.",
    "",
    "## Homonimos canonicos existentes",
    "",
    analysis.canonicalHomonyms.length > 0
      ? markdownTable(analysis.canonicalHomonyms.flatMap(group =>
          group.players.map(player => ({
            normalized: group.normalized,
            jugador_id: player.id,
            nombre: player.nombre_completo,
            inscripciones: player.inscripciones
              .map(item => `${item.inscripciones || item.id}:${item.club || item.club_id}/T${item.torneo_id}`)
              .join(", ")
          }))
        ), [
          { label: "normalizado", value: row => row.normalized },
          { label: "jugador_id", value: row => row.jugador_id },
          { label: "nombre", value: row => row.nombre },
          { label: "inscripciones", value: row => row.inscripciones }
        ])
      : "No se detectaron homonimos canonicos.",
    "",
    "## Familias de nombres para revisar",
    "",
    analysis.probableNameFamilies.length > 0
      ? markdownTable(analysis.probableNameFamilies.slice(0, 20), [
          { label: "clave", value: row => row.key },
          { label: "variantes", value: row => row.names.join("; ") }
        ])
      : "No se detectaron familias probables.",
    "",
    "## Ejemplos que requieren revision",
    "",
    reviewExamples.length > 0
      ? markdownTable(reviewExamples, [
          { label: "jugador_original", value: row => row.jugador },
          { label: "eventos", value: row => row.eventos },
          { label: "estado", value: row => row.status },
          { label: "clubes", value: row => row.clubes.join("; ") }
        ])
      : "No hay casos pendientes de revision.",
    "",
    "## Conclusion operativa",
    "",
    `Migracion automatica futura posible: ${analysis.autoRows.length} eventos.`,
    `Revision manual requerida: ${analysis.reviewRows.length} eventos.`,
    "No se modificaron eventos, jugadores, torneos, clubes ni resultados."
  ].join("\n");
}

function groupScorersTransition(events) {
  const groups = new Map();
  const seenEventIds = new Set();

  asArray(events).forEach(event => {
    if (!isScorerEvent(event)) return;
    if (event.id !== null && event.id !== undefined) {
      const eventKey = String(event.id);
      if (seenEventIds.has(eventKey)) return;
      seenEventIds.add(eventKey);
    }

    const playerText = cleanPlayerName(
      event.jugador_nombre || event.nombre_completo || event.jugador
    );
    if (!event.inscripcion_jugador_id && !hasPlayerText(playerText)) return;

    const identityKey = event.inscripcion_jugador_id
      ? `inscripcion:${event.inscripcion_jugador_id}`
      : `texto:${normalizePlayerName(playerText)}:club:${event.equipo_id || "sin_equipo"}`;
    const current = groups.get(identityKey) || {
      identityKey,
      inscripcion_jugador_id: event.inscripcion_jugador_id || null,
      jugador: playerText || "Jugador sin identificar",
      equipo_id: event.equipo_id || null,
      goles: 0,
      eventos_pendientes_vincular: 0
    };

    current.goles += 1;
    if (!event.inscripcion_jugador_id) {
      current.eventos_pendientes_vincular += 1;
    }
    groups.set(identityKey, current);
  });

  return [...groups.values()].sort((a, b) =>
    b.goles - a.goles ||
    a.jugador.localeCompare(b.jugador, "es", { sensitivity: "base" })
  );
}

function extractPublicSupabaseConfig() {
  const text = fs.readFileSync(path.join(ROOT, "js", "config.js"), "utf8");
  const urlMatch = text.match(/SUPABASE_URL\s*=\s*"([^"]+)"/);
  const keyMatch = text.match(/SUPABASE_KEY\s*=\s*"([^"]+)"/);
  if (!urlMatch || !keyMatch) {
    throw new Error("No se pudo leer la configuracion publica de Supabase.");
  }
  return { url: urlMatch[1].replace(/\/+$/, ""), key: keyMatch[1] };
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
          Accept: "application/json"
        }
      },
      response => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", chunk => {
          body += chunk;
        });
        response.on("end", () => {
          if (response.statusCode < 200 || response.statusCode >= 300) {
            reject(
              new Error(
                `Supabase GET ${restPath} -> ${response.statusCode}: ${body}`
              )
            );
            return;
          }
          resolve(body ? JSON.parse(body) : []);
        });
      }
    );
    request.on("error", reject);
    request.end();
  });
}

async function loadRemoteDataset() {
  const config = extractPublicSupabaseConfig();
  const [
    torneos,
    clubes,
    jugadores,
    inscripciones,
    partidos,
    eventos,
    goleadores
  ] = await Promise.all([
    supabaseGet(config, "/rest/v1/torneos?select=*&order=id.asc"),
    supabaseGet(config, "/rest/v1/clubes?select=*&order=id.asc"),
    supabaseGet(config, "/rest/v1/jugadores?select=*&order=id.asc"),
    supabaseGet(
      config,
      "/rest/v1/inscripciones_jugadores?select=*&order=id.asc"
    ),
    supabaseGet(config, "/rest/v1/partidos?select=*&order=id.asc"),
    supabaseGet(config, "/rest/v1/eventos_partido?select=*&order=id.asc"),
    supabaseGet(
      config,
      "/rest/v1/goleadores_oficiales?select=*&order=id.asc"
    )
  ]);

  return {
    metadata: {
      formato: "tres-palos-auditoria-remota-identidad-jugadores",
      generado_en: new Date().toISOString(),
      metodo: "Supabase REST publico, solo GET"
    },
    torneos,
    clubes,
    jugadores,
    inscripciones_jugadores: inscripciones,
    partidos,
    eventos_partido: eventos,
    goleadores_oficiales: goleadores
  };
}

function ensureParentDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

async function run(options = parseArgs()) {
  if (options.help) {
    return { help: usage() };
  }

  const data = options.remoteRead
    ? await loadRemoteDataset()
    : readJson(options.backupPath);
  const analysis = analyzeHistoricalPlayers(data, {
    tournamentId: options.tournamentId,
    source: options.remoteRead ? "supabase_rest_get" : options.backupPath
  });

  if (options.writeReport) {
    ensureParentDir(options.reportPath);
    fs.writeFileSync(options.reportPath, buildReport(analysis));
  }
  if (options.writeMapping) {
    ensureParentDir(options.mappingPath);
    fs.writeFileSync(
      options.mappingPath,
      JSON.stringify(buildMappingProposal(analysis), null, 2)
    );
  }

  return analysis;
}

if (require.main === module) {
  run()
    .then(result => {
      if (result.help) {
        console.log(result.help);
        return;
      }
      console.log(JSON.stringify({
        eventos_historicos: result.totals.eventos_historicos,
        ya_vinculados: result.totals.ya_vinculados,
        migrables_automaticamente: result.totals.migrables_automaticamente,
        requieren_revision: result.totals.requieren_revision,
        escrituras_supabase: 0
      }, null, 2));
    })
    .catch(error => {
      console.error(error.message);
      process.exitCode = 1;
    });
}

module.exports = {
  BLOCKED_FLAGS,
  REMOTE_HTTP_METHODS,
  DEFAULT_BACKUP_PATH,
  DEFAULT_REPORT_PATH,
  DEFAULT_MAPPING_PATH,
  PERSON_EVENT_TYPES,
  SCORER_TYPES,
  parseArgs,
  readJson,
  normalizePlayerName,
  cleanPlayerName,
  normalizeEventType,
  hasPlayerText,
  buildIndexes,
  buildIdentityEntries,
  findCandidatesForEvent,
  classifyEvent,
  analyzeHistoricalPlayers,
  summarizeReviewByName,
  buildMappingProposal,
  buildReport,
  groupScorersTransition,
  run
};
