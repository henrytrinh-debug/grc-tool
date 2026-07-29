"use client";

import { SummaryCard } from "./summary-card";
import {
  buildIncidentsSummary,
  formatMostRecentIncidentDate,
  formatSeverityBreakdown,
  formatStatusBreakdown,
} from "@/lib/rcsa/summaries";
import {
  formatDateOccurred,
  formatIncidentStatus,
  formatSeverity,
} from "@/lib/types/incident";
import type { LinkedIncident } from "@/lib/types/linked-entities";

type IncidentsSummaryCardProps = {
  links: LinkedIncident[];
};

export function IncidentsSummaryCard({ links }: IncidentsSummaryCardProps) {
  const summary = buildIncidentsSummary(links);

  return (
    <SummaryCard
      title="Incidents Summary"
      description="Linked incidents for this risk."
      toggleLabel="linked incidents"
      stats={[
        { label: "Total linked", value: summary.total },
        {
          label: "Most recent incident",
          value: formatMostRecentIncidentDate(summary.mostRecentDate),
        },
        {
          label: "Severity",
          value:
            summary.total === 0
              ? "No linked incidents"
              : formatSeverityBreakdown(summary.severity),
          wide: true,
        },
        {
          label: "Status",
          value:
            summary.total === 0
              ? "No linked incidents"
              : formatStatusBreakdown(summary.status),
          wide: true,
        },
      ]}
      columnHeaders={["Title", "Date Occurred", "Severity", "Status"]}
      rows={links.map((link) => ({
        key: link.linkId,
        cells: [
          link.title,
          formatDateOccurred(link.date_occurred),
          formatSeverity(link.severity),
          formatIncidentStatus(link.status),
        ],
      }))}
      emptyMessage="No incidents linked to this risk."
    />
  );
}
