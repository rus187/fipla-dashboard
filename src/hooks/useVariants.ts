import { useState } from "react";
import { createInitialVariants, type ScenarioVariant } from "../lib/variants";

export function useVariants() {
  const [variants, setVariants] = useState<ScenarioVariant[]>(createInitialVariants);
  const [activeVariantIndex, setActiveVariantIndex] = useState(0);
  const activeVariant = variants[activeVariantIndex];

  return {
    variants,
    setVariants,
    activeVariantIndex,
    setActiveVariantIndex,
    activeVariant,
  };
}
