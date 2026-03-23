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

function composeCorrectedTaxwareResult(params: {
  baseResult: any;
  ifdResult: any;
  cantonResult: any;
  fortuneResult: any;
  childrenCount: number;
  debug?: Record<string, unknown>;
}) {
  const { baseResult, ifdResult, cantonResult, fortuneResult, childrenCount, debug } = params;
  const baseNormalized = baseResult?.normalized ?? {};
  const ifdNormalized = ifdResult?.normalized ?? baseNormalized;
  const cantonNormalized = cantonResult?.normalized ?? baseNormalized;
  const fortuneNormalized = fortuneResult?.normalized ?? baseNormalized;

  const federalTaxGross =
    typeof ifdNormalized.federalTax === "number"
      ? ifdNormalized.federalTax
      : baseNormalized.federalTax ?? null;
  const ifdFamilyRebate =
    typeof federalTaxGross === "number" ? Math.max(0, childrenCount) * 263 : null;
  const federalTax =
    typeof federalTaxGross === "number" && typeof ifdFamilyRebate === "number"
      ? Math.max(0, federalTaxGross - ifdFamilyRebate)
      : federalTaxGross;
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
      debug: {
        ...(debug ?? {}),
        ifdFamilyRebate: {
          childrenCount: Math.max(0, childrenCount),
          rebatePerChild: 263,
          federalTaxGross,
          rebateTotal: ifdFamilyRebate,
          federalTaxNet: federalTax,
        },
      },
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

function pickReferenceValue(...values: Array<number | null | undefined>) {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      return value;
    }
  }

  return 0;
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

