"use client";

import { SummaryCard } from "./summary-card";
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
      rows={links.map((link) => ({
        key: link.linkId,
        cells: [
          link.title,
          link.is_key ? "Key" : "Non-Key",
          formatEffectiveness(link.effectiveness),
          getTestingStatus(link.last_tested_at),
        ],
      }))}
      emptyMessage="No controls linked to this risk."
    />
  );
}
