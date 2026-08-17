import Link from "next/link";
import type { ReactNode } from "react";
import { mutedTextClassName } from "@/app/components/ui";

export type RecordLinkTone = "default" | "alert" | "watch";

export type RecordLinkItem = {
  id: string;
  href: string;
  title: ReactNode;
  detail?: ReactNode;
  meta?: ReactNode;
  tone?: RecordLinkTone;
};

type RecordLinkListProps = {
  items: RecordLinkItem[];
  empty: ReactNode;
  variant?: "divided" | "cards";
  limit?: number;
  moreHref?: string;
  moreLabel?: string;
};

const cardToneClasses: Record<RecordLinkTone, string> = {
  default:
    "border-slate-200 hover:border-teal-300 dark:border-slate-800 dark:hover:border-teal-700",
  alert:
    "border-red-200 bg-red-50/70 hover:border-red-300 dark:border-red-900 dark:bg-red-950/40 dark:hover:border-red-700",
  watch:
    "border-amber-200 bg-amber-50/70 hover:border-amber-300 dark:border-amber-900 dark:bg-amber-950/40 dark:hover:border-amber-700",
};

const detailToneClasses: Record<RecordLinkTone, string> = {
  default: mutedTextClassName,
  alert: "text-red-700 dark:text-red-400",
  watch: "text-amber-800 dark:text-amber-300",
};

export function RecordLinkList({
  items,
  empty,
  variant = "divided",
  limit,
  moreHref,
  moreLabel,
}: RecordLinkListProps) {
  const visibleItems = limit ? items.slice(0, limit) : items;
  const hiddenCount = items.length - visibleItems.length;

  if (visibleItems.length === 0) {
    return <p className={`text-sm ${mutedTextClassName}`}>{empty}</p>;
  }

  return (
    <>
      <ul
        className={
          variant === "cards"
            ? "space-y-2"
            : "divide-y divide-slate-200 dark:divide-slate-800"
        }
      >
      {visibleItems.map((item) => {
        const tone = item.tone ?? "default";
        const cardClasses =
          variant === "cards"
            ? `rounded-lg border px-4 py-3 ${cardToneClasses[tone]}`
            : "py-3 hover:text-teal-800 dark:hover:text-teal-200";

        return (
          <li key={item.id}>
            <Link
              href={item.href}
              className={`flex flex-col gap-0.5 transition-colors sm:flex-row sm:items-baseline sm:justify-between sm:gap-4 ${cardClasses}`}
            >
              <span className="min-w-0">
                <span className="text-sm font-medium text-slate-950 dark:text-slate-50">
                  {item.title}
                </span>
                {item.detail !== undefined && (
                  <span
                    className={`mt-0.5 block text-xs ${detailToneClasses[tone]}`}
                  >
                    {item.detail}
                  </span>
                )}
              </span>
              {item.meta !== undefined && (
                <span className={`shrink-0 text-xs ${mutedTextClassName}`}>
                  {item.meta}
                </span>
              )}
            </Link>
          </li>
        );
      })}
      </ul>
      {hiddenCount > 0 ? (
        moreHref ? (
          <Link
            href={moreHref}
            className="mt-2 block text-sm font-medium text-teal-800 hover:underline dark:text-teal-300"
          >
            {moreLabel ?? `View ${hiddenCount} more`}
          </Link>
        ) : (
          <p className={`mt-2 text-sm ${mutedTextClassName}`}>
            {moreLabel ?? `${hiddenCount} more not shown`}
          </p>
        )
      ) : null}
    </>
  );
}