const APP_VERSION = "v1.0";
const APP_VERSION_CREATED_AT = "22.03.2026";
const APP_SOURCE = "TaxWare";
const APP_DESIGN = "Cabinet Russo";
const APP_CONTACT_EMAIL = "russo@cabinetrusso.ch";
const APP_CONTACT_PHONE = "+41 79 240 55 19";

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
  const [activeVariantIndex, setActiveVariantIndex] = useState(0);
  const [showConseillerPrompt, setShowConseillerPrompt] = useState(false);
  const [conseillerPasswordInput, setConseillerPasswordInput] = useState("");
  const [isConseillerAccessGranted, setIsConseillerAccessGranted] = useState(false);
  const [conseillerAccessError, setConseillerAccessError] = useState("");
  const [isRoiConseillerOpen, setIsRoiConseillerOpen] = useState(false);
  const [roiDossiersParMois, setRoiDossiersParMois] = useState(0);
  const [roiTempsParDossier, setRoiTempsParDossier] = useState(0);
  const [roiTauxHoraire, setRoiTauxHoraire] = useState(0);
  const [roiTempsParDossierAvecOutil, setRoiTempsParDossierAvecOutil] = useState(0);
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

  const setTaxResult = (nextValue: any) => {
    setVariants((current) =>
      current.map((variant, index) => {
        if (index === activeVariantIndex) {
          return { ...variant, taxResult: nextValue };
        }

        if (activeVariantIndex === 0 && variant.isLinkedToVariant1) {
          return { ...variant, taxResult: cloneValue(nextValue) };
        }

        return variant;
      })
    );
  };

  const setTaxResultSansOptimisation = (nextValue: any) => {
    setVariants((current) =>
      current.map((variant, index) => {
        if (index === activeVariantIndex) {
          return { ...variant, taxResultSansOptimisation: nextValue };
        }

        if (activeVariantIndex === 0 && variant.isLinkedToVariant1) {
          return { ...variant, taxResultSansOptimisation: cloneValue(nextValue) };
        }

        return variant;
      })
    );
  };

  const setTaxResultAvecDeductionsEstime = (nextValue: any) => {
    setVariants((current) =>
      current.map((variant, index) => {
        if (index === activeVariantIndex) {
          return { ...variant, taxResultAvecDeductionsEstime: nextValue };
        }

        if (activeVariantIndex === 0 && variant.isLinkedToVariant1) {
          return { ...variant, taxResultAvecDeductionsEstime: cloneValue(nextValue) };
        }

        return variant;
      })
    );
  };

  const setTaxResultAjustementManuel = (nextValue: any) => {
    setVariants((current) =>
      current.map((variant, index) => {
        if (index === activeVariantIndex) {
          return { ...variant, taxResultAjustementManuel: nextValue };
        }

        if (activeVariantIndex === 0 && variant.isLinkedToVariant1) {
          return { ...variant, taxResultAjustementManuel: cloneValue(nextValue) };
        }

        return variant;
      })
    );
  };

  const setTaxResultCorrectionFiscaleManuelle = (nextValue: any) => {
    setVariants((current) =>
      current.map((variant, index) => {
        if (index === activeVariantIndex) {
          return { ...variant, taxResultCorrectionFiscaleManuelle: nextValue };
        }

        if (activeVariantIndex === 0 && variant.isLinkedToVariant1) {
          return {
            ...variant,
            taxResultCorrectionFiscaleManuelle: cloneValue(nextValue),
          };
        }

        return variant;
      })
    );
  };

  const setComparisonTaxResults = (nextValue: Record<string, any>) => {
    setVariants((current) =>
      current.map((variant, index) => {
        if (index === activeVariantIndex) {
          return { ...variant, comparisonTaxResults: nextValue };
        }

        if (activeVariantIndex === 0 && variant.isLinkedToVariant1) {
          return { ...variant, comparisonTaxResults: cloneValue(nextValue) };
        }

        return variant;
      })
    );
  };

  const handleVariantCustomLabelChange = (variantIndex: number, nextValue: string) => {
    setVariants((current) =>
      current.map((variant, index) =>
        index === variantIndex ? { ...variant, customLabel: nextValue } : variant
      )
    );
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

  const valeurLocativeFiscalisee =
    habitationPropreActive && regimeImmobilierActuel
      ? dossier.immobilier.valeurLocativeHabitationPropre || 0
      : 0;

  const interetsHabitationDeductibles =
    habitationPropreActive && regimeImmobilierActuel
      ? dossier.immobilier.interetsHypothecairesHabitationPropre || 0
      : 0;

  const fraisHabitationDeductibles =
    habitationPropreActive && regimeImmobilierActuel
      ? dossier.immobilier.fraisEntretienHabitationPropre || 0
      : 0;

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

  const revenuImposableTaxwareIfd =
    typeof taxResultAffiche?.normalized?.taxableIncomeFederal === "number"
      ? taxResultAffiche.normalized.taxableIncomeFederal
      : revenuImposableIfdReference;

  const revenuImposableApresSimulationCalcule = Math.max(
    0,
    revenuImposableReference -
      (dossier.fiscalite.troisiemePilierSimule || 0) -
      (dossier.fiscalite.rachatLpp || 0) +
      (dossier.fiscalite.ajustementManuelRevenu || 0)
  );

  const revenuImposableIfdApresSimulationCalcule = Math.max(
    0,
    revenuImposableIfdReference -
      (dossier.fiscalite.troisiemePilierSimule || 0) -
      (dossier.fiscalite.rachatLpp || 0) +
      (dossier.fiscalite.ajustementManuelRevenu || 0)
  );

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
  const ifdFamilyRebateDebug = taxResultAffiche?.raw?.debug?.ifdFamilyRebate ?? null;
  const impotFederalBrut =
    typeof ifdFamilyRebateDebug?.federalTaxGross === "number"
      ? ifdFamilyRebateDebug.federalTaxGross
      : taxResultAffiche?.normalized?.federalTax ?? 0;
  const rabaisFamilialIfd =
    typeof ifdFamilyRebateDebug?.rebateTotal === "number"
      ? ifdFamilyRebateDebug.rebateTotal
      : Math.max(0, dossier.famille.nombreEnfants) * 263;
  const impotFederalNet = taxResultAffiche?.normalized?.federalTax ?? 0;

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
  const resultatFiscalBrutTitle = "Base imposable de reference";
  const resultatFiscalBrutHelper =
    "Montants imposables saisis manuellement et transmis a TaxWare pour produire le resultat fiscal";
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

  const lectureImmobiliereSynthese = [
    habitationPropreActive
      ? `Habitation propre traitée selon le ${regimeImmobilierLabel.toLowerCase()}`
      : null,
    biensRendementActifs ? "Biens de rendement intégrés dans les revenus imposables" : null,
    interetsHypothecairesImmobiliersBudgetaires > 0
      ? `Les intérêts hypothécaires restent pris en compte dans la marge budgétaire (${formatMontantCHFArrondi(
          interetsHypothecairesImmobiliersBudgetaires
        )})`
      : null,
    "Le traitement fiscal immobilier dépend du régime sélectionné.",
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
  const bestVariantState =
    variants.find((variant) => variant.id === bestVariant?.id) || activeVariant;
  const bestVariantDisplayedTaxResult = getVariantDisplayedTaxResult(bestVariantState);
  const activeVariantDisplayedTaxResult = getVariantDisplayedTaxResult(activeVariant);
  const referenceVariantTotalTax = getVariantTaxTotal(referenceVariant) ?? 0;
  const bestVariantTotalTax =
    getVariantTaxTotal(bestVariantState) ??
    getVariantTaxTotal(activeVariant) ??
    0;
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

  const cityForTaxwareControle =
    (dossier.identite.taxwareCity || "").trim() ||
    (dossier.identite.communeFiscale || "").trim() ||
    (dossier.identite.commune || "").trim();

  const zipForTaxwareControle =
    (dossier.identite.taxwareZip || "").trim() ||
    (dossier.identite.npa || "").trim();

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

  const buildDirectBaseTaxwareRequest = (params: {
    miscIncome: number;
    assets: number;
  }) => ({
    realEstates: [],
    zip: zipForTaxwareControle,
    city: cityForTaxwareControle,
    partnership: (dossier.famille.aConjoint ? "Marriage" : "Single") as "Marriage" | "Single",
    childrenCount: dossier.famille.nombreEnfants,
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
  });

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

  const handleTaxSimulation = async () => {
    try {
      const comparisonScenarios = getComparisonScenarios(dossier);
      const comparisonScenarioEntries = await Promise.all(
        comparisonScenarios.map(async (scenario) => {
          const taxableIncomeFederal = Math.max(
            0,
            (dossier.fiscalite.revenuImposableIfd || 0) -
              scenario.thirdPillar -
              scenario.lppBuyback +
              scenario.manualAdjustment
          );
          const taxableIncomeCantonal = Math.max(
            0,
            (dossier.fiscalite.revenuImposable || 0) -
              scenario.thirdPillar -
              scenario.lppBuyback +
              scenario.manualAdjustment
          );
          const taxableAssets = Math.max(
            0,
            dossier.fiscalite.fortuneImposableActuelleSaisie || 0
          );

          const baseResult = await resolveTaxwareTarget({
            label: `${scenario.key}-canton`,
            targetValue: taxableIncomeCantonal,
            metric: (result) => result?.normalized?.taxableIncomeCantonal,
            buildRequest: (miscIncome) =>
              buildDirectBaseTaxwareRequest({
                miscIncome,
                assets: taxableAssets,
              }),
          });

          const ifdResult = await resolveTaxwareTarget({
            label: `${scenario.key}-ifd`,
            targetValue: taxableIncomeFederal,
            metric: (result) => result?.normalized?.taxableIncomeFederal,
            buildRequest: (miscIncome) =>
              buildDirectBaseTaxwareRequest({
                miscIncome,
                assets: taxableAssets,
              }),
          });

          const fortuneResult = await resolveTaxwareTarget({
            label: `${scenario.key}-fortune`,
            targetValue: taxableAssets,
            metric: (result) => result?.normalized?.taxableAssets,
            buildRequest: (assets) =>
              buildDirectBaseTaxwareRequest({
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
              childrenCount: dossier.famille.nombreEnfants,
              debug: {
                source: "taxware-direct-bases",
                targets: {
                  taxableIncomeFederal,
                  taxableIncomeCantonal,
                  taxableAssets,
                },
                payloads: {
                  canton: buildDirectBaseTaxwareRequest({
                    miscIncome:
                      baseResult?.raw?.calibration?.driverValue ?? taxableIncomeCantonal,
                    assets: taxableAssets,
                  }),
                  ifd: buildDirectBaseTaxwareRequest({
                    miscIncome: ifdResult?.raw?.calibration?.driverValue ?? taxableIncomeFederal,
                    assets: taxableAssets,
                  }),
                  fortune: buildDirectBaseTaxwareRequest({
                    miscIncome: taxableIncomeCantonal,
                    assets: fortuneResult?.raw?.calibration?.driverValue ?? taxableAssets,
                  }),
                },
              },
            }),
          ] as const;
        })
      );

      const comparisonScenarioResults = Object.fromEntries(comparisonScenarioEntries);

      const baselineResult = comparisonScenarioResults.reference;
      const mixedResult = comparisonScenarioResults.mixed;
      const ajustementResult = comparisonScenarioResults["manual-adjustment"];

      setDossier({
        ...dossier,
        fiscalite: {
          ...dossier.fiscalite,
          revenuImposableIfd: pickReferenceValue(
            baselineResult?.normalized?.taxableIncomeFederal,
            dossier.fiscalite.revenuImposableIfd
          ),
          revenuImposable: pickReferenceValue(
            baselineResult?.normalized?.taxableIncomeCantonal,
            dossier.fiscalite.revenuImposable
          ),
          fortuneImposableActuelleSaisie: pickReferenceValue(
            baselineResult?.normalized?.taxableAssets,
            dossier.fiscalite.fortuneImposableActuelleSaisie
          ),
          impotsEstimes: pickReferenceValue(
            baselineResult?.normalized?.totalTax,
            dossier.fiscalite.impotsEstimes
          ),
        },
      });

      setTaxResultSansOptimisation(baselineResult);
      setTaxResultAvecDeductionsEstime(mixedResult);
      setTaxResult(mixedResult);
      setTaxResultAjustementManuel(ajustementResult);
      setTaxResultCorrectionFiscaleManuelle(null);
      setComparisonTaxResults(comparisonScenarioResults);
    } catch (error) {
      console.error("Erreur lors de la simulation fiscale TaxWare :", error);
      alert("Erreur lors de la simulation fiscale.");
    }
  };

  const runAutoTaxSimulation = useEffectEvent(async (variantId: string) => {
    if (autoSimulationStatusRef.current[variantId]) {
      return;
    }

    autoSimulationStatusRef.current[variantId] = "running";
    await handleTaxSimulation();
    autoSimulationStatusRef.current[variantId] = "done";
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

    void runAutoTaxSimulation(activeVariant.id);
  }, [
    activeVariant.id,
    activeVariant.taxResult,
    activeVariant.taxResultSansOptimisation,
    activeVariant.taxResultAvecDeductionsEstime,
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
  const toneProfileLabel = advisoryToneProfile
    .replace("client ", "Client ")
    .replace("couple", "Couple")
    .replace("celibataire", "Celibataire");

  const diagnosticStrategique = `Profil dominant : ${profilsClient.join(" / ")}. Le dossier combine ${formatMontantCHF(
    totalRevenusCalcule
  )} de revenus annuels, ${formatMontantCHF(
    fortuneBruteCalcule
  )} de patrimoine brut et un impot de reference de ${formatMontantCHF(
    dossier.fiscalite.impotsEstimes || 0
  )}.`;

  const enjeuxStrategiques = recommandationsStrategiques.map(
    (recommendation) => recommendation.enjeu
  );

  const resultatAttenduStrategique =
    recommandationsStrategiques.length > 0
      ? recommandationsStrategiques[0].expectedResult
      : "Une meilleure lisibilite des priorites patrimoniales et fiscales du client.";

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
  const introHighlights = [
    {
      title: "Situation actuelle",
      text: "Visualisez rapidement la situation patrimoniale, les revenus, les charges et les indicateurs clefs.",
    },
    {
      title: "Optimisations a tester",
      text: "Renseignez les leviers fiscaux utiles, comme le 3e pilier ou le rachat LPP, puis lancez la simulation.",
    },
    {
      title: "Resultat attendu",
      text: "Comparez les variantes et identifiez plus facilement le scenario le plus pertinent pour le client.",
    },
  ];
  const journeyNavigation = [
    { id: "optimisation", step: "1", label: "Optimisation" },
    { id: "informations-generales", step: "2", label: "Informations" },
    { id: "revenus", step: "3", label: "Revenus" },
    { id: "fortune", step: "4", label: "Fortune" },
    { id: "charges", step: "5", label: "Charges" },
    { id: "fiscalite", step: "6", label: "Fiscalité" },
    { id: "resultats", step: "7", label: "Résultats" },
    { id: "recommandation", step: "8", label: "Recommandation" },
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

  return (
    <div className="app-shell">
      <div className="app-shell__inner">
        <div
          style={{
            marginBottom: "24px",
            padding: "18px 22px",
            borderRadius: "18px",
            border: "1px solid #dbeafe",
            background: "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)",
            boxShadow: "0 10px 28px rgba(15, 23, 42, 0.05)",
          }}
        >
          <div
            style={{
              display: "grid",
              gap: "12px",
            }}
          >
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "12px 24px",
                alignItems: "center",
                color: "#334155",
                fontSize: "14px",
              }}
            >
              <span><strong style={{ color: "#0f172a" }}>Version :</strong> {APP_VERSION}</span>
              <span><strong style={{ color: "#0f172a" }}>Creation :</strong> {APP_VERSION_CREATED_AT}</span>
              <span><strong style={{ color: "#0f172a" }}>Date de calcul :</strong> {calculationDateLabel}</span>
            </div>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "12px 24px",
                alignItems: "center",
                color: "#475569",
                fontSize: "14px",
              }}
            >
              <span><strong style={{ color: "#0f172a" }}>Source :</strong> {APP_SOURCE}</span>
              <span><strong style={{ color: "#0f172a" }}>Conception :</strong> {APP_DESIGN}</span>
            </div>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "12px 24px",
                alignItems: "center",
                color: "#475569",
                fontSize: "14px",
              }}
            >
              <span><strong style={{ color: "#0f172a" }}>Email :</strong> {APP_CONTACT_EMAIL}</span>
              <span><strong style={{ color: "#0f172a" }}>Telephone :</strong> {APP_CONTACT_PHONE}</span>
            </div>
          </div>
        </div>

        <div
          style={{
            marginBottom: "30px",
            padding: "24px 26px",
            borderRadius: "20px",
            background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 65%, #eff6ff 100%)",
            border: "1px solid #dbeafe",
            boxShadow: "0 18px 36px rgba(15, 23, 42, 0.06)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: "20px",
              flexWrap: "wrap",
              marginBottom: "18px",
            }}
          >
            <div style={{ maxWidth: "720px" }}>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "6px 12px",
                  borderRadius: "999px",
                  backgroundColor: "#fff7ed",
                  border: "1px solid #fed7aa",
                  color: "#b45309",
                  fontSize: "12px",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                Application de conseil
              </div>

              <h1
                style={{
                  marginTop: "14px",
                  marginBottom: "10px",
                  fontSize: "42px",
                  lineHeight: 1.05,
                  color: "#0f172a",
                }}
              >
                Rapport Premium patrimonial et fiscal
              </h1>

              <p
                style={{
                  marginTop: 0,
                  marginBottom: 0,
                  color: "#475569",
                  fontSize: "17px",
                  lineHeight: 1.7,
                  maxWidth: "680px",
                }}
              >
                Un espace de travail guidé pour structurer la situation du client, lancer la
                simulation TaxWare et présenter des variantes d’optimisation dans un cadre plus
                clair, pédagogique et premium.
              </p>
            </div>

            <div
              style={{
                minWidth: "240px",
                padding: "16px 18px",
                borderRadius: "16px",
                backgroundColor: "#ffffff",
                border: "1px solid #e2e8f0",
              }}
            >
              <div style={{ color: "#64748b", fontSize: "12px", fontWeight: 700, textTransform: "uppercase" }}>
                Demarrage rapide
              </div>
              <div style={{ marginTop: "10px", display: "grid", gap: "8px", color: "#334155", fontSize: "14px" }}>
                <div><strong style={{ color: "#0f172a" }}>Variante active :</strong> {getVariantDisplayLabel(activeVariant)}</div>
                <div><strong style={{ color: "#0f172a" }}>Variantes disponibles :</strong> {variants.length} / {MAX_VARIANTS}</div>
                <div><strong style={{ color: "#0f172a" }}>Parcours :</strong> Saisir, simuler, comparer</div>
              </div>

              <div style={{ marginTop: "14px" }}>
                <label style={{ ...labelStyle, marginBottom: "8px", fontSize: "13px" }}>
                  Régime immobilier
                </label>
                <select
                  value={dossier.immobilier.regimeFiscal}
                  onChange={(e) =>
                    setDossier({
                      ...dossier,
                      immobilier: {
                        ...dossier.immobilier,
                        regimeFiscal: e.target.value as "actuel" | "reforme",
                      },
                    })
                  }
                  style={inputStyle}
                >
                  <option value="actuel">Régime actuel</option>
                  <option value="reforme">Régime réformé</option>
                </select>
                <span style={helperStyle}>
                  Ce paramètre pilote le traitement fiscal de l’habitation propre. Les biens de
                  rendement restent traités selon leur logique propre.
                </span>
              </div>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "14px",
            }}
          >
            {introHighlights.map((item, index) => (
              <div
                key={item.title}
                style={{
                  padding: "16px 18px",
                  borderRadius: "16px",
                  backgroundColor: "#ffffff",
                  border: "1px solid #e2e8f0",
                }}
              >
                <div
                  style={{
                    width: "30px",
                    height: "30px",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "999px",
                    backgroundColor: "#dbeafe",
                    color: "#1d4ed8",
                    fontSize: "13px",
                    fontWeight: 800,
                  }}
                >
                  {index + 1}
                </div>
                <div style={{ marginTop: "12px", color: "#0f172a", fontSize: "16px", fontWeight: 700 }}>
                  {item.title}
                </div>
                <div style={{ marginTop: "8px", color: "#475569", fontSize: "14px", lineHeight: 1.65 }}>
                  {item.text}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="cockpit-grid">
          {cockpitCards.map((card) => (
            <div key={card.label} className="cockpit-card">
              <div className="cockpit-card__label">{card.label}</div>
              <div className="cockpit-card__value">{card.value}</div>
              <div className="cockpit-card__helper">{card.helper}</div>
            </div>
          ))}
        </div>

        <nav className="journey-nav" aria-label="Parcours de simulation">
          <div className="journey-nav__title">Parcours guidé</div>
          <div className="journey-nav__items">
            {journeyNavigation.map((item) => (
              <a key={item.id} href={`#${item.id}`} className="journey-nav__link">
                <span className="journey-nav__step">{item.step}</span>
                <span>{item.label}</span>
              </a>
            ))}
          </div>
        </nav>

        <GuidedSection
          id="optimisation"
          step="1"
          title="Optimisation et variantes"
          description="Cette zone sert à piloter les variantes, dupliquer un scénario existant et comparer les écarts déjà calculés par l’application."
        >
        <div style={{ ...sectionCardStyle, padding: "18px", marginBottom: "18px" }}>
          <div style={{ color: "#475569", lineHeight: 1.6, marginBottom: "14px" }}>
            Duplique la variante active pour tester un nouveau scénario, puis compare les écarts
            calculés par l’application.
          </div>
          <div
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
              style={{
                display: "flex",
                gap: "10px",
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              {variants.map((variant, index) => (
                <div
                  key={variant.id}
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
              ))}

              <button
                type="button"
                onClick={handleAddVariantFromActive}
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

        <GuidedSection
          id="informations-generales"
          step="2"
          title="Informations générales"
          description="Renseignez ici l’identité du client, sa situation familiale et les éléments qui structurent l’ensemble du dossier. Les champs et automatismes existants restent inchangés."
        >
        <div style={sectionCardStyle}>
          <h2 style={{ marginTop: 0, marginBottom: "20px", color: "#0f172a" }}>
            Saisie identité du client
          </h2>

          <CollapsibleHelp title="Aide identite / situation">
            {sectionHelpTexts.identite.map((text) => (
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
              <label style={labelStyle}>Prénom</label>
              <input
                type="text"
                value={dossier.identite.prenom}
                onChange={(e) =>
                  setDossier({
                    ...dossier,
                    identite: {
                      ...dossier.identite,
                      prenom: e.target.value,
                    },
                  })
                }
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Nom</label>
              <input
                type="text"
                value={dossier.identite.nom}
                onChange={(e) =>
                  setDossier({
                    ...dossier,
                    identite: {
                      ...dossier.identite,
                      nom: e.target.value,
                    },
                  })
                }
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Âge</label>
              <input
                type="number"
                value={dossier.identite.age}
                onChange={(e) =>
                  setDossier({
                    ...dossier,
                    identite: {
                      ...dossier.identite,
                      age: numberValue(e.target.value),
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
              gridTemplateColumns: "1.1fr 2fr 1fr",
              gap: "15px",
              marginTop: "20px",
            }}
          >
            <div>
              <label style={labelStyle}>NPA</label>
              <input
                type="text"
                value={dossier.identite.npa}
                onChange={(e) => handleNpaChange(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Commune</label>
              <input
                type="text"
                value={dossier.identite.commune}
                readOnly
                style={inputReadOnlyStyle}
              />
              <span style={helperStyle}>Calcul automatique</span>
            </div>

            <div>
              <label style={labelStyle}>Canton</label>
              <input
                type="text"
                value={dossier.identite.canton}
                readOnly
                style={inputReadOnlyStyle}
              />
              <span style={helperStyle}>Calcul automatique</span>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "15px",
              marginTop: "20px",
            }}
          >
            <div>
              <label style={labelStyle}>État civil</label>
              <select
                value={dossier.identite.etatCivil}
                onChange={(e) => {
                  const etatCivil = e.target.value;
                  const aConjoint = etatCivil === "Marié";

                  setDossier({
                    ...dossier,
                    identite: {
                      ...dossier.identite,
                      etatCivil,
                    },
                    famille: {
                      ...dossier.famille,
                      aConjoint,
                    },
                  });
                }}
                style={inputStyle}
              >
                <option value="">Choisir</option>
                <option value="Célibataire">Célibataire</option>
                <option value="Marié">Marié</option>
                <option value="Divorcé">Divorcé</option>
                <option value="Veuf">Veuf</option>
              </select>
            </div>

            <div>
              <label style={labelStyle}>Nombre d’enfants</label>
              <input
                type="number"
                value={dossier.famille.nombreEnfants}
                onChange={(e) =>
                  setDossier({
                    ...dossier,
                    famille: {
                      ...dossier.famille,
                      nombreEnfants: numberValue(e.target.value),
                    },
                  })
                }
                style={inputStyle}
              />
            </div>
          </div>
        </div>
        </GuidedSection>

        <GuidedSection
          id="revenus"
          step="3"
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

        <GuidedSection
          id="fortune"
          step="4"
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
              <label style={labelStyle}>Titres</label>
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
              <span style={helperStyle}>Saisie manuelle</span>
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

        <GuidedSection
          id="charges"
          step="5"
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

        <GuidedSection
          id="fiscalite"
          step="6"
          title="Fiscalité et simulation"
          description="Saisissez directement le revenu imposable IFD, le revenu imposable Canton / Commune et la fortune imposable, puis lancez un calcul reel TaxWare sans recalcul des deductions dans cette section."
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
              Cette section part directement du revenu imposable et de la fortune imposable.
            </div>
            <div>
              Les déductions fiscales (frais professionnels, assurances, déductions
              sociales, etc.) ne sont pas recalculées ici.
            </div>
            <div>
              Le professionnel doit saisir les montants imposables déjà déterminés.
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
              Base imposable saisie
            </h3>
            <span style={helperStyle}>
              Ces trois montants pilotent exclusivement les appels TaxWare de cette section
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
              Leviers de simulation
            </h3>
            <span style={helperStyle}>
              Ces montants servent a comparer les variantes sans remplacer les bases imposables saisies
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
          </div>

          <div style={{ ...sectionCardStyle, marginTop: "20px", marginBottom: 0 }}>
            <h3 style={{ marginTop: 0, marginBottom: "8px", color: "#0f172a" }}>
              Résultat fiscal TaxWare
            </h3>
            <span style={helperStyle}>
              Les sorties ci-dessous proviennent des appels TaxWare construits a partir des montants imposables saisis
            </span>

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
                  Montants saisis
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
                  Sorties TaxWare
                </h4>
                <div style={{ display: "grid", gap: "10px" }}>
                  <div>
                    <label style={labelStyle}>IFD brut</label>
                    <input
                      type="text"
                      value={formatMontantCHFArrondi(impotFederalBrut)}
                      readOnly
                      style={inputReadOnlyStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Rabais familial IFD</label>
                    <input
                      type="text"
                      value={formatMontantCHFArrondi(rabaisFamilialIfd)}
                      readOnly
                      style={inputReadOnlyStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>IFD net</label>
                    <input
                      type="text"
                      value={formatMontantCHFArrondi(impotFederalNet)}
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
                  des scénarios, mais il n’est plus utilisé ici pour reconstruire le revenu
                  imposable.
                </div>
              </div>
            </div>
          </div>

          <div
            style={{
              marginTop: "20px",
              display: "flex",
            }}
          >
            <button
              onClick={handleTaxSimulation}
              style={{
                padding: "12px 20px",
                borderRadius: "10px",
                border: "none",
                backgroundColor: "#0f172a",
                color: "#ffffff",
                fontWeight: "bold",
                cursor: "pointer",
              }}
            >
              Simuler la fiscalité
            </button>
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
                  <label style={labelStyle}>IFD brut</label>
                  <input
                    type="text"
                    value={formatMontantCHFArrondi(impotFederalBrut)}
                    readOnly
                    style={inputReadOnlyStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Rabais familial IFD</label>
                  <input
                    type="text"
                    value={formatMontantCHFArrondi(rabaisFamilialIfd)}
                    readOnly
                    style={inputReadOnlyStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>IFD net</label>
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

        <GuidedSection
          id="resultats"
          step="7"
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
                    ["IFD brut", formatMontantCHF(impotFederalBrut)],
                    ["Rabais familial IFD", formatMontantCHF(rabaisFamilialIfd)],
                    ["IFD net", formatMontantCHF(impotFederalNet)],
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

        <GuidedSection
          id="recommandation"
          step="8"
          title="Recommandation et restitution"
          description="Cette dernière étape traduit les résultats existants en messages de conseil, en priorités et en conclusion client. La logique de recommandation reste exactement celle de l’application actuelle."
        >
          <div
            style={{
              border: "1px solid #c7d2fe",
              borderRadius: "16px",
              padding: "24px",
              marginTop: "0",
              marginBottom: "24px",
              background: "linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%)",
              boxShadow: "0 8px 20px rgba(30, 41, 59, 0.05)",
            }}
          >
            <h2 style={{ marginTop: 0, marginBottom: "16px", color: "#312e81", fontSize: "24px" }}>
              Recommandations strategiques personnalisees
            </h2>

            <CollapsibleHelp title="Aide recommandations">
              {sectionHelpTexts.recommandations.map((text) => (
                <div key={text}>{text}</div>
              ))}
            </CollapsibleHelp>
            <p style={{ marginTop: 0, marginBottom: "16px", color: "#475569", lineHeight: 1.7 }}>
              Ton de conseil applique : <strong>{toneProfileLabel}</strong>. {recommendationToneIntro}
            </p>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: "16px",
              }}
            >
              <div style={subCardStyle}>
                <h3 style={{ marginTop: 0, marginBottom: "10px", color: "#1e293b" }}>Diagnostic</h3>
                <div style={{ display: "grid", gap: "10px" }}>
                  <p style={{ margin: 0, color: "#334155", lineHeight: 1.7 }}>
                    {diagnosticStrategique}
                  </p>
                  {recommandationsStrategiques[0] ? (
                    <div
                      style={{
                        padding: "10px 12px",
                        borderRadius: "12px",
                        backgroundColor: "#ffffff",
                        border: "1px solid #dbeafe",
                        color: "#334155",
                        lineHeight: 1.6,
                      }}
                    >
                      {recommandationsStrategiques[0].diagnostic}
                    </div>
                  ) : null}
                </div>
              </div>

              <div style={subCardStyle}>
                <h3 style={{ marginTop: 0, marginBottom: "10px", color: "#1e293b" }}>Enjeux</h3>
                <div style={{ display: "grid", gap: "8px", color: "#334155", lineHeight: 1.6 }}>
                  {[...new Set(enjeuxStrategiques)].map((enjeu, index) => (
                    <div key={index}>• {enjeu}</div>
                  ))}
                </div>
              </div>

              <div style={subCardStyle}>
                <h3 style={{ marginTop: 0, marginBottom: "10px", color: "#1e293b" }}>
                  Orientation du conseil
                </h3>
                <div style={{ display: "grid", gap: "10px", color: "#334155", lineHeight: 1.6 }}>
                  {sectionsAutomatiques.map((section) => (
                    <div
                      key={section.titre}
                      style={{
                        padding: "10px 12px",
                        borderRadius: "12px",
                        border: "1px solid #e2e8f0",
                        backgroundColor: "#ffffff",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: "12px",
                          alignItems: "center",
                          marginBottom: "6px",
                        }}
                      >
                        <strong style={{ color: "#0f172a" }}>{section.titre}</strong>
                        <span
                          style={{
                            fontSize: "12px",
                            fontWeight: "bold",
                            color: "#1d4ed8",
                          }}
                        >
                          Conseil premium
                        </span>
                      </div>
                      <div>{section.transformation}</div>
                      <div style={{ marginTop: "8px", fontSize: "13px", color: "#475569" }}>
                        Resultat attendu : {section.resultat}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={subCardStyle}>
                <h3 style={{ marginTop: 0, marginBottom: "10px", color: "#1e293b" }}>
                  Resultat attendu
                </h3>
                <p style={{ margin: 0, color: "#334155", lineHeight: 1.7 }}>
                  {resultatAttenduStrategique}
                </p>
              </div>
            </div>
          </div>

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
          {sectionsAutomatiques.map((section, index) => (
            <ReportSection
              key={index}
              titre={section.titre}
              situation={section.situation}
              analyse={section.analyse}
              transformation={section.transformation}
              resultat={section.resultat}
            />
          ))}
        </GuidedSection>
      </div>
    </div>
  );
}
