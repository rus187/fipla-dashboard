import type { DossierClient } from "../types";
import type { AnalysisMode } from "./DecisionIntro";

type SituationEntryScreenProps = {
  analysisMode: AnalysisMode | null;
  canLaunchSimulation: boolean;
  dossier: DossierClient;
  isSimulating: boolean;
  launchHelper: string;
  onDossierChange: (nextDossier: DossierClient) => void;
  onLaunchSimulation: () => void;
  onNpaChange: (value: string) => void;
  formatCurrency: (value: number) => string;
};

const modeLabels: Record<AnalysisMode, string> = {
  current: "Situation actuelle",
  projected: "Situation projetee",
  compare: "Comparer des scenarios",
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
  isSimulating,
  launchHelper,
  onDossierChange,
  onLaunchSimulation,
  onNpaChange,
  formatCurrency,
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
  const effectiveIncome = dossier.revenus.totalRevenus || detailedIncomeTotal;

  const visibleChargesTotal =
    (dossier.charges.fraisEms || 0) +
    (dossier.charges.logement || 0) +
    (dossier.charges.primesMaladie || 0) +
    (dossier.charges.impotsRevenuFortune || 0) +
    (dossier.charges.autresCharges || 0);

  const effectiveFortune =
    dossier.fortune.fortuneTotale ||
    (dossier.fortune.liquidites || 0) +
      (dossier.fortune.titres || 0) +
      (dossier.fortune.immobilier || 0) +
      (dossier.fortune.autresActifs || 0);

  const effectiveDettes =
    dossier.dettes.totalDettes || (dossier.dettes.hypotheques || 0) + (dossier.dettes.autresDettes || 0);

  const estimatedMargin = effectiveIncome - visibleChargesTotal;

  const financialStatus =
    estimatedMargin >= 25000
      ? {
          label: "Confortable",
          tone: "comfortable" as const,
          text: "La marge degagee laisse une capacite de decision confortable.",
        }
      : estimatedMargin >= 0
        ? {
            label: "A surveiller",
            tone: "watch" as const,
            text: "La situation reste tenable, mais demande une attention rapprochee.",
          }
        : {
            label: "Critique",
            tone: "critical" as const,
            text: "La marge negative appelle une revue rapide des charges et du financement.",
          };

  const vigilanceItems = [
    visibleChargesTotal > 0 && effectiveIncome > 0 && visibleChargesTotal >= effectiveIncome * 0.65
      ? "Charges elevees"
      : null,
    estimatedMargin < 0 ? "Marge negative" : null,
    effectiveFortune > 0 && estimatedMargin < 15000 ? "Dependance a la fortune" : null,
  ].filter((item): item is string => Boolean(item));

  const isMinimumDataReady =
    dossier.identite.prenom.trim().length > 0 &&
    dossier.identite.age > 0 &&
    dossier.identite.npa.trim().length > 0 &&
    (effectiveIncome > 0 || effectiveFortune > 0);

  const isLaunchDisabled = !isMinimumDataReady || !canLaunchSimulation || isSimulating;

  return (
    <div className="situation-screen">
      <div className="situation-mode-bar">Mode selectionne : {selectedModeLabel}</div>

      <div className="situation-layout">
        <div className="situation-form-column">
          <section className="situation-card">
            <div className="situation-card__header">
              <h3 className="situation-card__title">Identite du client</h3>
            </div>

            <div className="situation-fields situation-fields--four">
              <label className="situation-field">
                <span>Prenom</span>
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
                <span>Age</span>
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

              <label className="situation-field">
                <span>Lieu de vie</span>
                <select
                  value={dossier.identite.lieuVie}
                  onChange={(event) =>
                    onDossierChange({
                      ...dossier,
                      identite: {
                        ...dossier.identite,
                        lieuVie: event.target.value as DossierClient["identite"]["lieuVie"],
                      },
                    })
                  }
                >
                  <option value="domicile">Domicile</option>
                  <option value="ems">EMS</option>
                </select>
              </label>

              <label className="situation-field">
                <span>Situation du conjoint</span>
                <select
                  value={dossier.famille.situationConjoint}
                  onChange={(event) =>
                    onDossierChange({
                      ...dossier,
                      famille: {
                        ...dossier.famille,
                        situationConjoint: event.target.value as DossierClient["famille"]["situationConjoint"],
                      },
                    })
                  }
                >
                  <option value="domicile">Domicile</option>
                  <option value="ems">EMS</option>
                </select>
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
                <span>Etat civil</span>
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
                <span>Nombre d'enfants</span>
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
          </section>

          <section className="situation-card">
            <div className="situation-card__header">
              <h3 className="situation-card__title">Situation globale</h3>
            </div>

            <div className="situation-fields situation-fields--three">
              <label className="situation-field">
                <span>Revenu total annuel</span>
                <input
                  type="number"
                  value={dossier.revenus.totalRevenus}
                  onChange={(event) =>
                    onDossierChange({
                      ...dossier,
                      revenus: {
                        ...dossier.revenus,
                        totalRevenus: Number(event.target.value || 0),
                      },
                    })
                  }
                />
              </label>

              <label className="situation-field">
                <span>Fortune totale</span>
                <input
                  type="number"
                  value={dossier.fortune.fortuneTotale}
                  onChange={(event) =>
                    onDossierChange({
                      ...dossier,
                      fortune: {
                        ...dossier.fortune,
                        fortuneTotale: Number(event.target.value || 0),
                      },
                    })
                  }
                />
              </label>

              <label className="situation-field">
                <span>Dettes</span>
                <input
                  type="number"
                  value={dossier.dettes.totalDettes}
                  onChange={(event) =>
                    onDossierChange({
                      ...dossier,
                      dettes: {
                        ...dossier.dettes,
                        totalDettes: Number(event.target.value || 0),
                      },
                    })
                  }
                />
              </label>
            </div>
          </section>

          <section className="situation-card">
            <div className="situation-card__header">
              <h3 className="situation-card__title">Revenus detailles</h3>
            </div>

            <div className="situation-fields situation-fields--four">
              <label className="situation-field">
                <span>AVS</span>
                <input
                  type="number"
                  value={dossier.revenus.avs}
                  onChange={(event) =>
                    onDossierChange({
                      ...dossier,
                      revenus: {
                        ...dossier.revenus,
                        avs: Number(event.target.value || 0),
                      },
                    })
                  }
                />
              </label>

              <label className="situation-field">
                <span>LPP</span>
                <input
                  type="number"
                  value={dossier.revenus.lpp}
                  onChange={(event) =>
                    onDossierChange({
                      ...dossier,
                      revenus: {
                        ...dossier.revenus,
                        lpp: Number(event.target.value || 0),
                      },
                    })
                  }
                />
              </label>

              <label className="situation-field">
                <span>Revenus locatifs</span>
                <input
                  type="number"
                  value={dossier.immobilier.loyersBiensRendement}
                  onChange={(event) =>
                    onDossierChange({
                      ...dossier,
                      immobilier: {
                        ...dossier.immobilier,
                        loyersBiensRendement: Number(event.target.value || 0),
                      },
                    })
                  }
                />
              </label>

              <label className="situation-field">
                <span>Autres revenus</span>
                <input
                  type="number"
                  value={dossier.revenus.autresRevenus}
                  onChange={(event) =>
                    onDossierChange({
                      ...dossier,
                      revenus: {
                        ...dossier.revenus,
                        autresRevenus: Number(event.target.value || 0),
                      },
                    })
                  }
                />
              </label>
            </div>
          </section>

          <section className="situation-card">
            <div className="situation-card__header">
              <h3 className="situation-card__title">Charges</h3>
            </div>

            <div className="situation-fields situation-fields--four">
              <label className="situation-field">
                <span>Frais EMS</span>
                <input
                  type="number"
                  value={dossier.charges.fraisEms}
                  onChange={(event) =>
                    onDossierChange({
                      ...dossier,
                      charges: {
                        ...dossier.charges,
                        fraisEms: Number(event.target.value || 0),
                      },
                    })
                  }
                />
              </label>

              <label className="situation-field">
                <span>Loyer / logement</span>
                <input
                  type="number"
                  value={dossier.charges.logement}
                  onChange={(event) =>
                    onDossierChange({
                      ...dossier,
                      charges: {
                        ...dossier.charges,
                        logement: Number(event.target.value || 0),
                      },
                    })
                  }
                />
              </label>

              <label className="situation-field">
                <span>Prime maladie</span>
                <input
                  type="number"
                  value={dossier.charges.primesMaladie}
                  onChange={(event) =>
                    onDossierChange({
                      ...dossier,
                      charges: {
                        ...dossier.charges,
                        primesMaladie: Number(event.target.value || 0),
                      },
                    })
                  }
                />
              </label>

              <label className="situation-field">
                <span>Impots (revenu + fortune)</span>
                <input
                  type="number"
                  value={dossier.charges.impotsRevenuFortune}
                  onChange={(event) =>
                    onDossierChange({
                      ...dossier,
                      charges: {
                        ...dossier.charges,
                        impotsRevenuFortune: Number(event.target.value || 0),
                      },
                    })
                  }
                />
              </label>
            </div>

            <div className="situation-fields situation-fields--one">
              <label className="situation-field">
                <span>Autres charges</span>
                <input
                  type="number"
                  value={dossier.charges.autresCharges}
                  onChange={(event) =>
                    onDossierChange({
                      ...dossier,
                      charges: {
                        ...dossier.charges,
                        autresCharges: Number(event.target.value || 0),
                      },
                    })
                  }
                />
              </label>
            </div>
          </section>

          <section className="situation-card">
            <div className="situation-card__header">
              <h3 className="situation-card__title">Structure de la fortune</h3>
            </div>

            <div className="situation-fields situation-fields--four">
              <label className="situation-field">
                <span>Liquidites</span>
                <input
                  type="number"
                  value={dossier.fortune.liquidites}
                  onChange={(event) =>
                    onDossierChange({
                      ...dossier,
                      fortune: {
                        ...dossier.fortune,
                        liquidites: Number(event.target.value || 0),
                      },
                    })
                  }
                />
              </label>

              <label className="situation-field">
                <span>Titres</span>
                <input
                  type="number"
                  value={dossier.fortune.titres}
                  onChange={(event) =>
                    onDossierChange({
                      ...dossier,
                      fortune: {
                        ...dossier.fortune,
                        titres: Number(event.target.value || 0),
                      },
                    })
                  }
                />
              </label>

              <label className="situation-field">
                <span>Bien immobilier</span>
                <input
                  type="number"
                  value={dossier.fortune.immobilier}
                  onChange={(event) =>
                    onDossierChange({
                      ...dossier,
                      fortune: {
                        ...dossier.fortune,
                        immobilier: Number(event.target.value || 0),
                      },
                    })
                  }
                />
              </label>

              <label className="situation-field">
                <span>Autres actifs</span>
                <input
                  type="number"
                  value={dossier.fortune.autresActifs}
                  onChange={(event) =>
                    onDossierChange({
                      ...dossier,
                      fortune: {
                        ...dossier.fortune,
                        autresActifs: Number(event.target.value || 0),
                      },
                    })
                  }
                />
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
                : "Renseignez au minimum le prenom, l'age, le NPA et une base de revenus ou de fortune."}
            </div>
          </div>
        </div>

        <aside className="situation-sidebar">
          <div className="situation-sidebar__stack">
            <section className="situation-sidebar-card">
              <h3 className="situation-sidebar-card__title">Resume rapide</h3>
              <SummaryRow label="Revenu total" value={formatCurrency(effectiveIncome)} />
              <SummaryRow label="Charges totales" value={formatCurrency(visibleChargesTotal)} />
              <SummaryRow label="Marge estimee" value={formatCurrency(estimatedMargin)} />
            </section>

            <section className="situation-sidebar-card">
              <h3 className="situation-sidebar-card__title">Capacite financiere</h3>
              <div className={`situation-status situation-status--${financialStatus.tone}`}>
                {financialStatus.label}
              </div>
              <p className="situation-sidebar-card__text">{financialStatus.text}</p>
            </section>

            <section className="situation-sidebar-card">
              <h3 className="situation-sidebar-card__title">Points de vigilance</h3>
              <div className="situation-vigilance-list">
                {vigilanceItems.length > 0 ? (
                  vigilanceItems.map((item) => <div key={item}>{item}</div>)
                ) : (
                  <div>Situation globalement equilibree</div>
                )}
              </div>
              <div className="situation-sidebar-card__footnote">
                Fortune de reference : {formatCurrency(effectiveFortune)}
              </div>
              <div className="situation-sidebar-card__footnote">
                Dettes de reference : {formatCurrency(effectiveDettes)}
              </div>
            </section>
          </div>
        </aside>
      </div>
    </div>
  );
}
