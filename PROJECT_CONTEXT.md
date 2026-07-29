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
| likelihood | int2 | 1–5, constrained |
| impact | int2 | 1–5, constrained |
| owner_id | uuid | FK → auth.users, set automatically from logged-in user |
| owner_email | text | denormalized copy of owner's email, for display (auth.users isn't publicly queryable) |
| created_at | timestamptz | |

No status field yet (open/closed) — deferred; likely belongs in the RCSA workflow (Objective 6).

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
- `last_tested_at` > 365 days ago → Overdue
- Otherwise → Tested

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
| owner_id / owner_email | uuid / text | |
| created_at | timestamptz | |

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
risk — which is why there's still no review-status field on `risks`.

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
(e.g. `001_issues.sql`) which are **run manually in the Supabase SQL editor** — there is no
migration runner wired up. The files are written to be re-runnable (`create table if not
exists`, `drop policy if exists` before create).

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
- **Sidebar navigation** — persistent across all pages: Home, Risks, Controls, Incidents,
  Issues, RCSA, plus Log Out button. `app/layout.tsx` wraps every page in `<AppShell>`
  (`app/components/app-shell.tsx`), which hides the sidebar on `/login` and otherwise
  renders `app/components/app-sidebar.tsx` (active-link highlighting + centralized log out).
- **Home page** (`/`) — welcome message + user email, stat cards (risks, overdue controls,
  open incidents, open issues), and dashboard visuals, all click-through to a filtered list:
  - Risk heat map (5×5 grid, likelihood × impact, color-coded)
  - Bar chart: risk count by severity band (calculated from likelihood × impact: 1–5 Low,
    6–10 Medium, 11–19 High, 20–25 Critical)
  - Donut charts: controls by effectiveness, incidents by status, issues by status
  - Remediation health: action-plan completion across open issues, plus open/overdue
    counts per severity
  - Built with `recharts`.
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
| List filters held in the URL | `useListFilters` + the `parse*Filters` / `filter*` helpers in `lib/list-filters.ts` |
| Link/unlink against a join table | `useEntityLinks` — owns the rows, search/select state, and insert/delete |
| Rendering linked rows | `LinkedEntitiesPanel` + the builders in `app/components/linked-entity-rows.tsx` |
| New/edit form scaffolding | `EntityFormPage` |
| Input/label/button classes | `app/components/ui.ts` — do **not** hand-write these strings |
| Loading, error, header, card chrome | `app/components/page-parts.tsx` |
| Supabase join-row plumbing | `lib/types/join-utils.ts` + `lib/types/linked-entities.ts` |

**Palette:** `slate` for neutrals, `teal` for accents. The codebase was migrated off `zinc`
entirely — if you find a `zinc-*` class, it's a regression.

**`owner_id` on every query.** RLS enforces it at the database, but the app filters
explicitly too, because a missing filter is silently wrong rather than an error. This was a
real bug on the risks queries.

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
| 7 | AI-assisted rating recommendations during RCSA | 🔜 Not started |

---

## Objective 6 — RCSA Workflow (built)

A risk owner selects risks at `/rcsa/start` (checklist showing each risk's last review date),
which creates a row in `rcsa_sessions` and hands off to `/rcsa/review` — a one-risk-at-a-time
wizard showing the risk alongside its linked controls and incidents as evidence, with
likelihood/impact ratings to confirm or change. `/rcsa/review` also accepts a single `risk`
id, so "Review This Risk" from the risks list or a risk's edit page skips the selection step.

Reviews land in `rcsa_reviews`. `rcsa_sessions` deliberately has **no status column** —
session progress isn't tracked; a session is just a grouping for the reviews it produced.

**Settled along the way:**
- Workflow shape: one-risk-at-a-time wizard (not a queue or inline dashboard editing).
- Linked controls and incidents are shown as read-only evidence during review, rather than
  being editable in the same flow — reviewing a risk stayed risk-only.
- A reviewer who spots a gap raises an **issue** from the review instead of the flow
  growing its own remediation concept.
- The deferred "risk status" field still doesn't exist; "last reviewed" is derived from
  `rcsa_reviews` instead of stored on the risk.

## Objective 7 — AI-assisted rating recommendations (not started)

The remaining piece of the original Objective 6: an agent that reads a risk's control and
incident history and **recommends** a likelihood/impact rating rather than auto-applying it.
The RCSA wizard is the place it plugs into — it already assembles exactly the evidence such
an agent would need.

**Open design questions:**
- What the agent sees: just linked controls/incidents, or test history and past ratings too.
- Output format: a suggested likelihood/impact, a written rationale, or both.
- Where the human approves or overrides, and whether the recommendation is recorded
  alongside the review for later comparison against what the reviewer chose.

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
