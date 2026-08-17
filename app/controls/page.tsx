"use client";

import Link from "next/link";
import { Suspense, useCallback, useMemo, useState } from "react";
import { ClickableRow } from "@/app/components/clickable-row";
import { ColumnHeader } from "@/app/components/column-header";
import { QualityTitle } from "@/app/components/quality-indicator";
import {
  ControlTypeBadge,
  EffectivenessBadge,
  KeyBadge,
  TestingStatusBadge,
} from "@/app/components/status-badge";
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
import { primaryButtonClassName, secondaryButtonClassName } from "@/app/components/ui";
import { ControlSummary } from "@/app/controls/_components/control-summary";
import { controlQuality } from "@/lib/data-quality/record";
import { applySort } from "@/lib/list-sort";
import { useListFilters } from "@/lib/hooks/use-list-filters";
import { useRequireAuth } from "@/lib/hooks/use-require-auth";
import {
  filterControls,
  hasActiveFilters,
  parseControlFilters,
  sortControlsByAttention,
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
  CONTROL_TYPE_OPTIONS,
  EFFECTIVENESS_OPTIONS,
  formatControlType,
  formatEffectiveness,
  formatLastTestedAt,
  formatNextTestDue,
  getTestingStatus,
  isTestingDue,
  type Control,
} from "@/lib/types/control";
import {
  groupIssuesByControl,
  ISSUE_CONTROL_ISSUE_SELECT,
  type IssueControlIssueRow,
} from "@/lib/types/issue-links";
import {
  departmentFilterOptions,
  formatPersonDepartment,
  formatPersonName,
  personByEmail,
} from "@/lib/types/person";
import { countGroupedLinks } from "@/lib/types/join-utils";
import {
  groupRiskControlRowsByControl,
  RISK_CONTROL_RISK_SELECT,
  RISK_CONTROL_RISK_SELECT_WITH_CATEGORY,
  type RiskControlRiskRow,
} from "@/lib/types/risk-control";

