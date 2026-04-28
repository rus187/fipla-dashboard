// Référentiel métier des règles IFD (Impôt Fédéral Direct)
// Aucun appel API, aucun composant React, aucune mutation d'état global.

export type IFDRuleFamily =
  | "travel_and_professional"
  | "meal_and_stay"
  | "training"
  | "retirement_savings"
  | "health_and_insurance"
  | "charitable"
  | "financial_charges"
  | "real_estate"
  | "special_tax_treatment";

export type IFDTaxpayerType =
  | "employee"
  | "self_employed"
  | "pensioner"
  | "all";

export type IFDCalculationType =
  | "actual_cost"
  | "flat_rate"
  | "actual_vs_flat"
  | "percentage_of_income"
  | "fixed_amount"
  | "special_rate";

export type IFDImpact =
  | "reduces_taxable_income"
  | "reduces_taxable_assets"
  | "preferential_tax_rate"
  | "separate_taxation";

export type IFDRiskLevel = "low" | "medium" | "high";

export interface IFDRuleInput {
  key: string;
  label: string;
  type: "number" | "boolean" | "select";
  unit?: "CHF" | "km" | "days" | "percent";
  options?: string[];
  required: boolean;
}

export interface IFDRule {
  id: string;
  family: IFDRuleFamily;
  category: string;
  label: string;
  appliesTo: IFDTaxpayerType[];
  userQuestion: string;
  inputs: IFDRuleInput[];
  calculationType: IFDCalculationType;
  impact: IFDImpact;
  justificationRequired: boolean;
  riskLevel: IFDRiskLevel;
  advisorMessage: string;
}

