type PremiumDomicileAccrocheProps = {
  onStart: () => void;
  onBack: () => void;
};

const steps = [
  {
    num: "01",
    label: "Situation actuelle",
    desc: "Votre domicile et vos données fiscales",
  },
  {
    num: "02",
    label: "Domicile envisagé",
    desc: "Le canton ou la commune cible",
  },
  {
    num: "03",
    label: "Comparaison et projection",
    desc: "Impact fiscal annuel et sur 10 ans",
  },
];

export default function PremiumDomicileAccroche({
  onStart,
  onBack,
}: PremiumDomicileAccrocheProps) {
  return (
    <div className="mobile-cards-stack">
      <div className="mobile-topbar">
        <button type="button" className="mobile-pill-button" onClick={onBack}>
          Retour
        </button>
      </div>

      <article className="premium-accroche-hero">
        <div className="premium-accroche-hero__eyebrow">Décision patrimoniale</div>
        <h2 className="premium-accroche-hero__title">
          Et si votre adresse vous coûtait trop cher ?
        </h2>
        <p className="premium-accroche-hero__subtitle">
          Comparez votre domicile actuel avec un autre canton ou une autre commune et visualisez
          l'impact fiscal annuel.
        </p>
        <button
          type="button"
          className="premium-accroche-hero__cta"
          onClick={onStart}
        >
          Comparer deux domiciles
        </button>
      </article>

      <div className="premium-accroche-steps">
        {steps.map(({ num, label, desc }) => (
          <div key={num} className="premium-accroche-step">
            <div className="premium-accroche-step__num">{num}</div>
            <div className="premium-accroche-step__body">
              <div className="premium-accroche-step__label">{label}</div>
              <div className="premium-accroche-step__desc">{desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
