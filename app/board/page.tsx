"use client";

import { useCallback, useMemo, useState } from "react";
import {
  ErrorBanner,
  PageHeader,
  PageLoading,
  SectionCard,
} from "@/app/components/page-parts";
import { RecordLinkList } from "@/app/components/record-link-list";
import { StatCard } from "@/app/components/dashboard/stat-card";
import {
  mutedTextClassName,
  pageClassName,
  secondaryButtonClassName,
} from "@/app/components/ui";
import {
  boardPackCsv,
  buildBoardPack,
} from "@/lib/board/pack";
import { downloadCsv } from "@/lib/export/csv";
import { useRequireAuth } from "@/lib/hooks/use-require-auth";
import { useSettings } from "@/lib/settings/context";
import { isBoardSectionVisible } from "@/lib/settings/preferences";
import {
  emptyGrcSnapshot,
  fetchGrcSnapshot,
  type GrcSnapshot,
} from "@/lib/snapshot/grc-snapshot";
import { getSupabaseClient } from "@/lib/supabase/client";

export default function BoardPage() {
  const { categories, settings } = useSettings();
  const [snapshot, setSnapshot] = useState<GrcSnapshot>(emptyGrcSnapshot);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (ownerId: string) => {
    setError(null);
    try {
      const supabase = getSupabaseClient();
      setSnapshot(await fetchGrcSnapshot(supabase, ownerId, "board"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load board pack");
    } finally {
      setLoading(false);
    }
  }, []);

  const { authLoading } = useRequireAuth(load);

  const pack = useMemo(
    () =>
      buildBoardPack({
        risks: snapshot.risks,
        controls: snapshot.controls,
        incidents: snapshot.incidents,
        issues: snapshot.issues,
        categories,
        linkedControlCounts: snapshot.indexes.linkedControlCountsByRisk,
      }),
    [categories, snapshot],
  );
  const boardSections = settings.workspacePreferences.boardSections;
  const showBoard = (id: Parameters<typeof isBoardSectionVisible>[1]) =>
    isBoardSectionVisible(settings.workspacePreferences, id);

  if (authLoading) {
    return <PageLoading />;
  }

  const generatedLabel = new Date(pack.generatedAt).toLocaleString();

  return (
    <div className={`${pageClassName} print:bg-white print:px-0 print:py-0`}>
      <main className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-8 print:max-w-none">
        <PageHeader
          title="Board pack"
          description={`${settings.organizationName} · generated ${generatedLabel}. Print or export this snapshot for committee packs.`}
          breadcrumbs={[
            { href: "/", label: "Home" },
            { label: "Board pack" },
          ]}
          actions={
            <div className="flex flex-wrap gap-2 print:hidden">
              <button
                type="button"
                className={secondaryButtonClassName}
                onClick={() => window.print()}
              >
                Print
              </button>
              <button
                type="button"
                className={secondaryButtonClassName}
                onClick={() =>
                  downloadCsv(
                    "board-pack",
                    ["Section", "Title", "Detail", "Path"],
                    boardPackCsv(pack, boardSections),
                  )
                }
              >
                Export CSV
              </button>
            </div>
          }
        />

        <ErrorBanner message={error} />

        {loading ? (
          <p className={mutedTextClassName}>Loading board pack...</p>
        ) : (
          <>
            {showBoard("headlines") ? (
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {pack.headlines.map((headline) => (
                <StatCard
                  key={headline.label}
                  label={headline.label}
                  value={headline.value}
                  href={headline.href}
                  linkLabel="Open filtered list"
                  hint={headline.hint}
                  tone={headline.tone}
                />
              ))}
            </section>
            ) : null}

            {showBoard("appetite") ||
            showBoard("criticalRisks") ||
            showBoard("overdueKeyControls") ||
            showBoard("overdueIssues") ||
            showBoard("severeIncidents") ? (
            <div className="grid min-w-0 gap-6 lg:grid-cols-2">
              {showBoard("appetite") ? (
              <SectionCard
                title="Above appetite"
                description="Inherent band exceeds the category appetite. Closed risks are excluded."
              >
                <RecordLinkList
                  items={pack.appetiteBreaches}
                  empty="No active risks sit above category appetite."
                  limit={6}
                  moreHref="/risks?appetiteBreach=true"
                />
              </SectionCard>
              ) : null}
              {showBoard("criticalRisks") ? (
              <SectionCard
                title="High / Critical risks"
                description="Open or monitoring risks in the top two score bands."
              >
                <RecordLinkList
                  items={pack.criticalRisks}
                  empty="No High or Critical risks are currently open."
                  limit={6}
                  moreHref="/risks?severity=High,Critical"
                />
              </SectionCard>
              ) : null}
              {showBoard("overdueKeyControls") ? (
              <SectionCard
                title="Overdue key controls"
                description="Key controls past the configured testing cadence."
              >
                <RecordLinkList
                  items={pack.overdueKeyControls}
                  empty="Key control testing is current."
                  limit={6}
                  moreHref="/controls?isKey=true&testingStatus=Overdue"
                />
              </SectionCard>
              ) : null}
              {showBoard("overdueIssues") ? (
              <SectionCard
                title="Overdue issues"
                description="Open findings past the target remediation date."
              >
                <RecordLinkList
                  items={pack.overdueIssues}
                  empty="No issues are past their target date."
                  limit={6}
                  moreHref="/issues?overdue=true"
                />
              </SectionCard>
              ) : null}
              {showBoard("severeIncidents") ? (
              <SectionCard
                title="Severe open incidents"
                description="High or critical incidents still open or under investigation."
              >
                <RecordLinkList
                  items={pack.openSevereIncidents}
                  empty="No severe incidents are currently open."
                  limit={6}
                  moreHref="/incidents?status=open,investigating&severity=high,critical"
                />
              </SectionCard>
              ) : null}
            </div>
            ) : null}
            {!boardSections.length ? (
              <p className={`${mutedTextClassName} print:hidden`}>
                Board pack sections are hidden. Restore them from Admin → Workspace.
              </p>
            ) : null}
          </>
        )}
      </main>
    </div>
  );
}
