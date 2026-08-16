import { formatIsoDate, todayIsoDate } from "@/lib/dates";
import type { Effectiveness, TestResultEffectiveness } from "./control";

export type ControlTestResult = {
  id: string;
  control_id: string;
  effectiveness: Effectiveness;
  tested_at: string;
  notes: string;
  owner_id?: string;
  owner_email?: string;
  created_at?: string;
};

export type NewControlTestResult = {
  effectiveness: TestResultEffectiveness;
  tested_at: string;
  notes: string;
};

export function getTodayDateForInput() {
  return todayIsoDate();
}

export function formatTestedAt(testedAt: string | null | undefined) {
  return formatIsoDate(testedAt);
}

export function toControlTestResultPayload(form: NewControlTestResult) {
  return {
    effectiveness: form.effectiveness,
    tested_at: form.tested_at,
    notes: form.notes,
  };
}
