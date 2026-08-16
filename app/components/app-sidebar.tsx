"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { useSettings } from "@/lib/settings/context";

const navSections = [
  {
    label: "Overview",
    items: [
      { href: "/", label: "Home" },
      { href: "/oversight", label: "Oversight" },
    ],
  },
  {
    label: "Registers",
    items: [
      { href: "/risks", label: "Risks" },
      { href: "/controls", label: "Controls" },
      { href: "/incidents", label: "Incidents" },
      { href: "/issues", label: "Issues" },
    ],
  },
  {
    label: "Assessment",
    items: [{ href: "/rcsa/start", label: "Risk Assessment" }],
  },
  {
    label: "Administration",
    items: [{ href: "/admin", label: "Settings" }],
  },
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

type AppSidebarProps = {
  mobileOpen?: boolean;
  onNavigate?: () => void;
};

export function AppSidebar({ mobileOpen = false, onNavigate }: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { settings } = useSettings();
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
    <aside
      id="app-sidebar"
      className={`flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 ${
        mobileOpen ? "fixed inset-y-0 left-0 z-40" : "hidden md:flex"
      }`}
    >
      <div className="border-b border-slate-200 px-5 py-5 dark:border-slate-800">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-700 dark:text-teal-300">
          GRC
        </p>
        <p className="mt-1 truncate text-base font-semibold tracking-tight text-slate-950 dark:text-slate-50">
          {settings.organizationName}
        </p>
      </div>

      <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-4">
        {navSections.map((section) => (
          <div key={section.label}>
            <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              {section.label}
            </p>
            <div className="flex flex-col gap-0.5">
              {section.items.map((item) => {
                const active = isActivePath(item.href, pathname);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      active
                        ? "bg-teal-50 text-teal-900 shadow-[inset_3px_0_0_0_rgb(13,148,136)] dark:bg-teal-950 dark:text-teal-200 dark:shadow-[inset_3px_0_0_0_rgb(45,212,191)]"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-50"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-slate-200 px-3 py-4 dark:border-slate-800">
        {email && (
          <p className="mb-3 truncate px-3 text-xs text-slate-500 dark:text-slate-500">
            {email}
          </p>
        )}
        <p className="mb-3 px-3 text-[11px] text-slate-400 dark:text-slate-500">
          ⌘K to jump
        </p>
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
