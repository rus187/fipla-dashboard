import type { DossierClient } from "../../types";
import { buildTaxwarePayload } from "./buildTaxwarePayload";
import { callTaxwareFromMunicipality } from "./callTaxware";
import { getDomicileInsurancePrimesDeduction } from "./domicileInsurancePrimes";
import { DOMICILE_INTERNAL_DEBUG_KEY, readInternalPayloadDebug } from "./domicilePayloadDebug";

type AnyRecord = Record<string, unknown>;

export type DomicileLocation = {
  zip: string;
  city: string;
  municipality: string;
  shortnameCanton: string;
};

export type DomicileTaxwareMetrics = {
  taxableIncomeFederal: number | null;
  taxableIncomeCantonal: number | null;
  taxableAssets: number | null;
  taxTotal: number | null;
};

function getByPath(source: AnyRecord | null | undefined, path: string): unknown {
  if (!source) {
    return undefined;
  }

  return path.split(".").reduce<unknown>((current, key) => {
    if (current && typeof current === "object" && key in (current as AnyRecord)) {
      return (current as AnyRecord)[key];
    }

    return undefined;
  }, source);
}

function toPositiveNumber(value: unknown) {
  const numericValue =
    typeof value === "number" && Number.isFinite(value) ? value : Number(value || 0);

  return Math.max(0, Number.isFinite(numericValue) ? numericValue : 0);
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const cleaned = value
      .replace(/\s/g, "")
      .replace(/'/g, "")
      .replace(/CHF/gi, "")
      .replace(",", ".");
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function firstNumber(source: AnyRecord, paths: string[]) {
  for (const path of paths) {
    const value = toFiniteNumber(getByPath(source, path));
    if (value !== null) {
      return value;
    }
  }

  return null;
}

function normalizeLocationValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getYearFromDossier(dossier: DossierClient) {
  const year = Math.round(
    toPositiveNumber(dossier.fiscalite.anneeSimulation || new Date().getFullYear())
  );

  return year >= 2000 ? year : new Date().getFullYear();
}

function buildDomicileRealEstates(dossier: DossierClient) {
  const ownerOccupied: Array<{
    taxableValue?: number;
    rentalIncome?: number;
    effectiveExpenses?: number;
  }> =
    dossier.immobilier.proprietaireOccupant &&
    (toPositiveNumber(dossier.immobilier.valeurLocativeHabitationPropre) > 0 ||
      toPositiveNumber(dossier.immobilier.fraisEntretienHabitationPropre) > 0)
      ? [
          {
            rentalIncome: toPositiveNumber(dossier.immobilier.valeurLocativeHabitationPropre),
            effectiveExpenses: toPositiveNumber(dossier.immobilier.fraisEntretienHabitationPropre),
          },
        ]
      : [];

  const rentalProperty: Array<{
    taxableValue?: number;
    rentalIncome?: number;
    effectiveExpenses?: number;
  }> =
    dossier.immobilier.possedeBienRendement &&
    (toPositiveNumber(dossier.immobilier.valeurFiscaleBiensRendement) > 0 ||
      toPositiveNumber(dossier.immobilier.loyersBiensRendement) > 0 ||
      toPositiveNumber(dossier.immobilier.fraisEntretienBiensRendement) > 0)
      ? [
          {
            taxableValue: toPositiveNumber(dossier.immobilier.valeurFiscaleBiensRendement),
            rentalIncome: toPositiveNumber(dossier.immobilier.loyersBiensRendement),
            effectiveExpenses: toPositiveNumber(dossier.immobilier.fraisEntretienBiensRendement),
          },
        ]
      : [];

  return [...ownerOccupied, ...rentalProperty];
}

function getDomicileAssets(dossier: DossierClient) {
  const explicitAssets = toPositiveNumber(dossier.fortune.fortuneTotale);

  if (explicitAssets > 0) {
    return explicitAssets;
  }

  return (
    toPositiveNumber(dossier.fortune.liquidites) +
    toPositiveNumber(dossier.fortune.titres) +
    toPositiveNumber(dossier.fortune.immobilier) +
    toPositiveNumber(dossier.fortune.autresActifs)
  );
}

function getDomicileDebts(dossier: DossierClient) {
  const explicitDebts = toPositiveNumber(dossier.dettes.totalDettes);

  if (explicitDebts > 0) {
    return explicitDebts;
  }

  return (
    toPositiveNumber(dossier.dettes.hypotheques) + toPositiveNumber(dossier.dettes.autresDettes)
  );
}

function getDomicileDebtInterests(dossier: DossierClient) {
  return (
    toPositiveNumber(dossier.immobilier.interetsHypothecairesHabitationPropre) +
    toPositiveNumber(dossier.immobilier.interetsHypothecairesBiensRendement)
  );
}

function getDomicileMiscIncome(dossier: DossierClient) {
  return (
    toPositiveNumber(dossier.revenus.avs) +
    toPositiveNumber(dossier.revenus.lpp) +
    toPositiveNumber(dossier.revenus.avsConjoint) +
    toPositiveNumber(dossier.revenus.lppConjoint) +
    toPositiveNumber(dossier.revenus.autresRevenusConjoint) +
    toPositiveNumber(dossier.revenus.revenuFortune) +
    toPositiveNumber(dossier.revenus.dividendesPriviligies) +
    toPositiveNumber(dossier.revenus.participationsPriviligiees) +
    toPositiveNumber(dossier.revenus.autresRevenus)
  );
}

export function getDomicileLocationFromDossier(dossier: DossierClient): DomicileLocation {
  return {
    zip: normalizeLocationValue(dossier.identite.taxwareZip || dossier.identite.npa),
    city: normalizeLocationValue(
      dossier.identite.taxwareCity || dossier.identite.communeFiscale || dossier.identite.commune
    ),
    municipality: normalizeLocationValue(
      dossier.identite.taxwareCity || dossier.identite.communeFiscale || dossier.identite.commune
    ),
    shortnameCanton: normalizeLocationValue(
      dossier.identite.cantonFiscal || dossier.identite.canton
    ).toUpperCase(),
  };
}

export function hasDomicileEconomicInputs(dossier: DossierClient) {
  return [
    toPositiveNumber(dossier.revenus.salaire),
    toPositiveNumber(dossier.revenus.salaireConjoint),
    getDomicileMiscIncome(dossier),
    getDomicileAssets(dossier),
    getDomicileDebts(dossier),
    getDomicileDebtInterests(dossier),
    ...buildDomicileRealEstates(dossier).flatMap((realEstate) => [
      toPositiveNumber(realEstate.taxableValue),
      toPositiveNumber(realEstate.rentalIncome),
      toPositiveNumber(realEstate.effectiveExpenses),
    ]),
  ].some((value) => value > 0);
}

export function getDomicileValidationError(
  sourceDossier: DossierClient,
  currentLocation: DomicileLocation,
  targetLocation: DomicileLocation
) {
  if (!currentLocation.zip || !currentLocation.city) {
    return "Le domicile actuel doit contenir un NPA et une localité fiscale.";
  }

  if (!currentLocation.municipality || !currentLocation.shortnameCanton) {
    return "Le domicile actuel doit contenir une municipalité et un canton fiscal.";
  }

  if (!targetLocation.zip || !targetLocation.city) {
    return "Le domicile cible doit contenir un NPA et une localité fiscale.";
  }

  if (!targetLocation.municipality || !targetLocation.shortnameCanton) {
    return "Le domicile cible doit contenir une municipalité et un canton fiscal.";
  }

  if (!hasDomicileEconomicInputs(sourceDossier)) {
    return "Le calculateur domicile requiert au moins un revenu, un actif immobilier, de la fortune, des dettes ou des intérêts.";
  }

  return null;
}

export function buildDomicilePayloadFromDossier(
  dossier: DossierClient,
  localisation: DomicileLocation
) {
  const insurancePrimesDeduction = getDomicileInsurancePrimesDeduction(dossier, {
    cantonalShortname: localisation.shortnameCanton,
  });
  const payload = buildTaxwarePayload({
    year: getYearFromDossier(dossier),
    zip: localisation.zip,
    city: localisation.city,
    partnership: dossier.famille.aConjoint ? "Marriage" : "Single",
    childrenCount: Math.max(0, Number(dossier.famille.nombreEnfants || 0)),
    realEstates: buildDomicileRealEstates(dossier),
    netWages: toPositiveNumber(dossier.revenus.salaire),
    pensionIncome: 0,
    hasOasiPensions: false,
    otherIncome: 0,
    thirdPillar: 0,
    lppBuyback: 0,
    assetIncome: 0,
    miscIncome: getDomicileMiscIncome(dossier),
    miscExpenses: 0,
    debtInterests: getDomicileDebtInterests(dossier),
    spouseNetWages: dossier.famille.aConjoint
      ? toPositiveNumber(dossier.revenus.salaireConjoint)
      : 0,
    spousePensionIncome: 0,
    spouseHasOasiPensions: false,
    spouseOtherIncome: 0,
    spouseThirdPillar: 0,
    spouseLppBuyback: 0,
    assets: getDomicileAssets(dossier),
    debts: getDomicileDebts(dossier),
  }) as Record<string, unknown>;

  return {
    ...payload,
    Municipality: localisation.municipality,
    ShortnameCanton: localisation.shortnameCanton,
    [DOMICILE_INTERNAL_DEBUG_KEY]: {
      insurancePrimes: insurancePrimesDeduction,
    },
  };
}

export function stripDomicilePayloadLocation(payload: Record<string, unknown>) {
  const {
    Municipality: _municipality,
    ShortnameCanton: _shortnameCanton,
    Zip: _zip,
    City: _city,
    ...rest
  } = payload;

  return rest;
}

export function buildDomicilePayloadAudit(payload: Record<string, unknown>) {
  const personLeading = (payload.PersonLeading as Record<string, unknown> | undefined) ?? {};
  const personSecond = (payload.PersonSecond as Record<string, unknown> | undefined) ?? {};
  const internalDebug = readInternalPayloadDebug(payload) as
    | {
        insurancePrimes?: {
          actuallyPaid?: number;
          cantonalCap?: number;
          federalCap?: number;
          cantonalRetained?: number;
          federalRetained?: number;
        };
      }
    | null;

  return {
    Year: payload.Year ?? null,
    Partnership: payload.Partnership ?? null,
    NumChildren: payload.NumChildren ?? null,
    Zip: payload.Zip ?? null,
    City: payload.City ?? null,
    Municipality: payload.Municipality ?? null,
    ShortnameCanton: payload.ShortnameCanton ?? null,
    PersonLeading: {
      NetWages: personLeading.NetWages ?? null,
    },
    PersonSecond: {
      NetWages: personSecond.NetWages ?? null,
    },
    MiscIncome: payload.MiscIncome ?? null,
    Assets: payload.Assets ?? null,
    Debts: payload.Debts ?? null,
    DebtInterests: payload.DebtInterests ?? null,
    RealEstates: payload.RealEstates ?? null,
    InsurancePrimes: {
      actuallyPaid: internalDebug?.insurancePrimes?.actuallyPaid ?? null,
      cantonalCap: internalDebug?.insurancePrimes?.cantonalCap ?? null,
      federalCap: internalDebug?.insurancePrimes?.federalCap ?? null,
      cantonalRetained: internalDebug?.insurancePrimes?.cantonalRetained ?? null,
      federalRetained: internalDebug?.insurancePrimes?.federalRetained ?? null,
    },
  };
}

export function extractDomicileTaxwareMetrics(rawResponse: unknown): DomicileTaxwareMetrics {
  const source =
    rawResponse && typeof rawResponse === "object"
      ? ((((rawResponse as AnyRecord).data as AnyRecord | undefined) ?? rawResponse) as AnyRecord)
      : {};

  return {
    taxableIncomeFederal: firstNumber(source, [
      "TaxableIncomeFederal",
      "Result.TaxableIncomeFederal",
      "Summary.TaxableIncomeFederal",
      "RatedefIncomeFederation",
      "RateDefiningIncomeFederation",
      "Result.RatedefIncomeFederation",
      "Summary.RatedefIncomeFederation",
    ]),
    taxableIncomeCantonal: firstNumber(source, [
      "TaxableIncomeCantonal",
      "TaxableIncomeCanton",
      "Result.TaxableIncomeCantonal",
      "Summary.TaxableIncomeCantonal",
      "RatedefIncomeCanton",
      "RateDefiningIncomeCanton",
      "Result.RatedefIncomeCanton",
      "Summary.RatedefIncomeCanton",
    ]),
    taxableAssets: firstNumber(source, [
      "TaxableAssets",
      "AssetsTaxable",
      "Result.TaxableAssets",
      "Summary.TaxableAssets",
    ]),
    taxTotal: firstNumber(source, [
      "TaxTotal",
      "TaxesTotal",
      "Result.TaxTotal",
      "Summary.TaxTotal",
    ]),
  };
}

export async function runDomicileComparison(params: {
  sourceDossier: DossierClient;
  currentLocation: DomicileLocation;
  targetLocation: DomicileLocation;
}) {
  const currentPayload = buildDomicilePayloadFromDossier(
    params.sourceDossier,
    params.currentLocation
  );
  const targetPayload = buildDomicilePayloadFromDossier(
    params.sourceDossier,
    params.targetLocation
  );

  const currentResult = await callTaxwareFromMunicipality(currentPayload);
  const targetResult = await callTaxwareFromMunicipality(targetPayload);

  return {
    currentPayload,
    targetPayload,
    currentResult,
    targetResult,
    currentMetrics: extractDomicileTaxwareMetrics(currentResult?.raw),
    targetMetrics: extractDomicileTaxwareMetrics(targetResult?.raw),
    payloadsMatchOutsideLocation:
      JSON.stringify(stripDomicilePayloadLocation(currentPayload)) ===
      JSON.stringify(stripDomicilePayloadLocation(targetPayload)),
  };
}
