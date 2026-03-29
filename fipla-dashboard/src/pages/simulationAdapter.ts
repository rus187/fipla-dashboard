import type { PreparedSimulationData } from './simulationNormalization'

export type TargetSimulationPayload = {
  taxpayerContext: {
    taxYear: number | null
    canton: string | null
    municipality: string | null
    postalCode: string | null
    civilStatus: string | null
    dependentChildren: number | null
    taxpayerType: 'personne_physique'
  }
  declaredFinancials: {
    annualIncome: number | null
    totalWealth: number | null
    totalDebts: number | null
  }
  declaredAdjustments: {
    passiveInterest: number | null
    mainDeductions: number | null
    pillar3Contribution: number | null
    lppBuybackContribution: number | null
  }
  serverPreparation: {
    leadTaxpayer: {
      netWages: number | null
      pensionIncome: number | null
      hasOasiPensions: boolean | null
      otherIncome: number | null
      thirdPillarContribution: number | null
      lppBuybackContribution: number | null
    }
    spouseTaxpayer: {
      netWages: number | null
      pensionIncome: number | null
      hasOasiPensions: boolean | null
      otherIncome: number | null
      thirdPillarContribution: number | null
      lppBuybackContribution: number | null
    }
    assetIncome: number | null
    miscIncome: number | null
    realEstates: Array<{
      taxableValue: number | null
      rentalIncome: number | null
      effectiveExpenses: number | null
    }>
  }
  integrationHints: {
    payloadVersion: 'draft-v2'
    currency: 'CHF'
    communeCode: null
    taxationMode: null
  }
}

export const CIVIL_STATUS_TO_PARTNERSHIP = {
  'Célibataire': 'Single',
  'Marié(e)': 'Marriage',
  'Divorcé(e)': 'Single',
  'Veuf / veuve': 'Single',
} as const

type SupportedCivilStatus = keyof typeof CIVIL_STATUS_TO_PARTNERSHIP

export type ResolvedPartnership = (typeof CIVIL_STATUS_TO_PARTNERSHIP)[SupportedCivilStatus]

export type PayloadMappingItem = {
  sourceField: string
  targetField: string
  status: 'mapped' | 'missing' | 'placeholder'
  note: string
}

export type PayloadGap = {
  field: string
  reason: string
  status: 'missing'
}

export type MinimalContractStatus = 'minimal-compatible' | 'incomplete'

export type TaxwareContractUsage = 'required' | 'optional' | 'not-used' | 'deferred'

export type TaxwareFieldReadiness =
  | 'ready'
  | 'missing'
  | 'empty'
  | 'not-used'
  | 'deferred'

export type ServerFieldCoverageItem = {
  fieldName: string
  contractUsage: TaxwareContractUsage
  readiness: TaxwareFieldReadiness
  frontSource: string
  adapterMapping: string
  bridgeMapping: string
  finalDecision: string
}

export type ExistingServerInputDraft = {
  realEstates: Array<{
    taxableValue: number | null
    rentalIncome: number | null
    effectiveExpenses: number | null
  }>
  zip: string | null
  city: string | null
  year: number | null
  partnership: ResolvedPartnership | null
  childrenCount: number | null
  netWages: number | null
  pensionIncome: number | null
  hasOasiPensions: boolean | null
  otherIncome: number | null
  thirdPillar: number | null
  lppBuyback: number | null
  assetIncome: number | null
  miscIncome: number | null
  miscExpenses: number | null
  debtInterests: number | null
  spouseNetWages: number | null
  spousePensionIncome: number | null
  spouseHasOasiPensions: boolean | null
  spouseOtherIncome: number | null
  spouseThirdPillar: number | null
  spouseLppBuyback: number | null
  assets: number | null
  debts: number | null
}

export type PreparedSimulationAdapterResult = {
  targetPayload: TargetSimulationPayload
  mappingItems: PayloadMappingItem[]
  missingFields: PayloadGap[]
  serverFieldCoverage: ServerFieldCoverageItem[]
  existingServerInputDraft: ExistingServerInputDraft
  minimalContractReadiness: MinimalContractReadiness
}

export type MinimalContractReadiness = {
  status: MinimalContractStatus
  requiredFieldCount: number
  readyRequiredFieldCount: number
  missingRequiredFields: PayloadGap[]
}

function getFieldStatus(value: unknown): 'mapped' | 'missing' {
  if (value === null) {
    return 'missing'
  }

  if (Array.isArray(value)) {
    return value.length > 0 ? 'mapped' : 'missing'
  }

  return 'mapped'
}

