import {
  buildMinimalContractReadinessFromPayload,
  type TargetSimulationPayload,
} from './simulationAdapter'

export const MOCK_SIMULATION_ROUTE_PATH = '/api/simulation-fiscale/mock'

export type SimulationBridgeCompatibility = {
  status: 'compatible' | 'partial' | 'fallback-mock'
  missingRequirements: string[]
  mappedFields: Array<{
    source: string
    target: string
    note: string
  }>
}

export type MockSimulationServiceResponse = {
  execution: {
    mode: 'internal-api-mock' | 'server-logic-fallback-mock' | 'server-logic-existing'
    status: 'response-ready'
    routePath: typeof MOCK_SIMULATION_ROUTE_PATH
    respondedAtLabel: string
    noRealCallExecuted: boolean
    message: string
  }
  serviceSummary: {
    transport: 'Front -> API interne -> réponse'
    payloadStatus: 'Payload local reçu'
    responseStatus: string
    engineConnection: string
  }
  mockedResults: {
    totalTaxEstimate: string
    incomeFortuneReading: string
    scenarioComparison: string
    restitutionSummary: string
  }
  processingNotes: string[]
  bridge: {
    compatibility: SimulationBridgeCompatibility
    serverInput: Record<string, unknown> | null
    normalizedResponse: Record<string, unknown> | null
    fallbackReason: string | null
  }
}

function getCurrentTimestampLabel() {
  return new Intl.DateTimeFormat('fr-CH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date())
}

function buildLocationLabel(payload: TargetSimulationPayload) {
  const locationParts = [
    payload.taxpayerContext.canton,
    payload.taxpayerContext.municipality,
    payload.taxpayerContext.postalCode,
  ].filter((value): value is string => value !== null)

  return locationParts.length > 0 ? locationParts.join(' / ') : 'localisation à confirmer'
}

function buildInputReadinessLabel(payload: TargetSimulationPayload) {
  const minimalContractReadiness = buildMinimalContractReadinessFromPayload(payload)

  if (minimalContractReadiness.status === 'minimal-compatible') {
    return `Le dossier remplit ${minimalContractReadiness.readyRequiredFieldCount}/${minimalContractReadiness.requiredFieldCount} champs requis du contrat minimal et reste en fallback sécurisé tant que l’opt-in serveur réel est désactivé.`
  }

  return `Le dossier remplit ${minimalContractReadiness.readyRequiredFieldCount}/${minimalContractReadiness.requiredFieldCount} champs requis du contrat minimal; des données obligatoires restent absentes pour une entrée buildTaxwarePayload complète.`
}

export function buildFallbackMockSimulationResponse(params: {
  compatibility: SimulationBridgeCompatibility
  fallbackReason: string
  payload: TargetSimulationPayload
  serverInput: Record<string, unknown> | null
}): MockSimulationServiceResponse {
  const { compatibility, fallbackReason, payload, serverInput } = params

  return {
    execution: {
      mode: 'server-logic-fallback-mock',
      status: 'response-ready',
      routePath: MOCK_SIMULATION_ROUTE_PATH,
      respondedAtLabel: getCurrentTimestampLabel(),
      noRealCallExecuted: true,
      message:
        'La route interne est branchée sur la couche serveur existante, mais la réponse courante reste sécurisée par un fallback mock.',
    },
    serviceSummary: {
      transport: 'Front -> API interne -> réponse',
      payloadStatus: 'Payload local reçu',
      responseStatus: 'Fallback mock sécurisé généré',
      engineConnection: 'Logique serveur existante préparée, fallback actif',
    },
    mockedResults: {
      totalTaxEstimate: 'Fallback serveur actif, sans calcul fiscal réel',
      incomeFortuneReading: buildInputReadinessLabel(payload),
      scenarioComparison: 'Comparaison simulée conservée tant que le branchement serveur réel reste partiel.',
      restitutionSummary: `La route interne prépare le raccordement serveur pour un dossier orienté ${buildLocationLabel(payload)}.`,
    },
    processingNotes: [
      `Le payload a transité par la route interne ${MOCK_SIMULATION_ROUTE_PATH} sans quitter l’environnement local.`,
      fallbackReason,
      'La structure de réponse reste compatible avec le front actuel pour sécuriser la transition côté serveur.',
    ],
    bridge: {
      compatibility: {
        ...compatibility,
        status: compatibility.status === 'compatible' ? 'fallback-mock' : compatibility.status,
      },
      serverInput,
      normalizedResponse: null,
      fallbackReason,
    },
  }
}
