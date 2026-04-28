// Moteur cantonal — fonctions pures, aucun effet de bord.
// Phase 5.2 : ajustements génériques pour les cantons romands pilotes.
// Aucun appel API, aucun composant React, aucune mutation d'état global.

import type { SwissCanton, CantonalImpact } from "../taxRules/cantonalRules";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CantonalUserAdjustmentInput {
  actualTravelCosts?: number;
  taxwareTravelCosts?: number;
  actualProfessionalExpenses?: number;
  taxwareProfessionalExpenses?: number;
  actualMedicalExpenses?: number;
  taxwareMedicalExpenses?: number;
  actualInsurancePremiums?: number;
  taxwareInsurancePremiums?: number;
  actualChildcareCosts?: number;
  taxwareChildcareCosts?: number;
  actualRealEstateMaintenance?: number;
  taxwareRealEstateMaintenance?: number;
  privateCompanyTaxValue?: number;
  businessParticipationDividends?: number;
  otherIncomeAdjustment?: number;
  otherWealthAdjustment?: number;
}

export interface ApplyCantonalRulesInput {
  canton: SwissCanton;
  taxableIncomeCanton: number;
  taxableWealthCanton?: number;
  taxwareDeductions?: Record<string, unknown>;
  userAdjustments?: CantonalUserAdjustmentInput;
}

export interface AppliedCantonalAdjustment {
  ruleId: string;
  label: string;
  amount: number;
  applied: boolean;
  impact: CantonalImpact;
  explanation: string;
  affectsTaxableIncome: boolean;
  affectsTaxableWealth: boolean;
}

export interface CantonalAdjustmentWarning {
  ruleId: string;
  message: string;
}

export interface ApplyCantonalRulesResult {
  canton: SwissCanton;
  baseIncomeCanton: number;
  baseWealthCanton: number;
  adjustments: AppliedCantonalAdjustment[];
  totalIncomeAdjustments: number;
  totalWealthAdjustments: number;
  adjustedIncomeCanton: number;
  adjustedWealthCanton: number;
  warnings: CantonalAdjustmentWarning[];
}

// ─── Utilitaires ──────────────────────────────────────────────────────────────

function safePositive(value: number | undefined): number {
  if (value === undefined || isNaN(value) || value < 0) return 0;
  return value;
}

function positiveGap(actual: number | undefined, taxware: number | undefined): number {
  const gap = safePositive(actual) - safePositive(taxware);
  return gap > 0 ? gap : 0;
}

const ROMAND_CANTONS = new Set<SwissCanton>(["NE", "GE", "VD", "FR", "VS", "JU"]);

// ─── Moteur cantonal ─────────────────────────────────────────────────────────

