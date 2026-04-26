type MobileStatCardProps = {
  label: string;
  value: string;
  helper: string;
};

function valueClass(v: string): string {
  const t = v.trim();
  if (/^[-−]/.test(t)) return "value--negative";
  const n = parseFloat(t.replace(/[^0-9.]/g, ""));
  return !isNaN(n) && n > 0 ? "value--positive" : "";
}

export default function MobileStatCard({ label, value, helper }: MobileStatCardProps) {
  return (
    <article className="mobile-stat-card">
      <div className="mobile-stat-card__label">{label}</div>
      <div className={`mobile-stat-card__value ${valueClass(value)}`}>{value}</div>
      <div className="mobile-stat-card__helper">{helper}</div>
    </article>
  );
}
