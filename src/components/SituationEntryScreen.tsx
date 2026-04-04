import type { RefObject } from "react";
import type { DossierClient } from "../types";
import type { AnalysisMode } from "./DecisionIntro";

type SituationEntryScreenProps = {
  analysisMode: AnalysisMode | null;
  canLaunchSimulation: boolean;
  dossier: DossierClient;
  totalCharges: number;
  isSimulating: boolean;
  launchHelper: string;
  onDossierChange: (nextDossier: DossierClient) => void;
  onLaunchSimulation: () => void;
  onNpaChange: (value: string) => void;
  formatCurrency: (value: number) => string;
  onFiscalInputsCompleted?: () => void;
  identitySectionRef?: RefObject<HTMLElement | null>;
};

const modeLabels: Record<AnalysisMode, string> = {
  current: "Situation actuelle",
  projected: "Situation projetée",
  compare: "Comparer des scénarios",
};

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="situation-summary-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default function SituationEntryScreen({
  analysisMode,
  canLaunchSimulation,
  dossier,
  totalCharges,
  isSimulating,
  launchHelper,
  onDossierChange,
  onLaunchSimulation,
  onNpaChange,
  formatCurrency,
  onFiscalInputsCompleted,
  identitySectionRef,
}: SituationEntryScreenProps) {
  const selectedMode =
    analysisMode ?? (dossier.immobilier.regimeFiscal === "reforme" ? "projected" : "current");
  const selectedModeLabel = modeLabels[selectedMode];

  const detailedIncomeTotal =
    (dossier.revenus.salaire || 0) +
    (dossier.revenus.avs || 0) +
    (dossier.revenus.lpp || 0) +
    (dossier.immobilier.loyersBiensRendement || 0) +
    (dossier.revenus.autresRevenus || 0);
  const summaryIncome = detailedIncomeTotal;
  const effectiveIncome = dossier.revenus.totalRevenus || detailedIncomeTotal;

  const effectiveFortune =
    dossier.fortune.fortuneTotale ||
    (dossier.fortune.liquidites || 0) +
      (dossier.fortune.titres || 0) +
      (dossier.fortune.immobilier || 0) +
      (dossier.fortune.autresActifs || 0);
  const summaryFortune =
    (dossier.fortune.liquidites || 0) +
    (dossier.fortune.titres || 0) +
    (dossier.fortune.immobilier || 0) +
    (dossier.fortune.autresActifs || 0);

  const effectiveDettes =
    dossier.dettes.totalDettes || (dossier.dettes.hypotheques || 0) + (dossier.dettes.autresDettes || 0);
  const summaryDettes = effectiveDettes;
  const summaryCharges = totalCharges;
  const startingLiquidity = dossier.fortune.liquidites || 0;
  const annualIncome = summaryIncome;
  const endingLiquidity = startingLiquidity + annualIncome - summaryCharges;

  const isMinimumDataReady =
    dossier.identite.prenom.trim().length > 0 &&
    dossier.identite.age > 0 &&
    dossier.identite.npa.trim().length > 0 &&
    (effectiveIncome > 0 || effectiveFortune > 0);

  const isLaunchDisabled = !isMinimumDataReady || !canLaunchSimulation || isSimulating;

  const updateFiscalField = (
    field: "revenuImposableIfd" | "revenuImposable" | "fortuneImposableActuelleSaisie",
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
                <input
                  type="number"
                  value={dossier.identite.age}
                  onChange={(event) =>
                    onDossierChange({
                      ...dossier,
                      identite: {
                        ...dossier.identite,
                        age: Number(event.target.value || 0),
                      },
                    })
                  }
                />
              </label>
            </div>

            <div className="situation-fields situation-fields--three">
              <label className="situation-field">
                <span>NPA</span>
                <input
                  type="text"
                  value={dossier.identite.npa}
                  onChange={(event) => onNpaChange(event.target.value)}
                />
              </label>

              <label className="situation-field">
                <span>Commune</span>
                <input
                  type="text"
                  value={dossier.identite.commune}
                  onChange={(event) =>
                    onDossierChange({
                      ...dossier,
                      identite: {
                        ...dossier.identite,
                        commune: event.target.value,
                        communeFiscale: event.target.value,
                        taxwareCity: event.target.value,
                      },
                    })
                  }
                />
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
                <input
                  type="number"
                  value={dossier.famille.nombreEnfants}
                  onChange={(event) =>
                    onDossierChange({
                      ...dossier,
                      famille: {
                        ...dossier.famille,
                        nombreEnfants: Number(event.target.value || 0),
                      },
                    })
                  }
                />
              </label>
            </div>

            <div className="situation-fiscal-entry">
              <div className="situation-card__header">
                <h3 className="situation-card__title">Bases imposables à reporter</h3>
              </div>

              <div className="situation-fields situation-fields--three">
                <label className="situation-field">
                  <span>Revenu imposable IFD</span>
                  <input
                    type="number"
                    value={dossier.fiscalite.revenuImposableIfd || 0}
                    onChange={(event) =>
                      updateFiscalField("revenuImposableIfd", event.target.value)
                    }
                  />
                </label>

                <label className="situation-field">
                  <span>Revenu imposable Canton / Commune</span>
                  <input
                    type="number"
                    value={dossier.fiscalite.revenuImposable || 0}
                    onChange={(event) => updateFiscalField("revenuImposable", event.target.value)}
                  />
                </label>

                <label className="situation-field">
                  <span>Fortune imposable</span>
                  <input
                    type="number"
                    value={dossier.fiscalite.fortuneImposableActuelleSaisie || 0}
                    onChange={(event) =>
                      updateFiscalField("fortuneImposableActuelleSaisie", event.target.value)
                    }
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
              </div>

              <p className="situation-fiscal-entry__helper">
                Veuillez reporter les données taxables inscrites de votre déclaration fiscale.
              </p>
            </div>
          </section>

          <section className="situation-card">
            <div className="situation-card__header">
              <h3 className="situation-card__title">Situation globale</h3>
            </div>

            <div className="situation-fields situation-fields--four">
              <label className="situation-field">
                <span>Revenu total annuel</span>
                <input type="text" value={formatCurrency(summaryIncome)} readOnly />
              </label>

              <label className="situation-field">
                <span>Charges totales</span>
                <input type="text" value={formatCurrency(summaryCharges)} readOnly />
              </label>

              <label className="situation-field">
                <span>Fortune totale</span>
                <input type="text" value={formatCurrency(summaryFortune)} readOnly />
              </label>

              <label className="situation-field">
                <span>Dettes</span>
                <input type="text" value={formatCurrency(summaryDettes)} readOnly />
              </label>
            </div>
          </section>

          <section className="situation-card">
            <div className="situation-card__header">
              <h3 className="situation-card__title">Structure de la fortune</h3>
            </div>

            <div className="situation-fields situation-fields--four">
              <label className="situation-field">
                <span>Liquidités</span>
                <input type="text" value={formatCurrency(dossier.fortune.liquidites || 0)} readOnly />
              </label>

              <label className="situation-field">
                <span>Fortune mobilière (comptes, épargne, portefeuille, titres, etc.)</span>
                <input type="text" value={formatCurrency(dossier.fortune.titres || 0)} readOnly />
              </label>

              <label className="situation-field">
                <span>Biens immobiliers (valeur fiscale)</span>
                <input type="text" value={formatCurrency(dossier.fortune.immobilier || 0)} readOnly />
              </label>

              <label className="situation-field">
                <span>Autres actifs</span>
                <input type="text" value={formatCurrency(dossier.fortune.autresActifs || 0)} readOnly />
              </label>

              <label className="situation-field">
                <span>Dettes</span>
                <input type="text" value={formatCurrency(summaryDettes)} readOnly />
              </label>
            </div>
          </section>

          <section className="situation-card">
            <div className="situation-card__header">
              <h3 className="situation-card__title">Évolution des liquidités</h3>
            </div>

            <div className="situation-fields situation-fields--four">
              <label className="situation-field">
                <span>Liquidités début d'exercice</span>
                <input type="text" value={formatCurrency(startingLiquidity)} readOnly />
              </label>

              <label className="situation-field">
                <span>Revenus annuels</span>
                <input type="text" value={formatCurrency(annualIncome)} readOnly />
              </label>

              <label className="situation-field">
                <span>Charges annuelles</span>
                <input type="text" value={formatCurrency(summaryCharges)} readOnly />
              </label>

              <label className="situation-field">
                <span>Liquidités fin d'exercice</span>
                <input type="text" value={formatCurrency(endingLiquidity)} readOnly />
              </label>
            </div>
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

        <aside className="situation-sidebar">
          <div className="situation-sidebar__stack">
            <section className="situation-sidebar-card">
              <h3 className="situation-sidebar-card__title">Résumé rapide</h3>
              <SummaryRow label="Revenu total" value={formatCurrency(effectiveIncome)} />
              <SummaryRow label="Charges totales" value={formatCurrency(summaryCharges)} />
              <SummaryRow label="Fortune totale" value={formatCurrency(summaryFortune)} />
              <SummaryRow label="Dettes" value={formatCurrency(summaryDettes)} />
            </section>
          </div>
        </aside>
      </div>
    </div>
  );
}
