-- Owner-scoped compliance obligations and mappings to controls and issues.
-- Run after 004_enterprise.sql. Safe to re-run.
-- This is a register, not a regulatory-content ingestion engine.
-- organization_id is reserved for a future membership migration (Workstream C).

create extension if not exists "pgcrypto";

create table if not exists public.obligations (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  source text not null default '',
  citation text not null default '',
  requirement_text text not null default '',
  status text not null default 'open',
  review_frequency_days int not null default 365,
  effective_date date,
  review_date date,
  assignee_id uuid references public.org_people (id) on delete set null,
  owner_id uuid not null references auth.users (id) on delete cascade,
  owner_email text,
  organization_id uuid,
  created_at timestamptz not null default now(),
  constraint obligations_status_check check (
    status in ('open', 'monitoring', 'retired')
  ),
  constraint obligations_frequency_check check (review_frequency_days >= 1)
);

create table if not exists public.obligation_controls (
  id uuid primary key default gen_random_uuid(),
  obligation_id uuid not null references public.obligations (id) on delete cascade,
  control_id uuid not null references public.controls (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (obligation_id, control_id)
);

create table if not exists public.obligation_issues (
  id uuid primary key default gen_random_uuid(),
  obligation_id uuid not null references public.obligations (id) on delete cascade,
  issue_id uuid not null references public.issues (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (obligation_id, issue_id)
);

create index if not exists obligations_owner_id_idx on public.obligations (owner_id);
create index if not exists obligations_review_date_idx on public.obligations (review_date);
create index if not exists obligation_controls_obligation_id_idx
  on public.obligation_controls (obligation_id);
create index if not exists obligation_controls_control_id_idx
  on public.obligation_controls (control_id);
create index if not exists obligation_issues_obligation_id_idx
  on public.obligation_issues (obligation_id);
create index if not exists obligation_issues_issue_id_idx
  on public.obligation_issues (issue_id);

alter table public.obligations enable row level security;
alter table public.obligation_controls enable row level security;
alter table public.obligation_issues enable row level security;

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'obligations',
    'obligation_controls',
    'obligation_issues'
  ]
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

grant select, insert, update, delete on table public.obligations to authenticated;
grant select, insert, delete on table public.obligation_controls to authenticated;
grant select, insert, delete on table public.obligation_issues to authenticated;
