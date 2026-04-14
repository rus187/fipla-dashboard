import type { DossierClient } from "../../types";
import { callTaxwareDomicileFromCityV2 } from "./callTaxware";
import {
  buildDomicileTaxCityV2PayloadFromBases,
  type DomicileTaxCityBases,
} from "./domicileTaxCityV2";
import { computeInsurancePrimesDeductionCap } from "./domicileInsurancePrimes";
import type { TaxwareNormalizedResponse } from "./normalizeTaxwareResponse";

type DomicileCorrectionLocation = {
  city: string;
  zip: string;
  shortnameCanton: string;
  municipality?: string;
};

type DomicileDisplayedMetrics = {
  taxableIncomeFederal: number | null;
  taxableIncomeCantonal: number | null;
  taxableAssets: number | null;
  taxTotal: number | null;
};

type DisplayValueSource =
  | "taxware-raw"
  | "application-insurance-primes-correction"
  | "taxware-v2-corrected-bases";

export type InsurancePrimesRealityCorrection = {
  actuallyPaid: number;
  cantonalCap: number;
  federalCap: number;
  taxwareDeductionCantonal: number;
  taxwareDeductionFederal: number;
  retainedDeductionCantonal: number;
  retainedDeductionFederal: number;
  overDeductionCantonal: number;
  overDeductionFederal: number;
  taxwareTaxableIncomeCantonal: number | null;
  taxwareTaxableIncomeFederal: number | null;
  correctedTaxableIncomeCantonal: number | null;
  correctedTaxableIncomeFederal: number | null;
  taxableAssets: number | null;
  shouldApplyCorrection: boolean;
  targetCanton: string;
  targetLocation: string;
};

export type DomicileInsurancePrimesRealityDisplay = {
  correction: InsurancePrimesRealityCorrection;
  correctionPayload: Record<string, unknown> | null;
  correctionResult:
    | {
        raw: unknown;
        normalized: TaxwareNormalizedResponse | null;
      }
    | null;
  displayedMetrics: DomicileDisplayedMetrics;
  displayedNormalized: TaxwareNormalizedResponse | null;
  displayedValueSources: {
    taxableIncomeFederal: DisplayValueSource;
    taxableIncomeCantonal: DisplayValueSource;
    taxableAssets: DisplayValueSource;
    taxTotal: DisplayValueSource;
  };
};

function toFiniteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toPositiveNumber(value: unknown) {
  const numericValue =
    typeof value === "number" && Number.isFinite(value) ? value : Number(value || 0);

  return Math.max(0, Number.isFinite(numericValue) ? numericValue : 0);
}

function getSimulationYear(dossier: DossierClient) {
  const explicitYear = Math.round(toPositiveNumber(dossier.fiscalite.anneeSimulation));
  return explicitYear >= 2000 ? explicitYear : new Date().getFullYear();
}

function cloneNormalizedResponse(
  normalized: TaxwareNormalizedResponse | null | undefined
): TaxwareNormalizedResponse | null {
  if (!normalized) {
    return null;
  }

  return {
    ...normalized,
    cantonalBreakdown: {
      ...normalized.cantonalBreakdown,
    },
    cantonalContext: {
      ...normalized.cantonalContext,
    },
    deductions: {
      occupational: {
        ...normalized.deductions.occupational,
      },
      insurance: {
        ...normalized.deductions.insurance,
      },
      social: {
        ...normalized.deductions.social,
        details: {
          children: {
            ...normalized.deductions.social.details.children,
          },
          personal: {
            ...normalized.deductions.social.details.personal,
          },
          secondEarner: {
            ...normalized.deductions.social.details.secondEarner,
          },
          assets: {
            ...normalized.deductions.social.details.assets,
          },
        },
      },
    },
  };
}

