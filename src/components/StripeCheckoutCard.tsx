import { useEffect, useState } from "react";
import { cancelStripeSubscription } from "../lib/stripe/cancelSubscription";
import { createStripeCheckoutSession } from "../lib/stripe/createCheckoutSession";
import {
  fetchStripeAccessStatus,
  type StripeAccessStatusResponse,
} from "../lib/stripe/fetchAccessStatus";
import { supabaseClient } from "../lib/supabase/client";
import type { Plan } from "../lib/supabase/types";

type StripeCheckoutCardProps = {
  profileId: string | null;
  organizationId?: string | null;
  accessToken?: string;
  onBillingChanged?: () => void;
};

type CheckoutOfferContent = {
  eyebrow: string;
  title: string;
  positioning: string;
  description: string;
  priceLabel: string;
  paymentLabel: string;
  ctaLabel: string;
  highlightLabel?: string;
  benefits: string[];
  footnote: string;
};

type CheckoutOffer = {
  id: string;
  name: string;
  paymentType: "one_time" | "monthly";
  content: CheckoutOfferContent;
};

const OFFER_ORDER = ["fipla_private_mini", "fipla_private_full", "fipla_pro_solo"] as const;

const OFFER_CONTENT: Record<(typeof OFFER_ORDER)[number], CheckoutOfferContent> = {
  fipla_private_mini: {
    eyebrow: "Paiement unique",
    title: "Mini",
    positioning: "La porte d'entrée FIPLA",
    description: "Une entrée simple pour lancer un premier dossier sans engagement mensuel.",
    priceLabel: "9 CHF - achat unique",
    paymentLabel: "Paiement unique",
    ctaLabel: "Choisir Mini",
    benefits: [
      "Accès immédiat à l'offre Mini",
      "Idéal pour un besoin ponctuel",
      "Aucun abonnement mensuel",
    ],
    footnote: "Parfait pour tester le parcours FIPLA sur un besoin cible.",
  },
  fipla_private_full: {
    eyebrow: "Abonnement mensuel",
    title: "Full",
    positioning: "L'offre recommandée",
    description: "La formule private la plus complète pour travailler dans la durée avec plus de confort.",
    priceLabel: "29 CHF / mois",
    paymentLabel: "Abonnement mensuel",
    ctaLabel: "Choisir Full",
    highlightLabel: "Le plus équilibré",
    benefits: [
      "Accès complet à l'offre Private Full",
      "Convient à un usage régulier",
      "Facturation mensuelle lisible",
      "Montée en puissance simple",
    ],
    footnote: "Conçue pour une utilisation récurrente sans complexité inutile.",
  },
  fipla_pro_solo: {
    eyebrow: "Abonnement mensuel",
    title: "Pro Solo",
    positioning: "La formule usage métier",
    description: "La formule orientée conseil pour un usage professionnel plus intensif.",
    priceLabel: "59 CHF / mois",
    paymentLabel: "Abonnement mensuel",
    ctaLabel: "Choisir Pro Solo",
    benefits: [
      "Positionnement Pro Solo",
      "Pensé pour un usage expert",
      "Abonnement mensuel robuste",
      "Accès direct au checkout dédié",
    ],
    footnote: "Recommandé pour une pratique plus soutenue et plus orientée business.",
  },
};

function getCheckoutErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Impossible de créer la session Stripe.";
}

function getPlanDisplayLabel(plan: string | null) {
  if (plan === "private_full") {
    return "Full";
  }

  if (plan === "pro") {
    return "Pro";
  }

  if (plan === "private_mini") {
    return "Mini";
  }

  return "Aucun";
}

