/**
 * Lightweight checks for filter / taxonomy helpers.
 * Run with: npx tsx scripts/verify-logic.ts
 */
import { barClickDatum } from "../app/components/chart-theme";
import { buildActivityFeed } from "../lib/activity/feed";
import { boardPackCsv, buildBoardPack } from "../lib/board/pack";
import { buildQualityFindings } from "../lib/data-quality/checks";
import {
  evidenceQuality,
  riskQuality,
} from "../lib/data-quality/record";
import {
  incidentEventDrafts,
  riskEventDrafts,
} from "../lib/governance/events";
import {
  incidentGovernanceBlockers,
  incidentGovernancePrompts,
  riskGovernanceBlockers,
} from "../lib/governance/gates";
import { parseCsv } from "../lib/import/csv";
import {
  importHasErrors,
  validateImport,
} from "../lib/import/validate";
import { isEvidenceExpired } from "../lib/types/evidence";
import { obligationCoverage } from "../lib/types/obligation";
import {
  filterControls,
  filterIncidents,
  filterIssues,
  filterRisks,
  hasActiveFilters,
  parseIncidentFilters,
  parseIssueFilters,
  parseRiskFilters,
  sortRisksByExposure,
} from "../lib/list-filters";
import { buildRatingMovement } from "../lib/oversight/movement";
import { buildSnapshotIndexes } from "../lib/snapshot/grc-snapshot";
import {
  BOARD_SECTION_IDS,
  HOME_WIDGET_IDS,
  createRegisterPreset,
  parseWorkspacePreferences,
  resolveHomeCategoryId,
  visibleNavigationSections,
  visibleStaticCommands,
} from "../lib/settings/preferences";
import {
  isActiveRisk,
  isAppetiteBreach,
  matchesCategoryFilter,
  matchesInheritedCategory,
  UNCATEGORISED_FILTER,
} from "../lib/taxonomy";
import type { Control } from "../lib/types/control";
import type { Incident } from "../lib/types/incident";
import type { Issue } from "../lib/types/issue";
import type { OrgPerson } from "../lib/types/person";
import type { Risk } from "../lib/types/risk";

