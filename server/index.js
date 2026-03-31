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
  },
});

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

    if (!plan_id || !success_url || !cancel_url) {
      return res.status(400).json({ error: 'plan_id, success_url and cancel_url are required' });
    }

    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select('stripe_price_id')
      .eq('id', plan_id)
      .single();

    if (planError || !plan || !plan.stripe_price_id) {
      console.error('Plan not found or stripe_price_id missing', { plan_id, planError, plan });
      return res.status(404).json({ error: 'Plan introuvable ou non configuré avec stripe_price_id' });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: plan.stripe_price_id, quantity: 1 }],
      success_url,
      cancel_url,
      metadata: {
        plan_id,
        profile_id: profile_id ?? '',
        organization_id: organization_id ?? '',
      },
    });

    return res.json({ url: session.url, id: session.id });
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

        const organization_id = session.metadata?.organization_id;
        const profile_id = session.metadata?.profile_id;
        const plan_id = session.metadata?.plan_id;

        if (!organization_id || !profile_id || !plan_id) {
          console.warn('[stripe:webhook] checkout.session.completed missing metadata', {
            profile_id,
            organization_id,
            plan_id,
          });
        } else {
          const subscriptionPayload = buildSubscriptionPayload({
            subscription,
            profileId: profile_id,
            organizationId: organization_id,
            planId: plan_id,
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
      console.info('[stripe:webhook] processing subscription lifecycle event', {
        eventId: event.id,
        eventType: event.type,
        subscriptionId: subscription.id,
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
