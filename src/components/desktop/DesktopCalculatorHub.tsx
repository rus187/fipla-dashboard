export type DesktopCalculatorCard = {
  id: string;
  label: string;
  title: string;
  description: string;
  helper: string;
  primaryLabel: string;
  status: string;
  currentVariant: string;
  sections: Array<{
    id: string;
    label: string;
  }>;
};

type DesktopCalculatorHubProps = {
  calculators: DesktopCalculatorCard[];
  activeCalculatorId: string;
  onSelect: (calculatorId: string) => void;
  onOpen: (calculatorId: string) => void;
  onOpenResults: (calculatorId: string) => void;
  onOpenSection: (calculatorId: string, sectionId: string) => void;
  onOpenPremium?: (calculatorId: string) => void;
};

function statusBadge(status: string): { icon: string; mod: string } {
  if (/prêt|disponible/i.test(status)) return { icon: "✔", mod: "desktop-calculator-card__status--ok" };
  if (/erreur/i.test(status)) return { icon: "✕", mod: "desktop-calculator-card__status--error" };
  return { icon: "⏳", mod: "desktop-calculator-card__status--pending" };
}

export default function DesktopCalculatorHub({
  calculators,
  activeCalculatorId,
  onSelect,
  onOpen,
  onOpenResults,
  onOpenSection,
  onOpenPremium,
}: DesktopCalculatorHubProps) {
  const activeCalculator =
    calculators.find((calculator) => calculator.id === activeCalculatorId) ?? calculators[0] ?? null;

  return (
    <section className="desktop-calculator-hub" aria-label="Calculateurs PC">
      <div className="desktop-calculator-hub__header">
        <div>
          <div className="desktop-calculator-hub__eyebrow">Calculateurs</div>
          <h2 className="desktop-calculator-hub__title">Quatre accès clairs, un seul dossier actif</h2>
        </div>
        <p className="desktop-calculator-hub__subtitle">
          Le dossier de base alimente tous les scénarios. Chaque calculateur ouvre sa zone dédiée
          sans changer la logique fiscale déjà en place.
        </p>
      </div>

      <div className="desktop-calculator-hub__grid">
        {calculators.map((calculator) => {
          const isActive = calculator.id === activeCalculatorId;

          const badge = statusBadge(calculator.status);

          return (
            <button
              key={calculator.id}
              type="button"
              className={`desktop-calculator-card${
                isActive ? " desktop-calculator-card--active" : ""
              }`}
              onClick={() => onSelect(calculator.id)}
            >
              <div className="desktop-calculator-card__topline">
                <span className="desktop-calculator-card__label">{calculator.label}</span>
                <span className={`desktop-calculator-card__status ${badge.mod}`}>{badge.icon} {calculator.status}</span>
              </div>
              <div className="desktop-calculator-card__title">{calculator.title}</div>
              <p className="desktop-calculator-card__description">{calculator.description}</p>
              <div className="desktop-calculator-card__variant">
                Variante ciblée : <strong>{calculator.currentVariant}</strong>
              </div>
            </button>
          );
        })}
      </div>

      {activeCalculator ? (
        <div className="desktop-calculator-focus">
          <div className="desktop-calculator-focus__content">
            <div className="desktop-calculator-focus__eyebrow">{activeCalculator.label}</div>
            <h3 className="desktop-calculator-focus__title">{activeCalculator.title}</h3>
            <p className="desktop-calculator-focus__description">{activeCalculator.description}</p>
            <div className="desktop-calculator-focus__helper">{activeCalculator.helper}</div>
          </div>

          <div className="desktop-calculator-focus__actions">
            <button
              type="button"
              className="desktop-primary-button"
              onClick={() => onOpen(activeCalculator.id)}
            >
              {activeCalculator.primaryLabel}
            </button>
            <button
              type="button"
              className="desktop-secondary-button"
              onClick={() => onOpenResults(activeCalculator.id)}
            >
              Voir les résultats
            </button>
            {activeCalculator.id === "changement-domicile" && onOpenPremium ? (
              <button
                type="button"
                className="desktop-primary-button"
                style={{ background: "linear-gradient(135deg, #163046 0%, #28455f 100%)" }}
                onClick={() => onOpenPremium(activeCalculator.id)}
              >
                Analyse domicile premium
              </button>
            ) : null}
          </div>

          <div className="desktop-calculator-focus__sections">
            {activeCalculator.sections.map((section) => (
              <button
                key={`${activeCalculator.id}-${section.id}`}
                type="button"
                className="desktop-section-chip"
                onClick={() => onOpenSection(activeCalculator.id, section.id)}
              >
                {section.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
