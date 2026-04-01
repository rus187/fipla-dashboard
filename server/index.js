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
  if (req.path === '/api/stripe/webhook') {
    return next();
  }

  return jsonParser(req, res, next);
});

const formatStripeTimestamp = (value) =>
  value ? new Date(value * 1000).toISOString() : null;

const normalizeOptionalString = (value) => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
};

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

const buildSubscriptionPayload = ({ subscription, profileId, organizationId, planId }) => ({
  profile_id: profileId,
  organization_id: organizationId,
  plan_id: planId || null,
  stripe_subscription_id: subscription.id,
  subscription_status: subscription.status,
  current_period_start: formatStripeTimestamp(subscription.current_period_start),
  current_period_end: formatStripeTimestamp(subscription.current_period_end),
  cancel_at: formatStripeTimestamp(subscription.cancel_at),
  canceled_at: formatStripeTimestamp(subscription.canceled_at),
  trial_end: formatStripeTimestamp(subscription.trial_end),
  quantity: subscription.items?.data?.[0]?.quantity ?? subscription.quantity ?? 1,
  metadata: {
    stripe_customer_id: subscription.customer,
    billing_cycle: subscription.items?.data?.[0]?.price?.recurring?.interval ?? null,
    cancel_at_period_end: subscription.cancel_at_period_end ?? false,
    stripe_metadata: {
      profile_id: normalizeOptionalString(subscription.metadata?.profile_id),
      organization_id: normalizeOptionalString(subscription.metadata?.organization_id),
      plan_id: normalizeOptionalString(subscription.metadata?.plan_id),
    },
  },
});

async function getProfileById(profileId) {
  return supabase
    .from("profiles")
    .select("id, email")
    .eq("id", profileId)
    .maybeSingle();
}

async function getOrganizationById(organizationId) {
  return supabase
    .from("organizations")
    .select("id, owner_id, name")
    .eq("id", organizationId)
    .maybeSingle();
}

async function getOwnedOrganization(profileId) {
  return supabase
    .from("organizations")
    .select("id, owner_id, name")
    .eq("owner_id", profileId)
    .order("created_at", { ascending: true })
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

app.get("/health", (_req, res) => {
  res.send("OK");
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

app.post("/api/stripe/create-checkout-session", async (req, res) => {
  try {
    const { plan_id, success_url, cancel_url, profile_id, organization_id } = req.body;
    const normalizedPlanId = normalizeOptionalString(plan_id);
    const normalizedProfileId = normalizeOptionalString(profile_id);
    const normalizedOrganizationId = normalizeOptionalString(organization_id);

    if (!normalizedPlanId || !success_url || !cancel_url || !normalizedProfileId) {
      return res
        .status(400)
        .json({ error: "plan_id, profile_id, success_url and cancel_url are required" });
    }

    if (!isUuid(normalizedPlanId) || !isUuid(normalizedProfileId)) {
      return res.status(400).json({ error: "plan_id and profile_id must be valid UUIDs" });
    }

    if (normalizedOrganizationId && !isUuid(normalizedOrganizationId)) {
      return res.status(400).json({ error: "organization_id must be a valid UUID when provided" });
    }

    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select('stripe_price_id')
      .eq('id', normalizedPlanId)
      .single();

    if (planError || !plan || !plan.stripe_price_id) {
      console.error('Plan not found or stripe_price_id missing', {
        plan_id: normalizedPlanId,
        planError,
        plan,
      });
      return res.status(404).json({ error: 'Plan introuvable ou non configuré avec stripe_price_id' });
    }

    const { data: profile, error: profileError } = await getProfileById(normalizedProfileId);

    if (profileError) {
      console.error("[stripe:checkout] profile lookup failed", {
        profileId: normalizedProfileId,
        error: profileError,
      });
      return res.status(500).json({ error: "Erreur lecture profile Supabase" });
    }

    if (!profile) {
      return res.status(404).json({ error: "Profile introuvable pour ce checkout" });
    }

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
      stripePriceId: plan.stripe_price_id,
      metadata,
    });

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: plan.stripe_price_id, quantity: 1 }],
      success_url,
      cancel_url,
      metadata,
      subscription_data: {
        metadata,
      },
    });

    console.info("[stripe:checkout] checkout created with metadata", {
      sessionId: session.id,
      url: session.url,
      metadata,
    });

    return res.json({ url: session.url, id: session.id, metadata });
  } catch (error) {
    console.error('create-checkout-session error', error);
    return res.status(500).json({ error: error.message || 'Erreur création session Stripe' });
  }
});

