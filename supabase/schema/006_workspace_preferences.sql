-- Workspace presentation preferences on org_settings.
-- Run after 003_admin_settings.sql. Safe to re-run.
-- Visibility stored here is presentation only — not authorization.

alter table public.org_settings
  add column if not exists workspace_preferences jsonb not null default '{}'::jsonb;
