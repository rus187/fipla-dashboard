// Moteur d'ajustements IFD — couche analytique post-TaxWare.
// Ne remplace pas TaxWare. N'appelle aucune API. Aucun composant React.

import { ifdRules } from "../taxRules/ifdRules";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface IFDUserAdjustmentInput {
  pillar3aPersonLeading?: number;
  pillar3aPersonSecond?: number;
  lppBuybackPersonLeading?: number;
  lppBuybackPersonSecond?: number;
  actualTravelCosts?: number;
  taxwareTravelCosts?: number;
  actualProfessionalExpenses?: number;
  taxwareProfessionalExpenses?: number;
  actualRealEstateMaintenance?: number;
  taxwareRealEstateMaintenance?: number;
  qualifiedDividendsGross?: number;
  qualifiedDividendsAlreadyTaxedAmount?: number;
}

export interface ApplyIFDRulesInput {
  taxableIncomeFederal: number;
  taxwareDeductions?: Record<string, unknown>;
  userAdjustments?: IFDUserAdjustmentInput;
}

export interface AppliedIFDAdjustment {
  ruleId: string;
  label: string;
  amount: number;
  applied: boolean;
  explanation: string;
  affectsBudgetIncome: boolean;
}

export interface IFDAdjustmentWarning {
  ruleId: string;
  message: string;
}

