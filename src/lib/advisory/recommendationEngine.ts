import { ADVISORY_THRESHOLDS, advisoryTemplates } from "./recommendationTemplates";

export type AdvisoryContext = {
  age: number;
  partnership: "Marriage" | "Single";
  childrenCount: number;
  totalIncome: number;
  totalWealth: number;
  hasRealEstate: boolean;
  realEstateRegime: "actuel" | "reforme" | null;
  taxGainVsBase: number | null;
  variantSpread: number | null;
  recommendedVariantLabel: string | null;
  recommendedVariantRegime: "actuel" | "reforme" | null;
  objectivePrincipal?: string | null;
  annualMargin?: number | null;
  totalTax?: number | null;
  hasRetirementObjective?: boolean;
  hasConjointProtectionObjective?: boolean;
  hasTransmissionObjective?: boolean;
  hasStructuringObjective?: boolean;
  hasTaxOptimizationObjective?: boolean;
};

export type AdvisoryBlockKey =
  | "recommendationLogic"
  | "actionPriorities"
  | "vigilancePoints"
  | "conclusion";

export type AdvisoryBlockItem = {
  key: string;
  title: string;
  text: string;
};

export type AdvisoryRuleActivation = {
  id: string;
  label: string;
  reason: string;
  effect: string;
};

type ConclusionTemplateKey =
  | "conclusion_affirmee"
  | "conclusion_prudente"
  | "conclusion_action"
  | "conclusion_long_terme"
  | "conclusion_familiale"
  | "conclusion_coherence_patrimoniale";

export type DynamicAdvisoryPreview = {
  blocks: {
    recommendationLogic: AdvisoryBlockItem[];
    actionPriorities: AdvisoryBlockItem[];
    vigilancePoints: AdvisoryBlockItem[];
    conclusion: AdvisoryBlockItem;
  };
  debug: {
    activatedRules: AdvisoryRuleActivation[];
    injectedBlocks: Array<{ block: AdvisoryBlockKey; key: string; title: string }>;
    selectedConclusion: {
      key: string;
      title: string;
      reason: string;
    };
    thresholds: typeof ADVISORY_THRESHOLDS;
    contextSummary: {
      age: number;
      partnership: "Marriage" | "Single";
      childrenCount: number;
      totalIncome: string;
      totalWealth: string;
      hasRealEstate: boolean;
      realEstateRegime: string;
      taxGainVsBase: string;
      variantSpread: string;
      recommendedVariantLabel: string;
      recommendedVariantRegime: string;
      objectivePrincipal: string;
    };
  };
};

function formatMoney(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "Indisponible";
  }

  return `${new Intl.NumberFormat("fr-CH", {
    maximumFractionDigits: 0,
  }).format(Math.round(value))} CHF`;
}

function pushUniqueBlock(
  items: AdvisoryBlockItem[],
  injectedBlocks: DynamicAdvisoryPreview["debug"]["injectedBlocks"],
  block: AdvisoryBlockKey,
  item: AdvisoryBlockItem
) {
  if (items.some((candidate) => candidate.key === item.key)) {
    return;
  }

  items.push(item);
  injectedBlocks.push({
    block,
    key: item.key,
    title: item.title,
  });
}

function addRule(
  activatedRules: AdvisoryRuleActivation[],
  id: string,
  label: string,
  reason: string,
  effect: string
) {
  activatedRules.push({
    id,
    label,
    reason,
    effect,
  });
}

