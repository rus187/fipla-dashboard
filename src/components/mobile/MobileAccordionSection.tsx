export type MobileAccordionRow = {
  label: string;
  value: string;
};

type MobileAccordionSectionProps = {
  title: string;
  rows: MobileAccordionRow[];
};

export default function MobileAccordionSection({
  title,
  rows,
}: MobileAccordionSectionProps) {
  return (
    <details className="mobile-accordion">
      <summary>
        <span className="mobile-accordion__title">{title}</span>
        <span className="mobile-accordion__indicator">+</span>
      </summary>
      <div className="mobile-accordion__content">
        {rows.map((row) => (
          <div key={row.label} className="mobile-accordion__row">
            <span>{row.label}</span>
            <strong>{row.value}</strong>
          </div>
        ))}
      </div>
    </details>
  );
}
