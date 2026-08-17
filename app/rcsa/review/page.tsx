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
import { EvidenceBriefCard } from "@/app/rcsa/_components/evidence-brief";
import { ResidualInsight } from "@/app/rcsa/_components/residual-insight";
import { ReviewEvidenceLinks } from "@/app/rcsa/_components/review-evidence-links";
import { getRiskScore, getSeverityBand } from "@/lib/dashboard/analytics";
import { useRequireAuth } from "@/lib/hooks/use-require-auth";
import {
  buildEvidenceBrief,
  buildIndicativeResidual,
} from "@/lib/rcsa/review-insight";
import {
  clampResidualToInherent,
  residualBlockers,
  residualCellAllowed,
  residualWarnings,
  storedResidual,
} from "@/lib/risk/ratings";
import { useSettings } from "@/lib/settings/context";
import { getSupabaseClient } from "@/lib/supabase/client";
import { throwIfAnyQueryError } from "@/lib/supabase/owned";
import { isIssueOpen } from "@/lib/types/issue";
import type {
  LinkedControl,
  LinkedIncident,
  LinkedIssue,
} from "@/lib/types/linked-entities";
import {
  formatLastReviewedAt,
  toRcsaReviewInsertPayload,
  type RcsaReview,
} from "@/lib/types/rcsa";
import {
  formatImpactOption,
  formatLikelihoodOption,
  type Risk,
} from "@/lib/types/risk";

function RcsaReviewPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { residualReady } = useSettings();
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
  const residualTouchedRef = useRef(false);
  const [createdSessionId, setCreatedSessionId] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [risk, setRisk] = useState<Risk | null>(null);
  const [linkedControls, setLinkedControls] = useState<LinkedControl[]>([]);
  const [linkedIncidents, setLinkedIncidents] = useState<LinkedIncident[]>([]);
  const [linkedIssues, setLinkedIssues] = useState<LinkedIssue[]>([]);
  const [lastReview, setLastReview] = useState<Pick<
    RcsaReview,
    "reviewed_at" | "final_likelihood" | "final_impact"
  > | null>(null);
  const [likelihood, setLikelihood] = useState(3);
  const [impact, setImpact] = useState(3);
  const [residualLikelihood, setResidualLikelihood] = useState(3);
  const [residualImpact, setResidualImpact] = useState(3);
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { user, authLoading } = useRequireAuth();
  const sessionId = sessionFromUrl || createdSessionId;
  const currentRiskId = riskIds[currentIndex] ?? null;
  const isLastRisk = currentIndex >= riskIds.length - 1;
  const loadingRisk = !risk || risk.id !== currentRiskId;
  const returnTo = `/rcsa/review?${searchParams.toString()}`;

  const handleLinksChange = useCallback(
    (links: {
      controls: LinkedControl[];
      incidents: LinkedIncident[];
      issues: LinkedIssue[];
    }) => {
      setLinkedControls(links.controls);
      setLinkedIncidents(links.incidents);
      setLinkedIssues(links.issues);
    },
    [],
  );

  const evidenceBrief = useMemo(
    () =>
      buildEvidenceBrief({
        controls: linkedControls,
        incidents: linkedIncidents,
        issues: linkedIssues,
      }),
    [linkedControls, linkedIncidents, linkedIssues],
  );
  const indicative = useMemo(
    () => buildIndicativeResidual(likelihood, impact, linkedControls),
    [impact, likelihood, linkedControls],
  );
  const confirmedResidual = {
    likelihood: residualLikelihood,
    impact: residualImpact,
  };
  const blockers = residualReady
    ? residualBlockers(
        { likelihood, impact },
        confirmedResidual,
        { controlCount: linkedControls.length, required: true },
      )
    : [];
  const warnings = residualReady
    ? residualWarnings(
        { likelihood, impact },
        confirmedResidual,
        indicative,
        {
          controlCount: linkedControls.length,
          openHighIncidents: linkedIncidents.filter(
            (incident) =>
              incident.status !== "resolved" &&
              (incident.severity === "high" || incident.severity === "critical"),
          ).length,
          openHighIssues: linkedIssues.filter(
            (issue) =>
              isIssueOpen(issue.status) &&
              (issue.severity === "high" || issue.severity === "critical"),
          ).length,
        },
      )
    : [];

  const loadCurrentRisk = useCallback(
    async (ownerId: string, riskId: string) => {
      try {
        const supabase = getSupabaseClient();
        const [riskResult, lastReviewResult] = await Promise.all([
          supabase
            .from("risks")
            .select("*")
            .eq("id", riskId)
            .eq("owner_id", ownerId)
            .maybeSingle(),
          supabase
            .from("rcsa_reviews")
            .select("reviewed_at, final_likelihood, final_impact")
            .eq("owner_id", ownerId)
            .eq("risk_id", riskId)
            .order("reviewed_at", { ascending: false })
            .limit(1),
        ]);

        throwIfAnyQueryError([riskResult, lastReviewResult]);

        if (!riskResult.data) {
          throw new Error("Risk not found or you do not have access to it");
        }

        const loadedRisk = riskResult.data as Risk;
        const stored = storedResidual(loadedRisk);
        residualTouchedRef.current = Boolean(stored);
        setLikelihood(loadedRisk.likelihood);
        setImpact(loadedRisk.impact);
        setResidualLikelihood(stored?.likelihood ?? loadedRisk.likelihood);
        setResidualImpact(stored?.impact ?? loadedRisk.impact);
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

  useEffect(() => {
    if (!residualReady || residualTouchedRef.current) {
      return;
    }

    setResidualLikelihood(indicative.residualLikelihood);
    setResidualImpact(indicative.residualImpact);
  }, [indicative.residualImpact, indicative.residualLikelihood, residualReady]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!user || !risk || !sessionId) {
      return;
    }

    if (!user.email) {
      setError("User email not available");
      return;
    }

    if (blockers.length > 0) {
      setError(blockers.join(" "));
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();
      const previousResidual = storedResidual(risk);
      const payload = toRcsaReviewInsertPayload(
        {
          session_id: sessionId,
          risk_id: risk.id,
          previous_likelihood: risk.likelihood,
          previous_impact: risk.impact,
          final_likelihood: likelihood,
          final_impact: impact,
          previous_residual_likelihood: previousResidual?.likelihood ?? null,
          previous_residual_impact: previousResidual?.impact ?? null,
          final_residual_likelihood: residualLikelihood,
          final_residual_impact: residualImpact,
        },
        { id: user.id, email: user.email },
        { includeResidual: residualReady },
      );

      const { error: updateError } = await supabase
        .from("risks")
        .update({
          likelihood,
          impact,
          ...(residualReady
            ? {
                residual_likelihood: residualLikelihood,
                residual_impact: residualImpact,
              }
            : {}),
        })
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
    const residualChanged =
      residualReady &&
      risk &&
      (residualLikelihood !== (storedResidual(risk)?.likelihood ?? risk.likelihood) ||
        residualImpact !== (storedResidual(risk)?.impact ?? risk.impact));

    if (
      risk &&
      (likelihood !== risk.likelihood || impact !== risk.impact || residualChanged)
    ) {
      const confirmed = window.confirm(
        "You changed a rating. Skip without saving this review?",
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
          description={`Risk ${currentIndex + 1} of ${riskIds.length}. Confirm inherent first, link evidence, then confirm residual.`}
          actions={
            <>
              {risk && (
                <Link
                  href={`/issues/new?${new URLSearchParams({
                    source: "risk_assessment",
                    risk: risk.id,
                    title: `Issue identified for risk: ${risk.title}`,
                    returnTo,
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

        {loadingRisk || !risk || !user ? (
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
                  at inherent {formatLikelihoodOption(lastReview.final_likelihood)} ×{" "}
                  {formatImpactOption(lastReview.final_impact)}.
                </p>
              )}
              <dl className="mt-6 grid gap-4 sm:grid-cols-3">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Current inherent
                  </dt>
                  <dd className="mt-1 text-sm font-medium text-slate-950 dark:text-slate-50">
                    {formatLikelihoodOption(risk.likelihood)} ×{" "}
                    {formatImpactOption(risk.impact)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Current residual
                  </dt>
                  <dd className="mt-1 text-sm font-medium text-slate-950 dark:text-slate-50">
                    {storedResidual(risk)
                      ? `${formatLikelihoodOption(storedResidual(risk)!.likelihood)} × ${formatImpactOption(storedResidual(risk)!.impact)}`
                      : "Not assessed"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Inherent score
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

            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-lg font-medium text-slate-950 dark:text-slate-50">
                1. Confirm inherent rating
              </h2>
              <p className={`mt-1 text-sm ${mutedTextClassName}`}>
                Gross exposure before crediting controls. Residual cells above
                this rating stay disabled.
              </p>
              <div className="mt-6">
                <RiskScorePicker
                  likelihood={likelihood}
                  impact={impact}
                  legend="Inherent"
                  onChange={(next) => {
                    const clamped = clampResidualToInherent(next, {
                      likelihood: residualLikelihood,
                      impact: residualImpact,
                    });
                    setLikelihood(next.likelihood);
                    setImpact(next.impact);
                    if (residualTouchedRef.current) {
                      setResidualLikelihood(clamped.likelihood);
                      setResidualImpact(clamped.impact);
                    }
                  }}
                />
              </div>
            </section>

            <EvidenceBriefCard brief={evidenceBrief} />

            <ReviewEvidenceLinks
              key={risk.id}
              riskId={risk.id}
              ownerId={user.id}
              returnTo={returnTo}
              onError={setError}
              onLinksChange={handleLinksChange}
            />

            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-lg font-medium text-slate-950 dark:text-slate-50">
                3. Confirm residual rating
              </h2>
              <p className={`mt-1 text-sm ${mutedTextClassName}`}>
                {residualReady
                  ? "Net exposure after current controls. This is stored on the register and compared to appetite."
                  : "Run supabase/schema/010_residual.sql to store residual separately. Until then, only inherent is saved."}
              </p>

              <div className="mt-6 space-y-6">
                <ResidualInsight residual={indicative} />
                {residualReady ? (
                  <button
                    type="button"
                    className={secondaryButtonClassName}
                    onClick={() => {
                      residualTouchedRef.current = true;
                      setResidualLikelihood(indicative.residualLikelihood);
                      setResidualImpact(indicative.residualImpact);
                    }}
                  >
                    Apply indicative residual
                  </button>
                ) : null}

                <form
                  onSubmit={(event) => void handleSubmit(event)}
                  className="space-y-6"
                >
                  {residualReady ? (
                    <RiskScorePicker
                      likelihood={residualLikelihood}
                      impact={residualImpact}
                      legend="Residual"
                      description="Disabled cells sit above inherent."
                      isCellEnabled={(cellLikelihood, cellImpact) =>
                        residualCellAllowed(
                          { likelihood, impact },
                          cellLikelihood,
                          cellImpact,
                        )
                      }
                      onChange={(next) => {
                        residualTouchedRef.current = true;
                        setResidualLikelihood(next.likelihood);
                        setResidualImpact(next.impact);
                      }}
                    />
                  ) : null}

                  {blockers.length > 0 ? (
                    <p className="text-sm text-red-700 dark:text-red-400">
                      {blockers.join(" ")}
                    </p>
                  ) : null}
                  {warnings.map((warning) => (
                    <p
                      key={warning}
                      className="text-sm text-amber-800 dark:text-amber-300"
                    >
                      {warning}
                    </p>
                  ))}

                  <div className="sticky bottom-4 z-10 flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
                    <button
                      type="submit"
                      disabled={submitting || blockers.length > 0}
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
