import type { Dispatch, SetStateAction } from "react";
import type { ScenarioVariant } from "../lib/variants";

export interface VariantHandlers {
  handleVariantCustomLabelChange: (variantIndex: number, nextValue: string) => void;
  handleDeleteVariant: (variantIndex: number) => void;
  handleResetVariantsFromVariant1: () => void;
}

export interface VariantHandlersOptions {
  setVariants: Dispatch<SetStateAction<ScenarioVariant[]>>;
  setActiveVariantIndex: Dispatch<SetStateAction<number>>;
  normalizeVariantLabels: (variants: ScenarioVariant[]) => ScenarioVariant[];
  cloneVariantStateFromBase: (
    baseVariant: ScenarioVariant,
    targetVariant: ScenarioVariant,
    keepLinkToVariant1: boolean
  ) => ScenarioVariant;
}

export function useVariantHandlers(options: VariantHandlersOptions): VariantHandlers {
  const {
    setVariants,
    setActiveVariantIndex,
    normalizeVariantLabels,
    cloneVariantStateFromBase,
  } = options;

  const handleVariantCustomLabelChange = (variantIndex: number, nextValue: string) => {
    setVariants((current) =>
      current.map((variant, index) =>
        index === variantIndex ? { ...variant, customLabel: nextValue } : variant
      )
    );
  };

  const handleDeleteVariant = (variantIndex: number) => {
    if (variantIndex === 0) {
      return;
    }

    setVariants((current) => {
      if (variantIndex < 0 || variantIndex >= current.length) {
        return current;
      }

      return normalizeVariantLabels(current.filter((_, index) => index !== variantIndex));
    });

    setActiveVariantIndex((currentActiveIndex) => {
      if (currentActiveIndex === variantIndex) {
        return Math.max(0, variantIndex - 1);
      }

      if (currentActiveIndex > variantIndex) {
        return currentActiveIndex - 1;
      }

      return currentActiveIndex;
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

  return {
    handleVariantCustomLabelChange,
    handleDeleteVariant,
    handleResetVariantsFromVariant1,
  };
}
