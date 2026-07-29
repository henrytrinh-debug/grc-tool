"use client";

import Link from "next/link";
import { Suspense, useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FilterSelect, ListToolbar } from "@/app/components/list-toolbar";
import { ErrorBanner, PageHeader, PageLoading } from "@/app/components/page-parts";
import {
  IssueSeverityBadge,
  IssueStatusBadge,
  OverdueBadge,
} from "@/app/components/status-badge";
import { primaryButtonClassName } from "@/app/components/ui";
import { useListFilters } from "@/lib/hooks/use-list-filters";
import { useRequireAuth } from "@/lib/hooks/use-require-auth";
import {
  filterIssues,
  hasActiveFilters,
  parseIssueFilters,
} from "@/lib/list-filters";
import { getSupabaseClient } from "@/lib/supabase/client";
import {
  formatDueDateLabel,
  formatIssueSeverity,
  formatIssueSource,
  formatIssueStatus,
  isIssueOverdue,
  ISSUE_SEVERITY_OPTIONS,
  ISSUE_SOURCE_OPTIONS,
  ISSUE_STATUS_OPTIONS,
  type Issue,
} from "@/lib/types/issue";
import {
  getActionProgress,
  type IssueAction,
} from "@/lib/types/issue-action";

const OPEN_STATUSES = "open,in_progress,pending_review";

