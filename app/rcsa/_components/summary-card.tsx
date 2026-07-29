"use client";

import { useState, type ReactNode } from "react";
import { mutedTextClassName, secondaryButtonClassName } from "@/app/components/ui";

export type SummaryStat = {
  label: string;
  value: ReactNode;
  /** Span both columns; use for breakdowns that need the room. */
  wide?: boolean;
};

export type SummaryRow = {
  key: string;
  cells: ReactNode[];
};

type SummaryCardProps = {
  title: string;
  description: string;
  /** Plural entity name used in the toggle label, e.g. "linked controls". */
  toggleLabel: string;
  stats: SummaryStat[];
  columnHeaders: string[];
  rows: SummaryRow[];
  emptyMessage: string;
};

/**
 * Read-only roll-up of the records linked to the risk being assessed, with an
 * expandable detail table.
 */
export function SummaryCard({
  title,
  description,
  toggleLabel,
  stats,
  columnHeaders,
  rows,
  emptyMessage,
}: SummaryCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-medium text-slate-950 dark:text-slate-50">
            {title}
          </h2>
          <p className={`mt-1 text-sm ${mutedTextClassName}`}>{description}</p>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className={`${secondaryButtonClassName} shrink-0`}
        >
          {expanded ? "Hide list" : `Show ${toggleLabel}`}
        </button>
      </div>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        {stats.map((stat) => (
          <div key={stat.label} className={stat.wide ? "sm:col-span-2" : ""}>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {stat.label}
            </dt>
            <dd className="mt-1 text-sm font-medium text-slate-950 dark:text-slate-50">
              {stat.value}
            </dd>
          </div>
        ))}
      </dl>

      {expanded && (
        <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
          {rows.length === 0 ? (
            <p className={`px-4 py-3 text-sm ${mutedTextClassName}`}>
              {emptyMessage}
            </p>
          ) : (
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 dark:bg-slate-950 dark:text-slate-400">
                <tr>
                  {columnHeaders.map((header) => (
                    <th key={header} className="px-4 py-2 font-medium">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {rows.map((row) => (
                  <tr key={row.key}>
                    {row.cells.map((cell, index) => (
                      <td
                        key={columnHeaders[index] ?? index}
                        className="px-4 py-3 text-slate-950 first:font-medium dark:text-slate-50"
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </section>
  );
}
