"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { AppSidebar } from "@/app/components/app-sidebar";
import { CommandPalette } from "@/app/components/command-palette";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showSidebar = pathname !== "/login";
  const [navOpenForPath, setNavOpenForPath] = useState<string | null>(null);
  const navOpen = navOpenForPath === pathname;

  if (!showSidebar) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-full">
      {navOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-30 bg-slate-950/40 md:hidden"
          onClick={() => setNavOpenForPath(null)}
        />
      )}
      <AppSidebar
        mobileOpen={navOpen}
        onNavigate={() => setNavOpenForPath(null)}
      />
      <div className="flex min-h-full min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 md:hidden dark:border-slate-800 dark:bg-slate-900">
          <button
            type="button"
            onClick={() => setNavOpenForPath(pathname)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-300"
            aria-expanded={navOpen}
            aria-controls="app-sidebar"
          >
            Menu
          </button>
          <p className="text-sm font-semibold text-slate-950 dark:text-slate-50">
            GRC Tool
          </p>
        </div>
        {children}
      </div>
      <CommandPalette />
    </div>
  );
}