function isValueProvided(value: unknown) {
  if (value === null || value === undefined) {
    return false
  }

  if (typeof value === 'string') {
    return value.trim().length > 0
  }

  if (Array.isArray(value)) {
    return value.length > 0
  }

  return true
}

function getReadinessForRequired(value: unknown): TaxwareFieldReadiness {
  return isValueProvided(value) ? 'ready' : 'missing'
}

function getReadinessForOptional(value: unknown): TaxwareFieldReadiness {
  return isValueProvided(value) ? 'ready' : 'empty'
}

export function resolvePartnershipFromCivilStatus(
  civilStatus: string | null
): ResolvedPartnership | null {
  if (civilStatus === null) {
    return null
  }

  return CIVIL_STATUS_TO_PARTNERSHIP[civilStatus as SupportedCivilStatus] ?? null
}

export function buildExistingServerInputDraft(
  payload: TargetSimulationPayload
): ExistingServerInputDraft {
  return {
    realEstates: payload.serverPreparation.realEstates,
    zip: payload.taxpayerContext.postalCode,
    city: payload.taxpayerContext.municipality,
    year: payload.taxpayerContext.taxYear,
    partnership: resolvePartnershipFromCivilStatus(payload.taxpayerContext.civilStatus),
    childrenCount: payload.taxpayerContext.dependentChildren,
    netWages: payload.serverPreparation.leadTaxpayer.netWages,
    pensionIncome: payload.serverPreparation.leadTaxpayer.pensionIncome,
    hasOasiPensions: payload.serverPreparation.leadTaxpayer.hasOasiPensions,
    otherIncome: payload.serverPreparation.leadTaxpayer.otherIncome,
    thirdPillar:
      payload.serverPreparation.leadTaxpayer.thirdPillarContribution ??
      payload.declaredAdjustments.pillar3Contribution,
    lppBuyback:
      payload.serverPreparation.leadTaxpayer.lppBuybackContribution ??
      payload.declaredAdjustments.lppBuybackContribution,
    assetIncome: payload.serverPreparation.assetIncome,
    miscIncome: payload.serverPreparation.miscIncome,
    miscExpenses: payload.declaredAdjustments.mainDeductions,
    debtInterests: payload.declaredAdjustments.passiveInterest,
    spouseNetWages: payload.serverPreparation.spouseTaxpayer.netWages,
    spousePensionIncome: payload.serverPreparation.spouseTaxpayer.pensionIncome,
    spouseHasOasiPensions: payload.serverPreparation.spouseTaxpayer.hasOasiPensions,
    spouseOtherIncome: payload.serverPreparation.spouseTaxpayer.otherIncome,
    spouseThirdPillar: payload.serverPreparation.spouseTaxpayer.thirdPillarContribution,
    spouseLppBuyback: payload.serverPreparation.spouseTaxpayer.lppBuybackContribution,
    assets: payload.declaredFinancials.totalWealth,
    debts: payload.declaredFinancials.totalDebts,
  }
}

