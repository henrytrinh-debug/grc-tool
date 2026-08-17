-- Append-only risk and incident event history, plus risk closure rationale.
-- Run after 005_operating.sql. Safe to re-run.
-- No update/delete policies: historical events are immutable.
-- organization_id is reserved for a future membership migration (Workstream C).

create extension if not exists "pgcrypto";

alter table public.risks
  add column if not exists closure_rationale text not null default '';

create table if not exists public.risk_events (
  id uuid primary key default gen_random_uuid(),
  risk_id uuid not null references public.risks (id) on delete cascade,
  event_type text not null,
  field text not null,
  previous_value text not null default '',
  next_value text not null default '',
  actor_id uuid not null references auth.users (id) on delete restrict,
  actor_email text,
  owner_id uuid not null references auth.users (id) on delete cascade,
  owner_email text,
  organization_id uuid,
  created_at timestamptz not null default now(),
  constraint risk_events_type_check check (
    event_type in ('status', 'treatment', 'assignment', 'rating')
  )
);

create table if not exists public.incident_events (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents (id) on delete cascade,
  event_type text not null,
  field text not null,
  previous_value text not null default '',
  next_value text not null default '',
  actor_id uuid not null references auth.users (id) on delete restrict,
  actor_email text,
  owner_id uuid not null references auth.users (id) on delete cascade,
  owner_email text,
  organization_id uuid,
  created_at timestamptz not null default now(),
  constraint incident_events_type_check check (
    event_type in ('status', 'assignment', 'rating')
  )
);

create index if not exists risk_events_risk_id_idx on public.risk_events (risk_id);
create index if not exists risk_events_owner_id_idx on public.risk_events (owner_id);
create index if not exists risk_events_created_at_idx on public.risk_events (created_at desc);
create index if not exists incident_events_incident_id_idx
  on public.incident_events (incident_id);
create index if not exists incident_events_owner_id_idx
  on public.incident_events (owner_id);
create index if not exists incident_events_created_at_idx
  on public.incident_events (created_at desc);

alter table public.risk_events enable row level security;
alter table public.incident_events enable row level security;

do $$
declare
  target_table text;
begin
  foreach target_table in array array['risk_events', 'incident_events']
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
      'create policy %I on public.%I for insert with check (
         auth.uid() = owner_id and auth.uid() = actor_id
       )',
      target_table || '_owner_insert',
      target_table
    );
  end loop;
end
$$;

grant select, insert on table public.risk_events to authenticated;
grant select, insert on table public.incident_events to authenticated;
