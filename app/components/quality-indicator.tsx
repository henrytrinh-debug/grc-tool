import Link from "next/link";
import type { ReactNode } from "react";
import { mutedTextClassName } from "@/app/components/ui";
import type { QualitySummary } from "@/lib/data-quality/record";

function toneClass(score: number, hasFlags: boolean) {
  if (!hasFlags && score === 100) {
    return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300";
  }
  if (score >= 70) {
    return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300";
  }
  return "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300";
}

function labelFor(summary: QualitySummary) {
  if (summary.applicable === 0) {
    return "Quality n/a";
  }
  if (summary.flags.length === 0) {
    return "Quality 100%";
  }
  return `Quality ${summary.score}%`;
}

export function QualityTitle({
  children,
  summary,
}: {
  children: ReactNode;
  summary: QualitySummary;
}) {
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span>{children}</span>
      <QualityPill summary={summary} />
    </span>
  );
}

/** Compact live completeness chip for register rows. Not a stored score. */
export function QualityPill({ summary }: { summary: QualitySummary }) {
  if (summary.applicable === 0) {
    return null;
  }

  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${toneClass(
        summary.score,
        summary.flags.length > 0,
      )}`}
      title={
        summary.flags.length > 0
          ? summary.flags.join(" · ")
          : "No completeness gaps on the current checks"
      }
    >
      {labelFor(summary)}
    </span>
  );
}

/** Edit-page callout listing live gaps. Completeness is calculated, never stored. */
export function QualityCallout({
  summary,
  href = "/quality",
}: {
  summary: QualitySummary;
  href?: string;
}) {
  if (summary.applicable === 0) {
    return null;
  }

  return (
    <section
      className={`rounded-xl border p-4 shadow-sm ${
        summary.flags.length === 0
          ? "border-emerald-200 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/30"
          : summary.score >= 70
            ? "border-amber-200 bg-amber-50/70 dark:border-amber-900 dark:bg-amber-950/30"
            : "border-red-200 bg-red-50/70 dark:border-red-900 dark:bg-red-950/30"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-950 dark:text-slate-50">
            Data quality {summary.score}%
          </p>
          <p className={`mt-0.5 text-xs ${mutedTextClassName}`}>
            Live completeness on this record. Nothing is stored as a score.
          </p>
        </div>
        <Link
          href={href}
          className="text-sm font-medium text-teal-800 hover:underline dark:text-teal-300"
        >
          Open checks
        </Link>
      </div>
      {summary.flags.length > 0 ? (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-800 dark:text-slate-200">
          {summary.flags.map((flag) => (
            <li key={flag}>{flag}</li>
          ))}
        </ul>
      ) : (
        <p className={`mt-2 text-sm ${mutedTextClassName}`}>
          No gaps on the checks that apply here.
        </p>
      )}
    </section>
  );
}
