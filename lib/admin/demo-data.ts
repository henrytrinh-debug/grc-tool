import { getSupabaseClient } from "@/lib/supabase/client";
import { addDaysToIsoDate, todayIsoDate } from "@/lib/dates";
import type { DemoIds } from "@/lib/settings/defaults";
import { isMissingRelationError } from "@/lib/settings/store";
import type { LineOfDefence } from "@/lib/types/person";

type Owner = { id: string; email: string };

type SeedOptions = {
  includeEnterprise?: boolean;
  includeOperating?: boolean;
  includeObligations?: boolean;
  includeEvidence?: boolean;
};

function ownerFields(owner: Owner) {
  return { owner_id: owner.id, owner_email: owner.email };
}

function newId() {
  return crypto.randomUUID();
}

async function insertRows(table: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) {
    return;
  }

  const supabase = getSupabaseClient();
  const { error } = await supabase.from(table).insert(rows);

  if (error) {
    throw error;
  }
}

async function insertRowsOptional(table: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) {
    return;
  }

  const supabase = getSupabaseClient();
  const { error } = await supabase.from(table).insert(rows);

  if (error && !isMissingRelationError(error)) {
    throw error;
  }
}

/**
 * Inserts a coherent demonstration environment: people, taxonomy, scored
 * risks, mixed control testing, incidents, findings, and RCSA reviews.
 */
