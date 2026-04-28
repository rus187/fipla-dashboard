import { useState } from "react";
import "../mobile/mobile.css";
import type { MobileActiveClientDossier } from "../mobile/activeClientDossier";
import PremiumDomicileAccroche from "../mobile/PremiumDomicileAccroche";
import PremiumDomicileForm, { type PremiumDomicilePayload } from "../mobile/PremiumDomicileForm";
import type { MobileDomicileResult } from "../mobile/MobileDomicileFlow";

type View = "accroche" | "form" | "results";

type DesktopPremiumDomicilePanelProps = {
  initialDossier: MobileActiveClientDossier;
  onRun: (payload: PremiumDomicilePayload) => Promise<MobileDomicileResult>;
  onClose: () => void;
};

function fmtCHF(n: number): string {
  const rounded = Math.round(n);
  return "CHF " + rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'");
}

function fmtSignedCHF(amount: number): string {
  const abs = Math.abs(Math.round(amount));
  const sign = amount >= 0 ? "+" : "−";
  return `${sign} CHF ${abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'")}`;
}

function parseSignedCHF(s: string): number {
  const isNeg = s.startsWith("−") || s.startsWith("-");
  const n = parseInt(s.replace(/[^0-9]/g, ""), 10);
  return isNeg ? -(isNaN(n) ? 0 : n) : isNaN(n) ? 0 : n;
}

function verdictClass(v: string) {
  if (/favorable|plus avantageux/i.test(v)) return "mobile-comparison-badge mobile-comparison-badge--favorable";
  if (/défavorable|moins avantageux/i.test(v)) return "mobile-comparison-badge mobile-comparison-badge--defavorable";
  return "mobile-comparison-badge mobile-comparison-badge--neutre";
}

