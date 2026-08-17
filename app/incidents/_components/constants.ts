import type { NewIncident } from "@/lib/types/incident";

export const EMPTY_INCIDENT_FORM: NewIncident = {
  title: "",
  description: "",
  date_occurred: "",
  severity: "medium",
  status: "open",
  root_cause: "",
  assignee_id: "",
  lessons_learned: "",
};
