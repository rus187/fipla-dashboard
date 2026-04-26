import { describe, it, expect } from "vitest";
import { normalizeTaxwareResponse } from "../normalizeTaxwareResponse";

describe("normalizeTaxwareResponse — cas de référence", () => {
  it("retourne une structure à nulls pour une entrée vide", () => {
    const normalized = normalizeTaxwareResponse(null);
    expect(normalized).toMatchSnapshot();
  });

  it("extrait les champs plats d'une réponse NE Le Locle minimale", () => {
    const raw = {
      Canton: "NE",
      Municipality: "Le Locle",
      TaxableIncomeCantonal: 75000,
      TaxableIncomeFederal: 76000,
      TaxableAssets: 45000,
      FederalTax: 950,
      CantonTax: 8200,
      MunicipalityTax: 5400,
      TotalTax: 14850,
      Partnership: "Single",
      NumChildren: 0,
    };
    expect(normalizeTaxwareResponse(raw)).toMatchSnapshot();
  });

  it("déballe le wrapper `data` — BE Biel/Bienne avec impôt paroissial", () => {
    const raw = {
      data: {
        Canton: "BE",
        Municipality: "Biel/Bienne",
        TaxableIncomeCantonal: 150000,
        TaxableIncomeFederal: 155000,
        CantonTax: 18000,
        MunicipalityTax: 11000,
        ChurchTax: 1500,
        FederalTax: 5200,
        WealthTaxCantonalCommunal: 600,
        Partnership: "Marriage",
        NumChildren: 2,
      },
    };
    expect(normalizeTaxwareResponse(raw)).toMatchSnapshot();
  });

  it("applique cantonRule 'vaud-office-mapping' pour VD Lausanne", () => {
    const raw = {
      Canton: "VD",
      Municipality: "Lausanne",
      TaxableIncomeCantonal: 180000,
      CantonTax: 22000,
      MunicipalityTax: 14000,
      FederalTax: 7000,
      TotalTax: 43000,
      Partnership: "Marriage",
      NumChildren: 1,
    };
    const normalized = normalizeTaxwareResponse(raw);
    expect(normalized.cantonalContext.cantonRule).toBe("vaud-office-mapping");
    expect(normalized).toMatchSnapshot();
  });

  it("extrait TaxesIncome.MarginalTaxRate quand présent", () => {
    const raw = {
      Canton: "GE",
      Municipality: "Genève",
      TaxesIncome: { MarginalTaxRate: 35.4 },
      FederalTax: 1200,
      TotalTax: 9000,
    };
    const normalized = normalizeTaxwareResponse(raw);
    expect(normalized.marginalTaxRate).toBe(35.4);
  });

  it("retourne null pour marginalTaxRate quand absent de la réponse", () => {
    const raw = { Canton: "NE", TotalTax: 5000 };
    expect(normalizeTaxwareResponse(raw).marginalTaxRate).toBeNull();
  });

  it("calcule le cantonalCommunalTax et le totalTax par fallback de somme — ZG Zug", () => {
    const raw = {
      Canton: "ZG",
      Municipality: "Zug",
      TaxableIncomeCantonal: 55000,
      TaxableIncomeFederal: 56000,
      CantonTax: 4200,
      MunicipalityTax: 3100,
      ChurchTax: 210,
      FederalTax: 480,
      WealthTaxCantonalCommunal: 1800,
      Partnership: "Single",
      NumChildren: 0,
    };
    const normalized = normalizeTaxwareResponse(raw);
    expect(normalized.cantonalCommunalTax).toBe(4200 + 3100 + 210);
    expect(normalized.totalTax).toBe(480 + (4200 + 3100 + 210) + 1800);
    expect(normalized).toMatchSnapshot();
  });
});
