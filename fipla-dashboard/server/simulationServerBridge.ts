import { buildTaxwarePayload } from '../../src/lib/taxware/buildTaxwarePayload'
import { normalizeTaxwareResponse } from '../../src/lib/taxware/normalizeTaxwareResponse.ts'
import {
  buildExistingServerInputDraft,
  buildMinimalContractReadinessFromDraft,
  type ExistingServerInputDraft,
  type TargetSimulationPayload,
} from '../src/pages/simulationAdapter'
import {
  buildFallbackMockSimulationResponse,
  MOCK_SIMULATION_ROUTE_PATH,
  type MockSimulationServiceResponse,
  type SimulationBridgeCompatibility,
} from '../src/pages/simulationMockEngine'

type ExistingServerInput = Parameters<typeof buildTaxwarePayload>[0]
type ExistingServerDryRun = {
  buildPayloadParams: ExistingServerInput
  taxwarePayload: ReturnType<typeof buildTaxwarePayload>
}

const DEFAULT_TAXWARE_PROXY_URL = 'http://127.0.0.1:3001/api/taxware/simulate'
const DEFAULT_TAXWARE_PROXY_TIMEOUT_MS = 15_000

function formatCurrency(value: number | null) {
  if (value === null) {
    return 'Réponse serveur reçue, montant non disponible'
  }

  return `${new Intl.NumberFormat('fr-CH').format(Math.round(value))} CHF`
}

function normalizeRealEstates(
  existingServerInputDraft: ExistingServerInputDraft
): ExistingServerInput['realEstates'] | undefined {
  const normalizedRealEstates = existingServerInputDraft.realEstates
    .map((realEstate) => {
      const normalizedRealEstate: NonNullable<ExistingServerInput['realEstates']>[number] = {}

      if (realEstate.taxableValue !== null) {
        normalizedRealEstate.taxableValue = realEstate.taxableValue
      }

      if (realEstate.rentalIncome !== null) {
        normalizedRealEstate.rentalIncome = realEstate.rentalIncome
      }

      if (realEstate.effectiveExpenses !== null) {
        normalizedRealEstate.effectiveExpenses = realEstate.effectiveExpenses
      }

      return normalizedRealEstate
    })
    .filter((realEstate) => Object.keys(realEstate).length > 0)

  return normalizedRealEstates.length > 0 ? normalizedRealEstates : undefined
}

function buildExistingServerInput(
  existingServerInputDraft: ExistingServerInputDraft
): ExistingServerInput | null {
  if (
    existingServerInputDraft.zip === null ||
    existingServerInputDraft.city === null ||
    existingServerInputDraft.year === null ||
    existingServerInputDraft.partnership === null ||
    existingServerInputDraft.childrenCount === null ||
    existingServerInputDraft.netWages === null ||
    existingServerInputDraft.thirdPillar === null ||
    existingServerInputDraft.lppBuyback === null ||
    existingServerInputDraft.assets === null ||
    existingServerInputDraft.debts === null
  ) {
    return null
  }

  const realEstates = normalizeRealEstates(existingServerInputDraft)

  return {
    zip: existingServerInputDraft.zip,
    city: existingServerInputDraft.city,
    year: existingServerInputDraft.year,
    partnership: existingServerInputDraft.partnership,
    childrenCount: existingServerInputDraft.childrenCount,
    netWages: existingServerInputDraft.netWages,
    thirdPillar: existingServerInputDraft.thirdPillar,
    lppBuyback: existingServerInputDraft.lppBuyback,
    assets: existingServerInputDraft.assets,
    debts: existingServerInputDraft.debts,
    ...(realEstates !== undefined ? { realEstates } : {}),
    ...(existingServerInputDraft.pensionIncome !== null
      ? { pensionIncome: existingServerInputDraft.pensionIncome }
      : {}),
    ...(existingServerInputDraft.hasOasiPensions !== null
      ? { hasOasiPensions: existingServerInputDraft.hasOasiPensions }
      : {}),
    ...(existingServerInputDraft.otherIncome !== null
      ? { otherIncome: existingServerInputDraft.otherIncome }
      : {}),
    ...(existingServerInputDraft.assetIncome !== null
      ? { assetIncome: existingServerInputDraft.assetIncome }
      : {}),
    ...(existingServerInputDraft.miscIncome !== null
      ? { miscIncome: existingServerInputDraft.miscIncome }
      : {}),
    ...(existingServerInputDraft.miscExpenses !== null
      ? { miscExpenses: existingServerInputDraft.miscExpenses }
      : {}),
    ...(existingServerInputDraft.debtInterests !== null
      ? { debtInterests: existingServerInputDraft.debtInterests }
      : {}),
    ...(existingServerInputDraft.spouseNetWages !== null
      ? { spouseNetWages: existingServerInputDraft.spouseNetWages }
      : {}),
    ...(existingServerInputDraft.spousePensionIncome !== null
      ? { spousePensionIncome: existingServerInputDraft.spousePensionIncome }
      : {}),
    ...(existingServerInputDraft.spouseHasOasiPensions !== null
      ? { spouseHasOasiPensions: existingServerInputDraft.spouseHasOasiPensions }
      : {}),
    ...(existingServerInputDraft.spouseOtherIncome !== null
      ? { spouseOtherIncome: existingServerInputDraft.spouseOtherIncome }
      : {}),
    ...(existingServerInputDraft.spouseThirdPillar !== null
      ? { spouseThirdPillar: existingServerInputDraft.spouseThirdPillar }
      : {}),
    ...(existingServerInputDraft.spouseLppBuyback !== null
      ? { spouseLppBuyback: existingServerInputDraft.spouseLppBuyback }
      : {}),
  }
}

