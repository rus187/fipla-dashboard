// QA visuelle — Phase 6.5 : circuit complet module entrepreneur.
// Ce scénario QA vérifie le circuit visuel complet du module entrepreneur.
// Il ne doit pas être utilisé comme source de calcul métier.
//
// Circuit vérifié :
//   saisie UI valorisation
//     → calculateCompanyValuation  (companyValuation.ts)
//     → ownedCompanyValue injectée dans dossier.fortune.valeurFiscaleEntrepriseParticipation
//     → guard App.tsx (isFinite && > 0) → cantonalPrivateCompanyTaxValue
//     → applyCantonalRules         (applyCantonalRules.ts)
//     → totalWealthAdjustments / adjustedWealthCanton
//     → OptimizationsPanel : "Ajustements fortune potentiels" + "Fortune cantonale corrigée indicative"

import {
  calculateCompanyValuation,
  type CompanyValuationInput,
  type CompanyValuationResult,
} from "./companyValuation";

import {
  applyCantonalRules,
  type ApplyCantonalRulesInput,
  type ApplyCantonalRulesResult,
} from "../taxEngine/applyCantonalRules";

// ─── Utilitaire ───────────────────────────────────────────────────────────────

export function formatCompanyValuationUiQaAmount(value: number): string {
  return (
    new Intl.NumberFormat("fr-CH", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value) + " CHF"
  );
}

// ─── Étape 1 : saisie UI valorisation ────────────────────────────────────────
//
// Canton : NE
// Bénéfices : [200 000, 180 000, 220 000]
// Valeur intrinsèque : 1 000 000
// Taux de capitalisation : 0.08
// Pourcentage détenu : 1 (100 %)

export const companyValuationUiQaInput: CompanyValuationInput = {
  profits: [200_000, 180_000, 220_000],
  intrinsicValue: 1_000_000,
  capitalizationRate: 0.08,
  ownershipPercentage: 1,
};

// ─── Étape 2 : calcul valeur entreprise ──────────────────────────────────────
//
// averageProfit    = (200 000 + 180 000 + 220 000) / 3 = 200 000
// earningsValue    = 200 000 / 0.08                   = 2 500 000
// fullCompanyValue = (2 × 2 500 000 + 1 000 000) / 3
//                  = (5 000 000 + 1 000 000) / 3
//                  = 6 000 000 / 3
//                  = 2 000 000
// ownedCompanyValue = 2 000 000 × 1                   = 2 000 000

export const companyValuationUiQaValuationResult: CompanyValuationResult =
  calculateCompanyValuation(companyValuationUiQaInput);

export const companyValuationUiQaExpectedValuation = {
  normalizedProfits: [200_000, 180_000, 220_000],
  averageProfit: 200_000,
  capitalizationRate: 0.08,
  earningsValue: 2_500_000,
  intrinsicValue: 1_000_000,
  fullCompanyValue: 2_000_000,
  ownershipPercentage: 1,
  ownedCompanyValue: 2_000_000,
  warningCodes: ["indicative_valuation"],

  formatted: {
    averageProfit: "200'000 CHF",
    earningsValue: "2'500'000 CHF",
    intrinsicValue: "1'000'000 CHF",
    fullCompanyValue: "2'000'000 CHF",
    ownedCompanyValue: "2'000'000 CHF",
  },
} as const;

// ─── Étape 3 : valeur injectée dans la fortune ────────────────────────────────
//
// App.tsx Phase 6.4 — bouton "Utiliser cette valeur dans la fortune" :
//   safeOwnedCompanyValue = Math.round(companyValuationResult.ownedCompanyValue)
//   setDossier → dossier.fortune.valeurFiscaleEntrepriseParticipation = 2 000 000
//   (Injection locale uniquement : non transmise à TaxWare dans cette phase.)

export const companyValuationUiQaInjectedValue = 2_000_000;

// ─── Étape 4 : extraction vers le moteur cantonal ────────────────────────────
//
// App.tsx Phase 5.7 guard :
//   rawCompanyValue = dossier.fortune.valeurFiscaleEntrepriseParticipation = 2 000 000
//   typeof === "number" && isFinite && > 0 → true
//   cantonalPrivateCompanyTaxValue = 2 000 000

