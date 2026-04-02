import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { calculateTaxware } from "./taxwareProxy.js";

dotenv.config({ path: './src/server/.env' });

const { stripe, supabase } = await import("./stripe/stripeClient.js");

const app = express();

app.use(cors());
const jsonParser = express.json();
app.use((req, res, next) => {
  const isStripeWebhookRequest =
    /^\/api\/stripe\/webhook\/?$/.test(req.path) ||
    /^\/api\/stripe\/webhook\/?(?:\?|$)/.test(req.originalUrl ?? "");

  if (isStripeWebhookRequest) {
    return next();
  }

  return jsonParser(req, res, next);
});

const formatStripeTimestamp = (value) =>
  value ? new Date(value * 1000).toISOString() : null;

const stripeSecretKey = process.env.STRIPE_SECRET_KEY ?? "";
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? "";
const HOST = process.env.HOST?.trim() || "127.0.0.1";
const DEFAULT_PORT = Number(process.env.PORT ?? "3000");
const FALLBACK_PORT = process.env.PORT ? null : 3002;

let activePort = null;

const getPublicHost = () => (HOST === "0.0.0.0" || HOST === "::" ? "localhost" : HOST);
const getServerBaseUrl = () => `http://${getPublicHost()}:${activePort ?? DEFAULT_PORT}`;
const getStripeWebhookUrl = () => `${getServerBaseUrl()}/api/stripe/webhook`;

const inferStripeModeFromSecretKey = (secretKey) => {
  if (secretKey.startsWith("sk_test_")) {
    return "test";
  }

  if (secretKey.startsWith("sk_live_")) {
    return "live";
  }

  return "unknown";
};

const normalizeOptionalString = (value) => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
};

const normalizeLoopbackHost = (url) => {
  if (url.hostname === "localhost") {
    url.hostname = "127.0.0.1";
  }

  return url;
};

const buildDefaultCheckoutRedirectUrl = (req, status) => {
  const candidates = [
    normalizeOptionalString(req.get("referer")),
    normalizeOptionalString(req.get("origin")),
    getServerBaseUrl(),
  ];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    try {
      const url = normalizeLoopbackHost(new URL(candidate));
      url.pathname = status === "success" ? "/checkout/success" : "/checkout/cancel";
      url.search = "";

      if (status === "success") {
        url.searchParams.set("session_id", "{CHECKOUT_SESSION_ID}");
      }

      return url.toString();
    } catch (_error) {
      continue;
    }
  }

  return null;
};

async function resolveProfileFromAuthorizationHeader(req) {
  const authorizationHeader = normalizeOptionalString(req.get("authorization"));
  const bearerToken = authorizationHeader?.match(/^Bearer\s+(.+)$/i)?.[1] ?? null;
  const normalizedToken = normalizeOptionalString(bearerToken);

  if (!normalizedToken) {
    return { profile: null, error: null };
  }

  const { data: authData, error: authError } = await supabase.auth.getUser(normalizedToken);

  if (authError || !authData?.user) {
    return {
      profile: null,
      error: authError ?? new Error("Utilisateur introuvable a partir du token d'authentification."),
    };
  }

  const authenticatedUserId = normalizeOptionalString(authData.user.id);

  if (authenticatedUserId && isUuid(authenticatedUserId)) {
    const { data: profileById, error: profileByIdError } = await getProfileById(authenticatedUserId);

    if (profileByIdError) {
      return {
        profile: null,
        error: profileByIdError,
      };
    }

    if (profileById) {
      return {
        profile: profileById,
        error: null,
      };
    }
  }

  const authenticatedEmail = normalizeOptionalString(authData.user.email)?.toLowerCase() ?? null;

  if (!authenticatedEmail) {
    return {
      profile: null,
      error: new Error("Aucun profile exploitable n'a pu etre resolu depuis le token."),
    };
  }

  const { data: profileByEmail, error: profileByEmailError } = await getProfileByEmail(authenticatedEmail);

  return {
    profile: profileByEmail ?? null,
    error: profileByEmailError ?? null,
  };
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isUuid = (value) => typeof value === "string" && uuidPattern.test(value);

const resolveStripeMetadata = ({ sessionMetadata, subscriptionMetadata }) => ({
  profile_id:
    normalizeOptionalString(subscriptionMetadata?.profile_id) ??
    normalizeOptionalString(sessionMetadata?.profile_id),
  organization_id:
    normalizeOptionalString(subscriptionMetadata?.organization_id) ??
    normalizeOptionalString(sessionMetadata?.organization_id),
  plan_id:
    normalizeOptionalString(subscriptionMetadata?.plan_id) ??
    normalizeOptionalString(sessionMetadata?.plan_id),
});

const allowedSubscriptionStatuses = new Set([
  "active",
  "trialing",
  "past_due",
  "canceled",
  "incomplete",
  "incomplete_expired",
  "unpaid",
]);

const getStripeCustomerId = (value) => {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    return normalizeOptionalString(value);
  }

  return normalizeOptionalString(value.id);
};

const getStripePriceId = (value) => {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    return normalizeOptionalString(value);
  }

  return normalizeOptionalString(value.id);
};

const getStripePriceInterval = (value) => {
  if (!value || typeof value === "string") {
    return null;
  }

  return normalizeOptionalString(value.recurring?.interval);
};

const normalizeBillingCycle = (value) => {
  const normalizedValue = normalizeOptionalString(value);

  if (!normalizedValue) {
    return null;
  }

  if (normalizedValue === "month" || normalizedValue === "monthly") {
    return "monthly";
  }

  if (normalizedValue === "year" || normalizedValue === "yearly") {
    return "yearly";
  }

  if (normalizedValue === "one_time" || normalizedValue === "one-time") {
    return "one_time";
  }

  return normalizedValue;
};

function resolveStripeCheckoutPricing(plan) {
  const monthlyPriceId = normalizeOptionalString(plan?.stripe_price_id_monthly);
  const fallbackPriceId = normalizeOptionalString(plan?.stripe_price_id);

  if (monthlyPriceId) {
    return {
      priceId: monthlyPriceId,
      checkoutMode: "subscription",
      paymentType: "monthly",
      sourceColumn: "stripe_price_id_monthly",
    };
  }

  if (fallbackPriceId) {
    return {
      priceId: fallbackPriceId,
      checkoutMode: "payment",
      paymentType: "one_time",
      sourceColumn: "stripe_price_id",
    };
  }

  return {
    priceId: null,
    checkoutMode: null,
    paymentType: null,
    sourceColumn: null,
  };
}

const getSubscriptionPrimaryItem = (subscription) => subscription?.items?.data?.[0] ?? null;

const normalizeSubscriptionStatus = (status) => {
  const normalizedStatus = normalizeOptionalString(status);

  if (normalizedStatus && allowedSubscriptionStatuses.has(normalizedStatus)) {
    return normalizedStatus;
  }

  return "active";
};

const deriveOrganizationBillingPlan = (plan) => {
  const planName = normalizeOptionalString(plan?.name)?.toLowerCase() ?? null;

  if (!planName) {
    return null;
  }

  if (planName === "fipla_pro_solo") {
    return "pro";
  }

  if (planName === "fipla_private_full") {
    return "private_full";
  }

  if (planName === "fipla_private_mini") {
    return "private_mini";
  }

  return planName;
};

