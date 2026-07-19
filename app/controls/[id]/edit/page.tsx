"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase/client";
import {
  toControlFormPayload,
  type Control,
  type NewControl,
} from "@/lib/types/control";
import type { Risk } from "@/lib/types/risk";
import {
  groupRiskControlRowsByControl,
  type LinkedRisk,
  type RiskControlRiskRow,
} from "@/lib/types/risk-control";
import {
  toControlTestResultPayload,
  type ControlTestResult,
  type NewControlTestResult,
} from "@/lib/types/control-test-result";
import { ControlFormFields } from "../../_components/control-form-fields";
import { LinkedRisksPanel } from "../../_components/linked-risks-panel";
import { TestHistoryPanel } from "../../_components/test-history-panel";

export default function EditControlPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const controlId = params.id;

  const [user, setUser] = useState<User | null>(null);
  const [control, setControl] = useState<Control | null>(null);
  const [form, setForm] = useState<NewControl | null>(null);
  const [userRisks, setUserRisks] = useState<Risk[]>([]);
  const [linkedRisks, setLinkedRisks] = useState<LinkedRisk[]>([]);
  const [selectedRiskId, setSelectedRiskId] = useState("");
  const [riskSearch, setRiskSearch] = useState("");
  const [linking, setLinking] = useState(false);
  const [unlinkingLinkId, setUnlinkingLinkId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<ControlTestResult[]>([]);
  const [loadingTestResults, setLoadingTestResults] = useState(true);
  const [recordingTest, setRecordingTest] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchControl = useCallback(async (ownerId: string) => {
    const supabase = getSupabaseClient();
    const { data, error: fetchError } = await supabase
      .from("controls")
      .select("*")
      .eq("id", controlId)
      .eq("owner_id", ownerId)
      .maybeSingle();

    if (fetchError) {
      throw fetchError;
    }

    if (!data) {
      return null;
    }

    return data as Control;
  }, [controlId]);

  const fetchUserRisks = useCallback(async (ownerId: string) => {
    const supabase = getSupabaseClient();
    const { data, error: fetchError } = await supabase
      .from("risks")
      .select("*")
      .eq("owner_id", ownerId)
      .order("title", { ascending: true });

    if (fetchError) {
      throw fetchError;
    }

    setUserRisks(data ?? []);
  }, []);

  const fetchTestResults = useCallback(async (ownerId: string) => {
    const supabase = getSupabaseClient();
    const { data, error: fetchError } = await supabase
      .from("control_test_results")
      .select("*")
      .eq("control_id", controlId)
      .eq("owner_id", ownerId)
      .order("tested_at", { ascending: false })
      .order("created_at", { ascending: false });

    if (fetchError) {
      throw fetchError;
    }

    setTestResults((data ?? []) as ControlTestResult[]);
  }, [controlId]);

  const fetchRiskControlLinks = useCallback(async (ownerId: string) => {
    const supabase = getSupabaseClient();
    const { data, error: fetchError } = await supabase
      .from("risk_controls")
      .select(
        "id, risk_id, control_id, risks(title, likelihood, impact, owner_email)",
      )
      .eq("owner_id", ownerId)
      .eq("control_id", controlId);

    if (fetchError) {
      throw fetchError;
    }

    const grouped = groupRiskControlRowsByControl(
      (data ?? []) as RiskControlRiskRow[],
    );
    setLinkedRisks(grouped[controlId] ?? []);
  }, [controlId]);

  const loadPageData = useCallback(
    async (ownerId: string) => {
      setError(null);

      try {
        const loadedControl = await fetchControl(ownerId);

        if (!loadedControl) {
          router.replace("/controls");
          return;
        }

        setControl(loadedControl);
        setForm({
          title: loadedControl.title,
          description: loadedControl.description,
          is_key: loadedControl.is_key,
          effectiveness: loadedControl.effectiveness,
          last_tested_at: loadedControl.last_tested_at,
        });

        await Promise.all([
          fetchUserRisks(ownerId),
          fetchRiskControlLinks(ownerId),
          fetchTestResults(ownerId),
        ]);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load control",
        );
      } finally {
        setLoading(false);
        setLoadingTestResults(false);
      }
    },
    [fetchControl, fetchRiskControlLinks, fetchTestResults, fetchUserRisks, router],
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
      await loadPageData(session.user.id);
    }

    void checkAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.replace("/login");
        return;
      }

      setUser(session.user);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [loadPageData, router]);

  function updateForm(updates: Partial<NewControl>) {
    setForm((current) => (current ? { ...current, ...updates } : current));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form || !control) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();
      const { error: updateError } = await supabase
        .from("controls")
        .update(toControlFormPayload(form))
        .eq("id", control.id);

      if (updateError) {
        throw updateError;
      }

      router.push("/controls");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update control");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!control) {
      return;
    }

    const confirmed = window.confirm(
      `Delete "${control.title}"? This action cannot be undone.`,
    );

    if (!confirmed) {
      return;
    }

    setDeleting(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();
      const { error: deleteError } = await supabase
        .from("controls")
        .delete()
        .eq("id", control.id);

      if (deleteError) {
        throw deleteError;
      }

      router.push("/controls");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete control");
    } finally {
      setDeleting(false);
    }
  }

  async function handleLinkRisk() {
    if (!selectedRiskId || !user) {
      return;
    }

    setLinking(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();
      const { error: linkError } = await supabase.from("risk_controls").insert({
        risk_id: selectedRiskId,
        control_id: controlId,
        owner_id: user.id,
      });

      if (linkError) {
        throw linkError;
      }

      setSelectedRiskId("");
      setRiskSearch("");
      await fetchRiskControlLinks(user.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to link risk");
    } finally {
      setLinking(false);
    }
  }

  async function handleRecordTestResult(payload: NewControlTestResult) {
    if (!user || !control) {
      throw new Error("You must be signed in to record a test result");
    }

    if (!user.email) {
      throw new Error("User email not available");
    }

    setRecordingTest(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();
      const testPayload = toControlTestResultPayload(payload);

      const { error: insertError } = await supabase
        .from("control_test_results")
        .insert({
          ...testPayload,
          control_id: controlId,
          owner_id: user.id,
          owner_email: user.email,
        });

      if (insertError) {
        throw insertError;
      }

      const { error: updateError } = await supabase
        .from("controls")
        .update({
          effectiveness: testPayload.effectiveness,
          last_tested_at: testPayload.tested_at,
        })
        .eq("id", control.id);

      if (updateError) {
        throw updateError;
      }

      setControl((current) =>
        current
          ? {
              ...current,
              effectiveness: testPayload.effectiveness,
              last_tested_at: testPayload.tested_at,
            }
          : current,
      );
      setForm((current) =>
        current
          ? {
              ...current,
              effectiveness: testPayload.effectiveness,
              last_tested_at: testPayload.tested_at,
            }
          : current,
      );

      await fetchTestResults(user.id);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to record test result";
      setError(message);
      throw err;
    } finally {
      setRecordingTest(false);
    }
  }

  async function handleUnlinkRisk(linkId: string) {
    if (!user) {
      return;
    }

    setUnlinkingLinkId(linkId);
    setError(null);

    try {
      const supabase = getSupabaseClient();
      const { error: unlinkError } = await supabase
        .from("risk_controls")
        .delete()
        .eq("id", linkId);

      if (unlinkError) {
        throw unlinkError;
      }

      await fetchRiskControlLinks(user.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to unlink risk");
    } finally {
      setUnlinkingLinkId(null);
    }
  }

  if (authLoading || loading || !form || !control) {
    return (
      <div className="flex min-h-full items-center justify-center bg-zinc-50 dark:bg-black">
        <p className="text-zinc-600 dark:text-zinc-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-zinc-50 px-6 py-10 dark:bg-black">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <header>
          <Link
            href="/controls"
            className="text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
          >
            ← Back to controls
          </Link>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            Edit Control
          </h1>
        </header>

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        )}

        <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
            <ControlFormFields form={form} onChange={updateForm} />

            <div className="flex flex-wrap gap-3 sm:col-span-2">
              <button
                type="submit"
                disabled={submitting || deleting}
                className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-600 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-teal-400 dark:text-slate-950 dark:hover:bg-teal-300"
              >
                {submitting ? "Saving..." : "Save Changes"}
              </button>
              <Link
                href="/controls"
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                Cancel
              </Link>
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={submitting || deleting}
                className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950"
              >
                {deleting ? "Deleting..." : "Delete Control"}
              </button>
            </div>
          </form>
        </section>

        <TestHistoryPanel
          testResults={testResults}
          loading={loadingTestResults}
          recording={recordingTest}
          onRecordTestResult={handleRecordTestResult}
        />

        <LinkedRisksPanel
          links={linkedRisks}
          userRisks={userRisks}
          selectedRiskId={selectedRiskId}
          riskSearch={riskSearch}
          linking={linking}
          unlinkingLinkId={unlinkingLinkId}
          onRiskSearchChange={setRiskSearch}
          onSelectedRiskChange={setSelectedRiskId}
          onLink={() => void handleLinkRisk()}
          onUnlink={(linkId) => void handleUnlinkRisk(linkId)}
        />
      </main>
    </div>
  );
}
