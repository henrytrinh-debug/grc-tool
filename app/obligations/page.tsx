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
  SchemaNotice,
  registerTheadClassName,
} from "@/app/components/page-parts";
import { primaryButtonClassName, secondaryButtonClassName } from "@/app/components/ui";
import { ObligationSummary } from "@/app/obligations/_components/obligation-summary";
import { formatIsoDate } from "@/lib/dates";
import { downloadCsv } from "@/lib/export/csv";
import { useListFilters } from "@/lib/hooks/use-list-filters";
import { useRequireAuth } from "@/lib/hooks/use-require-auth";
import { applySort } from "@/lib/list-sort";
import { parseRegisterView } from "@/lib/register/view";
import { useSettings } from "@/lib/settings/context";
import { getSupabaseClient } from "@/lib/supabase/client";
import { fetchOwnedTableOptional } from "@/lib/supabase/owned";
import { assigneeFilterOptions } from "@/lib/taxonomy";
import {
  formatPersonName,
  personByEmail,
} from "@/lib/types/person";
import {
  formatObligationStatus,
  OBLIGATION_STATUS_OPTIONS,
  type ObligationRecord,
  type ObligationStatus,
} from "@/lib/types/obligation";
import { obligationQuality } from "@/lib/data-quality/record";
import type { ObligationControlLink } from "@/lib/types/obligation-links";

function parseObligationFilters(params: URLSearchParams) {
  const status = params.get("status")?.trim() ?? "";
  return {
    q: params.get("q")?.trim() ?? "",
    status: OBLIGATION_STATUS_OPTIONS.some((option) => option.value === status)
      ? (status as ObligationStatus)
      : "",
    assignee: params.get("assignee")?.trim() ?? "",
  };
}

