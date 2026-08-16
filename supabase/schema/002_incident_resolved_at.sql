-- Adds resolved_at tracking to incidents, enabling incident stock/flow and
-- mean-time-to-resolve metrics on the Oversight Monitoring dashboard.
-- Run this in the Supabase SQL editor. Safe to re-run.

alter table if exists public.incidents
  add column if not exists resolved_at timestamptz;
