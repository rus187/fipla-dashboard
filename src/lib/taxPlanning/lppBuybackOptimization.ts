// Optimisation rachat LPP — fonctions pures, aucun effet de bord.
// Aucun appel API, aucun composant React, aucune mutation d'état global.

// Le rachat LPP diminue le revenu imposable fiscalement, mais ne doit pas être
// soustrait des revenus dans le contrôle budgétaire interne.
// Il est financé par la fortune liquide.

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LPPBuybackOptimizationInput {
  buybackAmount: number;
  marginalTaxRate: number;
  availableLiquidWealth?: number;
}

export interface LPPBuybackOptimizationResult {
  buybackAmount: number;
  marginalTaxRate: number;
  estimatedTaxSaving: number;
  remainingLiquidWealth?: number;
  affectsTaxableIncome: boolean;
  affectsBudgetIncome: boolean;
  affectsLiquidWealth: boolean;
  warning?: string;
}

// ─── Utilitaires ──────────────────────────────────────────────────────────────

function safePositive(value: number | undefined): number {
  if (value === undefined || isNaN(value) || value < 0) return 0;
  return value;
}

function clampRate(value: number | undefined): number {
  const v = safePositive(value);
  return Math.min(1, v);
}

// ─── Simulation rachat LPP ────────────────────────────────────────────────────

export function simulateLPPBuybackOptimization(
  input: LPPBuybackOptimizationInput
): LPPBuybackOptimizationResult {
  const buybackAmount = safePositive(input.buybackAmount);
  const marginalTaxRate = clampRate(input.marginalTaxRate);
  const estimatedTaxSaving = buybackAmount * marginalTaxRate;

  const result: LPPBuybackOptimizationResult = {
    buybackAmount,
    marginalTaxRate,
    estimatedTaxSaving,
    affectsTaxableIncome: true,
    affectsBudgetIncome: false,
    affectsLiquidWealth: true,
  };

  if (input.availableLiquidWealth !== undefined) {
    const liquidWealth = safePositive(input.availableLiquidWealth);
    result.remainingLiquidWealth = Math.max(0, liquidWealth - buybackAmount);

    if (buybackAmount > liquidWealth) {
      result.warning =
        "Le rachat LPP simulé dépasse la fortune liquide disponible.";
    }
  }

  return result;
}
