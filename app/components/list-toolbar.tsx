"use client";

import type { ReactNode } from "react";
import { secondaryButtonClassName } from "@/app/components/ui";

export const listInputClassName =
  "field-sizing-fixed w-full min-w-0 max-w-full overflow-hidden rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50 dark:focus:border-teal-400 dark:focus:ring-teal-400/20";

type ListToolbarProps = {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  showing: number;
  total: number;
  hasFilters: boolean;
  onClear: () => void;
  children?: ReactNode;
  actions?: ReactNode;
};

export function ListToolbar({
  search,
  onSearchChange,
  searchPlaceholder = "Search...",
  showing,
  total,
  hasFilters,
  onClear,
  children,
  actions,
}: ListToolbarProps) {
  return (
    <div className="min-w-0 space-y-4 border-b border-slate-200 px-6 py-4 dark:border-slate-800">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Search
          </span>
          <input
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={searchPlaceholder}
            className={listInputClassName}
          />
        </label>

        {(hasFilters || actions) && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {hasFilters && (
              <button
                type="button"
                onClick={onClear}
                className={secondaryButtonClassName}
              >
                Clear filters
              </button>
            )}
            {actions}
          </div>
        )}
      </div>

      {children ? (
        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {children}
        </div>
      ) : null}

      <p className="text-sm text-slate-500 dark:text-slate-400">
        Showing {showing} of {total}
      </p>
    </div>
  );
}

type FilterSelectProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  emptyLabel?: string;
  className?: string;
};

export function FilterSelect({
  label,
  value,
  onChange,
  options,
  emptyLabel = "All",
  className,
}: FilterSelectProps) {
  return (
    <label className={`flex min-w-0 max-w-full flex-col gap-1 ${className ?? ""}`}>
      <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={listInputClassName}
      >
        <option value="">{emptyLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
