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

### Junction tables (many-to-many relationships)

**`risk_controls`** — links risks ↔ controls (many-to-many: one control can mitigate multiple risks, one risk can have multiple controls)
**`incident_risks`** — links incidents ↔ risks (many-to-many)

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

---

## App Structure / Conventions

- **Pages per module**: list view at `/risks`, `/controls`, `/incidents` (table only, no
  inline forms). "Add" button → separate page (`/risks/new`). Clicking a row → separate
  edit page (`/risks/[id]/edit`). This replaced an earlier "form on top, list below" layout
  that felt cluttered.
- **Linked records** (e.g. a risk's linked controls) are shown/managed on the **edit** page,
  not the list page.
- **Shared UI per module** lives in a `_components/` folder inside each module
  (e.g. `app/controls/_components/`): the form fields, linked-record panels, the control
  test-history panel, and a `constants.ts` holding the empty-form default and the shared
  input class string. The `_` prefix keeps these out of Next.js routing. Cross-module
  dashboard analytics helpers live in `lib/dashboard/analytics.ts`.
- **Sidebar navigation** — persistent across all pages: Home, Risks, Controls, Incidents,
  plus Log Out button. `app/layout.tsx` wraps every page in `<AppShell>`
  (`app/components/app-shell.tsx`), which hides the sidebar on `/login` and otherwise
  renders `app/components/app-sidebar.tsx` (active-link highlighting + centralized log out).
- **Home page** (`/`) — welcome message + user email, stat cards (risk count, overdue
  control count, open/investigating incident count), and dashboard visuals:
  - Risk heat map (5×5 grid, likelihood × impact, color-coded)
  - Bar chart: risk count by severity band (calculated from likelihood × impact: 1–5 Low,
    6–10 Medium, 11–19 High, 20–25 Critical)
  - Donut chart: controls by effectiveness
  - Donut chart: incidents by status
  - Built with `recharts`.
- **Dropdown gotcha (hit twice — worth remembering):** dropdowns must send the lowercase,
  underscored database value (`not_tested`) even though the displayed label is friendly
  text ("Not Tested"). Mixing these up causes a Postgres check-constraint violation (`23514`)
  or a "column does not exist" error (`PGRST204`) depending on what's mismatched.

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
| 6 | RCSA workflow with AI-assisted rating recommendations | 🔜 Not started |

---

## Objective 6 — RCSA Workflow (design in progress)

Goal: a workflow where a risk owner goes through each of their risks, reviews/updates
ratings, and — eventually — an AI agent reviews related control and incident data to
**recommend** a rating (not auto-apply it).

**Known complexity flag:** this is structurally different from everything built so far.
Objectives 1–5 were all CRUD-on-a-table with the same repeating pattern. Objective 6
introduces (a) a guided multi-step workflow UI, and (b) an AI agent that reads across
multiple tables and reasons over them — not just displaying data. Treat as its own
design phase, not a quick Cursor prompt.

**Open design questions (not yet decided):**
- Workflow UI shape: one-risk-at-a-time wizard vs. a review queue/checklist vs. inline
  dashboard editing.
- Whether reviewing a risk during RCSA should also prompt reviewing/updating its linked
  controls and incidents in the same flow, or stay risk-only.
- What "AI reviews control/incident data and recommends a rating" means concretely:
  what inputs it sees, what output format (a suggested likelihood/impact? a written
  rationale? both?), and where a human approves/overrides it.
- Whether RCSA introduces the deferred "risk status" field (e.g. marking a risk as
  reviewed, with a review date/cycle).

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