export function computeInsurancePrimesRealityCorrection(params: {
  dossier: DossierClient;
  location: DomicileCorrectionLocation;
  normalized: TaxwareNormalizedResponse | null | undefined;
}): InsurancePrimesRealityCorrection {
  const caps = computeInsurancePrimesDeductionCap(params.dossier, {
    cantonalShortname: params.location.shortnameCanton,
  });
  const actuallyPaid = toPositiveNumber(params.dossier.charges.primesMaladie);
  const taxwareDeductionCantonal = toPositiveNumber(
    params.normalized?.deductions?.insurance?.cantonal
  );
  const taxwareDeductionFederal = toPositiveNumber(
    params.normalized?.deductions?.insurance?.federal
  );
  const retainedDeductionCantonal = Math.min(actuallyPaid, caps.cantonal);
  const retainedDeductionFederal = Math.min(actuallyPaid, caps.federal);
  const overDeductionCantonal = Math.max(0, taxwareDeductionCantonal - retainedDeductionCantonal);
  const overDeductionFederal = Math.max(0, taxwareDeductionFederal - retainedDeductionFederal);
  const taxwareTaxableIncomeCantonal = toFiniteNumber(params.normalized?.taxableIncomeCantonal);
  const taxwareTaxableIncomeFederal = toFiniteNumber(params.normalized?.taxableIncomeFederal);

  return {
    actuallyPaid,
    cantonalCap: caps.cantonal,
    federalCap: caps.federal,
    taxwareDeductionCantonal,
    taxwareDeductionFederal,
    retainedDeductionCantonal,
    retainedDeductionFederal,
    overDeductionCantonal,
    overDeductionFederal,
    taxwareTaxableIncomeCantonal,
    taxwareTaxableIncomeFederal,
    correctedTaxableIncomeCantonal:
      typeof taxwareTaxableIncomeCantonal === "number"
        ? taxwareTaxableIncomeCantonal + overDeductionCantonal
        : null,
    correctedTaxableIncomeFederal:
      typeof taxwareTaxableIncomeFederal === "number"
        ? taxwareTaxableIncomeFederal + overDeductionFederal
        : null,
    taxableAssets: toFiniteNumber(params.normalized?.taxableAssets),
    shouldApplyCorrection: overDeductionCantonal > 0 || overDeductionFederal > 0,
    targetCanton: params.location.shortnameCanton,
    targetLocation:
      params.location.municipality && params.location.shortnameCanton
        ? `${params.location.municipality} (${params.location.shortnameCanton})`
        : `${params.location.city} ${params.location.zip}`.trim(),
  };
}

