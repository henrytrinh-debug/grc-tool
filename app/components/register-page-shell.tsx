import type { ReactNode } from "react";
import { PageHeader } from "@/app/components/page-parts";
import { RegisterTabs } from "@/app/components/register-tabs";

export function RegisterPageShell({
  title,
  description,
  path,
  hasListFilters,
  actions,
  children,
}: {
  title: string;
  description: string;
  path: string;
  hasListFilters: boolean;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-h-full min-w-0 bg-slate-50 px-6 py-10 dark:bg-slate-950">
      <main className="mx-auto flex w-full min-w-0 max-w-7xl flex-col gap-6">
        <PageHeader
          title={title}
          description={description}
          breadcrumbs={[
            { href: "/", label: "Home" },
            { label: title },
          ]}
          actions={actions}
        />
        <RegisterTabs path={path} hasListFilters={hasListFilters} />
        {children}
      </main>
    </div>
  );
}

export function SummaryGrid({ children }: { children: ReactNode }) {
  return <div className="grid min-w-0 gap-6 lg:grid-cols-2">{children}</div>;
}
