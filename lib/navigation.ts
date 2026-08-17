export type WorkspaceModuleId =
  | "home"
  | "work"
  | "horizon"
  | "lines"
  | "board"
  | "oversight"
  | "risks"
  | "controls"
  | "incidents"
  | "issues"
  | "obligations"
  | "evidence"
  | "quality"
  | "rcsa"
  | "admin";

export type NavigationItem = {
  module: WorkspaceModuleId;
  href: string;
  label: string;
};

export type NavigationSection = {
  label: string;
  items: NavigationItem[];
};

export type StaticCommand = {
  module: WorkspaceModuleId;
  label: string;
  href: string;
  keywords: string;
};

export const NAVIGATION_SECTIONS: NavigationSection[] = [
  {
    label: "Overview",
    items: [
      { module: "home", href: "/", label: "Home" },
      { module: "work", href: "/work", label: "My work" },
      { module: "horizon", href: "/horizon", label: "Horizon" },
      { module: "lines", href: "/lines", label: "Lines of defence" },
      { module: "board", href: "/board", label: "Board pack" },
      { module: "oversight", href: "/oversight", label: "Oversight" },
      { module: "quality", href: "/quality", label: "Data quality" },
    ],
  },
  {
    label: "Registers",
    items: [
      { module: "risks", href: "/risks", label: "Risks" },
      { module: "controls", href: "/controls", label: "Controls" },
      { module: "incidents", href: "/incidents", label: "Incidents" },
      { module: "issues", href: "/issues", label: "Issues" },
      { module: "obligations", href: "/obligations", label: "Obligations" },
      { module: "evidence", href: "/evidence", label: "Evidence" },
    ],
  },
  {
    label: "Assessment",
    items: [
      { module: "rcsa", href: "/rcsa/start", label: "Risk Assessment" },
    ],
  },
  {
    label: "Administration",
    items: [{ module: "admin", href: "/admin", label: "Settings" }],
  },
];

export const STATIC_COMMANDS: StaticCommand[] = [
  {
    module: "home",
    label: "Home",
    href: "/",
    keywords: "dashboard attention",
  },
  {
    module: "work",
    label: "My work",
    href: "/work",
    keywords: "assigned me queue",
  },
  {
    module: "horizon",
    label: "Operating horizon",
    href: "/horizon",
    keywords: "calendar due overdue review test",
  },
  {
    module: "horizon",
    label: "Overdue obligations",
    href: "/horizon?bucket=overdue",
    keywords: "due now cadence",
  },
  {
    module: "lines",
    label: "Lines of defence",
    href: "/lines",
    keywords: "3lod first second third workload",
  },
  {
    module: "board",
    label: "Board pack",
    href: "/board",
    keywords: "committee pack print csv appetite",
  },
  {
    module: "risks",
    label: "High or Critical risks",
    href: "/risks?severity=High,Critical",
    keywords: "severe exposure",
  },
  {
    module: "risks",
    label: "Risk register",
    href: "/risks",
    keywords: "risks",
  },
  {
    module: "risks",
    label: "Risks due for review",
    href: "/risks?reviewRecency=due",
    keywords: "stale overdue rcsa",
  },
  {
    module: "risks",
    label: "Uncontrolled risks",
    href: "/risks?uncontrolled=true",
    keywords: "no controls",
  },
  {
    module: "risks",
    label: "Above appetite",
    href: "/risks?appetiteBreach=true",
    keywords: "appetite breach",
  },
  {
    module: "risks",
    label: "Assigned to me — risks",
    href: "/risks?assignee=me",
    keywords: "my risks",
  },
  {
    module: "controls",
    label: "Control register",
    href: "/controls",
    keywords: "controls",
  },
  {
    module: "controls",
    label: "Overdue controls",
    href: "/controls?testingStatus=Overdue",
    keywords: "testing",
  },
  {
    module: "controls",
    label: "Unmapped controls",
    href: "/controls?unmapped=true",
    keywords: "orphan",
  },
  {
    module: "controls",
    label: "Key controls",
    href: "/controls?isKey=true",
    keywords: "key",
  },
  {
    module: "incidents",
    label: "Incident register",
    href: "/incidents",
    keywords: "incidents",
  },
  {
    module: "incidents",
    label: "Open incidents",
    href: "/incidents?status=open,investigating",
    keywords: "open",
  },
  {
    module: "incidents",
    label: "Severe open incidents",
    href: "/incidents?status=open,investigating&severity=high,critical",
    keywords: "high critical",
  },
  {
    module: "issues",
    label: "Issue log",
    href: "/issues",
    keywords: "issues findings",
  },
  {
    module: "issues",
    label: "Overdue issues",
    href: "/issues?overdue=true",
    keywords: "remediation",
  },
  {
    module: "rcsa",
    label: "Start risk assessment",
    href: "/rcsa/start",
    keywords: "rcsa review",
  },
  {
    module: "oversight",
    label: "Oversight monitoring",
    href: "/oversight",
    keywords: "2lod second line",
  },
  {
    module: "admin",
    label: "Admin settings",
    href: "/admin",
    keywords: "admin organisation taxonomy cadence demo people",
  },
  {
    module: "quality",
    label: "Data quality",
    href: "/quality",
    keywords: "completeness gaps uncategorised unassigned",
  },
  {
    module: "obligations",
    label: "Obligations register",
    href: "/obligations",
    keywords: "compliance regulator citation",
  },
  {
    module: "evidence",
    label: "Evidence register",
    href: "/evidence",
    keywords: "artefact retention file",
  },
  {
    module: "admin",
    label: "Import CSV",
    href: "/admin/import",
    keywords: "onboarding csv upload portability",
  },
  {
    module: "risks",
    label: "Add risk",
    href: "/risks/new",
    keywords: "create",
  },
  {
    module: "controls",
    label: "Add control",
    href: "/controls/new",
    keywords: "create",
  },
  {
    module: "incidents",
    label: "Add incident",
    href: "/incidents/new",
    keywords: "create",
  },
  {
    module: "obligations",
    label: "Add obligation",
    href: "/obligations/new",
    keywords: "create compliance",
  },
  {
    module: "evidence",
    label: "Add evidence",
    href: "/evidence/new",
    keywords: "create artefact",
  },
];

export function isActiveNavigationPath(href: string, pathname: string) {
  if (href === "/") {
    return pathname === "/";
  }

  if (href.startsWith("/rcsa")) {
    return pathname.startsWith("/rcsa");
  }

  return pathname.startsWith(href);
}
