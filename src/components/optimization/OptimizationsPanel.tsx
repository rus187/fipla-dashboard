import type { CSSProperties } from "react";
import type { ThreePillarOptimizationResult } from "../../lib/taxPlanning/threePillarOptimization";
import type { LPPBuybackOptimizationResult } from "../../lib/taxPlanning/lppBuybackOptimization";

interface ThreePillarProjectionProps {
  totalContributions: number;
  finalCapital: number;
  totalTaxSavings: number;
  estimatedExitTax: number;
  netGainAfterExitTax: number;
  years: number;
}

interface StandardTaxSummaryProps {
  taxwareStandardTax?: number;
}

interface CantonalOptimizationSummaryProps {
  canton: string;
  baseIncomeCanton: number;
  totalIncomeAdjustments: number;
  adjustedIncomeCanton: number;
  baseWealthCanton: number;
  totalWealthAdjustments: number;
  adjustedWealthCanton: number;
  warnings?: Array<{ ruleId: string; message: string }>;
}

interface OptimizationsPanelProps {
  threePillarOptimization?: ThreePillarOptimizationResult;
  threePillarProjection?: ThreePillarProjectionProps;
  lppBuybackOptimization?: LPPBuybackOptimizationResult;
  standardTaxSummary?: StandardTaxSummaryProps;
  cantonalOptimizationSummary?: CantonalOptimizationSummaryProps;
}

const cardStyle: CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: "10px",
  padding: "20px 24px",
  background: "#f8fafc",
  flex: "1 1 260px",
};

const cardTitleStyle: CSSProperties = {
  margin: "0 0 8px 0",
  fontSize: "1rem",
  fontWeight: 600,
  color: "#1e293b",
};

const cardTextStyle: CSSProperties = {
  margin: "0 0 6px 0",
  fontSize: "0.925rem",
  color: "#475569",
  lineHeight: 1.6,
};

const highlightStyle: CSSProperties = {
  fontWeight: 600,
  color: "#0f172a",
};

const projectionTitleStyle: CSSProperties = {
  margin: "16px 0 8px 0",
  fontSize: "0.875rem",
  fontWeight: 700,
  color: "#334155",
  borderTop: "1px solid #e2e8f0",
  paddingTop: "12px",
};

const disclaimerStyle: CSSProperties = {
  margin: "10px 0 0 0",
  fontSize: "0.75rem",
  color: "#94a3b8",
  fontStyle: "italic",
};

const warningStyle: CSSProperties = {
  margin: "8px 0 0 0",
  fontSize: "0.85rem",
  color: "#b45309",
  fontWeight: 500,
};

const explainerBoxStyle: CSSProperties = {
  marginTop: "14px",
  borderTop: "1px dashed #e2e8f0",
  paddingTop: "12px",
};