function buildServerFieldCoverage(
  existingServerInputDraft: ExistingServerInputDraft
): ServerFieldCoverageItem[] {
  return [
    {
      fieldName: 'zip',
      contractUsage: 'required',
      readiness: getReadinessForRequired(existingServerInputDraft.zip),
      frontSource: 'baseParameters.npa -> simulationContext.postalCode',
      adapterMapping: 'taxpayerContext.postalCode',
      bridgeMapping: 'existingServerInputDraft.zip -> buildTaxwarePayload.zip',
      finalDecision: 'Champ requis minimum. Le NPA est transmis tel quel à Zip.',
    },
    {
      fieldName: 'city',
      contractUsage: 'required',
      readiness: getReadinessForRequired(existingServerInputDraft.city),
      frontSource: 'baseParameters.commune -> simulationContext.commune',
      adapterMapping: 'taxpayerContext.municipality',
      bridgeMapping: 'existingServerInputDraft.city -> buildTaxwarePayload.city',
      finalDecision: 'Champ requis minimum. La commune est transmise telle quelle à City.',
    },
    {
      fieldName: 'year',
      contractUsage: 'required',
      readiness: getReadinessForRequired(existingServerInputDraft.year),
      frontSource: 'baseParameters.fiscalYear -> simulationContext.fiscalYear',
      adapterMapping: 'taxpayerContext.taxYear',
      bridgeMapping: 'existingServerInputDraft.year -> buildTaxwarePayload.year',
      finalDecision: "Champ requis minimum pour verrouiller l'année de simulation transmise.",
    },
    {
      fieldName: 'partnership',
      contractUsage: 'required',
      readiness: getReadinessForRequired(existingServerInputDraft.partnership),
      frontSource: 'baseParameters.maritalStatus -> householdProfile.maritalStatus',
      adapterMapping: 'taxpayerContext.civilStatus',
      bridgeMapping: 'existingServerInputDraft.partnership -> buildTaxwarePayload.partnership',
      finalDecision:
        'Mapping explicite verrouillé: Célibataire -> Single, Marié(e) -> Marriage, Divorcé(e) -> Single, Veuf / veuve -> Single.',
    },
    {
      fieldName: 'childrenCount',
      contractUsage: 'required',
      readiness: getReadinessForRequired(existingServerInputDraft.childrenCount),
      frontSource: 'baseParameters.childrenCount -> householdProfile.dependentChildren',
      adapterMapping: 'taxpayerContext.dependentChildren',
      bridgeMapping: 'existingServerInputDraft.childrenCount -> buildTaxwarePayload.childrenCount',
      finalDecision: "Champ requis minimum. Le nombre d'enfants doit être explicite, y compris 0.",
    },
    {
      fieldName: 'netWages',
      contractUsage: 'required',
      readiness: getReadinessForRequired(existingServerInputDraft.netWages),
      frontSource: 'revenues.netWages -> incomeProfile.netWages',
      adapterMapping: 'serverPreparation.leadTaxpayer.netWages',
      bridgeMapping: 'existingServerInputDraft.netWages -> buildTaxwarePayload.netWages',
      finalDecision:
        'Champ requis minimum. annualIncome ne sert plus de fallback vers netWages afin de supprimer toute ambiguïté.',
    },
    {
      fieldName: 'thirdPillar',
      contractUsage: 'required',
      readiness: getReadinessForRequired(existingServerInputDraft.thirdPillar),
      frontSource:
        'chargesDeductions.thirdPillar -> deductionProfile.thirdPillarContribution',
      adapterMapping:
        'serverPreparation.leadTaxpayer.thirdPillarContribution + declaredAdjustments.pillar3Contribution',
      bridgeMapping: 'existingServerInputDraft.thirdPillar -> buildTaxwarePayload.thirdPillar',
      finalDecision:
        'Champ requis minimum. Le 3e pilier doit être explicite; le passthrough depuis declaredAdjustments reste strictement technique.',
    },
    {
      fieldName: 'lppBuyback',
      contractUsage: 'required',
      readiness: getReadinessForRequired(existingServerInputDraft.lppBuyback),
      frontSource:
        'chargesDeductions.lppBuyback -> deductionProfile.lppBuybackContribution',
      adapterMapping:
        'serverPreparation.leadTaxpayer.lppBuybackContribution + declaredAdjustments.lppBuybackContribution',
      bridgeMapping: 'existingServerInputDraft.lppBuyback -> buildTaxwarePayload.lppBuyback',
      finalDecision:
        'Champ requis minimum. Le rachat LPP doit être explicite; le passthrough depuis declaredAdjustments reste strictement technique.',
    },
    {
      fieldName: 'assets',
      contractUsage: 'required',
      readiness: getReadinessForRequired(existingServerInputDraft.assets),
      frontSource: 'fortune.totalWealth -> wealthProfile.totalWealth',
      adapterMapping: 'declaredFinancials.totalWealth',
      bridgeMapping: 'existingServerInputDraft.assets -> buildTaxwarePayload.assets',
      finalDecision: 'Champ requis minimum. La fortune totale alimente Assets.',
    },
    {
      fieldName: 'debts',
      contractUsage: 'required',
      readiness: getReadinessForRequired(existingServerInputDraft.debts),
      frontSource: 'debts.totalDebts -> liabilitiesProfile.totalDebts',
      adapterMapping: 'declaredFinancials.totalDebts',
      bridgeMapping: 'existingServerInputDraft.debts -> buildTaxwarePayload.debts',
      finalDecision: 'Champ requis minimum. Les dettes totales alimentent Debts.',
    },
    {
      fieldName: 'pensionIncome',
      contractUsage: 'optional',
      readiness: getReadinessForOptional(existingServerInputDraft.pensionIncome),
      frontSource: 'revenues.pensionIncome -> incomeProfile.pensionIncome',
      adapterMapping: 'serverPreparation.leadTaxpayer.pensionIncome',
      bridgeMapping: 'existingServerInputDraft.pensionIncome -> buildTaxwarePayload.pensionIncome',
      finalDecision: 'Champ optionnel assumé. Le laisser vide ne bloque pas le fallback sécurisé.',
    },
    {
      fieldName: 'hasOasiPensions',
      contractUsage: 'optional',
      readiness: getReadinessForOptional(existingServerInputDraft.hasOasiPensions),
      frontSource: 'revenues.hasOasiPensions -> incomeProfile.hasOasiPensions',
      adapterMapping: 'serverPreparation.leadTaxpayer.hasOasiPensions',
      bridgeMapping:
        'existingServerInputDraft.hasOasiPensions -> buildTaxwarePayload.hasOasiPensions',
      finalDecision:
        'Champ optionnel assumé. Le booléen est technique et ne déclenche aucun calcul réel ici.',
    },
    {
      fieldName: 'otherIncome',
      contractUsage: 'optional',
      readiness: getReadinessForOptional(existingServerInputDraft.otherIncome),
      frontSource: 'revenues.otherIncome -> incomeProfile.otherIncome',
      adapterMapping: 'serverPreparation.leadTaxpayer.otherIncome',
      bridgeMapping: 'existingServerInputDraft.otherIncome -> buildTaxwarePayload.otherIncome',
      finalDecision: 'Champ optionnel assumé pour éviter toute valeur implicite.',
    },
    {
      fieldName: 'assetIncome',
      contractUsage: 'optional',
      readiness: getReadinessForOptional(existingServerInputDraft.assetIncome),
      frontSource: 'revenues.assetIncome -> incomeProfile.assetIncome',
      adapterMapping: 'serverPreparation.assetIncome',
      bridgeMapping: 'existingServerInputDraft.assetIncome -> buildTaxwarePayload.assetIncome',
      finalDecision: 'Champ optionnel assumé. Utilisé seulement si renseigné explicitement.',
    },
    {
      fieldName: 'miscIncome',
      contractUsage: 'optional',
      readiness: getReadinessForOptional(existingServerInputDraft.miscIncome),
      frontSource: 'revenues.miscIncome -> incomeProfile.miscIncome',
      adapterMapping: 'serverPreparation.miscIncome',
      bridgeMapping: 'existingServerInputDraft.miscIncome -> buildTaxwarePayload.miscIncome',
      finalDecision: 'Champ optionnel assumé. Utilisé seulement si renseigné explicitement.',
    },
    {
      fieldName: 'miscExpenses',
      contractUsage: 'optional',
      readiness: getReadinessForOptional(existingServerInputDraft.miscExpenses),
      frontSource:
        'chargesDeductions.mainDeductions -> deductionProfile.mainDeductions',
      adapterMapping: 'declaredAdjustments.mainDeductions',
      bridgeMapping:
        'existingServerInputDraft.miscExpenses -> buildTaxwarePayload.miscExpenses',
      finalDecision:
        'Champ optionnel assumé. Le montant est passé tel quel vers MiscExpenses à ce stade, sans lecture fiscale supplémentaire.',
    },
    {
      fieldName: 'debtInterests',
      contractUsage: 'optional',
      readiness: getReadinessForOptional(existingServerInputDraft.debtInterests),
      frontSource:
        'chargesDeductions.passiveInterest -> deductionProfile.passiveInterest',
      adapterMapping: 'declaredAdjustments.passiveInterest',
      bridgeMapping:
        'existingServerInputDraft.debtInterests -> buildTaxwarePayload.debtInterests',
      finalDecision: 'Champ optionnel assumé. Les intérêts passifs sont transférés tels quels.',
    },
    {
      fieldName: 'spouseNetWages',
      contractUsage: 'optional',
      readiness: getReadinessForOptional(existingServerInputDraft.spouseNetWages),
      frontSource: 'revenues.spouseNetWages -> spouseProfile.netWages',
      adapterMapping: 'serverPreparation.spouseTaxpayer.netWages',
      bridgeMapping:
        'existingServerInputDraft.spouseNetWages -> buildTaxwarePayload.spouseNetWages',
      finalDecision:
        'Champ optionnel assumé. Consommé seulement lorsque partnership vaut Marriage.',
    },
    {
      fieldName: 'spousePensionIncome',
      contractUsage: 'optional',
      readiness: getReadinessForOptional(existingServerInputDraft.spousePensionIncome),
      frontSource: 'revenues.spousePensionIncome -> spouseProfile.pensionIncome',
      adapterMapping: 'serverPreparation.spouseTaxpayer.pensionIncome',
      bridgeMapping:
        'existingServerInputDraft.spousePensionIncome -> buildTaxwarePayload.spousePensionIncome',
      finalDecision:
        'Champ optionnel assumé. Consommé seulement lorsque partnership vaut Marriage.',
    },
    {
      fieldName: 'spouseHasOasiPensions',
      contractUsage: 'optional',
      readiness: getReadinessForOptional(existingServerInputDraft.spouseHasOasiPensions),
      frontSource:
        'revenues.spouseHasOasiPensions -> spouseProfile.hasOasiPensions',
      adapterMapping: 'serverPreparation.spouseTaxpayer.hasOasiPensions',
      bridgeMapping:
        'existingServerInputDraft.spouseHasOasiPensions -> buildTaxwarePayload.spouseHasOasiPensions',
      finalDecision:
        'Champ optionnel assumé. Consommé seulement lorsque partnership vaut Marriage.',
    },
    {
      fieldName: 'spouseOtherIncome',
      contractUsage: 'optional',
      readiness: getReadinessForOptional(existingServerInputDraft.spouseOtherIncome),
      frontSource: 'revenues.spouseOtherIncome -> spouseProfile.otherIncome',
      adapterMapping: 'serverPreparation.spouseTaxpayer.otherIncome',
      bridgeMapping:
        'existingServerInputDraft.spouseOtherIncome -> buildTaxwarePayload.spouseOtherIncome',
      finalDecision:
        'Champ optionnel assumé. Consommé seulement lorsque partnership vaut Marriage.',
    },
    {
      fieldName: 'spouseThirdPillar',
      contractUsage: 'optional',
      readiness: getReadinessForOptional(existingServerInputDraft.spouseThirdPillar),
      frontSource:
        'chargesDeductions.spouseThirdPillar -> deductionProfile.spouseThirdPillarContribution',
      adapterMapping: 'serverPreparation.spouseTaxpayer.thirdPillarContribution',
      bridgeMapping:
        'existingServerInputDraft.spouseThirdPillar -> buildTaxwarePayload.spouseThirdPillar',
      finalDecision:
        'Champ optionnel assumé. Consommé seulement lorsque partnership vaut Marriage.',
    },
    {
      fieldName: 'spouseLppBuyback',
      contractUsage: 'optional',
      readiness: getReadinessForOptional(existingServerInputDraft.spouseLppBuyback),
      frontSource:
        'chargesDeductions.spouseLppBuyback -> deductionProfile.spouseLppBuybackContribution',
      adapterMapping: 'serverPreparation.spouseTaxpayer.lppBuybackContribution',
      bridgeMapping:
        'existingServerInputDraft.spouseLppBuyback -> buildTaxwarePayload.spouseLppBuyback',
      finalDecision:
        'Champ optionnel assumé. Consommé seulement lorsque partnership vaut Marriage.',
    },
    {
      fieldName: 'realEstates',
      contractUsage: 'optional',
      readiness: getReadinessForOptional(existingServerInputDraft.realEstates),
      frontSource:
        'realEstate.taxableValue/rentalIncome/effectiveExpenses -> realEstateProfile.properties',
      adapterMapping: 'serverPreparation.realEstates',
      bridgeMapping:
        'existingServerInputDraft.realEstates -> buildTaxwarePayload.realEstates',
      finalDecision:
        'Champ optionnel assumé. Le tableau immobilier n’est transmis que si le brouillon est saisi.',
    },
    {
      fieldName: 'annualIncome',
      contractUsage: 'not-used',
      readiness: 'not-used',
      frontSource: 'revenues.annualIncome -> incomeProfile.annualIncome',
      adapterMapping: 'declaredFinancials.annualIncome',
      bridgeMapping: 'non transmis au brouillon serveur minimal',
      finalDecision:
        'Champ non utilisé à ce stade pour buildTaxwarePayload. Conservé uniquement comme agrégat front tant que netWages est saisi séparément.',
    },
    {
      fieldName: 'canton',
      contractUsage: 'not-used',
      readiness: 'not-used',
      frontSource: 'baseParameters.canton -> simulationContext.canton',
      adapterMapping: 'taxpayerContext.canton',
      bridgeMapping: 'non transmis au brouillon serveur minimal',
      finalDecision:
        'Champ non utilisé à ce stade par buildTaxwarePayload, mais conservé dans le contexte front.',
    },
    {
      fieldName: 'communeCode',
      contractUsage: 'deferred',
      readiness: 'deferred',
      frontSource: 'aucune source front active',
      adapterMapping: 'integrationHints.communeCode',
      bridgeMapping: 'non transmis au brouillon serveur minimal',
      finalDecision:
        'Champ explicitement différé. Non consommé par buildTaxwarePayload dans cette étape préparatoire.',
    },
    {
      fieldName: 'taxationMode',
      contractUsage: 'deferred',
      readiness: 'deferred',
      frontSource: 'aucune source front active',
      adapterMapping: 'integrationHints.taxationMode',
      bridgeMapping: 'non transmis au brouillon serveur minimal',
      finalDecision:
        'Champ explicitement différé. Non consommé par buildTaxwarePayload dans cette étape préparatoire.',
    },
  ]
}

