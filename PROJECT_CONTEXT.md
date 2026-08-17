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
Filter/taxonomy helpers can also be checked with `npx tsx scripts/verify-logic.ts`.

---

## Data Model

### `risks`
Core risk register entries.

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| title | text | required |
| description | text | |
| likelihood | int2 | 1–5, constrained. **Stored as an integer**; UI uses Admin-configured ISO 31000-style labels via a 5×5 score matrix, not dropdowns. Defaults: Rare → Almost certain. This is **inherent**. |
| impact | int2 | 1–5, constrained. Defaults: Negligible → Severe. Same matrix picker. This is **inherent**. |
| residual_likelihood | int2 | nullable. Net likelihood after controls. Added in `010_residual.sql`. |
| residual_impact | int2 | nullable. Net impact after controls. Must be set together with residual_likelihood. Cannot exceed inherent. |
| category_id | uuid | nullable FK → `risk_categories`, on delete set null. Added in `003_admin_settings.sql`. |
| treatment | text | `'mitigate' \| 'accept' \| 'transfer' \| 'avoid'`, default `mitigate`. Added in `003`. |
| status | text | `'open' \| 'monitoring' \| 'closed'`, default `open`. Added in `004_enterprise.sql`. Closed risks are excluded from heat maps, taxonomy counts, attention, and RCSA start. |
| assignee_id | uuid | nullable FK → `org_people`, on delete set null. Added in `004`. |
| treatment_rationale | text | Why this treatment was chosen / acceptance conditions. Added in `005_operating.sql`. Omitted from writes until `operatingReady`. |
| target_date | date | Optional treatment target. Drives Horizon “treatment target” obligations. Added in `005`. |
| closure_rationale | text | Why the risk was closed. Added in `007_governance.sql`. Omitted from writes until `governanceReady`. Close is blocked unless this is filled **or** an RCSA review exists for the risk. |
| owner_id | uuid | FK → auth.users, set automatically from logged-in user |
| owner_email | text | denormalized copy of owner's email, for display (auth.users isn't publicly queryable) |
| created_at | timestamptz | |

Inherent vs residual **is stored** after `010_residual.sql`: `likelihood` / `impact` remain inherent (gross); `residual_likelihood` / `residual_impact` are the net rating after current controls. Both residual columns are null until assessed. Residual cannot exceed inherent on either axis, and cannot sit below inherent with no linked controls. Appetite, High/Critical KPIs, and the register Score filter use residual when assessed, otherwise inherent. RCSA confirms inherent first, then residual. Until `010` is applied, `residualReady` is false and writes omit the columns.

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
| control_type | text | `'preventive' \| 'detective' \| 'corrective'`, default `preventive`. Added in `004`. |
| assignee_id | uuid | nullable FK → `org_people`, on delete set null. Added in `004`. |
| owner_id / owner_email | uuid / text | independent from any linked risk's owner |
| created_at | timestamptz | |

"Testing Status" (Never Tested / Tested / Overdue) is **calculated on the fly**, not stored:
- No `last_tested_at` → Never Tested
- Key control, `last_tested_at` older than the **key testing cadence** on Controls → Settings (default 180 days) → Overdue
- Non-key control, `last_tested_at` older than the **non-key testing cadence** on Controls → Settings (default 365 days) → Overdue
- Otherwise → Tested

Cadence days come from `org_settings` via `getSettings()` / `getTestingCadenceDays`. Until `003_admin_settings.sql` is applied, built-in defaults are used.

### `org_settings`
One row per owner (`owner_id` PK). Holds organisation name, likelihood/impact labels, score-band thresholds, review cadence by band, control testing cadence, issue due-date windows, optional `demo_ids` for the demonstration dataset, and optional `workspace_preferences` JSONB (added in `006_workspace_preferences.sql`). Schema: `supabase/schema/003_admin_settings.sql`. The app degrades to `DEFAULT_SETTINGS` in `lib/settings/defaults.ts` if the table is missing (`PGRST205` / `42P01` / schema cache).

