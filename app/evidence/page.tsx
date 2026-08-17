"use client";

import Link from "next/link";
import { Suspense, useCallback, useMemo, useState } from "react";
import { ClickableRow } from "@/app/components/clickable-row";
import { ColumnHeader } from "@/app/components/column-header";
import { QualityTitle } from "@/app/components/quality-indicator";
import { ListToolbar } from "@/app/components/list-toolbar";
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
import { EvidenceSummary } from "@/app/evidence/_components/evidence-summary";
import { formatIsoDate } from "@/lib/dates";
import { evidenceQuality } from "@/lib/data-quality/record";
import { loadTestControlIds } from "@/lib/evidence/entities";
import { downloadCsv } from "@/lib/export/csv";
import { useListFilters } from "@/lib/hooks/use-list-filters";
import { useRequireAuth } from "@/lib/hooks/use-require-auth";
import { applySort } from "@/lib/list-sort";
import { parseRegisterView } from "@/lib/register/view";
import { useSettings } from "@/lib/settings/context";
import { getSupabaseClient } from "@/lib/supabase/client";
import { fetchOwnedTableOptional } from "@/lib/supabase/owned";
import {
  EVIDENCE_ENTITY_OPTIONS,
  evidenceEntityHref,
  formatEvidenceEntityType,
  isEvidenceExpired,
  type EvidenceEntityType,
  type EvidenceRecord,
} from "@/lib/types/evidence";

function parseEvidenceFilters(params: URLSearchParams) {
  const entityType = params.get("entityType")?.trim() ?? "";
  return {
    q: params.get("q")?.trim() ?? "",
    entityType: EVIDENCE_ENTITY_OPTIONS.some((option) => option.value === entityType)
      ? (entityType as EvidenceEntityType)
      : "",
    expired: params.get("expired") === "true",
  };
}