const buildSubscriptionSnapshotFields = ({
  subscription,
  planId,
  stripeCustomerId,
  billingCycle,
}) => {
  const primaryItem = getSubscriptionPrimaryItem(subscription);
  const subscriptionPrice = primaryItem?.price ?? null;

  return {
    plan_id: planId || null,
    status: normalizeSubscriptionStatus(subscription.status),
    stripe_subscription_id: subscription.id,
    stripe_customer_id: stripeCustomerId ?? getStripeCustomerId(subscription.customer),
    current_period_start: formatStripeTimestamp(subscription.current_period_start),
    current_period_end: formatStripeTimestamp(subscription.current_period_end),
    cancel_at_period_end: subscription.cancel_at_period_end ?? false,
    billing_cycle: normalizeBillingCycle(
      billingCycle ?? getStripePriceInterval(subscriptionPrice)
    ),
  };
};

const buildSubscriptionPayload = ({
  subscription,
  organizationId,
  planId,
  stripeCustomerId,
  billingCycle,
}) => ({
  org_id: organizationId,
  ...buildSubscriptionSnapshotFields({
    subscription,
    planId,
    stripeCustomerId,
    billingCycle,
  }),
});

const buildOrganizationBillingSnapshot = ({
  subscription,
  plan,
  stripeCustomerId,
  stripePriceId,
}) => ({
  stripe_customer_id: stripeCustomerId ?? getStripeCustomerId(subscription.customer),
  stripe_subscription_id: subscription.id,
  stripe_price_id: stripePriceId ?? getStripePriceId(getSubscriptionPrimaryItem(subscription)?.price),
  billing_status: normalizeSubscriptionStatus(subscription.status),
  billing_plan: deriveOrganizationBillingPlan(plan),
  billing_current_period_end: formatStripeTimestamp(subscription.current_period_end),
  billing_cancel_at_period_end: subscription.cancel_at_period_end ?? false,
  billing_updated_at: new Date().toISOString(),
  payment_issue: ["past_due", "unpaid", "incomplete", "incomplete_expired"].includes(
    normalizeSubscriptionStatus(subscription.status)
  ),
});

const preserveExistingSubscriptionSnapshot = (nextPayload, existingRow) => {
  if (!existingRow) {
    return nextPayload;
  }

  const preservedPayload = { ...nextPayload };

  for (const field of ["current_period_start", "current_period_end", "billing_cycle"]) {
    if ((preservedPayload[field] === null || preservedPayload[field] === undefined) && existingRow[field]) {
      delete preservedPayload[field];
    }
  }

  return preservedPayload;
};

const preserveExistingOrganizationSnapshot = (nextPayload, organization) => {
  if (!organization) {
    return nextPayload;
  }

  const preservedPayload = { ...nextPayload };

  if (
    (preservedPayload.billing_current_period_end === null ||
      preservedPayload.billing_current_period_end === undefined) &&
    organization.billing_current_period_end
  ) {
    delete preservedPayload.billing_current_period_end;
  }

  return preservedPayload;
};

async function logStripeStartupDiagnostics() {
  const inferredMode = inferStripeModeFromSecretKey(stripeSecretKey);

  try {
    const account = await stripe.accounts.retrieve();

    console.info("[stripe:startup] backend Stripe configuration", {
      accountId: account.id,
      accountName: account.business_profile?.name ?? account.settings?.dashboard?.display_name ?? null,
      livemode: account.livemode,
      inferredMode,
      webhookRoute: getStripeWebhookUrl(),
      webhookSecretConfigured: Boolean(stripeWebhookSecret),
      secretKeyPrefix: stripeSecretKey.slice(0, 8),
    });
  } catch (error) {
    console.error("[stripe:startup] unable to retrieve Stripe account diagnostics", {
      inferredMode,
      webhookRoute: getStripeWebhookUrl(),
      webhookSecretConfigured: Boolean(stripeWebhookSecret),
      secretKeyPrefix: stripeSecretKey.slice(0, 8),
      error,
    });
  }
}

async function getStripeAccountDiagnostics() {
  try {
    const account = await stripe.accounts.retrieve();

    return {
      ok: true,
      accountId: account.id,
      accountName:
        account.business_profile?.name ?? account.settings?.dashboard?.display_name ?? null,
      livemode: account.livemode,
      inferredMode: inferStripeModeFromSecretKey(stripeSecretKey),
      secretKeyPrefix: stripeSecretKey.slice(0, 12),
    };
  } catch (error) {
    return {
      ok: false,
      inferredMode: inferStripeModeFromSecretKey(stripeSecretKey),
      secretKeyPrefix: stripeSecretKey.slice(0, 12),
      error: serializeOperationalError(error),
    };
  }
}

async function getProfileById(profileId) {
  return supabase
    .from("profiles")
    .select("*")
    .eq("id", profileId)
    .maybeSingle();
}

async function getOrganizationById(organizationId) {
  return supabase
    .from("organizations")
    .select("*")
    .eq("id", organizationId)
    .maybeSingle();
}

