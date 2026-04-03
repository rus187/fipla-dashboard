import { useEffect, useState } from "react";
import type { MobileActiveClientDossier } from "./activeClientDossier";
import MobileAccordionSection from "./MobileAccordionSection";
import MobileComparisonCard from "./MobileComparisonCard";
import MobileIdentityStep from "./MobileIdentityStep";
import MobileNavigation from "./MobileNavigation";
import MobilePrimaryAction from "./MobilePrimaryAction";
import MobileSectionHeader from "./MobileSectionHeader";

export type MobileSimulationResult = {
  current: {
    label: string;
    value: string;
    helper: string;
    metrics: Array<{ label: string; value: string }>;
  };
  next: {
    label: string;
    value: string;
    helper: string;
    metrics: Array<{ label: string; value: string }>;
  };
  difference: {
    label: string;
    value: string;
    helper: string;
    verdict: "Favorable" | "Neutre" | "Défavorable";
    metrics: Array<{ label: string; value: string }>;
  };
  detailSections: Array<{ title: string; rows: Array<{ label: string; value: string }> }>;
};

export type MobileSimulationPayload = {
  prenom: string;
  nom: string;
  zip: string;
  locality: string;
  etatCivil: string;
  enfants: number;
  revenuImposableIfd: number;
  revenuImposableIcc: number;
  troisiemePilier: number;
  rachatLpp: number;
  variationRevenu: number;
  fortuneImposable: number;
};

type MobileSimulationFlowProps = {
  onBack: () => void;
  onResolveLocation: (zip: string) => { locality: string } | null;
  onRun: (payload: MobileSimulationPayload) => Promise<MobileSimulationResult>;
  activeDossier: MobileActiveClientDossier;
  onActiveDossierChange: (partial: Partial<MobileActiveClientDossier>) => void;
};

const steps = [
  { step: "Étape 1", label: "Identité" },
  { step: "Étape 2", label: "Situation actuelle" },
  { step: "Étape 3", label: "Scénario" },
  { step: "Étape 4", label: "Bases recalculées" },
  { step: "Étape 5", label: "Comparaison" },
  { step: "Étape 6", label: "Détail" },
];

function createInitialState(activeDossier: MobileActiveClientDossier): MobileSimulationPayload {
  return {
    prenom: activeDossier.prenom,
    nom: activeDossier.nom,
    zip: activeDossier.zip,
    locality: activeDossier.locality,
    etatCivil: activeDossier.etatCivil,
    enfants: activeDossier.enfants,
    revenuImposableIfd: activeDossier.revenuImposableIfd,
    revenuImposableIcc: activeDossier.revenuImposableIcc,
    troisiemePilier: activeDossier.troisiemePilier,
    rachatLpp: activeDossier.rachatLpp,
    variationRevenu: 0,
    fortuneImposable: activeDossier.fortuneImposable,
  };
}

