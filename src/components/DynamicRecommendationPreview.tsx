import type { DynamicAdvisoryPreview } from "../lib/advisory/recommendationEngine";

type DynamicRecommendationPreviewProps = {
  preview: DynamicAdvisoryPreview;
  eyebrow?: string;
  title?: string;
  description?: string;
};

const wrapperStyle = {
  border: "1px solid #bfdbfe",
  borderRadius: "18px",
  padding: "24px",
  marginBottom: "24px",
  background: "linear-gradient(180deg, #ffffff 0%, #eff6ff 100%)",
  boxShadow: "0 12px 28px rgba(15, 23, 42, 0.06)",
};

const cardStyle = {
  border: "1px solid #dbeafe",
  borderRadius: "16px",
  padding: "18px",
  backgroundColor: "#ffffff",
  boxShadow: "0 8px 18px rgba(15, 23, 42, 0.04)",
};

const chipStyle = {
  display: "inline-flex",
  alignItems: "center",
  padding: "5px 10px",
  borderRadius: "999px",
  backgroundColor: "#eef2ff",
  border: "1px solid #c7d2fe",
  color: "#3730a3",
  fontSize: "12px",
  fontWeight: 700,
};

function PreviewBlock(props: {
  title: string;
  eyebrow: string;
  items: Array<{ key: string; title: string; text: string }>;
}) {
  return (
    <div style={cardStyle}>
      <div style={{ display: "grid", gap: "8px", marginBottom: "14px" }}>
        <span style={chipStyle}>{props.eyebrow}</span>
        <h3 style={{ margin: 0, color: "#0f172a", fontSize: "20px" }}>{props.title}</h3>
      </div>

      <div style={{ display: "grid", gap: "14px" }}>
        {props.items.map((item, index) => (
          <div
            key={item.key}
            style={{
              padding: "14px 16px",
              borderRadius: "14px",
              border: "1px solid #e2e8f0",
              backgroundColor: "#f8fafc",
            }}
          >
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: "10px",
                marginBottom: "8px",
              }}
            >
              <span
                style={{
                  width: "24px",
                  height: "24px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "999px",
                  backgroundColor: "#dbeafe",
                  color: "#1d4ed8",
                  fontSize: "12px",
                  fontWeight: 800,
                }}
              >
                {index + 1}
              </span>
              <strong style={{ color: "#0f172a" }}>{item.title}</strong>
              <code style={{ color: "#475569", fontSize: "12px" }}>{item.key}</code>
            </div>
            <p style={{ margin: 0, color: "#334155", lineHeight: 1.75 }}>{item.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DynamicRecommendationPreview(props: DynamicRecommendationPreviewProps) {
  const {
    preview,
    eyebrow = "Preview dynamique",
    title = "Prévisualisation du moteur de recommandations PDF",
    description = "Cette zone affiche les textes conditionnels retenus pour le dossier en cours. Elle ne modifie pas encore le PDF final et permet de vérifier l’ordre, le contenu et la logique d’assemblage avant intégration.",
  } = props;

  return (
    <div style={wrapperStyle}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "16px",
          alignItems: "flex-start",
          flexWrap: "wrap",
          marginBottom: "18px",
        }}
      >
        <div style={{ display: "grid", gap: "8px" }}>
          <span style={{ ...chipStyle, backgroundColor: "#dcfce7", border: "1px solid #bbf7d0", color: "#166534" }}>
            {eyebrow}
          </span>
          <h2 style={{ margin: 0, color: "#172554", fontSize: "26px" }}>
            {title}
          </h2>
          <p style={{ margin: 0, color: "#475569", lineHeight: 1.7, maxWidth: "820px" }}>
            {description}
          </p>
        </div>

        <div
          style={{
            ...cardStyle,
            minWidth: "260px",
            maxWidth: "320px",
            padding: "16px",
          }}
        >
          <div style={{ fontSize: "12px", fontWeight: 700, color: "#64748b", marginBottom: "8px" }}>
            Conclusion sélectionnée
          </div>
          <div style={{ color: "#0f172a", fontWeight: 800, fontSize: "18px", marginBottom: "8px" }}>
            {preview.blocks.conclusion.title}
          </div>
          <div style={{ color: "#475569", lineHeight: 1.6, fontSize: "14px" }}>
            {preview.debug.selectedConclusion.reason}
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "16px",
        }}
      >
        <PreviewBlock
          title="Logique de recommandation"
          eyebrow={`${preview.blocks.recommendationLogic.length} texte(s)`}
          items={preview.blocks.recommendationLogic}
        />
        <PreviewBlock
          title="Priorités d’action"
          eyebrow={`${preview.blocks.actionPriorities.length} texte(s)`}
          items={preview.blocks.actionPriorities}
        />
        <PreviewBlock
          title="Points de vigilance"
          eyebrow={`${preview.blocks.vigilancePoints.length} texte(s)`}
          items={preview.blocks.vigilancePoints}
        />
        <PreviewBlock
          title="Conclusion et mise en œuvre"
          eyebrow="Conclusion finale"
          items={[preview.blocks.conclusion]}
        />
      </div>

      <details
        style={{
          marginTop: "18px",
          padding: "16px 18px",
          borderRadius: "14px",
          border: "1px solid #cbd5e1",
          backgroundColor: "#f8fafc",
        }}
      >
        <summary style={{ cursor: "pointer", color: "#0f172a", fontWeight: 700 }}>
          Mode debug du moteur dynamique
        </summary>

        <div
          style={{
            display: "grid",
            gap: "16px",
            marginTop: "16px",
          }}
        >
          <div style={{ display: "grid", gap: "8px" }}>
            <strong style={{ color: "#0f172a" }}>Contexte détecté</strong>
            <div style={{ display: "grid", gap: "6px", color: "#334155", lineHeight: 1.6 }}>
              <div>Âge : {preview.debug.contextSummary.age} ans</div>
              <div>Partnership : {preview.debug.contextSummary.partnership}</div>
              <div>Enfants : {preview.debug.contextSummary.childrenCount}</div>
              <div>Revenu total : {preview.debug.contextSummary.totalIncome}</div>
              <div>Fortune totale : {preview.debug.contextSummary.totalWealth}</div>
              <div>Immobilier : {preview.debug.contextSummary.hasRealEstate ? "Oui" : "Non"}</div>
              <div>Régime immobilier : {preview.debug.contextSummary.realEstateRegime}</div>
              <div>Gain fiscal vs base : {preview.debug.contextSummary.taxGainVsBase}</div>
              <div>Écart entre variantes : {preview.debug.contextSummary.variantSpread}</div>
              <div>Variante recommandée : {preview.debug.contextSummary.recommendedVariantLabel}</div>
              <div>Régime recommandé : {preview.debug.contextSummary.recommendedVariantRegime}</div>
              <div>Objectif principal : {preview.debug.contextSummary.objectivePrincipal}</div>
            </div>
          </div>

          <div style={{ display: "grid", gap: "8px" }}>
            <strong style={{ color: "#0f172a" }}>Règles activées</strong>
            <div style={{ display: "grid", gap: "10px" }}>
              {preview.debug.activatedRules.map((rule) => (
                <div
                  key={rule.id}
                  style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: "12px",
                    padding: "12px 14px",
                    backgroundColor: "#ffffff",
                  }}
                >
                  <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                    <strong style={{ color: "#0f172a" }}>{rule.label}</strong>
                    <code style={{ color: "#64748b", fontSize: "12px" }}>{rule.id}</code>
                  </div>
                  <div style={{ color: "#334155", marginTop: "6px", lineHeight: 1.6 }}>
                    Déclencheur : {rule.reason}
                  </div>
                  <div style={{ color: "#475569", marginTop: "4px", lineHeight: 1.6 }}>
                    Effet : {rule.effect}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gap: "8px" }}>
            <strong style={{ color: "#0f172a" }}>Blocs injectés</strong>
            <div style={{ display: "grid", gap: "8px", color: "#334155", lineHeight: 1.6 }}>
              {preview.debug.injectedBlocks.map((block) => (
                <div key={`${block.block}-${block.key}`}>
                  <strong>{block.block}</strong> → {block.title} <code>{block.key}</code>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gap: "8px" }}>
            <strong style={{ color: "#0f172a" }}>Seuils actifs</strong>
            <div style={{ display: "grid", gap: "6px", color: "#334155", lineHeight: 1.6 }}>
              <div>Revenu élevé : {preview.debug.thresholds.highIncome.toLocaleString("fr-CH")} CHF</div>
              <div>Fortune élevée : {preview.debug.thresholds.highWealth.toLocaleString("fr-CH")} CHF</div>
              <div>Âge élevé : {preview.debug.thresholds.seniorAge} ans</div>
              <div>Gain fort : {preview.debug.thresholds.strongGain.toLocaleString("fr-CH")} CHF</div>
              <div>Gain faible : {preview.debug.thresholds.lowGain.toLocaleString("fr-CH")} CHF</div>
              <div>
                Écart important entre variantes :{" "}
                {preview.debug.thresholds.largeVariantGap.toLocaleString("fr-CH")} CHF
              </div>
              <div>
                Écart faible entre variantes :{" "}
                {preview.debug.thresholds.smallVariantGap.toLocaleString("fr-CH")} CHF
              </div>
            </div>
          </div>
        </div>
      </details>
    </div>
  );
}
