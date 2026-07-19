"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/risks", label: "Risks" },
  { href: "/controls", label: "Controls" },
  { href: "/incidents", label: "Incidents" },
  { href: "/rcsa/start", label: "RCSA" },
] as const;

function isActivePath(href: string, pathname: string) {
  if (href === "/") {
    return pathname === "/";
  }

  if (href.startsWith("/rcsa")) {
    return pathname.startsWith("/rcsa");
  }

  return pathname.startsWith(href);
}

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    async function loadUser() {
      const supabase = getSupabaseClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      setEmail(session?.user.email ?? null);
    }

    void loadUser();
  }, [pathname]);

  async function handleLogout() {
    setLoggingOut(true);

    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.signOut();

      if (error) {
        throw error;
      }

      router.replace("/login");
    } catch {
      setLoggingOut(false);
    }
  }

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="border-b border-slate-200 px-5 py-6 dark:border-slate-800">
        <p className="text-lg font-semibold tracking-tight text-slate-950 dark:text-slate-50">
          GRC Tool
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Governance · Risk · Compliance
        </p>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
        {navItems.map((item) => {
          const active = isActivePath(item.href, pathname);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-teal-50 text-teal-900 dark:bg-teal-950 dark:text-teal-200"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-50"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-200 px-3 py-4 dark:border-slate-800">
        {email && (
          <p className="mb-3 truncate px-3 text-xs text-slate-500 dark:text-slate-500">
            {email}
          </p>
        )}
        <button
          type="button"
          onClick={() => void handleLogout()}
          disabled={loggingOut}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          {loggingOut ? "Logging out..." : "Log out"}
        </button>
      </div>
    </aside>
  );
}
