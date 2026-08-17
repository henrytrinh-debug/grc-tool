"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  parseRegisterView,
  registerTabHref,
  type RegisterView,
} from "@/lib/register/view";

const TABS: { id: RegisterView; label: string }[] = [
  { id: "summary", label: "Summary" },
  { id: "register", label: "Register" },
  { id: "settings", label: "Settings" },
];

export function RegisterTabs({
  path,
  hasListFilters,
}: {
  path: string;
  hasListFilters: boolean;
}) {
  const searchParams = useSearchParams();
  const current = parseRegisterView(searchParams, hasListFilters);

  return (
    <nav
      aria-label="Register views"
      className="flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1 dark:border-slate-800 dark:bg-slate-900"
    >
      {TABS.map((tab) => {
        const active = current === tab.id;
        return (
          <Link
            key={tab.id}
            href={registerTabHref(path, tab.id, searchParams)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              active
                ? "bg-white text-slate-950 shadow-sm dark:bg-slate-800 dark:text-slate-50"
                : "text-slate-600 hover:text-slate-950 dark:text-slate-400 dark:hover:text-slate-50"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
