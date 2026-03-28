export function formatDate(value: string | null | undefined) {
  if (!value) return 'Données en cours de récupération'

  return new Date(value).toLocaleDateString('fr-CH', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}
