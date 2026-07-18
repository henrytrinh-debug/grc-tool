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
  "rounded-lg border border-zinc-300 px-3 py-2 text-zinc-950 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";
