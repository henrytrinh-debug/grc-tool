"use client";

import {
  formatEffectiveness,
  getTestingStatus,
} from "@/lib/types/control";
import type { LinkedControl } from "@/lib/types/risk-control";
import {
  buildControlsSummary,
  formatEffectivenessBreakdown,
} from "@/lib/rcsa/summaries";

type ControlsSummaryCardProps = {
  links: LinkedControl[];
  expanded: boolean;
  onToggleExpanded: () => void;
};

export function ControlsSummaryCard({
  links,
  expanded,
  onToggleExpanded,
}: ControlsSummaryCardProps) {
  const summary = buildControlsSummary(links);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-medium text-slate-950 dark:text-slate-50">
            Controls Summary
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Linked controls for this risk.
          </p>
        </div>
        <button
          type="button"
          onClick={onToggleExpanded}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          {expanded ? "Hide list" : "Show linked controls"}
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
            Key vs Non-Key
          </dt>
          <dd className="mt-1 text-sm font-medium text-slate-950 dark:text-slate-50">
            Key: {summary.keyCount} · Non-Key: {summary.nonKeyCount}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Effectiveness
          </dt>
          <dd className="mt-1 text-sm font-medium text-slate-950 dark:text-slate-50">
            {summary.total === 0
              ? "No linked controls"
              : formatEffectivenessBreakdown(summary.effectiveness)}
          </dd>
        </div>
      </dl>

      {expanded && (
        <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
          {links.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
              No controls linked to this risk.
            </p>
          ) : (
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 dark:bg-slate-950 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-2 font-medium">Title</th>
                  <th className="px-4 py-2 font-medium">Key</th>
                  <th className="px-4 py-2 font-medium">Effectiveness</th>
                  <th className="px-4 py-2 font-medium">Testing Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {links.map((link) => (
                  <tr key={link.linkId}>
                    <td className="px-4 py-3 font-medium text-slate-950 dark:text-slate-50">
                      {link.title}
                    </td>
                    <td className="px-4 py-3 text-slate-950 dark:text-slate-50">
                      {link.is_key ? "Key" : "Non-Key"}
                    </td>
                    <td className="px-4 py-3 text-slate-950 dark:text-slate-50">
                      {formatEffectiveness(link.effectiveness)}
                    </td>
                    <td className="px-4 py-3 text-slate-950 dark:text-slate-50">
                      {getTestingStatus(link.last_tested_at)}
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
