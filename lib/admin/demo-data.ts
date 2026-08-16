import { getSupabaseClient } from "@/lib/supabase/client";
import { addDaysToIsoDate, todayIsoDate } from "@/lib/dates";
import type { DemoIds } from "@/lib/settings/defaults";

type Owner = { id: string; email: string };

async function insertRow<T extends Record<string, unknown>>(
  table: string,
  payload: T,
) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(table)
    .insert(payload)
    .select("id")
    .single();

  if (error || !data?.id) {
    throw error ?? new Error(`Failed to insert into ${table}`);
  }

  return data.id as string;
}

function ownerFields(owner: Owner) {
  return { owner_id: owner.id, owner_email: owner.email };
}

/**
 * Inserts a coherent demonstration environment: taxonomy, scored risks,
 * mixed control testing, open incidents, and findings in flight.
 */
export async function seedDemonstrationData(owner: Owner): Promise<DemoIds> {
  const today = todayIsoDate();
  const ids: DemoIds = {
    categoryIds: [],
    riskIds: [],
    controlIds: [],
    incidentIds: [],
    issueIds: [],
    sessionIds: [],
  };

  const categorySpecs = [
    {
      name: "Cybersecurity",
      description: "Confidentiality, integrity, and availability of systems and data.",
    },
    {
      name: "Operational",
      description: "People, process, and change failures in day-to-day operations.",
    },
    {
      name: "Financial",
      description: "Fraud, reporting error, and liquidity or payment disruption.",
    },
    {
      name: "Compliance & Regulatory",
      description: "Obligations to regulators, customers, and applicable law.",
    },
    {
      name: "Third-Party",
      description: "Vendors, processors, and other external dependencies.",
    },
  ];

  for (const [index, spec] of categorySpecs.entries()) {
    ids.categoryIds.push(
      await insertRow("risk_categories", {
        ...spec,
        sort_order: index,
        ...ownerFields(owner),
      }),
    );
  }

  const [cyber, operational, financial, compliance, thirdParty] =
    ids.categoryIds;

  const riskSpecs = [
    {
      title: "Ransomware interrupting customer operations",
      description:
        "A successful ransomware attack encrypts production systems and backup copies, stopping onboarding and payments.",
      likelihood: 4,
      impact: 5,
      category_id: cyber,
      treatment: "mitigate",
    },
    {
      title: "Privileged access abuse",
      description:
        "Standing admin rights are used to alter records or exfiltrate data without detection.",
      likelihood: 3,
      impact: 5,
      category_id: cyber,
      treatment: "mitigate",
    },
    {
      title: "Cloud misconfiguration exposing customer data",
      description:
        "A storage bucket or identity policy is left public, leaking personal data.",
      likelihood: 3,
      impact: 4,
      category_id: cyber,
      treatment: "mitigate",
    },
    {
      title: "Payment fraud through compromised credentials",
      description:
        "Attackers initiate outbound payments using stolen finance-user credentials.",
      likelihood: 3,
      impact: 4,
      category_id: financial,
      treatment: "mitigate",
    },
    {
      title: "Key-person dependency in change management",
      description:
        "A single engineer holds production-release knowledge; absence delays patches.",
      likelihood: 4,
      impact: 3,
      category_id: operational,
      treatment: "mitigate",
    },
    {
      title: "Regulatory reporting submitted late or incomplete",
      description:
        "Manual returns miss a filing window, attracting supervisory findings.",
      likelihood: 2,
      impact: 4,
      category_id: compliance,
      treatment: "mitigate",
    },
    {
      title: "Critical vendor outage with no tested fallback",
      description:
        "The payments processor is unavailable and the documented workaround has never been exercised.",
      likelihood: 3,
      impact: 4,
      category_id: thirdParty,
      treatment: "transfer",
    },
    {
      title: "Failed change introducing service outage",
      description:
        "An unreviewed production change takes customer-facing services offline.",
      likelihood: 3,
      impact: 3,
      category_id: operational,
      treatment: "mitigate",
    },
    {
      title: "Personal data retained beyond policy",
      description:
        "Backups and archives keep customer records past the documented retention period.",
      likelihood: 2,
      impact: 3,
      category_id: compliance,
      treatment: "accept",
    },
    {
      title: "Business continuity plan untested",
      description:
        "The BC plan exists on paper but has not been exercised in the last year.",
      likelihood: 4,
      impact: 4,
      category_id: operational,
      treatment: "mitigate",
    },
  ] as const;

  for (const spec of riskSpecs) {
    ids.riskIds.push(
      await insertRow("risks", { ...spec, ...ownerFields(owner) }),
    );
  }

  const controlSpecs = [
    {
      title: "Privileged access review",
      description: "Quarterly recertification of standing admin accounts.",
      is_key: true,
      effectiveness: "ineffective",
      last_tested_at: addDaysToIsoDate(today, -40),
    },
    {
      title: "Immutable backups with restore test",
      description: "Offline backups restored in a tabletop and technical test.",
      is_key: true,
      effectiveness: "effective",
      last_tested_at: addDaysToIsoDate(today, -20),
    },
    {
      title: "MFA on remote and privileged access",
      description: "Phishing-resistant MFA for VPN, SSO, and admin consoles.",
      is_key: true,
      effectiveness: "effective",
      last_tested_at: addDaysToIsoDate(today, -60),
    },
    {
      title: "Cloud posture scanning",
      description: "Daily misconfiguration scan of production cloud accounts.",
      is_key: true,
      effectiveness: "not_tested",
      last_tested_at: null,
    },
    {
      title: "Dual approval for payments above threshold",
      description: "Second approver required for outbound payments.",
      is_key: true,
      effectiveness: "effective",
      last_tested_at: addDaysToIsoDate(today, -15),
    },
    {
      title: "Vendor due diligence and SLA monitoring",
      description: "Onboarding review plus monthly SLA dashboard for critical vendors.",
      is_key: false,
      effectiveness: "not_tested",
      last_tested_at: null,
    },
    {
      title: "Change advisory board",
      description: "Weekly CAB for production changes with rollback criteria.",
      is_key: false,
      effectiveness: "effective",
      last_tested_at: addDaysToIsoDate(today, -400),
    },
    {
      title: "Data retention job",
      description: "Automated purge aligned to the records schedule.",
      is_key: false,
      effectiveness: "ineffective",
      last_tested_at: addDaysToIsoDate(today, -90),
    },
  ] as const;

  for (const spec of controlSpecs) {
    ids.controlIds.push(
      await insertRow("controls", { ...spec, ...ownerFields(owner) }),
    );
  }

  const riskControlPairs: Array<[number, number]> = [
    [0, 1],
    [0, 2],
    [1, 0],
    [1, 2],
    [2, 3],
    [3, 4],
    [4, 6],
    [6, 5],
    [7, 6],
    [8, 7],
  ];

  for (const [riskIndex, controlIndex] of riskControlPairs) {
    await insertRow("risk_controls", {
      risk_id: ids.riskIds[riskIndex],
      control_id: ids.controlIds[controlIndex],
      owner_id: owner.id,
    });
  }

  const testNotes = [
    {
      controlIndex: 0,
      effectiveness: "ineffective",
      tested_at: addDaysToIsoDate(today, -40),
      notes: "12 orphaned admin accounts; recertification skipped last quarter.",
    },
    {
      controlIndex: 1,
      effectiveness: "effective",
      tested_at: addDaysToIsoDate(today, -20),
      notes: "Restore completed within RTO. Sample files intact.",
    },
    {
      controlIndex: 2,
      effectiveness: "effective",
      tested_at: addDaysToIsoDate(today, -60),
      notes: "MFA coverage 100% for in-scope apps.",
    },
    {
      controlIndex: 4,
      effectiveness: "effective",
      tested_at: addDaysToIsoDate(today, -15),
      notes: "Sample of 25 payments all had dual approval.",
    },
    {
      controlIndex: 6,
      effectiveness: "effective",
      tested_at: addDaysToIsoDate(today, -400),
      notes: "Last CAB sample was over a year ago — due for retest.",
    },
    {
      controlIndex: 7,
      effectiveness: "ineffective",
      tested_at: addDaysToIsoDate(today, -90),
      notes: "Purge job failed silently for the archive schema.",
    },
  ] as const;

  for (const test of testNotes) {
    await insertRow("control_test_results", {
      control_id: ids.controlIds[test.controlIndex],
      effectiveness: test.effectiveness,
      tested_at: test.tested_at,
      notes: test.notes,
      ...ownerFields(owner),
    });
  }

  ids.incidentIds.push(
    await insertRow("incidents", {
      title: "Attempted ransomware on a jump host",
      description:
        "EDR contained an encrypting payload on a privileged jump host before lateral movement.",
      date_occurred: addDaysToIsoDate(today, -12),
      severity: "critical",
      status: "investigating",
      root_cause: "Phished VPN credentials reused on the jump host.",
      ...ownerFields(owner),
    }),
    await insertRow("incidents", {
      title: "Duplicate supplier payment",
      description: "A weekend payment run submitted the same file twice.",
      date_occurred: addDaysToIsoDate(today, -80),
      severity: "medium",
      status: "resolved",
      root_cause: "No file-hash check before release.",
      resolved_at: new Date(
        Date.now() - 60 * 24 * 60 * 60 * 1000,
      ).toISOString(),
      ...ownerFields(owner),
    }),
  );

  await insertRow("incident_risks", {
    incident_id: ids.incidentIds[0],
    risk_id: ids.riskIds[0],
    owner_id: owner.id,
  });
  await insertRow("incident_risks", {
    incident_id: ids.incidentIds[1],
    risk_id: ids.riskIds[3],
    owner_id: owner.id,
  });

  ids.issueIds.push(
    await insertRow("issues", {
      title: "Privileged access recertification overdue",
      description:
        "Quarterly recertification of admin accounts was skipped; 12 accounts have no current owner.",
      source: "control_failure",
      severity: "high",
      status: "in_progress",
      identified_at: addDaysToIsoDate(today, -50),
      due_date: addDaysToIsoDate(today, -10),
      root_cause: "The recertification owner left and the control had no deputy.",
      remediation_plan:
        "Reassign ownership, complete recert, and revoke orphaned accounts.",
      closure_notes: "",
      ...ownerFields(owner),
    }),
    await insertRow("issues", {
      title: "Cloud posture scanning never commissioned",
      description:
        "The CSPM tool is licensed but not connected to production accounts.",
      source: "risk_assessment",
      severity: "high",
      status: "open",
      identified_at: addDaysToIsoDate(today, -8),
      due_date: addDaysToIsoDate(today, 22),
      root_cause: "",
      remediation_plan: "",
      closure_notes: "",
      ...ownerFields(owner),
    }),
    await insertRow("issues", {
      title: "Archive purge job failing silently",
      description:
        "Retention control does not delete from the archive schema; records exceed policy.",
      source: "internal_audit",
      severity: "medium",
      status: "pending_review",
      identified_at: addDaysToIsoDate(today, -70),
      due_date: addDaysToIsoDate(today, 5),
      root_cause: "Job scoped only to the live schema.",
      remediation_plan: "Extend the job, backfill deletions, and retest.",
      closure_notes: "",
      ...ownerFields(owner),
    }),
  );

  await insertRow("issue_risks", {
    issue_id: ids.issueIds[0],
    risk_id: ids.riskIds[1],
    owner_id: owner.id,
  });
  await insertRow("issue_controls", {
    issue_id: ids.issueIds[0],
    control_id: ids.controlIds[0],
    owner_id: owner.id,
  });
  await insertRow("issue_risks", {
    issue_id: ids.issueIds[1],
    risk_id: ids.riskIds[2],
    owner_id: owner.id,
  });
  await insertRow("issue_controls", {
    issue_id: ids.issueIds[1],
    control_id: ids.controlIds[3],
    owner_id: owner.id,
  });
  await insertRow("issue_risks", {
    issue_id: ids.issueIds[2],
    risk_id: ids.riskIds[8],
    owner_id: owner.id,
  });

  await insertRow("issue_actions", {
    issue_id: ids.issueIds[0],
    description: "Revoke orphaned admin accounts",
    assignee_email: owner.email,
    due_date: addDaysToIsoDate(today, -3),
    status: "in_progress",
    ...ownerFields(owner),
  });
  await insertRow("issue_actions", {
    issue_id: ids.issueIds[0],
    description: "Complete current-quarter recertification",
    assignee_email: owner.email,
    due_date: addDaysToIsoDate(today, 7),
    status: "open",
    ...ownerFields(owner),
  });
  await insertRow("issue_actions", {
    issue_id: ids.issueIds[2],
    description: "Patch purge job to include archive schema",
    assignee_email: owner.email,
    due_date: addDaysToIsoDate(today, -2),
    status: "completed",
    completed_at: new Date().toISOString(),
    ...ownerFields(owner),
  });
  await insertRow("issue_actions", {
    issue_id: ids.issueIds[2],
    description: "Retest retention control and attach evidence",
    assignee_email: owner.email,
    due_date: addDaysToIsoDate(today, 4),
    status: "completed",
    completed_at: new Date().toISOString(),
    ...ownerFields(owner),
  });

  const sessionId = await insertRow("rcsa_sessions", ownerFields(owner));
  ids.sessionIds.push(sessionId);

  const reviewSpecs = [
    { riskIndex: 3, daysAgo: 20, likelihood: 3, impact: 4 },
    { riskIndex: 5, daysAgo: 40, likelihood: 2, impact: 4 },
    { riskIndex: 8, daysAgo: 200, likelihood: 2, impact: 3 },
    { riskIndex: 4, daysAgo: 400, likelihood: 4, impact: 3 },
  ];

  for (const review of reviewSpecs) {
    const reviewedAt = new Date(
      Date.now() - review.daysAgo * 24 * 60 * 60 * 1000,
    ).toISOString();
    await insertRow("rcsa_reviews", {
      session_id: sessionId,
      risk_id: ids.riskIds[review.riskIndex],
      previous_likelihood: review.likelihood,
      previous_impact: review.impact,
      final_likelihood: review.likelihood,
      final_impact: review.impact,
      ai_recommended_likelihood: null,
      ai_recommended_impact: null,
      ai_rationale: null,
      reviewed_at: reviewedAt,
      ...ownerFields(owner),
    });
  }

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

    if (error && error.code !== "PGRST116") {
      throw error;
    }
  }

  await deleteByIds("issue_actions", "issue_id", ids.issueIds);
  await deleteByIds("issue_comments", "issue_id", ids.issueIds);
  await deleteByIds("issue_risks", "issue_id", ids.issueIds);
  await deleteByIds("issue_controls", "issue_id", ids.issueIds);
  await deleteByIds("issues", "id", ids.issueIds);
  await deleteByIds("incident_risks", "incident_id", ids.incidentIds);
  await deleteByIds("incidents", "id", ids.incidentIds);
  await deleteByIds("rcsa_reviews", "session_id", ids.sessionIds);
  await deleteByIds("rcsa_sessions", "id", ids.sessionIds);
  await deleteByIds("risk_controls", "risk_id", ids.riskIds);
  await deleteByIds("risk_controls", "control_id", ids.controlIds);
  await deleteByIds("control_test_results", "control_id", ids.controlIds);
  await deleteByIds("controls", "id", ids.controlIds);
  await deleteByIds("risks", "id", ids.riskIds);
  await deleteByIds("risk_categories", "id", ids.categoryIds);
}
