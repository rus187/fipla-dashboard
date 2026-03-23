export type TaxwareNormalizedResponse = {
  canton: string | null;
  municipality: string | null;
  taxableIncomeCantonal: number | null;
  taxableIncomeFederal: number | null;
  taxableAssets: number | null;
  federalTax: number | null;
  cantonalTax: number | null;
  communalTax: number | null;
  cantonalCommunalTax: number | null;
  wealthTax: number | null;
  totalTax: number | null;
  cantonalBreakdown: {
    principalCantonalTax: number | null;
    principalCommunalTax: number | null;
    unitaryTax: number | null;
    cantonAdditionalTax: number | null;
    municipalityAdditionalTax: number | null;
    churchTax: number | null;
    otherComponentsTotal: number | null;
    displayedCantonalTotal: number | null;
  };
  cantonalContext: {
    cantonRule: string;
    quotientAppliedLocally: boolean;
    rateDefiningIncomeCantonal: number | null;
    cantonAdditionalTax: number | null;
    municipalityAdditionalTax: number | null;
    exactCantonalField: string | null;
    exactCommunalField: string | null;
    exactUnitaryField: string | null;
    exactTotalField: string | null;
    partnership: string | null;
    childrenCount: number | null;
  };
  deductions: {
    occupational: {
      federal: number | null;
      cantonal: number | null;
      wealth: number | null;
    };
    insurance: {
      federal: number | null;
      cantonal: number | null;
      wealth: number | null;
    };
    social: {
      federal: number | null;
      cantonal: number | null;
      wealth: number | null;
      details: {
        children: {
          federal: number | null;
          cantonal: number | null;
          wealth: number | null;
        };
        personal: {
          federal: number | null;
          cantonal: number | null;
          wealth: number | null;
        };
        secondEarner: {
          federal: number | null;
          cantonal: number | null;
          wealth: number | null;
        };
        assets: {
          federal: number | null;
          cantonal: number | null;
          wealth: number | null;
        };
      };
    };
  };
  raw: unknown;
};

type AnyRecord = Record<string, any>;

