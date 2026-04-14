import { buildTaxwarePayload } from "./buildTaxwarePayload";
import { normalizeTaxwareResponse } from "./normalizeTaxwareResponse.ts";
import { adaptDomicileTaxCityV2Response } from "./domicileTaxCityV2.ts";
import {
  readInternalPayloadDebug,
  stripInternalPayloadDebug,
} from "./domicilePayloadDebug";

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

export async function callTaxware(params: CallTaxwareParams) {
  const payload = buildTaxwarePayload(params);
  return postTaxwarePayload("/api/taxware/simulate", payload, "callTaxware");
}

export async function callTaxwareFromMunicipality(payload: Record<string, unknown>) {
  return postTaxwarePayload(
    "/api/taxware/simulate-from-municipality",
    payload,
    "callTaxwareFromMunicipality"
  );
}

export async function callTaxwareDomicileFromCityV2(payload: Record<string, unknown>) {
  return postTaxwarePayload(
    "/api/taxware/domicile-from-city-v2",
    payload,
    "callTaxwareDomicileFromCityV2",
    adaptDomicileTaxCityV2Response
  );
}

async function postTaxwarePayload(
  endpoint: string,
  payload: Record<string, unknown>,
  logLabel: string,
  normalizeResponse: (
    data: Record<string, unknown> | null | undefined,
    requestPayload: Record<string, unknown>
  ) => any = normalizeTaxwareResponse
) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 20000);
  const internalDebug = readInternalPayloadDebug(payload);
  const requestPayload = stripInternalPayloadDebug(payload);

  try {
    console.log(`[${logLabel}] PAYLOAD ENVOYE =`, JSON.stringify(requestPayload, null, 2));
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestPayload),
      signal: controller.signal,
    });

    const text = await response.text();

    let data: any = null;

    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { message: text || "Réponse non JSON reçue" };
    }

    const normalized = normalizeResponse(
      data && typeof data === "object" ? (data as Record<string, unknown>) : null,
      requestPayload
    );

    console.log(`[${logLabel}] DATA RECUE =`, data);
    console.log(`[${logLabel}] DATA RECUE JSON =`, JSON.stringify(data, null, 2));
    console.log(`[${logLabel}] NORMALIZED PRODUIT =`, normalized);
    if (endpoint.includes("/api/taxware/")) {
      console.info("[DOMICILE][PIPELINE]", {
        endpoint,
        insurancePrimes: internalDebug,
        payloadSent: requestPayload,
        rawResponse: data,
        normalizedResponse: normalized,
      });
    }

    return {
      raw: data,
      normalized,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erreur inconnue lors de l'appel TaxWare";
    console.error(`[${logLabel}] ERREUR =`, message);
    return {
      raw: {
        error: message,
        message,
      },
      normalized: normalizeResponse(null, requestPayload),
    };
  } finally {
    window.clearTimeout(timeoutId);
  }
}