async function getOwnedOrganization(profileId) {
  return supabase
    .from("organizations")
    .select("*")
    .eq("owner_id", profileId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
}

async function getProfileByEmail(email) {
  return supabase
    .from("profiles")
    .select("*")
    .ilike("email", email)
    .maybeSingle();
}

async function getProfileByStripeCustomerId(stripeCustomerId) {
  return supabase
    .from("profiles")
    .select("*")
    .eq("stripe_customer_id", stripeCustomerId)
    .maybeSingle();
}

async function getOrganizationByStripeCustomerId(stripeCustomerId) {
  return supabase
    .from("organizations")
    .select("*")
    .eq("stripe_customer_id", stripeCustomerId)
    .maybeSingle();
}

async function getPlanById(planId) {
  return supabase
    .from("plans")
    .select("*")
    .eq("id", planId)
    .maybeSingle();
}

async function getPlanByStripePriceId(stripePriceId) {
  return supabase
    .from("plans")
    .select("*")
    .or(
      `stripe_price_id.eq.${stripePriceId},stripe_price_id_monthly.eq.${stripePriceId},stripe_price_id_yearly.eq.${stripePriceId}`
    )
    .maybeSingle();
}

async function getSubscriptionRowByStripeSubscriptionId(stripeSubscriptionId) {
  return supabase
    .from("subscriptions")
    .select("*")
    .eq("stripe_subscription_id", stripeSubscriptionId)
    .maybeSingle();
}

async function getLatestLegacySubscriptionCandidate(organizationId) {
  return supabase
    .from("subscriptions")
    .select("*")
    .eq("org_id", organizationId)
    .is("stripe_subscription_id", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
}

async function createPersonalOrganization(profile) {
  const organizationName = profile.email
    ? `Espace personnel ${profile.email}`
    : `Espace personnel ${profile.id.slice(0, 8)}`;

  return supabase
    .from("organizations")
    .insert({
      name: organizationName,
      owner_id: profile.id,
    })
    .select("id, owner_id, name")
    .single();
}

async function syncStripeCustomerReferences({ profile, organization, stripeCustomerId }) {
  const normalizedStripeCustomerId = normalizeOptionalString(stripeCustomerId);

  if (!normalizedStripeCustomerId) {
    return;
  }

  if (profile?.id && profile.stripe_customer_id !== normalizedStripeCustomerId) {
    const { error } = await supabase
      .from("profiles")
      .update({ stripe_customer_id: normalizedStripeCustomerId })
      .eq("id", profile.id);

    if (error) {
      console.error("[stripe:webhook] profile customer sync failed", {
        profileId: profile.id,
        stripeCustomerId: normalizedStripeCustomerId,
        error,
      });
    }
  }

  if (organization?.id && organization.stripe_customer_id !== normalizedStripeCustomerId) {
    const { error } = await supabase
      .from("organizations")
      .update({ stripe_customer_id: normalizedStripeCustomerId })
      .eq("id", organization.id);

    if (error) {
      console.error("[stripe:webhook] organization customer sync failed", {
        organizationId: organization.id,
        stripeCustomerId: normalizedStripeCustomerId,
        error,
      });
    }
  }
}

async function resolveCheckoutOrganization({ profile, requestedOrganizationId }) {
  const normalizedOrganizationId = normalizeOptionalString(requestedOrganizationId);

  if (normalizedOrganizationId) {
    const { data: organization, error } = await getOrganizationById(normalizedOrganizationId);

    if (error) {
      console.error("[stripe:checkout] organization lookup failed", {
        organizationId: normalizedOrganizationId,
        error,
      });
      throw error;
    }

    if (organization) {
      console.info("[stripe:checkout] using provided organization", {
        profileId: profile.id,
        organizationId: organization.id,
        ownerId: organization.owner_id,
      });
      return organization.id;
    }
  }

  const { data: existingOrganization, error: existingOrganizationError } =
    await getOwnedOrganization(profile.id);

  if (existingOrganizationError) {
    console.error("[stripe:checkout] owned organization lookup failed", {
      profileId: profile.id,
      error: existingOrganizationError,
    });
    throw existingOrganizationError;
  }

  if (existingOrganization) {
    console.info("[stripe:checkout] using owned organization", {
      profileId: profile.id,
      organizationId: existingOrganization.id,
      ownerId: existingOrganization.owner_id,
    });
    return existingOrganization.id;
  }

  const { data: createdOrganization, error: createOrganizationError } =
    await createPersonalOrganization(profile);

  if (createOrganizationError) {
    console.error("[stripe:checkout] personal organization creation failed", {
      profileId: profile.id,
      error: createOrganizationError,
    });
    throw createOrganizationError;
  }

  console.info("[stripe:checkout] personal organization created", {
    profileId: profile.id,
    organizationId: createdOrganization.id,
    ownerId: createdOrganization.owner_id,
  });

  return createdOrganization.id;
}

async function resolvePlanForStripeContext({ metadata, stripePriceId }) {
  const metadataPlanId = normalizeOptionalString(metadata?.plan_id);
  const normalizedStripePriceId = normalizeOptionalString(stripePriceId);
  let metadataPlan = null;
  let priceResolvedPlan = null;

  if (metadataPlanId && isUuid(metadataPlanId)) {
    const { data: plan, error } = await getPlanById(metadataPlanId);

    if (error) {
      console.error("[stripe:webhook] plan lookup by metadata failed", {
        planId: metadataPlanId,
        error,
      });
    } else if (plan) {
      metadataPlan = plan;
    }
  }

  if (normalizedStripePriceId) {
    const { data: plan, error } = await getPlanByStripePriceId(normalizedStripePriceId);

    if (error) {
      console.error("[stripe:webhook] plan lookup by stripe_price_id failed", {
        stripePriceId: normalizedStripePriceId,
        error,
      });
    } else if (plan) {
      priceResolvedPlan = plan;
      console.info("[stripe:webhook] resolved plan from price", {
        stripePriceId: normalizedStripePriceId,
        resolvedPlanId: plan.id,
        resolvedPlanName: plan.name ?? null,
      });
    }
  }

  if (metadataPlan && priceResolvedPlan && metadataPlan.id !== priceResolvedPlan.id) {
    console.warn("[stripe:webhook] resolved plan from price overrides metadata plan", {
      metadataPlanId: metadataPlan.id,
      metadataPlanName: metadataPlan.name ?? null,
      stripePriceId: normalizedStripePriceId,
      priceResolvedPlanId: priceResolvedPlan.id,
      priceResolvedPlanName: priceResolvedPlan.name ?? null,
    });
    return priceResolvedPlan;
  }

  return priceResolvedPlan ?? metadataPlan ?? null;
}

async function findUserByStripeContext({ metadata, stripeCustomerId, customerEmail }) {
  const normalizedStripeCustomerId = normalizeOptionalString(stripeCustomerId);
  const normalizedCustomerEmail = normalizeOptionalString(customerEmail)?.toLowerCase() ?? null;

  console.info("[stripe:webhook] user lookup", {
    profileId: metadata?.profile_id ?? null,
    organizationId: metadata?.organization_id ?? null,
    stripeCustomerId: normalizedStripeCustomerId,
    customerEmail: normalizedCustomerEmail,
  });

  let profile = null;
  let organization = null;
  const matchedBy = [];

  if (metadata?.profile_id && isUuid(metadata.profile_id)) {
    const { data, error } = await getProfileById(metadata.profile_id);

    if (error) {
      console.error("[stripe:webhook] profile lookup by metadata failed", {
        profileId: metadata.profile_id,
        error,
      });
    } else if (data) {
      profile = data;
      matchedBy.push("metadata.profile_id");
    }
  }

  if (metadata?.organization_id && isUuid(metadata.organization_id)) {
    const { data, error } = await getOrganizationById(metadata.organization_id);

    if (error) {
      console.error("[stripe:webhook] organization lookup by metadata failed", {
        organizationId: metadata.organization_id,
        error,
      });
    } else if (data) {
      organization = data;
      matchedBy.push("metadata.organization_id");
    }
  }

  if (!profile && normalizedStripeCustomerId) {
    const { data, error } = await getProfileByStripeCustomerId(normalizedStripeCustomerId);

    if (error) {
      console.error("[stripe:webhook] profile lookup by stripe_customer_id failed", {
        stripeCustomerId: normalizedStripeCustomerId,
        error,
      });
    } else if (data) {
      profile = data;
      matchedBy.push("profiles.stripe_customer_id");
    }
  }

  if (!organization && normalizedStripeCustomerId) {
    const { data, error } = await getOrganizationByStripeCustomerId(normalizedStripeCustomerId);

    if (error) {
      console.error("[stripe:webhook] organization lookup by stripe_customer_id failed", {
        stripeCustomerId: normalizedStripeCustomerId,
        error,
      });
    } else if (data) {
      organization = data;
      matchedBy.push("organizations.stripe_customer_id");
    }
  }

  if (!profile && normalizedCustomerEmail) {
    const { data, error } = await getProfileByEmail(normalizedCustomerEmail);

    if (error) {
      console.error("[stripe:webhook] profile lookup by email failed", {
        customerEmail: normalizedCustomerEmail,
        error,
      });
    } else if (data) {
      profile = data;
      matchedBy.push("profiles.email");
    }
  }

  if (!profile && organization?.owner_id) {
    const { data, error } = await getProfileById(organization.owner_id);

    if (error) {
      console.error("[stripe:webhook] profile lookup by organization owner failed", {
        ownerId: organization.owner_id,
        organizationId: organization.id,
        error,
      });
    } else if (data) {
      profile = data;
      matchedBy.push("organizations.owner_id");
    }
  }

  if (profile && !organization) {
    try {
      const resolvedOrganizationId = await resolveCheckoutOrganization({
        profile,
        requestedOrganizationId:
          metadata?.organization_id && isUuid(metadata.organization_id)
            ? metadata.organization_id
            : null,
      });
      const { data, error } = await getOrganizationById(resolvedOrganizationId);

      if (error) {
        console.error("[stripe:webhook] organization resolution lookup failed", {
          resolvedOrganizationId,
          profileId: profile.id,
          error,
        });
      } else if (data) {
        organization = data;
        matchedBy.push(
          metadata?.organization_id ? "resolveCheckoutOrganization(metadata)" : "resolveCheckoutOrganization(profile)"
        );
      }
    } catch (error) {
      console.error("[stripe:webhook] organization resolution failed", {
        profileId: profile.id,
        requestedOrganizationId: metadata?.organization_id ?? null,
        error: serializeOperationalError(error),
      });
    }
  }

  return {
    profile,
    organization,
    matchedBy,
  };
}

async function loadCheckoutSessionContext(checkoutSession) {
  const sessionId = normalizeOptionalString(checkoutSession?.id);
  let hydratedSession = checkoutSession;
  let lineItems = [];

  if (sessionId) {
    try {
      hydratedSession = await stripe.checkout.sessions.retrieve(sessionId);
    } catch (error) {
      console.error("[stripe:webhook] checkout session reload failed", {
        sessionId,
        error: serializeOperationalError(error),
      });
    }

    try {
      const lineItemsResponse = await stripe.checkout.sessions.listLineItems(sessionId, {
        limit: 10,
        expand: ["data.price"],
      });
      lineItems = lineItemsResponse.data ?? [];
    } catch (error) {
      console.error("[stripe:webhook] checkout line items reload failed", {
        sessionId,
        error: serializeOperationalError(error),
      });
    }
  }

  const subscriptionId =
    normalizeOptionalString(
      typeof hydratedSession?.subscription === "string"
        ? hydratedSession.subscription
        : hydratedSession?.subscription?.id
    ) ??
    normalizeOptionalString(
      typeof checkoutSession?.subscription === "string"
        ? checkoutSession.subscription
        : checkoutSession?.subscription?.id
    );

  let subscription =
    hydratedSession?.subscription && typeof hydratedSession.subscription === "object"
      ? hydratedSession.subscription
      : null;

  if (!subscription && subscriptionId) {
    try {
      subscription = await stripe.subscriptions.retrieve(subscriptionId, {
        expand: ["items.data.price"],
      });
    } catch (error) {
      console.error("[stripe:webhook] subscription reload failed", {
        sessionId,
        subscriptionId,
        error: serializeOperationalError(error),
      });
    }
  }

  const primaryLineItem = lineItems[0] ?? null;
  const primarySubscriptionItem = getSubscriptionPrimaryItem(subscription);
  const stripePriceId =
    getStripePriceId(primaryLineItem?.price) ?? getStripePriceId(primarySubscriptionItem?.price);
  const billingCycle =
    getStripePriceInterval(primaryLineItem?.price) ??
    getStripePriceInterval(primarySubscriptionItem?.price);
  const stripeCustomerId =
    getStripeCustomerId(hydratedSession?.customer) ??
    getStripeCustomerId(checkoutSession?.customer) ??
    getStripeCustomerId(subscription?.customer);
  const customerEmail =
    normalizeOptionalString(hydratedSession?.customer_details?.email) ??
    normalizeOptionalString(hydratedSession?.customer_email) ??
    normalizeOptionalString(checkoutSession?.customer_details?.email) ??
    normalizeOptionalString(checkoutSession?.customer_email);
  const metadata = resolveStripeMetadata({
    sessionMetadata: hydratedSession?.metadata ?? checkoutSession?.metadata,
    subscriptionMetadata: subscription?.metadata ?? null,
  });

  return {
    session: hydratedSession,
    sessionId,
    subscription,
    subscriptionId,
    stripePriceId,
    billingCycle,
    stripeCustomerId,
    customerEmail,
    metadata,
  };
}

async function upsertStripeSubscriptionInSupabase({
  subscription,
  profile,
  organization,
  plan,
  stripeCustomerId,
  stripeCheckoutSessionId,
  stripePriceId,
  customerEmail,
  billingCycle,
  source,
  checkoutMode,
  checkoutPaymentStatus,
}) {
  const subscriptionPayload = buildSubscriptionPayload({
    subscription,
    organizationId: organization.id,
    planId: plan?.id ?? null,
    stripeCustomerId,
    billingCycle,
  });

  console.info("[stripe:webhook] subscriptions upsert input", {
    eventSource: source,
    eventMode: checkoutMode,
    eventPaymentStatus: checkoutPaymentStatus,
    stripeCheckoutSessionId,
    stripeSubscriptionId: subscription.id,
    profileId: profile?.id ?? null,
    organizationId: organization.id,
    planId: plan?.id ?? null,
    stripePriceId,
    customerEmail,
    payload: subscriptionPayload,
  });

  const { data: existingSubscriptionRow, error: existingSubscriptionError } =
    await getSubscriptionRowByStripeSubscriptionId(subscription.id);

  if (existingSubscriptionError) {
    console.error("[stripe:webhook] subscriptions upsert failed", {
      stripeSubscriptionId: subscription.id,
      organizationId: organization.id,
      error: existingSubscriptionError,
      payload: subscriptionPayload,
    });
    return null;
  }

  let legacyCandidate = null;

  if (!existingSubscriptionRow) {
    const { data: legacyRow, error: legacyError } = await getLatestLegacySubscriptionCandidate(
      organization.id
    );

    if (legacyError) {
      console.error("[stripe:webhook] subscriptions upsert failed", {
        stripeSubscriptionId: subscription.id,
        organizationId: organization.id,
        error: legacyError,
        payload: subscriptionPayload,
      });
      return null;
    }

    legacyCandidate = legacyRow ?? null;
  }

  const subscriptionPayloadWithPreservedFields = preserveExistingSubscriptionSnapshot(
    subscriptionPayload,
    existingSubscriptionRow ?? legacyCandidate
  );

  if (legacyCandidate) {
    console.warn("[stripe:webhook] organizations/subscriptions divergence", {
      organizationId: organization.id,
      legacySubscriptionRow: {
        id: legacyCandidate.id,
        org_id: legacyCandidate.org_id ?? null,
        plan_id: legacyCandidate.plan_id ?? null,
        status: legacyCandidate.status ?? null,
        stripe_subscription_id: legacyCandidate.stripe_subscription_id ?? null,
        stripe_customer_id: legacyCandidate.stripe_customer_id ?? null,
        current_period_start: legacyCandidate.current_period_start ?? null,
        current_period_end: legacyCandidate.current_period_end ?? null,
        billing_cycle: legacyCandidate.billing_cycle ?? null,
      },
      intendedSubscription: subscriptionPayload,
    });
  }

  const mutation = existingSubscriptionRow
    ? supabase
        .from("subscriptions")
        .update(subscriptionPayloadWithPreservedFields)
        .eq("id", existingSubscriptionRow.id)
    : legacyCandidate
      ? supabase
          .from("subscriptions")
          .update(subscriptionPayloadWithPreservedFields)
          .eq("id", legacyCandidate.id)
      : supabase.from("subscriptions").insert(subscriptionPayloadWithPreservedFields);

  const { data, error } = await mutation
    .select(
      "id, org_id, plan_id, status, stripe_subscription_id, stripe_customer_id, current_period_start, current_period_end, billing_cycle"
    )
    .single();

  if (error) {
    console.error("[stripe:webhook] subscriptions upsert failed", {
      stripeSubscriptionId: subscription.id,
      profileId: profile?.id ?? null,
      organizationId: organization.id,
      planId: plan?.id ?? null,
      stripePriceId,
      error,
      payload: subscriptionPayload,
    });
    return null;
  }

  const nextOrganizationSnapshot = buildOrganizationBillingSnapshot({
    subscription,
    plan,
    stripeCustomerId,
    stripePriceId,
  });
  const nextOrganizationSnapshotWithPreservedFields = preserveExistingOrganizationSnapshot(
    nextOrganizationSnapshot,
    organization
  );
  const organizationDivergence = Object.fromEntries(
    Object.entries(nextOrganizationSnapshotWithPreservedFields).filter(
      ([key, value]) => organization?.[key] !== value
    )
  );

  if (Object.keys(organizationDivergence).length > 0) {
    console.warn("[stripe:webhook] organizations/subscriptions divergence", {
      organizationId: organization.id,
      subscriptionRow: data,
      currentOrganization: {
        stripe_customer_id: organization?.stripe_customer_id ?? null,
        stripe_subscription_id: organization?.stripe_subscription_id ?? null,
        stripe_price_id: organization?.stripe_price_id ?? null,
        billing_plan: organization?.billing_plan ?? null,
        billing_status: organization?.billing_status ?? null,
        billing_current_period_end: organization?.billing_current_period_end ?? null,
        billing_cancel_at_period_end: organization?.billing_cancel_at_period_end ?? null,
      },
      intendedOrganization: nextOrganizationSnapshotWithPreservedFields,
    });
  }

  const { error: organizationError } = await supabase
    .from("organizations")
    .update(nextOrganizationSnapshotWithPreservedFields)
    .eq("id", organization.id);

  if (organizationError) {
    console.error("[stripe:webhook] organizations sync failed", {
      stripeSubscriptionId: subscription.id,
      organizationId: organization.id,
      error: organizationError,
      payload: nextOrganizationSnapshotWithPreservedFields,
    });
  }

  console.info("[stripe:webhook] subscriptions upsert success", {
    stripeSubscriptionId: subscription.id,
    profileId: profile?.id ?? null,
    organizationId: organization.id,
    planId: plan?.id ?? null,
    stripePriceId,
    row: data,
  });

  return data;
}

async function updateStripeSubscriptionSnapshot({
  subscription,
  plan,
  stripeCustomerId,
  stripePriceId,
  billingCycle,
  source,
}) {
  const { data: existingRow, error: existingRowError } = await getSubscriptionRowByStripeSubscriptionId(
    subscription.id
  );

  if (existingRowError) {
    console.error("[stripe:webhook] subscriptions update failed", {
      stripeSubscriptionId: subscription.id,
      error: existingRowError,
    });
    return null;
  }

  if (!existingRow) {
    return [];
  }

  const updates = buildSubscriptionSnapshotFields({
    subscription,
    planId: plan?.id ?? null,
    stripeCustomerId,
    billingCycle,
  });
  const updatesWithPreservedFields = preserveExistingSubscriptionSnapshot(updates, existingRow);

  if (!plan?.id) {
    delete updatesWithPreservedFields.plan_id;
  }

  console.info("[stripe:webhook] subscriptions upsert input", {
    eventSource: source,
    stripeSubscriptionId: subscription.id,
    organizationId: existingRow.org_id ?? null,
    planId: plan?.id ?? existingRow.plan_id ?? null,
    stripePriceId,
    payload: updatesWithPreservedFields,
    existingRow,
  });

  const { data, error } = await supabase
    .from("subscriptions")
    .update(updatesWithPreservedFields)
    .select(
      "id, org_id, plan_id, status, stripe_subscription_id, stripe_customer_id, current_period_start, current_period_end, billing_cycle"
    )
    .eq("id", existingRow.id);

  if (error) {
    console.error("[stripe:webhook] subscriptions upsert failed", {
      stripeSubscriptionId: subscription.id,
      error,
      updates: updatesWithPreservedFields,
    });
    return null;
  }

  if (existingRow.org_id) {
    const { data: organization, error: organizationLookupError } = await getOrganizationById(
      existingRow.org_id
    );

    if (organizationLookupError) {
      console.error("[stripe:webhook] organizations sync failed", {
        stripeSubscriptionId: subscription.id,
        organizationId: existingRow.org_id,
        error: organizationLookupError,
      });
    } else if (organization) {
      const nextOrganizationSnapshot = buildOrganizationBillingSnapshot({
        subscription,
        plan,
        stripeCustomerId,
        stripePriceId,
      });
      const nextOrganizationSnapshotWithPreservedFields = preserveExistingOrganizationSnapshot(
        nextOrganizationSnapshot,
        organization
      );
      const organizationDivergence = Object.fromEntries(
        Object.entries(nextOrganizationSnapshotWithPreservedFields).filter(
          ([key, value]) => organization?.[key] !== value
        )
      );

      if (Object.keys(organizationDivergence).length > 0) {
        console.warn("[stripe:webhook] organizations/subscriptions divergence", {
          organizationId: organization.id,
          subscriptionRow: data?.[0] ?? null,
          currentOrganization: {
            stripe_customer_id: organization?.stripe_customer_id ?? null,
            stripe_subscription_id: organization?.stripe_subscription_id ?? null,
            stripe_price_id: organization?.stripe_price_id ?? null,
            billing_plan: organization?.billing_plan ?? null,
            billing_status: organization?.billing_status ?? null,
            billing_current_period_end: organization?.billing_current_period_end ?? null,
            billing_cancel_at_period_end: organization?.billing_cancel_at_period_end ?? null,
          },
          intendedOrganization: nextOrganizationSnapshotWithPreservedFields,
        });
      }

      const { error: organizationError } = await supabase
        .from("organizations")
        .update(nextOrganizationSnapshotWithPreservedFields)
        .eq("id", organization.id);

      if (organizationError) {
        console.error("[stripe:webhook] organizations sync failed", {
          stripeSubscriptionId: subscription.id,
          organizationId: organization.id,
          error: organizationError,
          payload: nextOrganizationSnapshotWithPreservedFields,
        });
      }
    }
  }

  console.info("[stripe:webhook] subscriptions upsert success", {
    stripeSubscriptionId: subscription.id,
    affectedRows: data?.length ?? 0,
    row: data?.[0] ?? null,
  });

  return data ?? [];
}

async function handleCheckoutSessionCompleted(event) {
  const checkoutSession = event.data.object;
  const checkoutContext = await loadCheckoutSessionContext(checkoutSession);

  console.info("[stripe:webhook] processing checkout.session.completed", {
    eventId: event.id,
    sessionId: checkoutContext.sessionId,
    subscriptionId: checkoutContext.subscriptionId,
    stripeCustomerId: checkoutContext.stripeCustomerId,
    customerEmail: checkoutContext.customerEmail,
    metadata: checkoutContext.metadata,
    stripePriceId: checkoutContext.stripePriceId,
  });

  const { profile, organization, matchedBy } = await findUserByStripeContext({
    metadata: checkoutContext.metadata,
    stripeCustomerId: checkoutContext.stripeCustomerId,
    customerEmail: checkoutContext.customerEmail,
  });

  if (!organization) {
    console.warn("[stripe:webhook] no matching user", {
      eventId: event.id,
      sessionId: checkoutContext.sessionId,
      subscriptionId: checkoutContext.subscriptionId,
      stripeCustomerId: checkoutContext.stripeCustomerId,
      customerEmail: checkoutContext.customerEmail,
      metadata: checkoutContext.metadata,
      matchedBy,
    });
    return;
  }

  await syncStripeCustomerReferences({
    profile,
    organization,
    stripeCustomerId: checkoutContext.stripeCustomerId,
  });

  if (!checkoutContext.subscription) {
    console.info("[stripe:webhook] one-time payment detected", {
      eventId: event.id,
      sessionId: checkoutContext.sessionId,
      organizationId: organization.id,
      profileId: profile?.id ?? null,
      stripePriceId: checkoutContext.stripePriceId,
      planId: checkoutContext.metadata?.plan_id ?? null,
      paymentStatus: checkoutContext.session?.payment_status ?? null,
    });
    console.info("[stripe:webhook] no subscription on session", {
      eventId: event.id,
      sessionId: checkoutContext.sessionId,
      stripeCustomerId: checkoutContext.stripeCustomerId,
      customerEmail: checkoutContext.customerEmail,
      matchedBy,
    });
    return;
  }

  const plan = await resolvePlanForStripeContext({
    metadata: checkoutContext.metadata,
    stripePriceId: checkoutContext.stripePriceId,
  });

  console.info("[stripe:webhook] monthly subscription detected", {
    eventId: event.id,
    sessionId: checkoutContext.sessionId,
    subscriptionId: checkoutContext.subscription.id,
    planId: plan?.id ?? checkoutContext.metadata?.plan_id ?? null,
    stripePriceId: checkoutContext.stripePriceId,
  });

  await upsertStripeSubscriptionInSupabase({
    subscription: checkoutContext.subscription,
    profile,
    organization,
    plan,
    stripeCustomerId: checkoutContext.stripeCustomerId,
    stripeCheckoutSessionId: checkoutContext.sessionId,
    stripePriceId: checkoutContext.stripePriceId,
    customerEmail: checkoutContext.customerEmail,
    billingCycle: normalizeBillingCycle(checkoutContext.billingCycle),
    source: event.type,
    checkoutMode: checkoutContext.session?.mode ?? null,
    checkoutPaymentStatus: checkoutContext.session?.payment_status ?? null,
  });
}

async function handleSubscriptionLifecycleEvent(event) {
  const subscription = event.data.object;
  const metadata = resolveStripeMetadata({
    sessionMetadata: null,
    subscriptionMetadata: subscription.metadata,
  });
  const primaryItem = getSubscriptionPrimaryItem(subscription);
  const stripePriceId = getStripePriceId(primaryItem?.price);
  const billingCycle = getStripePriceInterval(primaryItem?.price);
  const stripeCustomerId = getStripeCustomerId(subscription.customer);
  const plan = await resolvePlanForStripeContext({
    metadata,
    stripePriceId,
  });

  console.info("[stripe:webhook] processing subscription lifecycle event", {
    eventId: event.id,
    eventType: event.type,
    subscriptionId: subscription.id,
    stripeCustomerId,
    metadata,
    stripePriceId,
  });

  console.info("[stripe:webhook] monthly subscription detected", {
    eventId: event.id,
    eventType: event.type,
    subscriptionId: subscription.id,
    planId: plan?.id ?? metadata?.plan_id ?? null,
    stripePriceId,
  });

  const updatedRows = await updateStripeSubscriptionSnapshot({
    subscription,
    plan,
    stripeCustomerId,
    stripePriceId,
    billingCycle: normalizeBillingCycle(billingCycle),
    source: event.type,
  });

  if ((updatedRows?.length ?? 0) > 0) {
    return;
  }

  const { profile, organization, matchedBy } = await findUserByStripeContext({
    metadata,
    stripeCustomerId,
    customerEmail: null,
  });

  if (!organization) {
    console.warn("[stripe:webhook] no matching user", {
      eventId: event.id,
      subscriptionId: subscription.id,
      stripeCustomerId,
      metadata,
      matchedBy,
    });
    return;
  }

  await syncStripeCustomerReferences({
    profile,
    organization,
    stripeCustomerId,
  });

  await upsertStripeSubscriptionInSupabase({
    subscription,
    profile,
    organization,
    plan,
    stripeCustomerId,
    stripeCheckoutSessionId: null,
    stripePriceId,
    customerEmail: null,
    billingCycle: normalizeBillingCycle(billingCycle),
    source: event.type,
    checkoutMode: null,
    checkoutPaymentStatus: null,
  });
}

async function handleInvoicePaidEvent(event) {
  const invoice = event.data.object;
  const subscriptionId = normalizeOptionalString(
    typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id
  );

  if (!subscriptionId) {
    return;
  }

  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ["items.data.price"],
    });

    await handleSubscriptionLifecycleEvent({
      ...event,
      data: {
        ...event.data,
        object: subscription,
      },
      type: "invoice.paid",
    });
  } catch (error) {
    console.error("[stripe:webhook] invoice.paid subscription reload failed", {
      eventId: event.id,
      subscriptionId,
      error: serializeOperationalError(error),
    });
  }
}