function PremiumDesktopResults({
  result,
  payload,
  onBack,
  onReset,
}: {
  result: MobileDomicileResult;
  payload: PremiumDomicilePayload;
  onBack: () => void;
  onReset: () => void;
}) {
  const annualDelta = parseSignedCHF(result.difference.value);
  const delta5 = fmtSignedCHF(annualDelta * 5);
  const delta10 = fmtSignedCHF(annualDelta * 10);
  const isMarried = /mari[eé]/i.test(payload.etatCivil);
  const projectionLabel =
    result.difference.verdict === "Favorable" ? "Économie"
    : result.difference.verdict === "Défavorable" ? "Surcoût"
    : "Écart";

  return (
    <div className="mobile-cards-stack">
      <div className="mobile-topbar">
        <button type="button" className="mobile-pill-button" onClick={onBack}>Retour</button>
        <button type="button" className="mobile-link-button" onClick={onReset}>Nouvelle comparaison</button>
      </div>

      {/* Situation actuelle */}
      <section className="premium-domicile-bloc">
        <header className="premium-domicile-bloc-header">
          <div className="premium-domicile-bloc-header__eyebrow">Situation actuelle</div>
          <h3 className="premium-domicile-bloc-header__title">Votre domicile de référence</h3>
        </header>
        <article className="premium-domicile-situation-card">
          <div className="premium-domicile-situation-card__location">
            {payload.currentLocality}
            <span className="premium-domicile-situation-card__zip"> &mdash; {payload.currentZip}</span>
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
              <div className="premium-domicile-situation-item__label">Salaire net contrib.</div>
              <div className="premium-domicile-situation-item__value">{fmtCHF(payload.salaireNetContribuable)}</div>
            </div>
            {isMarried && payload.salaireNetConjoint > 0 ? (
              <div className="premium-domicile-situation-item">
                <div className="premium-domicile-situation-item__label">Salaire net conjoint</div>
                <div className="premium-domicile-situation-item__value">{fmtCHF(payload.salaireNetConjoint)}</div>
              </div>
            ) : null}
            {payload.fortuneMobiliere > 0 ? (
              <div className="premium-domicile-situation-item">
                <div className="premium-domicile-situation-item__label">Fortune mobilière</div>
                <div className="premium-domicile-situation-item__value">{fmtCHF(payload.fortuneMobiliere)}</div>
              </div>
            ) : null}
            {payload.estProprietaire && payload.valeurFiscaleImmeuble > 0 ? (
              <div className="premium-domicile-situation-item">
                <div className="premium-domicile-situation-item__label">Valeur fiscale immeuble</div>
                <div className="premium-domicile-situation-item__value">{fmtCHF(payload.valeurFiscaleImmeuble)}</div>
              </div>
            ) : null}
          </div>
        </article>
      </section>

      {/* Domicile envisagé */}
      <section className="premium-domicile-bloc">
        <header className="premium-domicile-bloc-header">
          <div className="premium-domicile-bloc-header__eyebrow">Domicile envisagé</div>
          <h3 className="premium-domicile-bloc-header__title">La commune cible</h3>
        </header>
        <article className="premium-domicile-situation-card">
          <div className="premium-domicile-situation-card__location">
            {payload.newLocality}
            <span className="premium-domicile-situation-card__zip"> &mdash; {payload.newZip}</span>
          </div>
          <div className="premium-domicile-situation-card__scenario">{result.next.helper}</div>
        </article>
      </section>

      {/* Résultat comparatif */}
      <section className="premium-domicile-bloc">
        <header className="premium-domicile-bloc-header">
          <div className="premium-domicile-bloc-header__eyebrow">Résultat comparatif</div>
          <h3 className="premium-domicile-bloc-header__title">Impact fiscal immédiat</h3>
        </header>

        {[result.current, result.next].map((side, i) => (
          <article
            key={side.label}
            className={`premium-domicile-tax-card${i === 1 ? " premium-domicile-tax-card--target" : ""}`}
          >
            <div className="premium-domicile-tax-card__header">
              <div>
                <div className="premium-domicile-tax-card__label">{side.label}</div>
                <div className="premium-domicile-tax-card__place">{side.value}</div>
              </div>
              {side.verdict ? (
                <div className={verdictClass(side.verdict)}>{side.verdict}</div>
              ) : null}
            </div>
            <div className="premium-domicile-tax-card__metrics">
              {side.metrics.map((m) => (
                <div key={m.label} className="premium-domicile-tax-card__row">
                  <span className="premium-domicile-tax-card__row-label">{m.label}</span>
                  <span className="premium-domicile-tax-card__row-value">{m.value}</span>
                </div>
              ))}
            </div>
          </article>
        ))}

        <article className="premium-domicile-diff-card">
          <div className="premium-domicile-diff-card__top">
            <div>
              <div className="premium-domicile-tax-card__label">Différence annuelle</div>
              <div className="premium-domicile-diff-card__value">{result.difference.value}</div>
            </div>
            <div className={verdictClass(result.difference.verdict)}>
              {result.difference.verdict === "Favorable" ? "Plus avantageux"
                : result.difference.verdict === "Défavorable" ? "Moins avantageux"
                : "Équivalent"}
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

      {/* Projection */}
      <section className="premium-domicile-bloc">
        <header className="premium-domicile-bloc-header">
          <div className="premium-domicile-bloc-header__eyebrow">Projection</div>
          <h3 className="premium-domicile-bloc-header__title">Vue à long terme</h3>
        </header>
        <div className="premium-domicile-projection-grid">
          <article className="premium-domicile-projection-card">
            <div className="premium-domicile-projection-card__label">{projectionLabel} sur 5 ans</div>
            <div className="premium-domicile-projection-card__value">{delta5}</div>
            <div className="premium-domicile-projection-card__helper">Projection linéaire, toutes choses égales</div>
          </article>
          <article className="premium-domicile-projection-card">
            <div className="premium-domicile-projection-card__label">{projectionLabel} sur 10 ans</div>
            <div className="premium-domicile-projection-card__value">{delta10}</div>
            <div className="premium-domicile-projection-card__helper">Projection linéaire, toutes choses égales</div>
          </article>
        </div>
        <article className="premium-domicile-decision-card">
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

export default function DesktopPremiumDomicilePanel({
  initialDossier,
  onRun,
  onClose,
}: DesktopPremiumDomicilePanelProps) {
  const [activeDossier, setActiveDossier] = useState<MobileActiveClientDossier>(initialDossier);
  const [view, setView] = useState<View>("accroche");
  const [result, setResult] = useState<MobileDomicileResult | null>(null);
  const [lastPayload, setLastPayload] = useState<PremiumDomicilePayload | null>(null);

  const handleActiveDossierChange = (partial: Partial<MobileActiveClientDossier>) => {
    setActiveDossier((current) => ({ ...current, ...partial }));
  };

  const handleRun = async (payload: PremiumDomicilePayload): Promise<MobileDomicileResult> => {
    const r = await onRun(payload);
    setLastPayload(payload);
    setResult(r);
    setView("results");
    return r;
  };

  const handleReset = () => {
    setResult(null);
    setLastPayload(null);
    setView("accroche");
  };

  return (
    <div className="dpdp-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dpdp-panel" onClick={(e) => e.stopPropagation()}>
        <div className="dpdp-panel__inner">
          {view === "accroche" ? (
            <PremiumDomicileAccroche onStart={() => setView("form")} onBack={onClose} />
          ) : view === "form" ? (
            <PremiumDomicileForm
              onBack={() => setView("accroche")}
              onRun={handleRun}
              activeDossier={activeDossier}
              onActiveDossierChange={handleActiveDossierChange}
            />
          ) : (
            <PremiumDesktopResults
              result={result!}
              payload={lastPayload!}
              onBack={() => setView("form")}
              onReset={handleReset}
            />
          )}
        </div>
      </div>
    </div>
  );
}