function ObligationsPageContent() {
  const { filters, updateRegisterFilters, clearFilters, sort, searchParams } =
    useListFilters("/obligations", parseObligationFilters);
  const { people, obligationsReady, enterpriseReady } = useSettings();
  const [rows, setRows] = useState<ObligationRecord[]>([]);
  const [links, setLinks] = useState<ObligationControlLink[]>([]);
  const [controlCounts, setControlCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (ownerId: string) => {
    setError(null);
    try {
      const supabase = getSupabaseClient();
      const [nextRows, nextLinks] = await Promise.all([
        fetchOwnedTableOptional<ObligationRecord>(
          supabase,
          "obligations",
          ownerId,
          { order: "created_at" },
        ),
        fetchOwnedTableOptional<ObligationControlLink>(
          supabase,
          "obligation_controls",
          ownerId,
          { columns: "obligation_id, control_id" },
        ),
      ]);
      setRows(nextRows);
      setLinks(nextLinks);
      const counts: Record<string, number> = {};
      for (const link of nextLinks) {
        counts[link.obligation_id] = (counts[link.obligation_id] ?? 0) + 1;
      }
      setControlCounts(counts);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load obligations",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const { user, authLoading } = useRequireAuth(load);
  const myPersonId = personByEmail(people, user?.email)?.id ?? null;

  const filtered = useMemo(() => {
    const needle = filters.q.toLowerCase();
    const rowsFiltered = rows.filter((row) => {
      if (
        needle &&
        !`${row.title} ${row.source} ${row.citation} ${row.requirement_text}`
          .toLowerCase()
          .includes(needle)
      ) {
        return false;
      }
      if (filters.status && row.status !== filters.status) {
        return false;
      }
      if (filters.assignee === "unassigned" && row.assignee_id) {
        return false;
      }
      if (filters.assignee === "me" && row.assignee_id !== myPersonId) {
        return false;
      }
      if (
        filters.assignee &&
        filters.assignee !== "unassigned" &&
        filters.assignee !== "me" &&
        row.assignee_id !== filters.assignee
      ) {
        return false;
      }
      return true;
    });
    return applySort(rowsFiltered, sort, {
      title: (row) => row.title,
      source: (row) => row.source,
      status: (row) => row.status,
      review: (row) => row.review_date ?? "",
      controls: (row) => controlCounts[row.id] ?? 0,
    });
  }, [controlCounts, filters, myPersonId, rows, sort]);

  const filtersActive = Boolean(filters.q || filters.status || filters.assignee);
  const view = parseRegisterView(searchParams, filtersActive);

  if (authLoading) {
    return <PageLoading />;
  }

  return (
    <RegisterPageShell
      title="Obligations"
      description="Owner-scoped compliance requirements mapped to controls and issues. This is a register, not a regulatory feed."
      path="/obligations"
      hasListFilters={filtersActive}
      actions={
        obligationsReady ? (
          <Link href="/obligations/new" className={primaryButtonClassName}>
            Add obligation
          </Link>
        ) : null
      }
    >
      {!obligationsReady && (
        <SchemaNotice>
          Run <code className="font-mono">supabase/schema/008_obligations.sql</code>{" "}
          to enable the obligations register.
        </SchemaNotice>
      )}

      <ErrorBanner message={error} />

      {view === "settings" ? (
        <RegisterSettingsPanel
          module="obligations"
          extra="Obligation review dates live on each record. People, taxonomy, and workspace layout stay in Admin."
        />
      ) : null}

      {view === "summary" ? (
        loading ? (
          <LoadingBlock label="Loading obligations..." />
        ) : rows.length === 0 ? (
          <ListEmpty>
            {obligationsReady
              ? "No obligations yet."
              : "The obligations table is not available yet."}
          </ListEmpty>
        ) : (
          <ObligationSummary rows={rows} links={links} />
        )
      ) : null}

      {view === "register" ? (
        <section className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <ListToolbar
            search={filters.q}
            onSearchChange={(value) => updateRegisterFilters({ q: value })}
            searchPlaceholder="Search title, source, or citation..."
            showing={filtered.length}
            total={rows.length}
            hasFilters={filtersActive}
            onClear={clearFilters}
            actions={
              <>
                <RegisterPresets module="obligations" />
                {filtered.length > 0 ? (
                  <button
                    type="button"
                    className={secondaryButtonClassName}
                    onClick={() =>
                      downloadCsv(
                        "obligations",
                        [
                          "Title",
                          "Source",
                          "Citation",
                          "Status",
                          "Assignee",
                          "Review date",
                          "Controls",
                        ],
                        filtered.map((row) => [
                          row.title,
                          row.source,
                          row.citation,
                          formatObligationStatus(row.status),
                          formatPersonName(people, row.assignee_id),
                          formatIsoDate(row.review_date),
                          controlCounts[row.id] ?? 0,
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
            <LoadingBlock label="Loading obligations..." />
          ) : filtered.length === 0 ? (
            <ListEmpty>
              {obligationsReady
                ? "No obligations match these filters."
                : "The obligations table is not available yet."}
            </ListEmpty>
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
                      filterValue={enterpriseReady ? filters.assignee : undefined}
                      filterOptions={
                        enterpriseReady ? assigneeFilterOptions(people) : undefined
                      }
                      onFilterChange={
                        enterpriseReady
                          ? (value) => updateRegisterFilters({ assignee: value })
                          : undefined
                      }
                      emptyLabel="All owners"
                    />
                  </th>
                  <th className="px-6 py-3">
                    <ColumnHeader
                      label="Source"
                      sortKey="source"
                      currentSort={sort}
                      onSort={(value) => updateRegisterFilters({ sort: value })}
                    />
                  </th>
                  <th className="px-6 py-3">
                    <ColumnHeader
                      label="Status"
                      sortKey="status"
                      currentSort={sort}
                      onSort={(value) => updateRegisterFilters({ sort: value })}
                      filterValue={filters.status}
                      filterOptions={OBLIGATION_STATUS_OPTIONS.map((option) => ({
                        value: option.value,
                        label: option.label,
                      }))}
                      onFilterChange={(value) =>
                        updateRegisterFilters({ status: value })
                      }
                    />
                  </th>
                  <th className="px-6 py-3">
                    <ColumnHeader
                      label="Review"
                      sortKey="review"
                      currentSort={sort}
                      onSort={(value) => updateRegisterFilters({ sort: value })}
                    />
                  </th>
                  <th className="px-6 py-3">
                    <ColumnHeader
                      label="Controls"
                      sortKey="controls"
                      currentSort={sort}
                      onSort={(value) => updateRegisterFilters({ sort: value })}
                    />
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <ClickableRow
                    key={row.id}
                    href={`/obligations/${row.id}/edit`}
                    label={`Open ${row.title}`}
                  >
                    <td className="px-6 py-3 font-medium text-slate-950 dark:text-slate-50">
                      <QualityTitle
                        summary={obligationQuality(row, {
                          mappedToControl: (controlCounts[row.id] ?? 0) > 0,
                        })}
                      >
                        {row.title}
                      </QualityTitle>
                    </td>
                    <td className="px-6 py-3">{row.source || "—"}</td>
                    <td className="px-6 py-3">
                      {formatObligationStatus(row.status)}
                    </td>
                    <td className="px-6 py-3">{formatIsoDate(row.review_date)}</td>
                    <td className="px-6 py-3">{controlCounts[row.id] ?? 0}</td>
                  </ClickableRow>
                ))}
              </tbody>
            </RegisterTable>
          )}
        </section>
      ) : null}
    </RegisterPageShell>
  );
}

export default function ObligationsPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <ObligationsPageContent />
    </Suspense>
  );
}