function getByPath(obj: AnyRecord | null | undefined, path: string): unknown {
  if (!obj) return undefined;

  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const cleaned = value
      .replace(/\s/g, "")
      .replace(/'/g, "")
      .replace(/CHF/gi, "")
      .replace(",", ".");

    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function firstNumber(obj: AnyRecord, paths: string[]): number | null {
  for (const path of paths) {
    const value = toNumber(getByPath(obj, path));
    if (value !== null) return value;
  }
  return null;
}

function sumNumbers(...values: Array<number | null>): number | null {
  const valid = values.filter((v): v is number => typeof v === "number");
  if (valid.length === 0) return null;
  return valid.reduce((acc, val) => acc + val, 0);
}

function firstNumberFromPaths(obj: AnyRecord, paths: string[]): number | null {
  return firstNumber(obj, paths);
}

function firstNumberWithMatchedPath(obj: AnyRecord, paths: string[]) {
  for (const path of paths) {
    const value = toNumber(getByPath(obj, path));
    if (value !== null) {
      return { value, path };
    }
  }

  return { value: null, path: null };
}

export function normalizeTaxwareResponse(
  rawResponse: AnyRecord | null | undefined
): TaxwareNormalizedResponse {
  const source = (rawResponse?.data ?? rawResponse ?? {}) as AnyRecord;

    const canton = source?.Canton ?? null;
    const municipality = source?.Municipality ?? null;

  const taxableIncomeCantonal = firstNumber(source, [
    "TaxableIncomeCantonal",
    "TaxableIncomeCanton",
    "IncomeTaxableCantonal",
    "IncomeTaxableCanton",
    "TaxableIncome",
    "Result.TaxableIncomeCantonal",
    "Summary.TaxableIncomeCantonal",
  ]);

  const taxableIncomeFederal = firstNumber(source, [
    "TaxableIncomeFederal",
    "IncomeTaxableFederal",
    "FederalTaxableIncome",
    "Result.TaxableIncomeFederal",
    "Summary.TaxableIncomeFederal",
  ]);

  const taxableAssets = firstNumber(source, [
    "TaxableAssets",
    "AssetsTaxable",
    "Result.TaxableAssets",
    "Summary.TaxableAssets",
  ]);

  const federalTax = firstNumber(source, [
    "FederalTax",
    "TaxesIncome.FederalTax",
    "Taxes.FederalTax",
    "TaxAmountFederal",
    "TaxesFederal",
    "Result.FederalTax",
    "Summary.FederalTax",
  ]);

  const exactCantonalTax = firstNumberWithMatchedPath(source, [
    "CantonTax",
    "TaxesIncome.CantonTax",
    "Result.CantonTax",
    "Summary.CantonTax",
    "CantonalTax",
    "Taxes.CantonTax",
    "Taxes.CantonalTax",
    "Result.CantonalTax",
    "Summary.CantonalTax",
    "TaxAmountCantonal",
    "TaxesCantonal",
  ]);
  const rawCantonalTax = exactCantonalTax.value;

  const exactCommunalTax = firstNumberWithMatchedPath(source, [
    "MunicipalityTax",
    "TaxesIncome.MunicipalityTax",
    "Result.MunicipalityTax",
    "Summary.MunicipalityTax",
    "MunicipalTax",
    "Taxes.CommunalTax",
    "Taxes.MunicipalityTax",
    "CommunalTax",
    "Result.CommunalTax",
    "Summary.CommunalTax",
    "TaxAmountMunicipality",
    "TaxesMunicipality",
  ]);
  const rawCommunalTax = exactCommunalTax.value;

  const churchTax = firstNumber(source, [
    "ChurchTax",
    "ParishTax",
    "TaxesIncome.ParishTax",
    "Taxes.ChurchTax",
    "Taxes.ParishTax",
    "TaxAmountChurch",
    "TaxesChurch",
    "Result.ChurchTax",
    "Summary.ChurchTax",
  ]);

  const exactCantonalCommunalTax = firstNumberWithMatchedPath(source, [
      "CantonMunicipalityParishTaxTotal",
      "TaxesIncome.CantonMunicipalityParishTaxTotal",
      "TaxesIncome.CantonMunicipalityTaxTotal",
      "CantonMunicipalityTaxTotal",
      "CantonalCommunalTax",
      "Taxes.CantonalCommunalTax",
      "Result.CantonMunicipalityParishTaxTotal",
      "Summary.CantonMunicipalityParishTaxTotal",
      "TaxAmountCantonalCommunal",
      "TaxesCantonalCommunal",
      "Result.CantonalCommunalTax",
      "Summary.CantonalCommunalTax",
    ]);
  const rawCantonalCommunalTax =
    exactCantonalCommunalTax.value ?? sumNumbers(rawCantonalTax, rawCommunalTax, churchTax);

  const cantonAdditionalTax = firstNumber(source, [
    "CantonAdditionalTax",
    "TaxesIncome.CantonAdditionalTax",
    "Taxes.CantonAdditionalTax",
    "Result.CantonAdditionalTax",
    "Summary.CantonAdditionalTax",
  ]);

  const municipalityAdditionalTax = firstNumber(source, [
    "MunicipalityAdditionalTax",
    "TaxesIncome.MunicipalityAdditionalTax",
    "Taxes.MunicipalityAdditionalTax",
    "Result.MunicipalityAdditionalTax",
    "Summary.MunicipalityAdditionalTax",
  ]);

  const rateDefiningIncomeCantonal = firstNumber(source, [
    "RatedefIncomeCanton",
    "RateDefiningIncomeCanton",
    "Result.RatedefIncomeCanton",
    "Summary.RatedefIncomeCanton",
  ]);

  const partnership = (getByPath(source, "Partnership") as string | undefined) ?? null;
  const childrenCount = firstNumber(source, [
    "NumChildren",
    "ChildrenCount",
    "Family.NumChildren",
    "Family.ChildrenCount",
  ]);
  const exactUnitaryTax = firstNumberWithMatchedPath(source, [
    "CantonUnitaryTax",
    "UnitaryTax",
    "TaxesIncome.CantonUnitaryTax",
    "Result.CantonUnitaryTax",
    "Summary.CantonUnitaryTax",
  ]);
  const unitaryTax = exactUnitaryTax.value;

  const wealthTax =
    firstNumber(source, [
      "WealthTaxCantonalCommunal",
      "AssetTaxCantonalCommunal",
      "TaxesAssets.CantonMunicipalityParishTaxTotal",
      "TaxesAssets.CantonMunicipalityTaxTotal",
      "TaxesAssets.TaxTotal",
    ]);

  const exactTotalTax = firstNumberWithMatchedPath(source, [
      "TotalTax",
      "TaxTotal",
      "TaxesIncome.TotalTax",
      "TaxesIncome.Total",
      "Taxes.TotalTax",
      "TaxesTotal",
      "TaxAmountTotal",
      "Result.TotalTax",
      "Summary.TotalTax",
    ]);
  const totalTax =
    exactTotalTax.value ?? sumNumbers(federalTax, rawCantonalCommunalTax, wealthTax);

  const occupationalFederalLeading = firstNumberFromPaths(source, [
    "PersonLeading.DeductionsOccupationalExpensesTotalFederal",
    "Result.PersonLeading.DeductionsOccupationalExpensesTotalFederal",
    "Summary.PersonLeading.DeductionsOccupationalExpensesTotalFederal",
  ]);

  const occupationalFederalSecond = firstNumberFromPaths(source, [
    "PersonSecond.DeductionsOccupationalExpensesTotalFederal",
    "Result.PersonSecond.DeductionsOccupationalExpensesTotalFederal",
    "Summary.PersonSecond.DeductionsOccupationalExpensesTotalFederal",
  ]);

  const occupationalCantonalLeading = firstNumberFromPaths(source, [
    "PersonLeading.DeductionsOccupationalExpensesTotalCanton",
    "Result.PersonLeading.DeductionsOccupationalExpensesTotalCanton",
    "Summary.PersonLeading.DeductionsOccupationalExpensesTotalCanton",
  ]);

  const occupationalCantonalSecond = firstNumberFromPaths(source, [
    "PersonSecond.DeductionsOccupationalExpensesTotalCanton",
    "Result.PersonSecond.DeductionsOccupationalExpensesTotalCanton",
    "Summary.PersonSecond.DeductionsOccupationalExpensesTotalCanton",
  ]);

  const occupationalFederal =
    sumNumbers(occupationalFederalLeading, occupationalFederalSecond) ??
    firstNumberFromPaths(source, [
      "DeductionsOccupationalExpensesTotalFederal",
      "Result.DeductionsOccupationalExpensesTotalFederal",
      "Summary.DeductionsOccupationalExpensesTotalFederal",
    ]);

  const occupationalCantonal =
    sumNumbers(occupationalCantonalLeading, occupationalCantonalSecond) ??
    firstNumberFromPaths(source, [
      "DeductionsOccupationalExpensesTotalCanton",
      "Result.DeductionsOccupationalExpensesTotalCanton",
      "Summary.DeductionsOccupationalExpensesTotalCanton",
    ]);

  const insuranceFederal = firstNumberFromPaths(source, [
    "DeductionsInsurancePrimesFederal",
    "Result.DeductionsInsurancePrimesFederal",
    "Summary.DeductionsInsurancePrimesFederal",
  ]);

  const insuranceCantonal = firstNumberFromPaths(source, [
    "DeductionsInsurancePrimesCanton",
    "Result.DeductionsInsurancePrimesCanton",
    "Summary.DeductionsInsurancePrimesCanton",
  ]);

  const socialChildrenFederal = firstNumberFromPaths(source, [
    "DeductionsChildrenFederal",
    "Result.DeductionsChildrenFederal",
    "Summary.DeductionsChildrenFederal",
  ]);

  const socialChildrenCantonal = firstNumberFromPaths(source, [
    "DeductionsChildrenCanton",
    "Result.DeductionsChildrenCanton",
    "Summary.DeductionsChildrenCanton",
  ]);

  const socialPersonalFederal = firstNumberFromPaths(source, [
    "DeductionPersonalFederal",
    "Result.DeductionPersonalFederal",
    "Summary.DeductionPersonalFederal",
  ]);

  const socialPersonalCantonal = firstNumberFromPaths(source, [
    "DeductionPersonalCanton",
    "Result.DeductionPersonalCanton",
    "Summary.DeductionPersonalCanton",
  ]);

  const socialSecondEarnerFederal = firstNumberFromPaths(source, [
    "DeductionsSecondEarnerFederal",
    "Result.DeductionsSecondEarnerFederal",
    "Summary.DeductionsSecondEarnerFederal",
  ]);

  const socialSecondEarnerCantonal = firstNumberFromPaths(source, [
    "DeductionsSecondEarnerCanton",
    "Result.DeductionsSecondEarnerCanton",
    "Summary.DeductionsSecondEarnerCanton",
  ]);

  const socialAssetsWealth = firstNumberFromPaths(source, [
    "DeductionAssets",
    "Result.DeductionAssets",
    "Summary.DeductionAssets",
  ]);

  const socialFederal = sumNumbers(
    socialChildrenFederal,
    socialPersonalFederal,
    socialSecondEarnerFederal
  );

  const socialCantonal = sumNumbers(
    socialChildrenCantonal,
    socialPersonalCantonal,
    socialSecondEarnerCantonal
  );

  return {
    canton,
    municipality,
    taxableIncomeCantonal,
    taxableIncomeFederal,
    taxableAssets,
    federalTax,
    cantonalTax: rawCantonalTax,
    communalTax: rawCommunalTax,
    cantonalCommunalTax: rawCantonalCommunalTax,
    wealthTax,
    totalTax,
    cantonalBreakdown: {
      principalCantonalTax: rawCantonalTax,
      principalCommunalTax: rawCommunalTax,
      unitaryTax,
      cantonAdditionalTax,
      municipalityAdditionalTax,
      churchTax,
      otherComponentsTotal: sumNumbers(cantonAdditionalTax, municipalityAdditionalTax, churchTax),
      displayedCantonalTotal: exactTotalTax.value ?? rawCantonalCommunalTax,
    },
    cantonalContext: {
      cantonRule: canton === "VD" ? "vaud-office-mapping" : "default",
      quotientAppliedLocally: false,
      rateDefiningIncomeCantonal,
      cantonAdditionalTax,
      municipalityAdditionalTax,
      exactCantonalField: exactCantonalTax.path,
      exactCommunalField: exactCommunalTax.path,
      exactUnitaryField: exactUnitaryTax.path,
      exactTotalField: exactTotalTax.path,
      partnership,
      childrenCount,
    },
    deductions: {
      occupational: {
        federal: occupationalFederal,
        cantonal: occupationalCantonal,
        wealth: null,
      },
      insurance: {
        federal: insuranceFederal,
        cantonal: insuranceCantonal,
        wealth: null,
      },
      social: {
        federal: socialFederal,
        cantonal: socialCantonal,
        wealth: socialAssetsWealth,
        details: {
          children: {
            federal: socialChildrenFederal,
            cantonal: socialChildrenCantonal,
            wealth: null,
          },
          personal: {
            federal: socialPersonalFederal,
            cantonal: socialPersonalCantonal,
            wealth: null,
          },
          secondEarner: {
            federal: socialSecondEarnerFederal,
            cantonal: socialSecondEarnerCantonal,
            wealth: null,
          },
          assets: {
            federal: null,
            cantonal: null,
            wealth: socialAssetsWealth,
          },
        },
      },
    },
    raw: rawResponse,
  };
}
