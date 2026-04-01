type CreateCheckoutSessionParams = {
  planId: string;
  profileId: string;
  organizationId?: string | null;
  successUrl?: string;
  cancelUrl?: string;
};

type CreateCheckoutSessionResponse = {
  id: string;
  url: string | null;
  metadata?: {
    plan_id: string;
    profile_id: string;
    organization_id: string;
  };
};

type CreateCheckoutSessionErrorResponse = {
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

  // Stripe returns to the exact URL we provide. Normalizing local dev
  // redirects to 127.0.0.1 avoids browser-specific localhost/IPv6
  // resolution issues that can surface as ERR_CONNECTION_REFUSED.
  if (isLocalhost) {
    currentUrl.hostname = "127.0.0.1";
  }

  currentUrl.searchParams.set("stripe_checkout", status);

  if (status === "success") {
    currentUrl.searchParams.set("session_id", "{CHECKOUT_SESSION_ID}");
  } else {
    currentUrl.searchParams.delete("session_id");
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

  // By default, use the current origin so Vite can proxy `/api/stripe` in dev
  // and production deployments can keep same-origin routing.
  return "";
}

export async function createStripeCheckoutSession(
  params: CreateCheckoutSessionParams
): Promise<CreateCheckoutSessionResponse> {
  const stripeApiBaseUrl = getStripeApiBaseUrl();
  const endpoint = `${stripeApiBaseUrl}/api/stripe/create-checkout-session`;
  const payload = {
    plan_id: params.planId,
    profile_id: params.profileId,
    organization_id: params.organizationId ?? null,
    success_url: params.successUrl ?? buildDefaultRedirectUrl("success"),
    cancel_url: params.cancelUrl ?? buildDefaultRedirectUrl("cancel"),
  };

  console.info("[Stripe][checkout] creation demandee", {
    endpoint,
    payload,
  });

  let response: Response;

  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erreur reseau inconnue pendant la creation Stripe.";
    throw new Error(`Impossible de contacter le backend Stripe (${endpoint}). ${message}`);
  }

  const responseText = await response.text();
  const responseBody = (() => {
    if (!responseText) {
      return null;
    }

    try {
      return JSON.parse(responseText) as
        | CreateCheckoutSessionResponse
        | CreateCheckoutSessionErrorResponse;
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
        : `Erreur lors de la creation de la session Stripe. HTTP ${response.status} ${response.statusText} (${endpoint}).`;
    throw new Error(message);
  }

  console.info("[Stripe][checkout] session recue", responseBody);

  return responseBody as CreateCheckoutSessionResponse;
}
