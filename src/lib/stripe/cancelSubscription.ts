import type { StripeAccessStatusResponse } from "./fetchAccessStatus";

type CancelSubscriptionErrorResponse = {
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

export async function cancelStripeSubscription(
  accessToken: string
): Promise<StripeAccessStatusResponse> {
  if (!accessToken) {
    throw new Error("Connexion requise pour résilier l'abonnement.");
  }

  const endpoint = `${getStripeApiBaseUrl()}/api/stripe/cancel-subscription`;

  let response: Response;

  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Erreur réseau inconnue pendant la résiliation Stripe.";
    throw new Error(`Impossible de contacter le backend Stripe (${endpoint}). ${message}`);
  }

  const responseText = await response.text();
  const responseBody = (() => {
    if (!responseText) {
      return null;
    }

    try {
      return JSON.parse(responseText) as StripeAccessStatusResponse | CancelSubscriptionErrorResponse;
    } catch {
      return null;
    }
  })();

  if (!response.ok || !responseBody) {
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
        : "Impossible de résilier l'abonnement Stripe.";
    throw new Error(message);
  }

  return responseBody as StripeAccessStatusResponse;
}
