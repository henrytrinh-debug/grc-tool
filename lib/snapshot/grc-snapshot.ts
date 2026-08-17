import type { SupabaseClient } from "@supabase/supabase-js";
import { indexLinkedCategories } from "@/lib/taxonomy";
import { fetchOwnedTable, fetchOwnedTableOptional } from "@/lib/supabase/owned";
import type { Control } from "@/lib/types/control";
import type { ControlTestResult } from "@/lib/types/control-test-result";
import type { IncidentEvent, RiskEvent } from "@/lib/governance/events";
import type { Incident } from "@/lib/types/incident";
import type { Issue } from "@/lib/types/issue";
import type { IssueAction } from "@/lib/types/issue-action";
import type { IssueComment } from "@/lib/types/issue-comment";
import { countByKey } from "@/lib/types/join-utils";
import {
  buildLastReviewedByRisk,
  type RcsaReview,
} from "@/lib/types/rcsa";
import type { Risk } from "@/lib/types/risk";

export type SnapshotProfile = "board" | "home" | "oversight" | "quality";

export type RiskControlLink = {
  risk_id: string;
  control_id: string;
};

export type IssueRiskLink = {
  issue_id: string;
  risk_id: string;
};

export type IssueControlLink = {
  issue_id: string;
  control_id: string;
};

export type IncidentRiskLink = {
  incident_id: string;
  risk_id: string;
};

export type SnapshotIndexes = {
  linkedControlCountsByRisk: Record<string, number>;
  controlCategoryIds: Record<string, string[]>;
  issueCategoryIds: Record<string, string[]>;
  incidentCategoryIds: Record<string, string[]>;
  lastReviewedByRisk: Record<string, string>;
};

export type GrcSnapshot = {
  risks: Risk[];
  controls: Control[];
  incidents: Incident[];
  issues: Issue[];
  actions: IssueAction[];
  reviews: RcsaReview[];
  tests: ControlTestResult[];
  comments: IssueComment[];
  riskControlLinks: RiskControlLink[];
  issueRiskLinks: IssueRiskLink[];
  incidentRiskLinks: IncidentRiskLink[];
  issueControlLinks: IssueControlLink[];
  riskEvents: RiskEvent[];
  incidentEvents: IncidentEvent[];
  indexes: SnapshotIndexes;
};

type SnapshotProfileConfig = {
  actions: boolean;
  reviews: boolean;
  tests: boolean;
  comments: boolean;
  issueRiskLinks: boolean;
  incidentRiskLinks: boolean;
  issueControlLinks: boolean;
  events: boolean;
};

const PROFILE_CONFIG: Record<SnapshotProfile, SnapshotProfileConfig> = {
  board: {
    actions: false,
    reviews: false,
    tests: false,
    comments: false,
    issueRiskLinks: false,
    incidentRiskLinks: false,
    issueControlLinks: false,
    events: false,
  },
  home: {
    actions: true,
    reviews: true,
    tests: true,
    comments: true,
    issueRiskLinks: true,
    incidentRiskLinks: true,
    issueControlLinks: false,
    events: true,
  },
  oversight: {
    actions: true,
    reviews: true,
    tests: true,
    comments: false,
    issueRiskLinks: true,
    incidentRiskLinks: true,
    issueControlLinks: false,
    events: false,
  },
  quality: {
    actions: false,
    reviews: true,
    tests: false,
    comments: false,
    issueRiskLinks: true,
    incidentRiskLinks: false,
    issueControlLinks: true,
    events: false,
  },
};

function emptyIndexes(): SnapshotIndexes {
  return {
    linkedControlCountsByRisk: {},
    controlCategoryIds: {},
    issueCategoryIds: {},
    incidentCategoryIds: {},
    lastReviewedByRisk: {},
  };
}

export function emptyGrcSnapshot(): GrcSnapshot {
  return {
    risks: [],
    controls: [],
    incidents: [],
    issues: [],
    actions: [],
    reviews: [],
    tests: [],
    comments: [],
    riskControlLinks: [],
    issueRiskLinks: [],
    incidentRiskLinks: [],
    issueControlLinks: [],
    riskEvents: [],
    incidentEvents: [],
    indexes: emptyIndexes(),
  };
}

function optionalOwnedTable<T>(
  enabled: boolean,
  supabase: SupabaseClient,
  table: string,
  ownerId: string,
  options?: Parameters<typeof fetchOwnedTable<T>>[3],
) {
  return enabled
    ? fetchOwnedTable<T>(supabase, table, ownerId, options)
    : Promise.resolve([] as T[]);
}

