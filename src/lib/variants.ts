import type { DossierClient } from "../types";
import { emptyDossier } from "../mockDossier";

export type VariantTaxRegime = "current" | "valeur_locative_reform";

export type ScenarioVariant = {
  id: string;
  label: string;
  customLabel: string;
  taxRegime: VariantTaxRegime;
  dossier: DossierClient;
  taxResult: any;
  taxResultSansOptimisation: any;
  taxResultAvecDeductionsEstime: any;
  taxResultAjustementManuel: any;
  taxResultCorrectionFiscaleManuelle: any;
  comparisonTaxResults: Record<string, any>;
  isLinkedToVariant1: boolean;
};

export function cloneDossier(source: DossierClient): DossierClient {
  return JSON.parse(JSON.stringify(source));
}

export function createEmptyVariant(index: number): ScenarioVariant {
  return {
    id: `variant-${index + 1}`,
    label: index === 0 ? "Base" : `Variante ${index}`,
    customLabel: "",
    taxRegime: "current",
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

export function createInitialVariants(): ScenarioVariant[] {
  return [createEmptyVariant(0)];
}
