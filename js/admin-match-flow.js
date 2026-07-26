(function initAdminMatchFlow(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.TPAdminFlow = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window, function factory() {
  const PLAYOFF_ORDER = {
    octavos: 1,
    cuartos: 2,
    semifinal: 3,
    final: 4
  };

  function normalizeSearchText(value) {
    return String(value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function compactSearchText(value) {
    return normalizeSearchText(value).replace(/\s+/g, "");
  }

  function compareNumber(a, b, nullsLast = true) {
    const numberA = Number(a);
    const numberB = Number(b);
    const validA = Number.isFinite(numberA);
    const validB = Number.isFinite(numberB);

    if (validA && validB) return numberA - numberB;
    if (validA) return nullsLast ? -1 : 1;
    if (validB) return nullsLast ? 1 : -1;
    return 0;
  }

  function compareText(a, b, nullsLast = true) {
    const textA = String(a ?? "").trim();
    const textB = String(b ?? "").trim();

    if (textA && textB) {
      return textA.localeCompare(textB, "es", { sensitivity: "base" });
    }
    if (textA) return nullsLast ? -1 : 1;
    if (textB) return nullsLast ? 1 : -1;
    return 0;
  }

  function getVisibleMatch(match, resolver) {
    return typeof resolver === "function"
      ? resolver(match)
      : match || {};
  }

  function getComparableTeam(match, resolver) {
    const visible = getVisibleMatch(match, resolver);
    return visible.local || match?.local || "";
  }

  function compareMatchesSporting(a, b, resolver) {
    return compareNumber(a?.torneo_id, b?.torneo_id) ||
      compareNumber(a?.fecha, b?.fecha) ||
      compareNumber(a?.zona, b?.zona) ||
      compareText(a?.fecha_partido, b?.fecha_partido) ||
      compareText(a?.hora, b?.hora) ||
      compareText(getComparableTeam(a, resolver), getComparableTeam(b, resolver)) ||
      compareNumber(PLAYOFF_ORDER[a?.fase], PLAYOFF_ORDER[b?.fase]) ||
      compareNumber(a?.numero_playoff, b?.numero_playoff) ||
      compareNumber(a?.id, b?.id);
  }

  function sortMatchesForSelector(matches, resolver) {
    return [...(matches || [])].sort((a, b) =>
      compareMatchesSporting(a, b, resolver)
    );
  }

  function matchSearchHaystack(match, resolver, extraLabel = "") {
    const visible = getVisibleMatch(match, resolver);
    return [
      match?.id,
      match?.tipo,
      match?.fase,
      match?.numero_playoff,
      match?.fecha,
      match?.zona,
      match?.estado,
      match?.local,
      match?.visitante,
      match?.source_local,
      match?.source_visitante,
      visible.local,
      visible.visitante,
      extraLabel
    ].join(" ");
  }

  function matchesSearch(match, query, resolver, extraLabel = "") {
    const normalizedQuery = normalizeSearchText(query);
    if (!normalizedQuery) return true;

    const haystack = matchSearchHaystack(match, resolver, extraLabel);
    const spaced = normalizeSearchText(haystack);
    const compact = spaced.replace(/\s+/g, "");
    const compactQuery = compactSearchText(query);
    const tokens = normalizedQuery.split(" ").filter(Boolean);

    return tokens.every(token =>
      spaced.includes(token) || compact.includes(token)
    ) || (compactQuery && compact.includes(compactQuery));
  }

  function filterMatches(matches, filters = {}, resolver, extraLabelForMatch) {
    const tournamentId = filters.torneoId ? String(filters.torneoId) : "";
    const type = filters.tipo || "all";
    const date = filters.fecha ? String(filters.fecha) : "";
    const zone = filters.zona ? String(filters.zona) : "";
    const status = filters.estado ? String(filters.estado) : "";
    const query = filters.equipo || "";

    return sortMatchesForSelector(
      (matches || []).filter(match => {
        const matchTournamentId = match?.torneo_id ? String(match.torneo_id) : "";
        if (tournamentId && matchTournamentId !== tournamentId) return false;
        if (type !== "all" && match?.tipo !== type) return false;
        if (date && String(match?.fecha ?? "") !== date) return false;
        if (zone && String(match?.zona ?? "") !== zone) return false;
        if (status && String(match?.estado || "programado") !== status) {
          return false;
        }

        const label = typeof extraLabelForMatch === "function"
          ? extraLabelForMatch(match)
          : "";
        return matchesSearch(match, query, resolver, label);
      }),
      resolver
    );
  }

  function uniqueSortedNumbers(values) {
    return [...new Set(
      values
        .map(value => Number(value))
        .filter(value => Number.isFinite(value))
    )].sort((a, b) => a - b);
  }

  function uniqueSortedText(values) {
    return [...new Set(
      values
        .map(value => String(value ?? "").trim())
        .filter(Boolean)
    )].sort((a, b) => compareText(a, b));
  }

  function getFilterOptions(matches, filters = {}) {
    const tournamentId = filters.torneoId ? String(filters.torneoId) : "";
    const type = filters.tipo || "all";
    const base = (matches || []).filter(match => {
      const matchTournamentId = match?.torneo_id ? String(match.torneo_id) : "";
      if (tournamentId && matchTournamentId !== tournamentId) return false;
      return type === "all" || match?.tipo === type;
    });
    const regularBase = base.filter(match => match.tipo === "regular");

    return {
      fechas: uniqueSortedNumbers(regularBase.map(match => match.fecha)),
      zonas: uniqueSortedNumbers(regularBase.map(match => match.zona)),
      estados: uniqueSortedText(base.map(match => match.estado || "programado"))
    };
  }

  function isPendingMatch(match) {
    return String(match?.estado || "programado") !== "finalizado";
  }

  function getSuggestedPendingDate(matches, tournamentId) {
    const ordered = sortMatchesForSelector(
      (matches || []).filter(match =>
        match?.tipo === "regular" &&
        (!tournamentId || String(match.torneo_id) === String(tournamentId)) &&
        isPendingMatch(match)
      )
    );

    return ordered[0]?.fecha ? String(ordered[0].fecha) : "";
  }

  function buildRegularStageValue(fecha, zona) {
    const date = String(fecha ?? "").trim();
    const zone = String(zona ?? "").trim();
    return date && zone ? `fecha:${date}:zona:${zone}` : date;
  }

  function parseRegularStageValue(value) {
    const raw = String(value ?? "").trim();
    const zoned = raw.match(/^fecha:(\d+):zona:([A-Za-z0-9_-]+)$/);
    if (zoned) {
      return {
        fecha: zoned[1],
        zona: zoned[2],
        legacy: false
      };
    }

    if (/^\d+$/.test(raw)) {
      return {
        fecha: raw,
        zona: null,
        legacy: true
      };
    }

    return {
      fecha: null,
      zona: null,
      legacy: false
    };
  }

  function isLegacyRegularStageValue(value) {
    const parsed = parseRegularStageValue(value);
    return Boolean(parsed.fecha && parsed.legacy);
  }

  function countMatchesForStage(matches, stage) {
    if (!stage) return 0;
    return (matches || []).filter(match => {
      if (String(match?.torneo_id) !== String(stage.torneoId)) return false;

      if (stage.tipo === "regular") {
        const parsed = parseRegularStageValue(stage.valor);
        if (!parsed.fecha) return false;
        if (match.tipo !== "regular") return false;
        if (String(match.fecha ?? "") !== String(parsed.fecha)) return false;
        return !parsed.zona || String(match.zona ?? "") === String(parsed.zona);
      }

      return match.tipo === "playoff" &&
        String(match.fase) === String(stage.valor);
    }).length;
  }

  return {
    normalizeSearchText,
    compareMatchesSporting,
    sortMatchesForSelector,
    matchesSearch,
    filterMatches,
    getFilterOptions,
    getSuggestedPendingDate,
    buildRegularStageValue,
    parseRegularStageValue,
    isLegacyRegularStageValue,
    countMatchesForStage
  };
});
