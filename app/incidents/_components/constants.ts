import type { NewIncident } from "@/lib/types/incident";

export const EMPTY_INCIDENT_FORM: NewIncident = {
  title: "",
  description: "",
  date_occurred: "",
  severity: "medium",
  status: "open",
  root_cause: "",
};

export const inputClassName =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-950 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50 dark:focus:border-teal-400 dark:focus:ring-teal-400/20";
