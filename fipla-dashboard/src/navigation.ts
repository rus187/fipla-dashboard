export const appRoutes = [
  {
    path: '/',
    label: 'Dashboard',
    description: 'Vue d’ensemble de la plateforme et des modules.',
  },
  {
    path: '/simulation-fiscale',
    label: 'Simulation fiscale',
    description: 'Espace dédié au parcours de simulation fiscale.',
  },
] as const

export type AppRoute = (typeof appRoutes)[number]['path']

export function normalizeRoutePath(pathname: string): AppRoute {
  return pathname === '/simulation-fiscale' ? '/simulation-fiscale' : '/'
}
