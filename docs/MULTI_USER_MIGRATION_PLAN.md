# Multi-user migration plan

This is a design-only note. Do **not** apply tenancy or RLS changes from this document until a later workstream explicitly implements them. Today the tenant is still `owner_id = auth.uid()`. `org_people` remains a directory of accountable names, not extra logins.

## Goal

Move from one login = one isolated GRC workspace to many people sharing one organisation, with invitations, roles, and membership-scoped RLS. Historical rows stay readable. Rollback must be possible until dual-write is turned off.

## Target model

### `organizations`

| Column | Notes |
|---|---|
| `id` | uuid PK |
| `name` | display name (today’s Admin organisation name) |
| `created_at` | |
| `created_by` | auth user who created the org |

One organisation per existing owner during backfill.

### `organization_members`

| Column | Notes |
|---|---|
| `organization_id` | FK → organizations |
| `user_id` | FK → auth.users |
| `role` | `owner` \| `admin` \| `member` \| `viewer` (names can change; keep a small closed set) |
| `status` | `active` \| `disabled` |
| `created_at` | |

Unique `(organization_id, user_id)`.

### `organization_invitations`

| Column | Notes |
|---|---|
| `organization_id` | |
| `email` | invitee |
| `role` | role granted on accept |
| `invited_by` | auth user |
| `token_hash` | store a hash, not the raw token |
| `expires_at` | |
| `accepted_at` | nullable |

Accepting an invitation creates a member row and signs the user into that org. Do not grant access from email match on `org_people` alone.

## Roles and permissions (application + RLS)

Keep authorization in Postgres. The app should not be the only gate.

Suggested baseline:

- **viewer** — select on domain tables for their org; no inserts/updates/deletes.
- **member** — create and edit records; cannot change org settings, people directory admin actions, or membership.
- **admin** — member plus Admin settings, taxonomy, invitations, demo seed/remove.
- **owner** — admin plus transfer/delete organisation (later; not required for first cut).

Workspace module hiding stays **presentation only**. It is not a substitute for roles.

`org_people` stays a directory used by `assignee_id`. A member login is `organization_members.user_id`. A person row may later optionally point at `user_id` when the same human is both a login and an assignee, but that link is not required to ship membership.

## Domain tables: `organization_id` and `owner_id`

Every current domain table (risks, controls, incidents, issues, actions, comments, reviews, sessions, tests, join tables, events, obligations, evidence, settings, categories, people, preferences) gets:

```sql
alter table public.<table>
  add column if not exists organization_id uuid references public.organizations (id);
```

`007` / `008` / `009` already reserve nullable `organization_id` on new tables. Older tables need the same column.

**`owner_id` meaning after migration**

- Stop treating `owner_id` as the tenant.
- Where it still exists, treat it as **created_by** (the auth user who inserted the row).
- RLS tenant predicate becomes membership:

```sql
organization_id in (
  select organization_id
  from public.organization_members
  where user_id = auth.uid()
    and status = 'active'
)
```

Writes also check role. Event inserts keep `actor_id = auth.uid()`. Append-only event tables still have **no update/delete policies**.

Do not drop `owner_id` in the first cut. Dual-read needs it.

## Backfill

For each distinct `owner_id` on `org_settings` (fallback: distinct `owner_id` on `risks`):

1. Insert one `organizations` row (`name` from `org_settings.organisation_name` or the owner email).
2. Insert `organization_members` (`role = owner`, `user_id = that owner_id`).
3. Set `organization_id` on every domain row where `owner_id` equals that user.

Join tables use the link’s `owner_id` today; stamp them with the same org as that creator. If a link ever pointed at records from another owner (it should not in the current app), leave `organization_id` null and fail a pre-check rather than guessing.

After backfill, `organization_id` is not null on live rows. Add `not null` only after the check passes.

## Dual-read / dual-write

Ship in this order. Do not skip ahead.

1. **Schema only** — tables, nullable `organization_id`, no RLS change. App still filters `owner_id = auth.uid()`.
2. **Backfill** — populate orgs, members, `organization_id`.
3. **Dual-write** — inserts/updates set `organization_id` from the user’s active membership **and** keep writing `owner_id` / `created_by`.
4. **Dual-read** — selects use `organization_id` membership; keep `owner_id` equality as a debug fallback behind a flag.
5. **RLS cutover** — replace `auth.uid() = owner_id` with membership policies. App drops the `owner_id` filter once RLS is proven.
6. **Stop dual-write of tenant-as-owner** — `owner_id` remains as `created_by` only.

Active organisation for a user with multiple memberships (later) lives in a profile table or `workspace_preferences`. First cut: one org per user, so no picker.

## Rollback

Until step 5, rollback is “stop writing `organization_id` and ignore the new tables.” Data in `organizations` / members is unused.

After step 5, rollback requires restoring the old RLS policies and pointing the app back at `owner_id`. Keep the previous policy SQL in the schema file comments. Do not drop `owner_id` until rollback is no longer needed.

Invitations accepted during a failed cutover still create member rows; they are harmless if RLS is reverted, because membership is not consulted.

## RLS sketch (do not apply yet)

- Enable RLS on `organizations`, `organization_members`, `organization_invitations`.
- Members can select their org and fellow members.
- Only admin/owner can insert invitations and update member roles.
- Users cannot update their own `role` to escalate.
- Domain policies: `for select using (organization_id in (select … active membership))`.
- Insert `with check` the same, plus role ≠ viewer.
- Update/delete: member+ on rows in their org; viewer none.
- `risk_events` / `incident_events`: select by org; insert with `actor_id = auth.uid()` and org membership; **no update/delete**.
- Storage: folder prefix becomes `organization_id/…` or `organization_id/user_id/…`. Today’s `{auth.uid()}/{evidence_id}/` must be rewritten in a storage migration; do not mix old and new prefixes without a backfill.

## Effects on existing features

| Area | Change |
|---|---|
| **`org_people`** | Stay a per-org directory. Unique `(organization_id, email)` replaces `(owner_id, email)`. Assignees are still people rows, not logins. |
| **Settings** | `org_settings` PK becomes `organization_id`. Cadence, labels, appetite, demo ids, and `workspace_preferences` are org-wide. |
| **Demo data** | Seed/remove keyed by org, not by login. Only admin/owner. |
| **CSV export** | Unchanged shape; scoped to the active org. |
| **CSV import** | Stamp `organization_id` and `created_by`. Duplicate detection is per org. |
| **Audit / events** | Keep append-only events. `actor_id` is the login; `owner_id` becomes `created_by`. Add `organization_id` (already nullable on `007`). |
| **Evidence storage** | Private bucket stays. Object paths and policies must follow the signed-in user’s **org**, not only `auth.uid()`. Never use the service-role key in the app. |
| **Command palette / nav hiding** | Still presentation. Viewers can open a hidden URL and should be allowed or denied by RLS, not by preferences. |

## Application changes (when implemented)

- Replace `eq("owner_id", session.user.id)` with org scope helpers.
- `insertOwnedRecord` / `insertOwnedRow` set `organization_id` + `created_by`.
- Ready-flag probes stay (missing relation / missing column). Add `membershipReady` only when the new tables exist.
- Do not infer access from `org_people.email === session.user.email`.

## Out of scope for this plan

- SSO / SCIM
- Per-record sharing across organisations
- Changing `org_people` into login accounts
- Dropping `owner_id` in the same release as RLS cutover
