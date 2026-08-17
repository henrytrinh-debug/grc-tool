"use client";

import Link from "next/link";
import { Suspense, useCallback, useMemo, useState } from "react";
import { ClickableRow } from "@/app/components/clickable-row";
import { ColumnHeader } from "@/app/components/column-header";
import { QualityTitle } from "@/app/components/quality-indicator";
import { ListToolbar } from "@/app/components/list-toolbar";
import { RegisterPresets } from "@/app/components/register-presets";
import { RegisterPageShell } from "@/app/components/register-page-shell";
import { RegisterSettingsPanel } from "@/app/components/register-settings-panel";
import {
  ErrorBanner,
  ListEmpty,
  LoadingBlock,
  PageLoading,
  RegisterTable,
  registerTheadClassName,
} from "@/app/components/page-parts";
import {
  IssueSeverityBadge,
  IssueStatusBadge,
  OverdueBadge,
} from "@/app/components/status-badge";
import { primaryButtonClassName, secondaryButtonClassName } from "@/app/components/ui";
import { IssueSummary } from "@/app/issues/_components/issue-summary";
import { issueQuality } from "@/lib/data-quality/record";
import { applySort } from "@/lib/list-sort";
import { useListFilters } from "@/lib/hooks/use-list-filters";
import { useRequireAuth } from "@/lib/hooks/use-require-auth";
import {
  filterIssues,
  hasActiveFilters,
  parseIssueFilters,
  sortIssuesByPriority,
} from "@/lib/list-filters";
import { parseRegisterView } from "@/lib/register/view";
import { downloadCsv } from "@/lib/export/csv";
import { useSettings } from "@/lib/settings/context";
import { getSupabaseClient } from "@/lib/supabase/client";
import { throwIfAnyQueryError } from "@/lib/supabase/owned";
import {
  assigneeFilterOptions,
  categoryFilterOptions,
  indexLinkedCategoriesFromRisks,
  uniqueCategoryLabels,
} from "@/lib/taxonomy";
import {
  departmentFilterOptions,
  formatPersonDepartment,
  formatPersonName,
  personByEmail,
} from "@/lib/types/person";
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
import {
  groupControlsByIssue,
  groupRisksByIssue,
  ISSUE_CONTROL_SELECT,
  ISSUE_RISK_SELECT,
  ISSUE_RISK_SELECT_WITH_CATEGORY,
  type IssueControlRow,
  type IssueRiskRow,
} from "@/lib/types/issue-links";
import { countGroupedLinks } from "@/lib/types/join-utils";

const OPEN_STATUSES = "open,in_progress,pending_review";

