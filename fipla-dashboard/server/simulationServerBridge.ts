import { buildTaxwarePayload } from '../../src/lib/taxware/buildTaxwarePayload'
import { normalizeTaxwareResponse } from '../../src/lib/taxware/normalizeTaxwareResponse.ts'
import type { TargetSimulationPayload } from '../src/pages/simulationAdapter'
import {
  buildFallbackMockSimulationResponse,
  MOCK_SIMULATION_ROUTE_PATH,
  type MockSimulationServiceResponse,
  type SimulationBridgeCompatibility,
} from '../src/pages/simulationMockEngine'

type ExistingServerInput = Parameters<typeof buildTaxwarePayload>[0]

const DEFAULT_TAXWARE_PROXY_URL = 'http://127.0.0.1:3001/api/taxware/simulate'

function mapCivilStatusToPartnership(civilStatus: string | null): 'Marriage' | 'Single' {
  return civilStatus === 'Marié(e)' ? 'Marriage' : 'Single'
}

function formatCurrency(value: number | null) {
  if (value === null) {
    return 'Réponse serveur reçue, montant non disponible'
  }

  return `${new Intl.NumberFormat('fr-CH').format(Math.round(value))} CHF`
}

function buildCompatibilityReport(
  payload: TargetSimulationPayload
): {
  compatibility: SimulationBridgeCompatibility
  existingServerInput: ExistingServerInput
} {
  const missingRequirements: string[] = []

  if (!payload.taxpayerContext.postalCode) {
    missingRequirements.push('Le NPA est requis pour le branchement serveur existant.')
  }

  if (!payload.taxpayerContext.municipality) {
    missingRequirements.push('La commune est requise pour le branchement serveur existant.')
  }

  if (payload.taxpayerContext.taxYear === null) {
    missingRequirements.push("L'année fiscale est requise pour le branchement serveur existant.")
  }

  const compatibilityStatus: SimulationBridgeCompatibility['status'] =
    missingRequirements.length === 0 ? 'compatible' : 'partial'

  return {
    compatibility: {
      status: compatibilityStatus,
      missingRequirements,
      mappedFields: [
        {
          source: 'taxpayerContext.postalCode',
          target: 'buildTaxwarePayload.zip',
          note: 'Le NPA est transmis tel quel à la logique serveur existante.',
        },
        {
          source: 'taxpayerContext.municipality',
          target: 'buildTaxwarePayload.city',
          note: 'La commune est utilisée comme ville fiscale côté serveur.',
        },
        {
          source: 'taxpayerContext.civilStatus',
          target: 'buildTaxwarePayload.partnership',
          note: 'Marié(e) devient Marriage, les autres statuts basculent en Single à ce stade.',
        },
        {
          source: 'declaredFinancials.annualIncome',
          target: 'buildTaxwarePayload.netWages',
          note: 'Le revenu agrégé actuel est mappé provisoirement sur le revenu principal serveur.',
        },
        {
          source: 'declaredFinancials.totalWealth',
          target: 'buildTaxwarePayload.assets',
          note: 'La fortune totale alimente la base Assets existante.',
        },
        {
          source: 'declaredFinancials.totalDebts',
          target: 'buildTaxwarePayload.debts',
          note: 'Les dettes totales alimentent le champ Debts existant.',
        },
        {
          source: 'declaredAdjustments.passiveInterest',
          target: 'buildTaxwarePayload.debtInterests',
          note: 'Les intérêts passifs sont transférés vers DebtInterests côté serveur.',
        },
        {
          source: 'declaredAdjustments.mainDeductions',
          target: 'buildTaxwarePayload.miscExpenses',
          note: 'Les déductions principales sont regroupées provisoirement en MiscExpenses.',
        },
      ],
    },
    existingServerInput: {
      realEstates: [],
      zip: payload.taxpayerContext.postalCode ?? '',
      city: payload.taxpayerContext.municipality ?? '',
      year: payload.taxpayerContext.taxYear ?? 2026,
      partnership: mapCivilStatusToPartnership(payload.taxpayerContext.civilStatus),
      childrenCount: payload.taxpayerContext.dependentChildren ?? 0,
      netWages: payload.declaredFinancials.annualIncome ?? 0,
      pensionIncome: 0,
      hasOasiPensions: false,
      otherIncome: 0,
      thirdPillar: payload.declaredAdjustments.pillar3Contribution ?? 0,
      lppBuyback: payload.declaredAdjustments.lppBuybackContribution ?? 0,
      assetIncome: 0,
      miscIncome: 0,
      miscExpenses: payload.declaredAdjustments.mainDeductions ?? 0,
      debtInterests: payload.declaredAdjustments.passiveInterest ?? 0,
      spouseNetWages: 0,
      spousePensionIncome: 0,
      spouseHasOasiPensions: false,
      spouseOtherIncome: 0,
      spouseThirdPillar: 0,
      spouseLppBuyback: 0,
      assets: payload.declaredFinancials.totalWealth ?? 0,
      debts: payload.declaredFinancials.totalDebts ?? 0,
    },
  }
}

