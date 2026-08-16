"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { AppSidebar } from "@/app/components/app-sidebar";
import { CommandPalette } from "@/app/components/command-palette";
import { PageLoading } from "@/app/components/page-parts";
import { SettingsProvider, useSettings } from "@/lib/settings/context";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showSidebar = pathname !== "/login";
  const [navOpenForPath, setNavOpenForPath] = useState<string | null>(null);
  const navOpen = navOpenForPath === pathname;

  if (!showSidebar) {
    return <SettingsProvider>{children}</SettingsProvider>;
  }

  return (
    <SettingsProvider>
      <AuthenticatedShell
        navOpen={navOpen}
        onCloseNav={() => setNavOpenForPath(null)}
        onOpenNav={() => setNavOpenForPath(pathname)}
      >
        {children}
      </AuthenticatedShell>
    </SettingsProvider>
  );
}

function AuthenticatedShell({
  children,
  navOpen,
  onCloseNav,
  onOpenNav,
}: {
  children: React.ReactNode;
  navOpen: boolean;
  onCloseNav: () => void;
  onOpenNav: () => void;
}) {
  const { loading } = useSettings();

  if (loading) {
    return <PageLoading />;
  }

  return (
    <div className="flex min-h-full">
      {navOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-30 bg-slate-950/50 backdrop-blur-sm md:hidden"
          onClick={onCloseNav}
        />
      )}
      <AppSidebar mobileOpen={navOpen} onNavigate={onCloseNav} />
      <div className="flex min-h-full min-w-0 flex-1 flex-col">
        <MobileTopBar navOpen={navOpen} onOpenNav={onOpenNav} />
        {children}
      </div>
      <CommandPalette />
    </div>
  );
}

function MobileTopBar({
  navOpen,
  onOpenNav,
}: {
  navOpen: boolean;
  onOpenNav: () => void;
}) {
  const { settings } = useSettings();

  return (
    <div className="flex items-center gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur md:hidden dark:border-slate-800 dark:bg-slate-900/90">
      <button
        type="button"
        onClick={onOpenNav}
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-300"
        aria-expanded={navOpen}
        aria-controls="app-sidebar"
      >
        Menu
      </button>
      <p className="truncate text-sm font-semibold text-slate-950 dark:text-slate-50">
        {settings.organizationName}
      </p>
    </div>
  );
}
