import type { EvidenceBrief } from "@/lib/rcsa/review-insight";
import { mutedTextClassName } from "@/app/components/ui";

type EvidenceBriefCardProps = {
  brief: EvidenceBrief;
};

const toneClasses = {
  ok: "border-teal-200 bg-teal-50/60 dark:border-teal-900 dark:bg-teal-950/40",
  watch:
    "border-amber-200 bg-amber-50/70 dark:border-amber-900 dark:bg-amber-950/40",
  alert: "border-red-200 bg-red-50/70 dark:border-red-900 dark:bg-red-950/40",
} as const;

const headlineClasses = {
  ok: "text-teal-900 dark:text-teal-200",
  watch: "text-amber-900 dark:text-amber-200",
  alert: "text-red-800 dark:text-red-300",
} as const;

export function EvidenceBriefCard({ brief }: EvidenceBriefCardProps) {
  return (
    <section
      className={`rounded-xl border p-6 shadow-sm ${toneClasses[brief.tone]}`}
    >
      <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Reviewer brief
      </h2>
      <p className={`mt-2 text-base font-medium ${headlineClasses[brief.tone]}`}>
        {brief.headline}
      </p>
      <ul className={`mt-3 list-disc space-y-1 pl-5 text-sm ${mutedTextClassName}`}>
        {brief.bullets.map((bullet) => (
          <li key={bullet}>{bullet}</li>
        ))}
      </ul>
    </section>
  );
}
