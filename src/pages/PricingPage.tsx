import { useEffect, useState } from "react";
import { createPricingCheckoutSession } from "../lib/stripe/createPricingCheckoutSession";
import { supabaseClient } from "../lib/supabase/client";
import "./PricingPage.css";

type PricingPageProps = {
  profileId: string | null;
};

type PricingPlanContent = {
  name: string;
  price: string;
  type: string;
  description: string;
  cta: string;
  badge?: string;
  points: string[];
  featured?: boolean;
};

type PricingPlan = PricingPlanContent & {
  id: string;
};

const OFFER_ORDER = ["fipla_private_mini", "fipla_private_full", "fipla_pro_solo"] as const;

const OFFER_CONTENT: Record<(typeof OFFER_ORDER)[number], PricingPlanContent> = {
  fipla_private_mini: {
    name: "Mini",
    price: "9 CHF",
    type: "Paiement unique",
    description: "Analyse ponctuelle",
    cta: "Commencer",
    points: ["Idéal pour un besoin ponctuel", "Décision rapide", "Sans abonnement"],
  },
  fipla_private_full: {
    name: "Full",
    price: "29 CHF/mois",
    type: "Abonnement",
    description: "Offre recommandée",
    cta: "Choisir Full",
    badge: "Le plus utilisé",
    featured: true,
    points: ["La formule la plus équilibrée", "Pensée pour un usage régulier", "Lecture claire et confortable"],
  },
  fipla_pro_solo: {
    name: "Pro Solo",
    price: "59 CHF/mois",
    type: "Abonnement",
    description: "Usage pro",
    cta: "Choisir Pro",
    points: ["Conçu pour un usage intensif", "Cadre professionnel", "Accès direct au parcours premium"],
  },
};

function getSafeCheckoutMessage() {
  return "Le paiement ne peut pas être lancé pour le moment. Merci de réessayer dans un instant.";
}

