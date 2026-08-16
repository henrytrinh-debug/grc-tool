# GRC Tool — Project Context

A personal, hobby-built Governance, Risk & Compliance (GRC) tool. Built as a learning
project to understand modern web development, deployment, and database concepts —
not intended for commercial or production use.

This document exists so any AI tool (Claude, Cursor, Gemini, etc.) or future version
of yourself can quickly understand the system without replaying the full build history.
Update it after significant decisions or new modules.

---

## Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js (App Router, TypeScript, Tailwind CSS) | Scaffolded via `create-next-app` |
| Hosting | Vercel | Auto-deploys on every push to `main` |
| Database | Supabase (Postgres) | Includes built-in Auth |
| Auth | Supabase Auth (email/password) | Email confirmation currently disabled (dev convenience) |
| Version control | GitHub | Repo: `grc-tool` |
| AI coding tool | Cursor | Code edits done via AI chat prompts, reviewed before accepting |

**Local dev:** `npm run dev` (currently runs on port 3001 if 3000 is occupied by a stale process)
**Before every push:** run `npm run build` locally first — production builds enforce
stricter TypeScript checks than dev mode, and this has caught real bugs dev mode missed.

---

## Data Model

### `risks`
Core risk register entries.

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| title | text | required |
| description | text | |
| likelihood | int2 | 1–5, constrained. **Stored as an integer**; UI uses Admin-configured ISO 31000-style labels via a 5×5 score matrix, not dropdowns. Defaults: Rare → Almost certain. |
| impact | int2 | 1–5, constrained. Defaults: Negligible → Severe. Same matrix picker. |
| category_id | uuid | nullable FK → `risk_categories`, on delete set null. Added in `003_admin_settings.sql`. |
| treatment | text | `'mitigate' \| 'accept' \| 'transfer' \| 'avoid'`, default `mitigate`. Added in `003`. |
| owner_id | uuid | FK → auth.users, set automatically from logged-in user |
| owner_email | text | denormalized copy of owner's email, for display (auth.users isn't publicly queryable) |
| created_at | timestamptz | |

No status field yet (open/closed) — deferred. Inherent vs residual is **not stored**:
the register holds inherent likelihood × impact; RCSA shows an *indicative* residual
(likelihood reduced by 1 when all relevant controls are effective) as a reviewer aid only.

### `controls`
Independent module — controls can exist without being linked to any risk.

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| title | text | required |
| description | text | |
| is_key | boolean | Key vs Non-Key control |
| effectiveness | text | 'effective' \| 'ineffective' \| 'not_tested' — **cached snapshot of latest test result** |
| last_tested_at | date | **cached snapshot** — kept in sync with `control_test_results` whenever a new test is recorded |
| owner_id / owner_email | uuid / text | independent from any linked risk's owner |
| created_at | timestamptz | |

"Testing Status" (Never Tested / Tested / Overdue) is **calculated on the fly**, not stored:
- No `last_tested_at` → Never Tested
- Key control, `last_tested_at` older than the Admin **key testing cadence** (default 180 days) → Overdue
- Non-key control, `last_tested_at` older than the Admin **non-key testing cadence** (default 365 days) → Overdue
- Otherwise → Tested

Cadence days come from `org_settings` via `getSettings()` / `getTestingCadenceDays`. Until `003_admin_settings.sql` is applied, built-in defaults are used.

### `org_settings`
One row per owner (`owner_id` PK). Holds organisation name, likelihood/impact labels, score-band thresholds, review cadence by band, control testing cadence, issue due-date windows, and optional `demo_ids` for the demonstration dataset. Schema: `supabase/schema/003_admin_settings.sql`. The app degrades to `DEFAULT_SETTINGS` in `lib/settings/defaults.ts` if the table is missing (`PGRST205` / `42P01` / schema cache).

### `risk_categories`
Owner-scoped taxonomy used on the risk register (`name` unique per owner). Risks point at a category via `category_id`.

