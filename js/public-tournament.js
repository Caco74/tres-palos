(function initPublicTournament(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.TPPublicTournament = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window, function factory() {
  function normalizeTeamName(value) {
    return String(value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizeHostname(value) {
    return String(value ?? "").trim().toLowerCase();
  }

  function isNetlifyPreviewHost(hostname) {
    const host = normalizeHostname(hostname);
    return host.endsWith(".netlify.app") && host !== "tres-palos.netlify.app";
  }

  function getPreviewTournamentId(search, hostname) {
    if (!isNetlifyPreviewHost(hostname)) return null;

    let params;
    try {
      params = new URLSearchParams(String(search || ""));
    } catch (error) {
      return null;
    }

    const value = String(params.get("preview_torneo") || "").trim();
    return /^[1-9]\d*$/.test(value) ? value : null;
  }

  function resolvePreviewTournament(torneos, search, hostname) {
    const id = getPreviewTournamentId(search, hostname);
    if (!id || !Array.isArray(torneos)) return null;

    return torneos.find(torneo => String(torneo.id) === id) || null;
  }

  function compareText(a, b) {
    return String(a ?? "").localeCompare(String(b ?? ""), "es", {
      sensitivity: "base"
    });
  }

  function hasTeamId(value) {
    const text = String(value ?? "").trim();
    return Boolean(text && text !== "0" && text.toLowerCase() !== "null");
  }

  function getTeamKey(id, name) {
    if (hasTeamId(id)) return `id:${String(id).trim()}`;
    const normalized = normalizeTeamName(name);
    return normalized ? `name:${normalized}` : "";
  }

  function hasTournament(match, tournamentId) {
    if (!tournamentId) return true;
    return String(match?.torneo_id ?? "") === String(tournamentId);
  }

  function isRegularMatch(match, tournamentId) {
    return match?.tipo === "regular" && hasTournament(match, tournamentId);
  }

  function getMatchSide(match, side, options = {}) {
    const id = side === "local" ? match?.local_id : match?.visitante_id;
    const rawName = side === "local" ? match?.local : match?.visitante;
    const officialName =
      typeof options.getOfficialName === "function"
        ? options.getOfficialName(rawName, id, match, side)
        : rawName;
    const teamName = officialName || rawName || "";
    const key = getTeamKey(id, teamName);

    return key
      ? {
          key,
          id: hasTeamId(id) ? String(id).trim() : null,
          equipo: teamName
        }
      : null;
  }

  function compareParticipants(a, b) {
    return compareText(a.equipo, b.equipo) || compareText(a.key, b.key);
  }

  function deriveRegularParticipants(matches, options = {}) {
    const tournamentId = options.torneoId || options.tournamentId || null;
    const byKey = new Map();
    const regularMatches = [];
    let order = 0;

    (matches || []).forEach(match => {
      if (!isRegularMatch(match, tournamentId)) return;

      const zona = Number(match.zona);
      if (!Number.isFinite(zona)) return;
      regularMatches.push(match);

      ["local", "visitante"].forEach(side => {
        const team = getMatchSide(match, side, options);
        if (!team) return;

        if (!byKey.has(team.key)) {
          byKey.set(team.key, {
            key: team.key,
            club_id: team.id,
            equipo: team.equipo,
            zonas: new Set(),
            firstZone: zona,
            firstOrder: order
          });
          order += 1;
        }

        const entry = byKey.get(team.key);
        entry.zonas.add(zona);
        if (!entry.equipo && team.equipo) entry.equipo = team.equipo;
        if (!entry.club_id && team.id) entry.club_id = team.id;
      });
    });

    const participants = [...byKey.values()]
      .map(entry => {
        const zonas = [...entry.zonas].sort((a, b) => a - b);
        return {
          key: entry.key,
          club_id: entry.club_id,
          equipo: entry.equipo,
          zona: zonas.length > 1 ? entry.firstZone : zonas[0],
          zonas,
          conflictoZona: zonas.length > 1,
          firstOrder: entry.firstOrder
        };
      })
      .sort((a, b) => a.firstOrder - b.firstOrder);

    const participantsByKey = new Map(
      participants.map(participant => [participant.key, participant])
    );
    const conflicts = participants
      .filter(participant => participant.conflictoZona)
      .map(participant => ({
        key: participant.key,
        club_id: participant.club_id,
        equipo: participant.equipo,
        zonas: participant.zonas
      }));
    const byZone = new Map();

    participants.forEach(participant => {
      if (!byZone.has(participant.zona)) byZone.set(participant.zona, []);
      byZone.get(participant.zona).push(participant);
    });

    byZone.forEach(zoneParticipants => {
      zoneParticipants.sort(compareParticipants);
    });

    return {
      participants,
      participantsByKey,
      byZone,
      zones: [...byZone.keys()].sort((a, b) => a - b),
      conflicts,
      regularMatches
    };
  }

  function getParticipantsByZone(derived, zone) {
    const zoneNumber = Number(zone);
    if (!Number.isFinite(zoneNumber)) return [];
    return (derived?.byZone?.get(zoneNumber) || []).slice();
  }

  function getTeamsByZone(derived, zone) {
    return getParticipantsByZone(derived, zone)
      .filter(participant => !participant.conflictoZona)
      .map(participant => participant.equipo);
  }

  function getZones(derived) {
    return (derived?.zones || []).slice().sort((a, b) => a - b);
  }

  function getFreeParticipants(derived, matches, zone, options = {}) {
    const zoneNumber = Number(zone);
    const zoneParticipants = getParticipantsByZone(derived, zoneNumber)
      .filter(participant => !participant.conflictoZona);
    const playing = new Set();

    (matches || [])
      .filter(match =>
        isRegularMatch(match, options.torneoId || options.tournamentId) &&
        Number(match.zona) === zoneNumber
      )
      .forEach(match => {
        ["local", "visitante"].forEach(side => {
          const team = getMatchSide(match, side, options);
          if (team) playing.add(team.key);
        });
      });

    const free = zoneParticipants.filter(
      participant => !playing.has(participant.key)
    );
    const expected = zoneParticipants.length % 2 === 1 ? 1 : 0;
    const valid = free.length === expected;

    return {
      participants: valid ? free : [],
      teams: valid ? free.map(participant => participant.equipo) : [],
      expected,
      found: free.length,
      valid
    };
  }

  function createTableRow(participant) {
    return {
      key: participant.key,
      equipo: participant.equipo,
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

  function hasResult(match) {
    return (
      match?.goles_local !== null &&
      match?.goles_local !== undefined &&
      match?.goles_visitante !== null &&
      match?.goles_visitante !== undefined &&
      Number.isFinite(Number(match.goles_local)) &&
      Number.isFinite(Number(match.goles_visitante))
    );
  }

  function compareRows(a, b) {
    return (
      b.pts - a.pts ||
      b.dg - a.dg ||
      b.gf - a.gf ||
      compareText(a.equipo, b.equipo)
    );
  }

  function buildZoneTable(matches, zone, options = {}) {
    const zoneNumber = Number(zone);
    const derived = options.derived ||
      deriveRegularParticipants(matches, options);
    const rows = new Map();

    getParticipantsByZone(derived, zoneNumber)
      .filter(participant => !participant.conflictoZona)
      .forEach(participant => {
        rows.set(participant.key, createTableRow(participant));
      });

    (matches || [])
      .filter(match =>
        isRegularMatch(match, options.torneoId || options.tournamentId) &&
        Number(match.zona) === zoneNumber
      )
      .sort((a, b) =>
        Number(a.fecha || 0) - Number(b.fecha || 0) ||
        Number(a.id || 0) - Number(b.id || 0)
      )
      .forEach(match => {
        const localTeam = getMatchSide(match, "local", options);
        const visitanteTeam = getMatchSide(match, "visitante", options);
        const localParticipant = localTeam
          ? derived.participantsByKey.get(localTeam.key)
          : null;
        const visitanteParticipant = visitanteTeam
          ? derived.participantsByKey.get(visitanteTeam.key)
          : null;

        if (
          !localParticipant ||
          !visitanteParticipant ||
          Number(localParticipant.zona) !== zoneNumber ||
          Number(visitanteParticipant.zona) !== zoneNumber ||
          localParticipant.conflictoZona ||
          visitanteParticipant.conflictoZona
        ) {
          return;
        }

        if (!hasResult(match)) return;

        const local = rows.get(localTeam.key);
        const visitante = rows.get(visitanteTeam.key);
        if (!local || !visitante) return;

        const golesLocal = Number(match.goles_local);
        const golesVisitante = Number(match.goles_visitante);

        local.pj += 1;
        visitante.pj += 1;
        local.gf += golesLocal;
        local.gc += golesVisitante;
        visitante.gf += golesVisitante;
        visitante.gc += golesLocal;

        if (golesLocal > golesVisitante) {
          local.pg += 1;
          local.pts += 3;
          visitante.pp += 1;
          local.forma.push("w");
          visitante.forma.push("l");
        } else if (golesLocal < golesVisitante) {
          visitante.pg += 1;
          visitante.pts += 3;
          local.pp += 1;
          local.forma.push("l");
          visitante.forma.push("w");
        } else {
          local.pe += 1;
          visitante.pe += 1;
          local.pts += 1;
          visitante.pts += 1;
          local.forma.push("e");
          visitante.forma.push("e");
        }

        local.dg = local.gf - local.gc;
        visitante.dg = visitante.gf - visitante.gc;
      });

    return [...rows.values()]
      .map(row => ({
        ...row,
        forma: row.forma.slice(-5)
      }))
      .sort(options.compareRows || compareRows);
  }

  function buildGeneralTable(matches, options = {}) {
    const derived = options.derived ||
      deriveRegularParticipants(matches, options);
    return getZones(derived)
      .flatMap(zone =>
        buildZoneTable(matches, zone, { ...options, derived })
          .map(row => ({ ...row, zona: zone }))
      )
      .sort(options.compareRows || compareRows);
  }

  function buildTeamList(derived) {
    const seen = new Set();
    return (derived?.participants || [])
      .filter(participant => {
        if (participant.conflictoZona || seen.has(participant.key)) {
          return false;
        }
        seen.add(participant.key);
        return true;
      })
      .map(participant => ({
        key: participant.key,
        club_id: participant.club_id,
        equipo: participant.equipo,
        zona: participant.zona
      }))
      .sort(compareParticipants);
  }

  return {
    normalizeTeamName,
    normalizeHostname,
    isNetlifyPreviewHost,
    getPreviewTournamentId,
    resolvePreviewTournament,
    getTeamKey,
    getMatchSide,
    deriveRegularParticipants,
    getParticipantsByZone,
    getTeamsByZone,
    getZones,
    getFreeParticipants,
    buildZoneTable,
    buildGeneralTable,
    buildTeamList
  };
});
