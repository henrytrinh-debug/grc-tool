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
  return new Date().toISOString().slice(0, 10);
}

export function formatTestedAt(testedAt: string | null | undefined) {
  if (!testedAt) {
    return "—";
  }

  return new Date(testedAt).toLocaleDateString();
}

export function toControlTestResultPayload(form: NewControlTestResult) {
  return {
    effectiveness: form.effectiveness,
    tested_at: form.tested_at,
    notes: form.notes,
  };
}
