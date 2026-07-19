import type { NewRisk } from "@/lib/types/risk";

export const EMPTY_RISK_FORM: NewRisk = {
  title: "",
  description: "",
  likelihood: 3,
  impact: 3,
};

export const inputClassName =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-950 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50 dark:focus:border-teal-400 dark:focus:ring-teal-400/20";