`workspace_preferences` is **presentation only** — hiding a module, Home widget, Oversight section, or Board pack section does not change RLS or `owner_id` filtering. Direct URLs still work. Home and Admin cannot be hidden. Until `006` is applied, `preferencesReady` is false: the current layout is used, and writes omit the column (`42703` / missing-column is treated like other schema probes).

Saved register filter presets (name + module + query string) live in the same JSONB blob and appear in the command palette and on register toolbars.

### `risk_categories`
Owner-scoped taxonomy used on the risk register (`name` unique per owner). Risks point at a category via `category_id`. `appetite_band` (`Low` \| `Medium` \| `High` \| `Critical`, default `High`) is added in `004` — a risk is an appetite breach when its **operating** band (residual if assessed, otherwise inherent) is strictly above the category appetite (closed risks are ignored).

Controls, incidents, and issues **inherit** taxonomy from linked risks. List filters use “any linked risk in category X”, with `uncategorised` meaning no linked risk has a `category_id`. Nested PostgREST `risks(..., category_id)` is only requested when `003` is applied.

### `org_people`
Directory of accountable owners for the signed-in account (not a second tenant). Schema: `supabase/schema/004_enterprise.sql`. Unique `(owner_id, email)`. `line_of_defence` is `'first' \| 'second' \| 'third'`. Assignments on risks/controls/incidents/issues point here. The signed-in user is still the RLS `owner_id` of every row — people are labels for accountability, not additional logins.

The app sets `enterpriseReady` when `org_people` exists. Until `004` is applied, assignee / status / control type / appetite columns are omitted from writes.

The app sets `operatingReady` when `incident_controls` exists (`005_operating.sql`). Until then, treatment rationale / target date, incident lessons learned, and incident↔control links are omitted from writes.

The app sets `preferencesReady` when `org_settings.workspace_preferences` exists (`006_workspace_preferences.sql`). Until then, workspace layout stays at the built-in default and the column is omitted from upserts.

The app sets `governanceReady` when `risk_events` exists (`007_governance.sql`). Until then, `closure_rationale` is omitted from writes and change-history rows are not inserted.

The app sets `obligationsReady` when `obligations` exists (`008_obligations.sql`). Until then the register is empty and Horizon/Oversight/quality skip obligation rows.

The app sets `evidenceReady` when `evidence` exists (`009_evidence.sql`), and `evidenceStorageReady` when listing the private `grc-evidence` bucket under `auth.uid()` succeeds. Metadata can be saved without Storage; the UI does not pretend uploads work if the bucket or policies are missing.

The app sets `residualReady` when `risks.residual_likelihood` exists (`010_residual.sql`). Until then residual is omitted from writes and Risk Assessment saves inherent only.

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
| assignee_id | uuid | nullable FK → `org_people`. Added in `004`. |
| lessons_learned | text | What will change so the incident does not recur. Added in `005`. |
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
| previous_likelihood / previous_impact | int2 | the inherent rating as it stood before review |
| final_likelihood / final_impact | int2 | what the reviewer confirmed or changed inherent to |
| previous_residual_* / final_residual_* | int2 | nullable — residual before/after. Added in `010`. Omitted from writes until `residualReady`. |
| ai_recommended_likelihood / ai_recommended_impact | int2 | nullable — reserved for Objective 7, always null today |
| ai_rationale | text | nullable — same |
| owner_id / owner_email | uuid / text | |
| created_at | timestamptz | |

A risk's "Last Reviewed" is **derived** from the newest `reviewed_at` here, not stored on the
risk. Review **due** is also derived from Admin cadence: by default Critical every 90 days,
High every 180 days, Medium/Low annually. The register filter `reviewRecency=due` and
Oversight's "Due for Review" stat use `getReviewCadenceDays` / `isReviewDue`. Next review
due dates are shown on the risk register via `formatNextReviewDue`.

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
| assignee_id | uuid | nullable FK → `org_people`. Added in `004`. |
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

