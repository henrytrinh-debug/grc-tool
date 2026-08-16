import { getSettings } from "@/lib/settings/store";
import { daysSinceIso, formatIsoDate } from "@/lib/dates";

export type Effectiveness = "effective" | "ineffective" | "not_tested";

export type Control = {
  id: string;
  title: string;
  description: string;
  is_key: boolean;
  effectiveness: Effectiveness;
  last_tested_at: string | null;
  owner_email?: string;
  owner_id?: string;
  created_at?: string;
};

export type NewControl = Pick<
  Control,
  "title" | "description" | "is_key" | "effectiveness" | "last_tested_at"
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

export function toControlFormPayload(form: NewControl) {
  return {
    title: form.title,
    description: form.description,
    is_key: form.is_key,
    effectiveness: form.effectiveness,
    last_tested_at: form.last_tested_at || null,
  };
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
