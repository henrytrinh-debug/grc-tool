-- Issue management module.
-- Run this in the Supabase SQL editor. Safe to re-run.

create extension if not exists "pgcrypto";

-- Issues (findings) raised from audits, control failures, incidents, or assessments.
create table if not exists public.issues (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  source text not null default 'self_identified',
  severity text not null default 'medium',
  status text not null default 'open',
  identified_at date not null default current_date,
  due_date date,
  root_cause text not null default '',
  remediation_plan text not null default '',
  closure_notes text not null default '',
  closed_at timestamptz,
  owner_id uuid not null references auth.users (id) on delete cascade,
  owner_email text,
  created_at timestamptz not null default now(),
  constraint issues_source_check check (
    source in (
      'internal_audit',
      'external_audit',
      'regulatory_exam',
      'control_failure',
      'incident',
      'risk_assessment',
      'self_identified'
    )
  ),
  constraint issues_severity_check check (
    severity in ('low', 'medium', 'high', 'critical')
  ),
  constraint issues_status_check check (
    status in ('open', 'in_progress', 'pending_review', 'closed')
  )
);

-- Remediation action plan items belonging to an issue.
create table if not exists public.issue_actions (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.issues (id) on delete cascade,
  description text not null,
  assignee_email text not null default '',
  due_date date,
  status text not null default 'open',
  completed_at timestamptz,
  owner_id uuid not null references auth.users (id) on delete cascade,
  owner_email text,
  created_at timestamptz not null default now(),
  constraint issue_actions_status_check check (
    status in ('open', 'in_progress', 'completed')
  )
);

-- Append-only activity trail: manual comments plus automatic status-change entries.
create table if not exists public.issue_comments (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.issues (id) on delete cascade,
  body text not null,
  kind text not null default 'comment',
  owner_id uuid not null references auth.users (id) on delete cascade,
  owner_email text,
  created_at timestamptz not null default now(),
  constraint issue_comments_kind_check check (
    kind in ('comment', 'status_change')
  )
);

create table if not exists public.issue_risks (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.issues (id) on delete cascade,
  risk_id uuid not null references public.risks (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (issue_id, risk_id)
);

create table if not exists public.issue_controls (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.issues (id) on delete cascade,
  control_id uuid not null references public.controls (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (issue_id, control_id)
);

create index if not exists issues_owner_id_idx on public.issues (owner_id);
create index if not exists issues_status_idx on public.issues (status);
create index if not exists issue_actions_issue_id_idx on public.issue_actions (issue_id);
create index if not exists issue_comments_issue_id_idx on public.issue_comments (issue_id);
create index if not exists issue_risks_issue_id_idx on public.issue_risks (issue_id);
create index if not exists issue_controls_issue_id_idx on public.issue_controls (issue_id);

alter table public.issues enable row level security;
alter table public.issue_actions enable row level security;
alter table public.issue_comments enable row level security;
alter table public.issue_risks enable row level security;
alter table public.issue_controls enable row level security;

-- Owner-scoped RLS, matching the pattern used by the existing tables.
do $$
declare
  target_table text;
begin
  for target_table in
    select unnest(array[
      'issues',
      'issue_actions',
      'issue_comments',
      'issue_risks',
      'issue_controls'
    ])
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