### `risk_events` / `incident_events`
Append-only change history. Schema: `007_governance.sql`. Select + insert only; insert requires `actor_id = auth.uid()`. Records status, treatment (risks), assignment, and material rating/severity changes. Nullable `organization_id` is reserved for a future membership migration.

### `obligations`
Owner-scoped compliance requirements (a register, not a regulatory-content engine). Schema: `008_obligations.sql`. Title, source/regulator, citation, requirement text, status (`open` \| `monitoring` \| `retired`), review frequency, effective/review dates, assignee. Mapped to controls and issues via join tables.

### `evidence`
Metadata linking an artefact to a risk, control, test result, incident, issue, or obligation. Schema: `009_evidence.sql`. Optional private Storage bucket `grc-evidence` with object path `{owner_id}/{evidence_id}/{filename}`. Never use the service-role key. If Storage is not configured, metadata and UI still work.

### Junction tables (many-to-many relationships)

**`risk_controls`** — links risks ↔ controls (many-to-many: one control can mitigate multiple risks, one risk can have multiple controls)
**`incident_risks`** — links incidents ↔ risks (many-to-many)
**`incident_controls`** — links incidents ↔ controls (e.g. the control that failed or contained the event). Added in `005_operating.sql`.
**`issue_risks`** — links issues ↔ risks
**`issue_controls`** — links issues ↔ controls
**`obligation_controls`** — links obligations ↔ controls. Added in `008_obligations.sql`.
**`obligation_issues`** — links obligations ↔ issues. Added in `008`.

Both follow the same shape: `id`, the two foreign keys (cascade delete), `owner_id`
(tracks who created the *link*, separate from who owns either linked record), `created_at`,
and a `unique(a_id, b_id)` constraint to prevent duplicate links.

**No `update` policy on junction tables** — a link either exists or doesn't; changing what's
linked means delete + re-insert, not editing a row in place.

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
(e.g. `001_issues.sql` … `010_residual.sql`) which are **run manually in the
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
  (Home, My work, Horizon, Lines of defence, Board pack, Oversight, Data quality), Registers (Risks, Controls, Incidents, Issues, Obligations, Evidence), Assessment
  (Risk Assessment), Administration (Settings → `/admin`). The header shows the
  organisation name from Admin. Collapses behind a Menu button on small screens.
  `⌘K` / `Ctrl+K` opens a jump palette (`app/components/command-palette.tsx`).
  `app/layout.tsx` wraps every page in `<AppShell>`
  (`app/components/app-shell.tsx`), which hides the sidebar on `/login` and otherwise
  renders `app/components/app-sidebar.tsx` (active-link highlighting + centralized log out).
  `SettingsProvider` wraps both the login and authenticated trees.
- **Home page** (`/`) — welcome message + user email, optional **taxonomy lens** filter
  (inherited onto controls/incidents/issues via linked risks), headline stats (open risks,
  overdue controls, open incidents, open issues, plus assigned-to-me and above-appetite
  when `004` is applied), a **Needs attention** queue, **recent activity**, and a
  12-month **incident flow** (occurred vs resolved) and **issue flow** (identified vs closed). Headline stats are the current stock. Control testing over time lives on Oversight. Asset-specific
  charts (heat map, taxonomy, treatment mix, donuts) live on each register’s **Summary** tab.
- **Registers** — each of `/risks`, `/controls`, `/incidents`, `/issues`, `/obligations`,
  `/evidence` has three tabs: **Summary** (asset overview + time series), **Register** (table),
  and **Settings** (methodology for that register plus saved views). Bare URLs open Summary;
  a filter or `sort` query opens the table; `view=` is explicit. Column headers sort on click
  and expose filters in a popover (`ColumnHeader`) instead of a dropdown grid above the table.
  Deep links such as `/risks?severity=High,Critical` still land on the filtered table.
  Lists still support department filter (from the assignee’s `org_people.department`), High or
  Critical combined severity, sticky table headers, next-test-due on controls, and
  incident↔control counts after `005`.
