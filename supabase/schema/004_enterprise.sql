-- Enterprise operating model: people directory, accountable owners, risk
-- status, control type, and taxonomy appetite. Run after 003_admin_settings.sql.
-- Safe to re-run.

create extension if not exists "pgcrypto";

create table if not exists public.org_people (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  title text not null default '',
  department text not null default '',
  line_of_defence text not null default 'first',
  owner_id uuid not null references auth.users (id) on delete cascade,
  owner_email text,
  created_at timestamptz not null default now(),
  unique (owner_id, email),
  constraint org_people_lod_check check (
    line_of_defence in ('first', 'second', 'third')
  )
);

create index if not exists org_people_owner_id_idx
  on public.org_people (owner_id);

alter table public.risk_categories
  add column if not exists appetite_band text;

update public.risk_categories
set appetite_band = 'High'
where appetite_band is null;

alter table public.risk_categories
  alter column appetite_band set default 'High';

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'risk_categories'
      and column_name = 'appetite_band'
  ) then
    alter table public.risk_categories drop constraint if exists risk_categories_appetite_band_check;
    alter table public.risk_categories
      add constraint risk_categories_appetite_band_check
      check (appetite_band in ('Low', 'Medium', 'High', 'Critical'));
  end if;
end
$$;

alter table public.risks
  add column if not exists assignee_id uuid references public.org_people (id) on delete set null;

alter table public.risks
  add column if not exists status text;

update public.risks
set status = 'open'
where status is null;

alter table public.risks
  alter column status set default 'open';

do $$
begin
  alter table public.risks drop constraint if exists risks_status_check;
  alter table public.risks
    add constraint risks_status_check
    check (status in ('open', 'monitoring', 'closed'));
end
$$;

alter table public.controls
  add column if not exists assignee_id uuid references public.org_people (id) on delete set null;

alter table public.controls
  add column if not exists control_type text;

update public.controls
set control_type = 'preventive'
where control_type is null;

alter table public.controls
  alter column control_type set default 'preventive';

do $$
begin
  alter table public.controls drop constraint if exists controls_control_type_check;
  alter table public.controls
    add constraint controls_control_type_check
    check (control_type in ('preventive', 'detective', 'corrective'));
end
$$;

alter table public.incidents
  add column if not exists assignee_id uuid references public.org_people (id) on delete set null;

alter table public.issues
  add column if not exists assignee_id uuid references public.org_people (id) on delete set null;

create index if not exists risks_assignee_id_idx on public.risks (assignee_id);
create index if not exists controls_assignee_id_idx on public.controls (assignee_id);
create index if not exists incidents_assignee_id_idx on public.incidents (assignee_id);
create index if not exists issues_assignee_id_idx on public.issues (assignee_id);

alter table public.org_people enable row level security;

do $$
begin
  execute format(
    'drop policy if exists %I on public.org_people',
    'org_people_owner_select'
  );
  execute format(
    'create policy %I on public.org_people for select using (auth.uid() = owner_id)',
    'org_people_owner_select'
  );
  execute format(
    'drop policy if exists %I on public.org_people',
    'org_people_owner_insert'
  );
  execute format(
    'create policy %I on public.org_people for insert with check (auth.uid() = owner_id)',
    'org_people_owner_insert'
  );
  execute format(
    'drop policy if exists %I on public.org_people',
    'org_people_owner_update'
  );
  execute format(
    'create policy %I on public.org_people for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id)',
    'org_people_owner_update'
  );
  execute format(
    'drop policy if exists %I on public.org_people',
    'org_people_owner_delete'
  );
  execute format(
    'create policy %I on public.org_people for delete using (auth.uid() = owner_id)',
    'org_people_owner_delete'
  );
end
$$;

grant select, insert, update, delete on table public.org_people to authenticated;
