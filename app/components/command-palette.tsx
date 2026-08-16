"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const COMMANDS = [
  { label: "Home", href: "/", keywords: "dashboard attention" },
  { label: "Risk register", href: "/risks", keywords: "risks" },
  { label: "Risks due for review", href: "/risks?reviewRecency=due", keywords: "stale overdue rcsa" },
  { label: "Uncontrolled risks", href: "/risks?uncontrolled=true", keywords: "no controls" },
  { label: "Control register", href: "/controls", keywords: "controls" },
  { label: "Overdue controls", href: "/controls?testingStatus=Overdue", keywords: "testing" },
  { label: "Unmapped controls", href: "/controls?unmapped=true", keywords: "orphan" },
  { label: "Key controls", href: "/controls?isKey=true", keywords: "key" },
  { label: "Incident register", href: "/incidents", keywords: "incidents" },
  { label: "Open incidents", href: "/incidents?status=open,investigating", keywords: "open" },
  { label: "Issue log", href: "/issues", keywords: "issues findings" },
  { label: "Overdue issues", href: "/issues?overdue=true", keywords: "remediation" },
  { label: "Start risk assessment", href: "/rcsa/start", keywords: "rcsa review" },
  { label: "Oversight monitoring", href: "/oversight", keywords: "2lod second line" },
  { label: "Admin settings", href: "/admin", keywords: "admin organisation taxonomy cadence demo" },
  { label: "Add risk", href: "/risks/new", keywords: "create" },
  { label: "Add control", href: "/controls/new", keywords: "create" },
  { label: "Add incident", href: "/incidents/new", keywords: "create" },
  { label: "Raise issue", href: "/issues/new", keywords: "create finding" },
] as const;

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();

    if (!needle) {
      return COMMANDS;
    }

    return COMMANDS.filter((command) =>
      `${command.label} ${command.keywords}`.toLowerCase().includes(needle),
    );
  }, [query]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }

      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  if (!open) {
    return null;
  }

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[15vh]">
      <button
        type="button"
        aria-label="Close command palette"
        className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Jump to"
        className="relative z-10 w-full max-w-lg overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
      >
        <input
          ref={inputRef}
          type="search"
          autoFocus
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActiveIndex((current) =>
                Math.min(current + 1, Math.max(matches.length - 1, 0)),
              );
            }

            if (event.key === "ArrowUp") {
              event.preventDefault();
              setActiveIndex((current) => Math.max(current - 1, 0));
            }

            if (event.key === "Enter" && matches[activeIndex]) {
              event.preventDefault();
              go(matches[activeIndex].href);
            }
          }}
          placeholder="Jump to a register or filtered view..."
          className="w-full border-b border-slate-200 bg-transparent px-4 py-3 text-sm text-slate-950 outline-none dark:border-slate-700 dark:text-slate-50"
        />
        <ul className="max-h-80 overflow-y-auto py-2">
          {matches.length === 0 ? (
            <li className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
              No matching pages.
            </li>
          ) : (
            matches.map((command, index) => (
              <li key={command.href}>
                <button
                  type="button"
                  onClick={() => go(command.href)}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={`flex w-full px-4 py-2 text-left text-sm ${
                    index === activeIndex
                      ? "bg-teal-50 text-teal-950 dark:bg-teal-950 dark:text-teal-100"
                      : "text-slate-700 dark:text-slate-300"
                  }`}
                >
                  {command.label}
                </button>
              </li>
            ))
          )}
        </ul>
        <p className="border-t border-slate-200 px-4 py-2 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
          ⌘K / Ctrl+K to open · Esc to close
        </p>
      </div>
    </div>
  );
}