- **My work** (`/work`) — assigned-to-me queue across risks, controls, incidents, and issues.
  Resolves “me” by matching `org_people.email` to the signed-in user.
- **Horizon** (`/horizon`) — operating calendar of derived obligations: risk reviews, treatment target dates (after `005`), control tests, issue due dates, and action due dates, bucketed overdue / 7 / 30 / 90 days.
- **Lines of defence** (`/lines`) — workload by assignee and 1st / 2nd / 3rd line from the people directory.
- **Board pack** (`/board`) — printable committee snapshot: above-appetite, High/Critical risks, overdue key controls, overdue issues, severe open incidents, uncontrolled High/Critical. Print hides the sidebar. CSV export included.
- **Overview surface boundaries** — Home is the operational landing page (cross-register
  stats, attention, activity, trend). Oversight is the 2LoD analytical view (health, flow,
  movement). Board pack is the printable committee view. Register Summary tabs own
  asset-specific visuals. They fetch through `lib/snapshot/grc-snapshot.ts` profiles and
  share KPI predicates from `lib/metrics/kpis.ts`. Do not copy owner-scoped fetch bundles
  or reimplement “open / overdue / above appetite” predicates in a page.
- **Recent activity** — combines RCSA reviews, tests, incidents, and issue trail entries.
  Timestamp sorting is normalized through `parseIsoDate`; an issue with an append-only
  “Issue raised” event is not also emitted as a duplicate synthetic creation row.
- **Lines of defence links** — each workload count deep-links to the matching filtered
  register. The person name is not a misleading risks-only link.
- **Risk ratings** — never two independent dropdowns. Use `RiskScorePicker`
  (`app/components/risk-score-picker.tsx`): a 5×5 heat map so the reviewer sees the
  resulting score band while choosing. Labels and band thresholds live on **Risks → Settings**
  (`org_settings`); code defaults remain in `lib/settings/defaults.ts` and
  `LIKELIHOOD_LABELS` / `IMPACT_LABELS` in `lib/types/risk.ts`. Stored values stay 1–5 integers.
- **Admin** (`/admin`) — organisation name, workspace layout (which overview widgets
  and modules are shown), risk taxonomy CRUD (including appetite band after `004`), people
  directory, saved-view management, and load/remove demonstration data
  (`lib/admin/demo-data.ts`). Scoring, review cadence, testing cadence, and issue due-date
  windows are edited on each register’s **Settings** tab (still stored in `org_settings`).
  The seed includes expanded taxonomy (Climate & ESG, Data & Records, Technology Resilience,
  Legal, Credit), obligations, and metadata-only evidence when those tables exist, plus a few
  intentional completeness gaps so Data quality has something to show. Re-load after removing
  an older demo set. `ChartCard` is chrome only — do not add hover that looks like a link.
  Requires `003_admin_settings.sql`. `004_enterprise.sql` unlocks people, assignees,
  risk status, control type, and appetite. `005_operating.sql` unlocks treatment
  target dates, incident lessons learned, and incident↔control links. Until those files are run, the page shows
  banners and the rest of the app omits unknown columns.