export function buildMinimalContractReadiness(
  serverFieldCoverage: ServerFieldCoverageItem[]
): MinimalContractReadiness {
  const requiredCoverage = serverFieldCoverage.filter((item) => item.contractUsage === 'required')
  const missingRequiredFields: PayloadGap[] = requiredCoverage
    .filter(
      (item): item is ServerFieldCoverageItem & { readiness: 'missing'; contractUsage: 'required' } =>
        item.readiness === 'missing'
    )
    .map((item) => ({
      field: `buildTaxwarePayload.${item.fieldName}`,
      reason: item.finalDecision,
      status: 'missing',
    }))

  return {
    status: missingRequiredFields.length === 0 ? 'minimal-compatible' : 'incomplete',
    requiredFieldCount: requiredCoverage.length,
    readyRequiredFieldCount: requiredCoverage.length - missingRequiredFields.length,
    missingRequiredFields,
  }
}

export function buildMinimalContractReadinessFromDraft(
  existingServerInputDraft: ExistingServerInputDraft
) {
  return buildMinimalContractReadiness(buildServerFieldCoverage(existingServerInputDraft))
}

export function buildMinimalContractReadinessFromPayload(payload: TargetSimulationPayload) {
  return buildMinimalContractReadinessFromDraft(buildExistingServerInputDraft(payload))
}

