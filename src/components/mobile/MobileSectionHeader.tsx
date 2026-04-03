type MobileSectionHeaderProps = {
  eyebrow: string;
  title: string;
  description: string;
};

export default function MobileSectionHeader({
  eyebrow,
  title,
  description,
}: MobileSectionHeaderProps) {
  return (
    <header className="mobile-section-header">
      <div className="mobile-section-header__eyebrow">{eyebrow}</div>
      <h1 className="mobile-section-header__title">{title}</h1>
      <p className="mobile-section-header__description">{description}</p>
    </header>
  );
}