function serializeOperationalError(error) {
  if (!error || typeof error !== "object") {
    return {
      message: String(error || "Unknown error"),
      type: null,
      code: null,
      details: null,
    };
  }

  return {
    message: error.message || "Unknown error",
    type: error.type ?? null,
    code: error.code ?? error.statusCode ?? null,
    details: error.details ?? error.detail ?? error.raw ?? null,
  };
}

app.get("/health", (_req, res) => {
  res.send("OK");
});

app.get("/api/stripe/debug/config", async (_req, res) => {
  const inferredMode = inferStripeModeFromSecretKey(stripeSecretKey);

  try {
    const account = await stripe.accounts.retrieve();

    return res.json({
      account_id: account.id,
      livemode: account.livemode,
      inferred_mode: inferredMode,
      webhook_route: getStripeWebhookUrl(),
      webhook_secret_configured: Boolean(stripeWebhookSecret),
      secret_key_prefix: stripeSecretKey.slice(0, 8),
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message || "Impossible de recuperer la configuration Stripe",
      inferred_mode: inferredMode,
      webhook_route: getStripeWebhookUrl(),
      webhook_secret_configured: Boolean(stripeWebhookSecret),
      secret_key_prefix: stripeSecretKey.slice(0, 8),
    });
  }
});

app.get("/api/stripe/debug/checkout-session/:sessionId", async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.retrieve(req.params.sessionId, {
      expand: ["subscription"],
    });

    return res.json({
      id: session.id,
      livemode: session.livemode,
      mode: session.mode,
      status: session.status,
      payment_status: session.payment_status,
      customer: session.customer,
      metadata: session.metadata ?? null,
      subscription:
        session.subscription && typeof session.subscription === "object"
          ? {
              id: session.subscription.id,
              status: session.subscription.status,
              metadata: session.subscription.metadata ?? null,
            }
          : session.subscription,
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message || "Impossible de recuperer la session Checkout",
      session_id: req.params.sessionId,
    });
  }
});

