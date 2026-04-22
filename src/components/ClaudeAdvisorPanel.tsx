import { useState } from "react";
import type { AdvisoryContext } from "../lib/advisory/recommendationEngine";
import { generateClaudeAdvisory, type ClaudeAdvisoryBlocks } from "../lib/advisory/claudeAdvisor";

type Props = {
  context: AdvisoryContext;
};

const wrapperStyle: React.CSSProperties = {
  border: "1px solid #e9d5ff",
  borderRadius: "18px",
  padding: "24px",
  marginBottom: "24px",
  background: "linear-gradient(180deg, #ffffff 0%, #faf5ff 100%)",
  boxShadow: "0 12px 28px rgba(88, 28, 135, 0.06)",
};

const chipStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  padding: "5px 12px",
  borderRadius: "999px",
  backgroundColor: "#f3e8ff",
  border: "1px solid #d8b4fe",
  color: "#6b21a8",
  fontSize: "12px",
  fontWeight: 700,
};

const cardStyle: React.CSSProperties = {
  border: "1px solid #ede9fe",
  borderRadius: "14px",
  padding: "18px",
  backgroundColor: "#ffffff",
  boxShadow: "0 4px 12px rgba(88, 28, 135, 0.04)",
};

const BLOCK_META: { key: keyof ClaudeAdvisoryBlocks; eyebrow: string; title: string }[] = [
  { key: "recommendationLogic", eyebrow: "Logique", title: "Recommandation" },
  { key: "actionPriorities", eyebrow: "Priorités", title: "Actions prioritaires" },
  { key: "vigilancePoints", eyebrow: "Vigilance", title: "Points d'attention" },
  { key: "conclusion", eyebrow: "Conclusion", title: "Mise en œuvre" },
];

export default function ClaudeAdvisorPanel({ context }: Props) {
  const [blocks, setBlocks] = useState<ClaudeAdvisoryBlocks | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setBlocks(null);

    const result = await generateClaudeAdvisory(context);

    if (result.status === "error") {
      setError(result.message);
    } else {
      setBlocks(result.blocks);
    }

    setLoading(false);
  }

  return (
    <div style={wrapperStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px", marginBottom: "18px" }}>
        <div style={{ display: "grid", gap: "8px" }}>
          <span style={chipStyle}>
            <span>✦</span> Claude Advisor
          </span>
          <h2 style={{ margin: 0, color: "#3b0764", fontSize: "24px" }}>
            Analyse IA du dossier
          </h2>
          <p style={{ margin: 0, color: "#6b21a8", fontSize: "14px", lineHeight: 1.6, maxWidth: "600px" }}>
            Génère une synthèse de conseil personnalisée basée sur le profil fiscal et patrimonial du client.
          </p>
        </div>

        <button
          onClick={handleGenerate}
          disabled={loading}
          style={{
            padding: "12px 24px",
            borderRadius: "12px",
            border: "none",
            backgroundColor: loading ? "#c4b5fd" : "#7c3aed",
            color: "#ffffff",
            fontWeight: 700,
            fontSize: "14px",
            cursor: loading ? "not-allowed" : "pointer",
            whiteSpace: "nowrap",
            transition: "background-color 0.15s",
          }}
        >
          {loading ? "Génération en cours…" : blocks ? "Régénérer" : "Générer l'analyse"}
        </button>
      </div>

      {error && (
        <div style={{ padding: "14px 18px", borderRadius: "12px", backgroundColor: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", fontSize: "14px" }}>
          {error}
        </div>
      )}

      {loading && (
        <div style={{ padding: "24px", textAlign: "center", color: "#7c3aed", fontSize: "14px" }}>
          Claude analyse le dossier…
        </div>
      )}

      {blocks && !loading && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "14px" }}>
          {BLOCK_META.map(({ key, eyebrow, title }) => {
            const text = blocks[key];
            if (!text) return null;
            return (
              <div key={key} style={cardStyle}>
                <div style={{ display: "grid", gap: "6px", marginBottom: "12px" }}>
                  <span style={{ ...chipStyle, backgroundColor: "#ede9fe", borderColor: "#ddd6fe", color: "#5b21b6", fontSize: "11px" }}>
                    {eyebrow}
                  </span>
                  <strong style={{ color: "#1e1b4b", fontSize: "15px" }}>{title}</strong>
                </div>
                <p style={{ margin: 0, color: "#374151", lineHeight: 1.75, fontSize: "14px" }}>{text}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
