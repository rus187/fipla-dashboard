import type { DossierClient } from "../../types";
import { buildTaxwarePayload } from "./buildTaxwarePayload";
import { callTaxware } from "./callTaxware";
import { callTaxwareFromBases, type CallTaxwareFromBasesParams } from "./callTaxwareFromBases";

export type DomicilePilotV2Bases = Pick<
  CallTaxwareFromBasesParams,
  "taxableIncomeFederal" | "taxableIncomeCanton" | "taxableAssets" | "basesSource"
>;

type DomicilePilotLocation = {
  zip: string;
  city: string;
};

type DomicilePilotFortuneFallbackTrace = {
  active: boolean;
  used: boolean;
  degradedMode: boolean;
  source: "fiscalite.fortuneImposableActuelleSaisie" | null;
  value: number;
};

type DomicilePilotFortuneReliability = {
  degradedMode: boolean;
  reliable: boolean;
  reason: "missing-gross-fortune-source" | null;
  fallbackSource: "fiscalite.fortuneImposableActuelleSaisie" | null;
  fallbackValue: number;
};

type DomicilePilotFortuneOptions = {
  includeFortune: boolean;
};

function toPositiveNumber(value: unknown) {
  const numericValue =
    typeof value === "number" && Number.isFinite(value) ? value : Number(value || 0);

  return Math.max(0, Number.isFinite(numericValue) ? numericValue : 0);
}

function normalizeLocationValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getDomicilePilotLocation(dossier: DossierClient): DomicilePilotLocation {
  return {
    zip: normalizeLocationValue(dossier.identite.taxwareZip || dossier.identite.npa),
    city: normalizeLocationValue(
      dossier.identite.taxwareCity || dossier.identite.communeFiscale || dossier.identite.commune
    ),
  };
}

function buildDomicilePilotRealEstates(
  dossier: DossierClient,
  options: DomicilePilotFortuneOptions
) {
  const removeOwnerOccupiedRentalValue = dossier.immobilier.regimeFiscal === "reforme";
  const realEstates: Array<{
    taxableValue?: number;
    rentalIncome?: number;
    effectiveExpenses?: number;
  }> = [];

  if (dossier.immobilier.proprietaireOccupant) {
    const ownerOccupied = {
      taxableValue: options.includeFortune ? toPositiveNumber(dossier.fortune.immobilier) : 0,
      rentalIncome: removeOwnerOccupiedRentalValue
        ? 0
        : toPositiveNumber(dossier.immobilier.valeurLocativeHabitationPropre),
      effectiveExpenses: removeOwnerOccupiedRentalValue
        ? 0
        : toPositiveNumber(dossier.immobilier.fraisEntretienHabitationPropre),
    };

    if (
      ownerOccupied.rentalIncome > 0 ||
      ownerOccupied.effectiveExpenses > 0
    ) {
      realEstates.push(ownerOccupied);
    }
  }

  if (dossier.immobilier.possedeBienRendement) {
    const rentalProperty = {
      taxableValue: options.includeFortune
        ? toPositiveNumber(dossier.immobilier.valeurFiscaleBiensRendement)
        : 0,
      rentalIncome: toPositiveNumber(dossier.immobilier.loyersBiensRendement),
      effectiveExpenses: toPositiveNumber(dossier.immobilier.fraisEntretienBiensRendement),
    };

    if (
      rentalProperty.taxableValue > 0 ||
      rentalProperty.rentalIncome > 0 ||
      rentalProperty.effectiveExpenses > 0
    ) {
      realEstates.push(rentalProperty);
    }
  }

  return realEstates;
}

function getDomicilePilotMortgageDebts(dossier: DossierClient) {
  return Math.max(
    toPositiveNumber(dossier.dettes.hypotheques),
    toPositiveNumber(dossier.immobilier.detteHypothecaireBiensRendement)
  );
}

function getDomicilePilotDebts(dossier: DossierClient) {
  return getDomicilePilotMortgageDebts(dossier) + toPositiveNumber(dossier.dettes.autresDettes);
}