export function buildDynamicAdvisoryPreview(context: AdvisoryContext): DynamicAdvisoryPreview {
  const blocks = {
    recommendationLogic: [] as AdvisoryBlockItem[],
    actionPriorities: [] as AdvisoryBlockItem[],
    vigilancePoints: [] as AdvisoryBlockItem[],
    conclusion: {
      key: "conclusion_action",
      ...advisoryTemplates.conclusions.conclusion_action,
    } as AdvisoryBlockItem,
  };
  const activatedRules: AdvisoryRuleActivation[] = [];
  const injectedBlocks: DynamicAdvisoryPreview["debug"]["injectedBlocks"] = [];

  const isMarried = context.partnership === "Marriage";
  const hasChildren = context.childrenCount > 0;
  const hasHighIncome = context.totalIncome >= ADVISORY_THRESHOLDS.highIncome;
  const hasHighWealth = context.totalWealth >= ADVISORY_THRESHOLDS.highWealth;
  const isSenior = context.age >= ADVISORY_THRESHOLDS.seniorAge;
  const hasStrongGain =
    typeof context.taxGainVsBase === "number" &&
    context.taxGainVsBase >= ADVISORY_THRESHOLDS.strongGain;
  const hasLowGain =
    typeof context.taxGainVsBase === "number" &&
    context.taxGainVsBase <= ADVISORY_THRESHOLDS.lowGain;
  const hasLargeVariantGap =
    typeof context.variantSpread === "number" &&
    context.variantSpread >= ADVISORY_THRESHOLDS.largeVariantGap;
  const hasSmallVariantGap =
    typeof context.variantSpread === "number" &&
    context.variantSpread <= ADVISORY_THRESHOLDS.smallVariantGap;
  const hasLongTermFocus = isSenior || Boolean(context.hasRetirementObjective);
  const needsTaxOptimization = hasHighIncome || Boolean(context.hasTaxOptimizationObjective);
  const needsStructuring = hasHighWealth || Boolean(context.hasStructuringObjective);
  const needsFamilyProtection =
    isMarried || Boolean(context.hasConjointProtectionObjective) || hasChildren;
  const needsTransmission = hasChildren || Boolean(context.hasTransmissionObjective);

  if (isMarried && hasChildren) {
    addRule(
      activatedRules,
      "logic-couple-with-children",
      "Logique familiale renforcée",
      `Partnership = Marriage et NumChildren = ${context.childrenCount}.`,
      "Injection du texte Couple avec enfants."
    );
    pushUniqueBlock(blocks.recommendationLogic, injectedBlocks, "recommendationLogic", {
      key: "coupleWithChildren",
      ...advisoryTemplates.recommendationLogic.coupleWithChildren,
    });
  } else if (isMarried) {
    addRule(
      activatedRules,
      "logic-couple",
      "Logique couple",
      "Partnership = Marriage sans enfant à charge détecté.",
      "Injection du texte Couple sans enfant."
    );
    pushUniqueBlock(blocks.recommendationLogic, injectedBlocks, "recommendationLogic", {
      key: "coupleWithoutChildren",
      ...advisoryTemplates.recommendationLogic.coupleWithoutChildren,
    });
  } else {
    addRule(
      activatedRules,
      "logic-individual",
      "Logique individuelle",
      "Aucune logique couple activée.",
      "Injection du texte générique de situation individuelle."
    );
    pushUniqueBlock(blocks.recommendationLogic, injectedBlocks, "recommendationLogic", {
      key: "individualBase",
      ...advisoryTemplates.recommendationLogic.individualBase,
    });
  }

  if (hasHighIncome) {
    addRule(
      activatedRules,
      "logic-high-income",
      "Revenu élevé",
      `Revenu total ${formatMoney(context.totalIncome)} >= seuil ${formatMoney(
        ADVISORY_THRESHOLDS.highIncome
      )}.`,
      "Ajout du bloc Revenu élevé."
    );
    pushUniqueBlock(blocks.recommendationLogic, injectedBlocks, "recommendationLogic", {
      key: "highIncome",
      ...advisoryTemplates.recommendationLogic.highIncome,
    });
  }

  if (hasHighWealth) {
    addRule(
      activatedRules,
      "logic-high-wealth",
      "Fortune élevée",
      `Fortune brute ${formatMoney(context.totalWealth)} >= seuil ${formatMoney(
        ADVISORY_THRESHOLDS.highWealth
      )}.`,
      "Ajout du bloc Fortune élevée."
    );
    pushUniqueBlock(blocks.recommendationLogic, injectedBlocks, "recommendationLogic", {
      key: "highWealth",
      ...advisoryTemplates.recommendationLogic.highWealth,
    });
  }

  if (context.hasRealEstate) {
    addRule(
      activatedRules,
      "logic-real-estate",
      "Présence immobilière",
      `Présence immobilière détectée avec régime ${context.realEstateRegime ?? "non renseigné"}.`,
      "Ajout du bloc Présence immobilière."
    );
    pushUniqueBlock(blocks.recommendationLogic, injectedBlocks, "recommendationLogic", {
      key: "realEstate",
      ...advisoryTemplates.recommendationLogic.realEstate,
    });
  }

  if (hasLargeVariantGap) {
    addRule(
      activatedRules,
      "logic-large-gap",
      "Écart important entre variantes",
      `Écart global entre variantes = ${formatMoney(context.variantSpread)}.`,
      "Ajout du bloc Écart important entre variantes."
    );
    pushUniqueBlock(blocks.recommendationLogic, injectedBlocks, "recommendationLogic", {
      key: "largeGap",
      ...advisoryTemplates.recommendationLogic.largeGap,
    });
  } else if (hasSmallVariantGap) {
    addRule(
      activatedRules,
      "logic-small-gap",
      "Écart faible entre variantes",
      `Écart global entre variantes = ${formatMoney(context.variantSpread)}.`,
      "Ajout du bloc Écart faible entre variantes."
    );
    pushUniqueBlock(blocks.recommendationLogic, injectedBlocks, "recommendationLogic", {
      key: "smallGap",
      ...advisoryTemplates.recommendationLogic.smallGap,
    });
  }

  if (hasLongTermFocus) {
    addRule(
      activatedRules,
      "logic-long-term",
      "Vision long terme",
      `Âge ${context.age} ans${context.hasRetirementObjective ? " avec objectif retraite activé" : ""}.`,
      "Ajout du bloc Vision long terme."
    );
    pushUniqueBlock(blocks.recommendationLogic, injectedBlocks, "recommendationLogic", {
      key: "longTerm",
      ...advisoryTemplates.recommendationLogic.longTerm,
    });
  }

  if (needsFamilyProtection) {
    addRule(
      activatedRules,
      "priority-spouse-protection",
      "Priorité protection du conjoint",
      isMarried
        ? "Le dossier comporte une logique couple."
        : "Un besoin explicite de protection du conjoint a été détecté.",
      "Ajout de la priorité Protection du conjoint."
    );
    pushUniqueBlock(blocks.actionPriorities, injectedBlocks, "actionPriorities", {
      key: "spouseProtection",
      ...advisoryTemplates.actionPriorities.spouseProtection,
    });
  }

  if (needsTaxOptimization || hasStrongGain || context.hasRealEstate) {
    addRule(
      activatedRules,
      "priority-tax-optimization",
      "Priorité optimisation fiscale",
      hasStrongGain
        ? `Gain fiscal estimé = ${formatMoney(context.taxGainVsBase)}.`
        : "Le dossier présente un enjeu d'optimisation fiscale activable.",
      "Ajout de la priorité Optimisation fiscale."
    );
    pushUniqueBlock(blocks.actionPriorities, injectedBlocks, "actionPriorities", {
      key: "taxOptimization",
      ...advisoryTemplates.actionPriorities.taxOptimization,
    });
  }

  if (needsStructuring) {
    addRule(
      activatedRules,
      "priority-structuring",
      "Priorité structuration patrimoniale",
      `Le dossier requiert une meilleure gouvernance du patrimoine (${formatMoney(
        context.totalWealth
      )}).`,
      "Ajout de la priorité Structuration patrimoniale."
    );
    pushUniqueBlock(blocks.actionPriorities, injectedBlocks, "actionPriorities", {
      key: "patrimonialStructuring",
      ...advisoryTemplates.actionPriorities.patrimonialStructuring,
    });
  }

  if (needsTransmission) {
    addRule(
      activatedRules,
      "priority-family-transmission",
      "Priorité prévoyance et transmission",
      hasChildren
        ? `NumChildren = ${context.childrenCount}.`
        : "Un objectif de transmission patrimoniale est actif.",
      "Ajout de la priorité Prévoyance et transmission."
    );
    pushUniqueBlock(blocks.actionPriorities, injectedBlocks, "actionPriorities", {
      key: "familyTransmission",
      ...advisoryTemplates.actionPriorities.familyTransmission,
    });
  }

  addRule(
    activatedRules,
    "priority-follow-up",
    "Priorité suivi patrimonial",
    "Le suivi reste nécessaire quel que soit le scénario retenu.",
    "Ajout systématique de la priorité Suivi patrimonial."
  );
  pushUniqueBlock(blocks.actionPriorities, injectedBlocks, "actionPriorities", {
    key: "followUp",
    ...advisoryTemplates.actionPriorities.followUp,
  });

  if (
    needsTaxOptimization ||
    hasStrongGain ||
    (typeof context.totalTax === "number" && context.totalTax > 20000)
  ) {
    addRule(
      activatedRules,
      "vigilance-tax-pressure",
      "Vigilance pression fiscale",
      `Le niveau d'impôt ou le gain visé justifie une vigilance sur la pression fiscale (${formatMoney(
        context.totalTax
      )}).`,
      "Ajout du point de vigilance Pression fiscale."
    );
    pushUniqueBlock(blocks.vigilancePoints, injectedBlocks, "vigilancePoints", {
      key: "taxPressure",
      ...advisoryTemplates.vigilancePoints.taxPressure,
    });
  }

  if (
    needsStructuring ||
    context.hasRealEstate ||
    (typeof context.annualMargin === "number" && context.annualMargin < 0)
  ) {
    addRule(
      activatedRules,
      "vigilance-inconsistencies",
      "Vigilance incohérences patrimoniales",
      typeof context.annualMargin === "number" && context.annualMargin < 0
        ? "La marge annuelle est négative ou sous tension."
        : "Le dossier combine patrimoine significatif ou composante immobilière.",
      "Ajout du point de vigilance Incohérences patrimoniales."
    );
    pushUniqueBlock(blocks.vigilancePoints, injectedBlocks, "vigilancePoints", {
      key: "patrimonialInconsistencies",
      ...advisoryTemplates.vigilancePoints.patrimonialInconsistencies,
    });
  }

  if (isMarried || hasChildren || context.hasRealEstate || needsStructuring) {
    addRule(
      activatedRules,
      "vigilance-coordination",
      "Vigilance coordination des décisions",
      "Le dossier mobilise plusieurs dimensions à coordonner (famille, immobilier, patrimoine ou fiscalité).",
      "Ajout du point de vigilance Coordination des décisions."
    );
    pushUniqueBlock(blocks.vigilancePoints, injectedBlocks, "vigilancePoints", {
      key: "coordination",
      ...advisoryTemplates.vigilancePoints.coordination,
    });
  }

  if (hasLongTermFocus || needsTransmission) {
    addRule(
      activatedRules,
      "vigilance-long-term",
      "Vigilance vision long terme",
      "La stratégie doit être pilotée dans une perspective de retraite, de transmission ou de stabilité durable.",
      "Ajout du point de vigilance Vision long terme."
    );
    pushUniqueBlock(blocks.vigilancePoints, injectedBlocks, "vigilancePoints", {
      key: "longTerm",
      ...advisoryTemplates.vigilancePoints.longTerm,
    });
  }

  const conclusionParagraphs: AdvisoryBlockItem[] = [];
  const pushConclusionParagraph = (key: ConclusionTemplateKey) => {
    const template = advisoryTemplates.conclusions[key];

    if (conclusionParagraphs.some((item) => item.key === key)) {
      return;
    }

    conclusionParagraphs.push({
      key,
      title: template.title,
      text: template.text,
    });
  };

  let selectedConclusion: DynamicAdvisoryPreview["debug"]["selectedConclusion"] = {
    key: "conclusion_action",
    title: advisoryTemplates.conclusions.conclusion_action.title,
    reason: "Conclusion orientée action retenue par défaut.",
  };

  if (hasStrongGain) {
    selectedConclusion = {
      key: "conclusion_affirmee",
      title: advisoryTemplates.conclusions.conclusion_affirmee.title,
      reason: `Gain fiscal estimé ${formatMoney(context.taxGainVsBase)} >= seuil ${formatMoney(
        ADVISORY_THRESHOLDS.strongGain
      )}.`,
    };
    pushConclusionParagraph("conclusion_affirmee");
  } else if (hasLowGain) {
    selectedConclusion = {
      key: "conclusion_prudente",
      title: advisoryTemplates.conclusions.conclusion_prudente.title,
      reason: `Gain fiscal estimé ${formatMoney(context.taxGainVsBase)} <= seuil ${formatMoney(
        ADVISORY_THRESHOLDS.lowGain
      )}.`,
    };
    pushConclusionParagraph("conclusion_prudente");
  } else {
    pushConclusionParagraph("conclusion_action");
  }

  if (hasLongTermFocus || hasHighWealth || isSenior) {
    addRule(
      activatedRules,
      "conclusion-long-term",
      "Conclusion long terme",
      `Âge ${context.age} ans, fortune ${formatMoney(context.totalWealth)} ou objectif retraite actif.`,
      "Ajout d'un paragraphe de conclusion orienté long terme."
    );
    pushConclusionParagraph("conclusion_long_terme");
  }

  if (hasChildren) {
    addRule(
      activatedRules,
      "conclusion-family",
      "Conclusion familiale",
      `NumChildren = ${context.childrenCount}.`,
      "Ajout d'un paragraphe de conclusion familiale."
    );
    pushConclusionParagraph("conclusion_familiale");
  }

  if (context.hasRealEstate) {
    addRule(
      activatedRules,
      "conclusion-real-estate-coherence",
      "Cohérence patrimoniale immobilière",
      `Présence immobilière détectée avec régime ${context.realEstateRegime ?? "non renseigné"}.`,
      "Ajout d'un paragraphe de cohérence patrimoniale."
    );
    pushConclusionParagraph("conclusion_coherence_patrimoniale");
  }

  blocks.conclusion = {
    key: selectedConclusion.key,
    title: selectedConclusion.title,
    text: conclusionParagraphs.map((paragraph) => paragraph.text).join("\n\n"),
  };

  injectedBlocks.push({
    block: "conclusion",
    key: blocks.conclusion.key,
    title: blocks.conclusion.title,
  });

  return {
    blocks,
    debug: {
      activatedRules,
      injectedBlocks,
      selectedConclusion,
      thresholds: ADVISORY_THRESHOLDS,
      contextSummary: {
        age: context.age,
        partnership: context.partnership,
        childrenCount: context.childrenCount,
        totalIncome: formatMoney(context.totalIncome),
        totalWealth: formatMoney(context.totalWealth),
        hasRealEstate: context.hasRealEstate,
        realEstateRegime: context.realEstateRegime ?? "Non renseigné",
        taxGainVsBase: formatMoney(context.taxGainVsBase),
        variantSpread: formatMoney(context.variantSpread),
        recommendedVariantLabel: context.recommendedVariantLabel ?? "À confirmer",
        recommendedVariantRegime: context.recommendedVariantRegime ?? "Non renseigné",
        objectivePrincipal: context.objectivePrincipal ?? "Non renseigné",
      },
    },
  };
}
