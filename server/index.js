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
const isDevelopmentLike = process.env.NODE_ENV !== "production";

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
  const normalizedPlanName = normalizeOptionalString(plan?.name);

  if (normalizedPlanName === "fipla_private_full") {
    return {
      priceId: normalizeOptionalString(plan?.stripe_price_id),
      checkoutMode: "subscription",
      paymentType: "monthly",
      sourceColumn: "stripe_price_id",
      expectedStripePriceType: "recurring",
      expectedCurrency: "chf",
      expectedUnitAmount: 2900,
      expectedRecurringInterval: "month",
      planName: normalizedPlanName,
    };
  }

  if (normalizedPlanName === "fipla_pro_solo") {
    return {
      priceId: normalizeOptionalString(plan?.stripe_price_id),
      checkoutMode: "subscription",
      paymentType: "monthly",
      sourceColumn: "stripe_price_id",
      expectedStripePriceType: "recurring",
      expectedCurrency: "chf",
      expectedUnitAmount: 5900,
      expectedRecurringInterval: "month",
      planName: normalizedPlanName,
    };
  }

  if (normalizedPlanName === "fipla_private_mini") {
    return {
      priceId: normalizeOptionalString(plan?.stripe_price_id),
      checkoutMode: "payment",
      paymentType: "one_time",
      sourceColumn: "stripe_price_id",
      expectedStripePriceType: "one_time",
      expectedCurrency: "chf",
      expectedUnitAmount: 900,
      expectedRecurringInterval: null,
      planName: normalizedPlanName,
    };
  }

  return {
    priceId: normalizeOptionalString(plan?.stripe_price_id),
    checkoutMode: null,
    paymentType: null,
    sourceColumn: "stripe_price_id",
    expectedStripePriceType: null,
    expectedCurrency: null,
    expectedUnitAmount: null,
    expectedRecurringInterval: null,
    planName: normalizedPlanName,
  };
}

function isStripePriceCompatibleForCheckout(price, expectedPricing) {
  if (!price || !expectedPricing?.expectedStripePriceType) {
    return false;
  }

  const normalizedPriceType = price.type === "recurring" ? "recurring" : "one_time";
  const normalizedPriceCurrency = normalizeOptionalString(price.currency);
  const normalizedPriceInterval = normalizeOptionalString(price.recurring?.interval);
  const unitAmount = typeof price.unit_amount === "number" ? price.unit_amount : null;

  if (!price.active) {
    return false;
  }

  if (normalizedPriceType !== expectedPricing.expectedStripePriceType) {
    return false;
  }

  if (
    expectedPricing.expectedCurrency &&
    normalizedPriceCurrency !== expectedPricing.expectedCurrency
  ) {
    return false;
  }

  if (
    typeof expectedPricing.expectedUnitAmount === "number" &&
    unitAmount !== expectedPricing.expectedUnitAmount
  ) {
    return false;
  }

  if (
    expectedPricing.expectedStripePriceType === "recurring" &&
    expectedPricing.expectedRecurringInterval &&
    normalizedPriceInterval !== expectedPricing.expectedRecurringInterval
  ) {
    return false;
  }

  return true;
}

async function findStripePriceFallbackForCheckout(expectedPricing) {
  if (
    !expectedPricing?.expectedStripePriceType ||
    !expectedPricing?.expectedCurrency ||
    typeof expectedPricing.expectedUnitAmount !== "number"
  ) {
    return [];
  }

  const pricesResponse = await stripe.prices.list({
    active: true,
    limit: 100,
  });

  return (pricesResponse.data ?? []).filter((price) =>
    isStripePriceCompatibleForCheckout(price, expectedPricing)
  );
}

async function resolveValidatedStripeCheckoutPricing(plan) {
  const expectedPricing = resolveStripeCheckoutPricing(plan);
  const configuredPriceId = expectedPricing.priceId;
  let configuredStripePrice = null;
  let configuredPriceErrorMessage = null;

  if (configuredPriceId) {
    try {
      configuredStripePrice = await stripe.prices.retrieve(configuredPriceId);
    } catch (error) {
      configuredPriceErrorMessage = serializeOperationalError(error).message;
    }
  }

  if (configuredStripePrice && isStripePriceCompatibleForCheckout(configuredStripePrice, expectedPricing)) {
    return {
      ...expectedPricing,
      priceId: configuredStripePrice.id,
      resolvedFrom: "plans.stripe_price_id",
      diagnostics: {
        configuredPriceId,
        configuredPriceType: configuredStripePrice.type,
        configuredPriceCurrency: configuredStripePrice.currency,
        configuredPriceUnitAmount: configuredStripePrice.unit_amount,
        configuredRecurringInterval: normalizeOptionalString(
          configuredStripePrice.recurring?.interval
        ),
      },
      resolutionError: null,
    };
  }

  const fallbackCandidates = await findStripePriceFallbackForCheckout(expectedPricing);
  const fallbackPrice = fallbackCandidates[0] ?? null;

  if (fallbackPrice) {
    return {
      ...expectedPricing,
      priceId: fallbackPrice.id,
      resolvedFrom: "stripe.active_prices_fallback",
      diagnostics: {
        configuredPriceId,
        configuredPriceErrorMessage,
        configuredPriceType: configuredStripePrice?.type ?? null,
        configuredPriceCurrency: configuredStripePrice?.currency ?? null,
        configuredPriceUnitAmount: configuredStripePrice?.unit_amount ?? null,
        configuredRecurringInterval: normalizeOptionalString(
          configuredStripePrice?.recurring?.interval
        ),
        fallbackPriceId: fallbackPrice.id,
        fallbackPriceType: fallbackPrice.type,
        fallbackPriceCurrency: fallbackPrice.currency,
        fallbackPriceUnitAmount: fallbackPrice.unit_amount,
        fallbackRecurringInterval: normalizeOptionalString(fallbackPrice.recurring?.interval),
      },
      resolutionError: null,
    };
  }

  return {
    ...expectedPricing,
    priceId: null,
    resolvedFrom: null,
    diagnostics: {
      configuredPriceId,
      configuredPriceErrorMessage,
      configuredPriceType: configuredStripePrice?.type ?? null,
      configuredPriceCurrency: configuredStripePrice?.currency ?? null,
      configuredPriceUnitAmount: configuredStripePrice?.unit_amount ?? null,
      configuredRecurringInterval: normalizeOptionalString(
        configuredStripePrice?.recurring?.interval
      ),
      fallbackCandidateCount: fallbackCandidates.length,
    },
    resolutionError:
      expectedPricing.planName === "fipla_private_mini"
        ? "Le plan Mini ne pointe vers aucun price Stripe one-time CHF 9 valide dans ce compte."
        : expectedPricing.planName === "fipla_private_full"
          ? "Le plan Full ne pointe vers aucun price Stripe recurring mensuel CHF 29 valide dans ce compte."
          : expectedPricing.planName === "fipla_pro_solo"
            ? "Le plan Pro Solo ne pointe vers aucun price Stripe recurring mensuel CHF 59 valide dans ce compte."
            : "Aucun price Stripe compatible n'a ete trouve pour ce plan.",
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

const premiumUnlockStatuses = new Set(["active", "trialing", "past_due"]);
const premiumBillingPlans = new Set(["private_full", "pro"]);

const normalizeOneTimeBillingStatus = (paymentStatus) => {
  const normalizedPaymentStatus = normalizeOptionalString(paymentStatus);

  if (normalizedPaymentStatus === "paid" || normalizedPaymentStatus === "no_payment_required") {
    return "active";
  }

  return "unpaid";
};

const normalizeSimulationCredits = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.floor(value));
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  }

  return 0;
};

