"use client";

import { RecordLinkList } from "@/app/components/record-link-list";
import type { AttentionItem } from "@/lib/dashboard/attention";

type AttentionListProps = {
  items: AttentionItem[];
};

export function AttentionList({ items }: AttentionListProps) {
  return (
    <RecordLinkList
      variant="cards"
      items={items.map((item) => ({
        id: item.id,
        href: item.href,
        title: item.title,
        detail: item.reason,
        tone: item.tone,
      }))}
      empty="Nothing flagged right now. Overdue issues, failed key controls, open high/critical incidents, and High/Critical risks that are uncontrolled or past their review cadence will appear here."
      limit={8}
    />
  );
}
