export type BaseParametersState = {
  fiscalYear: string
  canton: string
  commune: string
  npa: string
  maritalStatus: string
  childrenCount: string
}

export type RevenuesState = {
  annualIncome: string
}

export type FortuneState = {
  totalWealth: string
}

export type DebtsState = {
  totalDebts: string
}

export type ChargesDeductionsState = {
  passiveInterest: string
  mainDeductions: string
  thirdPillar: string
  lppBuyback: string
}

export type SimulationFormState = {
  baseParameters: BaseParametersState
  revenues: RevenuesState
  fortune: FortuneState
  debts: DebtsState
  chargesDeductions: ChargesDeductionsState
}

export type PreparedSimulationData = {
  simulationContext: {
    fiscalYear: number | null
    canton: string | null
    commune: string | null
    postalCode: string | null
  }
  householdProfile: {
    maritalStatus: string | null
    dependentChildren: number | null
  }
  incomeProfile: {
    annualIncome: number | null
  }
  wealthProfile: {
    totalWealth: number | null
  }
  liabilitiesProfile: {
    totalDebts: number | null
  }
  deductionProfile: {
    passiveInterest: number | null
    mainDeductions: number | null
    thirdPillarContribution: number | null
    lppBuybackContribution: number | null
  }
}

function normalizeText(value: string) {
  const trimmedValue = value.trim()
  return trimmedValue.length > 0 ? trimmedValue : null
}

function normalizeInteger(value: string) {
  const normalizedValue = value.replace(/[^\d-]/g, '')

  if (normalizedValue.length === 0) {
    return null
  }

  const parsedValue = Number.parseInt(normalizedValue, 10)
  return Number.isFinite(parsedValue) ? parsedValue : null
}

function normalizeAmount(value: string) {
  const normalizedValue = value
    .replace(/CHF/gi, '')
    .replace(/\s/g, '')
    .replace(/'/g, '')
    .replace(',', '.')

  if (normalizedValue.length === 0) {
    return null
  }

  const parsedValue = Number(normalizedValue)
  return Number.isFinite(parsedValue) ? parsedValue : null
}

export function mapFormStateToPreparedSimulation(
  formState: SimulationFormState
): PreparedSimulationData {
  return {
    simulationContext: {
      fiscalYear: normalizeInteger(formState.baseParameters.fiscalYear),
      canton: normalizeText(formState.baseParameters.canton),
      commune: normalizeText(formState.baseParameters.commune),
      postalCode: normalizeText(formState.baseParameters.npa),
    },
    householdProfile: {
      maritalStatus: normalizeText(formState.baseParameters.maritalStatus),
      dependentChildren: normalizeInteger(formState.baseParameters.childrenCount),
    },
    incomeProfile: {
      annualIncome: normalizeAmount(formState.revenues.annualIncome),
    },
    wealthProfile: {
      totalWealth: normalizeAmount(formState.fortune.totalWealth),
    },
    liabilitiesProfile: {
      totalDebts: normalizeAmount(formState.debts.totalDebts),
    },
    deductionProfile: {
      passiveInterest: normalizeAmount(formState.chargesDeductions.passiveInterest),
      mainDeductions: normalizeAmount(formState.chargesDeductions.mainDeductions),
      thirdPillarContribution: normalizeAmount(formState.chargesDeductions.thirdPillar),
      lppBuybackContribution: normalizeAmount(formState.chargesDeductions.lppBuyback),
    },
  }
}
