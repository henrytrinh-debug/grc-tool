"use client";

import { usePathname } from "next/navigation";
import { AppSidebar } from "@/app/components/app-sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showSidebar = pathname !== "/login";

  if (!showSidebar) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-full">
      <AppSidebar />
      <div className="flex min-h-full flex-1 flex-col">{children}</div>
    </div>
  );
}
