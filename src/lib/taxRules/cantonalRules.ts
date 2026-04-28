// Socle préparatoire pour les règles fiscales cantonales.
// Phase 5.2 : règles pilotes pour les cantons romands (NE, GE, VD, FR, VS, JU).

// ─── Types ────────────────────────────────────────────────────────────────────

export type SwissCanton =
  | "ZH" | "BE" | "LU" | "UR" | "SZ" | "OW" | "NW" | "GL" | "ZG"
  | "FR" | "SO" | "BS" | "BL" | "SH" | "AR" | "AI" | "SG" | "GR"
  | "AG" | "TG" | "TI" | "VD" | "VS" | "NE" | "GE" | "JU";

export type CantonalRuleFamily =
  | "employment_expenses"
  | "health_and_insurance"
  | "family_and_children"
  | "real_estate"
  | "wealth"
  | "pension"
  | "business_owner"
  | "special_tax_treatment"
  | "other";

export type CantonalTaxpayerType =
  | "employee"
  | "self_employed"
  | "pensioner"
  | "all";

export type CantonalCalculationType =
  | "actual_cost"
  | "flat_rate"
  | "actual_vs_flat"
  | "percentage_of_income"
  | "percentage_of_wealth"
  | "fixed_amount"
  | "special_rate";

export type CantonalImpact =
  | "reduce_cantonal_taxable_income"
  | "reduce_cantonal_taxable_wealth"
  | "preferential_cantonal_tax_treatment"
  | "information_only";

export type CantonalRiskLevel = "low" | "medium" | "high";

export interface CantonalRuleInput {
  key: string;
  label: string;
  type: "number" | "boolean" | "select";
  unit?: "CHF" | "km" | "days" | "percent";
  options?: string[];
  required: boolean;
}

export interface CantonalRule {
  id: string;
  canton: SwissCanton | SwissCanton[];
  family: CantonalRuleFamily;
  category: string;
  label: string;
  appliesTo: CantonalTaxpayerType[];
  userQuestion: string;
  inputs: CantonalRuleInput[];
  calculationType: CantonalCalculationType;
  impact: CantonalImpact;
  justificationRequired: boolean;
  riskLevel: CantonalRiskLevel;
  advisorMessage: string;
  legalNote?: string;
}

// ─── Cantons romands pilotes ──────────────────────────────────────────────────

const ROMAND_PILOT_CANTONS: SwissCanton[] = ["NE", "GE", "VD", "FR", "VS", "JU"];

const LEGAL_NOTE = "Montant/plafond cantonal à raccorder au référentiel légal cantonal.";

// ─── Générateurs de règles par type ──────────────────────────────────────────

function travelRule(canton: SwissCanton): CantonalRule {
  const c = canton.toLowerCase();
  return {
    id: `${c}_travel_actual`,
    canton,
    family: "employment_expenses",
    category: "Frais de déplacement",
    label: `Frais de déplacement réels (${canton})`,
    appliesTo: ["employee"],
    userQuestion:
      "Vos frais de déplacement réels sont-ils supérieurs au montant automatiquement retenu pour ce canton ?",
    inputs: [
      { key: "actualTravelCosts", label: "Frais réels (CHF)", type: "number", unit: "CHF", required: true },
      { key: "taxwareTravelCosts", label: "Montant retenu par TaxWare (CHF)", type: "number", unit: "CHF", required: false },
    ],
    calculationType: "actual_vs_flat",
    impact: "reduce_cantonal_taxable_income",
    justificationRequired: true,
    riskLevel: "medium",
    advisorMessage: `Canton ${canton} : les frais de déplacement réels dépassant le montant standard peuvent être déduits. Justificatifs requis.`,
    legalNote: LEGAL_NOTE,
  };
}

