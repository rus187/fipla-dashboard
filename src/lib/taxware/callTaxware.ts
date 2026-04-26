import { buildTaxwarePayload } from "./buildTaxwarePayload";
import { normalizeTaxwareResponse } from "./normalizeTaxwareResponse.ts";

type CallTaxwareParams = {
  realEstates?: Array<{
    taxableValue?: number;
    rentalIncome?: number;
    effectiveExpenses?: number;
  }>;
  zip: string;
  city: string;
  partnership: "Single" | "Marriage";
  childrenCount: number;

  netWages: number;
  pensionIncome?: number;
  hasOasiPensions?: boolean;
  otherIncome?: number;
  thirdPillar: number;
  lppBuyback: number;
  assetIncome?: number;
  miscIncome?: number;
  miscExpenses?: number;
  debtInterests?: number;

  spouseNetWages?: number;
  spousePensionIncome?: number;
  spouseHasOasiPensions?: boolean;
  spouseOtherIncome?: number;
  spouseThirdPillar?: number;
  spouseLppBuyback?: number;

  assets: number;
  debts: number;
};

const isDebugLogsEnabled =
  typeof import.meta !== "undefined" && Boolean(import.meta.env?.DEV);

export async function callTaxware(params: CallTaxwareParams) {
  if (isDebugLogsEnabled) {
    console.log("CALLTAXWARE VERSION NOUVELLE");
  }
  const payload = buildTaxwarePayload(params);

  if (isDebugLogsEnabled) {
    console.log("[TAXWARE] PAYLOAD ENVOYÉ =", JSON.stringify(payload, null, 2));
  }

  try {
    const response = await fetch("/api/taxware/simulate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const text = await response.text();

    let data: any = null;

    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { message: text || "Réponse non JSON reçue" };
    }

    const normalized = normalizeTaxwareResponse(data);

    if (isDebugLogsEnabled) {
      console.log("[TAXWARE] RÉPONSE BRUTE =", JSON.stringify(data, null, 2));
      console.log("[TAXWARE] NORMALISÉE =", normalized);
      console.log("[TAXWARE] TaxableIncomeCantonal brut =", data?.TaxableIncomeCanton || data?.IncomeTaxResult?.TaxableIncomeCanton);
      console.log("[TAXWARE] TaxableIncomeCantonal normalisé =", normalized?.taxableIncomeCantonal);
    }

    return {
      raw: data,
      normalized,
    };
  } catch (error) {
    return {
      raw: {
        message: error instanceof Error ? error.message : "Erreur inconnue",
      },
      normalized: normalizeTaxwareResponse(null),
    };
  }
}
