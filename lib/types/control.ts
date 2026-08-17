import { getSettings } from "@/lib/settings/store";
import {
  addDaysToIsoDate,
  daysSinceIso,
  formatIsoDate,
  todayIsoDate,
} from "@/lib/dates";

export type Effectiveness = "effective" | "ineffective" | "not_tested";

export type ControlType = "preventive" | "detective" | "corrective";

export type Control = {
  id: string;
  title: string;
  description: string;
  is_key: boolean;
  effectiveness: Effectiveness;
  last_tested_at: string | null;
  assignee_id?: string | null;
  control_type?: ControlType;
  owner_email?: string;
  owner_id?: string;
  created_at?: string;
};

export type NewControl = Pick<
  Control,
  | "title"
  | "description"
  | "is_key"
  | "effectiveness"
  | "last_tested_at"
  | "assignee_id"
  | "control_type"
>;

export const EFFECTIVENESS_OPTIONS: {
  value: Effectiveness;
  label: string;
}[] = [
  { value: "effective", label: "Effective" },
  { value: "ineffective", label: "Ineffective" },
  { value: "not_tested", label: "Not Tested" },
];

export type TestResultEffectiveness = "effective" | "ineffective";

export const TEST_RESULT_EFFECTIVENESS_OPTIONS: {
  value: TestResultEffectiveness;
  label: string;
}[] = [
  { value: "effective", label: "Effective" },
  { value: "ineffective", label: "Ineffective" },
];

export function formatEffectiveness(effectiveness: Effectiveness) {
  return (
    EFFECTIVENESS_OPTIONS.find((option) => option.value === effectiveness)
      ?.label ?? effectiveness
  );
}

export function toControlFormPayload(
  form: NewControl,
  includeEnterprise = false,
) {
  const payload: Record<string, unknown> = {
    title: form.title,
    description: form.description,
    is_key: form.is_key,
    effectiveness: form.effectiveness,
    last_tested_at: form.last_tested_at || null,
  };

  if (includeEnterprise) {
    payload.assignee_id = form.assignee_id || null;
    payload.control_type = form.control_type ?? "preventive";
  }

  return payload;
}

export const CONTROL_TYPE_OPTIONS: { value: ControlType; label: string }[] = [
  { value: "preventive", label: "Preventive" },
  { value: "detective", label: "Detective" },
  { value: "corrective", label: "Corrective" },
];

export function formatControlType(value: ControlType | null | undefined) {
  return (
    CONTROL_TYPE_OPTIONS.find((option) => option.value === value)?.label ??
    "Preventive"
  );
}

export function formatKeyStatus(isKey: boolean) {
  return isKey ? "Key" : "Non-Key";
}

/** Key controls use the Admin key-testing cadence; others use the non-key cadence. */
export function getTestingCadenceDays(isKey: boolean) {
  const settings = getSettings();
  return isKey
    ? settings.keyTestingCadenceDays
    : settings.nonKeyTestingCadenceDays;
}

export function getTestingStatus(
  lastTestedAt: string | null | undefined,
  isKey = false,
) {
  if (!lastTestedAt) {
    return "Never Tested";
  }

  if (daysSinceIso(lastTestedAt) > getTestingCadenceDays(isKey)) {
    return "Overdue";
  }

  return "Tested";
}

export function formatLastTestedAt(lastTestedAt: string | null | undefined) {
  return formatIsoDate(lastTestedAt);
}

export function getNextTestDueDate(
  lastTestedAt: string | null | undefined,
  isKey = false,
) {
  if (!lastTestedAt) {
    return todayIsoDate();
  }

  return addDaysToIsoDate(lastTestedAt.slice(0, 10), getTestingCadenceDays(isKey));
}

export function isTestingDue(
  lastTestedAt: string | null | undefined,
  isKey = false,
) {
  return getTestingStatus(lastTestedAt, isKey) !== "Tested";
}

export function formatNextTestDue(
  lastTestedAt: string | null | undefined,
  isKey = false,
) {
  const status = getTestingStatus(lastTestedAt, isKey);
  if (status === "Never Tested") {
    return "Due now";
  }
  if (status === "Overdue") {
    return "Overdue";
  }
  return formatIsoDate(getNextTestDueDate(lastTestedAt, isKey));
}

/**
 * Effectiveness is a snapshot of the latest test. Once a test exists (or a
 * last-tested date is set), Not Tested is not a valid state.
 */
export function controlEffectivenessBlockers(
  form: Pick<NewControl, "effectiveness" | "last_tested_at">,
  options: { hasTestHistory?: boolean } = {},
) {
  const tested = Boolean(options.hasTestHistory) || Boolean(form.last_tested_at);
  if (tested && form.effectiveness === "not_tested") {
    return [
      "Effectiveness cannot be Not Tested after a test has been recorded. Record a new test, or set Effective / Ineffective to match the latest result.",
    ];
  }
  if (!tested && form.effectiveness !== "not_tested" && !form.last_tested_at) {
    return [
      "Set a last-tested date, or record a test, before marking a control Effective or Ineffective.",
    ];
  }
  return [];
}