function getDomicilePilotAssets(dossier: DossierClient) {
  const realEstateAssets =
    toPositiveNumber(dossier.fortune.immobilier) +
    toPositiveNumber(dossier.immobilier.valeurFiscaleBiensRendement);
  const explicitNonRealEstateAssets = Math.max(
    0,
    toPositiveNumber(dossier.fortune.liquidites) +
      toPositiveNumber(dossier.fortune.titres) +
      toPositiveNumber(dossier.fortune.troisiemePilier) +
      toPositiveNumber(dossier.fortune.fortuneLppActuelle) +
      toPositiveNumber(dossier.fiscalite.troisiemePilierSimule) +
      toPositiveNumber(dossier.fiscalite.rachatLpp) +
      toPositiveNumber(dossier.fortune.autresActifs)
  );
  const totalAssetsFallback = Math.max(
    0,
    toPositiveNumber(dossier.fortune.fortuneTotale) - realEstateAssets
  );
  const taxableAssetsWorkFallback = toPositiveNumber(
    dossier.fiscalite.fortuneImposableActuelleSaisie
  );
  const grossAssetsUnavailable =
    explicitNonRealEstateAssets <= 0 &&
    realEstateAssets <= 0 &&
    toPositiveNumber(dossier.fortune.fortuneTotale) <= 0;

  if (explicitNonRealEstateAssets > 0) {
    return {
      value: explicitNonRealEstateAssets,
      trace: {
        active: false,
        used: false,
        degradedMode: false,
        source: null,
        value: 0,
      } satisfies DomicilePilotFortuneFallbackTrace,
    };
  }

  if (totalAssetsFallback > 0) {
    return {
      value: totalAssetsFallback,
      trace: {
        active: false,
        used: false,
        degradedMode: false,
        source: null,
        value: 0,
      } satisfies DomicilePilotFortuneFallbackTrace,
    };
  }

  if (grossAssetsUnavailable && taxableAssetsWorkFallback > 0) {
    return {
      value: taxableAssetsWorkFallback,
      trace: {
        active: true,
        used: true,
        degradedMode: true,
        source: "fiscalite.fortuneImposableActuelleSaisie",
        value: taxableAssetsWorkFallback,
      } satisfies DomicilePilotFortuneFallbackTrace,
    };
  }

  return {
    value: 0,
    trace: {
      active: false,
      used: false,
      degradedMode: false,
      source: null,
      value: 0,
    } satisfies DomicilePilotFortuneFallbackTrace,
  };
}

function getDomicilePilotDebtInterests(dossier: DossierClient) {
  const qualifiedHousingCharge = dossier.charges.logementIsHypothequeDeductible
    ? toPositiveNumber(dossier.charges.logement)
    : 0;
  const ownerOccupiedInterests =
    dossier.immobilier.regimeFiscal === "reforme"
      ? 0
      : toPositiveNumber(dossier.immobilier.interetsHypothecairesHabitationPropre);

  return (
    qualifiedHousingCharge +
    ownerOccupiedInterests +
    toPositiveNumber(dossier.immobilier.interetsHypothecairesBiensRendement)
  );
}

function getDomicilePilotMiscExpenses(dossier: DossierClient) {
  const genericDeductibleCharges = dossier.charges.autresChargesIsPensionDeductible
    ? toPositiveNumber(dossier.charges.autresCharges)
    : 0;
  const ownerOccupiedExpenses =
    dossier.immobilier.regimeFiscal === "reforme"
      ? 0
      : toPositiveNumber(dossier.immobilier.fraisEntretienHabitationPropre);

  return (
    genericDeductibleCharges +
    ownerOccupiedExpenses +
    toPositiveNumber(dossier.immobilier.fraisEntretienBiensRendement)
  );
}

function getDomicilePilotOtherIncomeLeading(dossier: DossierClient) {
  return (
    toPositiveNumber(dossier.revenus.autresRevenus) +
    toPositiveNumber(dossier.revenus.revenuFortune) +
    toPositiveNumber(dossier.revenus.dividendesPriviligies) +
    toPositiveNumber(dossier.revenus.participationsPriviligiees)
  );
}

function buildDomicilePilotFortuneReliability(
  trace: DomicilePilotFortuneFallbackTrace
): DomicilePilotFortuneReliability {
  return {
    degradedMode: trace.degradedMode,
    reliable: !trace.degradedMode,
    reason: trace.degradedMode ? "missing-gross-fortune-source" : null,
    fallbackSource: trace.source,
    fallbackValue: trace.value,
  };
}

function attachDomicilePilotFortuneReliability(
  result: Awaited<ReturnType<typeof callTaxware>>,
  trace: DomicilePilotFortuneFallbackTrace | null
) {
  if (!trace) {
    return result;
  }

  return {
    ...result,
    normalized: {
      ...(result?.normalized ?? {}),
      fortuneReliability: buildDomicilePilotFortuneReliability(trace),
    },
  };
}

