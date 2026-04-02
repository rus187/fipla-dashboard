import { useEffect } from "react";
import "./CheckoutStatus.css";

export default function CheckoutSuccess() {
  const sessionId =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("session_id")
      : null;

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    console.info("[Stripe][checkout] success page loaded", {
      sessionId,
    });
  }, [sessionId]);

  return (
    <div className="checkout-status-page">
      <div className="checkout-status-page__shell">
        <section className="checkout-status-page__panel">
          <div className="checkout-status-page__eyebrow">Paiement confirmé</div>
          <h1 className="checkout-status-page__title">Offre activée</h1>
          <p className="checkout-status-page__subtitle">
            Votre paiement a bien été confirmé. Vous pouvez reprendre votre parcours en toute
            simplicité dans un espace clair et prêt à l’emploi.
          </p>

          <div className="checkout-status-page__summary">
            <div className="checkout-status-page__summary-title">Paiement confirmé</div>
            <div className="checkout-status-page__summary-text">
              L’activation est prise en compte et votre espace est prêt à être utilisé. Aucun
              détail technique inutile n’est affiché ici pour garder une expérience rassurante.
            </div>
            <a href="/" className="checkout-status-page__cta">
              Accéder à mon espace
            </a>
          </div>

          <div className="checkout-status-page__notes">
            <article className="checkout-status-page__note">
              <div className="checkout-status-page__note-title">Parcours fluide</div>
              <div className="checkout-status-page__note-text">
                Vous revenez directement sur une étape claire, sans écran vide après Stripe.
              </div>
            </article>
            <article className="checkout-status-page__note">
              <div className="checkout-status-page__note-title">Activation immédiate</div>
              <div className="checkout-status-page__note-text">
                L’offre validée est prête pour la suite de votre utilisation.
              </div>
            </article>
            <article className="checkout-status-page__note">
              <div className="checkout-status-page__note-title">Expérience rassurante</div>
              <div className="checkout-status-page__note-text">
                La lecture reste simple, propre et professionnelle pour un rendu montrable à un client.
              </div>
            </article>
          </div>
        </section>
      </div>
    </div>
  );
}