export default function PricingPage({ profileId }: PricingPageProps) {
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [checkoutError, setCheckoutError] = useState("");
  const [activePlanId, setActivePlanId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadPlans = async () => {
      setIsLoading(true);
      setLoadError("");

      const { data, error } = await supabaseClient
        .from("plans")
        .select("id, name, active")
        .in("name", [...OFFER_ORDER])
        .eq("active", true);

      if (!isMounted) {
        return;
      }

      if (error) {
        setPlans([]);
        setLoadError("Les offres ne sont pas disponibles pour le moment.");
        setIsLoading(false);
        return;
      }

      const nextPlans = OFFER_ORDER.map((offerName) => {
        const plan = (data ?? []).find((item) => item.name === offerName);
        const content = OFFER_CONTENT[offerName];

        if (!plan || !content) {
          return null;
        }

        return {
          id: plan.id,
          ...content,
        };
      }).filter((plan): plan is PricingPlan => Boolean(plan));

      setPlans(nextPlans);
      setLoadError(nextPlans.length === OFFER_ORDER.length ? "" : "Certaines offres sont temporairement indisponibles.");
      setIsLoading(false);
    };

    void loadPlans();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleCheckout = async (plan: PricingPlan) => {
    if (!profileId) {
      setCheckoutError("Connexion requise pour lancer le paiement.");
      return;
    }

    setActivePlanId(plan.id);
    setCheckoutError("");

    try {
      const result = await createPricingCheckoutSession(plan.id);

      if (!result.url) {
        throw new Error("Missing Stripe URL");
      }

      window.location.assign(result.url);
    } catch (error) {
      console.error("[PricingPage] checkout failed", {
        planId: plan.id,
        error,
      });
      setCheckoutError(getSafeCheckoutMessage());
      setActivePlanId(null);
    }
  };

  return (
    <div className="pricing-page">
      <div className="pricing-page__shell">
        <div className="pricing-page__topbar">
          <div className="pricing-page__brand">FIPLA Premium</div>
          <a href="/" className="pricing-page__backlink">
            Retour à l’application
          </a>
        </div>

        <main className="pricing-page__main">
          <section className="pricing-hero">
            <div className="pricing-hero__eyebrow">Analyse fiscale premium</div>
            <h1 className="pricing-hero__title">Optimisez votre fiscalité en quelques minutes</h1>
            <p className="pricing-hero__subtitle">
              Une analyse claire, des décisions éclairées, sans complexité
            </p>
          </section>

          {isLoading ? (
            <section className="pricing-feedback">Chargement des offres en cours...</section>
          ) : (
            <section className="pricing-cards" aria-label="Offres premium">
              {plans.map((plan) => {
                const isSubmitting = activePlanId === plan.id;

                return (
                  <article
                    key={plan.id}
                    className={`pricing-card${plan.featured ? " pricing-card--featured" : ""}`}
                  >
                    <div className="pricing-card__topline">
                      <div className="pricing-card__type">{plan.type}</div>
                      {plan.badge ? <div className="pricing-card__badge">{plan.badge}</div> : null}
                    </div>

                    <div>
                      <h2 className="pricing-card__title">{plan.name}</h2>
                      <div className="pricing-card__price">{plan.price}</div>
                    </div>

                    <div className="pricing-card__description">{plan.description}</div>

                    <ul className="pricing-card__points">
                      {plan.points.map((point) => (
                        <li key={point} className="pricing-card__point">
                          {point}
                        </li>
                      ))}
                    </ul>

                    <button
                      type="button"
                      className="pricing-card__button"
                      disabled={Boolean(activePlanId)}
                      onClick={() => {
                        void handleCheckout(plan);
                      }}
                    >
                      {isSubmitting ? "Redirection..." : plan.cta}
                    </button>
                  </article>
                );
              })}
            </section>
          )}

          {loadError ? <section className="pricing-feedback pricing-feedback--error">{loadError}</section> : null}
          {checkoutError ? (
            <section className="pricing-feedback pricing-feedback--error">{checkoutError}</section>
          ) : null}

          <section className="pricing-comparison" aria-labelledby="pricing-comparison-title">
            <div className="pricing-section__eyebrow">Comparatif simple</div>
            <h2 id="pricing-comparison-title" className="pricing-section__title">
              Choisissez la formule adaptée à votre rythme
            </h2>
            <p className="pricing-section__subtitle">
              Une lecture volontairement simple pour vous aider à choisir rapidement.
            </p>

            <table className="pricing-comparison__table">
              <thead>
                <tr>
                  <th>Critère</th>
                  <th>Mini</th>
                  <th className="pricing-comparison__featured">Full</th>
                  <th>Pro Solo</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th>Prix</th>
                  <td>9 CHF</td>
                  <td className="pricing-comparison__featured">29 CHF/mois</td>
                  <td>59 CHF/mois</td>
                </tr>
                <tr>
                  <th>Format</th>
                  <td>Paiement unique</td>
                  <td className="pricing-comparison__featured">Abonnement</td>
                  <td>Abonnement</td>
                </tr>
                <tr>
                  <th>Usage conseillé</th>
                  <td>Analyse ponctuelle</td>
                  <td className="pricing-comparison__featured">Usage régulier</td>
                  <td>Usage professionnel</td>
                </tr>
                <tr>
                  <th>Positionnement</th>
                  <td>Simple et direct</td>
                  <td className="pricing-comparison__featured">Le meilleur équilibre</td>
                  <td>Cadre pro</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section className="pricing-reassurance" aria-labelledby="pricing-reassurance-title">
            <div className="pricing-section__eyebrow">Réassurance</div>
            <h2 id="pricing-reassurance-title" className="pricing-section__title">
              Un parcours propre, clair et immédiat
            </h2>
            <p className="pricing-section__subtitle">
              Chaque étape reste lisible pour inspirer confiance dès la première lecture.
            </p>

            <div className="pricing-reassurance__grid">
              <article className="pricing-reassurance__item">
                <div className="pricing-reassurance__label">Paiement sécurisé Stripe</div>
                <div className="pricing-reassurance__text">
                  Un paiement fluide, reconnu et rassurant pour finaliser votre choix sereinement.
                </div>
              </article>

              <article className="pricing-reassurance__item">
                <div className="pricing-reassurance__label">Activation immédiate</div>
                <div className="pricing-reassurance__text">
                  L’accès démarre sans attente inutile pour garder un parcours simple et rapide.
                </div>
              </article>

              <article className="pricing-reassurance__item">
                <div className="pricing-reassurance__label">Données traitées avec précision</div>
                <div className="pricing-reassurance__text">
                  Une expérience conçue pour rester claire, fiable et confortable à relire.
                </div>
              </article>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
