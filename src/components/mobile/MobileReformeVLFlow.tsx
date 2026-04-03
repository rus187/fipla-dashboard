import { useEffect, useState } from "react";
import MobileAccordionSection from "./MobileAccordionSection";
import MobileIdentityStep from "./MobileIdentityStep";
import MobileNavigation from "./MobileNavigation";
import MobilePrimaryAction from "./MobilePrimaryAction";
import MobileResultCard from "./MobileResultCard";
import MobileSectionHeader from "./MobileSectionHeader";

export type MobileReformePayload = {
  prenom: string;
  nom: string;
  zip: string;
  locality: string;
  etatCivil: string;
  enfants: number;
  revenuImposableIfd: number;
  revenuImposableIcc: number;
  fortuneImposable: number;
  residencePrincipale: "oui" | "non";
  bienRendement: "oui" | "non";
  valeurFiscale: number;
  revenuLocatif: number;
  interetsHypothecaires: number;
  chargesLieesAuBien: number;
};

export type MobileReformeResult = {
  currentTitle: string;
  currentHelper: string;
  currentMetrics: Array<{ label: string; value: string }>;
  projectedTitle: string;
  projectedHelper: string;
  projectedMetrics: Array<{ label: string; value: string }>;
  verdict: "Favorable" | "Neutre" | "Défavorable";
  deltaLabel: string;
  deltaValue: string;
  detailSections: Array<{ title: string; rows: Array<{ label: string; value: string }> }>;
};

type MobileReformeVLFlowProps = {
  onBack: () => void;
  onResolveLocation: (zip: string) => { locality: string } | null;
  onRun: (payload: MobileReformePayload) => Promise<MobileReformeResult>;
};

const steps = [
  { step: "Étape 1", label: "Identité" },
  { step: "Étape 2", label: "Avant réforme" },
  { step: "Étape 3", label: "Après réforme" },
  { step: "Étape 4", label: "Données fiscales" },
  { step: "Étape 5", label: "Comparaison" },
  { step: "Étape 6", label: "Détail" },
];

const initialState: MobileReformePayload = {
  prenom: "",
  nom: "",
  zip: "",
  locality: "",
  etatCivil: "",
  enfants: 0,
  revenuImposableIfd: 0,
  revenuImposableIcc: 0,
  fortuneImposable: 0,
  residencePrincipale: "oui",
  bienRendement: "non",
  valeurFiscale: 0,
  revenuLocatif: 0,
  interetsHypothecaires: 0,
  chargesLieesAuBien: 0,
};

function getVerdictClassName(verdict: MobileReformeResult["verdict"]) {
  if (verdict === "Favorable") {
    return "mobile-comparison-badge mobile-comparison-badge--favorable";
  }

  if (verdict === "Défavorable") {
    return "mobile-comparison-badge mobile-comparison-badge--defavorable";
  }

  return "mobile-comparison-badge mobile-comparison-badge--neutre";
}

