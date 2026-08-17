"use client";

import { RecordLinkList } from "@/app/components/record-link-list";
import {
  formatActivityKind,
  type ActivityItem,
} from "@/lib/activity/feed";

export function ActivityList({ items }: { items: ActivityItem[] }) {
  return (
    <RecordLinkList
      items={items.map((item) => ({
        id: item.id,
        href: item.href,
        title: item.title,
        detail: `${formatActivityKind(item.kind)} · ${item.detail}`,
        meta: new Date(item.at).toLocaleString(),
      }))}
      empty="Reviews, control tests, incidents, and issue activity will appear here as the registers are used."
      limit={8}
    />
  );
}
