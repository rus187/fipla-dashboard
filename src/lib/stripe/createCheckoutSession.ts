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

function buildDefaultRedirectUrl(status: "success" | "cancel") {
  if (typeof window === "undefined") {
    return "";
  }

  const currentUrl = new URL(window.location.href);
  currentUrl.searchParams.set("stripe_checkout", status);
  return currentUrl.toString();
}

export async function createStripeCheckoutSession(
  params: CreateCheckoutSessionParams
): Promise<CreateCheckoutSessionResponse> {
  const payload = {
    plan_id: params.planId,
    profile_id: params.profileId,
    organization_id: params.organizationId ?? null,
    success_url: params.successUrl ?? buildDefaultRedirectUrl("success"),
    cancel_url: params.cancelUrl ?? buildDefaultRedirectUrl("cancel"),
  };

  console.info("[Stripe][checkout] creation demandee", payload);

  const response = await fetch("/api/stripe/create-checkout-session", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const responseBody = (await response.json().catch(() => null)) as
    | CreateCheckoutSessionResponse
    | { error?: string }
    | null;

  if (!response.ok) {
    const message =
      responseBody && "error" in responseBody && typeof responseBody.error === "string"
        ? responseBody.error
        : "Erreur lors de la creation de la session Stripe.";
    throw new Error(message);
  }

  console.info("[Stripe][checkout] session recue", responseBody);

  return responseBody as CreateCheckoutSessionResponse;
}
