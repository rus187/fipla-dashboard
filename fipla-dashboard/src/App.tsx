import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'

type Profile = {
  id: string
  email: string | null
  created_at: string | null
}

type Membership = {
  user_id: string
  organization_id: string
  role: 'admin' | 'member'
}

type Organization = {
  id: string
  name: string
  created_at: string | null
}

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  padding: '48px 24px 64px',
  background:
    'radial-gradient(circle at top left, rgba(205, 224, 255, 0.65), transparent 32%), linear-gradient(180deg, #f6f8fc 0%, #eef3f8 100%)',
  boxSizing: 'border-box',
}

const shellStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: '1160px',
  margin: '0 auto',
  display: 'flex',
  flexDirection: 'column',
  gap: '24px',
}

const heroStyle: React.CSSProperties = {
  padding: '40px',
  borderRadius: '28px',
  background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)',
  color: '#f8fafc',
  textAlign: 'left',
  boxShadow: '0 24px 80px rgba(15, 23, 42, 0.16)',
}

const cardGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
  gap: '18px',
}

const cardStyle: React.CSSProperties = {
  borderRadius: '22px',
  padding: '24px',
  background: 'rgba(255, 255, 255, 0.92)',
  border: '1px solid rgba(148, 163, 184, 0.22)',
  boxShadow: '0 18px 50px rgba(15, 23, 42, 0.08)',
  textAlign: 'left',
}

const sectionStyle: React.CSSProperties = {
  ...cardStyle,
  padding: '28px',
}

const modulesGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: '16px',
  marginTop: '18px',
}

const moduleCardStyle: React.CSSProperties = {
  padding: '22px',
  borderRadius: '20px',
  background: 'linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)',
  border: '1px solid rgba(191, 219, 254, 0.9)',
  boxShadow: '0 14px 32px rgba(59, 130, 246, 0.08)',
  textAlign: 'left',
}

const statusPill = (tone: 'success' | 'info' | 'muted'): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '8px',
  padding: '7px 12px',
  borderRadius: '999px',
  fontSize: '13px',
  fontWeight: 700,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  backgroundColor:
    tone === 'success' ? 'rgba(22, 163, 74, 0.12)' : tone === 'info' ? 'rgba(37, 99, 235, 0.12)' : '#eef2f7',
  color: tone === 'success' ? '#166534' : tone === 'info' ? '#1d4ed8' : '#475569',
})

