"use client";

import { useRouter } from "next/navigation";
import type { KeyboardEvent, ReactNode } from "react";

type ClickableRowProps = {
  href: string;
  children: ReactNode;
  className?: string;
  label: string;
};

const rowClassName =
  "cursor-pointer transition-colors hover:bg-teal-50/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-teal-600 dark:hover:bg-slate-800/80 dark:focus-visible:outline-teal-400";

/**
 * List-table row that navigates on click and on Enter/Space, matching the
 * keyboard behaviour of a link.
 */
export function ClickableRow({
  href,
  children,
  className,
  label,
}: ClickableRowProps) {
  const router = useRouter();

  function go() {
    router.push(href);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTableRowElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      go();
    }
  }

  return (
    <tr
      tabIndex={0}
      role="link"
      aria-label={label}
      onClick={go}
      onKeyDown={handleKeyDown}
      className={`${rowClassName} ${className ?? ""}`}
    >
      {children}
    </tr>
  );
}