function professionalExpensesRule(canton: SwissCanton): CantonalRule {
  const c = canton.toLowerCase();
  return {
    id: `${c}_professional_expenses_actual`,
    canton,
    family: "employment_expenses",
    category: "Frais professionnels",
    label: `Frais professionnels réels supérieurs au forfait (${canton})`,
    appliesTo: ["employee"],
    userQuestion:
      "Vos frais professionnels réels dépassent-ils le forfait cantonal automatiquement appliqué ?",
    inputs: [
      { key: "actualProfessionalExpenses", label: "Frais professionnels réels (CHF)", type: "number", unit: "CHF", required: true },
      { key: "taxwareProfessionalExpenses", label: "Forfait TaxWare (CHF)", type: "number", unit: "CHF", required: false },
    ],
    calculationType: "actual_vs_flat",
    impact: "reduce_cantonal_taxable_income",
    justificationRequired: true,
    riskLevel: "medium",
    advisorMessage: `Canton ${canton} : seul l'excédent sur le forfait cantonal est déductible. Conserver les justificatifs.`,
    legalNote: LEGAL_NOTE,
  };
}

function medicalExpensesRule(canton: SwissCanton): CantonalRule {
  const c = canton.toLowerCase();
  return {
    id: `${c}_medical_expenses_actual`,
    canton,
    family: "health_and_insurance",
    category: "Frais médicaux",
    label: `Frais médicaux non remboursés (${canton})`,
    appliesTo: ["all"],
    userQuestion:
      "Avez-vous payé des frais médicaux importants non remboursés par votre assurance maladie ?",
    inputs: [
      { key: "actualMedicalExpenses", label: "Frais médicaux non remboursés (CHF)", type: "number", unit: "CHF", required: true },
      { key: "taxwareMedicalExpenses", label: "Montant retenu par TaxWare (CHF)", type: "number", unit: "CHF", required: false },
    ],
    calculationType: "actual_vs_flat",
    impact: "reduce_cantonal_taxable_income",
    justificationRequired: true,
    riskLevel: "medium",
    advisorMessage: `Canton ${canton} : les frais médicaux non remboursés dépassant le seuil cantonal sont déductibles. Seuil à valider.`,
    legalNote: LEGAL_NOTE,
  };
}

function childcareRule(canton: SwissCanton): CantonalRule {
  const c = canton.toLowerCase();
  return {
    id: `${c}_childcare_expenses_actual`,
    canton,
    family: "family_and_children",
    category: "Garde d'enfants",
    label: `Frais de garde d'enfants (${canton})`,
    appliesTo: ["employee", "self_employed"],
    userQuestion:
      "Avez-vous payé des frais de garde d'enfants fiscalement justifiables ?",
    inputs: [
      { key: "actualChildcareCosts", label: "Frais de garde réels (CHF)", type: "number", unit: "CHF", required: true },
      { key: "taxwareChildcareCosts", label: "Montant retenu par TaxWare (CHF)", type: "number", unit: "CHF", required: false },
    ],
    calculationType: "actual_vs_flat",
    impact: "reduce_cantonal_taxable_income",
    justificationRequired: true,
    riskLevel: "low",
    advisorMessage: `Canton ${canton} : les frais de garde d'enfants pour enfants en bas âge peuvent être déduits dans la limite cantonale. Factures requises.`,
    legalNote: LEGAL_NOTE,
  };
}

function companyValueRule(canton: SwissCanton): CantonalRule {
  const c = canton.toLowerCase();
  return {
    id: `${c}_private_company_tax_value`,
    canton,
    family: "wealth",
    category: "Fortune — participation privée",
    label: `Valeur fiscale de participation / entreprise privée (${canton})`,
    appliesTo: ["self_employed", "all"],
    userQuestion:
      "Détenez-vous une participation ou une entreprise non cotée à intégrer dans la fortune imposable cantonale ?",
    inputs: [
      { key: "privateCompanyTaxValue", label: "Valeur fiscale déclarée (CHF)", type: "number", unit: "CHF", required: true },
    ],
    calculationType: "actual_cost",
    impact: "reduce_cantonal_taxable_wealth",
    justificationRequired: true,
    riskLevel: "high",
    advisorMessage: `Canton ${canton} : la valeur fiscale d'une participation non cotée est déterminée selon la pratique cantonale (méthode de la valeur de rendement, valeur substantielle, etc.). Validation obligatoire.`,
    legalNote: LEGAL_NOTE,
  };
}

// ─── Référentiel cantonal ─────────────────────────────────────────────────────

export const cantonalRules: CantonalRule[] = ROMAND_PILOT_CANTONS.flatMap((canton) => [
  travelRule(canton),
  professionalExpensesRule(canton),
  medicalExpensesRule(canton),
  childcareRule(canton),
  companyValueRule(canton),
]);
