-- Stored residual ratings alongside inherent likelihood × impact.
-- Run after 007_governance.sql (uses risks + rcsa_reviews). Safe to re-run.
-- Inherent stays in likelihood / impact. Residual is the net rating after
-- current controls, confirmed in RCSA. Both residual columns are null until
-- assessed. Residual cannot exceed inherent on either axis.

create extension if not exists "pgcrypto";

alter table public.risks
  add column if not exists residual_likelihood smallint;

alter table public.risks
  add column if not exists residual_impact smallint;

alter table public.rcsa_reviews
  add column if not exists previous_residual_likelihood smallint;

alter table public.rcsa_reviews
  add column if not exists previous_residual_impact smallint;

alter table public.rcsa_reviews
  add column if not exists final_residual_likelihood smallint;

alter table public.rcsa_reviews
  add column if not exists final_residual_impact smallint;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'risks_residual_pair_check'
  ) then
    alter table public.risks
      add constraint risks_residual_pair_check
      check (
        (residual_likelihood is null and residual_impact is null)
        or (
          residual_likelihood between 1 and 5
          and residual_impact between 1 and 5
          and residual_likelihood <= likelihood
          and residual_impact <= impact
        )
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'rcsa_reviews_previous_residual_pair_check'
  ) then
    alter table public.rcsa_reviews
      add constraint rcsa_reviews_previous_residual_pair_check
      check (
        (previous_residual_likelihood is null and previous_residual_impact is null)
        or (
          previous_residual_likelihood between 1 and 5
          and previous_residual_impact between 1 and 5
        )
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'rcsa_reviews_final_residual_pair_check'
  ) then
    alter table public.rcsa_reviews
      add constraint rcsa_reviews_final_residual_pair_check
      check (
        (final_residual_likelihood is null and final_residual_impact is null)
        or (
          final_residual_likelihood between 1 and 5
          and final_residual_impact between 1 and 5
        )
      );
  end if;
end
$$;