const getSimulationCreditsFromMetadata = (metadata) => {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return 0;
  }

  return normalizeSimulationCredits(metadata.simulation_credits);
};

const getSimulationCreditsFromOrganization = (organization) =>
  Math.max(
    normalizeSimulationCredits(organization?.billing_private_mini_credits),
    getSimulationCreditsFromMetadata(organization?.metadata)
  );

const setSimulationCreditsOnMetadata = (metadata, nextCredits) => {
  const normalizedCredits = normalizeSimulationCredits(nextCredits);
  const nextMetadata =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? { ...metadata }
      : {};

  if (normalizedCredits > 0) {
    nextMetadata.simulation_credits = normalizedCredits;
  } else {
    delete nextMetadata.simulation_credits;
  }

  return nextMetadata;
};

const getGrantedMiniCheckoutSessionIdsFromMetadata = (metadata) => {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return [];
  }

  const rawValue = metadata.mini_checkout_credit_session_ids;

  if (!Array.isArray(rawValue)) {
    return [];
  }

  return rawValue
    .map((value) => normalizeOptionalString(value))
    .filter((value) => typeof value === "string" && value.length > 0);
};

const getPendingMiniCheckoutSessionIdsFromMetadata = (metadata) => {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return [];
  }

  const rawValue = metadata.pending_mini_checkout_session_ids;

  if (!Array.isArray(rawValue)) {
    return [];
  }

  return rawValue
    .map((value) => normalizeOptionalString(value))
    .filter((value) => typeof value === "string" && value.length > 0);
};

const setGrantedMiniCheckoutSessionIdsOnMetadata = (metadata, sessionIds) => {
  const nextMetadata =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? { ...metadata }
      : {};

  const normalizedSessionIds = Array.from(
    new Set(
      (sessionIds ?? [])
        .map((value) => normalizeOptionalString(value))
        .filter((value) => typeof value === "string" && value.length > 0)
    )
  );

  if (normalizedSessionIds.length > 0) {
    nextMetadata.mini_checkout_credit_session_ids = normalizedSessionIds.slice(-50);
  } else {
    delete nextMetadata.mini_checkout_credit_session_ids;
  }

  return nextMetadata;
};

