"use client";

import Link from "next/link";
import {
  FormEvent,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { ControlsSummaryCard } from "@/app/rcsa/_components/controls-summary-card";
import { IncidentsSummaryCard } from "@/app/rcsa/_components/incidents-summary-card";
import { getSupabaseClient } from "@/lib/supabase/client";
import {
  toRcsaReviewInsertPayload,
} from "@/lib/types/rcsa";
import type { Risk } from "@/lib/types/risk";
import {
  groupIncidentRiskRowsByRisk,
  type IncidentRiskIncidentRow,
  type LinkedIncident,
} from "@/lib/types/incident-risk";
import {
  groupRiskControlRows,
  type LinkedControl,
  type RiskControlRow,
} from "@/lib/types/risk-control";

const ratingSelectClassName =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-950 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50 dark:focus:border-teal-400 dark:focus:ring-teal-400/20";

function RcsaReviewPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session") ?? "";
  const riskIds = useMemo(() => {
    const raw = searchParams.get("risks") ?? "";
    return raw
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
  }, [searchParams]);

  const [user, setUser] = useState<User | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [risk, setRisk] = useState<Risk | null>(null);
  const [linkedControls, setLinkedControls] = useState<LinkedControl[]>([]);
  const [linkedIncidents, setLinkedIncidents] = useState<LinkedIncident[]>([]);
  const [likelihood, setLikelihood] = useState(3);
  const [impact, setImpact] = useState(3);
  const [controlsExpanded, setControlsExpanded] = useState(false);
  const [incidentsExpanded, setIncidentsExpanded] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [loadingRisk, setLoadingRisk] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentRiskId = riskIds[currentIndex] ?? null;
  const isLastRisk = currentIndex >= riskIds.length - 1;

  const loadCurrentRisk = useCallback(
    async (ownerId: string, riskId: string) => {
      setLoadingRisk(true);
      setError(null);
      setControlsExpanded(false);
      setIncidentsExpanded(false);

      try {
        const supabase = getSupabaseClient();
        const [riskResult, controlsResult, incidentsResult] = await Promise.all([
          supabase
            .from("risks")
            .select("*")
            .eq("id", riskId)
            .eq("owner_id", ownerId)
            .maybeSingle(),
          supabase
            .from("risk_controls")
            .select(
              "id, risk_id, control_id, controls(title, effectiveness, last_tested_at, is_key)",
            )
            .eq("owner_id", ownerId)
            .eq("risk_id", riskId),
          supabase
            .from("incident_risks")
            .select(
              "id, incident_id, risk_id, incidents(title, date_occurred, severity, status)",
            )
            .eq("owner_id", ownerId)
            .eq("risk_id", riskId),
        ]);

        if (riskResult.error) {
          throw riskResult.error;
        }

        if (controlsResult.error) {
          throw controlsResult.error;
        }

        if (incidentsResult.error) {
          throw incidentsResult.error;
        }

        if (!riskResult.data) {
          throw new Error("Risk not found or you do not have access to it");
        }

        const loadedRisk = riskResult.data as Risk;
        setRisk(loadedRisk);
        setLikelihood(loadedRisk.likelihood);
        setImpact(loadedRisk.impact);

        const controlGrouped = groupRiskControlRows(
          (controlsResult.data ?? []) as RiskControlRow[],
        );
        setLinkedControls(controlGrouped[riskId] ?? []);

        const incidentGrouped = groupIncidentRiskRowsByRisk(
          (incidentsResult.data ?? []) as IncidentRiskIncidentRow[],
        );
        setLinkedIncidents(incidentGrouped[riskId] ?? []);
      } catch (err) {
        setRisk(null);
        setLinkedControls([]);
        setLinkedIncidents([]);
        setError(
          err instanceof Error ? err.message : "Failed to load risk for review",
        );
      } finally {
        setLoadingRisk(false);
      }
    },
    [],
  );

  useEffect(() => {
    const supabase = getSupabaseClient();

    async function checkAuth() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/login");
        return;
      }

      setUser(session.user);
      setAuthLoading(false);
    }

    void checkAuth();
  }, [router]);

  useEffect(() => {
    if (!user || !currentRiskId || completed) {
      return;
    }

    void loadCurrentRisk(user.id, currentRiskId);
  }, [user, currentRiskId, completed, loadCurrentRisk]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!user || !risk || !sessionId || !currentRiskId) {
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

      const { error: insertError } = await supabase
        .from("rcsa_reviews")
        .insert(payload);

      if (insertError) {
        throw insertError;
      }

      const { error: updateError } = await supabase
        .from("risks")
        .update({
          likelihood,
          impact,
        })
        .eq("id", risk.id);

      if (updateError) {
        throw updateError;
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

  if (authLoading) {
    return (
      <div className="flex min-h-full items-center justify-center bg-slate-50 dark:bg-slate-950">
        <p className="text-slate-600 dark:text-slate-400">Loading...</p>
      </div>
    );
  }

  if (!sessionId || riskIds.length === 0) {
    return (
      <div className="min-h-full bg-slate-50 px-6 py-10 dark:bg-slate-950">
        <main className="mx-auto flex w-full max-w-3xl flex-col gap-4">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
            RCSA Review
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            No active review session found. Start from the checklist to begin.
          </p>
          <Link
            href="/rcsa/start"
            className="inline-flex w-fit rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-600 dark:bg-teal-400 dark:text-slate-950 dark:hover:bg-teal-300"
          >
            Go to Start Review
          </Link>
        </main>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="min-h-full bg-slate-50 px-6 py-10 dark:bg-slate-950">
        <main className="mx-auto flex w-full max-w-3xl flex-col gap-6">
          <header>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
              RCSA Review Complete
            </h1>
            <p className="mt-2 text-slate-600 dark:text-slate-400">
              You reviewed {riskIds.length} risk
              {riskIds.length === 1 ? "" : "s"} in this session.
            </p>
          </header>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/risks"
              className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-600 dark:bg-teal-400 dark:text-slate-950 dark:hover:bg-teal-300"
            >
              Back to risks
            </Link>
            <Link
              href="/rcsa/start"
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Start another review
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-slate-50 px-6 py-10 dark:bg-slate-950">
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Risk {currentIndex + 1} of {riskIds.length}
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
              RCSA Review
            </h1>
          </div>
          <Link
            href="/risks"
            className="inline-flex shrink-0 items-center justify-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Exit
          </Link>
        </header>

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        )}

        {loadingRisk || !risk ? (
          <p className="text-slate-600 dark:text-slate-400">Loading risk...</p>
        ) : (
          <>
            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-2xl font-semibold text-slate-950 dark:text-slate-50">
                {risk.title}
              </h2>
              <p className="mt-3 whitespace-pre-wrap text-slate-600 dark:text-slate-400">
                {risk.description}
              </p>
              <dl className="mt-6 grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Current likelihood
                  </dt>
                  <dd className="mt-1 text-lg font-medium text-slate-950 dark:text-slate-50">
                    {risk.likelihood}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Current impact
                  </dt>
                  <dd className="mt-1 text-lg font-medium text-slate-950 dark:text-slate-50">
                    {risk.impact}
                  </dd>
                </div>
              </dl>
            </section>

            <ControlsSummaryCard
              links={linkedControls}
              expanded={controlsExpanded}
              onToggleExpanded={() =>
                setControlsExpanded((current) => !current)
              }
            />

            <IncidentsSummaryCard
              links={linkedIncidents}
              expanded={incidentsExpanded}
              onToggleExpanded={() =>
                setIncidentsExpanded((current) => !current)
              }
            />

            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-lg font-medium text-slate-950 dark:text-slate-50">
                Update rating
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Confirm or adjust likelihood and impact for this review.
              </p>

              <form
                onSubmit={(event) => void handleSubmit(event)}
                className="mt-6 grid gap-4 sm:grid-cols-2"
              >
                <label className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Likelihood (1-5)
                  </span>
                  <select
                    value={likelihood}
                    onChange={(event) =>
                      setLikelihood(Number(event.target.value))
                    }
                    className={ratingSelectClassName}
                  >
                    {[1, 2, 3, 4, 5].map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Impact (1-5)
                  </span>
                  <select
                    value={impact}
                    onChange={(event) => setImpact(Number(event.target.value))}
                    className={ratingSelectClassName}
                  >
                    {[1, 2, 3, 4, 5].map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-600 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-teal-400 dark:text-slate-950 dark:hover:bg-teal-300"
                  >
                    {submitting
                      ? "Saving..."
                      : isLastRisk
                        ? "Submit Review & Finish"
                        : "Submit Review & Next"}
                  </button>
                </div>
              </form>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

export default function RcsaReviewPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-full items-center justify-center bg-slate-50 dark:bg-slate-950">
          <p className="text-slate-600 dark:text-slate-400">Loading...</p>
        </div>
      }
    >
      <RcsaReviewPageContent />
    </Suspense>
  );
}
