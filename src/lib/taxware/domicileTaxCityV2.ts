import type { DossierClient } from "../../types";
import type { TaxwareNormalizedResponse } from "./normalizeTaxwareResponse.ts";

type DomicileTaxCityLocation = {
  city: string;
  zip: string;
};

export type DomicileTaxCityBases = {
  taxableIncomeFederal: number;
  taxableIncomeCantonal: number;
  taxableAssets: number;
};

type DomicileTaxCityPayload = {
  Year: number;
  Partnership: "Single" | "Marriage";
  NumChildren: number;
  City: string;
  Zip: number;
  IncomeTaxParameters: {
    TaxableIncomeFederation: number;
    TaxableIncomeCanton: number;
  };
  AssetTaxParameters: {
    TaxableAssets: number;
  };
};

function normalizeFiniteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function sumDefinedNumbers(...values: Array<number | null>) {
  const validValues = values.filter((value): value is number => typeof value === "number");

  if (validValues.length === 0) {
    return null;
  }

  return validValues.reduce((total, value) => total + value, 0);
}

function getNestedNumber(source: Record<string, unknown>, path: string) {
  const value = path.split(".").reduce<unknown>((current, key) => {
    if (current && typeof current === "object" && key in (current as Record<string, unknown>)) {
      return (current as Record<string, unknown>)[key];
    }

    return undefined;
  }, source);

  return normalizeFiniteNumber(value);
}

function getFirstNestedNumber(source: Record<string, unknown>, paths: string[]) {
  for (const path of paths) {
    const value = getNestedNumber(source, path);
    if (typeof value === "number") {
      return value;
    }
  }

  return null;
}

export function getDomicileTaxCityReferenceBases(dossier: DossierClient) {
  return {
    taxableIncomeFederal: Math.max(0, Number(dossier.fiscalite.revenuImposableIfd || 0)),
    taxableIncomeCantonal: Math.max(0, Number(dossier.fiscalite.revenuImposable || 0)),
    taxableAssets: Math.max(0, Number(dossier.fiscalite.fortuneImposableActuelleSaisie || 0)),
  };
}

export function buildDomicileTaxCityV2PayloadFromBases(params: {
  year: number;
  partnership: "Single" | "Marriage";
  childrenCount: number;
  location: DomicileTaxCityLocation;
  bases: DomicileTaxCityBases;
}): DomicileTaxCityPayload {
  return {
    Year: params.year,
    Partnership: params.partnership,
    NumChildren: params.childrenCount,
    City: params.location.city.trim(),
    Zip: Number(params.location.zip || 0),
    IncomeTaxParameters: {
      TaxableIncomeFederation: Math.max(0, Number(params.bases.taxableIncomeFederal || 0)),
      TaxableIncomeCanton: Math.max(0, Number(params.bases.taxableIncomeCantonal || 0)),
    },
    AssetTaxParameters: {
      TaxableAssets: Math.max(0, Number(params.bases.taxableAssets || 0)),
    },
  };
}

export function buildDomicileTaxCityV2Payload(
  referenceDossier: DossierClient,
  location: DomicileTaxCityLocation
): DomicileTaxCityPayload {
  const referenceBases = getDomicileTaxCityReferenceBases(referenceDossier);

  return buildDomicileTaxCityV2PayloadFromBases({
    year: new Date().getFullYear(),
    partnership: referenceDossier.famille.aConjoint ? "Marriage" : "Single",
    childrenCount: Number(referenceDossier.famille.nombreEnfants || 0),
    location,
    bases: referenceBases,
  });
}