export interface ApplyIFDRulesResult {
  baseIncomeIFD: number;
  adjustments: AppliedIFDAdjustment[];
  totalAdjustments: number;
  adjustedIncomeIFD: number;
  warnings: IFDAdjustmentWarning[];
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

function ruleLabel(id: string): string {
  return ifdRules.find((r) => r.id === id)?.label ?? id;
}

// ─── Moteur principal ─────────────────────────────────────────────────────────

export function applyIFDRules(input: ApplyIFDRulesInput): ApplyIFDRulesResult {
  const warnings: IFDAdjustmentWarning[] = [];
  const adjustments: AppliedIFDAdjustment[] = [];

  // Validation de la base imposable
  const base = input.taxableIncomeFederal;
  if (base === undefined || base === null || isNaN(base) || base < 0) {
    warnings.push({
      ruleId: "ifd_base",
      message:
        "Le revenu imposable IFD est absent ou invalide. Aucun ajustement ne peut être calculé.",
    });
    return {
      baseIncomeIFD: 0,
      adjustments: [],
      totalAdjustments: 0,
      adjustedIncomeIFD: 0,
      warnings,
    };
  }

  const ua = input.userAdjustments ?? {};

  // ── 1. 3e pilier A ──────────────────────────────────────────────────────────
  const pillar3aTotal =
    safePositive(ua.pillar3aPersonLeading) + safePositive(ua.pillar3aPersonSecond);

  adjustments.push({
    ruleId: "ifd_pillar3a",
    label: ruleLabel("ifd_pillar3a"),
    amount: pillar3aTotal,
    applied: pillar3aTotal > 0,
    explanation:
      pillar3aTotal > 0
        ? `Versements 3e pilier A : CHF ${pillar3aTotal.toLocaleString("fr-CH")}. Déductibles dans la limite légale IFD.`
        : "Aucun versement 3e pilier A renseigné.",
    affectsBudgetIncome: false,
  });

  // ── 2. Rachat LPP ───────────────────────────────────────────────────────────
  const lppTotal =
    safePositive(ua.lppBuybackPersonLeading) + safePositive(ua.lppBuybackPersonSecond);

  adjustments.push({
    ruleId: "ifd_lpp_buyback",
    label: ruleLabel("ifd_lpp_buyback"),
    amount: lppTotal,
    applied: lppTotal > 0,
    explanation:
      lppTotal > 0
        ? `Rachat LPP : CHF ${lppTotal.toLocaleString("fr-CH")}. Diminue le revenu imposable fiscalement, mais ne doit pas être soustrait des revenus dans le contrôle budgétaire interne. Il est financé par la fortune liquide.`
        : "Aucun rachat LPP renseigné.",
    affectsBudgetIncome: false,
  });

  // ── 3. Frais de déplacement — excédent réel vs TaxWare ─────────────────────
  const travelGap = positiveGap(ua.actualTravelCosts, ua.taxwareTravelCosts);

  adjustments.push({
    ruleId: "ifd_travel_actual",
    label: ruleLabel("ifd_travel_actual"),
    amount: travelGap,
    applied: travelGap > 0,
    explanation:
      travelGap > 0
        ? `Excédent frais de déplacement réels sur forfait TaxWare : CHF ${travelGap.toLocaleString("fr-CH")}.`
        : "Frais de déplacement réels inférieurs ou égaux au montant TaxWare — aucun ajustement.",
    affectsBudgetIncome: true,
  });

  // ── 4. Frais professionnels — excédent réel vs TaxWare ─────────────────────
  const professionalGap = positiveGap(
    ua.actualProfessionalExpenses,
    ua.taxwareProfessionalExpenses
  );

  adjustments.push({
    ruleId: "ifd_professional_expenses_actual",
    label: ruleLabel("ifd_professional_expenses_actual"),
    amount: professionalGap,
    applied: professionalGap > 0,
    explanation:
      professionalGap > 0
        ? `Excédent frais professionnels réels sur forfait TaxWare : CHF ${professionalGap.toLocaleString("fr-CH")}.`
        : "Frais professionnels réels inférieurs ou égaux au montant TaxWare — aucun ajustement.",
    affectsBudgetIncome: true,
  });

  // ── 5. Entretien immobilier — excédent réel vs TaxWare ─────────────────────
  const realEstateGap = positiveGap(
    ua.actualRealEstateMaintenance,
    ua.taxwareRealEstateMaintenance
  );

  adjustments.push({
    ruleId: "ifd_real_estate_maintenance",
    label: ruleLabel("ifd_real_estate_maintenance"),
    amount: realEstateGap,
    applied: realEstateGap > 0,
    explanation:
      realEstateGap > 0
        ? `Excédent frais d'entretien immobilier réels sur forfait TaxWare : CHF ${realEstateGap.toLocaleString("fr-CH")}.`
        : "Frais d'entretien immobilier réels inférieurs ou égaux au montant TaxWare — aucun ajustement.",
    affectsBudgetIncome: true,
  });

  // ── 6. Dividendes de participation qualifiée ────────────────────────────────
  const grossDividend = safePositive(ua.qualifiedDividendsGross);
  const alreadyTaxed = safePositive(ua.qualifiedDividendsAlreadyTaxedAmount);

  let dividendAdjustment = 0;
  let dividendApplied = false;

  if (grossDividend > 0) {
    // Allègement théorique IFD : réduction pour participation = 30 % du dividende brut.
    // Si un montant a déjà été pris en compte par TaxWare, on ne double pas l'allègement.
    const theoreticalRelief = grossDividend * 0.3;
    dividendAdjustment = alreadyTaxed > 0 ? 0 : theoreticalRelief;
    dividendApplied = dividendAdjustment > 0;

    warnings.push({
      ruleId: "ifd_qualified_dividends",
      message:
        "L'allègement pour participation qualifiée (30 % du dividende brut, théorique IFD) doit être contrôlé selon la structure exacte de la participation et la déclaration de l'entreprise. Validation par un conseiller fiscal requise.",
    });
  }

  adjustments.push({
    ruleId: "ifd_qualified_dividends",
    label: ruleLabel("ifd_qualified_dividends"),
    amount: dividendAdjustment,
    applied: dividendApplied,
    explanation:
      grossDividend > 0
        ? alreadyTaxed > 0
          ? `Dividende brut de CHF ${grossDividend.toLocaleString("fr-CH")} — allègement déjà pris en compte par TaxWare (CHF ${alreadyTaxed.toLocaleString("fr-CH")}). Aucun ajustement supplémentaire appliqué.`
          : `Allègement théorique IFD (réduction pour participation, 30 %) : CHF ${dividendAdjustment.toLocaleString("fr-CH")} sur dividende brut de CHF ${grossDividend.toLocaleString("fr-CH")}.`
        : "Aucun dividende de participation qualifiée renseigné.",
    affectsBudgetIncome: false,
  });

  // ── Consolidation ───────────────────────────────────────────────────────────
  const totalAdjustments = adjustments
    .filter((a) => a.applied)
    .reduce((sum, a) => sum + a.amount, 0);

  const adjustedIncomeIFD = Math.max(0, base - totalAdjustments);

  return {
    baseIncomeIFD: base,
    adjustments,
    totalAdjustments,
    adjustedIncomeIFD,
    warnings,
  };
}
