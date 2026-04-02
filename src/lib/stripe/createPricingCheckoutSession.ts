import { supabaseClient } from "../supabase/client";

type CreatePricingCheckoutSessionResponse = {
  id: string;
  url: string | null;
  metadata?: {
    plan_id: string;
    profile_id: string;
    organization_id: string | null;
  };
};

type CreatePricingCheckoutSessionErrorResponse = {
  error?: string;
  details?: string;
  code?: string | null;
  type?: string | null;
};

function getStripeApiBaseUrl() {
  const configuredBaseUrl =
    typeof import.meta !== "undefined" && import.meta.env?.VITE_STRIPE_API_BASE_URL
      ? String(import.meta.env.VITE_STRIPE_API_BASE_URL).trim()
      : "";

  if (configuredBaseUrl) {
    return configuredBaseUrl.replace(/\/$/, "");
  }

  return "";
}

export async function createPricingCheckoutSession(
  planId: string
): Promise<CreatePricingCheckoutSessionResponse> {
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();
  const accessToken = session?.access_token ?? "";

  if (!accessToken) {
    throw new Error("Connexion requise pour lancer le paiement.");
  }

  const endpoint = `${getStripeApiBaseUrl()}/api/stripe/create-checkout-session`;

  let response: Response;

  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        plan_id: planId,
      }),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erreur réseau inconnue pendant la création Stripe.";
    throw new Error(`Impossible de contacter le backend Stripe (${endpoint}). ${message}`);
  }

  const responseText = await response.text();
  const responseBody = (() => {
    if (!responseText) {
      return null;
    }

    try {
      return JSON.parse(responseText) as
        | CreatePricingCheckoutSessionResponse
        | CreatePricingCheckoutSessionErrorResponse;
    } catch {
      return null;
    }
  })();

  if (!response.ok) {
    const responseError =
      responseBody && "error" in responseBody && typeof responseBody.error === "string"
        ? responseBody.error
        : null;
    const responseDetails =
      responseBody && "details" in responseBody && typeof responseBody.details === "string"
        ? responseBody.details
        : null;
    const messageParts = [responseError, responseDetails].filter(Boolean);
    const message =
      messageParts.length > 0
        ? messageParts.join(" ")
        : `Erreur lors de la création de la session Stripe. HTTP ${response.status} ${response.statusText} (${endpoint}).`;
    throw new Error(message);
  }

  return responseBody as CreatePricingCheckoutSessionResponse;
}
