import { parseCsv, csvToObjects } from "@/lib/import/csv";
import type { ControlType, Effectiveness } from "@/lib/types/control";
import type { IncidentStatus, Severity } from "@/lib/types/incident";
import type {
  IssueSeverity,
  IssueSource,
  IssueStatus,
} from "@/lib/types/issue";
import type { LineOfDefence } from "@/lib/types/person";
import type { RiskStatus, RiskTreatment } from "@/lib/types/risk";
import type { SeverityBandLike } from "@/lib/settings/defaults";

export type ImportKind =
  | "risks"
  | "controls"
  | "incidents"
  | "issues"
  | "people"
  | "taxonomy";

export type ImportIssue = {
  row: number;
  field: string;
  message: string;
  level: "error" | "warning";
};

export type ValidatedImportRow = {
  row: number;
  values: Record<string, string>;
  payload: Record<string, unknown>;
  issues: ImportIssue[];
};

export const IMPORT_TEMPLATES: Record<
  ImportKind,
  { filename: string; headers: string[]; example: string[] }
> = {
  risks: {
    filename: "risks-template.csv",
    headers: [
      "title",
      "description",
      "likelihood",
      "impact",
      "category",
      "treatment",
      "status",
      "assignee",
    ],
    example: [
      "Phishing of privileged users",
      "Credential theft via email",
      "4",
      "5",
      "Cyber",
      "mitigate",
      "open",
      "Ada Lopez",
    ],
  },
  controls: {
    filename: "controls-template.csv",
    headers: [
      "title",
      "description",
      "is_key",
      "effectiveness",
      "control_type",
      "assignee",
    ],
    example: [
      "MFA on remote access",
      "Authenticator app required",
      "true",
      "effective",
      "preventive",
      "Ada Lopez",
    ],
  },
  incidents: {
    filename: "incidents-template.csv",
    headers: [
      "title",
      "description",
      "date_occurred",
      "severity",
      "status",
      "root_cause",
      "assignee",
    ],
    example: [
      "VPN credential stuffing",
      "Failed logins then a success",
      "2026-03-02",
      "high",
      "open",
      "",
      "Ada Lopez",
    ],
  },
  issues: {
    filename: "issues-template.csv",
    headers: [
      "title",
      "description",
      "source",
      "severity",
      "status",
      "identified_at",
      "due_date",
      "root_cause",
      "remediation_plan",
      "assignee",
    ],
    example: [
      "Access recertification overdue",
      "Quarterly review missed",
      "internal_audit",
      "high",
      "open",
      "2026-02-01",
      "2026-03-15",
      "",
      "",
      "Ada Lopez",
    ],
  },
  people: {
    filename: "people-template.csv",
    headers: ["name", "email", "title", "department", "line_of_defence"],
    example: ["Ada Lopez", "ada@example.com", "CISO", "Technology", "first"],
  },
  taxonomy: {
    filename: "taxonomy-template.csv",
    headers: ["name", "description", "appetite_band"],
    example: ["Cyber", "Information security", "Medium"],
  },
};

const TREATMENTS: RiskTreatment[] = ["mitigate", "accept", "transfer", "avoid"];
const RISK_STATUSES: RiskStatus[] = ["open", "monitoring", "closed"];
const EFFECTIVENESS: Effectiveness[] = [
  "effective",
  "ineffective",
  "not_tested",
];
const CONTROL_TYPES: ControlType[] = [
  "preventive",
  "detective",
  "corrective",
];
const SEVERITIES: Severity[] = ["low", "medium", "high", "critical"];
const INCIDENT_STATUSES: IncidentStatus[] = [
  "open",
  "investigating",
  "resolved",
];
const ISSUE_SOURCES: IssueSource[] = [
  "internal_audit",
  "external_audit",
  "regulatory_exam",
  "control_failure",
  "incident",
  "risk_assessment",
  "self_identified",
];
const ISSUE_STATUSES: IssueStatus[] = [
  "open",
  "in_progress",
  "pending_review",
  "closed",
];
const LOD: LineOfDefence[] = ["first", "second", "third"];
const BANDS: SeverityBandLike[] = ["Low", "Medium", "High", "Critical"];

