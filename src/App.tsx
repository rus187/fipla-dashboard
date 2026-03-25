import { useEffect, useEffectEvent, useRef, useState, type ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import "./App.css";
import ReportSection from "./ReportSection";
import { emptyDossier } from "./mockDossier";
import type { DossierClient } from "./types";
import zipToFiscal from "./data/geography/zip-to-fiscal.json";
import { generatePremiumPdf } from "./lib/pdf/generatePremiumPdf";
import { buildTaxwarePayload } from "./lib/taxware/buildTaxwarePayload";
import { callTaxware } from "./lib/taxware/callTaxware";
import { getComparisonScenarios } from "./lib/multicriteriaComparison";
import {
  getAdvisoryToneProfile,
  getClientProfiles,
  getStrategicRecommendations,
  getStrategicRecommendationsByTheme,
  getToneConclusion,
  getToneRecommendationIntro,
  getToneSummaryIntro,
  toneRecommendationText,
} from "./lib/strategicRecommendations";
import CollapsibleHelp from "./components/CollapsibleHelp";
import DecisionIntro, { type AnalysisMode } from "./components/DecisionIntro";
import SituationEntryScreen from "./components/SituationEntryScreen";
import { buildDynamicAdvisoryPreview } from "./lib/advisory/recommendationEngine";

declare const process:
  | {
      env?: {
        NODE_ENV?: string;
      };
    }
  | undefined;

type ZipFiscalRow = {
  zip: string;
  locality: string;
  localityCanton?: string;
  ofs?: number | null;
  fiscalCommune?: string | null;
  fiscalCanton?: string | null;
};

type ScenarioVariant = {
  id: string;
  label: string;
  customLabel: string;
  dossier: DossierClient;
  taxResult: any;
  taxResultSansOptimisation: any;
  taxResultAvecDeductionsEstime: any;
  taxResultAjustementManuel: any;
  taxResultCorrectionFiscaleManuelle: any;
  comparisonTaxResults: Record<string, any>;
  isLinkedToVariant1: boolean;
};

const MAX_VARIANTS = 7;
const INTRO_SECTION_ID = "intro";

function hasSeparatedFiscalManualCorrections(fiscalite: DossierClient["fiscalite"]) {
  return (
    (fiscalite.correctionFiscaleManuelleIfd || 0) !== 0 ||
    (fiscalite.correctionFiscaleManuelleCanton || 0) !== 0 ||
    (fiscalite.correctionFiscaleManuelleFortune || 0) !== 0
  );
}

function sumFiniteNumbers(...values: Array<number | null | undefined>) {
  const validValues = values.filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value)
  );

  if (validValues.length === 0) {
    return null;
  }

  return validValues.reduce((total, value) => total + value, 0);
}

function roundCurrencyValue(value: number | null | undefined) {
  return Math.round(typeof value === "number" && Number.isFinite(value) ? value : 0);
}

function getRecordValueByPath(source: Record<string, any> | null | undefined, path: string) {
  if (!source) {
    return undefined;
  }

  return path.split(".").reduce<any>((current, key) => {
    if (current && typeof current === "object" && key in current) {
      return current[key];
    }
    return undefined;
  }, source);
}

