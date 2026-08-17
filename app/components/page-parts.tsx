import Link from "next/link";
import type { ReactNode } from "react";
import { Breadcrumbs } from "./breadcrumbs";
import { mutedTextClassName } from "./ui";

export function ErrorBanner({ message }: { message: string | null }) {
  if (!message) {
    return null;
  }

  return (
    <p
      role="alert"
      className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
    >
      {message}
    </p>
  );
}

export function PageLoading({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex min-h-full items-center justify-center bg-slate-50 dark:bg-slate-950">
      <p role="status" className={mutedTextClassName}>
        {label}
      </p>
    </div>
  );
}

export function BackLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-950 dark:text-slate-400 dark:hover:text-slate-50"
    >
      {children}
    </Link>
  );
}

export function ListEmpty({ children }: { children: ReactNode }) {
  return (
    <p className="px-6 py-8 text-slate-600 dark:text-slate-400">{children}</p>
  );
}

export function LoadingBlock({ label = "Loading..." }: { label?: string }) {
  return (
    <p
      role="status"
      className="px-6 py-8 text-slate-600 dark:text-slate-400"
    >
      {label}
    </p>
  );
}

export function RegisterTable({ children }: { children: ReactNode }) {
  return (
    <div className="max-h-[min(70vh,48rem)] overflow-auto print:max-h-none">
      <table className="min-w-full text-left text-sm">{children}</table>
    </div>
  );
}

export const registerTheadClassName =
  "sticky top-0 z-10 bg-slate-50 text-slate-600 shadow-[inset_0_-1px_0_0_rgb(226_232_240)] dark:bg-slate-950 dark:text-slate-400 dark:shadow-[inset_0_-1px_0_0_rgb(30_41_59)]";

export function PageHeader({
  title,
  description,
  actions,
  breadcrumbs,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  breadcrumbs?: Array<{ href?: string; label: string }>;
}) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <div className="mb-3">
            <Breadcrumbs items={breadcrumbs} />
          </div>
        )}
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
          {title}
        </h1>
        {description && <p className={`mt-2 ${mutedTextClassName}`}>{description}</p>}
      </div>
      {actions && (
        <div className="flex w-full min-w-0 shrink-0 flex-wrap items-end gap-3 sm:w-auto">
          {actions}
        </div>
      )}
    </header>
  );
}

export function SchemaNotice({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
      {children}
    </p>
  );
}

export function SectionCard({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow duration-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:shadow-none">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {title}
          </h2>
          {description && (
            <p className={`mt-1 text-sm ${mutedTextClassName}`}>{description}</p>
          )}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}