function IssuesPageContent() {
  const { filters, updateRegisterFilters, clearFilters, sort, searchParams } =
    useListFilters("/issues", parseIssueFilters);

  const { categories, schemaReady, people, enterpriseReady } = useSettings();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [actionsByIssue, setActionsByIssue] = useState<
    Record<string, IssueAction[]>
  >({});
  const [linkedRiskCounts, setLinkedRiskCounts] = useState<
    Record<string, number>
  >({});
  const [linkedControlCounts, setLinkedControlCounts] = useState<
    Record<string, number>
  >({});
  const [linkedCategoryIds, setLinkedCategoryIds] = useState<
    Record<string, string[]>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadIssues = useCallback(async (ownerId: string) => {
    setError(null);

    try {
      const supabase = getSupabaseClient();
      const [issuesResult, actionsResult, riskLinksResult, controlLinksResult] =
        await Promise.all([
        supabase
          .from("issues")
          .select("*")
          .eq("owner_id", ownerId)
          .order("identified_at", { ascending: false }),
        supabase
          .from("issue_actions")
          .select("*")
          .eq("owner_id", ownerId),
        supabase
          .from("issue_risks")
          .select(
            schemaReady ? ISSUE_RISK_SELECT_WITH_CATEGORY : ISSUE_RISK_SELECT,
          )
          .eq("owner_id", ownerId),
        supabase
          .from("issue_controls")
          .select(ISSUE_CONTROL_SELECT)
          .eq("owner_id", ownerId),
      ]);

      throwIfAnyQueryError([
        issuesResult,
        actionsResult,
        riskLinksResult,
        controlLinksResult,
      ]);

      setIssues((issuesResult.data ?? []) as Issue[]);

      const grouped: Record<string, IssueAction[]> = {};
      for (const action of (actionsResult.data ?? []) as IssueAction[]) {
        const bucket = grouped[action.issue_id] ?? [];
        bucket.push(action);
        grouped[action.issue_id] = bucket;
      }
      setActionsByIssue(grouped);
      const risksByIssue = groupRisksByIssue(
        (riskLinksResult.data ?? []) as IssueRiskRow[],
      );
      setLinkedRiskCounts(countGroupedLinks(risksByIssue));
      setLinkedCategoryIds(indexLinkedCategoriesFromRisks(risksByIssue));
      setLinkedControlCounts(
        countGroupedLinks(
          groupControlsByIssue(
            (controlLinksResult.data ?? []) as IssueControlRow[],
          ),
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load issues");
    } finally {
      setLoading(false);
    }
  }, [schemaReady]);

  const { user, authLoading } = useRequireAuth(loadIssues);
  const myPersonId = personByEmail(people, user?.email)?.id ?? null;

  const filteredIssues = useMemo(() => {
    const rows = sortIssuesByPriority(
      filterIssues(issues, filters, {
        linkedCategoryIds,
        myPersonId,
        people,
      }),
    );
    return applySort(rows, sort, {
      title: (issue) => issue.title,
      category: (issue) =>
        uniqueCategoryLabels(categories, linkedCategoryIds[issue.id] ?? []),
      assignee: (issue) => formatPersonName(people, issue.assignee_id),
      source: (issue) => issue.source,
      severity: (issue) => issue.severity,
      status: (issue) => issue.status,
      due: (issue) => issue.due_date ?? "",
      actions: (issue) => getActionProgress(actionsByIssue[issue.id] ?? []).total,
      linked:
        (issue) =>
          (linkedRiskCounts[issue.id] ?? 0) + (linkedControlCounts[issue.id] ?? 0),
    });
  }, [
    issues,
    filters,
    linkedCategoryIds,
    myPersonId,
    people,
    sort,
    categories,
    actionsByIssue,
    linkedRiskCounts,
    linkedControlCounts,
  ]);

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
    categoryId: filters.categoryId,
    assignee: filters.assignee,
    department: filters.department,
  });
  const view = parseRegisterView(searchParams, filtersActive);
  const departmentOptions = departmentFilterOptions(people);
  const allActions = useMemo(
    () => Object.values(actionsByIssue).flat(),
    [actionsByIssue],
  );

  if (authLoading) {
    return <PageLoading />;
  }

  return (
    <RegisterPageShell
      title="Issue Management"
      description="Track findings through remediation to closure."
      path="/issues"
      hasListFilters={filtersActive}
      actions={
        <Link href="/issues/new" className={primaryButtonClassName}>
          Add Issue
        </Link>
      }
    >
        <ErrorBanner message={error} />

        {view === "settings" ? (
          <RegisterSettingsPanel module="issues" sections={["issueDue"]} />
        ) : null}

        {view === "summary" ? (
          loading ? (
            <LoadingBlock label="Loading issues..." />
          ) : issues.length === 0 ? (
            <ListEmpty>
              No issues yet.{" "}
              <Link
                href="/issues/new"
                className="font-medium text-teal-700 underline underline-offset-2 dark:text-teal-300"
              >
                Raise your first issue
              </Link>
              .
            </ListEmpty>
          ) : (
            <IssueSummary issues={issues} actions={allActions} />
          )
        ) : null}

        {view === "register" ? (
        <>
        {overdueCount > 0 && !filters.overdue && (
          <button
            type="button"
            onClick={() => updateRegisterFilters({ overdue: "true" })}
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-left text-sm text-red-800 transition-colors hover:bg-red-100 dark:border-red-900 dark:bg-red-950 dark:text-red-300 dark:hover:bg-red-900/60"
          >
            <span className="font-medium">
              {overdueCount} issue{overdueCount === 1 ? " is" : "s are"} past the
              target remediation date.
            </span>{" "}
            Show only overdue issues.
          </button>
        )}

        <section className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <ListToolbar
            search={filters.q}
            onSearchChange={(value) => updateRegisterFilters({ q: value })}
            searchPlaceholder="Search title, description, root cause, or plan..."
            showing={filteredIssues.length}
            total={issues.length}
            hasFilters={filtersActive}
            onClear={clearFilters}
            actions={
              <>
                <RegisterPresets module="issues" />
                {filteredIssues.length > 0 ? (
                <button
                  type="button"
                  className={secondaryButtonClassName}
                  onClick={() =>
                    downloadCsv(
                      "issue-log",
                      [
                        "Title",
                        "Source",
                        "Severity",
                        "Status",
                        "Category",
                        "Assignee",
                        "Department",
                        "Target Date",
                        "Action Plan",
                        "Linked Risks",
                        "Linked Controls",
                      ],
                      filteredIssues.map((issue) => {
                        const progress = getActionProgress(
                          actionsByIssue[issue.id] ?? [],
                        );
                        return [
                          issue.title,
                          formatIssueSource(issue.source),
                          formatIssueSeverity(issue.severity),
                          formatIssueStatus(issue.status),
                          uniqueCategoryLabels(
                            categories,
                            linkedCategoryIds[issue.id] ?? [],
                          ),
                          formatPersonName(people, issue.assignee_id),
                          formatPersonDepartment(people, issue.assignee_id),
                          formatDueDateLabel(issue),
                          progress.total === 0
                            ? "No actions"
                            : `${progress.completed}/${progress.total}`,
                          linkedRiskCounts[issue.id] ?? 0,
                          linkedControlCounts[issue.id] ?? 0,
                        ];
                      }),
                    )
                  }
                >
                  Export CSV
                </button>
                ) : null}
              </>
            }
          />

          {loading ? (
            <LoadingBlock label="Loading issues..." />
          ) : issues.length === 0 ? (
            <ListEmpty>
              No issues yet.{" "}
              <Link
                href="/issues/new"
                className="font-medium text-teal-700 underline underline-offset-2 dark:text-teal-300"
              >
                Raise your first issue
              </Link>
              .
            </ListEmpty>
          ) : filteredIssues.length === 0 ? (
            <ListEmpty>No issues match the current filters.</ListEmpty>
          ) : (
            <RegisterTable>
                <thead className={registerTheadClassName}>
                  <tr>
                    <th className="px-6 py-3">
                      <ColumnHeader
                        label="Title"
                        sortKey="title"
                        currentSort={sort}
                        onSort={(value) => updateRegisterFilters({ sort: value })}
                      />
                    </th>
                    {schemaReady && (
                      <th className="px-6 py-3">
                        <ColumnHeader
                          label="Category"
                          sortKey="category"
                          currentSort={sort}
                          onSort={(value) => updateRegisterFilters({ sort: value })}
                          filterValue={filters.categoryId}
                          filterOptions={categoryFilterOptions(categories)}
                          onFilterChange={(value) =>
                            updateRegisterFilters({ category: value })
                          }
                        />
                      </th>
                    )}
                    {enterpriseReady && (
                      <th className="px-6 py-3">
                        <ColumnHeader
                          label="Assignee"
                          sortKey="assignee"
                          currentSort={sort}
                          onSort={(value) => updateRegisterFilters({ sort: value })}
                          filterValue={filters.assignee}
                          filterOptions={assigneeFilterOptions(people)}
                          onFilterChange={(value) =>
                            updateRegisterFilters({ assignee: value })
                          }
                          extraFilter={
                            departmentOptions.length > 0
                              ? {
                                  label: "Department",
                                  value: filters.department,
                                  options: departmentOptions,
                                  onChange: (value) =>
                                    updateRegisterFilters({ department: value }),
                                }
                              : undefined
                          }
                        />
                      </th>
                    )}
                    <th className="px-6 py-3">
                      <ColumnHeader
                        label="Source"
                        sortKey="source"
                        currentSort={sort}
                        onSort={(value) => updateRegisterFilters({ sort: value })}
                        filterValue={filters.source}
                        filterOptions={ISSUE_SOURCE_OPTIONS.map((option) => ({
                          value: option.value,
                          label: option.label,
                        }))}
                        onFilterChange={(value) =>
                          updateRegisterFilters({ source: value })
                        }
                      />
                    </th>
                    <th className="px-6 py-3">
                      <ColumnHeader
                        label="Severity"
                        sortKey="severity"
                        currentSort={sort}
                        onSort={(value) => updateRegisterFilters({ sort: value })}
                        filterValue={filters.severity}
                        filterOptions={ISSUE_SEVERITY_OPTIONS.map((option) => ({
                          value: option.value,
                          label: option.label,
                        }))}
                        onFilterChange={(value) =>
                          updateRegisterFilters({ severity: value })
                        }
                      />
                    </th>
                    <th className="px-6 py-3">
                      <ColumnHeader
                        label="Status"
                        sortKey="status"
                        currentSort={sort}
                        onSort={(value) => updateRegisterFilters({ sort: value })}
                        filterValue={statusFilterValue}
                        filterOptions={[
                          ...ISSUE_STATUS_OPTIONS.map((option) => ({
                            value: option.value,
                            label: option.label,
                          })),
                          { value: OPEN_STATUSES, label: "Not Closed" },
                        ]}
                        onFilterChange={(value) =>
                          updateRegisterFilters({ status: value })
                        }
                      />
                    </th>
                    <th className="px-6 py-3">
                      <ColumnHeader
                        label="Target Date"
                        sortKey="due"
                        currentSort={sort}
                        onSort={(value) => updateRegisterFilters({ sort: value })}
                        filterValue={filters.overdue ? "true" : ""}
                        filterOptions={[{ value: "true", label: "Overdue only" }]}
                        onFilterChange={(value) =>
                          updateRegisterFilters({ overdue: value })
                        }
                      />
                    </th>
                    <th className="px-6 py-3">
                      <ColumnHeader
                        label="Action Plan"
                        sortKey="actions"
                        currentSort={sort}
                        onSort={(value) => updateRegisterFilters({ sort: value })}
                      />
                    </th>
                    <th className="px-6 py-3">
                      <ColumnHeader
                        label="Linked"
                        sortKey="linked"
                        currentSort={sort}
                        onSort={(value) => updateRegisterFilters({ sort: value })}
                      />
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {filteredIssues.map((issue) => {
                    const progress = getActionProgress(
                      actionsByIssue[issue.id] ?? [],
                    );
                    const overdue = isIssueOverdue(issue);

                    return (
                      <ClickableRow
                        key={issue.id}
                        href={`/issues/${issue.id}/edit`}
                        label={`Open ${issue.title}`}
                        className={
                          overdue
                            ? "bg-amber-50/50 dark:bg-amber-950/20"
                            : undefined
                        }
                      >
                        <td className="px-6 py-4 font-medium text-slate-950 dark:text-slate-50">
                          <QualityTitle
                            summary={issueQuality(issue, {
                              linkedToRiskOrControl:
                                (linkedRiskCounts[issue.id] ?? 0) +
                                  (linkedControlCounts[issue.id] ?? 0) >
                                0,
                              enterpriseReady,
                            })}
                          >
                            {issue.title}
                          </QualityTitle>
                        </td>
                        {schemaReady && (
                          <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                            {uniqueCategoryLabels(
                              categories,
                              linkedCategoryIds[issue.id] ?? [],
                            )}
                          </td>
                        )}
                        {enterpriseReady && (
                          <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                            {formatPersonName(people, issue.assignee_id)}
                          </td>
                        )}
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
                        <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                          {(linkedRiskCounts[issue.id] ?? 0) +
                            (linkedControlCounts[issue.id] ?? 0) ===
                          0
                            ? "—"
                            : `${linkedRiskCounts[issue.id] ?? 0} risks · ${linkedControlCounts[issue.id] ?? 0} controls`}
                        </td>
                      </ClickableRow>
                    );
                  })}
                </tbody>
            </RegisterTable>
          )}
        </section>
        </>
        ) : null}
    </RegisterPageShell>
  );
}

export default function IssuesPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <IssuesPageContent />
    </Suspense>
  );
}