export function buildDomicilePilotPayloadFromDossier(
  dossier: DossierClient,
  location = getDomicilePilotLocation(dossier),
  options: DomicilePilotFortuneOptions = {
    includeFortune: true,
  }
) {
  const assetsResolution = options.includeFortune
    ? getDomicilePilotAssets(dossier)
    : null;
  const params = {
    realEstates: buildDomicilePilotRealEstates(dossier, options),
    zip: location.zip,
    city: location.city,
    year: Math.max(2000, Math.round(toPositiveNumber(dossier.fiscalite.anneeSimulation || 2026))),
    partnership: (dossier.famille.aConjoint ? "Marriage" : "Single") as "Marriage" | "Single",
    childrenCount: Math.max(0, Math.round(toPositiveNumber(dossier.famille.nombreEnfants))),
    netWages: toPositiveNumber(dossier.revenus.salaire),
    pensionIncome:
      toPositiveNumber(dossier.revenus.avs) + toPositiveNumber(dossier.revenus.lpp),
    hasOasiPensions: toPositiveNumber(dossier.revenus.avs) > 0,
    otherIncome: getDomicilePilotOtherIncomeLeading(dossier),
    thirdPillar: toPositiveNumber(dossier.fiscalite.troisiemePilierSimule),
    lppBuyback: toPositiveNumber(dossier.fiscalite.rachatLpp),
    assetIncome: 0,
    miscIncome: 0,
    miscExpenses: getDomicilePilotMiscExpenses(dossier),
    debtInterests: getDomicilePilotDebtInterests(dossier),
    spouseNetWages: dossier.famille.aConjoint ? toPositiveNumber(dossier.revenus.salaireConjoint) : 0,
    spousePensionIncome: dossier.famille.aConjoint
      ? toPositiveNumber(dossier.revenus.avsConjoint) + toPositiveNumber(dossier.revenus.lppConjoint)
      : 0,
    spouseHasOasiPensions: dossier.famille.aConjoint
      ? toPositiveNumber(dossier.revenus.avsConjoint) > 0
      : false,
    spouseOtherIncome: dossier.famille.aConjoint
      ? toPositiveNumber(dossier.revenus.autresRevenusConjoint)
      : 0,
    spouseThirdPillar: 0,
    spouseLppBuyback: 0,
    assets: assetsResolution?.value ?? 0,
    debts: options.includeFortune ? getDomicilePilotDebts(dossier) : 0,
  };

  return {
    params,
    payload: buildTaxwarePayload(params),
    trace: {
      fortuneWorkFallback: assetsResolution?.trace ?? null,
    },
  };
}

export async function runDomicilePilotSimulation(params: {
  currentDossier: DossierClient;
  targetDossier: DossierClient;
  currentIncludeFortune?: boolean;
  targetIncludeFortune?: boolean;
  useV2FromBases?: {
    current?: DomicilePilotV2Bases;
    target?: DomicilePilotV2Bases;
  };
}) {
  const current = buildDomicilePilotPayloadFromDossier(params.currentDossier, undefined, {
    includeFortune: params.currentIncludeFortune ?? true,
  });
  const target = buildDomicilePilotPayloadFromDossier(params.targetDossier, undefined, {
    includeFortune: params.targetIncludeFortune ?? true,
  });

  const v2Current = params.useV2FromBases?.current;
  const v2Target = params.useV2FromBases?.target;

  const currentResult = v2Current
    ? await callTaxwareFromBases({
        zip: current.params.zip,
        city: current.params.city,
        year: current.params.year ?? 2026,
        partnership: current.params.partnership,
        numChildren: current.params.childrenCount,
        ...v2Current,
      })
    : attachDomicilePilotFortuneReliability(
        await callTaxware(current.params),
        current.trace.fortuneWorkFallback
      );

  const targetResult = v2Target
    ? await callTaxwareFromBases({
        zip: target.params.zip,
        city: target.params.city,
        year: target.params.year ?? 2026,
        partnership: target.params.partnership,
        numChildren: target.params.childrenCount,
        ...v2Target,
      })
    : attachDomicilePilotFortuneReliability(
        await callTaxware(target.params),
        target.trace.fortuneWorkFallback
      );

  return {
    currentPayload: current.payload,
    targetPayload: target.payload,
    currentTrace: current.trace,
    targetTrace: target.trace,
    currentResult,
    targetResult,
  };
}