- **Command palette** — pages, filtered views, taxonomy deep-links, and jump-to-record
  by title (fetched when the palette opens).
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
| Owner-scoped table reads / query errors | `fetchOwnedTable` / `fetchOwnedTableOptional` / `throwIfAnyQueryError` in `lib/supabase/owned.ts` |
| Insert with owner stamp | `insertOwnedRecord` / `insertOwnedRow` in `lib/supabase/records.ts` |
| Completeness checks (not a stored score) | `buildQualityFindings` / `buildRegisterQualityScores` in `lib/data-quality/checks.ts`; per-record `*Quality` helpers in `lib/data-quality/record.ts` rendered as `QualityPill` / `QualityCallout` |
| Governance gates and event diffs | `lib/governance/gates.ts` / `lib/governance/events.ts` |
| CSV import preview | `lib/import/csv.ts` / `lib/import/validate.ts` |
| Overview data bundles + inherited-taxonomy indexes | `fetchGrcSnapshot(profile)` / `buildSnapshotIndexes` in `lib/snapshot/grc-snapshot.ts` |
| Shared operational KPI predicates | `lib/metrics/kpis.ts` |
| Navigation + command route catalogue | `lib/navigation.ts` |
| Linked record/activity/attention list presentation | `RecordLinkList` (`divided` or `cards`) — use `limit` + `moreHref` rather than dumping long lists |
| Clickable list rows (keyboard + click) | `ClickableRow` |
| List toolbar (search + CSV + count) | `ListToolbar` in `app/components/list-toolbar.tsx`. Register **filters and sort live in column headers** (`ColumnHeader` popovers), not a dropdown grid above the table. `FilterSelect` remains for one-off lenses such as Home’s taxonomy filter. |
| Register tabs (Summary / Register / Settings) | `RegisterTabs` + `parseRegisterView` in `lib/register/view.ts`; shell in `app/components/register-page-shell.tsx` |
| Time-series charts | `stackByMonth` / `buildIssueFlowTrend` / `buildIncidentFlowTrend` / `buildControlTestTrend` in `lib/charts/time-series.ts`; `StackedTimeChart` / `LineTimeChart` in `app/components/dashboard/time-charts.tsx` |
| Inherent vs residual | `lib/risk/ratings.ts` — `operatingRating`, `residualBlockers`, `residualWarnings` |
| Register methodology | `MethodologySettings` / `RegisterSettingsPanel` — scoring, review cadence, testing cadence, issue due days |
| Sticky register tables | `RegisterTable` / `registerTheadClassName` in `app/components/page-parts.tsx` |
| CSV download of a filtered list | `downloadCsv` in `lib/export/csv.ts` |
| Date-only display (no UTC day-shift) | `formatIsoDate` / `todayIsoDate` in `lib/dates.ts` |
| Dirty-form leave warning | `useUnsavedChanges` |
| Review cadence (register Settings; default 90/180/365 by band) | `isReviewDue` / `getReviewCadenceDays` in `lib/types/rcsa.ts` |
| Organisation settings snapshot | `getSettings()` / `hydrateSettings()` in `lib/settings/store.ts`; `useSettings()` in React |
| Link/unlink against a join table | `useEntityLinks` — owns the rows, search/select state, and insert/delete |
| Rendering linked rows | `LinkedEntitiesPanel` + the builders in `app/components/linked-entity-rows.tsx` (title cell is a link via `href`) |
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
| — | Enterprise operating model: people directory, assignees, risk status, control type, category appetite, inherited taxonomy filters, My work, expanded demo | ✅ Done |
| — | Operating calendar, 3LoD workload, activity feed, rating movement, board pack, treatment targets, incident lessons, incident↔control links (`005`) | ✅ Done |
| — | Overview modularization: profiled snapshots, shared KPIs/navigation/link lists, clarified Home/Oversight/Board boundaries | ✅ Done |
| — | Workspace customization: visible modules, Home/Oversight/Board sections, saved register views (`006`) | ✅ Done |
| — | Data quality cockpit (`/quality`) | ✅ Done |
| — | Multi-user tenancy / membership RLS | 📝 Design only — `docs/MULTI_USER_MIGRATION_PLAN.md`. Tenant is still `owner_id = auth user`. |
| — | Governance gates + immutable risk/incident events (`007`) | ✅ Done |
| — | Obligations register (`008`) | ✅ Done |
| — | Inherent and residual ratings (`010`) | ✅ Done |
| — | CSV import with preview/validation (`/admin/import`) | ✅ Done |
| 7 | AI-assisted rating recommendations during RCSA | 🔜 Not started |

---

## Objective 6 — RCSA Workflow (built)

A risk owner selects risks at `/rcsa/start` (checklist showing each risk's last review date,
cadence, and current severity band). Risks **due for review** are pre-selected. Starting a
sitting creates a row in `rcsa_sessions` and hands off to `/rcsa/review` — a one-risk-at-a-time
wizard. Skip confirms if the rating was changed without saving.

