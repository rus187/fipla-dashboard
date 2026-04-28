import { useState } from "react";
import type { MobileActiveClientDossier } from "./activeClientDossier";
import MobileNavigation from "./MobileNavigation";
import MobilePrimaryAction from "./MobilePrimaryAction";
import MobileSectionHeader from "./MobileSectionHeader";
import {
  resolveSwissLocationSelection,
  searchSwissLocations,
} from "../../lib/geography/locationLookup";
import type { MobileDomicileResult } from "./MobileDomicileFlow";

export type PremiumDomicilePayload = {
  prenom: string;
  nom: string;
  etatCivil: string;
  enfants: number;
  currentZip: string;
  currentLocality: string;
  newZip: string;
  newLocality: string;
  salaireNetContribuable: number;
  salaireNetConjoint: number;
  troisiemePilier: number;
  rachatLpp: number;
  estProprietaire: boolean;
  valeurFiscaleImmeuble: number;
  valeurLocative: number;
  fraisEntretienImmeuble: number;
  interetsHypothecaires: number;
  fortuneMobiliere: number;
  dettes: number;
};

type PremiumDomicileFormProps = {
  onBack: () => void;
  onRun: (payload: PremiumDomicilePayload) => Promise<MobileDomicileResult>;
  activeDossier: MobileActiveClientDossier;
  onActiveDossierChange: (partial: Partial<MobileActiveClientDossier>) => void;
};

const steps = [
  { step: "1", label: "Identité" },
  { step: "2", label: "Domiciles" },
  { step: "3", label: "Revenus" },
  { step: "4", label: "Patrimoine" },
];

function createInitialState(activeDossier: MobileActiveClientDossier): PremiumDomicilePayload {
  return {
    prenom: activeDossier.prenom,
    nom: activeDossier.nom,
    etatCivil: activeDossier.etatCivil,
    enfants: activeDossier.enfants,
    currentZip: activeDossier.zip,
    currentLocality: activeDossier.locality,
    newZip: "",
    newLocality: "",
    salaireNetContribuable: 0,
    salaireNetConjoint: 0,
    troisiemePilier: activeDossier.troisiemePilier,
    rachatLpp: activeDossier.rachatLpp,
    estProprietaire: false,
    valeurFiscaleImmeuble: 0,
    valeurLocative: 0,
    fraisEntretienImmeuble: 0,
    interetsHypothecaires: 0,
    fortuneMobiliere: 0,
    dettes: 0,
  };
}