function inList<T extends string>(value: string, allowed: T[]): T | null {
  const match = allowed.find(
    (item) => item.toLowerCase() === value.toLowerCase(),
  );
  return match ?? null;
}

function parseBool(value: string): boolean | null {
  const lowered = value.toLowerCase();
  if (["true", "yes", "1", "key"].includes(lowered)) {
    return true;
  }
  if (["false", "no", "0", "non-key", "nonkey"].includes(lowered) || !value) {
    return false;
  }
  return null;
}

function parseScale(value: string): number | null {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 5) {
    return null;
  }
  return parsed;
}

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function resolveNamed(
  value: string,
  directory: Array<{ id: string; name: string }>,
  field: string,
  row: number,
): { id: string | null; issues: ImportIssue[] } {
  if (!value) {
    return { id: null, issues: [] };
  }

  const needle = value.toLowerCase();
  const matches = directory.filter(
    (item) => item.name.trim().toLowerCase() === needle,
  );

  if (matches.length === 1) {
    return { id: matches[0].id, issues: [] };
  }

  if (matches.length === 0) {
    return {
      id: null,
      issues: [
        {
          row,
          field,
          level: "error",
          message: `Unknown ${field} “${value}”.`,
        },
      ],
    };
  }

  return {
    id: null,
    issues: [
      {
        row,
        field,
        level: "error",
        message: `Ambiguous ${field} “${value}” matches ${matches.length} records.`,
      },
    ],
  };
}