app.post("/api/taxware/calculate", async (req, res) => {
  try {
    const data = await calculateTaxware(req.body);
    res.json(data);
  } catch (error) {
    res.status(error.status || 500).json({
      error: error.message || "Erreur serveur",
      ...(error.details ? { details: error.details } : {}),
    });
  }
});

app.post("/api/taxware/simulate", async (req, res) => {
  const payload = req.body;
  const hasPayload = payload !== null && payload !== undefined;

  console.info("[taxware] simulate request received", {
    hasPayload,
    zip: typeof payload?.Zip === "number" ? payload.Zip : null,
    year: typeof payload?.Year === "number" ? payload.Year : null,
    partnership: typeof payload?.Partnership === "string" ? payload.Partnership : null,
    childrenCount: typeof payload?.NumChildren === "number" ? payload.NumChildren : null,
  });

  try {
    const data = await calculateTaxware(payload);
    console.info("[taxware] simulate success");
    res.json(data);
  } catch (error) {
    console.error("[taxware] simulate error", serializeOperationalError(error));
    res.status(error.status || 500).json({
      error: error.message || "Erreur serveur",
      ...(error.details ? { details: error.details } : {}),
    });
  }
});

app.post("/api/stripe/create-checkout-session", async (req, res) => {
  try {
    const { plan_id, success_url, cancel_url, profile_id, organization_id } = req.body;
    const normalizedPlanId = normalizeOptionalString(plan_id);
    const explicitProfileId = normalizeOptionalString(profile_id);
    const normalizedOrganizationId = normalizeOptionalString(organization_id);
    const normalizedSuccessUrl =
      normalizeOptionalString(success_url) ?? buildDefaultCheckoutRedirectUrl(req, "success");
    const normalizedCancelUrl =
      normalizeOptionalString(cancel_url) ?? buildDefaultCheckoutRedirectUrl(req, "cancel");
    const resolvedProfileContext = explicitProfileId
      ? { profile: null, error: null }
      : await resolveProfileFromAuthorizationHeader(req);
    const normalizedProfileId = explicitProfileId ?? normalizeOptionalString(resolvedProfileContext.profile?.id);

    console.info("[stripe:checkout] request received", {
      planId: normalizedPlanId,
      profileId: normalizedProfileId,
      requestedOrganizationId: normalizedOrganizationId,
      successUrl: normalizedSuccessUrl,
      cancelUrl: normalizedCancelUrl,
      authResolvedProfileId: resolvedProfileContext.profile?.id ?? null,
    });

    if (resolvedProfileContext.error) {
      console.error("[stripe:checkout] auth profile resolution failed", {
        error: serializeOperationalError(resolvedProfileContext.error),
      });
      return res.status(401).json({ error: "Authentification requise pour lancer ce checkout" });
    }

    if (!normalizedPlanId || !normalizedSuccessUrl || !normalizedCancelUrl || !normalizedProfileId) {
      console.error("[stripe:checkout] missing required fields", {
        planId: normalizedPlanId,
        profileId: normalizedProfileId,
        requestedOrganizationId: normalizedOrganizationId,
        successUrl: normalizedSuccessUrl,
        cancelUrl: normalizedCancelUrl,
      });
      return res
        .status(400)
        .json({ error: "plan_id et un profile authentifie sont requis pour ce checkout" });
    }

    if (!isUuid(normalizedPlanId) || !isUuid(normalizedProfileId)) {
      console.error("[stripe:checkout] invalid UUID input", {
        planId: normalizedPlanId,
        profileId: normalizedProfileId,
      });
      return res.status(400).json({ error: "plan_id and profile_id must be valid UUIDs" });
    }

    if (normalizedOrganizationId && !isUuid(normalizedOrganizationId)) {
      console.error("[stripe:checkout] invalid organization UUID input", {
        requestedOrganizationId: normalizedOrganizationId,
      });
      return res.status(400).json({ error: "organization_id must be a valid UUID when provided" });
    }

    try {
      new URL(normalizedSuccessUrl);
      new URL(normalizedCancelUrl);
    } catch (error) {
      console.error("[stripe:checkout] invalid redirect URL", {
        successUrl: normalizedSuccessUrl,
        cancelUrl: normalizedCancelUrl,
        error: serializeOperationalError(error),
      });
      return res.status(400).json({
        error: "success_url et cancel_url doivent etre des URLs absolues valides",
      });
    }

    const { data: plan, error: planError } = await supabase
      .from("plans")
      .select(
        "id, name, active, stripe_product_id, stripe_price_id, stripe_price_id_monthly, stripe_price_id_yearly"
      )
      .eq('id', normalizedPlanId)
      .single();

    const checkoutPricing = resolveStripeCheckoutPricing(plan);
    const selectedPriceIdRaw =
      checkoutPricing.sourceColumn === "stripe_price_id_monthly"
        ? plan?.stripe_price_id_monthly
        : plan?.stripe_price_id;
    const selectedPriceId = checkoutPricing.priceId;

    console.info("[stripe:checkout] selected plan row", {
      requestedPlanId: normalizedPlanId,
      selectedPlanRow: plan ?? null,
    });

    console.info("[stripe:checkout] selected payment type", {
      planId: normalizedPlanId,
      paymentType: checkoutPricing.paymentType,
      sourceColumn: checkoutPricing.sourceColumn,
    });

    console.info("[stripe:checkout] selected price id", {
      planId: normalizedPlanId,
      sourceColumn: checkoutPricing.sourceColumn,
      rawPriceId: selectedPriceIdRaw ?? null,
      normalizedPriceId: selectedPriceId,
      hadWhitespace:
        typeof selectedPriceIdRaw === "string" && selectedPriceIdRaw !== selectedPriceId,
      monthlyPriceId: plan?.stripe_price_id_monthly ?? null,
      yearlyPriceId: plan?.stripe_price_id_yearly ?? null,
    });

    console.info("[stripe:checkout] selected checkout mode", {
      planId: normalizedPlanId,
      checkoutMode: checkoutPricing.checkoutMode,
    });

    const stripeAccountDiagnostics = await getStripeAccountDiagnostics();
    console.info("[stripe:checkout] stripe account diagnostics", stripeAccountDiagnostics);

    if (planError || !plan || !selectedPriceId || !checkoutPricing.checkoutMode) {
      console.error("[stripe:checkout] plan lookup failed", {
        plan_id: normalizedPlanId,
        planError,
        plan,
        selectedPriceIdRaw: selectedPriceIdRaw ?? null,
        selectedPriceId,
        checkoutMode: checkoutPricing.checkoutMode,
        paymentType: checkoutPricing.paymentType,
      });
      return res.status(404).json({
        error:
          "Plan introuvable ou non configure avec stripe_price_id_monthly ou stripe_price_id.",
      });
    }

    console.info("[stripe:checkout] plan resolved", {
      planId: normalizedPlanId,
      stripePriceId: selectedPriceId,
      checkoutMode: checkoutPricing.checkoutMode,
      paymentType: checkoutPricing.paymentType,
    });

    const preResolvedProfile =
      resolvedProfileContext.profile && resolvedProfileContext.profile.id === normalizedProfileId
        ? resolvedProfileContext.profile
        : null;
    const { data: profileById, error: profileError } = preResolvedProfile
      ? { data: preResolvedProfile, error: null }
      : await getProfileById(normalizedProfileId);
    const profile = profileById;

    if (profileError) {
      console.error("[stripe:checkout] profile lookup failed", {
        profileId: normalizedProfileId,
        error: profileError,
      });
      return res.status(500).json({ error: "Erreur lecture profile Supabase" });
    }

    if (!profile) {
      console.error("[stripe:checkout] profile not found", {
        profileId: normalizedProfileId,
      });
      return res.status(404).json({ error: "Profile introuvable pour ce checkout" });
    }

    console.info("[stripe:checkout] profile resolved", {
      profileId: profile.id,
      email: profile.email ?? null,
    });

    const resolvedOrganizationId = await resolveCheckoutOrganization({
      profile,
      requestedOrganizationId: normalizedOrganizationId,
    });

    const metadata = {
      plan_id: normalizedPlanId,
      profile_id: normalizedProfileId,
      organization_id: resolvedOrganizationId,
    };

    console.info("[stripe:checkout] creating checkout session", {
      planId: normalizedPlanId,
      profileId: normalizedProfileId,
      requestedOrganizationId: normalizedOrganizationId,
      resolvedOrganizationId,
      stripePriceId: selectedPriceId,
      checkoutMode: checkoutPricing.checkoutMode,
      paymentType: checkoutPricing.paymentType,
      metadata,
    });

    const stripeCustomerId = normalizeOptionalString(profile.stripe_customer_id);
    const checkoutCustomerContext = stripeCustomerId
      ? { customer: stripeCustomerId }
      : profile.email
        ? { customer_email: profile.email }
        : {};

    const sessionPayload = {
      mode: checkoutPricing.checkoutMode,
      line_items: [{ price: selectedPriceId, quantity: 1 }],
      success_url: normalizedSuccessUrl,
      cancel_url: normalizedCancelUrl,
      ...checkoutCustomerContext,
      client_reference_id: normalizedProfileId,
      metadata,
      ...(checkoutPricing.checkoutMode === "subscription"
        ? {
            subscription_data: {
              metadata,
            },
          }
        : {}),
    };

    const session = await stripe.checkout.sessions.create(sessionPayload);

    console.info("[stripe:checkout] checkout created with metadata", {
      sessionId: session.id,
      url: session.url,
      livemode: session.livemode,
      mode: session.mode,
      paymentType: checkoutPricing.paymentType,
      status: session.status,
      paymentStatus: session.payment_status,
      clientReferenceId: session.client_reference_id,
      stripeCustomerId: stripeCustomerId ?? null,
      customerEmail: profile.email ?? null,
      metadata,
    });

    return res.json({ url: session.url, id: session.id, metadata });
  } catch (error) {
    const serializedError = serializeOperationalError(error);
    console.error("[stripe:checkout] create-checkout-session error", serializedError);
    return res.status(500).json({
      error: "Erreur creation session Stripe",
      details: serializedError.message,
      type: serializedError.type,
      code: serializedError.code,
    });
  }
});