export default function MobileSimulationFlow({
  onBack,
  onResolveLocation,
  onRun,
  activeDossier,
  onActiveDossierChange,
}: MobileSimulationFlowProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [form, setForm] = useState<MobileSimulationPayload>(() => createInitialState(activeDossier));
  const [result, setResult] = useState<MobileSimulationResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    setForm((current) => ({
      ...current,
      prenom: activeDossier.prenom,
      nom: activeDossier.nom,
      zip: activeDossier.zip,
      locality: activeDossier.locality,
      etatCivil: activeDossier.etatCivil,
      enfants: activeDossier.enfants,
      revenuImposableIfd: activeDossier.revenuImposableIfd,
      revenuImposableIcc: activeDossier.revenuImposableIcc,
      troisiemePilier: activeDossier.troisiemePilier,
      rachatLpp: activeDossier.rachatLpp,
      fortuneImposable: activeDossier.fortuneImposable,
    }));
  }, [activeDossier]);

  useEffect(() => {
    if (form.zip.trim().length < 4) return;

    const match = onResolveLocation(form.zip.trim());
    if (!match?.locality || match.locality === form.locality) return;

    setForm((current) => ({ ...current, locality: match.locality }));
    onActiveDossierChange({ zip: form.zip.trim(), locality: match.locality });
  }, [form.zip, form.locality, onResolveLocation]);

  const canRun =
    form.prenom.trim().length > 0 &&
    form.nom.trim().length > 0 &&
    form.zip.trim().length > 0 &&
    form.locality.trim().length > 0 &&
    form.etatCivil.trim().length > 0;
  const recalculatedIfd = Math.max(
    0,
    form.revenuImposableIfd - form.troisiemePilier - form.rachatLpp + form.variationRevenu
  );
  const recalculatedIcc = Math.max(
    0,
    form.revenuImposableIcc - form.troisiemePilier - form.rachatLpp + form.variationRevenu
  );
  const recalculatedFortune = Math.max(0, form.fortuneImposable + form.variationRevenu);

  const handleRun = async () => {
    if (!canRun) return;

    setIsRunning(true);

    try {
      const nextResult = await onRun(form);
      setResult(nextResult);
      setStepIndex(4);
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
            setForm(createInitialState(activeDossier));
            setResult(null);
            setStepIndex(0);
          }}
        >
          Réinitialiser
        </button>
      </div>

      <MobileSectionHeader
        eyebrow="Simulation fiscale"
        title="Diagnostic fiscal mobile"
        description="Une saisie épurée, pensée pour produire une lecture immédiate et premium en rendez-vous."
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
            onChange={(identity) => {
              setForm((current) => ({
                ...current,
                prenom: identity.prenom,
                nom: identity.nom,
                zip: identity.zip,
                locality: identity.locality,
                etatCivil: identity.etatCivil,
                enfants: identity.enfants,
              }));
              onActiveDossierChange({
                prenom: identity.prenom,
                nom: identity.nom,
                zip: identity.zip,
                locality: identity.locality,
                etatCivil: identity.etatCivil,
                enfants: identity.enfants,
              });
            }}
          />
          <MobilePrimaryAction label="Passer à la base actuelle" onClick={() => setStepIndex(1)} />
        </>
      ) : null}

      {stepIndex === 1 ? (
        <>
          <div className="mobile-form-grid">
            <label className="mobile-field">
              <span className="mobile-field__label">Revenu imposable IFD</span>
              <input
                className="mobile-field__input"
                type="number"
                inputMode="numeric"
                value={form.revenuImposableIfd}
                onChange={(event) => {
                  const value = Number(event.target.value || 0);
                  setForm((current) => ({
                    ...current,
                    revenuImposableIfd: value,
                  }));
                  onActiveDossierChange({ revenuImposableIfd: value });
                }}
              />
            </label>

            <label className="mobile-field">
              <span className="mobile-field__label">Revenu imposable ICC</span>
              <input
                className="mobile-field__input"
                type="number"
                inputMode="numeric"
                value={form.revenuImposableIcc}
                onChange={(event) => {
                  const value = Number(event.target.value || 0);
                  setForm((current) => ({
                    ...current,
                    revenuImposableIcc: value,
                  }));
                  onActiveDossierChange({ revenuImposableIcc: value });
                }}
              />
            </label>

            <label className="mobile-field">
              <span className="mobile-field__label">Fortune imposable</span>
              <input
                className="mobile-field__input"
                type="number"
                inputMode="numeric"
                value={form.fortuneImposable}
                onChange={(event) => {
                  const value = Number(event.target.value || 0);
                  setForm((current) => ({
                    ...current,
                    fortuneImposable: value,
                  }));
                  onActiveDossierChange({ fortuneImposable: value });
                }}
              />
            </label>
          </div>
          <div className="mobile-secondary-row">
            <button type="button" className="mobile-secondary-action" onClick={() => setStepIndex(0)}>
              Précédent
            </button>
          </div>
          <MobilePrimaryAction label="Passer au scénario d’optimisation" onClick={() => setStepIndex(2)} />
        </>
      ) : null}

      {stepIndex === 2 ? (
        <>
          <div className="mobile-form-grid">
            <label className="mobile-field">
              <span className="mobile-field__label">Cotisation 3e pilier</span>
              <input
                className="mobile-field__input"
                type="number"
                inputMode="numeric"
                value={form.troisiemePilier}
                onChange={(event) => {
                  const value = Number(event.target.value || 0);
                  setForm((current) => ({
                    ...current,
                    troisiemePilier: value,
                  }));
                  onActiveDossierChange({ troisiemePilier: value });
                }}
              />
            </label>

            <label className="mobile-field">
              <span className="mobile-field__label">Rachat LPP</span>
              <input
                className="mobile-field__input"
                type="number"
                inputMode="numeric"
                value={form.rachatLpp}
                onChange={(event) => {
                  const value = Number(event.target.value || 0);
                  setForm((current) => ({
                    ...current,
                    rachatLpp: value,
                  }));
                  onActiveDossierChange({ rachatLpp: value });
                }}
              />
            </label>
            <label className="mobile-field">
              <span className="mobile-field__label">Variation de revenu</span>
              <input
                className="mobile-field__input"
                type="number"
                inputMode="numeric"
                value={form.variationRevenu}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    variationRevenu: Number(event.target.value || 0),
                  }))
                }
              />
            </label>
          </div>
          <div className="mobile-secondary-row">
            <button type="button" className="mobile-secondary-action" onClick={() => setStepIndex(1)}>
              Précédent
            </button>
          </div>
          <MobilePrimaryAction label="Passer aux données recalculées" onClick={() => setStepIndex(3)} />
        </>
      ) : null}

      {stepIndex === 3 ? (
        <>
          <div className="mobile-cards-stack">
            <article className="mobile-flow-card">
              <h3 className="mobile-flow-card__title">Données fiscales recalculées</h3>
              <div className="mobile-result-grid">
                <div className="mobile-result-row">
                  <span className="mobile-result-row__name">Nouveau revenu imposable IFD</span>
                  <span className="mobile-result-row__value">{recalculatedIfd.toLocaleString("fr-CH")} CHF</span>
                </div>
                <div className="mobile-result-row">
                  <span className="mobile-result-row__name">Nouveau revenu imposable ICC</span>
                  <span className="mobile-result-row__value">{recalculatedIcc.toLocaleString("fr-CH")} CHF</span>
                </div>
                <div className="mobile-result-row">
                  <span className="mobile-result-row__name">Fortune imposable</span>
                  <span className="mobile-result-row__value">{recalculatedFortune.toLocaleString("fr-CH")} CHF</span>
                </div>
              </div>
            </article>
          </div>
          <div className="mobile-secondary-row">
            <button type="button" className="mobile-secondary-action" onClick={() => setStepIndex(2)}>
              Précédent
            </button>
          </div>
          <MobilePrimaryAction
            label={isRunning ? "Analyse en cours..." : "Afficher la comparaison"}
            onClick={() => {
              void handleRun();
            }}
            disabled={!canRun || isRunning}
          />
        </>
      ) : null}

      {stepIndex === 4 && result ? (
        <>
          <MobileComparisonCard current={result.current} next={result.next} difference={result.difference} />
          <div className="mobile-secondary-row">
            <button type="button" className="mobile-secondary-action" onClick={() => setStepIndex(3)}>
              Précédent
            </button>
            <button type="button" className="mobile-secondary-action" onClick={() => setStepIndex(5)}>
              Voir le détail
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