function buildExistingServerDryRun(
  existingServerInput: ExistingServerInput
): ExistingServerDryRun {
  return {
    buildPayloadParams: existingServerInput,
    taxwarePayload: buildTaxwarePayload(existingServerInput),
  }
}

function buildCompatibilityReport(
  payload: TargetSimulationPayload
): {
  compatibility: SimulationBridgeCompatibility
  existingServerInputDraft: ExistingServerInputDraft
  existingServerInput: ExistingServerInput | null
} {
  const existingServerInputDraft = buildExistingServerInputDraft(payload)
  const minimalContractReadiness = buildMinimalContractReadinessFromDraft(existingServerInputDraft)
  const missingRequirements = minimalContractReadiness.missingRequiredFields.map(
    (missingField) => missingField.reason
  )

  const compatibilityStatus: SimulationBridgeCompatibility['status'] =
    minimalContractReadiness.status === 'minimal-compatible' ? 'compatible' : 'partial'

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
          note: 'Mapping verrouillé: Célibataire -> Single, Marié(e) -> Marriage, Divorcé(e) -> Single, Veuf / veuve -> Single.',
        },
        {
          source: 'serverPreparation.leadTaxpayer.netWages',
          target: 'buildTaxwarePayload.netWages',
          note: 'Le contrat minimal exige désormais netWages explicite, sans fallback implicite depuis annualIncome.',
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
          note: 'MiscExpenses reste optionnel et reçoit le montant brut mainDeductions lorsqu’il est saisi.',
        },
        {
          source: 'serverPreparation.realEstates',
          target: 'buildTaxwarePayload.realEstates',
          note: 'Le bloc immobilier local est désormais transmis lorsque des valeurs sont saisies.',
        },
      ],
    },
    existingServerInputDraft,
    existingServerInput: buildExistingServerInput(existingServerInputDraft),
  }
}

function isExistingServerExecutionEnabled() {
  return process.env.FIPLA_ENABLE_EXISTING_TAXWARE_ROUTE === 'true'
}

function resolveExistingServerProxyRuntimeConfig() {
  const proxyUrl = process.env.FIPLA_TAXWARE_PROXY_URL?.trim() || DEFAULT_TAXWARE_PROXY_URL
  const timeoutSource = process.env.FIPLA_TAXWARE_PROXY_TIMEOUT_MS?.trim()
  const timeoutMs =
    timeoutSource && timeoutSource.length > 0
      ? Number.parseInt(timeoutSource, 10)
      : DEFAULT_TAXWARE_PROXY_TIMEOUT_MS

  try {
    new URL(proxyUrl)
  } catch {
    throw new Error('FIPLA_TAXWARE_PROXY_URL doit être une URL absolue valide.')
  }

  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error('FIPLA_TAXWARE_PROXY_TIMEOUT_MS doit être un entier strictement positif.')
  }

  return {
    proxyUrl,
    timeoutMs,
  }
}

