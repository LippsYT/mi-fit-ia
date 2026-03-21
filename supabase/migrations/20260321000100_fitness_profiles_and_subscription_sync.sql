create extension if not exists pgcrypto;

create or replace function public.set_timestamp_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.fitness_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  weight numeric,
  height numeric,
  age integer,
  gender text,
  goal text,
  activity_level text,
  training_days integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.fitness_profiles enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'fitness_profiles' and policyname = 'Users can view own fitness profile'
  ) then
    create policy "Users can view own fitness profile"
      on public.fitness_profiles
      for select
      to authenticated
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'fitness_profiles' and policyname = 'Users can insert own fitness profile'
  ) then
    create policy "Users can insert own fitness profile"
      on public.fitness_profiles
      for insert
      to authenticated
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'fitness_profiles' and policyname = 'Users can update own fitness profile'
  ) then
    create policy "Users can update own fitness profile"
      on public.fitness_profiles
      for update
      to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end
$$;

drop trigger if exists fitness_profiles_set_updated_at on public.fitness_profiles;
create trigger fitness_profiles_set_updated_at
  before update on public.fitness_profiles
  for each row
  execute function public.set_timestamp_updated_at();

create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  stripe_price_id text,
  status text not null default 'inactive',
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'subscriptions' and policyname = 'Users can view own subscriptions'
  ) then
    create policy "Users can view own subscriptions"
      on public.subscriptions
      for select
      to authenticated
      using (auth.uid() = user_id);
  end if;
end
$$;

drop trigger if exists subscriptions_set_updated_at on public.subscriptions;
create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row
  execute function public.set_timestamp_updated_at();
