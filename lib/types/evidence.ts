import { todayIsoDate } from "@/lib/dates";

export type EvidenceEntityType =
  | "risk"
  | "control"
  | "test"
  | "incident"
  | "issue"
  | "obligation";

export type EvidenceRecord = {
  id: string;
  title: string;
  description: string;
  evidence_date: string | null;
  source: string;
  retention_date: string | null;
  entity_type: EvidenceEntityType;
  entity_id: string;
  storage_path?: string | null;
  original_filename?: string;
  assignee_id?: string | null;
  owner_email?: string;
  owner_id?: string;
  organization_id?: string | null;
  created_at?: string;
};

export type NewEvidence = Pick<
  EvidenceRecord,
  | "title"
  | "description"
  | "evidence_date"
  | "source"
  | "retention_date"
  | "entity_type"
  | "entity_id"
  | "assignee_id"
>;

export const EVIDENCE_ENTITY_OPTIONS: {
  value: EvidenceEntityType;
  label: string;
}[] = [
  { value: "risk", label: "Risk" },
  { value: "control", label: "Control" },
  { value: "test", label: "Control test" },
  { value: "incident", label: "Incident" },
  { value: "issue", label: "Issue" },
  { value: "obligation", label: "Obligation" },
];

export function formatEvidenceEntityType(value: EvidenceEntityType) {
  return (
    EVIDENCE_ENTITY_OPTIONS.find((option) => option.value === value)?.label ??
    value
  );
}

export function evidenceEntityHref(
  record: Pick<EvidenceRecord, "id" | "entity_type" | "entity_id">,
  testControlIds?: Record<string, string>,
) {
  switch (record.entity_type) {
    case "risk":
      return `/risks/${record.entity_id}/edit`;
    case "control":
      return `/controls/${record.entity_id}/edit`;
    case "test": {
      const controlId = testControlIds?.[record.entity_id];
      return controlId
        ? `/controls/${controlId}/edit`
        : `/evidence/${record.id}/edit`;
    }
    case "incident":
      return `/incidents/${record.entity_id}/edit`;
    case "issue":
      return `/issues/${record.entity_id}/edit`;
    case "obligation":
      return `/obligations/${record.entity_id}/edit`;
    default:
      return "/evidence";
  }
}

export function toEvidencePayload(form: NewEvidence) {
  return {
    title: form.title.trim(),
    description: form.description.trim(),
    evidence_date: form.evidence_date || null,
    source: form.source.trim(),
    retention_date: form.retention_date || null,
    entity_type: form.entity_type,
    entity_id: form.entity_id,
    assignee_id: form.assignee_id || null,
  };
}

export function emptyEvidenceForm(
  entityType: EvidenceEntityType = "risk",
  entityId = "",
): NewEvidence {
  return {
    title: "",
    description: "",
    evidence_date: todayIsoDate(),
    source: "",
    retention_date: "",
    entity_type: entityType,
    entity_id: entityId,
    assignee_id: "",
  };
}

export function isEvidenceExpired(
  record: Pick<EvidenceRecord, "retention_date">,
  today = todayIsoDate(),
) {
  return Boolean(record.retention_date && record.retention_date < today);
}

export const EVIDENCE_BUCKET = "grc-evidence";

export function evidenceObjectPath(
  ownerId: string,
  evidenceId: string,
  filename: string,
) {
  const safeName = filename.replaceAll(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
  return `${ownerId}/${evidenceId}/${safeName || "file"}`;
}
