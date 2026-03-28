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
  integrationHints: {
    payloadVersion: 'draft-v1'
    currency: 'CHF'
    communeCode: null
    taxationMode: null
  }
}

export type PayloadMappingItem = {
  sourceField: string
  targetField: string
  status: 'mapped' | 'missing' | 'placeholder'
  note: string
}

export type PayloadGap = {
  field: string
  reason: string
}

export type PreparedSimulationAdapterResult = {
  targetPayload: TargetSimulationPayload
  mappingItems: PayloadMappingItem[]
  missingFields: PayloadGap[]
}

function getFieldStatus(value: number | string | null): 'mapped' | 'missing' {
  return value === null ? 'missing' : 'mapped'
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
    integrationHints: {
      payloadVersion: 'draft-v1',
      currency: 'CHF',
      communeCode: null,
      taxationMode: null,
    },
  }

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
      note: 'Commune métier à confirmer ou compléter si absente.',
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
      note: 'Statut civil conservé pour le futur moteur.',
    },
    {
      sourceField: 'householdProfile.dependentChildren',
      targetField: 'taxpayerContext.dependentChildren',
      status: getFieldStatus(targetPayload.taxpayerContext.dependentChildren),
      note: 'Nombre d’enfants déjà prêt côté adaptation.',
    },
    {
      sourceField: 'constant',
      targetField: 'taxpayerContext.taxpayerType',
      status: 'placeholder',
      note: 'Valeur provisoire fixée à personne physique pour cette étape.',
    },
    {
      sourceField: 'incomeProfile.annualIncome',
      targetField: 'declaredFinancials.annualIncome',
      status: getFieldStatus(targetPayload.declaredFinancials.annualIncome),
      note: 'Revenus annuels transmis au payload cible.',
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
      note: 'Déductions principales prêtes pour un futur raccordement.',
    },
    {
      sourceField: 'deductionProfile.thirdPillarContribution',
      targetField: 'declaredAdjustments.pillar3Contribution',
      status: getFieldStatus(targetPayload.declaredAdjustments.pillar3Contribution),
      note: '3e pilier transmis au format cible.',
    },
    {
      sourceField: 'deductionProfile.lppBuybackContribution',
      targetField: 'declaredAdjustments.lppBuybackContribution',
      status: getFieldStatus(targetPayload.declaredAdjustments.lppBuybackContribution),
      note: 'Rachat LPP transmis au format cible.',
    },
    {
      sourceField: 'constant',
      targetField: 'integrationHints.currency',
      status: 'placeholder',
      note: 'Devise fixée à CHF pour le brouillon local.',
    },
    {
      sourceField: 'à confirmer',
      targetField: 'integrationHints.communeCode',
      status: 'placeholder',
      note: 'Code commune absent du formulaire actuel, à confirmer avant intégration.',
    },
    {
      sourceField: 'à confirmer',
      targetField: 'integrationHints.taxationMode',
      status: 'placeholder',
      note: 'Mode de taxation futur encore à préciser.',
    },
  ]

  const missingFields: PayloadGap[] = []

  if (targetPayload.taxpayerContext.municipality === null) {
    missingFields.push({
      field: 'taxpayerContext.municipality',
      reason: 'La commune n’est pas encore renseignée dans le formulaire actuel.',
    })
  }

  if (targetPayload.taxpayerContext.postalCode === null) {
    missingFields.push({
      field: 'taxpayerContext.postalCode',
      reason: 'Le NPA n’est pas encore renseigné dans le formulaire actuel.',
    })
  }

  if (targetPayload.declaredFinancials.annualIncome === null) {
    missingFields.push({
      field: 'declaredFinancials.annualIncome',
      reason: 'Le revenu consolidé reste à saisir ou confirmer.',
    })
  }

  if (targetPayload.integrationHints.communeCode === null) {
    missingFields.push({
      field: 'integrationHints.communeCode',
      reason: 'Un identifiant de commune ou code officiel sera à définir pour le raccordement final.',
    })
  }

  if (targetPayload.integrationHints.taxationMode === null) {
    missingFields.push({
      field: 'integrationHints.taxationMode',
      reason: 'Le mode de taxation attendu par le moteur n’est pas encore confirmé.',
    })
  }

  return {
    targetPayload,
    mappingItems,
    missingFields,
  }
}
