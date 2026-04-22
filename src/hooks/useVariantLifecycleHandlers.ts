import type { Dispatch, SetStateAction } from "react";
import { createEmptyVariant } from "../lib/variants";
import type { ScenarioVariant } from "../lib/variants";

export interface VariantLifecycleHandlers {
  handleAddVariantFromActive: () => void;
}

export interface VariantLifecycleHandlersOptions {
  setVariants: Dispatch<SetStateAction<ScenarioVariant[]>>;
  setActiveVariantIndex: Dispatch<SetStateAction<number>>;
  activeVariantIndex: number;
  maxVariants: number;
  normalizeVariantLabels: (variants: ScenarioVariant[]) => ScenarioVariant[];
  cloneVariantStateFromBase: (
    baseVariant: ScenarioVariant,
    targetVariant: ScenarioVariant,
    keepLinkToVariant1: boolean
  ) => ScenarioVariant;
  clearVariantSimulationOutputs: (variant: ScenarioVariant) => ScenarioVariant;
  getVariantUserLabel: (variant: ScenarioVariant) => string;
}

export function useVariantLifecycleHandlers(
  options: VariantLifecycleHandlersOptions
): VariantLifecycleHandlers {
  const {
    setVariants,
    setActiveVariantIndex,
    activeVariantIndex,
    maxVariants,
    normalizeVariantLabels,
    cloneVariantStateFromBase,
    clearVariantSimulationOutputs,
    getVariantUserLabel,
  } = options;

  const handleAddVariantFromActive = () => {
    setVariants((current) => {
      if (current.length >= maxVariants) {
        return current;
      }

      const sourceVariant = current[activeVariantIndex] ?? current[0];
      const nextIndex = current.length;
      const targetVariant = {
        ...createEmptyVariant(nextIndex),
        taxRegime: sourceVariant.taxRegime,
      };
      const nextVariant: ScenarioVariant = clearVariantSimulationOutputs(
        {
          ...cloneVariantStateFromBase(sourceVariant, targetVariant, false),
          id: `variant-${Date.now()}-${nextIndex}`,
          customLabel: `Copie de ${getVariantUserLabel(sourceVariant) || sourceVariant.label}`,
          isLinkedToVariant1: false,
        }
      );

      const nextVariants = normalizeVariantLabels([...current, nextVariant]);
      setActiveVariantIndex(nextVariants.length - 1);

      return nextVariants;
    });
  };

  return {
    handleAddVariantFromActive,
  };
}
