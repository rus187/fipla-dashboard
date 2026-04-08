// BE LOCKED LOGIC - REVENU DE LA FORTUNE / AssetIncome
// This helper deliberately enables the explicit "Revenu de la fortune" field
// for Bern only. Do NOT extend this rule to other cantons without explicit
// user authorization, and do NOT auto-derive this amount from real estate,
// securities, or other fiscal calculations.
export function isBernAssetIncomeEnabled(params: {
  canton?: string | null | undefined;
  cantonFiscal?: string | null | undefined;
}) {
  return String(params.cantonFiscal || params.canton || "")
    .trim()
    .toUpperCase() === "BE";
}
