import type { MobileDomicilePayload, MobileDomicileResult } from "./MobileDomicileFlow";

type PremiumDomicileResultsProps = {
  result: MobileDomicileResult;
  payload: MobileDomicilePayload;
  onBack: () => void;
  onReset: () => void;
};

function fmtCHF(n: number): string {
  const rounded = Math.round(n);
  return "CHF " + rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'");
}

function parseSignedCHF(formatted: string): number {
  const s = formatted.trim();
  const isNeg = s.startsWith("−") || s.startsWith("-");
  const digits = s.replace(/[^0-9]/g, "");
  const n = parseInt(digits, 10);
  return isNeg ? -(isNaN(n) ? 0 : n) : isNaN(n) ? 0 : n;
}

function fmtSignedCHF(amount: number): string {
  const abs = Math.abs(Math.round(amount));
  const sign = amount >= 0 ? "+" : "−";
  const formatted = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  return `${sign} CHF ${formatted}`;
}

function getVerdictClass(verdict: string): string {
  if (verdict === "Favorable" || verdict === "Plus avantageux") {
    return "mobile-comparison-badge mobile-comparison-badge--favorable";
  }
  if (verdict === "Défavorable" || verdict === "Moins avantageux") {
    return "mobile-comparison-badge mobile-comparison-badge--defavorable";
  }
  return "mobile-comparison-badge mobile-comparison-badge--neutre";
}

function getDiffBadgeLabel(verdict: "Favorable" | "Neutre" | "Défavorable"): string {
  if (verdict === "Favorable") return "Plus avantageux";
  if (verdict === "Défavorable") return "Moins avantageux";
  return "Équivalent";
}

function getDecisionMessage(
  verdict: "Favorable" | "Neutre" | "Défavorable",
  annualDelta: number,
): string {
  if (verdict === "Favorable") {
    return Math.abs(annualDelta) >= 5000
      ? "Le domicile envisagé présente un avantage fiscal significatif."
      : "Le domicile envisagé présente un avantage fiscal notable.";
  }
  if (verdict === "Défavorable") {
    return "Le domicile actuel reste fiscalement plus favorable.";
  }
  return "L'écart fiscal est limité : d'autres critères patrimoniaux doivent être analysés.";
}

