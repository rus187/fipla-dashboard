import { useEffect, useState } from "react";
import { createStripeCheckoutSession } from "../lib/stripe/createCheckoutSession";
import { supabaseClient } from "../lib/supabase/client";
import type { Plan } from "../lib/supabase/types";

type StripeCheckoutCardProps = {
  profileId: string | null;
  organizationId?: string | null;
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
    positioning: "La porte d'entree FIPLA",
    description: "Une entree simple pour lancer un premier dossier sans engagement mensuel.",
    priceLabel: "9 CHF - achat unique",
    paymentLabel: "Paiement unique",
    ctaLabel: "Choisir Mini",
    benefits: [
      "Acces immediat a l'offre Mini",
      "Ideal pour un besoin ponctuel",
      "Aucun abonnement mensuel",
    ],
    footnote: "Parfait pour tester le parcours FIPLA sur un besoin cible.",
  },
  fipla_private_full: {
    eyebrow: "Abonnement mensuel",
    title: "Full",
    positioning: "L'offre recommandee",
    description: "La formule private la plus complete pour travailler dans la duree avec plus de confort.",
    priceLabel: "29 CHF / mois",
    paymentLabel: "Abonnement mensuel",
    ctaLabel: "Choisir Full",
    highlightLabel: "Le plus equilibre",
    benefits: [
      "Acces complet a l'offre Private Full",
      "Convient a un usage regulier",
      "Facturation mensuelle lisible",
      "Montée en puissance simple",
    ],
    footnote: "Concue pour une utilisation recurrente sans complexite inutile.",
  },
  fipla_pro_solo: {
    eyebrow: "Abonnement mensuel",
    title: "Pro Solo",
    positioning: "La formule usage metier",
    description: "La formule orientee conseil pour un usage professionnel plus intensif.",
    priceLabel: "59 CHF / mois",
    paymentLabel: "Abonnement mensuel",
    ctaLabel: "Choisir Pro Solo",
    benefits: [
      "Positionnement Pro Solo",
      "Pensé pour un usage expert",
      "Abonnement mensuel robuste",
      "Acces direct au checkout dedie",
    ],
    footnote: "Recommande pour une pratique plus soutenue et plus orientee business.",
  },
};

function getCheckoutErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Impossible de creer la session Stripe.";
}

function resolveCheckoutOffer(plan: Plan): CheckoutOffer | null {
  const normalizedName = plan.name as (typeof OFFER_ORDER)[number];
  const content = OFFER_CONTENT[normalizedName];

  if (!content || !plan.active) {
    return null;
  }

  const hasMonthlyPrice = typeof plan.stripe_price_id_monthly === "string" && plan.stripe_price_id_monthly.trim() !== "";
  const hasOneTimePrice = typeof plan.stripe_price_id === "string" && plan.stripe_price_id.trim() !== "";

  if (hasMonthlyPrice) {
    return {
      id: plan.id,
      name: plan.name,
      paymentType: "monthly",
      content,
    };
  }

  if (hasOneTimePrice) {
    return {
      id: plan.id,
      name: plan.name,
      paymentType: "one_time",
      content,
    };
  }

  return null;
}

export default function StripeCheckoutCard({
  profileId,
  organizationId = null,
}: StripeCheckoutCardProps) {
  const [offers, setOffers] = useState<CheckoutOffer[]>([]);
  const [isLoadingOffers, setIsLoadingOffers] = useState(true);
  const [offersError, setOffersError] = useState("");
  const [checkoutError, setCheckoutError] = useState("");
  const [checkoutErrorOfferId, setCheckoutErrorOfferId] = useState<string | null>(null);
  const [activeOfferId, setActiveOfferId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadOffers = async () => {
      setIsLoadingOffers(true);
      setOffersError("");

      const { data, error } = await supabaseClient
        .from("plans")
        .select("id, name, active, stripe_price_id, stripe_price_id_monthly, stripe_price_id_yearly")
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

  const handleCheckout = async (offer: CheckoutOffer) => {
    if (activeOfferId) {
      return;
    }

    if (!profileId) {
      setCheckoutError("Aucun profile utilisateur disponible pour lancer Checkout.");
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
        throw new Error("Stripe n'a pas renvoye d'URL de redirection.");
      }

      window.location.assign(result.url);
    } catch (error) {
      setCheckoutError(getCheckoutErrorMessage(error));
      setCheckoutErrorOfferId(offer.id);
      setActiveOfferId(null);
    }
  };

  const hasAvailableOffers = offers.length > 0;
  const reassuranceItems = [
    "Paiement securise via Stripe",
    "Activation simple apres validation",
    "Parcours fluide sans ressaisie technique",
  ];

  const pricingNotes = [
    "Les plans inactifs restent masques automatiquement.",
    "Le backend conserve seul la resolution du plan, du mode et du type de paiement.",
  ];

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
              Choisissez l'offre FIPLA adaptee a votre rythme de travail.
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
              Une entree simple pour demarrer, une formule recommandee pour un usage regulier, et
              une offre Pro Solo pour une pratique plus soutenue. Le parcours reste clair, rapide
              et securise jusqu'au paiement.
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
              L'objectif est de vous aider a choisir rapidement la bonne formule, sans exposer de
              details techniques ni complexifier le checkout.
            </div>
            <div style={{ fontSize: "13px", color: "#64748b", lineHeight: 1.6 }}>
              Offre recommandee: <strong style={{ color: "#1d4ed8" }}>FIPLA Private Full</strong>
            </div>
          </div>
        </div>
      </div>

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
              Reassurance
            </div>
            <div style={{ fontSize: "14px", lineHeight: 1.7, color: "#334155" }}>
              Votre paiement est securise et l'activation reste simple. Vous choisissez une offre,
              puis Stripe prend le relais pour finaliser le parcours de facon fluide.
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
