import type { User } from '@supabase/supabase-js'
import type { Membership, Organization, Profile } from '../appTypes'
import { formatDate } from '../utils/formatDate'

type DashboardPageProps = {
  connectionStatus: string
  loading: boolean
  membership: Membership | null
  onOpenTaxSimulation: () => void
  organization: Organization | null
  profile: Profile | null
  user: User | null
}

type ModuleDefinition = {
  title: string
  description: string
  status: string
  actionLabel?: string
  isPrimary?: boolean
}

const modules: ModuleDefinition[] = [
  {
    title: 'Simulation fiscale',
    description:
      'Accédez maintenant à une page dédiée pour cadrer le module fiscal dans le parcours SaaS.',
    status: 'Actif',
    actionLabel: 'Ouvrir le module',
    isPrimary: true,
  },
  {
    title: 'Patrimoine',
    description:
      'Centralisez les liquidités, actifs financiers, immobilier et prévoyance dans une lecture unifiée.',
    status: 'Bientôt',
  },
  {
    title: 'Comparaison de scénarios',
    description:
      'Comparez plusieurs stratégies patrimoniales avec une lecture claire des écarts et arbitrages.',
    status: 'Bientôt',
  },
  {
    title: 'Abonnements',
    description:
      'Préparez l’espace de gestion des accès et des offres avant l’intégration de la couche Stripe.',
    status: 'Bientôt',
  },
] as const

export function DashboardPage({
  connectionStatus,
  loading,
  membership,
  onOpenTaxSimulation,
  organization,
  profile,
  user,
}: DashboardPageProps) {
  return (
    <div className="page-stack">
      <section className="hero-panel hero-panel--dashboard">
        <div className="hero-panel__content">
          <span className="status-pill status-pill--info">{connectionStatus}</span>
          <h1 className="hero-panel__title">FIPLA Dashboard</h1>
          <p className="hero-panel__text">
            Plateforme de simulation patrimoniale et fiscale conçue pour piloter les scénarios,
            structurer les décisions et préparer une expérience SaaS haut de gamme.
          </p>
        </div>

        <div className="hero-panel__aside">
          <div className="hero-metric">
            <span className="hero-metric__label">Organisation active</span>
            <strong className="hero-metric__value">
              {organization?.name ?? 'Données en cours de récupération'}
            </strong>
          </div>
          <div className="hero-metric">
            <span className="hero-metric__label">Rôle</span>
            <strong className="hero-metric__value">
              {membership?.role ?? 'Données en cours de récupération'}
            </strong>
          </div>
          <div className="hero-metric">
            <span className="hero-metric__label">Module du jour</span>
            <strong className="hero-metric__value">Simulation fiscale</strong>
          </div>
        </div>
      </section>

      <section className="overview-grid">
        <article className="surface-card">
          <span className="status-pill status-pill--success">Utilisateur connecté</span>
          <h2 className="surface-card__title">{user?.email ?? 'Données en cours de récupération'}</h2>
          <p className="surface-card__text">
            Identifiant : {user?.id ?? 'Données en cours de récupération'}
          </p>
          <p className="surface-card__text">
            Profil créé le : {formatDate(profile?.created_at)}
          </p>
        </article>

        <article className="surface-card">
          <span className="status-pill status-pill--success">Organisation</span>
          <h2 className="surface-card__title">
            {organization?.name ?? 'Données en cours de récupération'}
          </h2>
          <p className="surface-card__text">
            Rôle : {membership?.role ?? 'Données en cours de récupération'}
          </p>
          <p className="surface-card__text">Créée le : {formatDate(organization?.created_at)}</p>
        </article>

        <article className="surface-card">
          <span className="status-pill status-pill--info">Statut de connexion Supabase</span>
          <h2 className="surface-card__title">
            {loading ? 'Données en cours de récupération' : connectionStatus}
          </h2>
          <p className="surface-card__text">
            Authentification, profil et rattachement organisationnel restent vérifiés au chargement.
          </p>
        </article>
      </section>

      <section className="surface-card surface-card--section">
        <div className="section-heading">
          <div>
            <span className="status-pill status-pill--muted">Modules disponibles</span>
            <h2 className="section-heading__title">Navigation applicative</h2>
          </div>
          <p className="section-heading__text">
            Le dashboard devient le point d’entrée de l’application. Le module “Simulation
            fiscale” ouvre maintenant une page dédiée, pensée pour accueillir la suite du parcours
            sans perturber l’existant.
          </p>
        </div>

        <div className="modules-grid">
          {modules.map((module) => {
            const isPrimary = Boolean(module.isPrimary)

            return (
              <article
                key={module.title}
                className={`module-card${isPrimary ? ' module-card--primary' : ''}`}
              >
                <div className="module-card__topline">
                  <span className={`status-pill ${isPrimary ? 'status-pill--info' : 'status-pill--muted'}`}>
                    {module.status}
                  </span>
                </div>

                <h3 className="module-card__title">{module.title}</h3>
                <p className="module-card__text">{module.description}</p>

                {isPrimary ? (
                  <button
                    type="button"
                    className="module-card__action"
                    onClick={onOpenTaxSimulation}
                  >
                    {module.actionLabel ?? 'Ouvrir'}
                  </button>
                ) : (
                  <div className="module-card__footnote">Structure préservée pour les prochaines étapes.</div>
                )}
              </article>
            )
          })}
        </div>
      </section>
    </div>
  )
}
