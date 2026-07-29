import Link from "next/link";

const toneClasses = {
  default:
    "border-slate-200 hover:border-teal-300 hover:bg-teal-50/40 focus-visible:outline-teal-600 dark:border-slate-800 dark:hover:border-teal-700 dark:hover:bg-slate-800 dark:focus-visible:outline-teal-400",
  alert:
    "border-red-200 bg-red-50/60 hover:border-red-300 hover:bg-red-50 focus-visible:outline-red-600 dark:border-red-900 dark:bg-red-950/40 dark:hover:border-red-700 dark:hover:bg-red-950 dark:focus-visible:outline-red-400",
} as const;

type StatCardProps = {
  label: string;
  value: number | string;
  href: string;
  linkLabel: string;
  hint?: string;
  /** `alert` highlights the card in red; used when the value needs attention. */
  tone?: keyof typeof toneClasses;
};

export function StatCard({
  label,
  value,
  href,
  linkLabel,
  hint,
  tone = "default",
}: StatCardProps) {
  const isAlert = tone === "alert";

  return (
    <Link
      href={href}
      className={`rounded-xl border bg-white p-6 shadow-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 dark:bg-slate-900 ${toneClasses[tone]}`}
    >
      <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
        {label}
      </p>
      <p
        className={`mt-2 text-3xl font-semibold ${
          isAlert
            ? "text-red-700 dark:text-red-400"
            : "text-slate-950 dark:text-slate-50"
        }`}
      >
        {value}
      </p>
      {hint && (
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">{hint}</p>
      )}
      <p
        className={`mt-2 text-xs ${
          isAlert
            ? "text-red-700 dark:text-red-400"
            : "text-teal-700 dark:text-teal-300"
        }`}
      >
        {linkLabel} →
      </p>
    </Link>
  );
}
