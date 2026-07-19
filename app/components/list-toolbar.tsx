"use client";

import type { ReactNode } from "react";

export const listInputClassName =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50 dark:focus:border-teal-400 dark:focus:ring-teal-400/20";

type ListToolbarProps = {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  showing: number;
  total: number;
  hasFilters: boolean;
  onClear: () => void;
  children?: ReactNode;
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
}: ListToolbarProps) {
  return (
    <div className="space-y-3 border-b border-slate-200 px-6 py-4 dark:border-slate-800">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
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

        {children}

        {hasFilters && (
          <button
            type="button"
            onClick={onClear}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
          >
            Clear filters
          </button>
        )}
      </div>

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
};

export function FilterSelect({
  label,
  value,
  onChange,
  options,
  emptyLabel = "All",
}: FilterSelectProps) {
  return (
    <label className="flex min-w-[9rem] flex-col gap-1">
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
