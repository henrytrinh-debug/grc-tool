import Link from "next/link";
import { SeverityBandBadge } from "@/app/components/status-badge";
import type { TaxonomyOverviewRow } from "@/lib/oversight/metrics";

export function TaxonomyOverviewTable({ rows }: { rows: TaxonomyOverviewRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Add a taxonomy in Admin to view exposure by category.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="text-slate-600 dark:text-slate-400">
          <tr>
            <th className="px-3 py-2 font-medium">Category</th>
            <th className="px-3 py-2 font-medium">Appetite</th>
            <th className="px-3 py-2 font-medium">Risks</th>
            <th className="px-3 py-2 font-medium">H/C</th>
            <th className="px-3 py-2 font-medium">Uncontrolled</th>
            <th className="px-3 py-2 font-medium">Due</th>
            <th className="px-3 py-2 font-medium">Breaches</th>
            <th className="px-3 py-2 font-medium">Issues</th>
            <th className="px-3 py-2 font-medium">Incidents</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
          {rows.map((row) => (
            <tr key={row.categoryId}>
              <td className="px-3 py-2">
                <Link
                  href={`/risks?category=${encodeURIComponent(row.categoryId)}`}
                  className="font-medium text-teal-800 hover:underline dark:text-teal-200"
                >
                  {row.name}
                </Link>
              </td>
              <td className="px-3 py-2">
                <SeverityBandBadge band={row.appetite} />
              </td>
              <td className="px-3 py-2 text-slate-950 dark:text-slate-50">
                {row.risks}
              </td>
              <td className="px-3 py-2 text-slate-950 dark:text-slate-50">
                {row.highOrCritical}
              </td>
              <td
                className={`px-3 py-2 ${
                  row.uncontrolled > 0
                    ? "font-medium text-red-700 dark:text-red-400"
                    : "text-slate-950 dark:text-slate-50"
                }`}
              >
                {row.uncontrolled}
              </td>
              <td
                className={`px-3 py-2 ${
                  row.reviewsDue > 0
                    ? "font-medium text-red-700 dark:text-red-400"
                    : "text-slate-950 dark:text-slate-50"
                }`}
              >
                {row.reviewsDue}
              </td>
              <td
                className={`px-3 py-2 ${
                  row.appetiteBreaches > 0
                    ? "font-medium text-red-700 dark:text-red-400"
                    : "text-slate-950 dark:text-slate-50"
                }`}
              >
                <Link
                  href={`/risks?category=${encodeURIComponent(row.categoryId)}&appetiteBreach=true`}
                  className="hover:underline"
                >
                  {row.appetiteBreaches}
                </Link>
              </td>
              <td className="px-3 py-2 text-slate-950 dark:text-slate-50">
                <Link
                  href={`/issues?category=${encodeURIComponent(row.categoryId)}&status=open,in_progress,pending_review`}
                  className="hover:underline"
                >
                  {row.openIssues}
                </Link>
              </td>
              <td className="px-3 py-2 text-slate-950 dark:text-slate-50">
                <Link
                  href={`/incidents?category=${encodeURIComponent(row.categoryId)}&status=open,investigating`}
                  className="hover:underline"
                >
                  {row.openIncidents}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