export function adaptDomicileTaxCityV2Response(
  rawResponse: Record<string, unknown> | null | undefined,
  payload: Record<string, unknown>
): TaxwareNormalizedResponse {
  const source = (rawResponse?.data ?? rawResponse ?? {}) as Record<string, unknown>;
  const incomeTaxResult =
    (source.IncomeTaxResult as Record<string, unknown> | undefined) ?? {};
  const assetTaxResult =
    (source.AssetTaxResult as Record<string, unknown> | undefined) ?? {};
  const taxableIncomeCantonal = getFirstNestedNumber(source, [
    "TaxableIncomeCantonal",
    "TaxableIncomeCanton",
    "IncomeTaxResult.TaxableIncomeCantonal",
    "IncomeTaxResult.TaxableIncomeCanton",
    "Result.TaxableIncomeCantonal",
    "Summary.TaxableIncomeCantonal",
  ]);
  const taxableIncomeFederal = getFirstNestedNumber(source, [
    "TaxableIncomeFederal",
    "IncomeTaxResult.TaxableIncomeFederal",
    "Result.TaxableIncomeFederal",
    "Summary.TaxableIncomeFederal",
  ]);
  const taxableAssets = getFirstNestedNumber(source, [
    "TaxableAssets",
    "AssetTaxResult.TaxableAssets",
    "Result.TaxableAssets",
    "Summary.TaxableAssets",
  ]);
  const insuranceFederal = getFirstNestedNumber(source, [
    "DeductionsInsurancePrimesFederal",
    "IncomeTaxResult.DeductionsInsurancePrimesFederal",
    "Result.DeductionsInsurancePrimesFederal",
    "Summary.DeductionsInsurancePrimesFederal",
  ]);
  const insuranceCantonal = getFirstNestedNumber(source, [
    "DeductionsInsurancePrimesCanton",
    "IncomeTaxResult.DeductionsInsurancePrimesCanton",
    "Result.DeductionsInsurancePrimesCanton",
    "Summary.DeductionsInsurancePrimesCanton",
  ]);

  const federalTax =
    getNestedNumber({ IncomeTaxResult: incomeTaxResult }, "IncomeTaxResult.FederalTax");
  const cantonalTax =
    getNestedNumber({ IncomeTaxResult: incomeTaxResult }, "IncomeTaxResult.CantonTax");
  const communalTax =
    getNestedNumber({ IncomeTaxResult: incomeTaxResult }, "IncomeTaxResult.MunicipalityTax");
  const cantonalCommunalTax =
    getNestedNumber(
      { IncomeTaxResult: incomeTaxResult },
      "IncomeTaxResult.CantonMunicipalityParishTaxTotal"
    ) ?? sumDefinedNumbers(cantonalTax, communalTax);
  const wealthTax =
    getNestedNumber({ AssetTaxResult: assetTaxResult }, "AssetTaxResult.TaxTotal") ??
    getNestedNumber(
      { AssetTaxResult: assetTaxResult },
      "AssetTaxResult.CantonMunicipalityParishTaxTotal"
    );
  const totalTax =
    normalizeFiniteNumber(source.TaxesTotal) ??
    sumDefinedNumbers(federalTax, cantonalCommunalTax, wealthTax);

  return {
    canton: typeof source.Canton === "string" ? source.Canton : null,
    municipality: typeof source.Municipality === "string" ? source.Municipality : null,
    taxableIncomeCantonal,
    taxableIncomeFederal,
    taxableAssets,
    federalTax,
    cantonalTax,
    communalTax,
    cantonalCommunalTax,
    wealthTax,
    totalTax,
    cantonalBreakdown: {
      principalCantonalTax: cantonalTax,
      principalCommunalTax: communalTax,
      unitaryTax: getNestedNumber(
        { IncomeTaxResult: incomeTaxResult },
        "IncomeTaxResult.CantonUnitaryTax"
      ),
      cantonAdditionalTax: null,
      municipalityAdditionalTax: null,
      churchTax: getNestedNumber(
        { IncomeTaxResult: incomeTaxResult },
        "IncomeTaxResult.ParishTaxTotal"
      ),
      otherComponentsTotal: null,
      displayedCantonalTotal: cantonalCommunalTax,
    },
    cantonalContext: {
      cantonRule: "domicile-v2-from-city",
      quotientAppliedLocally: false,
      rateDefiningIncomeCantonal: getFirstNestedNumber(source, [
        "RatedefIncomeCanton",
        "IncomeTaxResult.RatedefIncomeCanton",
        "Result.RatedefIncomeCanton",
        "Summary.RatedefIncomeCanton",
      ]),
      cantonAdditionalTax: null,
      municipalityAdditionalTax: null,
      exactCantonalField: "IncomeTaxResult.CantonTax",
      exactCommunalField: "IncomeTaxResult.MunicipalityTax",
      exactUnitaryField: "IncomeTaxResult.CantonUnitaryTax",
      exactTotalField: "TaxesTotal",
      partnership: typeof payload.Partnership === "string" ? payload.Partnership : null,
      childrenCount: normalizeFiniteNumber(payload.NumChildren),
    },
    deductions: {
      occupational: {
        federal: null,
        cantonal: null,
        wealth: null,
      },
      insurance: {
        federal: insuranceFederal,
        cantonal: insuranceCantonal,
        wealth: null,
      },
      social: {
        federal: null,
        cantonal: null,
        wealth: null,
        details: {
          children: {
            federal: null,
            cantonal: null,
            wealth: null,
          },
          personal: {
            federal: null,
            cantonal: null,
            wealth: null,
          },
          secondEarner: {
            federal: null,
            cantonal: null,
            wealth: null,
          },
          assets: {
            federal: null,
            cantonal: null,
            wealth: null,
          },
        },
      },
    },
    raw: rawResponse ?? null,
  };
}
