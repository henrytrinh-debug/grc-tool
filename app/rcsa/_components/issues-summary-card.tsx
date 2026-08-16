"use client";

import Link from "next/link";
import { SummaryCard } from "./summary-card";
import {
  IssueSeverityBadge,
  IssueStatusBadge,
  OverdueBadge,
} from "@/app/components/status-badge";
import {
  buildIssuesSummary,
  formatIssueSeverityBreakdown,
  formatIssueStatusBreakdown,
} from "@/lib/rcsa/summaries";
import {
  formatDueDateLabel,
  formatIssueSeverity,
  formatIssueStatus,
  isIssueOverdue,
} from "@/lib/types/issue";
import type { LinkedIssue } from "@/lib/types/linked-entities";

type IssuesSummaryCardProps = {
  links: LinkedIssue[];
};

export function IssuesSummaryCard({ links }: IssuesSummaryCardProps) {
  const summary = buildIssuesSummary(links);

  return (
    <SummaryCard
      title="Issues Summary"
      description="Linked findings and remediation for this risk."
      toggleLabel="linked issues"
      stats={[
        { label: "Total linked", value: summary.total },
        {
          label: "Open / overdue",
          value: `${summary.open} open · ${summary.overdue} overdue`,
        },
        {
          label: "Severity",
          value:
            summary.total === 0
              ? "No linked issues"
              : formatIssueSeverityBreakdown(summary.severity),
          wide: true,
        },
        {
          label: "Status",
          value:
            summary.total === 0
              ? "No linked issues"
              : formatIssueStatusBreakdown(summary.status),
          wide: true,
        },
      ]}
      columnHeaders={["Title", "Severity", "Status", "Due"]}
      rows={links.map((link) => ({
        key: link.linkId,
        cells: [
          <Link
            key={`${link.linkId}-title`}
            href={`/issues/${link.issueId}/edit`}
            className="font-medium text-teal-700 underline underline-offset-2 dark:text-teal-300"
          >
            {link.title}
          </Link>,
          <IssueSeverityBadge
            key={`${link.linkId}-sev`}
            severity={link.severity}
            label={formatIssueSeverity(link.severity)}
          />,
          <span key={`${link.linkId}-status`} className="inline-flex flex-wrap items-center gap-1.5">
            <IssueStatusBadge
              status={link.status}
              label={formatIssueStatus(link.status)}
            />
            {isIssueOverdue(link) && <OverdueBadge />}
          </span>,
          formatDueDateLabel(link),
        ],
      }))}
      emptyMessage="No issues linked to this risk."
    />
  );
}