function getNumberFromUnknown(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value
      .replace(/\s/g, "")
      .replace(/'/g, "")
      .replace(/CHF/gi, "")
      .replace(",", ".");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function getFirstNumberByPaths(
  source: Record<string, any> | null | undefined,
  paths: string[]
): number | null {
  for (const path of paths) {
    const value = getNumberFromUnknown(getRecordValueByPath(source, path));
    if (value !== null) {
      return value;
    }
  }

  return null;
}

function getFirstDefinedValueByPaths(
  source: Record<string, any> | null | undefined,
  paths: string[]
): unknown {
  for (const path of paths) {
    const value = getRecordValueByPath(source, path);
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }

  return null;
}

function composeCorrectedTaxwareResult(params: {
  baseResult: any;
  ifdResult: any;
  cantonResult: any;
  fortuneResult: any;
  debug?: Record<string, unknown>;
}) {
  const { baseResult, ifdResult, cantonResult, fortuneResult, debug } = params;
  const baseNormalized = baseResult?.normalized ?? {};
  const ifdNormalized = ifdResult?.normalized ?? baseNormalized;
  const cantonNormalized = cantonResult?.normalized ?? baseNormalized;
  const fortuneNormalized = fortuneResult?.normalized ?? baseNormalized;

  const federalTax =
    typeof ifdNormalized.federalTax === "number"
      ? ifdNormalized.federalTax
      : baseNormalized.federalTax ?? null;
  const cantonalTax =
    typeof cantonNormalized.cantonalTax === "number"
      ? cantonNormalized.cantonalTax
      : baseNormalized.cantonalTax ?? null;
  const communalTax =
    typeof cantonNormalized.communalTax === "number"
      ? cantonNormalized.communalTax
      : baseNormalized.communalTax ?? null;
  const cantonalCommunalTax =
    typeof cantonNormalized.cantonalCommunalTax === "number"
      ? cantonNormalized.cantonalCommunalTax
      : sumFiniteNumbers(cantonalTax, communalTax) ?? baseNormalized.cantonalCommunalTax ?? null;
  const wealthTax =
    typeof fortuneNormalized.wealthTax === "number"
      ? fortuneNormalized.wealthTax
      : baseNormalized.wealthTax ?? null;

  return {
    raw: {
      baseline: baseResult?.raw ?? null,
      correctionIfd: ifdResult?.raw ?? null,
      correctionCanton: cantonResult?.raw ?? null,
      correctionFortune: fortuneResult?.raw ?? null,
      debug: debug ?? {},
    },
    normalized: {
      ...baseNormalized,
      taxableIncomeFederal:
        typeof ifdNormalized.taxableIncomeFederal === "number"
          ? ifdNormalized.taxableIncomeFederal
          : baseNormalized.taxableIncomeFederal ?? null,
      taxableIncomeCantonal:
        typeof cantonNormalized.taxableIncomeCantonal === "number"
          ? cantonNormalized.taxableIncomeCantonal
          : baseNormalized.taxableIncomeCantonal ?? null,
      taxableAssets:
        typeof fortuneNormalized.taxableAssets === "number"
          ? fortuneNormalized.taxableAssets
          : baseNormalized.taxableAssets ?? null,
      federalTax,
      cantonalTax,
      communalTax,
      cantonalCommunalTax,
      wealthTax,
      totalTax:
        sumFiniteNumbers(federalTax, cantonalCommunalTax, wealthTax) ??
        baseNormalized.totalTax ??
        null,
    },
  };
}

function cloneDossier(source: DossierClient): DossierClient {
  return JSON.parse(JSON.stringify(source));
}

function cloneValue<T>(source: T): T {
  return JSON.parse(JSON.stringify(source));
}

function roundScore(value: number) {
  return Math.round(value * 10) / 10;
}

function normalizeDescending(value: number, min: number, max: number) {
  if (max <= min) return 100;
  return ((max - value) / (max - min)) * 100;
}

function normalizeAscending(value: number, min: number, max: number) {
  if (max <= min) return 100;
  return ((value - min) / (max - min)) * 100;
}

function getExtrema(values: number[]) {
  return {
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

function cloneVariantStateFromBase(
  baseVariant: ScenarioVariant,
  targetVariant: ScenarioVariant,
  keepLinkToVariant1: boolean
): ScenarioVariant {
  return {
    ...targetVariant,
    dossier: cloneDossier(baseVariant.dossier),
    taxResult: cloneValue(baseVariant.taxResult),
    taxResultSansOptimisation: cloneValue(baseVariant.taxResultSansOptimisation),
    taxResultAvecDeductionsEstime: cloneValue(baseVariant.taxResultAvecDeductionsEstime),
    taxResultAjustementManuel: cloneValue(baseVariant.taxResultAjustementManuel),
    taxResultCorrectionFiscaleManuelle: cloneValue(
      baseVariant.taxResultCorrectionFiscaleManuelle
    ),
    comparisonTaxResults: cloneValue(baseVariant.comparisonTaxResults),
    isLinkedToVariant1: keepLinkToVariant1,
  };
}

function createEmptyVariant(index: number): ScenarioVariant {
  return {
    id: `variant-${index + 1}`,
    label: index === 0 ? "Base" : `Variante ${index}`,
    customLabel: "",
    dossier: cloneDossier(emptyDossier),
    taxResult: null,
    taxResultSansOptimisation: null,
    taxResultAvecDeductionsEstime: null,
    taxResultAjustementManuel: null,
    taxResultCorrectionFiscaleManuelle: null,
    comparisonTaxResults: {},
    isLinkedToVariant1: false,
  };
}

function createInitialVariants(): ScenarioVariant[] {
  return [createEmptyVariant(0)];
}

function getTaxwareLocationForDossier(dossier: DossierClient) {
  return {
    city:
      (dossier.identite.taxwareCity || "").trim() ||
      (dossier.identite.communeFiscale || "").trim() ||
      (dossier.identite.commune || "").trim(),
    zip: (dossier.identite.taxwareZip || "").trim() || (dossier.identite.npa || "").trim(),
  };
}

function isDossierReadyForTaxSimulation(dossier: DossierClient) {
  const location = getTaxwareLocationForDossier(dossier);
  return location.zip.length > 0 && location.city.length > 0;
}

function getSimulationImmobilierDelta(dossier: DossierClient) {
  const habitationPropreActive = Boolean(dossier.immobilier.proprietaireOccupant);
  const regimeImmobilierActuel = dossier.immobilier.regimeFiscal === "actuel";

  const valeurLocativeActuelleHabitation = habitationPropreActive
    ? dossier.immobilier.valeurLocativeHabitationPropre || 0
    : 0;

  const interetsHabitationActuels = habitationPropreActive
    ? dossier.immobilier.interetsHypothecairesHabitationPropre || 0
    : 0;

  const fraisHabitationActuels = habitationPropreActive
    ? dossier.immobilier.fraisEntretienHabitationPropre || 0
    : 0;

  const variationValeurLocativeSimulation = regimeImmobilierActuel
    ? 0
    : -valeurLocativeActuelleHabitation;

  const variationInteretsHypothecairesSimulation = regimeImmobilierActuel
    ? 0
    : interetsHabitationActuels;

  const variationFraisEntretienSimulation = regimeImmobilierActuel
    ? 0
    : fraisHabitationActuels;

  return (
    variationValeurLocativeSimulation +
    variationInteretsHypothecairesSimulation +
    variationFraisEntretienSimulation
  );
}

function normalizeVariantLabels(variants: ScenarioVariant[]) {
  return variants.map((variant, index) => ({
    ...variant,
    label: index === 0 ? "Base" : `Variante ${index}`,
  }));
}

function getVariantUserLabel(variant: ScenarioVariant) {
  return variant.customLabel.trim();
}

function getVariantDisplayLabel(variant: ScenarioVariant) {
  const userLabel = getVariantUserLabel(variant);
  return userLabel ? `${variant.label} - ${userLabel}` : variant.label;
}

const sectionHelpTexts = {
  identite: [
    "Ce bloc sert a decrire la situation personnelle du client.",
    "Renseignez le prenom, le nom, l age, le NPA, l etat civil et le nombre d enfants.",
    "La commune et le canton sont completes automatiquement a partir du NPA.",
  ],
  revenus: [
    "Ce bloc sert a saisir les revenus annuels utilises dans l analyse.",
    "Renseignez le salaire, l AVS, la LPP et les autres revenus si le client en a.",
    "Le total des revenus est calcule automatiquement.",
  ],
  fortune: [
    "Ce bloc sert a decrire le patrimoine du client.",
    "Renseignez les liquidites, les titres, le 3e pilier, la fortune LPP actuelle et l immobilier.",
    "Les montants de fortune brute, fortune fiscale et liquidites apres mouvements sont calcules automatiquement.",
  ],
  dettes: [
    "Ce bloc sert a renseigner les engagements financiers du client.",
    "Saisissez les hypotheques et les autres dettes connues.",
    "Le total des dettes est calcule automatiquement.",
  ],
  syntheseFortune: [
    "Ce bloc donne une lecture rapide de la situation patrimoniale.",
    "Aucune saisie supplementaire n est necessaire ici.",
    "Le systeme resume automatiquement la fortune brute, la fortune fiscale et la fortune nette.",
  ],
  charges: [
    "Ce bloc sert a decrire les depenses annuelles du client.",
    "Saisissez les charges courantes comme le logement, les primes maladie, les frais de vie et les autres charges.",
    "Les impots, le total des charges et la marge annuelle sont completes automatiquement.",
  ],
  fiscalite: [
    "Ce bloc part directement du revenu imposable et de la fortune imposable.",
    "Les deductions fiscales ne sont pas recalculees ici.",
    "Le professionnel saisit les montants imposables deja determines puis consulte l estimation d impot.",
  ],
  informationsClient: [
    "Ce bloc resume toutes les informations de la variante active.",
    "Il permet de verifier rapidement les donnees saisies avant ou apres une simulation.",
    "Toutes les valeurs affichees ici sont reprises automatiquement des autres blocs.",
  ],
  recommandations: [
    "Ce bloc aide a lire les enseignements du dossier.",
    "Aucune saisie n est attendue ici.",
    "Le systeme construit automatiquement des recommandations et une synthese a partir des donnees de la variante active.",
  ],
} as const;

function getVariantDisplayedTaxResult(variant: ScenarioVariant) {
  if (
    hasSeparatedFiscalManualCorrections(variant.dossier.fiscalite) &&
    variant.taxResultCorrectionFiscaleManuelle?.normalized
  ) {
    return variant.taxResultCorrectionFiscaleManuelle;
  }

  return (variant.dossier.fiscalite.ajustementManuelRevenu || 0) !== 0 &&
    variant.taxResultAjustementManuel?.normalized
    ? variant.taxResultAjustementManuel
    : variant.taxResult;
}

function getVariantTaxTotal(variant: ScenarioVariant) {
  return (
    getVariantDisplayedTaxResult(variant)?.normalized?.totalTax ??
    variant.dossier.fiscalite.impotsEstimes ??
    null
  );
}

function getVariantPatrimoineBreakdown(variant: ScenarioVariant) {
  const liquiditesAjustees =
    (variant.dossier.fortune.liquidites || 0) -
    (variant.dossier.fiscalite.troisiemePilierSimule || 0) -
    (variant.dossier.fiscalite.rachatLpp || 0) +
    (variant.dossier.fiscalite.ajustementManuelRevenu || 0);
  const troisiemePilier =
    (variant.dossier.fortune.troisiemePilier || 0) +
    (variant.dossier.fiscalite.troisiemePilierSimule || 0);
  const fortuneLpp =
    (variant.dossier.fortune.fortuneLppActuelle || 0) + (variant.dossier.fiscalite.rachatLpp || 0);

  return [
    { label: "Liquidites", montant: Math.max(0, liquiditesAjustees) },
    { label: "Titres", montant: variant.dossier.fortune.titres || 0 },
    { label: "Immobilier", montant: variant.dossier.fortune.immobilier || 0 },
    { label: "3e pilier", montant: troisiemePilier || 0 },
    { label: "LPP", montant: fortuneLpp || 0 },
  ].filter((item) => item.montant > 0);
}

function getVariantComparisonMetrics(variant: ScenarioVariant) {
  const dossier = variant.dossier;
  const impotTotal = getVariantTaxTotal(variant);

  if (typeof impotTotal !== "number") {
    return null;
  }

  const totalRevenus =
    (dossier.revenus.salaire || 0) +
    (dossier.revenus.avs || 0) +
    (dossier.revenus.lpp || 0) +
    (dossier.revenus.autresRevenus || 0);

  const habitationPropreActive = Boolean(dossier.immobilier.proprietaireOccupant);
  const biensRendementActifs = Boolean(dossier.immobilier.possedeBienRendement);

  const interetsHabitationBudgetaires = habitationPropreActive
    ? dossier.immobilier.interetsHypothecairesHabitationPropre || 0
    : 0;

  const interetsBiensRendementBudgetaires = biensRendementActifs
    ? dossier.immobilier.interetsHypothecairesBiensRendement || 0
    : 0;

  const interetsHypothecairesImmobiliersBudgetaires =
    interetsHabitationBudgetaires + interetsBiensRendementBudgetaires;

  const effortLiquidite =
    (dossier.fiscalite.troisiemePilierSimule || 0) +
    (dossier.fiscalite.rachatLpp || 0) +
    Math.max(0, -(dossier.fiscalite.ajustementManuelRevenu || 0));

  const totalCharges =
    (dossier.charges.logement || 0) +
    interetsHypothecairesImmobiliersBudgetaires +
    (dossier.charges.primesMaladie || 0) +
    impotTotal +
    (dossier.fiscalite.troisiemePilierSimule || 0) +
    (dossier.charges.fraisVie || 0) +
    (dossier.charges.autresCharges || 0);

  const liquiditesAjustees =
    (dossier.fortune.liquidites || 0) -
    (dossier.fiscalite.troisiemePilierSimule || 0) -
    (dossier.fiscalite.rachatLpp || 0) +
    (dossier.fiscalite.ajustementManuelRevenu || 0);

  const troisiemePilierPatrimonial =
    (dossier.fortune.troisiemePilier || 0) + (dossier.fiscalite.troisiemePilierSimule || 0);

  const fortuneLppPatrimoniale =
    (dossier.fortune.fortuneLppActuelle || 0) + (dossier.fiscalite.rachatLpp || 0);

  const fortuneBrute =
    liquiditesAjustees +
    (dossier.fortune.titres || 0) +
    troisiemePilierPatrimonial +
    fortuneLppPatrimoniale +
    (dossier.fortune.immobilier || 0);

  const totalDettes = (dossier.dettes.hypotheques || 0) + (dossier.dettes.autresDettes || 0);

  return {
    impotTotal,
    margeAnnuelle: totalRevenus - totalCharges,
    effortLiquidite,
    fortuneRestante: Math.max(0, fortuneBrute - totalDettes),
  };
}

function buildVariantComparisonResults(variants: ScenarioVariant[]) {
  const candidates = variants
    .map((variant) => {
      const metrics = getVariantComparisonMetrics(variant);

      if (!metrics) {
        return null;
      }

      return {
        key: variant.id,
        label: getVariantDisplayLabel(variant),
        signature: [
          metrics.impotTotal,
          metrics.margeAnnuelle,
          metrics.effortLiquidite,
          metrics.fortuneRestante,
        ]
          .map((value) => roundScore(value))
          .join("|"),
        isLinkedToVariant1: variant.isLinkedToVariant1,
        hasCustomLabel: getVariantUserLabel(variant) !== "",
        ...metrics,
      };
    })
    .filter((variant): variant is NonNullable<typeof variant> => Boolean(variant));

  const uniqueCandidates = candidates.filter((variant, index) => {
    const previousDuplicate = candidates.findIndex(
      (candidate) => candidate.signature === variant.signature
    );

    if (previousDuplicate === index) {
      return true;
    }

    return !variant.isLinkedToVariant1 || variant.hasCustomLabel;
  });

  if (uniqueCandidates.length === 0) {
    return [];
  }

  const taxExtrema = getExtrema(uniqueCandidates.map((variant) => variant.impotTotal));
  const marginExtrema = getExtrema(uniqueCandidates.map((variant) => variant.margeAnnuelle));
  const effortExtrema = getExtrema(uniqueCandidates.map((variant) => variant.effortLiquidite));
  const wealthExtrema = getExtrema(uniqueCandidates.map((variant) => variant.fortuneRestante));

  return [...uniqueCandidates]
    .map((variant) => {
      const fiscalScore = roundScore(
        normalizeDescending(variant.impotTotal, taxExtrema.min, taxExtrema.max)
      );
      const treasuryScore = roundScore(
        normalizeAscending(variant.margeAnnuelle, marginExtrema.min, marginExtrema.max) * 0.6 +
          normalizeDescending(
            variant.effortLiquidite,
            effortExtrema.min,
            effortExtrema.max
          ) *
            0.4
      );
      const patrimonialScore = roundScore(
        normalizeAscending(variant.fortuneRestante, wealthExtrema.min, wealthExtrema.max)
      );
      const globalScore = roundScore(
        fiscalScore * 0.5 + treasuryScore * 0.3 + patrimonialScore * 0.2
      );

      return {
        ...variant,
        fiscalScore,
        treasuryScore,
        patrimonialScore,
        globalScore,
        rank: 0,
      };
    })
    .sort(
      (left, right) =>
        right.globalScore - left.globalScore ||
        right.fiscalScore - left.fiscalScore ||
        left.impotTotal - right.impotTotal
    )
    .map((variant, index) => ({
      ...variant,
      rank: index + 1,
    }));
}

function buildVariantComparisonSummary(
  comparisonResults: ReturnType<typeof buildVariantComparisonResults>
) {
  if (comparisonResults.length === 0) {
    return null;
  }

  const bestFiscal = [...comparisonResults].sort(
    (left, right) => right.fiscalScore - left.fiscalScore || left.rank - right.rank
  )[0];
  const bestTreasury = [...comparisonResults].sort(
    (left, right) => right.treasuryScore - left.treasuryScore || left.rank - right.rank
  )[0];
  const bestPatrimonial = [...comparisonResults].sort(
    (left, right) => right.patrimonialScore - left.patrimonialScore || left.rank - right.rank
  )[0];
  const bestGlobal = [...comparisonResults].sort(
    (left, right) => right.globalScore - left.globalScore || left.rank - right.rank
  )[0];

  return {
    bestFiscalVariant: bestFiscal.label,
    bestTreasuryVariant: bestTreasury.label,
    bestPatrimonialVariant: bestPatrimonial.label,
    recommendedVariant: bestGlobal.label,
    summaryLines: [
      `La variante ${bestFiscal.label} est la plus avantageuse fiscalement.`,
      `La variante ${bestTreasury.label} preserve le mieux la tresorerie.`,
      `La variante ${bestPatrimonial.label} conserve le plus de patrimoine.`,
      `La variante recommandee est ${bestGlobal.label} car elle offre le meilleur equilibre global.`,
    ],
  };
}

type GuidedSectionProps = {
  id: string;
  step: string;
  title: string;
  description: string;
  children: ReactNode;
};

function GuidedSection({ id, step, title, description, children }: GuidedSectionProps) {
  return (
    <section id={id} className="journey-section">
      <div className="journey-section__intro">
        <div className="journey-section__step">Étape {step}</div>
        <div className="journey-section__heading">
          <h2 className="journey-section__title">{title}</h2>
          <p className="journey-section__description">{description}</p>
        </div>
      </div>
      <div className="journey-section__content">{children}</div>
    </section>
  );
}

export default function App() {
  const autoSimulationStatusRef = useRef<Record<string, "running" | "done">>({});
  const activeStepViewportRef = useRef<HTMLDivElement | null>(null);
  const [activeVariantIndex, setActiveVariantIndex] = useState(0);
  const [activeSectionId, setActiveSectionId] = useState(INTRO_SECTION_ID);
  const [showConseillerPrompt, setShowConseillerPrompt] = useState(false);
  const [conseillerPasswordInput, setConseillerPasswordInput] = useState("");
  const [isConseillerAccessGranted, setIsConseillerAccessGranted] = useState(false);
  const [conseillerAccessError, setConseillerAccessError] = useState("");
  const [isRoiConseillerOpen, setIsRoiConseillerOpen] = useState(false);
  const [roiDossiersParMois, setRoiDossiersParMois] = useState(0);
  const [roiTempsParDossier, setRoiTempsParDossier] = useState(0);
  const [roiTauxHoraire, setRoiTauxHoraire] = useState(0);
  const [roiTempsParDossierAvecOutil, setRoiTempsParDossierAvecOutil] = useState(0);
  const [isSimulatingVariants, setIsSimulatingVariants] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [simulationStatusMessage, setSimulationStatusMessage] = useState("");
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode | null>(null);
  const [isDecisionHelpOpen, setIsDecisionHelpOpen] = useState(false);
  const [variants, setVariants] = useState<ScenarioVariant[]>(createInitialVariants);
  const activeVariant = variants[activeVariantIndex];
  const conseillerPassword = import.meta.env.VITE_CONSEILLER_PASSWORD || "";
  const dossier = activeVariant.dossier;
  const taxResult = activeVariant.taxResult;
  const taxResultSansOptimisation = activeVariant.taxResultSansOptimisation;
  const taxResultAjustementManuel = activeVariant.taxResultAjustementManuel;

  const setDossier = (nextDossier: DossierClient) => {
    setVariants((current) => {
      if (activeVariantIndex === 0) {
        const updatedBaseVariant = {
          ...current[0],
          dossier: nextDossier,
        };

        return current.map((variant, index) => {
          if (index === 0) {
            return updatedBaseVariant;
          }

          if (variant.isLinkedToVariant1) {
            return cloneVariantStateFromBase(updatedBaseVariant, variant, true);
          }

          return variant;
        });
      }

      return current.map((variant, index) =>
        index === activeVariantIndex
          ? { ...variant, dossier: nextDossier, isLinkedToVariant1: false }
          : variant
      );
    });
  };

  const handleVariantCustomLabelChange = (variantIndex: number, nextValue: string) => {
    setVariants((current) =>
      current.map((variant, index) =>
        index === variantIndex ? { ...variant, customLabel: nextValue } : variant
      )
    );
  };

  const handleAnalysisModeSelection = (mode: AnalysisMode) => {
    setAnalysisMode(mode);

    if (mode === "current" || mode === "projected") {
      setDossier({
        ...dossier,
        immobilier: {
          ...dossier.immobilier,
          regimeFiscal: mode === "current" ? "actuel" : "reforme",
        },
      });
      return;
    }

    setVariants((current) => {
      const baseVariant = current[0] ?? createEmptyVariant(0);
      const baseDossier = cloneDossier(baseVariant.dossier);
      const nextVariants = [...current];
      const hasReformedVariant = current.some(
        (variant, index) => index > 0 && variant.dossier.immobilier.regimeFiscal === "reforme"
      );

      nextVariants[0] = {
        ...baseVariant,
        dossier: {
          ...baseDossier,
          immobilier: {
            ...baseDossier.immobilier,
            regimeFiscal: "actuel",
          },
        },
        customLabel: baseVariant.customLabel.trim() || "Situation actuelle",
        isLinkedToVariant1: false,
      };

      if (!hasReformedVariant && current.length < MAX_VARIANTS) {
        const compareVariant = cloneVariantStateFromBase(nextVariants[0], createEmptyVariant(1), false);
        const compareVariantDossier = cloneDossier(compareVariant.dossier);

        nextVariants.push({
          ...compareVariant,
          id: `variant-compare-${Date.now()}`,
          customLabel: "Situation projetée",
          dossier: {
            ...compareVariantDossier,
            immobilier: {
              ...compareVariantDossier.immobilier,
              regimeFiscal: "reforme",
            },
          },
          isLinkedToVariant1: false,
        });
      }

      return normalizeVariantLabels(nextVariants);
    });
    setActiveVariantIndex(0);
  };

  const handleAddVariantFromActive = () => {
    setVariants((current) => {
      if (current.length >= MAX_VARIANTS) {
        return current;
      }

      const sourceVariant = current[activeVariantIndex] ?? current[0];
      const nextIndex = current.length;
      const nextVariant: ScenarioVariant = {
        ...cloneVariantStateFromBase(sourceVariant, createEmptyVariant(nextIndex), false),
        id: `variant-${Date.now()}-${nextIndex}`,
        customLabel: `Copie de ${getVariantUserLabel(sourceVariant) || sourceVariant.label}`,
        isLinkedToVariant1: false,
      };

      const nextVariants = normalizeVariantLabels([...current, nextVariant]);
      setActiveVariantIndex(nextVariants.length - 1);

      return nextVariants;
    });
  };

  const handleDeleteVariant = (variantIndex: number) => {
    if (variantIndex === 0) {
      return;
    }

    setVariants((current) => {
      const nextVariants = normalizeVariantLabels(
        current.filter((_, index) => index !== variantIndex)
      );

      setActiveVariantIndex((currentActiveIndex) => {
        if (currentActiveIndex === variantIndex) {
          return Math.max(0, variantIndex - 1);
        }

        if (currentActiveIndex > variantIndex) {
          return currentActiveIndex - 1;
        }

        return currentActiveIndex;
      });

      return nextVariants;
    });
  };

  const handleResetVariantsFromVariant1 = () => {
    setVariants((current) => {
      const baseVariant = current[0];

      return normalizeVariantLabels(current.map((variant, index) => {
        if (index === 0) {
          return variant;
        }

        return {
          ...cloneVariantStateFromBase(baseVariant, variant, false),
          isLinkedToVariant1: false,
        };
      }));
    });
  };

  const handleResetManualValues = () => {
    const shouldReset = window.confirm("Voulez-vous vraiment réinitialiser toutes les valeurs ?");

    if (!shouldReset) {
      return;
    }

    autoSimulationStatusRef.current = {};
    setActiveVariantIndex(0);
    setActiveSectionId(INTRO_SECTION_ID);
    setAnalysisMode(null);
    setIsDecisionHelpOpen(false);
    setVariants(createInitialVariants());
  };

  const handleConseillerAccessToggle = () => {
    if (isConseillerAccessGranted) {
      setIsConseillerAccessGranted(false);
      setShowConseillerPrompt(false);
      setConseillerPasswordInput("");
      setConseillerAccessError("");
      return;
    }

    setShowConseillerPrompt((current) => !current);
    setConseillerAccessError("");
  };

  const handleConseillerAccessSubmit = () => {
    if (conseillerPassword !== "" && conseillerPasswordInput === conseillerPassword) {
      setIsConseillerAccessGranted(true);
      setShowConseillerPrompt(false);
      setConseillerPasswordInput("");
      setConseillerAccessError("");
      return;
    }

    setIsConseillerAccessGranted(false);
    setConseillerAccessError("Acces refuse");
  };

  console.log("DOSSIER ACTIF =", dossier, "VARIANTE =", getVariantDisplayLabel(activeVariant));

  const totalRevenusCalcule =
    (dossier.revenus.salaire || 0) +
    (dossier.revenus.avs || 0) +
    (dossier.revenus.lpp || 0) +
    (dossier.revenus.autresRevenus || 0);

  const regimeImmobilierActuel = dossier.immobilier.regimeFiscal === "actuel";
  const regimeImmobilierLabel =
    dossier.immobilier.regimeFiscal === "actuel" ? "Régime actuel" : "Régime réformé";

  const habitationPropreActive = Boolean(dossier.immobilier.proprietaireOccupant);
  const biensRendementActifs = Boolean(dossier.immobilier.possedeBienRendement);

  const interetsHabitationBudgetaires = habitationPropreActive
    ? dossier.immobilier.interetsHypothecairesHabitationPropre || 0
    : 0;

  const interetsBiensRendementBudgetaires = biensRendementActifs
    ? dossier.immobilier.interetsHypothecairesBiensRendement || 0
    : 0;

  const interetsHypothecairesImmobiliersBudgetaires =
    interetsHabitationBudgetaires + interetsBiensRendementBudgetaires;

  const valeurLocativeActuelleHabitation = habitationPropreActive
    ? dossier.immobilier.valeurLocativeHabitationPropre || 0
    : 0;

  const interetsHabitationActuels = habitationPropreActive
    ? dossier.immobilier.interetsHypothecairesHabitationPropre || 0
    : 0;

  const fraisHabitationActuels = habitationPropreActive
    ? dossier.immobilier.fraisEntretienHabitationPropre || 0
    : 0;

  const variationValeurLocativeSimulation = regimeImmobilierActuel
    ? 0
    : -valeurLocativeActuelleHabitation;

  const variationInteretsHypothecairesSimulation = regimeImmobilierActuel
    ? 0
    : interetsHabitationActuels;

  const variationFraisEntretienSimulation = regimeImmobilierActuel
    ? 0
    : fraisHabitationActuels;

  const totalAjustementsImmobiliersSimulation =
    variationValeurLocativeSimulation +
    variationInteretsHypothecairesSimulation +
    variationFraisEntretienSimulation;

  const valeurLocativeFiscalisee = valeurLocativeActuelleHabitation;

  const interetsHabitationDeductibles = interetsHabitationActuels;

  const fraisHabitationDeductibles = fraisHabitationActuels;

  const loyersBiensRendementImposables = biensRendementActifs
    ? dossier.immobilier.loyersBiensRendement || 0
    : 0;

  const interetsBiensRendementDeductibles = biensRendementActifs
    ? dossier.immobilier.interetsHypothecairesBiensRendement || 0
    : 0;

  const fraisBiensRendementDeductibles = biensRendementActifs
    ? dossier.immobilier.fraisEntretienBiensRendement || 0
    : 0;

  const liquiditesAjusteesCalcule =
    (dossier.fortune.liquidites || 0) -
    (dossier.fiscalite.troisiemePilierSimule || 0) -
    (dossier.fiscalite.rachatLpp || 0) +
    (dossier.fiscalite.ajustementManuelRevenu || 0);

  const troisiemePilierPatrimonialCalcule =
    (dossier.fortune.troisiemePilier || 0) +
    (dossier.fiscalite.troisiemePilierSimule || 0);

  const fortuneLppPatrimonialeCalcule =
    (dossier.fortune.fortuneLppActuelle || 0) +
    (dossier.fiscalite.rachatLpp || 0);

  const fortuneBruteCalcule =
    liquiditesAjusteesCalcule +
    (dossier.fortune.titres || 0) +
    troisiemePilierPatrimonialCalcule +
    fortuneLppPatrimonialeCalcule +
    (dossier.fortune.immobilier || 0);

  const fortuneFiscaleCalcule =
    liquiditesAjusteesCalcule +
    (dossier.fortune.titres || 0) +
    (dossier.fortune.immobilier || 0);

  const totalDettesCalcule =
    (dossier.dettes.hypotheques || 0) +
    (dossier.dettes.autresDettes || 0);

  const fortuneNetteFiscaleCalcule = Math.max(
    0,
    fortuneFiscaleCalcule - totalDettesCalcule
  );

  const fortuneNetteCalcule = Math.max(
    0,
    fortuneBruteCalcule - totalDettesCalcule
  );

  const revenusImmobiliersFiscauxCalcules =
    valeurLocativeFiscalisee + loyersBiensRendementImposables;

  const deductionsImmobilieresFiscalesCalculees =
    interetsHabitationDeductibles +
    fraisHabitationDeductibles +
    interetsBiensRendementDeductibles +
    fraisBiensRendementDeductibles;

  const taxResultAvantCorrectionsFiscales =
    (dossier.fiscalite.ajustementManuelRevenu || 0) !== 0 && taxResultAjustementManuel?.normalized
      ? taxResultAjustementManuel
      : taxResult;

  const taxResultAffiche = taxResultAvantCorrectionsFiscales;
  const taxResultReferenceBrute = taxResultSansOptimisation ?? taxResultAvantCorrectionsFiscales;

  const revenuImposableIfdReference = Math.max(0, dossier.fiscalite.revenuImposableIfd || 0);
  const revenuImposableReference = Math.max(0, dossier.fiscalite.revenuImposable || 0);
  const fortuneImposableReference = Math.max(
    0,
    dossier.fiscalite.fortuneImposableActuelleSaisie || 0
  );

  const ajustementPrevoyanceSimulation =
    -(dossier.fiscalite.troisiemePilierSimule || 0) - (dossier.fiscalite.rachatLpp || 0);
  const ajustementManuelSimulation = dossier.fiscalite.ajustementManuelRevenu || 0;
  const totalAjustementsSimulationIfd =
    totalAjustementsImmobiliersSimulation +
    ajustementPrevoyanceSimulation +
    ajustementManuelSimulation +
    (dossier.fiscalite.correctionFiscaleManuelleIfd || 0);
  const totalAjustementsSimulationCanton =
    totalAjustementsImmobiliersSimulation +
    ajustementPrevoyanceSimulation +
    ajustementManuelSimulation +
    (dossier.fiscalite.correctionFiscaleManuelleCanton || 0);
  const totalAjustementsSimulationFortune =
    dossier.fiscalite.correctionFiscaleManuelleFortune || 0;

  const revenuImposableIfdSimule = Math.max(
    0,
    revenuImposableIfdReference + totalAjustementsSimulationIfd
  );
  const revenuImposableCantonalSimule = Math.max(
    0,
    revenuImposableReference + totalAjustementsSimulationCanton
  );
  const fortuneImposableSimulee = Math.max(
    0,
    fortuneImposableReference + totalAjustementsSimulationFortune
  );

  const revenuImposableTaxwareIfd =
    typeof taxResultAffiche?.normalized?.taxableIncomeFederal === "number"
      ? taxResultAffiche.normalized.taxableIncomeFederal
      : revenuImposableIfdReference;

  const revenuImposableApresSimulationCalcule = revenuImposableCantonalSimule;

  const revenuImposableIfdApresSimulationCalcule = revenuImposableIfdSimule;

  const revenuImposableTaxwareCanton =
    typeof taxResultAffiche?.normalized?.taxableIncomeCantonal === "number"
      ? taxResultAffiche.normalized.taxableIncomeCantonal
      : revenuImposableApresSimulationCalcule;

  const fortuneImposableTaxware =
    typeof taxResultAffiche?.normalized?.taxableAssets === "number"
      ? taxResultAffiche.normalized.taxableAssets
      : fortuneImposableReference;

  const revenuImposableCorrigeIfd = revenuImposableTaxwareIfd;
  const revenuImposableCorrigeCanton = revenuImposableTaxwareCanton;
  const fortuneImposableCorrige = fortuneImposableTaxware;
  const revenuControleApresDeductions = revenuImposableIfdApresSimulationCalcule;
  const impotFederalDirect = taxResultAffiche?.normalized?.federalTax ?? 0;

  const isDevelopmentEnvironment =
    typeof process !== "undefined" && process.env?.NODE_ENV === "development";
  const taxwareRawDisplayedResult =
    (taxResultAffiche?.raw?.correctionCanton?.data ??
      taxResultAffiche?.raw?.correctionCanton ??
      taxResultAffiche?.raw?.baseline?.data ??
      taxResultAffiche?.raw?.baseline ??
      null) as Record<string, any> | null;
  const vaudDebugTaxableIncomeCantonal = getFirstNumberByPaths(taxwareRawDisplayedResult, [
    "TaxableIncomeCantonal",
    "TaxableIncomeCanton",
    "IncomeTaxableCantonal",
    "IncomeTaxableCanton",
    "Result.TaxableIncomeCantonal",
    "Summary.TaxableIncomeCantonal",
  ]);
  const vaudDebugRateDefiningIncomeCantonal = getFirstNumberByPaths(taxwareRawDisplayedResult, [
    "RatedefIncomeCanton",
    "RateDefiningIncomeCanton",
    "Result.RatedefIncomeCanton",
    "Summary.RatedefIncomeCanton",
  ]);
  const vaudDebugTaxCanton = getFirstNumberByPaths(taxwareRawDisplayedResult, [
    "TaxCanton",
    "CantonTax",
    "TaxesIncome.CantonTax",
    "Taxes.CantonTax",
    "Taxes.CantonalTax",
    "Result.CantonTax",
    "Summary.CantonTax",
  ]);
  const vaudDebugTaxMunicipality = getFirstNumberByPaths(taxwareRawDisplayedResult, [
    "TaxMunicipality",
    "MunicipalityTax",
    "CommunalTax",
    "TaxesIncome.MunicipalityTax",
    "Taxes.MunicipalityTax",
    "Result.MunicipalityTax",
    "Summary.MunicipalityTax",
  ]);
  const vaudDebugCantonAdditionalTax = getFirstNumberByPaths(taxwareRawDisplayedResult, [
    "CantonAdditionalTax",
    "TaxesIncome.CantonAdditionalTax",
    "Taxes.CantonAdditionalTax",
    "Result.CantonAdditionalTax",
    "Summary.CantonAdditionalTax",
  ]);
  const vaudDebugMunicipalityAdditionalTax = getFirstNumberByPaths(taxwareRawDisplayedResult, [
    "MunicipalityAdditionalTax",
    "TaxesIncome.MunicipalityAdditionalTax",
    "Taxes.MunicipalityAdditionalTax",
    "Result.MunicipalityAdditionalTax",
    "Summary.MunicipalityAdditionalTax",
  ]);
  const vaudDebugCantonalReconstituted = sumFiniteNumbers(
    vaudDebugTaxCanton,
    vaudDebugCantonAdditionalTax
  );
  const vaudDebugCommunalReconstituted = sumFiniteNumbers(
    vaudDebugTaxMunicipality,
    vaudDebugMunicipalityAdditionalTax
  );
  const vaudDebugRawUnitaryTax = getFirstNumberByPaths(taxwareRawDisplayedResult, [
    "CantonUnitaryTax",
    "UnitaryTax",
    "TaxesIncome.CantonUnitaryTax",
    "Result.CantonUnitaryTax",
    "Summary.CantonUnitaryTax",
  ]);
  const vaudDebugRawTotalTax = getFirstNumberByPaths(taxwareRawDisplayedResult, [
    "TaxTotal",
    "TotalTax",
    "TaxesIncome.TaxTotal",
    "TaxesIncome.TotalTax",
    "Taxes.TotalTax",
  ]);
  const vaudDisplayedTaxTotal = taxResultAffiche?.normalized?.cantonalCommunalTax ?? null;
  const vaudDisplayedCanton = taxResultAffiche?.normalized?.canton ?? null;
  const vaudDebugContext = taxResultAffiche?.normalized?.cantonalContext ?? null;
  const vaudCantonalBreakdown = taxResultAffiche?.normalized?.cantonalBreakdown ?? null;
  const vaudUiChildrenCount = dossier.famille.nombreEnfants;
  const vaudUiPartnership = dossier.famille.aConjoint ? "Marriage" : "Single";
  const vaudResponseChildrenEcho = getFirstDefinedValueByPaths(taxwareRawDisplayedResult, [
    "NumChildren",
    "ChildrenCount",
    "Family.NumChildren",
    "Family.ChildrenCount",
  ]);
  const vaudResponsePartnershipEcho = getFirstDefinedValueByPaths(taxwareRawDisplayedResult, [
    "Partnership",
    "Family.Partnership",
  ]);
  const vaudResponseRateDefFederal = getFirstNumberByPaths(taxwareRawDisplayedResult, [
    "RatedefIncomeFederation",
    "RateDefiningIncomeFederation",
    "Result.RatedefIncomeFederation",
    "Summary.RatedefIncomeFederation",
  ]);
  const vaudResponseFederalChildrenReduction = getFirstNumberByPaths(taxwareRawDisplayedResult, [
    "FederalChildrenReduction",
    "Result.FederalChildrenReduction",
    "Summary.FederalChildrenReduction",
  ]);
  const vaudResponseCantonalChildrenReduction = getFirstNumberByPaths(taxwareRawDisplayedResult, [
    "CantonChildrenReduction",
    "Result.CantonChildrenReduction",
    "Summary.CantonChildrenReduction",
  ]);
  const vaudResponseTariffField = getFirstDefinedValueByPaths(taxwareRawDisplayedResult, [
    "Tariff",
    "TaxTariff",
    "TariffCode",
    "RateType",
  ]);
  const vaudResponseQuotientField = getFirstDefinedValueByPaths(taxwareRawDisplayedResult, [
    "Quotient",
    "FamilyQuotient",
    "QuotientFamilial",
  ]);
  const vaudExpectedQuotientDebug =
    dossier.famille.aConjoint && dossier.famille.nombreEnfants === 2
      ? "1.8 (hypothèse debug pour marié + 2 enfants)"
      : dossier.famille.nombreEnfants === 0
        ? "1.0 (aucun enfant)"
        : "À confirmer: le payload actuel ne modélise pas explicitement le quotient Vaud";
  const shouldShowVaudDebugPanel =
    isDevelopmentEnvironment &&
    (vaudDisplayedCanton === "VD" || String(vaudDebugContext?.cantonRule || "").startsWith("vaud"));
  const vaudAppRecompositionMode =
    "L’application lit maintenant directement les champs exacts TaxWare retenus pour Vaud, sans recomposition locale.";
  const vaudDebugRawResponsePretty = taxwareRawDisplayedResult
    ? JSON.stringify(taxwareRawDisplayedResult, null, 2)
    : "Aucune réponse brute TaxWare disponible.";
  const vaudDebugCandidates = [
    {
      label: "TaxCanton / CantonTax",
      paths: [
        "TaxCanton",
        "CantonTax",
        "TaxesIncome.CantonTax",
        "Taxes.CantonTax",
        "Taxes.CantonalTax",
      ],
      value: vaudDebugTaxCanton,
      usedByApp: true,
    },
    {
      label: "TaxMunicipality / MunicipalityTax",
      paths: [
        "TaxMunicipality",
        "MunicipalityTax",
        "CommunalTax",
        "TaxesIncome.MunicipalityTax",
        "Taxes.MunicipalityTax",
      ],
      value: vaudDebugTaxMunicipality,
      usedByApp: true,
    },
    {
      label: "CantonAdditionalTax",
      paths: [
        "CantonAdditionalTax",
        "TaxesIncome.CantonAdditionalTax",
        "Taxes.CantonAdditionalTax",
      ],
      value: vaudDebugCantonAdditionalTax,
      usedByApp: false,
    },
    {
      label: "MunicipalityAdditionalTax",
      paths: [
        "MunicipalityAdditionalTax",
        "TaxesIncome.MunicipalityAdditionalTax",
        "Taxes.MunicipalityAdditionalTax",
      ],
      value: vaudDebugMunicipalityAdditionalTax,
      usedByApp: false,
    },
    {
      label: "CantonMunicipalityParishTaxTotal",
      paths: [
        "CantonMunicipalityParishTaxTotal",
        "TaxesIncome.CantonMunicipalityParishTaxTotal",
        "TaxesIncome.CantonMunicipalityTaxTotal",
      ],
      value: getFirstNumberByPaths(taxwareRawDisplayedResult, [
        "CantonMunicipalityParishTaxTotal",
        "TaxesIncome.CantonMunicipalityParishTaxTotal",
        "TaxesIncome.CantonMunicipalityTaxTotal",
      ]),
      usedByApp: true,
    },
    {
      label: "TaxTotal / TotalTax",
      paths: [
        "TaxTotal",
        "TotalTax",
        "TaxesIncome.TotalTax",
        "Taxes.TotalTax",
      ],
      value: getFirstNumberByPaths(taxwareRawDisplayedResult, [
        "TaxTotal",
        "TotalTax",
        "TaxesIncome.TotalTax",
        "Taxes.TotalTax",
      ]),
      usedByApp: true,
    },
    {
      label: "CantonCoefficient",
      paths: ["CantonCoefficient", "TaxesIncome.CantonCoefficient"],
      value: getFirstDefinedValueByPaths(taxwareRawDisplayedResult, [
        "CantonCoefficient",
        "TaxesIncome.CantonCoefficient",
      ]),
      usedByApp: false,
    },
    {
      label: "MunicipalityCoefficient",
      paths: ["MunicipalityCoefficient", "TaxesIncome.MunicipalityCoefficient"],
      value: getFirstDefinedValueByPaths(taxwareRawDisplayedResult, [
        "MunicipalityCoefficient",
        "TaxesIncome.MunicipalityCoefficient",
      ]),
      usedByApp: false,
    },
    {
      label: "CantonTaxRate",
      paths: ["CantonTaxRate", "CantonRate", "TaxesIncome.CantonTaxRate"],
      value: getFirstDefinedValueByPaths(taxwareRawDisplayedResult, [
        "CantonTaxRate",
        "CantonRate",
        "TaxesIncome.CantonTaxRate",
      ]),
      usedByApp: false,
    },
    {
      label: "MunicipalityTaxRate",
      paths: ["MunicipalityTaxRate", "MunicipalityRate", "TaxesIncome.MunicipalityTaxRate"],
      value: getFirstDefinedValueByPaths(taxwareRawDisplayedResult, [
        "MunicipalityTaxRate",
        "MunicipalityRate",
        "TaxesIncome.MunicipalityTaxRate",
      ]),
      usedByApp: false,
    },
    {
      label: "CantonAdditionalTaxRate",
      paths: ["CantonAdditionalTaxRate"],
      value: getFirstDefinedValueByPaths(taxwareRawDisplayedResult, ["CantonAdditionalTaxRate"]),
      usedByApp: false,
    },
    {
      label: "MunicipalityAdditionalTaxRate",
      paths: ["MunicipalityAdditionalTaxRate"],
      value: getFirstDefinedValueByPaths(taxwareRawDisplayedResult, [
        "MunicipalityAdditionalTaxRate",
      ]),
      usedByApp: false,
    },
    {
      label: "CantonUnitaryTaxRate",
      paths: ["CantonUnitaryTaxRate"],
      value: getFirstDefinedValueByPaths(taxwareRawDisplayedResult, ["CantonUnitaryTaxRate"]),
      usedByApp: false,
    },
    {
      label: "TotalTaxRate",
      paths: ["TotalTaxRate"],
      value: getFirstDefinedValueByPaths(taxwareRawDisplayedResult, ["TotalTaxRate"]),
      usedByApp: false,
    },
    {
      label: "CantonCoefficientText",
      paths: ["CantonCoefficientText"],
      value: getFirstDefinedValueByPaths(taxwareRawDisplayedResult, ["CantonCoefficientText"]),
      usedByApp: false,
    },
    {
      label: "MunicipalityCoefficientText",
      paths: ["MunicipalityCoefficientText"],
      value: getFirstDefinedValueByPaths(taxwareRawDisplayedResult, [
        "MunicipalityCoefficientText",
      ]),
      usedByApp: false,
    },
  ];
  const vaudDebugMissingCandidates = vaudDebugCandidates.filter(
    (candidate) => !candidate.usedByApp && candidate.value !== null
  );
  const showVaudFiscalBreakdown =
    String(taxResultAffiche?.normalized?.cantonalContext?.cantonRule || "").startsWith("vaud");
  const vaudPreviousMapping = {
    cantonalField: "CantonalTax + CantonAdditionalTax",
    communalField: "CommunalTax + MunicipalityAdditionalTax",
    unitaryField: "CantonUnitaryTax / UnitaryTax",
    totalField: "CantonalCommunalTax reconstitué",
  };
  const vaudCurrentMapping = {
    cantonalField: vaudDebugContext?.exactCantonalField ?? "non trouvé",
    communalField: vaudDebugContext?.exactCommunalField ?? "non trouvé",
    unitaryField: vaudDebugContext?.exactUnitaryField ?? "non trouvé",
    totalField: vaudDebugContext?.exactTotalField ?? "non trouvé",
  };

  const impotRevenuFortuneCharge =
    taxResultAffiche?.normalized?.totalTax ??
    taxResult?.normalized?.totalTax ??
    dossier.fiscalite.impotsEstimes ??
    dossier.charges.impotsRevenuFortune ??
    0;

  const totalChargesCalcule =
    (dossier.charges.logement || 0) +
    interetsHypothecairesImmobiliersBudgetaires +
    (dossier.charges.primesMaladie || 0) +
    impotRevenuFortuneCharge +
    (dossier.fiscalite.troisiemePilierSimule || 0) +
    (dossier.charges.fraisVie || 0) +
    (dossier.charges.autresCharges || 0);

  const interetsHypothecairesChargesDeductibles =
    dossier.charges.logementIsHypothequeDeductible ? dossier.charges.logement || 0 : 0;

  const chargesDeductiblesGeneriques =
    dossier.charges.autresChargesIsPensionDeductible ? dossier.charges.autresCharges || 0 : 0;

  const interetsHypothecairesDeductibles =
    interetsHypothecairesChargesDeductibles +
    interetsHabitationDeductibles +
    interetsBiensRendementDeductibles;

  const chargesDeductiblesTaxware =
    chargesDeductiblesGeneriques + fraisHabitationDeductibles + fraisBiensRendementDeductibles;

  const realEstatesTaxware = [
    ...(habitationPropreActive && regimeImmobilierActuel
      ? [
          {
            rentalIncome: valeurLocativeFiscalisee,
            effectiveExpenses: fraisHabitationDeductibles,
          },
        ]
      : []),
    ...(biensRendementActifs
      ? [
          {
            rentalIncome: loyersBiensRendementImposables,
            effectiveExpenses: fraisBiensRendementDeductibles,
          },
        ]
      : []),
  ].filter(
    (realEstate) =>
      Number(realEstate.rentalIncome || 0) > 0 || Number(realEstate.effectiveExpenses || 0) > 0
  );

  const revenusImmobiliersTaxware = realEstatesTaxware.reduce(
    (sum, realEstate) => sum + Number(realEstate.rentalIncome || 0),
    0
  );

  const fraisImmobiliersTaxware = realEstatesTaxware.reduce(
    (sum, realEstate) => sum + Number(realEstate.effectiveExpenses || 0),
    0
  );

  const margeAnnuelleCalcule = totalRevenusCalcule - totalChargesCalcule;

  const impotEstimeCalcule = dossier.fiscalite.impotsEstimes || 0;
  const impotReferenceTaxware =
    taxResultSansOptimisation?.normalized?.totalTax ??
    taxResult?.normalized?.totalTax ??
    impotEstimeCalcule;
  const impotCorrigeSynthese =
    taxResultAffiche?.normalized?.totalTax ?? impotReferenceTaxware;
  const resultatFiscalBrutTitle = "Base fiscale actuelle";
  const resultatFiscalBrutHelper =
    "Montants actuels saisis par le fiduciaire, conserves comme reference et jamais recalcules automatiquement";
  const impotTotalReference =
    impotCorrigeSynthese ??
    taxResultSansOptimisation?.normalized?.totalTax ??
    impotEstimeCalcule;

  const objectifPrincipalSynthese =
    impotTotalReference >= 15000
      ? "Réduire la charge fiscale"
      : dossier.identite.age >= 55
        ? "Préparer la retraite"
        : fortuneBruteCalcule >= 1000000
          ? "Structurer et sécuriser le patrimoine"
          : "Optimisation globale";

  const formatMontantCHF = (valeur: number) => {
    return `${new Intl.NumberFormat("fr-CH").format(valeur || 0)} CHF`;
  };

  const formatMontantTaxware = (valeur: number | null | undefined) => {
    return typeof valeur === "number" ? formatMontantCHF(valeur) : "Non disponible separement";
  };

  const formatMontantCHFArrondi = (valeur: number | null | undefined) => {
    return formatMontantCHF(Math.round(typeof valeur === "number" ? valeur : 0));
  };

  const formatMontantCHFSigne = (valeur: number | null | undefined) => {
    const montant = roundCurrencyValue(valeur);
    const prefixe = montant > 0 ? "+" : "";
    return `${prefixe}${formatMontantCHF(montant)}`;
  };

  const lectureImmobiliereSynthese = [
    habitationPropreActive ? "La base actuelle intègre déjà le traitement immobilier actuel." : null,
    biensRendementActifs ? "Biens de rendement intégrés dans les revenus imposables" : null,
    interetsHypothecairesImmobiliersBudgetaires > 0
      ? `Les intérêts hypothécaires restent pris en compte dans la marge budgétaire (${formatMontantCHFArrondi(
          interetsHypothecairesImmobiliersBudgetaires
        )})`
      : null,
    `Le ${regimeImmobilierLabel.toLowerCase()} sert uniquement à calculer le delta de simulation.`,
  ].filter(Boolean) as string[];

  const formatMontantCHFCompact = (valeur: number | null | undefined) => {
    return `${new Intl.NumberFormat("fr-CH", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(typeof valeur === "number" ? valeur : 0)} CHF`;
  };

  const formatHeures = (valeur: number | null | undefined) => {
    return `${new Intl.NumberFormat("fr-CH", {
      maximumFractionDigits: 1,
    }).format(typeof valeur === "number" ? valeur : 0)} h`;
  };

  const formatEcartTaxware = (
    avant: number | null | undefined,
    apres: number | null | undefined
  ) => {
    return typeof avant === "number" && typeof apres === "number"
      ? formatMontantCHF(Math.round(avant - apres))
      : "Non disponible separement";
  };

  const formatChartTooltipValue = (
    value: number | string | readonly (number | string)[] | undefined
  ) => {
    if (Array.isArray(value)) {
      return formatMontantCHFArrondi(Number(value[0] || 0));
    }

    return formatMontantCHFArrondi(Number(value || 0));
  };

  const roiTempsTotalMensuel = roiDossiersParMois * roiTempsParDossier;
  const roiValeurTempsMensuelle = roiTempsTotalMensuel * roiTauxHoraire;
  const roiNouveauTempsTotalMensuel = roiDossiersParMois * roiTempsParDossierAvecOutil;
  const roiGainHeuresMensuel = roiTempsTotalMensuel - roiNouveauTempsTotalMensuel;
  const roiGainFinancierMensuel = roiGainHeuresMensuel * roiTauxHoraire;
  const roiGainAnnuel = roiGainFinancierMensuel * 12;
  const roiCapaciteSupplementaire =
    roiTempsParDossierAvecOutil > 0
      ? Math.max(0, roiGainHeuresMensuel / roiTempsParDossierAvecOutil)
      : 0;

  const variantTotals = variants.map((variant) => {
    return {
      id: variant.id,
      customLabel: getVariantUserLabel(variant),
      label: getVariantDisplayLabel(variant),
      totalTax: getVariantTaxTotal(variant),
    };
  });

  const bestVariant = variantTotals.reduce<{
    id: string;
    customLabel: string;
    label: string;
    totalTax: number | null;
  } | null>((best, current) => {
    if (typeof current.totalTax !== "number") return best;
    if (!best || typeof best.totalTax !== "number" || current.totalTax < best.totalTax) {
      return current;
    }
    return best;
  }, null);

  const chartPalette = ["#0f172a", "#2563eb", "#14b8a6", "#f59e0b", "#a855f7"];
  const referenceVariant = variants[0];
  const referenceVariantDisplayedTaxResult = getVariantDisplayedTaxResult(referenceVariant);
  const referenceDossier = referenceVariant.dossier;
  const bestVariantState =
    variants.find((variant) => variant.id === bestVariant?.id) || activeVariant;
  const bestVariantDisplayedTaxResult = getVariantDisplayedTaxResult(bestVariantState);
  const activeVariantDisplayedTaxResult = getVariantDisplayedTaxResult(activeVariant);
  const referenceVariantTotalTaxRaw = getVariantTaxTotal(referenceVariant);
  const referenceVariantTotalTax = getVariantTaxTotal(referenceVariant) ?? 0;
  const bestVariantTotalTax =
    getVariantTaxTotal(bestVariantState) ??
    getVariantTaxTotal(activeVariant) ??
    0;
  const simulatedVariantTaxValues = variantTotals
    .map((variant) => variant.totalTax)
    .filter((value): value is number => typeof value === "number");
  const variantSpread =
    simulatedVariantTaxValues.length > 1
      ? Math.max(...simulatedVariantTaxValues) - Math.min(...simulatedVariantTaxValues)
      : null;
  const bestVariantGainVsBase =
    typeof referenceVariantTotalTaxRaw === "number" && typeof bestVariant?.totalTax === "number"
      ? referenceVariantTotalTaxRaw - bestVariant.totalTax
      : null;
  const referenceLiquiditesAjusteesCalcule =
    (referenceDossier.fortune.liquidites || 0) -
    (referenceDossier.fiscalite.troisiemePilierSimule || 0) -
    (referenceDossier.fiscalite.rachatLpp || 0) +
    (referenceDossier.fiscalite.ajustementManuelRevenu || 0);
  const referenceTroisiemePilierPatrimonialCalcule =
    (referenceDossier.fortune.troisiemePilier || 0) +
    (referenceDossier.fiscalite.troisiemePilierSimule || 0);
  const referenceFortuneLppPatrimonialeCalcule =
    (referenceDossier.fortune.fortuneLppActuelle || 0) + (referenceDossier.fiscalite.rachatLpp || 0);
  const referenceFortuneBruteCalcule =
    referenceLiquiditesAjusteesCalcule +
    (referenceDossier.fortune.titres || 0) +
    referenceTroisiemePilierPatrimonialCalcule +
    referenceFortuneLppPatrimonialeCalcule +
    (referenceDossier.fortune.immobilier || 0);
  const referenceFortuneFiscaleCalcule =
    referenceLiquiditesAjusteesCalcule +
    (referenceDossier.fortune.titres || 0) +
    (referenceDossier.fortune.immobilier || 0);
  const referenceTotalDettesCalcule =
    (referenceDossier.dettes.hypotheques || 0) + (referenceDossier.dettes.autresDettes || 0);
  const referenceFortuneNetteFiscaleCalcule = Math.max(
    0,
    referenceFortuneFiscaleCalcule - referenceTotalDettesCalcule
  );
  const referenceTotalRevenusCalcule =
    (referenceDossier.revenus.salaire || 0) +
    (referenceDossier.revenus.avs || 0) +
    (referenceDossier.revenus.lpp || 0) +
    (referenceDossier.revenus.autresRevenus || 0);
  const referenceTotalChargesCalcule =
    (referenceDossier.charges.logement || 0) +
    (referenceDossier.charges.primesMaladie || 0) +
    (referenceDossier.charges.fraisVie || 0) +
    (referenceDossier.charges.autresCharges || 0);
  const referenceMargeAnnuelleCalcule = referenceTotalRevenusCalcule - referenceTotalChargesCalcule;
  const chartTargetLabel = bestVariant?.label || getVariantDisplayLabel(activeVariant);
  const impotAvantApresChartData = [
    { label: "Avant", montant: referenceVariantTotalTax },
    { label: "Apres", montant: bestVariantTotalTax },
  ];
  const repartitionImpotsChartData = [
    {
      label: "IFD",
      montant:
        bestVariantDisplayedTaxResult?.normalized?.federalTax ??
        activeVariantDisplayedTaxResult?.normalized?.federalTax ??
        0,
    },
    {
      label: "Impot cantonal",
      montant:
        bestVariantDisplayedTaxResult?.normalized?.cantonalTax ??
        activeVariantDisplayedTaxResult?.normalized?.cantonalTax ??
        0,
    },
    {
      label: "Impot communal",
      montant:
        bestVariantDisplayedTaxResult?.normalized?.communalTax ??
        activeVariantDisplayedTaxResult?.normalized?.communalTax ??
        0,
    },
    {
      label: "Impot fortune",
      montant:
        bestVariantDisplayedTaxResult?.normalized?.wealthTax ??
        activeVariantDisplayedTaxResult?.normalized?.wealthTax ??
        0,
    },
  ].filter((item) => item.montant > 0);
  const patrimoineChartData = getVariantPatrimoineBreakdown(bestVariantState);
  const hasTaxBreakdownData = repartitionImpotsChartData.length > 0;
  const hasPatrimoineData = patrimoineChartData.length > 0;

  const comparaisonMultiCriteres = buildVariantComparisonResults(variants);

  const resumeComparatifClient = buildVariantComparisonSummary(comparaisonMultiCriteres);

  const meilleureVarianteComparative = comparaisonMultiCriteres[0] || null;
  const showAdvancedComparison = comparaisonMultiCriteres.length > 1;

  const inputStyle = {
    width: "100%",
    padding: "10px",
    borderRadius: "10px",
    border: "1px solid #cbd5e1",
    fontSize: "16px",
    boxSizing: "border-box" as const,
    backgroundColor: "#ffffff",
  };

  const inputReadOnlyStyle = {
    ...inputStyle,
    backgroundColor: "#f1f5f9",
    border: "1px solid #e2e8f0",
    fontWeight: 600 as const,
    color: "#0f172a",
  };

  const labelStyle = {
    display: "block",
    marginBottom: "6px",
    fontWeight: "bold" as const,
    color: "#334155",
  };

  const helperStyle = {
    display: "block",
    marginTop: "4px",
    fontSize: "12px",
    color: "#64748b",
  };

  const checkboxRowStyle = {
    display: "flex",
    alignItems: "flex-start",
    gap: "8px",
    color: "#334155",
    fontSize: "13px",
    lineHeight: 1.5,
  };

  const sectionCardStyle = {
    background: "#ffffff",
    borderRadius: "16px",
    padding: "24px",
    border: "1px solid #cbd5e1",
    marginBottom: "24px",
  };

  const subCardStyle = {
    border: "1px solid #e2e8f0",
    borderRadius: "16px",
    padding: "18px",
    backgroundColor: "#f8fafc",
  };

  const dataFieldCardStyle = {
    border: "1px solid #e2e8f0",
    borderRadius: "14px",
    padding: "16px",
    backgroundColor: "#f8fafc",
    minHeight: "142px",
    display: "flex",
    flexDirection: "column" as const,
    justifyContent: "space-between",
  };

  const chargeCardStyle = {
    ...dataFieldCardStyle,
    minHeight: "248px",
    justifyContent: "flex-start" as const,
    gap: "12px",
  };

  const chargeFieldStackStyle = {
    display: "grid",
    gap: "6px",
    alignContent: "start",
  };

  const chargeFooterPlaceholderStyle = {
    minHeight: "86px",
  };

  const chargeFooterStyle = {
    marginTop: "auto",
    minHeight: "86px",
    display: "flex",
    alignItems: "flex-start",
  };

  const checkboxTextStackStyle = {
    display: "grid",
    gap: "4px",
  };

  const immobilierCardsGridStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
    gap: "16px",
    alignItems: "stretch" as const,
  };

  const immobilierCardStyle = {
    ...subCardStyle,
    minHeight: "100%",
    display: "flex",
    flexDirection: "column" as const,
    gap: "16px",
    padding: "20px",
    backgroundColor: "#ffffff",
  };

  const immobilierCardHeaderStyle = {
    display: "grid",
    gap: "8px",
  };

  const immobilierActivationStyle = {
    padding: "12px 14px",
    borderRadius: "14px",
    backgroundColor: "#f8fafc",
    border: "1px solid #e2e8f0",
  };

  const immobilierFieldsGridStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "12px",
    alignItems: "stretch" as const,
  };

  const immobilierFieldCardStyle = {
    border: "1px solid #e2e8f0",
    borderRadius: "14px",
    padding: "14px",
    backgroundColor: "#f8fafc",
    display: "grid",
    gap: "8px",
    alignContent: "start",
  };

  const immobilierWideFieldCardStyle = {
    ...immobilierFieldCardStyle,
    gridColumn: "1 / -1",
  };

  const immobilierTagStyle = {
    display: "inline-flex",
    alignItems: "center",
    width: "fit-content",
    padding: "5px 10px",
    borderRadius: "999px",
    backgroundColor: "#eff6ff",
    border: "1px solid #bfdbfe",
    color: "#1d4ed8",
    fontSize: "12px",
    fontWeight: 700,
  };

  const fortuneFieldCardStyle = {
    ...dataFieldCardStyle,
    minHeight: "170px",
    backgroundColor: "#ffffff",
  };

  const numberValue = (value: string) => Number(value || 0);

  const { city: cityForTaxwareControle, zip: zipForTaxwareControle } =
    getTaxwareLocationForDossier(dossier);
  const isTaxSimulationReady = isDossierReadyForTaxSimulation(dossier);
  const variantSimulationReadiness = variants.map((variant) => ({
    id: variant.id,
    label: getVariantDisplayLabel(variant),
    isReady: isDossierReadyForTaxSimulation(variant.dossier),
  }));
  const variantsNotReadyForSimulation = variantSimulationReadiness.filter((variant) => !variant.isReady);
  const isGlobalTaxSimulationReady =
    variantSimulationReadiness.length > 0 && variantsNotReadyForSimulation.length === 0;
  const simulatedVariantsCount = variants.filter(
    (variant) =>
      Boolean(variant.taxResult) ||
      Boolean(variant.taxResultSansOptimisation) ||
      Boolean(variant.taxResultAvecDeductionsEstime)
  ).length;
  const taxSimulationMissingRequirementsMessage =
    variantsNotReadyForSimulation.length > 0
      ? `Renseignez le NPA et la commune fiscale pour : ${variantsNotReadyForSimulation
          .map((variant) => variant.label)
          .join(", ")}.`
      : "Renseignez au moins le NPA et la commune fiscale avant de lancer la simulation fiscale.";

  const taxwarePayloadControle = buildTaxwarePayload({
    realEstates: realEstatesTaxware,
    zip: zipForTaxwareControle,
    city: cityForTaxwareControle,
    year: 2026,
    partnership: dossier.famille.aConjoint ? "Marriage" : "Single",
    childrenCount: dossier.famille.nombreEnfants,
    netWages: dossier.revenus.salaire || 0,
    pensionIncome: (dossier.revenus.avs || 0) + (dossier.revenus.lpp || 0),
    hasOasiPensions: (dossier.revenus.avs || 0) > 0,
    otherIncome: 0,
    thirdPillar: dossier.fiscalite.troisiemePilierSimule || 0,
    lppBuyback: dossier.fiscalite.rachatLpp || 0,
    assetIncome: dossier.revenus.autresRevenus || 0,
    miscIncome: 0,
    miscExpenses: chargesDeductiblesTaxware,
    debtInterests: interetsHypothecairesDeductibles,
    spouseNetWages: 0,
    spousePensionIncome: 0,
    spouseHasOasiPensions: false,
    spouseOtherIncome: 0,
    spouseThirdPillar: 0,
    spouseLppBuyback: 0,
    assets: fortuneFiscaleCalcule || 0,
    debts: totalDettesCalcule || 0,
  });

  const taxwarePayloadJson = JSON.stringify(taxwarePayloadControle, null, 2);
  const vaudPayloadChildrenCountSent = getFirstDefinedValueByPaths(
    taxwarePayloadControle as Record<string, any>,
    ["NumChildren", "ChildrenCount"]
  );
  const vaudPayloadPartnershipSent = getFirstDefinedValueByPaths(
    taxwarePayloadControle as Record<string, any>,
    ["Partnership"]
  );
  const vaudPayloadExpectedChildrenKey = "NumChildren";
  const vaudPayloadHasNumChildren =
    getRecordValueByPath(taxwarePayloadControle as Record<string, any>, "NumChildren") !==
    undefined;
  const vaudPayloadHasChildrenCount =
    getRecordValueByPath(taxwarePayloadControle as Record<string, any>, "ChildrenCount") !==
    undefined;
  const vaudPayloadActualChildrenKey = vaudPayloadHasNumChildren && vaudPayloadHasChildrenCount
    ? "NumChildren + ChildrenCount"
    : vaudPayloadHasNumChildren
      ? "NumChildren"
      : vaudPayloadHasChildrenCount
        ? "ChildrenCount"
        : "aucune clé enfant";
  const vaudPayloadChildrenDuplicateState =
    vaudPayloadHasNumChildren && vaudPayloadHasChildrenCount ? "Oui" : "Non";
  const vaudPayloadIccTariff = getFirstDefinedValueByPaths(
    taxwarePayloadControle as Record<string, any>,
    ["TariffCanton", "IccTariff", "Tariff", "IncomeTaxParameters.Tariff"]
  );
  const vaudPayloadFederalTariff = getFirstDefinedValueByPaths(
    taxwarePayloadControle as Record<string, any>,
    ["TariffFederal", "IfdTariff", "FederalTariff"]
  );

  const handleNpaChange = (npa: string) => {
    const match = (zipToFiscal as ZipFiscalRow[]).find((item) => item.zip === npa);

    if (match) {
      setDossier({
        ...dossier,
        identite: {
          ...dossier.identite,
          npa,
          commune: match.locality || "",
          canton: match.fiscalCanton || match.localityCanton || "",
          communeFiscale: match.fiscalCommune || "",
          cantonFiscal: match.fiscalCanton || "",
          taxwareZip: npa,
          taxwareCity: match.fiscalCommune || "",
        },
      });
    } else {
      setDossier({
        ...dossier,
        identite: {
          ...dossier.identite,
          npa,
          commune: "",
          canton: "",
          communeFiscale: "",
          cantonFiscal: "",
          taxwareZip: npa,
          taxwareCity: "",
        },
      });
    }
  };

  const buildDirectBaseTaxwareRequestForDossier = (
    dossierForSimulation: DossierClient,
    params: {
      miscIncome: number;
      assets: number;
    }
  ) => {
    const { city, zip } = getTaxwareLocationForDossier(dossierForSimulation);

    return {
      realEstates: [],
      zip,
      city,
      partnership: (dossierForSimulation.famille.aConjoint ? "Marriage" : "Single") as
        | "Marriage"
        | "Single",
      childrenCount: dossierForSimulation.famille.nombreEnfants,
      netWages: 0,
      pensionIncome: 0,
      hasOasiPensions: false,
      otherIncome: 0,
      thirdPillar: 0,
      lppBuyback: 0,
      assetIncome: 0,
      miscIncome: Math.max(0, Math.round(params.miscIncome)),
      miscExpenses: 0,
      debtInterests: 0,
      spouseNetWages: 0,
      spousePensionIncome: 0,
      spouseHasOasiPensions: false,
      spouseOtherIncome: 0,
      spouseThirdPillar: 0,
      spouseLppBuyback: 0,
      assets: Math.max(0, Math.round(params.assets)),
      debts: 0,
    };
  };

  const assertTaxwareSuccess = (result: any, contextLabel: string) => {
    if (result?.raw?.error) {
      throw new Error(`${contextLabel}: ${JSON.stringify(result.raw)}`);
    }
  };

  const resolveTaxwareTarget = async (params: {
    label: string;
    targetValue: number;
    metric: (result: any) => number | null | undefined;
    buildRequest: (inputValue: number) => any;
    maxIterations?: number;
  }) => {
    const targetValue = Math.max(0, Math.round(params.targetValue));
    let driverValue = targetValue;
    let previousDelta: number | null = null;
    let bestResult: any = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    const maxIterations = params.maxIterations ?? 6;

    for (let attempt = 0; attempt < maxIterations; attempt += 1) {
      const result = await callTaxware(params.buildRequest(driverValue));
      assertTaxwareSuccess(result, params.label);

      const observedRaw = params.metric(result);
      const observed = typeof observedRaw === "number" ? observedRaw : 0;
      const delta = targetValue - observed;
      const distance = Math.abs(delta);

      if (distance < bestDistance) {
        bestDistance = distance;
        bestResult = {
          ...result,
          raw: {
            ...result.raw,
            calibration: {
              label: params.label,
              driverValue,
              observed,
              targetValue,
              attempt,
            },
          },
        };
      }

      if (distance <= 1) {
        return bestResult;
      }

      if (previousDelta !== null && Math.abs(previousDelta) === distance) {
        driverValue = Math.max(0, driverValue + Math.sign(delta));
      } else {
        driverValue = Math.max(0, driverValue + delta);
      }

      previousDelta = delta;
    }

    return bestResult;
  };

  const runTaxSimulationForVariant = async (variant: ScenarioVariant) => {
    const dossierForSimulation = variant.dossier;
    const comparisonScenarios = getComparisonScenarios(dossierForSimulation);
    const immobilierSimulationDelta = getSimulationImmobilierDelta(dossierForSimulation);

    const comparisonScenarioEntries = await Promise.all(
      comparisonScenarios.map(async (scenario) => {
        const immobilierDelta = scenario.key === "reference" ? 0 : immobilierSimulationDelta;
        const taxableIncomeFederal = Math.max(
          0,
          (dossierForSimulation.fiscalite.revenuImposableIfd || 0) -
            scenario.thirdPillar -
            scenario.lppBuyback +
            scenario.manualAdjustment +
            immobilierDelta +
            (dossierForSimulation.fiscalite.correctionFiscaleManuelleIfd || 0)
        );
        const taxableIncomeCantonal = Math.max(
          0,
          (dossierForSimulation.fiscalite.revenuImposable || 0) -
            scenario.thirdPillar -
            scenario.lppBuyback +
            scenario.manualAdjustment +
            immobilierDelta +
            (dossierForSimulation.fiscalite.correctionFiscaleManuelleCanton || 0)
        );
        const taxableAssets = Math.max(
          0,
          (dossierForSimulation.fiscalite.fortuneImposableActuelleSaisie || 0) +
            (dossierForSimulation.fiscalite.correctionFiscaleManuelleFortune || 0)
        );

        const buildVariantRequest = (params: { miscIncome: number; assets: number }) =>
          buildDirectBaseTaxwareRequestForDossier(dossierForSimulation, params);

        const baseResult = await resolveTaxwareTarget({
          label: `${variant.id}-${scenario.key}-canton`,
          targetValue: taxableIncomeCantonal,
          metric: (result) => result?.normalized?.taxableIncomeCantonal,
          buildRequest: (miscIncome) =>
            buildVariantRequest({
              miscIncome,
              assets: taxableAssets,
            }),
        });

        const ifdResult = await resolveTaxwareTarget({
          label: `${variant.id}-${scenario.key}-ifd`,
          targetValue: taxableIncomeFederal,
          metric: (result) => result?.normalized?.taxableIncomeFederal,
          buildRequest: (miscIncome) =>
            buildVariantRequest({
              miscIncome,
              assets: taxableAssets,
            }),
        });

        const fortuneResult = await resolveTaxwareTarget({
          label: `${variant.id}-${scenario.key}-fortune`,
          targetValue: taxableAssets,
          metric: (result) => result?.normalized?.taxableAssets,
          buildRequest: (assets) =>
            buildVariantRequest({
              miscIncome: taxableIncomeCantonal,
              assets,
            }),
        });

        return [
          scenario.key,
          composeCorrectedTaxwareResult({
            baseResult,
            ifdResult,
            cantonResult: baseResult,
            fortuneResult,
            debug: {
              source: "taxware-direct-bases",
              targets: {
                taxableIncomeFederal,
                taxableIncomeCantonal,
                taxableAssets,
                immobilierDelta,
              },
              payloads: {
                canton: buildVariantRequest({
                  miscIncome: baseResult?.raw?.calibration?.driverValue ?? taxableIncomeCantonal,
                  assets: taxableAssets,
                }),
                ifd: buildVariantRequest({
                  miscIncome: ifdResult?.raw?.calibration?.driverValue ?? taxableIncomeFederal,
                  assets: taxableAssets,
                }),
                fortune: buildVariantRequest({
                  miscIncome: taxableIncomeCantonal,
                  assets: fortuneResult?.raw?.calibration?.driverValue ?? taxableAssets,
                }),
              },
            },
          }),
        ] as const;
      })
    );

    const comparisonTaxResults = Object.fromEntries(comparisonScenarioEntries);
    const baselineResult = comparisonTaxResults.reference;
    const mixedResult = comparisonTaxResults.mixed;
    const ajustementResult = comparisonTaxResults["manual-adjustment"];

    return {
      ...variant,
      taxResultSansOptimisation: baselineResult,
      taxResultAvecDeductionsEstime: mixedResult,
      taxResult: mixedResult,
      taxResultAjustementManuel: ajustementResult,
      taxResultCorrectionFiscaleManuelle: null,
      comparisonTaxResults,
    };
  };

  const handleTaxSimulation = async (options?: {
    silentMissingRequirements?: boolean;
    targetVariantIds?: string[];
    navigateToResults?: boolean;
  }) => {
    const requestedVariantIds = options?.targetVariantIds;
    const targetVariants =
      requestedVariantIds && requestedVariantIds.length > 0
        ? variants.filter((variant) => requestedVariantIds.includes(variant.id))
        : variants;

    const notReadyVariants = targetVariants.filter(
      (variant) => !isDossierReadyForTaxSimulation(variant.dossier)
    );

    if (notReadyVariants.length > 0) {
      if (!options?.silentMissingRequirements) {
        alert(
          `Renseignez le NPA et la commune fiscale pour : ${notReadyVariants
            .map((variant) => getVariantDisplayLabel(variant))
            .join(", ")}.`
        );
      }
      return false;
    }

    if (targetVariants.length === 0) {
      return false;
    }

    setIsSimulatingVariants(true);
    setSimulationStatusMessage(
      targetVariants.length > 1
        ? `Calcul des ${targetVariants.length} variantes en cours...`
        : `Calcul de ${getVariantDisplayLabel(targetVariants[0])} en cours...`
    );

    try {
      const simulatedVariants = await Promise.all(
        targetVariants.map((variant) => runTaxSimulationForVariant(variant))
      );
      const simulatedVariantsById = new Map(
        simulatedVariants.map((variant) => [variant.id, variant] as const)
      );

      setVariants((current) =>
        current.map((variant) => simulatedVariantsById.get(variant.id) ?? variant)
      );

      simulatedVariants.forEach((variant) => {
        autoSimulationStatusRef.current[variant.id] = "done";
      });

      if (options?.navigateToResults) {
        setActiveSectionId("resultats");
      }

      if (options?.navigateToResults && typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }

      return true;
    } catch (error) {
      console.error("Erreur lors de la simulation fiscale TaxWare :", error);
      alert("Erreur lors de la simulation fiscale.");
      return false;
    } finally {
      setIsSimulatingVariants(false);
      setSimulationStatusMessage("");
    }
  };

  const runAutoTaxSimulation = useEffectEvent(async (variantId: string) => {
    if (autoSimulationStatusRef.current[variantId]) {
      return;
    }

    autoSimulationStatusRef.current[variantId] = "running";
    const didRun = await handleTaxSimulation({
      silentMissingRequirements: true,
      targetVariantIds: [variantId],
    });

    if (didRun) {
      autoSimulationStatusRef.current[variantId] = "done";
      return;
    }

    delete autoSimulationStatusRef.current[variantId];
  });

  useEffect(() => {
    const hasExistingResult =
      activeVariant.taxResult ||
      activeVariant.taxResultSansOptimisation ||
      activeVariant.taxResultAvecDeductionsEstime;

    if (hasExistingResult) {
      autoSimulationStatusRef.current[activeVariant.id] = "done";
      return;
    }

    if (!isTaxSimulationReady) {
      delete autoSimulationStatusRef.current[activeVariant.id];
      return;
    }

    void runAutoTaxSimulation(activeVariant.id);
  }, [
    activeVariant.id,
    activeVariant.taxResult,
    activeVariant.taxResultSansOptimisation,
    activeVariant.taxResultAvecDeductionsEstime,
    isTaxSimulationReady,
    runAutoTaxSimulation,
  ]);

  const niveauDossier =
    dossier.identite.age > 60 ||
      dossier.identite.etatCivil === "Marié" ||
      totalRevenusCalcule > 150000 ||
      fortuneBruteCalcule > 1000000 ||
      totalDettesCalcule > 500000
      ? "Élevée"
      : "Standard";

  let syntheseAutomatique = "";

  const prioritesAutomatiques: string[] = [];
  const vigilancesAutomatiques: string[] = [];

  if (dossier.identite.age > 60) {
    prioritesAutomatiques.push("Préparer la retraite");
    prioritesAutomatiques.push("Anticiper le décaissement du patrimoine");
    vigilancesAutomatiques.push("Maintenir la stabilité financière à long terme");
  }

  if (dossier.identite.etatCivil === "Marié") {
    prioritesAutomatiques.push("Protéger le conjoint");
    vigilancesAutomatiques.push("Coordonner les décisions patrimoniales du ménage");
  }

  if (totalRevenusCalcule > 150000) {
    prioritesAutomatiques.push("Optimiser la charge fiscale");
    vigilancesAutomatiques.push("Éviter une pression fiscale durablement élevée");
  }

  if (fortuneBruteCalcule > 1000000) {
    prioritesAutomatiques.push("Structurer le patrimoine global");
    vigilancesAutomatiques.push("Préserver la cohérence patrimoniale à long terme");
  }

  if (totalDettesCalcule > 500000) {
    prioritesAutomatiques.push("Surveiller le poids de l’endettement");
    vigilancesAutomatiques.push("Évaluer l’impact des dettes sur la flexibilité financière");
  }

  if (margeAnnuelleCalcule < 0) {
    prioritesAutomatiques.push("Réduire la pression budgétaire");
    vigilancesAutomatiques.push("Risque de déséquilibre annuel entre revenus et charges");
  }

  if (
    dossier.identite.age <= 60 &&
    dossier.identite.etatCivil !== "Marié" &&
    totalRevenusCalcule <= 150000 &&
    fortuneBruteCalcule <= 1000000 &&
    totalDettesCalcule <= 500000
  ) {
    prioritesAutomatiques.push("Optimiser progressivement la situation financière");
    vigilancesAutomatiques.push("Structurer le patrimoine pour les étapes futures");
  }

  prioritesAutomatiques.push("Améliorer la lisibilité globale du dossier");

  if (margeAnnuelleCalcule < 0) {
    syntheseAutomatique =
      "La situation révèle une tension budgétaire annuelle, ce qui nécessite une lecture attentive des charges, des revenus et de la capacité de maintien du niveau de vie.";
  } else if (dossier.identite.age > 60 && dossier.identite.etatCivil === "Marié") {
    syntheseAutomatique =
      "La situation présente un niveau de complexité élevé, avec des enjeux liés à la préparation de la retraite, à la protection du conjoint et à la structuration patrimoniale.";
  } else if (totalRevenusCalcule > 150000) {
    syntheseAutomatique =
      "La situation met en évidence un niveau de revenus important, ce qui justifie une attention particulière à l’optimisation fiscale et à la cohérence des décisions patrimoniales.";
  } else if (fortuneBruteCalcule > 1000000) {
    syntheseAutomatique =
      "La situation patrimoniale est significative et nécessite une lecture structurée afin d’assurer cohérence, protection et efficacité à long terme.";
  } else if (dossier.identite.age > 60) {
    syntheseAutomatique =
      "La situation présente des enjeux importants liés à la retraite, à la prévoyance et à l’organisation future du patrimoine.";
  } else if (dossier.identite.etatCivil === "Marié") {
    syntheseAutomatique =
      "La situation nécessite une attention particulière à la protection du conjoint, à la coordination patrimoniale et à la cohérence des décisions financières.";
  } else {
    syntheseAutomatique =
      "La situation peut être abordée dans une logique d’optimisation, de structuration progressive et de préparation des étapes futures.";
  }

  const strategicRecommendationContext = {
    dossier,
    totalRevenus: totalRevenusCalcule,
    fortuneBrute: fortuneBruteCalcule,
    impotsEstimes: dossier.fiscalite.impotsEstimes || 0,
    troisiemePilierSimule: dossier.fiscalite.troisiemePilierSimule || 0,
    rachatLpp: dossier.fiscalite.rachatLpp || 0,
    age: dossier.identite.age,
    isMarried: dossier.identite.etatCivil === "Marié",
  };

  const profilsClient = getClientProfiles(strategicRecommendationContext);
  const advisoryToneProfile = getAdvisoryToneProfile(strategicRecommendationContext);
  const recommandationsStrategiques = getStrategicRecommendations(
    strategicRecommendationContext
  ).slice(0, 4);
  const recommandationsFiscalite = getStrategicRecommendationsByTheme(
    strategicRecommendationContext,
    "fiscalite"
  );
  const recommandationsFortune = getStrategicRecommendationsByTheme(
    strategicRecommendationContext,
    "fortune"
  );
  const recommandationsRetraite = getStrategicRecommendationsByTheme(
    strategicRecommendationContext,
    "retraite"
  );
  const summaryToneIntro = getToneSummaryIntro(advisoryToneProfile);
  const recommendationToneIntro = getToneRecommendationIntro(advisoryToneProfile);
  const conclusionStrategique = getToneConclusion(advisoryToneProfile);
  const diagnosticStrategique = `Profil dominant : ${profilsClient.join(" / ")}. Le dossier combine ${formatMontantCHF(
    totalRevenusCalcule
  )} de revenus annuels, ${formatMontantCHF(
    fortuneBruteCalcule
  )} de patrimoine brut et un impot de reference de ${formatMontantCHF(
    dossier.fiscalite.impotsEstimes || 0
  )}.`;
  const syntheseAutomatiquePersonnalisee = `${summaryToneIntro} ${syntheseAutomatique}`;
  const recommandationFiscalePrincipale = recommandationsFiscalite[0];
  const recommandationFortunePrincipale = recommandationsFortune[0];
  const recommandationRetraitePrincipale = recommandationsRetraite[0];
  const calculationDateLabel = new Intl.DateTimeFormat("fr-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date());

  const sectionsAutomatiques = [
    {
      titre: "Fiscalité",
      situation: `Revenu imposable IFD : ${formatMontantCHF(
        revenuImposableIfdReference
      )}. Revenu imposable Canton / Commune : ${formatMontantCHF(
        revenuImposableReference
      )}. Fortune imposable actuelle saisie : ${formatMontantCHF(
        fortuneImposableReference
      )}.`,
      analyse:
        recommandationFiscalePrincipale?.diagnostic ||
        "Une lecture ciblee de la fiscalite permet d identifier les leviers concrets d amelioration.",
      transformation: recommandationFiscalePrincipale
        ? toneRecommendationText(
            advisoryToneProfile,
            recommandationFiscalePrincipale.recommendation
          )
        : "Activer progressivement les leviers fiscaux les plus pertinents selon la situation personnelle.",
      resultat:
        recommandationFiscalePrincipale?.expectedResult ||
        `Une meilleure maitrise de la charge fiscale. Impot estime actuel : ${formatMontantCHF(
          impotEstimeCalcule
        )}.`,
    },
    {
      titre: "Fortune",
      situation:
        fortuneBruteCalcule > 1000000
          ? "Le patrimoine global est significatif et merite une structuration attentive."
          : "Le patrimoine doit etre structure de maniere coherente pour soutenir les objectifs futurs.",
      analyse:
        recommandationFortunePrincipale?.diagnostic ||
        "La structuration patrimoniale doit renforcer la lisibilite, la souplesse et la capacite d evolution.",
      transformation: recommandationFortunePrincipale
        ? toneRecommendationText(
            advisoryToneProfile,
            recommandationFortunePrincipale.recommendation
          )
        : "Organiser le patrimoine de facon progressive afin d en ameliorer la lisibilite et l efficacite.",
      resultat:
        recommandationFortunePrincipale?.expectedResult ||
        "Un patrimoine plus lisible, plus coherent et mieux aligne avec les objectifs du client.",
    },
    {
      titre: "Retraite",
      situation:
        dossier.identite.age > 60
          ? "La retraite constitue un enjeu central du dossier, avec un besoin accru de visibilite sur les revenus futurs."
          : "La retraite peut encore être preparée dans une logique d'anticipation et de montée en puissance progressive.",
      analyse:
        recommandationRetraitePrincipale?.diagnostic ||
        "Une preparation precoce permet d ameliorer fortement la marge de manœuvre future.",
      transformation: recommandationRetraitePrincipale
        ? toneRecommendationText(
            advisoryToneProfile,
            recommandationRetraitePrincipale.recommendation
          )
        : "Mettre en place une strategie de preparation retraite progressive, structuree et adaptee au profil.",
      resultat:
        recommandationRetraitePrincipale?.expectedResult ||
        "Une vision plus claire de l'avenir et une meilleure capacite de decision.",
    },
  ];
  const journeyNavigation = [
    { id: "informations-generales", step: "1", label: "Situation" },
    { id: "revenus", step: "2", label: "Revenus" },
    { id: "fortune", step: "3", label: "Fortune" },
    { id: "charges", step: "4", label: "Charges" },
    { id: "fiscalite", step: "5", label: "Fiscalité" },
    { id: "resultats", step: "6", label: "Résultats" },
    { id: "recommandation", step: "7", label: "Recommandation" },
  ];
  const cockpitCards = [
    {
      label: "Variante active",
      value: getVariantDisplayLabel(activeVariant),
      helper: "Scénario actuellement consulté",
    },
    {
      label: "Date du calcul",
      value: calculationDateLabel,
      helper: "Lecture figée à l’instant du calcul",
    },
    {
      label: "Fiscalité estimée",
      value:
        typeof getVariantTaxTotal(activeVariant) === "number"
          ? formatMontantCHFArrondi(getVariantTaxTotal(activeVariant) as number)
          : "Simulation requise",
      helper: "Valeur calculée par la logique actuelle",
    },
    {
      label: "Objectif dominant",
      value: objectifPrincipalSynthese,
      helper: "Synthèse automatique du dossier",
    },
  ];
  const workflowStages = [
    {
      step: "1",
      title: "Saisir",
      text: "Complétez les rubriques métier sans perdre la lecture d’ensemble du dossier.",
    },
    {
      step: "2",
      title: "Simuler",
      text: "Un seul clic relance maintenant toutes les variantes existantes avec leurs propres données.",
    },
    {
      step: "3",
      title: "Comparer",
      text: "Lisez immédiatement l’écart fiscal, le régime immobilier et la meilleure variante disponible.",
    },
    {
      step: "4",
      title: "Décider",
      text: "Servez-vous de la synthèse, des graphiques et des recommandations pour conclure.",
    },
  ];
  const workflowDashboardCards = [
    {
      label: "Variantes prêtes",
      value: `${variantSimulationReadiness.length - variantsNotReadyForSimulation.length}/${variantSimulationReadiness.length}`,
      helper:
        variantsNotReadyForSimulation.length === 0
          ? "Toutes les variantes peuvent être calculées"
          : "Certaines variantes doivent encore être complétées",
    },
    {
      label: "Calculs disponibles",
      value: `${simulatedVariantsCount}/${variants.length}`,
      helper: "Nombre de variantes déjà simulées dans la session",
    },
    {
      label: "Meilleure lecture",
      value: bestVariant?.label ?? "À calculer",
      helper: "Scénario actuellement le plus favorable selon l’impôt total",
    },
    {
      label: "Régime actif",
      value: regimeImmobilierLabel,
      helper: "Régime immobilier de la variante actuellement ouverte",
    },
  ];
  const simulationPrimaryButtonLabel = isSimulatingVariants
    ? "Calcul des variantes en cours..."
    : "Simuler la fiscalité";
  const simulationPrimaryHelper = isSimulatingVariants
    ? simulationStatusMessage
    : isGlobalTaxSimulationReady
      ? "Le calcul relance automatiquement toutes les variantes existantes."
      : taxSimulationMissingRequirementsMessage;
  const canExportPdf = simulatedVariantsCount > 0;
  const activeJourneyStep = journeyNavigation.find((item) => item.id === activeSectionId) ?? null;
  const activeJourneyStepIndex = activeJourneyStep
    ? journeyNavigation.findIndex((item) => item.id === activeJourneyStep.id)
    : -1;
  const isIntroActive = activeSectionId === INTRO_SECTION_ID;
  const activeJourneyLabel = activeJourneyStep?.label ?? "Introduction";
  const activeJourneyProgressLabel = activeJourneyStep
    ? `Étape ${activeJourneyStep.step} sur ${journeyNavigation.length}`
    : "Introduction avant l’étape 1";
  const activeVariantTotalTax = getVariantTaxTotal(activeVariant);
  const activeVariantSavingsVsBase =
    typeof referenceVariantTotalTax === "number" && typeof activeVariantTotalTax === "number"
      ? referenceVariantTotalTax - activeVariantTotalTax
      : null;
  const shouldShowTopResultsRibbon = simulatedVariantsCount > 0;
  const topResultsCards = [
    {
      label: "Impôt total",
      value:
        typeof activeVariantTotalTax === "number"
          ? formatMontantCHFArrondi(activeVariantTotalTax)
          : "Simulation requise",
      helper: `Lecture de ${getVariantDisplayLabel(activeVariant)}`,
    },
    {
      label: "Meilleure variante",
      value: bestVariant?.label ?? "À calculer",
      helper:
        typeof bestVariantTotalTax === "number"
          ? formatMontantCHFArrondi(bestVariantTotalTax)
          : "En attente de simulation",
    },
    {
      label: "Écart vs Base",
      value:
        typeof activeVariantSavingsVsBase === "number"
          ? formatMontantCHFSigne(activeVariantSavingsVsBase)
          : "Indisponible",
      helper: "Économie ou surcoût de la variante active",
    },
    {
      label: "Section active",
      value: activeJourneyLabel,
      helper: activeJourneyProgressLabel,
    },
  ];
  const dynamicAdvisoryPreview = buildDynamicAdvisoryPreview({
    age: dossier.identite.age,
    partnership: dossier.famille.aConjoint ? "Marriage" : "Single",
    childrenCount: dossier.famille.nombreEnfants,
    totalIncome: totalRevenusCalcule,
    totalWealth: fortuneBruteCalcule,
    hasRealEstate: Boolean(
      (dossier.fortune.immobilier || 0) > 0 || habitationPropreActive || biensRendementActifs
    ),
    realEstateRegime: dossier.immobilier.regimeFiscal,
    taxGainVsBase: bestVariantGainVsBase,
    variantSpread,
    recommendedVariantLabel: bestVariant?.label ?? null,
    recommendedVariantRegime: bestVariantState?.dossier.immobilier.regimeFiscal ?? null,
    objectivePrincipal: objectifPrincipalSynthese,
    annualMargin: margeAnnuelleCalcule,
    totalTax:
      bestVariantDisplayedTaxResult?.normalized?.totalTax ??
      activeVariantDisplayedTaxResult?.normalized?.totalTax ??
      null,
    hasRetirementObjective: dossier.objectifs.preparerRetraite,
    hasConjointProtectionObjective: dossier.objectifs.protegerConjoint,
    hasTransmissionObjective: dossier.objectifs.transmettre,
    hasStructuringObjective: dossier.objectifs.structurerPatrimoine,
    hasTaxOptimizationObjective: dossier.objectifs.reduireImpots,
  });
  const dynamicPdfLogicParagraphs = dynamicAdvisoryPreview.blocks.recommendationLogic
    .map((item) => item.text.trim())
    .filter(Boolean);
  const dynamicPdfPriorities = dynamicAdvisoryPreview.blocks.actionPriorities
    .map((item) => item.text.trim())
    .filter(Boolean);
  const dynamicPdfVigilance = dynamicAdvisoryPreview.blocks.vigilancePoints
    .map((item) => item.text.trim())
    .filter(Boolean);
  const dynamicPdfConclusion = dynamicAdvisoryPreview.blocks.conclusion.text.trim();
  const variantChartCandidates = variants
    .map((variant) => {
      const totalTax = getVariantTaxTotal(variant);

      if (typeof totalTax !== "number" || totalTax <= 0) {
        return null;
      }

      return {
        id: variant.id,
        label: getVariantDisplayLabel(variant),
        value: totalTax,
        isBase: variant.id === referenceVariant.id,
        isRecommended: variant.id === bestVariantState.id,
      };
    })
    .filter((variant): variant is NonNullable<typeof variant> => Boolean(variant));
  const baseVariantChart = variantChartCandidates.find((variant) => variant.isBase) ?? variantChartCandidates[0] ?? null;
  const recommendedVariantChart =
    variantChartCandidates.find((variant) => variant.isRecommended) ?? baseVariantChart;
  const intermediaryVariantChart =
    variantChartCandidates.find(
      (variant) => variant.id !== baseVariantChart?.id && variant.id !== recommendedVariantChart?.id
    ) ?? null;
  const variantComparisonChartData = [baseVariantChart, intermediaryVariantChart, recommendedVariantChart]
    .filter((variant): variant is NonNullable<typeof variant> => Boolean(variant))
    .map((variant) => ({
      label: variant.label,
      value: variant.value,
      color: variant.isRecommended ? "#2f7d5a" : variant.isBase ? "#94a3b8" : "#3b82f6",
      accentLabel: variant.isRecommended ? "Recommandée" : variant.isBase ? "Base" : "Alternative",
    }));
  const taxBreakdownChartData = [
    {
      label: "Impôt fédéral",
      value: bestVariantDisplayedTaxResult?.normalized?.federalTax || 0,
      color: "#1f4c7a",
    },
    {
      label: "Impôt cantonal / communal",
      value: bestVariantDisplayedTaxResult?.normalized?.cantonalCommunalTax || 0,
      color: "#6b7280",
    },
    {
      label: "Impôt sur la fortune",
      value: bestVariantDisplayedTaxResult?.normalized?.wealthTax || 0,
      color: "#b88a44",
    },
  ].filter((item) => item.value > 0);
  const patrimonyStructureChartData = [
    {
      label: "Liquidités",
      value: Math.max(0, referenceLiquiditesAjusteesCalcule),
      color: "#94a3b8",
    },
    {
      label: "Immobilier (Valeur fiscale)",
      value: referenceDossier.fortune.immobilier || 0,
      color: "#1f4c7a",
    },
    {
      label: "Fortune mobilière",
      value: referenceDossier.fortune.titres || 0,
      color: "#b88a44",
    },
    {
      label: "Prévoyance",
      value: referenceTroisiemePilierPatrimonialCalcule + referenceFortuneLppPatrimonialeCalcule,
      color: "#2f7d5a",
    },
  ].filter((item) => item.value > 0);
  const pdfPayload = {
    title: "FIPLA Dashboard",
    clientName:
      `${dossier.identite.prenom} ${dossier.identite.nom}`.trim() || "Client non renseigné",
    reportDate: calculationDateLabel,
    cabinetName: "Cabinet Russo",
    summary: {
      situation: syntheseAutomatiquePersonnalisee,
      problem:
        lectureImmobiliereSynthese[0] ||
        diagnosticStrategique ||
        "La situation nécessite une lecture consolidée des impacts fiscaux et patrimoniaux.",
      recommendation:
        resumeComparatifClient?.summaryLines[3] ||
        recommandationsStrategiques[0]?.recommendation ||
        conclusionStrategique,
      estimatedGain:
        bestVariant && typeof referenceVariantTotalTax === "number" && typeof bestVariant.totalTax === "number"
          ? formatMontantCHFSigne(referenceVariantTotalTax - bestVariant.totalTax)
          : "Indisponible",
    },
    currentSituation: {
      revenus: [
        { label: "Salaire", value: formatMontantCHF(referenceDossier.revenus.salaire) },
        { label: "AVS", value: formatMontantCHF(referenceDossier.revenus.avs) },
        { label: "LPP", value: formatMontantCHF(referenceDossier.revenus.lpp) },
        { label: "Autres revenus", value: formatMontantCHF(referenceDossier.revenus.autresRevenus) },
        { label: "Total revenus", value: formatMontantCHF(referenceTotalRevenusCalcule) },
      ],
      fortune: [
        { label: "Liquidités", value: formatMontantCHF(referenceDossier.fortune.liquidites) },
        { label: "Fortune mobilière", value: formatMontantCHF(referenceDossier.fortune.titres) },
        { label: "3e pilier", value: formatMontantCHF(referenceTroisiemePilierPatrimonialCalcule) },
        { label: "Immobilier", value: formatMontantCHF(referenceDossier.fortune.immobilier) },
        { label: "Fortune brute", value: formatMontantCHF(referenceFortuneBruteCalcule) },
        { label: "Fortune nette fiscale", value: formatMontantCHF(referenceFortuneNetteFiscaleCalcule) },
      ],
      charges: [
        { label: "Logement", value: formatMontantCHF(referenceDossier.charges.logement) },
        { label: "Primes maladie", value: formatMontantCHF(referenceDossier.charges.primesMaladie) },
        { label: "Frais de vie", value: formatMontantCHF(referenceDossier.charges.fraisVie) },
        { label: "Autres charges", value: formatMontantCHF(referenceDossier.charges.autresCharges) },
        { label: "Total charges", value: formatMontantCHF(referenceTotalChargesCalcule) },
        { label: "Marge annuelle", value: formatMontantCHF(referenceMargeAnnuelleCalcule) },
      ],
      fiscalite: [
        {
          label: "Revenu imposable IFD",
          value: formatMontantCHF(
            referenceVariantDisplayedTaxResult?.normalized?.taxableIncomeFederal ?? revenuImposableCorrigeIfd
          ),
        },
        {
          label: "Revenu imposable Canton / Commune",
          value: formatMontantCHF(
            referenceVariantDisplayedTaxResult?.normalized?.taxableIncomeCantonal ?? revenuImposableCorrigeCanton
          ),
        },
        {
          label: "Fortune imposable",
          value: formatMontantCHF(
            referenceVariantDisplayedTaxResult?.normalized?.taxableAssets ?? fortuneImposableCorrige
          ),
        },
        {
          label: "Objectif principal",
          value: objectifPrincipalSynthese,
        },
      ],
    },
    taxDetails: [
      {
        label: "Impôt fédéral",
        value: formatMontantCHF(referenceVariantDisplayedTaxResult?.normalized?.federalTax || 0),
      },
      {
        label: "Impôt cantonal / communal",
        value: formatMontantCHF(referenceVariantDisplayedTaxResult?.normalized?.cantonalCommunalTax || 0),
      },
      {
        label: "Impôt sur la fortune",
        value: formatMontantCHF(referenceVariantDisplayedTaxResult?.normalized?.wealthTax || 0),
      },
      {
        label: "Impôt total",
        value: formatMontantCHF(referenceVariantDisplayedTaxResult?.normalized?.totalTax || 0),
      },
    ],
    recommendedTaxDetails: [
      {
        label: "Impôt fédéral",
        value: formatMontantCHF(bestVariantDisplayedTaxResult?.normalized?.federalTax || 0),
      },
      {
        label: "Impôt cantonal / communal",
        value: formatMontantCHF(bestVariantDisplayedTaxResult?.normalized?.cantonalCommunalTax || 0),
      },
      {
        label: "Impôt sur la fortune",
        value: formatMontantCHF(bestVariantDisplayedTaxResult?.normalized?.wealthTax || 0),
      },
      {
        label: "Impôt total",
        value: formatMontantCHF(bestVariantDisplayedTaxResult?.normalized?.totalTax || 0),
      },
    ],
    variants: variants.map((variant) => {
      const totalTax = getVariantTaxTotal(variant);
      const differenceVsBase =
        typeof referenceVariantTotalTax === "number" && typeof totalTax === "number"
          ? referenceVariantTotalTax - totalTax
          : null;

      return {
        label: getVariantDisplayLabel(variant),
        regime:
          variant.dossier.immobilier.regimeFiscal === "actuel"
            ? "Avant réforme"
            : "Après réforme",
        totalTax:
          typeof totalTax === "number" ? formatMontantCHFArrondi(totalTax) : "Simulation requise",
        difference:
          typeof differenceVsBase === "number"
            ? formatMontantCHFSigne(differenceVsBase)
            : "Indisponible",
        highlight:
          bestVariant?.id === variant.id
            ? "Meilleure option"
            : activeVariant.id === variant.id
              ? "Variante active"
              : "Comparaison",
      };
    }),
    realEstate: {
      currentRegime: "Régime actuel: maintien de la valeur locative et des charges retenues.",
      reformedRegime:
        "Régime réformé: simulation sans valeur locative avec ajustement des déductions liées à l’habitation propre.",
      impact: formatMontantCHFSigne(totalAjustementsImmobiliersSimulation),
      bullets:
        lectureImmobiliereSynthese.length > 0
          ? lectureImmobiliereSynthese
          : [
              `Impact fiscal immobilier simulé: ${formatMontantCHFSigne(
                totalAjustementsImmobiliersSimulation
              )}.`,
            ],
    },
    optimisations: [
      { label: "3e pilier", value: formatMontantCHF(dossier.fiscalite.troisiemePilierSimule) },
      { label: "Rachat LPP", value: formatMontantCHF(dossier.fiscalite.rachatLpp) },
      {
        label: "Ajustement manuel",
        value: formatMontantCHF(dossier.fiscalite.ajustementManuelRevenu),
      },
      {
        label: "Autres leviers",
        value:
          recommandationsStrategiques[0]?.recommendation ||
          "Optimisations conservées telles qu’affichées dans l’interface.",
      },
    ],
    charts: {
      variantComparison: variantComparisonChartData,
      taxBreakdown: taxBreakdownChartData,
      patrimonyStructure: patrimonyStructureChartData,
    },
    finalRecommendation: {
      intro: recommendationToneIntro,
      logicParagraphs: dynamicPdfLogicParagraphs,
      priorities: dynamicPdfPriorities,
      vigilance: dynamicPdfVigilance,
      conclusion: dynamicPdfConclusion || conclusionStrategique,
      useDynamicBlocks: true,
    },
  };
  const handleJourneyNavigation = (sectionId: string) => {
    setActiveSectionId(sectionId);
  };

  const handleContinueFromDecision = () => {
    if (!analysisMode) {
      return;
    }

    setIsDecisionHelpOpen(false);
    handleJourneyNavigation("informations-generales");
  };

  const handlePdfExport = async () => {
    if (!canExportPdf || isExportingPdf) {
      return;
    }

    try {
      setIsExportingPdf(true);
      generatePremiumPdf(pdfPayload);
    } finally {
      setIsExportingPdf(false);
    }
  };

  useEffect(() => {
    if (!activeStepViewportRef.current) {
      return;
    }

    activeStepViewportRef.current.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, [activeSectionId]);

  return (
    <div className="app-shell">
      <div className="app-shell__inner">
        <DecisionIntro
          analysisMode={analysisMode}
          isHelpOpen={isDecisionHelpOpen}
          onContinue={handleContinueFromDecision}
          onSelectMode={handleAnalysisModeSelection}
          onToggleHelp={() => setIsDecisionHelpOpen((current) => !current)}
        />

        <div className="cockpit-grid">
          {cockpitCards.map((card) => (
            <div key={card.label} className="cockpit-card">
              <div className="cockpit-card__label">{card.label}</div>
              <div className="cockpit-card__value">{card.value}</div>
              <div className="cockpit-card__helper">{card.helper}</div>
            </div>
          ))}
        </div>

        <section className="workflow-command" aria-label="Pilotage de la simulation">
          <div className="workflow-command__lead">
            <div className="workflow-command__eyebrow">Pilotage du workflow</div>
            <h2 className="workflow-command__title">Saisir, simuler, comparer, décider.</h2>
            <p className="workflow-command__text">
              Le parcours reste complet, mais l’action principale est désormais centralisée pour
              accélérer la lecture du dossier et la mise à jour de toutes les variantes.
            </p>

            <div className="workflow-command__actions">
                <button
                  type="button"
                  onClick={() => {
                    void handleTaxSimulation({ navigateToResults: true });
                  }}
                  disabled={!isGlobalTaxSimulationReady || isSimulatingVariants}
                  className="workflow-command__button"
                title={simulationPrimaryHelper}
              >
                {simulationPrimaryButtonLabel}
              </button>
              <div className="workflow-command__status">
                {simulationPrimaryHelper}
              </div>
            </div>
          </div>

          <div className="workflow-command__panel">
            {workflowDashboardCards.map((card) => (
              <div key={card.label} className="workflow-command__metric">
                <div className="workflow-command__metric-label">{card.label}</div>
                <div className="workflow-command__metric-value">{card.value}</div>
                <div className="workflow-command__metric-helper">{card.helper}</div>
              </div>
            ))}
          </div>

          <div className="workflow-stage-grid">
            {workflowStages.map((item) => (
              <div key={item.step} className="workflow-stage-card">
                <div className="workflow-stage-card__step">{item.step}</div>
                <div className="workflow-stage-card__title">{item.title}</div>
                <div className="workflow-stage-card__text">{item.text}</div>
              </div>
            ))}
          </div>
        </section>

        {shouldShowTopResultsRibbon && (
          <section className="results-ribbon" aria-label="Résultats immédiats">
            <div className="results-ribbon__header">
              <div>
                <div className="results-ribbon__eyebrow">Résultats immédiats</div>
                <h2 className="results-ribbon__title">Les indicateurs clés restent visibles en haut.</h2>
              </div>
              <div className="results-ribbon__helper">
                La simulation renvoie automatiquement vers la lecture des résultats consolidés.
              </div>
            </div>

            <div className="results-ribbon__metrics">
              {topResultsCards.map((card) => (
                <div key={card.label} className="results-ribbon__metric">
                  <div className="results-ribbon__metric-label">{card.label}</div>
                  <div className="results-ribbon__metric-value">{card.value}</div>
                  <div className="results-ribbon__metric-helper">{card.helper}</div>
                </div>
              ))}
            </div>

            <div className="results-ribbon__variants">
              {variantTotals.map((variant) => {
                const isBest = bestVariant?.id === variant.id;
                const isActive = activeVariant.id === variant.id;

                return (
                  <div
                    key={`${variant.id}-ribbon`}
                    className={`results-ribbon__variant${
                      isBest ? " results-ribbon__variant--best" : ""
                    }${isActive ? " results-ribbon__variant--active" : ""}`}
                  >
                    <div className="results-ribbon__variant-topline">
                      <strong>{variant.label}</strong>
                      <span>{isBest ? "Meilleure" : isActive ? "Active" : "Variante"}</span>
                    </div>
                    <div className="results-ribbon__variant-value">
                      {typeof variant.totalTax === "number"
                        ? formatMontantCHFArrondi(variant.totalTax)
                        : "En attente"}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <nav className="journey-nav" aria-label="Parcours de simulation">
          <div className="journey-nav__title">
            Parcours guidé
            <span className="journey-nav__title-meta">
              {activeJourneyProgressLabel}
            </span>
          </div>
          <div className="journey-nav__items">
            {journeyNavigation.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleJourneyNavigation(item.id)}
                className={`journey-nav__link${
                  item.id === activeSectionId ? " journey-nav__link--active" : ""
                }`}
                aria-current={item.id === activeSectionId ? "step" : undefined}
              >
                <span className="journey-nav__step">{item.step}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </nav>

        <GuidedSection
          id="optimisation"
          step="1"
          title="Optimisation et variantes"
          description="Cette zone sert à piloter les variantes, dupliquer un scénario existant et comparer les écarts déjà calculés par l’application."
        >
        <div className="variant-board" style={{ ...sectionCardStyle, padding: "18px", marginBottom: "18px" }}>
          <div className="variant-board__summary">
            <div className="variant-board__summary-card">
              <div className="variant-board__summary-label">Variante active</div>
              <div className="variant-board__summary-value">{getVariantDisplayLabel(activeVariant)}</div>
              <div className="variant-board__summary-helper">
                Régime {regimeImmobilierLabel.toLowerCase()} et données propres à cette variante.
              </div>
            </div>
            <div className="variant-board__summary-card">
              <div className="variant-board__summary-label">Déclenchement</div>
              <div className="variant-board__summary-value">Simulation globale</div>
              <div className="variant-board__summary-helper">
                Un clic unique met à jour toutes les variantes disponibles sans écraser leurs entrées.
              </div>
            </div>
          </div>

          <div style={{ color: "#475569", lineHeight: 1.6, marginBottom: "14px" }}>
            Duplique la variante active pour tester un nouveau scénario, puis compare les écarts
            calculés par l’application.
          </div>
          <div
            className="variant-board__toolbar"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: "18px",
              flexWrap: "wrap",
              marginBottom: "14px",
            }}
          >
            <div
              className="variant-board__tabs"
              style={{
                display: "flex",
                gap: "10px",
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              {variants.map((variant, index) => (
                <div
                  key={`${variant.id}-tab`}
                  className="variant-board__tab-wrapper"
                >
                <div
                  key={variant.id}
                  className="variant-board__tab"
                  style={{
                    display: "flex",
                    alignItems: "stretch",
                    borderRadius: "999px",
                    overflow: "hidden",
                    border:
                      index === activeVariantIndex ? "1px solid #1d4ed8" : "1px solid #cbd5e1",
                    backgroundColor: index === activeVariantIndex ? "#eff6ff" : "#ffffff",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setActiveVariantIndex(index)}
                    style={{
                      padding: "10px 16px",
                      border: "none",
                      backgroundColor: "transparent",
                      color: "#0f172a",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <div style={{ fontWeight: 700 }}>
                      {getVariantUserLabel(variant) || variant.label}
                    </div>
                    <div
                      style={{
                        marginTop: "4px",
                        fontSize: "12px",
                        color: "#475569",
                        fontWeight: 600,
                      }}
                    >
                      {variant.label}
                    </div>
                    <div
                      style={{
                        marginTop: "6px",
                        display: "flex",
                        gap: "8px",
                        flexWrap: "wrap",
                        fontSize: "11px",
                        color: "#475569",
                        fontWeight: 700,
                      }}
                    >
                      <span>{variant.dossier.immobilier.regimeFiscal === "actuel" ? "Régime actuel" : "Régime réformé"}</span>
                      <span>
                        {isDossierReadyForTaxSimulation(variant.dossier)
                          ? "Prête"
                          : "À compléter"}
                      </span>
                    </div>
                  </button>
                  {index > 0 && (
                    <button
                      type="button"
                      onClick={() => handleDeleteVariant(index)}
                      style={{
                        padding: "0 12px",
                        border: "none",
                        borderLeft: "1px solid #dbeafe",
                        backgroundColor: "transparent",
                        color: "#64748b",
                        cursor: "pointer",
                        fontWeight: 700,
                      }}
                      aria-label={`Supprimer ${getVariantDisplayLabel(variant)}`}
                    >
                      ×
                    </button>
                  )}
                </div>
                </div>
              ))}

              <button
                type="button"
                onClick={handleAddVariantFromActive}
                className="variant-board__add"
                disabled={variants.length >= MAX_VARIANTS}
                style={{
                  padding: "12px 18px",
                  borderRadius: "999px",
                  border:
                    variants.length >= MAX_VARIANTS
                      ? "1px solid #cbd5e1"
                      : "1px dashed #2563eb",
                  backgroundColor: variants.length >= MAX_VARIANTS ? "#f8fafc" : "#ffffff",
                  color: variants.length >= MAX_VARIANTS ? "#94a3b8" : "#1d4ed8",
                  cursor: variants.length >= MAX_VARIANTS ? "not-allowed" : "pointer",
                  fontWeight: 700,
                }}
              >
                + Nouvelle variante
              </button>
            </div>

            <div
              className="variant-board__actions"
              style={{
                minWidth: "280px",
                padding: "14px",
                borderRadius: "14px",
                backgroundColor: "#f8fafc",
                border: "1px solid #e2e8f0",
              }}
            >
              <div
                style={{
                  color: "#475569",
                  fontSize: "12px",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  marginBottom: "10px",
                }}
              >
                Actions dossier
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  flexWrap: "wrap",
                }}
              >
                <button
                  onClick={handleResetManualValues}
                  style={{
                    padding: "10px 16px",
                    borderRadius: "10px",
                    border: "1px solid #fecdd3",
                    backgroundColor: "#fff1f2",
                    color: "#be123c",
                    fontWeight: 700,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  Reset des valeurs
                </button>

                <button
                  onClick={handleResetVariantsFromVariant1}
                  style={{
                    padding: "10px 16px",
                    borderRadius: "10px",
                    border: "1px solid #cbd5e1",
                    backgroundColor: "#ffffff",
                    color: "#0f172a",
                    fontWeight: 700,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  Reinitialiser les variantes depuis Base
                </button>
              </div>

              <div style={{ ...helperStyle, marginTop: "10px" }}>
                Gestion globale du dossier et synchronisation des variantes
              </div>
            </div>
          </div>

          <div
            className="variant-board__naming-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: "12px",
              marginBottom: "14px",
            }}
          >
            {variants.map((variant, index) => (
              <div
                key={`${variant.id}-name`}
                className="variant-board__name-card"
                style={{
                  padding: "14px",
                  borderRadius: "14px",
                  backgroundColor: index === activeVariantIndex ? "#eff6ff" : "#f8fafc",
                  border: index === activeVariantIndex ? "1px solid #93c5fd" : "1px solid #e2e8f0",
                }}
              >
                <div style={{ color: "#0f172a", fontSize: "14px", fontWeight: 700 }}>{variant.label}</div>
                <label
                  style={{
                    display: "block",
                    marginTop: "10px",
                    marginBottom: "6px",
                    color: "#475569",
                    fontSize: "12px",
                    fontWeight: 700,
                  }}
                >
                  Nom du scenario
                </label>
                <input
                  type="text"
                  value={variant.customLabel}
                  onChange={(event) => handleVariantCustomLabelChange(index, event.target.value)}
                  placeholder={index === 0 ? "Ex. Base patrimoniale" : "Ex. Demenagement GE"}
                  style={inputStyle}
                />
              </div>
            ))}
          </div>

          <div
            className="variant-board__totals"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "12px",
              alignItems: "start",
            }}
          >
            {variantTotals.map((variant) => {
              const isBest = bestVariant?.id === variant.id && typeof variant.totalTax === "number";
              return (
                <div
                  key={variant.id}
                  className="variant-board__total-card"
                  style={{
                    borderRadius: "14px",
                    padding: "14px",
                    border: isBest ? "1px solid #86efac" : "1px solid #e2e8f0",
                    background: isBest ? "#f0fdf4" : "#f8fafc",
                  }}
                >
                  <div style={{ color: "#334155", fontSize: "13px", fontWeight: "bold" }}>
                    {variant.label}
                  </div>
                  <div style={{ marginTop: "4px", color: "#0f172a", fontSize: "14px", fontWeight: 700 }}>
                    {variant.customLabel || variant.label}
                  </div>
                  <div style={{ marginTop: "6px", color: "#0f172a", fontSize: "26px", fontWeight: "bold" }}>
                    {typeof variant.totalTax === "number"
                      ? formatMontantCHFArrondi(variant.totalTax)
                      : "Simulation requise"}
                  </div>
                  <div style={{ marginTop: "6px", color: "#64748b", fontSize: "12px" }}>
                    {isBest ? "Variante la plus avantageuse fiscalement" : "Impot total de la variante"}
                  </div>
                  <div style={{ marginTop: "8px", color: "#475569", fontSize: "13px" }}>
                    {typeof variant.totalTax === "number" && typeof variantTotals[0]?.totalTax === "number"
                      ? `Ecart vs Base : ${formatMontantCHFArrondi(
                          variantTotals[0].totalTax - variant.totalTax
                        )}`
                      : "Ecart indisponible"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={sectionCardStyle}>
          <button
            type="button"
            onClick={() => setIsRoiConseillerOpen((current) => !current)}
            style={{
              width: "100%",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "12px",
              padding: "4px 0",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <div>
              <h2 style={{ marginTop: 0, marginBottom: "4px", color: "#0f172a" }}>
                ROI conseiller
              </h2>
              <p style={{ margin: 0, color: "#64748b", lineHeight: 1.6 }}>
                {isRoiConseillerOpen
                  ? "Mesure rapide des gains de temps et des gains financiers liés à l’utilisation de l’application."
                  : "Cliquer pour ouvrir le simulateur de rentabilité conseiller."}
              </p>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                justifyContent: "flex-end",
              }}
            >
              {isRoiConseillerOpen && (
                <div
                  style={{
                    padding: "12px 16px",
                    borderRadius: "14px",
                    background: "linear-gradient(135deg, #eff6ff 0%, #f8fafc 100%)",
                    border: "1px solid #bfdbfe",
                    minWidth: "260px",
                  }}
                >
                  <div style={{ color: "#1d4ed8", fontSize: "13px", fontWeight: 700 }}>
                    Potentiel annuel
                  </div>
                  <div style={{ marginTop: "6px", color: "#0f172a", fontSize: "28px", fontWeight: 700 }}>
                    {formatMontantCHFArrondi(roiGainAnnuel)}
                  </div>
                  <div style={{ ...helperStyle, marginTop: "6px" }}>
                    {roiGainAnnuel > 0
                      ? `Avec cet outil, vous pouvez générer ${formatMontantCHFArrondi(roiGainAnnuel)} supplémentaires par an`
                      : "Renseignez vos hypothèses pour visualiser le potentiel de rentabilité"}
                  </div>
                </div>
              )}

              <span
                style={{
                  minWidth: "44px",
                  height: "44px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "999px",
                  border: "1px solid #cbd5e1",
                  backgroundColor: "#f8fafc",
                  color: "#0f172a",
                  fontSize: "20px",
                  fontWeight: 700,
                }}
              >
                {isRoiConseillerOpen ? "−" : "+"}
              </span>
            </div>
          </button>

          {isRoiConseillerOpen && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                gap: "16px",
                marginTop: "16px",
              }}
            >
              <div style={subCardStyle}>
                <h3 style={{ marginTop: 0, marginBottom: "14px", color: "#1e293b" }}>
                  Situation actuelle
                </h3>

                <div style={{ display: "grid", gap: "12px" }}>
                  <div>
                    <label style={labelStyle}>Nombre de dossiers par mois</label>
                    <input
                      type="number"
                      value={roiDossiersParMois}
                      onChange={(e) => setRoiDossiersParMois(Number(e.target.value || 0))}
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Temps moyen par dossier (heures)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={roiTempsParDossier}
                      onChange={(e) => setRoiTempsParDossier(Number(e.target.value || 0))}
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Taux horaire (CHF)</label>
                    <input
                      type="number"
                      value={roiTauxHoraire}
                      onChange={(e) => setRoiTauxHoraire(Number(e.target.value || 0))}
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Temps total mensuel</label>
                    <input
                      type="text"
                      value={formatHeures(roiTempsTotalMensuel)}
                      readOnly
                      style={inputReadOnlyStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Valeur du temps</label>
                    <input
                      type="text"
                      value={formatMontantCHFArrondi(roiValeurTempsMensuelle)}
                      readOnly
                      style={inputReadOnlyStyle}
                    />
                  </div>
                </div>
              </div>

              <div style={subCardStyle}>
                <h3 style={{ marginTop: 0, marginBottom: "14px", color: "#1e293b" }}>
                  Situation avec l’application
                </h3>

                <div style={{ display: "grid", gap: "12px" }}>
                  <div>
                    <label style={labelStyle}>Temps moyen par dossier avec l’outil</label>
                    <input
                      type="number"
                      step="0.1"
                      value={roiTempsParDossierAvecOutil}
                      onChange={(e) => setRoiTempsParDossierAvecOutil(Number(e.target.value || 0))}
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Nouveau temps total</label>
                    <input
                      type="text"
                      value={formatHeures(roiNouveauTempsTotalMensuel)}
                      readOnly
                      style={inputReadOnlyStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Gain de temps</label>
                    <input
                      type="text"
                      value={formatHeures(roiGainHeuresMensuel)}
                      readOnly
                      style={inputReadOnlyStyle}
                    />
                  </div>
                </div>
              </div>

              <div style={subCardStyle}>
                <h3 style={{ marginTop: 0, marginBottom: "14px", color: "#1e293b" }}>
                  Résultats
                </h3>

                <div style={{ display: "grid", gap: "12px" }}>
                  <div>
                    <label style={labelStyle}>Heures gagnées par mois</label>
                    <input
                      type="text"
                      value={formatHeures(roiGainHeuresMensuel)}
                      readOnly
                      style={inputReadOnlyStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Gain financier mensuel</label>
                    <input
                      type="text"
                      value={formatMontantCHFArrondi(roiGainFinancierMensuel)}
                      readOnly
                      style={inputReadOnlyStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Gain annuel</label>
                    <input
                      type="text"
                      value={formatMontantCHFArrondi(roiGainAnnuel)}
                      readOnly
                      style={inputReadOnlyStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Capacité de dossiers supplémentaires</label>
                    <input
                      type="text"
                      value={new Intl.NumberFormat("fr-CH", { maximumFractionDigits: 1 }).format(
                        roiCapaciteSupplementaire
                      )}
                      readOnly
                      style={inputReadOnlyStyle}
                    />
                    <span style={helperStyle}>Heures gagnées / temps par dossier optimisé</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {showAdvancedComparison && (taxResultSansOptimisation?.normalized || taxResult?.normalized) && (
          <>
            <div style={{ ...sectionCardStyle, marginBottom: "18px" }}>
              <h2 style={{ marginTop: 0, marginBottom: "8px", color: "#0f172a" }}>
                Comparaison des variantes
              </h2>
              <p style={{ marginTop: 0, marginBottom: "16px", color: "#64748b", lineHeight: 1.7 }}>
                Le classement compare les variantes sur l impot total, la marge annuelle,
                l effort de liquidite et la fortune restante, sans recalculer la fiscalite.
              </p>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: "12px",
                }}
              >
                {comparaisonMultiCriteres.map((scenario) => {
                  const isBest = meilleureVarianteComparative?.key === scenario.key;
                  return (
                    <div
                      key={scenario.key}
                      style={{
                        borderRadius: "16px",
                        padding: "16px",
                        border: isBest ? "1px solid #86efac" : "1px solid #e2e8f0",
                        background: isBest ? "#f0fdf4" : "#f8fafc",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
                        <strong style={{ color: "#0f172a" }}>{scenario.label}</strong>
                        <span style={{ color: isBest ? "#166534" : "#475569", fontWeight: 700 }}>
                          #{scenario.rank}
                        </span>
                      </div>
                      <div
                        style={{
                          marginTop: "8px",
                          fontSize: "26px",
                          fontWeight: 700,
                          color: "#0f172a",
                        }}
                      >
                        {scenario.globalScore}/100
                      </div>
                      <div style={{ marginTop: "10px", display: "grid", gap: "6px", color: "#334155" }}>
                        <div>Impot total : {formatMontantCHFArrondi(scenario.impotTotal)}</div>
                        <div>Marge annuelle : {formatMontantCHFArrondi(scenario.margeAnnuelle)}</div>
                        <div>Effort de liquidite : {formatMontantCHFArrondi(scenario.effortLiquidite)}</div>
                        <div>Fortune restante : {formatMontantCHFArrondi(scenario.fortuneRestante)}</div>
                        <div>Score fiscal : {scenario.fiscalScore}/100</div>
                        <div>Score tresorerie : {scenario.treasuryScore}/100</div>
                        <div>Score patrimonial : {scenario.patrimonialScore}/100</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div
                style={{
                  marginTop: "18px",
                  border: "1px solid #dbeafe",
                  borderRadius: "14px",
                  overflowX: "auto",
                  backgroundColor: "#ffffff",
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "minmax(220px, 1.5fr) repeat(8, minmax(120px, 1fr))",
                    backgroundColor: "#eff6ff",
                    color: "#1e3a8a",
                    fontSize: "13px",
                    fontWeight: 700,
                  }}
                >
                  <div style={{ padding: "12px 14px" }}>Variante</div>
                  <div style={{ padding: "12px 14px", textAlign: "right" }}>Impot total</div>
                  <div style={{ padding: "12px 14px", textAlign: "right" }}>Marge annuelle</div>
                  <div style={{ padding: "12px 14px", textAlign: "right" }}>Effort liquidite</div>
                  <div style={{ padding: "12px 14px", textAlign: "right" }}>Fortune restante</div>
                  <div style={{ padding: "12px 14px", textAlign: "right" }}>Fiscal</div>
                  <div style={{ padding: "12px 14px", textAlign: "right" }}>Tresorerie</div>
                  <div style={{ padding: "12px 14px", textAlign: "right" }}>Patrimoine</div>
                  <div style={{ padding: "12px 14px", textAlign: "right" }}>Global</div>
                </div>

                {comparaisonMultiCriteres.map((scenario, index) => (
                  <div
                    key={scenario.key}
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "minmax(220px, 1.5fr) repeat(8, minmax(120px, 1fr))",
                      borderTop: index === 0 ? "none" : "1px solid #e2e8f0",
                      backgroundColor:
                        meilleureVarianteComparative?.key === scenario.key ? "#f8fafc" : "#ffffff",
                      color: "#0f172a",
                    }}
                  >
                    <div style={{ padding: "14px", fontWeight: 600 }}>{scenario.label}</div>
                    <div style={{ padding: "14px", textAlign: "right" }}>
                      {formatMontantCHFArrondi(scenario.impotTotal)}
                    </div>
                    <div style={{ padding: "14px", textAlign: "right" }}>
                      {formatMontantCHFArrondi(scenario.margeAnnuelle)}
                    </div>
                    <div style={{ padding: "14px", textAlign: "right" }}>
                      {formatMontantCHFArrondi(scenario.effortLiquidite)}
                    </div>
                    <div style={{ padding: "14px", textAlign: "right" }}>
                      {formatMontantCHFArrondi(scenario.fortuneRestante)}
                    </div>
                    <div style={{ padding: "14px", textAlign: "right" }}>{scenario.fiscalScore}</div>
                    <div style={{ padding: "14px", textAlign: "right" }}>{scenario.treasuryScore}</div>
                    <div style={{ padding: "14px", textAlign: "right" }}>{scenario.patrimonialScore}</div>
                    <div style={{ padding: "14px", textAlign: "right", fontWeight: 700 }}>
                      {scenario.globalScore}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {resumeComparatifClient && (
              <div
                style={{
                  ...sectionCardStyle,
                  marginBottom: "18px",
                  border: "1px solid #c7d2fe",
                  background: "linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%)",
                }}
              >
                <h2 style={{ marginTop: 0, marginBottom: "10px", color: "#312e81" }}>
                  Resume automatique client
                </h2>
                <p style={{ marginTop: 0, marginBottom: "16px", color: "#475569", lineHeight: 1.7 }}>
                  Le moteur identifie la meilleure variante fiscale, la meilleure variante
                  tresorerie, la meilleure variante patrimoniale et la meilleure variante globale.
                </p>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: "16px",
                  }}
                >
                  <div style={subCardStyle}>
                    <h3 style={{ marginTop: 0, marginBottom: "10px", color: "#1e293b" }}>
                      Meilleures variantes
                    </h3>
                    <div style={{ display: "grid", gap: "8px", color: "#0f172a", lineHeight: 1.7 }}>
                      <div><strong>Fiscale :</strong> {resumeComparatifClient.bestFiscalVariant}</div>
                      <div><strong>Tresorerie :</strong> {resumeComparatifClient.bestTreasuryVariant}</div>
                      <div><strong>Patrimoine :</strong> {resumeComparatifClient.bestPatrimonialVariant}</div>
                      <div><strong>Globale :</strong> {resumeComparatifClient.recommendedVariant}</div>
                    </div>
                  </div>

                  <div style={subCardStyle}>
                    <h3 style={{ marginTop: 0, marginBottom: "10px", color: "#1e293b" }}>
                      Resume automatique
                    </h3>
                    <div style={{ display: "grid", gap: "8px", color: "#334155", lineHeight: 1.6 }}>
                      {resumeComparatifClient.summaryLines.map((reason, index) => (
                        <div key={index}>• {reason}</div>
                      ))}
                    </div>
                  </div>

                  <div style={subCardStyle}>
                    <h3 style={{ marginTop: 0, marginBottom: "10px", color: "#1e293b" }}>
                      Regle de scoring
                    </h3>
                    <div style={{ display: "grid", gap: "8px", color: "#334155", lineHeight: 1.6 }}>
                      <div>Score fiscal : impot total le plus bas = 100</div>
                      <div>Score tresorerie : marge annuelle elevee + effort de liquidite faible</div>
                      <div>Score patrimonial : fortune restante la plus elevee = 100</div>
                      <div>Score global : fiscalite 50%, tresorerie 30%, patrimoine 20%</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        </GuidedSection>

        <div ref={activeStepViewportRef} className="active-step-viewport">
        {activeSectionId === "informations-generales" && (
        <GuidedSection
          id="informations-generales"
          step="1"
          title="Saisie de la situation"
          description="Renseignez une situation patrimoniale et fiscale dans un format plus direct, avec une lecture immediate des indicateurs simples. Les calculs fiscaux officiels restent inchanges dans le reste de l'application."
        >
        <SituationEntryScreen
          analysisMode={analysisMode}
          canLaunchSimulation={isGlobalTaxSimulationReady}
          dossier={dossier}
          totalCharges={totalChargesCalcule}
          isSimulating={isSimulatingVariants}
          launchHelper={simulationPrimaryHelper}
          onDossierChange={setDossier}
          onLaunchSimulation={() => {
            void handleTaxSimulation({ navigateToResults: true });
          }}
          onNpaChange={handleNpaChange}
          formatCurrency={formatMontantCHFArrondi}
        />
        </GuidedSection>
        )}

        {activeSectionId === "revenus" && (
        <GuidedSection
          id="revenus"
          step="2"
          title="Revenus du foyer"
          description="Ce bloc centralise les revenus déjà utilisés dans les calculs existants. Il permet de vérifier rapidement la base économique retenue avant la simulation."
        >
        <div style={sectionCardStyle}>
          <h2 style={{ marginTop: 0, marginBottom: "20px", color: "#0f172a" }}>
            Revenus
          </h2>

          <CollapsibleHelp title="Aide revenus">
            {sectionHelpTexts.revenus.map((text) => (
              <div key={text}>{text}</div>
            ))}
          </CollapsibleHelp>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr 1fr 1fr",
              gap: "15px",
            }}
          >
            <div>
              <label style={labelStyle}>Salaire</label>
              <input
                type="number"
                value={dossier.revenus.salaire}
                onChange={(e) =>
                  setDossier({
                    ...dossier,
                    revenus: {
                      ...dossier.revenus,
                      salaire: numberValue(e.target.value),
                    },
                  })
                }
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>AVS</label>
              <input
                type="number"
                value={dossier.revenus.avs}
                onChange={(e) =>
                  setDossier({
                    ...dossier,
                    revenus: {
                      ...dossier.revenus,
                      avs: numberValue(e.target.value),
                    },
                  })
                }
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>LPP</label>
              <input
                type="number"
                value={dossier.revenus.lpp}
                onChange={(e) =>
                  setDossier({
                    ...dossier,
                    revenus: {
                      ...dossier.revenus,
                      lpp: numberValue(e.target.value),
                    },
                  })
                }
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Autres revenus</label>
              <input
                type="number"
                value={dossier.revenus.autresRevenus}
                onChange={(e) =>
                  setDossier({
                    ...dossier,
                    revenus: {
                      ...dossier.revenus,
                      autresRevenus: numberValue(e.target.value),
                    },
                  })
                }
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Total revenus</label>
              <input
                type="text"
                value={formatMontantCHFArrondi(totalRevenusCalcule)}
                readOnly
                style={inputReadOnlyStyle}
              />
              <span style={helperStyle}>Calcul automatique</span>
            </div>
          </div>

          <div
            style={{
              marginTop: "22px",
              padding: "18px",
              borderRadius: "16px",
              border: "1px solid #dbeafe",
              background: "linear-gradient(180deg, #f8fbff 0%, #ffffff 100%)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "16px",
                alignItems: "flex-start",
                flexWrap: "wrap",
                marginBottom: "14px",
              }}
            >
              <div>
                <h3 style={{ marginTop: 0, marginBottom: "6px", color: "#0f172a" }}>Immobilier</h3>
                <p style={{ margin: 0, color: "#475569", lineHeight: 1.7 }}>
                  Renseignez ici les éléments immobiliers ayant une incidence fiscale. Distinguez
                  l’habitation propre des biens de rendement.
                </p>
              </div>

              <div
                style={{
                  minWidth: "240px",
                  padding: "14px 16px",
                  borderRadius: "14px",
                  backgroundColor: "#ffffff",
                  border: "1px solid #dbeafe",
                }}
              >
                <div style={{ color: "#64748b", fontSize: "12px", fontWeight: 700, textTransform: "uppercase" }}>
                  Lecture métier
                </div>
                <div style={{ marginTop: "8px", display: "grid", gap: "6px", color: "#334155", fontSize: "14px" }}>
                  <div><strong style={{ color: "#0f172a" }}>Régime :</strong> {regimeImmobilierLabel}</div>
                  <div>
                    <strong style={{ color: "#0f172a" }}>Total revenus existant :</strong>{" "}
                    inchangé
                  </div>
                  <div>
                    <strong style={{ color: "#0f172a" }}>Revenus immobiliers retenus :</strong>{" "}
                    {formatMontantCHFArrondi(revenusImmobiliersTaxware)}
                  </div>
                  <div>
                    <strong style={{ color: "#0f172a" }}>Impact budgétaire retenu :</strong>{" "}
                    {formatMontantCHFArrondi(interetsHypothecairesImmobiliersBudgetaires)}
                  </div>
                  <div>
                    <strong style={{ color: "#0f172a" }}>Déductions immobilières retenues :</strong>{" "}
                    {formatMontantCHFArrondi(
                      interetsHabitationDeductibles +
                        fraisHabitationDeductibles +
                        interetsBiensRendementDeductibles +
                        fraisBiensRendementDeductibles
                    )}
                  </div>
                  <div>
                    Les données immobilières alimentent d’abord la fiscalité, sans être mélangées
                    aux revenus encaissés classiques.
                  </div>
                  <div>La valeur locative reste fiscale et n’est pas présentée comme un revenu encaissé.</div>
                </div>
              </div>
            </div>

            <div style={immobilierCardsGridStyle}>
              <div style={immobilierCardStyle}>
                <div style={immobilierCardHeaderStyle}>
                  <span style={immobilierTagStyle}>Usage personnel</span>
                  <div>
                    <h4 style={{ margin: 0, color: "#0f172a", fontSize: "18px" }}>Habitation propre</h4>
                    <p style={{ marginTop: "6px", color: "#475569", lineHeight: 1.6 }}>
                      À compléter uniquement si le client occupe lui-même un bien immobilier.
                    </p>
                  </div>
                  <p style={{ margin: 0, color: "#64748b", fontSize: "13px", lineHeight: 1.6 }}>
                    Ces éléments influencent surtout la fiscalité, pas les revenus encaissés.
                  </p>
                </div>

                <div style={immobilierActivationStyle}>
                  <label style={checkboxRowStyle}>
                    <input
                      type="checkbox"
                      checked={habitationPropreActive}
                      onChange={(e) =>
                        setDossier({
                          ...dossier,
                          immobilier: {
                            ...dossier.immobilier,
                            proprietaireOccupant: e.target.checked,
                          },
                        })
                      }
                    />
                    <span>Le client est propriétaire occupant</span>
                  </label>
                </div>

                {habitationPropreActive ? (
                  <div style={immobilierFieldsGridStyle}>
                    <div style={immobilierFieldCardStyle}>
                      <label style={labelStyle}>Valeur locative</label>
                      <input
                        type="number"
                        value={dossier.immobilier.valeurLocativeHabitationPropre}
                        onChange={(e) =>
                          setDossier({
                            ...dossier,
                            immobilier: {
                              ...dossier.immobilier,
                              valeurLocativeHabitationPropre: numberValue(e.target.value),
                            },
                          })
                        }
                        style={inputStyle}
                      />
                      <span style={helperStyle}>
                        Prise en compte dans le calcul fiscal selon le régime choisi.
                      </span>
                    </div>

                    <div style={immobilierFieldCardStyle}>
                      <label style={labelStyle}>Intérêts hypothécaires habitation propre</label>
                      <input
                        type="number"
                        value={dossier.immobilier.interetsHypothecairesHabitationPropre}
                        onChange={(e) =>
                          setDossier({
                            ...dossier,
                            immobilier: {
                              ...dossier.immobilier,
                              interetsHypothecairesHabitationPropre: numberValue(e.target.value),
                            },
                          })
                        }
                        style={inputStyle}
                      />
                      <span style={helperStyle}>
                        Le traitement fiscal dépend du régime de simulation sélectionné, mais
                        l’impact budgétaire réel est conservé dans la marge annuelle.
                      </span>
                    </div>

                    <div style={immobilierWideFieldCardStyle}>
                      <label style={labelStyle}>Frais d’entretien habitation propre</label>
                      <input
                        type="number"
                        value={dossier.immobilier.fraisEntretienHabitationPropre}
                        onChange={(e) =>
                          setDossier({
                            ...dossier,
                            immobilier: {
                              ...dossier.immobilier,
                              fraisEntretienHabitationPropre: numberValue(e.target.value),
                            },
                          })
                        }
                        style={inputStyle}
                      />
                      <span style={helperStyle}>
                        Le traitement fiscal dépend du régime de simulation sélectionné.
                      </span>
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      ...immobilierActivationStyle,
                      marginTop: "auto",
                      color: "#64748b",
                      lineHeight: 1.6,
                    }}
                  >
                    Activez cette carte pour saisir les éléments fiscaux liés à l’habitation propre.
                  </div>
                )}
              </div>

              <div style={immobilierCardStyle}>
                <div style={immobilierCardHeaderStyle}>
                  <span style={immobilierTagStyle}>Location à des tiers</span>
                  <div>
                    <h4 style={{ margin: 0, color: "#0f172a", fontSize: "18px" }}>Biens de rendement</h4>
                    <p style={{ marginTop: "6px", color: "#475569", lineHeight: 1.6 }}>
                      À compléter uniquement si le client perçoit des loyers sur des biens loués à
                      des tiers.
                    </p>
                  </div>
                  <p style={{ margin: 0, color: "#64748b", fontSize: "13px", lineHeight: 1.6 }}>
                    Ces montants correspondent à des revenus réellement perçus.
                  </p>
                </div>

                <div style={immobilierActivationStyle}>
                  <label style={checkboxRowStyle}>
                    <input
                      type="checkbox"
                      checked={biensRendementActifs}
                      onChange={(e) =>
                        setDossier({
                          ...dossier,
                          immobilier: {
                            ...dossier.immobilier,
                            possedeBienRendement: e.target.checked,
                          },
                        })
                      }
                    />
                    <span>Le client possède un bien de rendement</span>
                  </label>
                </div>

                {biensRendementActifs ? (
                  <div style={immobilierFieldsGridStyle}>
                    <div style={immobilierFieldCardStyle}>
                      <label style={labelStyle}>Loyers encaissés</label>
                      <input
                        type="number"
                        value={dossier.immobilier.loyersBiensRendement}
                        onChange={(e) =>
                          setDossier({
                            ...dossier,
                            immobilier: {
                              ...dossier.immobilier,
                              loyersBiensRendement: numberValue(e.target.value),
                            },
                          })
                        }
                        style={inputStyle}
                      />
                      <span style={helperStyle}>
                        Pris en compte dans le calcul fiscal comme revenus de rendement.
                      </span>
                    </div>

                    <div style={immobilierFieldCardStyle}>
                      <label style={labelStyle}>Intérêts hypothécaires biens de rendement</label>
                      <input
                        type="number"
                        value={dossier.immobilier.interetsHypothecairesBiensRendement}
                        onChange={(e) =>
                          setDossier({
                            ...dossier,
                            immobilier: {
                              ...dossier.immobilier,
                              interetsHypothecairesBiensRendement: numberValue(e.target.value),
                            },
                          })
                        }
                        style={inputStyle}
                      />
                      <span style={helperStyle}>
                        Pris en compte avec le bien de rendement dans le calcul fiscal.
                      </span>
                    </div>

                    <div style={immobilierWideFieldCardStyle}>
                      <label style={labelStyle}>Frais d’entretien biens de rendement</label>
                      <input
                        type="number"
                        value={dossier.immobilier.fraisEntretienBiensRendement}
                        onChange={(e) =>
                          setDossier({
                            ...dossier,
                            immobilier: {
                              ...dossier.immobilier,
                              fraisEntretienBiensRendement: numberValue(e.target.value),
                            },
                          })
                        }
                        style={inputStyle}
                      />
                      <span style={helperStyle}>
                        Pris en compte avec le bien de rendement dans le calcul fiscal.
                      </span>
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      ...immobilierActivationStyle,
                      marginTop: "auto",
                      color: "#64748b",
                      lineHeight: 1.6,
                    }}
                  >
                    Activez cette carte pour saisir les loyers et charges liés aux biens de
                    rendement.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        </GuidedSection>
        )}

        {activeSectionId === "fortune" && (
        <GuidedSection
          id="fortune"
          step="3"
          title="Fortune, dettes et structure patrimoniale"
          description="Regroupez dans une même lecture les actifs, les dettes et les synthèses patrimoniales déjà calculées par l’application. L’objectif est de rendre la situation patrimoniale immédiatement lisible."
        >
        <div style={sectionCardStyle}>
          <h2 style={{ marginTop: 0, marginBottom: "20px", color: "#0f172a" }}>
            Fortune
          </h2>

          <CollapsibleHelp title="Aide fortune">
            {sectionHelpTexts.fortune.map((text) => (
              <div key={text}>{text}</div>
            ))}
          </CollapsibleHelp>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: "16px",
              alignItems: "stretch",
            }}
          >
            <div style={fortuneFieldCardStyle}>
              <label style={labelStyle}>Liquidités de départ</label>
              <input
                type="number"
                value={dossier.fortune.liquidites}
                onChange={(e) =>
                  setDossier({
                    ...dossier,
                    fortune: {
                      ...dossier.fortune,
                      liquidites: numberValue(e.target.value),
                    },
                  })
                }
                style={inputStyle}
              />
              <span style={helperStyle}>Valeur source saisie manuellement</span>
            </div>

            <div style={{ ...fortuneFieldCardStyle, minHeight: "132px" }}>
              <label style={labelStyle}>Liquidités disponibles après mouvements</label>
              <input
                type="text"
                value={formatMontantCHF(liquiditesAjusteesCalcule)}
                readOnly
                style={inputReadOnlyStyle}
              />
              <span style={helperStyle}>
                Liquidités de départ - 3e pilier simulé - rachat LPP + ajustement manuel
              </span>
            </div>

            <div style={fortuneFieldCardStyle}>
              <label style={labelStyle}>Fortune mobilière (compte, portefeuille, titre, autre)</label>
              <input
                type="number"
                value={dossier.fortune.titres}
                onChange={(e) =>
                  setDossier({
                    ...dossier,
                    fortune: {
                      ...dossier.fortune,
                      titres: numberValue(e.target.value),
                    },
                  })
                }
                style={inputStyle}
              />
              <span style={helperStyle}>Saisie manuelle</span>
            </div>

            <div style={fortuneFieldCardStyle}>
              <label style={labelStyle}>3e pilier</label>
              <input
                type="number"
                value={dossier.fortune.troisiemePilier}
                onChange={(e) =>
                  setDossier({
                    ...dossier,
                    fortune: {
                      ...dossier.fortune,
                      troisiemePilier: numberValue(e.target.value),
                    },
                  })
                }
                style={inputStyle}
              />
              <span style={helperStyle}>
                Valeur source. Patrimoine affiche apres simulation : {formatMontantCHF(
                  troisiemePilierPatrimonialCalcule
                )}
              </span>
            </div>

            <div style={fortuneFieldCardStyle}>
              <label style={labelStyle}>Fortune LPP actuelle</label>
              <input
                type="number"
                value={dossier.fortune.fortuneLppActuelle}
                onChange={(e) =>
                  setDossier({
                    ...dossier,
                    fortune: {
                      ...dossier.fortune,
                      fortuneLppActuelle: numberValue(e.target.value),
                    },
                  })
                }
                style={inputStyle}
              />
              <span style={helperStyle}>
                Information patrimoniale, non imposable. Patrimoine affiche apres rachat : {formatMontantCHF(
                  fortuneLppPatrimonialeCalcule
                )}
              </span>
            </div>

            <div style={fortuneFieldCardStyle}>
              <label style={labelStyle}>Immobilier</label>
              <input
                type="number"
                value={dossier.fortune.immobilier}
                onChange={(e) =>
                  setDossier({
                    ...dossier,
                    fortune: {
                      ...dossier.fortune,
                      immobilier: numberValue(e.target.value),
                    },
                  })
                }
                style={inputStyle}
              />
              <span style={helperStyle}>Valeur fiscale</span>
            </div>

            <div style={fortuneFieldCardStyle}>
              <label style={labelStyle}>Fortune brute</label>
              <input
                type="text"
                value={formatMontantCHF(fortuneBruteCalcule)}
                readOnly
                style={inputReadOnlyStyle}
              />
              <span style={helperStyle}>
                Liquidités après sorties + titres + 3e pilier + fortune LPP actuelle + immobilier
              </span>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: "16px",
              marginTop: "16px",
              alignItems: "stretch",
            }}
          >
            <div style={{ ...fortuneFieldCardStyle, minHeight: "132px" }}>
              <label style={labelStyle}>Fortune fiscale</label>
              <input
                type="text"
                value={formatMontantCHF(fortuneFiscaleCalcule)}
                readOnly
                style={inputReadOnlyStyle}
              />
              <span style={helperStyle}>Liquidités après sorties + titres + immobilier, hors 3e pilier</span>
            </div>

            <div style={{ ...fortuneFieldCardStyle, minHeight: "132px" }}>
              <label style={labelStyle}>Fortune nette fiscale</label>
              <input
                type="text"
                value={formatMontantCHF(fortuneNetteFiscaleCalcule)}
                readOnly
                style={inputReadOnlyStyle}
              />
              <span style={helperStyle}>Fortune fiscale moins dettes</span>
            </div>
          </div>
        </div>

        <div style={sectionCardStyle}>
          <h2 style={{ marginTop: 0, marginBottom: "20px", color: "#0f172a" }}>
            Dettes
          </h2>

          <CollapsibleHelp title="Aide dettes">
            {sectionHelpTexts.dettes.map((text) => (
              <div key={text}>{text}</div>
            ))}
          </CollapsibleHelp>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: "15px",
            }}
          >
            <div>
              <label style={labelStyle}>Hypothèques</label>
              <input
                type="number"
                value={dossier.dettes.hypotheques}
                onChange={(e) =>
                  setDossier({
                    ...dossier,
                    dettes: {
                      ...dossier.dettes,
                      hypotheques: numberValue(e.target.value),
                    },
                  })
                }
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Autres dettes</label>
              <input
                type="number"
                value={dossier.dettes.autresDettes}
                onChange={(e) =>
                  setDossier({
                    ...dossier,
                    dettes: {
                      ...dossier.dettes,
                      autresDettes: numberValue(e.target.value),
                    },
                  })
                }
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Total dettes</label>
              <input
                type="text"
                value={formatMontantCHF(totalDettesCalcule)}
                readOnly
                style={inputReadOnlyStyle}
              />
              <span style={helperStyle}>Calcul automatique</span>
            </div>
          </div>
        </div>

        <div style={sectionCardStyle}>
          <h2 style={{ marginTop: 0, marginBottom: "20px", color: "#0f172a" }}>
            Synthèse fortune
          </h2>

          <CollapsibleHelp title="Aide synthese fortune">
            {sectionHelpTexts.syntheseFortune.map((text) => (
              <div key={text}>{text}</div>
            ))}
          </CollapsibleHelp>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr",
              gap: "15px",
            }}
          >
            <div>
              <label style={labelStyle}>Fortune brute</label>
              <input
                type="text"
                value={formatMontantCHF(fortuneBruteCalcule)}
                readOnly
                style={inputReadOnlyStyle}
              />
              <span style={helperStyle}>Vision patrimoniale globale</span>
            </div>

            <div>
              <label style={labelStyle}>Fortune fiscale</label>
              <input
                type="text"
                value={formatMontantCHF(fortuneFiscaleCalcule)}
                readOnly
                style={inputReadOnlyStyle}
              />
              <span style={helperStyle}>Hors 3e pilier</span>
            </div>

            <div>
              <label style={labelStyle}>Dettes</label>
              <input
                type="text"
                value={formatMontantCHF(totalDettesCalcule)}
                readOnly
                style={inputReadOnlyStyle}
              />
              <span style={helperStyle}>Hypothèques + autres dettes</span>
            </div>

            <div>
              <label style={labelStyle}>Fortune nette</label>
              <input
                type="text"
                value={formatMontantCHF(fortuneNetteCalcule)}
                readOnly
                style={inputReadOnlyStyle}
              />
              <span style={helperStyle}>Fortune brute moins dettes</span>
            </div>

            <div>
              <label style={labelStyle}>Fortune nette fiscale</label>
              <input
                type="text"
                value={formatMontantCHF(fortuneNetteFiscaleCalcule)}
                readOnly
                style={inputReadOnlyStyle}
              />
              <span style={helperStyle}>Fortune fiscale moins dettes</span>
            </div>
          </div>
        </div>
        </GuidedSection>
        )}

        <div className="technical-annex">
          <div className="technical-annex__label">Annexe technique</div>
          <div className="technical-annex__text">
            La zone conseiller conserve exactement les mêmes contrôles internes et le même payload TaxWare. Elle est volontairement isolée du parcours principal pour garder une lecture client plus fluide.
          </div>
        <div style={sectionCardStyle}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "12px",
              flexWrap: "wrap",
              marginBottom: isConseillerAccessGranted ? "20px" : "0",
            }}
          >
            <h2 style={{ marginTop: 0, marginBottom: 0, color: "#0f172a" }}>
              Payload TaxWare détaillé
            </h2>

            <button
              onClick={handleConseillerAccessToggle}
              style={{
                padding: "10px 16px",
                borderRadius: "10px",
                border: "1px solid #cbd5e1",
                backgroundColor: isConseillerAccessGranted ? "#dbeafe" : "#ffffff",
                color: "#0f172a",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {isConseillerAccessGranted ? "Fermer l'acces conseiller" : "Acces conseiller"}
            </button>
          </div>

          {!isConseillerAccessGranted && (
            <div style={{ ...subCardStyle, marginTop: "20px" }}>
              <p style={{ marginTop: 0, marginBottom: "12px", color: "#475569", lineHeight: 1.7 }}>
                Cette section technique est reservee a l utilisateur autorise.
              </p>

              {showConseillerPrompt && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(220px, 320px) auto",
                    gap: "12px",
                    alignItems: "start",
                  }}
                >
                  <div>
                    <label style={labelStyle}>Mot de passe conseiller</label>
                    <input
                      type="password"
                      value={conseillerPasswordInput}
                      onChange={(e) => {
                        setConseillerPasswordInput(e.target.value);
                        if (conseillerAccessError) {
                          setConseillerAccessError("");
                        }
                      }}
                      style={inputStyle}
                    />
                    {conseillerAccessError ? (
                      <span style={{ ...helperStyle, color: "#b91c1c" }}>{conseillerAccessError}</span>
                    ) : null}
                  </div>

                  <button
                    onClick={handleConseillerAccessSubmit}
                    style={{
                      padding: "10px 16px",
                      borderRadius: "10px",
                      border: "none",
                      backgroundColor: "#0f172a",
                      color: "#ffffff",
                      fontWeight: 700,
                      cursor: "pointer",
                      marginTop: "30px",
                    }}
                  >
                    Ouvrir
                  </button>
                </div>
              )}
            </div>
          )}

          {isConseillerAccessGranted && (
            <div
              style={{
                display: "grid",
                gap: "18px",
              }}
            >
              <div style={subCardStyle}>
                <h3 style={{ marginTop: 0, marginBottom: "14px", color: "#1e293b" }}>
                  Contrôle TaxWare
                </h3>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "18px",
                  }}
                >
                  <div style={subCardStyle}>
                    <h4 style={{ marginTop: 0, marginBottom: "14px", color: "#1e293b" }}>
                      Contrôle fortune
                    </h4>

                    <div style={{ display: "grid", gap: "12px" }}>
                      <div>
                        <label style={labelStyle}>Fortune brute</label>
                        <input
                          type="text"
                          value={formatMontantCHF(fortuneBruteCalcule)}
                          readOnly
                          style={inputReadOnlyStyle}
                        />
                      </div>

                      <div>
                        <label style={labelStyle}>Fortune fiscale</label>
                        <input
                          type="text"
                          value={formatMontantCHF(fortuneFiscaleCalcule)}
                          readOnly
                          style={inputReadOnlyStyle}
                        />
                      </div>

                      <div>
                        <label style={labelStyle}>Dettes</label>
                        <input
                          type="text"
                          value={formatMontantCHF(totalDettesCalcule)}
                          readOnly
                          style={inputReadOnlyStyle}
                        />
                      </div>

                      <div>
                        <label style={labelStyle}>Fortune nette fiscale</label>
                        <input
                          type="text"
                          value={formatMontantCHF(fortuneNetteFiscaleCalcule)}
                          readOnly
                          style={inputReadOnlyStyle}
                        />
                      </div>

                      <div>
                        <label style={labelStyle}>Assets envoyés à TaxWare</label>
                        <input
                          type="text"
                          value={formatMontantCHF(Number(taxwarePayloadControle.Assets || 0))}
                          readOnly
                          style={inputReadOnlyStyle}
                        />
                        <span style={helperStyle}>Assets (fortune fiscale)</span>
                      </div>

                      <div>
                        <label style={labelStyle}>Dettes envoyées à TaxWare</label>
                        <input
                          type="text"
                          value={formatMontantCHF(Number(taxwarePayloadControle.Debts || 0))}
                          readOnly
                          style={inputReadOnlyStyle}
                        />
                        <span style={helperStyle}>Debts (dettes)</span>
                      </div>

                      <div style={{ display: "grid", gap: "6px", color: "#475569", fontSize: "14px" }}>
                        <div>3e pilier inclus : non</div>
                        <div>Assets (fortune fiscale) : {formatMontantCHF(Number(taxwarePayloadControle.Assets || 0))}</div>
                        <div>Debts (dettes) : {formatMontantCHF(Number(taxwarePayloadControle.Debts || 0))}</div>
                        <div>Resultat calcule par TaxWare : fortune nette fiscale</div>
                        <div>
                          La fortune nette n’est pas envoyée directement. TaxWare calcule la fortune nette
                          a partir de Assets et Debts.
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={subCardStyle}>
                    <h4 style={{ marginTop: 0, marginBottom: "14px", color: "#1e293b" }}>
                      Contrôle revenus
                    </h4>

                    <div style={{ display: "grid", gap: "12px" }}>
                      <span style={helperStyle}>Contrôle interne avant calcul final TaxWare</span>

                      <div>
                        <label style={labelStyle}>Revenus saisis</label>
                        <input
                          type="text"
                          value={formatMontantCHF(totalRevenusCalcule)}
                          readOnly
                          style={inputReadOnlyStyle}
                        />
                      </div>

                      <div>
                        <label style={labelStyle}>3e pilier</label>
                        <input
                          type="text"
                          value={formatMontantCHF(dossier.fiscalite.troisiemePilierSimule)}
                          readOnly
                          style={inputReadOnlyStyle}
                        />
                      </div>

                      <div>
                        <label style={labelStyle}>Rachat LPP</label>
                        <input
                          type="text"
                          value={formatMontantCHF(dossier.fiscalite.rachatLpp)}
                          readOnly
                          style={inputReadOnlyStyle}
                        />
                        <span style={helperStyle}>Finance par fortune liquide</span>
                      </div>

                      <div>
                        <label style={labelStyle}>Autres déductions connues</label>
                        <input
                          type="text"
                          value={formatMontantCHF(chargesDeductiblesTaxware)}
                          readOnly
                          style={inputReadOnlyStyle}
                        />
                        <span style={helperStyle}>
                          Déductions diverses et frais immobiliers transmis via `MiscExpenses`
                        </span>
                      </div>

                      <div>
                        <label style={labelStyle}>Revenu de contrôle après déductions</label>
                        <input
                          type="text"
                          value={formatMontantCHF(revenuControleApresDeductions)}
                          readOnly
                          style={inputReadOnlyStyle}
                        />
                        <span style={helperStyle}>
                          Inclut la correction immobilière locale, le 3e pilier, le rachat LPP et
                          l ajustement manuel
                        </span>
                      </div>

                      <div>
                        <label style={labelStyle}>Revenu avant déductions envoyé à TaxWare</label>
                        <input
                          type="text"
                          value={formatMontantCHF(
                            Number(taxwarePayloadControle.PersonLeading?.NetWages || 0) +
                            Number(taxwarePayloadControle.PersonLeading?.PensionIncome || 0) +
                            Number(taxwarePayloadControle.AssetIncome || 0) +
                            Number(taxwarePayloadControle.MiscIncome || 0) +
                            revenusImmobiliersTaxware
                          )}
                          readOnly
                          style={inputReadOnlyStyle}
                        />
                        <span style={helperStyle}>
                          Déductions envoyées séparément via `ThirdPillarContribution`, `LobContributions`, `DebtInterests` et `MiscExpenses`
                        </span>
                      </div>

                      <div style={{ display: "grid", gap: "6px", color: "#475569", fontSize: "14px" }}>
                        <div>3e pilier déduit du revenu imposable : oui</div>
                        <div>Rachat LPP déduit du revenu imposable : oui</div>
                        <div>
                          Intérêts hypothécaires transmis :{" "}
                          {interetsHypothecairesDeductibles > 0 ? "oui" : "non"}
                        </div>
                        <div>
                          Charges déductibles transmises :{" "}
                          {chargesDeductiblesTaxware > 0 ? "oui" : "non"}
                        </div>
                        <div>
                          Immobilier transmis via `RealEstates` :{" "}
                          {realEstatesTaxware.length > 0 ? "oui" : "non"}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {taxResult && (
                <div style={subCardStyle}>
                  <h3 style={{ marginTop: 0, marginBottom: "8px", color: "#1e293b" }}>
                    Donnees envoyees a TaxWare
                  </h3>
                  <span style={helperStyle}>
                    Valeurs effectivement transmises dans le payload au moteur fiscal
                  </span>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "12px 20px",
                      marginTop: "16px",
                    }}
                  >
                    <div>
                      <strong>NPA envoye :</strong> {taxwarePayloadControle.Zip || "-"}
                    </div>

                    <div>
                      <strong>Ville envoyee :</strong> {taxwarePayloadControle.City || "-"}
                    </div>

                    <div>
                      <strong>Revenu avant deductions :</strong>{" "}
                      {formatMontantCHF(
                        Number(taxwarePayloadControle.PersonLeading?.NetWages || 0) +
                        Number(taxwarePayloadControle.PersonLeading?.PensionIncome || 0) +
                        Number(taxwarePayloadControle.AssetIncome || 0) +
                        Number(taxwarePayloadControle.MiscIncome || 0) +
                        revenusImmobiliersTaxware
                      )}
                    </div>

                    <div>
                      <strong>Rentes transmises :</strong>{" "}
                      {formatMontantCHF(
                        Number(taxwarePayloadControle.PersonLeading?.PensionIncome || 0)
                      )}
                    </div>

                    <div>
                      <strong>Revenu de fortune transmis :</strong>{" "}
                      {formatMontantCHF(Number(taxwarePayloadControle.AssetIncome || 0))}
                    </div>

                    <div>
                      <strong>3e pilier transmis :</strong>{" "}
                      {formatMontantCHF(
                        Number(taxwarePayloadControle.PersonLeading?.ThirdPillarContribution || 0)
                      )}
                    </div>

                    <div>
                      <strong>Rachat LPP transmis :</strong>{" "}
                      {formatMontantCHF(
                        Number(taxwarePayloadControle.PersonLeading?.LobContributions || 0)
                      )}
                    </div>

                    <div>
                      <strong>Assets transmis :</strong>{" "}
                      {formatMontantCHF(Number(taxwarePayloadControle.Assets || 0))}
                    </div>

                    <div>
                      <strong>Debts transmis :</strong>{" "}
                      {formatMontantCHF(Number(taxwarePayloadControle.Debts || 0))}
                    </div>

                    <div>
                      <strong>Intérêts hypothécaires transmis :</strong>{" "}
                      {formatMontantCHF(Number(taxwarePayloadControle.DebtInterests || 0))}
                    </div>

                    <div>
                      <strong>Charges déductibles transmises :</strong>{" "}
                      {formatMontantCHF(Number(taxwarePayloadControle.MiscExpenses || 0))}
                    </div>

                    <div>
                      <strong>Revenus immobiliers transmis :</strong>{" "}
                      {formatMontantCHF(revenusImmobiliersTaxware)}
                    </div>

                    <div>
                      <strong>Frais immobiliers transmis :</strong>{" "}
                      {formatMontantCHF(fraisImmobiliersTaxware)}
                    </div>
                  </div>
                </div>
              )}

              <div style={subCardStyle}>
                <h3 style={{ marginTop: 0, marginBottom: "14px", color: "#1e293b" }}>
                  Mapping UI → TaxWare
                </h3>

                <div style={{ display: "grid", gap: "10px", color: "#334155", fontSize: "14px" }}>
                  <div>Fortune fiscale → `Assets`</div>
                  <div>Dettes → `Debts`</div>
                  <div>Salaire → `PersonLeading.NetWages`</div>
                  <div>AVS + LPP → `PersonLeading.PensionIncome`</div>
                  <div>Autres revenus patrimoniaux → `AssetIncome`</div>
                  <div>Habitation propre / rendement → `RealEstates[].RentalIncome`</div>
                  <div>Frais d’entretien immobiliers → `RealEstates[].EffectiveExpenses`</div>
                  <div>3e pilier simulé → `PersonLeading.ThirdPillarContribution`</div>
                  <div>Rachat LPP → `PersonLeading.LobContributions`</div>
                  <div>Intérêts hypothécaires immobiliers et logement qualifié → `DebtInterests`</div>
                  <div>Autres charges qualifiées et frais divers → `MiscExpenses`</div>
                  <div>Ville fiscale → `City`</div>
                  <div>NPA fiscal → `Zip`</div>
                </div>
              </div>

              <div style={subCardStyle}>
                <h3 style={{ marginTop: 0, marginBottom: "14px", color: "#1e293b" }}>
                  Payload JSON
                </h3>

                <pre
                  style={{
                    margin: 0,
                    padding: "16px",
                    borderRadius: "12px",
                    backgroundColor: "#0f172a",
                    color: "#e2e8f0",
                    overflowX: "auto",
                    fontSize: "13px",
                    lineHeight: 1.5,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {taxwarePayloadJson}
                </pre>
              </div>

              <div style={subCardStyle}>
                <h3 style={{ marginTop: 0, marginBottom: "14px", color: "#1e293b" }}>
                  Lecture métier
                </h3>

                <div style={{ display: "grid", gap: "10px", color: "#334155", fontSize: "14px" }}>
                  <div>
                    La fortune n’est pas envoyée nette dans un seul champ, elle est transmise via
                    `Assets` et `Debts`.
                  </div>
                  <div>
                    Le revenu imposable final n’est pas saisi directement, il est reconstitué par
                    TaxWare à partir du revenu et des déductions.
                  </div>
                  <div>
                    Le 3e pilier et le rachat LPP sont transmis séparément comme déductions.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        </div>

        {activeSectionId === "charges" && (
        <GuidedSection
          id="charges"
          step="4"
          title="Charges annuelles"
          description="Cette section regroupe les dépenses du foyer et les agrégats budgétaires déjà calculés. Elle permet de visualiser clairement l’impact des charges sur la marge annuelle."
        >
        <div style={sectionCardStyle}>
          <h2 style={{ marginTop: 0, marginBottom: "20px", color: "#0f172a" }}>
            Charges
          </h2>

          <CollapsibleHelp title="Aide charges">
            {sectionHelpTexts.charges.map((text) => (
              <div key={text}>{text}</div>
            ))}
          </CollapsibleHelp>

          <div
            style={{
              marginBottom: "16px",
              padding: "12px 14px",
              borderRadius: "12px",
              backgroundColor: "#fff7ed",
              border: "1px solid #fed7aa",
              color: "#9a3412",
              lineHeight: 1.6,
            }}
          >
            Les éléments fiscaux immobiliers (intérêts hypothécaires, frais d’entretien) se
            saisissent dans le bloc Immobilier.
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "16px",
              alignItems: "stretch",
            }}
          >
            <div style={chargeCardStyle}>
              <label style={labelStyle}>Logement</label>
              <div style={chargeFieldStackStyle}>
                <input
                  type="number"
                  value={dossier.charges.logement}
                  onChange={(e) =>
                    setDossier({
                      ...dossier,
                      charges: {
                        ...dossier.charges,
                        logement: numberValue(e.target.value),
                      },
                    })
                  }
                  style={inputStyle}
                />
                <span style={helperStyle}>Saisie manuelle</span>
              </div>
              <div style={chargeFooterPlaceholderStyle} />
            </div>

            <div style={chargeCardStyle}>
              <label style={labelStyle}>Primes maladie</label>
              <div style={chargeFieldStackStyle}>
                <input
                  type="number"
                  value={dossier.charges.primesMaladie}
                  onChange={(e) =>
                    setDossier({
                      ...dossier,
                      charges: {
                        ...dossier.charges,
                        primesMaladie: numberValue(e.target.value),
                      },
                    })
                  }
                  style={inputStyle}
                />
                <span style={helperStyle}>Saisie manuelle</span>
              </div>
              <div style={chargeFooterPlaceholderStyle} />
            </div>

            <div style={chargeCardStyle}>
              <label style={labelStyle}>Impôts revenu et fortune</label>
              <div style={chargeFieldStackStyle}>
                <input
                  type="text"
                  value={formatMontantCHFArrondi(impotRevenuFortuneCharge)}
                  readOnly
                  style={inputReadOnlyStyle}
                />
                <span style={helperStyle}>
                  Repris automatiquement depuis l impôt total affiche
                </span>
              </div>
              <div style={chargeFooterPlaceholderStyle} />
            </div>

            <div style={chargeCardStyle}>
              <label style={labelStyle}>3e pilier simulé</label>
              <div style={chargeFieldStackStyle}>
                <input
                  type="text"
                  value={formatMontantCHFArrondi(dossier.fiscalite.troisiemePilierSimule)}
                  readOnly
                  style={inputReadOnlyStyle}
                />
                <span style={helperStyle}>
                  Sortie budgétaire automatique intégrée dans les charges
                </span>
              </div>
              <div style={chargeFooterPlaceholderStyle} />
            </div>

            <div style={chargeCardStyle}>
              <label style={labelStyle}>Frais de vie</label>
              <div style={chargeFieldStackStyle}>
                <input
                  type="number"
                  value={dossier.charges.fraisVie}
                  onChange={(e) =>
                    setDossier({
                      ...dossier,
                      charges: {
                        ...dossier.charges,
                        fraisVie: numberValue(e.target.value),
                      },
                    })
                  }
                  style={inputStyle}
                />
                <span style={helperStyle}>Saisie manuelle</span>
              </div>
              <div style={chargeFooterPlaceholderStyle} />
            </div>

            <div style={chargeCardStyle}>
              <label style={labelStyle}>Autres charges</label>
              <div style={chargeFieldStackStyle}>
                <input
                  type="number"
                  value={dossier.charges.autresCharges}
                  onChange={(e) =>
                    setDossier({
                      ...dossier,
                      charges: {
                        ...dossier.charges,
                        autresCharges: numberValue(e.target.value),
                      },
                    })
                  }
                  style={inputStyle}
                />
                <span style={helperStyle}>Saisie manuelle</span>
              </div>
              <div style={chargeFooterStyle}>
                <label style={checkboxRowStyle}>
                  <input
                    type="checkbox"
                    checked={Boolean(dossier.charges.autresChargesIsPensionDeductible)}
                    onChange={(e) =>
                      setDossier({
                        ...dossier,
                        charges: {
                          ...dossier.charges,
                          autresChargesIsPensionDeductible: e.target.checked,
                        },
                      })
                    }
                  />
                  <span style={checkboxTextStackStyle}>
                    <span>
                      Ce montant correspond à des charges déductibles (ex : pensions alimentaires)
                    </span>
                    <span style={helperStyle}>
                      À cocher uniquement si ce montant correspond à des charges fiscalement
                      déductibles selon la situation du client.
                    </span>
                  </span>
                </label>
              </div>
            </div>

            <div style={chargeCardStyle}>
              <label style={labelStyle}>Total charges</label>
              <div style={chargeFieldStackStyle}>
                <input
                  type="text"
                  value={formatMontantCHFArrondi(totalChargesCalcule)}
                  readOnly
                  style={inputReadOnlyStyle}
                />
                <span style={helperStyle}>
                  Calcul automatique, 3e pilier simulé et intérêts hypothécaires immobiliers inclus
                </span>
              </div>
              <div style={chargeFooterPlaceholderStyle} />
            </div>

            <div style={chargeCardStyle}>
              <label style={labelStyle}>Marge annuelle</label>
              <div style={chargeFieldStackStyle}>
                <input
                  type="text"
                  value={formatMontantCHFArrondi(margeAnnuelleCalcule)}
                  readOnly
                  style={inputReadOnlyStyle}
                />
                <span style={helperStyle}>
                  Calcul automatique, avec maintien des intérêts hypothécaires comme dépense réelle
                </span>
              </div>
              <div style={chargeFooterPlaceholderStyle} />
            </div>
          </div>
        </div>
        </GuidedSection>
        )}

        {activeSectionId === "fiscalite" && (
        <GuidedSection
          id="fiscalite"
          step="5"
          title="Fiscalité et simulation"
          description="Saisissez la base fiscale actuelle du client, puis laissez l’application mesurer l’impact du changement de régime immobilier et des leviers de simulation sans reconstruire la fiscalité depuis zéro."
        >
        <div style={sectionCardStyle}>
          <h2 style={{ marginTop: 0, marginBottom: "20px", color: "#0f172a" }}>
            Fiscalité
          </h2>

          <CollapsibleHelp title="Aide fiscalite">
            {sectionHelpTexts.fiscalite.map((text) => (
              <div key={text}>{text}</div>
            ))}
          </CollapsibleHelp>

          <div
            style={{
              marginBottom: "16px",
              padding: "14px 16px",
              borderRadius: "12px",
              backgroundColor: "#f8fafc",
              border: "1px solid #dbeafe",
              color: "#334155",
              lineHeight: 1.7,
            }}
          >
            <strong style={{ color: "#0f172a" }}>Remarque importante</strong>
            <div>
              La base fiscale actuelle saisie représente déjà la situation fiscale réelle du client.
            </div>
            <div>
              Elle inclut déjà le traitement immobilier actuel, notamment la valeur locative,
              les intérêts hypothécaires admis et les frais d’entretien admis.
            </div>
            <div>
              Les champs immobiliers servent uniquement à simuler l’écart entre le régime actuel
              et le régime réformé.
            </div>
          </div>

          <div
            style={{
              marginBottom: "16px",
              padding: "18px",
              borderRadius: "14px",
              backgroundColor: "#ffffff",
              border: "1px solid #dbeafe",
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: "8px", color: "#0f172a" }}>
              Base fiscale actuelle
            </h3>
            <span style={helperStyle}>
              Ces montants représentent la situation fiscale actuelle du client et incluent déjà le traitement immobilier actuel.
            </span>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "14px",
                marginTop: "18px",
              }}
            >
              <div>
                <label style={labelStyle}>Revenu imposable IFD</label>
                <input
                  type="number"
                  value={dossier.fiscalite.revenuImposableIfd || 0}
                  onChange={(e) =>
                    setDossier({
                      ...dossier,
                      fiscalite: {
                        ...dossier.fiscalite,
                        revenuImposableIfd: Math.max(0, numberValue(e.target.value)),
                      },
                    })
                  }
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Revenu imposable Canton / Commune</label>
                <input
                  type="number"
                  value={dossier.fiscalite.revenuImposable || 0}
                  onChange={(e) =>
                    setDossier({
                      ...dossier,
                      fiscalite: {
                        ...dossier.fiscalite,
                        revenuImposable: Math.max(0, numberValue(e.target.value)),
                      },
                    })
                  }
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Fortune imposable</label>
                <input
                  type="number"
                  value={dossier.fiscalite.fortuneImposableActuelleSaisie || 0}
                  onChange={(e) =>
                    setDossier({
                      ...dossier,
                      fiscalite: {
                        ...dossier.fiscalite,
                        fortuneImposableActuelleSaisie: Math.max(
                          0,
                          numberValue(e.target.value)
                        ),
                      },
                    })
                  }
                  style={inputStyle}
                />
              </div>
            </div>
          </div>

          <div
            style={{
              marginBottom: "16px",
              padding: "18px",
              borderRadius: "14px",
              backgroundColor: "#ffffff",
              border: "1px solid #dbeafe",
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: "8px", color: "#0f172a" }}>
              Ajustements de simulation
            </h3>
            <span style={helperStyle}>
              La simulation ajoute ou retire uniquement les écarts liés au régime sélectionné et aux leviers fiscaux.
            </span>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "14px",
                marginTop: "18px",
              }}
            >
              <div>
                <label style={labelStyle}>Variation valeur locative</label>
                <input
                  type="text"
                  value={formatMontantCHFSigne(variationValeurLocativeSimulation)}
                  readOnly
                  style={inputReadOnlyStyle}
                />
                <span style={helperStyle}>
                  {regimeImmobilierActuel
                    ? "Aucun écart: la base actuelle correspond déjà au régime actuel."
                    : "La valeur locative actuelle est retirée de la base fiscale simulée."}
                </span>
              </div>
              <div>
                <label style={labelStyle}>Variation intérêts hypothécaires</label>
                <input
                  type="text"
                  value={formatMontantCHFSigne(variationInteretsHypothecairesSimulation)}
                  readOnly
                  style={inputReadOnlyStyle}
                />
                <span style={helperStyle}>
                  {regimeImmobilierActuel
                    ? "Aucun écart sur la déductibilité des intérêts en régime actuel."
                    : "Les intérêts actuellement admis sont réintégrés dans la base simulée."}
                </span>
              </div>
              <div>
                <label style={labelStyle}>Variation frais d’entretien</label>
                <input
                  type="text"
                  value={formatMontantCHFSigne(variationFraisEntretienSimulation)}
                  readOnly
                  style={inputReadOnlyStyle}
                />
                <span style={helperStyle}>
                  {regimeImmobilierActuel
                    ? "Aucun écart sur les frais d’entretien en régime actuel."
                    : "Les frais actuellement admis sont réintégrés dans la base simulée."}
                </span>
              </div>
              <div>
                <label style={labelStyle}>Total des ajustements fiscaux immobiliers</label>
                <input
                  type="text"
                  value={formatMontantCHFSigne(totalAjustementsImmobiliersSimulation)}
                  readOnly
                  style={inputReadOnlyStyle}
                />
                <span style={helperStyle}>
                  Delta immobilier net appliqué à la base actuelle avant calcul TaxWare.
                </span>
              </div>
            </div>
          </div>

          <div
            style={{
              marginBottom: "16px",
              padding: "18px",
              borderRadius: "14px",
              backgroundColor: "#ffffff",
              border: "1px solid #dbeafe",
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: "8px", color: "#0f172a" }}>
              Leviers de simulation
            </h3>
            <span style={helperStyle}>
              Ces leviers s’ajoutent à la logique par écart sans jamais remplacer la base fiscale actuelle.
            </span>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "14px",
                marginTop: "18px",
              }}
            >
              <div>
                <label style={labelStyle}>3e pilier simulé</label>
                <input
                  type="number"
                  value={dossier.fiscalite.troisiemePilierSimule || 0}
                  onChange={(e) =>
                    setDossier({
                      ...dossier,
                      fiscalite: {
                        ...dossier.fiscalite,
                        troisiemePilierSimule: Math.max(0, numberValue(e.target.value)),
                      },
                    })
                  }
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Rachat LPP</label>
                <input
                  type="number"
                  value={dossier.fiscalite.rachatLpp || 0}
                  onChange={(e) =>
                    setDossier({
                      ...dossier,
                      fiscalite: {
                        ...dossier.fiscalite,
                        rachatLpp: Math.max(0, numberValue(e.target.value)),
                      },
                    })
                  }
                  style={inputStyle}
                />
              </div>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "14px",
                marginTop: "14px",
              }}
            >
              <div>
                <label style={labelStyle}>Impact prévoyance sur le revenu</label>
                <input
                  type="text"
                  value={formatMontantCHFSigne(ajustementPrevoyanceSimulation)}
                  readOnly
                  style={inputReadOnlyStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Ajustement manuel de simulation</label>
                <input
                  type="text"
                  value={formatMontantCHFSigne(ajustementManuelSimulation)}
                  readOnly
                  style={inputReadOnlyStyle}
                />
              </div>
            </div>
          </div>

          <div
            style={{
              marginBottom: "16px",
              padding: "18px",
              borderRadius: "14px",
              background: "linear-gradient(180deg, #f8fbff 0%, #ffffff 100%)",
              border: "1px solid #bfdbfe",
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: "8px", color: "#0f172a" }}>
              Base fiscale simulée
            </h3>
            <span style={helperStyle}>
              Lecture seule: base actuelle saisie +/- ajustements de simulation.
            </span>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "14px",
                marginTop: "18px",
              }}
            >
              <div>
                <label style={labelStyle}>Revenu imposable IFD simulé</label>
                <input
                  type="text"
                  value={formatMontantCHFArrondi(revenuImposableIfdSimule)}
                  readOnly
                  style={inputReadOnlyStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Revenu imposable canton / commune simulé</label>
                <input
                  type="text"
                  value={formatMontantCHFArrondi(revenuImposableCantonalSimule)}
                  readOnly
                  style={inputReadOnlyStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Fortune imposable simulée</label>
                <input
                  type="text"
                  value={formatMontantCHFArrondi(fortuneImposableSimulee)}
                  readOnly
                  style={inputReadOnlyStyle}
                />
              </div>
            </div>
          </div>

          <div style={{ ...sectionCardStyle, marginTop: "20px", marginBottom: 0 }}>
            <h3 style={{ marginTop: 0, marginBottom: "8px", color: "#0f172a" }}>
              Résultat fiscal TaxWare
            </h3>
            <span style={helperStyle}>
              Les sorties ci-dessous proviennent des appels TaxWare construits à partir de la base fiscale simulée, elle-même calculée par écart depuis la base actuelle.
            </span>

            {String(
              taxResultAffiche?.normalized?.cantonalContext?.cantonRule || ""
            ).startsWith("vaud") && (
              <div
                style={{
                  marginTop: "16px",
                  padding: "14px 16px",
                  borderRadius: "12px",
                  backgroundColor: "#f8fafc",
                  border: "1px solid #bfdbfe",
                  color: "#334155",
                  lineHeight: 1.6,
                }}
              >
                La normalisation Vaud additionne les composantes fiscales spécifiques VD renvoyées
                par TaxWare, notamment les taxes additionnelles cantonales et communales.
              </div>
            )}

            {shouldShowVaudDebugPanel && (
              <div
                style={{
                  marginTop: "16px",
                  padding: "18px",
                  borderRadius: "14px",
                  backgroundColor: "#0f172a",
                  border: "1px solid #1d4ed8",
                  color: "#e2e8f0",
                }}
              >
                <h4 style={{ marginTop: 0, marginBottom: "8px", color: "#ffffff" }}>
                  Debug Vaud / Lausanne
                </h4>
                <div style={{ color: "#93c5fd", fontSize: "13px", lineHeight: 1.6 }}>
                  Comparaison entre la réponse brute TaxWare et la reconstitution affichée par
                  l’application. Visible uniquement en développement.
                </div>

                <div
                  style={{
                    marginTop: "16px",
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: "14px",
                  }}
                >
                  <div style={{ ...subCardStyle, backgroundColor: "#111c33", border: "1px solid #1e3a8a" }}>
                    <label style={{ ...labelStyle, color: "#bfdbfe" }}>Revenu imposable cantonal</label>
                    <input
                      type="text"
                      value={formatMontantTaxware(vaudDebugTaxableIncomeCantonal)}
                      readOnly
                      style={inputReadOnlyStyle}
                    />
                    <span style={{ ...helperStyle, color: "#93c5fd" }}>Valeur brute TaxWare</span>
                  </div>

                  <div style={{ ...subCardStyle, backgroundColor: "#111c33", border: "1px solid #1e3a8a" }}>
                    <label style={{ ...labelStyle, color: "#bfdbfe" }}>Revenu déterminant cantonal</label>
                    <input
                      type="text"
                      value={formatMontantTaxware(vaudDebugRateDefiningIncomeCantonal)}
                      readOnly
                      style={inputReadOnlyStyle}
                    />
                    <span style={{ ...helperStyle, color: "#93c5fd" }}>Champ `RatedefIncomeCanton`</span>
                  </div>

                  <div style={{ ...subCardStyle, backgroundColor: "#111c33", border: "1px solid #1e3a8a" }}>
                    <label style={{ ...labelStyle, color: "#bfdbfe" }}>TaxCanton</label>
                    <input
                      type="text"
                      value={formatMontantTaxware(vaudDebugTaxCanton)}
                      readOnly
                      style={inputReadOnlyStyle}
                    />
                  </div>

                  <div style={{ ...subCardStyle, backgroundColor: "#111c33", border: "1px solid #1e3a8a" }}>
                    <label style={{ ...labelStyle, color: "#bfdbfe" }}>TaxMunicipality</label>
                    <input
                      type="text"
                      value={formatMontantTaxware(vaudDebugTaxMunicipality)}
                      readOnly
                      style={inputReadOnlyStyle}
                    />
                  </div>

                  <div style={{ ...subCardStyle, backgroundColor: "#111c33", border: "1px solid #1e3a8a" }}>
                    <label style={{ ...labelStyle, color: "#bfdbfe" }}>CantonAdditionalTax</label>
                    <input
                      type="text"
                      value={formatMontantTaxware(vaudDebugCantonAdditionalTax)}
                      readOnly
                      style={inputReadOnlyStyle}
                    />
                  </div>

                  <div style={{ ...subCardStyle, backgroundColor: "#111c33", border: "1px solid #1e3a8a" }}>
                    <label style={{ ...labelStyle, color: "#bfdbfe" }}>MunicipalityAdditionalTax</label>
                    <input
                      type="text"
                      value={formatMontantTaxware(vaudDebugMunicipalityAdditionalTax)}
                      readOnly
                      style={inputReadOnlyStyle}
                    />
                  </div>

                  <div style={{ ...subCardStyle, backgroundColor: "#111c33", border: "1px solid #1e3a8a" }}>
                    <label style={{ ...labelStyle, color: "#bfdbfe" }}>Total cantonal reconstitué</label>
                    <input
                      type="text"
                      value={formatMontantTaxware(vaudDebugCantonalReconstituted)}
                      readOnly
                      style={inputReadOnlyStyle}
                    />
                    <span style={{ ...helperStyle, color: "#93c5fd" }}>
                      `TaxCanton + CantonAdditionalTax`
                    </span>
                  </div>

                  <div style={{ ...subCardStyle, backgroundColor: "#111c33", border: "1px solid #1e3a8a" }}>
                    <label style={{ ...labelStyle, color: "#bfdbfe" }}>Total communal reconstitué</label>
                    <input
                      type="text"
                      value={formatMontantTaxware(vaudDebugCommunalReconstituted)}
                      readOnly
                      style={inputReadOnlyStyle}
                    />
                    <span style={{ ...helperStyle, color: "#93c5fd" }}>
                      `TaxMunicipality + MunicipalityAdditionalTax`
                    </span>
                  </div>

                  <div style={{ ...subCardStyle, backgroundColor: "#111c33", border: "1px solid #1e3a8a" }}>
                    <label style={{ ...labelStyle, color: "#bfdbfe" }}>
                      Total impôt Vaud affiché dans l’application
                    </label>
                    <input
                      type="text"
                      value={formatMontantTaxware(vaudDisplayedTaxTotal)}
                      readOnly
                      style={inputReadOnlyStyle}
                    />
                    <span style={{ ...helperStyle, color: "#93c5fd" }}>
                      `normalized.cantonalCommunalTax`
                    </span>
                  </div>
                </div>

                <div
                  style={{
                    marginTop: "16px",
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: "14px",
                  }}
                >
                  <div style={{ ...subCardStyle, backgroundColor: "#111c33", border: "1px solid #1e3a8a" }}>
                    <label style={{ ...labelStyle, color: "#bfdbfe" }}>Partnership UI / React</label>
                    <input
                      type="text"
                      value={String(vaudUiPartnership)}
                      readOnly
                      style={inputReadOnlyStyle}
                    />
                  </div>

                  <div style={{ ...subCardStyle, backgroundColor: "#111c33", border: "1px solid #1e3a8a" }}>
                    <label style={{ ...labelStyle, color: "#bfdbfe" }}>Children UI / React</label>
                    <input
                      type="text"
                      value={String(vaudUiChildrenCount)}
                      readOnly
                      style={inputReadOnlyStyle}
                    />
                  </div>

                  <div style={{ ...subCardStyle, backgroundColor: "#111c33", border: "1px solid #1e3a8a" }}>
                    <label style={{ ...labelStyle, color: "#bfdbfe" }}>partnership</label>
                    <input
                      type="text"
                      value={String(vaudPayloadPartnershipSent ?? "-")}
                      readOnly
                      style={inputReadOnlyStyle}
                    />
                    <span style={{ ...helperStyle, color: "#93c5fd" }}>Valeur envoyée dans le payload</span>
                  </div>

                  <div style={{ ...subCardStyle, backgroundColor: "#111c33", border: "1px solid #1e3a8a" }}>
                    <label style={{ ...labelStyle, color: "#bfdbfe" }}>NumChildren envoyé</label>
                    <input
                      type="text"
                      value={String(vaudPayloadChildrenCountSent ?? "-")}
                      readOnly
                      style={inputReadOnlyStyle}
                    />
                    <span style={{ ...helperStyle, color: "#93c5fd" }}>
                      Clé envoyée: {vaudPayloadActualChildrenKey} | Clé attendue: {vaudPayloadExpectedChildrenKey}
                    </span>
                  </div>

                  <div style={{ ...subCardStyle, backgroundColor: "#111c33", border: "1px solid #1e3a8a" }}>
                    <label style={{ ...labelStyle, color: "#bfdbfe" }}>quotientAppliedLocally</label>
                    <input
                      type="text"
                      value={String(vaudDebugContext?.quotientAppliedLocally ?? false)}
                      readOnly
                      style={inputReadOnlyStyle}
                    />
                  </div>

                  <div style={{ ...subCardStyle, backgroundColor: "#111c33", border: "1px solid #1e3a8a" }}>
                    <label style={{ ...labelStyle, color: "#bfdbfe" }}>Barème ICC envoyé</label>
                    <input
                      type="text"
                      value={String(vaudPayloadIccTariff ?? "Non transmis explicitement")}
                      readOnly
                      style={inputReadOnlyStyle}
                    />
                  </div>

                  <div style={{ ...subCardStyle, backgroundColor: "#111c33", border: "1px solid #1e3a8a" }}>
                    <label style={{ ...labelStyle, color: "#bfdbfe" }}>Barème fédéral envoyé</label>
                    <input
                      type="text"
                      value={String(vaudPayloadFederalTariff ?? "Non transmis explicitement")}
                      readOnly
                      style={inputReadOnlyStyle}
                    />
                  </div>

                  <div style={{ ...subCardStyle, backgroundColor: "#111c33", border: "1px solid #1e3a8a" }}>
                    <label style={{ ...labelStyle, color: "#bfdbfe" }}>
                      Quotient attendu théorique Vaud
                    </label>
                    <input
                      type="text"
                      value={vaudExpectedQuotientDebug}
                      readOnly
                      style={inputReadOnlyStyle}
                    />
                    <span style={{ ...helperStyle, color: "#93c5fd" }}>
                      Information debug uniquement, non utilisée dans le calcul.
                    </span>
                  </div>
                </div>

                <div
                  style={{
                    marginTop: "16px",
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: "14px",
                  }}
                >
                  <div style={{ ...subCardStyle, backgroundColor: "#111c33", border: "1px solid #1e3a8a" }}>
                    <label style={{ ...labelStyle, color: "#bfdbfe" }}>Partnership visible dans la réponse</label>
                    <input
                      type="text"
                      value={String(vaudResponsePartnershipEcho ?? "Non visible dans la réponse")}
                      readOnly
                      style={inputReadOnlyStyle}
                    />
                  </div>

                  <div style={{ ...subCardStyle, backgroundColor: "#111c33", border: "1px solid #1e3a8a" }}>
                    <label style={{ ...labelStyle, color: "#bfdbfe" }}>NumChildren visible dans la réponse</label>
                    <input
                      type="text"
                      value={String(vaudResponseChildrenEcho ?? "Non visible dans la réponse")}
                      readOnly
                      style={inputReadOnlyStyle}
                    />
                  </div>

                  <div style={{ ...subCardStyle, backgroundColor: "#111c33", border: "1px solid #1e3a8a" }}>
                    <label style={{ ...labelStyle, color: "#bfdbfe" }}>Barème ICC / revenu déterminant</label>
                    <input
                      type="text"
                      value={formatMontantTaxware(vaudDebugRateDefiningIncomeCantonal)}
                      readOnly
                      style={inputReadOnlyStyle}
                    />
                  </div>

                  <div style={{ ...subCardStyle, backgroundColor: "#111c33", border: "1px solid #1e3a8a" }}>
                    <label style={{ ...labelStyle, color: "#bfdbfe" }}>Barème fédéral / revenu déterminant</label>
                    <input
                      type="text"
                      value={formatMontantTaxware(vaudResponseRateDefFederal)}
                      readOnly
                      style={inputReadOnlyStyle}
                    />
                  </div>

                  <div style={{ ...subCardStyle, backgroundColor: "#111c33", border: "1px solid #1e3a8a" }}>
                    <label style={{ ...labelStyle, color: "#bfdbfe" }}>Réduction enfants fédérale</label>
                    <input
                      type="text"
                      value={formatMontantTaxware(vaudResponseFederalChildrenReduction)}
                      readOnly
                      style={inputReadOnlyStyle}
                    />
                  </div>

                  <div style={{ ...subCardStyle, backgroundColor: "#111c33", border: "1px solid #1e3a8a" }}>
                    <label style={{ ...labelStyle, color: "#bfdbfe" }}>Réduction enfants cantonale</label>
                    <input
                      type="text"
                      value={formatMontantTaxware(vaudResponseCantonalChildrenReduction)}
                      readOnly
                      style={inputReadOnlyStyle}
                    />
                  </div>

                  <div style={{ ...subCardStyle, backgroundColor: "#111c33", border: "1px solid #1e3a8a" }}>
                    <label style={{ ...labelStyle, color: "#bfdbfe" }}>Champ tarif dans la réponse</label>
                    <input
                      type="text"
                      value={String(vaudResponseTariffField ?? "Aucun champ tarif trouvé")}
                      readOnly
                      style={inputReadOnlyStyle}
                    />
                  </div>

                  <div style={{ ...subCardStyle, backgroundColor: "#111c33", border: "1px solid #1e3a8a" }}>
                    <label style={{ ...labelStyle, color: "#bfdbfe" }}>Champ quotient dans la réponse</label>
                    <input
                      type="text"
                      value={String(vaudResponseQuotientField ?? "Aucun champ quotient trouvé")}
                      readOnly
                      style={inputReadOnlyStyle}
                    />
                  </div>
                </div>

                <div
                  style={{
                    marginTop: "16px",
                    padding: "14px 16px",
                    borderRadius: "12px",
                    backgroundColor: "#111827",
                    border: "1px solid #334155",
                    color: "#e2e8f0",
                    lineHeight: 1.6,
                  }}
                >
                  <strong style={{ color: "#ffffff" }}>Lecture du montage actuel</strong>
                  <div>{vaudAppRecompositionMode}</div>
                  <div>
                    Audit enfants: le payload envoie désormais <code>NumChildren</code>,
                    conformément au schéma TaxWare local. <code>ChildrenCount</code> n’est plus envoyé.
                  </div>
                </div>

                <div
                  style={{
                    marginTop: "16px",
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                    gap: "14px",
                  }}
                >
                  <div
                    style={{
                      padding: "14px 16px",
                      borderRadius: "12px",
                      backgroundColor: "#3f1d1d",
                      border: "1px solid #7f1d1d",
                      color: "#fee2e2",
                      lineHeight: 1.6,
                    }}
                  >
                    <strong style={{ color: "#ffffff" }}>Avant</strong>
                    <div>Canton: {vaudPreviousMapping.cantonalField}</div>
                    <div>Commune: {vaudPreviousMapping.communalField}</div>
                    <div>Taux unique: {vaudPreviousMapping.unitaryField}</div>
                    <div>Total: {vaudPreviousMapping.totalField}</div>
                  </div>

                  <div
                    style={{
                      padding: "14px 16px",
                      borderRadius: "12px",
                      backgroundColor: "#0b2a1f",
                      border: "1px solid #14532d",
                      color: "#dcfce7",
                      lineHeight: 1.6,
                    }}
                  >
                    <strong style={{ color: "#ffffff" }}>Après</strong>
                    <div>Canton: {vaudCurrentMapping.cantonalField}</div>
                    <div>Commune: {vaudCurrentMapping.communalField}</div>
                    <div>Taux unique: {vaudCurrentMapping.unitaryField}</div>
                    <div>Total: {vaudCurrentMapping.totalField}</div>
                  </div>
                </div>

                <div
                  style={{
                    marginTop: "16px",
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                    gap: "14px",
                  }}
                >
                  <div
                    style={{
                      padding: "14px 16px",
                      borderRadius: "12px",
                      backgroundColor: "#111827",
                      border: "1px solid #334155",
                      color: "#e2e8f0",
                      lineHeight: 1.6,
                    }}
                  >
                    <strong style={{ color: "#ffffff" }}>Montants TaxWare reçus</strong>
                    <div>Canton brut: {formatMontantTaxware(vaudDebugTaxCanton)}</div>
                    <div>Commune brute: {formatMontantTaxware(vaudDebugTaxMunicipality)}</div>
                    <div>Taux unique brut: {formatMontantTaxware(vaudDebugRawUnitaryTax)}</div>
                    <div>Total brut: {formatMontantTaxware(vaudDebugRawTotalTax)}</div>
                  </div>

                  <div
                    style={{
                      padding: "14px 16px",
                      borderRadius: "12px",
                      backgroundColor: "#111827",
                      border: "1px solid #334155",
                      color: "#e2e8f0",
                      lineHeight: 1.6,
                    }}
                  >
                    <strong style={{ color: "#ffffff" }}>Montants normalisés</strong>
                    <div>Canton: {formatMontantTaxware(taxResultAffiche?.normalized?.cantonalTax)}</div>
                    <div>Commune: {formatMontantTaxware(taxResultAffiche?.normalized?.communalTax)}</div>
                    <div>Taux unique: {formatMontantTaxware(vaudCantonalBreakdown?.unitaryTax)}</div>
                    <div>Total: {formatMontantTaxware(taxResultAffiche?.normalized?.totalTax)}</div>
                  </div>

                  <div
                    style={{
                      padding: "14px 16px",
                      borderRadius: "12px",
                      backgroundColor: "#111827",
                      border: "1px solid #334155",
                      color: "#e2e8f0",
                      lineHeight: 1.6,
                    }}
                  >
                    <strong style={{ color: "#ffffff" }}>Comparaison avant / après</strong>
                    <div>Avant clé enfants: <code>ChildrenCount</code></div>
                    <div>Après clé enfants: <code>{vaudPayloadActualChildrenKey}</code></div>
                    <div>Doublon clé enfant: {vaudPayloadChildrenDuplicateState}</div>
                    <div>Valeur envoyée: {String(vaudPayloadChildrenCountSent ?? "-")}</div>
                  </div>
                </div>

                <div
                  style={{
                    marginTop: "16px",
                    padding: "14px 16px",
                    borderRadius: "12px",
                    backgroundColor: "#111827",
                    border: "1px solid #334155",
                    color: "#e2e8f0",
                    lineHeight: 1.6,
                  }}
                >
                  <strong style={{ color: "#ffffff" }}>Mapping actuel de l’application</strong>
                  <div>
                    <code>TaxCanton</code> / <code>CantonTax</code> {"->"} <code>normalized.cantonalTax</code>
                  </div>
                  <div>
                    <code>TaxMunicipality</code> / <code>MunicipalityTax</code> {"->"} <code>normalized.communalTax</code>
                  </div>
                  <div>
                    <code>CantonAdditionalTax</code> et <code>MunicipalityAdditionalTax</code> {"->"} ajoutés par la règle
                    Vaud si présents
                  </div>
                  <div>
                    <code>CantonMunicipalityParishTaxTotal</code> / <code>TaxTotal</code> {"->"} lus comme totaux globaux
                    si l’API les fournit
                  </div>
                  <div>
                    Les coefficients et taux (`CantonCoefficient`, `MunicipalityCoefficient`,
                    `*TaxRate`, `*AdditionalTaxRate`) sont aujourd’hui affichés en debug mais ne
                    modifient pas encore notre normalisation.
                  </div>
                </div>

                <div
                  style={{
                    marginTop: "16px",
                    display: "grid",
                    gap: "10px",
                  }}
                >
                  <h5 style={{ margin: 0, color: "#ffffff" }}>
                    Champs fiscaux candidats détectés
                  </h5>
                  {vaudDebugCandidates.map((candidate) => (
                    <div
                      key={candidate.label}
                      style={{
                        padding: "12px 14px",
                        borderRadius: "12px",
                        backgroundColor: candidate.usedByApp ? "#0b2a1f" : "#1f2937",
                        border: candidate.usedByApp
                          ? "1px solid #14532d"
                          : "1px solid #334155",
                        color: "#e2e8f0",
                      }}
                    >
                      <div style={{ fontWeight: 700, color: "#ffffff" }}>{candidate.label}</div>
                      <div style={{ fontSize: "13px", color: "#93c5fd", marginTop: "4px" }}>
                        Paths: {candidate.paths.join(" | ")}
                      </div>
                      <div style={{ marginTop: "6px" }}>
                        Valeur brute:{" "}
                        {typeof candidate.value === "number"
                          ? formatMontantCHFArrondi(candidate.value)
                          : String(candidate.value ?? "non trouvée")}
                      </div>
                      <div style={{ marginTop: "4px", color: "#cbd5e1", fontSize: "13px" }}>
                        {candidate.usedByApp ? "Actuellement lu par l’application" : "Présent mais non utilisé dans le calcul affiché"}
                      </div>
                    </div>
                  ))}
                </div>

                <div
                  style={{
                    marginTop: "16px",
                    padding: "14px 16px",
                    borderRadius: "12px",
                    backgroundColor: "#111827",
                    border: "1px solid #334155",
                    color: "#e2e8f0",
                    lineHeight: 1.6,
                  }}
                >
                  <strong style={{ color: "#ffffff" }}>Ce qui manque potentiellement</strong>
                  {vaudDebugMissingCandidates.length > 0 ? (
                    vaudDebugMissingCandidates.map((candidate) => (
                      <div key={candidate.label}>
                        {candidate.label}:{" "}
                        {typeof candidate.value === "number"
                          ? formatMontantCHFArrondi(candidate.value)
                          : String(candidate.value)}
                      </div>
                    ))
                  ) : (
                    <div>Aucun champ candidat supplémentaire détecté dans la réponse brute utile.</div>
                  )}
                </div>

                <div
                  style={{
                    marginTop: "16px",
                    padding: "14px 16px",
                    borderRadius: "12px",
                    backgroundColor: "#111827",
                    border: "1px solid #334155",
                  }}
                >
                  <div style={{ color: "#ffffff", fontWeight: 700, marginBottom: "8px" }}>
                    Réponse brute TaxWare utile
                  </div>
                  <pre
                    style={{
                      margin: 0,
                      color: "#cbd5e1",
                      fontSize: "12px",
                      lineHeight: 1.6,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      overflowX: "auto",
                    }}
                  >
                    {vaudDebugRawResponsePretty}
                  </pre>
                </div>

                <div
                  style={{
                    marginTop: "16px",
                    padding: "14px 16px",
                    borderRadius: "12px",
                    backgroundColor: "#111827",
                    border: "1px solid #334155",
                  }}
                >
                  <div style={{ color: "#ffffff", fontWeight: 700, marginBottom: "8px" }}>
                    Payload TaxWare réellement envoyé
                  </div>
                  <pre
                    style={{
                      margin: 0,
                      color: "#cbd5e1",
                      fontSize: "12px",
                      lineHeight: 1.6,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      overflowX: "auto",
                    }}
                  >
                    {taxwarePayloadJson}
                  </pre>
                </div>
              </div>
            )}

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: "16px",
                marginTop: "18px",
                alignItems: "stretch",
              }}
            >
              <div style={subCardStyle}>
                <h4 style={{ marginTop: 0, marginBottom: "12px", color: "#1e293b" }}>
                  Base actuelle saisie
                </h4>
                <div style={{ display: "grid", gap: "10px" }}>
                  <div>
                    <label style={labelStyle}>Revenu imposable IFD</label>
                    <input
                      type="text"
                      value={formatMontantCHFArrondi(revenuImposableIfdReference)}
                      readOnly
                      style={inputReadOnlyStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Revenu imposable Canton / Commune</label>
                    <input
                      type="text"
                      value={formatMontantCHFArrondi(revenuImposableReference)}
                      readOnly
                      style={inputReadOnlyStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Fortune imposable</label>
                    <input
                      type="text"
                      value={formatMontantCHFArrondi(fortuneImposableReference)}
                      readOnly
                      style={inputReadOnlyStyle}
                    />
                  </div>
                </div>
              </div>

              <div style={subCardStyle}>
                <h4 style={{ marginTop: 0, marginBottom: "12px", color: "#1e293b" }}>
                  Base simulée transmise
                </h4>
                <div style={{ display: "grid", gap: "10px" }}>
                  <div>
                    <label style={labelStyle}>Revenu imposable IFD simulé</label>
                    <input
                      type="text"
                      value={formatMontantCHFArrondi(revenuImposableIfdApresSimulationCalcule)}
                      readOnly
                      style={inputReadOnlyStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Revenu imposable Canton / Commune simulé</label>
                    <input
                      type="text"
                      value={formatMontantCHFArrondi(revenuImposableApresSimulationCalcule)}
                      readOnly
                      style={inputReadOnlyStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Fortune imposable simulée</label>
                    <input
                      type="text"
                      value={formatMontantCHFArrondi(fortuneImposableSimulee)}
                      readOnly
                      style={inputReadOnlyStyle}
                    />
                  </div>
                </div>
              </div>

              <div style={subCardStyle}>
                <h4 style={{ marginTop: 0, marginBottom: "12px", color: "#1e293b" }}>
                  Sorties TaxWare
                </h4>
                <div style={{ display: "grid", gap: "10px" }}>
                  <div>
                    <label style={labelStyle}>IFD</label>
                    <input
                      type="text"
                      value={formatMontantCHFArrondi(impotFederalDirect)}
                      readOnly
                      style={inputReadOnlyStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Impôt cantonal / communal</label>
                    <input
                      type="text"
                      value={formatMontantCHFArrondi(
                        taxResultAffiche?.normalized?.cantonalCommunalTax
                      )}
                      readOnly
                      style={inputReadOnlyStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Impôt sur la fortune</label>
                    <input
                      type="text"
                      value={formatMontantCHFArrondi(taxResultAffiche?.normalized?.wealthTax)}
                      readOnly
                      style={inputReadOnlyStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Impôt total</label>
                    <input
                      type="text"
                      value={formatMontantCHFArrondi(taxResultAffiche?.normalized?.totalTax)}
                      readOnly
                      style={inputReadOnlyStyle}
                    />
                  </div>
                </div>
              </div>

              <div style={subCardStyle}>
                <h4 style={{ marginTop: 0, marginBottom: "12px", color: "#1e293b" }}>
                  Rappel métier
                </h4>
                <div
                  style={{
                    padding: "14px 16px",
                    borderRadius: "12px",
                    backgroundColor: "#ffffff",
                    border: "1px solid #dbeafe",
                    color: "#334155",
                    lineHeight: 1.6,
                    fontSize: "14px",
                  }}
                >
                  Le bloc Immobilier est conservé pour la simulation métier et la comparaison
                  des scénarios. Il sert uniquement à calculer un delta de simulation à partir
                  de la base fiscale actuelle.
                </div>
              </div>
            </div>

            {showVaudFiscalBreakdown && (
              <div
                style={{
                  marginTop: "18px",
                  padding: "20px",
                  borderRadius: "14px",
                  background: "linear-gradient(180deg, #f8fbff 0%, #ffffff 100%)",
                  border: "1px solid #bfdbfe",
                  boxShadow: "0 10px 24px rgba(15, 23, 42, 0.05)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: "14px",
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <h4 style={{ marginTop: 0, marginBottom: "6px", color: "#0f172a" }}>
                      Structure de l’impôt Vaud
                    </h4>
                    <div style={{ color: "#475569", lineHeight: 1.6, fontSize: "14px" }}>
                      Présentation détaillée des composantes renvoyées par TaxWare, dans une
                      lecture plus proche de TaxWare Office.
                    </div>
                  </div>
                  <div
                    style={{
                      padding: "10px 12px",
                      borderRadius: "12px",
                      backgroundColor: "#eff6ff",
                      border: "1px solid #bfdbfe",
                      color: "#1e3a8a",
                      fontWeight: 700,
                      fontSize: "13px",
                    }}
                  >
                    Lecture Vaud dédiée
                  </div>
                </div>

                <div
                  style={{
                    marginTop: "16px",
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                    gap: "16px",
                    alignItems: "stretch",
                  }}
                >
                  <div style={subCardStyle}>
                    <h5 style={{ marginTop: 0, marginBottom: "12px", color: "#1e293b" }}>
                      Impôt principal
                    </h5>
                    <div style={{ display: "grid", gap: "10px" }}>
                      <div>
                        <label style={labelStyle}>Canton</label>
                        <input
                          type="text"
                          value={formatMontantTaxware(
                            vaudCantonalBreakdown?.principalCantonalTax
                          )}
                          readOnly
                          style={inputReadOnlyStyle}
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>Commune</label>
                        <input
                          type="text"
                          value={formatMontantTaxware(
                            vaudCantonalBreakdown?.principalCommunalTax
                          )}
                          readOnly
                          style={inputReadOnlyStyle}
                        />
                      </div>
                    </div>
                  </div>

                  <div style={subCardStyle}>
                    <h5 style={{ marginTop: 0, marginBottom: "12px", color: "#1e293b" }}>
                      Impôt à taux unique
                    </h5>
                    <div style={{ display: "grid", gap: "10px" }}>
                      <div>
                        <label style={labelStyle}>Montant séparé</label>
                        <input
                          type="text"
                          value={formatMontantTaxware(vaudCantonalBreakdown?.unitaryTax)}
                          readOnly
                          style={inputReadOnlyStyle}
                        />
                        <span style={helperStyle}>
                          Champ TaxWare `CantonUnitaryTax` / `UnitaryTax` si disponible.
                        </span>
                      </div>
                    </div>
                  </div>

                  <div style={subCardStyle}>
                    <h5 style={{ marginTop: 0, marginBottom: "12px", color: "#1e293b" }}>
                      Autres composantes
                    </h5>
                    <div style={{ display: "grid", gap: "10px" }}>
                      <div>
                        <label style={labelStyle}>Supplément cantonal</label>
                        <input
                          type="text"
                          value={formatMontantTaxware(
                            vaudCantonalBreakdown?.cantonAdditionalTax
                          )}
                          readOnly
                          style={inputReadOnlyStyle}
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>Supplément communal</label>
                        <input
                          type="text"
                          value={formatMontantTaxware(
                            vaudCantonalBreakdown?.municipalityAdditionalTax
                          )}
                          readOnly
                          style={inputReadOnlyStyle}
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>Impôt paroissial / autre</label>
                        <input
                          type="text"
                          value={formatMontantTaxware(vaudCantonalBreakdown?.churchTax)}
                          readOnly
                          style={inputReadOnlyStyle}
                        />
                      </div>
                    </div>
                  </div>

                  <div style={subCardStyle}>
                    <h5 style={{ marginTop: 0, marginBottom: "12px", color: "#1e293b" }}>
                      Total impôt Vaud
                    </h5>
                    <div style={{ display: "grid", gap: "10px" }}>
                      <div>
                        <label style={labelStyle}>Somme complète</label>
                        <input
                          type="text"
                          value={formatMontantTaxware(
                            vaudCantonalBreakdown?.displayedCantonalTotal
                          )}
                          readOnly
                          style={inputReadOnlyStyle}
                        />
                        <span style={helperStyle}>
                          Total cantonal / communal affiché par l’application, inchangé.
                        </span>
                      </div>
                      <div>
                        <label style={labelStyle}>Autres composantes éventuelles</label>
                        <input
                          type="text"
                          value={formatMontantTaxware(
                            vaudCantonalBreakdown?.otherComponentsTotal
                          )}
                          readOnly
                          style={inputReadOnlyStyle}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div
            className="fiscalite-inline-note"
            style={{
              marginTop: "20px",
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              gap: "8px",
            }}
          >
            <strong style={{ color: "#0f172a" }}>Simulation pilotée par le footer fixe</strong>
            <span style={helperStyle}>
              Le bouton principal reste visible en permanence en bas de l’écran et relance toutes
              les variantes en un seul clic.
            </span>
          </div>

          {taxResultReferenceBrute?.normalized && (
            <div
              style={{
                marginTop: "20px",
                padding: "20px",
                background: "#f8fafc",
                borderRadius: "12px",
                border: "1px solid #e2e8f0",
              }}
            >
              <h3 style={{ marginTop: 0, marginBottom: "8px", color: "#0f172a" }}>
                {resultatFiscalBrutTitle}
              </h3>
              <span style={helperStyle}>
                {resultatFiscalBrutHelper}
              </span>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: "15px",
                  marginTop: "16px",
                  alignItems: "stretch",
                }}
              >
                <div style={{ ...dataFieldCardStyle, minHeight: "126px", backgroundColor: "#ffffff" }}>
                  <label style={labelStyle}>Revenu imposable Canton / Commune</label>
                  <input
                    type="text"
                    value={formatMontantCHF(
                      taxResultReferenceBrute.normalized.taxableIncomeCantonal || 0
                    )}
                    readOnly
                    style={inputReadOnlyStyle}
                  />
                </div>

                <div style={{ ...dataFieldCardStyle, minHeight: "126px", backgroundColor: "#ffffff" }}>
                  <label style={labelStyle}>Revenu imposable IFD</label>
                  <input
                    type="text"
                    value={formatMontantCHF(
                      taxResultReferenceBrute.normalized.taxableIncomeFederal || 0
                    )}
                    readOnly
                    style={inputReadOnlyStyle}
                  />
                </div>

                <div style={{ ...dataFieldCardStyle, minHeight: "126px", backgroundColor: "#ffffff" }}>
                  <label style={labelStyle}>Fortune imposable</label>
                  <input
                    type="text"
                    value={formatMontantCHF(
                      taxResultReferenceBrute.normalized.taxableAssets || 0
                    )}
                    readOnly
                    style={inputReadOnlyStyle}
                  />
                </div>

                <div style={{ ...dataFieldCardStyle, minHeight: "126px", backgroundColor: "#ffffff" }}>
                  <label style={labelStyle}>Impôt cantonal / communal</label>
                  <input
                    type="text"
                    value={formatMontantCHF(
                      taxResultReferenceBrute.normalized.cantonalCommunalTax || 0
                    )}
                    readOnly
                    style={inputReadOnlyStyle}
                  />
                </div>

                <div style={{ ...dataFieldCardStyle, minHeight: "126px", backgroundColor: "#ffffff" }}>
                  <label style={labelStyle}>Impôt fédéral</label>
                  <input
                    type="text"
                    value={formatMontantCHF(
                      taxResultReferenceBrute.normalized.federalTax || 0
                    )}
                    readOnly
                    style={inputReadOnlyStyle}
                  />
                </div>

                <div style={{ ...dataFieldCardStyle, minHeight: "126px", backgroundColor: "#ffffff" }}>
                  <label style={labelStyle}>Impôt total</label>
                  <input
                    type="text"
                    value={formatMontantCHF(
                      taxResultReferenceBrute.normalized.totalTax || 0
                    )}
                    readOnly
                    style={inputReadOnlyStyle}
                  />
                </div>
              </div>
            </div>
          )}

          <div
            style={{
              marginTop: "20px",
              padding: "20px",
              background: "#f8fafc",
              borderRadius: "12px",
              border: "1px solid #e2e8f0",
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: "8px", color: "#0f172a" }}>
              Visualisations
            </h3>
            <span style={helperStyle}>
              Lecture visuelle rapide des impacts fiscaux et patrimoniaux du dossier
            </span>

            <div
              style={{
                marginTop: "16px",
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                gap: "16px",
                alignItems: "stretch",
              }}
            >
              <div style={subCardStyle}>
                <h4 style={{ marginTop: 0, marginBottom: "6px", color: "#1e293b" }}>
                  Impot avant / apres
                </h4>
                <span style={helperStyle}>
                  Avant = Base de reference. Apres = {chartTargetLabel}
                </span>

                <div style={{ width: "100%", height: "260px", marginTop: "12px" }}>
                  <ResponsiveContainer>
                    <BarChart data={impotAvantApresChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="label" tick={{ fill: "#475569", fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis
                        tickFormatter={(value) => formatMontantCHFCompact(Number(value))}
                        tick={{ fill: "#475569", fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                        width={70}
                      />
                      <Tooltip formatter={formatChartTooltipValue} />
                      <Bar dataKey="montant" radius={[8, 8, 0, 0]} fill="#0f172a" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div style={subCardStyle}>
                <h4 style={{ marginTop: 0, marginBottom: "6px", color: "#1e293b" }}>
                  Repartition des impots
                </h4>
                <span style={helperStyle}>
                  Detail fiscal TaxWare de {chartTargetLabel}
                </span>

                <div style={{ width: "100%", height: "260px", marginTop: "12px" }}>
                  {hasTaxBreakdownData ? (
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie
                          data={repartitionImpotsChartData}
                          dataKey="montant"
                          nameKey="label"
                          innerRadius={48}
                          outerRadius={82}
                          paddingAngle={2}
                        >
                          {repartitionImpotsChartData.map((entry, index) => (
                            <Cell key={entry.label} fill={chartPalette[index % chartPalette.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={formatChartTooltipValue} />
                        <Legend wrapperStyle={{ fontSize: "12px" }} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div
                      style={{
                        height: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#64748b",
                        fontSize: "14px",
                        textAlign: "center",
                      }}
                    >
                      Simulation fiscale requise pour afficher la repartition.
                    </div>
                  )}
                </div>
              </div>

              <div style={subCardStyle}>
                <h4 style={{ marginTop: 0, marginBottom: "6px", color: "#1e293b" }}>
                  Structure du patrimoine
                </h4>
                <span style={helperStyle}>
                  Structure patrimoniale client de {chartTargetLabel}
                </span>

                <div style={{ width: "100%", height: "260px", marginTop: "12px" }}>
                  {hasPatrimoineData ? (
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie
                          data={patrimoineChartData}
                          dataKey="montant"
                          nameKey="label"
                          innerRadius={48}
                          outerRadius={82}
                          paddingAngle={2}
                        >
                          {patrimoineChartData.map((entry, index) => (
                            <Cell key={entry.label} fill={chartPalette[index % chartPalette.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={formatChartTooltipValue} />
                        <Legend wrapperStyle={{ fontSize: "12px" }} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div
                      style={{
                        height: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#64748b",
                        fontSize: "14px",
                        textAlign: "center",
                      }}
                    >
                      Aucune composante patrimoniale significative a afficher.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {taxResultSansOptimisation?.normalized && taxResultAffiche?.normalized && (
            <div
              style={{
                marginTop: "20px",
                padding: "20px",
                background: "linear-gradient(180deg, #f8fafc 0%, #eef6ff 100%)",
                borderRadius: "12px",
                border: "1px solid #dbeafe",
                boxShadow: "0 10px 24px rgba(15, 23, 42, 0.05)",
              }}
            >
              <h3 style={{ marginTop: 0, marginBottom: "8px", color: "#0f172a" }}>
                Comparaison fiscale avant / apres optimisation
              </h3>
              <span style={helperStyle}>
                Comparaison basee sur les resultats reels TaxWare de la section
              </span>

              <div
                style={{
                  marginTop: "16px",
                  marginBottom: "18px",
                  padding: "14px 16px",
                  borderRadius: "12px",
                  backgroundColor: "#ffffff",
                  border: "1px solid #bfdbfe",
                }}
              >
                <div style={{ color: "#1d4ed8", fontSize: "13px", fontWeight: "bold" }}>
                  Economie totale
                </div>
                <div style={{ color: "#0f172a", fontSize: "28px", fontWeight: "bold" }}>
                  {formatEcartTaxware(
                    taxResultSansOptimisation.normalized.totalTax,
                    taxResultAffiche.normalized.totalTax
                  )}
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.1fr 1.1fr 1.1fr",
                  gap: "14px",
                  alignItems: "start",
                }}
              >
                <div style={subCardStyle}>
                  <h4 style={{ marginTop: 0, marginBottom: "12px", color: "#1e293b" }}>
                    Avant optimisation
                  </h4>
                  <div style={{ display: "grid", gap: "10px" }}>
                    <div>
                      <label style={labelStyle}>IFD</label>
                      <input
                        type="text"
                        value={formatMontantTaxware(taxResultSansOptimisation.normalized.federalTax)}
                        readOnly
                        style={inputReadOnlyStyle}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Impot cantonal</label>
                      <input
                        type="text"
                        value={formatMontantTaxware(taxResultSansOptimisation.normalized.cantonalTax)}
                        readOnly
                        style={inputReadOnlyStyle}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Impot communal</label>
                      <input
                        type="text"
                        value={formatMontantTaxware(taxResultSansOptimisation.normalized.communalTax)}
                        readOnly
                        style={inputReadOnlyStyle}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Impot sur la fortune</label>
                      <input
                        type="text"
                        value={formatMontantTaxware(taxResultSansOptimisation.normalized.wealthTax)}
                        readOnly
                        style={inputReadOnlyStyle}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Impot total</label>
                      <input
                        type="text"
                        value={formatMontantTaxware(taxResultSansOptimisation.normalized.totalTax)}
                        readOnly
                        style={inputReadOnlyStyle}
                      />
                    </div>
                  </div>
                </div>

                <div style={subCardStyle}>
                  <h4 style={{ marginTop: 0, marginBottom: "12px", color: "#1e293b" }}>
                    Apres optimisation
                  </h4>
                  <div style={{ display: "grid", gap: "10px" }}>
                    <div>
                      <label style={labelStyle}>IFD</label>
                      <input
                        type="text"
                        value={formatMontantTaxware(taxResultAffiche.normalized.federalTax)}
                        readOnly
                        style={inputReadOnlyStyle}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Impot cantonal</label>
                      <input
                        type="text"
                        value={formatMontantTaxware(taxResultAffiche.normalized.cantonalTax)}
                        readOnly
                        style={inputReadOnlyStyle}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Impot communal</label>
                      <input
                        type="text"
                        value={formatMontantTaxware(taxResultAffiche.normalized.communalTax)}
                        readOnly
                        style={inputReadOnlyStyle}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Impot sur la fortune</label>
                      <input
                        type="text"
                        value={formatMontantTaxware(taxResultAffiche.normalized.wealthTax)}
                        readOnly
                        style={inputReadOnlyStyle}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Impot total</label>
                      <input
                        type="text"
                        value={formatMontantTaxware(taxResultAffiche.normalized.totalTax)}
                        readOnly
                        style={inputReadOnlyStyle}
                      />
                    </div>
                  </div>
                </div>

                <div style={subCardStyle}>
                  <h4 style={{ marginTop: 0, marginBottom: "12px", color: "#1e293b" }}>
                    Ecart / economie
                  </h4>
                  <div style={{ display: "grid", gap: "10px" }}>
                    <div>
                      <label style={labelStyle}>IFD</label>
                      <input
                        type="text"
                        value={formatEcartTaxware(
                          taxResultSansOptimisation.normalized.federalTax,
                          taxResultAffiche.normalized.federalTax
                        )}
                        readOnly
                        style={inputReadOnlyStyle}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Impot cantonal</label>
                      <input
                        type="text"
                        value={formatEcartTaxware(
                          taxResultSansOptimisation.normalized.cantonalTax,
                          taxResultAffiche.normalized.cantonalTax
                        )}
                        readOnly
                        style={inputReadOnlyStyle}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Impot communal</label>
                      <input
                        type="text"
                        value={formatEcartTaxware(
                          taxResultSansOptimisation.normalized.communalTax,
                          taxResultAffiche.normalized.communalTax
                        )}
                        readOnly
                        style={inputReadOnlyStyle}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Impot sur la fortune</label>
                      <input
                        type="text"
                        value={formatEcartTaxware(
                          taxResultSansOptimisation.normalized.wealthTax,
                          taxResultAffiche.normalized.wealthTax
                        )}
                        readOnly
                        style={inputReadOnlyStyle}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Impot total</label>
                      <input
                        type="text"
                        value={formatEcartTaxware(
                          taxResultSansOptimisation.normalized.totalTax,
                          taxResultAffiche.normalized.totalTax
                        )}
                        readOnly
                        style={inputReadOnlyStyle}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div
                style={{
                  marginTop: "18px",
                  padding: "16px",
                  borderRadius: "12px",
                  backgroundColor: "#ffffff",
                  border: "1px solid #dbeafe",
                }}
              >
                <h4 style={{ marginTop: 0, marginBottom: "12px", color: "#1e293b" }}>
                  Actions d optimisation appliquees
                </h4>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: "12px",
                    alignItems: "stretch",
                  }}
                >
                  <div style={{ ...dataFieldCardStyle, minHeight: "126px", backgroundColor: "#ffffff" }}>
                    <label style={labelStyle}>Cotisation 3e pilier</label>
                    <input
                      type="text"
                      value={formatMontantCHF(dossier.fiscalite.troisiemePilierSimule)}
                      readOnly
                      style={inputReadOnlyStyle}
                    />
                  </div>

                  <div style={{ ...dataFieldCardStyle, minHeight: "126px", backgroundColor: "#ffffff" }}>
                    <label style={labelStyle}>Rachat LPP</label>
                    <input
                      type="text"
                      value={formatMontantCHF(dossier.fiscalite.rachatLpp)}
                      readOnly
                      style={inputReadOnlyStyle}
                    />
                  </div>

                  <div style={{ ...dataFieldCardStyle, minHeight: "126px", backgroundColor: "#ffffff" }}>
                    <label style={labelStyle}>Ajustement manuel</label>
                    <input
                      type="text"
                      value={formatMontantCHF(dossier.fiscalite.ajustementManuelRevenu)}
                      readOnly
                      style={inputReadOnlyStyle}
                    />
                  </div>

                  <div style={{ ...dataFieldCardStyle, minHeight: "126px", backgroundColor: "#ffffff" }}>
                    <label style={labelStyle}>Impact total sur le revenu de controle</label>
                    <input
                      type="text"
                      value={formatMontantCHF(
                        -(
                          (dossier.fiscalite.troisiemePilierSimule || 0) +
                          (dossier.fiscalite.rachatLpp || 0)
                        )
                      )}
                      readOnly
                      style={inputReadOnlyStyle}
                    />
                  </div>
                </div>

                <div
                  style={{
                    marginTop: "14px",
                    padding: "14px 16px",
                    borderRadius: "14px",
                    backgroundColor: "#ffffff",
                    border: "1px solid #dbeafe",
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gap: "6px",
                      color: "#475569",
                      fontSize: "14px",
                      lineHeight: 1.6,
                    }}
                  >
                    <div>3e pilier : deduction du revenu</div>
                    <div>Rachat LPP : finance par la fortune liquide</div>
                    <div>Ajustement manuel : correction informative, hors deduction fiscale standard</div>
                    <div>Strategie appliquee : optimisation fiscale via prevoyance (3e pilier + rachat LPP)</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {taxResultAffiche?.normalized && (
            <div
              style={{
                marginTop: "20px",
                padding: "20px",
                background: "#f8fafc",
                borderRadius: "12px",
                border: "1px solid #e2e8f0",
              }}
            >
              <h3 style={{ marginTop: 0, marginBottom: "8px", color: "#0f172a" }}>
                Impots a payer
              </h3>
              <span style={helperStyle}>Montants issus des appels reels TaxWare</span>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: "15px",
                  marginTop: "16px",
                }}
              >
                <div>
                  <label style={labelStyle}>IFD</label>
                  <input
                    type="text"
                    value={formatMontantTaxware(taxResultAffiche.normalized.federalTax)}
                    readOnly
                    style={inputReadOnlyStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Impôt cantonal / communal</label>
                  <input
                    type="text"
                    value={formatMontantTaxware(taxResultAffiche.normalized.cantonalCommunalTax)}
                    readOnly
                    style={inputReadOnlyStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Impôt sur la fortune</label>
                  <input
                    type="text"
                    value={formatMontantTaxware(taxResultAffiche.normalized.wealthTax)}
                    readOnly
                    style={inputReadOnlyStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Impôt total</label>
                  <input
                    type="text"
                    value={formatMontantTaxware(taxResultAffiche.normalized.totalTax)}
                    readOnly
                    style={inputReadOnlyStyle}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
        </GuidedSection>
        )}

        {activeSectionId === "resultats" && (
        <GuidedSection
          id="resultats"
          step="6"
          title="Résultats consolidés"
          description="Retrouvez ici les indicateurs de synthèse et le résumé client du scénario actif. Cette lecture réunit les mêmes valeurs métier dans une présentation plus directe pour la restitution."
        >
          {lectureImmobiliereSynthese.length > 0 && (
            <div
              style={{
                marginBottom: "18px",
                padding: "14px 16px",
                borderRadius: "14px",
                border: "1px solid #bfdbfe",
                background: "linear-gradient(180deg, #eff6ff 0%, #ffffff 100%)",
                color: "#1e3a8a",
                lineHeight: 1.7,
              }}
            >
              {lectureImmobiliereSynthese.map((item, index) => (
                <div key={index}>• {item}</div>
              ))}
            </div>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "16px",
              marginBottom: "24px",
            }}
          >
            {[
              ["NIVEAU", niveauDossier],
              ["OBJECTIF", objectifPrincipalSynthese],
              ["REVENU", formatMontantCHF(totalRevenusCalcule)],
              ["FORTUNE BRUTE", formatMontantCHF(fortuneBruteCalcule)],
              ["DETTES", formatMontantCHF(totalDettesCalcule)],
              ["MARGE", formatMontantCHF(margeAnnuelleCalcule)],
            ].map(([label, value], index) => (
              <div
                key={index}
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: "16px",
                  padding: "18px",
                  backgroundColor: "#ffffff",
                  boxShadow: "0 6px 18px rgba(0, 0, 0, 0.05)",
                }}
              >
                <p style={{ margin: 0, fontSize: "13px", color: "#64748b", fontWeight: "bold" }}>
                  {label}
                </p>
                <p
                  style={{
                    marginTop: "8px",
                    marginBottom: 0,
                    fontSize: label === "OBJECTIF" ? "16px" : "18px",
                    color: "#0f172a",
                    fontWeight: "bold",
                    whiteSpace: label === "OBJECTIF" ? "normal" : "nowrap",
                    overflow: "hidden",
                    textOverflow: label === "OBJECTIF" ? "clip" : "ellipsis",
                    lineHeight: label === "OBJECTIF" ? 1.3 : 1.2,
                  }}
                >
                  {value}
                </p>
              </div>
            ))}
          </div>

          <div style={sectionCardStyle}>
            <h2 style={{ marginTop: 0, color: "#0f172a", fontSize: "24px" }}>
              Informations client
            </h2>

            <CollapsibleHelp title="Aide resume client">
              {sectionHelpTexts.informationsClient.map((text) => (
                <div key={text}>{text}</div>
              ))}
            </CollapsibleHelp>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: "18px",
              }}
            >
              {[
                {
                  titre: "Identité",
                  lignes: [
                    ["Nom", `${dossier.identite.prenom} ${dossier.identite.nom}`],
                    ["Âge", `${dossier.identite.age} ans`],
                    ["État civil", dossier.identite.etatCivil],
                    ["NPA", dossier.identite.npa],
                    ["Commune postale", dossier.identite.commune],
                    ["Commune fiscale", dossier.identite.communeFiscale || dossier.identite.commune],
                    ["Canton", dossier.identite.canton],
                    ["Nombre d’enfants", String(dossier.famille.nombreEnfants)],
                  ],
                },
                {
                  titre: "Revenus",
                  lignes: [
                    ["Salaire", formatMontantCHF(dossier.revenus.salaire)],
                    ["AVS", formatMontantCHF(dossier.revenus.avs)],
                    ["LPP", formatMontantCHF(dossier.revenus.lpp)],
                    ["Autres revenus", formatMontantCHF(dossier.revenus.autresRevenus)],
                    ["Total revenus", formatMontantCHF(totalRevenusCalcule)],
                  ],
                },
                {
                  titre: "Immobilier fiscal",
                  lignes: [
                    ["Régime immobilier", regimeImmobilierLabel],
                    ["Habitation propre active", habitationPropreActive ? "Oui" : "Non"],
                    [
                      "Valeur locative retenue",
                      formatMontantCHF(valeurLocativeFiscalisee),
                    ],
                    [
                      "Intérêts habitation retenus",
                      formatMontantCHF(interetsHabitationDeductibles),
                    ],
                    [
                      "Frais habitation retenus",
                      formatMontantCHF(fraisHabitationDeductibles),
                    ],
                    [
                      "Biens de rendement actifs",
                      biensRendementActifs ? "Oui" : "Non",
                    ],
                    [
                      "Loyers retenus",
                      formatMontantCHF(loyersBiensRendementImposables),
                    ],
                    [
                      "Intérêts rendement retenus",
                      formatMontantCHF(interetsBiensRendementDeductibles),
                    ],
                    [
                      "Frais rendement retenus",
                      formatMontantCHF(fraisBiensRendementDeductibles),
                    ],
                    [
                      "Base fiscale immobilière locale",
                      formatMontantCHF(
                        revenusImmobiliersFiscauxCalcules -
                          deductionsImmobilieresFiscalesCalculees
                      ),
                    ],
                  ],
                },
                {
                  titre: "Fortune",
                  lignes: [
                    ["Liquidités de départ", formatMontantCHF(dossier.fortune.liquidites)],
                    ["Liquidités après ajustements", formatMontantCHF(liquiditesAjusteesCalcule)],
                    ["Titres", formatMontantCHF(dossier.fortune.titres)],
                    ["3e pilier", formatMontantCHF(troisiemePilierPatrimonialCalcule)],
                    ["Fortune LPP actuelle", formatMontantCHF(fortuneLppPatrimonialeCalcule)],
                    ["Immobilier", formatMontantCHF(dossier.fortune.immobilier)],
                    ["Fortune brute", formatMontantCHF(fortuneBruteCalcule)],
                    ["Fortune fiscale", formatMontantCHF(fortuneFiscaleCalcule)],
                    ["Fortune nette fiscale", formatMontantCHF(fortuneNetteFiscaleCalcule)],
                  ],
                },
                {
                  titre: "Dettes",
                  lignes: [
                    ["Hypothèques", formatMontantCHF(dossier.dettes.hypotheques)],
                    ["Autres dettes", formatMontantCHF(dossier.dettes.autresDettes)],
                    ["Total dettes", formatMontantCHF(totalDettesCalcule)],
                  ],
                },
                {
                  titre: "Charges",
                  lignes: [
                    ["Logement", formatMontantCHF(dossier.charges.logement)],
                    [
                      "Intérêts hypothécaires immobiliers",
                      formatMontantCHF(interetsHypothecairesImmobiliersBudgetaires),
                    ],
                    ["Primes maladie", formatMontantCHF(dossier.charges.primesMaladie)],
                    ["Impôts revenu et fortune", formatMontantCHF(impotRevenuFortuneCharge)],
                    ["3e pilier simulé", formatMontantCHF(dossier.fiscalite.troisiemePilierSimule)],
                    ["Frais de vie", formatMontantCHF(dossier.charges.fraisVie)],
                    ["Autres charges", formatMontantCHF(dossier.charges.autresCharges)],
                    ["Total charges", formatMontantCHF(totalChargesCalcule)],
                    ["Marge annuelle", formatMontantCHF(margeAnnuelleCalcule)],
                  ],
                },
                {
                  titre: "Fiscalité",
                  lignes: [
                    [
                      "Revenu imposable IFD",
                      formatMontantCHF(revenuImposableCorrigeIfd),
                    ],
                    [
                      "Revenu imposable Canton / Commune",
                      formatMontantCHF(revenuImposableCorrigeCanton),
                    ],
                    [
                      "Fortune imposable actuelle saisie",
                      formatMontantCHF(fortuneImposableCorrige),
                    ],
                    ["3e pilier simulé", formatMontantCHF(dossier.fiscalite.troisiemePilierSimule)],
                    ["Rachat LPP", formatMontantCHF(dossier.fiscalite.rachatLpp)],
                    ["Ajustement manuel", formatMontantCHF(dossier.fiscalite.ajustementManuelRevenu)],
                    ["IFD", formatMontantCHF(impotFederalDirect)],
                    [
                      "Impôt cantonal / communal",
                      formatMontantCHF(taxResultAffiche?.normalized?.cantonalCommunalTax || 0),
                    ],
                    ["Impôt sur la fortune", formatMontantCHF(taxResultAffiche?.normalized?.wealthTax || 0)],
                    ["Impôt total", formatMontantCHF(impotCorrigeSynthese)],
                    ["Objectif principal", objectifPrincipalSynthese],
                  ],
                },
              ].map((bloc, index) => (
                <div key={index} style={subCardStyle}>
                  <h3
                    style={{
                      marginTop: 0,
                      marginBottom: "14px",
                      color: "#1e293b",
                      fontSize: "18px",
                      fontWeight: "700",
                    }}
                  >
                    {bloc.titre}
                  </h3>

                  <div style={{ display: "grid", gap: "10px" }}>
                    {bloc.lignes.map(([label, value], i) => (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: "12px",
                          alignItems: "flex-start",
                          paddingBottom: "8px",
                          borderBottom: i < bloc.lignes.length - 1 ? "1px solid #e2e8f0" : "none",
                        }}
                      >
                        <span
                          style={{
                            color: "#475569",
                            fontSize: "14px",
                            fontWeight: 600,
                          }}
                        >
                          {label}
                        </span>

                        <span
                          style={{
                            color: "#0f172a",
                            fontSize: "14px",
                            fontWeight: 700,
                            textAlign: "right",
                          }}
                        >
                          {value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </GuidedSection>
        )}

        {activeSectionId === "recommandation" && (
        <GuidedSection
          id="recommandation"
          step="7"
          title="Recommandation et restitution"
          description="Cette dernière étape traduit les résultats existants en messages de conseil, en priorités et en conclusion client. La logique de recommandation reste exactement celle de l’application actuelle."
        >
          <div
            style={{
              border: "1px solid #f5d48a",
              borderRadius: "16px",
              padding: "24px",
              marginTop: "0",
              backgroundColor: "#fffaf0",
              boxShadow: "0 6px 18px rgba(180, 83, 9, 0.08)",
              textAlign: "left",
            }}
          >
            <h2 style={{ marginTop: 0, color: "#92400e", fontSize: "24px" }}>
              Résumé exécutif
            </h2>

            <ul
              style={{
                marginTop: 0,
                marginBottom: "18px",
                color: "#78350f",
                lineHeight: 1.8,
                paddingLeft: "24px",
              }}
            >
              <li>{syntheseAutomatiquePersonnalisee}</li>
            </ul>

            <p style={{ fontWeight: "bold", color: "#92400e", marginBottom: "8px" }}>
              Priorités
            </p>
            <ul
              style={{
                marginTop: 0,
                color: "#78350f",
                lineHeight: 1.8,
                paddingLeft: "24px",
              }}
            >
              {prioritesAutomatiques.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>

            <p style={{ fontWeight: "bold", color: "#92400e", marginBottom: "8px" }}>
              Points de vigilance
            </p>
            <ul
              style={{
                marginTop: 0,
                color: "#78350f",
                lineHeight: 1.8,
                paddingLeft: "24px",
              }}
            >
              {vigilancesAutomatiques.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>

            <p style={{ fontWeight: "bold", color: "#92400e", marginBottom: "8px" }}>
              Conclusion
            </p>
            <p style={{ marginTop: 0, marginBottom: 0, color: "#78350f", lineHeight: 1.8 }}>
              {conclusionStrategique}
            </p>
          </div>
          {sectionsAutomatiques
            .filter((section) => section.titre === "Fiscalité" || section.titre === "Retraite")
            .map((section, index) => (
            <ReportSection
              key={index}
              titre={section.titre}
              situation={section.situation}
              analyse={section.analyse}
              transformation={section.transformation}
              resultat={section.resultat}
            />
          ))}
          <ReportSection
            titre="Recommandations"
            situation={syntheseAutomatiquePersonnalisee}
            analyse={recommandationsStrategiques.map((recommendation) => recommendation.diagnostic).join(" ")}
            transformation={recommandationsStrategiques
              .map((recommendation) => recommendation.recommendation)
              .join(" ")}
            resultat={recommandationsStrategiques.map((recommendation) => recommendation.expectedResult).join(" ")}
          />
          <div
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: "16px",
              padding: "24px",
              marginTop: "24px",
              backgroundColor: "#ffffff",
              boxShadow: "0 6px 18px rgba(0, 0, 0, 0.06)",
              textAlign: "left",
            }}
          >
            <h2
              style={{
                marginTop: 0,
                marginBottom: "18px",
                fontSize: "24px",
                color: "#0f172a",
                textAlign: "left",
              }}
            >
              Conclusion
            </h2>
            <p style={{ margin: 0, color: "#475569", lineHeight: 1.8 }}>
              {dynamicPdfConclusion || conclusionStrategique}
            </p>
          </div>
        </GuidedSection>
        )}
        </div>

        <div className="sticky-sim-footer" role="region" aria-label="Actions principales">
          <div className="sticky-sim-footer__meta">
            <div className="sticky-sim-footer__eyebrow">Section affichée</div>
            <div className="sticky-sim-footer__title">
              {activeJourneyLabel}
            </div>
            <div className="sticky-sim-footer__helper">
              {activeJourneyProgressLabel}
            </div>
          </div>

          <div className="sticky-sim-footer__nav">
            <button
              type="button"
              onClick={() =>
                handleJourneyNavigation(journeyNavigation[Math.max(0, activeJourneyStepIndex - 1)].id)
              }
              disabled={activeJourneyStepIndex <= 0}
              className="sticky-sim-footer__secondary"
            >
              Étape précédente
            </button>
            <button
              type="button"
              onClick={() =>
                isIntroActive
                  ? handleJourneyNavigation(journeyNavigation[0].id)
                  : handleJourneyNavigation(
                      journeyNavigation[Math.min(journeyNavigation.length - 1, activeJourneyStepIndex + 1)].id
                    )
              }
              disabled={
                isIntroActive ? !analysisMode : activeJourneyStepIndex >= journeyNavigation.length - 1
              }
              className="sticky-sim-footer__secondary"
            >
              Étape suivante
            </button>
          </div>

          <div className="sticky-sim-footer__action">
            <button
              type="button"
              onClick={() => {
                void handleTaxSimulation({ navigateToResults: true });
              }}
              disabled={!isGlobalTaxSimulationReady || isSimulatingVariants}
              className="sticky-sim-footer__primary"
              title={simulationPrimaryHelper}
            >
              {simulationPrimaryButtonLabel}
            </button>
            <button
              type="button"
              onClick={() => {
                void handlePdfExport();
              }}
              disabled={!canExportPdf || isExportingPdf}
              className="sticky-sim-footer__export"
              title={canExportPdf ? "Télécharger le document PDF premium" : "Lancez d’abord une simulation pour exporter le PDF"}
            >
              {isExportingPdf ? "Export PDF en cours..." : "Exporter PDF"}
            </button>
            <div className="sticky-sim-footer__status">{simulationPrimaryHelper}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
