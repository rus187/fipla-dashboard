type DesktopActiveDossierField = {
  label: string;
  value: string;
  helper?: string;
};

type DesktopActiveDossierCardProps = {
  title: string;
  subtitle: string;
  fields: DesktopActiveDossierField[];
  onEdit: () => void;
  onNewDossier: () => void;
  onReset: () => void;
};

export default function DesktopActiveDossierCard({
  title,
  subtitle,
  fields,
  onEdit,
  onNewDossier,
  onReset,
}: DesktopActiveDossierCardProps) {
  return (
    <aside className="desktop-active-dossier" aria-label="Dossier actif">
      <div className="desktop-active-dossier__header">
        <div className="desktop-active-dossier__eyebrow">Dossier actif</div>
        <h2 className="desktop-active-dossier__title">{title}</h2>
        <p className="desktop-active-dossier__subtitle">{subtitle}</p>
      </div>

      <div className="desktop-active-dossier__grid">
        {fields.map((field) => (
          <div key={field.label} className="desktop-active-dossier__item">
            <div className="desktop-active-dossier__item-label">{field.label}</div>
            <div className="desktop-active-dossier__item-value">{field.value}</div>
            {field.helper ? (
              <div className="desktop-active-dossier__item-helper">{field.helper}</div>
            ) : null}
          </div>
        ))}
      </div>

      <div className="desktop-active-dossier__actions">
        <button type="button" className="desktop-secondary-button" onClick={onEdit}>
          Modifier
        </button>
        <button type="button" className="desktop-secondary-button" onClick={onNewDossier}>
          Nouveau dossier
        </button>
        <button
          type="button"
          className="desktop-secondary-button desktop-secondary-button--danger"
          onClick={onReset}
        >
          Réinitialiser
        </button>
      </div>
    </aside>
  );
}
