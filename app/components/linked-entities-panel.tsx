"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { dangerButtonClassName, inputClassName, labelClassName, primaryButtonClassName } from "./ui";

export type LinkedRow = {
  linkId: string;
  entityId: string;
  href: string;
  title: string;
  cells: ReactNode[];
};

export type LinkOption = {
  id: string;
  title: string;
};

type LinkedEntitiesPanelProps = {
  /** Panel heading, e.g. "Linked Controls". */
  title: string;
  /** Capitalised singular of the linked entity, e.g. "Control". */
  entityLabel: string;
  /** Lowercase singular of the record being edited, e.g. "risk". */
  parentLabel: string;
  /** Where to go to create the linked entity, e.g. "/controls". */
  createHref: string;
  columnHeaders: string[];
  rows: LinkedRow[];
  /** Every candidate owned by the user; already-linked ones are filtered out. */
  options: LinkOption[];
  search: string;
  selectedId: string;
  linking: boolean;
  unlinkingLinkId: string | null;
  onSearchChange: (value: string) => void;
  onSelectedChange: (id: string) => void;
  onLink: () => void;
  onUnlink: (linkId: string) => void;
};

export function LinkedEntitiesPanel({
  title,
  entityLabel,
  parentLabel,
  createHref,
  columnHeaders,
  rows,
  options,
  search,
  selectedId,
  linking,
  unlinkingLinkId,
  onSearchChange,
  onSelectedChange,
  onLink,
  onUnlink,
}: LinkedEntitiesPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const query = search.trim().toLowerCase();
  const linkedIds = new Set(rows.map((row) => row.entityId));

  const visibleRows = rows.filter(
    (row) => !query || row.title.toLowerCase().includes(query),
  );

  const availableOptions = options.filter((option) => {
    if (linkedIds.has(option.id)) {
      return false;
    }

    return !query || option.title.toLowerCase().includes(query);
  });

  const singularLower = entityLabel.toLowerCase();
  const pluralLabel = `${singularLower}s`;
  const previewLimit = 5;
  const displayRows =
    !query && !expanded && visibleRows.length > previewLimit
      ? visibleRows.slice(0, previewLimit)
      : visibleRows;
  const hiddenCount = visibleRows.length - displayRows.length;

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-900/60">
      <h3 className="text-sm font-medium text-slate-950 dark:text-slate-50">
        {title}
      </h3>

      <label className="flex flex-col gap-1">
        <span className={labelClassName}>Search {pluralLabel}</span>
        <input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={`Filter linked and available ${pluralLabel} by title...`}
          className={inputClassName}
        />
      </label>

      {rows.length === 0 ? (
        <p className="text-sm text-slate-600 dark:text-slate-400">
          No {pluralLabel} linked to this {parentLabel} yet.
        </p>
      ) : visibleRows.length === 0 ? (
        <p className="text-sm text-slate-600 dark:text-slate-400">
          No linked {pluralLabel} match “{search.trim()}”.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 dark:bg-slate-900 dark:text-slate-400">
              <tr>
                {columnHeaders.map((header) => (
                  <th key={header} className="px-4 py-2 font-medium">
                    {header}
                  </th>
                ))}
                <th className="px-4 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {displayRows.map((row) => (
                <tr key={row.linkId}>
                  {row.cells.map((cell, index) => (
                    <td
                      key={columnHeaders[index] ?? index}
                      className="px-4 py-3 text-slate-950 dark:text-slate-50"
                    >
                      {index === 0 ? (
                        <Link
                          href={row.href}
                          className="font-medium text-teal-700 underline underline-offset-2 dark:text-teal-300"
                        >
                          {cell}
                        </Link>
                      ) : (
                        cell
                      )}
                    </td>
                  ))}
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => onUnlink(row.linkId)}
                      disabled={unlinkingLinkId === row.linkId}
                      className={dangerButtonClassName}
                    >
                      {unlinkingLinkId === row.linkId ? "Unlinking..." : "Unlink"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {hiddenCount > 0 || (expanded && visibleRows.length > previewLimit && !query) ? (
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="text-sm font-medium text-teal-800 hover:underline dark:text-teal-300"
        >
          {expanded ? "Show fewer" : `Show ${hiddenCount} more`}
        </button>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex flex-1 flex-col gap-1">
          <span className={labelClassName}>Link {singularLower}</span>
          <select
            value={selectedId}
            onChange={(event) => onSelectedChange(event.target.value)}
            className={inputClassName}
          >
            <option value="">Select a {singularLower}...</option>
            {availableOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.title}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={onLink}
          disabled={!selectedId || linking}
          className={primaryButtonClassName}
        >
          {linking ? "Linking..." : `Link ${entityLabel}`}
        </button>
      </div>

      {options.length === 0 && (
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Create {pluralLabel} on the{" "}
          <Link
            href={createHref}
            className="font-medium text-teal-700 underline underline-offset-2 dark:text-teal-300"
          >
            {pluralLabel} page
          </Link>{" "}
          before linking them here.
        </p>
      )}

      {options.length > 0 &&
        availableOptions.length === 0 &&
        rows.length > 0 &&
        !query && (
          <p className="text-sm text-slate-600 dark:text-slate-400">
            All of your {pluralLabel} are already linked to this {parentLabel}.
          </p>
        )}

      {options.length > 0 && availableOptions.length === 0 && query && (
        <p className="text-sm text-slate-600 dark:text-slate-400">
          No available {pluralLabel} match “{search.trim()}”.
        </p>
      )}
    </section>
  );
}
