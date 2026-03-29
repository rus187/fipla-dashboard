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
  netWages: string
  pensionIncome: string
  hasOasiPensions: string
  otherIncome: string
  assetIncome: string
  miscIncome: string
  spouseNetWages: string
  spousePensionIncome: string
  spouseHasOasiPensions: string
  spouseOtherIncome: string
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
  spouseThirdPillar: string
  spouseLppBuyback: string
}

export type RealEstateState = {
  taxableValue: string
  rentalIncome: string
  effectiveExpenses: string
}

export type SimulationFormState = {
  baseParameters: BaseParametersState
  revenues: RevenuesState
  fortune: FortuneState
  debts: DebtsState
  chargesDeductions: ChargesDeductionsState
  realEstate: RealEstateState
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
    netWages: number | null
    pensionIncome: number | null
    hasOasiPensions: boolean | null
    otherIncome: number | null
    assetIncome: number | null
    miscIncome: number | null
  }
  spouseProfile: {
    netWages: number | null
    pensionIncome: number | null
    hasOasiPensions: boolean | null
    otherIncome: number | null
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
    spouseThirdPillarContribution: number | null
    spouseLppBuybackContribution: number | null
  }
  realEstateProfile: {
    properties: Array<{
      taxableValue: number | null
      rentalIncome: number | null
      effectiveExpenses: number | null
    }>
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

function normalizeBoolean(value: string) {
  const normalizedValue = value.trim().toLowerCase()

  if (normalizedValue === 'oui') {
    return true
  }

  if (normalizedValue === 'non') {
    return false
  }

  return null
}

export function mapFormStateToPreparedSimulation(
  formState: SimulationFormState
): PreparedSimulationData {
  const realEstateDraft = {
    taxableValue: normalizeAmount(formState.realEstate.taxableValue),
    rentalIncome: normalizeAmount(formState.realEstate.rentalIncome),
    effectiveExpenses: normalizeAmount(formState.realEstate.effectiveExpenses),
  }

  const hasRealEstateDraft = Object.values(realEstateDraft).some((value) => value !== null)

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
      netWages: normalizeAmount(formState.revenues.netWages),
      pensionIncome: normalizeAmount(formState.revenues.pensionIncome),
      hasOasiPensions: normalizeBoolean(formState.revenues.hasOasiPensions),
      otherIncome: normalizeAmount(formState.revenues.otherIncome),
      assetIncome: normalizeAmount(formState.revenues.assetIncome),
      miscIncome: normalizeAmount(formState.revenues.miscIncome),
    },
    spouseProfile: {
      netWages: normalizeAmount(formState.revenues.spouseNetWages),
      pensionIncome: normalizeAmount(formState.revenues.spousePensionIncome),
      hasOasiPensions: normalizeBoolean(formState.revenues.spouseHasOasiPensions),
      otherIncome: normalizeAmount(formState.revenues.spouseOtherIncome),
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
      spouseThirdPillarContribution: normalizeAmount(formState.chargesDeductions.spouseThirdPillar),
      spouseLppBuybackContribution: normalizeAmount(formState.chargesDeductions.spouseLppBuyback),
    },
    realEstateProfile: {
      properties: hasRealEstateDraft ? [realEstateDraft] : [],
    },
  }
}