export function applyCantonalRules(
  input: ApplyCantonalRulesInput
): ApplyCantonalRulesResult {
  const baseIncomeCanton = safePositive(input.taxableIncomeCanton);
  const baseWealthCanton = safePositive(input.taxableWealthCanton);
  const warnings: CantonalAdjustmentWarning[] = [];
  const adjustments: AppliedCantonalAdjustment[] = [];

  if (!ROMAND_CANTONS.has(input.canton)) {
    warnings.push({
      ruleId: "cantonal_non_romand",
      message: "Aucune règle pilote romande active pour ce canton dans cette phase.",
    });
    return {
      canton: input.canton,
      baseIncomeCanton,
      baseWealthCanton,
      adjustments,
      totalIncomeAdjustments: 0,
      totalWealthAdjustments: 0,
      adjustedIncomeCanton: baseIncomeCanton,
      adjustedWealthCanton: baseWealthCanton,
      warnings,
    };
  }

  const ua = input.userAdjustments ?? {};
  const c = input.canton.toLowerCase();

  // ── Ajustements revenu (réduisent la base cantonale) ──────────────────────

  const travelGap = positiveGap(ua.actualTravelCosts, ua.taxwareTravelCosts);
  adjustments.push({
    ruleId: `${c}_travel_actual`,
    label: "Frais de déplacement réels",
    amount: travelGap,
    applied: travelGap > 0,
    impact: "reduce_cantonal_taxable_income",
    explanation:
      travelGap > 0
        ? `Excédent frais déplacement réels vs TaxWare : CHF ${travelGap.toLocaleString("fr-CH")}`
        : "Frais de déplacement réels inférieurs ou égaux au montant TaxWare — aucun ajustement.",
    affectsTaxableIncome: true,
    affectsTaxableWealth: false,
  });

  const professionalGap = positiveGap(
    ua.actualProfessionalExpenses,
    ua.taxwareProfessionalExpenses
  );
  adjustments.push({
    ruleId: `${c}_professional_expenses_actual`,
    label: "Frais professionnels réels",
    amount: professionalGap,
    applied: professionalGap > 0,
    impact: "reduce_cantonal_taxable_income",
    explanation:
      professionalGap > 0
        ? `Excédent frais professionnels réels vs TaxWare : CHF ${professionalGap.toLocaleString("fr-CH")}`
        : "Frais professionnels réels inférieurs ou égaux au forfait TaxWare — aucun ajustement.",
    affectsTaxableIncome: true,
    affectsTaxableWealth: false,
  });

  const medicalGap = positiveGap(ua.actualMedicalExpenses, ua.taxwareMedicalExpenses);
  adjustments.push({
    ruleId: `${c}_medical_expenses_actual`,
    label: "Frais médicaux non remboursés",
    amount: medicalGap,
    applied: medicalGap > 0,
    impact: "reduce_cantonal_taxable_income",
    explanation:
      medicalGap > 0
        ? `Excédent frais médicaux vs montant TaxWare : CHF ${medicalGap.toLocaleString("fr-CH")}`
        : "Frais médicaux inférieurs ou égaux au montant TaxWare — aucun ajustement.",
    affectsTaxableIncome: true,
    affectsTaxableWealth: false,
  });

  const childcareGap = positiveGap(ua.actualChildcareCosts, ua.taxwareChildcareCosts);
  adjustments.push({
    ruleId: `${c}_childcare_expenses_actual`,
    label: "Frais de garde d'enfants",
    amount: childcareGap,
    applied: childcareGap > 0,
    impact: "reduce_cantonal_taxable_income",
    explanation:
      childcareGap > 0
        ? `Excédent frais de garde vs montant TaxWare : CHF ${childcareGap.toLocaleString("fr-CH")}`
        : "Frais de garde inférieurs ou égaux au montant TaxWare — aucun ajustement.",
    affectsTaxableIncome: true,
    affectsTaxableWealth: false,
  });

  const realEstateGap = positiveGap(
    ua.actualRealEstateMaintenance,
    ua.taxwareRealEstateMaintenance
  );
  adjustments.push({
    ruleId: `${c}_real_estate_maintenance`,
    label: "Frais d'entretien immobilier",
    amount: realEstateGap,
    applied: realEstateGap > 0,
    impact: "reduce_cantonal_taxable_income",
    explanation:
      realEstateGap > 0
        ? `Excédent frais entretien immobilier vs TaxWare : CHF ${realEstateGap.toLocaleString("fr-CH")}`
        : "Frais d'entretien inférieurs ou égaux au montant TaxWare — aucun ajustement.",
    affectsTaxableIncome: true,
    affectsTaxableWealth: false,
  });

  const otherIncome = safePositive(ua.otherIncomeAdjustment);
  if (otherIncome > 0) {
    adjustments.push({
      ruleId: `${c}_other_income_adjustment`,
      label: "Autre ajustement de revenu",
      amount: otherIncome,
      applied: true,
      impact: "reduce_cantonal_taxable_income",
      explanation: `Ajustement de revenu cantonal divers : CHF ${otherIncome.toLocaleString("fr-CH")}`,
      affectsTaxableIncome: true,
      affectsTaxableWealth: false,
    });
  }

  // ── Ajustements fortune (augmentent la base cantonale dans cette phase) ────

  const companyValue = safePositive(ua.privateCompanyTaxValue);
  if (companyValue > 0) {
    adjustments.push({
      ruleId: `${c}_private_company_tax_value`,
      label: "Valeur fiscale participation / entreprise privée",
      amount: companyValue,
      applied: true,
      impact: "reduce_cantonal_taxable_wealth",
      explanation: `Valeur fiscale entreprise intégrée dans la fortune cantonale : CHF ${companyValue.toLocaleString("fr-CH")}`,
      affectsTaxableIncome: false,
      affectsTaxableWealth: true,
    });
    warnings.push({
      ruleId: `${c}_private_company_tax_value`,
      message:
        "La valeur fiscale de l'entreprise doit être validée selon la pratique cantonale applicable.",
    });
  }

  const otherWealth = safePositive(ua.otherWealthAdjustment);
  if (otherWealth > 0) {
    adjustments.push({
      ruleId: `${c}_other_wealth_adjustment`,
      label: "Autre ajustement de fortune",
      amount: otherWealth,
      applied: true,
      impact: "reduce_cantonal_taxable_wealth",
      explanation: `Ajustement de fortune cantonale divers : CHF ${otherWealth.toLocaleString("fr-CH")}`,
      affectsTaxableIncome: false,
      affectsTaxableWealth: true,
    });
  }

  // ── Consolidation ──────────────────────────────────────────────────────────

  const totalIncomeAdjustments = adjustments
    .filter((a) => a.applied && a.affectsTaxableIncome)
    .reduce((sum, a) => sum + a.amount, 0);

  const totalWealthAdjustments = adjustments
    .filter((a) => a.applied && a.affectsTaxableWealth)
    .reduce((sum, a) => sum + a.amount, 0);

  // Income adjustments reduce the cantonal base.
  // Wealth adjustments (company value) add to the cantonal base in this phase.
  const adjustedIncomeCanton = Math.max(0, baseIncomeCanton - totalIncomeAdjustments);
  const adjustedWealthCanton = Math.max(0, baseWealthCanton + totalWealthAdjustments);

  return {
    canton: input.canton,
    baseIncomeCanton,
    baseWealthCanton,
    adjustments,
    totalIncomeAdjustments,
    totalWealthAdjustments,
    adjustedIncomeCanton,
    adjustedWealthCanton,
    warnings,
  };
}
