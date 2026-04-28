// Ce scénario QA sert uniquement à vérifier visuellement le moteur cantonal.
// Il ne doit pas être utilisé comme source de calcul métier.

import {
  applyCantonalRules,
  type ApplyCantonalRulesInput,
  type ApplyCantonalRulesResult,
} from "../taxEngine/applyCantonalRules";

// ─── Utilitaire de formatage QA ───────────────────────────────────────────────

export function formatCantonalQaAmount(value: number): string {
  return (
    new Intl.NumberFormat("fr-CH", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value) + " CHF"
  );
}

// ─── UserAdjustments communs aux deux scénarios ───────────────────────────────

const sharedUserAdjustments = {
  actualTravelCosts: 6_000,
  taxwareTravelCosts: 3_000,           // gap attendu : 3 000

  actualProfessionalExpenses: 4_500,
  taxwareProfessionalExpenses: 1_800,  // gap attendu : 2 700

  actualMedicalExpenses: 8_000,
  taxwareMedicalExpenses: 2_000,       // gap attendu : 6 000

  actualChildcareCosts: 12_000,
  taxwareChildcareCosts: 6_000,        // gap attendu : 6 000

  actualRealEstateMaintenance: 15_000,
  taxwareRealEstateMaintenance: 10_000, // gap attendu : 5 000

  privateCompanyTaxValue: 2_000_000,
  otherIncomeAdjustment: 1_000,
  otherWealthAdjustment: 50_000,
} as const;

// ─── Scénario NE — canton romand pilote ──────────────────────────────────────

export const cantonalQaScenarioInputNE: ApplyCantonalRulesInput = {
  canton: "NE",
  taxableIncomeCanton: 150_000,
  taxableWealthCanton: 500_000,
  userAdjustments: { ...sharedUserAdjustments },
};

export const cantonalQaScenarioResultNE: ApplyCantonalRulesResult =
  applyCantonalRules(cantonalQaScenarioInputNE);

// Valeurs attendues NE :
//
// Ajustements revenu :
//   travel              =  6000 - 3000  = 3 000
//   professional        =  4500 - 1800  = 2 700
//   medical             =  8000 - 2000  = 6 000
//   childcare           = 12000 - 6000  = 6 000
//   realEstate          = 15000 - 10000 = 5 000
//   otherIncome         =               1 000
//   totalIncome         =              23 700
//
// adjustedIncomeCanton  = 150 000 - 23 700 = 126 300
//
// Ajustements fortune :
//   privateCompanyValue = 2 000 000
//   otherWealth         =    50 000
//   totalWealth         = 2 050 000
//
// adjustedWealthCanton  = 500 000 + 2 050 000 = 2 550 000
//
// Warnings :
//   - warning valeur fiscale de l'entreprise

export const cantonalQaExpectedNE = {
  canton: "NE",
  baseIncomeCanton: 150_000,
  baseWealthCanton: 500_000,

  incomeAdjustments: {
    travel: 3_000,
    professional: 2_700,
    medical: 6_000,
    childcare: 6_000,
    realEstate: 5_000,
    otherIncome: 1_000,
  },

  totalIncomeAdjustments: 23_700,
  adjustedIncomeCanton: 126_300,

  wealthAdjustments: {
    privateCompanyTaxValue: 2_000_000,
    otherWealthAdjustment: 50_000,
  },

  totalWealthAdjustments: 2_050_000,
  adjustedWealthCanton: 2_550_000,

  warningKeys: ["ne_private_company_tax_value"],

  formatted: {
    baseIncomeCanton: "150'000 CHF",
    adjustedIncomeCanton: "126'300 CHF",
    baseWealthCanton: "500'000 CHF",
    adjustedWealthCanton: "2'550'000 CHF",
    totalIncomeAdjustments: "23'700 CHF",
    totalWealthAdjustments: "2'050'000 CHF",
  },
} as const;

// ─── Scénario ZH — canton non romand ─────────────────────────────────────────

export const cantonalQaScenarioInputZH: ApplyCantonalRulesInput = {
  canton: "ZH",
  taxableIncomeCanton: 150_000,
  taxableWealthCanton: 500_000,
  userAdjustments: { ...sharedUserAdjustments },
};

export const cantonalQaScenarioResultZH: ApplyCantonalRulesResult =
  applyCantonalRules(cantonalQaScenarioInputZH);

// Valeurs attendues ZH :
//   Canton non romand → guard immédiat, aucun ajustement appliqué.
//   adjustments             = []
//   totalIncomeAdjustments  = 0
//   totalWealthAdjustments  = 0
//   adjustedIncomeCanton    = 150 000 (inchangé)
//   adjustedWealthCanton    = 500 000 (inchangé)
//   warning                 : "Aucune règle pilote romande active pour ce canton dans cette phase."

export const cantonalQaExpectedZH = {
  canton: "ZH",
  baseIncomeCanton: 150_000,
  baseWealthCanton: 500_000,

  totalIncomeAdjustments: 0,
  totalWealthAdjustments: 0,
  adjustedIncomeCanton: 150_000,
  adjustedWealthCanton: 500_000,

  adjustmentsCount: 0,

  expectedWarningRuleId: "cantonal_non_romand",
  expectedWarningMessage:
    "Aucune règle pilote romande active pour ce canton dans cette phase.",

  formatted: {
    adjustedIncomeCanton: "150'000 CHF",
    adjustedWealthCanton: "500'000 CHF",
  },
} as const;
