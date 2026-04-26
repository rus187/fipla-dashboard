export type MobileResultMetric = {
  label: string;
  value: string;
};

type MobileResultCardProps = {
  title: string;
  eyebrow: string;
  helper: string;
  metrics: MobileResultMetric[];
};

function valueClass(v: string): string {
  const t = v.trim();
  if (/^[-−]/.test(t)) return "value--negative";
  const n = parseFloat(t.replace(/[^0-9.]/g, ""));
  return !isNaN(n) && n > 0 ? "value--positive" : "";
}

export default function MobileResultCard({
  title,
  eyebrow,
  helper,
  metrics,
}: MobileResultCardProps) {
  return (
    <article className="mobile-result-card">
      <div className="mobile-result-card__label">{eyebrow}</div>
      <div className={`mobile-result-card__value ${valueClass(title)}`}>{title}</div>
      <div className="mobile-result-card__helper">{helper}</div>
      <div className="mobile-result-grid">
        {metrics.map((metric) => (
          <div key={metric.label} className="mobile-result-row">
            <span className="mobile-result-row__name">{metric.label}</span>
            <span className={`mobile-result-row__value ${valueClass(metric.value)}`}>{metric.value}</span>
          </div>
        ))}
      </div>
    </article>
  );
}
