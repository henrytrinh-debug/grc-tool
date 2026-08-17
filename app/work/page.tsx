"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import {
  ErrorBanner,
  ListEmpty,
  LoadingBlock,
  PageHeader,
  PageLoading,
} from "@/app/components/page-parts";
import { ClickableRow } from "@/app/components/clickable-row";
import { mutedTextClassName, primaryButtonClassName } from "@/app/components/ui";
import { getRiskScore, getSeverityBand } from "@/lib/dashboard/analytics";
import { useRequireAuth } from "@/lib/hooks/use-require-auth";
import { useSettings } from "@/lib/settings/context";
import { fetchOwnedTable } from "@/lib/supabase/owned";
import { getSupabaseClient } from "@/lib/supabase/client";
import { isAppetiteBreach, isActiveRisk } from "@/lib/taxonomy";
import { getTestingStatus, type Control } from "@/lib/types/control";
import { isIncidentOpen, type Incident } from "@/lib/types/incident";
import { isIssueOverdue, type Issue } from "@/lib/types/issue";
import { personByEmail } from "@/lib/types/person";
import type { Risk } from "@/lib/types/risk";

type WorkItem = {
  id: string;
  href: string;
  kind: "Risk" | "Control" | "Incident" | "Issue";
  title: string;
  detail: string;
  tone: "alert" | "watch" | "ok";
};

export default function WorkPage() {
  const { people, enterpriseReady, categories } = useSettings();
  const [risks, setRisks] = useState<Risk[]>([]);
  const [controls, setControls] = useState<Control[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (ownerId: string) => {
    setError(null);
    try {
      const supabase = getSupabaseClient();
      const [nextRisks, nextControls, nextIncidents, nextIssues] =
        await Promise.all([
          fetchOwnedTable<Risk>(supabase, "risks", ownerId),
          fetchOwnedTable<Control>(supabase, "controls", ownerId),
          fetchOwnedTable<Incident>(supabase, "incidents", ownerId),
          fetchOwnedTable<Issue>(supabase, "issues", ownerId),
        ]);
      setRisks(nextRisks);
      setControls(nextControls);
      setIncidents(nextIncidents);
      setIssues(nextIssues);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load work queue");
    } finally {
      setLoading(false);
    }
  }, []);

  const { user, authLoading } = useRequireAuth(load);
  const me = personByEmail(people, user?.email);

  const items = useMemo(() => {
    if (!me) {
      return [];
    }

    const queue: WorkItem[] = [];

    for (const risk of risks) {
      if (risk.assignee_id !== me.id || !isActiveRisk(risk)) {
        continue;
      }
      const band = getSeverityBand(getRiskScore(risk.likelihood, risk.impact));
      const breach = isAppetiteBreach(risk, categories);
      queue.push({
        id: `risk-${risk.id}`,
        href: `/risks/${risk.id}/edit`,
        kind: "Risk",
        title: risk.title,
        detail: `${band} · ${risk.status ?? "open"}`,
        tone: breach || band === "Critical" ? "alert" : "watch",
      });
    }

    for (const control of controls) {
      if (control.assignee_id !== me.id) {
        continue;
      }
      const testing = getTestingStatus(control.last_tested_at, control.is_key);
      queue.push({
        id: `control-${control.id}`,
        href: `/controls/${control.id}/edit`,
        kind: "Control",
        title: control.title,
        detail: testing,
        tone:
          testing === "Overdue" || control.effectiveness === "ineffective"
            ? "alert"
            : "ok",
      });
    }

    for (const incident of incidents) {
      if (incident.assignee_id !== me.id || !isIncidentOpen(incident.status)) {
        continue;
      }
      queue.push({
        id: `incident-${incident.id}`,
        href: `/incidents/${incident.id}/edit`,
        kind: "Incident",
        title: incident.title,
        detail: incident.severity,
        tone:
          incident.severity === "critical" || incident.severity === "high"
            ? "alert"
            : "watch",
      });
    }

    for (const issue of issues) {
      if (issue.assignee_id !== me.id || issue.status === "closed") {
        continue;
      }
      queue.push({
        id: `issue-${issue.id}`,
        href: `/issues/${issue.id}/edit`,
        kind: "Issue",
        title: issue.title,
        detail: issue.status.replaceAll("_", " "),
        tone: isIssueOverdue(issue) ? "alert" : "watch",
      });
    }

    const rank = { alert: 0, watch: 1, ok: 2 };
    return queue.sort(
      (left, right) =>
        rank[left.tone] - rank[right.tone] ||
        left.title.localeCompare(right.title),
    );
  }, [categories, controls, incidents, issues, me, risks]);

  if (authLoading) {
    return <PageLoading />;
  }

  return (
    <div className="min-h-full min-w-0 bg-slate-50 px-6 py-10 dark:bg-slate-950">
      <main className="mx-auto flex w-full min-w-0 max-w-5xl flex-col gap-8">
        <PageHeader
          title="My work"
          description="Records assigned to the directory person matching your sign-in email."
          breadcrumbs={[
            { href: "/", label: "Home" },
            { label: "My work" },
          ]}
        />

        <ErrorBanner message={error} />

        {!enterpriseReady ? (
          <p className={`text-sm ${mutedTextClassName}`}>
            Run{" "}
            <code className="font-mono">supabase/schema/004_enterprise.sql</code>{" "}
            and add yourself to the people directory in Admin to use this queue.
          </p>
        ) : !me ? (
          <div className="space-y-3">
            <p className={`text-sm ${mutedTextClassName}`}>
              No directory person matches {user?.email}. Add yourself in Admin
              so assignments can resolve to this account.
            </p>
            <Link href="/admin" className={primaryButtonClassName}>
              Open Admin
            </Link>
          </div>
        ) : loading ? (
          <LoadingBlock label="Loading assigned work..." />
        ) : items.length === 0 ? (
          <ListEmpty>
            Nothing assigned to {me.name}. Assign a risk, control, incident, or
            issue from its edit page.
          </ListEmpty>
        ) : (
          <section className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-600 dark:bg-slate-950 dark:text-slate-400">
                  <tr>
                    <th className="px-6 py-3 font-medium">Type</th>
                    <th className="px-6 py-3 font-medium">Title</th>
                    <th className="px-6 py-3 font-medium">Why it is here</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {items.map((item) => (
                    <ClickableRow
                      key={item.id}
                      href={item.href}
                      label={`Open ${item.title}`}
                      className={
                        item.tone === "alert"
                          ? "bg-amber-50/50 dark:bg-amber-950/20"
                          : undefined
                      }
                    >
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                        {item.kind}
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-950 dark:text-slate-50">
                        {item.title}
                      </td>
                      <td className="px-6 py-4 capitalize text-slate-600 dark:text-slate-400">
                        {item.detail}
                      </td>
                    </ClickableRow>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
