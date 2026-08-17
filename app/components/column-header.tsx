"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { listInputClassName } from "@/app/components/list-toolbar";
import { nextSortValue } from "@/lib/register/view";

export type ColumnFilterOption = { value: string; label: string };

export function ColumnHeader({
  label,
  sortKey,
  currentSort,
  onSort,
  filterValue,
  filterOptions,
  onFilterChange,
  extraFilter,
  emptyLabel = "All",
}: {
  label: ReactNode;
  sortKey?: string;
  currentSort?: string;
  onSort?: (value: string) => void;
  filterValue?: string;
  filterOptions?: ColumnFilterOption[];
  onFilterChange?: (value: string) => void;
  extraFilter?: {
    label: string;
    value: string;
    options: ColumnFilterOption[];
    onChange: (value: string) => void;
    emptyLabel?: string;
  };
  emptyLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const filtered = Boolean(filterValue) || Boolean(extraFilter?.value);
  const sorted =
    sortKey && (currentSort === sortKey || currentSort === `-${sortKey}`);
  const descending = Boolean(sortKey && currentSort === `-${sortKey}`);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative flex items-center gap-1">
      {sortKey && onSort ? (
        <button
          type="button"
          onClick={() => onSort(nextSortValue(currentSort ?? "", sortKey))}
          className="text-left font-medium hover:text-slate-950 dark:hover:text-slate-50"
        >
          {label}
          {sorted ? (
            <span className="ml-1 text-teal-700 dark:text-teal-300">
              {descending ? "↓" : "↑"}
            </span>
          ) : null}
        </button>
      ) : (
        <span className="font-medium">{label}</span>
      )}
      {filterOptions && onFilterChange ? (
        <>
          <button
            type="button"
            aria-expanded={open}
            aria-controls={menuId}
            aria-label={`Filter ${typeof label === "string" ? label : "column"}`}
            onClick={() => setOpen((current) => !current)}
            className={`rounded px-1 text-xs ${
              filtered
                ? "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-200"
                : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            }`}
          >
            ▾
          </button>
          {open ? (
            <div
              id={menuId}
              className="absolute left-0 top-full z-20 mt-1 min-w-44 space-y-2 rounded-lg border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-900"
            >
              <select
                autoFocus
                value={filterValue ?? ""}
                onChange={(event) => {
                  onFilterChange(event.target.value);
                  if (!extraFilter) {
                    setOpen(false);
                  }
                }}
                className={listInputClassName}
              >
                <option value="">{emptyLabel}</option>
                {filterOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {extraFilter ? (
                <label className="block space-y-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {extraFilter.label}
                  </span>
                  <select
                    value={extraFilter.value}
                    onChange={(event) => extraFilter.onChange(event.target.value)}
                    className={listInputClassName}
                  >
                    <option value="">{extraFilter.emptyLabel ?? "All"}</option>
                    {extraFilter.options.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
