import type { DossierClient } from "../../types";

function toPositiveNumber(value: unknown) {
  const numericValue =
    typeof value === "number" && Number.isFinite(value) ? value : Number(value || 0);

  return Math.max(0, Number.isFinite(numericValue) ? numericValue : 0);
}

export type DomicileInsurancePrimesDeduction = {
  actuallyPaid: number;
  cantonalCap: number;
  federalCap: number;
  cantonalRetained: number;
  federalRetained: number;
};

type InsuranceDeductionCapOptions = {
  cantonalShortname?: string | null;
};

const DOMICILE_CANTONAL_CAP_OVERRIDES: Record<string, number> = {
  GE: 28000,
};

export function computeInsurancePrimesDeductionCap(
  dossier: DossierClient,
  options?: InsuranceDeductionCapOptions
) {
  const cantonalShortname = String(options?.cantonalShortname || "").trim().toUpperCase();
  const defaultCantonalCap = dossier.famille.aConjoint ? 6400 : 3200;

  return {
    federal: dossier.famille.aConjoint ? 5100 : 2550,
    cantonal: DOMICILE_CANTONAL_CAP_OVERRIDES[cantonalShortname] ?? defaultCantonalCap,
  };
}

export function resolveInsurancePrimesDeduction(
  actuallyPaid: number,
  applicableCap: number
) {
  return Math.min(toPositiveNumber(actuallyPaid), toPositiveNumber(applicableCap));
}

export function getDomicileInsurancePrimesDeduction(
  dossier: DossierClient,
  options?: InsuranceDeductionCapOptions
): DomicileInsurancePrimesDeduction {
  const actuallyPaid = toPositiveNumber(dossier.charges.primesMaladie);
  const caps = computeInsurancePrimesDeductionCap(dossier, options);

  return {
    actuallyPaid,
    cantonalCap: caps.cantonal,
    federalCap: caps.federal,
    cantonalRetained: resolveInsurancePrimesDeduction(actuallyPaid, caps.cantonal),
    federalRetained: resolveInsurancePrimesDeduction(actuallyPaid, caps.federal),
  };
}
