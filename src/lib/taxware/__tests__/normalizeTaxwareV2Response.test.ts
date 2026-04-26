import { describe, it, expect } from "vitest";
import { normalizeTaxwareV2Response } from "../normalizeTaxwareV2Response";

const GE_BASES = {
  taxableIncomeFederal: 159800,
  taxableIncomeCanton: 128047,
  taxableAssets: 336385,
};

const NE_BASES = {
  taxableIncomeFederal: 159800,
  taxableIncomeCanton: 174400,
  taxableAssets: 600000,
};

// Fixtures capturées lors des tests curl V2 GE et NE (2026-04-25)
const GE_RAW_V2 = {
  Canton: "GE",
  Municipality: "Genève",
  TariffCanton: "Normal",
  TariffFederal: "Normal",
  IncomeTaxResult: {
    CantonMunicipalityParishTaxTotal: 24998.5,
    FederalTax: 8153.6,
    FederalGrossTax: 8153.6,
    FederalRate: 0.05102378,
    FederalChildrenReduction: 0.0,
    CantonUnitaryTax: 14166.2,
    CantonUnitaryTaxRate: 0.1106325,
    CantonTax: 18554.3,
    CantonVariableTax: 18529.3,
    CantonRate: 0.14470737,
    CantonCoefficient: 1.308,
    CantonCoefficientText: "130.8",
    CantonIndex: 0,
    CantonChildrenReduction: 0.0,
    CantonFixTax: 25,
    MunicipalityTax: 6444.2,
    MunicipalityVariableTax: 6444.2,
    MunicipalityCoefficient: 0.4549,
    MunicipalityCoefficientText: "45.49",
    MunicipalityIndex: 0,
    MunicipalityFixTax: 0,
    MunicipalityRate: 0.05032675,
    ParishTaxTotal: 0.0,
    ParishCoefficient: 0.0,
    ParishCoefficientText: null,
    ParishCoefficientSpouse: 0.0,
    ParishCoefficientSpouseText: null,
    MarginalTaxRate: 0.3708,
    TaxTotal: 33152.1,
  },
  AssetTaxResult: {
    CantonMunicipalityParishTaxTotal: 1255.2,
    TaxTotal: 1255.2,
    CantonUnitaryTax: 635.2,
    CantonUnitaryTaxRate: 0.0018882,
    CantonTax: 966.2,
    CantonRate: 0.00287227,
    CantonCoefficient: 1.308,
    CantonCoefficientText: "130.8",
    CantonIndex: 0,
    MunicipalityTax: 289.0,
    MunicipalityCoefficient: 0.4549,
    MunicipalityIndex: 0,
    ParishTaxTotal: 0,
    ParishCoefficient: 0.0,
    ParishCoefficientSpouse: 0.0,
    MarginalTaxRate: 0.0047,
  },
  TaxesTotal: 34407.3,
  ErrorCode: null,
  ErrorMessage: null,
  HasError: false,
  StatusCode: "Ok",
};

const NE_RAW_V2 = {
  Canton: "NE",
  Municipality: "Neuchâtel",
  TariffCanton: "Normal",
  TariffFederal: "Normal",
  IncomeTaxResult: {
    CantonMunicipalityParishTaxTotal: 42400.0,
    FederalTax: 8153.6,
    FederalGrossTax: 8153.6,
    FederalRate: 0.05102378,
    FederalChildrenReduction: 0.0,
    CantonUnitaryTax: 22433.9,
    CantonUnitaryTaxRate: 0.128635,
    CantonTax: 27818.0,
    CantonVariableTax: 27818.0,
    CantonRate: 0.15950709,
    CantonCoefficient: 1.24,
    CantonCoefficientText: "124",
    CantonIndex: 0,
    CantonChildrenReduction: 0.0,
    CantonFixTax: 0.0,
    MunicipalityTax: 14582.0,
    MunicipalityVariableTax: 14582.0,
    MunicipalityCoefficient: 0.65,
    MunicipalityCoefficientText: "65",
    MunicipalityIndex: 0,
    MunicipalityFixTax: 0,
    MunicipalityRate: 0.08361259,
    ParishTaxTotal: 0.0,
    ParishCoefficient: 0.0,
    ParishCoefficientText: null,
    ParishCoefficientSpouse: 0.0,
    ParishCoefficientSpouseText: null,
    MarginalTaxRate: 0.4104,
    TaxTotal: 50553.6,
  },
  AssetTaxResult: {
    CantonMunicipalityParishTaxTotal: 4082.4,
    TaxTotal: 4082.4,
    CantonUnitaryTax: 2160.0,
    CantonUnitaryTaxRate: 0.0036,
    CantonTax: 2678.4,
    CantonRate: 0.004464,
    CantonCoefficient: 1.24,
    CantonCoefficientText: "124",
    CantonIndex: 0,
    MunicipalityTax: 1404.0,
    MunicipalityCoefficient: 0.65,
    MunicipalityIndex: 0,
    ParishTaxTotal: 0,
    ParishCoefficient: 0.0,
    ParishCoefficientSpouse: 0.0,
    MarginalTaxRate: 0.0068,
  },
  TaxesTotal: 54636.0,
  ErrorCode: null,
  ErrorMessage: null,
  HasError: false,
  StatusCode: "Ok",
};

