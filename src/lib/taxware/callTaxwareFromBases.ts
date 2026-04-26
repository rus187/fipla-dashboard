import {
  normalizeTaxwareV2Response,
  type TaxwareV2NormalizedResponse,
  type TaxwareV2Reliability,
} from "./normalizeTaxwareV2Response";

export type CallTaxwareFromBasesParams = {
  zip: string | number;
  city: string;
  year: number;
  partnership: "Single" | "Marriage";
  numChildren?: number;
  taxableIncomeFederal: number;
  taxableIncomeCanton: number;
  taxableAssets: number;
  basesSource: TaxwareV2Reliability["basesSource"];
};

export type CallTaxwareFromBasesResult = {
  raw: unknown;
  normalized: TaxwareV2NormalizedResponse;
};

const isDebugLogsEnabled =
  typeof import.meta !== "undefined" && Boolean(import.meta.env?.DEV);

export async function callTaxwareFromBases(
  params: CallTaxwareFromBasesParams
): Promise<CallTaxwareFromBasesResult> {
  const {
    zip,
    city,
    year,
    partnership,
    numChildren,
    taxableIncomeFederal,
    taxableIncomeCanton,
    taxableAssets,
    basesSource,
  } = params;

  const requestedBases = { taxableIncomeFederal, taxableIncomeCanton, taxableAssets };

  const payload = {
    zip: Number(zip),
    city,
    year,
    partnership,
    numChildren: typeof numChildren === "number" ? numChildren : 0,
    taxableIncomeFederal,
    taxableIncomeCanton,
    taxableAssets,
  };

  if (isDebugLogsEnabled) {
    console.log("[TAXWARE V2] callTaxwareFromBases — payload =", JSON.stringify(payload, null, 2));
  }

  try {
    const response = await fetch("/api/taxware/from-bases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const text = await response.text();
    let data: unknown = null;

    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { message: text || "Réponse non JSON reçue" };
    }

    if (isDebugLogsEnabled) {
      console.log("[TAXWARE V2] réponse brute =", JSON.stringify(data, null, 2));
    }

    const normalized = normalizeTaxwareV2Response(
      data as Record<string, unknown>,
      requestedBases,
      basesSource
    );

    if (isDebugLogsEnabled) {
      console.log("[TAXWARE V2] normalisé =", normalized);
    }

    return { raw: data, normalized };
  } catch (error) {
    const normalized = normalizeTaxwareV2Response(null, requestedBases, basesSource);
    return {
      raw: { message: error instanceof Error ? error.message : "Erreur inconnue" },
      normalized,
    };
  }
}
