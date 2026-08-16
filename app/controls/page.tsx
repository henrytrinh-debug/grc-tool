"use client";

import Link from "next/link";
import { Suspense, useCallback, useMemo, useState } from "react";
import { ClickableRow } from "@/app/components/clickable-row";
import {
  EffectivenessBadge,
  KeyBadge,
  TestingStatusBadge,
} from "@/app/components/status-badge";
import { FilterSelect, ListToolbar } from "@/app/components/list-toolbar";
import {
  ErrorBanner,
  ListEmpty,
  PageHeader,
  PageLoading,
} from "@/app/components/page-parts";
import { primaryButtonClassName, secondaryButtonClassName } from "@/app/components/ui";
import { useListFilters } from "@/lib/hooks/use-list-filters";
import { useRequireAuth } from "@/lib/hooks/use-require-auth";
import {
  filterControls,
  hasActiveFilters,
  parseControlFilters,
  sortControlsByAttention,
} from "@/lib/list-filters";
import { downloadCsv } from "@/lib/export/csv";
import { getSupabaseClient } from "@/lib/supabase/client";
import { throwIfAnyQueryError } from "@/lib/supabase/owned";
import {
  EFFECTIVENESS_OPTIONS,
  formatEffectiveness,
  formatLastTestedAt,
  getTestingStatus,
  type Control,
} from "@/lib/types/control";
import {
  groupIssuesByControl,
  ISSUE_CONTROL_ISSUE_SELECT,
  type IssueControlIssueRow,
} from "@/lib/types/issue-links";
import { countGroupedLinks } from "@/lib/types/join-utils";
import {
  groupRiskControlRowsByControl,
  type RiskControlRiskRow,
} from "@/lib/types/risk-control";

function ControlsPageContent() {
  const { filters, updateFilters, clearFilters } = useListFilters(
    "/controls",
    parseControlFilters,
  );

  const [controls, setControls] = useState<Control[]>([]);
  const [linkedRiskCounts, setLinkedRiskCounts] = useState<
    Record<string, number>
  >({});
  const [openIssueCounts, setOpenIssueCounts] = useState<
    Record<string, number>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadControls = useCallback(async (ownerId: string) => {
    setError(null);

    try {
      const supabase = getSupabaseClient();
      const [controlsResult, linksResult, issueLinksResult] = await Promise.all([
        supabase
          .from("controls")
          .select("*")
          .eq("owner_id", ownerId)
          .order("created_at", { ascending: false }),
        supabase
          .from("risk_controls")
          .select(
            "id, risk_id, control_id, risks(title, likelihood, impact, owner_email)",
          )
          .eq("owner_id", ownerId),
        supabase
          .from("issue_controls")
          .select(ISSUE_CONTROL_ISSUE_SELECT)
          .eq("owner_id", ownerId),
      ]);

      throwIfAnyQueryError([controlsResult, linksResult, issueLinksResult]);

      setControls((controlsResult.data ?? []) as Control[]);

      setLinkedRiskCounts(
        countGroupedLinks(
          groupRiskControlRowsByControl(
            (linksResult.data ?? []) as RiskControlRiskRow[],
          ),
        ),
      );

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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load controls");
    } finally {
      setLoading(false);
    }
  }, []);

  const { authLoading } = useRequireAuth(loadControls);

  const filteredControls = useMemo(
    () =>
      sortControlsByAttention(
        filterControls(controls, filters, { linkedRiskCounts }),
      ),
    [controls, filters, linkedRiskCounts],
  );

  const filtersActive = hasActiveFilters({
    q: filters.q,
    effectiveness: filters.effectiveness,
    testingStatus: filters.testingStatus,
    isKey: filters.isKey,
    unmapped: filters.unmapped,
  });

  if (authLoading) {
    return <PageLoading />;
  }

  return (
    <div className="min-h-full bg-slate-50 px-6 py-10 dark:bg-slate-950">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-8">
        <PageHeader
          title="Control Register"
          description="Manage and track your assigned controls."
          actions={
            <Link href="/controls/new" className={primaryButtonClassName}>
              Add Control
            </Link>
          }
        />

        <ErrorBanner message={error} />

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <ListToolbar
            search={filters.q}
            onSearchChange={(value) => updateFilters({ q: value })}
            searchPlaceholder="Search title or description..."
            showing={filteredControls.length}
            total={controls.length}
            hasFilters={filtersActive}
            onClear={clearFilters}
            actions={
              filteredControls.length > 0 ? (
                <button
                  type="button"
                  className={secondaryButtonClassName}
                  onClick={() =>
                    downloadCsv(
                      "control-register",
                      [
                        "Title",
                        "Key",
                        "Effectiveness",
                        "Last Tested",
                        "Testing Status",
                        "Linked Risks",
                        "Open Issues",
                      ],
                      filteredControls.map((control) => [
                        control.title,
                        control.is_key ? "Key" : "Non-Key",
                        formatEffectiveness(control.effectiveness),
                        formatLastTestedAt(control.last_tested_at),
                        getTestingStatus(control.last_tested_at, control.is_key),
                        linkedRiskCounts[control.id] ?? 0,
                        openIssueCounts[control.id] ?? 0,
                      ]),
                    )
                  }
                >
                  Export CSV
                </button>
              ) : null
            }
          >
            <FilterSelect
              label="Key"
              value={filters.isKey}
              onChange={(value) => updateFilters({ isKey: value })}
              options={[
                { value: "true", label: "Key" },
                { value: "false", label: "Non-Key" },
              ]}
            />
            <FilterSelect
              label="Effectiveness"
              value={filters.effectiveness}
              onChange={(value) => updateFilters({ effectiveness: value })}
              options={EFFECTIVENESS_OPTIONS.map((option) => ({
                value: option.value,
                label: option.label,
              }))}
            />
            <FilterSelect
              label="Testing Status"
              value={filters.testingStatus}
              onChange={(value) => updateFilters({ testingStatus: value })}
              options={[
                { value: "Never Tested", label: "Never Tested" },
                { value: "Tested", label: "Tested" },
                { value: "Overdue", label: "Overdue" },
              ]}
            />
            <FilterSelect
              label="Mapping"
              value={filters.unmapped ? "true" : ""}
              onChange={(value) => updateFilters({ unmapped: value })}
              options={[{ value: "true", label: "Unmapped only" }]}
            />
          </ListToolbar>

          {loading ? (
            <ListEmpty>Loading controls...</ListEmpty>
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
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-600 dark:bg-slate-950 dark:text-slate-400">
                  <tr>
                    <th className="px-6 py-3 font-medium">Title</th>
                    <th className="px-6 py-3 font-medium">Key</th>
                    <th className="px-6 py-3 font-medium">Effectiveness</th>
                    <th className="px-6 py-3 font-medium">Last Tested</th>
                    <th className="px-6 py-3 font-medium">Testing Status</th>
                    <th className="px-6 py-3 font-medium">Linked Risks</th>
                    <th className="px-6 py-3 font-medium">Open Issues</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {filteredControls.map((control) => {
                    const testingStatus = getTestingStatus(
                      control.last_tested_at,
                      control.is_key,
                    );
                    const riskCount = linkedRiskCounts[control.id] ?? 0;
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
                        {control.title}
                      </td>
                      <td className="px-6 py-4">
                        <KeyBadge isKey={control.is_key} />
                      </td>
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
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default function ControlsPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <ControlsPageContent />
    </Suspense>
  );
}
