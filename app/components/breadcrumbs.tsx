import Link from "next/link";

type Crumb = {
  href?: string;
  label: string;
};

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-slate-500 dark:text-slate-400">
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((item, index) => {
          const last = index === items.length - 1;

          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-1">
              {index > 0 && <span aria-hidden="true">/</span>}
              {item.href && !last ? (
                <Link
                  href={item.href}
                  className="font-medium text-slate-600 transition-colors hover:text-slate-950 dark:text-slate-400 dark:hover:text-slate-50"
                >
                  {item.label}
                </Link>
              ) : (
                <span className={last ? "text-slate-950 dark:text-slate-50" : undefined}>
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
