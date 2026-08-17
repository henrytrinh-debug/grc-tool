"use client";

import Link from "next/link";
import type { FormEvent, ReactNode } from "react";
import { Breadcrumbs } from "./breadcrumbs";
import { BackLink, ErrorBanner } from "./page-parts";
import { primaryButtonClassName, secondaryButtonClassName } from "./ui";

type EntityFormPageProps = {
  backHref: string;
  backLabel: string;
  title: string;
  description?: string;
  breadcrumbs?: Array<{ href?: string; label: string }>;
  error: string | null;
  submitting: boolean;
  submitLabel: string;
  submittingLabel: string;
  cancelHref: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  /** Form fields, laid out on a two-column grid. */
  children: ReactNode;
};

/**
 * Shared scaffold for single-record create forms: back link, heading, error
 * banner, two-column field grid, and submit/cancel actions.
 */
export function EntityFormPage({
  backHref,
  backLabel,
  title,
  description,
  breadcrumbs,
  error,
  submitting,
  submitLabel,
  submittingLabel,
  cancelHref,
  onSubmit,
  children,
}: EntityFormPageProps) {
  return (
    <div className="min-h-full min-w-0 bg-slate-50 px-6 py-10 dark:bg-slate-950">
      <main className="mx-auto flex w-full min-w-0 max-w-4xl flex-col gap-8">
        <header>
          {breadcrumbs && breadcrumbs.length > 0 ? (
            <Breadcrumbs items={breadcrumbs} />
          ) : (
            <BackLink href={backHref}>← {backLabel}</BackLink>
          )}
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
            {title}
          </h1>
          {description && (
            <p className="mt-2 text-slate-600 dark:text-slate-400">
              {description}
            </p>
          )}
        </header>

        <ErrorBanner message={error} />

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <form onSubmit={onSubmit} className="grid min-w-0 gap-4 sm:grid-cols-2">
            {children}

            <div className="flex flex-wrap gap-3 sm:col-span-2">
              <button
                type="submit"
                disabled={submitting}
                className={primaryButtonClassName}
              >
                {submitting ? submittingLabel : submitLabel}
              </button>
              <Link href={cancelHref} className={secondaryButtonClassName}>
                Cancel
              </Link>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}
