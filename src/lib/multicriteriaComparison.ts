import type { DossierClient } from "../types";

export type ComparisonScenarioKey =
  | "reference"
  | "third-pillar"
  | "lpp-buyback"
  | "mixed"
  | "manual-adjustment";

export type ComparisonScenario = {
  key: ComparisonScenarioKey;
  label: string;
  thirdPillar: number;
  spouseThirdPillar: number;
  lppBuyback: number;
  spouseLppBuyback: number;
  manualAdjustment: number;
};

export type ComparisonScenarioResult = {
  key: ComparisonScenarioKey;
  label: string;
  impotTotal: number;
  margeAnnuelle: number;
  effortLiquidite: number;
  fortuneRestante: number;
  fiscalScore: number;
  treasuryScore: number;
  patrimonialScore: number;
  globalScore: number;
  rank: number;
};

export type ComparisonClientSummary = {
  bestFiscalVariant: string;
  bestTreasuryVariant: string;
  bestPatrimonialVariant: string;
  recommendedVariant: string;
  summaryLines: string[];
};

const roundScore = (value: number) => Math.round(value * 10) / 10;

function normalizeDescending(value: number, min: number, max: number) {
  if (max <= min) return 100;
  return ((max - value) / (max - min)) * 100;
}

function normalizeAscending(value: number, min: number, max: number) {
  if (max <= min) return 100;
  return ((value - min) / (max - min)) * 100;
}

