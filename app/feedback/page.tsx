"use client";

import { Suspense, useCallback, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FollowUpList } from "@/app/components/follow-up-list";
import {
  ErrorBanner,
  PageHeader,
  PageLoading,
  SchemaNotice,
  SectionCard,
} from "@/app/components/page-parts";
import { RecordLinkList } from "@/app/components/record-link-list";
import { mutedTextClassName, pageClassName } from "@/app/components/ui";
import { buildAuditTrail } from "@/lib/feedback/audit";
import { useRequireAuth } from "@/lib/hooks/use-require-auth";
import { useSettings } from "@/lib/settings/context";
import {
  emptyGrcSnapshot,
  fetchGrcSnapshot,
  type GrcSnapshot,
} from "@/lib/snapshot/grc-snapshot";
import { getSupabaseClient } from "@/lib/supabase/client";
import { fetchOwnedTableOptional } from "@/lib/supabase/owned";
import type { EntityComment } from "@/lib/types/entity-comment";
import type { FollowUp } from "@/lib/types/follow-up";
import { isFollowUpOpen } from "@/lib/types/follow-up";

function FeedbackPageContent() {
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") === "audit" ? "audit" : "actions";
  const focus = searchParams.get("focus") ?? "";
  const { people, feedbackReady } = useSettings();
  const [snapshot, setSnapshot] = useState<GrcSnapshot>(emptyGrcSnapshot);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [comments, setComments] = useState<EntityComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (ownerId: string) => {
      setError(null);
      try {
        const supabase = getSupabaseClient();
        const nextSnapshot = await fetchGrcSnapshot(supabase, ownerId, "home");
        setSnapshot(nextSnapshot);

        if (!feedbackReady) {
          setFollowUps([]);
          setComments([]);
          return;
        }

        const [nextFollowUps, nextComments] = await Promise.all([
          fetchOwnedTableOptional<FollowUp>(supabase, "follow_ups", ownerId, {
            order: "created_at",
            ascending: false,
          }),
          fetchOwnedTableOptional<EntityComment>(
            supabase,
            "entity_comments",
            ownerId,
            { order: "created_at", ascending: false },
          ),
        ]);
        setFollowUps(nextFollowUps);
        setComments(nextComments);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load feedback loops",
        );
      } finally {
        setLoading(false);
      }
    },
    [feedbackReady],
  );

  const { user, authLoading } = useRequireAuth(load);

  const titles = useMemo(() => {
    const map: Record<string, string> = {};
    for (const risk of snapshot.risks) {
      map[risk.id] = risk.title;
    }
    for (const control of snapshot.controls) {
      map[control.id] = control.title;
    }
    for (const incident of snapshot.incidents) {
      map[incident.id] = incident.title;
    }
    for (const issue of snapshot.issues) {
      map[issue.id] = issue.title;
    }
    return map;
  }, [snapshot]);

  const audit = useMemo(
    () =>
      buildAuditTrail({
        riskEvents: snapshot.riskEvents,
        incidentEvents: snapshot.incidentEvents,
        comments,
        issueComments: snapshot.comments,
        reviews: snapshot.reviews,
        tests: snapshot.tests,
        followUps,
        titles,
      }).slice(0, 80),
    [comments, followUps, snapshot, titles],
  );

  const openCount = followUps.filter((item) => isFollowUpOpen(item.status)).length;

  if (authLoading) {
    return <PageLoading />;
  }

  return (
    <div className={pageClassName}>
      <main className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-8">
        <PageHeader
          title="Feedback"
          description="Actions raised when something changes, plus the audit trail across registers. Issue remediation plans stay on the issue itself."
          breadcrumbs={[
            { href: "/", label: "Home" },
            { label: "Feedback" },
          ]}
        />

        <nav
          aria-label="Feedback views"
          className="flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1 dark:border-slate-800 dark:bg-slate-900"
        >
          <a
            href="/feedback"
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              tab === "actions"
                ? "bg-white text-slate-950 shadow-sm dark:bg-slate-800 dark:text-slate-50"
                : "text-slate-600 dark:text-slate-400"
            }`}
          >
            Actions ({openCount})
          </a>
          <a
            href="/feedback?tab=audit"
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              tab === "audit"
                ? "bg-white text-slate-950 shadow-sm dark:bg-slate-800 dark:text-slate-50"
                : "text-slate-600 dark:text-slate-400"
            }`}
          >
            Audit trail
          </a>
        </nav>

        <ErrorBanner message={error} />

        {!feedbackReady ? (
          <SchemaNotice>
            Run <code className="font-mono">supabase/schema/011_feedback.sql</code>{" "}
            after <code className="font-mono">010_residual.sql</code> to store
            follow-ups and comments.
          </SchemaNotice>
        ) : null}

        {loading ? (
          <p className={mutedTextClassName}>Loading feedback...</p>
        ) : tab === "audit" ? (
          <SectionCard
            title="Audit trail"
            description="Assembled from risk and incident changes, RCSA reviews, control tests, comments, and follow-ups. Not a separate events table."
          >
            <RecordLinkList
              items={audit.map((entry) => ({
                id: entry.id,
                href: entry.href,
                title: entry.title,
                detail: `${entry.source} · ${entry.detail}`,
                meta: new Date(entry.at).toLocaleString(),
              }))}
              empty="No trail entries yet."
              limit={80}
            />
          </SectionCard>
        ) : (
          <FollowUpList
            owner={
              user?.email ? { id: user.id, email: user.email } : null
            }
            enabled={feedbackReady}
            people={people}
            focusId={focus}
            title="Action list"
            description="Open loops close when you retest, reassess, or dismiss them. Approvers are directory people, not extra logins."
          />
        )}
      </main>
    </div>
  );
}

export default function FeedbackPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <FeedbackPageContent />
    </Suspense>
  );
}
