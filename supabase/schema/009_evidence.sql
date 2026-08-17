-- Evidence metadata linked to GRC records, plus a private Storage bucket.
-- Run after 008_obligations.sql (obligations FK). Safe to re-run.
-- Uploads use the signed-in user's JWT. Never use the service-role key in the app.
-- organization_id is reserved for a future membership migration (Workstream C).
--
-- Storage: objects live at {owner_id}/{evidence_id}/{filename}.
-- If the storage schema is unavailable in this editor, metadata still works;
-- create the private `grc-evidence` bucket and object policies from the
-- Storage Access Control docs: https://supabase.com/docs/guides/storage/security/access-control

create extension if not exists "pgcrypto";

create table if not exists public.evidence (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  evidence_date date,
  source text not null default '',
  retention_date date,
  entity_type text not null,
  entity_id uuid not null,
  storage_path text,
  original_filename text not null default '',
  assignee_id uuid references public.org_people (id) on delete set null,
  owner_id uuid not null references auth.users (id) on delete cascade,
  owner_email text,
  organization_id uuid,
  created_at timestamptz not null default now(),
  constraint evidence_entity_type_check check (
    entity_type in (
      'risk',
      'control',
      'test',
      'incident',
      'issue',
      'obligation'
    )
  )
);

create index if not exists evidence_owner_id_idx on public.evidence (owner_id);
create index if not exists evidence_entity_idx
  on public.evidence (entity_type, entity_id);
create index if not exists evidence_retention_date_idx
  on public.evidence (retention_date);

alter table public.evidence enable row level security;

do $$
begin
  execute format(
    'drop policy if exists %I on public.evidence',
    'evidence_owner_select'
  );
  execute format(
    'create policy %I on public.evidence for select using (auth.uid() = owner_id)',
    'evidence_owner_select'
  );
  execute format(
    'drop policy if exists %I on public.evidence',
    'evidence_owner_insert'
  );
  execute format(
    'create policy %I on public.evidence for insert with check (auth.uid() = owner_id)',
    'evidence_owner_insert'
  );
  execute format(
    'drop policy if exists %I on public.evidence',
    'evidence_owner_update'
  );
  execute format(
    'create policy %I on public.evidence for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id)',
    'evidence_owner_update'
  );
  execute format(
    'drop policy if exists %I on public.evidence',
    'evidence_owner_delete'
  );
  execute format(
    'create policy %I on public.evidence for delete using (auth.uid() = owner_id)',
    'evidence_owner_delete'
  );
end
$$;

grant select, insert, update, delete on table public.evidence to authenticated;

-- Private bucket and owner-folder policies. Skip quietly if storage is not
-- exposed to this SQL session.
do $$
begin
  if not exists (
    select 1 from information_schema.schemata where schema_name = 'storage'
  ) then
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit)
  values ('grc-evidence', 'grc-evidence', false, 10485760)
  on conflict (id) do update
    set public = excluded.public,
        file_size_limit = excluded.file_size_limit;

  execute 'drop policy if exists grc_evidence_select on storage.objects';
  execute $policy$
    create policy grc_evidence_select
    on storage.objects
    for select
    to authenticated
    using (
      bucket_id = 'grc-evidence'
      and (storage.foldername(name))[1] = auth.uid()::text
    )
  $policy$;

  execute 'drop policy if exists grc_evidence_insert on storage.objects';
  execute $policy$
    create policy grc_evidence_insert
    on storage.objects
    for insert
    to authenticated
    with check (
      bucket_id = 'grc-evidence'
      and (storage.foldername(name))[1] = auth.uid()::text
    )
  $policy$;

  execute 'drop policy if exists grc_evidence_update on storage.objects';
  execute $policy$
    create policy grc_evidence_update
    on storage.objects
    for update
    to authenticated
    using (
      bucket_id = 'grc-evidence'
      and (storage.foldername(name))[1] = auth.uid()::text
    )
    with check (
      bucket_id = 'grc-evidence'
      and (storage.foldername(name))[1] = auth.uid()::text
    )
  $policy$;

  execute 'drop policy if exists grc_evidence_delete on storage.objects';
  execute $policy$
    create policy grc_evidence_delete
    on storage.objects
    for delete
    to authenticated
    using (
      bucket_id = 'grc-evidence'
      and (storage.foldername(name))[1] = auth.uid()::text
    )
  $policy$;
exception
  when others then
    raise notice 'Skipped storage bucket/policies: %', sqlerrm;
end
$$;
