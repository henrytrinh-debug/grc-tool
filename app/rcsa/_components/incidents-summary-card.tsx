"use client";

import {
  formatDateOccurred,
  formatIncidentStatus,
  formatSeverity,
} from "@/lib/types/incident";
import type { LinkedIncident } from "@/lib/types/incident-risk";
import {
  buildIncidentsSummary,
  formatMostRecentIncidentDate,
  formatSeverityBreakdown,
  formatStatusBreakdown,
} from "@/lib/rcsa/summaries";

type IncidentsSummaryCardProps = {
  links: LinkedIncident[];
  expanded: boolean;
  onToggleExpanded: () => void;
};

export function IncidentsSummaryCard({
  links,
  expanded,
  onToggleExpanded,
}: IncidentsSummaryCardProps) {
  const summary = buildIncidentsSummary(links);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-medium text-slate-950 dark:text-slate-50">
            Incidents Summary
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Linked incidents for this risk.
          </p>
        </div>
        <button
          type="button"
          onClick={onToggleExpanded}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          {expanded ? "Hide list" : "Show linked incidents"}
        </button>
      </div>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Total linked
          </dt>
          <dd className="mt-1 text-sm font-medium text-slate-950 dark:text-slate-50">
            {summary.total}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Most recent incident
          </dt>
          <dd className="mt-1 text-sm font-medium text-slate-950 dark:text-slate-50">
            {formatMostRecentIncidentDate(summary.mostRecentDate)}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Severity
          </dt>
          <dd className="mt-1 text-sm font-medium text-slate-950 dark:text-slate-50">
            {summary.total === 0
              ? "No linked incidents"
              : formatSeverityBreakdown(summary.severity)}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Status
          </dt>
          <dd className="mt-1 text-sm font-medium text-slate-950 dark:text-slate-50">
            {summary.total === 0
              ? "No linked incidents"
              : formatStatusBreakdown(summary.status)}
          </dd>
        </div>
      </dl>

      {expanded && (
        <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
          {links.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
              No incidents linked to this risk.
            </p>
          ) : (
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 dark:bg-slate-950 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-2 font-medium">Title</th>
                  <th className="px-4 py-2 font-medium">Date Occurred</th>
                  <th className="px-4 py-2 font-medium">Severity</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {links.map((link) => (
                  <tr key={link.linkId}>
                    <td className="px-4 py-3 font-medium text-slate-950 dark:text-slate-50">
                      {link.title}
                    </td>
                    <td className="px-4 py-3 text-slate-950 dark:text-slate-50">
                      {formatDateOccurred(link.date_occurred)}
                    </td>
                    <td className="px-4 py-3 text-slate-950 dark:text-slate-50">
                      {formatSeverity(link.severity)}
                    </td>
                    <td className="px-4 py-3 text-slate-950 dark:text-slate-50">
                      {formatIncidentStatus(link.status)}
                    </td>
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
