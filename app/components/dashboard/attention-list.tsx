"use client";

import Link from "next/link";
import type { AttentionItem } from "@/lib/dashboard/attention";
import { mutedTextClassName } from "@/app/components/ui";

type AttentionListProps = {
  items: AttentionItem[];
};

const toneClasses = {
  alert:
    "border-red-200 bg-red-50/70 dark:border-red-900 dark:bg-red-950/40",
  watch:
    "border-amber-200 bg-amber-50/70 dark:border-amber-900 dark:bg-amber-950/40",
} as const;

const reasonClasses = {
  alert: "text-red-700 dark:text-red-400",
  watch: "text-amber-800 dark:text-amber-300",
} as const;

export function AttentionList({ items }: AttentionListProps) {
  if (items.length === 0) {
    return (
      <p className={`text-sm ${mutedTextClassName}`}>
        Nothing flagged right now. Overdue issues, failed key controls, open
        high/critical incidents, and High/Critical risks that are uncontrolled
        or past their review cadence will appear here.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.id}>
          <Link
            href={item.href}
            className={`flex flex-col gap-0.5 rounded-lg border px-4 py-3 transition-colors hover:border-teal-300 dark:hover:border-teal-700 ${toneClasses[item.tone]}`}
          >
            <span className="text-sm font-medium text-slate-950 dark:text-slate-50">
              {item.title}
            </span>
            <span className={`text-xs ${reasonClasses[item.tone]}`}>
              {item.reason}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
