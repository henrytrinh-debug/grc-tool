"use client";

import { useCallback, useEffect, useState } from "react";
import { LinkedEntitiesPanel } from "@/app/components/linked-entities-panel";
import {
  buildControlRows,
  buildIncidentRows,
  buildIssueRows,
  CONTROL_COLUMNS,
  INCIDENT_COLUMNS,
  ISSUE_COLUMNS,
} from "@/app/components/linked-entity-rows";
import { mutedTextClassName } from "@/app/components/ui";
import { useEntityLinks } from "@/lib/hooks/use-entity-links";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { Control } from "@/lib/types/control";
import type { Incident } from "@/lib/types/incident";
import type { Issue } from "@/lib/types/issue";
import {
  groupIncidentRiskRowsByRisk,
  INCIDENT_RISK_INCIDENT_SELECT,
  type IncidentRiskIncidentRow,
} from "@/lib/types/incident-risk";
import {
  groupIssuesByRisk,
  ISSUE_RISK_ISSUE_SELECT,
  type IssueRiskIssueRow,
} from "@/lib/types/issue-links";
import type {
  LinkedControl,
  LinkedIncident,
  LinkedIssue,
} from "@/lib/types/linked-entities";
import {
  groupRiskControlRows,
  RISK_CONTROL_SELECT,
  type RiskControlRow,
} from "@/lib/types/risk-control";

type ReviewEvidenceLinksProps = {
  riskId: string;
  ownerId: string;
  returnTo: string;
  onError: (message: string | null) => void;
  onLinksChange: (links: {
    controls: LinkedControl[];
    incidents: LinkedIncident[];
    issues: LinkedIssue[];
  }) => void;
};

export function ReviewEvidenceLinks({
  riskId,
  ownerId,
  returnTo,
  onError,
  onLinksChange,
}: ReviewEvidenceLinksProps) {
  const [controls, setControls] = useState<Control[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);

  const {
    linked: linkedControls,
    refresh: refreshControls,
    panelProps: controlPanelProps,
  } = useEntityLinks<RiskControlRow, LinkedControl>({
    table: "risk_controls",
    select: RISK_CONTROL_SELECT,
    parentColumn: "risk_id",
    parentId: riskId,
    childColumn: "control_id",
    parse: (rows) => groupRiskControlRows(rows)[riskId] ?? [],
    label: "control",
    onError,
  });

  const {
    linked: linkedIncidents,
    refresh: refreshIncidents,
    panelProps: incidentPanelProps,
  } = useEntityLinks<IncidentRiskIncidentRow, LinkedIncident>({
    table: "incident_risks",
    select: INCIDENT_RISK_INCIDENT_SELECT,
    parentColumn: "risk_id",
    parentId: riskId,
    childColumn: "incident_id",
    parse: (rows) => groupIncidentRiskRowsByRisk(rows)[riskId] ?? [],
    label: "incident",
    onError,
  });

  const {
    linked: linkedIssues,
    refresh: refreshIssues,
    panelProps: issuePanelProps,
  } = useEntityLinks<IssueRiskIssueRow, LinkedIssue>({
    table: "issue_risks",
    select: ISSUE_RISK_ISSUE_SELECT,
    parentColumn: "risk_id",
    parentId: riskId,
    childColumn: "issue_id",
    parse: (rows) => groupIssuesByRisk(rows)[riskId] ?? [],
    label: "issue",
    onError,
  });

  const loadOptions = useCallback(async () => {
    const supabase = getSupabaseClient();
    const [controlResult, incidentResult, issueResult] = await Promise.all([
      supabase
        .from("controls")
        .select("id, title")
        .eq("owner_id", ownerId)
        .order("title", { ascending: true }),
      supabase
        .from("incidents")
        .select("id, title")
        .eq("owner_id", ownerId)
        .order("title", { ascending: true }),
      supabase
        .from("issues")
        .select("id, title")
        .eq("owner_id", ownerId)
        .order("title", { ascending: true }),
    ]);

    if (controlResult.error) {
      throw controlResult.error;
    }
    if (incidentResult.error) {
      throw incidentResult.error;
    }
    if (issueResult.error) {
      throw issueResult.error;
    }

    setControls((controlResult.data ?? []) as Control[]);
    setIncidents((incidentResult.data ?? []) as Incident[]);
    setIssues((issueResult.data ?? []) as Issue[]);
  }, [ownerId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async option load
    void loadOptions().catch((err) => {
      onError(err instanceof Error ? err.message : "Failed to load link options");
    });
  }, [loadOptions, onError]);

  useEffect(() => {
    void Promise.all([
      refreshControls(ownerId),
      refreshIncidents(ownerId),
      refreshIssues(ownerId),
    ]).catch((err) => {
      onError(err instanceof Error ? err.message : "Failed to load linked evidence");
    });
  }, [ownerId, refreshControls, refreshIncidents, refreshIssues, onError, riskId]);

  useEffect(() => {
    onLinksChange({
      controls: linkedControls,
      incidents: linkedIncidents,
      issues: linkedIssues,
    });
  }, [linkedControls, linkedIncidents, linkedIssues, onLinksChange]);

  const encodedReturn = encodeURIComponent(returnTo);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium text-slate-950 dark:text-slate-50">
          2. Link evidence
        </h2>
        <p className={`mt-1 text-sm ${mutedTextClassName}`}>
          Residual credit depends on the controls you attach here. Link incidents
          and issues so the review is complete, or create a new record and return
          to this sitting.
        </p>
      </div>

      <LinkedEntitiesPanel
        title="Controls"
        entityLabel="Control"
        parentLabel="risk"
        createHref={`/controls/new?risk=${riskId}&returnTo=${encodedReturn}`}
        columnHeaders={CONTROL_COLUMNS}
        rows={buildControlRows(linkedControls)}
        options={controls}
        {...controlPanelProps}
      />
      <LinkedEntitiesPanel
        title="Incidents"
        entityLabel="Incident"
        parentLabel="risk"
        createHref={`/incidents/new?risk=${riskId}&returnTo=${encodedReturn}`}
        columnHeaders={INCIDENT_COLUMNS}
        rows={buildIncidentRows(linkedIncidents)}
        options={incidents}
        {...incidentPanelProps}
      />
      <LinkedEntitiesPanel
        title="Issues"
        entityLabel="Issue"
        parentLabel="risk"
        createHref={`/issues/new?${new URLSearchParams({
          source: "risk_assessment",
          risk: riskId,
          returnTo,
        }).toString()}`}
        columnHeaders={ISSUE_COLUMNS}
        rows={buildIssueRows(linkedIssues)}
        options={issues}
        {...issuePanelProps}
      />

      <p className={`text-sm ${mutedTextClassName}`}>
        Prefer to raise a finding instead of changing the rating?{" "}
        <a
          href={`/issues/new?${new URLSearchParams({
            source: "risk_assessment",
            risk: riskId,
            returnTo,
          }).toString()}`}
          className="font-medium text-teal-800 underline-offset-2 hover:underline dark:text-teal-300"
        >
          Raise issue
        </a>
      </p>
    </div>
  );
}