export function buildSnapshotIndexes(input: {
  risks: Risk[];
  reviews: RcsaReview[];
  riskControlLinks: RiskControlLink[];
  issueRiskLinks: IssueRiskLink[];
  incidentRiskLinks: IncidentRiskLink[];
}): SnapshotIndexes {
  const riskById = Object.fromEntries(
    input.risks.map((risk) => [risk.id, risk]),
  );

  return {
    linkedControlCountsByRisk: countByKey(
      input.riskControlLinks,
      (link) => link.risk_id,
    ),
    controlCategoryIds: indexLinkedCategories(
      input.riskControlLinks.map((link) => ({
        parentId: link.control_id,
        categoryId: riskById[link.risk_id]?.category_id,
      })),
    ),
    issueCategoryIds: indexLinkedCategories(
      input.issueRiskLinks.map((link) => ({
        parentId: link.issue_id,
        categoryId: riskById[link.risk_id]?.category_id,
      })),
    ),
    incidentCategoryIds: indexLinkedCategories(
      input.incidentRiskLinks.map((link) => ({
        parentId: link.incident_id,
        categoryId: riskById[link.risk_id]?.category_id,
      })),
    ),
    lastReviewedByRisk: buildLastReviewedByRisk(input.reviews),
  };
}

export async function fetchGrcSnapshot(
  supabase: SupabaseClient,
  ownerId: string,
  profile: SnapshotProfile,
): Promise<GrcSnapshot> {
  const config = PROFILE_CONFIG[profile];
  const [
    risks,
    controls,
    incidents,
    issues,
    actions,
    reviews,
    tests,
    comments,
    riskControlLinks,
    issueRiskLinks,
    incidentRiskLinks,
    issueControlLinks,
    riskEvents,
    incidentEvents,
  ] = await Promise.all([
    fetchOwnedTable<Risk>(supabase, "risks", ownerId),
    fetchOwnedTable<Control>(supabase, "controls", ownerId),
    fetchOwnedTable<Incident>(supabase, "incidents", ownerId),
    fetchOwnedTable<Issue>(supabase, "issues", ownerId),
    optionalOwnedTable<IssueAction>(
      config.actions,
      supabase,
      "issue_actions",
      ownerId,
    ),
    optionalOwnedTable<RcsaReview>(
      config.reviews,
      supabase,
      "rcsa_reviews",
      ownerId,
      { order: "reviewed_at" },
    ),
    optionalOwnedTable<ControlTestResult>(
      config.tests,
      supabase,
      "control_test_results",
      ownerId,
      { order: "tested_at" },
    ),
    optionalOwnedTable<IssueComment>(
      config.comments,
      supabase,
      "issue_comments",
      ownerId,
      { order: "created_at" },
    ),
    fetchOwnedTable<RiskControlLink>(
      supabase,
      "risk_controls",
      ownerId,
      { columns: "risk_id, control_id" },
    ),
    optionalOwnedTable<IssueRiskLink>(
      config.issueRiskLinks,
      supabase,
      "issue_risks",
      ownerId,
      { columns: "issue_id, risk_id" },
    ),
    optionalOwnedTable<IncidentRiskLink>(
      config.incidentRiskLinks,
      supabase,
      "incident_risks",
      ownerId,
      { columns: "incident_id, risk_id" },
    ),
    optionalOwnedTable<IssueControlLink>(
      config.issueControlLinks,
      supabase,
      "issue_controls",
      ownerId,
      { columns: "issue_id, control_id" },
    ),
    config.events
      ? fetchOwnedTableOptional<RiskEvent>(supabase, "risk_events", ownerId, {
          order: "created_at",
        })
      : Promise.resolve([] as RiskEvent[]),
    config.events
      ? fetchOwnedTableOptional<IncidentEvent>(
          supabase,
          "incident_events",
          ownerId,
          { order: "created_at" },
        )
      : Promise.resolve([] as IncidentEvent[]),
  ]);

  const indexes = buildSnapshotIndexes({
    risks,
    reviews,
    riskControlLinks,
    issueRiskLinks,
    incidentRiskLinks,
  });

  return {
    risks,
    controls,
    incidents,
    issues,
    actions,
    reviews,
    tests,
    comments,
    riskControlLinks,
    issueRiskLinks,
    incidentRiskLinks,
    issueControlLinks,
    riskEvents,
    incidentEvents,
    indexes,
  };
}
