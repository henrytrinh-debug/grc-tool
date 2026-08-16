-- Admin / organisation settings, risk taxonomy, and optional treatment on risks.
-- Run this in the Supabase SQL editor. Safe to re-run.

create extension if not exists "pgcrypto";

create table if not exists public.org_settings (
  owner_id uuid primary key references auth.users (id) on delete cascade,
  owner_email text,
  organization_name text not null default 'My organisation',
  likelihood_labels jsonb not null default '{"1":"Rare","2":"Unlikely","3":"Possible","4":"Likely","5":"Almost certain"}'::jsonb,
  impact_labels jsonb not null default '{"1":"Negligible","2":"Minor","3":"Moderate","4":"Major","5":"Severe"}'::jsonb,
  band_max_low int2 not null default 5,
  band_max_medium int2 not null default 10,
  band_max_high int2 not null default 19,
  review_cadence_low int not null default 365,
  review_cadence_medium int not null default 365,
  review_cadence_high int not null default 180,
  review_cadence_critical int not null default 90,
  key_testing_cadence_days int not null default 180,
  non_key_testing_cadence_days int not null default 365,
  issue_due_critical int not null default 30,
  issue_due_high int not null default 60,
  issue_due_medium int not null default 90,
  issue_due_low int not null default 180,
  demo_ids jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.risk_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  sort_order int not null default 0,
  owner_id uuid not null references auth.users (id) on delete cascade,
  owner_email text,
  created_at timestamptz not null default now(),
  unique (owner_id, name)
);

alter table public.risks
  add column if not exists category_id uuid references public.risk_categories (id) on delete set null;

alter table public.risks
  add column if not exists treatment text;

update public.risks
set treatment = 'mitigate'
where treatment is null;

alter table public.risks
  alter column treatment set default 'mitigate';

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'risks'
      and column_name = 'treatment'
  ) then
    alter table public.risks drop constraint if exists risks_treatment_check;
    alter table public.risks
      add constraint risks_treatment_check
      check (treatment in ('mitigate', 'accept', 'transfer', 'avoid'));
  end if;
end
$$;

create index if not exists risk_categories_owner_id_idx
  on public.risk_categories (owner_id);

create index if not exists risks_category_id_idx
  on public.risks (category_id);

alter table public.org_settings enable row level security;
alter table public.risk_categories enable row level security;

do $$
declare
  target_table text;
begin
  for target_table in
    select unnest(array['org_settings', 'risk_categories'])
  loop
    execute format(
      'drop policy if exists %I on public.%I',
      target_table || '_owner_select',
      target_table
    );
    execute format(
      'create policy %I on public.%I for select using (auth.uid() = owner_id)',
      target_table || '_owner_select',
      target_table
    );

    execute format(
      'drop policy if exists %I on public.%I',
      target_table || '_owner_insert',
      target_table
    );
    execute format(
      'create policy %I on public.%I for insert with check (auth.uid() = owner_id)',
      target_table || '_owner_insert',
      target_table
    );

    execute format(
      'drop policy if exists %I on public.%I',
      target_table || '_owner_update',
      target_table
    );
    execute format(
      'create policy %I on public.%I for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id)',
      target_table || '_owner_update',
      target_table
    );

    execute format(
      'drop policy if exists %I on public.%I',
      target_table || '_owner_delete',
      target_table
    );
    execute format(
      'create policy %I on public.%I for delete using (auth.uid() = owner_id)',
      target_table || '_owner_delete',
      target_table
    );
  end loop;
end
$$;

grant select, insert, update, delete on table public.org_settings to authenticated;
grant select, insert, update, delete on table public.risk_categories to authenticated;
