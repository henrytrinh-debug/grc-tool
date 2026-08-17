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
  includeResidual?: boolean;
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
  const includeResidual = Boolean(options.includeResidual);
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

  riskSpecs.push(
    {
      title: "Customer authentication fatigue from repeated step-up prompts",
      description:
        "Retail customers abandon journeys after repeated MFA challenges on low-risk payments.",
      likelihood: 4,
      impact: 3,
      category_id: cyber,
      treatment: "mitigate",
      status: "open",
    },
    {
      title: "Supplier invoice fraud via changed bank details",
      description:
        "Callback verification is skipped for known vendors when AP is under month-end pressure.",
      likelihood: 3,
      impact: 4,
      category_id: financial,
      treatment: "mitigate",
      status: "open",
    },
    {
      title: "Branch cash-in-transit delay after a contractor strike",
      description:
        "CIT fallback is contractual only; no tested alternate carrier.",
      likelihood: 2,
      impact: 3,
      category_id: operational,
      treatment: "transfer",
      status: "monitoring",
    },
    {
      title: "Regulatory perimeter change for crypto-asset promotions",
      description:
        "Marketing of a new savings wrapper may fall in scope of the financial promotions regime.",
      likelihood: 3,
      impact: 4,
      category_id: compliance,
      treatment: "mitigate",
      status: "open",
    },
    {
      title: "Key-person absence in sanctions operations",
      description:
        "Two analysts cover all list exceptions; leave plans are not dual-controlled.",
      likelihood: 3,
      impact: 4,
      category_id: peopleCat,
      treatment: "mitigate",
      status: "open",
    },
    {
      title: "Open-source licence contamination in a customer SDK",
      description:
        "A copyleft component shipped in the mobile SDK without Legal review.",
      likelihood: 2,
      impact: 3,
      category_id: legal,
      treatment: "mitigate",
      status: "open",
    },
    {
      title: "Wholesale credit limit override without dual approval",
      description:
        "Relationship managers can lift limits overnight with a single authoriser.",
      likelihood: 3,
      impact: 5,
      category_id: credit,
      treatment: "mitigate",
      status: "open",
    },
    {
      title: "Tape backup restoration untested after vault vendor change",
      description:
        "The new vault SLA excludes weekend restores; last live restore was 14 months ago.",
      likelihood: 3,
      impact: 5,
      category_id: techResilience,
      treatment: "mitigate",
      status: "open",
    },
  );

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
      ...(includeResidual && ![4, 14, 32, 33, 40].includes(index)
        ? {
            residual_likelihood: Math.max(1, spec.likelihood - (index % 3 === 0 ? 1 : 0)),
            residual_impact: spec.impact,
          }
        : {}),
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

  controlSpecs.push(
    {
      title: "Callback verification for vendor bank-detail changes",
      description: "AP must call a registered number before changing settlement details.",
      is_key: true,
      effectiveness: "ineffective",
      last_tested_at: addDaysToIsoDate(today, -20),
      control_type: "preventive",
    },
    {
      title: "Dual approval for wholesale limit overrides",
      description: "Second authoriser required above the documented threshold.",
      is_key: true,
      effectiveness: "not_tested",
      last_tested_at: null,
      control_type: "preventive",
    },
    {
      title: "Weekend vault restore drill",
      description: "Quarterly restore from the new vault vendor including weekend windows.",
      is_key: true,
      effectiveness: "effective",
      last_tested_at: addDaysToIsoDate(today, -95),
      control_type: "corrective",
    },
    {
      title: "SDK licence scanning in CI",
      description: "Build fails on copyleft licences without a Legal exception ticket.",
      is_key: false,
      effectiveness: "effective",
      last_tested_at: addDaysToIsoDate(today, -12),
      control_type: "detective",
    },
    {
      title: "Sanctions exception four-eye review",
      description: "Exceptions cannot be released by the analyst who raised them.",
      is_key: true,
      effectiveness: "effective",
      last_tested_at: addDaysToIsoDate(today, -40),
      control_type: "preventive",
    },
  );

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
    [34, 2],
    [35, 29],
    [36, 5],
    [37, 9],
    [38, 33],
    [39, 32],
    [40, 30],
    [41, 31],
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

  const extraTests = [
    { controlIndex: 0, daysAgo: 60, effectiveness: "effective" as const },
    { controlIndex: 0, daysAgo: 200, effectiveness: "effective" as const },
    { controlIndex: 1, daysAgo: 90, effectiveness: "effective" as const },
    { controlIndex: 3, daysAgo: 150, effectiveness: "ineffective" as const },
    { controlIndex: 4, daysAgo: 45, effectiveness: "effective" as const },
    { controlIndex: 5, daysAgo: 110, effectiveness: "ineffective" as const },
    { controlIndex: 8, daysAgo: 30, effectiveness: "effective" as const },
    { controlIndex: 12, daysAgo: 75, effectiveness: "effective" as const },
    { controlIndex: 17, daysAgo: 220, effectiveness: "ineffective" as const },
    { controlIndex: 21, daysAgo: 14, effectiveness: "effective" as const },
    { controlIndex: 29, daysAgo: 18, effectiveness: "ineffective" as const },
    { controlIndex: 31, daysAgo: 40, effectiveness: "effective" as const },
    { controlIndex: 2, daysAgo: 240, effectiveness: "effective" as const },
    { controlIndex: 8, daysAgo: 280, effectiveness: "ineffective" as const },
    { controlIndex: 9, daysAgo: 320, effectiveness: "effective" as const },
    { controlIndex: 21, daysAgo: 340, effectiveness: "ineffective" as const },
  ];

  await insertRows(
    "control_test_results",
    extraTests
      .filter((test) => ids.controlIds[test.controlIndex])
      .map((test) => ({
        control_id: ids.controlIds[test.controlIndex],
        effectiveness: test.effectiveness,
        tested_at: addDaysToIsoDate(today, -test.daysAgo),
        notes: `Historical sample from ${test.daysAgo} days ago.`,
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

  incidentSpecs.push(
    {
      title: "Vendor bank-detail change paid to a mule account",
      description:
        "A callback was skipped; £84k left the house before the fraud team froze the payment.",
      daysAgo: 38,
      severity: "high",
      status: "investigating",
      root_cause: "Month-end override of the callback control.",
      riskIndex: 35,
    },
    {
      title: "Limit override on a wholesale name overnight",
      description:
        "A single authoriser lifted a sector-limit breach to complete a syndication.",
      daysAgo: 70,
      severity: "high",
      status: "open",
      root_cause: "Override path had no dual-control gate.",
      riskIndex: 40,
    },
    {
      title: "Restore drill missed the weekend window",
      description:
        "The new vault vendor declined a Saturday restore; RTO was breached in the exercise.",
      daysAgo: 120,
      severity: "medium",
      status: "resolved",
      root_cause: "SLA excluded weekend restores.",
      resolvedDaysAgo: 90,
      riskIndex: 41,
    },
    {
      title: "Copyleft licence detected in the customer SDK",
      description:
        "CI flagged GPL code after a dependency bump; a hotfix was shipped the same day.",
      daysAgo: 210,
      severity: "low",
      status: "resolved",
      root_cause: "Licence scan was warning-only.",
      resolvedDaysAgo: 180,
      riskIndex: 39,
    },
    {
      title: "Sanctions exception released by the raising analyst",
      description:
        "Four-eye review was bypassed during a peak payments day.",
      daysAgo: 15,
      severity: "critical",
      status: "investigating",
      root_cause: "Deputy cover was not provisioned.",
      riskIndex: 38,
    },
    {
      title: "MFA fatigue complaints spike after step-up change",
      description:
        "Contact centre logged 400 abandonment complaints in a week.",
      daysAgo: 9,
      severity: "medium",
      status: "open",
      root_cause: "Risk-based authentication thresholds were tightened without a customer test.",
      riskIndex: 34,
    },
    {
      title: "Batch window overrun recovered without customer impact",
      description:
        "Overnight processing overran by 40 minutes; the SLA credit clause was not triggered.",
      daysAgo: 160,
      severity: "low",
      status: "resolved",
      root_cause: "A late file from a vendor delayed the start.",
      resolvedDaysAgo: 140,
      riskIndex: 29,
    },
    {
      title: "Fourth-party outage contained by contractual fallback",
      description:
        "A sub-processor of the card platform was down for two hours; traffic failed over.",
      daysAgo: 240,
      severity: "medium",
      status: "resolved",
      root_cause: "No direct monitoring of the fourth party.",
      resolvedDaysAgo: 220,
      riskIndex: 15,
    },
  );

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
    closedDaysAgo?: number;
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
      closedDaysAgo: 32,
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

  issueSpecs.push(
    {
      title: "Callback control bypassed at month-end",
      description:
        "AP skipped vendor bank-detail callbacks for known suppliers during close.",
      source: "incident",
      severity: "high",
      status: "in_progress",
      identifiedDaysAgo: 36,
      dueInDays: -2,
      root_cause: "No hard stop in the payments platform.",
      remediation_plan: "Make callback a blocking workflow step.",
      riskIndex: 35,
      controlIndex: 29,
    },
    {
      title: "Wholesale override path lacks dual control",
      description: "A single authoriser can lift sector limits overnight.",
      source: "risk_assessment",
      severity: "critical",
      status: "open",
      identifiedDaysAgo: 12,
      dueInDays: 18,
      root_cause: "",
      remediation_plan: "",
      riskIndex: 40,
      controlIndex: 30,
    },
    {
      title: "Vault SLA excludes weekend restores",
      description: "RTO cannot be met if an incident falls on a Saturday.",
      source: "control_failure",
      severity: "high",
      status: "pending_review",
      identifiedDaysAgo: 88,
      dueInDays: 6,
      root_cause: "Contract novation dropped weekend coverage.",
      remediation_plan: "Renegotiate SLA and retest.",
      riskIndex: 41,
      controlIndex: 31,
    },
    {
      title: "SDK licence scan is warning-only",
      description: "Copyleft can still ship if the build owner dismisses the warning.",
      source: "self_identified",
      severity: "medium",
      status: "open",
      identifiedDaysAgo: 200,
      dueInDays: 40,
      root_cause: "CI gate was never switched to fail.",
      remediation_plan: "Fail the build without a Legal exception.",
      riskIndex: 39,
      controlIndex: 32,
    },
    {
      title: "Sanctions four-eye bypass during peak",
      description: "Exceptions were released by the raising analyst.",
      source: "incident",
      severity: "critical",
      status: "in_progress",
      identifiedDaysAgo: 14,
      dueInDays: -1,
      root_cause: "Deputy cover not provisioned.",
      remediation_plan: "Enforce four-eye in the workflow engine.",
      riskIndex: 38,
      controlIndex: 33,
    },
    {
      title: "Step-up authentication not customer-tested",
      description: "Threshold change caused abandonment without a journey test.",
      source: "external_audit",
      severity: "medium",
      status: "open",
      identifiedDaysAgo: 7,
      dueInDays: 25,
      root_cause: "",
      remediation_plan: "",
      riskIndex: 34,
    },
    {
      title: "CIT fallback carrier never exercised",
      description: "Contractual alternate exists; no live run in 18 months.",
      source: "internal_audit",
      severity: "low",
      status: "closed",
      identifiedDaysAgo: 260,
      dueInDays: -200,
      closedDaysAgo: 210,
      root_cause: "Exercise was deferred twice.",
      remediation_plan: "Annual live run booked.",
      riskIndex: 36,
    },
    {
      title: "Crypto-asset promotion legal memo overdue",
      description: "Product wants to launch before the promotions opinion lands.",
      source: "regulatory_exam",
      severity: "high",
      status: "open",
      identifiedDaysAgo: 21,
      dueInDays: 9,
      root_cause: "",
      remediation_plan: "",
      riskIndex: 37,
    },
    {
      title: "Privilege recertification completed after catch-up",
      description: "Orphaned admin accounts were revoked; the next cycle is on calendar.",
      source: "control_failure",
      severity: "medium",
      status: "closed",
      identifiedDaysAgo: 120,
      dueInDays: -80,
      closedDaysAgo: 95,
      root_cause: "Owner left without a deputy.",
      remediation_plan: "Deputy named and calendar invite series created.",
      riskIndex: 1,
      controlIndex: 0,
    },
    {
      title: "Complaints queue filter corrected",
      description: "Migrated cases now appear on the SLA dashboard.",
      source: "regulatory_exam",
      severity: "low",
      status: "closed",
      identifiedDaysAgo: 75,
      dueInDays: -40,
      closedDaysAgo: 48,
      root_cause: "Hard-coded legacy team code.",
      remediation_plan: "Dashboard rebuilt from the case-management API.",
      riskIndex: 13,
      controlIndex: 11,
    },
    {
      title: "IdP secondary region configured after brownout",
      description: "Failover was proven in a weekend exercise.",
      source: "incident",
      severity: "medium",
      status: "closed",
      identifiedDaysAgo: 200,
      dueInDays: -150,
      closedDaysAgo: 160,
      root_cause: "No secondary region.",
      remediation_plan: "Secondary region live; runbook updated.",
      riskIndex: 12,
      controlIndex: 12,
    },
    {
      title: "Archive purge job extended to the records store",
      description: "Retention control now covers the archive schema.",
      source: "control_failure",
      severity: "medium",
      status: "closed",
      identifiedDaysAgo: 300,
      dueInDays: -240,
      closedDaysAgo: 250,
      root_cause: "Job scoped to the live schema only.",
      remediation_plan: "Job extended and retested.",
      riskIndex: 8,
      controlIndex: 7,
    },
  );

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
          ? new Date(
              Date.now() -
                (spec.closedDaysAgo ?? Math.max(1, spec.identifiedDaysAgo - 14)) *
                  24 *
                  60 *
                  60 *
                  1000,
            ).toISOString()
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
    {
      issue_id: ids.issueIds[ids.issueIds.length - 12],
      description: "Block payments until callback is recorded",
      assignee_email: owner.email,
      due_date: addDaysToIsoDate(today, 3),
      status: "in_progress",
      ...ownerFields(owner),
    },
    {
      issue_id: ids.issueIds[ids.issueIds.length - 11],
      description: "Add dual authoriser to the overnight override path",
      assignee_email: owner.email,
      due_date: addDaysToIsoDate(today, 10),
      status: "open",
      ...ownerFields(owner),
    },
  ]);

  await insertRows("issue_comments", [
    {
      issue_id: ids.issueIds[0],
      body: "Deputy named; recertification pack is in review.",
      kind: "comment",
      ...ownerFields(owner),
    },
    {
      issue_id: ids.issueIds[ids.issueIds.length - 12],
      body: "Month-end override of callback is still possible; platform change requested.",
      kind: "comment",
      ...ownerFields(owner),
    },
    {
      issue_id: ids.issueIds[ids.issueIds.length - 5],
      body: "Legal memo still outstanding; product launch is gated.",
      kind: "comment",
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

    obligationSpecs.push(
      {
        title: "Financial promotions for qualifying cryptoassets",
        source: "FCA",
        citation: "PS23/6",
        requirement_text:
          "Ensure cryptoasset promotions are fair, clear and not misleading, with a clear risk warning.",
        status: "open",
        review_frequency_days: 180,
        effectiveDaysAgo: 40,
        reviewInDays: 20,
        controlIndexes: [],
        issueIndexes: [issueSpecs.length - 5],
      },
      {
        title: "Sanctions screening effectiveness",
        source: "OFSI",
        citation: "Guidance",
        requirement_text:
          "Screening must be timely, complete, and independently reviewed.",
        status: "monitoring",
        review_frequency_days: 90,
        effectiveDaysAgo: 400,
        reviewInDays: -8,
        controlIndexes: [9, 33],
        issueIndexes: [issueSpecs.length - 8],
      },
      {
        title: "Operational resilience important business services",
        source: "PRA",
        citation: "SS1/21",
        requirement_text:
          "Set impact tolerances for each important business service and test them.",
        status: "open",
        review_frequency_days: 365,
        effectiveDaysAgo: 250,
        reviewInDays: 40,
        controlIndexes: [31],
        issueIndexes: [issueSpecs.length - 10],
      },
      {
        title: "Consumer Duty monitoring of authentication journeys",
        source: "FCA",
        citation: "PRIN 2A",
        requirement_text:
          "Monitor whether retail customers receive good outcomes, including friction in authentication.",
        status: "open",
        review_frequency_days: 180,
        effectiveDaysAgo: 70,
        reviewInDays: 11,
        controlIndexes: [2],
        issueIndexes: [issueSpecs.length - 7],
      },
      {
        title: "Outsourcing register completeness",
        source: "EBA",
        citation: "EBA/GL/2019/02",
        requirement_text:
          "Maintain a register of outsourcing arrangements including fourth parties.",
        status: "open",
        review_frequency_days: 365,
        effectiveDaysAgo: 180,
        reviewInDays: -20,
        controlIndexes: [19],
        issueIndexes: [],
      },
      {
        title: "Records of processing activities",
        source: "UK GDPR",
        citation: "Article 30",
        requirement_text:
          "Maintain a record of processing activities for which the firm is controller.",
        status: "monitoring",
        review_frequency_days: 365,
        effectiveDaysAgo: 500,
        reviewInDays: 80,
        controlIndexes: [7, 24],
        issueIndexes: [],
      },
      {
        title: "Payment Services incident reporting",
        source: "PSD2 / FCA",
        citation: "SUP 15.3",
        requirement_text:
          "Notify the FCA of operational or security incidents that affect payment services.",
        status: "open",
        review_frequency_days: 180,
        effectiveDaysAgo: 110,
        reviewInDays: -2,
        controlIndexes: [4],
        issueIndexes: [],
      },
      {
        title: "Staff screening for certified roles",
        source: "SMCR",
        citation: "FIT",
        requirement_text:
          "Assess fitness and propriety before a person performs a certified function.",
        status: "monitoring",
        review_frequency_days: 365,
        effectiveDaysAgo: 420,
        reviewInDays: 25,
        controlIndexes: [14],
        issueIndexes: [],
      },
    );

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
    { riskIndex: 35, daysAgo: 11, likelihood: 3, impact: 4, previousLikelihood: 4, previousImpact: 4 },
    { riskIndex: 40, daysAgo: 6, likelihood: 3, impact: 5, previousLikelihood: 4, previousImpact: 5 },
    { riskIndex: 41, daysAgo: 28, likelihood: 2, impact: 5, previousLikelihood: 3, previousImpact: 5 },
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
        ...(includeResidual
          ? {
              previous_residual_likelihood: Math.max(
                1,
                (review.previousLikelihood ?? review.likelihood) - 1,
              ),
              previous_residual_impact: review.previousImpact ?? review.impact,
              final_residual_likelihood: Math.max(1, review.likelihood - 1),
              final_residual_impact: review.impact,
            }
          : {}),
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
