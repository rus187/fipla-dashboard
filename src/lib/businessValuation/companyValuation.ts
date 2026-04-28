// Module de valorisation indicative des participations privées / entreprises non cotées.
// Ce module ne remplace pas une valorisation fiscale officielle.
//
// Méthode : praticiens suisses (circulaire AFC)
//   valeur de rendement  = bénéfice moyen / taux de capitalisation
//   valeur fiscale indicative = (2 × valeur de rendement + valeur intrinsèque) / 3

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CompanyValuationInput {
  profits: number[];
  intrinsicValue: number;
  capitalizationRate: number;
  ownershipPercentage?: number;
}

export interface CompanyValuationWarning {
  code: string;
  message: string;
}

export interface CompanyValuationResult {
  normalizedProfits: number[];
  averageProfit: number;
  capitalizationRate: number;
  earningsValue: number;
  intrinsicValue: number;
  fullCompanyValue: number;
  ownershipPercentage: number;
  ownedCompanyValue: number;
  warnings: CompanyValuationWarning[];
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const DEFAULT_CAPITALIZATION_RATE = 0.08;

// ─── Utilitaires ──────────────────────────────────────────────────────────────

function isUsableNumber(value: unknown): value is number {
  return typeof value === "number" && isFinite(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// ─── Moteur de valorisation ───────────────────────────────────────────────────

export function calculateCompanyValuation(
  input: CompanyValuationInput
): CompanyValuationResult {
  const warnings: CompanyValuationWarning[] = [];

  // ── 1. Normalisation des profits ──────────────────────────────────────────
  const normalizedProfits: number[] = (input.profits ?? [])
    .filter(isUsableNumber)
    .map((p) => Math.max(0, p));  // V1 indicative : profits négatifs → 0

  if (normalizedProfits.length < 2) {
    warnings.push({
      code: "insufficient_profit_years",
      message:
        "Moins de deux années de bénéfices renseignées : estimation moins robuste.",
    });
  }

  // ── 2. Bénéfice moyen ─────────────────────────────────────────────────────
  let averageProfit = 0;
  if (normalizedProfits.length === 0) {
    warnings.push({
      code: "no_valid_profits",
      message: "Aucun bénéfice valide fourni : bénéfice moyen fixé à 0.",
    });
  } else {
    const sum = normalizedProfits.reduce((acc, p) => acc + p, 0);
    averageProfit = sum / normalizedProfits.length;
  }

  // ── 3. Taux de capitalisation ─────────────────────────────────────────────
  let capitalizationRate = input.capitalizationRate;
  const rateIsValid =
    isUsableNumber(capitalizationRate) &&
    capitalizationRate > 0 &&
    capitalizationRate <= 1;

  if (!rateIsValid) {
    capitalizationRate = DEFAULT_CAPITALIZATION_RATE;
    warnings.push({
      code: "invalid_capitalization_rate",
      message: `Taux de capitalisation invalide ou absent : taux par défaut de ${DEFAULT_CAPITALIZATION_RATE * 100} % utilisé.`,
    });
  } else {
    capitalizationRate = clamp(capitalizationRate, 0.01, 1);
  }

  // ── 4. Valeur de rendement ────────────────────────────────────────────────
  const earningsValue = averageProfit / capitalizationRate;

  // ── 5. Valeur intrinsèque ─────────────────────────────────────────────────
  const intrinsicValue = Math.max(
    0,
    isUsableNumber(input.intrinsicValue) ? input.intrinsicValue : 0
  );

  // ── 6. Valeur fiscale indicative (méthode des praticiens) ─────────────────
  const fullCompanyValue = (2 * earningsValue + intrinsicValue) / 3;

  // ── 7. Pourcentage de participation ───────────────────────────────────────
  let ownershipPercentage = 1;
  if (input.ownershipPercentage !== undefined) {
    if (isUsableNumber(input.ownershipPercentage)) {
      ownershipPercentage = clamp(input.ownershipPercentage, 0, 1);
    }
  }

  // ── 8. Valeur détenue ─────────────────────────────────────────────────────
  const ownedCompanyValue = fullCompanyValue * ownershipPercentage;

  // ── 9. Warning métier systématique ────────────────────────────────────────
  warnings.push({
    code: "indicative_valuation",
    message:
      "Valorisation indicative : à valider selon la pratique fiscale cantonale et les données comptables.",
  });

  return {
    normalizedProfits,
    averageProfit,
    capitalizationRate,
    earningsValue,
    intrinsicValue,
    fullCompanyValue,
    ownershipPercentage,
    ownedCompanyValue,
    warnings,
  };
}