The runtime snapshot is hydrated by `SettingsProvider` (`lib/settings/context.tsx`) into `lib/settings/store.ts` so pure helpers (`getSeverityBand`, `getReviewCadenceDays`, `formatLikelihood`, `getDefaultDueDate`) pick up live values without threading React context everywhere.

### `control_test_results`
Historical log of every test recorded against a control (added to avoid overwriting history).

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| control_id | uuid | FK → controls, cascade delete |
| effectiveness | text | same constraint as controls.effectiveness |
| tested_at | date | defaults to today |
| notes | text | findings/what was tested |
| owner_id / owner_email | uuid / text | |
| created_at | timestamptz | |

No `update` policy — a test result is a historical record; corrections happen via delete + re-insert, not editing.
Recording a new result here also updates `controls.effectiveness` / `controls.last_tested_at` to match (app-level sync, not a DB trigger).

### `incidents`

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| title | text | required |
| description | text | |
| date_occurred | date | single date (no separate "reported" date) |
| severity | text | 'low' \| 'medium' \| 'high' \| 'critical' |
| status | text | 'open' \| 'investigating' \| 'resolved' |
| root_cause | text | optional, filled in once known |
| resolved_at | timestamptz | nullable — added in `002_incident_resolved_at.sql`, see note below |
| owner_id / owner_email | uuid / text | |
| created_at | timestamptz | |

`resolved_at` is kept in sync **at the app level, not via a DB trigger** — the same
pattern as `controls.effectiveness`/`last_tested_at` and `issue_actions.completed_at`.
Create and edit stamp it the first time status is `resolved` (if not already set),
and clear it back to null if the incident is reopened. The SQL file also backfills
rows that were already `resolved` before the column existed, using `created_at` as
the closest recorded time. The Oversight page does the same write on load, so
metrics populate without re-saving each incident. Because the query layer uses
`select("*")`, this degrades gracefully before the migration is applied —
`resolved_at` is simply absent from the returned rows rather than erroring.

### `rcsa_sessions`
One row per risk-assessment sitting — a grouping for the reviews it produced.

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| owner_id / owner_email | uuid / text | |
| created_at | timestamptz | |

**Deliberately has no `status` column** — session progress isn't tracked. Don't add one to
the insert; doing so causes a `PGRST204` "column does not exist" error.

### `rcsa_reviews`
The outcome of reviewing one risk within a session. Records the ratings **before and after**,
so a rating change has provenance rather than silently overwriting the risk.

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| session_id | uuid | FK → rcsa_sessions |
| risk_id | uuid | FK → risks |
| reviewed_at | timestamptz | drives "Last Reviewed" everywhere |
| previous_likelihood / previous_impact | int2 | the rating as it stood before review |
| final_likelihood / final_impact | int2 | what the reviewer confirmed or changed it to |
| ai_recommended_likelihood / ai_recommended_impact | int2 | nullable — reserved for Objective 7, always null today |
| ai_rationale | text | nullable — same |
| owner_id / owner_email | uuid / text | |
| created_at | timestamptz | |

A risk's "Last Reviewed" is **derived** from the newest `reviewed_at` here, not stored on the
risk — which is why there's still no review-status field on `risks`. Review **due** is also
derived from Admin cadence: by default Critical every 90 days, High every 180 days,
Medium/Low annually. The register filter `reviewRecency=due` and Oversight's "Due for Review"
stat use `getReviewCadenceDays` / `isReviewDue`, not a single 365-day rule.

