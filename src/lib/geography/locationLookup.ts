import zipToFiscal from "../../data/geography/zip-to-fiscal.json";

export type SwissLocationRow = {
  zip: string;
  locality: string;
  localityCanton?: string;
  ofs?: number | null;
  fiscalCommune?: string | null;
  fiscalCanton?: string | null;
};

export type SwissLocationSuggestion = {
  key: string;
  zip: string;
  locality: string;
  fiscalCommune: string;
  canton: string;
  matchedAlias: string;
  selectionLabel: string;
  score: number;
};

const CANTON_SUFFIX_RE = /\s+[A-Z]{2}$/;
const PAREN_SUFFIX_RE = /\s+\([^)]*\)$/;

const EXONYM_ALIASES: Record<string, string[]> = {
  bern: ["berne"],
  berne: ["bern"],
  "biel/bienne": ["biel", "bienne"],
  biel: ["biel/bienne", "bienne"],
  bienne: ["biel/bienne", "biel"],
  fribourg: ["freiburg"],
  freiburg: ["fribourg"],
  geneve: ["genève", "genf"],
  genf: ["genève", "geneve"],
  neuchatel: ["neuenburg"],
  neuenburg: ["neuchâtel", "neuchatel"],
  sion: ["sitten"],
  sitten: ["sion"],
  delemont: ["delémont", "delsberg"],
  delsberg: ["delémont", "delemont"],
  porrentruy: ["pruntrut"],
  pruntrut: ["porrentruy"],
};

function normalizeSearchValue(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[()'/.\\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanAliasValue(value: string) {
  return value.replace(CANTON_SUFFIX_RE, "").replace(PAREN_SUFFIX_RE, "").trim();
}

function buildAliasSet(row: SwissLocationRow) {
  const values = new Set<string>();
  const locality = (row.locality || "").trim();
  const fiscalCommune = (row.fiscalCommune || "").trim();

  const add = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      return;
    }

    values.add(trimmed);
    const cleaned = cleanAliasValue(trimmed);
    if (cleaned && cleaned !== trimmed) {
      values.add(cleaned);
    }

    if (trimmed.includes("/")) {
      trimmed
        .split("/")
        .map((part) => cleanAliasValue(part))
        .filter(Boolean)
        .forEach((part) => values.add(part));
    }
  };

  add(locality);
  add(fiscalCommune);

  const normalizedAliases = Array.from(values).map((value) => normalizeSearchValue(value));
  for (const normalizedAlias of normalizedAliases) {
    const aliases = EXONYM_ALIASES[normalizedAlias];
    if (!aliases) {
      continue;
    }

    aliases.forEach((alias) => values.add(alias));
  }

  return Array.from(values);
}

type IndexedLocation = {
  row: SwissLocationRow;
  key: string;
  canton: string;
  fiscalCommune: string;
  aliases: string[];
  normalizedAliases: string[];
};

function buildSuggestionFromIndexedLocation(
  entry: IndexedLocation,
  matchedAlias: string,
  score: number
): SwissLocationSuggestion {
  const primaryLabelBase =
    entry.fiscalCommune &&
    normalizeSearchValue(entry.fiscalCommune) !== normalizeSearchValue(entry.row.locality)
      ? `${entry.row.zip} ${entry.row.locality} -> ${entry.fiscalCommune}`
      : `${entry.row.zip} ${entry.row.locality}`;
  const primaryLabel = `${primaryLabelBase}${entry.canton ? ` (${entry.canton})` : ""}`;
  const selectionLabel =
    matchedAlias === entry.row.zip ||
    normalizeSearchValue(matchedAlias) === normalizeSearchValue(entry.row.locality)
      ? primaryLabel
      : `${matchedAlias} - ${primaryLabel}`;

  const directLocalityBonus =
    normalizeSearchValue(entry.fiscalCommune) === normalizeSearchValue(entry.row.locality) ? 25 : 0;

  return {
    key: entry.key,
    zip: entry.row.zip,
    locality: entry.row.locality,
    fiscalCommune: entry.fiscalCommune,
    canton: entry.canton,
    matchedAlias,
    selectionLabel,
    score: score + directLocalityBonus,
  };
}

const indexedLocations: IndexedLocation[] = (zipToFiscal as SwissLocationRow[]).map((row) => {
  const fiscalCommune = (row.fiscalCommune || row.locality || "").trim();
  const canton = (row.fiscalCanton || row.localityCanton || "").trim();
  const key = [row.zip, row.locality, fiscalCommune, canton, row.ofs ?? ""].join("|");
  const aliases = buildAliasSet(row);

  return {
    row,
    key,
    canton,
    fiscalCommune,
    aliases,
    normalizedAliases: aliases.map((alias) => normalizeSearchValue(alias)),
  };
});

