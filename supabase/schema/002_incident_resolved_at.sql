-- Adds resolved_at tracking to incidents, enabling incident stock/flow and
-- mean-time-to-resolve metrics on the Oversight Monitoring dashboard.
-- Run this in the Supabase SQL editor. Safe to re-run.

alter table if exists public.incidents
  add column if not exists resolved_at timestamptz;

-- Incidents already marked resolved never went through the app-level stamp,
-- so backfill from created_at (the closest existing timestamp). Using now()
-- would incorrectly dump historical closures into the trailing 30-day flow.
update public.incidents
set resolved_at = coalesce(created_at, now())
where status = 'resolved'
  and resolved_at is null;
