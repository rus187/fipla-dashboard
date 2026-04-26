export type TaxwareV2Reliability = {
  source: "v2-from-bases";
  basesSource: "office-aligned" | "v1-derived-corrected";
  requestedBases: {
    taxableIncomeFederal: number;
    taxableIncomeCanton: number;
    taxableAssets: number;
  };
};

export type TaxwareV2NormalizedResponse = {
  canton: string | null;
  municipality: string | null;
  taxableIncomeFederal: number;
  taxableIncomeCanton: number;
  taxableAssets: number;
  federalTax: number | null;
  cantonalTax: number | null;
  communalTax: number | null;
  churchTax: number | null;
  cantonalCommunalTax: number | null;
  wealthTax: number | null;
  totalTax: number | null;
  marginalTaxRate: number | null;
  cantonCoefficient: number | null;
  municipalityCoefficient: number | null;
  reliability: TaxwareV2Reliability;
  raw: unknown;
};

type AnyRecord = Record<string, any>;

function toNum(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return null;
}

export function normalizeTaxwareV2Response(
  rawResponse: AnyRecord | null | undefined,
  requestedBases: {
    taxableIncomeFederal: number;
    taxableIncomeCanton: number;
    taxableAssets: number;
  },
  basesSource: TaxwareV2Reliability["basesSource"]
): TaxwareV2NormalizedResponse {
  const src = (rawResponse ?? {}) as AnyRecord;
  const income = (src.IncomeTaxResult ?? {}) as AnyRecord;
  const assets = (src.AssetTaxResult ?? {}) as AnyRecord;

  return {
    canton: typeof src.Canton === "string" ? src.Canton : null,
    municipality: typeof src.Municipality === "string" ? src.Municipality : null,

    taxableIncomeFederal: requestedBases.taxableIncomeFederal,
    taxableIncomeCanton: requestedBases.taxableIncomeCanton,
    taxableAssets: requestedBases.taxableAssets,

    federalTax: toNum(income.FederalTax),
    cantonalTax: toNum(income.CantonTax),
    communalTax: toNum(income.MunicipalityTax),
    churchTax: toNum(income.ParishTaxTotal),
    cantonalCommunalTax: toNum(income.CantonMunicipalityParishTaxTotal),
    wealthTax: toNum(assets.TaxTotal),
    totalTax: toNum(src.TaxesTotal),
    marginalTaxRate: toNum(income.MarginalTaxRate),

    cantonCoefficient: toNum(income.CantonCoefficient),
    municipalityCoefficient: toNum(income.MunicipalityCoefficient),

    reliability: {
      source: "v2-from-bases",
      basesSource,
      requestedBases,
    },

    raw: rawResponse,
  };
}
