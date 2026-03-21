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

alter table public.nutrition_logs
  add column if not exists meal_type text,
  add column if not exists food_description text,
  add column if not exists ai_summary text;

create table if not exists public.ai_consultations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  consultation_type text not null default 'quick_question',
  question text not null,
  answer text not null,
  action_steps jsonb not null default '[]'::jsonb,
  context_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_consultations_user_created_at_idx
  on public.ai_consultations (user_id, created_at desc);

alter table public.ai_consultations enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'ai_consultations' and policyname = 'Users can view own ai consultations'
  ) then
    create policy "Users can view own ai consultations"
      on public.ai_consultations
      for select
      to authenticated
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'ai_consultations' and policyname = 'Users can insert own ai consultations'
  ) then
    create policy "Users can insert own ai consultations"
      on public.ai_consultations
      for insert
      to authenticated
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'ai_consultations' and policyname = 'Users can update own ai consultations'
  ) then
    create policy "Users can update own ai consultations"
      on public.ai_consultations
      for update
      to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'ai_consultations' and policyname = 'Users can delete own ai consultations'
  ) then
    create policy "Users can delete own ai consultations"
      on public.ai_consultations
      for delete
      to authenticated
      using (auth.uid() = user_id);
  end if;
end
$$;

drop trigger if exists ai_consultations_set_updated_at on public.ai_consultations;
create trigger ai_consultations_set_updated_at
  before update on public.ai_consultations
  for each row
  execute function public.set_timestamp_updated_at();

create table if not exists public.workout_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid not null references public.generated_plans(id) on delete cascade,
  workout_day text not null,
  completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists workout_progress_user_plan_day_idx
  on public.workout_progress (user_id, plan_id, workout_day);

alter table public.workout_progress enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'workout_progress' and policyname = 'Users can view own workout progress'
  ) then
    create policy "Users can view own workout progress"
      on public.workout_progress
      for select
      to authenticated
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'workout_progress' and policyname = 'Users can insert own workout progress'
  ) then
    create policy "Users can insert own workout progress"
      on public.workout_progress
      for insert
      to authenticated
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'workout_progress' and policyname = 'Users can update own workout progress'
  ) then
    create policy "Users can update own workout progress"
      on public.workout_progress
      for update
      to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'workout_progress' and policyname = 'Users can delete own workout progress'
  ) then
    create policy "Users can delete own workout progress"
      on public.workout_progress
      for delete
      to authenticated
      using (auth.uid() = user_id);
  end if;
end
$$;

drop trigger if exists workout_progress_set_updated_at on public.workout_progress;
create trigger workout_progress_set_updated_at
  before update on public.workout_progress
  for each row
  execute function public.set_timestamp_updated_at();