function ControlsPageContent() {
  const { filters, updateRegisterFilters, clearFilters, sort, searchParams } =
    useListFilters("/controls", parseControlFilters);

  const { categories, schemaReady, people, enterpriseReady } = useSettings();
  const [controls, setControls] = useState<Control[]>([]);
  const [linkedRiskCounts, setLinkedRiskCounts] = useState<
    Record<string, number>
  >({});
  const [linkedCategoryIds, setLinkedCategoryIds] = useState<
    Record<string, string[]>
  >({});
  const [openIssueCounts, setOpenIssueCounts] = useState<
    Record<string, number>
  >({});
  const [tests, setTests] = useState<
    Array<{ tested_at: string; effectiveness: string }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadControls = useCallback(async (ownerId: string) => {
    setError(null);

    try {
      const supabase = getSupabaseClient();
      const [controlsResult, linksResult, issueLinksResult, testsResult] =
        await Promise.all([
        supabase
          .from("controls")
          .select("*")
          .eq("owner_id", ownerId)
          .order("created_at", { ascending: false }),
        supabase
          .from("risk_controls")
          .select(
            schemaReady
              ? RISK_CONTROL_RISK_SELECT_WITH_CATEGORY
              : RISK_CONTROL_RISK_SELECT,
          )
          .eq("owner_id", ownerId),
        supabase
          .from("issue_controls")
          .select(ISSUE_CONTROL_ISSUE_SELECT)
          .eq("owner_id", ownerId),
        supabase
          .from("control_test_results")
          .select("tested_at, effectiveness")
          .eq("owner_id", ownerId),
      ]);

      throwIfAnyQueryError([
        controlsResult,
        linksResult,
        issueLinksResult,
        testsResult,
      ]);

      setControls((controlsResult.data ?? []) as Control[]);

      const grouped = groupRiskControlRowsByControl(
        (linksResult.data ?? []) as RiskControlRiskRow[],
      );
      setLinkedRiskCounts(countGroupedLinks(grouped));
      setLinkedCategoryIds(indexLinkedCategoriesFromRisks(grouped));

      const issuesByControl = groupIssuesByControl(
        (issueLinksResult.data ?? []) as IssueControlIssueRow[],
      );
      const openCounts: Record<string, number> = {};
      for (const [controlId, issues] of Object.entries(issuesByControl)) {
        openCounts[controlId] = issues.filter(
          (issue) => issue.status !== "closed",
        ).length;
      }
      setOpenIssueCounts(openCounts);
      setTests(
        (testsResult.data ?? []) as Array<{
          tested_at: string;
          effectiveness: string;
        }>,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load controls");
    } finally {
      setLoading(false);
    }
  }, [schemaReady]);

  const { user, authLoading } = useRequireAuth(loadControls);
  const myPersonId = personByEmail(people, user?.email)?.id ?? null;

  const filteredControls = useMemo(() => {
    const rows = sortControlsByAttention(
      filterControls(controls, filters, {
        linkedRiskCounts,
        linkedCategoryIds,
        myPersonId,
        people,
      }),
    );
    return applySort(rows, sort, {
      title: (control) => control.title,
      key: (control) => Number(control.is_key),
      type: (control) => control.control_type ?? "preventive",
      category: (control) =>
        uniqueCategoryLabels(categories, linkedCategoryIds[control.id] ?? []),
      assignee: (control) => formatPersonName(people, control.assignee_id),
      effectiveness: (control) => control.effectiveness,
      lastTested: (control) => control.last_tested_at ?? "",
      testingStatus: (control) =>
        getTestingStatus(control.last_tested_at, control.is_key),
      nextTest: (control) =>
        formatNextTestDue(control.last_tested_at, control.is_key),
      risks: (control) => linkedRiskCounts[control.id] ?? 0,
      issues: (control) => openIssueCounts[control.id] ?? 0,
    });
  }, [
    controls,
    filters,
    linkedRiskCounts,
    linkedCategoryIds,
    myPersonId,
    people,
    sort,
    categories,
    openIssueCounts,
  ]);

  const filtersActive = hasActiveFilters({
    q: filters.q,
    effectiveness: filters.effectiveness,
    testingStatus: filters.testingStatus,
    isKey: filters.isKey,
    unmapped: filters.unmapped,
    categoryId: filters.categoryId,
    controlType: filters.controlType,
    assignee: filters.assignee,
    department: filters.department,
  });
  const view = parseRegisterView(searchParams, filtersActive);
  const departmentOptions = departmentFilterOptions(people);

  if (authLoading) {
    return <PageLoading />;
  }

  return (
    <RegisterPageShell
      title="Control Register"
      description="Manage and track your assigned controls."
      path="/controls"
      hasListFilters={filtersActive}
      actions={
        <Link href="/controls/new" className={primaryButtonClassName}>
          Add Control
        </Link>
      }
    >
        <ErrorBanner message={error} />

        {view === "settings" ? (
          <RegisterSettingsPanel module="controls" sections={["testing"]} />
        ) : null}

        {view === "summary" ? (
          loading ? (
            <LoadingBlock label="Loading controls..." />
          ) : controls.length === 0 ? (
            <ListEmpty>
              No controls yet.{" "}
              <Link
                href="/controls/new"
                className="font-medium text-teal-700 underline underline-offset-2 dark:text-teal-300"
              >
                Add your first control
              </Link>
              .
            </ListEmpty>
          ) : (
            <ControlSummary
              controls={controls}
              linkedRiskCounts={linkedRiskCounts}
              tests={tests}
            />
          )
        ) : null}

        {view === "register" ? (
        <section className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <ListToolbar
            search={filters.q}
            onSearchChange={(value) => updateRegisterFilters({ q: value })}
            searchPlaceholder="Search title or description..."
            showing={filteredControls.length}
            total={controls.length}
            hasFilters={filtersActive}
            onClear={clearFilters}
            actions={
              <>
                <RegisterPresets module="controls" />
                {filteredControls.length > 0 ? (
                <button
                  type="button"
                  className={secondaryButtonClassName}
                  onClick={() =>
                    downloadCsv(
                      "control-register",
                      [
                        "Title",
                        "Key",
                        "Type",
                        "Category",
                        "Assignee",
                        "Department",
                        "Effectiveness",
                        "Last Tested",
                        "Testing Status",
                        "Next Test",
                        "Linked Risks",
                        "Open Issues",
                      ],
                      filteredControls.map((control) => [
                        control.title,
                        control.is_key ? "Key" : "Non-Key",
                        formatControlType(control.control_type),
                        uniqueCategoryLabels(
                          categories,
                          linkedCategoryIds[control.id] ?? [],
                        ),
                        formatPersonName(people, control.assignee_id),
                        formatPersonDepartment(people, control.assignee_id),
                        formatEffectiveness(control.effectiveness),
                        formatLastTestedAt(control.last_tested_at),
                        getTestingStatus(control.last_tested_at, control.is_key),
                        formatNextTestDue(control.last_tested_at, control.is_key),
                        linkedRiskCounts[control.id] ?? 0,
                        openIssueCounts[control.id] ?? 0,
                      ]),
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
            <LoadingBlock label="Loading controls..." />
          ) : controls.length === 0 ? (
            <ListEmpty>
              No controls yet.{" "}
              <Link
                href="/controls/new"
                className="font-medium text-teal-700 underline underline-offset-2 dark:text-teal-300"
              >
                Add your first control
              </Link>
              .
            </ListEmpty>
          ) : filteredControls.length === 0 ? (
            <ListEmpty>No controls match the current filters.</ListEmpty>
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
                    <th className="px-6 py-3">
                      <ColumnHeader
                        label="Key"
                        sortKey="key"
                        currentSort={sort}
                        onSort={(value) => updateRegisterFilters({ sort: value })}
                        filterValue={filters.isKey}
                        filterOptions={[
                          { value: "true", label: "Key" },
                          { value: "false", label: "Non-Key" },
                        ]}
                        onFilterChange={(value) =>
                          updateRegisterFilters({ isKey: value })
                        }
                      />
                    </th>
                    {enterpriseReady && (
                      <th className="px-6 py-3">
                        <ColumnHeader
                          label="Type"
                          sortKey="type"
                          currentSort={sort}
                          onSort={(value) => updateRegisterFilters({ sort: value })}
                          filterValue={filters.controlType}
                          filterOptions={CONTROL_TYPE_OPTIONS.map((option) => ({
                            value: option.value,
                            label: option.label,
                          }))}
                          onFilterChange={(value) =>
                            updateRegisterFilters({ controlType: value })
                          }
                        />
                      </th>
                    )}
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
                        label="Effectiveness"
                        sortKey="effectiveness"
                        currentSort={sort}
                        onSort={(value) => updateRegisterFilters({ sort: value })}
                        filterValue={filters.effectiveness}
                        filterOptions={EFFECTIVENESS_OPTIONS.map((option) => ({
                          value: option.value,
                          label: option.label,
                        }))}
                        onFilterChange={(value) =>
                          updateRegisterFilters({ effectiveness: value })
                        }
                      />
                    </th>
                    <th className="px-6 py-3">
                      <ColumnHeader
                        label="Last Tested"
                        sortKey="lastTested"
                        currentSort={sort}
                        onSort={(value) => updateRegisterFilters({ sort: value })}
                      />
                    </th>
                    <th className="px-6 py-3">
                      <ColumnHeader
                        label="Testing Status"
                        sortKey="testingStatus"
                        currentSort={sort}
                        onSort={(value) => updateRegisterFilters({ sort: value })}
                        filterValue={filters.testingStatus}
                        filterOptions={[
                          { value: "Never Tested", label: "Never Tested" },
                          { value: "Tested", label: "Tested" },
                          { value: "Overdue", label: "Overdue" },
                        ]}
                        onFilterChange={(value) =>
                          updateRegisterFilters({ testingStatus: value })
                        }
                      />
                    </th>
                    <th className="px-6 py-3">
                      <ColumnHeader
                        label="Next Test"
                        sortKey="nextTest"
                        currentSort={sort}
                        onSort={(value) => updateRegisterFilters({ sort: value })}
                      />
                    </th>
                    <th className="px-6 py-3">
                      <ColumnHeader
                        label="Linked Risks"
                        sortKey="risks"
                        currentSort={sort}
                        onSort={(value) => updateRegisterFilters({ sort: value })}
                        filterValue={filters.unmapped ? "true" : ""}
                        filterOptions={[{ value: "true", label: "Unmapped only" }]}
                        onFilterChange={(value) =>
                          updateRegisterFilters({ unmapped: value })
                        }
                      />
                    </th>
                    <th className="px-6 py-3">
                      <ColumnHeader
                        label="Open Issues"
                        sortKey="issues"
                        currentSort={sort}
                        onSort={(value) => updateRegisterFilters({ sort: value })}
                      />
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {filteredControls.map((control) => {
                    const testingStatus = getTestingStatus(
                      control.last_tested_at,
                      control.is_key,
                    );
                    const riskCount = linkedRiskCounts[control.id] ?? 0;
                    const testingDue = isTestingDue(
                      control.last_tested_at,
                      control.is_key,
                    );
                    const needsAttention =
                      (control.is_key &&
                        control.effectiveness === "ineffective") ||
                      testingStatus === "Overdue" ||
                      riskCount === 0;

                    return (
                    <ClickableRow
                      key={control.id}
                      href={`/controls/${control.id}/edit`}
                      label={`Open ${control.title}`}
                      className={
                        needsAttention
                          ? "bg-amber-50/50 dark:bg-amber-950/20"
                          : undefined
                      }
                    >
                      <td className="px-6 py-4 font-medium text-slate-950 dark:text-slate-50">
                        <QualityTitle
                          summary={controlQuality(control, {
                            mappedToRisk: riskCount > 0,
                            enterpriseReady,
                          })}
                        >
                          {control.title}
                        </QualityTitle>
                      </td>
                      <td className="px-6 py-4">
                        <KeyBadge isKey={control.is_key} />
                      </td>
                      {enterpriseReady && (
                        <td className="px-6 py-4">
                          <ControlTypeBadge
                            label={formatControlType(control.control_type)}
                          />
                        </td>
                      )}
                      {schemaReady && (
                        <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                          {uniqueCategoryLabels(
                            categories,
                            linkedCategoryIds[control.id] ?? [],
                          )}
                        </td>
                      )}
                      {enterpriseReady && (
                        <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                          {formatPersonName(people, control.assignee_id)}
                        </td>
                      )}
                      <td className="px-6 py-4">
                        <EffectivenessBadge
                          effectiveness={control.effectiveness}
                          label={formatEffectiveness(control.effectiveness)}
                        />
                      </td>
                      <td className="px-6 py-4 text-slate-950 dark:text-slate-50">
                        {formatLastTestedAt(control.last_tested_at)}
                      </td>
                      <td className="px-6 py-4">
                        <TestingStatusBadge status={testingStatus} />
                      </td>
                      <td
                        className={`px-6 py-4 ${
                          testingDue
                            ? "font-medium text-red-700 dark:text-red-400"
                            : "text-slate-600 dark:text-slate-400"
                        }`}
                      >
                        {formatNextTestDue(
                          control.last_tested_at,
                          control.is_key,
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-950 dark:text-slate-50">
                        <span
                          className={
                            riskCount === 0
                              ? "font-medium text-red-700 dark:text-red-400"
                              : undefined
                          }
                        >
                          {riskCount}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={
                            (openIssueCounts[control.id] ?? 0) > 0
                              ? "font-medium text-red-700 dark:text-red-400"
                              : "text-slate-950 dark:text-slate-50"
                          }
                        >
                          {openIssueCounts[control.id] ?? 0}
                        </span>
                      </td>
                    </ClickableRow>
                    );
                  })}
                </tbody>
            </RegisterTable>
          )}
        </section>
        ) : null}
    </RegisterPageShell>
  );
}

export default function ControlsPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <ControlsPageContent />
    </Suspense>
  );
}
