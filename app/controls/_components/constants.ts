import type { NewControl } from "@/lib/types/control";

export const EMPTY_CONTROL_FORM: NewControl = {
  title: "",
  description: "",
  is_key: false,
  effectiveness: "not_tested",
  last_tested_at: null,
};