export function validateImport(input: {
  kind: ImportKind;
  csvText: string;
  existingTitles: string[];
  existingEmails?: string[];
  categories: Array<{ id: string; name: string }>;
  people: Array<{ id: string; name: string; email: string }>;
}): ValidatedImportRow[] {
  const required = IMPORT_TEMPLATES[input.kind].headers;
  const { headers, records } = csvToObjects(parseCsv(input.csvText));
  const missingHeaders = required.filter(
    (header) => !headers.includes(header),
  );

  if (missingHeaders.length > 0) {
    return [
      {
        row: 1,
        values: {},
        payload: {},
        issues: [
          {
            row: 1,
            field: "headers",
            level: "error",
            message: `Missing columns: ${missingHeaders.join(", ")}.`,
          },
        ],
      },
    ];
  }

  const existing = new Set(
    input.existingTitles.map((title) => title.trim().toLowerCase()),
  );
  const existingEmails = new Set(
    (input.existingEmails ?? []).map((email) => email.trim().toLowerCase()),
  );
  const seenInFile = new Map<string, number>();
  const seenEmails = new Map<string, number>();

  return records.map((values, index) => {
    const row = index + 2;
    const issues: ImportIssue[] = [];
    const payload: Record<string, unknown> = {};
    const titleKey = (values.title || values.name || "").trim().toLowerCase();

    function requireText(field: string) {
      const value = values[field] ?? "";
      if (!value) {
        issues.push({
          row,
          field,
          level: "error",
          message: `${field} is required.`,
        });
      }
      return value;
    }

    if (input.kind === "risks") {
      payload.title = requireText("title");
      payload.description = values.description ?? "";
      const likelihood = parseScale(values.likelihood);
      const impact = parseScale(values.impact);
      if (likelihood == null) {
        issues.push({
          row,
          field: "likelihood",
          level: "error",
          message: "Likelihood must be an integer 1–5.",
        });
      } else {
        payload.likelihood = likelihood;
      }
      if (impact == null) {
        issues.push({
          row,
          field: "impact",
          level: "error",
          message: "Impact must be an integer 1–5.",
        });
      } else {
        payload.impact = impact;
      }
      const treatment = inList(values.treatment || "mitigate", TREATMENTS);
      if (!treatment) {
        issues.push({
          row,
          field: "treatment",
          level: "error",
          message: "Treatment must be mitigate, accept, transfer, or avoid.",
        });
      } else {
        payload.treatment = treatment;
      }
      const status = inList(values.status || "open", RISK_STATUSES);
      if (!status) {
        issues.push({
          row,
          field: "status",
          level: "error",
          message: "Status must be open, monitoring, or closed.",
        });
      } else {
        payload.status = status;
      }
      const category = resolveNamed(
        values.category ?? "",
        input.categories,
        "category",
        row,
      );
      issues.push(...category.issues);
      payload.category_id = category.id;
      const assignee = resolveNamed(
        values.assignee ?? "",
        input.people,
        "assignee",
        row,
      );
      issues.push(...assignee.issues);
      payload.assignee_id = assignee.id;
    }

    if (input.kind === "controls") {
      payload.title = requireText("title");
      payload.description = values.description ?? "";
      const isKey = parseBool(values.is_key ?? "");
      if (isKey == null) {
        issues.push({
          row,
          field: "is_key",
          level: "error",
          message: "is_key must be true or false.",
        });
      } else {
        payload.is_key = isKey;
      }
      const effectiveness = inList(
        values.effectiveness || "not_tested",
        EFFECTIVENESS,
      );
      if (!effectiveness) {
        issues.push({
          row,
          field: "effectiveness",
          level: "error",
          message: "effectiveness must be effective, ineffective, or not_tested.",
        });
      } else {
        payload.effectiveness = effectiveness;
      }
      const controlType = inList(
        values.control_type || "preventive",
        CONTROL_TYPES,
      );
      if (!controlType) {
        issues.push({
          row,
          field: "control_type",
          level: "error",
          message: "control_type must be preventive, detective, or corrective.",
        });
      } else {
        payload.control_type = controlType;
      }
      const assignee = resolveNamed(
        values.assignee ?? "",
        input.people,
        "assignee",
        row,
      );
      issues.push(...assignee.issues);
      payload.assignee_id = assignee.id;
    }

    if (input.kind === "incidents") {
      payload.title = requireText("title");
      payload.description = values.description ?? "";
      if (!isIsoDate(values.date_occurred ?? "")) {
        issues.push({
          row,
          field: "date_occurred",
          level: "error",
          message: "date_occurred must be YYYY-MM-DD.",
        });
      } else {
        payload.date_occurred = values.date_occurred;
      }
      const severity = inList(values.severity || "", SEVERITIES);
      if (!severity) {
        issues.push({
          row,
          field: "severity",
          level: "error",
          message: "severity must be low, medium, high, or critical.",
        });
      } else {
        payload.severity = severity;
      }
      const status = inList(values.status || "open", INCIDENT_STATUSES);
      if (!status) {
        issues.push({
          row,
          field: "status",
          level: "error",
          message: "status must be open, investigating, or resolved.",
        });
      } else {
        payload.status = status;
      }
      payload.root_cause = values.root_cause ?? "";
      const assignee = resolveNamed(
        values.assignee ?? "",
        input.people,
        "assignee",
        row,
      );
      issues.push(...assignee.issues);
      payload.assignee_id = assignee.id;
    }

    if (input.kind === "issues") {
      payload.title = requireText("title");
      payload.description = values.description ?? "";
      const source = inList(values.source || "", ISSUE_SOURCES);
      if (!source) {
        issues.push({
          row,
          field: "source",
          level: "error",
          message: "source is not a known issue source.",
        });
      } else {
        payload.source = source;
      }
      const severity = inList(
        values.severity || "",
        SEVERITIES as IssueSeverity[],
      );
      if (!severity) {
        issues.push({
          row,
          field: "severity",
          level: "error",
          message: "severity must be low, medium, high, or critical.",
        });
      } else {
        payload.severity = severity;
      }
      const status = inList(values.status || "open", ISSUE_STATUSES);
      if (!status) {
        issues.push({
          row,
          field: "status",
          level: "error",
          message: "status must be open, in_progress, pending_review, or closed.",
        });
      } else {
        payload.status = status;
      }
      if (values.identified_at && !isIsoDate(values.identified_at)) {
        issues.push({
          row,
          field: "identified_at",
          level: "error",
          message: "identified_at must be YYYY-MM-DD.",
        });
      } else {
        payload.identified_at = values.identified_at || null;
      }
      if (values.due_date && !isIsoDate(values.due_date)) {
        issues.push({
          row,
          field: "due_date",
          level: "error",
          message: "due_date must be YYYY-MM-DD.",
        });
      } else {
        payload.due_date = values.due_date || null;
      }
      payload.root_cause = values.root_cause ?? "";
      payload.remediation_plan = values.remediation_plan ?? "";
      payload.closure_notes = "";
      const assignee = resolveNamed(
        values.assignee ?? "",
        input.people,
        "assignee",
        row,
      );
      issues.push(...assignee.issues);
      payload.assignee_id = assignee.id;
    }

    if (input.kind === "people") {
      payload.name = requireText("name");
      payload.email = requireText("email").toLowerCase();
      if (payload.email && !String(payload.email).includes("@")) {
        issues.push({
          row,
          field: "email",
          level: "error",
          message: "email must include @.",
        });
      }
      const emailKey = String(payload.email ?? "").toLowerCase();
      if (emailKey && existingEmails.has(emailKey)) {
        issues.push({
          row,
          field: "email",
          level: "error",
          message: `Likely duplicate of an existing person with email “${values.email}”.`,
        });
      }
      const firstEmail = seenEmails.get(emailKey);
      if (emailKey && firstEmail) {
        issues.push({
          row,
          field: "email",
          level: "error",
          message: `Duplicate of row ${firstEmail} in this file.`,
        });
      } else if (emailKey) {
        seenEmails.set(emailKey, row);
      }
      payload.title = values.title ?? "";
      payload.department = values.department ?? "";
      const lod = inList(values.line_of_defence || "first", LOD);
      if (!lod) {
        issues.push({
          row,
          field: "line_of_defence",
          level: "error",
          message: "line_of_defence must be first, second, or third.",
        });
      } else {
        payload.line_of_defence = lod;
      }
    }

    if (input.kind === "taxonomy") {
      payload.name = requireText("name");
      payload.description = values.description ?? "";
      const band = inList(values.appetite_band || "High", BANDS);
      if (!band) {
        issues.push({
          row,
          field: "appetite_band",
          level: "error",
          message: "appetite_band must be Low, Medium, High, or Critical.",
        });
      } else {
        payload.appetite_band = band;
      }
    }

    if (titleKey) {
      if (existing.has(titleKey)) {
        issues.push({
          row,
          field: input.kind === "people" || input.kind === "taxonomy" ? "name" : "title",
          level: "error",
          message: `Likely duplicate of an existing record named “${values.title || values.name}”.`,
        });
      }
      const first = seenInFile.get(titleKey);
      if (first) {
        issues.push({
          row,
          field: input.kind === "people" || input.kind === "taxonomy" ? "name" : "title",
          level: "error",
          message: `Duplicate of row ${first} in this file.`,
        });
      } else {
        seenInFile.set(titleKey, row);
      }
    }

    return { row, values, payload, issues };
  });
}

