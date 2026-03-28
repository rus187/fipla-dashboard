export type Profile = {
  id: string
  email: string | null
  created_at: string | null
}

export type Membership = {
  user_id: string
  organization_id: string
  role: 'admin' | 'member'
}

export type Organization = {
  id: string
  name: string
  created_at: string | null
}
