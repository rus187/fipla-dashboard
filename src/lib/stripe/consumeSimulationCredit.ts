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

type ConsumeSimulationCreditResponse = {
  simulation_credits: number;
  organization_id: string | null;
};

export async function consumeSimulationCredit(
  accessToken: string
): Promise<ConsumeSimulationCreditResponse> {
  if (!accessToken) {
    throw new Error("Connexion requise pour consommer un credit de simulation.");
  }

  const endpoint = `${getStripeApiBaseUrl()}/api/stripe/consume-simulation-credit`;

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
      error instanceof Error ? error.message : "Erreur reseau inconnue pendant la consommation du credit.";
    throw new Error(`Impossible de contacter le backend Stripe (${endpoint}). ${message}`);
  }

  const responseText = await response.text();
  const responseBody = responseText
    ? (JSON.parse(responseText) as Partial<ConsumeSimulationCreditResponse> & { error?: string })
    : null;

  if (!response.ok || !responseBody || typeof responseBody.simulation_credits !== "number") {
    throw new Error(
      responseBody?.error || "Impossible de consommer le credit de simulation."
    );
  }

  return {
    simulation_credits: responseBody.simulation_credits,
    organization_id:
      typeof responseBody.organization_id === "string" ? responseBody.organization_id : null,
  };
}
