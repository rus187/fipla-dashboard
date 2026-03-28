import { useState, type ChangeEvent, type Dispatch, type SetStateAction } from 'react'
import type { User } from '@supabase/supabase-js'
import type { Membership, Organization } from '../appTypes'
import {
  adaptPreparedSimulationToTargetPayload,
  type TargetSimulationPayload,
} from './simulationAdapter'
import {
  executeMockSimulationService,
  MOCK_SIMULATION_ROUTE_PATH,
  type MockSimulationServiceResponse,
} from './simulationMockService'
import {
  mapFormStateToPreparedSimulation,
  type BaseParametersState,
  type ChargesDeductionsState,
  type DebtsState,
  type FortuneState,
  type RevenuesState,
  type SimulationFormState,
} from './simulationNormalization'

type TaxSimulationPageProps = {
  connectionStatus: string
  membership: Membership | null
  onBackToDashboard: () => void
  organization: Organization | null
  user: User | null
}

type SummaryMetric = {
  label: string
  value: string
  helper: string
}

type ReservedResult = {
  label: string
  value: string
}

type BaseFieldConfig = {
  field: keyof BaseParametersState
  helper: string
  label: string
  placeholder?: string
}

type CategoryFieldConfig<TField extends string> = {
  field: TField
  helper: string
  label: string
  placeholder: string
}

type LocalLaunchState = {
  finalPayload: TargetSimulationPayload
  generatedAtLabel: string
  mappingCount: number
  missingCount: number
  placeholderCount: number
}

type LocalMockExecutionState = {
  sentPayload: TargetSimulationPayload
  response: MockSimulationServiceResponse
}

const summaryMetrics: SummaryMetric[] = [
  {
    label: 'Statut de page',
    value: 'State local structuré',
    helper: 'Les données sont organisées par catégories métier prêtes à intégrer.',
  },
  {
    label: 'Résultats',
    value: 'Zone réservée',
    helper: 'La restitution reste purement visuelle sans calcul fiscal réel.',
  },
  {
    label: 'Niveau d’avancement',
    value: 'Préparation des données',
    helper: 'Le formulaire prépare le terrain pour brancher le cœur fiscal plus tard.',
  },
] as const

const reservedResults: ReservedResult[] = [
  { label: 'Impôt total estimé', value: 'Placeholder visuel' },
  { label: 'Lecture revenu / fortune', value: 'Placeholder visuel' },
  { label: 'Comparaison de scénarios', value: 'Placeholder visuel' },
  { label: 'Synthèse de restitution', value: 'Placeholder visuel' },
] as const

const baseParameterFields: BaseFieldConfig[] = [
  {
    field: 'fiscalYear',
    label: 'Année fiscale',
    helper: 'Année de référence du dossier.',
  },
  {
    field: 'canton',
    label: 'Canton',
    helper: 'Canton principal du calcul futur.',
  },
  {
    field: 'commune',
    label: 'Commune',
    helper: 'Commune de référence du foyer fiscal.',
    placeholder: 'Lausanne',
  },
  {
    field: 'npa',
    label: 'NPA',
    helper: 'Code postal utilisé pour la localisation.',
    placeholder: '1000',
  },
  {
    field: 'maritalStatus',
    label: 'Statut civil',
    helper: 'Situation familiale du dossier.',
  },
  {
    field: 'childrenCount',
    label: 'Nombre d’enfants',
    helper: 'Nombre d’enfants à charge retenus.',
    placeholder: '0',
  },
] as const

const revenueFields: CategoryFieldConfig<keyof RevenuesState>[] = [
  {
    field: 'annualIncome',
    label: 'Revenus',
    helper: 'Revenus annuels consolidés du ménage.',
    placeholder: 'CHF 180000',
  },
] as const

const fortuneFields: CategoryFieldConfig<keyof FortuneState>[] = [
  {
    field: 'totalWealth',
    label: 'Fortune',
    helper: 'Masse patrimoniale retenue pour la simulation.',
    placeholder: 'CHF 950000',
  },
] as const

const debtFields: CategoryFieldConfig<keyof DebtsState>[] = [
  {
    field: 'totalDebts',
    label: 'Dettes',
    helper: 'Encours financier et hypothécaire du foyer.',
    placeholder: 'CHF 420000',
  },
] as const

const chargesDeductionFields: CategoryFieldConfig<keyof ChargesDeductionsState>[] = [
  {
    field: 'passiveInterest',
    label: 'Intérêts passifs',
    helper: 'Charge d’intérêts à considérer dans le futur calcul.',
    placeholder: 'CHF 14500',
  },
  {
    field: 'mainDeductions',
    label: 'Déductions principales',
    helper: 'Déductions structurantes du dossier fiscal.',
    placeholder: 'CHF 18000',
  },
  {
    field: 'thirdPillar',
    label: '3e pilier',
    helper: 'Versement annuel ou enveloppe retenue.',
    placeholder: 'CHF 7056',
  },
  {
    field: 'lppBuyback',
    label: 'Rachat LPP',
    helper: 'Montant prévu pour un rachat éventuel.',
    placeholder: 'CHF 25000',
  },
] as const

