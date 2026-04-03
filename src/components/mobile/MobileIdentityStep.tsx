type MobileIdentityValue = {
  prenom: string;
  nom: string;
  zip: string;
  locality: string;
  etatCivil: string;
  enfants: number;
};

type MobileIdentityStepProps = {
  value: MobileIdentityValue;
  onChange: (nextValue: MobileIdentityValue) => void;
};

export default function MobileIdentityStep({
  value,
  onChange,
}: MobileIdentityStepProps) {
  return (
    <div className="mobile-form-grid">
      <label className="mobile-field">
        <span className="mobile-field__label">Prénom</span>
        <input
          className="mobile-field__input"
          type="text"
          value={value.prenom}
          onChange={(event) => onChange({ ...value, prenom: event.target.value })}
        />
      </label>

      <label className="mobile-field">
        <span className="mobile-field__label">Nom</span>
        <input
          className="mobile-field__input"
          type="text"
          value={value.nom}
          onChange={(event) => onChange({ ...value, nom: event.target.value })}
        />
      </label>

      <label className="mobile-field">
        <span className="mobile-field__label">NPA</span>
        <input
          className="mobile-field__input"
          type="text"
          inputMode="numeric"
          value={value.zip}
          onChange={(event) => onChange({ ...value, zip: event.target.value })}
        />
      </label>

      <label className="mobile-field">
        <span className="mobile-field__label">Localité</span>
        <input
          className="mobile-field__input"
          type="text"
          value={value.locality}
          onChange={(event) => onChange({ ...value, locality: event.target.value })}
        />
      </label>

      <label className="mobile-field">
        <span className="mobile-field__label">État civil</span>
        <select
          className="mobile-field__select"
          value={value.etatCivil}
          onChange={(event) => onChange({ ...value, etatCivil: event.target.value })}
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
          value={value.enfants}
          onChange={(event) => onChange({ ...value, enfants: Number(event.target.value || 0) })}
        />
      </label>
    </div>
  );
}
