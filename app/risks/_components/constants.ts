import type { NewRisk } from "@/lib/types/risk";

export const EMPTY_RISK_FORM: NewRisk = {
  title: "",
  description: "",
  likelihood: 3,
  impact: 3,
};

export const inputClassName =
  "rounded-lg border border-zinc-300 px-3 py-2 text-zinc-950 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";
