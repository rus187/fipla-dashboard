import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import './App.css'
import type { Membership, Organization, Profile } from './appTypes'
import { supabase } from './lib/supabase'
import { appRoutes, normalizeRoutePath, type AppRoute } from './navigation'
import { DashboardPage } from './pages/DashboardPage'
import { TaxSimulationPage } from './pages/TaxSimulationPage'

function App() {
  const [loading, setLoading] = useState(true)
  const [connectionStatus, setConnectionStatus] = useState('Connexion Supabase en cours')
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [membership, setMembership] = useState<Membership | null>(null)
  const [currentRoute, setCurrentRoute] = useState<AppRoute>(() =>
    normalizeRoutePath(window.location.pathname)
  )

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

  useEffect(() => {
    const handlePopState = () => {
      setCurrentRoute(normalizeRoutePath(window.location.pathname))
    }

    window.addEventListener('popstate', handlePopState)

    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [])

  const navigateTo = (nextRoute: AppRoute) => {
    if (nextRoute === currentRoute) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    window.history.pushState({}, '', nextRoute)
    setCurrentRoute(nextRoute)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <main className="platform-shell">
      <div className="platform-shell__inner">
        <header className="platform-header">
          <div className="platform-header__brand">
            <div className="platform-header__eyebrow">FIPLA Platform</div>
            <div className="platform-header__title">Navigation applicative</div>
          </div>

          <nav className="platform-nav" aria-label="Navigation principale">
            {appRoutes.map((route) => {
              const isActive = route.path === currentRoute

              return (
                <button
                  key={route.path}
                  type="button"
                  className={`platform-nav__item${isActive ? ' platform-nav__item--active' : ''}`}
                  onClick={() => navigateTo(route.path)}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <span className="platform-nav__label">{route.label}</span>
                  <span className="platform-nav__description">{route.description}</span>
                </button>
              )
            })}
          </nav>

          <div className="platform-header__meta">
            <span className="status-pill status-pill--muted">
              {organization?.name ?? 'Organisation en cours de récupération'}
            </span>
            <span className="status-pill status-pill--info">{connectionStatus}</span>
          </div>
        </header>

        {currentRoute === '/' ? (
          <DashboardPage
            connectionStatus={connectionStatus}
            loading={loading}
            membership={membership}
            onOpenTaxSimulation={() => navigateTo('/simulation-fiscale')}
            organization={organization}
            profile={profile}
            user={user}
          />
        ) : (
          <TaxSimulationPage
            connectionStatus={connectionStatus}
            membership={membership}
            onBackToDashboard={() => navigateTo('/')}
            organization={organization}
            user={user}
          />
        )}
      </div>
    </main>
  )
}

export default App