function assert(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

const cyber = {
  id: "cat-cyber",
  name: "Cyber",
  description: "",
  sort_order: 1,
  appetite_band: "Medium" as const,
};

function risk(overrides: Partial<Risk> & Pick<Risk, "id" | "title">): Risk {
  return {
    description: "",
    likelihood: 3,
    impact: 3,
    ...overrides,
  };
}

const risks: Risk[] = [
  risk({
    id: "r1",
    title: "Phishing",
    likelihood: 5,
    impact: 5,
    category_id: cyber.id,
    status: "open",
    assignee_id: "p1",
  }),
  risk({
    id: "r2",
    title: "Vendor delay",
    likelihood: 2,
    impact: 2,
    category_id: null,
    status: "open",
  }),
  risk({
    id: "r3",
    title: "Legacy access",
    likelihood: 5,
    impact: 5,
    category_id: cyber.id,
    status: "closed",
    assignee_id: "p1",
  }),
];

const parsed = parseRiskFilters(
  new URLSearchParams(
    "q=phish&severity=Critical&category=cat-cyber&assignee=p1&appetiteBreach=true&status=open",
  ),
);

assert(parsed.q === "phish", "parseRiskFilters q");
assert(parsed.severity === "Critical", "parseRiskFilters severity");
assert(parsed.categoryId === "cat-cyber", "parseRiskFilters category");
assert(parsed.assignee === "p1", "parseRiskFilters assignee");
assert(parsed.appetiteBreach, "parseRiskFilters appetiteBreach");
assert(parsed.status === "open", "parseRiskFilters status");

assert(isAppetiteBreach(risks[0], [cyber]), "open critical cyber risk is above Medium appetite");
assert(!isAppetiteBreach(risks[2], [cyber]), "closed risks are not appetite breaches");
assert(!isActiveRisk(risks[2]), "closed risk is inactive");

assert(matchesCategoryFilter(null, UNCATEGORISED_FILTER), "uncategorised filter matches null");
assert(!matchesCategoryFilter(cyber.id, UNCATEGORISED_FILTER), "uncategorised filter excludes categorised");
assert(
  matchesInheritedCategory([], UNCATEGORISED_FILTER),
  "inherited uncategorised when no linked categories",
);
assert(
  matchesInheritedCategory([cyber.id], cyber.id),
  "inherited category matches any linked id",
);

const filtered = filterRisks(risks, parsed, {
  categories: [cyber],
  myPersonId: "p1",
});
assert(filtered.length === 1 && filtered[0].id === "r1", "filterRisks combines query, band, owner, appetite");

const unassigned = filterRisks(
  risks,
  parseRiskFilters(new URLSearchParams("assignee=unassigned")),
);
assert(unassigned.length === 1 && unassigned[0].id === "r2", "unassigned assignee filter");

const me = filterRisks(
  risks,
  parseRiskFilters(new URLSearchParams("assignee=me")),
  { myPersonId: "p1" },
);
assert(
  me.length === 2 && me.every((item) => item.assignee_id === "p1"),
  "me assignee filter",
);

const ranked = sortRisksByExposure(risks);
assert(ranked[0].id !== "r2", "sortRisksByExposure puts higher scores first");

const issueParams = parseIssueFilters(
  new URLSearchParams("status=open,in_progress,pending_review&overdue=true"),
);
assert(
  issueParams.status.length === 3 && issueParams.overdue,
  "parseIssueFilters comma statuses",
);

const issues: Issue[] = [
  {
    id: "i1",
    title: "Access review",
    description: "",
    source: "internal_audit",
    severity: "high",
    status: "open",
    identified_at: "2026-01-01",
    due_date: "2020-01-01",
    root_cause: "",
    remediation_plan: "",
    closure_notes: "",
    closed_at: null,
    assignee_id: "p1",
  },
];

const overdueIssues = filterIssues(
  issues,
  parseIssueFilters(new URLSearchParams("overdue=true&assignee=me")),
  { myPersonId: "p1", linkedCategoryIds: { i1: [] } },
);
assert(overdueIssues.length === 1, "overdue issue assigned to me");

const uncategorisedIssues = filterIssues(issues, parseIssueFilters(new URLSearchParams("category=uncategorised")), {
  linkedCategoryIds: { i1: [] },
});
assert(uncategorisedIssues.length === 1, "issue with no linked categories is uncategorised");

const incidents: Incident[] = [
  {
    id: "inc1",
    title: "Outage",
    description: "",
    date_occurred: "2026-01-01",
    severity: "high",
    status: "open",
    root_cause: "",
    assignee_id: null,
  },
];

const openIncidents = filterIncidents(
  incidents,
  parseIncidentFilters(new URLSearchParams("status=open,investigating")),
);
assert(openIncidents.length === 1, "incident open,investigating filter");

const controls: Control[] = [
  {
    id: "c1",
    title: "MFA",
    description: "",
    is_key: true,
    effectiveness: "ineffective",
    last_tested_at: null,
    control_type: "preventive",
    assignee_id: "p1",
  },
];

const keyControls = filterControls(controls, {
  q: "",
  effectiveness: "",
  testingStatus: "Never Tested",
  isKey: "true",
  unmapped: false,
  categoryId: "",
  controlType: "",
  assignee: "p1",
  department: "",
});
assert(keyControls.length === 1, "key never-tested control filter");

assert(!hasActiveFilters({ q: "", severity: "", uncontrolled: false }), "empty filters are inactive");
assert(hasActiveFilters({ q: "x" }), "search counts as active");
assert(hasActiveFilters({ status: ["open"] }), "array filters count as active");

const peopleDirectory: Array<Pick<OrgPerson, "id" | "name" | "email" | "title" | "department" | "line_of_defence">> = [
  {
    id: "p1",
    name: "Priya",
    email: "priya@demo.grc",
    title: "CISO",
    department: "Technology",
    line_of_defence: "first",
  },
];

const techRisks = filterRisks(
  risks,
  parseRiskFilters(new URLSearchParams("department=Technology")),
  { people: peopleDirectory as OrgPerson[] },
);
assert(
  techRisks.length === 2 && techRisks.every((item) => item.assignee_id === "p1"),
  "department filter uses assignee directory",
);

const highCritical = filterRisks(
  risks,
  parseRiskFilters(new URLSearchParams("severity=High,Critical")),
);
assert(
  highCritical.map((item) => item.id).sort().join(",") === "r1,r3",
  "High,Critical combined severity filter",
);

const severeIncidents = filterIncidents(
  incidents,
  parseIncidentFilters(new URLSearchParams("severity=high,critical")),
);
assert(severeIncidents.length === 1, "incident high,critical combined filter");

const pack = buildBoardPack({
  risks,
  controls,
  incidents,
  issues,
  categories: [cyber],
  linkedControlCounts: { r1: 0, r2: 1, r3: 1 },
});
assert(
  pack.headlines.some((headline) => headline.label === "Above appetite" && headline.value === 1),
  "board pack counts appetite breach on open critical cyber risk",
);
assert(
  pack.headlines.some(
    (headline) =>
      headline.label === "Uncontrolled High/Critical" && headline.value === 1,
  ),
  "board pack counts uncontrolled high/critical",
);

const movement = buildRatingMovement(
  [
    {
      id: "rev1",
      session_id: "s1",
      risk_id: "r1",
      reviewed_at: "2026-01-02T00:00:00.000Z",
      previous_likelihood: 3,
      previous_impact: 3,
      final_likelihood: 5,
      final_impact: 5,
    },
    {
      id: "rev0",
      session_id: "s1",
      risk_id: "r1",
      reviewed_at: "2025-01-01T00:00:00.000Z",
      previous_likelihood: 5,
      previous_impact: 5,
      final_likelihood: 3,
      final_impact: 3,
    },
  ],
  risks,
);
assert(movement.increased === 1 && movement.moves[0]?.riskId === "r1", "rating movement uses latest review");

const indexes = buildSnapshotIndexes({
  risks,
  reviews: [],
  riskControlLinks: [
    { risk_id: "r1", control_id: "c1" },
    { risk_id: "r2", control_id: "c1" },
  ],
  issueRiskLinks: [{ issue_id: "i1", risk_id: "r1" }],
  incidentRiskLinks: [{ incident_id: "inc1", risk_id: "r1" }],
});
assert(
  indexes.linkedControlCountsByRisk.r1 === 1 &&
    indexes.controlCategoryIds.c1?.includes(cyber.id),
  "snapshot indexes centralise link counts and inherited taxonomy",
);

const activity = buildActivityFeed({
  risks,
  controls,
  incidents: [],
  issues,
  reviews: [],
  tests: [
    {
      id: "test-1",
      control_id: "c1",
      effectiveness: "effective",
      tested_at: "2026-03-03",
      notes: "",
    },
  ],
  comments: [
    {
      id: "comment-1",
      issue_id: "i1",
      body: "Issue raised.",
      kind: "status_change",
      created_at: "2026-03-02T12:00:00.000Z",
    },
  ],
});
assert(activity[0]?.id === "test-test-1", "activity uses chronological timestamps");
assert(
  activity.filter((item) => item.href === "/issues/i1/edit").length === 1 &&
    activity.some((item) => item.kind === "issue_status"),
  "activity avoids duplicate issue creation and labels status events",
);

assert(
  barClickDatum<{ filterValue: string }>({ payload: { filterValue: "cyber" } })
    ?.filterValue === "cyber",
  "barClickDatum reads nested payload",
);
assert(
  barClickDatum<{ band: string }>({ band: "High" })?.band === "High",
  "barClickDatum falls back to top-level datum",
);

const defaultPrefs = parseWorkspacePreferences({});
assert(
  defaultPrefs.homeWidgets.length === HOME_WIDGET_IDS.length &&
    defaultPrefs.hiddenModules.length === 0 &&
    defaultPrefs.oversightSections.length === 4 &&
    defaultPrefs.boardSections.length === BOARD_SECTION_IDS.length,
  "missing workspace preferences keep the current UI",
);
assert(
  parseWorkspacePreferences({ homeWidgets: [] }).homeWidgets.length === 0,
  "empty homeWidgets is an explicit hide-all",
);
assert(
  !parseWorkspacePreferences({ hiddenModules: ["home", "admin", "work"] })
    .hiddenModules.includes("home") &&
    parseWorkspacePreferences({ hiddenModules: ["home", "admin", "work"] })
      .hiddenModules[0] === "work",
  "Home and Admin cannot be hidden",
);
assert(
  visibleNavigationSections(
    parseWorkspacePreferences({ hiddenModules: ["work", "horizon"] }),
  ).every((section) =>
    section.items.every((item) => item.module !== "work" && item.module !== "horizon"),
  ),
  "hidden modules drop from navigation",
);
assert(
  visibleStaticCommands(
    parseWorkspacePreferences({ hiddenModules: ["oversight"] }),
  ).every((command) => command.module !== "oversight"),
  "hidden modules drop from command palette",
);
assert(
  boardPackCsv(pack, ["appetite"]).every((row) => row[0] === "Above appetite") &&
    boardPackCsv(pack, ["appetite"]).length === pack.appetiteBreaches.length,
  "board CSV respects visible sections",
);
assert(resolveHomeCategoryId("", "cat-cyber") === "cat-cyber", "home default category");
assert(resolveHomeCategoryId("all", "cat-cyber") === "", "home all overrides default");
assert(
  createRegisterPreset({
    name: "High risks",
    module: "risks",
    query: "?severity=High,Critical",
  })?.query === "severity=High,Critical",
  "saved views store a query string without ?",
);
assert(
  createRegisterPreset({
    name: "bad",
    module: "risks",
    query: "https://example.com",
  }) === null,
  "saved views reject absolute URLs",
);

const quality = buildQualityFindings({
  risks,
  controls,
  incidents,
  issues,
  indexes,
  riskControlLinks: [
    { risk_id: "r1", control_id: "c1" },
    { risk_id: "r2", control_id: "c1" },
  ],
  issueRiskLinks: [{ issue_id: "i1", risk_id: "r1" }],
  issueControlLinks: [],
  operatingReady: true,
});
assert(
  quality.some(
    (finding) =>
      finding.id === "uncategorised-risks" &&
      finding.items.some((item) => item.id === "r2"),
  ),
  "quality flags uncategorised active risks",
);
assert(
  quality.some(
    (finding) =>
      finding.id === "resolved-without-root-cause" && finding.count === 0,
  ),
  "open incidents are not flagged for missing root cause",
);

assert(
  riskQuality(risks[1], {
    controlCount: 0,
    hasReview: false,
    enterpriseReady: true,
  }).flags.includes("Uncategorised"),
  "record quality flags uncategorised active risks",
);
assert(
  riskQuality(risks[2], { controlCount: 0, hasReview: false }).applicable === 0,
  "closed risks have no record-quality score",
);
assert(
  evidenceQuality({ retention_date: "2020-01-01", storage_path: null }).flags.includes(
    "Past retention date",
  ) &&
    !evidenceQuality({
      retention_date: "2020-01-01",
      storage_path: null,
    }).flags.includes("No file attached"),
  "missing files are only a record-quality gap when storage is configured",
);

assert(
  riskGovernanceBlockers(
    {
      treatment: "accept",
      treatment_rationale: "",
      status: "open",
      closure_rationale: "",
    },
    { operatingReady: true, hasReviewEvidence: false },
  ).length === 1,
  "accepted risks need rationale when operating schema is ready",
);
assert(
  riskGovernanceBlockers(
    {
      treatment: "mitigate",
      treatment_rationale: "",
      status: "closed",
      closure_rationale: "",
    },
    { operatingReady: true, hasReviewEvidence: true },
  ).length === 0,
  "close is allowed with RCSA evidence and no closure rationale",
);
assert(
  incidentGovernanceBlockers({
    status: "resolved",
    root_cause: "",
  }).length === 1,
  "resolved incidents need a root cause",
);
assert(
  incidentGovernancePrompts(
    { status: "resolved", lessons_learned: "" },
    true,
  ).length === 1,
  "lessons learned is a prompt, not a blocker",
);

assert(
  riskEventDrafts({
    previousStatus: "open",
    nextStatus: "closed",
    previousTreatment: "mitigate",
    nextTreatment: "mitigate",
    previousAssigneeId: "p1",
    nextAssigneeId: "p1",
    previousLikelihood: 3,
    nextLikelihood: 5,
    previousImpact: 3,
    nextImpact: 3,
  }).map((draft) => draft.event_type).join(",") === "status,rating",
  "risk events record status and rating changes",
);
assert(
  incidentEventDrafts({
    previousStatus: "open",
    nextStatus: "open",
    previousAssigneeId: "",
    nextAssigneeId: "p1",
    previousSeverity: "high",
    nextSeverity: "critical",
  }).length === 2,
  "incident events record assignment and severity",
);

const parsedCsv = parseCsv('title,description\n"Phish,ing",note\n');
assert(
  parsedCsv[1]?.[0] === "Phish,ing" && parsedCsv[1]?.[1] === "note",
  "CSV parser keeps quoted commas",
);

const importRows = validateImport({
  kind: "risks",
  csvText:
    "title,description,likelihood,impact,category,treatment,status,assignee\nPhishing,x,5,5,Cyber,mitigate,open,Priya\n",
  existingTitles: ["Phishing"],
  categories: [{ id: "cat-cyber", name: "Cyber" }],
  people: [{ id: "p1", name: "Priya", email: "priya@demo.grc" }],
});
assert(importHasErrors(importRows), "likely duplicate titles block import");

const cleanImport = validateImport({
  kind: "taxonomy",
  csvText: "name,description,appetite_band\nFraud,Internal fraud,High\n",
  existingTitles: ["Cyber"],
  categories: [cyber],
  people: [],
});
assert(
  !importHasErrors(cleanImport) && cleanImport[0]?.payload.name === "Fraud",
  "taxonomy import accepts a new category name",
);

assert(
  isEvidenceExpired({ retention_date: "2020-01-01" }, "2026-08-17") &&
    !isEvidenceExpired({ retention_date: null }, "2026-08-17"),
  "evidence expiry is date-only and ignores missing retention",
);
assert(
  obligationCoverage(
    [
      { id: "o1", status: "open" },
      { id: "o2", status: "retired" },
    ],
    [{ obligation_id: "o1" }],
  ).uncovered === 0,
  "retired obligations are not coverage gaps",
);

console.log("verify-logic: all checks passed");
