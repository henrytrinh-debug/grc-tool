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
  BOARD_LIST_LIMIT,
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
import { fetchOwnedTableOptional } from "@/lib/supabase/owned";
import type { FollowUp } from "@/lib/types/follow-up";

export default function BoardPage() {
  const { categories, settings, feedbackReady } = useSettings();
  const [snapshot, setSnapshot] = useState<GrcSnapshot>(emptyGrcSnapshot);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (ownerId: string) => {
      setError(null);
      try {
        const supabase = getSupabaseClient();
        const nextSnapshot = await fetchGrcSnapshot(supabase, ownerId, "board");
        setSnapshot(nextSnapshot);
        if (feedbackReady) {
          setFollowUps(
            await fetchOwnedTableOptional<FollowUp>(
              supabase,
              "follow_ups",
              ownerId,
            ),
          );
        } else {
          setFollowUps([]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load board pack");
      } finally {
        setLoading(false);
      }
    },
    [feedbackReady],
  );

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
        followUps,
        reviews: snapshot.reviews,
      }),
    [categories, followUps, snapshot],
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
          description={`${settings.organizationName} · generated ${generatedLabel}. Exceptions and decisions, not the operating registers.`}
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

            <p className={`text-sm ${mutedTextClassName}`}>
              {pack.movementSentence}
            </p>

            {showBoard("matters") ? (
              <SectionCard
                title="Matters for attention"
                description="The exceptions that need a board or committee decision. Full registers stay on Home and Oversight."
              >
                <RecordLinkList
                  items={pack.matters}
                  empty="No material exceptions in this snapshot."
                  limit={BOARD_LIST_LIMIT}
                  moreHref="/feedback"
                  moreLabel="and more in Feedback"
                />
              </SectionCard>
            ) : null}

            {showBoard("decisions") ||
            showBoard("controlFailures") ||
            showBoard("severeIncidents") ||
            showBoard("appetite") ? (
              <div className="grid min-w-0 gap-6 lg:grid-cols-2">
                {showBoard("decisions") ? (
                  <SectionCard
                    title="Decisions required"
                    description="Open follow-ups from incidents, issues, ineffective tests, and rating changes."
                  >
                    <RecordLinkList
                      items={pack.decisions}
                      empty="No open follow-ups."
                      limit={BOARD_LIST_LIMIT}
                      moreHref="/feedback"
                    />
                  </SectionCard>
                ) : null}
                {showBoard("controlFailures") ? (
                  <SectionCard
                    title="Control failures"
                    description="Latest test recorded ineffective. Key failures should already appear above."
                  >
                    <RecordLinkList
                      items={pack.controlFailures}
                      empty="No ineffective controls in this snapshot."
                      limit={BOARD_LIST_LIMIT}
                      moreHref="/controls?effectiveness=ineffective"
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
                      limit={BOARD_LIST_LIMIT}
                      moreHref="/incidents?status=open,investigating&severity=high,critical"
                    />
                  </SectionCard>
                ) : null}
                {showBoard("appetite") ? (
                  <SectionCard
                    title="Above appetite"
                    description="Operating band exceeds the category appetite. Closed risks are excluded."
                  >
                    <RecordLinkList
                      items={pack.appetiteBreaches}
                      empty="No active risks sit above category appetite."
                      limit={BOARD_LIST_LIMIT}
                      moreHref="/risks?appetiteBreach=true"
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
