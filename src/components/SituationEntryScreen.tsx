import { useEffect, useState, type RefObject } from "react";
import type { DossierClient } from "../types";
import type { AnalysisMode } from "./DecisionIntro";
import {
  resolveSwissLocationSelection,
  searchSwissLocations,
} from "../lib/geography/locationLookup";
import { isBernAssetIncomeEnabled } from "../lib/taxware/bernAssetIncome";
import StableNumberInput from "./StableNumberInput";

type SituationEntryScreenProps = {
  analysisMode: AnalysisMode | null;
  canLaunchSimulation: boolean;
  dossier: DossierClient;
  isSimulating: boolean;
  launchHelper: string;
  onDossierChange: (nextDossier: DossierClient) => void;
  onLaunchSimulation: () => void;
  onNpaChange: (value: string) => void;
  onFiscalInputsCompleted?: () => void;
  identitySectionRef?: RefObject<HTMLElement | null>;
  disableTaxableBaseInputs?: boolean;
};

const modeLabels: Record<AnalysisMode, string> = {
  current: "Situation actuelle",
  projected: "Situation projetée",
  compare: "Comparer des scénarios",
};

export default function SituationEntryScreen({
  analysisMode,
  canLaunchSimulation,
  dossier,
  isSimulating,
  launchHelper,
  onDossierChange,
  onLaunchSimulation,
  onNpaChange,
  onFiscalInputsCompleted,
  identitySectionRef,
  disableTaxableBaseInputs = false,
}: SituationEntryScreenProps) {
  // NPA INPUT LOCKED FIX (PC) - DO NOT MODIFY WITHOUT EXPLICIT INSTRUCTION
  // This local draft prevents the controlled input from re-injecting an older zip
  // while the user is typing or deleting digits. Keep this behavior isolated to NPA.
  const [npaDraft, setNpaDraft] = useState(dossier.identite.npa);
  const [isEditingNpa, setIsEditingNpa] = useState(false);

  useEffect(() => {
    if (!isEditingNpa) {
      setNpaDraft(dossier.identite.npa);
    }
  }, [dossier.identite.npa, isEditingNpa]);

  const localitySuggestions = searchSwissLocations(dossier.identite.commune, 8);

  const selectedMode =
    analysisMode ?? (dossier.immobilier.regimeFiscal === "reforme" ? "projected" : "current");
  const selectedModeLabel = modeLabels[selectedMode];

  const effectiveIncome =
    (dossier.revenus.totalRevenus || 0) + (dossier.immobilier.loyersBiensRendement || 0);
  const effectiveFortune =
    dossier.fortune.fortuneTotale ||
    (dossier.fortune.liquidites || 0) +
      (dossier.fortune.titres || 0) +
      (dossier.fortune.immobilier || 0) +
      (dossier.fortune.autresActifs || 0);
  const isMinimumDataReady =
    dossier.identite.prenom.trim().length > 0 &&
    dossier.identite.age > 0 &&
    dossier.identite.npa.trim().length > 0 &&
    (effectiveIncome > 0 || effectiveFortune > 0);

  const isLaunchDisabled = !isMinimumDataReady || !canLaunchSimulation || isSimulating;
  // BE LOCKED LOGIC - REVENU DE LA FORTUNE / AssetIncome
  // The explicit field is intentionally visible for Bern only.
  const isBernCanton = isBernAssetIncomeEnabled(dossier.identite);

  const updateFiscalField = (
    field:
      | "revenuImposableIfd"
      | "revenuImposable"
      | "fortuneImposableActuelleSaisie"
      | "revenuFortuneBE",
    value: string
  ) => {
    onDossierChange({
      ...dossier,
      fiscalite: {
        ...dossier.fiscalite,
        [field]: Math.max(0, Number(value || 0)),
      },
    });
  };

  const updateIdentityNumberField = (field: "age", value: number) => {
    onDossierChange({
      ...dossier,
      identite: {
        ...dossier.identite,
        [field]: Math.max(0, value),
      },
    });
  };

  const updateFamilyNumberField = (field: "nombreEnfants", value: number) => {
    onDossierChange({
      ...dossier,
      famille: {
        ...dossier.famille,
        [field]: Math.max(0, value),
      },
    });
  };

  const handleFiscalInputsCompleted = (value: string) => {
    if (value.trim().length === 0) {
      return;
    }

    onFiscalInputsCompleted?.();
  };

  return (
    <div className="situation-screen">
      <div className="situation-mode-bar">Mode sélectionné : {selectedModeLabel}</div>

      <div className="situation-layout">
        <div className="situation-form-column">
          <section ref={identitySectionRef} className="situation-card">
            <div className="situation-card__header">
              <h3 className="situation-card__title">Identité du client</h3>
              
            </div>

            <div className="situation-fields situation-fields--three">
              <label className="situation-field">
                <span>Prénom</span>
                <input
                  type="text"
                  value={dossier.identite.prenom}
                  onChange={(event) =>
                    onDossierChange({
                      ...dossier,
                      identite: {
                        ...dossier.identite,
                        prenom: event.target.value,
                      },
                    })
                  }
                />
              </label>

              <label className="situation-field">
                <span>Nom</span>
                <input
                  type="text"
                  value={dossier.identite.nom}
                  onChange={(event) =>
                    onDossierChange({
                      ...dossier,
                      identite: {
                        ...dossier.identite,
                        nom: event.target.value,
                      },
                    })
                  }
                />
              </label>

              <label className="situation-field">
                <span>Âge</span>
                <StableNumberInput
                  value={dossier.identite.age}
                  onValueChange={(value) => updateIdentityNumberField("age", value)}
                  normalizeValue={(value) => Math.max(0, value)}
                />
              </label>
            </div>

            <div className="situation-fields situation-fields--three">
              <label className="situation-field">
                <span>NPA</span>
                {/* NPA INPUT LOCKED FIX (PC) - DO NOT MODIFY WITHOUT EXPLICIT INSTRUCTION */}
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={isEditingNpa ? npaDraft : dossier.identite.npa}
                  onFocus={() => {
                    setIsEditingNpa(true);
                    setNpaDraft(dossier.identite.npa);
                  }}
                  onChange={(event) => {
                    const nextValue = event.target.value.replace(/\D+/g, "").slice(0, 4);
                    setNpaDraft(nextValue);
                  }}
                  onBlur={() => {
                    if (dossier.identite.npa !== npaDraft) {
                      onNpaChange(npaDraft);
                    }
                    setIsEditingNpa(false);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.currentTarget.blur();
                    }
                  }}
                />
              </label>

              <label className="situation-field">
                <span>Commune</span>
                <input
                  type="text"
                  value={dossier.identite.commune}
                  list="desktop-locality-suggestions"
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    const selectedLocation = resolveSwissLocationSelection(nextValue, {
                      preferredZip: dossier.identite.npa,
                    });

                    if (selectedLocation) {
                      onDossierChange({
                        ...dossier,
                        identite: {
                          ...dossier.identite,
                          npa: selectedLocation.zip,
                          commune: selectedLocation.locality,
                          communeFiscale: selectedLocation.fiscalCommune,
                          canton: selectedLocation.canton,
                          cantonFiscal: selectedLocation.canton,
                          taxwareZip: selectedLocation.zip,
                          taxwareCity: selectedLocation.fiscalCommune,
                        },
                      });
                      return;
                    }

                    onDossierChange({
                      ...dossier,
                      identite: {
                        ...dossier.identite,
                        commune: nextValue,
                        communeFiscale: nextValue,
                        taxwareCity: nextValue,
                      },
                    });
                  }}
                  onBlur={(event) => {
                    const selectedLocation = resolveSwissLocationSelection(event.target.value, {
                      preferredZip: dossier.identite.npa,
                    });

                    if (!selectedLocation) {
                      return;
                    }

                    onDossierChange({
                      ...dossier,
                      identite: {
                        ...dossier.identite,
                        npa: selectedLocation.zip,
                        commune: selectedLocation.locality,
                        communeFiscale: selectedLocation.fiscalCommune,
                        canton: selectedLocation.canton,
                        cantonFiscal: selectedLocation.canton,
                        taxwareZip: selectedLocation.zip,
                        taxwareCity: selectedLocation.fiscalCommune,
                      },
                    });
                  }}
                />
                <datalist id="desktop-locality-suggestions">
                  {localitySuggestions.map((suggestion) => (
                    <option key={suggestion.key} value={suggestion.selectionLabel} />
                  ))}
                </datalist>
              </label>

              <label className="situation-field">
                <span>Canton</span>
                <input type="text" value={dossier.identite.canton} readOnly />
              </label>
            </div>

            <div className="situation-fields situation-fields--two">
              <label className="situation-field">
                <span>État civil</span>
                <select
                  value={dossier.identite.etatCivil}
                  onChange={(event) =>
                    onDossierChange({
                      ...dossier,
                      identite: {
                        ...dossier.identite,
                        etatCivil: event.target.value,
                      },
                      famille: {
                        ...dossier.famille,
                        aConjoint: event.target.value === "Marié",
                      },
                    })
                  }
                >
                  <option value="">Choisir</option>
                  <option value="Célibataire">Célibataire</option>
                  <option value="Marié">Marié</option>
                  <option value="Divorcé">Divorcé</option>
                  <option value="Veuf">Veuf</option>
                </select>
              </label>

              <label className="situation-field">
                <span>Nombre d’enfants</span>
                <StableNumberInput
                  value={dossier.famille.nombreEnfants}
                  onValueChange={(value) => updateFamilyNumberField("nombreEnfants", value)}
                  normalizeValue={(value) => Math.max(0, value)}
                />
              </label>
            </div>

            {disableTaxableBaseInputs ? (
              <div className="situation-fiscal-entry">
                <div className="situation-card__header">
                  <h3 className="situation-card__title">Bases imposables à reporter</h3>
                </div>
                <p className="situation-fiscal-entry__helper" style={{ color: "#92400e" }}>
                  Dans le calculateur <strong>Changement de domicile</strong>, les champs
                  <strong> Revenu imposable IFD</strong>,
                  <strong> Revenu imposable Canton / Commune</strong> et
                  <strong> Fortune imposable</strong> sont masqués et non utilisés.
                </p>
                <p className="situation-fiscal-entry__helper">
                  Le calcul repart uniquement des données économiques source du dossier.
                </p>
                {isBernCanton ? (
                  <>
                    <div
                      className="situation-fields situation-fields--one"
                      style={{ marginTop: "12px" }}
                    >
                      <label className="situation-field">
                        <span>Revenu de la fortune</span>
                        <StableNumberInput
                          value={dossier.fiscalite.revenuFortuneBE || 0}
                          onValueChange={(value) =>
                            updateFiscalField("revenuFortuneBE", String(value))
                          }
                          normalizeValue={(value) => Math.max(0, value)}
                        />
                      </label>
                    </div>
                    <p className="situation-fiscal-entry__helper">
                      Pour Berne, ce champ reste actif dans le flux domicile car il alimente
                      directement la valeur AssetIncome du clic réel.
                    </p>
                  </>
                ) : null}
              </div>
            ) : (
              <div className="situation-fiscal-entry">
                <div className="situation-card__header">
                  <h3 className="situation-card__title">Bases imposables à reporter</h3>
                </div>

                <div
                  className={`situation-fields ${
                    isBernCanton ? "situation-fields--four" : "situation-fields--three"
                  }`}
                >
                  <label className="situation-field">
                    <span>Revenu imposable IFD</span>
                    <StableNumberInput
                      value={dossier.fiscalite.revenuImposableIfd || 0}
                      onValueChange={(value) =>
                        updateFiscalField("revenuImposableIfd", String(value))
                      }
                      normalizeValue={(value) => Math.max(0, value)}
                    />
                  </label>

                  <label className="situation-field">
                    <span>Revenu imposable Canton / Commune</span>
                    <StableNumberInput
                      value={dossier.fiscalite.revenuImposable || 0}
                      onValueChange={(value) =>
                        updateFiscalField("revenuImposable", String(value))
                      }
                      normalizeValue={(value) => Math.max(0, value)}
                    />
                  </label>

                  <label className="situation-field">
                    <span>Fortune imposable</span>
                    <StableNumberInput
                      value={dossier.fiscalite.fortuneImposableActuelleSaisie || 0}
                      onValueChange={(value) =>
                        updateFiscalField("fortuneImposableActuelleSaisie", String(value))
                      }
                      normalizeValue={(value) => Math.max(0, value)}
                      onBlur={(event) => {
                        handleFiscalInputsCompleted(event.target.value);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          handleFiscalInputsCompleted(
                            (event.target as HTMLInputElement).value
                          );
                        }
                      }}
                    />
                  </label>

                  {isBernCanton ? (
                    <label className="situation-field">
                      <span>Revenu de la fortune</span>
                      <StableNumberInput
                        value={dossier.fiscalite.revenuFortuneBE || 0}
                        onValueChange={(value) =>
                          updateFiscalField("revenuFortuneBE", String(value))
                        }
                        normalizeValue={(value) => Math.max(0, value)}
                      />
                    </label>
                  ) : null}
                </div>

                <p className="situation-fiscal-entry__helper">
                  Veuillez reporter les données taxables inscrites de votre déclaration fiscale.
                </p>
              </div>
            )}
          </section>

          <section className="situation-card">
            <div className="situation-card__header">
              <h3 className="situation-card__title">Organisation de la saisie</h3>
            </div>

            <p className="situation-fiscal-entry__helper" style={{ marginTop: 0 }}>
              Cet écran sert uniquement à renseigner l’identité du client, le contexte familial,
              la localisation et les bases déclaratives à reporter.
            </p>
            <p className="situation-fiscal-entry__helper" style={{ marginBottom: 0 }}>
              La saisie détaillée des revenus du foyer et de l’immobilier se fait exclusivement
              dans l’<strong>Étape 2 - Revenus du foyer</strong>.
            </p>
          </section>

          <div className="situation-cta">
            <button
              type="button"
              onClick={onLaunchSimulation}
              className="situation-cta__button"
              disabled={isLaunchDisabled}
            >
              {isSimulating ? "Simulation en cours..." : "Lancer la simulation"}
            </button>
            <div className="situation-cta__helper">
              {isMinimumDataReady
                ? launchHelper
                : "Renseignez au minimum le prénom, l'âge, le NPA et une base de revenus ou de fortune."}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
