"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import {
  ErrorBanner,
  PageHeader,
  PageLoading,
  SchemaNotice,
} from "@/app/components/page-parts";
import {
  inputClassName,
  labelClassName,
  mutedTextClassName,
  pageClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
} from "@/app/components/ui";
import { objectsToCsv } from "@/lib/import/csv";
import {
  flattenImportIssues,
  IMPORT_TEMPLATES,
  importHasErrors,
  importTableName,
  shapeImportPayload,
  validateImport,
  type ImportKind,
  type ValidatedImportRow,
} from "@/lib/import/validate";
import { downloadCsv } from "@/lib/export/csv";
import { useRequireAuth } from "@/lib/hooks/use-require-auth";
import { useSettings } from "@/lib/settings/context";
import { getSupabaseClient } from "@/lib/supabase/client";
import { fetchOwnedTableOptional } from "@/lib/supabase/owned";

const KIND_OPTIONS: { value: ImportKind; label: string }[] = [
  { value: "risks", label: "Risks" },
  { value: "controls", label: "Controls" },
  { value: "incidents", label: "Incidents" },
  { value: "issues", label: "Issues" },
  { value: "people", label: "People" },
  { value: "taxonomy", label: "Taxonomy" },
];

function downloadTemplate(kind: ImportKind) {
  const template = IMPORT_TEMPLATES[kind];
  const csv = objectsToCsv(template.headers, [template.example]);
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = template.filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function ImportPage() {
  const { user, authLoading } = useRequireAuth();
  const {
    categories,
    people,
    schemaReady,
    enterpriseReady,
    operatingReady,
  } = useSettings();
  const [kind, setKind] = useState<ImportKind>("risks");
  const [csvText, setCsvText] = useState("");
  const [rows, setRows] = useState<ValidatedImportRow[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const issues = useMemo(
    () => (rows ? flattenImportIssues(rows) : []),
    [rows],
  );
  const hasErrors = rows ? importHasErrors(rows) : true;
  const validCount = rows?.filter((row) =>
    row.issues.every((issue) => issue.level !== "error"),
  ).length ?? 0;

  const blockedReason =
    kind === "people" && !enterpriseReady
      ? "Run 004_enterprise.sql before importing people."
      : kind === "taxonomy" && !schemaReady
        ? "Run 003_admin_settings.sql before importing taxonomy."
        : null;

  async function handlePreview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    if (blockedReason) {
      setError(blockedReason);
      return;
    }

    try {
      const supabase = getSupabaseClient();
      const ownerId = user?.id;
      if (!ownerId) {
        throw new Error("You must be signed in to preview an import.");
      }

      const table = importTableName(kind);
      const existing = await fetchOwnedTableOptional<{
        title?: string;
        name?: string;
        email?: string;
      }>(supabase, table, ownerId, {
        columns:
          kind === "people"
            ? "name, email"
            : kind === "taxonomy"
              ? "name"
              : "title",
      });

      setRows(
        validateImport({
          kind,
          csvText,
          existingTitles: existing.map(
            (row) => row.title ?? row.name ?? "",
          ),
          existingEmails: existing
            .map((row) => row.email ?? "")
            .filter(Boolean),
          categories,
          people: people.map((person) => ({
            id: person.id,
            name: person.name,
            email: person.email,
          })),
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to preview import");
    }
  }

  async function handleImport() {
    if (!rows || !user || hasErrors || blockedReason) {
      return;
    }

    const confirmed = window.confirm(
      `Import ${validCount} ${kind} row${validCount === 1 ? "" : "s"}? Invalid files are never partially written.`,
    );
    if (!confirmed) {
      return;
    }

    setImporting(true);
    setError(null);
    setMessage(null);

    try {
      const payloads = rows
        .filter((row) => row.issues.every((issue) => issue.level !== "error"))
        .map((row) => ({
          ...shapeImportPayload(kind, row.payload, {
            schemaReady,
            enterpriseReady,
            operatingReady,
          }),
          owner_id: user.id,
          owner_email: user.email,
        }));

      const supabase = getSupabaseClient();
      const { error: insertError } = await supabase
        .from(importTableName(kind))
        .insert(payloads);

      if (insertError) {
        throw insertError;
      }

      setMessage(`Imported ${payloads.length} ${kind} row${payloads.length === 1 ? "" : "s"}.`);
      setRows(null);
      setCsvText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import");
    } finally {
      setImporting(false);
    }
  }

  if (authLoading || !user) {
    return <PageLoading />;
  }

  return (
    <div className={pageClassName}>
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <PageHeader
          title="Import CSV"
          description="Preview and validate before any rows are written. Invalid files are rejected in full."
          breadcrumbs={[
            { href: "/", label: "Home" },
            { href: "/admin", label: "Admin" },
            { label: "Import" },
          ]}
          actions={
            <Link href="/admin" className={secondaryButtonClassName}>
              Back to settings
            </Link>
          }
        />

        <ErrorBanner message={error} />
        {message ? (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
            {message}
          </p>
        ) : null}

        {blockedReason ? <SchemaNotice>{blockedReason}</SchemaNotice> : null}

        <form
          onSubmit={(event) => void handlePreview(event)}
          className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <label className="flex flex-col gap-1">
            <span className={labelClassName}>Register</span>
            <select
              value={kind}
              onChange={(event) => {
                setKind(event.target.value as ImportKind);
                setRows(null);
              }}
              className={inputClassName}
            >
              {KIND_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className={secondaryButtonClassName}
              onClick={() => downloadTemplate(kind)}
            >
              Download template
            </button>
          </div>

          <label className="flex flex-col gap-1">
            <span className={labelClassName}>CSV file</span>
            <input
              type="file"
              accept=".csv,text/csv"
              className={inputClassName}
              onChange={(event) => {
                const next = event.target.files?.[0];
                if (!next) {
                  return;
                }
                const reader = new FileReader();
                reader.onload = () => {
                  setCsvText(String(reader.result ?? ""));
                  setRows(null);
                };
                reader.readAsText(next);
              }}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className={labelClassName}>Or paste CSV</span>
            <textarea
              rows={8}
              value={csvText}
              onChange={(event) => {
                setCsvText(event.target.value);
                setRows(null);
              }}
              className={inputClassName}
            />
          </label>

          <button
            type="submit"
            disabled={!csvText.trim() || Boolean(blockedReason)}
            className={primaryButtonClassName}
          >
            Preview and validate
          </button>
        </form>

        {rows ? (
          <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Preview
            </h2>
            <p className={`text-sm ${mutedTextClassName}`}>
              {validCount} valid row{validCount === 1 ? "" : "s"}
              {issues.length > 0
                ? ` · ${issues.length} validation message${issues.length === 1 ? "" : "s"}`
                : ""}
              . Nothing is written until you confirm.
            </p>

            {issues.length > 0 ? (
              <div className="flex flex-col gap-3">
                <ul className="list-disc space-y-1 pl-5 text-sm text-red-700 dark:text-red-300">
                  {issues.slice(0, 20).map((issue) => (
                    <li key={`${issue.row}-${issue.field}-${issue.message}`}>
                      Row {issue.row} · {issue.field}: {issue.message}
                    </li>
                  ))}
                </ul>
                {issues.length > 20 ? (
                  <p className={`text-sm ${mutedTextClassName}`}>
                    Showing the first 20 messages.
                  </p>
                ) : null}
                <button
                  type="button"
                  className={secondaryButtonClassName}
                  onClick={() =>
                    downloadCsv(
                      "import-errors",
                      ["row", "field", "level", "message"],
                      issues.map((issue) => [
                        issue.row,
                        issue.field,
                        issue.level,
                        issue.message,
                      ]),
                    )
                  }
                >
                  Export validation failures
                </button>
              </div>
            ) : null}

            <div className="overflow-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="text-slate-600 dark:text-slate-400">
                    <th className="px-3 py-2 font-medium">Row</th>
                    <th className="px-3 py-2 font-medium">Summary</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 25).map((row) => (
                    <tr key={row.row} className="border-t border-slate-200 dark:border-slate-800">
                      <td className="px-3 py-2">{row.row}</td>
                      <td className="px-3 py-2">
                        {String(row.values.title || row.values.name || "—")}
                      </td>
                      <td className="px-3 py-2">
                        {row.issues.some((issue) => issue.level === "error")
                          ? "Blocked"
                          : "Ready"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button
              type="button"
              disabled={hasErrors || importing || validCount === 0}
              className={primaryButtonClassName}
              onClick={() => void handleImport()}
            >
              {importing
                ? "Importing..."
                : hasErrors
                  ? "Fix errors before import"
                  : `Confirm import of ${validCount} rows`}
            </button>
          </section>
        ) : null}
      </main>
    </div>
  );
}
