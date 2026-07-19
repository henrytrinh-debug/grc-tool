"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { Control } from "@/lib/types/control";
import type { Incident } from "@/lib/types/incident";
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
import { toRiskFormPayload, type NewRisk, type Risk } from "@/lib/types/risk";
import { LinkedControlsPanel } from "../../_components/linked-controls-panel";
import { LinkedIncidentsPanel } from "../../_components/linked-incidents-panel";
import { RiskFormFields } from "../../_components/risk-form-fields";

export default function EditRiskPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const riskId = params.id;

  const [user, setUser] = useState<User | null>(null);
  const [risk, setRisk] = useState<Risk | null>(null);
  const [form, setForm] = useState<NewRisk | null>(null);
  const [userControls, setUserControls] = useState<Control[]>([]);
  const [linkedControls, setLinkedControls] = useState<LinkedControl[]>([]);
  const [userIncidents, setUserIncidents] = useState<Incident[]>([]);
  const [linkedIncidents, setLinkedIncidents] = useState<LinkedIncident[]>([]);
  const [selectedControlId, setSelectedControlId] = useState("");
  const [selectedIncidentId, setSelectedIncidentId] = useState("");
  const [controlSearch, setControlSearch] = useState("");
  const [incidentSearch, setIncidentSearch] = useState("");
  const [linkingControl, setLinkingControl] = useState(false);
  const [linkingIncident, setLinkingIncident] = useState(false);
  const [unlinkingControlLinkId, setUnlinkingControlLinkId] = useState<
    string | null
  >(null);
  const [unlinkingIncidentLinkId, setUnlinkingIncidentLinkId] = useState<
    string | null
  >(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRisk = useCallback(async () => {
    const supabase = getSupabaseClient();
    const { data, error: fetchError } = await supabase
      .from("risks")
      .select("*")
      .eq("id", riskId)
      .maybeSingle();

    if (fetchError) {
      throw fetchError;
    }

    if (!data) {
      return null;
    }

    return data as Risk;
  }, [riskId]);

  const fetchUserControls = useCallback(async (ownerId: string) => {
    const supabase = getSupabaseClient();
    const { data, error: fetchError } = await supabase
      .from("controls")
      .select("*")
      .eq("owner_id", ownerId)
      .order("title", { ascending: true });

    if (fetchError) {
      throw fetchError;
    }

    setUserControls(data ?? []);
  }, []);

  const fetchRiskControlLinks = useCallback(async (ownerId: string) => {
    const supabase = getSupabaseClient();
    const { data, error: fetchError } = await supabase
      .from("risk_controls")
      .select(
        "id, risk_id, control_id, controls(title, effectiveness, last_tested_at, is_key)",
      )
      .eq("owner_id", ownerId)
      .eq("risk_id", riskId);

    if (fetchError) {
      throw fetchError;
    }

    const grouped = groupRiskControlRows((data ?? []) as RiskControlRow[]);
    setLinkedControls(grouped[riskId] ?? []);
  }, [riskId]);

  const fetchUserIncidents = useCallback(async (ownerId: string) => {
    const supabase = getSupabaseClient();
    const { data, error: fetchError } = await supabase
      .from("incidents")
      .select("*")
      .eq("owner_id", ownerId)
      .order("title", { ascending: true });

    if (fetchError) {
      throw fetchError;
    }

    setUserIncidents(data ?? []);
  }, []);

  const fetchIncidentRiskLinks = useCallback(async (ownerId: string) => {
    const supabase = getSupabaseClient();
    const { data, error: fetchError } = await supabase
      .from("incident_risks")
      .select(
        "id, incident_id, risk_id, incidents(title, date_occurred, severity, status)",
      )
      .eq("owner_id", ownerId)
      .eq("risk_id", riskId);

    if (fetchError) {
      throw fetchError;
    }

    const grouped = groupIncidentRiskRowsByRisk(
      (data ?? []) as IncidentRiskIncidentRow[],
    );
    setLinkedIncidents(grouped[riskId] ?? []);
  }, [riskId]);

  const loadPageData = useCallback(
    async (ownerId: string) => {
      setError(null);

      try {
        const loadedRisk = await fetchRisk();

        if (!loadedRisk) {
          router.replace("/risks");
          return;
        }

        setRisk(loadedRisk);
        setForm({
          title: loadedRisk.title,
          description: loadedRisk.description,
          likelihood: loadedRisk.likelihood,
          impact: loadedRisk.impact,
        });

        await Promise.all([
          fetchUserControls(ownerId),
          fetchRiskControlLinks(ownerId),
          fetchUserIncidents(ownerId),
          fetchIncidentRiskLinks(ownerId),
        ]);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load risk",
        );
      } finally {
        setLoading(false);
      }
    },
    [
      fetchIncidentRiskLinks,
      fetchRisk,
      fetchRiskControlLinks,
      fetchUserControls,
      fetchUserIncidents,
      router,
    ],
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

  function updateForm(updates: Partial<NewRisk>) {
    setForm((current) => (current ? { ...current, ...updates } : current));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form || !risk) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();
      const { error: updateError } = await supabase
        .from("risks")
        .update(toRiskFormPayload(form))
        .eq("id", risk.id);

      if (updateError) {
        throw updateError;
      }

      router.push("/risks");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update risk");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!risk) {
      return;
    }

    const confirmed = window.confirm(
      `Delete "${risk.title}"? This action cannot be undone.`,
    );

    if (!confirmed) {
      return;
    }

    setDeleting(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();
      const { error: deleteError } = await supabase
        .from("risks")
        .delete()
        .eq("id", risk.id);

      if (deleteError) {
        throw deleteError;
      }

      router.push("/risks");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete risk");
    } finally {
      setDeleting(false);
    }
  }

  async function handleLinkControl() {
    if (!selectedControlId || !user) {
      return;
    }

    setLinkingControl(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();
      const { error: linkError } = await supabase.from("risk_controls").insert({
        risk_id: riskId,
        control_id: selectedControlId,
        owner_id: user.id,
      });

      if (linkError) {
        throw linkError;
      }

      setSelectedControlId("");
      setControlSearch("");
      await fetchRiskControlLinks(user.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to link control");
    } finally {
      setLinkingControl(false);
    }
  }

  async function handleUnlinkControl(linkId: string) {
    if (!user) {
      return;
    }

    setUnlinkingControlLinkId(linkId);
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
      setError(err instanceof Error ? err.message : "Failed to unlink control");
    } finally {
      setUnlinkingControlLinkId(null);
    }
  }

  async function handleLinkIncident() {
    if (!selectedIncidentId || !user) {
      return;
    }

    setLinkingIncident(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();
      const { error: linkError } = await supabase.from("incident_risks").insert({
        incident_id: selectedIncidentId,
        risk_id: riskId,
        owner_id: user.id,
      });

      if (linkError) {
        throw linkError;
      }

      setSelectedIncidentId("");
      setIncidentSearch("");
      await fetchIncidentRiskLinks(user.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to link incident");
    } finally {
      setLinkingIncident(false);
    }
  }

  async function handleUnlinkIncident(linkId: string) {
    if (!user) {
      return;
    }

    setUnlinkingIncidentLinkId(linkId);
    setError(null);

    try {
      const supabase = getSupabaseClient();
      const { error: unlinkError } = await supabase
        .from("incident_risks")
        .delete()
        .eq("id", linkId);

      if (unlinkError) {
        throw unlinkError;
      }

      await fetchIncidentRiskLinks(user.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to unlink incident");
    } finally {
      setUnlinkingIncidentLinkId(null);
    }
  }

  if (authLoading || loading || !form || !risk) {
    return (
      <div className="flex min-h-full items-center justify-center bg-zinc-50 dark:bg-black">
        <p className="text-zinc-600 dark:text-zinc-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-zinc-50 px-6 py-10 dark:bg-black">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link
              href="/risks"
              className="text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
            >
              ← Back to risks
            </Link>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
              Edit Risk
            </h1>
          </div>
          <Link
            href={`/rcsa/review?risk=${risk.id}`}
            className="inline-flex shrink-0 items-center justify-center rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-600 dark:bg-teal-400 dark:text-slate-950 dark:hover:bg-teal-300"
          >
            Review This Risk
          </Link>
        </header>

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        )}

        <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
            <RiskFormFields form={form} onChange={updateForm} />

            <div className="flex flex-wrap gap-3 sm:col-span-2">
              <button
                type="submit"
                disabled={submitting || deleting}
                className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-600 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-teal-400 dark:text-slate-950 dark:hover:bg-teal-300"
              >
                {submitting ? "Saving..." : "Save Changes"}
              </button>
              <Link
                href="/risks"
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
                {deleting ? "Deleting..." : "Delete Risk"}
              </button>
            </div>
          </form>
        </section>

        <LinkedControlsPanel
          links={linkedControls}
          userControls={userControls}
          selectedControlId={selectedControlId}
          controlSearch={controlSearch}
          linking={linkingControl}
          unlinkingLinkId={unlinkingControlLinkId}
          onControlSearchChange={setControlSearch}
          onSelectedControlChange={setSelectedControlId}
          onLink={() => void handleLinkControl()}
          onUnlink={(linkId) => void handleUnlinkControl(linkId)}
        />

        <LinkedIncidentsPanel
          links={linkedIncidents}
          userIncidents={userIncidents}
          selectedIncidentId={selectedIncidentId}
          incidentSearch={incidentSearch}
          linking={linkingIncident}
          unlinkingLinkId={unlinkingIncidentLinkId}
          onIncidentSearchChange={setIncidentSearch}
          onSelectedIncidentChange={setSelectedIncidentId}
          onLink={() => void handleLinkIncident()}
          onUnlink={(linkId) => void handleUnlinkIncident(linkId)}
        />
      </main>
    </div>
  );
}