export const ifdRules: IFDRule[] = [
  {
    id: "ifd_travel_actual",
    family: "travel_and_professional",
    category: "Frais de déplacement",
    label: "Frais de déplacement réels",
    appliesTo: ["employee"],
    userQuestion:
      "Utilisez-vous un véhicule privé ou les transports publics pour vous rendre au travail ? Quel est votre trajet aller-retour ?",
    inputs: [
      {
        key: "annualTransportCost",
        label: "Coût annuel des transports (CHF)",
        type: "number",
        unit: "CHF",
        required: true,
      },
      {
        key: "distanceKm",
        label: "Distance aller (km)",
        type: "number",
        unit: "km",
        required: false,
      },
      {
        key: "transportType",
        label: "Mode de transport",
        type: "select",
        options: ["transports_publics", "vehicule_prive", "mixte"],
        required: true,
      },
    ],
    calculationType: "actual_vs_flat",
    impact: "reduces_taxable_income",
    justificationRequired: true,
    riskLevel: "medium",
    advisorMessage:
      "Les frais réels sont déductibles s'ils dépassent le forfait IFD (max CHF 3 000 pour véhicule privé). Justificatifs de transport obligatoires. Contrôle fréquent en cas de distance importante.",
  },
  {
    id: "ifd_professional_expenses_actual",
    family: "travel_and_professional",
    category: "Frais professionnels",
    label: "Frais professionnels réels supérieurs au forfait",
    appliesTo: ["employee"],
    userQuestion:
      "Avez-vous des frais professionnels (matériel, vêtements de travail, outils) dépassant le forfait de 3 % du salaire net ?",
    inputs: [
      {
        key: "actualProfessionalExpenses",
        label: "Frais professionnels réels (CHF)",
        type: "number",
        unit: "CHF",
        required: true,
      },
      {
        key: "netSalary",
        label: "Salaire net annuel (CHF)",
        type: "number",
        unit: "CHF",
        required: true,
      },
    ],
    calculationType: "actual_vs_flat",
    impact: "reduces_taxable_income",
    justificationRequired: true,
    riskLevel: "medium",
    advisorMessage:
      "Le forfait IFD est de 3 % du salaire net (min CHF 2 000, max CHF 4 000). Les frais réels ne sont retenus que s'ils dépassent ce forfait et sont dûment justifiés.",
  },
  {
    id: "ifd_meal_expenses",
    family: "meal_and_stay",
    category: "Frais de repas",
    label: "Frais de repas hors domicile",
    appliesTo: ["employee"],
    userQuestion:
      "Prenez-vous vos repas à l'extérieur en raison de votre activité professionnelle ? Votre employeur participe-t-il aux frais ?",
    inputs: [
      {
        key: "workedDaysOutside",
        label: "Jours de repas hors domicile par an",
        type: "number",
        unit: "days",
        required: true,
      },
      {
        key: "employerContribution",
        label: "Participation de l'employeur (CHF/jour)",
        type: "number",
        unit: "CHF",
        required: false,
      },
    ],
    calculationType: "flat_rate",
    impact: "reduces_taxable_income",
    justificationRequired: false,
    riskLevel: "low",
    advisorMessage:
      "Déduction forfaitaire IFD : CHF 15 par jour si l'employeur ne participe pas, CHF 7.50 si participation partielle. Plafond annuel selon le nombre de jours travaillés.",
  },
  {
    id: "ifd_training",
    family: "training",
    category: "Formation continue",
    label: "Formation continue liée à l'activité professionnelle",
    appliesTo: ["employee", "self_employed"],
    userQuestion:
      "Avez-vous engagé des frais de formation continue directement liés à votre activité professionnelle actuelle ?",
    inputs: [
      {
        key: "trainingCost",
        label: "Coût total de la formation (CHF)",
        type: "number",
        unit: "CHF",
        required: true,
      },
      {
        key: "linkedToCurrentActivity",
        label: "Formation liée à l'activité actuelle",
        type: "boolean",
        required: true,
      },
    ],
    calculationType: "actual_cost",
    impact: "reduces_taxable_income",
    justificationRequired: true,
    riskLevel: "medium",
    advisorMessage:
      "Déductible jusqu'à CHF 12 000 par an (IFD). La formation doit être liée à l'activité professionnelle actuelle et non à une reconversion. Factures requises.",
  },
  {
    id: "ifd_pillar3a",
    family: "retirement_savings",
    category: "Prévoyance",
    label: "3e pilier A",
    appliesTo: ["employee", "self_employed"],
    userQuestion:
      "Effectuez-vous des versements dans un compte ou une police de 3e pilier A ?",
    inputs: [
      {
        key: "pillar3aContribution",
        label: "Versement annuel 3e pilier A (CHF)",
        type: "number",
        unit: "CHF",
        required: true,
      },
      {
        key: "hasPensionFund",
        label: "Affilié à une caisse de pension (LPP)",
        type: "boolean",
        required: true,
      },
    ],
    calculationType: "fixed_amount",
    impact: "reduces_taxable_income",
    justificationRequired: false,
    riskLevel: "low",
    advisorMessage:
      "Plafond 2026 : CHF 7 258 (salarié affilié LPP) ou 20 % du revenu net d'activité lucrative, max CHF 36 288 (indépendant sans LPP). Déductible franc pour franc dans la limite légale.",
  },
  {
    id: "ifd_lpp_buyback",
    family: "retirement_savings",
    category: "Prévoyance",
    label: "Rachat LPP (lacune de prévoyance)",
    appliesTo: ["employee", "self_employed"],
    userQuestion:
      "Avez-vous effectué un rachat dans votre caisse de pension pour combler une lacune de prévoyance ?",
    inputs: [
      {
        key: "lppBuybackAmount",
        label: "Montant du rachat LPP (CHF)",
        type: "number",
        unit: "CHF",
        required: true,
      },
      {
        key: "buybackYear",
        label: "Année du rachat",
        type: "number",
        required: true,
      },
    ],
    calculationType: "actual_cost",
    impact: "reduces_taxable_income",
    justificationRequired: true,
    riskLevel: "high",
    advisorMessage:
      "Diminue le revenu imposable fiscalement, mais ne doit pas être soustrait des revenus dans le contrôle budgétaire interne. Il est financé par la fortune liquide. Attention : retrait du capital dans les 3 ans suivant le rachat entraîne une reprise fiscale.",
  },
  {
    id: "ifd_medical_expenses",
    family: "health_and_insurance",
    category: "Santé",
    label: "Frais médicaux non remboursés",
    appliesTo: ["all"],
    userQuestion:
      "Avez-vous supporté des frais médicaux ou dentaires non remboursés par votre assurance maladie ?",
    inputs: [
      {
        key: "totalMedicalExpenses",
        label: "Total des frais médicaux non remboursés (CHF)",
        type: "number",
        unit: "CHF",
        required: true,
      },
      {
        key: "netIncome",
        label: "Revenu net imposable estimé (CHF)",
        type: "number",
        unit: "CHF",
        required: true,
      },
    ],
    calculationType: "percentage_of_income",
    impact: "reduces_taxable_income",
    justificationRequired: true,
    riskLevel: "medium",
    advisorMessage:
      "Déductibles à l'IFD uniquement si les frais dépassent 5 % du revenu net. Seul l'excédent est déductible. Conserver toutes les factures et les décomptes de remboursement.",
  },
  {
    id: "ifd_insurance_premiums",
    family: "health_and_insurance",
    category: "Assurances",
    label: "Primes d'assurance",
    appliesTo: ["all"],
    userQuestion:
      "Payez-vous des primes d'assurance-maladie, assurance-vie ou assurance-rentes ?",
    inputs: [
      {
        key: "healthInsurancePremium",
        label: "Primes assurance-maladie annuelles (CHF)",
        type: "number",
        unit: "CHF",
        required: true,
      },
      {
        key: "lifeInsurancePremium",
        label: "Primes assurance-vie/rentes (CHF)",
        type: "number",
        unit: "CHF",
        required: false,
      },
      {
        key: "familyStatus",
        label: "Situation familiale",
        type: "select",
        options: ["celibataire", "marie", "famille_avec_enfants"],
        required: true,
      },
    ],
    calculationType: "flat_rate",
    impact: "reduces_taxable_income",
    justificationRequired: false,
    riskLevel: "low",
    advisorMessage:
      "Déduction forfaitaire IFD 2026 : CHF 1 800 (personne seule), CHF 3 600 (couple), + CHF 600 par enfant. Les primes effectives peuvent être déduites si elles dépassent le forfait, dans la limite légale.",
  },
  {
    id: "ifd_charitable_donations",
    family: "charitable",
    category: "Dons",
    label: "Dons à des institutions reconnues d'utilité publique",
    appliesTo: ["all"],
    userQuestion:
      "Avez-vous effectué des dons à des associations ou fondations reconnues d'utilité publique exonérées d'impôt ?",
    inputs: [
      {
        key: "totalDonations",
        label: "Total des dons (CHF)",
        type: "number",
        unit: "CHF",
        required: true,
      },
      {
        key: "netIncome",
        label: "Revenu net imposable estimé (CHF)",
        type: "number",
        unit: "CHF",
        required: true,
      },
    ],
    calculationType: "percentage_of_income",
    impact: "reduces_taxable_income",
    justificationRequired: true,
    riskLevel: "low",
    advisorMessage:
      "Déductibles à l'IFD si les dons atteignent au moins CHF 100 et dans la limite de 20 % du revenu net. L'institution doit être reconnue exonérée d'impôt. Reçus de don obligatoires.",
  },
  {
    id: "ifd_passive_interests",
    family: "financial_charges",
    category: "Intérêts",
    label: "Intérêts passifs",
    appliesTo: ["all"],
    userQuestion:
      "Payez-vous des intérêts sur des dettes (hypothèque, prêt privé, crédit) ?",
    inputs: [
      {
        key: "mortgageInterests",
        label: "Intérêts hypothécaires annuels (CHF)",
        type: "number",
        unit: "CHF",
        required: false,
      },
      {
        key: "otherDebtInterests",
        label: "Autres intérêts passifs (CHF)",
        type: "number",
        unit: "CHF",
        required: false,
      },
      {
        key: "assetIncome",
        label: "Rendement de la fortune (CHF)",
        type: "number",
        unit: "CHF",
        required: true,
      },
    ],
    calculationType: "actual_cost",
    impact: "reduces_taxable_income",
    justificationRequired: true,
    riskLevel: "medium",
    advisorMessage:
      "Les intérêts passifs sont déductibles à concurrence du rendement de la fortune augmenté de CHF 50 000. L'excédent n'est pas déductible à l'IFD. Relevé bancaire et contrats de prêt requis.",
  },
  {
    id: "ifd_real_estate_maintenance",
    family: "real_estate",
    category: "Immobilier",
    label: "Frais d'entretien immobilier",
    appliesTo: ["all"],
    userQuestion:
      "Êtes-vous propriétaire d'un bien immobilier et avez-vous engagé des frais d'entretien ou de rénovation ?",
    inputs: [
      {
        key: "maintenanceCosts",
        label: "Frais d'entretien réels (CHF)",
        type: "number",
        unit: "CHF",
        required: true,
      },
      {
        key: "rentalValue",
        label: "Valeur locative brute (CHF)",
        type: "number",
        unit: "CHF",
        required: true,
      },
      {
        key: "propertyType",
        label: "Type de bien",
        type: "select",
        options: ["residence_principale", "residence_secondaire", "bien_locatif"],
        required: true,
      },
    ],
    calculationType: "actual_vs_flat",
    impact: "reduces_taxable_income",
    justificationRequired: true,
    riskLevel: "medium",
    advisorMessage:
      "Choix entre forfait (10 % ou 20 % de la valeur locative selon l'âge du bâtiment) ou frais réels. Seuls les frais d'entretien (pas les travaux à plus-value) sont déductibles. Factures requises pour les frais réels.",
  },
  {
    id: "ifd_qualified_dividends",
    family: "special_tax_treatment",
    category: "Revenus de participations",
    label: "Dividendes de participation qualifiée (réduction pour participation)",
    appliesTo: ["self_employed", "all"],
    userQuestion:
      "Détenez-vous une participation d'au moins 10 % dans le capital d'une société de capitaux ou d'une société coopérative ?",
    inputs: [
      {
        key: "participationPercentage",
        label: "Pourcentage de participation (%)",
        type: "number",
        unit: "percent",
        required: true,
      },
      {
        key: "grossDividend",
        label: "Dividende brut perçu (CHF)",
        type: "number",
        unit: "CHF",
        required: true,
      },
      {
        key: "qualifiesAsBusinessAsset",
        label: "Participation constitue une fortune commerciale",
        type: "boolean",
        required: true,
      },
    ],
    calculationType: "special_rate",
    impact: "preferential_tax_rate",
    justificationRequired: true,
    riskLevel: "high",
    advisorMessage:
      "Les dividendes de participation qualifiée bénéficient d'une imposition réduite à l'IFD (réduction pour participation). Le dividende n'est pas une déduction ordinaire : il est imposé à un taux préférentiel. La participation doit représenter au moins 10 % du capital-actions ou avoir une valeur vénale d'au moins CHF 1 million. Analyse approfondie requise par un conseiller fiscal.",
  },
];
