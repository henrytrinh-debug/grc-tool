"use client";

import Link from "next/link";
import { SummaryCard } from "./summary-card";
import {
  EffectivenessBadge,
  KeyBadge,
  TestingStatusBadge,
} from "@/app/components/status-badge";
import {
  buildControlsSummary,
  formatEffectivenessBreakdown,
} from "@/lib/rcsa/summaries";
import { formatEffectiveness, getTestingStatus } from "@/lib/types/control";
import type { LinkedControl } from "@/lib/types/linked-entities";

type ControlsSummaryCardProps = {
  links: LinkedControl[];
};

export function ControlsSummaryCard({ links }: ControlsSummaryCardProps) {
  const summary = buildControlsSummary(links);

  return (
    <SummaryCard
      title="Controls Summary"
      description="Linked controls for this risk."
      toggleLabel="linked controls"
      stats={[
        { label: "Total linked", value: summary.total },
        {
          label: "Key vs Non-Key",
          value: `Key: ${summary.keyCount} · Non-Key: ${summary.nonKeyCount}`,
        },
        {
          label: "Effectiveness",
          value:
            summary.total === 0
              ? "No linked controls"
              : formatEffectivenessBreakdown(summary.effectiveness),
          wide: true,
        },
      ]}
      columnHeaders={["Title", "Key", "Effectiveness", "Testing Status"]}
      rows={links.map((link) => {
        const testingStatus = getTestingStatus(link.last_tested_at, link.is_key);

        return {
          key: link.linkId,
          cells: [
            <Link
              key={`${link.linkId}-title`}
              href={`/controls/${link.controlId}/edit`}
              className="font-medium text-teal-700 underline underline-offset-2 dark:text-teal-300"
            >
              {link.title}
            </Link>,
            <KeyBadge key={`${link.linkId}-key`} isKey={link.is_key} />,
            <EffectivenessBadge
              key={`${link.linkId}-eff`}
              effectiveness={link.effectiveness}
              label={formatEffectiveness(link.effectiveness)}
            />,
            <TestingStatusBadge
              key={`${link.linkId}-test`}
              status={testingStatus}
            />,
          ],
        };
      })}
      emptyMessage="No controls linked to this risk."
    />
  );
}
