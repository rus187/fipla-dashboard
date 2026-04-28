// QA métier — Phase 6.2 : valorisation indicative entreprise / participation.
// Ce fichier sert uniquement à vérifier les calculs du moteur companyValuation.ts.
// Il ne doit pas être utilisé comme source de calcul métier.
//
// Méthode praticiens :
//   earningsValue    = averageProfit / capitalizationRate
//   fullCompanyValue = (2 × earningsValue + intrinsicValue) / 3
//   ownedCompanyValue = fullCompanyValue × ownershipPercentage

import {
  calculateCompanyValuation,
  type CompanyValuationInput,
  type CompanyValuationResult,
} from "./companyValuation";

// ─── Utilitaire ───────────────────────────────────────────────────────────────

export function formatValuationAmount(value: number): string {
  return (
    new Intl.NumberFormat("fr-CH", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value) + " CHF"
  );
}

// ─── Scénario 1 : cas standard — associé majoritaire ─────────────────────────
//
// Données :
//   profits           = [180 000, 210 000, 195 000]  (3 ans)
//   averageProfit     = (180 000 + 210 000 + 195 000) / 3 = 195 000
//   capitalizationRate = 0.08
//   earningsValue     = 195 000 / 0.08 = 2 437 500
//   intrinsicValue    = 800 000
//   fullCompanyValue  = (2 × 2 437 500 + 800 000) / 3
//                     = (4 875 000 + 800 000) / 3
//                     = 5 675 000 / 3
//                     ≈ 1 891 667
//   ownershipPercentage = 0.60
//   ownedCompanyValue = 1 891 667 × 0.60 ≈ 1 135 000

export const qaInputStandard: CompanyValuationInput = {
  profits: [180_000, 210_000, 195_000],
  intrinsicValue: 800_000,
  capitalizationRate: 0.08,
  ownershipPercentage: 0.60,
};

export const qaResultStandard: CompanyValuationResult =
  calculateCompanyValuation(qaInputStandard);

export const qaExpectedStandard = {
  normalizedProfits: [180_000, 210_000, 195_000],
  averageProfit: 195_000,
  capitalizationRate: 0.08,
  earningsValue: 2_437_500,          // 195 000 / 0.08
  intrinsicValue: 800_000,
  fullCompanyValue: 5_675_000 / 3,   // ≈ 1 891 667
  ownershipPercentage: 0.60,
  ownedCompanyValue: (5_675_000 / 3) * 0.60, // ≈ 1 135 000
  warningCodes: ["indicative_valuation"],     // seul warning attendu

  formatted: {
    averageProfit: "195'000 CHF",
    earningsValue: "2'437'500 CHF",
    fullCompanyValue: "1'891'667 CHF",
    ownedCompanyValue: "1'135'000 CHF",
  },
} as const;

// ─── Scénario 2 : associé minoritaire, taux personnalisé ─────────────────────
//
//   profits           = [90 000, 110 000]  (2 ans)
//   averageProfit     = 100 000
//   capitalizationRate = 0.10
//   earningsValue     = 100 000 / 0.10 = 1 000 000
//   intrinsicValue    = 400 000
//   fullCompanyValue  = (2 000 000 + 400 000) / 3 = 800 000
//   ownershipPercentage = 0.25
//   ownedCompanyValue = 800 000 × 0.25 = 200 000

export const qaInputMinority: CompanyValuationInput = {
  profits: [90_000, 110_000],
  intrinsicValue: 400_000,
  capitalizationRate: 0.10,
  ownershipPercentage: 0.25,
};

export const qaResultMinority: CompanyValuationResult =
  calculateCompanyValuation(qaInputMinority);

export const qaExpectedMinority = {
  averageProfit: 100_000,
  capitalizationRate: 0.10,
  earningsValue: 1_000_000,
  fullCompanyValue: 800_000,
  ownedCompanyValue: 200_000,
  warningCodes: ["indicative_valuation"],

  formatted: {
    earningsValue: "1'000'000 CHF",
    fullCompanyValue: "800'000 CHF",
    ownedCompanyValue: "200'000 CHF",
  },
} as const;

