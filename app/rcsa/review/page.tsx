"use client";

import Link from "next/link";
import {
  FormEvent,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ErrorBanner,
  PageHeader,
  PageLoading,
} from "@/app/components/page-parts";
import { RiskScorePicker } from "@/app/components/risk-score-picker";
import { SeverityBandBadge } from "@/app/components/status-badge";
import {
  mutedTextClassName,
  pageClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
} from "@/app/components/ui";
import { ControlsSummaryCard } from "@/app/rcsa/_components/controls-summary-card";
import { EvidenceBriefCard } from "@/app/rcsa/_components/evidence-brief";
import { IncidentsSummaryCard } from "@/app/rcsa/_components/incidents-summary-card";
import { IssuesSummaryCard } from "@/app/rcsa/_components/issues-summary-card";
import { ResidualInsight } from "@/app/rcsa/_components/residual-insight";
import { getRiskScore, getSeverityBand } from "@/lib/dashboard/analytics";
import { useRequireAuth } from "@/lib/hooks/use-require-auth";
import {
  buildEvidenceBrief,
  buildIndicativeResidual,
} from "@/lib/rcsa/review-insight";
import { getSupabaseClient } from "@/lib/supabase/client";
import { throwIfAnyQueryError } from "@/lib/supabase/owned";
import {
  groupIncidentRiskRowsByRisk,
  INCIDENT_RISK_INCIDENT_SELECT,
  type IncidentRiskIncidentRow,
} from "@/lib/types/incident-risk";
import {
  groupIssuesByRisk,
  ISSUE_RISK_ISSUE_SELECT,
  type IssueRiskIssueRow,
} from "@/lib/types/issue-links";
import type {
  LinkedControl,
  LinkedIncident,
  LinkedIssue,
} from "@/lib/types/linked-entities";
import { toRcsaReviewInsertPayload, formatLastReviewedAt, type RcsaReview } from "@/lib/types/rcsa";
import { formatImpactOption, formatLikelihoodOption, type Risk } from "@/lib/types/risk";
import {
  groupRiskControlRows,
  RISK_CONTROL_SELECT,
  type RiskControlRow,
} from "@/lib/types/risk-control";

function RcsaReviewPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionFromUrl = searchParams.get("session") ?? "";
  const riskIds = useMemo(() => {
    const multi = (searchParams.get("risks") ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    const single = (searchParams.get("risk") ?? "").trim();

    if (multi.length > 0) {
      return multi;
    }

    return single ? [single] : [];
  }, [searchParams]);

  const creatingSessionRef = useRef(false);
  const [createdSessionId, setCreatedSessionId] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [risk, setRisk] = useState<Risk | null>(null);
  const [linkedControls, setLinkedControls] = useState<LinkedControl[]>([]);
  const [linkedIncidents, setLinkedIncidents] = useState<LinkedIncident[]>([]);
  const [linkedIssues, setLinkedIssues] = useState<LinkedIssue[]>([]);
  const [lastReview, setLastReview] = useState<Pick<
    RcsaReview,
    | "reviewed_at"
    | "final_likelihood"
    | "final_impact"
  > | null>(null);
  const [likelihood, setLikelihood] = useState(3);
  const [impact, setImpact] = useState(3);
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { user, authLoading } = useRequireAuth();

  // The session id lives in the URL once created, so a refresh resumes it.
  const sessionId = sessionFromUrl || createdSessionId;
  const currentRiskId = riskIds[currentIndex] ?? null;
  const isLastRisk = currentIndex >= riskIds.length - 1;
  const loadingRisk = !risk || risk.id !== currentRiskId;
  const evidenceBrief = useMemo(
    () =>
      buildEvidenceBrief({
        controls: linkedControls,
        incidents: linkedIncidents,
        issues: linkedIssues,
      }),
    [linkedControls, linkedIncidents, linkedIssues],
  );
  const residual = useMemo(
    () => buildIndicativeResidual(likelihood, impact, linkedControls),
    [impact, likelihood, linkedControls],
  );

  const loadCurrentRisk = useCallback(
    async (ownerId: string, riskId: string) => {
      try {
        const supabase = getSupabaseClient();
        const [
          riskResult,
          controlsResult,
          incidentsResult,
          issuesResult,
          lastReviewResult,
        ] = await Promise.all([
          supabase
            .from("risks")
            .select("*")
            .eq("id", riskId)
            .eq("owner_id", ownerId)
            .maybeSingle(),
          supabase
            .from("risk_controls")
            .select(RISK_CONTROL_SELECT)
            .eq("owner_id", ownerId)
            .eq("risk_id", riskId),
          supabase
            .from("incident_risks")
            .select(INCIDENT_RISK_INCIDENT_SELECT)
            .eq("owner_id", ownerId)
            .eq("risk_id", riskId),
          supabase
            .from("issue_risks")
            .select(ISSUE_RISK_ISSUE_SELECT)
            .eq("owner_id", ownerId)
            .eq("risk_id", riskId),
          supabase
            .from("rcsa_reviews")
            .select("reviewed_at, final_likelihood, final_impact")
            .eq("owner_id", ownerId)
            .eq("risk_id", riskId)
            .order("reviewed_at", { ascending: false })
            .limit(1),
        ]);

        throwIfAnyQueryError([
          riskResult,
          controlsResult,
          incidentsResult,
          issuesResult,
          lastReviewResult,
        ]);

        if (!riskResult.data) {
          throw new Error("Risk not found or you do not have access to it");
        }

        const loadedRisk = riskResult.data as Risk;
        setLikelihood(loadedRisk.likelihood);
        setImpact(loadedRisk.impact);
        setLinkedControls(
          groupRiskControlRows(
            (controlsResult.data ?? []) as RiskControlRow[],
          )[riskId] ?? [],
        );
        setLinkedIncidents(
          groupIncidentRiskRowsByRisk(
            (incidentsResult.data ?? []) as IncidentRiskIncidentRow[],
          )[riskId] ?? [],
        );
        setLinkedIssues(
          groupIssuesByRisk(
            (issuesResult.data ?? []) as IssueRiskIssueRow[],
          )[riskId] ?? [],
        );
        setLastReview(
          ((lastReviewResult.data ?? []) as Pick<
            RcsaReview,
            "reviewed_at" | "final_likelihood" | "final_impact"
          >[])[0] ?? null,
        );
        setError(null);
        setRisk(loadedRisk);
      } catch (err) {
        setRisk(null);
        setLinkedControls([]);
        setLinkedIncidents([]);
        setLinkedIssues([]);
        setLastReview(null);
        setError(
          err instanceof Error ? err.message : "Failed to load risk for review",
        );
      }
    },
    [],
  );

  const createSession = useCallback(
    async (ownerId: string, ownerEmail: string | undefined) => {
      // Guard against a second insert while the first is still in flight.
      if (creatingSessionRef.current) {
        return;
      }

      creatingSessionRef.current = true;

      try {
        const supabase = getSupabaseClient();
        const { data, error: insertError } = await supabase
          .from("rcsa_sessions")
          .insert({ owner_id: ownerId, owner_email: ownerEmail })
          .select("id")
          .single();

        if (insertError) {
          throw insertError;
        }

        if (!data?.id) {
          throw new Error("Failed to create risk assessment session");
        }

        setCreatedSessionId(data.id as string);

        const params = new URLSearchParams(searchParams.toString());
        params.set("session", data.id as string);
        router.replace(`/rcsa/review?${params.toString()}`);
      } catch (err) {
        creatingSessionRef.current = false;
        setError(
          err instanceof Error
            ? err.message
            : "Failed to start risk assessment session",
        );
      }
    },
    [router, searchParams],
  );

  // Both effects below synchronise with Supabase off the URL-driven session and
  // risk ids, so the state they set lands in an async callback rather than
  // during the effect body itself.
  useEffect(() => {
    if (!user || sessionId || riskIds.length === 0) {
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    void createSession(user.id, user.email);
  }, [createSession, riskIds.length, sessionId, user]);

  useEffect(() => {
    if (!user || !currentRiskId || completed || !sessionId) {
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadCurrentRisk(user.id, currentRiskId);
  }, [completed, currentRiskId, loadCurrentRisk, sessionId, user]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!user || !risk || !sessionId) {
      return;
    }

    if (!user.email) {
      setError("User email not available");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();
      const payload = toRcsaReviewInsertPayload(
        {
          session_id: sessionId,
          risk_id: risk.id,
          previous_likelihood: risk.likelihood,
          previous_impact: risk.impact,
          final_likelihood: likelihood,
          final_impact: impact,
        },
        { id: user.id, email: user.email },
      );

      const { error: updateError } = await supabase
        .from("risks")
        .update({ likelihood, impact })
        .eq("id", risk.id)
        .eq("owner_id", user.id);

      if (updateError) {
        throw updateError;
      }

      const { error: insertError } = await supabase
        .from("rcsa_reviews")
        .insert(payload);

      if (insertError) {
        throw insertError;
      }

      if (isLastRisk) {
        setCompleted(true);
        setRisk(null);
      } else {
        setCurrentIndex((current) => current + 1);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to submit RCSA review",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function handleSkip() {
    if (
      risk &&
      (likelihood !== risk.likelihood || impact !== risk.impact)
    ) {
      const confirmed = window.confirm(
        "You changed the rating. Skip without saving this review?",
      );

      if (!confirmed) {
        return;
      }
    }

    if (isLastRisk) {
      setCompleted(true);
      setRisk(null);
      return;
    }

    setCurrentIndex((current) => current + 1);
  }

  if (authLoading) {
    return <PageLoading />;
  }

  if (riskIds.length === 0) {
    return (
      <div className={pageClassName}>
        <main className="mx-auto flex w-full max-w-3xl flex-col gap-4">
          <PageHeader
            title="Risk Assessment"
            description="No risk selected for review. Choose risks from the assessment checklist or open a risk and click Review This Risk."
          />
          <div className="flex flex-wrap gap-3">
            <Link href="/rcsa/start" className={primaryButtonClassName}>
              Go to Risk Assessment
            </Link>
            <Link href="/risks" className={secondaryButtonClassName}>
              Back to risks
            </Link>
          </div>
        </main>
      </div>
    );
  }

  if (!sessionId) {
    return <PageLoading label={error ?? "Preparing review session..."} />;
  }

  if (completed) {
    return (
      <div className={pageClassName}>
        <main className="mx-auto flex w-full max-w-3xl flex-col gap-6">
          <PageHeader
            title="Risk Assessment Complete"
            description={`You reviewed ${riskIds.length} risk${
              riskIds.length === 1 ? "" : "s"
            } in this session.`}
          />
          <div className="flex flex-wrap gap-3">
            <Link href="/risks" className={primaryButtonClassName}>
              Back to risks
            </Link>
            <Link href="/rcsa/start" className={secondaryButtonClassName}>
              Start another assessment
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className={pageClassName}>
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-8">
        <PageHeader
          title="Risk Assessment"
          description={`Risk ${currentIndex + 1} of ${riskIds.length}`}
          actions={
            <>
              {risk && (
                <Link
                  href={`/issues/new?${new URLSearchParams({
                    source: "risk_assessment",
                    risk: risk.id,
                    title: `Issue identified for risk: ${risk.title}`,
                  }).toString()}`}
                  className={secondaryButtonClassName}
                >
                  Raise Issue
                </Link>
              )}
              <Link href="/risks" className={secondaryButtonClassName}>
                Exit
              </Link>
            </>
          }
        />

        <ErrorBanner message={error} />

        {loadingRisk || !risk ? (
          <p className={mutedTextClassName}>Loading risk...</p>
        ) : (
          <>
            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-2xl font-semibold text-slate-950 dark:text-slate-50">
                <Link
                  href={`/risks/${risk.id}/edit`}
                  className="underline-offset-2 hover:underline"
                >
                  {risk.title}
                </Link>
              </h2>
              <p className={`mt-3 whitespace-pre-wrap ${mutedTextClassName}`}>
                {risk.description}
              </p>
              {lastReview && (
                <p className={`mt-3 text-sm ${mutedTextClassName}`}>
                  Last reviewed {formatLastReviewedAt(lastReview.reviewed_at)}{" "}
                  at {formatLikelihoodOption(lastReview.final_likelihood)} ×{" "}
                  {formatImpactOption(lastReview.final_impact)}.
                </p>
              )}
              <dl className="mt-6 grid gap-4 sm:grid-cols-3">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Current likelihood
                  </dt>
                  <dd className="mt-1 text-sm font-medium text-slate-950 dark:text-slate-50">
                    {formatLikelihoodOption(risk.likelihood)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Current impact
                  </dt>
                  <dd className="mt-1 text-sm font-medium text-slate-950 dark:text-slate-50">
                    {formatImpactOption(risk.impact)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Current score
                  </dt>
                  <dd className="mt-1 flex flex-wrap items-center gap-2 text-sm font-medium text-slate-950 dark:text-slate-50">
                    {getRiskScore(risk.likelihood, risk.impact)}
                    <SeverityBandBadge
                      band={getSeverityBand(
                        getRiskScore(risk.likelihood, risk.impact),
                      )}
                    />
                  </dd>
                </div>
              </dl>
            </section>

            <EvidenceBriefCard brief={evidenceBrief} />

            {/* Keyed on the risk so each card starts collapsed for the next risk. */}
            <ControlsSummaryCard key={`controls-${risk.id}`} links={linkedControls} />
            <IncidentsSummaryCard
              key={`incidents-${risk.id}`}
              links={linkedIncidents}
            />
            <IssuesSummaryCard key={`issues-${risk.id}`} links={linkedIssues} />

            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-lg font-medium text-slate-950 dark:text-slate-50">
                Confirm inherent rating
              </h2>
              <p className={`mt-1 text-sm ${mutedTextClassName}`}>
                Click a cell to confirm or change likelihood and impact. Residual
                below updates as an indicative view of control effectiveness —
                it is not saved separately.
              </p>

              <div className="mt-6 space-y-6">
                <ResidualInsight residual={residual} />

                <form
                  onSubmit={(event) => void handleSubmit(event)}
                  className="space-y-6"
                >
                  <RiskScorePicker
                    likelihood={likelihood}
                    impact={impact}
                    onChange={(next) => {
                      setLikelihood(next.likelihood);
                      setImpact(next.impact);
                    }}
                  />

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="submit"
                      disabled={submitting}
                      className={primaryButtonClassName}
                    >
                      {submitting
                        ? "Saving..."
                        : isLastRisk
                          ? "Submit Review & Finish"
                          : "Submit Review & Next"}
                    </button>
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={handleSkip}
                      className={secondaryButtonClassName}
                    >
                      {isLastRisk ? "Skip & Finish" : "Skip"}
                    </button>
                  </div>
                </form>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

export default function RcsaReviewPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <RcsaReviewPageContent />
    </Suspense>
  );
}
