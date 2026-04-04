import { supabaseClient } from "../supabase/client";

type CreatePricingCheckoutSessionParams = {
  planId: string;
  profileId: string;
  organizationId?: string | null;
  successUrl?: string;
  cancelUrl?: string;
};

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

function buildDefaultRedirectUrl(status: "success" | "cancel") {
  if (typeof window === "undefined") {
    return "";
  }

  const currentUrl = new URL(window.location.href);
  const isLocalhost =
    currentUrl.hostname === "localhost" ||
    currentUrl.hostname === "127.0.0.1" ||
    currentUrl.hostname === "[::1]";

  if (isLocalhost) {
    currentUrl.hostname = "127.0.0.1";
  }

  currentUrl.pathname = status === "success" ? "/checkout/success" : "/checkout/cancel";
  currentUrl.search = "";

  if (status === "success") {
    currentUrl.searchParams.set("session_id", "{CHECKOUT_SESSION_ID}");
  }

  return currentUrl.toString();
}

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
  params: CreatePricingCheckoutSessionParams
): Promise<CreatePricingCheckoutSessionResponse> {
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();
  const accessToken = session?.access_token ?? "";

  if (!params.profileId) {
    throw new Error("Profil utilisateur introuvable pour lancer le paiement.");
  }

  const endpoint = `${getStripeApiBaseUrl()}/api/stripe/create-checkout-session`;
  const payload = {
    plan_id: params.planId,
    profile_id: params.profileId,
    organization_id: params.organizationId ?? null,
    success_url: params.successUrl ?? buildDefaultRedirectUrl("success"),
    cancel_url: params.cancelUrl ?? buildDefaultRedirectUrl("cancel"),
  };

  let response: Response;

  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(payload),
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

  console.info("[Stripe][pricing] session recue", responseBody);

  return responseBody as CreatePricingCheckoutSessionResponse;
}
