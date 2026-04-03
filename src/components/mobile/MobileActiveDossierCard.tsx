import { useEffect, useState } from "react";
import {
  getActiveClientDossierLabel,
  hasActiveClientDossier,
  normalizeActiveClientDossier,
  type MobileActiveClientDossier,
} from "./activeClientDossier";

type MobileActiveDossierCardProps = {
  dossier: MobileActiveClientDossier;
  onSave: (nextValue: MobileActiveClientDossier) => void;
  onResetToNew: () => void;
  onClear: () => void;
};

export default function MobileActiveDossierCard({
  dossier,
  onSave,
  onResetToNew,
  onClear,
}: MobileActiveDossierCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<MobileActiveClientDossier>(dossier);

  useEffect(() => {
    setDraft(dossier);
  }, [dossier]);

  const handleSave = () => {
    onSave(normalizeActiveClientDossier(draft));
    setIsEditing(false);
  };

  return (
    <article className="mobile-active-dossier">
      <div className="mobile-active-dossier__header">
        <div className="mobile-active-dossier__content">
          <div className="mobile-active-dossier__label">Dossier actif</div>
          <div className="mobile-active-dossier__marker">DOSSIER ACTIF BRANCHÉ</div>
          <div className="mobile-active-dossier__title">{getActiveClientDossierLabel(dossier)}</div>
          <p className="mobile-active-dossier__helper">
            {hasActiveClientDossier(dossier)
              ? "Les données communes sont mémorisées et réutilisées automatiquement entre les modules mobiles."
              : "Aucun dossier partagé n’est encore mémorisé. Vous pouvez démarrer un dossier mobile commun dès maintenant."}
          </p>
        </div>
        <div className="mobile-active-dossier__actions">
          <button
            type="button"
            className="mobile-secondary-action"
            onClick={() => setIsEditing((current) => !current)}
          >
            {isEditing ? "Fermer" : "Modifier les données de base"}
          </button>
          <button type="button" className="mobile-secondary-action" onClick={onResetToNew}>
            Nouveau dossier
          </button>
          <button
            type="button"
            className="mobile-secondary-action mobile-secondary-action--danger"
            onClick={() => {
              onClear();
              setIsEditing(false);
            }}
          >
            Effacer le dossier actif
          </button>
        </div>
      </div>

      {isEditing ? (
        <div className="mobile-form-grid">
          <label className="mobile-field">
            <span className="mobile-field__label">Prénom</span>
            <input
              className="mobile-field__input"
              type="text"
              value={draft.prenom}
              onChange={(event) => setDraft((current) => ({ ...current, prenom: event.target.value }))}
            />
          </label>
          <label className="mobile-field">
            <span className="mobile-field__label">Nom</span>
            <input
              className="mobile-field__input"
              type="text"
              value={draft.nom}
              onChange={(event) => setDraft((current) => ({ ...current, nom: event.target.value }))}
            />
          </label>
          <label className="mobile-field">
            <span className="mobile-field__label">NPA</span>
            <input
              className="mobile-field__input"
              type="text"
              inputMode="numeric"
              value={draft.zip}
              onChange={(event) => setDraft((current) => ({ ...current, zip: event.target.value }))}
            />
          </label>
          <label className="mobile-field">
            <span className="mobile-field__label">Localité</span>
            <input
              className="mobile-field__input"
              type="text"
              value={draft.locality}
              onChange={(event) =>
                setDraft((current) => ({ ...current, locality: event.target.value }))
              }
            />
          </label>
          <label className="mobile-field">
            <span className="mobile-field__label">État civil</span>
            <select
              className="mobile-field__select"
              value={draft.etatCivil}
              onChange={(event) =>
                setDraft((current) => ({ ...current, etatCivil: event.target.value }))
              }
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
              value={draft.enfants}
              onChange={(event) =>
                setDraft((current) => ({ ...current, enfants: Number(event.target.value || 0) }))
              }
            />
          </label>
          <label className="mobile-field">
            <span className="mobile-field__label">Revenu imposable IFD</span>
            <input
              className="mobile-field__input"
              type="number"
              inputMode="numeric"
              value={draft.revenuImposableIfd}
              onChange={(event) =>
                setDraft((current) => ({
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
              value={draft.revenuImposableIcc}
              onChange={(event) =>
                setDraft((current) => ({
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
              value={draft.fortuneImposable}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  fortuneImposable: Number(event.target.value || 0),
                }))
              }
            />
          </label>
          <label className="mobile-field">
            <span className="mobile-field__label">3e pilier</span>
            <input
              className="mobile-field__input"
              type="number"
              inputMode="numeric"
              value={draft.troisiemePilier}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  troisiemePilier: Number(event.target.value || 0),
                }))
              }
            />
          </label>
          <label className="mobile-field">
            <span className="mobile-field__label">Rachat LPP</span>
            <input
              className="mobile-field__input"
              type="number"
              inputMode="numeric"
              value={draft.rachatLpp}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  rachatLpp: Number(event.target.value || 0),
                }))
              }
            />
          </label>
          <button type="button" className="mobile-primary-action" onClick={handleSave}>
            Enregistrer le dossier actif
          </button>
        </div>
      ) : null}
    </article>
  );
}