export function adaptPreparedSimulationToTargetPayload(
  preparedSimulation: PreparedSimulationData
): PreparedSimulationAdapterResult {
  const targetPayload: TargetSimulationPayload = {
    taxpayerContext: {
      taxYear: preparedSimulation.simulationContext.fiscalYear,
      canton: preparedSimulation.simulationContext.canton,
      municipality: preparedSimulation.simulationContext.commune,
      postalCode: preparedSimulation.simulationContext.postalCode,
      civilStatus: preparedSimulation.householdProfile.maritalStatus,
      dependentChildren: preparedSimulation.householdProfile.dependentChildren,
      taxpayerType: 'personne_physique',
    },
    declaredFinancials: {
      annualIncome: preparedSimulation.incomeProfile.annualIncome,
      totalWealth: preparedSimulation.wealthProfile.totalWealth,
      totalDebts: preparedSimulation.liabilitiesProfile.totalDebts,
    },
    declaredAdjustments: {
      passiveInterest: preparedSimulation.deductionProfile.passiveInterest,
      mainDeductions: preparedSimulation.deductionProfile.mainDeductions,
      pillar3Contribution: preparedSimulation.deductionProfile.thirdPillarContribution,
      lppBuybackContribution: preparedSimulation.deductionProfile.lppBuybackContribution,
    },
    serverPreparation: {
      leadTaxpayer: {
        netWages: preparedSimulation.incomeProfile.netWages,
        pensionIncome: preparedSimulation.incomeProfile.pensionIncome,
        hasOasiPensions: preparedSimulation.incomeProfile.hasOasiPensions,
        otherIncome: preparedSimulation.incomeProfile.otherIncome,
        thirdPillarContribution: preparedSimulation.deductionProfile.thirdPillarContribution,
        lppBuybackContribution: preparedSimulation.deductionProfile.lppBuybackContribution,
      },
      spouseTaxpayer: {
        netWages: preparedSimulation.spouseProfile.netWages,
        pensionIncome: preparedSimulation.spouseProfile.pensionIncome,
        hasOasiPensions: preparedSimulation.spouseProfile.hasOasiPensions,
        otherIncome: preparedSimulation.spouseProfile.otherIncome,
        thirdPillarContribution: preparedSimulation.deductionProfile.spouseThirdPillarContribution,
        lppBuybackContribution: preparedSimulation.deductionProfile.spouseLppBuybackContribution,
      },
      assetIncome: preparedSimulation.incomeProfile.assetIncome,
      miscIncome: preparedSimulation.incomeProfile.miscIncome,
      realEstates: preparedSimulation.realEstateProfile.properties,
    },
    integrationHints: {
      payloadVersion: 'draft-v2',
      currency: 'CHF',
      communeCode: null,
      taxationMode: null,
    },
  }

  const existingServerInputDraft = buildExistingServerInputDraft(targetPayload)

  const mappingItems: PayloadMappingItem[] = [
    {
      sourceField: 'simulationContext.fiscalYear',
      targetField: 'taxpayerContext.taxYear',
      status: getFieldStatus(targetPayload.taxpayerContext.taxYear),
      note: 'Année fiscale prête pour un raccordement futur.',
    },
    {
      sourceField: 'simulationContext.canton',
      targetField: 'taxpayerContext.canton',
      status: getFieldStatus(targetPayload.taxpayerContext.canton),
      note: 'Canton transmis tel quel depuis l’objet préparé.',
    },
    {
      sourceField: 'simulationContext.commune',
      targetField: 'taxpayerContext.municipality',
      status: getFieldStatus(targetPayload.taxpayerContext.municipality),
      note: 'Commune métier transmise telle quelle à la couche serveur.',
    },
    {
      sourceField: 'simulationContext.postalCode',
      targetField: 'taxpayerContext.postalCode',
      status: getFieldStatus(targetPayload.taxpayerContext.postalCode),
      note: 'NPA transmis lorsque disponible dans le formulaire.',
    },
    {
      sourceField: 'householdProfile.maritalStatus',
      targetField: 'taxpayerContext.civilStatus',
      status: getFieldStatus(targetPayload.taxpayerContext.civilStatus),
      note: 'Statut civil conservé pour un mapping partnership désormais explicite.',
    },
    {
      sourceField: 'householdProfile.dependentChildren',
      targetField: 'taxpayerContext.dependentChildren',
      status: getFieldStatus(targetPayload.taxpayerContext.dependentChildren),
      note: "Nombre d'enfants déjà prêt côté adaptation.",
    },
    {
      sourceField: 'constant',
      targetField: 'taxpayerContext.taxpayerType',
      status: 'placeholder',
      note: 'Valeur de contexte front conservée, non utilisée par buildTaxwarePayload.',
    },
    {
      sourceField: 'incomeProfile.annualIncome',
      targetField: 'declaredFinancials.annualIncome',
      status: getFieldStatus(targetPayload.declaredFinancials.annualIncome),
      note: 'Agrégat front conservé, mais non utilisé pour le contrat minimal serveur.',
    },
    {
      sourceField: 'incomeProfile.netWages',
      targetField: 'serverPreparation.leadTaxpayer.netWages',
      status: getFieldStatus(targetPayload.serverPreparation.leadTaxpayer.netWages),
      note: 'Revenu salarial principal explicitement séparé pour le contrat minimal serveur.',
    },
    {
      sourceField: 'incomeProfile.pensionIncome',
      targetField: 'serverPreparation.leadTaxpayer.pensionIncome',
      status: getFieldStatus(targetPayload.serverPreparation.leadTaxpayer.pensionIncome),
      note: 'Pensions du déclarant principal désormais préparées localement.',
    },
    {
      sourceField: 'incomeProfile.hasOasiPensions',
      targetField: 'serverPreparation.leadTaxpayer.hasOasiPensions',
      status: getFieldStatus(targetPayload.serverPreparation.leadTaxpayer.hasOasiPensions),
      note: 'Indicateur AVS/OASI du déclarant principal ajouté au payload cible.',
    },
    {
      sourceField: 'incomeProfile.otherIncome',
      targetField: 'serverPreparation.leadTaxpayer.otherIncome',
      status: getFieldStatus(targetPayload.serverPreparation.leadTaxpayer.otherIncome),
      note: 'Autres revenus du déclarant principal désormais distincts.',
    },
    {
      sourceField: 'incomeProfile.assetIncome',
      targetField: 'serverPreparation.assetIncome',
      status: getFieldStatus(targetPayload.serverPreparation.assetIncome),
      note: 'Rendement du patrimoine préparé pour le payload serveur existant.',
    },
    {
      sourceField: 'incomeProfile.miscIncome',
      targetField: 'serverPreparation.miscIncome',
      status: getFieldStatus(targetPayload.serverPreparation.miscIncome),
      note: 'Revenus divers désormais disponibles pour le pont serveur.',
    },
    {
      sourceField: 'spouseProfile.netWages',
      targetField: 'serverPreparation.spouseTaxpayer.netWages',
      status: getFieldStatus(targetPayload.serverPreparation.spouseTaxpayer.netWages),
      note: 'Revenu salarial du conjoint ajouté pour les dossiers Marriage.',
    },
    {
      sourceField: 'spouseProfile.pensionIncome',
      targetField: 'serverPreparation.spouseTaxpayer.pensionIncome',
      status: getFieldStatus(targetPayload.serverPreparation.spouseTaxpayer.pensionIncome),
      note: 'Pensions du conjoint désormais préparées localement.',
    },
    {
      sourceField: 'spouseProfile.hasOasiPensions',
      targetField: 'serverPreparation.spouseTaxpayer.hasOasiPensions',
      status: getFieldStatus(targetPayload.serverPreparation.spouseTaxpayer.hasOasiPensions),
      note: 'Indicateur AVS/OASI du conjoint ajouté au payload cible.',
    },
    {
      sourceField: 'spouseProfile.otherIncome',
      targetField: 'serverPreparation.spouseTaxpayer.otherIncome',
      status: getFieldStatus(targetPayload.serverPreparation.spouseTaxpayer.otherIncome),
      note: 'Autres revenus du conjoint désormais prévus côté page.',
    },
    {
      sourceField: 'wealthProfile.totalWealth',
      targetField: 'declaredFinancials.totalWealth',
      status: getFieldStatus(targetPayload.declaredFinancials.totalWealth),
      note: 'Fortune totale conservée pour la future intégration.',
    },
    {
      sourceField: 'liabilitiesProfile.totalDebts',
      targetField: 'declaredFinancials.totalDebts',
      status: getFieldStatus(targetPayload.declaredFinancials.totalDebts),
      note: 'Dettes totales prêtes à être transmises.',
    },
    {
      sourceField: 'deductionProfile.passiveInterest',
      targetField: 'declaredAdjustments.passiveInterest',
      status: getFieldStatus(targetPayload.declaredAdjustments.passiveInterest),
      note: 'Intérêts passifs transférés en l’état.',
    },
    {
      sourceField: 'deductionProfile.mainDeductions',
      targetField: 'declaredAdjustments.mainDeductions',
      status: getFieldStatus(targetPayload.declaredAdjustments.mainDeductions),
      note: 'Déductions principales conservées comme montant brut côté front.',
    },
    {
      sourceField: 'deductionProfile.thirdPillarContribution',
      targetField: 'declaredAdjustments.pillar3Contribution',
      status: getFieldStatus(targetPayload.declaredAdjustments.pillar3Contribution),
      note: '3e pilier transmis au format cible.',
    },
    {
      sourceField: 'deductionProfile.thirdPillarContribution',
      targetField: 'serverPreparation.leadTaxpayer.thirdPillarContribution',
      status: getFieldStatus(targetPayload.serverPreparation.leadTaxpayer.thirdPillarContribution),
      note: '3e pilier principal dupliqué dans la zone de préparation serveur.',
    },
    {
      sourceField: 'deductionProfile.lppBuybackContribution',
      targetField: 'declaredAdjustments.lppBuybackContribution',
      status: getFieldStatus(targetPayload.declaredAdjustments.lppBuybackContribution),
      note: 'Rachat LPP transmis au format cible.',
    },
    {
      sourceField: 'deductionProfile.lppBuybackContribution',
      targetField: 'serverPreparation.leadTaxpayer.lppBuybackContribution',
      status: getFieldStatus(targetPayload.serverPreparation.leadTaxpayer.lppBuybackContribution),
      note: 'Rachat LPP principal dupliqué dans la zone de préparation serveur.',
    },
    {
      sourceField: 'deductionProfile.spouseThirdPillarContribution',
      targetField: 'serverPreparation.spouseTaxpayer.thirdPillarContribution',
      status: getFieldStatus(
        targetPayload.serverPreparation.spouseTaxpayer.thirdPillarContribution
      ),
      note: '3e pilier conjoint ajouté pour la compatibilité Marriage.',
    },
    {
      sourceField: 'deductionProfile.spouseLppBuybackContribution',
      targetField: 'serverPreparation.spouseTaxpayer.lppBuybackContribution',
      status: getFieldStatus(
        targetPayload.serverPreparation.spouseTaxpayer.lppBuybackContribution
      ),
      note: 'Rachat LPP conjoint ajouté pour la compatibilité Marriage.',
    },
    {
      sourceField: 'realEstateProfile.properties',
      targetField: 'serverPreparation.realEstates',
      status: getFieldStatus(targetPayload.serverPreparation.realEstates),
      note: 'Bloc immobilier préparé sous forme de tableau compatible avec buildTaxwarePayload.',
    },
    {
      sourceField: 'constant',
      targetField: 'integrationHints.currency',
      status: 'placeholder',
      note: 'Devise fixée à CHF pour le brouillon local.',
    },
    {
      sourceField: 'différé',
      targetField: 'integrationHints.communeCode',
      status: 'placeholder',
      note: 'Champ différé explicitement, non utilisé à ce stade.',
    },
    {
      sourceField: 'différé',
      targetField: 'integrationHints.taxationMode',
      status: 'placeholder',
      note: 'Champ différé explicitement, non utilisé à ce stade.',
    },
  ]

  const serverFieldCoverage = buildServerFieldCoverage(existingServerInputDraft)
  const minimalContractReadiness = buildMinimalContractReadiness(serverFieldCoverage)
  const missingFields = minimalContractReadiness.missingRequiredFields

  return {
    targetPayload,
    mappingItems,
    missingFields,
    serverFieldCoverage,
    existingServerInputDraft,
    minimalContractReadiness,
  }
}
