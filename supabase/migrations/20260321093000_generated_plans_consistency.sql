create or replace function public.set_timestamp_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

alter table public.generated_plans
  add column if not exists updated_at timestamptz not null default now();

update public.generated_plans
set updated_at = created_at
where updated_at is null;

with ranked as (
  select
    id,
    row_number() over (
      partition by user_id, plan_type
      order by coalesce(updated_at, created_at) desc, created_at desc, id desc
    ) as rn
  from public.generated_plans
)
delete from public.generated_plans gp
using ranked
where gp.id = ranked.id
  and ranked.rn > 1;

create unique index if not exists generated_plans_user_plan_type_idx
  on public.generated_plans (user_id, plan_type);

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'generated_plans'
      and policyname = 'Users can update own plans'
  ) then
    create policy "Users can update own plans"
      on public.generated_plans
      for update
      to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end
$$;

drop trigger if exists generated_plans_set_updated_at on public.generated_plans;
create trigger generated_plans_set_updated_at
  before update on public.generated_plans
  for each row
  execute function public.set_timestamp_updated_at();