const setPendingMiniCheckoutSessionIdsOnMetadata = (metadata, sessionIds) => {
  const nextMetadata =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? { ...metadata }
      : {};

  const normalizedSessionIds = Array.from(
    new Set(
      (sessionIds ?? [])
        .map((value) => normalizeOptionalString(value))
        .filter((value) => typeof value === "string" && value.length > 0)
    )
  );

  if (normalizedSessionIds.length > 0) {
    nextMetadata.pending_mini_checkout_session_ids = normalizedSessionIds.slice(-50);
  } else {
    delete nextMetadata.pending_mini_checkout_session_ids;
  }

  return nextMetadata;
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

const buildOneTimeOrganizationBillingSnapshot = ({
  organization,
  plan,
  stripeCustomerId,
  stripePriceId,
  checkoutPaymentStatus,
}) => {
  const hasActiveRecurringBilling =
    normalizeOptionalString(organization?.stripe_subscription_id) &&
    premiumUnlockStatuses.has(normalizeOptionalString(organization?.billing_status) ?? "");

  return {
    stripe_customer_id:
      stripeCustomerId ?? normalizeOptionalString(organization?.stripe_customer_id) ?? null,
    stripe_price_id: stripePriceId ?? normalizeOptionalString(organization?.stripe_price_id) ?? null,
    billing_updated_at: new Date().toISOString(),
    payment_issue: normalizeOneTimeBillingStatus(checkoutPaymentStatus) === "unpaid",
    ...(hasActiveRecurringBilling
      ? {}
      : {
          billing_status: normalizeOneTimeBillingStatus(checkoutPaymentStatus),
          billing_plan: deriveOrganizationBillingPlan(plan),
        }),
  };
};

const hasPaidAccessFromBillingContext = ({ organization, subscription }) => {
  const organizationBillingPlan = normalizeOptionalString(organization?.billing_plan);
  const organizationBillingStatus = normalizeOptionalString(organization?.billing_status);
  const subscriptionStatus = normalizeOptionalString(subscription?.status);
  const stripeSubscriptionId = normalizeOptionalString(subscription?.stripe_subscription_id);
  const simulationCredits = getSimulationCreditsFromOrganization(organization);

  if (
    organizationBillingPlan &&
    premiumBillingPlans.has(organizationBillingPlan) &&
    (!organizationBillingStatus || premiumUnlockStatuses.has(organizationBillingStatus))
  ) {
    return {
      hasPaidAccess: true,
      source: "organizations.billing_status",
      simulationCredits,
    };
  }

  if (
    stripeSubscriptionId &&
    subscriptionStatus &&
    premiumUnlockStatuses.has(subscriptionStatus)
  ) {
    return {
      hasPaidAccess: true,
      source: "subscriptions.status",
      simulationCredits,
    };
  }

  return {
    hasPaidAccess: false,
    source: null,
    simulationCredits,
  };
};

async function persistOneTimePaymentInSupabase({
  profile,
  organization,
  plan,
  stripeCustomerId,
  stripePriceId,
  checkoutPaymentStatus,
  source,
}) {
  const nextOrganizationSnapshot = buildOneTimeOrganizationBillingSnapshot({
    organization,
    plan,
    stripeCustomerId,
    stripePriceId,
    checkoutPaymentStatus,
  });

  const { error } = await supabase
    .from("organizations")
    .update(nextOrganizationSnapshot)
    .eq("id", organization.id);

  if (error) {
    console.error("[stripe:webhook] one-time organization billing sync failed", {
      eventSource: source,
      profileId: profile?.id ?? null,
      organizationId: organization.id,
      stripeCustomerId,
      stripePriceId,
      checkoutPaymentStatus,
      error,
      payload: nextOrganizationSnapshot,
    });
    return;
  }

  console.info("[stripe:webhook] one-time organization billing sync success", {
    eventSource: source,
    profileId: profile?.id ?? null,
    organizationId: organization.id,
    stripeCustomerId,
    stripePriceId,
    checkoutPaymentStatus,
    payload: nextOrganizationSnapshot,
  });
}

async function setOrganizationSimulationCredits({
  organization,
  nextCredits,
  source,
  profile,
}) {
  if (!organization?.id) {
    return null;
  }

  const normalizedNextCredits = normalizeSimulationCredits(nextCredits);
  const { data, error } = await supabase
    .from("organizations")
    .update({
      billing_private_mini_credits: normalizedNextCredits,
      billing_private_mini_consumed_at:
        normalizedNextCredits < getSimulationCreditsFromOrganization(organization)
          ? new Date().toISOString()
          : organization.billing_private_mini_consumed_at ?? null,
      billing_updated_at: new Date().toISOString(),
    })
    .eq("id", organization.id)
    .select("*")
    .maybeSingle();

  if (error) {
    console.error("[stripe:credits] organization credits sync failed", {
      source,
      profileId: profile?.id ?? null,
      organizationId: organization.id,
      nextCredits: normalizeSimulationCredits(nextCredits),
      error,
    });
    return null;
  }

  console.info("[stripe:credits] organization credits sync success", {
    source,
    profileId: profile?.id ?? null,
    organizationId: organization.id,
    simulationCredits: getSimulationCreditsFromOrganization(
      data ?? { ...organization, billing_private_mini_credits: normalizedNextCredits }
    ),
  });

  return data ?? { ...organization, billing_private_mini_credits: normalizedNextCredits };
}

async function incrementOrganizationSimulationCredits({
  organization,
  amount,
  source,
  profile,
}) {
  const currentCredits = getSimulationCreditsFromOrganization(organization);
  return setOrganizationSimulationCredits({
    organization,
    nextCredits: currentCredits + normalizeSimulationCredits(amount),
    source,
    profile,
  });
}

async function recordPendingMiniCheckoutSession({
  organization,
  checkoutSessionId,
  source,
  profile,
}) {
  console.info("[stripe:credits] pending Mini checkout session skipped", {
    source,
    profileId: profile?.id ?? null,
    organizationId: organization?.id ?? null,
    checkoutSessionId: normalizeOptionalString(checkoutSessionId),
    reason: "legacy-organizations-schema-without-metadata",
  });
  return organization;
}

async function grantMiniSimulationCreditIfEligible({
  organization,
  plan,
  profile,
  checkoutSessionId,
  checkoutPaymentStatus,
  source,
}) {
  const normalizedSessionId = normalizeOptionalString(checkoutSessionId);

  if (
    plan?.name !== "fipla_private_mini" ||
    normalizeOneTimeBillingStatus(checkoutPaymentStatus) !== "active" ||
    !organization?.id ||
    !normalizedSessionId
  ) {
    return {
      organization,
      simulationCredits: getSimulationCreditsFromOrganization(organization),
      creditGranted: false,
    };
  }

  const currentCredits = getSimulationCreditsFromOrganization(organization);

  if (currentCredits > 0) {
    console.info("[stripe:credits] Mini credit already granted", {
      source,
      profileId: profile?.id ?? null,
      organizationId: organization.id,
      checkoutSessionId: normalizedSessionId,
      simulationCredits: currentCredits,
    });

    return {
      organization,
      simulationCredits: currentCredits,
      creditGranted: false,
    };
  }

  const { data, error } = await supabase
    .from("organizations")
    .update({
      billing_private_mini_credits: currentCredits + 1,
      billing_updated_at: new Date().toISOString(),
    })
    .eq("id", organization.id)
    .select("*")
    .maybeSingle();

  if (error) {
    console.error("[stripe:credits] Mini credit grant failed", {
      source,
      profileId: profile?.id ?? null,
      organizationId: organization.id,
      checkoutSessionId: normalizedSessionId,
      error,
    });

    return {
      organization,
      simulationCredits: currentCredits,
      creditGranted: false,
    };
  }

  const updatedOrganization =
    data ?? { ...organization, billing_private_mini_credits: currentCredits + 1 };
  const nextCredits = getSimulationCreditsFromOrganization(updatedOrganization);

  console.info("[stripe:credits] Mini credit granted", {
    source,
    profileId: profile?.id ?? null,
    organizationId: updatedOrganization.id,
    checkoutSessionId: normalizedSessionId,
    simulationCredits: nextCredits,
  });

  return {
    organization: updatedOrganization,
    simulationCredits: nextCredits,
    creditGranted: true,
  };
}

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

async function getOwnedOrganizations(profileId) {
  return supabase
    .from("organizations")
    .select("*")
    .eq("owner_id", profileId)
    .order("created_at", { ascending: true });
}

async function getOrganizationsByProfileEmail(profileEmail) {
  const normalizedEmail = normalizeOptionalString(profileEmail);

  if (!normalizedEmail) {
    return { data: [], error: null };
  }

  return supabase
    .from("organizations")
    .select("*")
    .ilike("name", `%${normalizedEmail}%`)
    .order("created_at", { ascending: true });
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

async function getLatestSubscriptionByOrganizationId(organizationId) {
  return supabase
    .from("subscriptions")
    .select("*")
    .eq("org_id", organizationId)
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

async function ensureOrganizationOwnedByProfile({ profile, organization, source }) {
  if (!profile?.id || !organization?.id) {
    return organization;
  }

  if (normalizeOptionalString(organization.owner_id) === profile.id) {
    return organization;
  }

  if (normalizeOptionalString(organization.owner_id)) {
    return organization;
  }

  const { data, error } = await supabase
    .from("organizations")
    .update({ owner_id: profile.id })
    .eq("id", organization.id)
    .is("owner_id", null)
    .select("*")
    .maybeSingle();

  if (error) {
    console.error("[stripe:billing] organization owner sync failed", {
      source,
      profileId: profile.id,
      organizationId: organization.id,
      error,
    });
    return organization;
  }

  console.info("[stripe:billing] organization owner synced", {
    source,
    profileId: profile.id,
    organizationId: organization.id,
  });

  return data ?? { ...organization, owner_id: profile.id };
}

function getAccessCandidateSortValue(organization, subscription) {
  const timestamps = [
    organization?.billing_updated_at,
    organization?.updated_at,
    organization?.billing_current_period_end,
    subscription?.current_period_end,
    subscription?.created_at,
    organization?.created_at,
  ]
    .map((value) => {
      const timestamp = value ? Date.parse(value) : Number.NaN;
      return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY;
    });

  return Math.max(...timestamps);
}

async function resolveAccessOrganizationForProfile(profile) {
  const { data: ownedOrganizations, error: ownedOrganizationsError } = await getOwnedOrganizations(
    profile.id
  );

  if (ownedOrganizationsError) {
    return {
      organization: null,
      subscription: null,
      accessStatus: { hasPaidAccess: false, source: null },
      error: ownedOrganizationsError,
    };
  }

  const { data: emailOrganizations, error: emailOrganizationsError } =
    await getOrganizationsByProfileEmail(profile.email ?? null);

  if (emailOrganizationsError) {
    return {
      organization: null,
      subscription: null,
      accessStatus: { hasPaidAccess: false, source: null },
      error: emailOrganizationsError,
    };
  }

  const candidates = [...(ownedOrganizations ?? []), ...(emailOrganizations ?? [])].reduce(
    (map, organization) => {
      if (!organization?.id || map.has(organization.id)) {
        return map;
      }

      map.set(organization.id, organization);
      return map;
    },
    new Map()
  );

  const evaluatedCandidates = [];

  for (const organization of candidates.values()) {
    const { data: subscription, error: subscriptionError } = await getLatestSubscriptionByOrganizationId(
      organization.id
    );

    if (subscriptionError) {
      return {
        organization: null,
        subscription: null,
        accessStatus: { hasPaidAccess: false, source: null },
        error: subscriptionError,
      };
    }

    evaluatedCandidates.push({
      organization,
      subscription,
      accessStatus: hasPaidAccessFromBillingContext({
        organization,
        subscription,
      }),
      isOwned: normalizeOptionalString(organization.owner_id) === profile.id,
      sortValue: getAccessCandidateSortValue(organization, subscription),
    });
  }

  if (evaluatedCandidates.length === 0) {
    return {
      organization: null,
      subscription: null,
      accessStatus: { hasPaidAccess: false, source: null },
      error: null,
    };
  }

  evaluatedCandidates.sort((left, right) => {
    if (left.accessStatus.hasPaidAccess !== right.accessStatus.hasPaidAccess) {
      return Number(right.accessStatus.hasPaidAccess) - Number(left.accessStatus.hasPaidAccess);
    }

    if (left.accessStatus.simulationCredits !== right.accessStatus.simulationCredits) {
      return right.accessStatus.simulationCredits - left.accessStatus.simulationCredits;
    }

    if (left.isOwned !== right.isOwned) {
      return Number(right.isOwned) - Number(left.isOwned);
    }

    return right.sortValue - left.sortValue;
  });

  const selectedCandidate = evaluatedCandidates[0];
  const selectedOrganization =
    selectedCandidate.accessStatus.hasPaidAccess || selectedCandidate.accessStatus.simulationCredits > 0
    ? await ensureOrganizationOwnedByProfile({
        profile,
        organization: selectedCandidate.organization,
        source: "access-status",
      })
    : selectedCandidate.organization;

  return {
    organization: selectedOrganization,
    subscription: selectedCandidate.subscription,
    accessStatus: selectedCandidate.accessStatus,
    error: null,
  };
}

function buildAccessStatusPayload({ profile, organization, subscription, accessStatus }) {
  return {
    has_paid_access: accessStatus.hasPaidAccess,
    source: accessStatus.source,
    simulation_credits: normalizeSimulationCredits(accessStatus.simulationCredits),
    profile_id: profile?.id ?? null,
    profile_email: normalizeOptionalString(profile?.email) ?? null,
    organization_id: organization?.id ?? null,
    billing_plan: normalizeOptionalString(organization?.billing_plan) ?? null,
    billing_status: normalizeOptionalString(organization?.billing_status) ?? null,
    billing_current_period_end: organization?.billing_current_period_end ?? null,
    billing_cancel_at_period_end: Boolean(organization?.billing_cancel_at_period_end),
    stripe_customer_id: normalizeOptionalString(organization?.stripe_customer_id) ?? null,
    stripe_subscription_id:
      normalizeOptionalString(organization?.stripe_subscription_id) ??
      normalizeOptionalString(subscription?.stripe_subscription_id) ??
      null,
    subscription_status: normalizeOptionalString(subscription?.status) ?? null,
    subscription_org_id: normalizeOptionalString(subscription?.org_id) ?? null,
    subscription_plan_id: normalizeOptionalString(subscription?.plan_id) ?? null,
  };
}

async function findLatestStripeSubscriptionForProfile(profile) {
  if (!profile?.id) {
    return null;
  }

  try {
    const searchResult = await stripe.subscriptions.search({
      query: `metadata['profile_id']:'${profile.id}'`,
      limit: 10,
    });

    const activeLikeSubscriptions = (searchResult.data ?? []).filter((subscription) =>
      premiumUnlockStatuses.has(normalizeSubscriptionStatus(subscription.status))
    );

    activeLikeSubscriptions.sort((left, right) => (right.created ?? 0) - (left.created ?? 0));
    return activeLikeSubscriptions[0] ?? null;
  } catch (error) {
    console.error("[stripe:access-status] Stripe subscription search failed", {
      profileId: profile.id,
      email: profile.email ?? null,
      error: serializeOperationalError(error),
    });
    return null;
  }
}

async function reconcilePremiumAccessFromStripe(profile) {
  const stripeSubscription = await findLatestStripeSubscriptionForProfile(profile);

  if (!stripeSubscription) {
    console.info("[stripe:access-status] No Stripe subscription found for profile", {
      profileId: profile.id,
      email: profile.email ?? null,
    });
    return null;
  }

  const metadata = resolveStripeMetadata({
    sessionMetadata: null,
    subscriptionMetadata: stripeSubscription.metadata,
  });
  const primaryItem = getSubscriptionPrimaryItem(stripeSubscription);
  const stripePriceId = getStripePriceId(primaryItem?.price);
  const stripeCustomerId = getStripeCustomerId(stripeSubscription.customer);
  const billingCycle = getStripePriceInterval(primaryItem?.price);
  const plan = await resolvePlanForStripeContext({
    metadata,
    stripePriceId,
  });

  let organization = null;

  if (metadata?.organization_id && isUuid(metadata.organization_id)) {
    const { data, error } = await getOrganizationById(metadata.organization_id);

    if (error) {
      console.error("[stripe:access-status] Organization lookup by Stripe metadata failed", {
        profileId: profile.id,
        organizationId: metadata.organization_id,
        error,
      });
      return null;
    }

    organization = data ?? null;
  }

  if (!organization) {
    try {
      const resolvedOrganizationId = await resolveCheckoutOrganization({
        profile,
        requestedOrganizationId: null,
      });
      const { data, error } = await getOrganizationById(resolvedOrganizationId);

      if (error) {
        console.error("[stripe:access-status] Organization resolution failed during reconcile", {
          profileId: profile.id,
          resolvedOrganizationId,
          error,
        });
        return null;
      }

      organization = data ?? null;
    } catch (error) {
      console.error("[stripe:access-status] Checkout organization resolution failed", {
        profileId: profile.id,
        error: serializeOperationalError(error),
      });
      return null;
    }
  }

  if (!organization) {
    return null;
  }

  await syncStripeCustomerReferences({
    profile,
    organization,
    stripeCustomerId,
  });

  const linkedOrganization = await ensureOrganizationOwnedByProfile({
    profile,
    organization,
    source: "access-status-reconcile",
  });

  await upsertStripeSubscriptionInSupabase({
    subscription: stripeSubscription,
    profile,
    organization: linkedOrganization,
    plan,
    stripeCustomerId,
    stripeCheckoutSessionId: null,
    stripePriceId,
    customerEmail: profile.email ?? null,
    billingCycle: normalizeBillingCycle(billingCycle),
    source: "access-status-reconcile",
    checkoutMode: "subscription",
    checkoutPaymentStatus: null,
  });

  console.info("[stripe:access-status] Reconciled premium access from Stripe", {
    profileId: profile.id,
    email: profile.email ?? null,
    organizationId: linkedOrganization.id,
    stripeSubscriptionId: stripeSubscription.id,
    stripePriceId,
    planId: plan?.id ?? null,
  });

  return {
    organizationId: linkedOrganization.id,
    stripeSubscriptionId: stripeSubscription.id,
  };
}

async function reconcileMiniAccessFromPendingSessions(profile) {
  try {
    const sessionsResponse = await stripe.checkout.sessions.list({ limit: 100 });
    const normalizedProfileEmail = normalizeOptionalString(profile.email)?.toLowerCase() ?? null;
    const matchingSessions = [];

    for (const session of sessionsResponse.data ?? []) {
      if (
        session.mode !== "payment" ||
        normalizeOneTimeBillingStatus(session.payment_status ?? null) !== "active" ||
        normalizeOptionalString(session.status) !== "complete"
      ) {
        continue;
      }

      const sessionEmail =
        normalizeOptionalString(session.customer_details?.email ?? session.customer_email)?.toLowerCase() ??
        null;
      const sessionProfileId = normalizeOptionalString(session.metadata?.profile_id);
      const sessionClientReferenceId = normalizeOptionalString(session.client_reference_id);

      if (
        sessionProfileId !== profile.id &&
        sessionClientReferenceId !== profile.id &&
        (!normalizedProfileEmail || sessionEmail !== normalizedProfileEmail)
      ) {
        continue;
      }

      const checkoutContext = await loadCheckoutSessionContext(session);
      const checkoutPlan = await resolvePlanForStripeContext({
        metadata: checkoutContext.metadata,
        stripePriceId: checkoutContext.stripePriceId,
      });

      if (checkoutPlan?.name !== "fipla_private_mini") {
        continue;
      }

      matchingSessions.push(checkoutContext);
    }

    matchingSessions.sort(
      (left, right) => (right.session?.created ?? 0) - (left.session?.created ?? 0)
    );

    const latestMiniSession = matchingSessions[0] ?? null;

    if (!latestMiniSession) {
      console.info("[stripe:access-status] No Stripe Mini session found for profile", {
        profileId: profile.id,
        email: profile.email ?? null,
      });
      return null;
    }

    const {
      profile: resolvedStripeProfile,
      organization,
    } = await findUserByStripeContext({
      metadata: latestMiniSession.metadata,
      stripeCustomerId: latestMiniSession.stripeCustomerId,
      customerEmail: latestMiniSession.customerEmail,
    });

    if (resolvedStripeProfile?.id && resolvedStripeProfile.id !== profile.id) {
      return null;
    }

    if (!organization) {
      return null;
    }

    await syncStripeCustomerReferences({
      profile,
      organization,
      stripeCustomerId: latestMiniSession.stripeCustomerId,
    });

    const linkedOrganization = await ensureOrganizationOwnedByProfile({
      profile,
      organization,
      source: "access-status-mini-reconcile",
    });

    const currentCredits = getSimulationCreditsFromOrganization(linkedOrganization);
    const consumedAtTimestamp = linkedOrganization?.billing_private_mini_consumed_at
      ? Date.parse(linkedOrganization.billing_private_mini_consumed_at)
      : Number.NaN;
    const latestSessionTimestamp = (latestMiniSession.session?.created ?? 0) * 1000;

    if (
      currentCredits <= 0 &&
      Number.isFinite(consumedAtTimestamp) &&
      latestSessionTimestamp <= consumedAtTimestamp
    ) {
      console.info("[stripe:access-status] Latest Mini session already consumed", {
        profileId: profile.id,
        email: profile.email ?? null,
        organizationId: linkedOrganization.id,
        checkoutSessionId: latestMiniSession.sessionId,
        consumedAt: linkedOrganization.billing_private_mini_consumed_at,
      });
      return null;
    }

    const checkoutPlan = await resolvePlanForStripeContext({
      metadata: latestMiniSession.metadata,
      stripePriceId: latestMiniSession.stripePriceId,
    });

    await persistOneTimePaymentInSupabase({
      profile,
      organization: linkedOrganization,
      plan: checkoutPlan,
      stripeCustomerId: latestMiniSession.stripeCustomerId,
      stripePriceId: latestMiniSession.stripePriceId,
      checkoutPaymentStatus: latestMiniSession.session?.payment_status ?? null,
      source: "access-status-mini-reconcile",
    });

    const grantResult = await grantMiniSimulationCreditIfEligible({
      organization: linkedOrganization,
      plan: checkoutPlan,
      profile,
      checkoutSessionId: latestMiniSession.sessionId,
      checkoutPaymentStatus: latestMiniSession.session?.payment_status ?? null,
      source: "access-status-mini-reconcile",
    });

    console.info("[stripe:access-status] Reconciled Mini credit from Stripe", {
      profileId: profile.id,
      email: profile.email ?? null,
      organizationId: grantResult.organization?.id ?? linkedOrganization.id,
      checkoutSessionId: latestMiniSession.sessionId,
      simulationCredits: grantResult.simulationCredits,
      creditGranted: grantResult.creditGranted,
    });

    return {
      organizationId: grantResult.organization?.id ?? linkedOrganization.id,
      checkoutSessionId: latestMiniSession.sessionId,
    };
  } catch (error) {
    console.error("[stripe:access-status] Mini Stripe reconcile failed", {
      profileId: profile.id,
      email: profile.email ?? null,
      error: serializeOperationalError(error),
    });
    return null;
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

  const linkedOrganization = await ensureOrganizationOwnedByProfile({
    profile,
    organization,
    source: event.type,
  });

  if (!checkoutContext.subscription) {
    const plan = await resolvePlanForStripeContext({
      metadata: checkoutContext.metadata,
      stripePriceId: checkoutContext.stripePriceId,
    });

    console.info("[stripe:webhook] one-time payment detected", {
      eventId: event.id,
      sessionId: checkoutContext.sessionId,
      organizationId: organization.id,
      profileId: profile?.id ?? null,
      stripePriceId: checkoutContext.stripePriceId,
      planId: plan?.id ?? checkoutContext.metadata?.plan_id ?? null,
      paymentStatus: checkoutContext.session?.payment_status ?? null,
    });

    await persistOneTimePaymentInSupabase({
      profile,
      organization: linkedOrganization,
      plan,
      stripeCustomerId: checkoutContext.stripeCustomerId,
      stripePriceId: checkoutContext.stripePriceId,
      checkoutPaymentStatus: checkoutContext.session?.payment_status ?? null,
      source: event.type,
    });

    await grantMiniSimulationCreditIfEligible({
      organization: linkedOrganization,
      plan,
      profile,
      checkoutSessionId: checkoutContext.sessionId,
      checkoutPaymentStatus: checkoutContext.session?.payment_status ?? null,
      source: `${event.type}:mini-credit`,
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
    organization: linkedOrganization,
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

  const linkedOrganization = await ensureOrganizationOwnedByProfile({
    profile,
    organization,
    source: event.type,
  });

  await upsertStripeSubscriptionInSupabase({
    subscription,
    profile,
    organization: linkedOrganization,
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

app.get("/api/stripe/debug/access-status-by-email/:email", async (req, res) => {
  if (!isDevelopmentLike) {
    return res.status(404).json({ error: "Not found" });
  }

  const email = normalizeOptionalString(req.params.email);

  if (!email) {
    return res.status(400).json({ error: "Email requis" });
  }

  const { data: profile, error: profileError } = await getProfileByEmail(email);

  if (profileError) {
    return res.status(500).json({
      error: "Impossible de lire le profil",
      details: profileError.message,
      email,
    });
  }

  if (!profile) {
    return res.status(404).json({
      error: "Profil introuvable",
      email,
    });
  }

  const accessResolution = await resolveAccessOrganizationForProfile(profile);

  if (accessResolution.error) {
    return res.status(500).json({
      error: "Impossible de resoudre l'accès premium",
      details: accessResolution.error.message,
      email,
      profile_id: profile.id,
    });
  }

  const payload = buildAccessStatusPayload({
    profile,
    organization: accessResolution.organization,
    subscription: accessResolution.subscription,
    accessStatus: accessResolution.accessStatus,
  });

  console.info("[stripe:debug] access-status by email", payload);

  return res.json(payload);
});

app.get("/api/stripe/access-status", async (req, res) => {
  const resolvedProfileContext = await resolveProfileFromAuthorizationHeader(req);

  if (resolvedProfileContext.error) {
    return res.status(401).json({
      error: "Authentification requise pour lire le statut d'accès",
      details: serializeOperationalError(resolvedProfileContext.error).message,
    });
  }

  const profile = resolvedProfileContext.profile;

  if (!profile) {
    return res.status(404).json({
      has_paid_access: false,
      source: null,
      simulation_credits: 0,
      profile_id: null,
      organization_id: null,
      billing_plan: null,
      billing_status: null,
      billing_current_period_end: null,
      billing_cancel_at_period_end: false,
      subscription_status: null,
      stripe_subscription_id: null,
    });
  }

  const {
    organization,
    subscription,
    accessStatus,
    error: accessResolutionError,
  } = await resolveAccessOrganizationForProfile(profile);

  if (accessResolutionError) {
    return res.status(500).json({
      error: "Impossible de lire l'organisation pour ce profil",
      details: accessResolutionError.message,
    });
  }

  if (!organization) {
    return res.json({
      has_paid_access: false,
      source: null,
      simulation_credits: 0,
      profile_id: profile.id,
      organization_id: null,
      billing_plan: null,
      billing_status: null,
      billing_current_period_end: null,
      billing_cancel_at_period_end: false,
      subscription_status: null,
      stripe_subscription_id: null,
    });
  }

  let resolvedOrganization = organization;
  let resolvedSubscription = subscription;
  let resolvedAccessStatus = accessStatus;

  if (
    !resolvedAccessStatus.hasPaidAccess &&
    normalizeSimulationCredits(resolvedAccessStatus.simulationCredits) <= 0
  ) {
    await reconcilePremiumAccessFromStripe(profile);
    await reconcileMiniAccessFromPendingSessions(profile);

    const retriedResolution = await resolveAccessOrganizationForProfile(profile);

    if (retriedResolution.error) {
      return res.status(500).json({
        error: "Impossible de relire l'accès premium apres reconciliation Stripe",
        details: retriedResolution.error.message,
      });
    }

    resolvedOrganization = retriedResolution.organization;
    resolvedSubscription = retriedResolution.subscription;
    resolvedAccessStatus = retriedResolution.accessStatus;
  }

  const payload = buildAccessStatusPayload({
    profile,
    organization: resolvedOrganization,
    subscription: resolvedSubscription,
    accessStatus: resolvedAccessStatus,
  });

  console.info("[stripe:access-status] resolved", payload);

  return res.json(payload);
});

app.post("/api/stripe/cancel-subscription", async (req, res) => {
  const resolvedProfileContext = await resolveProfileFromAuthorizationHeader(req);

  if (resolvedProfileContext.error) {
    return res.status(401).json({
      error: "Authentification requise pour résilier l'abonnement",
      details: serializeOperationalError(resolvedProfileContext.error).message,
    });
  }

  const profile = resolvedProfileContext.profile;

  if (!profile) {
    return res.status(404).json({
      error: "Profil introuvable pour cette résiliation",
    });
  }

  const {
    organization,
    subscription,
    error: accessResolutionError,
  } = await resolveAccessOrganizationForProfile(profile);

  if (accessResolutionError) {
    return res.status(500).json({
      error: "Impossible de lire l'organisation pour cette résiliation",
      details: accessResolutionError.message,
    });
  }

  if (!organization) {
    return res.status(404).json({
      error: "Aucune organisation rattachee a ce profil",
    });
  }

  const normalizedBillingPlan = normalizeOptionalString(organization.billing_plan);
  const stripeSubscriptionId =
    normalizeOptionalString(organization.stripe_subscription_id) ??
    normalizeOptionalString(subscription?.stripe_subscription_id);

  if (!stripeSubscriptionId || !premiumBillingPlans.has(normalizedBillingPlan ?? "")) {
    return res.status(409).json({
      error: "Aucun abonnement recurrent actif a resilier",
      organization_id: organization.id,
      billing_plan: normalizedBillingPlan,
    });
  }

  try {
    let stripeSubscription = await stripe.subscriptions.retrieve(stripeSubscriptionId, {
      expand: ["items.data.price"],
    });

    if (!stripeSubscription.cancel_at_period_end) {
      await stripe.subscriptions.update(stripeSubscriptionId, {
        cancel_at_period_end: true,
      });

      stripeSubscription = await stripe.subscriptions.retrieve(stripeSubscriptionId, {
        expand: ["items.data.price"],
      });
    }

    const primaryItem = getSubscriptionPrimaryItem(stripeSubscription);
    const stripePriceId = getStripePriceId(primaryItem?.price);
    const billingCycle = normalizeBillingCycle(getStripePriceInterval(primaryItem?.price));
    const metadata = resolveStripeMetadata({
      sessionMetadata: null,
      subscriptionMetadata: stripeSubscription.metadata,
    });
    const plan = await resolvePlanForStripeContext({
      metadata,
      stripePriceId,
    });
    const stripeCustomerId = getStripeCustomerId(stripeSubscription.customer);

    await syncStripeCustomerReferences({
      profile,
      organization,
      stripeCustomerId,
    });

    const linkedOrganization = await ensureOrganizationOwnedByProfile({
      profile,
      organization,
      source: "cancel-subscription",
    });

    const { data: existingSubscriptionRow, error: existingSubscriptionError } =
      await getSubscriptionRowByStripeSubscriptionId(stripeSubscription.id);

    if (existingSubscriptionError) {
      return res.status(500).json({
        error: "Impossible de lire l'abonnement local avant mise a jour",
        details: existingSubscriptionError.message,
      });
    }

    if (existingSubscriptionRow) {
      const updatedRows = await updateStripeSubscriptionSnapshot({
        subscription: stripeSubscription,
        plan,
        stripeCustomerId,
        stripePriceId,
        billingCycle,
        source: "cancel-subscription",
      });

      if (updatedRows === null) {
        return res.status(500).json({
          error: "Impossible de synchroniser l'abonnement apres la résiliation Stripe",
        });
      }
    } else {
      const upsertedSubscription = await upsertStripeSubscriptionInSupabase({
        subscription: stripeSubscription,
        profile,
        organization: linkedOrganization,
        plan,
        stripeCustomerId,
        stripeCheckoutSessionId: null,
        stripePriceId,
        customerEmail: profile.email ?? null,
        billingCycle,
        source: "cancel-subscription",
        checkoutMode: "subscription",
        checkoutPaymentStatus: null,
      });

      if (upsertedSubscription === null) {
        return res.status(500).json({
          error: "Impossible de creer la trace locale de l'abonnement apres la résiliation Stripe",
        });
      }
    }

    const { data: refreshedOrganization, error: refreshedOrganizationError } =
      await getOrganizationById(linkedOrganization.id);

    if (refreshedOrganizationError) {
      return res.status(500).json({
        error: "Impossible de relire l'organisation apres la résiliation",
        details: refreshedOrganizationError.message,
      });
    }

    const { data: refreshedSubscription, error: refreshedSubscriptionError } =
      await getLatestSubscriptionByOrganizationId(linkedOrganization.id);

    if (refreshedSubscriptionError) {
      return res.status(500).json({
        error: "Impossible de relire l'abonnement apres la résiliation",
        details: refreshedSubscriptionError.message,
      });
    }

    const resolvedOrganization = refreshedOrganization ?? linkedOrganization;
    const resolvedSubscription = refreshedSubscription ?? subscription;
    const payload = buildAccessStatusPayload({
      profile,
      organization: resolvedOrganization,
      subscription: resolvedSubscription,
      accessStatus: hasPaidAccessFromBillingContext({
        organization: resolvedOrganization,
        subscription: resolvedSubscription,
      }),
    });

    console.info("[stripe:cancel-subscription] success", {
      profileId: profile.id,
      organizationId: resolvedOrganization.id,
      stripeSubscriptionId: stripeSubscription.id,
      billingPlan: resolvedOrganization.billing_plan ?? null,
      cancelAtPeriodEnd: resolvedOrganization.billing_cancel_at_period_end ?? null,
      currentPeriodEnd: resolvedOrganization.billing_current_period_end ?? null,
    });

    return res.json(payload);
  } catch (error) {
    const serializedError = serializeOperationalError(error);
    console.error("[stripe:cancel-subscription] failed", {
      profileId: profile.id,
      organizationId: organization.id,
      stripeSubscriptionId,
      error: serializedError,
    });
    return res.status(500).json({
      error: serializedError.message,
      details: serializedError.details,
      code: serializedError.code,
      type: serializedError.type,
    });
  }
});

app.post("/api/stripe/reconcile-checkout-session", async (req, res) => {
  try {
    const resolvedProfileContext = await resolveProfileFromAuthorizationHeader(req);

    if (resolvedProfileContext.error) {
      return res.status(401).json({
        error: "Authentification requise pour reconciler la session Stripe",
        details: serializeOperationalError(resolvedProfileContext.error).message,
      });
    }

    const profile = resolvedProfileContext.profile;
    const sessionId = normalizeOptionalString(req.body?.session_id);

    if (!profile) {
      return res.status(404).json({
        error: "Profil introuvable pour cette reconciliation Stripe",
      });
    }

    if (!sessionId) {
      return res.status(400).json({
        error: "session_id requis pour reconciler le paiement Stripe",
      });
    }

    const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId);
    const checkoutContext = await loadCheckoutSessionContext(checkoutSession);

    const metadataProfileId = normalizeOptionalString(checkoutContext.metadata?.profile_id);

    if (metadataProfileId && metadataProfileId !== profile.id) {
      return res.status(403).json({
        error: "Cette session Stripe n'appartient pas au profil connecte",
        session_id: sessionId,
        profile_id: profile.id,
        metadata_profile_id: metadataProfileId,
      });
    }

    const { profile: resolvedStripeProfile, organization } = await findUserByStripeContext({
      metadata: checkoutContext.metadata,
      stripeCustomerId: checkoutContext.stripeCustomerId,
      customerEmail: checkoutContext.customerEmail,
    });

    if (resolvedStripeProfile?.id && resolvedStripeProfile.id !== profile.id) {
      return res.status(403).json({
        error: "Cette session Stripe est rattachee a un autre profil",
        session_id: sessionId,
        profile_id: profile.id,
        resolved_profile_id: resolvedStripeProfile.id,
      });
    }

    if (!organization) {
      return res.status(404).json({
        error: "Aucune organisation resolue pour cette session Stripe",
        session_id: sessionId,
      });
    }

    await syncStripeCustomerReferences({
      profile,
      organization,
      stripeCustomerId: checkoutContext.stripeCustomerId,
    });

    const linkedOrganization = await ensureOrganizationOwnedByProfile({
      profile,
      organization,
      source: "reconcile-checkout-session",
    });

    const plan = await resolvePlanForStripeContext({
      metadata: checkoutContext.metadata,
      stripePriceId: checkoutContext.stripePriceId,
    });

    if (checkoutContext.subscription || checkoutContext.session?.mode === "subscription") {
      return res.json({
        session_id: sessionId,
        plan_name: plan?.name ?? null,
        mode: checkoutContext.session?.mode ?? null,
        payment_status: checkoutContext.session?.payment_status ?? null,
        simulation_credits: getSimulationCreditsFromOrganization(linkedOrganization),
        credit_granted: false,
        organization_id: linkedOrganization.id,
      });
    }

    await persistOneTimePaymentInSupabase({
      profile,
      organization: linkedOrganization,
      plan,
      stripeCustomerId: checkoutContext.stripeCustomerId,
      stripePriceId: checkoutContext.stripePriceId,
      checkoutPaymentStatus: checkoutContext.session?.payment_status ?? null,
      source: "reconcile-checkout-session",
    });

    const grantResult = await grantMiniSimulationCreditIfEligible({
      organization: linkedOrganization,
      plan,
      profile,
      checkoutSessionId: checkoutContext.sessionId,
      checkoutPaymentStatus: checkoutContext.session?.payment_status ?? null,
      source: "reconcile-checkout-session",
    });

    return res.json({
      session_id: sessionId,
      plan_name: plan?.name ?? null,
      mode: checkoutContext.session?.mode ?? null,
      payment_status: checkoutContext.session?.payment_status ?? null,
      simulation_credits: grantResult.simulationCredits,
      credit_granted: grantResult.creditGranted,
      organization_id: grantResult.organization?.id ?? linkedOrganization.id,
    });
  } catch (error) {
    const serializedError = serializeOperationalError(error);
    console.error("[stripe:reconcile-checkout-session] failed", serializedError);
    return res.status(500).json({
      error: serializedError.message,
      details: serializedError.details,
      code: serializedError.code,
      type: serializedError.type,
    });
  }
});

app.post("/api/stripe/consume-simulation-credit", async (req, res) => {
  const resolvedProfileContext = await resolveProfileFromAuthorizationHeader(req);

  if (resolvedProfileContext.error) {
    return res.status(401).json({
      error: "Authentification requise pour consommer un credit de simulation",
      details: serializeOperationalError(resolvedProfileContext.error).message,
    });
  }

  const profile = resolvedProfileContext.profile;

  if (!profile) {
    return res.status(404).json({
      error: "Profil introuvable pour ce credit de simulation",
    });
  }

  const {
    organization,
    accessStatus,
    error: accessResolutionError,
  } = await resolveAccessOrganizationForProfile(profile);

  if (accessResolutionError) {
    return res.status(500).json({
      error: "Impossible de lire l'organisation pour consommer un credit",
      details: accessResolutionError.message,
    });
  }

  if (!organization) {
    return res.status(404).json({
      error: "Aucune organisation rattachee a ce profil",
    });
  }

  const availableCredits = normalizeSimulationCredits(accessStatus.simulationCredits);

  if (availableCredits <= 0) {
    return res.status(409).json({
      error: "Aucun credit de simulation disponible",
      simulation_credits: 0,
      organization_id: organization.id,
    });
  }

  const updatedOrganization = await setOrganizationSimulationCredits({
    organization,
    nextCredits: availableCredits - 1,
    source: "consume-simulation-credit",
    profile,
  });

  if (!updatedOrganization) {
    return res.status(500).json({
      error: "Impossible de mettre a jour les credits de simulation",
      simulation_credits: availableCredits,
      organization_id: organization.id,
    });
  }

  return res.json({
    simulation_credits: getSimulationCreditsFromOrganization(updatedOrganization),
    organization_id: updatedOrganization.id,
  });
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
      .select("id, name, active, stripe_product_id, stripe_price_id")
      .eq('id', normalizedPlanId)
      .single();

    const checkoutPricing = await resolveValidatedStripeCheckoutPricing(plan);
    const selectedPriceIdRaw = plan?.stripe_price_id;
    const selectedPriceId = checkoutPricing.priceId;

    console.info("[stripe:checkout] selected plan row", {
      requestedPlanId: normalizedPlanId,
      selectedPlanRow: plan ?? null,
    });

    console.info("[stripe:checkout] selected payment type", {
      planId: normalizedPlanId,
      planName: plan?.name ?? null,
      paymentType: checkoutPricing.paymentType,
      checkoutMode: checkoutPricing.checkoutMode,
      sourceColumn: checkoutPricing.sourceColumn,
      resolvedFrom: checkoutPricing.resolvedFrom ?? null,
    });

    console.info("[stripe:checkout] selected price id", {
      planId: normalizedPlanId,
      planName: plan?.name ?? null,
      sourceColumn: checkoutPricing.sourceColumn,
      rawPriceId: selectedPriceIdRaw ?? null,
      normalizedPriceId: selectedPriceId,
      hadWhitespace:
        typeof selectedPriceIdRaw === "string" && selectedPriceIdRaw !== selectedPriceId,
      diagnostics: checkoutPricing.diagnostics ?? null,
    });

    console.info("[stripe:checkout] selected checkout mode", {
      planId: normalizedPlanId,
      checkoutMode: checkoutPricing.checkoutMode,
    });

    const stripeAccountDiagnostics = await getStripeAccountDiagnostics();
    console.info("[stripe:checkout] stripe account diagnostics", stripeAccountDiagnostics);

    if (
      planError ||
      !plan ||
      !selectedPriceId ||
      !checkoutPricing.checkoutMode ||
      checkoutPricing.resolutionError
    ) {
      console.error("[stripe:checkout] plan lookup failed", {
        plan_id: normalizedPlanId,
        planError,
        plan,
        selectedPriceIdRaw: selectedPriceIdRaw ?? null,
        selectedPriceId,
        checkoutMode: checkoutPricing.checkoutMode,
        paymentType: checkoutPricing.paymentType,
        resolvedFrom: checkoutPricing.resolvedFrom ?? null,
        resolutionError: checkoutPricing.resolutionError ?? null,
        diagnostics: checkoutPricing.diagnostics ?? null,
      });
      return res.status(409).json({
        error: checkoutPricing.resolutionError || "Plan introuvable ou non configure avec stripe_price_id.",
        details:
          plan?.name === "fipla_private_mini"
            ? `Mini attend un price Stripe one-time CHF 9. price configure: ${selectedPriceIdRaw ?? "absent"}.`
            : plan?.name === "fipla_private_full"
              ? `Full attend un price Stripe recurring mensuel CHF 29. price configure: ${selectedPriceIdRaw ?? "absent"}.`
              : plan?.name === "fipla_pro_solo"
                ? `Pro Solo attend un price Stripe recurring mensuel CHF 59. price configure: ${selectedPriceIdRaw ?? "absent"}.`
                : null,
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

    if (plan?.name === "fipla_private_mini") {
      const { data: checkoutOrganization, error: checkoutOrganizationError } =
        await getOrganizationById(resolvedOrganizationId);

      if (checkoutOrganizationError) {
        console.error("[stripe:checkout] Mini pending session organization lookup failed", {
          profileId: profile.id,
          organizationId: resolvedOrganizationId,
          sessionId: session.id,
          error: checkoutOrganizationError,
        });
      } else if (checkoutOrganization) {
        await recordPendingMiniCheckoutSession({
          organization: checkoutOrganization,
          checkoutSessionId: session.id,
          source: "create-checkout-session",
          profile,
        });
      }
    }

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
