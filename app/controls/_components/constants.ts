import type { NewControl } from "@/lib/types/control";

export const EMPTY_CONTROL_FORM: NewControl = {
  title: "",
  description: "",
  is_key: false,
  effectiveness: "not_tested",
  last_tested_at: null,
};

export const inputClassName =
  "rounded-lg border border-zinc-300 px-3 py-2 text-zinc-950 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";