function formatDate(value: string | null | undefined) {
  if (!value) return 'Données en cours de récupération'

  return new Date(value).toLocaleDateString('fr-CH', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

function App() {
  const [loading, setLoading] = useState(true)
  const [connectionStatus, setConnectionStatus] = useState('Connexion Supabase en cours')
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [membership, setMembership] = useState<Membership | null>(null)

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      setConnectionStatus('Connexion Supabase en cours')

      try {
        const {
          data: { user: existingUser },
          error: userError,
        } = await supabase.auth.getUser()

        console.log('AUTH USER:', existingUser)
        console.log('AUTH USER ERROR:', userError)

        let currentUser = existingUser ?? null

        if (!currentUser) {
          const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
            email: 'test@test.com',
            password: '123456',
          })

          console.log('LOGIN:', loginData)
          console.log('LOGIN ERROR:', loginError)

          if (loginError) {
            setConnectionStatus('Connexion Supabase indisponible')
            return
          }

          currentUser = loginData?.user ?? null
        }

        if (!currentUser) {
          setConnectionStatus('Utilisateur non disponible')
          return
        }

        setUser(currentUser)

        const { data: existingProfile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', currentUser.id)
          .maybeSingle()

        console.log('PROFILE:', existingProfile)
        console.log('PROFILE ERROR:', profileError)

        let activeProfile = existingProfile as Profile | null

        if (!activeProfile) {
          const { data: createdProfile, error: insertProfileError } = await supabase
            .from('profiles')
            .insert({
              id: currentUser.id,
              email: currentUser.email,
            })
            .select('*')
            .single()

          console.log('CREATED PROFILE:', createdProfile)
          console.log('PROFILE INSERT ERROR:', insertProfileError)

          activeProfile = (createdProfile as Profile | null) ?? null
        }

        setProfile(activeProfile)

        const { data: existingMemberships, error: membershipsError } = await supabase
          .from('memberships')
          .select('*')
          .eq('user_id', currentUser.id)

        console.log('MEMBERSHIPS:', existingMemberships)
        console.log('MEMBERSHIPS ERROR:', membershipsError)

        if (membershipsError) {
          setConnectionStatus('Connexion Supabase partielle')
          return
        }

        let activeMembership: Membership | null =
          existingMemberships && existingMemberships.length > 0
            ? (existingMemberships[0] as Membership)
            : null
        let activeOrganization: Organization | null = null

        if (!activeMembership) {
          const { data: createdOrganization, error: organizationError } = await supabase
            .from('organizations')
            .insert({
              name: `Org of ${currentUser.email ?? currentUser.id}`,
            })
            .select('*')
            .single()

          console.log('CREATED ORGANIZATION:', createdOrganization)
          console.log('ORGANIZATION ERROR:', organizationError)

          if (organizationError || !createdOrganization) {
            setConnectionStatus('Connexion Supabase partielle')
            return
          }

          const { data: createdMembership, error: membershipError } = await supabase
            .from('memberships')
            .insert({
              user_id: currentUser.id,
              organization_id: createdOrganization.id,
              role: 'admin',
            })
            .select('*')
            .single()

          console.log('CREATED MEMBERSHIP:', createdMembership)
          console.log('MEMBERSHIP ERROR:', membershipError)

          if (membershipError || !createdMembership) {
            setConnectionStatus('Connexion Supabase partielle')
            return
          }

          activeOrganization = createdOrganization as Organization
          activeMembership = createdMembership as Membership
        } else {
          const { data: existingOrganization, error: organizationError } = await supabase
            .from('organizations')
            .select('*')
            .eq('id', activeMembership.organization_id)
            .maybeSingle()

          console.log('EXISTING ORGANIZATION:', existingOrganization)
          console.log('EXISTING ORGANIZATION ERROR:', organizationError)

          activeOrganization = (existingOrganization as Organization | null) ?? null
        }

        setMembership(activeMembership)
        setOrganization(activeOrganization)
        setConnectionStatus('Supabase connecté')
      } finally {
        setLoading(false)
      }
    }

    run()
  }, [])

  const modules = [
    {
      title: 'Simulation fiscale',
      description:
        'Prévisualisez les bases imposables, les ajustements et les impacts fiscaux dans un cadre structuré.',
    },
    {
      title: 'Patrimoine',
      description:
        'Centralisez les liquidités, actifs financiers, immobilier et prévoyance dans une lecture unifiée.',
    },
    {
      title: 'Comparaison de scénarios',
      description:
        'Comparez plusieurs stratégies patrimoniales avec une lecture claire des écarts et arbitrages.',
    },
    {
      title: 'Abonnements',
      description:
        'Préparez l’espace de gestion des accès et des offres avant l’intégration de la couche Stripe.',
    },
  ]

  return (
    <main style={pageStyle}>
      <div style={shellStyle}>
        <section style={heroStyle}>
          <div style={statusPill(connectionStatus === 'Supabase connecté' ? 'success' : 'info')}>
            {connectionStatus}
          </div>
          <h1
            style={{
              margin: '18px 0 14px',
              fontSize: 'clamp(2.8rem, 6vw, 4.6rem)',
              lineHeight: 1,
              letterSpacing: '-0.04em',
              color: '#f8fafc',
            }}
          >
            FIPLA Dashboard
          </h1>
          <p
            style={{
              maxWidth: '760px',
              fontSize: '1.1rem',
              lineHeight: 1.7,
              color: 'rgba(226, 232, 240, 0.92)',
            }}
          >
            Plateforme de simulation patrimoniale et fiscale conçue pour piloter les scénarios,
            structurer les décisions et préparer une expérience SaaS haut de gamme.
          </p>
        </section>

        <section style={cardGridStyle}>
          <article style={cardStyle}>
            <span style={statusPill(user ? 'success' : 'muted')}>Utilisateur connecté</span>
            <h2 style={{ marginTop: '18px', marginBottom: '14px', color: '#0f172a' }}>
              {user?.email ?? 'Données en cours de récupération'}
            </h2>
            <p style={{ color: '#475569', lineHeight: 1.7 }}>
              Identifiant : {user?.id ?? 'Données en cours de récupération'}
            </p>
            <p style={{ color: '#475569', lineHeight: 1.7, marginTop: '10px' }}>
              Profil créé le : {formatDate(profile?.created_at)}
            </p>
          </article>

          <article style={cardStyle}>
            <span style={statusPill(organization ? 'success' : 'muted')}>Organisation</span>
            <h2 style={{ marginTop: '18px', marginBottom: '14px', color: '#0f172a' }}>
              {organization?.name ?? 'Données en cours de récupération'}
            </h2>
            <p style={{ color: '#475569', lineHeight: 1.7 }}>
              Rôle : {membership?.role ?? 'Données en cours de récupération'}
            </p>
            <p style={{ color: '#475569', lineHeight: 1.7, marginTop: '10px' }}>
              Créée le : {formatDate(organization?.created_at)}
            </p>
          </article>

          <article style={cardStyle}>
            <span style={statusPill(connectionStatus === 'Supabase connecté' ? 'success' : 'info')}>
              Statut de connexion Supabase
            </span>
            <h2 style={{ marginTop: '18px', marginBottom: '14px', color: '#0f172a' }}>
              {loading ? 'Données en cours de récupération' : connectionStatus}
            </h2>
            <p style={{ color: '#475569', lineHeight: 1.7 }}>
              Authentification, profil et rattachement organisationnel sont vérifiés au chargement.
            </p>
          </article>
        </section>

        <section style={sectionStyle}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: '16px',
              alignItems: 'flex-end',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ textAlign: 'left' }}>
              <span style={statusPill('info')}>Modules disponibles</span>
              <h2 style={{ marginTop: '18px', color: '#0f172a' }}>
                Prévisualisation de l’espace applicatif
              </h2>
            </div>
            <p style={{ maxWidth: '520px', color: '#64748b', lineHeight: 1.7, margin: 0 }}>
              Une base claire pour valider l’expérience globale avant l’intégration des abonnements
              et des parcours avancés.
            </p>
          </div>

          <div style={modulesGridStyle}>
            {modules.map((module) => (
              <article key={module.title} style={moduleCardStyle}>
                <div style={statusPill('muted')}>Module</div>
                <h3
                  style={{
                    margin: '18px 0 12px',
                    fontSize: '1.2rem',
                    color: '#0f172a',
                  }}
                >
                  {module.title}
                </h3>
                <p style={{ color: '#475569', lineHeight: 1.7 }}>{module.description}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}

export default App
