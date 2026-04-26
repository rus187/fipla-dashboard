import { describe, it, expect } from "vitest";
import {
  buildDynamicAdvisoryPreview,
  type AdvisoryContext,
} from "../recommendationEngine";

const baseContext: AdvisoryContext = {
  age: 45,
  partnership: "Marriage",
  childrenCount: 2,
  totalIncome: 120_000,
  totalWealth: 500_000,
  hasRealEstate: true,
  realEstateRegime: "actuel",
  taxGainVsBase: 5_000,
  variantSpread: 3_000,
  recommendedVariantLabel: "Variante optimisée",
  recommendedVariantRegime: "actuel",
};

describe("buildDynamicAdvisoryPreview — structure de sortie", () => {
  it("retourne les quatre blocs obligatoires", () => {
    const result = buildDynamicAdvisoryPreview(baseContext);
    expect(Array.isArray(result.blocks.recommendationLogic)).toBe(true);
    expect(Array.isArray(result.blocks.actionPriorities)).toBe(true);
    expect(Array.isArray(result.blocks.vigilancePoints)).toBe(true);
    expect(result.blocks.conclusion).toMatchObject({
      key: expect.any(String),
      title: expect.any(String),
      text: expect.any(String),
    });
  });

  it("le debug liste au moins une règle activée pour ce profil", () => {
    const result = buildDynamicAdvisoryPreview(baseContext);
    expect(result.debug.activatedRules.length).toBeGreaterThan(0);
  });

  it("context Single sans immobilier produit également une conclusion valide", () => {
    const ctx: AdvisoryContext = {
      ...baseContext,
      partnership: "Single",
      childrenCount: 0,
      hasRealEstate: false,
      realEstateRegime: null,
      taxGainVsBase: null,
      variantSpread: null,
      recommendedVariantLabel: null,
      recommendedVariantRegime: null,
    };
    const result = buildDynamicAdvisoryPreview(ctx);
    expect(result.blocks.conclusion.text.length).toBeGreaterThan(0);
  });
});
