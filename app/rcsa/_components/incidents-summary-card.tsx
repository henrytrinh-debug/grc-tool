"use client";

import Link from "next/link";
import { SummaryCard } from "./summary-card";
import {
  IncidentSeverityBadge,
  IncidentStatusBadge,
} from "@/app/components/status-badge";
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
          <Link
            key={`${link.linkId}-title`}
            href={`/incidents/${link.incidentId}/edit`}
            className="font-medium text-teal-700 underline underline-offset-2 dark:text-teal-300"
          >
            {link.title}
          </Link>,
          formatDateOccurred(link.date_occurred),
          <IncidentSeverityBadge
            key={`${link.linkId}-sev`}
            severity={link.severity}
            label={formatSeverity(link.severity)}
          />,
          <IncidentStatusBadge
            key={`${link.linkId}-status`}
            status={link.status}
            label={formatIncidentStatus(link.status)}
          />,
        ],
      }))}
      emptyMessage="No incidents linked to this risk."
    />
  );
}
