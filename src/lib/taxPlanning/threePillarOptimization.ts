// Optimisation 3e pilier A — fonctions pures, aucun effet de bord.
// Aucun appel API, aucun composant React, aucune mutation d'état global.

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ThreePillarPersonInput {
  label: string;
  currentContribution: number;
  maxContribution: number;
}

export interface ThreePillarOptimizationInput {
  personLeading: ThreePillarPersonInput;
  personSecond?: ThreePillarPersonInput;
  marginalTaxRate: number;
}

export interface ThreePillarPersonResult {
  label: string;
  currentContribution: number;
  maxContribution: number;
  remainingContribution: number;
  potentialTaxSaving: number;
}

export interface ThreePillarOptimizationResult {
  persons: ThreePillarPersonResult[];
  totalCurrentContribution: number;
  totalMaxContribution: number;
  totalRemainingContribution: number;
  marginalTaxRate: number;
  totalPotentialTaxSaving: number;
}

export interface ThreePillarProjectionInput {
  annualContribution: number;
  years: number;
  annualReturnRate: number;
  marginalTaxRate: number;
  exitTaxRate: number;
}

export interface ThreePillarProjectionResult {
  annualContribution: number;
  years: number;
  annualReturnRate: number;
  marginalTaxRate: number;
  exitTaxRate: number;
  totalContributions: number;
  totalTaxSavings: number;
  finalCapital: number;
  estimatedExitTax: number;
  netGainAfterExitTax: number;
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

function computePersonResult(
  person: ThreePillarPersonInput,
  marginalTaxRate: number
): ThreePillarPersonResult {
  const current = safePositive(person.currentContribution);
  const max = safePositive(person.maxContribution);
  const remaining = Math.max(0, max - current);
  const potentialTaxSaving = remaining * marginalTaxRate;

  return {
    label: person.label,
    currentContribution: current,
    maxContribution: max,
    remainingContribution: remaining,
    potentialTaxSaving,
  };
}

// ─── Optimisation annuelle ────────────────────────────────────────────────────

export function calculateThreePillarOptimization(
  input: ThreePillarOptimizationInput
): ThreePillarOptimizationResult {
  const rate = clampRate(input.marginalTaxRate);

  const persons: ThreePillarPersonResult[] = [
    computePersonResult(input.personLeading, rate),
  ];

  if (input.personSecond) {
    persons.push(computePersonResult(input.personSecond, rate));
  }

  const totalCurrentContribution = persons.reduce(
    (sum, p) => sum + p.currentContribution,
    0
  );
  const totalMaxContribution = persons.reduce(
    (sum, p) => sum + p.maxContribution,
    0
  );
  const totalRemainingContribution = persons.reduce(
    (sum, p) => sum + p.remainingContribution,
    0
  );
  const totalPotentialTaxSaving = persons.reduce(
    (sum, p) => sum + p.potentialTaxSaving,
    0
  );

  return {
    persons,
    totalCurrentContribution,
    totalMaxContribution,
    totalRemainingContribution,
    marginalTaxRate: rate,
    totalPotentialTaxSaving,
  };
}

// ─── Projection multi-années ──────────────────────────────────────────────────

// L'impôt de sortie est estimé ici par exitTaxRate.
// Une version future pourra utiliser l'endpoint TaxWare prestations en capital.
export function simulateThreePillarProjection(
  input: ThreePillarProjectionInput
): ThreePillarProjectionResult {
  const annualContribution = safePositive(input.annualContribution);
  const years = Math.max(0, Math.floor(safePositive(input.years)));
  const annualReturnRate = clampRate(input.annualReturnRate);
  const marginalTaxRate = clampRate(input.marginalTaxRate);
  const exitTaxRate = clampRate(input.exitTaxRate);

  const totalContributions = annualContribution * years;
  const totalTaxSavings = annualContribution * marginalTaxRate * years;

  // Accumulation annuelle en fin d'année :
  // versement de l'année k capitalise pendant (years - k) années, pour k = 1..years.
  let finalCapital = 0;
  for (let k = 1; k <= years; k++) {
    finalCapital += annualContribution * Math.pow(1 + annualReturnRate, years - k);
  }

  const estimatedExitTax = finalCapital * exitTaxRate;
  const netGainAfterExitTax =
    totalTaxSavings + (finalCapital - totalContributions) - estimatedExitTax;

  return {
    annualContribution,
    years,
    annualReturnRate,
    marginalTaxRate,
    exitTaxRate,
    totalContributions,
    totalTaxSavings,
    finalCapital,
    estimatedExitTax,
    netGainAfterExitTax,
  };
}