const initialFormState: SimulationFormState = {
  baseParameters: {
    fiscalYear: '2026',
    canton: 'Vaud',
    commune: '',
    npa: '',
    maritalStatus: 'Marié(e)',
    childrenCount: '0',
  },
  revenues: {
    annualIncome: '',
  },
  fortune: {
    totalWealth: '',
  },
  debts: {
    totalDebts: '',
  },
  chargesDeductions: {
    passiveInterest: '',
    mainDeductions: '',
    thirdPillar: '',
    lppBuyback: '',
  },
}

function getActionMessage(action: 'draft' | 'launch' | 'compare') {
  if (action === 'draft') {
    return 'Le brouillon est conservé localement dans le state de la page. Aucun envoi, aucun calcul et aucune persistance métier n’ont été déclenchés.'
  }

  if (action === 'launch') {
    return 'Le bouton de lancement reste volontairement limité à l’interface. Le moteur fiscal réel n’est pas connecté à cette étape.'
  }

  return 'La comparaison de scénarios reste préparée visuellement pour une intégration future, sans aucun branchement métier réel pour l’instant.'
}

function formatSummaryValue(value: string) {
  const trimmedValue = value.trim()
  return trimmedValue.length > 0 ? trimmedValue : 'Non renseigné'
}

function formatPreparedValue(value: number | string | null) {
  if (value === null) {
    return 'null'
  }

  if (typeof value === 'number') {
    return new Intl.NumberFormat('fr-CH').format(value)
  }

  return value
}

function getMappingStatusLabel(status: 'mapped' | 'missing' | 'placeholder') {
  if (status === 'mapped') {
    return 'Mappé'
  }

  if (status === 'missing') {
    return 'Manquant'
  }

  return 'Placeholder'
}

function handleTextInputChange<TSection extends keyof SimulationFormState>(
  setFormState: Dispatch<SetStateAction<SimulationFormState>>,
  section: TSection,
  field: keyof SimulationFormState[TSection]
) {
  return (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const nextValue = event.target.value

    setFormState((currentState) => ({
      ...currentState,
      [section]: {
        ...currentState[section],
        [field]: nextValue,
      },
    }))
  }
}

