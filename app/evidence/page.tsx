"use client";

import Link from "next/link";
import { Suspense, useCallback, useMemo, useState } from "react";
import { ClickableRow } from "@/app/components/clickable-row";
import { QualityTitle } from "@/app/components/quality-indicator";
import { FilterSelect, ListToolbar } from "@/app/components/list-toolbar";
import {
  ErrorBanner,
  ListEmpty,
  LoadingBlock,
  PageHeader,
  PageLoading,
  RegisterTable,
  SchemaNotice,
  registerTheadClassName,
} from "@/app/components/page-parts";
import { primaryButtonClassName, secondaryButtonClassName } from "@/app/components/ui";
import { formatIsoDate } from "@/lib/dates";
import { evidenceQuality } from "@/lib/data-quality/record";
import { loadTestControlIds } from "@/lib/evidence/entities";
import { downloadCsv } from "@/lib/export/csv";
import { useListFilters } from "@/lib/hooks/use-list-filters";
import { useRequireAuth } from "@/lib/hooks/use-require-auth";
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
  const { filters, updateFilters, clearFilters } = useListFilters(
    "/evidence",
    parseEvidenceFilters,
  );
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
    return rows.filter((row) => {
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
  }, [filters, rows]);

  if (authLoading) {
    return <PageLoading />;
  }

  return (
    <div className="min-h-full min-w-0 bg-slate-50 px-6 py-10 dark:bg-slate-950">
      <main className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-6">
        <PageHeader
          title="Evidence"
          description="Metadata and optional files linked to risks, controls, tests, incidents, issues, and obligations."
          breadcrumbs={[
            { href: "/", label: "Home" },
            { label: "Evidence" },
          ]}
          actions={
            evidenceReady ? (
              <Link href="/evidence/new" className={primaryButtonClassName}>
                Add evidence
              </Link>
            ) : null
          }
        />

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

        <section className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <ListToolbar
            search={filters.q}
            onSearchChange={(value) => updateFilters({ q: value })}
            searchPlaceholder="Search title or source..."
            showing={filtered.length}
            total={rows.length}
            hasFilters={Boolean(filters.q || filters.entityType || filters.expired)}
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
          >
            <FilterSelect
              label="Linked type"
              value={filters.entityType}
              onChange={(value) => updateFilters({ entityType: value })}
              options={EVIDENCE_ENTITY_OPTIONS.map((option) => ({
                value: option.value,
                label: option.label,
              }))}
            />
            <FilterSelect
              label="Retention"
              value={filters.expired ? "expired" : ""}
              onChange={(value) =>
                updateFilters({ expired: value === "expired" ? "true" : "" })
              }
              options={[{ value: "expired", label: "Expired" }]}
            />
          </ListToolbar>

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
                  <th className="px-6 py-3 font-medium">Title</th>
                  <th className="px-6 py-3 font-medium">Linked to</th>
                  <th className="px-6 py-3 font-medium">Date</th>
                  <th className="px-6 py-3 font-medium">File</th>
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
      </main>
    </div>
  );
}

export default function EvidencePage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <EvidencePageContent />
    </Suspense>
  );
}