export default function PremiumDomicileForm({
  onBack,
  onRun,
  activeDossier,
  onActiveDossierChange,
}: PremiumDomicileFormProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [form, setForm] = useState<PremiumDomicilePayload>(() => createInitialState(activeDossier));
  const [isRunning, setIsRunning] = useState(false);

  const currentSuggestions = searchSwissLocations(form.currentLocality, 8);
  const newSuggestions = searchSwissLocations(form.newLocality, 8);

  const isMarried = /mari[eé]/i.test(form.etatCivil);

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
      await onRun(form);
    } finally {
      setIsRunning(false);
    }
  };

  const setNum = (key: keyof PremiumDomicilePayload) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: Number(e.target.value) || 0 }));

  const setStr = (key: keyof PremiumDomicilePayload) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  // Show empty string instead of 0 so the user can type without fighting the controlled input
  const n = (val: number) => (val === 0 ? "" : val);

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
            setStepIndex(0);
          }}
        >
          Réinitialiser
        </button>
      </div>

      <MobileSectionHeader
        eyebrow="Analyse domicile — Premium"
        title="Comparaison fiscale enrichie"
        description="Saisissez vos données économiques réelles : TaxWare calcule les bases imposables spécifiques à chaque canton."
      />

      <MobileNavigation items={steps} activeIndex={stepIndex} onSelect={setStepIndex} />

      {/* ── Étape 1 : Identité ── */}
      {stepIndex === 0 ? (
        <>
          <div className="mobile-form-grid">
            <label className="mobile-field">
              <span className="mobile-field__label">Prénom</span>
              <input
                className="mobile-field__input"
                type="text"
                value={form.prenom}
                onChange={(e) => {
                  setForm((f) => ({ ...f, prenom: e.target.value }));
                  onActiveDossierChange({ prenom: e.target.value });
                }}
              />
            </label>
            <label className="mobile-field">
              <span className="mobile-field__label">Nom</span>
              <input
                className="mobile-field__input"
                type="text"
                value={form.nom}
                onChange={(e) => {
                  setForm((f) => ({ ...f, nom: e.target.value }));
                  onActiveDossierChange({ nom: e.target.value });
                }}
              />
            </label>
            <label className="mobile-field">
              <span className="mobile-field__label">État civil</span>
              <select
                className="mobile-field__select"
                value={form.etatCivil}
                onChange={(e) => {
                  setStr("etatCivil")(e);
                  onActiveDossierChange({ etatCivil: e.target.value });
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
              <span className="mobile-field__label">Nombre d'enfants</span>
              <input
                className="mobile-field__input"
                type="number"
                inputMode="numeric"
                value={n(form.enfants)}
                onChange={(e) => {
                  const v = Number(e.target.value) || 0;
                  setForm((f) => ({ ...f, enfants: v }));
                  onActiveDossierChange({ enfants: v });
                }}
              />
            </label>
          </div>
          <MobilePrimaryAction label="Continuer" onClick={() => setStepIndex(1)} />
        </>
      ) : null}

      {/* ── Étape 2 : Domiciles ── */}
      {stepIndex === 1 ? (
        <>
          <div className="mobile-form-grid">
            <div className="premium-form-group-label">Domicile actuel</div>
            <label className="mobile-field">
              <span className="mobile-field__label">NPA</span>
              <input
                className="mobile-field__input"
                type="text"
                inputMode="numeric"
                value={form.currentZip}
                onChange={(e) => {
                  setForm((f) => ({ ...f, currentZip: e.target.value }));
                  onActiveDossierChange({ zip: e.target.value });
                }}
              />
            </label>
            <label className="mobile-field">
              <span className="mobile-field__label">Localité</span>
              <input
                className="mobile-field__input"
                type="text"
                value={form.currentLocality}
                list="pf-current-locality"
                onChange={(e) => {
                  const sel = resolveSwissLocationSelection(e.target.value, { preferredZip: form.currentZip });
                  if (sel) {
                    setForm((f) => ({ ...f, currentZip: sel.zip, currentLocality: sel.locality }));
                    onActiveDossierChange({ zip: sel.zip, locality: sel.locality });
                  } else {
                    setForm((f) => ({ ...f, currentLocality: e.target.value }));
                    onActiveDossierChange({ locality: e.target.value });
                  }
                }}
              />
              <datalist id="pf-current-locality">
                {currentSuggestions.map((s) => (
                  <option key={s.key} value={s.selectionLabel} />
                ))}
              </datalist>
            </label>

            <div className="premium-form-group-label">Domicile envisagé</div>
            <label className="mobile-field">
              <span className="mobile-field__label">NPA</span>
              <input
                className="mobile-field__input"
                type="text"
                inputMode="numeric"
                value={form.newZip}
                onChange={(e) => setForm((f) => ({ ...f, newZip: e.target.value }))}
              />
            </label>
            <label className="mobile-field">
              <span className="mobile-field__label">Localité</span>
              <input
                className="mobile-field__input"
                type="text"
                value={form.newLocality}
                list="pf-new-locality"
                onChange={(e) => {
                  const sel = resolveSwissLocationSelection(e.target.value, { preferredZip: form.newZip });
                  if (sel) {
                    setForm((f) => ({ ...f, newZip: sel.zip, newLocality: sel.locality }));
                  } else {
                    setForm((f) => ({ ...f, newLocality: e.target.value }));
                  }
                }}
              />
              <datalist id="pf-new-locality">
                {newSuggestions.map((s) => (
                  <option key={s.key} value={s.selectionLabel} />
                ))}
              </datalist>
            </label>
          </div>
          <MobilePrimaryAction label="Passer aux revenus" onClick={() => setStepIndex(2)} />
        </>
      ) : null}

      {/* ── Étape 3 : Revenus ── */}
      {stepIndex === 2 ? (
        <>
          <div className="mobile-form-grid">
            <div className="premium-form-group-label">Contribuable</div>
            <label className="mobile-field">
              <span className="mobile-field__label">Salaire net (après AVS et LPP)</span>
              <input
                className="mobile-field__input"
                type="number"
                inputMode="numeric"
                value={n(form.salaireNetContribuable)}
                onChange={setNum("salaireNetContribuable")}
              />
            </label>
            <label className="mobile-field">
              <span className="mobile-field__label">3e pilier A</span>
              <input
                className="mobile-field__input"
                type="number"
                inputMode="numeric"
                value={n(form.troisiemePilier)}
                onChange={(e) => {
                  const v = Number(e.target.value) || 0;
                  setForm((f) => ({ ...f, troisiemePilier: v }));
                  onActiveDossierChange({ troisiemePilier: v });
                }}
              />
            </label>
            <label className="mobile-field">
              <span className="mobile-field__label">Rachat LPP</span>
              <input
                className="mobile-field__input"
                type="number"
                inputMode="numeric"
                value={n(form.rachatLpp)}
                onChange={(e) => {
                  const v = Number(e.target.value) || 0;
                  setForm((f) => ({ ...f, rachatLpp: v }));
                  onActiveDossierChange({ rachatLpp: v });
                }}
              />
            </label>

            {isMarried ? (
              <>
                <div className="premium-form-group-label">Conjoint</div>
                <label className="mobile-field">
                  <span className="mobile-field__label">Salaire net (après AVS et LPP)</span>
                  <input
                    className="mobile-field__input"
                    type="number"
                    inputMode="numeric"
                    value={n(form.salaireNetConjoint)}
                    onChange={setNum("salaireNetConjoint")}
                  />
                </label>
              </>
            ) : null}
          </div>
          <MobilePrimaryAction label="Passer au patrimoine" onClick={() => setStepIndex(3)} />
        </>
      ) : null}

      {/* ── Étape 4 : Patrimoine ── */}
      {stepIndex === 3 ? (
        <>
          <div className="mobile-form-grid">
            <label className="premium-form-toggle">
              <span className="premium-form-toggle__label">Propriétaire immobilier</span>
              <input
                type="checkbox"
                className="premium-form-toggle__checkbox"
                checked={form.estProprietaire}
                onChange={(e) => setForm((f) => ({ ...f, estProprietaire: e.target.checked }))}
              />
            </label>

            {form.estProprietaire ? (
              <>
                <div className="premium-form-group-label">Immeuble</div>
                <label className="mobile-field">
                  <span className="mobile-field__label">Valeur fiscale de l'immeuble</span>
                  <input
                    className="mobile-field__input"
                    type="number"
                    inputMode="numeric"
                    value={n(form.valeurFiscaleImmeuble)}
                    onChange={setNum("valeurFiscaleImmeuble")}
                  />
                </label>
                <label className="mobile-field">
                  <span className="mobile-field__label">Valeur locative</span>
                  <input
                    className="mobile-field__input"
                    type="number"
                    inputMode="numeric"
                    value={n(form.valeurLocative)}
                    onChange={setNum("valeurLocative")}
                  />
                </label>
                <label className="mobile-field">
                  <span className="mobile-field__label">Frais d'entretien</span>
                  <input
                    className="mobile-field__input"
                    type="number"
                    inputMode="numeric"
                    value={n(form.fraisEntretienImmeuble)}
                    onChange={setNum("fraisEntretienImmeuble")}
                  />
                </label>
                <label className="mobile-field">
                  <span className="mobile-field__label">Intérêts hypothécaires</span>
                  <input
                    className="mobile-field__input"
                    type="number"
                    inputMode="numeric"
                    value={n(form.interetsHypothecaires)}
                    onChange={setNum("interetsHypothecaires")}
                  />
                </label>
              </>
            ) : null}

            <div className="premium-form-group-label">Fortune mobilière</div>
            <label className="mobile-field">
              <span className="mobile-field__label">Liquidités et titres (brut)</span>
              <input
                className="mobile-field__input"
                type="number"
                inputMode="numeric"
                value={n(form.fortuneMobiliere)}
                onChange={setNum("fortuneMobiliere")}
              />
            </label>
            <label className="mobile-field">
              <span className="mobile-field__label">Dettes (hors hypothèques)</span>
              <input
                className="mobile-field__input"
                type="number"
                inputMode="numeric"
                value={n(form.dettes)}
                onChange={setNum("dettes")}
              />
            </label>
          </div>
          <MobilePrimaryAction
            label={isRunning ? "Comparaison en cours..." : "Lancer la comparaison"}
            onClick={() => { void handleRun(); }}
            disabled={!canRun || isRunning}
          />
        </>
      ) : null}
    </div>
  );
}
