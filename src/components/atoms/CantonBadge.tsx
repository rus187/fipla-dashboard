import type { CSSProperties } from "react";
import CantonFlag from "./CantonFlag";

type CantonBadgeSize = "xs" | "sm" | "md";

type CantonBadgeProps = {
  code: string;
  commune?: string;
  size?: CantonBadgeSize;
  cantonName?: string;
};

const CANTON_NAMES: Record<string, string> = {
  AG: "Argovie",
  AI: "Appenzell Rhodes-Intérieures",
  AR: "Appenzell Rhodes-Extérieures",
  BE: "Berne",
  BL: "Bâle-Campagne",
  BS: "Bâle-Ville",
  FR: "Fribourg",
  GE: "Genève",
  GL: "Glaris",
  GR: "Grisons",
  JU: "Jura",
  LU: "Lucerne",
  NE: "Neuchâtel",
  NW: "Nidwald",
  OW: "Obwald",
  SG: "Saint-Gall",
  SH: "Schaffhouse",
  SO: "Soleure",
  SZ: "Schwyz",
  TG: "Thurgovie",
  TI: "Tessin",
  UR: "Uri",
  VD: "Vaud",
  VS: "Valais",
  ZG: "Zoug",
  ZH: "Zurich",
};

export default function CantonBadge({
  code,
  commune,
  size = "sm",
  cantonName,
}: CantonBadgeProps) {
  const normalizedCode = (code || "").trim().toUpperCase().slice(0, 2);
  if (!normalizedCode) {
    return null;
  }
  const fullName = cantonName ?? CANTON_NAMES[normalizedCode] ?? normalizedCode;

  const wrapperStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    padding: "4px 10px 4px 4px",
    borderRadius: "999px",
    background: "#f1f5f9",
    color: "#0f172a",
    fontSize: size === "md" ? "13px" : "12px",
    fontWeight: 600,
    lineHeight: 1.2,
    maxWidth: "100%",
  };

  const textStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "baseline",
    gap: "6px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };

  const cantonLabelStyle: CSSProperties = {
    color: "#475569",
    fontWeight: 500,
  };

  return (
    <span style={wrapperStyle} aria-label={`Canton ${fullName}${commune ? `, ${commune}` : ""}`}>
      <CantonFlag code={normalizedCode} size={size} title={fullName} />
      <span style={textStyle}>
        {commune ? <span>{commune}</span> : null}
        <span style={cantonLabelStyle}>
          {commune ? `· ${normalizedCode}` : fullName}
        </span>
      </span>
    </span>
  );
}