function EvidencePageContent() {
  const { filters, updateRegisterFilters, clearFilters, sort, searchParams } =
    useListFilters("/evidence", parseEvidenceFilters);
  const { evidenceReady, evidenceStorageReady } = useSettings();
  const [rows, setRows] = useState<EvidenceRecord[]>([]);
  const [testControlIds, setTestControlIds] = useState<Record<string, string>>(
    {},
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (ownerId: string) => {
    setError(null);
    try {
      const supabase = getSupabaseClient();
      const [nextRows, nextTests] = await Promise.all([
        fetchOwnedTableOptional<EvidenceRecord>(supabase, "evidence", ownerId, {
          order: "created_at",
        }),
        loadTestControlIds(ownerId),
      ]);
      setRows(nextRows);
      setTestControlIds(nextTests);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load evidence");
    } finally {
      setLoading(false);
    }
  }, []);

  const { authLoading } = useRequireAuth(load);

  const filtered = useMemo(() => {
    const needle = filters.q.toLowerCase();
    const rowsFiltered = rows.filter((row) => {
      if (
        needle &&
        !`${row.title} ${row.source} ${row.description}`.toLowerCase().includes(needle)
      ) {
        return false;
      }
      if (filters.entityType && row.entity_type !== filters.entityType) {
        return false;
      }
      if (filters.expired && !isEvidenceExpired(row)) {
        return false;
      }
      return true;
    });
    return applySort(rowsFiltered, sort, {
      title: (row) => row.title,
      type: (row) => row.entity_type,
      date: (row) => row.evidence_date ?? "",
      file: (row) => (row.storage_path ? 1 : 0),
    });
  }, [filters, rows, sort]);

  const filtersActive = Boolean(
    filters.q || filters.entityType || filters.expired,
  );
  const view = parseRegisterView(searchParams, filtersActive);

  if (authLoading) {
    return <PageLoading />;
  }

  return (
    <RegisterPageShell
      title="Evidence"
      description="Metadata and optional files linked to risks, controls, tests, incidents, issues, and obligations."
      path="/evidence"
      hasListFilters={filtersActive}
      actions={
        evidenceReady ? (
          <Link href="/evidence/new" className={primaryButtonClassName}>
            Add evidence
          </Link>
        ) : null
      }
    >
      {!evidenceReady && (
        <SchemaNotice>
          Run <code className="font-mono">supabase/schema/009_evidence.sql</code>{" "}
          to enable the evidence register.
        </SchemaNotice>
      )}
      {evidenceReady && !evidenceStorageReady && (
        <SchemaNotice>
          Metadata works. File uploads need the private{" "}
          <code className="font-mono">grc-evidence</code> bucket and Storage
          Access Control policies from{" "}
          <a
            className="underline"
            href="https://supabase.com/docs/guides/storage/security/access-control"
          >
            the Storage docs
          </a>
          . Folder prefix must be <code className="font-mono">auth.uid()</code>.
        </SchemaNotice>
      )}

      <ErrorBanner message={error} />

      {view === "settings" ? (
        <RegisterSettingsPanel
          module="evidence"
          extra="Evidence storage is configured in Supabase. Organisation-wide people, taxonomy, and workspace layout stay in Admin."
        />
      ) : null}

      {view === "summary" ? (
        loading ? (
          <LoadingBlock label="Loading evidence..." />
        ) : rows.length === 0 ? (
          <ListEmpty>
            {evidenceReady
              ? "No evidence yet."
              : "The evidence table is not available yet."}
          </ListEmpty>
        ) : (
          <EvidenceSummary rows={rows} />
        )
      ) : null}

      {view === "register" ? (
        <section className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <ListToolbar
            search={filters.q}
            onSearchChange={(value) => updateRegisterFilters({ q: value })}
            searchPlaceholder="Search title or source..."
            showing={filtered.length}
            total={rows.length}
            hasFilters={filtersActive}
            onClear={clearFilters}
            actions={
              filtered.length > 0 ? (
                <button
                  type="button"
                  className={secondaryButtonClassName}
                  onClick={() =>
                    downloadCsv(
                      "evidence",
                      ["Title", "Type", "Source", "Evidence date", "Retention", "File"],
                      filtered.map((row) => [
                        row.title,
                        formatEvidenceEntityType(row.entity_type),
                        row.source,
                        formatIsoDate(row.evidence_date),
                        formatIsoDate(row.retention_date),
                        row.storage_path ? "Yes" : "No",
                      ]),
                    )
                  }
                >
                  Export CSV
                </button>
              ) : null
            }
          />

          {loading ? (
            <LoadingBlock label="Loading evidence..." />
          ) : filtered.length === 0 ? (
            <ListEmpty>
              {evidenceReady
                ? "No evidence matches these filters."
                : "The evidence table is not available yet."}
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
                    />
                  </th>
                  <th className="px-6 py-3">
                    <ColumnHeader
                      label="Linked to"
                      sortKey="type"
                      currentSort={sort}
                      onSort={(value) => updateRegisterFilters({ sort: value })}
                      filterValue={filters.entityType}
                      filterOptions={EVIDENCE_ENTITY_OPTIONS.map((option) => ({
                        value: option.value,
                        label: option.label,
                      }))}
                      onFilterChange={(value) =>
                        updateRegisterFilters({ entityType: value })
                      }
                    />
                  </th>
                  <th className="px-6 py-3">
                    <ColumnHeader
                      label="Date"
                      sortKey="date"
                      currentSort={sort}
                      onSort={(value) => updateRegisterFilters({ sort: value })}
                    />
                  </th>
                  <th className="px-6 py-3">
                    <ColumnHeader
                      label="File"
                      sortKey="file"
                      currentSort={sort}
                      onSort={(value) => updateRegisterFilters({ sort: value })}
                      filterValue={filters.expired ? "expired" : ""}
                      filterOptions={[{ value: "expired", label: "Expired" }]}
                      onFilterChange={(value) =>
                        updateRegisterFilters({
                          expired: value === "expired" ? "true" : "",
                        })
                      }
                    />
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <ClickableRow
                    key={row.id}
                    href={`/evidence/${row.id}/edit`}
                    label={`Open ${row.title}`}
                  >
                    <td className="px-6 py-3 font-medium text-slate-950 dark:text-slate-50">
                      <QualityTitle
                        summary={evidenceQuality(row, { evidenceStorageReady })}
                      >
                        {row.title}
                      </QualityTitle>
                    </td>
                    <td className="px-6 py-3">
                      <Link
                        href={evidenceEntityHref(row, testControlIds)}
                        className="text-teal-800 hover:underline dark:text-teal-300"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {formatEvidenceEntityType(row.entity_type)}
                      </Link>
                    </td>
                    <td className="px-6 py-3">{formatIsoDate(row.evidence_date)}</td>
                    <td className="px-6 py-3">
                      {row.storage_path
                        ? "Attached"
                        : isEvidenceExpired(row)
                          ? "Expired · no file"
                          : "Metadata only"}
                    </td>
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

export default function EvidencePage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <EvidencePageContent />
    </Suspense>
  );
}
