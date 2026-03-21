create extension if not exists pgcrypto;

alter table public.profiles
  add column if not exists stripe_customer_id text;

create unique index if not exists profiles_stripe_customer_id_idx
  on public.profiles (stripe_customer_id)
  where stripe_customer_id is not null;

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  stripe_price_id text,
  status text not null default 'inactive'
    check (status in ('incomplete', 'incomplete_expired', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused', 'inactive')),
  cancel_at_period_end boolean not null default false,
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscriptions_user_status_idx
  on public.subscriptions (user_id, status);

alter table public.subscriptions enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'subscriptions'
      and policyname = 'Users can view own subscriptions'
  ) then
    create policy "Users can view own subscriptions"
      on public.subscriptions
      for select
      to authenticated
      using (auth.uid() = user_id);
  end if;
end
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.sync_profile_subscription_status(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  active_subscription boolean;
  next_customer_id text;
begin
  select exists (
    select 1
    from public.subscriptions
    where user_id = target_user_id
      and status in ('active', 'trialing')
      and (current_period_end is null or current_period_end > now())
  )
  into active_subscription;

  select stripe_customer_id
  into next_customer_id
  from public.subscriptions
  where user_id = target_user_id
  limit 1;

  update public.profiles
  set
    is_subscribed = coalesce(active_subscription, false),
    stripe_customer_id = coalesce(next_customer_id, stripe_customer_id),
    updated_at = now()
  where id = target_user_id;
end;
$$;

create or replace function public.handle_subscription_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sync_profile_subscription_status(coalesce(new.user_id, old.user_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists subscriptions_set_updated_at on public.subscriptions;
create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row
  execute function public.set_updated_at();

drop trigger if exists sync_profile_subscription_status on public.subscriptions;
create trigger sync_profile_subscription_status
  after insert or update or delete on public.subscriptions
  for each row
  execute function public.handle_subscription_change();
