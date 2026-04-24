import { describe, it, expect } from "vitest";
import { createInitialVariants, createEmptyVariant, cloneDossier } from "../variants";

describe("variants — création et clonage (useVariants)", () => {
  it("createInitialVariants retourne exactement une variante de base", () => {
    const variants = createInitialVariants();
    expect(variants).toHaveLength(1);
    expect(variants[0].id).toBe("variant-1");
    expect(variants[0].label).toBe("Base");
    expect(variants[0].taxRegime).toBe("current");
    expect(variants[0].taxResult).toBeNull();
    expect(variants[0].isLinkedToVariant1).toBe(false);
  });

  it("createEmptyVariant(1) crée une variante numérotée distincte de la base", () => {
    const variant = createEmptyVariant(1);
    expect(variant.id).toBe("variant-2");
    expect(variant.label).toBe("Variante 1");
    expect(variant.customLabel).toBe("");
    expect(variant.isLinkedToVariant1).toBe(false);
  });

  it("cloneDossier produit une copie profonde indépendante", () => {
    const [base] = createInitialVariants();
    const clone = cloneDossier(base.dossier);
    (clone as Record<string, unknown>).__sentinel = true;
    expect((base.dossier as Record<string, unknown>).__sentinel).toBeUndefined();
  });

  it("gère le cas edge : créer une variante avec un index très élevé", () => {
    const variant = createEmptyVariant(999);
    expect(variant.id).toBe("variant-1000");
    expect(variant.label).toBe("Variante 999");
    expect(variant.taxResult).toBeNull();
    expect(variant.comparisonTaxResults).toEqual({});
  });

  it("createEmptyVariant(0) génère la variante Base avec tous les champs par défaut", () => {
    const variant = createEmptyVariant(0);
    expect(variant.id).toBe("variant-1");
    expect(variant.label).toBe("Base");
    expect(variant.customLabel).toBe("");
    expect(variant.taxRegime).toBe("current");
    expect(variant.taxResult).toBeNull();
    expect(variant.taxResultSansOptimisation).toBeNull();
    expect(variant.taxResultAvecDeductionsEstime).toBeNull();
    expect(variant.taxResultAjustementManuel).toBeNull();
    expect(variant.taxResultCorrectionFiscaleManuelle).toBeNull();
    expect(variant.comparisonTaxResults).toEqual({});
    expect(variant.isLinkedToVariant1).toBe(false);
    expect(variant.dossier).toBeDefined();
  });
});
