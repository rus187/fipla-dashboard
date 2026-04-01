create extension if not exists pgcrypto;

create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  full_name text,
  avatar_url text,
  stripe_customer_id text,
  metadata jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references profiles(id) on delete cascade,
  stripe_customer_id text,
  metadata jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  role text not null check(role in ('admin','member','billing')),
  joined_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, organization_id)
);

create table if not exists plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  stripe_price_id text not null,
  interval text not null check(interval in ('month','year')),
  amount_cents integer not null,
  currency text not null default 'usd',
  active boolean not null default true,
  metadata jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  plan_id uuid references plans(id) on delete set null,
  stripe_subscription_id text not null unique,
  subscription_status text not null check(subscription_status in ('active','trialing','past_due','canceled','incomplete','incomplete_expired','unpaid')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at timestamptz,
  canceled_at timestamptz,
  trial_end timestamptz,
  quantity integer default 1,
  metadata jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists org_usage_monthly (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  year integer not null,
  month integer not null check(month >= 1 and month <= 12),
  usage_count integer not null default 0,
  limit_count integer not null default 0,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(organization_id, year, month)
);

create index if not exists idx_profiles_email on profiles(email);
create index if not exists idx_organizations_owner_id on organizations(owner_id);
create index if not exists idx_subscriptions_profile_id on subscriptions(profile_id);
create index if not exists idx_subscriptions_organization_id on subscriptions(organization_id);
create index if not exists idx_org_usage_monthly_org on org_usage_monthly(organization_id, year, month);

alter table profiles enable row level security;

drop policy if exists "profiles_select_own" on profiles;
create policy "profiles_select_own"
on profiles
for select
to authenticated
using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on profiles;
create policy "profiles_insert_own"
on profiles
for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on profiles;
create policy "profiles_update_own"
on profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);