export async function seedDemonstrationData(
  owner: Owner,
  options: SeedOptions = {},
): Promise<DemoIds> {
  const includeEnterprise = Boolean(options.includeEnterprise);
  const includeOperating = Boolean(options.includeOperating);
  const includeObligations = Boolean(options.includeObligations);
  const includeEvidence = Boolean(options.includeEvidence);
  const today = todayIsoDate();
  const ids: DemoIds = {
    categoryIds: [],
    riskIds: [],
    controlIds: [],
    incidentIds: [],
    issueIds: [],
    sessionIds: [],
    personIds: [],
    obligationIds: [],
    evidenceIds: [],
  };

  const personSpecs: Array<{
    name: string;
    email: string;
    title: string;
    department: string;
    line_of_defence: LineOfDefence;
  }> = includeEnterprise
    ? [
        {
          name: "Account owner",
          email: owner.email,
          title: "Head of Operational Risk",
          department: "Risk",
          line_of_defence: "second",
        },
        {
          name: "Priya Shah",
          email: "priya.shah@demo.grc",
          title: "CISO",
          department: "Technology",
          line_of_defence: "first",
        },
        {
          name: "James Okonkwo",
          email: "james.okonkwo@demo.grc",
          title: "Payments Operations Lead",
          department: "Operations",
          line_of_defence: "first",
        },
        {
          name: "Elena Rossi",
          email: "elena.rossi@demo.grc",
          title: "Control Testing Manager",
          department: "Risk",
          line_of_defence: "second",
        },
        {
          name: "Tom Nguyen",
          email: "tom.nguyen@demo.grc",
          title: "Vendor Manager",
          department: "Procurement",
          line_of_defence: "first",
        },
        {
          name: "Amelia Clark",
          email: "amelia.clark@demo.grc",
          title: "Data Protection Officer",
          department: "Legal",
          line_of_defence: "second",
        },
        {
          name: "Marcus Hale",
          email: "marcus.hale@demo.grc",
          title: "Internal Audit Manager",
          department: "Internal Audit",
          line_of_defence: "third",
        },
        {
          name: "Sofia Berg",
          email: "sofia.berg@demo.grc",
          title: "Incident Response Lead",
          department: "Technology",
          line_of_defence: "first",
        },
        {
          name: "Hannah Cole",
          email: "hannah.cole@demo.grc",
          title: "Climate Risk Lead",
          department: "Risk",
          line_of_defence: "second",
        },
        {
          name: "Diego Alvarez",
          email: "diego.alvarez@demo.grc",
          title: "Records Manager",
          department: "Operations",
          line_of_defence: "first",
        },
      ]
    : [];

  ids.personIds = personSpecs.map(() => newId());
  if (includeEnterprise) {
    await insertRows(
      "org_people",
      personSpecs.map((spec, index) => ({
        id: ids.personIds![index],
        ...spec,
        ...ownerFields(owner),
      })),
    );
  }

  const people = ids.personIds;
  const assignee = (index: number) =>
    includeEnterprise ? (people[index % people.length] ?? null) : undefined;

  const categorySpecs = [
    {
      name: "Cybersecurity",
      description: "Confidentiality, integrity, and availability of systems and data.",
      appetite_band: "Medium",
    },
    {
      name: "Operational",
      description: "People, process, and change failures in day-to-day operations.",
      appetite_band: "High",
    },
    {
      name: "Financial",
      description: "Fraud, reporting error, and liquidity or payment disruption.",
      appetite_band: "Medium",
    },
    {
      name: "Compliance & Regulatory",
      description: "Obligations to regulators, customers, and applicable law.",
      appetite_band: "Low",
    },
    {
      name: "Third-Party",
      description: "Vendors, processors, and other external dependencies.",
      appetite_band: "Medium",
    },
    {
      name: "People & Conduct",
      description: "Workforce, culture, and customer-treatment outcomes.",
      appetite_band: "High",
    },
    {
      name: "Strategic",
      description: "Business model, change programmes, and market positioning.",
      appetite_band: "High",
    },
    {
      name: "Climate & ESG",
      description: "Physical climate, transition, and sustainability disclosures.",
      appetite_band: "Medium",
    },
    {
      name: "Data & Records",
      description: "Retention, quality, and lawful use of records and unstructured data.",
      appetite_band: "Low",
    },
    {
      name: "Technology Resilience",
      description: "Availability of core platforms, batch windows, and recoverability.",
      appetite_band: "Medium",
    },
    {
      name: "Legal",
      description: "Contractual rights, indemnities, and litigation exposure.",
      appetite_band: "Low",
    },
    {
      name: "Credit",
      description: "Concentration, underwriting quality, and limit breaches.",
      appetite_band: "Medium",
    },
  ] as const;

  ids.categoryIds = categorySpecs.map(() => newId());
  await insertRows(
    "risk_categories",
    categorySpecs.map((spec, index) => ({
      id: ids.categoryIds[index],
      name: spec.name,
      description: spec.description,
      sort_order: index,
      ...(includeEnterprise ? { appetite_band: spec.appetite_band } : {}),
      ...ownerFields(owner),
    })),
  );

  const [
    cyber,
    operational,
    financial,
    compliance,
    thirdParty,
    peopleCat,
    strategic,
    climate,
    dataRecords,
    techResilience,
    legal,
    credit,
  ] = ids.categoryIds;

  const riskSpecs: Array<{
    title: string;
    description: string;
    likelihood: number;
    impact: number;
    category_id: string | null;
    treatment: "mitigate" | "accept" | "transfer" | "avoid";
    status: "open" | "monitoring" | "closed";
    unassigned?: boolean;
  }> = [
    {
      title: "Ransomware interrupting customer operations",
      description:
        "A successful ransomware attack encrypts production systems and backup copies, stopping onboarding and payments.",
      likelihood: 4,
      impact: 5,
      category_id: cyber,
      treatment: "mitigate",
      status: "open",
    },
    {
      title: "Privileged access abuse",
      description:
        "Standing admin rights are used to alter records or exfiltrate data without detection.",
      likelihood: 3,
      impact: 5,
      category_id: cyber,
      treatment: "mitigate",
      status: "open",
    },
    {
      title: "Cloud misconfiguration exposing customer data",
      description:
        "A storage bucket or identity policy is left public, leaking personal data.",
      likelihood: 3,
      impact: 4,
      category_id: cyber,
      treatment: "mitigate",
      status: "open",
    },
    {
      title: "Payment fraud through compromised credentials",
      description:
        "Attackers initiate outbound payments using stolen finance-user credentials.",
      likelihood: 3,
      impact: 4,
      category_id: financial,
      treatment: "mitigate",
      status: "open",
    },
    {
      title: "Key-person dependency in change management",
      description:
        "A single engineer holds production-release knowledge; absence delays patches.",
      likelihood: 4,
      impact: 3,
      category_id: operational,
      treatment: "mitigate",
      status: "monitoring",
    },
    {
      title: "Regulatory reporting submitted late or incomplete",
      description:
        "Manual returns miss a filing window, attracting supervisory findings.",
      likelihood: 2,
      impact: 4,
      category_id: compliance,
      treatment: "mitigate",
      status: "open",
    },
    {
      title: "Critical vendor outage with no tested fallback",
      description:
        "The payments processor is unavailable and the documented workaround has never been exercised.",
      likelihood: 3,
      impact: 4,
      category_id: thirdParty,
      treatment: "transfer",
      status: "open",
    },
    {
      title: "Failed change introducing service outage",
      description:
        "An unreviewed production change takes customer-facing services offline.",
      likelihood: 3,
      impact: 3,
      category_id: operational,
      treatment: "mitigate",
      status: "open",
    },
    {
      title: "Personal data retained beyond policy",
      description:
        "Backups and archives keep customer records past the documented retention period.",
      likelihood: 2,
      impact: 3,
      category_id: compliance,
      treatment: "accept",
      status: "monitoring",
    },
    {
      title: "Business continuity plan untested",
      description:
        "The BC plan exists on paper but has not been exercised in the last year.",
      likelihood: 4,
      impact: 4,
      category_id: operational,
      treatment: "mitigate",
      status: "open",
    },
    {
      title: "Insider trading of non-public product roadmap",
      description:
        "Staff with early access to pricing changes trade or leak information.",
      likelihood: 2,
      impact: 5,
      category_id: peopleCat,
      treatment: "mitigate",
      status: "open",
    },
    {
      title: "Model risk in credit decisioning",
      description:
        "An undocumented champion/challenger swap degrades underwriting quality.",
      likelihood: 3,
      impact: 4,
      category_id: financial,
      treatment: "mitigate",
      status: "open",
    },
    {
      title: "Identity provider outage blocking staff access",
      description:
        "SSO unavailable for more than four hours, stopping servicing and change.",
      likelihood: 2,
      impact: 4,
      category_id: cyber,
      treatment: "mitigate",
      status: "open",
    },
    {
      title: "Incomplete customer complaints handling",
      description:
        "Complaints miss the regulatory clock and are not root-caused.",
      likelihood: 3,
      impact: 3,
      category_id: compliance,
      treatment: "mitigate",
      status: "open",
    },
    {
      title: "Cloud cost overrun from untagged workloads",
      description:
        "Shadow environments run without owners, distorting financial forecasts.",
      likelihood: 4,
      impact: 2,
      category_id: financial,
      treatment: "accept",
      status: "closed",
    },
    {
      title: "Fourth-party concentration in a critical SaaS chain",
      description:
        "Two material vendors share the same sub-processor with no contractual visibility.",
      likelihood: 3,
      impact: 4,
      category_id: thirdParty,
      treatment: "mitigate",
      status: "open",
    },
    {
      title: "Physical site unavailability after flooding",
      description:
        "The primary operations floor is inaccessible and the alternate site is not ready.",
      likelihood: 2,
      impact: 4,
      category_id: operational,
      treatment: "transfer",
      status: "open",
    },
    {
      title: "AI feature leaking confidential prompts",
      description:
        "A copilot integration sends customer data to an unapproved model endpoint.",
      likelihood: 3,
      impact: 4,
      category_id: cyber,
      treatment: "avoid",
      status: "open",
    },
    {
      title: "Conduct risk in incentive schemes",
      description:
        "Sales targets encourage unsuitable product sales to vulnerable customers.",
      likelihood: 3,
      impact: 4,
      category_id: peopleCat,
      treatment: "mitigate",
      status: "open",
    },
    {
      title: "Strategic programme overruns delaying control uplift",
      description:
        "The core-banking replacement slips, leaving known control gaps unaddressed.",
      likelihood: 4,
      impact: 3,
      category_id: strategic,
      treatment: "mitigate",
      status: "monitoring",
    },
    {
      title: "Treasury liquidity reporting error",
      description:
        "Manual spreadsheets misstate overnight positions used by ALCO.",
      likelihood: 2,
      impact: 5,
      category_id: financial,
      treatment: "mitigate",
      status: "open",
    },
    {
      title: "Endpoint malware on contractor laptops",
      description:
        "BYOD contractors connect to production jump hosts without EDR.",
      likelihood: 4,
      impact: 3,
      category_id: cyber,
      treatment: "mitigate",
      status: "open",
    },
    {
      title: "Incomplete staff screening for regulated roles",
      description:
        "Joiners start in certified roles before background checks complete.",
      likelihood: 3,
      impact: 3,
      category_id: peopleCat,
      treatment: "mitigate",
      status: "open",
    },
    {
      title: "API rate-limit bypass exposing customer PII",
      description:
        "An unauthenticated enumeration endpoint returns account identifiers.",
      likelihood: 3,
      impact: 4,
      category_id: cyber,
      treatment: "mitigate",
      status: "open",
    },
    {
      title: "Outdated sanctions screening list",
      description:
        "Daily list refresh failed silently for 11 days.",
      likelihood: 2,
      impact: 5,
      category_id: compliance,
      treatment: "mitigate",
      status: "open",
    },
    {
      title: "Board risk appetite not cascaded to product teams",
      description:
        "Product launches exceed documented appetite without an exception.",
      likelihood: 3,
      impact: 3,
      category_id: strategic,
      treatment: "mitigate",
      status: "open",
    },
    {
      title: "Physical climate damage to primary data centres",
      description:
        "Flood and heat scenarios for the two production sites are not in the ICAAP pack.",
      likelihood: 3,
      impact: 4,
      category_id: climate,
      treatment: "mitigate",
      status: "open",
    },
    {
      title: "Greenwashing in sustainability product claims",
      description:
        "Marketing claims exceed the evidence held for financed-emissions reductions.",
      likelihood: 3,
      impact: 3,
      category_id: climate,
      treatment: "mitigate",
      status: "open",
    },
    {
      title: "Chat and collaboration records outside the retention schedule",
      description:
        "Teams and Slack hold customer conversations that the records job never touches.",
      likelihood: 4,
      impact: 3,
      category_id: dataRecords,
      treatment: "mitigate",
      status: "open",
    },
    {
      title: "Core banking batch window overrun",
      description:
        "Overnight settlement regularly overruns into the servicing window.",
      likelihood: 3,
      impact: 4,
      category_id: techResilience,
      treatment: "mitigate",
      status: "open",
    },
    {
      title: "Contractual indemnity gap on material vendors",
      description:
        "Several critical contracts cap liability below the plausible operational loss.",
      likelihood: 3,
      impact: 4,
      category_id: legal,
      treatment: "mitigate",
      status: "open",
    },
    {
      title: "Credit concentration in a single wholesale sector",
      description:
        "One industry now exceeds the documented single-name and sector limits.",
      likelihood: 3,
      impact: 4,
      category_id: credit,
      treatment: "mitigate",
      status: "monitoring",
    },
    {
      title: "Shadow IT workflow without an owner",
      description:
        "A spreadsheet-based onboarding path is used by two teams and is not on any register.",
      likelihood: 3,
      impact: 3,
      category_id: null,
      treatment: "mitigate",
      status: "open",
      unassigned: true,
    },
    {
      title: "Low-value stationery and sundry theft",
      description:
        "Office supplies shrinkage is below materiality; no further control investment planned.",
      likelihood: 2,
      impact: 2,
      category_id: operational,
      treatment: "accept",
      status: "monitoring",
    },
  ];

  ids.riskIds = riskSpecs.map(() => newId());
  const riskOperating: Record<
    number,
    { treatment_rationale: string; target_date: string | null }
  > = {
    0: {
      treatment_rationale:
        "Contain blast radius and restore from immutable backups; acceptance is not available.",
      target_date: addDaysToIsoDate(today, 21),
    },
    6: {
      treatment_rationale:
        "Contractual transfer via SLA credits; fallback still untested so residual remains high.",
      target_date: addDaysToIsoDate(today, 45),
    },
    8: {
      treatment_rationale:
        "Accepted until the archive purge programme lands; legal has signed the exception.",
      target_date: addDaysToIsoDate(today, -14),
    },
    9: {
      treatment_rationale: "Mitigate by running a live BC exercise this quarter.",
      target_date: addDaysToIsoDate(today, -7),
    },
    14: {
      treatment_rationale: "Closed as accepted after tagging and budget controls landed.",
      target_date: null,
    },
    17: {
      treatment_rationale:
        "Avoid until DLP is in path; the pilot is paused pending a private endpoint.",
      target_date: addDaysToIsoDate(today, 30),
    },
  };

  await insertRows(
    "risks",
    riskSpecs.map((spec, index) => ({
      id: ids.riskIds[index],
      title: spec.title,
      description: spec.description,
      likelihood: spec.likelihood,
      impact: spec.impact,
      category_id: spec.category_id,
      treatment: spec.treatment,
      ...(includeEnterprise
        ? {
            status: spec.status,
            assignee_id: spec.unassigned ? null : assignee(index),
          }
        : {}),
      ...(includeOperating
        ? {
            treatment_rationale: riskOperating[index]?.treatment_rationale ?? "",
            target_date: riskOperating[index]?.target_date ?? null,
          }
        : {}),
      ...ownerFields(owner),
    })),
  );

  const controlSpecs: Array<{
    title: string;
    description: string;
    is_key: boolean;
    effectiveness: "effective" | "ineffective" | "not_tested";
    last_tested_at: string | null;
    control_type: "preventive" | "detective" | "corrective";
  }> = [
    {
      title: "Privileged access review",
      description: "Quarterly recertification of standing admin accounts.",
      is_key: true,
      effectiveness: "ineffective",
      last_tested_at: addDaysToIsoDate(today, -40),
      control_type: "detective",
    },
    {
      title: "Immutable backups with restore test",
      description: "Offline backups restored in a tabletop and technical test.",
      is_key: true,
      effectiveness: "effective",
      last_tested_at: addDaysToIsoDate(today, -20),
      control_type: "corrective",
    },
    {
      title: "MFA on remote and privileged access",
      description: "Phishing-resistant MFA for VPN, SSO, and admin consoles.",
      is_key: true,
      effectiveness: "effective",
      last_tested_at: addDaysToIsoDate(today, -60),
      control_type: "preventive",
    },
    {
      title: "Cloud posture scanning",
      description: "Daily misconfiguration scan of production cloud accounts.",
      is_key: true,
      effectiveness: "not_tested",
      last_tested_at: null,
      control_type: "detective",
    },
    {
      title: "Dual approval for payments above threshold",
      description: "Second approver required for outbound payments.",
      is_key: true,
      effectiveness: "effective",
      last_tested_at: addDaysToIsoDate(today, -15),
      control_type: "preventive",
    },
    {
      title: "Vendor due diligence and SLA monitoring",
      description: "Onboarding review plus monthly SLA dashboard for critical vendors.",
      is_key: false,
      effectiveness: "not_tested",
      last_tested_at: null,
      control_type: "preventive",
    },
    {
      title: "Change advisory board",
      description: "Weekly CAB for production changes with rollback criteria.",
      is_key: false,
      effectiveness: "effective",
      last_tested_at: addDaysToIsoDate(today, -400),
      control_type: "preventive",
    },
    {
      title: "Data retention job",
      description: "Automated purge aligned to the records schedule.",
      is_key: false,
      effectiveness: "ineffective",
      last_tested_at: addDaysToIsoDate(today, -90),
      control_type: "corrective",
    },
    {
      title: "EDR coverage on endpoints",
      description: "Managed detection on staff and contractor devices.",
      is_key: true,
      effectiveness: "effective",
      last_tested_at: addDaysToIsoDate(today, -25),
      control_type: "detective",
    },
    {
      title: "Sanctions list refresh",
      description: "Daily automated ingest of the consolidated screening list.",
      is_key: true,
      effectiveness: "ineffective",
      last_tested_at: addDaysToIsoDate(today, -12),
      control_type: "preventive",
    },
    {
      title: "Model validation checklist",
      description: "Independent validation before champion models go live.",
      is_key: true,
      effectiveness: "not_tested",
      last_tested_at: null,
      control_type: "preventive",
    },
    {
      title: "Complaints SLA dashboard",
      description: "Daily ageing of open complaints against the regulatory clock.",
      is_key: false,
      effectiveness: "effective",
      last_tested_at: addDaysToIsoDate(today, -45),
      control_type: "detective",
    },
    {
      title: "SSO resiliency runbook",
      description: "Break-glass access and IdP failover documented and tested.",
      is_key: true,
      effectiveness: "not_tested",
      last_tested_at: null,
      control_type: "corrective",
    },
    {
      title: "AI data-loss prevention",
      description: "Prompt and output filters for approved model endpoints.",
      is_key: true,
      effectiveness: "ineffective",
      last_tested_at: addDaysToIsoDate(today, -18),
      control_type: "preventive",
    },
    {
      title: "Joiner screening gate",
      description: "HRIS blocks regulated-role access until checks complete.",
      is_key: false,
      effectiveness: "effective",
      last_tested_at: addDaysToIsoDate(today, -70),
      control_type: "preventive",
    },
    {
      title: "Incentive scheme review",
      description: "Annual conduct review of sales targets and quality metrics.",
      is_key: false,
      effectiveness: "not_tested",
      last_tested_at: null,
      control_type: "detective",
    },
    {
      title: "ALCO pack reconciliation",
      description: "System-to-system check of overnight liquidity figures.",
      is_key: true,
      effectiveness: "effective",
      last_tested_at: addDaysToIsoDate(today, -8),
      control_type: "detective",
    },
    {
      title: "API authentication and rate limiting",
      description: "Gateway enforces authn, authz, and burst limits.",
      is_key: true,
      effectiveness: "ineffective",
      last_tested_at: addDaysToIsoDate(today, -30),
      control_type: "preventive",
    },
    {
      title: "Alternate-site readiness checklist",
      description: "Quarterly walkthrough of the disaster-recovery floor.",
      is_key: false,
      effectiveness: "not_tested",
      last_tested_at: null,
      control_type: "corrective",
    },
    {
      title: "Fourth-party mapping",
      description: "Material subcontractors recorded in the vendor inventory.",
      is_key: false,
      effectiveness: "effective",
      last_tested_at: addDaysToIsoDate(today, -100),
      control_type: "detective",
    },
    {
      title: "Product appetite exception log",
      description: "Documented exceptions when launches exceed appetite.",
      is_key: false,
      effectiveness: "not_tested",
      last_tested_at: null,
      control_type: "preventive",
    },
    {
      title: "BC exercise programme",
      description: "Annual technical failover plus a departmental tabletop.",
      is_key: true,
      effectiveness: "ineffective",
      last_tested_at: addDaysToIsoDate(today, -380),
      control_type: "detective",
    },
    {
      title: "Climate scenario in the ICAAP pack",
      description: "Physical and transition scenarios for material sites and portfolios.",
      is_key: true,
      effectiveness: "not_tested",
      last_tested_at: null,
      control_type: "detective",
    },
    {
      title: "Sustainability claims evidence pack",
      description: "Second-line review of public ESG claims against source data.",
      is_key: false,
      effectiveness: "not_tested",
      last_tested_at: null,
      control_type: "preventive",
    },
    {
      title: "Collaboration-tool retention job",
      description: "Export and purge of Slack/Teams aligned to the records schedule.",
      is_key: false,
      effectiveness: "ineffective",
      last_tested_at: addDaysToIsoDate(today, -200),
      control_type: "corrective",
    },
    {
      title: "Overnight batch monitoring",
      description: "Paging when core settlement overruns the servicing window.",
      is_key: true,
      effectiveness: "effective",
      last_tested_at: addDaysToIsoDate(today, -12),
      control_type: "detective",
    },
    {
      title: "Material-vendor indemnity review",
      description: "Legal review of liability caps on critical contracts.",
      is_key: false,
      effectiveness: "not_tested",
      last_tested_at: null,
      control_type: "preventive",
    },
    {
      title: "Sector concentration limits",
      description: "Automated breach alerts against documented wholesale sector caps.",
      is_key: true,
      effectiveness: "effective",
      last_tested_at: addDaysToIsoDate(today, -35),
      control_type: "detective",
    },
    {
      title: "Standalone wiki password policy",
      description: "Local password rules on an unmanaged wiki that is not mapped to a risk.",
      is_key: false,
      effectiveness: "not_tested",
      last_tested_at: null,
      control_type: "preventive",
    },
  ];

  ids.controlIds = controlSpecs.map(() => newId());
  await insertRows(
    "controls",
    controlSpecs.map((spec, index) => ({
      id: ids.controlIds[index],
      title: spec.title,
      description: spec.description,
      is_key: spec.is_key,
      effectiveness: spec.effectiveness,
      last_tested_at: spec.last_tested_at,
      ...(includeEnterprise
        ? {
            control_type: spec.control_type,
            assignee_id: assignee(index + 1),
          }
        : {}),
      ...ownerFields(owner),
    })),
  );

  const riskControlPairs: Array<[number, number]> = [
    [0, 1],
    [0, 2],
    [0, 8],
    [1, 0],
    [1, 2],
    [2, 3],
    [3, 4],
    [4, 6],
    [6, 5],
    [7, 6],
    [8, 7],
    [9, 21],
    [10, 15],
    [11, 10],
    [12, 12],
    [13, 11],
    [15, 19],
    [16, 18],
    [17, 13],
    [18, 15],
    [20, 16],
    [21, 8],
    [22, 14],
    [23, 17],
    [24, 9],
    [25, 20],
    [26, 22],
    [27, 23],
    [28, 24],
    [29, 25],
    [30, 26],
    [31, 27],
    [33, 4],
  ];

  await insertRows(
    "risk_controls",
    riskControlPairs.map(([riskIndex, controlIndex]) => ({
      risk_id: ids.riskIds[riskIndex],
      control_id: ids.controlIds[controlIndex],
      owner_id: owner.id,
    })),
  );

  const testNotes = controlSpecs
    .map((spec, controlIndex) => {
      if (!spec.last_tested_at) {
        return null;
      }

      return {
        control_id: ids.controlIds[controlIndex],
        effectiveness:
          spec.effectiveness === "not_tested" ? "ineffective" : spec.effectiveness,
        tested_at: spec.last_tested_at,
        notes:
          spec.effectiveness === "ineffective"
            ? `Sample failed for ${spec.title.toLowerCase()}. Remediation in flight.`
            : `Sample passed for ${spec.title.toLowerCase()}. Evidence filed.`,
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  await insertRows(
    "control_test_results",
    testNotes.map((test) => ({
      ...test,
      ...ownerFields(owner),
    })),
  );

  const incidentSpecs: Array<{
    title: string;
    description: string;
    daysAgo: number;
    severity: "low" | "medium" | "high" | "critical";
    status: "open" | "investigating" | "resolved";
    root_cause: string;
    resolvedDaysAgo?: number;
    riskIndex: number;
  }> = [
    {
      title: "Attempted ransomware on a jump host",
      description:
        "EDR contained an encrypting payload on a privileged jump host before lateral movement.",
      daysAgo: 12,
      severity: "critical",
      status: "investigating",
      root_cause: "Phished VPN credentials reused on the jump host.",
      riskIndex: 0,
    },
    {
      title: "Duplicate supplier payment",
      description: "A weekend payment run submitted the same file twice.",
      daysAgo: 80,
      severity: "medium",
      status: "resolved",
      root_cause: "No file-hash check before release.",
      resolvedDaysAgo: 60,
      riskIndex: 3,
    },
    {
      title: "Public S3 bucket detected by researcher",
      description: "A staging bucket with customer exports was world-readable for six hours.",
      daysAgo: 5,
      severity: "high",
      status: "open",
      root_cause: "Terraform default ACL not overridden.",
      riskIndex: 2,
    },
    {
      title: "Sanctions screening outage",
      description: "Daily list ingest failed; payments released against a stale list.",
      daysAgo: 11,
      severity: "critical",
      status: "investigating",
      root_cause: "Job credential expired and alerts were muted.",
      riskIndex: 24,
    },
    {
      title: "Customer API enumeration",
      description: "External tester walked account IDs without authentication.",
      daysAgo: 21,
      severity: "high",
      status: "investigating",
      root_cause: "Rate limit bound to session rather than IP.",
      riskIndex: 23,
    },
    {
      title: "Contractor laptop malware",
      description: "A BYOD device connected to a jump host with a known trojan.",
      daysAgo: 18,
      severity: "high",
      status: "open",
      root_cause: "No EDR mandate for contractors.",
      riskIndex: 21,
    },
    {
      title: "IdP brownout",
      description: "SSO latency exceeded 30 seconds for 90 minutes during a region event.",
      daysAgo: 40,
      severity: "medium",
      status: "resolved",
      root_cause: "No secondary region configured.",
      resolvedDaysAgo: 38,
      riskIndex: 12,
    },
    {
      title: "Prompt leakage to an unapproved model",
      description: "A pilot copilot sent case notes to a public endpoint.",
      daysAgo: 9,
      severity: "high",
      status: "open",
      root_cause: "SDK defaulted to the vendor's public model.",
      riskIndex: 17,
    },
    {
      title: "Complaints clock breach",
      description: "Fourteen complaints exceeded the eight-week limit.",
      daysAgo: 6,
      severity: "medium",
      status: "investigating",
      root_cause: "Dashboard excluded a migrated queue.",
      riskIndex: 13,
    },
    {
      title: "Vendor processor outage",
      description: "Card acquiring was unavailable for 3 hours on a Friday peak.",
      daysAgo: 27,
      severity: "high",
      status: "resolved",
      root_cause: "Vendor change without customer notification.",
      resolvedDaysAgo: 26,
      riskIndex: 6,
    },
    {
      title: "ALCO pack mismatch",
      description: "Overnight liquidity in the pack differed from the source system by £12m.",
      daysAgo: 3,
      severity: "critical",
      status: "open",
      root_cause: "Manual paste missed a sheet.",
      riskIndex: 20,
    },
    {
      title: "Joiner started before screening completed",
      description: "A payments operations joiner received production access on day one.",
      daysAgo: 15,
      severity: "medium",
      status: "resolved",
      root_cause: "HRIS gate bypassed for a contractor conversion.",
      resolvedDaysAgo: 10,
      riskIndex: 22,
    },
    {
      title: "Coastal data-centre flood watch",
      description:
        "A flood warning closed the primary site access road for six hours; failover was not invoked.",
      daysAgo: 4,
      severity: "medium",
      status: "investigating",
      root_cause: "Scenario playbook did not include site-access loss.",
      riskIndex: 26,
    },
  ];

  ids.incidentIds = incidentSpecs.map(() => newId());
  const incidentOperating: Record<
    number,
    { lessons_learned: string; controlIndexes: number[] }
  > = {
    0: {
      lessons_learned: "",
      controlIndexes: [0, 1, 2],
    },
    1: {
      lessons_learned:
        "File-hash uniqueness is now checked before release; weekend runs require dual approval.",
      controlIndexes: [4],
    },
    2: {
      lessons_learned: "",
      controlIndexes: [3],
    },
    3: {
      lessons_learned: "",
      controlIndexes: [9],
    },
    4: {
      lessons_learned: "",
      controlIndexes: [17],
    },
    5: {
      lessons_learned: "",
      controlIndexes: [8],
    },
    6: {
      lessons_learned:
        "SSO now fails over to a second region; latency alerts page the identity team.",
      controlIndexes: [12],
    },
    7: {
      lessons_learned: "",
      controlIndexes: [13],
    },
    9: {
      lessons_learned:
        "Vendor changes require customer notification and a tested workaround before go-live.",
      controlIndexes: [5],
    },
    10: {
      lessons_learned: "",
      controlIndexes: [16],
    },
    11: {
      lessons_learned:
        "Contractor conversions cannot bypass the screening gate; HRIS now blocks day-one access.",
      controlIndexes: [14],
    },
    12: {
      lessons_learned: "",
      controlIndexes: [22],
    },
  };

  await insertRows(
    "incidents",
    incidentSpecs.map((spec, index) => ({
      id: ids.incidentIds[index],
      title: spec.title,
      description: spec.description,
      date_occurred: addDaysToIsoDate(today, -spec.daysAgo),
      severity: spec.severity,
      status: spec.status,
      root_cause: spec.root_cause,
      resolved_at:
        spec.resolvedDaysAgo !== undefined
          ? new Date(
              Date.now() - spec.resolvedDaysAgo * 24 * 60 * 60 * 1000,
            ).toISOString()
          : null,
      ...(includeEnterprise ? { assignee_id: assignee(index + 2) } : {}),
      ...(includeOperating
        ? { lessons_learned: incidentOperating[index]?.lessons_learned ?? "" }
        : {}),
      ...ownerFields(owner),
    })),
  );

  await insertRows(
    "incident_risks",
    incidentSpecs.map((spec, index) => ({
      incident_id: ids.incidentIds[index],
      risk_id: ids.riskIds[spec.riskIndex],
      owner_id: owner.id,
    })),
  );

  if (includeOperating) {
    await insertRows(
      "incident_controls",
      Object.entries(incidentOperating).flatMap(([index, spec]) =>
        spec.controlIndexes.map((controlIndex) => ({
          incident_id: ids.incidentIds[Number(index)],
          control_id: ids.controlIds[controlIndex],
          owner_id: owner.id,
        })),
      ),
    );
  }

  const issueSpecs: Array<{
    title: string;
    description: string;
    source:
      | "internal_audit"
      | "external_audit"
      | "regulatory_exam"
      | "control_failure"
      | "incident"
      | "risk_assessment"
      | "self_identified";
    severity: "low" | "medium" | "high" | "critical";
    status: "open" | "in_progress" | "pending_review" | "closed";
    identifiedDaysAgo: number;
    dueInDays: number;
    root_cause: string;
    remediation_plan: string;
    riskIndex?: number;
    controlIndex?: number;
  }> = [
    {
      title: "Privileged access recertification overdue",
      description:
        "Quarterly recertification of admin accounts was skipped; 12 accounts have no current owner.",
      source: "control_failure",
      severity: "high",
      status: "in_progress",
      identifiedDaysAgo: 50,
      dueInDays: -10,
      root_cause: "The recertification owner left and the control had no deputy.",
      remediation_plan:
        "Reassign ownership, complete recert, and revoke orphaned accounts.",
      riskIndex: 1,
      controlIndex: 0,
    },
    {
      title: "Cloud posture scanning never commissioned",
      description:
        "The CSPM tool is licensed but not connected to production accounts.",
      source: "risk_assessment",
      severity: "high",
      status: "open",
      identifiedDaysAgo: 8,
      dueInDays: 22,
      root_cause: "",
      remediation_plan: "",
      riskIndex: 2,
      controlIndex: 3,
    },
    {
      title: "Archive purge job failing silently",
      description:
        "Retention control does not delete from the archive schema; records exceed policy.",
      source: "internal_audit",
      severity: "medium",
      status: "pending_review",
      identifiedDaysAgo: 70,
      dueInDays: 5,
      root_cause: "Job scoped only to the live schema.",
      remediation_plan: "Extend the job, backfill deletions, and retest.",
      riskIndex: 8,
      controlIndex: 7,
    },
    {
      title: "Sanctions ingest credentials expired",
      description: "Daily list refresh failed for 11 days without a paging alert.",
      source: "incident",
      severity: "critical",
      status: "in_progress",
      identifiedDaysAgo: 11,
      dueInDays: -2,
      root_cause: "Secret rotation skipped the screening service account.",
      remediation_plan: "Rotate credentials, restore ingest, and add a heartbeat alert.",
      riskIndex: 24,
      controlIndex: 9,
    },
    {
      title: "Unauthenticated account enumeration",
      description: "Public API returns whether an account id exists.",
      source: "external_audit",
      severity: "high",
      status: "open",
      identifiedDaysAgo: 21,
      dueInDays: 9,
      root_cause: "Authn check applied after the lookup.",
      remediation_plan: "Move authn to the gateway and add rate limits.",
      riskIndex: 23,
      controlIndex: 17,
    },
    {
      title: "Contractor EDR gap",
      description: "BYOD contractors can reach production jump hosts without EDR.",
      source: "self_identified",
      severity: "high",
      status: "open",
      identifiedDaysAgo: 18,
      dueInDays: 12,
      root_cause: "Policy covers employees only.",
      remediation_plan: "Extend EDR licence and block unmanaged devices.",
      riskIndex: 21,
      controlIndex: 8,
    },
    {
      title: "Copilot sending case notes off-platform",
      description: "Pilot SDK defaults to a public model.",
      source: "incident",
      severity: "high",
      status: "in_progress",
      identifiedDaysAgo: 9,
      dueInDays: 6,
      root_cause: "No allow-list for model endpoints.",
      remediation_plan: "Pin the private endpoint and add DLP inspection.",
      riskIndex: 17,
      controlIndex: 13,
    },
    {
      title: "Complaints dashboard missing a queue",
      description: "Migrated complaints do not appear on the SLA view.",
      source: "regulatory_exam",
      severity: "medium",
      status: "in_progress",
      identifiedDaysAgo: 6,
      dueInDays: 14,
      root_cause: "Filter hard-coded to the legacy team code.",
      remediation_plan: "Rebuild the dashboard from the case-management API.",
      riskIndex: 13,
      controlIndex: 11,
    },
    {
      title: "No IdP failover",
      description: "SSO has no secondary region; a brownout stopped servicing.",
      source: "incident",
      severity: "medium",
      status: "open",
      identifiedDaysAgo: 40,
      dueInDays: 20,
      root_cause: "Resiliency project unfunded.",
      remediation_plan: "Stand up a second region and test break-glass.",
      riskIndex: 12,
      controlIndex: 12,
    },
    {
      title: "Model validation skipped for challenger",
      description: "A credit challenger went live without independent validation.",
      source: "internal_audit",
      severity: "high",
      status: "open",
      identifiedDaysAgo: 28,
      dueInDays: 4,
      root_cause: "Fast-track path had no second-line gate.",
      remediation_plan: "Retrospective validation and freeze further swaps.",
      riskIndex: 11,
      controlIndex: 10,
    },
    {
      title: "BC exercise overdue",
      description: "No technical failover has been run in more than a year.",
      source: "risk_assessment",
      severity: "high",
      status: "open",
      identifiedDaysAgo: 15,
      dueInDays: 30,
      root_cause: "Exercise window clashed with a release freeze.",
      remediation_plan: "Schedule a weekend failover and capture issues.",
      riskIndex: 9,
      controlIndex: 21,
    },
    {
      title: "Fourth-party not in inventory",
      description: "Two material vendors share an unrecorded sub-processor.",
      source: "external_audit",
      severity: "medium",
      status: "pending_review",
      identifiedDaysAgo: 33,
      dueInDays: 12,
      root_cause: "Onboarding questionnaire did not ask for fourth parties.",
      remediation_plan: "Update the questionnaire and backfill critical vendors.",
      riskIndex: 15,
      controlIndex: 19,
    },
    {
      title: "Incentive scheme not reviewed this year",
      description: "Sales quality metrics have not been re-approved.",
      source: "self_identified",
      severity: "medium",
      status: "open",
      identifiedDaysAgo: 20,
      dueInDays: 40,
      root_cause: "Conduct committee deferred the paper.",
      remediation_plan: "Table the review at the next committee.",
      riskIndex: 18,
      controlIndex: 15,
    },
    {
      title: "Manual ALCO pack still in use",
      description: "Overnight liquidity is still pasted from a spreadsheet.",
      source: "control_failure",
      severity: "critical",
      status: "in_progress",
      identifiedDaysAgo: 3,
      dueInDays: 7,
      root_cause: "System feed project slipped.",
      remediation_plan: "Add a system-to-system recon and retire the paste.",
      riskIndex: 20,
      controlIndex: 16,
    },
    {
      title: "Screening gate bypass for conversions",
      description: "Contractor-to-perm conversions skip the HRIS control.",
      source: "incident",
      severity: "medium",
      status: "closed",
      identifiedDaysAgo: 45,
      dueInDays: -5,
      root_cause: "Conversion workflow is a separate HRIS path.",
      remediation_plan: "Same gate applied; retested.",
      riskIndex: 22,
      controlIndex: 14,
    },
    {
      title: "Product launches without appetite exceptions",
      description: "Two features shipped above documented appetite.",
      source: "risk_assessment",
      severity: "low",
      status: "open",
      identifiedDaysAgo: 12,
      dueInDays: 50,
      root_cause: "No exception log in the launch checklist.",
      remediation_plan: "Add the log and train product owners.",
      riskIndex: 25,
      controlIndex: 20,
    },
    {
      title: "Climate scenario missing from ICAAP",
      description: "Physical climate scenarios for the two production sites are not modelled.",
      source: "risk_assessment",
      severity: "high",
      status: "open",
      identifiedDaysAgo: 9,
      dueInDays: 25,
      root_cause: "Climate workstream is still a slide pack.",
      remediation_plan: "Commission scenarios and include them in the next ICAAP.",
      riskIndex: 26,
      controlIndex: 22,
    },
    {
      title: "Walkthrough finding with no parent record",
      description:
        "A process walkthrough noted an undocumented exception path; it was never linked to a risk or control.",
      source: "self_identified",
      severity: "medium",
      status: "open",
      identifiedDaysAgo: 16,
      dueInDays: 20,
      root_cause: "",
      remediation_plan: "",
    },
  ];

  ids.issueIds = issueSpecs.map(() => newId());
  await insertRows(
    "issues",
    issueSpecs.map((spec, index) => ({
      id: ids.issueIds[index],
      title: spec.title,
      description: spec.description,
      source: spec.source,
      severity: spec.severity,
      status: spec.status,
      identified_at: addDaysToIsoDate(today, -spec.identifiedDaysAgo),
      due_date: addDaysToIsoDate(today, spec.dueInDays),
      root_cause: spec.root_cause,
      remediation_plan: spec.remediation_plan,
      closure_notes: spec.status === "closed" ? "Retested and closed." : "",
      closed_at:
        spec.status === "closed"
          ? new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString()
          : null,
      ...(includeEnterprise ? { assignee_id: assignee(index + 3) } : {}),
      ...ownerFields(owner),
    })),
  );

  await insertRows(
    "issue_risks",
    issueSpecs.flatMap((spec, index) =>
      spec.riskIndex === undefined
        ? []
        : [
            {
              issue_id: ids.issueIds[index],
              risk_id: ids.riskIds[spec.riskIndex],
              owner_id: owner.id,
            },
          ],
    ),
  );

  await insertRows(
    "issue_controls",
    issueSpecs.flatMap((spec, index) =>
      spec.controlIndex === undefined
        ? []
        : [
            {
              issue_id: ids.issueIds[index],
              control_id: ids.controlIds[spec.controlIndex],
              owner_id: owner.id,
            },
          ],
    ),
  );

  await insertRows("issue_actions", [
    {
      issue_id: ids.issueIds[0],
      description: "Revoke orphaned admin accounts",
      assignee_email: owner.email,
      due_date: addDaysToIsoDate(today, -3),
      status: "in_progress",
      ...ownerFields(owner),
    },
    {
      issue_id: ids.issueIds[0],
      description: "Complete current-quarter recertification",
      assignee_email: owner.email,
      due_date: addDaysToIsoDate(today, 7),
      status: "open",
      ...ownerFields(owner),
    },
    {
      issue_id: ids.issueIds[2],
      description: "Patch purge job to include archive schema",
      assignee_email: owner.email,
      due_date: addDaysToIsoDate(today, -2),
      status: "completed",
      completed_at: new Date().toISOString(),
      ...ownerFields(owner),
    },
    {
      issue_id: ids.issueIds[2],
      description: "Retest retention control and attach evidence",
      assignee_email: owner.email,
      due_date: addDaysToIsoDate(today, 4),
      status: "completed",
      completed_at: new Date().toISOString(),
      ...ownerFields(owner),
    },
    {
      issue_id: ids.issueIds[3],
      description: "Restore sanctions ingest and add heartbeat",
      assignee_email: owner.email,
      due_date: addDaysToIsoDate(today, 1),
      status: "in_progress",
      ...ownerFields(owner),
    },
    {
      issue_id: ids.issueIds[13],
      description: "Build system-to-system liquidity recon",
      assignee_email: owner.email,
      due_date: addDaysToIsoDate(today, 5),
      status: "open",
      ...ownerFields(owner),
    },
  ]);

  if (includeObligations) {
    const obligationSpecs: Array<{
      title: string;
      source: string;
      citation: string;
      requirement_text: string;
      status: "open" | "monitoring" | "retired";
      review_frequency_days: number;
      effectiveDaysAgo: number;
      reviewInDays: number;
      controlIndexes: number[];
      issueIndexes: number[];
    }> = [
      {
        title: "Security of processing",
        source: "UK GDPR",
        citation: "Article 32",
        requirement_text:
          "Implement appropriate technical and organisational measures to ensure a level of security appropriate to the risk.",
        status: "open",
        review_frequency_days: 365,
        effectiveDaysAgo: 800,
        reviewInDays: 40,
        controlIndexes: [2, 8],
        issueIndexes: [],
      },
      {
        title: "Outsourcing systems and controls",
        source: "FCA Handbook",
        citation: "SYSC 8",
        requirement_text:
          "A firm must take reasonable care to supervise the discharge of outsourced functions.",
        status: "open",
        review_frequency_days: 365,
        effectiveDaysAgo: 600,
        reviewInDays: 18,
        controlIndexes: [5],
        issueIndexes: [11],
      },
      {
        title: "ICT-related incident reporting",
        source: "DORA",
        citation: "Art. 19",
        requirement_text:
          "Report major ICT-related incidents to the competent authority within the prescribed windows.",
        status: "monitoring",
        review_frequency_days: 180,
        effectiveDaysAgo: 120,
        reviewInDays: 55,
        controlIndexes: [12],
        issueIndexes: [],
      },
      {
        title: "Climate-related financial disclosures",
        source: "Companies Act / TCFD",
        citation: "s414CB",
        requirement_text:
          "Describe the principal climate-related risks and how they are managed.",
        status: "open",
        review_frequency_days: 365,
        effectiveDaysAgo: 200,
        reviewInDays: 12,
        controlIndexes: [22],
        issueIndexes: [16],
      },
      {
        title: "Consumer Duty outcomes monitoring",
        source: "FCA",
        citation: "PRIN 2A",
        requirement_text:
          "Monitor whether retail customers receive good outcomes, including complaints handling.",
        status: "open",
        review_frequency_days: 180,
        effectiveDaysAgo: 300,
        reviewInDays: -5,
        controlIndexes: [11],
        issueIndexes: [7],
      },
      {
        title: "Storage limitation",
        source: "UK GDPR",
        citation: "Article 5(1)(e)",
        requirement_text:
          "Keep personal data for no longer than is necessary for the purposes.",
        status: "open",
        review_frequency_days: 365,
        effectiveDaysAgo: 900,
        reviewInDays: 70,
        controlIndexes: [7, 24],
        issueIndexes: [2],
      },
      {
        title: "Operational resilience mapping",
        source: "PRA / FCA",
        citation: "SS1/21",
        requirement_text:
          "Identify important business services and set impact tolerances.",
        status: "open",
        review_frequency_days: 365,
        effectiveDaysAgo: 90,
        reviewInDays: -12,
        controlIndexes: [],
        issueIndexes: [],
      },
      {
        title: "AI transparency for customer-facing models",
        source: "Incoming duty",
        citation: "Draft",
        requirement_text:
          "Explain material automated decisions that affect retail customers.",
        status: "open",
        review_frequency_days: 180,
        effectiveDaysAgo: 30,
        reviewInDays: -3,
        controlIndexes: [],
        issueIndexes: [],
      },
    ];

    ids.obligationIds = obligationSpecs.map(() => newId());
    await insertRowsOptional(
      "obligations",
      obligationSpecs.map((spec, index) => ({
        id: ids.obligationIds![index],
        title: spec.title,
        source: spec.source,
        citation: spec.citation,
        requirement_text: spec.requirement_text,
        status: spec.status,
        review_frequency_days: spec.review_frequency_days,
        effective_date: addDaysToIsoDate(today, -spec.effectiveDaysAgo),
        review_date: addDaysToIsoDate(today, spec.reviewInDays),
        ...(includeEnterprise ? { assignee_id: assignee(index + 4) } : {}),
        ...ownerFields(owner),
      })),
    );

    await insertRowsOptional(
      "obligation_controls",
      obligationSpecs.flatMap((spec, index) =>
        spec.controlIndexes.map((controlIndex) => ({
          obligation_id: ids.obligationIds![index],
          control_id: ids.controlIds[controlIndex],
          owner_id: owner.id,
        })),
      ),
    );

    await insertRowsOptional(
      "obligation_issues",
      obligationSpecs.flatMap((spec, index) =>
        spec.issueIndexes.map((issueIndex) => ({
          obligation_id: ids.obligationIds![index],
          issue_id: ids.issueIds[issueIndex],
          owner_id: owner.id,
        })),
      ),
    );
  }

  if (includeEvidence) {
    const evidenceSpecs: Array<{
      title: string;
      description: string;
      source: string;
      evidenceDaysAgo: number;
      retentionInDays: number;
      entity_type:
        | "risk"
        | "control"
        | "incident"
        | "issue"
        | "obligation";
      entityId: () => string;
    }> = [
      {
        title: "Ransomware tabletop pack",
        description: "Facilitator notes and attendance for the last tabletop.",
        source: "BC / IR",
        evidenceDaysAgo: 20,
        retentionInDays: 365,
        entity_type: "risk",
        entityId: () => ids.riskIds[0],
      },
      {
        title: "Privileged access recert sample",
        description: "Q2 sample of 25 admin accounts with reviewer sign-off.",
        source: "2LoD testing",
        evidenceDaysAgo: 40,
        retentionInDays: 180,
        entity_type: "control",
        entityId: () => ids.controlIds[0],
      },
      {
        title: "Public bucket incident ticket",
        description: "Service-desk ticket and timeline for the staging leak.",
        source: "Service desk",
        evidenceDaysAgo: 5,
        retentionInDays: 730,
        entity_type: "incident",
        entityId: () => ids.incidentIds[2],
      },
      {
        title: "Recertification finding memo",
        description: "Internal audit memo on overdue privileged-access recert.",
        source: "Internal audit",
        evidenceDaysAgo: 50,
        retentionInDays: 365,
        entity_type: "issue",
        entityId: () => ids.issueIds[0],
      },
      {
        title: "Expired BC exercise evidence",
        description: "Last technical failover pack; retention lapsed.",
        source: "Operations",
        evidenceDaysAgo: 400,
        retentionInDays: -30,
        entity_type: "control",
        entityId: () => ids.controlIds[21],
      },
      {
        title: "Expired vendor assurance letter",
        description: "SSAE report for the payments processor past retention.",
        source: "Vendor manager",
        evidenceDaysAgo: 500,
        retentionInDays: -14,
        entity_type: "control",
        entityId: () => ids.controlIds[5],
      },
      {
        title: "Climate scenario workbook",
        description: "Draft physical-risk workbook for the two production sites.",
        source: "Climate risk",
        evidenceDaysAgo: 9,
        retentionInDays: 365,
        entity_type: "risk",
        entityId: () => ids.riskIds[26],
      },
      {
        title: "Chat retention exception",
        description: "Legal exception to retain a litigation hold channel.",
        source: "Legal",
        evidenceDaysAgo: 14,
        retentionInDays: 90,
        entity_type: "risk",
        entityId: () => ids.riskIds[28],
      },
      {
        title: "Indemnity review note",
        description: "Legal note on liability caps for two critical vendors.",
        source: "Legal",
        evidenceDaysAgo: 21,
        retentionInDays: 365,
        entity_type: "risk",
        entityId: () => ids.riskIds[30],
      },
    ];

    if (includeObligations && ids.obligationIds?.[0]) {
      evidenceSpecs.push({
        title: "GDPR Article 32 mapping",
        description: "Control mapping worksheet for security of processing.",
        source: "DPO",
        evidenceDaysAgo: 60,
        retentionInDays: 365,
        entity_type: "obligation",
        entityId: () => ids.obligationIds![0],
      });
    }

    ids.evidenceIds = evidenceSpecs.map(() => newId());
    await insertRowsOptional(
      "evidence",
      evidenceSpecs.map((spec, index) => ({
        id: ids.evidenceIds![index],
        title: spec.title,
        description: spec.description,
        source: spec.source,
        evidence_date: addDaysToIsoDate(today, -spec.evidenceDaysAgo),
        retention_date: addDaysToIsoDate(today, spec.retentionInDays),
        entity_type: spec.entity_type,
        entity_id: spec.entityId(),
        storage_path: null,
        original_filename: "",
        ...(includeEnterprise ? { assignee_id: assignee(index + 5) } : {}),
        ...ownerFields(owner),
      })),
    );
  }

  const sessionId = newId();
  ids.sessionIds.push(sessionId);
  await insertRows("rcsa_sessions", [
    { id: sessionId, ...ownerFields(owner) },
  ]);

  const reviewSpecs = [
    { riskIndex: 3, daysAgo: 20, likelihood: 3, impact: 4, previousLikelihood: 4, previousImpact: 4 },
    { riskIndex: 5, daysAgo: 40, likelihood: 2, impact: 4 },
    { riskIndex: 8, daysAgo: 200, likelihood: 2, impact: 3 },
    { riskIndex: 4, daysAgo: 400, likelihood: 4, impact: 3 },
    { riskIndex: 0, daysAgo: 70, likelihood: 4, impact: 5, previousLikelihood: 3, previousImpact: 4 },
    { riskIndex: 1, daysAgo: 95, likelihood: 3, impact: 5, previousLikelihood: 4, previousImpact: 5 },
    { riskIndex: 6, daysAgo: 15, likelihood: 3, impact: 4, previousLikelihood: 4, previousImpact: 4 },
    { riskIndex: 11, daysAgo: 120, likelihood: 3, impact: 4 },
    { riskIndex: 12, daysAgo: 10, likelihood: 2, impact: 4 },
    { riskIndex: 14, daysAgo: 30, likelihood: 4, impact: 2 },
    { riskIndex: 16, daysAgo: 250, likelihood: 2, impact: 4 },
    { riskIndex: 18, daysAgo: 55, likelihood: 3, impact: 4 },
    { riskIndex: 20, daysAgo: 8, likelihood: 2, impact: 5, previousLikelihood: 2, previousImpact: 4 },
    { riskIndex: 22, daysAgo: 180, likelihood: 3, impact: 3 },
    { riskIndex: 24, daysAgo: 5, likelihood: 2, impact: 5 },
    { riskIndex: 25, daysAgo: 90, likelihood: 3, impact: 3 },
    { riskIndex: 9, daysAgo: 370, likelihood: 4, impact: 4 },
    { riskIndex: 17, daysAgo: 22, likelihood: 3, impact: 4, previousLikelihood: 2, previousImpact: 4 },
  ];

  await insertRows(
    "rcsa_reviews",
    reviewSpecs.map((review) => {
      const reviewedAt = new Date(
        Date.now() - review.daysAgo * 24 * 60 * 60 * 1000,
      ).toISOString();
      return {
        session_id: sessionId,
        risk_id: ids.riskIds[review.riskIndex],
        previous_likelihood: review.previousLikelihood ?? review.likelihood,
        previous_impact: review.previousImpact ?? review.impact,
        final_likelihood: review.likelihood,
        final_impact: review.impact,
        ai_recommended_likelihood: null,
        ai_recommended_impact: null,
        ai_rationale: null,
        reviewed_at: reviewedAt,
        ...ownerFields(owner),
      };
    }),
  );

  return ids;
}

export async function removeDemonstrationData(ownerId: string, ids: DemoIds) {
  const supabase = getSupabaseClient();

  async function deleteByIds(table: string, column: string, values: string[]) {
    if (values.length === 0) {
      return;
    }

    const { error } = await supabase
      .from(table)
      .delete()
      .eq("owner_id", ownerId)
      .in(column, values);

    if (error && error.code !== "PGRST116" && !isMissingRelationError(error)) {
      throw error;
    }
  }

  await deleteByIds("issue_actions", "issue_id", ids.issueIds);
  await deleteByIds("issue_comments", "issue_id", ids.issueIds);
  await deleteByIds("issue_risks", "issue_id", ids.issueIds);
  await deleteByIds("issue_controls", "issue_id", ids.issueIds);
  await deleteByIds("obligation_controls", "obligation_id", ids.obligationIds ?? []);
  await deleteByIds("obligation_issues", "obligation_id", ids.obligationIds ?? []);
  await deleteByIds("evidence", "id", ids.evidenceIds ?? []);
  await deleteByIds("obligations", "id", ids.obligationIds ?? []);
  await deleteByIds("risk_events", "risk_id", ids.riskIds);
  await deleteByIds("incident_events", "incident_id", ids.incidentIds);
  await deleteByIds("issues", "id", ids.issueIds);
  await deleteByIds("incident_risks", "incident_id", ids.incidentIds);
  await deleteByIds("incident_controls", "incident_id", ids.incidentIds);
  await deleteByIds("incidents", "id", ids.incidentIds);
  await deleteByIds("rcsa_reviews", "session_id", ids.sessionIds);
  await deleteByIds("rcsa_sessions", "id", ids.sessionIds);
  await deleteByIds("risk_controls", "risk_id", ids.riskIds);
  await deleteByIds("risk_controls", "control_id", ids.controlIds);
  await deleteByIds("control_test_results", "control_id", ids.controlIds);
  await deleteByIds("controls", "id", ids.controlIds);
  await deleteByIds("risks", "id", ids.riskIds);
  await deleteByIds("risk_categories", "id", ids.categoryIds);
  await deleteByIds("org_people", "id", ids.personIds ?? []);
}