export function TaxSimulationPage({
  connectionStatus,
  membership,
  onBackToDashboard,
  organization,
  user,
}: TaxSimulationPageProps) {
  const [formState, setFormState] = useState<SimulationFormState>(initialFormState)
  const [actionStatus, setActionStatus] = useState(
    'Le state local alimente le formulaire et le résumé ci-dessous, sans aucun calcul fiscal branché.'
  )
  const [localLaunchState, setLocalLaunchState] = useState<LocalLaunchState | null>(null)
  const [localMockExecutionState, setLocalMockExecutionState] =
    useState<LocalMockExecutionState | null>(null)
  const [isMockExecuting, setIsMockExecuting] = useState(false)
  const preparedSimulationData = mapFormStateToPreparedSimulation(formState)
  const preparedSimulationPreview = JSON.stringify(preparedSimulationData, null, 2)
  const adapterResult = adaptPreparedSimulationToTargetPayload(preparedSimulationData)
  const targetPayloadPreview = JSON.stringify(adapterResult.targetPayload, null, 2)
  const launchedPayloadPreview = localLaunchState
    ? JSON.stringify(localLaunchState.finalPayload, null, 2)
    : null
  const mockResponsePreview = localMockExecutionState
    ? JSON.stringify(localMockExecutionState.response, null, 2)
    : null

  async function handleLaunchSimulation() {
    const normalizedSimulation = mapFormStateToPreparedSimulation(formState)
    const adaptedSimulation = adaptPreparedSimulationToTargetPayload(normalizedSimulation)

    setLocalLaunchState({
      finalPayload: adaptedSimulation.targetPayload,
      generatedAtLabel: new Intl.DateTimeFormat('fr-CH', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date()),
      mappingCount: adaptedSimulation.mappingItems.filter((item) => item.status === 'mapped')
        .length,
      missingCount: adaptedSimulation.missingFields.length,
      placeholderCount: adaptedSimulation.mappingItems.filter(
        (item) => item.status === 'placeholder'
      ).length,
    })
    setLocalMockExecutionState(null)
    setIsMockExecuting(true)
    setActionStatus(
      `Simulation locale préparée. Le payload final est transmis à la route interne ${MOCK_SIMULATION_ROUTE_PATH} pour simuler un aller-retour d’exécution, sans TaxWare et sans calcul fiscal réel.`
    )

    try {
      const mockResponse = await executeMockSimulationService(adaptedSimulation.targetPayload)

      setLocalMockExecutionState({
        sentPayload: adaptedSimulation.targetPayload,
        response: mockResponse,
      })
      setActionStatus(
        `La route interne ${MOCK_SIMULATION_ROUTE_PATH} a reçu le payload et renvoyé une réponse simulée. Aucun appel réel n’a été exécuté.`
      )
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'La route interne mockée n’a pas pu répondre correctement.'

      setActionStatus(`Le test local via l’API interne a échoué: ${message}`)
    } finally {
      setIsMockExecuting(false)
    }
  }

  return (
    <div className="page-stack">
      <section className="hero-panel hero-panel--simulation">
        <div className="hero-panel__content">
          <span className="status-pill status-pill--success">Architecture locale prête</span>
          <h1 className="hero-panel__title">Simulation fiscale</h1>
          <p className="hero-panel__text">
            Le formulaire s’appuie maintenant sur une vraie structure de données locale, organisée
            par catégories métier. Cette étape prépare proprement l’intégration future du cœur
            fiscal existant, sans connecter encore le moindre calcul réel.
          </p>

          <div className="hero-panel__actions">
            <button type="button" className="primary-button" onClick={onBackToDashboard}>
              Retour au dashboard
            </button>
            <div className="inline-note">
              Les saisies restent locales à la page. Aucun appel TaxWare, aucun PDF et aucune
              logique fiscale réelle ne sont activés ici.
            </div>
          </div>
        </div>

        <aside className="hero-panel__aside hero-panel__aside--compact">
          <div className="hero-metric">
            <span className="hero-metric__label">Connexion</span>
            <strong className="hero-metric__value">{connectionStatus}</strong>
          </div>
          <div className="hero-metric">
            <span className="hero-metric__label">Organisation</span>
            <strong className="hero-metric__value">
              {organization?.name ?? 'Données en cours de récupération'}
            </strong>
          </div>
          <div className="hero-metric">
            <span className="hero-metric__label">Utilisateur</span>
            <strong className="hero-metric__value">{user?.email ?? 'Non disponible'}</strong>
          </div>
          <div className="hero-metric">
            <span className="hero-metric__label">Rôle</span>
            <strong className="hero-metric__value">{membership?.role ?? 'Non disponible'}</strong>
          </div>
        </aside>
      </section>

      <section className="simulation-summary-grid">
        {summaryMetrics.map((metric) => (
          <article key={metric.label} className="simulation-summary-card">
            <span className="simulation-summary-card__label">{metric.label}</span>
            <strong className="simulation-summary-card__value">{metric.value}</strong>
            <p className="simulation-summary-card__text">{metric.helper}</p>
          </article>
        ))}
      </section>

      <section className="simulation-workspace">
        <article className="surface-card surface-card--section simulation-block">
          <div className="section-heading">
            <div>
              <span className="status-pill status-pill--info">Bloc 1</span>
              <h2 className="section-heading__title">Paramètres de base</h2>
            </div>
            <p className="section-heading__text">
              Les paramètres fondamentaux du dossier sont reliés à une section dédiée du state
              local, prête pour un branchement futur plus robuste.
            </p>
          </div>

          <div className="simulation-form-grid simulation-form-grid--parameters">
            <label className="form-field-card">
              <span className="form-field-card__label">Année fiscale</span>
              <select
                className="simulation-select"
                value={formState.baseParameters.fiscalYear}
                onChange={handleTextInputChange(setFormState, 'baseParameters', 'fiscalYear')}
              >
                <option value="2026">2026</option>
                <option value="2025">2025</option>
                <option value="2024">2024</option>
              </select>
              <span className="form-field-card__helper">{baseParameterFields[0].helper}</span>
            </label>

            <label className="form-field-card">
              <span className="form-field-card__label">Canton</span>
              <select
                className="simulation-select"
                value={formState.baseParameters.canton}
                onChange={handleTextInputChange(setFormState, 'baseParameters', 'canton')}
              >
                <option value="Vaud">Vaud</option>
                <option value="Genève">Genève</option>
                <option value="Valais">Valais</option>
                <option value="Fribourg">Fribourg</option>
                <option value="Neuchâtel">Neuchâtel</option>
              </select>
              <span className="form-field-card__helper">{baseParameterFields[1].helper}</span>
            </label>

            <label className="form-field-card">
              <span className="form-field-card__label">Commune</span>
              <input
                className="simulation-input"
                type="text"
                value={formState.baseParameters.commune}
                onChange={handleTextInputChange(setFormState, 'baseParameters', 'commune')}
                placeholder={baseParameterFields[2].placeholder}
              />
              <span className="form-field-card__helper">{baseParameterFields[2].helper}</span>
            </label>

            <label className="form-field-card">
              <span className="form-field-card__label">NPA</span>
              <input
                className="simulation-input"
                type="text"
                inputMode="numeric"
                value={formState.baseParameters.npa}
                onChange={handleTextInputChange(setFormState, 'baseParameters', 'npa')}
                placeholder={baseParameterFields[3].placeholder}
              />
              <span className="form-field-card__helper">{baseParameterFields[3].helper}</span>
            </label>

            <label className="form-field-card">
              <span className="form-field-card__label">Statut civil</span>
              <select
                className="simulation-select"
                value={formState.baseParameters.maritalStatus}
                onChange={handleTextInputChange(setFormState, 'baseParameters', 'maritalStatus')}
              >
                <option value="Célibataire">Célibataire</option>
                <option value="Marié(e)">Marié(e)</option>
                <option value="Divorcé(e)">Divorcé(e)</option>
                <option value="Veuf / veuve">Veuf / veuve</option>
              </select>
              <span className="form-field-card__helper">{baseParameterFields[4].helper}</span>
            </label>

            <label className="form-field-card">
              <span className="form-field-card__label">Nombre d’enfants</span>
              <input
                className="simulation-input"
                type="text"
                inputMode="numeric"
                value={formState.baseParameters.childrenCount}
                onChange={handleTextInputChange(setFormState, 'baseParameters', 'childrenCount')}
                placeholder={baseParameterFields[5].placeholder}
              />
              <span className="form-field-card__helper">{baseParameterFields[5].helper}</span>
            </label>
          </div>
        </article>

        <article className="surface-card surface-card--section simulation-block">
          <div className="section-heading">
            <div>
              <span className="status-pill status-pill--info">Bloc 2</span>
              <h2 className="section-heading__title">Données d’entrée</h2>
            </div>
            <p className="section-heading__text">
              Les montants sont désormais organisés dans des groupes de données locaux distincts:
              revenus, fortune, dettes et charges / déductions.
            </p>
          </div>

          <div className="data-groups-grid">
            <article className="data-group-card">
              <h3 className="data-group-card__title">Revenus</h3>
              <p className="data-group-card__text">
                Section locale dédiée aux entrées de revenus consolidés.
              </p>
              {revenueFields.map((field) => (
                <label key={field.field} className="form-field-card form-field-card--compact">
                  <span className="form-field-card__label">{field.label}</span>
                  <input
                    className="simulation-input"
                    type="text"
                    inputMode="numeric"
                    value={formState.revenues[field.field]}
                    onChange={handleTextInputChange(setFormState, 'revenues', field.field)}
                    placeholder={field.placeholder}
                  />
                  <span className="form-field-card__helper">{field.helper}</span>
                </label>
              ))}
            </article>

            <article className="data-group-card">
              <h3 className="data-group-card__title">Fortune</h3>
              <p className="data-group-card__text">
                Section locale prête pour la couche patrimoniale du futur moteur fiscal.
              </p>
              {fortuneFields.map((field) => (
                <label key={field.field} className="form-field-card form-field-card--compact">
                  <span className="form-field-card__label">{field.label}</span>
                  <input
                    className="simulation-input"
                    type="text"
                    inputMode="numeric"
                    value={formState.fortune[field.field]}
                    onChange={handleTextInputChange(setFormState, 'fortune', field.field)}
                    placeholder={field.placeholder}
                  />
                  <span className="form-field-card__helper">{field.helper}</span>
                </label>
              ))}
            </article>

            <article className="data-group-card">
              <h3 className="data-group-card__title">Dettes</h3>
              <p className="data-group-card__text">
                Section locale pour les engagements financiers du dossier.
              </p>
              {debtFields.map((field) => (
                <label key={field.field} className="form-field-card form-field-card--compact">
                  <span className="form-field-card__label">{field.label}</span>
                  <input
                    className="simulation-input"
                    type="text"
                    inputMode="numeric"
                    value={formState.debts[field.field]}
                    onChange={handleTextInputChange(setFormState, 'debts', field.field)}
                    placeholder={field.placeholder}
                  />
                  <span className="form-field-card__helper">{field.helper}</span>
                </label>
              ))}
            </article>

            <article className="data-group-card data-group-card--wide">
              <h3 className="data-group-card__title">Charges / déductions</h3>
              <p className="data-group-card__text">
                Section locale dédiée aux charges fiscales structurantes et aux enveloppes de
                prévoyance.
              </p>
              <div className="charges-deductions-grid">
                {chargesDeductionFields.map((field) => (
                  <label key={field.field} className="form-field-card form-field-card--compact">
                    <span className="form-field-card__label">{field.label}</span>
                    <input
                      className="simulation-input"
                      type="text"
                      inputMode="numeric"
                      value={formState.chargesDeductions[field.field]}
                      onChange={handleTextInputChange(
                        setFormState,
                        'chargesDeductions',
                        field.field
                      )}
                      placeholder={field.placeholder}
                    />
                    <span className="form-field-card__helper">{field.helper}</span>
                  </label>
                ))}
              </div>
            </article>
          </div>
        </article>

        <article className="surface-card surface-card--section simulation-block">
          <div className="section-heading">
            <div>
              <span className="status-pill status-pill--success">Résumé local</span>
              <h2 className="section-heading__title">Vérification du state</h2>
            </div>
            <p className="section-heading__text">
              Ce panneau confirme visuellement que les champs édités alimentent bien la structure
              locale organisée par catégories, sans calcul fiscal réel.
            </p>
          </div>

          <div className="local-summary-grid">
            <article className="local-summary-card">
              <span className="local-summary-card__label">Paramètres de base</span>
              <div className="local-summary-card__rows">
                <div className="local-summary-row">
                  <span>Année fiscale</span>
                  <strong>{formatSummaryValue(formState.baseParameters.fiscalYear)}</strong>
                </div>
                <div className="local-summary-row">
                  <span>Canton</span>
                  <strong>{formatSummaryValue(formState.baseParameters.canton)}</strong>
                </div>
                <div className="local-summary-row">
                  <span>Commune / NPA</span>
                  <strong>
                    {`${formatSummaryValue(formState.baseParameters.commune)} / ${formatSummaryValue(
                      formState.baseParameters.npa
                    )}`}
                  </strong>
                </div>
                <div className="local-summary-row">
                  <span>Statut civil</span>
                  <strong>{formatSummaryValue(formState.baseParameters.maritalStatus)}</strong>
                </div>
                <div className="local-summary-row">
                  <span>Enfants</span>
                  <strong>{formatSummaryValue(formState.baseParameters.childrenCount)}</strong>
                </div>
              </div>
            </article>

            <article className="local-summary-card">
              <span className="local-summary-card__label">Revenus</span>
              <div className="local-summary-card__rows">
                <div className="local-summary-row">
                  <span>Revenus saisis</span>
                  <strong>{formatSummaryValue(formState.revenues.annualIncome)}</strong>
                </div>
              </div>
            </article>

            <article className="local-summary-card">
              <span className="local-summary-card__label">Fortune</span>
              <div className="local-summary-card__rows">
                <div className="local-summary-row">
                  <span>Fortune saisie</span>
                  <strong>{formatSummaryValue(formState.fortune.totalWealth)}</strong>
                </div>
              </div>
            </article>

            <article className="local-summary-card">
              <span className="local-summary-card__label">Dettes</span>
              <div className="local-summary-card__rows">
                <div className="local-summary-row">
                  <span>Dettes saisies</span>
                  <strong>{formatSummaryValue(formState.debts.totalDebts)}</strong>
                </div>
              </div>
            </article>

            <article className="local-summary-card local-summary-card--wide">
              <span className="local-summary-card__label">Charges / déductions</span>
              <div className="local-summary-card__rows">
                <div className="local-summary-row">
                  <span>Intérêts passifs</span>
                  <strong>{formatSummaryValue(formState.chargesDeductions.passiveInterest)}</strong>
                </div>
                <div className="local-summary-row">
                  <span>Déductions principales</span>
                  <strong>{formatSummaryValue(formState.chargesDeductions.mainDeductions)}</strong>
                </div>
                <div className="local-summary-row">
                  <span>3e pilier</span>
                  <strong>{formatSummaryValue(formState.chargesDeductions.thirdPillar)}</strong>
                </div>
                <div className="local-summary-row">
                  <span>Rachat LPP</span>
                  <strong>{formatSummaryValue(formState.chargesDeductions.lppBuyback)}</strong>
                </div>
              </div>
            </article>
          </div>

          <div className="prepared-simulation-panel">
            <div className="prepared-simulation-panel__header">
              <div>
                <span className="status-pill status-pill--info">Objet préparé</span>
                <h3 className="prepared-simulation-panel__title">
                  Simulation normalisée prête à intégrer
                </h3>
              </div>
              <p className="prepared-simulation-panel__text">
                Ce mapping local transforme le state de saisie en un objet métier normalisé,
                exploitable plus tard par la couche fiscale sans déclencher de calcul aujourd’hui.
              </p>
            </div>

            <div className="prepared-simulation-grid">
              <article className="prepared-simulation-card">
                <span className="prepared-simulation-card__label">Contexte</span>
                <div className="prepared-simulation-card__rows">
                  <div className="prepared-simulation-row">
                    <span>Année fiscale</span>
                    <strong>
                      {formatPreparedValue(preparedSimulationData.simulationContext.fiscalYear)}
                    </strong>
                  </div>
                  <div className="prepared-simulation-row">
                    <span>Canton</span>
                    <strong>{formatPreparedValue(preparedSimulationData.simulationContext.canton)}</strong>
                  </div>
                  <div className="prepared-simulation-row">
                    <span>Commune</span>
                    <strong>{formatPreparedValue(preparedSimulationData.simulationContext.commune)}</strong>
                  </div>
                  <div className="prepared-simulation-row">
                    <span>NPA</span>
                    <strong>
                      {formatPreparedValue(preparedSimulationData.simulationContext.postalCode)}
                    </strong>
                  </div>
                </div>
              </article>

              <article className="prepared-simulation-card">
                <span className="prepared-simulation-card__label">Profils financiers</span>
                <div className="prepared-simulation-card__rows">
                  <div className="prepared-simulation-row">
                    <span>Revenus</span>
                    <strong>{formatPreparedValue(preparedSimulationData.incomeProfile.annualIncome)}</strong>
                  </div>
                  <div className="prepared-simulation-row">
                    <span>Fortune</span>
                    <strong>{formatPreparedValue(preparedSimulationData.wealthProfile.totalWealth)}</strong>
                  </div>
                  <div className="prepared-simulation-row">
                    <span>Dettes</span>
                    <strong>{formatPreparedValue(preparedSimulationData.liabilitiesProfile.totalDebts)}</strong>
                  </div>
                  <div className="prepared-simulation-row">
                    <span>Enfants à charge</span>
                    <strong>
                      {formatPreparedValue(preparedSimulationData.householdProfile.dependentChildren)}
                    </strong>
                  </div>
                </div>
              </article>
            </div>

            <div className="prepared-simulation-code">
              <div className="prepared-simulation-code__label">Prévisualisation de l’objet normalisé</div>
              <pre className="prepared-simulation-code__block">{preparedSimulationPreview}</pre>
            </div>
          </div>

          <div className="adapter-panel">
            <div className="adapter-panel__header">
              <div>
                <span className="status-pill status-pill--success">Adaptateur local</span>
                <h3 className="adapter-panel__title">Payload cible prêt pour un futur raccordement</h3>
              </div>
              <p className="adapter-panel__text">
                Cette couche intermédiaire convertit l’objet préparé vers un payload cible lisible,
                sans appeler de moteur fiscal, sans calcul réel et sans connexion API.
              </p>
            </div>

            <div className="adapter-grid">
              <article className="adapter-card">
                <span className="adapter-card__label">Correspondances de mapping</span>
                <div className="adapter-card__rows">
                  {adapterResult.mappingItems.map((item) => (
                    <div key={`${item.sourceField}-${item.targetField}`} className="adapter-row">
                      <div className="adapter-row__fields">
                        <strong>{item.targetField}</strong>
                        <span>{`${item.sourceField} -> ${item.targetField}`}</span>
                        <p>{item.note}</p>
                      </div>
                      <span
                        className={`adapter-row__status adapter-row__status--${item.status}`}
                      >
                        {getMappingStatusLabel(item.status)}
                      </span>
                    </div>
                  ))}
                </div>
              </article>

              <article className="adapter-card">
                <span className="adapter-card__label">Champs manquants ou à confirmer</span>
                {adapterResult.missingFields.length > 0 ? (
                  <div className="adapter-missing-list">
                    {adapterResult.missingFields.map((missingField) => (
                      <div key={missingField.field} className="adapter-row adapter-row--missing">
                        <div className="adapter-row__fields">
                          <strong>{missingField.field}</strong>
                          <p>{missingField.reason}</p>
                        </div>
                        <span className="adapter-row__status adapter-row__status--missing">
                          A confirmer
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="adapter-empty-state">
                    Aucun champ bloquant détecté dans cette prévisualisation locale.
                  </div>
                )}
              </article>
            </div>

            <div className="adapter-json">
              <div className="adapter-json__label">Objet cible généré</div>
              <pre className="adapter-json__block">{targetPayloadPreview}</pre>
            </div>
          </div>
        </article>

        <article className="surface-card surface-card--section simulation-block">
          <div className="section-heading">
            <div>
              <span className="status-pill status-pill--muted">Bloc 3</span>
              <h2 className="section-heading__title">Résultats réservés</h2>
            </div>
            <p className="section-heading__text">
              Cette zone reste volontairement visuelle. Elle réserve la place et la hiérarchie pour
              la restitution future sans lancer de calcul réel aujourd’hui.
            </p>
          </div>

          <div className="results-reserved">
            {localMockExecutionState ? (
              <div className="mock-results-panel">
                <div className="mock-results-panel__header">
                  <div className="results-reserved__hero">
                    <div className="results-reserved__eyebrow">API interne de simulation</div>
                    <div className="results-reserved__title">Réponse serveur reçue</div>
                    <p className="results-reserved__text">
                      La zone résultats montre maintenant un aller-retour complet entre le payload
                      envoyé, la route interne et la réponse reçue, avec fallback sécurisé si la
                      logique serveur existante n’est pas encore exécutable.
                    </p>
                  </div>

                  <div className="mock-results-status-grid">
                    <article className="mock-results-status-card">
                      <span className="mock-results-status-card__label">API interne</span>
                      <strong className="mock-results-status-card__value">
                        {localMockExecutionState.response.serviceSummary.transport}
                      </strong>
                      <p className="mock-results-status-card__text">
                        Route utilisée: {localMockExecutionState.response.execution.routePath}
                      </p>
                    </article>

                    <article className="mock-results-status-card">
                      <span className="mock-results-status-card__label">Payload envoyé</span>
                      <strong className="mock-results-status-card__value">
                        {localMockExecutionState.response.serviceSummary.payloadStatus}
                      </strong>
                      <p className="mock-results-status-card__text">
                        Le payload final local a bien été transmis à la route serveur interne.
                      </p>
                    </article>

                    <article className="mock-results-status-card">
                      <span className="mock-results-status-card__label">Réponse reçue</span>
                      <strong className="mock-results-status-card__value">
                        {localMockExecutionState.response.serviceSummary.responseStatus}
                      </strong>
                      <p className="mock-results-status-card__text">
                        Retour mocké reçu le{' '}
                        {localMockExecutionState.response.execution.respondedAtLabel}.
                      </p>
                    </article>

                    <article className="mock-results-status-card">
                      <span className="mock-results-status-card__label">Sécurité</span>
                      <strong className="mock-results-status-card__value">
                        {localMockExecutionState.response.execution.noRealCallExecuted
                          ? 'Aucun appel réel exécuté'
                          : 'Exécution serveur existante'}
                      </strong>
                      <p className="mock-results-status-card__text">
                        {localMockExecutionState.response.execution.noRealCallExecuted
                          ? 'TaxWare, API et moteur fiscal réel restent déconnectés.'
                          : 'La route interne a pu relayer la requête vers la logique serveur existante.'}
                      </p>
                    </article>
                  </div>
                </div>

                <div className="results-reserved__grid">
                  <div className="result-placeholder-card">
                    <span className="result-placeholder-card__label">Impôt total estimé</span>
                    <strong className="result-placeholder-card__value">
                      {localMockExecutionState.response.mockedResults.totalTaxEstimate}
                    </strong>
                    <div className="result-placeholder-card__bar" />
                  </div>
                  <div className="result-placeholder-card">
                    <span className="result-placeholder-card__label">Lecture revenu / fortune</span>
                    <strong className="result-placeholder-card__value">
                      {localMockExecutionState.response.mockedResults.incomeFortuneReading}
                    </strong>
                    <div className="result-placeholder-card__bar" />
                  </div>
                  <div className="result-placeholder-card">
                    <span className="result-placeholder-card__label">
                      Comparaison de scénarios
                    </span>
                    <strong className="result-placeholder-card__value">
                      {localMockExecutionState.response.mockedResults.scenarioComparison}
                    </strong>
                    <div className="result-placeholder-card__bar" />
                  </div>
                  <div className="result-placeholder-card">
                    <span className="result-placeholder-card__label">Synthèse de restitution</span>
                    <strong className="result-placeholder-card__value">
                      {localMockExecutionState.response.mockedResults.restitutionSummary}
                    </strong>
                    <div className="result-placeholder-card__bar" />
                  </div>
                </div>

                <div className="mock-results-notes">
                  {localMockExecutionState.response.processingNotes.map((note) => (
                    <div key={note} className="mock-results-note">
                      {note}
                    </div>
                  ))}
                </div>

                <div className="mock-results-code-grid">
                  <div className="mock-results-code">
                    <div className="mock-results-code__label">Payload envoyé</div>
                    <pre className="mock-results-code__block">{launchedPayloadPreview}</pre>
                  </div>
                  <div className="mock-results-code">
                    <div className="mock-results-code__label">Réponse serveur reçue</div>
                    <pre className="mock-results-code__block">{mockResponsePreview}</pre>
                  </div>
                </div>
              </div>
            ) : isMockExecuting ? (
                <div className="mock-results-empty-state">
                  <div className="results-reserved__eyebrow">API interne de simulation</div>
                  <div className="results-reserved__title">Exécution simulée en cours</div>
                  <p className="results-reserved__text">
                    Le payload final vient d’être transmis à la route interne{' '}
                    {MOCK_SIMULATION_ROUTE_PATH}. La réponse serveur va être affichée ici, avec
                    fallback sécurisé si nécessaire et sans calcul fiscal côté front.
                  </p>
                </div>
            ) : (
              <>
                <div className="results-reserved__hero">
                  <div className="results-reserved__eyebrow">Zone placeholder</div>
                  <div className="results-reserved__title">Restitution fiscale à intégrer</div>
                  <p className="results-reserved__text">
                    Les résultats consolidés, la comparaison de scénarios et les commentaires de
                    restitution viendront ici lors du branchement du cœur fiscal existant.
                  </p>
                </div>

                <div className="results-reserved__grid">
                  {reservedResults.map((result) => (
                    <div key={result.label} className="result-placeholder-card">
                      <span className="result-placeholder-card__label">{result.label}</span>
                      <strong className="result-placeholder-card__value">{result.value}</strong>
                      <div className="result-placeholder-card__bar" />
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </article>

        <article className="surface-card surface-card--section simulation-block">
          <div className="section-heading">
            <div>
              <span className="status-pill status-pill--success">Bloc 4</span>
              <h2 className="section-heading__title">Actions</h2>
            </div>
            <p className="section-heading__text">
              Les commandes principales du parcours restent visibles et purement locales, sans
              déclencher de logique fiscale réelle.
            </p>
          </div>

          <div className="action-control-panel">
            <div className="action-control-panel__grid">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setActionStatus(getActionMessage('draft'))}
              >
                Enregistrer brouillon
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={handleLaunchSimulation}
                disabled={isMockExecuting}
              >
                {isMockExecuting ? 'Simulation locale en cours...' : 'Lancer simulation'}
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setActionStatus(getActionMessage('compare'))}
              >
                Comparer scénarios
              </button>
              <button type="button" className="secondary-button" onClick={onBackToDashboard}>
                Retour dashboard
              </button>
            </div>

            <div className="action-status-card">
              <span className="action-status-card__label">État de l’interface</span>
              <p className="action-status-card__text">{actionStatus}</p>
            </div>

            <div className="launch-preview-panel">
              <div className="launch-preview-panel__header">
                <div>
                  <span className="status-pill status-pill--success">Déclenchement local</span>
                  <h3 className="launch-preview-panel__title">
                    Validation du flux de lancement
                  </h3>
                </div>
                <p className="launch-preview-panel__text">
                  Le bouton de lancement peut maintenant simuler le flux utilisateur complet en
                  local, jusqu’au payload final prêt pour un futur raccordement moteur.
                </p>
              </div>

              {localLaunchState ? (
                <>
                  <div className="launch-status-grid">
                    <article className="launch-status-card">
                      <span className="launch-status-card__label">Statut</span>
                      <strong className="launch-status-card__value">
                        Simulation locale préparée
                      </strong>
                      <p className="launch-status-card__text">
                        Le déclenchement a parcouru le pipeline existant sans exécution fiscale.
                      </p>
                    </article>

                    <article className="launch-status-card">
                      <span className="launch-status-card__label">Payload</span>
                      <strong className="launch-status-card__value">Payload prêt</strong>
                      <p className="launch-status-card__text">
                        Généré localement le {localLaunchState.generatedAtLabel}.
                      </p>
                    </article>

                    <article className="launch-status-card">
                      <span className="launch-status-card__label">Sécurité</span>
                      <strong className="launch-status-card__value">
                        {localMockExecutionState?.response.execution.noRealCallExecuted === false
                          ? 'Exécution serveur existante possible'
                          : 'Aucun appel réel exécuté'}
                      </strong>
                      <p className="launch-status-card__text">
                        {localMockExecutionState?.response.execution.noRealCallExecuted === false
                          ? 'La route interne peut maintenant relayer vers la logique serveur existante lorsque le contexte est prêt.'
                          : 'TaxWare, API et moteur fiscal réel restent totalement débranchés.'}
                      </p>
                    </article>
                  </div>

                  <div className="launch-metrics-grid">
                    <div className="launch-metric-card">
                      <span className="launch-metric-card__label">Champs mappés</span>
                      <strong className="launch-metric-card__value">
                        {localLaunchState.mappingCount}
                      </strong>
                    </div>
                    <div className="launch-metric-card">
                      <span className="launch-metric-card__label">Placeholders</span>
                      <strong className="launch-metric-card__value">
                        {localLaunchState.placeholderCount}
                      </strong>
                    </div>
                    <div className="launch-metric-card">
                      <span className="launch-metric-card__label">Champs à confirmer</span>
                      <strong className="launch-metric-card__value">
                        {localLaunchState.missingCount}
                      </strong>
                    </div>
                  </div>

                  <div className="launch-json">
                    <div className="launch-json__label">Payload final prêt à être envoyé</div>
                    <pre className="launch-json__block">{launchedPayloadPreview}</pre>
                  </div>
                </>
              ) : (
                <div className="launch-empty-state">
                  Cliquez sur <strong>Lancer simulation</strong> pour générer localement le payload
                  final à partir du state, de la normalisation et de l’adaptation déjà en place.
                  Aucun appel réel ne sera exécuté.
                </div>
              )}
            </div>
          </div>
        </article>
      </section>
    </div>
  )
}
