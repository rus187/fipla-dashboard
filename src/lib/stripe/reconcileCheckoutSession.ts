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

type ReconcileCheckoutSessionResponse = {
  session_id: string;
  plan_name: string | null;
  mode: string | null;
  payment_status: string | null;
  simulation_credits: number;
  credit_granted: boolean;
  credit_status?: string | null;
  organization_id: string | null;
};

export async function reconcileCheckoutSession(
  accessToken: string,
  sessionId: string
): Promise<ReconcileCheckoutSessionResponse> {
  if (!accessToken) {
    throw new Error("Connexion requise pour reconciler le paiement Stripe.");
  }

  if (!sessionId) {
    throw new Error("session_id requis pour reconciler le paiement Stripe.");
  }

  const endpoint = `${getStripeApiBaseUrl()}/api/stripe/reconcile-checkout-session`;

  let response: Response;

  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        session_id: sessionId,
      }),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erreur reseau inconnue pendant la reconciliation Stripe.";
    throw new Error(`Impossible de contacter le backend Stripe (${endpoint}). ${message}`);
  }

  const responseText = await response.text();
  const responseBody = responseText
    ? (JSON.parse(responseText) as Partial<ReconcileCheckoutSessionResponse> & { error?: string })
    : null;

  if (!response.ok || !responseBody || typeof responseBody.simulation_credits !== "number") {
    throw new Error(
      responseBody?.error || "Impossible de reconciler le paiement Stripe."
    );
  }

  return {
    session_id: typeof responseBody.session_id === "string" ? responseBody.session_id : sessionId,
    plan_name: typeof responseBody.plan_name === "string" ? responseBody.plan_name : null,
    mode: typeof responseBody.mode === "string" ? responseBody.mode : null,
    payment_status: typeof responseBody.payment_status === "string" ? responseBody.payment_status : null,
    simulation_credits: responseBody.simulation_credits,
    credit_granted: Boolean(responseBody.credit_granted),
    organization_id:
      typeof responseBody.organization_id === "string" ? responseBody.organization_id : null,
  };
}
