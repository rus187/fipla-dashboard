export type AnalysisMode = "current" | "projected" | "compare";

type DecisionIntroProps = {
  analysisMode: AnalysisMode | null;
  isHelpOpen: boolean;
  onContinue: () => void;
  onSelectMode: (mode: AnalysisMode) => void;
  onToggleHelp: () => void;
};

const decisionCards = [
  {
    id: "current" as const,
    title: "Situation actuelle",
    description: "Analyser votre situation actuelle.",
    helper: "Point de départ recommandé pour un diagnostic précis.",
  },
  {
    id: "projected" as const,
    title: "Situation projetée",
    description: "Anticiper une évolution de votre situation.",
    helper: "Idéal pour préparer les décisions à venir.",
  },
  {
    id: "compare" as const,
    title: "Comparer des scénarios",
    description: "Comparer plusieurs scénarios.",
    helper: "Recommandé pour une analyse approfondie.",
  },
];

export default function DecisionIntro({
  analysisMode,
  isHelpOpen,
  onContinue,
  onSelectMode,
  onToggleHelp,
}: DecisionIntroProps) {
  return (
    <section className="decision-screen" aria-label="Introduction">
      <header className="decision-screen__header">
        <div className="decision-screen__brand">FIPLA Dashboard</div>
        <div className="decision-screen__meta">Version 1.0 | TaxWare | Cabinet Russo</div>
      </header>

      <div className="decision-screen__panel">
        <div className="decision-screen__panel-inner">
          <div className="decision-screen__heading">
            <div className="decision-screen__eyebrow">Simulation patrimoniale et fiscale</div>
            <h1 className="decision-screen__title">Quelle analyse souhaitez-vous réaliser ?</h1>
            <p className="decision-screen__subtitle">
              Définissez votre point de départ pour analyser votre situation.
            </p>
          </div>

          <div className="decision-screen__cards" role="list" aria-label="Choix d'analyse">
            {decisionCards.map((card) => {
              const isSelected = analysisMode === card.id;

              return (
                <button
                  key={card.id}
                  type="button"
                  className={`decision-card${isSelected ? " decision-card--selected" : ""}`}
                  onClick={() => onSelectMode(card.id)}
                  aria-pressed={isSelected}
                >
                  <div className="decision-card__topline">
                    <span className="decision-card__badge">
                      {card.id === "current"
                        ? "AUJOURD’HUI"
                        : card.id === "projected"
                          ? "PROJECTION"
                          : "VISION COMPLÈTE"}
                    </span>
                    {isSelected ? <span className="decision-card__state">Selectionne</span> : null}
                  </div>

                  <div className="decision-card__title">{card.title}</div>
                  <div className="decision-card__description">{card.description}</div>
                  <div className="decision-card__helper">{card.helper}</div>
                </button>
              );
            })}
          </div>

          <p className="decision-screen__strategy-line">
            Inclut l’analyse du bien immobilier, des revenus, de la fiscalité et des stratégies
            d’optimisation.
          </p>

          <div className="decision-screen__actions">
            <button
              type="button"
              className="decision-screen__help-link"
              onClick={onToggleHelp}
              aria-expanded={isHelpOpen}
            >
              Je ne sais pas par où commencer
            </button>

            {isHelpOpen ? (
              <div className="decision-screen__help-panel" role="region" aria-label="Comment choisir">
                <div className="decision-screen__help-title">Comment choisir ?</div>
                <div className="decision-screen__help-list">
                  <div>
                    Situation actuelle → pour établir un diagnostic précis de votre situation
                    aujourd’hui
                  </div>
                  <div>
                    Situation projetée → pour anticiper l’impact des évolutions fiscales
                  </div>
                  <div>
                    Comparer → pour identifier la meilleure stratégie entre plusieurs options
                  </div>
                </div>
              </div>
            ) : null}

            <button
              type="button"
              className="decision-screen__primary"
              onClick={onContinue}
              disabled={!analysisMode}
            >
              Démarrer
            </button>

            <p className="decision-screen__footnote">
              Vous pourrez ensuite saisir les données, lancer la simulation et explorer
              différentes stratégies d’optimisation.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
