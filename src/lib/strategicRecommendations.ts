import type { DossierClient } from "../types";

export type StrategicRecommendation = {
  key: string;
  theme: "fiscalite" | "fortune" | "retraite" | "famille";
  title: string;
  priority: "haute" | "moyenne" | "veille";
  diagnostic: string;
  enjeu: string;
  recommendation: string;
  expectedResult: string;
  isActive: (context: StrategicRecommendationContext) => boolean;
};

export type StrategicRecommendationContext = {
  dossier: DossierClient;
  totalRevenus: number;
  fortuneBrute: number;
  impotsEstimes: number;
  troisiemePilierSimule: number;
  rachatLpp: number;
  age: number;
  isMarried: boolean;
};

export type AdvisoryToneProfile =
  | "client fortune"
  | "client prudent"
  | "client entrepreneur"
  | "couple"
  | "celibataire";

const priorityWeight: Record<StrategicRecommendation["priority"], number> = {
  haute: 3,
  moyenne: 2,
  veille: 1,
};

export const strategicRecommendationLibrary: StrategicRecommendation[] = [
  {
    key: "opt_fiscale",
    theme: "fiscalite",
    title: "Optimisation fiscale",
    priority: "haute",
    diagnostic:
      "La charge fiscale demeure significative au regard du revenu disponible et du niveau de patrimoine.",
    enjeu:
      "Conserver davantage de capacite d epargne et de flexibilite financiere sans desequilibrer la structure patrimoniale.",
    recommendation:
      "Activer de facon methodique les leviers de prevoyance et les arbitrages patrimoniaux qui reduisent durablement l impot.",
    expectedResult:
      "Une baisse mesurable de la pression fiscale et une meilleure maitrise du revenu net disponible.",
    isActive: (context) =>
      context.impotsEstimes >= 15000 ||
      context.dossier.objectifs.reduireImpots ||
      context.totalRevenus >= 120000,
  },
  {
    key: "troisieme_pilier",
    theme: "fiscalite",
    title: "Renforcement du 3e pilier",
    priority: "haute",
    diagnostic:
      "Le 3e pilier n est pas encore exploite au maximum ou reste insuffisamment mobilise dans le scenario actif.",
    enjeu:
      "Profiter d un levier simple de reduction d impot tout en renforcant le capital de prevoyance privee.",
    recommendation:
      "Augmenter progressivement les versements 3e pilier et les calibrer en fonction de la marge fiscale et de tresorerie.",
    expectedResult:
      "Une prevoyance privee plus solide et une optimisation fiscale recurrente.",
    isActive: (context) => context.troisiemePilierSimule <= 0,
  },
  {
    key: "rachat_lpp",
    theme: "retraite",
    title: "Rachat LPP cible",
    priority: "haute",
    diagnostic:
      "Le potentiel de rachat LPP peut constituer un levier puissant si la liquidite patrimoniale le permet.",
    enjeu:
      "Renforcer la retraite tout en arbitrant correctement l usage des liquidites disponibles.",
    recommendation:
      "Etudier un plan de rachats LPP fractionnes pour optimiser le gain fiscal et lisser l effort de financement.",
    expectedResult:
      "Une retraite mieux financee et une efficacite fiscale accrue sur plusieurs exercices.",
    isActive: (context) =>
      context.rachatLpp <= 0 && (context.fortuneBrute >= 750000 || context.age >= 55),
  },
  {
    key: "pre_retraite",
    theme: "retraite",
    title: "Preparation de la retraite",
    priority: "haute",
    diagnostic:
      "Le dossier entre dans une phase ou les decisions de prevoyance et de decaissement deviennent structurantes.",
    enjeu:
      "Coordonner retraite, fiscalite, liquidite et protection du conjoint sur les prochaines annees.",
    recommendation:
      "Construire un scenario retraite integre en tenant compte des rentes, du patrimoine mobilisable et de l effort fiscal.",
    expectedResult:
      "Une meilleure visibilite sur le revenu futur et des arbitrages patrimoniaux plus sereins.",
    isActive: (context) => context.age >= 55,
  },
  {
    key: "patrimoine",
    theme: "fortune",
    title: "Structuration de la fortune",
    priority: "moyenne",
    diagnostic:
      "Le patrimoine atteint un niveau qui justifie une architecture plus intentionnelle entre liquidite, rendement et protection.",
    enjeu:
      "Eviter une lecture fragmentee du patrimoine et mieux coordonner la fiscalite avec les objectifs de long terme.",
    recommendation:
      "Formaliser une allocation cible entre liquidites, titres, immobilier et prevoyance afin de mieux piloter le risque global.",
    expectedResult:
      "Un patrimoine plus lisible, plus robuste et plus facile a faire evoluer.",
    isActive: (context) => context.fortuneBrute >= 1000000,
  },
  {
    key: "conjoint",
    theme: "famille",
    title: "Protection du conjoint",
    priority: "moyenne",
    diagnostic:
      "La situation familiale demande une lecture coordonnee des decisions fiscales, patrimoniales et successorales.",
    enjeu:
      "Limiter les angles morts en cas d alea de vie et garantir une continuité de niveau de vie.",
    recommendation:
      "Verifier la coherence entre prevoyance, detentions patrimoniales et objectifs de protection du conjoint.",
    expectedResult:
      "Une meilleure securite familiale et une strategie patrimoniale plus coherente a deux.",
    isActive: (context) => context.isMarried || context.dossier.objectifs.protegerConjoint,
  },
  {
    key: "transmission",
    theme: "fortune",
    title: "Anticipation de la transmission",
    priority: "veille",
    diagnostic:
      "Le patrimoine et l age du client justifient de preparer les prochaines etapes plutot que d attendre un besoin urgent.",
    enjeu:
      "Conserver de la souplesse pour transmettre dans de bonnes conditions patrimoniales et familiales.",
    recommendation:
      "Commencer a cadrer une logique de transmission et de gouvernance patrimoniale en amont des decisions futures.",
    expectedResult:
      "Une trajectoire de transmission plus fluide et moins subie.",
    isActive: (context) =>
      context.fortuneBrute >= 1000000 || context.age >= 60 || context.dossier.objectifs.transmettre,
  },
];