app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  console.log("WEBHOOK STRIPE RECU");

  if (!webhookSecret) {
    console.error("Erreur webhook Stripe:", "STRIPE_WEBHOOK_SECRET manquant");
    return res.status(500).send("Webhook non configure");
  }

  if (typeof sig !== "string" || sig.length === 0) {
    console.error("Erreur webhook Stripe:", "signature Stripe manquante");
    return res.status(400).send("Webhook Error: Missing stripe signature");
  }

  if (!Buffer.isBuffer(req.body)) {
    console.error("Erreur webhook Stripe:", "body brut Stripe indisponible");
    return res.status(400).send("Webhook Error: raw body required");
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur de signature Stripe";
    console.error("Erreur webhook Stripe:", message);
    return res.status(400).send(`Webhook Error: ${message}`);
  }

  console.log("Event type:", event.type);

  try {
    if (event.type === "checkout.session.completed") {
      console.log("Paiement confirme");
      await handleCheckoutSessionCompleted(event);
    }

    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      await handleSubscriptionLifecycleEvent(event);
    }

    if (event.type === "invoice.paid") {
      await handleInvoicePaidEvent(event);
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur interne webhook";
    console.error("Erreur webhook Stripe:", message);
    return res.status(500).send(`Webhook Error: ${message}`);
  }
});

