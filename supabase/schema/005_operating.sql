-- Operating model: treatment targets, incident lessons, and incident↔control
-- links. Run after 004_enterprise.sql. Safe to re-run.

create extension if not exists "pgcrypto";

alter table public.risks
  add column if not exists treatment_rationale text not null default '';

alter table public.risks
  add column if not exists target_date date;

alter table public.incidents
  add column if not exists lessons_learned text not null default '';

create table if not exists public.incident_controls (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents (id) on delete cascade,
  control_id uuid not null references public.controls (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (incident_id, control_id)
);

create index if not exists incident_controls_incident_id_idx
  on public.incident_controls (incident_id);

create index if not exists incident_controls_control_id_idx
  on public.incident_controls (control_id);

create index if not exists risks_target_date_idx on public.risks (target_date);

alter table public.incident_controls enable row level security;

do $$
begin
  execute format(
    'drop policy if exists %I on public.incident_controls',
    'incident_controls_owner_select'
  );
  execute format(
    'create policy %I on public.incident_controls for select using (auth.uid() = owner_id)',
    'incident_controls_owner_select'
  );
  execute format(
    'drop policy if exists %I on public.incident_controls',
    'incident_controls_owner_insert'
  );
  execute format(
    'create policy %I on public.incident_controls for insert with check (auth.uid() = owner_id)',
    'incident_controls_owner_insert'
  );
  execute format(
    'drop policy if exists %I on public.incident_controls',
    'incident_controls_owner_delete'
  );
  execute format(
    'create policy %I on public.incident_controls for delete using (auth.uid() = owner_id)',
    'incident_controls_owner_delete'
  );
end
$$;

grant select, insert, delete on table public.incident_controls to authenticated;
