-- Cross-record comments, follow-up actions (feedback loops), and RCSA
-- approvers. Run after 010_residual.sql. Safe to re-run.
-- Approvers are org_people labels, not extra logins. Tenant remains owner_id.
-- organization_id is reserved for a future membership migration (Workstream C).

create extension if not exists "pgcrypto";

alter table public.rcsa_reviews
  add column if not exists approver_id uuid references public.org_people (id) on delete set null;

alter table public.rcsa_reviews
  add column if not exists approval_status text;

alter table public.rcsa_reviews
  add column if not exists approved_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'rcsa_reviews_approval_status_check'
  ) then
    alter table public.rcsa_reviews
      add constraint rcsa_reviews_approval_status_check
      check (
        approval_status is null
        or approval_status in ('not_required', 'pending', 'approved', 'rejected')
      );
  end if;
end
$$;

create table if not exists public.entity_comments (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  body text not null,
  kind text not null default 'comment',
  owner_id uuid not null references auth.users (id) on delete cascade,
  owner_email text,
  organization_id uuid,
  created_at timestamptz not null default now(),
  constraint entity_comments_entity_type_check check (
    entity_type in (
      'risk',
      'control',
      'incident',
      'issue',
      'obligation',
      'follow_up'
    )
  ),
  constraint entity_comments_kind_check check (
    kind in ('comment', 'status_change')
  )
);

create index if not exists entity_comments_owner_id_idx
  on public.entity_comments (owner_id);
create index if not exists entity_comments_entity_idx
  on public.entity_comments (entity_type, entity_id, created_at desc);

create table if not exists public.follow_ups (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  entity_type text not null,
  entity_id uuid not null,
  trigger_type text not null,
  status text not null default 'open',
  assignee_id uuid references public.org_people (id) on delete set null,
  approver_id uuid references public.org_people (id) on delete set null,
  due_date date,
  source_incident_id uuid references public.incidents (id) on delete set null,
  source_issue_id uuid references public.issues (id) on delete set null,
  completed_at timestamptz,
  owner_id uuid not null references auth.users (id) on delete cascade,
  owner_email text,
  organization_id uuid,
  created_at timestamptz not null default now(),
  constraint follow_ups_entity_type_check check (
    entity_type in ('risk', 'control', 'incident', 'issue', 'obligation')
  ),
  constraint follow_ups_trigger_type_check check (
    trigger_type in (
      'incident_on_control',
      'issue_on_control',
      'ineffective_test',
      'incident_on_risk',
      'issue_on_risk',
      'rating_changed'
    )
  ),
  constraint follow_ups_status_check check (
    status in (
      'open',
      'in_progress',
      'pending_approval',
      'done',
      'dismissed'
    )
  )
);

create index if not exists follow_ups_owner_id_idx on public.follow_ups (owner_id);
create index if not exists follow_ups_entity_idx
  on public.follow_ups (entity_type, entity_id);
create index if not exists follow_ups_status_idx on public.follow_ups (status);
create unique index if not exists follow_ups_open_trigger_idx
  on public.follow_ups (owner_id, entity_type, entity_id, trigger_type)
  where status in ('open', 'in_progress', 'pending_approval');

alter table public.entity_comments enable row level security;
alter table public.follow_ups enable row level security;

do $$
declare
  target_table text;
begin
  foreach target_table in array array['entity_comments', 'follow_ups']
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
