import Link from "next/link";

const toneClasses = {
  default:
    "border-slate-200 hover:-translate-y-0.5 hover:border-teal-300 hover:bg-teal-50/40 hover:shadow-md focus-visible:outline-teal-600 dark:border-slate-800 dark:hover:border-teal-700 dark:hover:bg-slate-800 dark:hover:shadow-none dark:focus-visible:outline-teal-400",
  alert:
    "border-red-200 bg-red-50/60 hover:-translate-y-0.5 hover:border-red-300 hover:bg-red-50 hover:shadow-md focus-visible:outline-red-600 dark:border-red-900 dark:bg-red-950/40 dark:hover:border-red-700 dark:hover:bg-red-950 dark:hover:shadow-none dark:focus-visible:outline-red-400",
} as const;

type StatCardProps = {
  label: string;
  value: number | string;
  /** Omit for a non-interactive stat with no sensible filtered-list target. */
  href?: string;
  linkLabel?: string;
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

  const content = (
    <>
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
      {href && linkLabel && (
        <p
          className={`mt-2 text-xs ${
            isAlert
              ? "text-red-700 dark:text-red-400"
              : "text-teal-700 dark:text-teal-300"
          }`}
        >
          {linkLabel} →
        </p>
      )}
    </>
  );

  const className = `rounded-xl border bg-white p-6 shadow-sm dark:bg-slate-900 ${toneClasses[tone]}`;

  if (href) {
    return (
      <Link
        href={href}
        className={`${className} transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2`}
      >
        {content}
      </Link>
    );
  }

  return <div className={className}>{content}</div>;
}
