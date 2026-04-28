// Ce scénario QA sert uniquement à vérifier visuellement le module d'optimisations fiscales.
// Il ne doit pas être utilisé comme source de calcul métier.

// ─── Utilitaire de formatage QA ──────────────────────────────────────────────

export function formatQaAmount(value: number): string {
  return (
    new Intl.NumberFormat("fr-CH", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value) + " CHF"
  );
}

// ─── Scénario QA de référence ─────────────────────────────────────────────────
//
// Projection 3a — formule de capitalisation en fin d'année :
//   finalCapital = Σ (annualContribution × (1 + rate)^(years - k)) pour k = 1..years
//
// Avec annualContribution = 9516, rate = 0.02, years = 10 :
//   S = (1.02^10 − 1) / 0.02 = (1.219994 − 1) / 0.02 = 10.94972
//   finalCapital = 9516 × 10.94972 ≈ 104 198
//
// Sources de vérification manuelle :
//   totalContributions    = 9516 × 10                       = 95 160
//   totalTaxSavings       = 9516 × 0.30 × 10                = 28 548
//   estimatedExitTax      = 104 198 × 0.08                  ≈  8 336
//   netGainAfterExitTax   = 28 548 + (104 198 − 95 160) − 8 336 = 29 250
//
// Résumé global :
//   totalPotentialGain    = 2 854.80 + 6 000                ≈  8 855
//   optimizedIndicativeTax = 18 000 − 8 854.80              ≈  9 145

export const optimizationQaScenario = {
  // ── Impôt standard TaxWare ─────────────────────────────────────────────────
  standardTaxwareTax: 18_000,

  // ── 3e pilier A ────────────────────────────────────────────────────────────
  threePillar: {
    currentContribution: 5_000,
    maxContribution: 14_516,      // 2 × 7 258 (couple, plafond 2026)
    remainingContribution: 9_516,
    marginalTaxRate: 0.30,
    potentialTaxSaving: 2_854.80, // 9516 × 0.30

    expected: {
      label: "Gain 3e pilier A",
      formattedPotentialTaxSaving: "2'855 CHF",
    },
  },

  // ── Rachat LPP ─────────────────────────────────────────────────────────────
  lppBuyback: {
    buybackAmount: 20_000,
    marginalTaxRate: 0.30,
    estimatedTaxSaving: 6_000,   // 20000 × 0.30
    availableLiquidWealth: 50_000,
    remainingLiquidWealth: 30_000, // 50000 − 20000
    affectsTaxableIncome: true,
    affectsBudgetIncome: false,
    affectsLiquidWealth: true,

    expected: {
      label: "Gain rachat LPP",
      formattedEstimatedTaxSaving: "6'000 CHF",
      formattedRemainingLiquidWealth: "30'000 CHF",
      warning: undefined,
    },
  },

  // ── Projection 3a — 10 ans ─────────────────────────────────────────────────
  projection3a: {
    years: 10,
    annualContribution: 9_516,
    annualReturnRate: 0.02,
    exitTaxRate: 0.08,

    // Valeurs attendues (voir calcul en en-tête)
    totalContributions: 95_160,
    finalCapital: 104_198,        // arrondi à l'entier, ±1 selon implémentation
    totalTaxSavings: 28_548,
    estimatedExitTax: 8_336,      // 104 198 × 0.08, arrondi
    netGainAfterExitTax: 29_250,  // 28 548 + 9 038 − 8 336

    expected: {
      formattedTotalContributions: "95'160 CHF",
      formattedFinalCapital: "104'198 CHF",
      formattedTotalTaxSavings: "28'548 CHF",
      formattedEstimatedExitTax: "8'336 CHF",
      formattedNetGainAfterExitTax: "29'250 CHF",
    },
  },

  // ── Résumé global ──────────────────────────────────────────────────────────
  finalSummary: {
    totalPotentialGain: 8_854.80,  // 2854.80 + 6000
    optimizedIndicativeTax: 9_145.20, // 18000 − 8854.80

    expected: {
      formattedTotalPotentialGain: "8'855 CHF",
      formattedOptimizedIndicativeTax: "9'145 CHF",
    },
  },
} as const;
