"use client";

import { useRouter } from "next/navigation";
import { DashboardDonutChart } from "@/app/components/dashboard/donut-charts";
import type { ChartCount } from "@/lib/dashboard/analytics";

const KEY_COLORS: Record<string, string> = {
  Key: "#0d9488",
  "Non-Key": "#94a3b8",
};

type ControlKeySplitDonutProps = {
  data: ChartCount[];
};

export function ControlKeySplitDonut({ data }: ControlKeySplitDonutProps) {
  const router = useRouter();

  return (
    <DashboardDonutChart
      data={data}
      colors={KEY_COLORS}
      emptyMessage="No controls to display."
      onSliceClick={(filterValue) => router.push(`/controls?isKey=${filterValue}`)}
    />
  );
}

const TESTING_STATUS_COLORS: Record<string, string> = {
  "Never Tested": "#94a3b8",
  Tested: "#22c55e",
  Overdue: "#ef4444",
};

type TestingCoverageDonutProps = {
  data: ChartCount[];
  /** Extra query params (e.g. isKey=true) merged into the /controls link. */
  extraParams?: Record<string, string>;
};

export function TestingCoverageDonut({
  data,
  extraParams,
}: TestingCoverageDonutProps) {
  const router = useRouter();

  return (
    <DashboardDonutChart
      data={data}
      colors={TESTING_STATUS_COLORS}
      emptyMessage="No controls to display."
      onSliceClick={(filterValue) => {
        const params = new URLSearchParams({
          testingStatus: filterValue,
          ...extraParams,
        });
        router.push(`/controls?${params.toString()}`);
      }}
    />
  );
}

const SOURCE_COLORS: Record<string, string> = {
  "Internal Audit": "#0d9488",
  "External Audit": "#0891b2",
  "Regulatory Exam": "#7c3aed",
  "Control Failure": "#ef4444",
  Incident: "#f97316",
  "Risk Assessment": "#eab308",
  "Self Identified": "#94a3b8",
};

type OpenIssuesBySourceDonutProps = {
  data: ChartCount[];
};

export function OpenIssuesBySourceDonut({ data }: OpenIssuesBySourceDonutProps) {
  const router = useRouter();

  return (
    <DashboardDonutChart
      data={data}
      colors={SOURCE_COLORS}
      emptyMessage="No open issues to display."
      onSliceClick={(filterValue) =>
        router.push(
          `/issues?source=${filterValue}&status=open,in_progress,pending_review`,
        )
      }
    />
  );
}

const INCIDENT_SEVERITY_COLORS: Record<string, string> = {
  Low: "#22c55e",
  Medium: "#eab308",
  High: "#f97316",
  Critical: "#ef4444",
};

type IncidentSeverityDonutProps = {
  data: ChartCount[];
};

export function IncidentSeverityDonut({ data }: IncidentSeverityDonutProps) {
  const router = useRouter();

  return (
    <DashboardDonutChart
      data={data}
      colors={INCIDENT_SEVERITY_COLORS}
      emptyMessage="No incidents to display."
      onSliceClick={(filterValue) => router.push(`/incidents?severity=${filterValue}`)}
    />
  );
}