export async function resolveDomicileInsurancePrimesRealityDisplay(params: {
  dossier: DossierClient;
  location: DomicileCorrectionLocation;
  result:
    | {
        raw: unknown;
        normalized: TaxwareNormalizedResponse | null;
      }
    | null
    | undefined;
}): Promise<DomicileInsurancePrimesRealityDisplay> {
  const baseNormalized = cloneNormalizedResponse(params.result?.normalized);
  const correction = computeInsurancePrimesRealityCorrection({
    dossier: params.dossier,
    location: params.location,
    normalized: baseNormalized,
  });

  const displayedMetrics: DomicileDisplayedMetrics = {
    taxableIncomeFederal: baseNormalized?.taxableIncomeFederal ?? null,
    taxableIncomeCantonal: baseNormalized?.taxableIncomeCantonal ?? null,
    taxableAssets: baseNormalized?.taxableAssets ?? null,
    taxTotal: baseNormalized?.totalTax ?? null,
  };

  if (
    !correction.shouldApplyCorrection ||
    typeof correction.correctedTaxableIncomeFederal !== "number" ||
    typeof correction.correctedTaxableIncomeCantonal !== "number"
  ) {
    console.info("[DOMICILE][INSURANCE_PRIMES][CORRECTION]", {
      location: correction.targetLocation,
      actuallyPaid: correction.actuallyPaid,
      cantonalCap: correction.cantonalCap,
      federalCap: correction.federalCap,
      taxwareDeductionCantonal: correction.taxwareDeductionCantonal,
      taxwareDeductionFederal: correction.taxwareDeductionFederal,
      retainedDeductionCantonal: correction.retainedDeductionCantonal,
      retainedDeductionFederal: correction.retainedDeductionFederal,
      overDeductionCantonal: correction.overDeductionCantonal,
      overDeductionFederal: correction.overDeductionFederal,
      taxwareTaxableIncomeCantonal: correction.taxwareTaxableIncomeCantonal,
      taxwareTaxableIncomeFederal: correction.taxwareTaxableIncomeFederal,
      correctedTaxableIncomeCantonal: correction.correctedTaxableIncomeCantonal,
      correctedTaxableIncomeFederal: correction.correctedTaxableIncomeFederal,
      displaySource: "taxware-raw",
    });

    return {
      correction,
      correctionPayload: null,
      correctionResult: null,
      displayedMetrics,
      displayedNormalized: baseNormalized,
      displayedValueSources: {
        taxableIncomeFederal: "taxware-raw",
        taxableIncomeCantonal: "taxware-raw",
        taxableAssets: "taxware-raw",
        taxTotal: "taxware-raw",
      },
    };
  }

  const correctionBases: DomicileTaxCityBases = {
    taxableIncomeFederal: correction.correctedTaxableIncomeFederal,
    taxableIncomeCantonal: correction.correctedTaxableIncomeCantonal,
    taxableAssets: correction.taxableAssets ?? 0,
  };
  const correctionPayload = buildDomicileTaxCityV2PayloadFromBases({
    year: getSimulationYear(params.dossier),
    partnership: params.dossier.famille.aConjoint ? "Marriage" : "Single",
    childrenCount: Number(params.dossier.famille.nombreEnfants || 0),
    location: {
      city: params.location.city,
      zip: params.location.zip,
    },
    bases: correctionBases,
  }) as Record<string, unknown>;
  const correctionResult = await callTaxwareDomicileFromCityV2(correctionPayload);
  const correctionNormalized = cloneNormalizedResponse(
    correctionResult?.normalized as TaxwareNormalizedResponse | null | undefined
  );
  const displayedNormalized = correctionNormalized
    ? {
        ...correctionNormalized,
        taxableIncomeFederal: correction.correctedTaxableIncomeFederal,
        taxableIncomeCantonal: correction.correctedTaxableIncomeCantonal,
        taxableAssets: correction.taxableAssets ?? correctionNormalized.taxableAssets,
      }
    : baseNormalized
      ? {
          ...baseNormalized,
          taxableIncomeFederal: correction.correctedTaxableIncomeFederal,
          taxableIncomeCantonal: correction.correctedTaxableIncomeCantonal,
          taxableAssets: correction.taxableAssets ?? baseNormalized.taxableAssets,
        }
      : null;

  const finalDisplayedMetrics: DomicileDisplayedMetrics = {
    taxableIncomeFederal:
      displayedNormalized?.taxableIncomeFederal ?? correction.correctedTaxableIncomeFederal,
    taxableIncomeCantonal:
      displayedNormalized?.taxableIncomeCantonal ?? correction.correctedTaxableIncomeCantonal,
    taxableAssets: displayedNormalized?.taxableAssets ?? correction.taxableAssets ?? null,
    taxTotal: displayedNormalized?.totalTax ?? baseNormalized?.totalTax ?? null,
  };

  console.info("[DOMICILE][INSURANCE_PRIMES][CORRECTION]", {
    location: correction.targetLocation,
    actuallyPaid: correction.actuallyPaid,
    cantonalCap: correction.cantonalCap,
    federalCap: correction.federalCap,
    taxwareDeductionCantonal: correction.taxwareDeductionCantonal,
    taxwareDeductionFederal: correction.taxwareDeductionFederal,
    retainedDeductionCantonal: correction.retainedDeductionCantonal,
    retainedDeductionFederal: correction.retainedDeductionFederal,
    overDeductionCantonal: correction.overDeductionCantonal,
    overDeductionFederal: correction.overDeductionFederal,
    taxwareTaxableIncomeCantonal: correction.taxwareTaxableIncomeCantonal,
    taxwareTaxableIncomeFederal: correction.taxwareTaxableIncomeFederal,
    correctedTaxableIncomeCantonal: correction.correctedTaxableIncomeCantonal,
    correctedTaxableIncomeFederal: correction.correctedTaxableIncomeFederal,
    correctionPayload,
    correctionRawResponse: correctionResult?.raw ?? null,
    correctionNormalizedResponse: correctionNormalized,
    displaySource: "taxware-v2-corrected-bases",
  });

  return {
    correction,
    correctionPayload,
    correctionResult: {
      raw: correctionResult?.raw ?? null,
      normalized: correctionNormalized,
    },
    displayedMetrics: finalDisplayedMetrics,
    displayedNormalized,
    displayedValueSources: {
      taxableIncomeFederal: "application-insurance-primes-correction",
      taxableIncomeCantonal: "application-insurance-primes-correction",
      taxableAssets: "taxware-raw",
      taxTotal: correctionNormalized?.totalTax != null ? "taxware-v2-corrected-bases" : "taxware-raw",
    },
  };
}