The review page is built for a **challenger**, not a form-filler:

1. **Confirm inherent** — 5×5 picker for gross exposure. Residual cells above this stay disabled.
2. **Reviewer brief** (`lib/rcsa/review-insight.ts` → `buildEvidenceBrief`) — a
   headline plus bullets synthesising linked controls, incidents, and issues
   (overdue findings, ineffective key controls, uncontrolled exposure). Tone is
   ok / watch / alert.
3. **Evidence cards** — link or unlink controls, incidents, and issues from the
   review itself. New records can be created with `?risk=` and return to the sitting.
4. **Indicative residual** — derived from linked control effectiveness
   (likelihood reduced by 1 only when every relevant control is effective;
   impact unchanged). Used as a starting point for unassessed residual. After `010_residual.sql`, the
   reviewer **confirms residual** on the same 5×5 scale; it is stored on `risks`
   and on the review row. Residual cannot exceed inherent, and cannot be reduced
   with no linked controls.

`/rcsa/review` also accepts a single `risk` id, so "Review This Risk" from the
risks list or a risk's edit page skips the selection step.

Reviews land in `rcsa_reviews`. `rcsa_sessions` deliberately has **no status column** —
session progress isn't tracked; a session is just a grouping for the reviews it produced.

**Settled along the way:**
- Workflow shape: one-risk-at-a-time wizard (not a queue or inline dashboard editing).
- Linked controls, incidents, and issues can be linked or unlinked during review; new records return to the sitting via `?risk=` and `returnTo`.
- **Skip** is allowed without writing a review — a multi-risk sitting can move on.
- A reviewer who spots a gap raises an **issue** from the review instead of the flow
  growing its own remediation concept.
- The confirmed rating is written to `risks` **before** the `rcsa_reviews` insert, so a
  failed audit-row write cannot leave a review that disagrees with the register.
- Residual is confirmed in RCSA and stored on `risks` after `010`. Indicative residual remains a control-effectiveness aid, not an automatic write.
- The deferred "risk status" field is now on `risks` (`open` / `monitoring` / `closed`)
  after `004`. "Last reviewed" remains derived from `rcsa_reviews`.

**Deliberately not built yet** (common GRC features that don't earn a table until
they're needed): KRIs, true org memberships / RBAC (the
account is still the tenant; `org_people` is a directory, not extra logins; workspace
module visibility is presentation only; the cutover is documented in
`docs/MULTI_USER_MIGRATION_PLAN.md` and must not be implemented as a drive-by RLS
change), third-party / vendor risk as a separate module, control design vs operating
effectiveness as separate ratings, AI RCSA recommendations, a stored data-quality
score, or a regulatory-content ingestion engine.

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
cross-register operational landing) and from register **Summary** tabs (asset-specific
charts). This one takes a **Second Line of Defence (2LoD)** lens: not "how many records
exist" but "is the environment well-controlled, are reviews current, and is remediation
keeping pace." No create/edit forms — headline stats link out to filtered register views.

Organized into three workspace-togglable sections:

- **Health** — key-control testing overdue, uncontrolled High/Critical, reviews due,
  above appetite, overdue issue %, open incident age, unmapped controls, test pass rate
  (from `control_test_results` history), obligation coverage gaps, a 12-month **control testing** chart, and uncontrolled exposure by band.
- **Flow and aging** — open-issue aging; 30/90-day issue and incident flow bars; monthly
  opened-vs-closed line charts.
- **Rating movement** — latest RCSA vs incoming score, plus review recency.

Asset-specific visuals (heat map, taxonomy table, testing donuts, incident severity,
issues by source) live on the matching register’s Summary tab.

All computation lives in `lib/oversight/metrics.ts` and `lib/charts/time-series.ts`.
This keeps `app/oversight/page.tsx` a thin fetch-and-render shell. Chart components
specific to this page live under `app/components/oversight/`.

**Schema dependency:** incident flow needs `resolved_at`,
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
