"use client";

import { formatIsoDate } from "@/lib/dates";
import { mutedTextClassName } from "@/app/components/ui";
import { ExpandableList } from "@/app/components/expandable-list";
import type { GovernanceEvent } from "@/lib/governance/events";

export function EventTimeline({
  events,
  empty = "No recorded changes yet.",
}: {
  events: GovernanceEvent[];
  empty?: string;
}) {
  if (events.length === 0) {
    return <p className={`text-sm ${mutedTextClassName}`}>{empty}</p>;
  }

  return (
    <div className="space-y-3">
      <ExpandableList
        items={events}
        limit={8}
        renderItem={(event) => (
          <div key={event.id} className="border-l-2 border-teal-600 pl-3">
            <p className="text-sm font-medium text-slate-950 dark:text-slate-50">
              {event.field.replaceAll("_", " ")}: {event.previous_value || "—"} →{" "}
              {event.next_value || "—"}
            </p>
            <p className={`text-xs ${mutedTextClassName}`}>
              {formatIsoDate(event.created_at)}
              {event.actor_email ? ` · ${event.actor_email}` : ""}
            </p>
          </div>
        )}
      />
    </div>
  );
}
