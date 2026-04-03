import { useEffect, useState } from "react";
import type { MobileActiveClientDossier } from "./activeClientDossier";
import MobileAccordionSection from "./MobileAccordionSection";
import MobileComparisonCard from "./MobileComparisonCard";
import MobileIdentityStep from "./MobileIdentityStep";
import MobileNavigation from "./MobileNavigation";
import MobilePrimaryAction from "./MobilePrimaryAction";
import MobileSectionHeader from "./MobileSectionHeader";

export type MobileEnfantTransitionPayload = {
  prenom: string;
  nom: string;
  zip: string;
  locality: string;
  etatCivil: string;
  enfants: number;
  revenuImposableIfd: number;
  revenuImposableIcc: number;
  fortuneImposable: number;
  enfantACharge: "oui" | "non";
  statutEnfant: "formation" | "etudes" | "autre";
  deductionEnfantActive: "oui" | "non";
  baremeActuel: "avec-enfant" | "standard";
  situationApres: "majorite" | "fin-formation";
  changementBaremeDivorce: "oui" | "non";
  enfantsApres: number;
};

export type MobileEnfantTransitionResult = {
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

type MobileEnfantTransitionFlowProps = {
  onBack: () => void;
  onResolveLocation: (zip: string) => { locality: string } | null;
  onRun: (payload: MobileEnfantTransitionPayload) => Promise<MobileEnfantTransitionResult>;
  activeDossier: MobileActiveClientDossier;
  onActiveDossierChange: (partial: Partial<MobileActiveClientDossier>) => void;
};

const steps = [
  { step: "Étape 1", label: "Identité" },
  { step: "Étape 2", label: "Situation actuelle" },
  { step: "Étape 3", label: "Après changement" },
  { step: "Étape 4", label: "Données fiscales" },
  { step: "Étape 5", label: "Comparaison" },
  { step: "Étape 6", label: "Détail" },
];

const initialState: MobileEnfantTransitionPayload = {
  prenom: "",
  nom: "",
  zip: "",
  locality: "",
  etatCivil: "",
  enfants: 1,
  revenuImposableIfd: 0,
  revenuImposableIcc: 0,
  fortuneImposable: 0,
  enfantACharge: "oui",
  statutEnfant: "formation",
  deductionEnfantActive: "oui",
  baremeActuel: "avec-enfant",
  situationApres: "majorite",
  changementBaremeDivorce: "non",
  enfantsApres: 0,
};

function createInitialState(activeDossier: MobileActiveClientDossier): MobileEnfantTransitionPayload {
  return {
    ...initialState,
    prenom: activeDossier.prenom,
    nom: activeDossier.nom,
    zip: activeDossier.zip,
    locality: activeDossier.locality,
    etatCivil: activeDossier.etatCivil,
    enfants: activeDossier.enfants > 0 ? activeDossier.enfants : 1,
    revenuImposableIfd: activeDossier.revenuImposableIfd,
    revenuImposableIcc: activeDossier.revenuImposableIcc,
    fortuneImposable: activeDossier.fortuneImposable,
    enfantsApres: activeDossier.enfants > 0 ? Math.max(0, activeDossier.enfants - 1) : 0,
  };
}

export default function MobileEnfantTransitionFlow({
  onBack,
  onResolveLocation,
  onRun,
  activeDossier,
  onActiveDossierChange,
}: MobileEnfantTransitionFlowProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [form, setForm] = useState<MobileEnfantTransitionPayload>(() => createInitialState(activeDossier));
  const [result, setResult] = useState<MobileEnfantTransitionResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    setForm((current) => ({
      ...(function () {
        const nextChildren = activeDossier.enfants > 0 ? activeDossier.enfants : current.enfants;
        const suggestedAfterChildren = Math.max(0, nextChildren - 1);
        return {
          ...current,
          prenom: activeDossier.prenom,
          nom: activeDossier.nom,
          zip: activeDossier.zip,
          locality: activeDossier.locality,
          etatCivil: activeDossier.etatCivil,
          enfants: nextChildren,
          revenuImposableIfd: activeDossier.revenuImposableIfd,
          revenuImposableIcc: activeDossier.revenuImposableIcc,
          fortuneImposable: activeDossier.fortuneImposable,
          enfantsApres:
            current.enfants !== nextChildren
              ? Math.min(suggestedAfterChildren, nextChildren)
              : Math.min(current.enfantsApres, nextChildren),
        };
      })(),
    }));
  }, [activeDossier]);

  useEffect(() => {
    if (form.zip.trim().length < 4) return;
    const match = onResolveLocation(form.zip.trim());
    if (!match?.locality || match.locality === form.locality) return;
    setForm((current) => ({ ...current, locality: match.locality }));
    onActiveDossierChange({ zip: form.zip.trim(), locality: match.locality });
  }, [form.zip, form.locality, onResolveLocation]);

  const hasTaxwareContext =
    form.zip.trim().length > 0 &&
    form.locality.trim().length > 0 &&
    form.etatCivil.trim().length > 0;

  const hasTaxwareBases =
    Number.isFinite(form.revenuImposableIfd) &&
    form.revenuImposableIfd >= 0 &&
    Number.isFinite(form.revenuImposableIcc) &&
    form.revenuImposableIcc >= 0 &&
    Number.isFinite(form.fortuneImposable) &&
    form.fortuneImposable >= 0;

  const canRun = hasTaxwareContext && hasTaxwareBases;

  const projectedChildren = Math.max(0, Math.min(form.enfants, form.enfantsApres));

  useEffect(() => {
    setForm((current) => {
      const suggestedChildren =
        current.enfantACharge === "oui" && current.deductionEnfantActive === "oui"
          ? Math.max(0, current.enfants - 1)
          : current.enfants;

      if (current.enfantsApres > current.enfants) {
        return { ...current, enfantsApres: current.enfants };
      }

      if (
        current.enfantsApres === 0 &&
        current.enfants > 0 &&
        current.enfantACharge === "oui" &&
        current.deductionEnfantActive === "oui"
      ) {
        return { ...current, enfantsApres: suggestedChildren };
      }

      return current;
    });
  }, [form.enfants, form.enfantACharge, form.deductionEnfantActive]);

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
        eyebrow="Transition enfant"
        title="Fin de déduction enfant"
        description="Un module de démonstration pour montrer l’impact fiscal d’un passage à la majorité ou d’une fin de formation. MARQUEUR ACTIF 53233."
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
                enfantsApres: Math.min(current.enfantsApres, identity.enfants),
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
          <MobilePrimaryAction label="Passer à la situation actuelle" onClick={() => setStepIndex(1)} />
        </>
      ) : null}

      {stepIndex === 1 ? (
        <>
          <div className="mobile-form-grid">
            <label className="mobile-field">
              <span className="mobile-field__label">Revenu imposable IFD</span>
              <input className="mobile-field__input" type="number" inputMode="numeric" value={form.revenuImposableIfd} onChange={(event) => {
                const value = Number(event.target.value || 0);
                setForm((current) => ({ ...current, revenuImposableIfd: value }));
                onActiveDossierChange({ revenuImposableIfd: value });
              }} />
            </label>
            <label className="mobile-field">
              <span className="mobile-field__label">Revenu imposable ICC</span>
              <input className="mobile-field__input" type="number" inputMode="numeric" value={form.revenuImposableIcc} onChange={(event) => {
                const value = Number(event.target.value || 0);
                setForm((current) => ({ ...current, revenuImposableIcc: value }));
                onActiveDossierChange({ revenuImposableIcc: value });
              }} />
            </label>
            <label className="mobile-field">
              <span className="mobile-field__label">Fortune imposable</span>
              <input className="mobile-field__input" type="number" inputMode="numeric" value={form.fortuneImposable} onChange={(event) => {
                const value = Number(event.target.value || 0);
                setForm((current) => ({ ...current, fortuneImposable: value }));
                onActiveDossierChange({ fortuneImposable: value });
              }} />
            </label>
            <label className="mobile-field">
              <span className="mobile-field__label">Enfant à charge</span>
              <select className="mobile-field__select" value={form.enfantACharge} onChange={(event) => setForm((current) => ({ ...current, enfantACharge: event.target.value as "oui" | "non" }))}>
                <option value="oui">Oui</option>
                <option value="non">Non</option>
              </select>
            </label>
            <label className="mobile-field">
              <span className="mobile-field__label">Statut enfant</span>
              <select className="mobile-field__select" value={form.statutEnfant} onChange={(event) => setForm((current) => ({ ...current, statutEnfant: event.target.value as "formation" | "etudes" | "autre" }))}>
                <option value="formation">En formation</option>
                <option value="etudes">En études</option>
                <option value="autre">Autre situation</option>
              </select>
            </label>
            <label className="mobile-field">
              <span className="mobile-field__label">Déduction enfant active</span>
              <select className="mobile-field__select" value={form.deductionEnfantActive} onChange={(event) => setForm((current) => ({ ...current, deductionEnfantActive: event.target.value as "oui" | "non" }))}>
                <option value="oui">Oui</option>
                <option value="non">Non</option>
              </select>
            </label>
            <label className="mobile-field">
              <span className="mobile-field__label">Barème actuel</span>
              <select className="mobile-field__select" value={form.baremeActuel} onChange={(event) => setForm((current) => ({ ...current, baremeActuel: event.target.value as "avec-enfant" | "standard" }))}>
                <option value="avec-enfant">Avec enfant</option>
                <option value="standard">Standard</option>
              </select>
            </label>
          </div>
          <div className="mobile-secondary-row">
            <button type="button" className="mobile-secondary-action" onClick={() => setStepIndex(0)}>Précédent</button>
          </div>
          <MobilePrimaryAction label="Passer à l’après changement" onClick={() => setStepIndex(2)} />
        </>
      ) : null}

      {stepIndex === 2 ? (
        <>
          <div className="mobile-form-grid">
            <label className="mobile-field">
              <span className="mobile-field__label">Situation après changement</span>
              <select className="mobile-field__select" value={form.situationApres} onChange={(event) => setForm((current) => ({ ...current, situationApres: event.target.value as "majorite" | "fin-formation" }))}>
                <option value="majorite">Enfant majeur</option>
                <option value="fin-formation">Fin de formation</option>
              </select>
            </label>
            <label className="mobile-field">
              <span className="mobile-field__label">Suppression déduction enfant</span>
              <select className="mobile-field__select" value={form.deductionEnfantActive} onChange={(event) => setForm((current) => ({ ...current, deductionEnfantActive: event.target.value as "oui" | "non" }))}>
                <option value="oui">La déduction disparaît</option>
                <option value="non">Pas de déduction active</option>
              </select>
            </label>
            <label className="mobile-field">
              <span className="mobile-field__label">Changement de barème si parent divorcé</span>
              <select className="mobile-field__select" value={form.changementBaremeDivorce} onChange={(event) => setForm((current) => ({ ...current, changementBaremeDivorce: event.target.value as "oui" | "non" }))}>
                <option value="non">Non</option>
                <option value="oui">Oui</option>
              </select>
            </label>
            <label className="mobile-field">
              <span className="mobile-field__label">Enfants restant à charge après changement</span>
              <input
                className="mobile-field__input"
                type="number"
                inputMode="numeric"
                min={0}
                max={form.enfants}
                value={projectedChildren}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    enfantsApres: Math.max(
                      0,
                      Math.min(current.enfants, Number(event.target.value || 0))
                    ),
                  }))
                }
              />
            </label>
          </div>
          <div className="mobile-cards-stack">
            <article className="mobile-flow-card">
              <h3 className="mobile-flow-card__title">Lecture après changement</h3>
              <p className="mobile-flow-card__text">
                Le scénario après changement transmet à TaxWare la même base fiscale, la même situation familiale et le nombre réel d’enfants restant à charge. Les déductions sociales et diverses sont alors produites par TaxWare, sans reconstitution locale.
              </p>
            </article>
            <article className="mobile-flow-card">
              <h3 className="mobile-flow-card__title">Projection familiale</h3>
              <div className="mobile-result-grid">
                <div className="mobile-result-row">
                  <span className="mobile-result-row__name">Enfants actuellement pris en compte</span>
                  <span className="mobile-result-row__value">{form.enfants}</span>
                </div>
                <div className="mobile-result-row">
                  <span className="mobile-result-row__name">Enfants après changement</span>
                  <span className="mobile-result-row__value">{projectedChildren}</span>
                </div>
              </div>
            </article>
          </div>
          <div className="mobile-secondary-row">
            <button type="button" className="mobile-secondary-action" onClick={() => setStepIndex(1)}>Précédent</button>
          </div>
          <MobilePrimaryAction label="Passer aux données fiscales" onClick={() => setStepIndex(3)} />
        </>
      ) : null}

      {stepIndex === 3 ? (
        <>
          <div className="mobile-form-grid">
            <label className="mobile-field">
              <span className="mobile-field__label">Base IFD transmise à TaxWare</span>
              <input className="mobile-field__input" type="number" inputMode="numeric" value={form.revenuImposableIfd} readOnly />
            </label>
            <label className="mobile-field">
              <span className="mobile-field__label">Base ICC transmise à TaxWare</span>
              <input className="mobile-field__input" type="number" inputMode="numeric" value={form.revenuImposableIcc} readOnly />
            </label>
            <label className="mobile-field">
              <span className="mobile-field__label">Fortune imposable transmise</span>
              <input className="mobile-field__input" type="number" inputMode="numeric" value={form.fortuneImposable} readOnly />
            </label>
          </div>
          <div className="mobile-secondary-row">
            <button type="button" className="mobile-secondary-action" onClick={() => setStepIndex(2)}>Précédent</button>
          </div>
          <MobilePrimaryAction label={isRunning ? "Analyse en cours..." : "Afficher la comparaison"} onClick={() => { void handleRun(); }} disabled={!canRun || isRunning} />
        </>
      ) : null}

      {stepIndex === 4 && result ? (
        <>
          <MobileComparisonCard current={result.current} next={result.next} difference={result.difference} />
          <div className="mobile-secondary-row">
            <button type="button" className="mobile-secondary-action" onClick={() => setStepIndex(3)}>Précédent</button>
            <button type="button" className="mobile-secondary-action" onClick={() => setStepIndex(5)}>Voir le détail</button>
          </div>
        </>
      ) : null}

      {stepIndex === 5 && result ? (
        <>
          <div className="mobile-secondary-row">
            <button type="button" className="mobile-secondary-action" onClick={() => setStepIndex(4)}>Précédent</button>
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