export function importHasErrors(rows: ValidatedImportRow[]) {
  return rows.some((row) =>
    row.issues.some((issue) => issue.level === "error"),
  );
}

export function flattenImportIssues(rows: ValidatedImportRow[]) {
  return rows.flatMap((row) => row.issues);
}

export function importTableName(kind: ImportKind) {
  if (kind === "taxonomy") {
    return "risk_categories";
  }
  if (kind === "people") {
    return "org_people";
  }
  return kind;
}

export function shapeImportPayload(
  kind: ImportKind,
  payload: Record<string, unknown>,
  options: {
    schemaReady: boolean;
    enterpriseReady: boolean;
    operatingReady: boolean;
  },
) {
  const next = { ...payload };

  if (kind === "risks") {
    if (!options.schemaReady) {
      delete next.category_id;
      delete next.treatment;
    }
    if (!options.enterpriseReady) {
      delete next.assignee_id;
      delete next.status;
    }
  }

  if (kind === "controls") {
    if (!options.enterpriseReady) {
      delete next.assignee_id;
      delete next.control_type;
    }
  }

  if (kind === "incidents") {
    if (!options.enterpriseReady) {
      delete next.assignee_id;
    }
    if (next.status === "resolved") {
      next.resolved_at = new Date().toISOString();
    }
  }

  if (kind === "issues" && !options.enterpriseReady) {
    delete next.assignee_id;
  }

  if (kind === "taxonomy") {
    next.sort_order = 0;
    if (!options.enterpriseReady) {
      delete next.appetite_band;
    }
  }

  return next;
}