### `issues`
Findings raised from audits, control failures, incidents, or risk assessments. This is the
module that turns the tool from a register into a workflow — everything else records state,
issues drive remediation to completion.

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| title | text | required |
| description | text | |
| source | text | 'internal_audit' \| 'external_audit' \| 'regulatory_exam' \| 'control_failure' \| 'incident' \| 'risk_assessment' \| 'self_identified' |
| severity | text | 'low' \| 'medium' \| 'high' \| 'critical' |
| status | text | 'open' \| 'in_progress' \| 'pending_review' \| 'closed' |
| identified_at | date | defaults to today |
| due_date | date | target remediation date; defaulted from severity on the new-issue form |
| root_cause | text | required before an issue can close |
| remediation_plan | text | required before an issue can go to review |
| closure_notes | text | required before an issue can close |
| closed_at | timestamptz | stamped by the workflow transition, not hand-edited |
| owner_id / owner_email | uuid / text | |
| created_at | timestamptz | |

"Overdue" is **calculated on the fly**, not stored: a non-closed issue whose `due_date` is in
the past. Same principle as the control testing status.

### `issue_actions`
The action plan for an issue — the individual remediation steps.

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| issue_id | uuid | FK → issues, cascade delete |
| description | text | required |
| assignee_email | text | free text; no user table to join to |
| due_date | date | optional |
| status | text | 'open' \| 'in_progress' \| 'completed' |
| completed_at | timestamptz | set when status becomes 'completed', cleared if reopened |
| owner_id / owner_email | uuid / text | |
| created_at | timestamptz | |

### `issue_comments`
Append-only activity trail per issue. Holds both user notes and automatic status-change
entries, so the history of an issue is auditable.

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| issue_id | uuid | FK → issues, cascade delete |
| body | text | |
| kind | text | 'comment' \| 'status_change' |
| owner_id / owner_email | uuid / text | |
| created_at | timestamptz | |

**No `update` or `delete` policy** — like `control_test_results`, this is history. An audit
trail you can edit isn't an audit trail.

### Junction tables (many-to-many relationships)

**`risk_controls`** — links risks ↔ controls (many-to-many: one control can mitigate multiple risks, one risk can have multiple controls)
**`incident_risks`** — links incidents ↔ risks (many-to-many)
**`issue_risks`** — links issues ↔ risks
**`issue_controls`** — links issues ↔ controls

Both follow the same shape: `id`, the two foreign keys (cascade delete), `owner_id`
(tracks who created the *link*, separate from who owns either linked record), `created_at`,
and a `unique(a_id, b_id)` constraint to prevent duplicate links.

**No `update` policy on junction tables** — a link either exists or doesn't; changing what's
linked means delete + re-insert, not editing a row in place.

**Not yet built, but cheap to add later:** `incident_controls` (linking incidents directly to
controls, e.g. "this control failure caused this incident"). Same pattern as above — deferred
because it wasn't needed yet, not because it's hard.

### Row Level Security (RLS)
Every table has RLS enabled. Standard pattern:
```sql
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id)
```
Each table's `owner_id` is independent — a risk's owner, a control's owner, and a link's
owner can all differ (relevant if this ever becomes multi-user).

**Historical note:** tables were initially created with a permissive `using (true)` policy
before auth existed, then tightened once auth was working. If you ever see an "allow all"
policy anywhere, it's leftover from before auth and should be replaced with an owner-scoped one.

### Schema changes / migrations

Early tables were created by hand in the Supabase SQL editor with no record in the repo.
From the Issues module onward, schema lives in versioned files under `supabase/schema/`
(e.g. `001_issues.sql`, `002_incident_resolved_at.sql`, `003_admin_settings.sql`) which are **run manually in the
Supabase SQL editor** — there is no migration runner wired up. The files are written to
be re-runnable (`create table if not exists`, `add column if not exists`, `drop policy
if exists` before create).

**This means a fresh clone won't work until those files have been run against the database.**
If the app 404s or errors on a whole module, check whether its SQL has been applied.

---

## App Structure / Conventions

- **Pages per module**: list view at `/risks`, `/controls`, `/incidents` (table only, no
  inline forms). "Add" button → separate page (`/risks/new`). Clicking a row → separate
  edit page (`/risks/[id]/edit`). This replaced an earlier "form on top, list below" layout
  that felt cluttered.
