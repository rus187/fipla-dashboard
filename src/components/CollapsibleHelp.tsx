import { useState, type ReactNode } from "react";

type CollapsibleHelpProps = {
  title?: string;
  children: ReactNode;
  defaultOpen?: boolean;
};

export default function CollapsibleHelp({
  title = "Aide pour cette section",
  children,
  defaultOpen = false,
}: CollapsibleHelpProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div
      style={{
        marginBottom: "18px",
        borderRadius: "14px",
        border: "1px solid #dbeafe",
        backgroundColor: "#f8fbff",
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          padding: "12px 14px",
          border: "none",
          background: "transparent",
          color: "#0f172a",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <div>
          <div style={{ fontSize: "14px", fontWeight: 700 }}>{title}</div>
          <div style={{ marginTop: "4px", fontSize: "12px", color: "#475569" }}>
            {isOpen ? "Cliquer pour refermer l aide" : "Cliquer pour afficher l aide"}
          </div>
        </div>

        <span
          aria-hidden="true"
          style={{
            minWidth: "28px",
            height: "28px",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "999px",
            border: "1px solid #bfdbfe",
            backgroundColor: "#ffffff",
            fontSize: "18px",
            fontWeight: 700,
            color: "#1d4ed8",
          }}
        >
          {isOpen ? "-" : "+"}
        </span>
      </button>

      {isOpen && (
        <div
          style={{
            padding: "0 14px 14px",
            color: "#334155",
            fontSize: "14px",
            lineHeight: 1.6,
            display: "grid",
            gap: "8px",
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
