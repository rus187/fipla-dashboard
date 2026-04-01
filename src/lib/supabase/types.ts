export interface Profile {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  created_at?: string;
}

export interface Organization {
  id: string;
  name: string;
  owner_id: string;
  created_at?: string;
}

export interface Membership {
  id: string;
  user_id: string;
  organization_id: string;
  role: 'admin' | 'member' | 'billing';
  created_at?: string;
}

export interface Plan {
  id: string;
  name: string;
  active?: boolean;
  stripe_product_id?: string | null;
  stripe_price_id?: string | null;
  stripe_price_id_monthly?: string | null;
  stripe_price_id_yearly?: string | null;
  created_at?: string;
}

export interface Subscription {
  id: string;
  profile_id: string;
  organization_id: string;
  plan_id: string;
  stripe_subscription_id?: string;
  status: 'active' | 'past_due' | 'canceled' | 'trialing';
  current_period_start?: string;
  current_period_end?: string;
  cancel_at?: string;
  created_at?: string;
}

export interface OrgUsageMonthly {
  id: string;
  organization_id: string;
  year: number;
  month: number;
  usage_count: number;
  created_at?: string;
}
