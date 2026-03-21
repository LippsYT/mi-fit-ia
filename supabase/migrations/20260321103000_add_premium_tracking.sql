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

create table if not exists public.nutrition_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  meal_name text not null,
  eaten_at timestamptz not null default now(),
  calories numeric not null default 0,
  protein numeric not null default 0,
  carbs numeric not null default 0,
  fats numeric not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.nutrition_logs
  add column if not exists eaten_at timestamptz not null default now(),
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists notes text,
  add column if not exists calories numeric not null default 0,
  add column if not exists protein numeric not null default 0,
  add column if not exists carbs numeric not null default 0,
  add column if not exists fats numeric not null default 0;

create index if not exists nutrition_logs_user_eaten_at_idx
  on public.nutrition_logs (user_id, eaten_at desc);

alter table public.nutrition_logs enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'nutrition_logs' and policyname = 'Users can view own nutrition logs'
  ) then
    create policy "Users can view own nutrition logs"
      on public.nutrition_logs
      for select
      to authenticated
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'nutrition_logs' and policyname = 'Users can insert own nutrition logs'
  ) then
    create policy "Users can insert own nutrition logs"
      on public.nutrition_logs
      for insert
      to authenticated
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'nutrition_logs' and policyname = 'Users can update own nutrition logs'
  ) then
    create policy "Users can update own nutrition logs"
      on public.nutrition_logs
      for update
      to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'nutrition_logs' and policyname = 'Users can delete own nutrition logs'
  ) then
    create policy "Users can delete own nutrition logs"
      on public.nutrition_logs
      for delete
      to authenticated
      using (auth.uid() = user_id);
  end if;
end
$$;

drop trigger if exists nutrition_logs_set_updated_at on public.nutrition_logs;
create trigger nutrition_logs_set_updated_at
  before update on public.nutrition_logs
  for each row
  execute function public.set_timestamp_updated_at();

create table if not exists public.progress_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  checkin_date date not null default current_date,
  weight numeric,
  waist numeric,
  energy_level integer check (energy_level between 1 and 5),
  adherence_score integer check (adherence_score between 1 and 5),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.progress_checkins
  add column if not exists checkin_date date not null default current_date,
  add column if not exists weight numeric,
  add column if not exists waist numeric,
  add column if not exists energy_level integer,
  add column if not exists adherence_score integer,
  add column if not exists notes text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists progress_checkins_user_checkin_date_idx
  on public.progress_checkins (user_id, checkin_date);

alter table public.progress_checkins enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'progress_checkins' and policyname = 'Users can view own progress checkins'
  ) then
    create policy "Users can view own progress checkins"
      on public.progress_checkins
      for select
      to authenticated
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'progress_checkins' and policyname = 'Users can insert own progress checkins'
  ) then
    create policy "Users can insert own progress checkins"
      on public.progress_checkins
      for insert
      to authenticated
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'progress_checkins' and policyname = 'Users can update own progress checkins'
  ) then
    create policy "Users can update own progress checkins"
      on public.progress_checkins
      for update
      to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'progress_checkins' and policyname = 'Users can delete own progress checkins'
  ) then
    create policy "Users can delete own progress checkins"
      on public.progress_checkins
      for delete
      to authenticated
      using (auth.uid() = user_id);
  end if;
end
$$;

drop trigger if exists progress_checkins_set_updated_at on public.progress_checkins;
create trigger progress_checkins_set_updated_at
  before update on public.progress_checkins
  for each row
  execute function public.set_timestamp_updated_at();
