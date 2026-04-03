import type { MobileResultMetric } from "./MobileResultCard";

type MobileComparisonBlock = {
  label: string;
  value: string;
  helper: string;
  metrics: MobileResultMetric[];
};

type MobileComparisonCardProps = {
  current: MobileComparisonBlock;
  next: MobileComparisonBlock;
  difference: MobileComparisonBlock & {
    verdict: "Favorable" | "Neutre" | "Défavorable";
  };
};

function getVerdictClassName(verdict: MobileComparisonCardProps["difference"]["verdict"]) {
  if (verdict === "Favorable") {
    return "mobile-comparison-badge mobile-comparison-badge--favorable";
  }

  if (verdict === "Défavorable") {
    return "mobile-comparison-badge mobile-comparison-badge--defavorable";
  }

  return "mobile-comparison-badge mobile-comparison-badge--neutre";
}

function ComparisonBlock({
  label,
  value,
  helper,
  metrics,
}: MobileComparisonBlock) {
  return (
    <article className="mobile-comparison-card">
      <div className="mobile-comparison-card__label">{label}</div>
      <div className="mobile-comparison-card__value">{value}</div>
      <div className="mobile-comparison-card__helper">{helper}</div>
      <div className="mobile-result-grid">
        {metrics.map((metric) => (
          <div key={metric.label} className="mobile-result-row">
            <span className="mobile-result-row__name">{metric.label}</span>
            <span className="mobile-result-row__value">{metric.value}</span>
          </div>
        ))}
      </div>
    </article>
  );
}

export default function MobileComparisonCard({
  current,
  next,
  difference,
}: MobileComparisonCardProps) {
  return (
    <div className="mobile-cards-stack">
      <ComparisonBlock {...current} />
      <ComparisonBlock {...next} />
      <article className="mobile-comparison-card">
        <div className="mobile-comparison-card__label">{difference.label}</div>
        <div className="mobile-comparison-card__value">{difference.value}</div>
        <div className="mobile-comparison-card__helper">{difference.helper}</div>
        <div className={getVerdictClassName(difference.verdict)}>{difference.verdict}</div>
        <div className="mobile-result-grid">
          {difference.metrics.map((metric) => (
            <div key={metric.label} className="mobile-result-row">
              <span className="mobile-result-row__name">{metric.label}</span>
              <span className="mobile-result-row__value">{metric.value}</span>
            </div>
          ))}
        </div>
      </article>
    </div>
  );
}
