alter table public.nutrition_logs
  add column if not exists meal_name text;

update public.nutrition_logs
set meal_name = coalesce(nullif(meal_name, ''), 'Comida')
where meal_name is null or meal_name = '';

alter table public.nutrition_logs
  alter column meal_name set default 'Comida';

alter table public.nutrition_logs
  alter column meal_name set not null;