const explainerTitleStyle: CSSProperties = {
  margin: "0 0 6px 0",
  fontSize: "0.775rem",
  fontWeight: 700,
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const explainerLineStyle: CSSProperties = {
  margin: "0 0 4px 0",
  fontSize: "0.825rem",
  color: "#64748b",
  lineHeight: 1.5,
};

const tagStyle = (active: boolean): CSSProperties => ({
  display: "inline-block",
  fontSize: "0.75rem",
  fontWeight: 600,
  padding: "2px 8px",
  borderRadius: "4px",
  background: active ? "#dcfce7" : "#fee2e2",
  color: active ? "#166534" : "#991b1b",
  marginRight: "4px",
});

function fmtChf(value: number): string {
  return (
    new Intl.NumberFormat("fr-CH", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value) + " CHF"
  );
}

export default function OptimizationsPanel({
  threePillarOptimization,
  threePillarProjection,
  lppBuybackOptimization,
  standardTaxSummary,
  cantonalOptimizationSummary,
}: OptimizationsPanelProps) {
  const lppIsActive =
    lppBuybackOptimization !== undefined && lppBuybackOptimization.buybackAmount > 0;

  const threePillarGain = threePillarOptimization?.totalPotentialTaxSaving ?? 0;
  const lppBuybackGain = lppIsActive ? (lppBuybackOptimization?.estimatedTaxSaving ?? 0) : 0;
  const totalPotentialTaxSaving = threePillarGain + lppBuybackGain;

  const standardTax = standardTaxSummary?.taxwareStandardTax ?? 0;
  const optimizedIndicativeTax = Math.max(0, standardTax - totalPotentialTaxSaving);
  const showRecap = standardTax > 0 && totalPotentialTaxSaving > 0;

  return (
    <div style={{ marginTop: "32px" }}>
      <h3
        style={{
          margin: "0 0 16px 0",
          fontSize: "1.125rem",
          fontWeight: 700,
          color: "#0f172a",
        }}
      >
        Optimisations fiscales détectées
      </h3>

      <div
        style={{
          border: "1px solid #cbd5e1",
          borderLeft: "4px solid #64748b",
          borderRadius: "6px",
          padding: "12px 16px",
          background: "#f8fafc",
          marginBottom: "16px",
        }}
      >
        <p
          style={{
            margin: "0 0 4px 0",
            fontSize: "0.8rem",
            fontWeight: 700,
            color: "#475569",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          Résultat standard vs optimisation
        </p>
        <p
          style={{
            margin: 0,
            fontSize: "0.875rem",
            color: "#64748b",
            lineHeight: 1.5,
          }}
        >
          Le calcul TaxWare reste la base fiscale standard. Les montants ci-dessous
          représentent des optimisations FIPLA indicatives, basées sur les données
          disponibles et les hypothèses affichées.
        </p>
      </div>

      {totalPotentialTaxSaving > 0 && (
        <div
          style={{
            border: "1.5px solid #bbf7d0",
            borderRadius: "12px",
            padding: "18px 24px",
            background: "#f0fdf4",
            marginBottom: "16px",
          }}
        >
          <p
            style={{
              margin: "0 0 12px 0",
              fontSize: "0.875rem",
              fontWeight: 700,
              color: "#14532d",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Gain fiscal potentiel
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {threePillarGain > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.925rem", color: "#166534" }}>Gain 3e pilier A</span>
                <span style={{ fontSize: "0.925rem", fontWeight: 600, color: "#166534" }}>
                  {fmtChf(threePillarGain)}
                </span>
              </div>
            )}
            {lppBuybackGain > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.925rem", color: "#166534" }}>Gain rachat LPP</span>
                <span style={{ fontSize: "0.925rem", fontWeight: 600, color: "#166534" }}>
                  {fmtChf(lppBuybackGain)}
                </span>
              </div>
            )}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderTop: "1px solid #86efac",
                paddingTop: "8px",
                marginTop: "4px",
              }}
            >
              <span style={{ fontSize: "1rem", fontWeight: 700, color: "#14532d" }}>
                Total potentiel
              </span>
              <span style={{ fontSize: "1.125rem", fontWeight: 800, color: "#14532d" }}>
                {fmtChf(totalPotentialTaxSaving)}
              </span>
            </div>
          </div>

          <p
            style={{
              margin: "12px 0 0 0",
              fontSize: "0.75rem",
              fontStyle: "italic",
              color: "#16a34a",
            }}
          >
            Estimation indicative basée sur les données disponibles. Ne remplace pas un calcul fiscal définitif.
          </p>
        </div>
      )}

      {showRecap && (
        <div
          style={{
            border: "1.5px solid #c7d2fe",
            borderRadius: "12px",
            padding: "18px 24px",
            background: "#eef2ff",
            marginBottom: "16px",
          }}
        >
          <p
            style={{
              margin: "0 0 14px 0",
              fontSize: "0.875rem",
              fontWeight: 700,
              color: "#3730a3",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Standard TaxWare vs Optimisé FIPLA
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.925rem", color: "#4338ca" }}>
                Impôt standard TaxWare
              </span>
              <span style={{ fontSize: "0.925rem", fontWeight: 600, color: "#1e1b4b" }}>
                {fmtChf(standardTax)}
              </span>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.925rem", color: "#4338ca" }}>
                Gain fiscal potentiel
              </span>
              <span style={{ fontSize: "0.925rem", fontWeight: 600, color: "#166534" }}>
                − {fmtChf(totalPotentialTaxSaving)}
              </span>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderTop: "1px solid #a5b4fc",
                paddingTop: "10px",
                marginTop: "4px",
              }}
            >
              <span style={{ fontSize: "1rem", fontWeight: 700, color: "#1e1b4b" }}>
                Impôt optimisé indicatif
              </span>
              <span style={{ fontSize: "1.25rem", fontWeight: 800, color: "#1e1b4b" }}>
                {fmtChf(optimizedIndicativeTax)}
              </span>
            </div>
          </div>

          <p
            style={{
              margin: "12px 0 0 0",
              fontSize: "0.75rem",
              fontStyle: "italic",
              color: "#6366f1",
            }}
          >
            Le montant optimisé est indicatif : il additionne des leviers potentiels et ne
            remplace pas un nouveau calcul fiscal définitif.
          </p>
        </div>
      )}

      <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
        {/* Carte 3e pilier A */}
        <div style={cardStyle}>
          <p style={cardTitleStyle}>3e pilier A</p>

          {threePillarOptimization ? (
            <>
              <p style={cardTextStyle}>
                Versement actuel :{" "}
                <span style={highlightStyle}>
                  {fmtChf(threePillarOptimization.totalCurrentContribution)}
                </span>
              </p>
              <p style={cardTextStyle}>
                Plafond total :{" "}
                <span style={highlightStyle}>
                  {fmtChf(threePillarOptimization.totalMaxContribution)}
                </span>
              </p>
              <p style={cardTextStyle}>
                Potentiel restant :{" "}
                <span style={highlightStyle}>
                  {fmtChf(threePillarOptimization.totalRemainingContribution)}
                </span>
              </p>
              <p style={{ ...cardTextStyle, marginTop: "10px", color: "#166534" }}>
                Gain fiscal estimé :{" "}
                <span style={{ fontWeight: 700 }}>
                  {fmtChf(threePillarOptimization.totalPotentialTaxSaving)}
                </span>
              </p>

              {threePillarProjection && (
                <>
                  <p style={projectionTitleStyle}>
                    Projection sur {threePillarProjection.years} ans
                  </p>
                  <p style={cardTextStyle}>
                    Versements cumulés :{" "}
                    <span style={highlightStyle}>
                      {fmtChf(threePillarProjection.totalContributions)}
                    </span>
                  </p>
                  <p style={cardTextStyle}>
                    Capital estimé :{" "}
                    <span style={highlightStyle}>
                      {fmtChf(threePillarProjection.finalCapital)}
                    </span>
                  </p>
                  <p style={cardTextStyle}>
                    Économie fiscale cumulée :{" "}
                    <span style={highlightStyle}>
                      {fmtChf(threePillarProjection.totalTaxSavings)}
                    </span>
                  </p>
                  <p style={cardTextStyle}>
                    Impôt de sortie estimé :{" "}
                    <span style={highlightStyle}>
                      {fmtChf(threePillarProjection.estimatedExitTax)}
                    </span>
                  </p>
                  <p style={{ ...cardTextStyle, color: "#166534" }}>
                    Gain net estimé :{" "}
                    <span style={{ fontWeight: 700 }}>
                      {fmtChf(threePillarProjection.netGainAfterExitTax)}
                    </span>
                  </p>
                  <p style={disclaimerStyle}>
                    Projection indicative basée sur des hypothèses temporaires.
                  </p>
                </>
              )}
            </>
          ) : (
            <p style={cardTextStyle}>
              Vous pourriez potentiellement optimiser vos versements et réduire votre impôt.
            </p>
          )}

          <div style={explainerBoxStyle}>
            <p style={explainerTitleStyle}>Pourquoi c'est intéressant ?</p>
            <p style={explainerLineStyle}>
              Chaque versement 3a admissible peut réduire votre revenu imposable.
            </p>
            <p style={explainerLineStyle}>
              Action : vérifier si vous pouvez encore verser avant la fin de l'année fiscale.
            </p>
            <p style={{ ...explainerLineStyle, margin: 0 }}>
              Justificatif : conserver l'attestation bancaire ou d'assurance du 3e pilier A.
            </p>
          </div>
        </div>

        {/* Carte Rachat LPP */}
        <div style={cardStyle}>
          <p style={cardTitleStyle}>Rachat LPP</p>

          {lppIsActive && lppBuybackOptimization ? (
            <>
              <p style={cardTextStyle}>
                Montant simulé :{" "}
                <span style={highlightStyle}>
                  {fmtChf(lppBuybackOptimization.buybackAmount)}
                </span>
              </p>
              <p style={{ ...cardTextStyle, color: "#166534" }}>
                Économie fiscale estimée :{" "}
                <span style={{ fontWeight: 700 }}>
                  {fmtChf(lppBuybackOptimization.estimatedTaxSaving)}
                </span>
              </p>

              <div style={{ margin: "10px 0 6px 0" }}>
                <span style={tagStyle(lppBuybackOptimization.affectsTaxableIncome)}>
                  Revenu imposable ↓
                </span>
                <span style={tagStyle(!lppBuybackOptimization.affectsBudgetIncome)}>
                  Budget interne =
                </span>
                <span style={tagStyle(lppBuybackOptimization.affectsLiquidWealth)}>
                  Fortune liquide ↓
                </span>
              </div>

              {lppBuybackOptimization.remainingLiquidWealth !== undefined && (
                <p style={cardTextStyle}>
                  Fortune liquide restante :{" "}
                  <span style={highlightStyle}>
                    {fmtChf(lppBuybackOptimization.remainingLiquidWealth)}
                  </span>
                </p>
              )}

              <p style={{ ...disclaimerStyle, margin: "10px 0 0 0" }}>
                Le rachat LPP réduit le revenu imposable, mais il est traité comme une
                sortie de fortune liquide, pas comme une baisse du revenu budgétaire.
              </p>

              {lppBuybackOptimization.warning && (
                <p style={warningStyle}>⚠ {lppBuybackOptimization.warning}</p>
              )}
            </>
          ) : (
            <p style={cardTextStyle}>
              Un rachat dans votre caisse de pension peut réduire votre revenu imposable.
            </p>
          )}

          <div style={explainerBoxStyle}>
            <p style={explainerTitleStyle}>Pourquoi c'est intéressant ?</p>
            <p style={explainerLineStyle}>
              Un rachat LPP peut réduire votre revenu imposable, mais il mobilise votre fortune liquide.
            </p>
            <p style={explainerLineStyle}>
              Action : demander à votre caisse de pension le montant de rachat possible.
            </p>
            <p style={{ ...explainerLineStyle, margin: 0 }}>
              Justificatif : conserver l'attestation de rachat et le certificat de prévoyance.
            </p>
          </div>
        </div>
      </div>

      {cantonalOptimizationSummary &&
        (cantonalOptimizationSummary.baseIncomeCanton > 0 ||
          cantonalOptimizationSummary.baseWealthCanton > 0) && (
          <div
            style={{
              marginTop: "16px",
              border: "1px solid #d1d5db",
              borderLeft: "4px solid #6b7280",
              borderRadius: "6px",
              padding: "14px 18px",
              background: "#f9fafb",
            }}
          >
            <p
              style={{
                margin: "0 0 2px 0",
                fontSize: "0.775rem",
                fontWeight: 700,
                color: "#6b7280",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Lecture cantonale préparatoire — {cantonalOptimizationSummary.canton}
            </p>

            <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "5px" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: "0.85rem", color: "#6b7280" }}>Revenu cantonal standard</span>
                <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#374151" }}>
                  {fmtChf(cantonalOptimizationSummary.baseIncomeCanton)}
                </span>
              </div>
              {cantonalOptimizationSummary.totalIncomeAdjustments > 0 && (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "0.85rem", color: "#6b7280" }}>Ajustements revenu potentiels</span>
                    <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#166534" }}>
                      − {fmtChf(cantonalOptimizationSummary.totalIncomeAdjustments)}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #e5e7eb", paddingTop: "5px" }}>
                    <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#374151" }}>Revenu cantonal corrigé indicatif</span>
                    <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#1f2937" }}>
                      {fmtChf(cantonalOptimizationSummary.adjustedIncomeCanton)}
                    </span>
                  </div>
                </>
              )}

              {cantonalOptimizationSummary.baseWealthCanton > 0 && (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: "6px" }}>
                    <span style={{ fontSize: "0.85rem", color: "#6b7280" }}>Fortune cantonale standard</span>
                    <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#374151" }}>
                      {fmtChf(cantonalOptimizationSummary.baseWealthCanton)}
                    </span>
                  </div>
                  {cantonalOptimizationSummary.totalWealthAdjustments > 0 && (
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ fontSize: "0.85rem", color: "#6b7280" }}>Ajustements fortune potentiels</span>
                        <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#374151" }}>
                          + {fmtChf(cantonalOptimizationSummary.totalWealthAdjustments)}
                        </span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #e5e7eb", paddingTop: "5px" }}>
                        <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#374151" }}>Fortune cantonale corrigée indicative</span>
                        <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#1f2937" }}>
                          {fmtChf(cantonalOptimizationSummary.adjustedWealthCanton)}
                        </span>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>

            <p
              style={{
                margin: "10px 0 0 0",
                fontSize: "0.72rem",
                fontStyle: "italic",
                color: "#9ca3af",
              }}
            >
              Lecture indicative préparatoire. Les règles cantonales pilotes ne remplacent pas
              le calcul TaxWare ni une validation fiscale cantonale.
            </p>
          </div>
        )}

      <div
        style={{
          marginTop: "20px",
          border: "1px solid #e2e8f0",
          borderLeft: "4px solid #334155",
          borderRadius: "6px",
          padding: "16px 20px",
          background: "#f1f5f9",
        }}
      >
        <p
          style={{
            margin: "0 0 2px 0",
            fontSize: "0.775rem",
            fontWeight: 700,
            color: "#334155",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          Lecture conseiller
        </p>
        <p
          style={{
            margin: "0 0 12px 0",
            fontSize: "0.825rem",
            color: "#64748b",
          }}
        >
          Points à contrôler avant recommandation client
        </p>

        <ol
          style={{
            margin: 0,
            padding: "0 0 0 18px",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
          }}
        >
          {[
            "Le taux marginal utilisé est une estimation temporaire.",
            "Le plafond 3a affiché est temporaire et devra être relié au référentiel légal.",
            "L'impôt de sortie 3a est estimé ; une version future pourra utiliser l'endpoint TaxWare prestations en capital.",
            "Le rachat LPP doit être validé avec le certificat de prévoyance et la capacité de rachat disponible.",
            "Les montants affichés ne remplacent pas une validation fiscale définitive.",
          ].map((point, i) => (
            <li
              key={i}
              style={{
                fontSize: "0.825rem",
                color: "#475569",
                lineHeight: 1.5,
              }}
            >
              {point}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