export const companyValuationUiQaCantonalInput: ApplyCantonalRulesInput = {
  canton: "NE",
  taxableIncomeCanton: 150_000,
  taxableWealthCanton: 500_000,
  userAdjustments: {
    privateCompanyTaxValue: companyValuationUiQaInjectedValue,
  },
};

// ─── Étape 5 : résultat moteur cantonal ──────────────────────────────────────
//
// applyCantonalRules(NE, revenu=150 000, fortune=500 000, privateCompanyTaxValue=2 000 000)
//   totalWealthAdjustments = 2 000 000
//   adjustedWealthCanton   = 500 000 + 2 000 000 = 2 500 000
//   warning : ne_private_company_tax_value

export const companyValuationUiQaCantonalResult: ApplyCantonalRulesResult =
  applyCantonalRules(companyValuationUiQaCantonalInput);

export const companyValuationUiQaExpected = {
  // Fortune de base
  baseWealthCanton: 500_000,
  // Ajustement entreprise
  privateCompanyTaxValue: 2_000_000,
  totalWealthAdjustments: 2_000_000,
  // Fortune corrigée
  adjustedWealthCanton: 2_500_000,
  // Revenu inchangé (aucun ajustement revenu dans ce scénario)
  adjustedIncomeCanton: 150_000,
  totalIncomeAdjustments: 0,
  // Warning attendue
  expectedWarningRuleId: "ne_private_company_tax_value",
  // UI OptimizationsPanel
  ui: {
    adjustmentBlockVisible: true,
    correctedWealthBlockVisible: true,
    adjustmentLabel: "Participation / entreprise privée",
    adjustmentAmount: "2'000'000 CHF",
    correctedWealth: "2'500'000 CHF",
  },
} as const;

// ─── Checkpoints visuels ─────────────────────────────────────────────────────

export const companyValuationUiQaCheckpoints = [
  {
    step: 1,
    name: "Saisie UI valorisation",
    field: "Mini-UI valorisation — champs bénéfices / valeur intrinsèque / taux / participation",
    expected: "6 champs StableNumberInput affichent les valeurs saisies",
    visualCheck:
      "Tableau résultats affiche : bénéfice moyen 200'000 CHF, valeur rendement 2'500'000 CHF, valeur intrinsèque 1'000'000 CHF, valeur fiscale entreprise 2'000'000 CHF, part détenue 2'000'000 CHF",
  },
  {
    step: 2,
    name: "Calcul valeur entreprise",
    field: "companyValuationResult.ownedCompanyValue",
    expected: "2'000'000 CHF",
    visualCheck:
      "Bouton 'Utiliser cette valeur dans la fortune' devient actif (bleu) — valeur > 0 détectée",
  },
  {
    step: 3,
    name: "Injection dans la fortune",
    field: "dossier.fortune.valeurFiscaleEntrepriseParticipation",
    expected: "2'000'000 CHF (Math.round appliqué)",
    visualCheck:
      "Message vert 'Valeur reprise dans la fortune cantonale indicative.' apparaît sous le bouton. Champ 'Participation / entreprise privée' de la fortune affiche 2'000'000.",
  },
  {
    step: 4,
    name: "Extraction vers moteur cantonal",
    field: "cantonalPrivateCompanyTaxValue (App.tsx guard)",
    expected: "2'000'000 — guard isFinite && > 0 passé",
    visualCheck:
      "Aucun indicateur UI direct à cette étape (calcul interne). Vérifiable via instrumentation console.",
  },
  {
    step: 5,
    name: "Résumé cantonal — OptimizationsPanel",
    field: "totalWealthAdjustments / adjustedWealthCanton",
    expected:
      "Bloc 'Ajustements fortune potentiels' : 2'000'000 CHF. Fortune cantonale corrigée indicative : 2'500'000 CHF.",
    visualCheck:
      "Deux blocs visibles dans OptimizationsPanel sous la section cantonale : (1) 'Ajustements fortune potentiels' avec montant 2'000'000 CHF et label 'Participation / entreprise privée', (2) 'Fortune cantonale corrigée indicative : 2'500'000 CHF'.",
  },
] as const;