function isExistingServerExecutionEnabled() {
  return process.env.FIPLA_ENABLE_EXISTING_TAXWARE_ROUTE === 'true'
}

async function callExistingServerTaxware(existingServerInput: ExistingServerInput) {
  const taxwarePayload = buildTaxwarePayload(existingServerInput)
  const proxyUrl = process.env.FIPLA_TAXWARE_PROXY_URL?.trim() || DEFAULT_TAXWARE_PROXY_URL

  const response = await fetch(proxyUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(taxwarePayload),
  })

  const text = await response.text()
  const parsedResponse = text ? (JSON.parse(text) as Record<string, unknown>) : null

  if (!response.ok) {
    throw new Error(
      `La logique serveur existante a répondu avec le statut ${response.status} via ${proxyUrl}.`
    )
  }

  return {
    taxwarePayload,
    parsedResponse,
    normalizedResponse: normalizeTaxwareResponse(parsedResponse),
  }
}

export async function executeSimulationThroughServerBridge(
  payload: TargetSimulationPayload
): Promise<MockSimulationServiceResponse> {
  const { compatibility, existingServerInput } = buildCompatibilityReport(payload)

  if (compatibility.missingRequirements.length > 0) {
    return buildFallbackMockSimulationResponse({
      compatibility,
      fallbackReason:
        'Le payload actuel ne contient pas encore tous les champs requis par la logique serveur existante.',
      payload,
      serverInput: existingServerInput as Record<string, unknown>,
    })
  }

  if (!isExistingServerExecutionEnabled()) {
    return buildFallbackMockSimulationResponse({
      compatibility,
      fallbackReason:
        "Le branchement vers la logique serveur existante est prêt, mais l'opt-in serveur reste désactivé pour sécuriser la transition.",
      payload,
      serverInput: existingServerInput as Record<string, unknown>,
    })
  }

  try {
    const existingServerResult = await callExistingServerTaxware(existingServerInput)

    return {
      execution: {
        mode: 'server-logic-existing',
        status: 'response-ready',
        routePath: MOCK_SIMULATION_ROUTE_PATH,
        respondedAtLabel: new Intl.DateTimeFormat('fr-CH', {
          dateStyle: 'medium',
          timeStyle: 'short',
        }).format(new Date()),
        noRealCallExecuted: false,
        message:
          'La route interne a relayé le payload vers la logique serveur existante et a reçu une réponse structurée.',
      },
      serviceSummary: {
        transport: 'Front -> API interne -> réponse',
        payloadStatus: 'Payload local reçu',
        responseStatus: 'Réponse structurée générée par la logique serveur',
        engineConnection: 'Logique serveur existante exécutée',
      },
      mockedResults: {
        totalTaxEstimate: formatCurrency(existingServerResult.normalizedResponse.totalTax),
        incomeFortuneReading:
          existingServerResult.normalizedResponse.taxableIncomeCantonal !== null ||
          existingServerResult.normalizedResponse.taxableAssets !== null
            ? `Réponse normalisée reçue: revenu cantonal ${formatCurrency(
                existingServerResult.normalizedResponse.taxableIncomeCantonal
              )}, fortune taxable ${formatCurrency(
                existingServerResult.normalizedResponse.taxableAssets
              )}.`
            : 'Réponse serveur reçue, mais les agrégats fiscaux restent partiels dans cette première intégration.',
        scenarioComparison:
          'La comparaison de scénarios reste pilotée côté interface pendant cette transition serveur.',
        restitutionSummary:
          'La route interne a utilisé buildTaxwarePayload et normalizeTaxwareResponse côté serveur sans modifier le front.',
      },
      processingNotes: [
        `Le payload a transité par la route interne ${MOCK_SIMULATION_ROUTE_PATH} avant de rejoindre la logique serveur existante.`,
        'Le front conserve le même contrat de payload et la même structure générale de réponse.',
        'La transition reste réversible grâce au fallback mock sécurisé prévu côté serveur.',
      ],
      bridge: {
        compatibility,
        serverInput: {
          buildPayloadParams: existingServerInput,
          taxwarePayload: existingServerResult.taxwarePayload,
        } as Record<string, unknown>,
        normalizedResponse:
          existingServerResult.normalizedResponse as unknown as Record<string, unknown>,
        fallbackReason: null,
      },
    }
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'La logique serveur existante n’a pas pu répondre correctement.'

    return buildFallbackMockSimulationResponse({
      compatibility,
      fallbackReason: `${message} Un fallback mock sécurisé a été utilisé pour préserver le flux actuel.`,
      payload,
      serverInput: {
        buildPayloadParams: existingServerInput,
        note: 'Le payload serveur prévu est conservé pour inspection malgré le fallback.',
      },
    })
  }
}
