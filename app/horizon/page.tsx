"use client";

import { Suspense, useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { ExpandableList } from "@/app/components/expandable-list";
import { ErrorBanner, PageHeader, PageLoading } from "@/app/components/page-parts";
import { FilterSelect, ListToolbar } from "@/app/components/list-toolbar";
import { StatCard } from "@/app/components/dashboard/stat-card";
import { mutedTextClassName } from "@/app/components/ui";
import { useListFilters } from "@/lib/hooks/use-list-filters";
import { useRequireAuth } from "@/lib/hooks/use-require-auth";
import { useSettings } from "@/lib/settings/context";
import { fetchOwnedTable, fetchOwnedTableOptional } from "@/lib/supabase/owned";
import { getSupabaseClient } from "@/lib/supabase/client";
import {
  buildObligations,
  countByBucket,
  formatDueLabel,
  formatObligationBucket,
  formatObligationKind,
  type Obligation,
  type ObligationBucket,
  type ObligationKind,
} from "@/lib/horizon/obligations";
import type { Control } from "@/lib/types/control";
import type { Issue } from "@/lib/types/issue";
import type { IssueAction } from "@/lib/types/issue-action";
import { buildLastReviewedByRisk, type RcsaReview } from "@/lib/types/rcsa";
import type { Risk } from "@/lib/types/risk";
import type { ObligationRecord } from "@/lib/types/obligation";

const BUCKETS: ObligationBucket[] = ["overdue", "week", "month", "quarter"];
const KINDS: ObligationKind[] = [
  "risk_review",
  "risk_target",
  "control_test",
  "issue_due",
  "action_due",
  "obligation_review",
];

const bucketTone: Record<ObligationBucket, string> = {
  overdue:
    "border-red-200 bg-red-50/60 dark:border-red-900 dark:bg-red-950/30",
  week: "border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/30",
  month: "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900",
  quarter: "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900",
};

function parseHorizonFilters(params: URLSearchParams) {
  const bucket = params.get("bucket")?.trim() ?? "";
  const kind = params.get("kind")?.trim() ?? "";
  return {
    q: params.get("q")?.trim() ?? "",
    bucket: BUCKETS.includes(bucket as ObligationBucket)
      ? (bucket as ObligationBucket)
      : "",
    kind: KINDS.includes(kind as ObligationKind) ? (kind as ObligationKind) : "",
  };
}

function HorizonPageContent() {
  const { people, obligationsReady } = useSettings();
  const { filters, updateFilters, clearFilters } = useListFilters(
    "/horizon",
    parseHorizonFilters,
  );
  const [risks, setRisks] = useState<Risk[]>([]);
  const [controls, setControls] = useState<Control[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [actions, setActions] = useState<IssueAction[]>([]);
  const [registerObligations, setRegisterObligations] = useState<
    ObligationRecord[]
  >([]);
  const [lastReviewedByRisk, setLastReviewedByRisk] = useState<
    Record<string, string>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (ownerId: string) => {
    setError(null);
    try {
      const supabase = getSupabaseClient();
      const [nextRisks, nextControls, nextIssues, nextActions, reviews, nextObligations] =
        await Promise.all([
          fetchOwnedTable<Risk>(supabase, "risks", ownerId),
          fetchOwnedTable<Control>(supabase, "controls", ownerId),
          fetchOwnedTable<Issue>(supabase, "issues", ownerId),
          fetchOwnedTable<IssueAction>(supabase, "issue_actions", ownerId),
          fetchOwnedTable<RcsaReview>(supabase, "rcsa_reviews", ownerId, {
            order: "reviewed_at",
          }),
          obligationsReady
            ? fetchOwnedTableOptional<ObligationRecord>(
                supabase,
                "obligations",
                ownerId,
              )
            : Promise.resolve([] as ObligationRecord[]),
        ]);
      setRisks(nextRisks);
      setControls(nextControls);
      setIssues(nextIssues);
      setActions(nextActions);
      setLastReviewedByRisk(buildLastReviewedByRisk(reviews));
      setRegisterObligations(nextObligations);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load the operating horizon",
      );
    } finally {
      setLoading(false);
    }
  }, [obligationsReady]);

  const { authLoading } = useRequireAuth(load);

  const items = useMemo(
    () =>
      buildObligations({
        risks,
        controls,
        issues,
        actions,
        lastReviewedByRisk,
        people,
        registerObligations,
      }),
    [actions, controls, issues, lastReviewedByRisk, people, registerObligations, risks],
  );

  const counts = useMemo(() => countByBucket(items), [items]);

  const filtered = useMemo(() => {
    const query = filters.q.toLowerCase();
    return items.filter((item) => {
      if (filters.bucket && item.bucket !== filters.bucket) {
        return false;
      }
      if (filters.kind && item.kind !== filters.kind) {
        return false;
      }
      if (query) {
        const haystack =
          `${item.title} ${item.detail} ${item.owner} ${formatObligationKind(item.kind)}`.toLowerCase();
        if (!haystack.includes(query)) {
          return false;
        }
      }
      return true;
    });
  }, [filters.bucket, filters.kind, filters.q, items]);

  const grouped = useMemo(() => {
    const groups: Record<ObligationBucket, Obligation[]> = {
      overdue: [],
      week: [],
      month: [],
      quarter: [],
    };
    for (const item of filtered) {
      groups[item.bucket].push(item);
    }
    return groups;
  }, [filtered]);

  const hasFilters = Boolean(filters.q || filters.bucket || filters.kind);

  if (authLoading) {
    return <PageLoading />;
  }

  return (
    <div className="min-h-full min-w-0 bg-slate-50 px-6 py-10 dark:bg-slate-950">
      <main className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-8">
        <PageHeader
          title="Operating horizon"
          description="Reviews, tests, findings, and actions due in the next 90 days — the calendar a control function actually runs."
          breadcrumbs={[
            { href: "/", label: "Home" },
            { label: "Horizon" },
          ]}
        />

        <ErrorBanner message={error} />

        {loading ? (
          <p className={mutedTextClassName}>Loading obligations...</p>
        ) : (
          <>
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Overdue / due now"
                value={counts.overdue}
                href="/horizon?bucket=overdue"
                linkLabel="Show overdue"
                tone={counts.overdue > 0 ? "alert" : "default"}
              />
              <StatCard
                label="Next 7 days"
                value={counts.week}
                href="/horizon?bucket=week"
                linkLabel="Show this week"
              />
              <StatCard
                label="8–30 days"
                value={counts.month}
                href="/horizon?bucket=month"
                linkLabel="Show this month"
              />
              <StatCard
                label="31–90 days"
                value={counts.quarter}
                href="/horizon?bucket=quarter"
                linkLabel="Show this quarter"
              />
            </section>

            <section className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <ListToolbar
                search={filters.q}
                onSearchChange={(value) => updateFilters({ q: value })}
                searchPlaceholder="Search title, owner, or detail..."
                showing={filtered.length}
                total={items.length}
                hasFilters={hasFilters}
                onClear={clearFilters}
              >
                <FilterSelect
                  label="Window"
                  value={filters.bucket}
                  onChange={(value) => updateFilters({ bucket: value })}
                  options={BUCKETS.map((bucket) => ({
                    value: bucket,
                    label: formatObligationBucket(bucket),
                  }))}
                />
                <FilterSelect
                  label="Type"
                  value={filters.kind}
                  onChange={(value) => updateFilters({ kind: value })}
                  options={KINDS.map((kind) => ({
                    value: kind,
                    label: formatObligationKind(kind),
                  }))}
                />
              </ListToolbar>

              {filtered.length === 0 ? (
                <p className={`px-6 py-8 text-sm ${mutedTextClassName}`}>
                  Nothing in this window. Cadence-driven reviews, control tests,
                  issue target dates, open actions, and obligation reviews appear
                  here.
                </p>
              ) : (
                <div className="space-y-8 px-6 py-6">
                  {BUCKETS.map((bucket) => {
                    const rows = grouped[bucket];
                    if (rows.length === 0) {
                      return null;
                    }

                    return (
                      <section key={bucket}>
                        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          {formatObligationBucket(bucket)}
                        </h2>
                        <div className="mt-3 space-y-2">
                          <ExpandableList
                            items={rows}
                            limit={6}
                            renderItem={(item) => (
                            <Link
                              key={item.id}
                              href={item.href}
                              className={`flex flex-col gap-1 rounded-lg border px-4 py-3 transition-colors hover:border-teal-300 dark:hover:border-teal-700 sm:flex-row sm:items-center sm:justify-between ${bucketTone[item.bucket]}`}
                            >
                                <span className="min-w-0">
                                  <span className="block text-sm font-medium text-slate-950 dark:text-slate-50">
                                    {item.title}
                                  </span>
                                  <span className={`block text-xs ${mutedTextClassName}`}>
                                    {formatObligationKind(item.kind)} · {item.detail} ·{" "}
                                    {item.owner}
                                  </span>
                                </span>
                                <span className="shrink-0 text-xs font-medium text-slate-700 dark:text-slate-300">
                                  {formatDueLabel(item)}
                                </span>
                            </Link>
                            )}
                          />
                        </div>
                      </section>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}

export default function HorizonPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <HorizonPageContent />
    </Suspense>
  );
}