const suggestionsBySelectionLabel = new Map<string, SwissLocationSuggestion>();

indexedLocations.forEach((entry) => {
  const aliasesToIndex = new Set<string>([entry.row.zip, entry.row.locality, ...entry.aliases]);
  aliasesToIndex.forEach((alias) => {
    const suggestion = buildSuggestionFromIndexedLocation(entry, alias, 1000);
    suggestionsBySelectionLabel.set(suggestion.selectionLabel, suggestion);
  });
});

function getAliasScore(alias: string, query: string) {
  if (!alias || !query) {
    return -1;
  }

  if (alias === query) {
    return 1000;
  }

  const aliasTokens = alias.split(" ").filter(Boolean);
  if (aliasTokens.includes(query)) {
    return 850;
  }

  if (alias.startsWith(query)) {
    return 700;
  }

  if (aliasTokens.some((token) => token.startsWith(query))) {
    return 550;
  }

  return -1;
}

function getZipScore(zip: string, query: string) {
  if (!query || !/^\d+$/.test(query)) {
    return -1;
  }

  if (zip === query) {
    return 1000;
  }

  if (zip.startsWith(query)) {
    return 700;
  }

  return -1;
}

function sortSuggestions(
  left: SwissLocationSuggestion,
  right: SwissLocationSuggestion
) {
  if (left.score !== right.score) {
    return right.score - left.score;
  }

  if (left.locality !== right.locality) {
    return left.locality.localeCompare(right.locality, "fr-CH");
  }

  if (left.zip !== right.zip) {
    return left.zip.localeCompare(right.zip, "fr-CH", { numeric: true });
  }

  return left.fiscalCommune.localeCompare(right.fiscalCommune, "fr-CH");
}

export function resolveSwissLocationByZip(zip: string) {
  const trimmedZip = zip.trim();
  if (!trimmedZip) {
    return null;
  }

  const match = indexedLocations.find((entry) => entry.row.zip === trimmedZip);
  if (!match) {
    return null;
  }

  return {
    zip: match.row.zip,
    locality: match.row.locality,
    fiscalCommune: match.fiscalCommune,
    canton: match.canton,
  };
}

export function searchSwissLocations(query: string, limit = 8) {
  const normalizedQuery = normalizeSearchValue(query);
  if (!normalizedQuery) {
    return [];
  }

  const suggestions: SwissLocationSuggestion[] = [];

  for (const entry of indexedLocations) {
    let bestScore = getZipScore(entry.row.zip, normalizedQuery);
    let matchedAlias = entry.row.zip;

    entry.normalizedAliases.forEach((alias, index) => {
      const aliasScore = getAliasScore(alias, normalizedQuery);
      if (aliasScore > bestScore) {
        bestScore = aliasScore;
        matchedAlias = entry.aliases[index] || entry.row.locality;
      }
    });

    if (bestScore < 0) {
      continue;
    }

    suggestions.push(buildSuggestionFromIndexedLocation(entry, matchedAlias, bestScore));
  }

  return suggestions.sort(sortSuggestions).slice(0, limit);
}

export function resolveSwissLocationSelection(
  value: string,
  options?: {
    preferredZip?: string;
  }
) {
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return null;
  }

  const directSelectionMatch = suggestionsBySelectionLabel.get(trimmedValue);
  if (directSelectionMatch) {
    return directSelectionMatch;
  }

  const suggestions = searchSwissLocations(value, 20);
  if (suggestions.length === 0) {
    return null;
  }

  const exactLabelMatch = suggestions.find((suggestion) => suggestion.selectionLabel === trimmedValue);
  if (exactLabelMatch) {
    return exactLabelMatch;
  }

  const normalizedValue = normalizeSearchValue(value);
  const exactAliasMatches = suggestions.filter(
    (suggestion) => normalizeSearchValue(suggestion.matchedAlias) === normalizedValue
  );

  if (options?.preferredZip) {
    const preferredMatch = exactAliasMatches.find(
      (suggestion) => suggestion.zip === options.preferredZip?.trim()
    );
    if (preferredMatch) {
      return preferredMatch;
    }
  }

  if (exactAliasMatches.length === 1) {
    return exactAliasMatches[0];
  }

  return null;
}