function formatAccessDate(value: string | null) {
  if (!value) {
    return null;
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("fr-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(parsedDate);
}

function resolveCheckoutOffer(plan: Plan): CheckoutOffer | null {
  const normalizedName = plan.name as (typeof OFFER_ORDER)[number];
  const content = OFFER_CONTENT[normalizedName];

  if (!content || !plan.active) {
    return null;
  }

  const hasPriceId = typeof plan.stripe_price_id === "string" && plan.stripe_price_id.trim() !== "";

  if (!hasPriceId) {
    return null;
  }

  return {
    id: plan.id,
    name: plan.name,
    paymentType:
      normalizedName === "fipla_private_full" || normalizedName === "fipla_pro_solo"
        ? "monthly"
        : "one_time",
    content,
  };
}

export default function StripeCheckoutCard({
  profileId,
  organizationId = null,
  accessToken = "",
  onBillingChanged,
}: StripeCheckoutCardProps) {
  const [offers, setOffers] = useState<CheckoutOffer[]>([]);
  const [isLoadingOffers, setIsLoadingOffers] = useState(true);
  const [offersError, setOffersError] = useState("");
  const [checkoutError, setCheckoutError] = useState("");
  const [checkoutErrorOfferId, setCheckoutErrorOfferId] = useState<string | null>(null);
  const [activeOfferId, setActiveOfferId] = useState<string | null>(null);
  const [accessStatus, setAccessStatus] = useState<StripeAccessStatusResponse | null>(null);
  const [isLoadingAccessStatus, setIsLoadingAccessStatus] = useState(false);
  const [accessStatusError, setAccessStatusError] = useState("");
  const [cancelError, setCancelError] = useState("");
  const [cancelNotice, setCancelNotice] = useState("");
  const [isCancellingSubscription, setIsCancellingSubscription] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadOffers = async () => {
      setIsLoadingOffers(true);
      setOffersError("");

      const { data, error } = await supabaseClient
        .from("plans")
        .select("id, name, active, stripe_price_id")
        .in("name", [...OFFER_ORDER])
        .eq("active", true);

      if (!isMounted) {
        return;
      }

      if (error) {
        setOffers([]);
        setOffersError("Impossible de charger les offres Stripe pour le moment.");
        setIsLoadingOffers(false);
        return;
      }

      const nextOffers = OFFER_ORDER.map((offerName) =>
        (data ?? []).find((plan) => plan.name === offerName)
      )
        .map((plan) => (plan ? resolveCheckoutOffer(plan as Plan) : null))
        .filter((offer): offer is CheckoutOffer => Boolean(offer));

      setOffers(nextOffers);
      setOffersError(
        nextOffers.length === OFFER_ORDER.length
          ? ""
          : "Certaines offres ne sont pas disponibles actuellement."
      );
      setIsLoadingOffers(false);
    };

    void loadOffers();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadAccessStatus = async () => {
      if (!accessToken) {
        if (isMounted) {
          setAccessStatus(null);
          setAccessStatusError("");
          setIsLoadingAccessStatus(false);
        }
        return;
      }

      setIsLoadingAccessStatus(true);
      setAccessStatusError("");

      try {
        const nextAccessStatus = await fetchStripeAccessStatus(accessToken);

        if (!isMounted) {
          return;
        }

        setAccessStatus(nextAccessStatus);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setAccessStatus(null);
        setAccessStatusError(
          error instanceof Error
            ? error.message
            : "Impossible de lire l'abonnement actuel pour le moment."
        );
      } finally {
        if (isMounted) {
          setIsLoadingAccessStatus(false);
        }
      }
    };

    void loadAccessStatus();

    return () => {
      isMounted = false;
    };
  }, [accessToken]);

  const handleCheckout = async (offer: CheckoutOffer) => {
    if (activeOfferId) {
      return;
    }

    if (!profileId) {
      setCheckoutError("Aucun profil utilisateur disponible pour lancer le paiement.");
      setCheckoutErrorOfferId(offer.id);
      return;
    }

    setActiveOfferId(offer.id);
    setCheckoutError("");
    setCheckoutErrorOfferId(null);

    try {
      const result = await createStripeCheckoutSession({
        planId: offer.id,
        profileId,
        organizationId,
      });

      if (!result.url) {
        throw new Error("Stripe n'a pas renvoyé d'URL de redirection.");
      }

      window.location.assign(result.url);
    } catch (error) {
      setCheckoutError(getCheckoutErrorMessage(error));
      setCheckoutErrorOfferId(offer.id);
      setActiveOfferId(null);
    }
  };

  const hasAvailableOffers = offers.length > 0;
  const isRecurringPremiumPlan =
    accessStatus?.billing_plan === "private_full" || accessStatus?.billing_plan === "pro";
  const canCancelSubscription =
    Boolean(accessStatus?.stripe_subscription_id) &&
    isRecurringPremiumPlan &&
    accessStatus?.subscription_status !== "canceled" &&
    accessStatus?.billing_cancel_at_period_end !== true;
  const isCancellationScheduled =
    Boolean(accessStatus?.stripe_subscription_id) &&
    isRecurringPremiumPlan &&
    accessStatus?.billing_cancel_at_period_end === true;
  const planDisplayLabel = getPlanDisplayLabel(accessStatus?.billing_plan ?? null);
  const currentPeriodEndLabel = formatAccessDate(accessStatus?.billing_current_period_end ?? null);
  const reassuranceItems = [
    "Paiement sécurisé via Stripe",
    "Activation simple après validation",
    "Parcours fluide sans ressaisie technique",
  ];

  const pricingNotes = [
    "Les plans inactifs restent masqués automatiquement.",
    "Le backend conserve seul la résolution du plan, du mode et du type de paiement.",
  ];

  const handleCancelSubscription = async () => {
    if (!accessToken || isCancellingSubscription || !canCancelSubscription) {
      return;
    }

    const shouldCancel = window.confirm(
      "La résiliation stoppera le renouvellement automatique à la fin de la période en cours. Continuer ?"
    );

    if (!shouldCancel) {
      return;
    }

    setIsCancellingSubscription(true);
    setCancelError("");
    setCancelNotice("");

    try {
      const nextAccessStatus = await cancelStripeSubscription(accessToken);
      setAccessStatus(nextAccessStatus);
      setCancelNotice(
        nextAccessStatus.billing_cancel_at_period_end
          ? `Résiliation planifiée${formatAccessDate(nextAccessStatus.billing_current_period_end) ? ` jusqu'au ${formatAccessDate(nextAccessStatus.billing_current_period_end)}` : ""}.`
          : "Résiliation enregistrée."
      );
      onBillingChanged?.();
    } catch (error) {
      setCancelError(
        error instanceof Error ? error.message : "Impossible de résilier l'abonnement."
      );
    } finally {
      setIsCancellingSubscription(false);
    }
  };

  return (
    <section
      style={{
        marginBottom: "24px",
        padding: "28px",
        borderRadius: "28px",
        border: "1px solid rgba(148, 163, 184, 0.22)",
        background:
          "radial-gradient(circle at top left, rgba(219, 234, 254, 0.95), rgba(255, 255, 255, 0.98) 38%), linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
        boxShadow: "0 28px 65px rgba(15, 23, 42, 0.08)",
        display: "grid",
        gap: "24px",
      }}
    >
      <div
        style={{
          display: "grid",
          gap: "18px",
          paddingBottom: "4px",
          borderBottom: "1px solid rgba(148, 163, 184, 0.16)",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            width: "fit-content",
            minHeight: "30px",
            padding: "0 12px",
            borderRadius: "999px",
            background: "rgba(15, 23, 42, 0.06)",
            color: "#17324d",
            fontSize: "12px",
            fontWeight: 800,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          Tarification FIPLA
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "20px",
            alignItems: "start",
          }}
        >
          <div style={{ display: "grid", gap: "12px" }}>
            <h2
              style={{
                margin: 0,
                fontSize: "clamp(30px, 4vw, 46px)",
                lineHeight: 1.05,
                color: "#0f172a",
                letterSpacing: "-0.03em",
              }}
            >
              Choisissez l'offre FIPLA adaptée à votre rythme de travail.
            </h2>
            <p
              style={{
                margin: 0,
                maxWidth: "760px",
                fontSize: "16px",
                lineHeight: 1.8,
                color: "#334155",
              }}
            >
              Une entrée simple pour démarrer, une formule recommandée pour un usage régulier, et
              une offre Pro Solo pour une pratique plus soutenue. Le parcours reste clair, rapide
              et sécurisé jusqu'au paiement.
            </p>
          </div>

          <div
            style={{
              borderRadius: "22px",
              padding: "18px",
              background: "rgba(255, 255, 255, 0.88)",
              border: "1px solid rgba(148, 163, 184, 0.18)",
              display: "grid",
              gap: "10px",
            }}
          >
            <div style={{ fontSize: "13px", fontWeight: 800, color: "#17324d", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Pourquoi cette page
            </div>
            <div style={{ fontSize: "14px", color: "#334155", lineHeight: 1.7 }}>
              L'objectif est de vous aider à choisir rapidement la bonne formule, sans exposer de
              détails techniques ni complexifier le checkout.
            </div>
            <div style={{ fontSize: "13px", color: "#64748b", lineHeight: 1.6 }}>
              Offre recommandée : <strong style={{ color: "#1d4ed8" }}>FIPLA Private Full</strong>
            </div>
          </div>
        </div>
      </div>

      {isLoadingAccessStatus || accessStatus || accessStatusError || cancelError || cancelNotice ? (
        <div
          style={{
            display: "grid",
            gap: "14px",
            padding: "18px",
            borderRadius: "22px",
            background: "rgba(255, 255, 255, 0.9)",
            border: "1px solid rgba(148, 163, 184, 0.18)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "14px",
              alignItems: "start",
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "grid", gap: "6px" }}>
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: 800,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "#17324d",
                }}
              >
                Gestion de l'abonnement
              </div>
              <div style={{ fontSize: "20px", fontWeight: 800, color: "#0f172a" }}>
                {isLoadingAccessStatus ? "Lecture de l'accès en cours..." : `Plan actuel : ${planDisplayLabel}`}
              </div>
              <div style={{ fontSize: "14px", lineHeight: 1.6, color: "#475569" }}>
                {isCancellationScheduled
                  ? currentPeriodEndLabel
                    ? `Le renouvellement automatique est arrêté. L'accès reste actif jusqu'au ${currentPeriodEndLabel}.`
                    : "Le renouvellement automatique est arrêté et l'accès reste actif jusqu'à la fin de la période en cours."
                  : canCancelSubscription
                    ? currentPeriodEndLabel
                      ? `Abonnement récurrent actif jusqu'au ${currentPeriodEndLabel}, puis renouvelé automatiquement tant qu'il n'est pas résilié.`
                      : "Abonnement récurrent actif avec renouvellement automatique."
                    : accessStatus?.billing_plan === "private_mini"
                      ? "Le plan Mini reste un achat ponctuel et n'affiche donc pas de résiliation d'abonnement."
                      : "Aucun abonnement récurrent actif détecté sur ce compte."}
              </div>
            </div>

            {canCancelSubscription ? (
              <button
                type="button"
                onClick={() => {
                  void handleCancelSubscription();
                }}
                disabled={isCancellingSubscription}
                style={{
                  minHeight: "48px",
                  padding: "0 18px",
                  borderRadius: "14px",
                  border: "1px solid rgba(220, 38, 38, 0.18)",
                  background: isCancellingSubscription ? "#fecaca" : "#fee2e2",
                  color: "#991b1b",
                  fontSize: "14px",
                  fontWeight: 800,
                  cursor: isCancellingSubscription ? "wait" : "pointer",
                }}
              >
                {isCancellingSubscription ? "Résiliation en cours..." : "Résilier l'abonnement"}
              </button>
            ) : null}
          </div>

          {accessStatusError ? (
            <div
              style={{
                padding: "12px 14px",
                borderRadius: "14px",
                background: "#fff7ed",
                border: "1px solid #fed7aa",
                color: "#c2410c",
                fontSize: "13px",
                lineHeight: 1.5,
              }}
            >
              {accessStatusError}
            </div>
          ) : null}

          {cancelError ? (
            <div
              style={{
                padding: "12px 14px",
                borderRadius: "14px",
                background: "#fff1f2",
                border: "1px solid #fecdd3",
                color: "#be123c",
                fontSize: "13px",
                lineHeight: 1.5,
              }}
            >
              {cancelError}
            </div>
          ) : null}

          {cancelNotice ? (
            <div
              style={{
                padding: "12px 14px",
                borderRadius: "14px",
                background: "#eff6ff",
                border: "1px solid #bfdbfe",
                color: "#1d4ed8",
                fontSize: "13px",
                lineHeight: 1.5,
              }}
            >
              {cancelNotice}
            </div>
          ) : null}
        </div>
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "12px",
        }}
      >
        {reassuranceItems.map((item) => (
          <div
            key={item}
            style={{
              minHeight: "64px",
              borderRadius: "18px",
              padding: "14px 16px",
              background: "rgba(255, 255, 255, 0.9)",
              border: "1px solid rgba(148, 163, 184, 0.18)",
              color: "#334155",
              fontSize: "14px",
              lineHeight: 1.6,
              display: "flex",
              alignItems: "center",
            }}
          >
            {item}
          </div>
        ))}
      </div>

      {isLoadingOffers ? (
        <div
          style={{
            padding: "18px",
            borderRadius: "18px",
            background: "rgba(255, 255, 255, 0.88)",
            border: "1px solid rgba(148, 163, 184, 0.18)",
            color: "#475569",
            fontSize: "14px",
          }}
        >
          Chargement des offres disponibles...
        </div>
      ) : null}

      {!isLoadingOffers ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "18px",
          }}
        >
          {offers.map((offer) => {
            const isSubmitting = activeOfferId === offer.id;
            const isAnotherOfferSubmitting = Boolean(activeOfferId) && !isSubmitting;
            const hasCardError = checkoutErrorOfferId === offer.id && checkoutError !== "";

            return (
              <article
                key={offer.id}
                style={{
                  border:
                    offer.name === "fipla_private_full"
                      ? "1px solid rgba(37, 99, 235, 0.32)"
                      : "1px solid rgba(148, 163, 184, 0.2)",
                  borderRadius: "24px",
                  padding: offer.name === "fipla_private_full" ? "24px" : "22px",
                  background:
                    offer.name === "fipla_private_full"
                      ? "linear-gradient(180deg, rgba(219, 234, 254, 0.92) 0%, rgba(255, 255, 255, 0.98) 100%)"
                      : "rgba(255, 255, 255, 0.9)",
                  display: "grid",
                  gap: "14px",
                  alignContent: "start",
                  boxShadow:
                    offer.name === "fipla_private_full"
                      ? "0 24px 44px rgba(37, 99, 235, 0.12)"
                      : "0 10px 22px rgba(15, 23, 42, 0.04)",
                  transform: offer.name === "fipla_private_full" ? "translateY(-4px)" : "none",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      width: "fit-content",
                      minHeight: "28px",
                      padding: "0 10px",
                      borderRadius: "999px",
                      background: "#e2e8f0",
                      color: "#334155",
                      fontSize: "12px",
                      fontWeight: 800,
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                    }}
                  >
                    {offer.content.eyebrow}
                  </div>
                  {offer.content.highlightLabel ? (
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        width: "fit-content",
                        minHeight: "28px",
                        padding: "0 10px",
                        borderRadius: "999px",
                        background: "#dbeafe",
                        color: "#1d4ed8",
                        fontSize: "12px",
                        fontWeight: 800,
                      }}
                    >
                      {offer.content.highlightLabel}
                    </div>
                  ) : null}
                </div>

                <div style={{ display: "grid", gap: "8px" }}>
                  <div style={{ fontSize: "22px", fontWeight: 800, color: "#0f172a" }}>
                    {offer.content.title}
                  </div>
                  <div
                    style={{
                      fontSize: "13px",
                      fontWeight: 700,
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                      color: offer.name === "fipla_private_full" ? "#1d4ed8" : "#64748b",
                    }}
                  >
                    {offer.content.positioning}
                  </div>
                  <div style={{ fontSize: "14px", color: "#334155", lineHeight: 1.7 }}>
                    {offer.content.description}
                  </div>
                </div>

                <div style={{ display: "grid", gap: "4px" }}>
                  <div style={{ fontSize: "28px", fontWeight: 800, color: "#17324d" }}>
                    {offer.content.priceLabel}
                  </div>
                  <div style={{ fontSize: "13px", color: "#64748b", textTransform: "capitalize" }}>
                    {offer.content.paymentLabel}
                  </div>
                </div>

                <div
                  style={{
                    borderRadius: "16px",
                    background: "#ffffff",
                    border: "1px solid rgba(226, 232, 240, 0.92)",
                    padding: "14px",
                    display: "grid",
                    gap: "10px",
                  }}
                >
                  {offer.content.benefits.map((benefit) => (
                    <div
                      key={benefit}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "14px 1fr",
                        gap: "10px",
                        alignItems: "start",
                        fontSize: "14px",
                        color: "#334155",
                        lineHeight: 1.5,
                      }}
                    >
                      <span style={{ color: "#2f7d5a", fontWeight: 800 }}>•</span>
                      <span>{benefit}</span>
                    </div>
                  ))}
                </div>

                <div style={{ fontSize: "13px", lineHeight: 1.6, color: "#64748b" }}>
                  {offer.content.footnote}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    void handleCheckout(offer);
                  }}
                  disabled={Boolean(activeOfferId) || !profileId}
                  style={{
                    minHeight: "50px",
                    border: "none",
                    borderRadius: "14px",
                    background:
                      isSubmitting
                        ? "#0f172a"
                        : isAnotherOfferSubmitting || !profileId
                        ? "#94a3b8"
                        : offer.name === "fipla_private_full"
                          ? "linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)"
                          : "linear-gradient(135deg, #17324d 0%, #264b6f 100%)",
                    color: "#ffffff",
                    fontSize: "15px",
                    fontWeight: 700,
                    cursor: Boolean(activeOfferId) || !profileId ? "not-allowed" : "pointer",
                  }}
                >
                  {isSubmitting ? "Redirection vers Stripe..." : offer.content.ctaLabel}
                </button>

                {hasCardError ? (
                  <div
                    style={{
                      padding: "12px 14px",
                      borderRadius: "14px",
                      background: "#fff1f2",
                      border: "1px solid #fecdd3",
                      color: "#be123c",
                      fontSize: "13px",
                      lineHeight: 1.5,
                    }}
                  >
                    {checkoutError}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : null}

      {offersError ? (
        <div
          style={{
            padding: "12px 14px",
            borderRadius: "14px",
            background: "#fff7ed",
            border: "1px solid #fed7aa",
            color: "#c2410c",
            fontSize: "14px",
            lineHeight: 1.5,
          }}
        >
          {offersError}
        </div>
      ) : null}

      {hasAvailableOffers ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "16px",
            padding: "18px",
            borderRadius: "22px",
            background: "rgba(15, 23, 42, 0.03)",
            border: "1px solid rgba(148, 163, 184, 0.16)",
          }}
        >
          <div style={{ display: "grid", gap: "10px" }}>
            <div
              style={{
                fontSize: "13px",
                fontWeight: 800,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "#17324d",
              }}
            >
              Réassurance
            </div>
            <div style={{ fontSize: "14px", lineHeight: 1.7, color: "#334155" }}>
              Votre paiement est sécurisé et l'activation reste simple. Vous choisissez une offre,
              puis Stripe prend le relais pour finaliser le parcours de façon fluide.
            </div>
          </div>

          <div style={{ display: "grid", gap: "8px" }}>
            {pricingNotes.map((item) => (
              <div key={item} style={{ fontSize: "13px", lineHeight: 1.6, color: "#64748b" }}>
                {item}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {checkoutError && !checkoutErrorOfferId ? (
        <div
          style={{
            padding: "12px 14px",
            borderRadius: "14px",
            background: "#fff1f2",
            border: "1px solid #fecdd3",
            color: "#be123c",
            fontSize: "14px",
            lineHeight: 1.5,
          }}
        >
          {checkoutError}
        </div>
      ) : null}
    </section>
  );
}