// ─── Scénario 3 : guard taux invalide → défaut 8 % ───────────────────────────
//
//   capitalizationRate = -0.05  (invalide → remplacé par 0.08)
//   profits            = [150 000]  (1 seul an → warning insufficient_profit_years)
//   averageProfit      = 150 000
//   earningsValue      = 150 000 / 0.08 = 1 875 000
//   intrinsicValue     = 500 000
//   fullCompanyValue   = (3 750 000 + 500 000) / 3 ≈ 1 416 667
//   ownershipPercentage absent → 1.0
//   ownedCompanyValue  = fullCompanyValue × 1 ≈ 1 416 667
//
//   Warnings attendues :
//     - insufficient_profit_years
//     - invalid_capitalization_rate
//     - indicative_valuation

export const qaInputInvalidRate: CompanyValuationInput = {
  profits: [150_000],
  intrinsicValue: 500_000,
  capitalizationRate: -0.05,
};

export const qaResultInvalidRate: CompanyValuationResult =
  calculateCompanyValuation(qaInputInvalidRate);

export const qaExpectedInvalidRate = {
  capitalizationRateUsed: 0.08,      // défaut appliqué
  averageProfit: 150_000,
  earningsValue: 1_875_000,          // 150 000 / 0.08
  fullCompanyValue: 4_250_000 / 3,   // ≈ 1 416 667
  ownershipPercentage: 1,
  warningCodes: [
    "insufficient_profit_years",
    "invalid_capitalization_rate",
    "indicative_valuation",
  ],

  formatted: {
    earningsValue: "1'875'000 CHF",
    fullCompanyValue: "1'416'667 CHF",
  },
} as const;

// ─── Scénario 4 : année déficitaire → normalisée à 0 ─────────────────────────
//
//   profits = [-50 000, 120 000, 130 000]
//   normalisés → [0, 120 000, 130 000]
//   averageProfit = (0 + 120 000 + 130 000) / 3 ≈ 83 333
//   earningsValue = 83 333 / 0.08 ≈ 1 041 667
//   intrinsicValue = 600 000
//   fullCompanyValue = (2 083 333 + 600 000) / 3 ≈ 894 444

export const qaInputNegativeYear: CompanyValuationInput = {
  profits: [-50_000, 120_000, 130_000],
  intrinsicValue: 600_000,
  capitalizationRate: 0.08,
};

export const qaResultNegativeYear: CompanyValuationResult =
  calculateCompanyValuation(qaInputNegativeYear);

export const qaExpectedNegativeYear = {
  normalizedProfits: [0, 120_000, 130_000],   // -50 000 → 0
  averageProfit: 250_000 / 3,                  // ≈ 83 333
  earningsValue: (250_000 / 3) / 0.08,         // ≈ 1 041 667
  warningCodes: ["indicative_valuation"],

  formatted: {
    normalizedFirstProfit: "0 CHF",
    averageProfit: "83'333 CHF",
  },
} as const;

// ─── Scénario 5 : aucun profit valide → averageProfit = 0 ────────────────────

export const qaInputNoProfit: CompanyValuationInput = {
  profits: [],
  intrinsicValue: 300_000,
  capitalizationRate: 0.08,
};

export const qaResultNoProfit: CompanyValuationResult =
  calculateCompanyValuation(qaInputNoProfit);

export const qaExpectedNoProfit = {
  averageProfit: 0,
  earningsValue: 0,
  fullCompanyValue: 300_000 / 3,   // = 100 000 (basé sur intrinsicValue seule)
  warningCodes: [
    "insufficient_profit_years",
    "no_valid_profits",
    "indicative_valuation",
  ],

  formatted: {
    fullCompanyValue: "100'000 CHF",
  },
} as const;