async function callExistingServerTaxware(existingServerInput: ExistingServerInput) {
  const taxwarePayload = buildTaxwarePayload(existingServerInput)
  const { proxyUrl, timeoutMs } = resolveExistingServerProxyRuntimeConfig()
  const abortController = new AbortController()
  const timeoutHandle = setTimeout(() => abortController.abort(), timeoutMs)

  let response: Response

  try {
    response = await fetch(proxyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(taxwarePayload),
      signal: abortController.signal,
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(
        `Le proxy TaxWare n’a pas répondu dans le délai configuré (${timeoutMs} ms) via ${proxyUrl}.`
      )
    }

    throw error
  } finally {
    clearTimeout(timeoutHandle)
  }

  const text = await response.text()
  let parsedResponse: Record<string, unknown> | null = null

  if (text) {
    try {
      parsedResponse = JSON.parse(text) as Record<string, unknown>
    } catch {
      throw new Error(
        `Le proxy TaxWare a répondu avec un corps non JSON via ${proxyUrl}, impossible à normaliser.`
      )
    }
  }

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
  const { compatibility, existingServerInputDraft, existingServerInput } =
    buildCompatibilityReport(payload)
  const existingServerExecutionEnabled = isExistingServerExecutionEnabled()

  if (compatibility.missingRequirements.length > 0) {
    return buildFallbackMockSimulationResponse({
      compatibility,
      fallbackReason:
        'Le payload actuel ne contient pas encore tous les champs requis par la logique serveur existante.',
      payload,
      serverInput: existingServerInputDraft as Record<string, unknown>,
    })
  }

  if (existingServerInput === null) {
    return buildFallbackMockSimulationResponse({
      compatibility: {
        ...compatibility,
        status: 'partial',
        missingRequirements: [
          ...compatibility.missingRequirements,
          'Le brouillon serveur ne peut pas encore être converti en entrée buildTaxwarePayload complète.',
        ],
      },
      fallbackReason:
        "Le contrat minimal n'est pas encore prêt pour construire une entrée buildTaxwarePayload exploitable.",
      payload,
      serverInput: existingServerInputDraft as Record<string, unknown>,
    })
  }

  let existingServerDryRun: ExistingServerDryRun

  try {
    existingServerDryRun = buildExistingServerDryRun(existingServerInput)
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Le dry-run local buildTaxwarePayload n’a pas pu être construit correctement.'

    return buildFallbackMockSimulationResponse({
      compatibility: {
        ...compatibility,
        status: 'partial',
        missingRequirements: [
          ...compatibility.missingRequirements,
          'Le pont serveur n’a pas pu matérialiser une entrée strictement compatible avec buildTaxwarePayload.',
        ],
      },
      fallbackReason: `${message} Aucun appel TaxWare réel n’a été tenté et le fallback mock sécurisé reste actif.`,
      payload,
      serverInput: existingServerInputDraft as Record<string, unknown>,
    })
  }

  if (!existingServerExecutionEnabled) {
    return buildFallbackMockSimulationResponse({
      compatibility,
      fallbackReason:
        "Le branchement vers la logique serveur existante est prêt, mais l'opt-in serveur reste désactivé pour sécuriser la transition.",
      payload,
      serverInput: existingServerDryRun.buildPayloadParams as Record<string, unknown>,
    })
  }

  try {
    const existingServerResult = await callExistingServerTaxware(
      existingServerDryRun.buildPayloadParams
    )

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
          buildPayloadParams: existingServerDryRun.buildPayloadParams,
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
        buildPayloadParams: existingServerDryRun.buildPayloadParams,
        note: 'Le payload serveur prévu est conservé pour inspection malgré le fallback.',
      },
    })
  }
}
