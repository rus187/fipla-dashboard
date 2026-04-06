export type StripeAccessStatusResponse = {
  has_paid_access: boolean;
  source: string | null;
  simulation_credits: number;
  profile_id: string | null;
  organization_id: string | null;
  billing_plan: string | null;
  billing_status: string | null;
  billing_current_period_end: string | null;
  billing_cancel_at_period_end: boolean;
  subscription_status: string | null;
  stripe_subscription_id: string | null;
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

export async function fetchStripeAccessStatus(
  accessToken: string
): Promise<StripeAccessStatusResponse> {
  if (!accessToken) {
    throw new Error("Connexion requise pour vérifier le statut d'accès.");
  }

  const endpoint = `${getStripeApiBaseUrl()}/api/stripe/access-status`;

  let response: Response;

  try {
    response = await fetch(endpoint, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erreur réseau inconnue pendant la lecture d'accès.";
    throw new Error(`Impossible de contacter le backend Stripe (${endpoint}). ${message}`);
  }

  const responseText = await response.text();
  const responseBody = responseText ? (JSON.parse(responseText) as StripeAccessStatusResponse) : null;

  if (!response.ok || !responseBody) {
    throw new Error("Impossible de lire le statut d'accès premium.");
  }

  return responseBody;
}
