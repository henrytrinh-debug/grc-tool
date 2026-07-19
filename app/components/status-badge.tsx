import type { SeverityBand } from "@/lib/dashboard/analytics";
import type { Effectiveness } from "@/lib/types/control";
import type { IncidentStatus, Severity } from "@/lib/types/incident";

const baseClassName =
  "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium";

const severityBandClasses: Record<SeverityBand, string> = {
  Low: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  Medium: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  High: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
  Critical: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

const effectivenessClasses: Record<Effectiveness, string> = {
  effective:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  ineffective: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  not_tested: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

const testingStatusClasses: Record<string, string> = {
  "Never Tested":
    "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  Tested:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  Overdue: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

const incidentStatusClasses: Record<IncidentStatus, string> = {
  open: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
  investigating:
    "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  resolved:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
};

const incidentSeverityClasses: Record<Severity, string> = {
  low: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
  critical: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

type BadgeProps = {
  children: React.ReactNode;
  className: string;
};

function Badge({ children, className }: BadgeProps) {
  return <span className={`${baseClassName} ${className}`}>{children}</span>;
}

export function SeverityBandBadge({ band }: { band: SeverityBand }) {
  return <Badge className={severityBandClasses[band]}>{band}</Badge>;
}

export function EffectivenessBadge({
  effectiveness,
  label,
}: {
  effectiveness: Effectiveness;
  label: string;
}) {
  return (
    <Badge className={effectivenessClasses[effectiveness]}>{label}</Badge>
  );
}

export function TestingStatusBadge({ status }: { status: string }) {
  return (
    <Badge
      className={
        testingStatusClasses[status] ??
        "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
      }
    >
      {status}
    </Badge>
  );
}

export function IncidentStatusBadge({
  status,
  label,
}: {
  status: IncidentStatus;
  label: string;
}) {
  return <Badge className={incidentStatusClasses[status]}>{label}</Badge>;
}

export function IncidentSeverityBadge({
  severity,
  label,
}: {
  severity: Severity;
  label: string;
}) {
  return <Badge className={incidentSeverityClasses[severity]}>{label}</Badge>;
}

export function KeyBadge({ isKey }: { isKey: boolean }) {
  return (
    <Badge
      className={
        isKey
          ? "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300"
          : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
      }
    >
      {isKey ? "Key" : "Non-Key"}
    </Badge>
  );
}