describe("normalizeTaxwareV2Response", () => {
  describe("cas GE (Genève — bases Office 2026)", () => {
    const result = normalizeTaxwareV2Response(GE_RAW_V2, GE_BASES, "office-aligned");

    it("extrait le canton et la commune", () => {
      expect(result.canton).toBe("GE");
      expect(result.municipality).toBe("Genève");
    });

    it("reflète les bases imposables en input", () => {
      expect(result.taxableIncomeFederal).toBe(159800);
      expect(result.taxableIncomeCanton).toBe(128047);
      expect(result.taxableAssets).toBe(336385);
    });

    it("extrait l'IFD", () => {
      expect(result.federalTax).toBe(8153.6);
    });

    it("extrait l'impôt cantonal/communal income", () => {
      expect(result.cantonalCommunalTax).toBe(24998.5);
      expect(result.cantonalTax).toBe(18554.3);
      expect(result.communalTax).toBe(6444.2);
      expect(result.churchTax).toBe(0);
    });

    it("extrait l'impôt fortune", () => {
      expect(result.wealthTax).toBe(1255.2);
    });

    it("extrait le total", () => {
      expect(result.totalTax).toBe(34407.3);
    });

    it("extrait le taux marginal", () => {
      expect(result.marginalTaxRate).toBe(0.3708);
    });

    it("extrait les coefficients communaux", () => {
      expect(result.cantonCoefficient).toBe(1.308);
      expect(result.municipalityCoefficient).toBe(0.4549);
    });

    it("annote la fiabilité", () => {
      expect(result.reliability.source).toBe("v2-from-bases");
      expect(result.reliability.basesSource).toBe("office-aligned");
      expect(result.reliability.requestedBases).toEqual(GE_BASES);
    });

    it("conserve la réponse brute", () => {
      expect(result.raw).toBe(GE_RAW_V2);
    });
  });

  describe("cas NE (Neuchâtel — bases Office 2026)", () => {
    const result = normalizeTaxwareV2Response(NE_RAW_V2, NE_BASES, "office-aligned");

    it("extrait le canton et la commune", () => {
      expect(result.canton).toBe("NE");
      expect(result.municipality).toBe("Neuchâtel");
    });

    it("reflète les bases imposables en input", () => {
      expect(result.taxableIncomeFederal).toBe(159800);
      expect(result.taxableIncomeCanton).toBe(174400);
      expect(result.taxableAssets).toBe(600000);
    });

    it("extrait l'IFD — identique à GE pour la même base fédérale", () => {
      expect(result.federalTax).toBe(8153.6);
    });

    it("extrait l'impôt cantonal/communal income", () => {
      expect(result.cantonalCommunalTax).toBe(42400.0);
      expect(result.cantonalTax).toBe(27818.0);
      expect(result.communalTax).toBe(14582.0);
      expect(result.churchTax).toBe(0);
    });

    it("extrait l'impôt fortune", () => {
      expect(result.wealthTax).toBe(4082.4);
    });

    it("extrait le total", () => {
      expect(result.totalTax).toBe(54636.0);
    });

    it("extrait le taux marginal", () => {
      expect(result.marginalTaxRate).toBe(0.4104);
    });

    it("extrait les coefficients communaux", () => {
      expect(result.cantonCoefficient).toBe(1.24);
      expect(result.municipalityCoefficient).toBe(0.65);
    });

    it("annote la fiabilité", () => {
      expect(result.reliability.source).toBe("v2-from-bases");
      expect(result.reliability.basesSource).toBe("office-aligned");
      expect(result.reliability.requestedBases).toEqual(NE_BASES);
    });
  });

  describe("réponse vide ou null", () => {
    const bases = { taxableIncomeFederal: 100000, taxableIncomeCanton: 95000, taxableAssets: 200000 };
    const result = normalizeTaxwareV2Response(null, bases, "office-aligned");

    it("retourne des nulls pour tous les impôts", () => {
      expect(result.federalTax).toBeNull();
      expect(result.cantonalCommunalTax).toBeNull();
      expect(result.wealthTax).toBeNull();
      expect(result.totalTax).toBeNull();
    });

    it("reflète quand même les bases", () => {
      expect(result.taxableIncomeFederal).toBe(100000);
      expect(result.taxableIncomeCanton).toBe(95000);
      expect(result.taxableAssets).toBe(200000);
    });

    it("annote la fiabilité même en cas d'erreur", () => {
      expect(result.reliability.source).toBe("v2-from-bases");
    });
  });

  describe("cohérence NE vs GE (delta impôts)", () => {
    const geResult = normalizeTaxwareV2Response(GE_RAW_V2, GE_BASES, "office-aligned");
    const neResult = normalizeTaxwareV2Response(NE_RAW_V2, NE_BASES, "office-aligned");

    it("NE est plus chargé que GE sur l'ICC (bases différentes)", () => {
      expect(neResult.cantonalCommunalTax!).toBeGreaterThan(geResult.cantonalCommunalTax!);
    });

    it("IFD identique GE vs NE pour la même base fédérale", () => {
      expect(neResult.federalTax).toBe(geResult.federalTax);
    });

    it("delta total NE − GE ≈ +20'228 CHF", () => {
      const delta = neResult.totalTax! - geResult.totalTax!;
      expect(delta).toBeCloseTo(20228.7, 0);
    });
  });
});
