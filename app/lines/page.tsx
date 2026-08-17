"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import {
  ErrorBanner,
  ListEmpty,
  LoadingBlock,
  PageHeader,
  PageLoading,
  RegisterTable,
  registerTheadClassName,
} from "@/app/components/page-parts";
import { mutedTextClassName } from "@/app/components/ui";
import { buildLodWorkload } from "@/lib/lines/workload";
import { useRequireAuth } from "@/lib/hooks/use-require-auth";
import { useSettings } from "@/lib/settings/context";
import { fetchOwnedTable } from "@/lib/supabase/owned";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { Control } from "@/lib/types/control";
import type { Incident } from "@/lib/types/incident";
import type { Issue } from "@/lib/types/issue";
import type { Risk } from "@/lib/types/risk";

function MetricLink({
  href,
  value,
  alert = false,
}: {
  href: string;
  value: string | number;
  alert?: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        alert
          ? "font-medium text-red-700 underline-offset-2 hover:underline dark:text-red-400"
          : "text-slate-950 underline-offset-2 hover:underline dark:text-slate-50"
      }
    >
      {value}
    </Link>
  );
}

export default function LinesPage() {
  const { people, enterpriseReady } = useSettings();
  const [risks, setRisks] = useState<Risk[]>([]);
  const [controls, setControls] = useState<Control[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (ownerId: string) => {
    setError(null);
    try {
      const supabase = getSupabaseClient();
      const [nextRisks, nextControls, nextIncidents, nextIssues] =
        await Promise.all([
          fetchOwnedTable<Risk>(supabase, "risks", ownerId),
          fetchOwnedTable<Control>(supabase, "controls", ownerId),
          fetchOwnedTable<Incident>(supabase, "incidents", ownerId),
          fetchOwnedTable<Issue>(supabase, "issues", ownerId),
        ]);
      setRisks(nextRisks);
      setControls(nextControls);
      setIncidents(nextIncidents);
      setIssues(nextIssues);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load line-of-defence work",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const { authLoading } = useRequireAuth(load);

  const groups = useMemo(
    () =>
      buildLodWorkload({
        people,
        risks,
        controls,
        incidents,
        issues,
      }),
    [controls, incidents, issues, people, risks],
  );

  if (authLoading) {
    return <PageLoading />;
  }

  return (
    <div className="min-h-full min-w-0 bg-slate-50 px-6 py-10 dark:bg-slate-950">
      <main className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-8">
        <PageHeader
          title="Lines of defence"
          description="Open risks, overdue tests, open incidents, and open issues rolled up by the person and line they are assigned to."
          breadcrumbs={[
            { href: "/", label: "Home" },
            { label: "Lines of defence" },
          ]}
        />

        <ErrorBanner message={error} />

        {!enterpriseReady ? (
          <p className={`text-sm ${mutedTextClassName}`}>
            Run{" "}
            <code className="font-mono">supabase/schema/004_enterprise.sql</code>{" "}
            and add people in Admin to see workload by line of defence.
          </p>
        ) : loading ? (
          <LoadingBlock label="Loading assigned work..." />
        ) : groups.length === 0 ? (
          <ListEmpty>
            Nothing is assigned yet. Set an accountable owner on a risk, control,
            incident, or issue.
          </ListEmpty>
        ) : (
          groups.map((group) => (
            <section
              key={group.line}
              className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex flex-col gap-1 border-b border-slate-200 px-6 py-4 sm:flex-row sm:items-baseline sm:justify-between dark:border-slate-800">
                <h2 className="text-lg font-medium text-slate-950 dark:text-slate-50">
                  {group.label}
                </h2>
                <p className={`text-sm ${mutedTextClassName}`}>
                  {group.totals.total} live items · {group.totals.risks} risks ·{" "}
                  {group.totals.controlsOverdue} overdue tests ·{" "}
                  {group.totals.incidents} incidents · {group.totals.issues}{" "}
                  issues
                  {group.totals.issuesOverdue > 0
                    ? ` (${group.totals.issuesOverdue} overdue)`
                    : ""}
                </p>
              </div>
              <RegisterTable>
                  <thead className={registerTheadClassName}>
                    <tr>
                      <th className="px-6 py-3 font-medium">Person</th>
                      <th className="px-6 py-3 font-medium">Department</th>
                      <th className="px-6 py-3 font-medium">Risks</th>
                      <th className="px-6 py-3 font-medium">Overdue tests</th>
                      <th className="px-6 py-3 font-medium">Incidents</th>
                      <th className="px-6 py-3 font-medium">Issues</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {group.people.map((row) => {
                      const name = row.person?.name ?? "Unassigned";
                      const assignee = encodeURIComponent(
                        row.person?.id ?? "unassigned",
                      );

                      return (
                        <tr key={row.person?.id ?? "unassigned"}>
                          <td className="px-6 py-4 font-medium text-slate-950 dark:text-slate-50">
                            <span>{name}</span>
                            {row.person?.title ? (
                              <span className={`mt-0.5 block text-xs ${mutedTextClassName}`}>
                                {row.person.title}
                              </span>
                            ) : null}
                          </td>
                          <td className={`px-6 py-4 ${mutedTextClassName}`}>
                            {row.person?.department || "—"}
                          </td>
                          <td className="px-6 py-4 text-slate-950 dark:text-slate-50">
                            <MetricLink
                              href={`/risks?assignee=${assignee}`}
                              value={row.risks}
                            />
                          </td>
                          <td className="px-6 py-4">
                            <MetricLink
                              href={`/controls?assignee=${assignee}&testingStatus=Overdue`}
                              value={row.controlsOverdue}
                              alert={row.controlsOverdue > 0}
                            />
                          </td>
                          <td className="px-6 py-4 text-slate-950 dark:text-slate-50">
                            <MetricLink
                              href={`/incidents?assignee=${assignee}&status=open,investigating`}
                              value={row.incidents}
                            />
                          </td>
                          <td className="px-6 py-4">
                            <MetricLink
                              href={`/issues?assignee=${assignee}&status=open,in_progress,pending_review`}
                              value={`${row.issues}${
                                row.issuesOverdue > 0
                                  ? ` (${row.issuesOverdue} overdue)`
                                  : ""
                              }`}
                              alert={row.issuesOverdue > 0}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
              </RegisterTable>
            </section>
          ))
        )}
      </main>
    </div>
  );
}