function getExtrema(values: number[]) {
  return {
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

function getBestScenarioByMetric(
  scenarios: ComparisonScenarioResult[],
  metric: keyof Pick<
    ComparisonScenarioResult,
    "fiscalScore" | "treasuryScore" | "patrimonialScore" | "globalScore"
  >
) {
  return [...scenarios].sort((left, right) => right[metric] - left[metric] || left.rank - right.rank)[0];
}

export function getComparisonScenarios(dossier: DossierClient): ComparisonScenario[] {
  const thirdPillar = dossier.fiscalite.troisiemePilierPersonne1 ?? dossier.fiscalite.troisiemePilierSimule ?? 0;
  const spouseThirdPillar = dossier.fiscalite.troisiemePilierPersonne2 ?? 0;
  const lppBuyback = dossier.fiscalite.rachatLppPersonne1 ?? dossier.fiscalite.rachatLpp ?? 0;
  const spouseLppBuyback = dossier.fiscalite.rachatLppPersonne2 ?? 0;
  const manualAdjustment = dossier.fiscalite.ajustementManuelRevenu || 0;

  return [
    {
      key: "reference",
      label: "Variante 1 - Reference",
      thirdPillar: 0,
      spouseThirdPillar: 0,
      lppBuyback: 0,
      spouseLppBuyback: 0,
      manualAdjustment: 0,
    },
    {
      key: "third-pillar",
      label: "Variante 2 - 3e pilier",
      thirdPillar,
      spouseThirdPillar,
      lppBuyback: 0,
      spouseLppBuyback: 0,
      manualAdjustment: 0,
    },
    {
      key: "lpp-buyback",
      label: "Variante 3 - Rachat LPP",
      thirdPillar: 0,
      spouseThirdPillar: 0,
      lppBuyback,
      spouseLppBuyback,
      manualAdjustment: 0,
    },
    {
      key: "mixed",
      label: "Variante 4 - Mixte",
      thirdPillar,
      spouseThirdPillar,
      lppBuyback,
      spouseLppBuyback,
      manualAdjustment: 0,
    },
    {
      key: "manual-adjustment",
      label: "Variante 5 - Ajustement manuel",
      thirdPillar,
      spouseThirdPillar,
      lppBuyback,
      spouseLppBuyback,
      manualAdjustment,
    },
  ];
}

export function getScenarioNetWealth(dossier: DossierClient, scenario: ComparisonScenario) {
  const totalThirdPillar = scenario.thirdPillar + scenario.spouseThirdPillar;
  const totalLppBuyback = scenario.lppBuyback + scenario.spouseLppBuyback;
  const liquiditesAjustees =
    (dossier.fortune.liquidites || 0) -
    totalThirdPillar -
    totalLppBuyback +
    scenario.manualAdjustment;
  const fortuneBrute =
    liquiditesAjustees +
    (dossier.fortune.titres || 0) +
    (dossier.fortune.troisiemePilier || 0) +
    totalThirdPillar +
    (dossier.fortune.fortuneLppActuelle || 0) +
    totalLppBuyback +
    (dossier.fortune.immobilier || 0);

  const totalDettes =
    (dossier.dettes.hypotheques || 0) + (dossier.dettes.autresDettes || 0);

  return Math.max(0, fortuneBrute - totalDettes);
}

export function evaluateMultiCriteriaScenarios(params: {
  dossier: DossierClient;
  totalRevenus: number;
  baseChargesExcludingTax: number;
  scenarioTaxes: Record<ComparisonScenarioKey, number | null>;
}) {
  const { dossier, totalRevenus, baseChargesExcludingTax, scenarioTaxes } = params;
  const scenarios = getComparisonScenarios(dossier).filter((scenario, index, allScenarios) => {
    if (index === 0) {
      return true;
    }

    const isActive =
      scenario.thirdPillar !== 0 || scenario.lppBuyback !== 0 || scenario.manualAdjustment !== 0;

    if (!isActive) {
      return false;
    }

    const signature = `${scenario.thirdPillar}|${scenario.lppBuyback}|${scenario.manualAdjustment}`;

    return (
      allScenarios.findIndex(
        (candidate) =>
          `${candidate.thirdPillar}|${candidate.lppBuyback}|${candidate.manualAdjustment}` ===
          signature
      ) === index
    );
  });

  const rawScenarios = scenarios.map((scenario) => {
    const impotTotal = scenarioTaxes[scenario.key] ?? 0;
    const effortLiquidite =
      scenario.thirdPillar +
      scenario.lppBuyback +
      Math.max(0, -scenario.manualAdjustment);
    const margeAnnuelle = totalRevenus - (baseChargesExcludingTax + impotTotal + effortLiquidite);
    const fortuneRestante = getScenarioNetWealth(dossier, scenario);

    return {
      key: scenario.key,
      label: scenario.label,
      impotTotal,
      margeAnnuelle,
      effortLiquidite,
      fortuneRestante,
    };
  });

  const taxExtrema = getExtrema(rawScenarios.map((scenario) => scenario.impotTotal));
  const marginExtrema = getExtrema(rawScenarios.map((scenario) => scenario.margeAnnuelle));
  const effortExtrema = getExtrema(rawScenarios.map((scenario) => scenario.effortLiquidite));
  const wealthExtrema = getExtrema(rawScenarios.map((scenario) => scenario.fortuneRestante));

  const scored = rawScenarios.map((scenario) => {
    const fiscalScore = roundScore(
      normalizeDescending(scenario.impotTotal, taxExtrema.min, taxExtrema.max)
    );
    const marginScore = normalizeAscending(
      scenario.margeAnnuelle,
      marginExtrema.min,
      marginExtrema.max
    );
    const effortScore = normalizeDescending(
      scenario.effortLiquidite,
      effortExtrema.min,
      effortExtrema.max
    );
    const treasuryScore = roundScore(marginScore * 0.6 + effortScore * 0.4);
    const patrimonialScore = roundScore(
      normalizeAscending(
        scenario.fortuneRestante,
        wealthExtrema.min,
        wealthExtrema.max
      )
    );
    const globalScore = roundScore(
      fiscalScore * 0.5 + treasuryScore * 0.3 + patrimonialScore * 0.2
    );

    return {
      ...scenario,
      fiscalScore,
      treasuryScore,
      patrimonialScore,
      globalScore,
      rank: 0,
    };
  });

  return [...scored]
    .sort(
      (left, right) =>
        right.globalScore - left.globalScore ||
        right.fiscalScore - left.fiscalScore ||
        left.impotTotal - right.impotTotal
    )
    .map((scenario, index) => ({
      ...scenario,
      rank: index + 1,
    }));
}

export function buildClientComparisonSummary(
  scenarios: ComparisonScenarioResult[]
): ComparisonClientSummary | null {
  if (scenarios.length === 0) return null;

  const bestFiscal = getBestScenarioByMetric(scenarios, "fiscalScore");
  const bestTreasury = getBestScenarioByMetric(scenarios, "treasuryScore");
  const bestPatrimonial = getBestScenarioByMetric(scenarios, "patrimonialScore");
  const bestGlobal = getBestScenarioByMetric(scenarios, "globalScore");

  return {
    bestFiscalVariant: bestFiscal.label,
    bestTreasuryVariant: bestTreasury.label,
    bestPatrimonialVariant: bestPatrimonial.label,
    recommendedVariant: bestGlobal.label,
    summaryLines: [
      `La variante ${bestFiscal.label} est la plus avantageuse fiscalement.`,
      `La variante ${bestTreasury.label} preserve le mieux la tresorerie.`,
      `La variante ${bestPatrimonial.label} conserve le plus de patrimoine.`,
      `La variante recommandee est ${bestGlobal.label} car elle offre le meilleur equilibre global.`,
    ],
  };
}