- **Linked records** (e.g. a risk's linked controls) are shown/managed on the **edit** page,
  not the list page.
- **Module-specific UI** lives in a `_components/` folder inside each module
  (e.g. `app/controls/_components/`): the form fields, the control test-history panel, the
  issue workflow/action-plan/activity panels, and a `constants.ts` holding the empty-form
  default. The `_` prefix keeps these out of Next.js routing.
- **Sidebar navigation** — grouped sections rather than a flat module list: Overview
  (Home, Oversight), Registers (Risks, Controls, Incidents, Issues), Assessment
  (Risk Assessment), Administration (Settings → `/admin`). The header shows the
  organisation name from Admin. Collapses behind a Menu button on small screens.
  `⌘K` / `Ctrl+K` opens a jump palette (`app/components/command-palette.tsx`).
  `app/layout.tsx` wraps every page in `<AppShell>`
  (`app/components/app-shell.tsx`), which hides the sidebar on `/login` and otherwise
  renders `app/components/app-sidebar.tsx` (active-link highlighting + centralized log out).
  `SettingsProvider` wraps both the login and authenticated trees.
- **Home page** (`/`) — welcome message + user email, stat cards (risks, overdue controls,
  open incidents, open issues), a **Needs attention** queue (overdue issues, failed/overdue
  key controls, open high/critical incidents, and High/Critical risks that are uncontrolled
  or past their review cadence), and dashboard visuals, all click-through:
  - Risk heat map (5×5 grid, likelihood × impact, labeled axes, color-coded)
  - Bar chart: risk count by severity band (calculated from likelihood × impact: 1–5 Low,
    6–10 Medium, 11–19 High, 20–25 Critical)
  - Donut charts: controls by effectiveness, incidents by status, issues by status
  - Remediation health: action-plan completion across open issues, plus open/overdue
    counts per severity
  - Built with `recharts`.
- **Risk ratings** — never two independent dropdowns. Use `RiskScorePicker`
  (`app/components/risk-score-picker.tsx`): a 5×5 heat map so the reviewer sees the
  resulting score band while choosing. Labels and band thresholds live in Admin
  (`org_settings`); code defaults remain in `lib/settings/defaults.ts` and
  `LIKELIHOOD_LABELS` / `IMPACT_LABELS` in `lib/types/risk.ts`. Stored values stay 1–5 integers.
- **Admin** (`/admin`) — organisation name, likelihood/impact labels, score bands,
  review cadence by band, key vs non-key testing cadence, issue due-date windows,
  risk taxonomy CRUD, and load/remove demonstration data (`lib/admin/demo-data.ts`).
  Requires `003_admin_settings.sql`. Until that file is run, the page shows a banner
  and the rest of the app uses built-in defaults.
- **Bar-chart hover** — Recharts' default pale overlay is disabled
  (`chartHoverCursor = false` in `app/components/chart-theme.ts`); hovered bars use a
  teal stroke instead.
- **Dropdown gotcha (hit twice — worth remembering):** dropdowns must send the lowercase,
  underscored database value (`not_tested`) even though the displayed label is friendly
  text ("Not Tested"). Mixing these up causes a Postgres check-constraint violation (`23514`)
  or a "column does not exist" error (`PGRST204`) depending on what's mismatched.

### The shared layer (read this before adding a page)

Five modules built to the same pattern produced a lot of near-identical code, which was
then extracted. **Reach for these before writing a new page from scratch:**

| Concern | Use |
|---|---|
| Auth gate + owner-scoped initial load | `useRequireAuth(callback)` — redirects to `/login`, hands you `ownerId` |
| Owner-scoped table reads / query errors | `fetchOwnedTable` / `throwIfAnyQueryError` in `lib/supabase/owned.ts` |
| Clickable list rows (keyboard + click) | `ClickableRow` |
| List filters held in the URL | `useListFilters` + the `parse*Filters` / `filter*` / `sort*` helpers in `lib/list-filters.ts` |
| CSV download of a filtered list | `downloadCsv` in `lib/export/csv.ts` |
| Date-only display (no UTC day-shift) | `formatIsoDate` / `todayIsoDate` in `lib/dates.ts` |
| Dirty-form leave warning | `useUnsavedChanges` |
| Review cadence (Admin-configured; default 90/180/365 by band) | `isReviewDue` / `getReviewCadenceDays` in `lib/types/rcsa.ts` |
| Organisation settings snapshot | `getSettings()` / `hydrateSettings()` in `lib/settings/store.ts`; `useSettings()` in React |
| Link/unlink against a join table | `useEntityLinks` — owns the rows, search/select state, and insert/delete |
| Rendering linked rows | `LinkedEntitiesPanel` + the builders in `app/components/linked-entity-rows.tsx` |
| New/edit form scaffolding | `EntityFormPage` |
| Input/label/button classes | `app/components/ui.ts` — do **not** hand-write these strings |
| Likelihood × impact rating | `RiskScorePicker` — do **not** add `<select>` 1–5 dropdowns |
| Loading, error, header, card chrome | `app/components/page-parts.tsx` |
| Supabase join-row plumbing | `lib/types/join-utils.ts` + `lib/types/linked-entities.ts` |

**Palette:** `slate` for neutrals, `teal` for accents. The codebase was migrated off `zinc`
entirely — if you find a `zinc-*` class, it's a regression.

**`owner_id` on every query and mutation.** RLS enforces it at the database, but the app
filters explicitly too, because a missing filter is silently wrong rather than an error.
This was a real bug on the risks queries, and write paths now follow the same rule.

### Issue workflow

`lib/issues/workflow.ts` is the state machine. Allowed transitions:

```
open ⇄ in_progress → pending_review → closed
                     pending_review → in_progress   (send back)
                     closed → in_progress           (reopen)
```

Each transition has **gates** — preconditions returned as human-readable blockers and shown
in the UI rather than silently disabling the button:
- → `pending_review` requires a remediation plan and at least one action item
- → `closed` requires a root cause, closure notes, and all action items completed

Every transition writes a `status_change` row to `issue_comments`, so the trail explains
itself. The edit page also warns when unsaved form edits would change whether a gate passes,
since the gates evaluate against **saved** values.

### Where issues get raised from

Issues are rarely created cold — the value is in raising them in context, so the form is
pre-filled via query params and the originating record is linked automatically:

| From | Sets |
|---|---|
| A failed control test (`TestHistoryPanel`) | source `control_failure`, links the control |
| An incident's review | source `incident`, inherits severity, seeds root cause |
| An RCSA review | source `risk_assessment`, links the risk |
| A risk or control edit page | source per entity, links that record |

---

## Environment / Secrets

`.env.local` (never committed — excluded via `.gitignore`):
```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
```
Use the `anon`/`publishable` key only — never the `service_role`/`secret` key in
frontend code (it bypasses RLS entirely).

**Vercel** needs these same two variables set separately under
Project → Settings → Environment Variables (scoped to Production + Preview at minimum) —
`.env.local` does not travel with git pushes, so this step is easy to forget after adding
a new env var locally.

**Supabase Auth → URL Configuration** needs both the local and live URLs registered:
- Site URL: live Vercel URL (e.g. `https://grc-tool-lovat.vercel.app`)
- Redirect URLs: both `http://localhost:3001/**` and `https://grc-tool-lovat.vercel.app/**`

---

## Status: Objectives

| # | Objective | Status |
|---|---|---|
| 4 | CRUD on risks (edit/delete) | ✅ Done |
| 1 | Auth + RLS | ✅ Done |
| 3 | Controls module, many-to-many linking to risks | ✅ Done |
| 5 | Incidents module, many-to-many linking to risks | ✅ Done |
| — | UI polish: sidebar nav, home page, list/add/edit restructure, dashboard visuals | ✅ Done |
| — | Control test history workflow (separate from editing control details) | ✅ Done |
| 6 | RCSA workflow (guided review wizard) | ✅ Done — AI recommendations still open |
| — | Issues module: lifecycle workflow, action plans, activity trail, cross-module raising | ✅ Done |
| — | Shared-layer extraction + `zinc` → `slate`/`teal` migration | ✅ Done |
| — | Oversight Monitoring: 2LoD analytics dashboard (coverage, aging, stock/flow) | ✅ Done |
| — | RCSA evidence brief, linked issues, 5×5 rating picker, indicative residual | ✅ Done |
| — | Cadence, attention-queue risks, CSV export, command palette, mobile nav | ✅ Done |
| — | Admin: configurable methodology, taxonomy, demonstration data, grouped nav | ✅ Done |
| 7 | AI-assisted rating recommendations during RCSA | 🔜 Not started |

---

## Objective 6 — RCSA Workflow (built)

A risk owner selects risks at `/rcsa/start` (checklist showing each risk's last review date,
cadence, and current severity band). Risks **due for review** are pre-selected. Starting a
sitting creates a row in `rcsa_sessions` and hands off to `/rcsa/review` — a one-risk-at-a-time
wizard. Skip confirms if the rating was changed without saving.

The review page is built for a **challenger**, not a form-filler:

1. **Reviewer brief** (`lib/rcsa/review-insight.ts` → `buildEvidenceBrief`) — a
   headline plus bullets synthesising linked controls, incidents, and issues
   (overdue findings, ineffective key controls, uncontrolled exposure). Tone is
   ok / watch / alert.
2. **Evidence cards** — linked controls, incidents, **and issues**, each with a
   roll-up and an expandable table. Row titles link through to the record.
3. **Indicative residual** — derived from linked control effectiveness
   (likelihood reduced by 1 only when every relevant control is effective;
   impact unchanged). **Not stored.** The confirmed rating is still inherent
   likelihood × impact on `risks`.
4. **5×5 score picker** to confirm or change the inherent rating.

`/rcsa/review` also accepts a single `risk` id, so "Review This Risk" from the
risks list or a risk's edit page skips the selection step.

Reviews land in `rcsa_reviews`. `rcsa_sessions` deliberately has **no status column** —
session progress isn't tracked; a session is just a grouping for the reviews it produced.

**Settled along the way:**
- Workflow shape: one-risk-at-a-time wizard (not a queue or inline dashboard editing).
- Linked controls, incidents, and issues are shown as read-only evidence during review.
- **Skip** is allowed without writing a review — a multi-risk sitting can move on.
- A reviewer who spots a gap raises an **issue** from the review instead of the flow
  growing its own remediation concept.
- The confirmed rating is written to `risks` **before** the `rcsa_reviews` insert, so a
  failed audit-row write cannot leave a review that disagrees with the register.
- Residual is a reviewer aid, not a second pair of columns on `risks` — storing
  residual would be a later schema change if 2LoD wants a register of residual scores.
- The deferred "risk status" field still doesn't exist; "last reviewed" is derived from
  `rcsa_reviews` instead of stored on the risk.

**Deliberately not built yet** (common GRC features that don't earn a table until
they're needed): KRIs, explicit risk appetite/tolerance, inherent-vs-residual as
stored fields, third-party / vendor risk, control design vs operating effectiveness
as separate ratings.

## Objective 7 — AI-assisted rating recommendations (not started)

The remaining piece of the original Objective 6: an agent that reads a risk's control,
incident, and issue history and **recommends** a likelihood/impact rating rather than
auto-applying it. The RCSA wizard is the place it plugs into — it already assembles
the evidence brief, indicative residual, and linked records such an agent would need.

**Open design questions:**
- What the agent sees: the reviewer brief only, or full test history and past ratings too.
- Output format: a suggested likelihood/impact, a written rationale, or both.
- Where the human approves or overrides, and whether the recommendation is recorded
  alongside the review for later comparison against what the reviewer chose.

## Oversight Monitoring (built)

A read-only analytics dashboard at `/oversight`, distinct from the home page (`/`,
operational/entity-count focused). This one takes a **Second Line of Defence (2LoD)**
lens on the risk and control environment: not "how many records exist" but "is the
environment well-controlled, are reviews current, and is remediation keeping pace."
No create/edit forms — headline stats link out to filtered list views where a
matching filter already exists on that module's list page.

Organized into four sections, each pairing headline `StatCard`s with `ChartCard`
visuals:

- **Controls** — key vs non-key split; testing coverage (Never Tested / Tested /
  Overdue) both overall and restricted to key controls (key-control-overdue is a
  headline alert stat, since 2LoD cares more about gaps in key-control testing);
  test pass rate computed from full `control_test_results` history rather than just
  each control's cached `effectiveness` snapshot (so a fail-then-pass retest shows
  real history); risks with zero linked controls (`risk_controls`), broken out by
  severity band so uncontrolled High/Critical exposure stands out; controls with
  zero linked risks (unmapped / orphan controls).
- **Risks** — severity band distribution (reuses `buildSeverityBandCounts`); review
  recency buckets (never reviewed / >365 days / 180–365 days / within 180 days),
  derived from the max `reviewed_at` per risk in `rcsa_reviews`, plus a **Due for
  Review** headline that applies the Admin review cadence by severity band.
- **Issues & Remediation** — open-issue aging buckets (0–30/31–60/61–90/90+ days
  since `identified_at`) broken out by severity; issue flow (opened vs closed,
  trailing 30/90 days); % of open issues overdue and average action-plan completion
  (reuses `isIssueOverdue` / `summariseIssues`); average days from `identified_at` to
  `closed_at`; open issues by source, to show which upstream process (audits,
  control failures, incidents, ...) is generating the most findings.
- **Incidents** — stock (open + investigating count, average age since
  `date_occurred`); flow (new vs resolved, trailing 30/90 days) and mean-time-to-
  resolve, both driven by the new `resolved_at` column (see the `incidents` table
  section above); severity distribution.

All computation lives in `lib/oversight/metrics.ts` — small pure functions taking
arrays of already-fetched, owner-filtered rows and returning typed summary objects,
mirroring the style of `lib/dashboard/analytics.ts`. This keeps `app/oversight/page.tsx`
a thin fetch-and-render shell. New chart components specific to this page (a stacked
aging bar chart, a generic opened-vs-closed flow bar chart, and a few themed donuts)
live under `app/components/oversight/`, reusing the existing `ChartCard`/`StatCard`
shells and the `DashboardDonutChart` primitive (now exported from
`app/components/dashboard/donut-charts.tsx` for reuse outside the home page).

**Schema dependency:** incident flow and mean-time-to-resolve need `resolved_at`,
which only exists after `supabase/schema/002_incident_resolved_at.sql` is run (the
file also backfills existing resolved rows). Until then those specific metrics
render as "—" / 0; every other metric on the page works against existing columns.

---

## Working Conventions (process, not code)

- **Design decisions are made deliberately before building**, especially anything
  involving relationships between tables (one-to-many vs. many-to-many), security scope,
  or workflow shape. Cursor executes; design conversations happen first.
- **Always run `npm run build` locally before pushing** — dev mode is more forgiving
  than Vercel's production build (has caught real TypeScript errors this way).
- **One change at a time when possible** — build, test, confirm, *then* move to the next
  change, rather than batching multiple risky changes into one prompt.
- Cost/tooling: Cursor Pro subscription (~$20/mo), Supabase free tier, Vercel free
  (Hobby) tier, GitHub free — no other recurring costs.
