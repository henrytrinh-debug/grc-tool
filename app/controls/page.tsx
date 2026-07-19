"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  EffectivenessBadge,
  KeyBadge,
  TestingStatusBadge,
} from "@/app/components/status-badge";
import { FilterSelect, ListToolbar } from "@/app/components/list-toolbar";
import {
  filterControls,
  hasActiveFilters,
  parseControlFilters,
} from "@/lib/list-filters";
import { getSupabaseClient } from "@/lib/supabase/client";
import {
  EFFECTIVENESS_OPTIONS,
  formatEffectiveness,
  formatLastTestedAt,
  getTestingStatus,
  type Control,
} from "@/lib/types/control";
import {
  groupRiskControlRowsByControl,
  type RiskControlRiskRow,
} from "@/lib/types/risk-control";

function ControlsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filters = useMemo(
    () => parseControlFilters(searchParams),
    [searchParams],
  );

  const [controls, setControls] = useState<Control[]>([]);
  const [linkedRiskCounts, setLinkedRiskCounts] = useState<
    Record<string, number>
  >({});
  const [authLoading, setAuthLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const updateFilters = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());

      for (const [key, value] of Object.entries(updates)) {
        if (!value) {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }

      const query = params.toString();
      router.replace(query ? `/controls?${query}` : "/controls");
    },
    [router, searchParams],
  );

  const clearFilters = useCallback(() => {
    router.replace("/controls");
  }, [router]);

  const fetchControls = useCallback(async (ownerId: string) => {
    setError(null);

    try {
      const supabase = getSupabaseClient();
      const [controlsResult, linksResult] = await Promise.all([
        supabase
          .from("controls")
          .select("*")
          .eq("owner_id", ownerId)
          .order("created_at", { ascending: false }),
        supabase
          .from("risk_controls")
          .select("id, risk_id, control_id, risks(title, likelihood, impact, owner_email)")
          .eq("owner_id", ownerId),
      ]);

      if (controlsResult.error) {
        throw controlsResult.error;
      }

      if (linksResult.error) {
        throw linksResult.error;
      }

      setControls(controlsResult.data ?? []);

      const grouped = groupRiskControlRowsByControl(
        (linksResult.data ?? []) as RiskControlRiskRow[],
      );
      const counts: Record<string, number> = {};
      for (const [controlId, links] of Object.entries(grouped)) {
        counts[controlId] = links.length;
      }
      setLinkedRiskCounts(counts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load controls");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const supabase = getSupabaseClient();

    async function checkAuth() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/login");
        return;
      }

      setAuthLoading(false);
      await fetchControls(session.user.id);
    }

    void checkAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.replace("/login");
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchControls, router]);

  const filteredControls = useMemo(
    () => filterControls(controls, filters),
    [controls, filters],
  );

  const filtersActive = hasActiveFilters({
    q: filters.q,
    effectiveness: filters.effectiveness,
    testingStatus: filters.testingStatus,
    isKey: filters.isKey,
  });

  if (authLoading) {
    return (
      <div className="flex min-h-full items-center justify-center bg-slate-50 dark:bg-slate-950">
        <p className="text-slate-600 dark:text-slate-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-slate-50 px-6 py-10 dark:bg-slate-950">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
              Control Register
            </h1>
            <p className="mt-2 text-slate-600 dark:text-slate-400">
              Manage and track your assigned controls.
            </p>
          </div>
          <Link
            href="/controls/new"
            className="inline-flex shrink-0 items-center justify-center rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-600 dark:bg-teal-400 dark:text-slate-950 dark:hover:bg-teal-300"
          >
            Add Control
          </Link>
        </header>

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        )}

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <ListToolbar
            search={filters.q}
            onSearchChange={(value) => updateFilters({ q: value })}
            searchPlaceholder="Search title or description..."
            showing={filteredControls.length}
            total={controls.length}
            hasFilters={filtersActive}
            onClear={clearFilters}
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
          </ListToolbar>

          {loading ? (
            <p className="px-6 py-8 text-slate-600 dark:text-slate-400">
              Loading controls...
            </p>
          ) : controls.length === 0 ? (
            <p className="px-6 py-8 text-slate-600 dark:text-slate-400">
              No controls yet.{" "}
              <Link
                href="/controls/new"
                className="font-medium text-teal-700 underline underline-offset-2 dark:text-teal-300"
              >
                Add your first control
              </Link>
              .
            </p>
          ) : filteredControls.length === 0 ? (
            <p className="px-6 py-8 text-slate-600 dark:text-slate-400">
              No controls match the current filters.
            </p>
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
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {filteredControls.map((control) => (
                    <tr
                      key={control.id}
                      onClick={() =>
                        router.push(`/controls/${control.id}/edit`)
                      }
                      className="cursor-pointer transition-colors hover:bg-teal-50/60 dark:hover:bg-slate-800/80"
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
                        <TestingStatusBadge
                          status={getTestingStatus(control.last_tested_at)}
                        />
                      </td>
                      <td className="px-6 py-4 text-slate-950 dark:text-slate-50">
                        {linkedRiskCounts[control.id] ?? 0}
                      </td>
                    </tr>
                  ))}
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
    <Suspense
      fallback={
        <div className="flex min-h-full items-center justify-center bg-slate-50 dark:bg-slate-950">
          <p className="text-slate-600 dark:text-slate-400">Loading...</p>
        </div>
      }
    >
      <ControlsPageContent />
    </Suspense>
  );
}