function IssuesPageContent() {
  const router = useRouter();
  const { filters, updateFilters, clearFilters } = useListFilters(
    "/issues",
    parseIssueFilters,
  );

  const [issues, setIssues] = useState<Issue[]>([]);
  const [actionsByIssue, setActionsByIssue] = useState<
    Record<string, IssueAction[]>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadIssues = useCallback(async (ownerId: string) => {
    setError(null);

    try {
      const supabase = getSupabaseClient();
      const [issuesResult, actionsResult] = await Promise.all([
        supabase
          .from("issues")
          .select("*")
          .eq("owner_id", ownerId)
          .order("identified_at", { ascending: false }),
        supabase
          .from("issue_actions")
          .select("*")
          .eq("owner_id", ownerId),
      ]);

      if (issuesResult.error) {
        throw issuesResult.error;
      }

      if (actionsResult.error) {
        throw actionsResult.error;
      }

      setIssues((issuesResult.data ?? []) as Issue[]);

      const grouped: Record<string, IssueAction[]> = {};
      for (const action of (actionsResult.data ?? []) as IssueAction[]) {
        const bucket = grouped[action.issue_id] ?? [];
        bucket.push(action);
        grouped[action.issue_id] = bucket;
      }
      setActionsByIssue(grouped);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load issues");
    } finally {
      setLoading(false);
    }
  }, []);

  const { authLoading } = useRequireAuth(loadIssues);

  const filteredIssues = useMemo(
    () => filterIssues(issues, filters),
    [issues, filters],
  );

  const overdueCount = useMemo(
    () => issues.filter((issue) => isIssueOverdue(issue)).length,
    [issues],
  );

  const statusFilterValue =
    filters.status.length === 3 && !filters.status.includes("closed")
      ? OPEN_STATUSES
      : filters.status.length === 1
        ? filters.status[0]
        : "";

  const filtersActive = hasActiveFilters({
    q: filters.q,
    severity: filters.severity,
    status: filters.status,
    source: filters.source,
    overdue: filters.overdue,
  });

  if (authLoading) {
    return <PageLoading />;
  }

  return (
    <div className="min-h-full bg-slate-50 px-6 py-10 dark:bg-slate-950">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-8">
        <PageHeader
          title="Issue Management"
          description="Track findings through remediation to closure."
          actions={
            <Link href="/issues/new" className={primaryButtonClassName}>
              Add Issue
            </Link>
          }
        />

        <ErrorBanner message={error} />

        {overdueCount > 0 && !filters.overdue && (
          <button
            type="button"
            onClick={() => updateFilters({ overdue: "true" })}
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-left text-sm text-red-800 transition-colors hover:bg-red-100 dark:border-red-900 dark:bg-red-950 dark:text-red-300 dark:hover:bg-red-900/60"
          >
            <span className="font-medium">
              {overdueCount} issue{overdueCount === 1 ? " is" : "s are"} past the
              target remediation date.
            </span>{" "}
            Show only overdue issues.
          </button>
        )}

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <ListToolbar
            search={filters.q}
            onSearchChange={(value) => updateFilters({ q: value })}
            searchPlaceholder="Search title, description, root cause, or plan..."
            showing={filteredIssues.length}
            total={issues.length}
            hasFilters={filtersActive}
            onClear={clearFilters}
          >
            <FilterSelect
              label="Severity"
              value={filters.severity}
              onChange={(value) => updateFilters({ severity: value })}
              options={ISSUE_SEVERITY_OPTIONS.map((option) => ({
                value: option.value,
                label: option.label,
              }))}
            />
            <FilterSelect
              label="Status"
              value={statusFilterValue}
              onChange={(value) => updateFilters({ status: value })}
              options={[
                ...ISSUE_STATUS_OPTIONS.map((option) => ({
                  value: option.value,
                  label: option.label,
                })),
                { value: OPEN_STATUSES, label: "Not Closed" },
              ]}
            />
            <FilterSelect
              label="Source"
              value={filters.source}
              onChange={(value) => updateFilters({ source: value })}
              options={ISSUE_SOURCE_OPTIONS.map((option) => ({
                value: option.value,
                label: option.label,
              }))}
            />
            <FilterSelect
              label="Target Date"
              value={filters.overdue ? "true" : ""}
              onChange={(value) => updateFilters({ overdue: value })}
              options={[{ value: "true", label: "Overdue only" }]}
            />
          </ListToolbar>

          {loading ? (
            <p className="px-6 py-8 text-slate-600 dark:text-slate-400">
              Loading issues...
            </p>
          ) : issues.length === 0 ? (
            <p className="px-6 py-8 text-slate-600 dark:text-slate-400">
              No issues yet.{" "}
              <Link
                href="/issues/new"
                className="font-medium text-teal-700 underline underline-offset-2 dark:text-teal-300"
              >
                Raise your first issue
              </Link>
              .
            </p>
          ) : filteredIssues.length === 0 ? (
            <p className="px-6 py-8 text-slate-600 dark:text-slate-400">
              No issues match the current filters.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-600 dark:bg-slate-950 dark:text-slate-400">
                  <tr>
                    <th className="px-6 py-3 font-medium">Title</th>
                    <th className="px-6 py-3 font-medium">Source</th>
                    <th className="px-6 py-3 font-medium">Severity</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                    <th className="px-6 py-3 font-medium">Target Date</th>
                    <th className="px-6 py-3 font-medium">Action Plan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {filteredIssues.map((issue) => {
                    const progress = getActionProgress(
                      actionsByIssue[issue.id] ?? [],
                    );

                    return (
                      <tr
                        key={issue.id}
                        onClick={() => router.push(`/issues/${issue.id}/edit`)}
                        className="cursor-pointer transition-colors hover:bg-teal-50/60 dark:hover:bg-slate-800/80"
                      >
                        <td className="px-6 py-4 font-medium text-slate-950 dark:text-slate-50">
                          {issue.title}
                        </td>
                        <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                          {formatIssueSource(issue.source)}
                        </td>
                        <td className="px-6 py-4">
                          <IssueSeverityBadge
                            severity={issue.severity}
                            label={formatIssueSeverity(issue.severity)}
                          />
                        </td>
                        <td className="px-6 py-4">
                          <IssueStatusBadge
                            status={issue.status}
                            label={formatIssueStatus(issue.status)}
                          />
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className="text-slate-950 dark:text-slate-50">
                              {formatDueDateLabel(issue)}
                            </span>
                            {isIssueOverdue(issue) && <OverdueBadge />}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-slate-950 dark:text-slate-50">
                          {progress.total === 0
                            ? "No actions"
                            : `${progress.completed}/${progress.total} complete`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default function IssuesPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <IssuesPageContent />
    </Suspense>
  );
}