app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const payload = req.body;
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  console.info('[stripe:webhook] request received', {
    contentType: req.headers['content-type'],
    hasSignature: Boolean(sig),
    payloadType: Buffer.isBuffer(payload) ? 'buffer' : typeof payload,
    payloadLength: Buffer.isBuffer(payload) ? payload.length : null,
  });

  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET non défini');
    return res.status(500).send('Webhook non configuré');
  }

  if (!sig) {
    console.error('[stripe:webhook] missing stripe-signature header');
    return res.status(400).send('Missing stripe signature');
  }

  if (!Buffer.isBuffer(payload)) {
    console.error('[stripe:webhook] raw body unavailable before signature check');
    return res.status(400).send('Webhook Error: raw body required');
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(payload, sig, webhookSecret);
    console.info('[stripe:webhook] signature verified', {
      eventId: event.id,
      eventType: event.type,
    });
  } catch (err) {
    console.error('Webhook signature verification failed', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      console.info('[stripe:webhook] processing checkout.session.completed', {
        eventId: event.id,
        sessionId: session.id,
        subscriptionId: session.subscription ?? null,
        metadata: session.metadata ?? null,
      });

      if (session.subscription) {
        const subscription = await stripe.subscriptions.retrieve(session.subscription);
        const metadata = resolveStripeMetadata({
          sessionMetadata: session.metadata,
          subscriptionMetadata: subscription.metadata,
        });

        console.info("[stripe:webhook] checkout metadata resolved", {
          eventId: event.id,
          sessionId: session.id,
          subscriptionId: subscription.id,
          sessionMetadata: session.metadata ?? null,
          subscriptionMetadata: subscription.metadata ?? null,
          resolvedMetadata: metadata,
        });

        if (!metadata.organization_id || !metadata.profile_id || !metadata.plan_id) {
          console.warn('[stripe:webhook] checkout.session.completed missing metadata', {
            profile_id: metadata.profile_id,
            organization_id: metadata.organization_id,
            plan_id: metadata.plan_id,
          });
        } else {
          const subscriptionPayload = buildSubscriptionPayload({
            subscription,
            profileId: metadata.profile_id,
            organizationId: metadata.organization_id,
            planId: metadata.plan_id,
          });

          console.info("[stripe:webhook] subscriptions upsert with profile_id", {
            eventId: event.id,
            sessionId: session.id,
            subscriptionId: subscription.id,
            profileId: metadata.profile_id,
            organizationId: metadata.organization_id,
            planId: metadata.plan_id,
          });

          const { data, error } = await supabase
            .from('subscriptions')
            .upsert(subscriptionPayload, { onConflict: 'stripe_subscription_id' })
            .select('id, stripe_subscription_id, subscription_status, current_period_start, current_period_end')
            .single();

          if (error) {
            console.error('[stripe:webhook] subscriptions upsert failed', {
              eventId: event.id,
              sessionId: session.id,
              subscriptionId: subscription.id,
              error,
              payload: subscriptionPayload,
            });
            throw error;
          }

          console.info('[stripe:webhook] subscriptions upsert ok', {
            eventId: event.id,
            sessionId: session.id,
            row: data,
          });
        }
      }
    }

    if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object;
      const metadata = resolveStripeMetadata({
        sessionMetadata: null,
        subscriptionMetadata: subscription.metadata,
      });

      console.info('[stripe:webhook] processing subscription lifecycle event', {
        eventId: event.id,
        eventType: event.type,
        subscriptionId: subscription.id,
        metadata,
      });

      const updates = {
        subscription_status: subscription.status,
        current_period_start: formatStripeTimestamp(subscription.current_period_start),
        current_period_end: formatStripeTimestamp(subscription.current_period_end),
        cancel_at: formatStripeTimestamp(subscription.cancel_at),
        canceled_at: formatStripeTimestamp(subscription.canceled_at),
        trial_end: formatStripeTimestamp(subscription.trial_end),
        quantity: subscription.items?.data?.[0]?.quantity ?? subscription.quantity ?? 1,
        metadata: {
          stripe_customer_id: subscription.customer,
          billing_cycle: subscription.items?.data?.[0]?.price?.recurring?.interval ?? null,
          cancel_at_period_end: subscription.cancel_at_period_end ?? false,
        },
      };

      const { data, error } = await supabase
        .from('subscriptions')
        .update(updates)
        .select('id, stripe_subscription_id, subscription_status, current_period_start, current_period_end')
        .eq('stripe_subscription_id', subscription.id);

      if (error) {
        console.error('[stripe:webhook] subscriptions update failed', {
          eventId: event.id,
          subscriptionId: subscription.id,
          error,
          updates,
        });
        throw error;
      }

      console.info('[stripe:webhook] subscriptions update ok', {
        eventId: event.id,
        subscriptionId: subscription.id,
        affectedRows: data?.length ?? 0,
      });

      if ((data?.length ?? 0) === 0) {
        if (!metadata.profile_id || !metadata.organization_id) {
          console.warn("[stripe:webhook] lifecycle event cannot upsert missing metadata", {
            eventId: event.id,
            subscriptionId: subscription.id,
            metadata,
          });
        } else {
          const subscriptionPayload = buildSubscriptionPayload({
            subscription,
            profileId: metadata.profile_id,
            organizationId: metadata.organization_id,
            planId: metadata.plan_id,
          });

          console.info("[stripe:webhook] lifecycle fallback upsert with profile_id", {
            eventId: event.id,
            subscriptionId: subscription.id,
            profileId: metadata.profile_id,
            organizationId: metadata.organization_id,
            planId: metadata.plan_id,
          });

          const { data: fallbackData, error: fallbackError } = await supabase
            .from("subscriptions")
            .upsert(subscriptionPayload, { onConflict: "stripe_subscription_id" })
            .select("id, stripe_subscription_id, subscription_status, current_period_start, current_period_end")
            .single();

          if (fallbackError) {
            console.error("[stripe:webhook] lifecycle fallback upsert failed", {
              eventId: event.id,
              subscriptionId: subscription.id,
              error: fallbackError,
              payload: subscriptionPayload,
            });
            throw fallbackError;
          }

          console.info("[stripe:webhook] lifecycle fallback upsert ok", {
            eventId: event.id,
            subscriptionId: subscription.id,
            row: fallbackData,
          });
        }
      }
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('Stripe webhook handling error', err);
    return res.status(500).json({ error: err.message || 'Webhook handling error' });
  }
});

const PORT = 3000;

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