let isServerReady = false;
let httpServer = null;

process.on("exit", (code) => {
  console.error("[server:lifecycle] process exit", {
    code,
    isServerReady,
    activePort,
  });
});

process.on("uncaughtException", (error) => {
  console.error("[server:lifecycle] uncaughtException", error);
});

process.on("unhandledRejection", (reason) => {
  console.error("[server:lifecycle] unhandledRejection", reason);
});

function attachServerLifecycleHandlers(server) {
  server.on("close", () => {
    console.error("[server:lifecycle] http server closed unexpectedly", {
      activePort,
    });
  });

  server.on("error", (error) => {
    console.error("[server:lifecycle] http server error", error);
  });
}

function startServer(port) {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, HOST);

    const handleListening = () => {
      server.off("error", handleError);
      resolve(server);
    };

    const handleError = (error) => {
      server.off("listening", handleListening);
      reject(error);
    };

    server.once("listening", handleListening);
    server.once("error", handleError);
  });
}

async function bootstrap() {
  try {
    httpServer = await startServer(DEFAULT_PORT);
    activePort = DEFAULT_PORT;
  } catch (error) {
    if (
      (error?.code === "EADDRINUSE" || error?.code === "EACCES") &&
      typeof FALLBACK_PORT === "number"
    ) {
      console.warn("[server:startup] preferred port unavailable, retrying on fallback port", {
        preferredPort: DEFAULT_PORT,
        fallbackPort: FALLBACK_PORT,
        host: HOST,
        code: error.code,
      });

      httpServer = await startServer(FALLBACK_PORT);
      activePort = FALLBACK_PORT;
    } else {
      throw error;
    }
  }

  isServerReady = true;
  attachServerLifecycleHandlers(httpServer);
  console.log(`Server listening on ${getServerBaseUrl()}`);
  void logStripeStartupDiagnostics();
}

bootstrap().catch((error) => {
  console.error("[server:startup] fatal bootstrap error", error);
  process.exitCode = 1;
});
