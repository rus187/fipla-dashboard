import type { CSSProperties } from "react";

type CantonFlagSize = "xs" | "sm" | "md";

type CantonFlagProps = {
  code: string;
  size?: CantonFlagSize;
  title?: string;
};

const CANTON_COLORS: Record<string, string> = {
  AG: "#3b82f6",
  AI: "#111827",
  AR: "#111827",
  BE: "#dc2626",
  BL: "#dc2626",
  BS: "#111827",
  FR: "#111827",
  GE: "#dc2626",
  GL: "#dc2626",
  GR: "#2563eb",
  JU: "#dc2626",
  LU: "#2563eb",
  NE: "#047857",
  NW: "#dc2626",
  OW: "#dc2626",
  SG: "#047857",
  SH: "#ca8a04",
  SO: "#dc2626",
  SZ: "#dc2626",
  TG: "#047857",
  TI: "#dc2626",
  UR: "#ca8a04",
  VD: "#047857",
  VS: "#dc2626",
  ZG: "#2563eb",
  ZH: "#2563eb",
};

const SIZE_PX: Record<CantonFlagSize, number> = {
  xs: 16,
  sm: 22,
  md: 28,
};

const FONT_PX: Record<CantonFlagSize, number> = {
  xs: 8,
  sm: 10,
  md: 12,
};

export default function CantonFlag({ code, size = "sm", title }: CantonFlagProps) {
  const normalizedCode = (code || "").trim().toUpperCase().slice(0, 2);
  const color = CANTON_COLORS[normalizedCode] ?? "#64748b";
  const dimension = SIZE_PX[size];
  const fontSize = FONT_PX[size];

  const style: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: `${dimension}px`,
    height: `${dimension}px`,
    borderRadius: "50%",
    background: color,
    color: "#ffffff",
    fontSize: `${fontSize}px`,
    fontWeight: 700,
    letterSpacing: "0.02em",
    lineHeight: 1,
    boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.18)",
    flexShrink: 0,
    userSelect: "none",
  };

  return (
    <span role="img" aria-label={title ?? `Canton ${normalizedCode}`} style={style}>
      {normalizedCode || "?"}
    </span>
  );
}
