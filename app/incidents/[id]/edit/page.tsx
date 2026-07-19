"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase/client";
import {
  formatDateForInput,
  toIncidentFormPayload,
  type Incident,
  type NewIncident,
} from "@/lib/types/incident";
import {
  groupIncidentRiskRowsByIncident,
  type IncidentRiskRow,
  type LinkedRisk,
} from "@/lib/types/incident-risk";
import type { Risk } from "@/lib/types/risk";
import { IncidentFormFields } from "../../_components/incident-form-fields";
import { LinkedRisksPanel } from "../../_components/linked-risks-panel";

export default function EditIncidentPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const incidentId = params.id;

  const [user, setUser] = useState<User | null>(null);
  const [incident, setIncident] = useState<Incident | null>(null);
  const [form, setForm] = useState<NewIncident | null>(null);
  const [userRisks, setUserRisks] = useState<Risk[]>([]);
  const [linkedRisks, setLinkedRisks] = useState<LinkedRisk[]>([]);
  const [selectedRiskId, setSelectedRiskId] = useState("");
  const [riskSearch, setRiskSearch] = useState("");
  const [linking, setLinking] = useState(false);
  const [unlinkingLinkId, setUnlinkingLinkId] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchIncident = useCallback(async (ownerId: string) => {
    const supabase = getSupabaseClient();
    const { data, error: fetchError } = await supabase
      .from("incidents")
      .select("*")
      .eq("id", incidentId)
      .eq("owner_id", ownerId)
      .maybeSingle();

    if (fetchError) {
      throw fetchError;
    }

    if (!data) {
      return null;
    }

    return data as Incident;
  }, [incidentId]);

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

  const fetchIncidentRiskLinks = useCallback(async (ownerId: string) => {
    const supabase = getSupabaseClient();
    const { data, error: fetchError } = await supabase
      .from("incident_risks")
      .select(
        "id, incident_id, risk_id, risks(title, likelihood, impact, owner_email)",
      )
      .eq("owner_id", ownerId)
      .eq("incident_id", incidentId);

    if (fetchError) {
      throw fetchError;
    }

    const grouped = groupIncidentRiskRowsByIncident(
      (data ?? []) as IncidentRiskRow[],
    );
    setLinkedRisks(grouped[incidentId] ?? []);
  }, [incidentId]);

  const loadPageData = useCallback(
    async (ownerId: string) => {
      setError(null);

      try {
        const loadedIncident = await fetchIncident(ownerId);

        if (!loadedIncident) {
          router.replace("/incidents");
          return;
        }

        setIncident(loadedIncident);
        setForm({
          title: loadedIncident.title,
          description: loadedIncident.description,
          date_occurred: formatDateForInput(loadedIncident.date_occurred),
          severity: loadedIncident.severity,
          status: loadedIncident.status,
          root_cause: loadedIncident.root_cause,
        });

        await Promise.all([
          fetchUserRisks(ownerId),
          fetchIncidentRiskLinks(ownerId),
        ]);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load incident",
        );
      } finally {
        setLoading(false);
      }
    },
    [fetchIncident, fetchIncidentRiskLinks, fetchUserRisks, router],
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

  function updateForm(updates: Partial<NewIncident>) {
    setForm((current) => (current ? { ...current, ...updates } : current));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form || !incident) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();
      const { error: updateError } = await supabase
        .from("incidents")
        .update(toIncidentFormPayload(form))
        .eq("id", incident.id);

      if (updateError) {
        throw updateError;
      }

      router.push("/incidents");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update incident");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!incident) {
      return;
    }

    const confirmed = window.confirm(
      `Delete "${incident.title}"? This action cannot be undone.`,
    );

    if (!confirmed) {
      return;
    }

    setDeleting(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();
      const { error: deleteError } = await supabase
        .from("incidents")
        .delete()
        .eq("id", incident.id);

      if (deleteError) {
        throw deleteError;
      }

      router.push("/incidents");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete incident");
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
      const { error: linkError } = await supabase.from("incident_risks").insert({
        incident_id: incidentId,
        risk_id: selectedRiskId,
        owner_id: user.id,
      });

      if (linkError) {
        throw linkError;
      }

      setSelectedRiskId("");
      setRiskSearch("");
      await fetchIncidentRiskLinks(user.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to link risk");
    } finally {
      setLinking(false);
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
        .from("incident_risks")
        .delete()
        .eq("id", linkId);

      if (unlinkError) {
        throw unlinkError;
      }

      await fetchIncidentRiskLinks(user.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to unlink risk");
    } finally {
      setUnlinkingLinkId(null);
    }
  }

  if (authLoading || loading || !form || !incident) {
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
            href="/incidents"
            className="text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
          >
            ← Back to incidents
          </Link>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            Edit Incident
          </h1>
        </header>

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        )}

        <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
            <IncidentFormFields form={form} onChange={updateForm} />

            <div className="flex flex-wrap gap-3 sm:col-span-2">
              <button
                type="submit"
                disabled={submitting || deleting}
                className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-600 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-teal-400 dark:text-slate-950 dark:hover:bg-teal-300"
              >
                {submitting ? "Saving..." : "Save Changes"}
              </button>
              <Link
                href="/incidents"
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
                {deleting ? "Deleting..." : "Delete Incident"}
              </button>
            </div>
          </form>
        </section>

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
