"use client";

import { useState, type ReactNode } from "react";

const PREVIEW_LIMIT = 6;

export function ExpandableList<T>({
  items,
  limit = PREVIEW_LIMIT,
  renderItem,
  moreLabel,
}: {
  items: T[];
  limit?: number;
  renderItem: (item: T) => ReactNode;
  moreLabel?: (hidden: number) => string;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, limit);
  const hidden = items.length - visible.length;
  const canCollapse = expanded && items.length > limit;

  return (
    <>
      {visible.map(renderItem)}
      {hidden > 0 || canCollapse ? (
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="mt-2 text-sm font-medium text-teal-800 hover:underline dark:text-teal-300"
        >
          {expanded
            ? "Show fewer"
            : (moreLabel?.(hidden) ?? `Show ${hidden} more`)}
        </button>
      ) : null}
    </>
  );
}
