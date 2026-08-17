import { getSupabaseClient } from "@/lib/supabase/client";
import { fetchOwnedTableOptional } from "@/lib/supabase/owned";
import type { Control } from "@/lib/types/control";
import type { ControlTestResult } from "@/lib/types/control-test-result";
import type { EvidenceEntityType } from "@/lib/types/evidence";
import type { Incident } from "@/lib/types/incident";
import type { Issue } from "@/lib/types/issue";
import type { ObligationRecord } from "@/lib/types/obligation";
import type { Risk } from "@/lib/types/risk";

export type EvidenceEntityOption = {
  id: string;
  title: string;
};

export async function loadEvidenceEntityOptions(
  ownerId: string,
  entityType: EvidenceEntityType,
): Promise<EvidenceEntityOption[]> {
  const supabase = getSupabaseClient();

  if (entityType === "risk") {
    const rows = await fetchOwnedTableOptional<Pick<Risk, "id" | "title">>(
      supabase,
      "risks",
      ownerId,
      { columns: "id, title", order: "title", ascending: true },
    );
    return rows.map((row) => ({ id: row.id, title: row.title }));
  }

  if (entityType === "control") {
    const rows = await fetchOwnedTableOptional<Pick<Control, "id" | "title">>(
      supabase,
      "controls",
      ownerId,
      { columns: "id, title", order: "title", ascending: true },
    );
    return rows.map((row) => ({ id: row.id, title: row.title }));
  }

  if (entityType === "incident") {
    const rows = await fetchOwnedTableOptional<Pick<Incident, "id" | "title">>(
      supabase,
      "incidents",
      ownerId,
      { columns: "id, title", order: "title", ascending: true },
    );
    return rows.map((row) => ({ id: row.id, title: row.title }));
  }

  if (entityType === "issue") {
    const rows = await fetchOwnedTableOptional<Pick<Issue, "id" | "title">>(
      supabase,
      "issues",
      ownerId,
      { columns: "id, title", order: "title", ascending: true },
    );
    return rows.map((row) => ({ id: row.id, title: row.title }));
  }

  if (entityType === "obligation") {
    const rows = await fetchOwnedTableOptional<
      Pick<ObligationRecord, "id" | "title">
    >(supabase, "obligations", ownerId, {
      columns: "id, title",
      order: "title",
      ascending: true,
    });
    return rows.map((row) => ({ id: row.id, title: row.title }));
  }

  const [tests, controls] = await Promise.all([
    fetchOwnedTableOptional<Pick<ControlTestResult, "id" | "control_id" | "tested_at">>(
      supabase,
      "control_test_results",
      ownerId,
      { columns: "id, control_id, tested_at", order: "tested_at" },
    ),
    fetchOwnedTableOptional<Pick<Control, "id" | "title">>(supabase, "controls", ownerId, {
      columns: "id, title",
    }),
  ]);
  const titles = new Map(controls.map((control) => [control.id, control.title]));
  return tests.map((test) => ({
    id: test.id,
    title: `${titles.get(test.control_id) ?? "Control"} · ${test.tested_at}`,
  }));
}

export async function loadTestControlIds(ownerId: string) {
  const supabase = getSupabaseClient();
  const tests = await fetchOwnedTableOptional<
    Pick<ControlTestResult, "id" | "control_id">
  >(supabase, "control_test_results", ownerId, {
    columns: "id, control_id",
  });
  return Object.fromEntries(tests.map((test) => [test.id, test.control_id]));
}
