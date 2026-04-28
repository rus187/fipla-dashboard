// QA visuelle — Phase 5.9 : circuit valeur fiscale entreprise / participation.
// Ce fichier sert uniquement à vérifier visuellement le circuit complet :
//   dossier.fortune.valeurFiscaleEntrepriseParticipation
//     → cantonalPrivateCompanyTaxValue (App.tsx Phase 5.7)
//     → applyCantonalRules (privateCompanyTaxValue)
//     → adjustedWealthCanton = baseWealthCanton + privateCompanyTaxValue
//     → OptimizationsPanel "Ajustements fortune potentiels"
// Il ne doit pas être utilisé comme source de calcul métier.

import {
  applyCantonalRules,
  type ApplyCantonalRulesInput,
  type ApplyCantonalRulesResult,
} from "../taxEngine/applyCantonalRules";

// ─── Utilitaire ───────────────────────────────────────────────────────────────

export function formatCompanyQaAmount(value: number): string {
  return (
    new Intl.NumberFormat("fr-CH", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value) + " CHF"
  );
}

// ─── Scénario 1 : valeur entreprise présente (NE, romand pilote) ──────────────
//
// Circuit attendu :
//   dossier.fortune.valeurFiscaleEntrepriseParticipation = 800 000
//   cantonalPrivateCompanyTaxValue                       = 800 000   (guard > 0 → passe)
//   applyCantonalRules privateCompanyTaxValue            = 800 000
//   totalWealthAdjustments                               = 800 000
//   adjustedWealthCanton  = 500 000 + 800 000            = 1 300 000
//   warning attendue      : "La valeur fiscale de l'entreprise doit être validée..."

export const companyValueQaInputNE: ApplyCantonalRulesInput = {
  canton: "NE",
  taxableIncomeCanton: 120_000,
  taxableWealthCanton: 500_000,
  userAdjustments: {
    privateCompanyTaxValue: 800_000,
  },
};

export const companyValueQaResultNE: ApplyCantonalRulesResult =
  applyCantonalRules(companyValueQaInputNE);

export const companyValueQaExpectedNE = {
  canton: "NE",
  baseWealthCanton: 500_000,
  privateCompanyTaxValue: 800_000,
  totalWealthAdjustments: 800_000,
  adjustedWealthCanton: 1_300_000,   // 500 000 + 800 000
  totalIncomeAdjustments: 0,
  adjustedIncomeCanton: 120_000,     // inchangé, aucun ajustement revenu

  expectedWarningRuleId: "ne_private_company_tax_value",

  formatted: {
    baseWealthCanton: "500'000 CHF",
    privateCompanyTaxValue: "800'000 CHF",
    totalWealthAdjustments: "800'000 CHF",
    adjustedWealthCanton: "1'300'000 CHF",
  },
} as const;

// ─── Scénario 2 : valeur entreprise absente / zéro ────────────────────────────
//
// Circuit attendu :
//   dossier.fortune.valeurFiscaleEntrepriseParticipation = undefined / 0
//   cantonalPrivateCompanyTaxValue                       = 0   (guard > 0 → undefined passé au moteur)
//   applyCantonalRules privateCompanyTaxValue            = absent
//   totalWealthAdjustments                               = 0
//   adjustedWealthCanton  = 500 000 (inchangé)
//   Bloc "Ajustements fortune potentiels"                : absent de l'UI

export const companyValueQaInputNE_zero: ApplyCantonalRulesInput = {
  canton: "NE",
  taxableIncomeCanton: 120_000,
  taxableWealthCanton: 500_000,
  userAdjustments: {
    privateCompanyTaxValue: undefined,
  },
};

export const companyValueQaResultNE_zero: ApplyCantonalRulesResult =
  applyCantonalRules(companyValueQaInputNE_zero);

export const companyValueQaExpectedNE_zero = {
  canton: "NE",
  baseWealthCanton: 500_000,
  totalWealthAdjustments: 0,
  adjustedWealthCanton: 500_000,   // inchangé
  uiBlockVisible: false,           // "Ajustements fortune potentiels" absent
  formatted: {
    adjustedWealthCanton: "500'000 CHF",
  },
} as const;

// ─── Scénario 3 : guard protection — valeur négative ─────────────────────────
//
// Circuit attendu :
//   dossier.fortune.valeurFiscaleEntrepriseParticipation = -50 000
//   guard App.tsx : isFinite(-50000) && -50000 > 0  → false
//   cantonalPrivateCompanyTaxValue                       = 0
//   Effet : identique au scénario zéro

export const companyValueQaGuardExpected = {
  description: "Une valeur négative est rejetée par le guard App.tsx (isFinite && > 0).",
  rawInput: -50_000,
  cantonalPrivateCompanyTaxValueAfterGuard: 0,
  effect: "Aucun ajustement fortune, circuit identique au scénario zéro.",
} as const;

// ─── Récapitulatif des points de vérification UI ─────────────────────────────

export const companyValueQaCheckpoints = [
  {
    step: "Saisie UI",
    field: "fortune.valeurFiscaleEntrepriseParticipation",
    location: "Section fortune — champ 'Participation / entreprise privée'",
    expectedBehavior: "StableNumberInput normalise à max(0, value)",
  },
  {
    step: "Extraction App.tsx",
    variable: "cantonalPrivateCompanyTaxValue",
    guard: "typeof === 'number' && isFinite && > 0",
    expectedBehavior: "0 si absent/invalide, valeur brute sinon",
  },
  {
    step: "Moteur cantonal",
    function: "applyCantonalRules",
    field: "userAdjustments.privateCompanyTaxValue",
    expectedBehavior: "undefined si 0, valeur si > 0 → AppliedCantonalAdjustment avec affectsTaxableWealth: true",
  },
  {
    step: "Consolidation moteur",
    formula: "adjustedWealthCanton = max(0, baseWealthCanton + totalWealthAdjustments)",
    expectedBehavior: "Fortune cantonale augmentée si privateCompanyTaxValue > 0",
  },
  {
    step: "OptimizationsPanel",
    condition: "totalWealthAdjustments > 0",
    expectedBehavior: "Affiche 'Ajustements fortune potentiels' et 'Fortune cantonale corrigée indicative'",
  },
] as const;
