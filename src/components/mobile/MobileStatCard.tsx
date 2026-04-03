type MobileStatCardProps = {
  label: string;
  value: string;
  helper: string;
};

export default function MobileStatCard({ label, value, helper }: MobileStatCardProps) {
  return (
    <article className="mobile-stat-card">
      <div className="mobile-stat-card__label">{label}</div>
      <div className="mobile-stat-card__value">{value}</div>
      <div className="mobile-stat-card__helper">{helper}</div>
    </article>
  );
}
