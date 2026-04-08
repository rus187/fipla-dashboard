import { useEffect, useState } from "react";
import type { MobileActiveClientDossier } from "./activeClientDossier";
import MobileAccordionSection from "./MobileAccordionSection";
import MobileComparisonCard from "./MobileComparisonCard";
import MobileNavigation from "./MobileNavigation";
import MobilePrimaryAction from "./MobilePrimaryAction";
import MobileSectionHeader from "./MobileSectionHeader";
import {
  resolveSwissLocationSelection,
  searchSwissLocations,
} from "../../lib/geography/locationLookup";

export type MobileDomicilePayload = {
  prenom: string;
  nom: string;
  etatCivil: string;
  enfants: number;
  currentZip: string;
  currentLocality: string;
  newZip: string;
  newLocality: string;
  revenuImposableIfd: number;
  revenuImposableIcc: number;
  troisiemePilier: number;
  rachatLpp: number;
  fortuneImposable: number;
};

export type MobileDomicileResult = {
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

type MobileDomicileFlowProps = {
  onBack: () => void;
  onResolveLocation: (zip: string) => { locality: string } | null;
  onRun: (payload: MobileDomicilePayload) => Promise<MobileDomicileResult>;
  activeDossier: MobileActiveClientDossier;
  onActiveDossierChange: (partial: Partial<MobileActiveClientDossier>) => void;
};

const steps = [
  { step: "Étape 1", label: "Identité" },
  { step: "Étape 2", label: "Domicile actuel" },
  { step: "Étape 3", label: "Nouveau domicile" },
  { step: "Étape 4", label: "Données fiscales" },
  { step: "Étape 5", label: "Comparaison" },
  { step: "Étape 6", label: "Détail" },
];

function createInitialState(activeDossier: MobileActiveClientDossier): MobileDomicilePayload {
  return {
    prenom: activeDossier.prenom,
    nom: activeDossier.nom,
    etatCivil: activeDossier.etatCivil,
    enfants: activeDossier.enfants,
    currentZip: activeDossier.zip,
    currentLocality: activeDossier.locality,
    newZip: "",
    newLocality: "",
    revenuImposableIfd: activeDossier.revenuImposableIfd,
    revenuImposableIcc: activeDossier.revenuImposableIcc,
    troisiemePilier: activeDossier.troisiemePilier,
    rachatLpp: activeDossier.rachatLpp,
    fortuneImposable: activeDossier.fortuneImposable,
  };
}

export default function MobileDomicileFlow({
  onBack,
  onResolveLocation,
  onRun,
  activeDossier,
  onActiveDossierChange,
}: MobileDomicileFlowProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [form, setForm] = useState<MobileDomicilePayload>(() => createInitialState(activeDossier));
  const [result, setResult] = useState<MobileDomicileResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const currentLocalitySuggestions = searchSwissLocations(form.currentLocality, 8);
  const newLocalitySuggestions = searchSwissLocations(form.newLocality, 8);

  useEffect(() => {
    setForm((current) => ({
      ...current,
      prenom: activeDossier.prenom,
      nom: activeDossier.nom,
      etatCivil: activeDossier.etatCivil,
      enfants: activeDossier.enfants,
      currentZip: activeDossier.zip,
      currentLocality: activeDossier.locality,
      revenuImposableIfd: activeDossier.revenuImposableIfd,
      revenuImposableIcc: activeDossier.revenuImposableIcc,
      troisiemePilier: activeDossier.troisiemePilier,
      rachatLpp: activeDossier.rachatLpp,
      fortuneImposable: activeDossier.fortuneImposable,
    }));
  }, [activeDossier]);

  useEffect(() => {
    if (form.currentZip.trim().length < 4) return;
    const match = onResolveLocation(form.currentZip.trim());
    if (!match?.locality || match.locality === form.currentLocality) return;
    setForm((current) => ({ ...current, currentLocality: match.locality }));
    onActiveDossierChange({ zip: form.currentZip.trim(), locality: match.locality });
  }, [form.currentZip, form.currentLocality, onResolveLocation]);

  useEffect(() => {
    if (form.newZip.trim().length < 4) return;
    const match = onResolveLocation(form.newZip.trim());
    if (!match?.locality || match.locality === form.newLocality) return;
    setForm((current) => ({ ...current, newLocality: match.locality }));
  }, [form.newZip, form.newLocality, onResolveLocation]);

  const canRun =
    form.prenom.trim().length > 0 &&
    form.nom.trim().length > 0 &&
    form.etatCivil.trim().length > 0 &&
    form.currentZip.trim().length > 0 &&
    form.currentLocality.trim().length > 0 &&
    form.newZip.trim().length > 0 &&
    form.newLocality.trim().length > 0;

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
        eyebrow="Changement de domicile"
        title="Comparaison fiscale immédiate"
        description="Un parcours pensé pour montrer, en quelques gestes, l’effet d’un nouveau domicile sur la charge fiscale."
      />

      <MobileNavigation items={steps} activeIndex={stepIndex} onSelect={setStepIndex} />

      {stepIndex === 0 ? (
        <>
          <div className="mobile-form-grid">
            <label className="mobile-field">
              <span className="mobile-field__label">Prénom</span>
              <input
                className="mobile-field__input"
                type="text"
                value={form.prenom}
                onChange={(event) => {
                  const value = event.target.value;
                  setForm((current) => ({ ...current, prenom: value }));
                  onActiveDossierChange({ prenom: value });
                }}
              />
            </label>
            <label className="mobile-field">
              <span className="mobile-field__label">Nom</span>
              <input
                className="mobile-field__input"
                type="text"
                value={form.nom}
                onChange={(event) => {
                  const value = event.target.value;
                  setForm((current) => ({ ...current, nom: value }));
                  onActiveDossierChange({ nom: value });
                }}
              />
            </label>
            <label className="mobile-field">
              <span className="mobile-field__label">État civil</span>
              <select
                className="mobile-field__select"
                value={form.etatCivil}
                onChange={(event) => {
                  const value = event.target.value;
                  setForm((current) => ({ ...current, etatCivil: value }));
                  onActiveDossierChange({ etatCivil: value });
                }}
              >
                <option value="">Choisir</option>
                <option value="Célibataire">Célibataire</option>
                <option value="Marié">Marié</option>
                <option value="Divorcé">Divorcé</option>
                <option value="Veuf">Veuf</option>
              </select>
            </label>
            <label className="mobile-field">
              <span className="mobile-field__label">Nombre d’enfants</span>
              <input
                className="mobile-field__input"
                type="number"
                inputMode="numeric"
                value={form.enfants}
                onChange={(event) =>
                  {
                    const value = Number(event.target.value || 0);
                    setForm((current) => ({ ...current, enfants: value }));
                    onActiveDossierChange({ enfants: value });
                  }
                }
              />
            </label>
          </div>
          <MobilePrimaryAction label="Continuer" onClick={() => setStepIndex(1)} />
        </>
      ) : null}

      {stepIndex === 1 ? (
        <>
          <div className="mobile-form-grid">
            <label className="mobile-field">
              <span className="mobile-field__label">NPA actuel</span>
              <input
                className="mobile-field__input"
                type="text"
                inputMode="numeric"
                value={form.currentZip}
                onChange={(event) =>
                  {
                    const value = event.target.value;
                    setForm((current) => ({ ...current, currentZip: value }));
                    onActiveDossierChange({ zip: value });
                  }
                }
              />
            </label>
            <label className="mobile-field">
              <span className="mobile-field__label">Localité actuelle</span>
              <input
                className="mobile-field__input"
                type="text"
                value={form.currentLocality}
                list="mobile-current-locality-suggestions"
                onChange={(event) => {
                  const value = event.target.value;
                  const selectedLocation = resolveSwissLocationSelection(value, {
                    preferredZip: form.currentZip,
                  });

                  if (selectedLocation) {
                    setForm((current) => ({
                      ...current,
                      currentZip: selectedLocation.zip,
                      currentLocality: selectedLocation.locality,
                    }));
                    onActiveDossierChange({
                      zip: selectedLocation.zip,
                      locality: selectedLocation.locality,
                    });
                    return;
                  }

                  setForm((current) => ({ ...current, currentLocality: value }));
                  onActiveDossierChange({ locality: value });
                }}
                onBlur={(event) => {
                  const selectedLocation = resolveSwissLocationSelection(event.target.value, {
                    preferredZip: form.currentZip,
                  });

                  if (!selectedLocation) {
                    return;
                  }

                  setForm((current) => ({
                    ...current,
                    currentZip: selectedLocation.zip,
                    currentLocality: selectedLocation.locality,
                  }));
                  onActiveDossierChange({
                    zip: selectedLocation.zip,
                    locality: selectedLocation.locality,
                  });
                }}
              />
              <datalist id="mobile-current-locality-suggestions">
                {currentLocalitySuggestions.map((suggestion) => (
                  <option key={suggestion.key} value={suggestion.selectionLabel} />
                ))}
              </datalist>
            </label>
          </div>
          <MobilePrimaryAction label="Passer au nouveau domicile" onClick={() => setStepIndex(2)} />
        </>
      ) : null}

      {stepIndex === 2 ? (
        <>
          <div className="mobile-form-grid">
            <label className="mobile-field">
              <span className="mobile-field__label">Nouveau NPA</span>
              <input
                className="mobile-field__input"
                type="text"
                inputMode="numeric"
                value={form.newZip}
                onChange={(event) => setForm((current) => ({ ...current, newZip: event.target.value }))}
              />
            </label>
            <label className="mobile-field">
              <span className="mobile-field__label">Nouvelle localité</span>
              <input
                className="mobile-field__input"
                type="text"
                value={form.newLocality}
                list="mobile-new-locality-suggestions"
                onChange={(event) => {
                  const value = event.target.value;
                  const selectedLocation = resolveSwissLocationSelection(value, {
                    preferredZip: form.newZip,
                  });

                  if (selectedLocation) {
                    setForm((current) => ({
                      ...current,
                      newZip: selectedLocation.zip,
                      newLocality: selectedLocation.locality,
                    }));
                    return;
                  }

                  setForm((current) => ({ ...current, newLocality: value }));
                }}
                onBlur={(event) => {
                  const selectedLocation = resolveSwissLocationSelection(event.target.value, {
                    preferredZip: form.newZip,
                  });

                  if (!selectedLocation) {
                    return;
                  }

                  setForm((current) => ({
                    ...current,
                    newZip: selectedLocation.zip,
                    newLocality: selectedLocation.locality,
                  }));
                }}
              />
              <datalist id="mobile-new-locality-suggestions">
                {newLocalitySuggestions.map((suggestion) => (
                  <option key={suggestion.key} value={suggestion.selectionLabel} />
                ))}
              </datalist>
            </label>
          </div>
          <MobilePrimaryAction label="Passer aux données fiscales" onClick={() => setStepIndex(3)} />
        </>
      ) : null}

      {stepIndex === 3 ? (
        <>
          <div className="mobile-form-grid">
            {[
              ["Revenu imposable IFD", "revenuImposableIfd"],
              ["Revenu imposable ICC", "revenuImposableIcc"],
              ["3e pilier", "troisiemePilier"],
              ["Rachat LPP", "rachatLpp"],
              ["Fortune imposable", "fortuneImposable"],
            ].map(([label, key]) => (
              <label key={key} className="mobile-field">
                <span className="mobile-field__label">{label}</span>
                <input
                  className="mobile-field__input"
                  type="number"
                  inputMode="numeric"
                  value={
                    form[
                      key as keyof Pick<
                        MobileDomicilePayload,
                        "revenuImposableIfd" | "revenuImposableIcc" | "troisiemePilier" | "rachatLpp" | "fortuneImposable"
                      >
                    ]
                  }
                  onChange={(event) =>
                    {
                      const value = Number(event.target.value || 0);
                      setForm((current) => ({
                        ...current,
                        [key]: value,
                      }));
                      if (key === "revenuImposableIfd") {
                        onActiveDossierChange({ revenuImposableIfd: value });
                      }
                      if (key === "revenuImposableIcc") {
                        onActiveDossierChange({ revenuImposableIcc: value });
                      }
                      if (key === "troisiemePilier") {
                        onActiveDossierChange({ troisiemePilier: value });
                      }
                      if (key === "rachatLpp") {
                        onActiveDossierChange({ rachatLpp: value });
                      }
                      if (key === "fortuneImposable") {
                        onActiveDossierChange({ fortuneImposable: value });
                      }
                    }
                  }
                />
              </label>
            ))}
          </div>
          <MobilePrimaryAction
            label={isRunning ? "Comparaison en cours..." : "Afficher la comparaison"}
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
            <button type="button" className="mobile-secondary-action" onClick={() => setStepIndex(5)}>
              Voir le détail
            </button>
          </div>
        </>
      ) : null}

      {stepIndex === 5 && result ? (
        <div className="mobile-accordion-stack">
          {result.detailSections.map((section) => (
            <MobileAccordionSection key={section.title} title={section.title} rows={section.rows} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