export function getClientProfiles(context: StrategicRecommendationContext): string[] {
  const profiles: string[] = [];

  if (context.age < 55) profiles.push("Phase d accumulation");
  if (context.age >= 55 && context.age < 65) profiles.push("Pre-retraite");
  if (context.age >= 65) profiles.push("Retraite / decaissement");
  if (context.impotsEstimes >= 15000 || context.totalRevenus >= 120000) {
    profiles.push("Forte charge fiscale");
  }
  if (context.fortuneBrute >= 1000000) profiles.push("Patrimoine eleve");
  if (profiles.length === 0) profiles.push("Structuration progressive");

  return profiles;
}

export function getStrategicRecommendations(context: StrategicRecommendationContext) {
  return strategicRecommendationLibrary
    .filter((recommendation) => recommendation.isActive(context))
    .sort((left, right) => priorityWeight[right.priority] - priorityWeight[left.priority]);
}

export function getStrategicRecommendationsByTheme(
  context: StrategicRecommendationContext,
  theme: StrategicRecommendation["theme"]
) {
  return getStrategicRecommendations(context).filter(
    (recommendation) => recommendation.theme === theme
  );
}

export function getAdvisoryToneProfile(
  context: StrategicRecommendationContext
): AdvisoryToneProfile {
  if (context.fortuneBrute >= 1500000) return "client fortune";
  if (context.totalRevenus >= 180000 || context.impotsEstimes >= 25000) {
    return "client entrepreneur";
  }
  if (context.isMarried) return "couple";
  if (context.totalRevenus <= 100000 && context.impotsEstimes <= 15000) {
    return "client prudent";
  }
  return "celibataire";
}

export function getToneSummaryIntro(profile: AdvisoryToneProfile) {
  switch (profile) {
    case "client fortune":
      return "Le rapport privilegie une lecture strategique, elegante et structuree du patrimoine global.";
    case "client prudent":
      return "Le rapport adopte une lecture rassurante, progressive et pedagogique des decisions a prendre.";
    case "client entrepreneur":
      return "Le rapport retient une approche directe, orientee performance, efficacite et arbitrage rapide.";
    case "couple":
      return "Le rapport s inscrit dans une logique de coordination patrimoniale et de protection du conjoint.";
    case "celibataire":
      return "Le rapport privilegie une logique d optimisation individuelle, souple et evolutive.";
  }
}

export function getToneRecommendationIntro(profile: AdvisoryToneProfile) {
  switch (profile) {
    case "client fortune":
      return "Axes de conseil privilegies pour structurer le patrimoine avec exigence et visibilite.";
    case "client prudent":
      return "Actions recommandees dans une logique de clarte, de securite et de progression maitrisee.";
    case "client entrepreneur":
      return "Leviers prioritaires selectionnes pour maximiser l efficacite fiscale et patrimoniale.";
    case "couple":
      return "Recommandations formulees pour renforcer la coherence du couple et la protection croisee.";
    case "celibataire":
      return "Pistes retenues pour gagner en flexibilite personnelle et en efficacite patrimoniale.";
  }
}

export function toneRecommendationText(
  profile: AdvisoryToneProfile,
  text: string
) {
  switch (profile) {
    case "client fortune":
      return `Dans une logique de structuration patrimoniale haut de gamme, ${text.toLowerCase()}`;
    case "client prudent":
      return `De maniere progressive et rassurante, ${text.toLowerCase()}`;
    case "client entrepreneur":
      return `Le levier le plus efficient consiste a ${text.toLowerCase()}`;
    case "couple":
      return `A l echelle du couple, il convient de ${text.toLowerCase()}`;
    case "celibataire":
      return `A titre individuel, il est pertinent de ${text.toLowerCase()}`;
  }
}

export function getToneConclusion(profile: AdvisoryToneProfile) {
  switch (profile) {
    case "client fortune":
      return "La priorite consiste a consolider une architecture patrimoniale lisible, selective et durable, afin de proteger le capital tout en preservant les marges d arbitrage futures.";
    case "client prudent":
      return "La trajectoire recommandee reste volontairement mesuree : securiser les fondations, avancer par etapes et renforcer la serenite de decision.";
    case "client entrepreneur":
      return "La ligne directrice consiste a concentrer les efforts sur les leviers les plus rentables, avec une execution claire et des arbitrages rapides.";
    case "couple":
      return "La conclusion privilegie une strategie coordonnee, orientee protection mutuelle, lisibilite des roles et robustesse du patrimoine familial.";
    case "celibataire":
      return "La conclusion met l accent sur une optimisation personnelle agile, capable de conserver souplesse, efficacite fiscale et liberte de mouvement.";
  }
}