export default function PremiumDomicileResults({
  result,
  payload,
  onBack,
  onReset,
}: PremiumDomicileResultsProps) {
  const annualDelta = parseSignedCHF(result.difference.value);
  const delta5 = fmtSignedCHF(annualDelta * 5);
  const delta10 = fmtSignedCHF(annualDelta * 10);
  const projectionLabel =
    result.difference.verdict === "Favorable"
      ? "Économie"
      : result.difference.verdict === "Défavorable"
        ? "Surcoût"
        : "Écart";
  const decisionMessage = getDecisionMessage(result.difference.verdict, annualDelta);

  return (
    <div className="mobile-cards-stack">
      <div className="mobile-topbar">
        <button type="button" className="mobile-pill-button" onClick={onBack}>
          Retour
        </button>
        <button type="button" className="mobile-link-button" onClick={onReset}>
          Nouvelle comparaison
        </button>
      </div>

      {/* Bloc 2 — Situation actuelle */}
      <section className="premium-domicile-bloc">
        <header className="premium-domicile-bloc-header">
          <div className="premium-domicile-bloc-header__eyebrow">Situation actuelle</div>
          <h3 className="premium-domicile-bloc-header__title">Votre domicile de référence</h3>
        </header>
        <article className="premium-domicile-situation-card">
          <div className="premium-domicile-situation-card__location">
            {payload.currentLocality}
            <span className="premium-domicile-situation-card__zip">
              {" "}
              &mdash; {payload.currentZip}
            </span>
          </div>
          <div className="premium-domicile-situation-card__grid">
            <div className="premium-domicile-situation-item">
              <div className="premium-domicile-situation-item__label">État civil</div>
              <div className="premium-domicile-situation-item__value">{payload.etatCivil}</div>
            </div>
            {payload.enfants > 0 ? (
              <div className="premium-domicile-situation-item">
                <div className="premium-domicile-situation-item__label">Enfants</div>
                <div className="premium-domicile-situation-item__value">{payload.enfants}</div>
              </div>
            ) : null}
            <div className="premium-domicile-situation-item">
              <div className="premium-domicile-situation-item__label">Revenu IFD</div>
              <div className="premium-domicile-situation-item__value">
                {fmtCHF(payload.revenuImposableIfd)}
              </div>
            </div>
            <div className="premium-domicile-situation-item">
              <div className="premium-domicile-situation-item__label">Revenu ICC</div>
              <div className="premium-domicile-situation-item__value">
                {fmtCHF(payload.revenuImposableIcc)}
              </div>
            </div>
            {payload.fortuneImposable > 0 ? (
              <div className="premium-domicile-situation-item">
                <div className="premium-domicile-situation-item__label">Fortune imposable</div>
                <div className="premium-domicile-situation-item__value">
                  {fmtCHF(payload.fortuneImposable)}
                </div>
              </div>
            ) : null}
          </div>
        </article>
      </section>

      {/* Bloc 3 — Domicile envisagé */}
      <section className="premium-domicile-bloc">
        <header className="premium-domicile-bloc-header">
          <div className="premium-domicile-bloc-header__eyebrow">Domicile envisagé</div>
          <h3 className="premium-domicile-bloc-header__title">La commune cible</h3>
        </header>
        <article className="premium-domicile-situation-card">
          <div className="premium-domicile-situation-card__location">
            {payload.newLocality}
            <span className="premium-domicile-situation-card__zip">
              {" "}
              &mdash; {payload.newZip}
            </span>
          </div>
          <div className="premium-domicile-situation-card__scenario">
            {result.next.helper}
          </div>
        </article>
      </section>

      {/* Bloc 4 — Résultat comparatif */}
      <section className="premium-domicile-bloc">
        <header className="premium-domicile-bloc-header">
          <div className="premium-domicile-bloc-header__eyebrow">Résultat comparatif</div>
          <h3 className="premium-domicile-bloc-header__title">Impact fiscal immédiat</h3>
        </header>

        {/* Card domicile actuel */}
        <article className="premium-domicile-tax-card">
          <div className="premium-domicile-tax-card__header">
            <div>
              <div className="premium-domicile-tax-card__label">{result.current.label}</div>
              <div className="premium-domicile-tax-card__place">{result.current.value}</div>
            </div>
            {result.current.verdict ? (
              <div className={getVerdictClass(result.current.verdict)}>
                {result.current.verdict}
              </div>
            ) : null}
          </div>
          <div className="premium-domicile-tax-card__metrics">
            {result.current.metrics.map((m) => (
              <div key={m.label} className="premium-domicile-tax-card__row">
                <span className="premium-domicile-tax-card__row-label">{m.label}</span>
                <span className="premium-domicile-tax-card__row-value">{m.value}</span>
              </div>
            ))}
          </div>
        </article>

        {/* Card domicile envisagé */}
        <article className="premium-domicile-tax-card premium-domicile-tax-card--target">
          <div className="premium-domicile-tax-card__header">
            <div>
              <div className="premium-domicile-tax-card__label">{result.next.label}</div>
              <div className="premium-domicile-tax-card__place">{result.next.value}</div>
            </div>
            {result.next.verdict ? (
              <div className={getVerdictClass(result.next.verdict)}>{result.next.verdict}</div>
            ) : null}
          </div>
          <div className="premium-domicile-tax-card__metrics">
            {result.next.metrics.map((m) => (
              <div key={m.label} className="premium-domicile-tax-card__row">
                <span className="premium-domicile-tax-card__row-label">{m.label}</span>
                <span className="premium-domicile-tax-card__row-value">{m.value}</span>
              </div>
            ))}
          </div>
        </article>

        {/* Card différence annuelle */}
        <article className="premium-domicile-diff-card">
          <div className="premium-domicile-diff-card__top">
            <div>
              <div className="premium-domicile-tax-card__label">Différence annuelle</div>
              <div className="premium-domicile-diff-card__value">{result.difference.value}</div>
            </div>
            <div className={getVerdictClass(result.difference.verdict)}>
              {getDiffBadgeLabel(result.difference.verdict)}
            </div>
          </div>
          <div className="premium-domicile-diff-card__helper">{result.difference.helper}</div>
          {result.difference.metrics.length > 0 ? (
            <div className="premium-domicile-tax-card__metrics">
              {result.difference.metrics.map((m) => (
                <div key={m.label} className="premium-domicile-tax-card__row">
                  <span className="premium-domicile-tax-card__row-label">{m.label}</span>
                  <span className="premium-domicile-tax-card__row-value">{m.value}</span>
                </div>
              ))}
            </div>
          ) : null}
        </article>
      </section>

      {/* Bloc 5 — Projection et décision */}
      <section className="premium-domicile-bloc">
        <header className="premium-domicile-bloc-header">
          <div className="premium-domicile-bloc-header__eyebrow">Projection</div>
          <h3 className="premium-domicile-bloc-header__title">Vue à long terme</h3>
        </header>

        <div className="premium-domicile-projection-grid">
          <article className="premium-domicile-projection-card">
            <div className="premium-domicile-projection-card__label">
              {projectionLabel} sur 5 ans
            </div>
            <div className="premium-domicile-projection-card__value">{delta5}</div>
            <div className="premium-domicile-projection-card__helper">
              Projection linéaire, toutes choses égales
            </div>
          </article>
          <article className="premium-domicile-projection-card">
            <div className="premium-domicile-projection-card__label">
              {projectionLabel} sur 10 ans
            </div>
            <div className="premium-domicile-projection-card__value">{delta10}</div>
            <div className="premium-domicile-projection-card__helper">
              Projection linéaire, toutes choses égales
            </div>
          </article>
        </div>

        <article className="premium-domicile-decision-card">
          <div className="premium-domicile-decision-card__message">{decisionMessage}</div>
          {result.synthesis ? (
            <div className="premium-domicile-synthesis">{result.synthesis}</div>
          ) : null}
          <button type="button" className="mobile-primary-action" disabled>
            Obtenir une analyse complète
          </button>
        </article>
      </section>
    </div>
  );
}
