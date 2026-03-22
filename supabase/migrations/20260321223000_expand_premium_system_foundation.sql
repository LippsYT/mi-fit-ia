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

alter table public.fitness_profiles
  add column if not exists full_name text,
  add column if not exists target_weight numeric,
  add column if not exists experience_level text,
  add column if not exists training_type text,
  add column if not exists equipment jsonb not null default '[]'::jsonb,
  add column if not exists dietary_restrictions jsonb not null default '[]'::jsonb,
  add column if not exists allergies text,
  add column if not exists preferred_foods jsonb not null default '[]'::jsonb,
  add column if not exists rejected_foods jsonb not null default '[]'::jsonb,
  add column if not exists food_budget text,
  add column if not exists cooking_time text,
  add column if not exists country text,
  add column if not exists cuisine_style text,
  add column if not exists injuries text,
  add column if not exists onboarding_completed boolean not null default false;

create table if not exists public.onboarding_answers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.system_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  version_kind text not null default 'initial'
    check (version_kind in ('initial', 'weekly_adjustment', 'monthly_refresh', 'manual_adjustment')),
  nutrition_plan_id uuid references public.generated_plans(id) on delete set null,
  workout_plan_id uuid references public.generated_plans(id) on delete set null,
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.shopping_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_label text not null,
  mode text not null default 'standard'
    check (mode in ('standard', 'ahorro', 'rapido', 'sin_cocinar')),
  estimated_cost numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shopping_list_items (
  id uuid primary key default gen_random_uuid(),
  shopping_list_id uuid not null references public.shopping_lists(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null,
  item_name text not null,
  quantity text,
  checked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.body_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  measurement_date date not null default current_date,
  weight numeric,
  waist numeric,
  chest numeric,
  hips numeric,
  arms numeric,
  thighs numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists body_measurements_user_measurement_date_idx
  on public.body_measurements (user_id, measurement_date);

create table if not exists public.progress_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null default current_date,
  weight numeric,
  adherence numeric,
  streak_days integer not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.progress_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  shot_date date not null default current_date,
  view_type text not null default 'front'
    check (view_type in ('front', 'side', 'back', 'custom')),
  image_url text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null
    check (kind in ('daily_reminder', 'weekly_checkin', 'streak', 'inactivity', 'weekly_summary', 'billing')),
  title text not null,
  body text not null,
  scheduled_for timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_type text not null default 'coach'
    check (conversation_type in ('coach', 'nutrition', 'training', 'support')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.onboarding_answers enable row level security;
alter table public.system_versions enable row level security;
alter table public.shopping_lists enable row level security;
alter table public.shopping_list_items enable row level security;
alter table public.body_measurements enable row level security;
alter table public.progress_logs enable row level security;
alter table public.progress_photos enable row level security;
alter table public.notifications enable row level security;
alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'onboarding_answers' and policyname = 'Users can manage own onboarding answers'
  ) then
    create policy "Users can manage own onboarding answers"
      on public.onboarding_answers
      for all
      to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'system_versions' and policyname = 'Users can view own system versions'
  ) then
    create policy "Users can view own system versions"
      on public.system_versions
      for select
      to authenticated
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'shopping_lists' and policyname = 'Users can manage own shopping lists'
  ) then
    create policy "Users can manage own shopping lists"
      on public.shopping_lists
      for all
      to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'shopping_list_items' and policyname = 'Users can manage own shopping list items'
  ) then
    create policy "Users can manage own shopping list items"
      on public.shopping_list_items
      for all
      to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'body_measurements' and policyname = 'Users can manage own body measurements'
  ) then
    create policy "Users can manage own body measurements"
      on public.body_measurements
      for all
      to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'progress_logs' and policyname = 'Users can manage own progress logs'
  ) then
    create policy "Users can manage own progress logs"
      on public.progress_logs
      for all
      to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'progress_photos' and policyname = 'Users can manage own progress photos'
  ) then
    create policy "Users can manage own progress photos"
      on public.progress_photos
      for all
      to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'notifications' and policyname = 'Users can view own notifications'
  ) then
    create policy "Users can view own notifications"
      on public.notifications
      for select
      to authenticated
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'notifications' and policyname = 'Users can update own notifications'
  ) then
    create policy "Users can update own notifications"
      on public.notifications
      for update
      to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'ai_conversations' and policyname = 'Users can manage own ai conversations'
  ) then
    create policy "Users can manage own ai conversations"
      on public.ai_conversations
      for all
      to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'ai_messages' and policyname = 'Users can manage own ai messages'
  ) then
    create policy "Users can manage own ai messages"
      on public.ai_messages
      for all
      to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end
$$;

drop trigger if exists onboarding_answers_set_updated_at on public.onboarding_answers;
create trigger onboarding_answers_set_updated_at
  before update on public.onboarding_answers
  for each row execute function public.set_timestamp_updated_at();

drop trigger if exists shopping_lists_set_updated_at on public.shopping_lists;
create trigger shopping_lists_set_updated_at
  before update on public.shopping_lists
  for each row execute function public.set_timestamp_updated_at();

drop trigger if exists shopping_list_items_set_updated_at on public.shopping_list_items;
create trigger shopping_list_items_set_updated_at
  before update on public.shopping_list_items
  for each row execute function public.set_timestamp_updated_at();

drop trigger if exists body_measurements_set_updated_at on public.body_measurements;
create trigger body_measurements_set_updated_at
  before update on public.body_measurements
  for each row execute function public.set_timestamp_updated_at();

drop trigger if exists progress_logs_set_updated_at on public.progress_logs;
create trigger progress_logs_set_updated_at
  before update on public.progress_logs
  for each row execute function public.set_timestamp_updated_at();

drop trigger if exists progress_photos_set_updated_at on public.progress_photos;
create trigger progress_photos_set_updated_at
  before update on public.progress_photos
  for each row execute function public.set_timestamp_updated_at();

drop trigger if exists notifications_set_updated_at on public.notifications;
create trigger notifications_set_updated_at
  before update on public.notifications
  for each row execute function public.set_timestamp_updated_at();

drop trigger if exists ai_conversations_set_updated_at on public.ai_conversations;
create trigger ai_conversations_set_updated_at
  before update on public.ai_conversations
  for each row execute function public.set_timestamp_updated_at();