export default function MobileReformeVLFlow({
  onBack,
  onResolveLocation,
  onRun,
}: MobileReformeVLFlowProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [form, setForm] = useState(initialState);
  const [result, setResult] = useState<MobileReformeResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    if (form.zip.trim().length < 4) return;

    const match = onResolveLocation(form.zip.trim());
    if (!match?.locality || match.locality === form.locality) return;

    setForm((current) => ({ ...current, locality: match.locality }));
  }, [form.zip, form.locality, onResolveLocation]);

  const canRun =
    form.prenom.trim().length > 0 &&
    form.nom.trim().length > 0 &&
    form.zip.trim().length > 0 &&
    form.locality.trim().length > 0 &&
    form.etatCivil.trim().length > 0;

  const valeurLocativeAvant = form.residencePrincipale === "oui" ? Math.max(0, form.revenuLocatif) : 0;
  const ajustementReforme = Math.max(
    0,
    form.chargesLieesAuBien + form.interetsHypothecaires - valeurLocativeAvant
  );
  const baseIfdApresReforme = Math.max(0, form.revenuImposableIfd + ajustementReforme);
  const baseIccApresReforme = Math.max(0, form.revenuImposableIcc + ajustementReforme);

  const handleRun = async () => {
    if (!canRun) return;

    setIsRunning(true);

    try {
      const nextResult = await onRun(form);
      setResult(nextResult);
      setStepIndex(3);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="mobile-cards-stack">
      <div className="mobile-topbar">
        <button type="button" className="mobile-pill-button" onClick={onBack}>
          Retour
        </button>
        <button
          type="button"
          className="mobile-link-button"
          onClick={() => {
            setForm(initialState);
            setResult(null);
            setStepIndex(0);
          }}
        >
          Réinitialiser
        </button>
      </div>

      <MobileSectionHeader
        eyebrow="Réforme valeur locative"
        title="Lecture immobilière premium"
        description="Une restitution épurée pour montrer rapidement l’effet d’une réforme sur la fiscalité immobilière."
      />

      <MobileNavigation items={steps} activeIndex={stepIndex} onSelect={setStepIndex} />

      {stepIndex === 0 ? (
        <>
          <MobileIdentityStep
            value={{
              prenom: form.prenom,
              nom: form.nom,
              zip: form.zip,
              locality: form.locality,
              etatCivil: form.etatCivil,
              enfants: form.enfants,
            }}
            onChange={(identity) =>
              setForm((current) => ({
                ...current,
                prenom: identity.prenom,
                nom: identity.nom,
                zip: identity.zip,
                locality: identity.locality,
                etatCivil: identity.etatCivil,
                enfants: identity.enfants,
              }))
            }
          />
          <MobilePrimaryAction label="Passer à l’avant réforme" onClick={() => setStepIndex(1)} />
        </>
      ) : null}

      {stepIndex === 1 ? (
        <>
          <div className="mobile-form-grid">
            <label className="mobile-field">
              <span className="mobile-field__label">Situation fiscale actuelle</span>
              <select
                className="mobile-field__select"
                value={form.residencePrincipale}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    residencePrincipale: event.target.value as "oui" | "non",
                  }))
                }
              >
                <option value="oui">Habitation propre active</option>
                <option value="non">Sans habitation propre</option>
              </select>
            </label>

            <label className="mobile-field">
              <span className="mobile-field__label">Valeur locative</span>
              <input
                className="mobile-field__input"
                type="number"
                inputMode="numeric"
                value={valeurLocativeAvant}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    revenuLocatif: Number(event.target.value || 0),
                  }))
                }
              />
            </label>

            <label className="mobile-field">
              <span className="mobile-field__label">Revenus liés au bien</span>
              <select
                className="mobile-field__select"
                value={form.bienRendement}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    bienRendement: event.target.value as "oui" | "non",
                  }))
                }
              >
                <option value="non">Aucun revenu de rendement</option>
                <option value="oui">Bien de rendement actif</option>
              </select>
            </label>

            <label className="mobile-field">
              <span className="mobile-field__label">Montant des revenus liés au bien</span>
              <input
                className="mobile-field__input"
                type="number"
                inputMode="numeric"
                value={form.revenuLocatif}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    revenuLocatif: Number(event.target.value || 0),
                  }))
                }
              />
            </label>

            <label className="mobile-field">
              <span className="mobile-field__label">Intérêts hypothécaires</span>
              <input
                className="mobile-field__input"
                type="number"
                inputMode="numeric"
                value={form.interetsHypothecaires}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    interetsHypothecaires: Number(event.target.value || 0),
                  }))
                }
              />
            </label>

            <label className="mobile-field">
              <span className="mobile-field__label">Charges liées au bien</span>
              <input
                className="mobile-field__input"
                type="number"
                inputMode="numeric"
                value={form.chargesLieesAuBien}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    chargesLieesAuBien: Number(event.target.value || 0),
                  }))
                }
              />
            </label>
          </div>
          <div className="mobile-secondary-row">
            <button type="button" className="mobile-secondary-action" onClick={() => setStepIndex(0)}>
              Précédent
            </button>
          </div>
          <MobilePrimaryAction label="Passer à l’après réforme" onClick={() => setStepIndex(2)} />
        </>
      ) : null}

      {stepIndex === 2 ? (
        <>
          <div className="mobile-cards-stack">
            <article className="mobile-flow-card">
              <h3 className="mobile-flow-card__title">Simulation après suppression de la valeur locative</h3>
              <p className="mobile-flow-card__text">
                La valeur locative de l’habitation propre est retirée de la base de lecture, puis les
                intérêts et charges conservés viennent ajuster la nouvelle assiette fiscale.
              </p>
            </article>

            <article className="mobile-flow-card">
              <h3 className="mobile-flow-card__title">Ajustements fiscaux</h3>
              <div className="mobile-result-grid">
                <div className="mobile-result-row">
                  <span className="mobile-result-row__name">Valeur locative supprimée</span>
                  <span className="mobile-result-row__value">
                    {valeurLocativeAvant.toLocaleString("fr-CH")} CHF
                  </span>
                </div>
                <div className="mobile-result-row">
                  <span className="mobile-result-row__name">Intérêts conservés</span>
                  <span className="mobile-result-row__value">
                    {form.interetsHypothecaires.toLocaleString("fr-CH")} CHF
                  </span>
                </div>
                <div className="mobile-result-row">
                  <span className="mobile-result-row__name">Charges conservées</span>
                  <span className="mobile-result-row__value">
                    {form.chargesLieesAuBien.toLocaleString("fr-CH")} CHF
                  </span>
                </div>
                <div className="mobile-result-row">
                  <span className="mobile-result-row__name">Ajustement estimé</span>
                  <span className="mobile-result-row__value">
                    {ajustementReforme.toLocaleString("fr-CH")} CHF
                  </span>
                </div>
              </div>
            </article>

            <article className="mobile-flow-card">
              <h3 className="mobile-flow-card__title">Nouvelles bases après réforme</h3>
              <div className="mobile-result-grid">
                <div className="mobile-result-row">
                  <span className="mobile-result-row__name">Base IFD projetée</span>
                  <span className="mobile-result-row__value">
                    {baseIfdApresReforme.toLocaleString("fr-CH")} CHF
                  </span>
                </div>
                <div className="mobile-result-row">
                  <span className="mobile-result-row__name">Base ICC projetée</span>
                  <span className="mobile-result-row__value">
                    {baseIccApresReforme.toLocaleString("fr-CH")} CHF
                  </span>
                </div>
                <div className="mobile-result-row">
                  <span className="mobile-result-row__name">Fortune imposable</span>
                  <span className="mobile-result-row__value">
                    {form.fortuneImposable.toLocaleString("fr-CH")} CHF
                  </span>
                </div>
              </div>
            </article>
          </div>
          <div className="mobile-secondary-row">
            <button type="button" className="mobile-secondary-action" onClick={() => setStepIndex(1)}>
              Précédent
            </button>
          </div>
          <MobilePrimaryAction label="Passer aux données fiscales" onClick={() => setStepIndex(3)} />
        </>
      ) : null}

      {stepIndex === 3 ? (
        <>
          <div className="mobile-form-grid">
            <label className="mobile-field">
              <span className="mobile-field__label">Revenu imposable IFD</span>
              <input
                className="mobile-field__input"
                type="number"
                inputMode="numeric"
                value={form.revenuImposableIfd}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    revenuImposableIfd: Number(event.target.value || 0),
                  }))
                }
              />
            </label>

            <label className="mobile-field">
              <span className="mobile-field__label">Revenu imposable ICC</span>
              <input
                className="mobile-field__input"
                type="number"
                inputMode="numeric"
                value={form.revenuImposableIcc}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    revenuImposableIcc: Number(event.target.value || 0),
                  }))
                }
              />
            </label>

            <label className="mobile-field">
              <span className="mobile-field__label">Fortune imposable</span>
              <input
                className="mobile-field__input"
                type="number"
                inputMode="numeric"
                value={form.fortuneImposable}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    fortuneImposable: Number(event.target.value || 0),
                  }))
                }
              />
            </label>
          </div>
          <div className="mobile-secondary-row">
            <button type="button" className="mobile-secondary-action" onClick={() => setStepIndex(2)}>
              Précédent
            </button>
          </div>
          <MobilePrimaryAction
            label={isRunning ? "Analyse en cours..." : "Comparer la réforme"}
            onClick={() => {
              void handleRun();
            }}
            disabled={!canRun || isRunning}
          />
        </>
      ) : null}

      {stepIndex === 4 && result ? (
        <>
          <MobileResultCard
            eyebrow="Situation actuelle"
            title={result.currentTitle}
            helper={result.currentHelper}
            metrics={result.currentMetrics}
          />
          <MobileResultCard
            eyebrow="Après réforme"
            title={result.projectedTitle}
            helper={result.projectedHelper}
            metrics={result.projectedMetrics}
          />
          <article className="mobile-comparison-card">
            <div className="mobile-comparison-card__label">{result.deltaLabel}</div>
            <div className="mobile-comparison-card__value">{result.deltaValue}</div>
            <div className={getVerdictClassName(result.verdict)}>{result.verdict}</div>
          </article>
          <div className="mobile-secondary-row">
            <button type="button" className="mobile-secondary-action" onClick={() => setStepIndex(3)}>
              Précédent
            </button>
            <button type="button" className="mobile-secondary-action" onClick={() => setStepIndex(5)}>
              Ouvrir les détails
            </button>
          </div>
        </>
      ) : null}

      {stepIndex === 5 && result ? (
        <>
          <div className="mobile-secondary-row">
            <button type="button" className="mobile-secondary-action" onClick={() => setStepIndex(4)}>
              Précédent
            </button>
          </div>
          <div className="mobile-accordion-stack">
            {result.detailSections.map((section) => (
              <MobileAccordionSection key={section.title} title={section.title} rows={section.rows} />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
