import "./CheckoutStatus.css";

export default function CheckoutCancel() {
  return (
    <div className="checkout-status-page">
      <div className="checkout-status-page__shell">
        <section className="checkout-status-page__panel">
          <div className="checkout-status-page__eyebrow">Paiement annulé</div>
          <h1 className="checkout-status-page__title">Aucune commande n’a été validée</h1>
          <p className="checkout-status-page__subtitle">
            Le paiement a été interrompu sans conséquence. Vous pouvez revenir aux offres quand vous
            le souhaitez et reprendre votre choix sereinement.
          </p>

          <div className="checkout-status-page__summary">
            <div className="checkout-status-page__summary-title">Paiement annulé</div>
            <div className="checkout-status-page__summary-text">
              Rien n’a été facturé ici. Le parcours reste ouvert pour vous laisser comparer les
              offres dans de bonnes conditions, sans pression ni écran vide.
            </div>
            <a href="/pricing" className="checkout-status-page__cta">
              Revenir aux offres
            </a>
          </div>

          <div className="checkout-status-page__notes">
            <article className="checkout-status-page__note">
              <div className="checkout-status-page__note-title">Retour simple</div>
              <div className="checkout-status-page__note-text">
                Un accès direct vous ramène vers les offres pour reprendre la décision calmement.
              </div>
            </article>
            <article className="checkout-status-page__note">
              <div className="checkout-status-page__note-title">Aucun vide après Stripe</div>
              <div className="checkout-status-page__note-text">
                La transition reste lisible et rassurante, sans impression de parcours interrompu.
              </div>
            </article>
            <article className="checkout-status-page__note">
              <div className="checkout-status-page__note-title">Présentation premium</div>
              <div className="checkout-status-page__note-text">
                Le rendu reste sobre, clair et suffisamment propre pour être montré à un client final.
              </div>
            </article>
          </div>
        </section>
      </div>
    </div>
  );
}
