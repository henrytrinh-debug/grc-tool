"use client";

import { FormEvent, Fragment, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase/client";
import {
  groupIncidentRiskRowsByIncident,
  type IncidentRiskRow,
  type LinkedRisk,
} from "@/lib/types/incident-risk";
import {
  formatDateForInput,
  formatDateOccurred,
  formatIncidentStatus,
  formatSeverity,
  SEVERITY_OPTIONS,
  STATUS_OPTIONS,
  toIncidentFormPayload,
  type Incident,
  type NewIncident,
} from "@/lib/types/incident";
import type { Risk } from "@/lib/types/risk";

const emptyForm: NewIncident = {
  title: "",
  description: "",
  date_occurred: "",
  severity: "medium",
  status: "open",
  root_cause: "",
};

const inputClassName =
  "rounded-lg border border-zinc-300 px-3 py-2 text-zinc-950 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";

type IncidentFormFieldsProps = {
  form: NewIncident;
  onChange: (updates: Partial<NewIncident>) => void;
};

function IncidentFormFields({ form, onChange }: IncidentFormFieldsProps) {
  return (
    <>
      <label className="flex flex-col gap-1 sm:col-span-2">
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Title
        </span>
        <input
          required
          value={form.title}
          onChange={(event) => onChange({ title: event.target.value })}
          className={inputClassName}
        />
      </label>

      <label className="flex flex-col gap-1 sm:col-span-2">
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Description
        </span>
        <textarea
          required
          rows={3}
          value={form.description}
          onChange={(event) => onChange({ description: event.target.value })}
          className={inputClassName}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Date Occurred
        </span>
        <input
          required
          type="date"
          value={form.date_occurred}
          onChange={(event) =>
            onChange({ date_occurred: event.target.value })
          }
          className={inputClassName}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Severity
        </span>
        <select
          value={form.severity}
          onChange={(event) =>
            onChange({
              severity: event.target.value as NewIncident["severity"],
            })
          }
          className={inputClassName}
        >
          {SEVERITY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Status
        </span>
        <select
          value={form.status}
          onChange={(event) =>
            onChange({
              status: event.target.value as NewIncident["status"],
            })
          }
          className={inputClassName}
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 sm:col-span-2">
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Root Cause
        </span>
        <textarea
          rows={3}
          value={form.root_cause}
          onChange={(event) => onChange({ root_cause: event.target.value })}
          className={inputClassName}
        />
      </label>
    </>
  );
}

type LinkedRisksPanelProps = {
  links: LinkedRisk[];
  userRisks: Risk[];
  selectedRiskId: string;
  riskSearch: string;
  linking: boolean;
  unlinkingLinkId: string | null;
  onRiskSearchChange: (value: string) => void;
  onSelectedRiskChange: (riskId: string) => void;
  onLink: () => void;
  onUnlink: (linkId: string) => void;
};

function LinkedRisksPanel({
  links,
  userRisks,
  selectedRiskId,
  riskSearch,
  linking,
  unlinkingLinkId,
  onRiskSearchChange,
  onSelectedRiskChange,
  onLink,
  onUnlink,
}: LinkedRisksPanelProps) {
  const linkedRiskIds = new Set(links.map((link) => link.riskId));
  const search = riskSearch.trim().toLowerCase();

  const availableRisks = userRisks.filter((risk) => {
    if (linkedRiskIds.has(risk.id)) {
      return false;
    }

    if (!search) {
      return true;
    }

    return risk.title.toLowerCase().includes(search);
  });

  return (
    <div className="space-y-4 bg-zinc-50 px-6 py-4 dark:bg-zinc-900/50">
      <h3 className="text-sm font-medium text-zinc-950 dark:text-zinc-50">
        Linked Risks
      </h3>

      {links.length === 0 ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          No risks linked to this incident yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-zinc-50 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-2 font-medium">Title</th>
                <th className="px-4 py-2 font-medium">Likelihood</th>
                <th className="px-4 py-2 font-medium">Impact</th>
                <th className="px-4 py-2 font-medium">Owner</th>
                <th className="px-4 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {links.map((link) => (
                <tr key={link.linkId}>
                  <td className="px-4 py-3 font-medium text-zinc-950 dark:text-zinc-50">
                    {link.title}
                  </td>
                  <td className="px-4 py-3 text-zinc-950 dark:text-zinc-50">
                    {link.likelihood}
                  </td>
                  <td className="px-4 py-3 text-zinc-950 dark:text-zinc-50">
                    {link.impact}
                  </td>
                  <td className="px-4 py-3 text-zinc-950 dark:text-zinc-50">
                    {link.owner_email}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => onUnlink(link.linkId)}
                      disabled={unlinkingLinkId === link.linkId}
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950"
                    >
                      {unlinkingLinkId === link.linkId
                        ? "Unlinking..."
                        : "Unlink"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Search risks
          </span>
          <input
            type="search"
            value={riskSearch}
            onChange={(event) => onRiskSearchChange(event.target.value)}
            placeholder="Filter by title..."
            className={inputClassName}
          />
        </label>

        <label className="flex flex-1 flex-col gap-1">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Link risk
          </span>
          <select
            value={selectedRiskId}
            onChange={(event) => onSelectedRiskChange(event.target.value)}
            className={inputClassName}
          >
            <option value="">Select a risk...</option>
            {availableRisks.map((risk) => (
              <option key={risk.id} value={risk.id}>
                {risk.title}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={onLink}
          disabled={!selectedRiskId || linking}
          className="rounded-lg bg-zinc-950 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
        >
          {linking ? "Linking..." : "Link Risk"}
        </button>
      </div>

      {userRisks.length === 0 && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Create risks on the{" "}
          <a
            href="/risks"
            className="font-medium text-zinc-950 underline underline-offset-2 dark:text-zinc-50"
          >
            risks page
          </a>{" "}
          before linking them here.
        </p>
      )}

      {userRisks.length > 0 &&
        availableRisks.length === 0 &&
        links.length > 0 &&
        !search && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            All of your risks are already linked to this incident.
          </p>
        )}
    </div>
  );
}

export default function IncidentsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [userRisks, setUserRisks] = useState<Risk[]>([]);
  const [linkedRisksByIncident, setLinkedRisksByIncident] = useState<
    Record<string, LinkedRisk[]>
  >({});
  const [expandedIncidentId, setExpandedIncidentId] = useState<string | null>(
    null,
  );
  const [linkSelections, setLinkSelections] = useState<Record<string, string>>(
    {},
  );
  const [riskSearchByIncident, setRiskSearchByIncident] = useState<
    Record<string, string>
  >({});
  const [linkingIncidentId, setLinkingIncidentId] = useState<string | null>(
    null,
  );
  const [unlinkingLinkId, setUnlinkingLinkId] = useState<string | null>(null);
  const [form, setForm] = useState<NewIncident>(emptyForm);
  const [editingIncident, setEditingIncident] = useState<Incident | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      .eq("owner_id", ownerId);

    if (fetchError) {
      throw fetchError;
    }

    setLinkedRisksByIncident(
      groupIncidentRiskRowsByIncident((data ?? []) as IncidentRiskRow[]),
    );
  }, []);

  const fetchIncidents = useCallback(async (ownerId: string) => {
    setError(null);

    try {
      const supabase = getSupabaseClient();
      const { data, error: fetchError } = await supabase
        .from("incidents")
        .select("*")
        .eq("owner_id", ownerId)
        .order("date_occurred", { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      setIncidents(data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load incidents");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadIncidentPageData = useCallback(
    async (ownerId: string) => {
      try {
        await Promise.all([
          fetchIncidents(ownerId),
          fetchUserRisks(ownerId),
          fetchIncidentRiskLinks(ownerId),
        ]);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load incident page data",
        );
      }
    },
    [fetchIncidentRiskLinks, fetchIncidents, fetchUserRisks],
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
      await loadIncidentPageData(session.user.id);
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
  }, [loadIncidentPageData, router]);

  function updateForm(updates: Partial<NewIncident>) {
    setForm((current) => ({ ...current, ...updates }));
  }

  function startEdit(incident: Incident) {
    setEditingIncident(incident);
    setForm({
      title: incident.title,
      description: incident.description,
      date_occurred: formatDateForInput(incident.date_occurred),
      severity: incident.severity,
      status: incident.status,
      root_cause: incident.root_cause,
    });
    setError(null);
  }

  function cancelEdit() {
    setEditingIncident(null);
    setForm(emptyForm);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();
      const payload = toIncidentFormPayload(form);

      if (editingIncident) {
        const { error: updateError } = await supabase
          .from("incidents")
          .update(payload)
          .eq("id", editingIncident.id);

        if (updateError) {
          throw updateError;
        }

        setEditingIncident(null);
      } else {
        const {
          data: { user: currentUser },
        } = await supabase.auth.getUser();

        if (!currentUser) {
          throw new Error("You must be signed in to add an incident");
        }

        if (!currentUser.email) {
          throw new Error("User email not available");
        }

        const { error: insertError } = await supabase.from("incidents").insert({
          ...payload,
          owner_id: currentUser.id,
          owner_email: currentUser.email,
        });

        if (insertError) {
          throw insertError;
        }
      }

      setForm(emptyForm);

      if (user) {
        await loadIncidentPageData(user.id);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : editingIncident
            ? "Failed to update incident"
            : "Failed to add incident",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(incident: Incident) {
    const confirmed = window.confirm(
      `Delete "${incident.title}"? This action cannot be undone.`,
    );

    if (!confirmed) {
      return;
    }

    setDeletingId(incident.id);
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

      if (editingIncident?.id === incident.id) {
        cancelEdit();
      }

      if (expandedIncidentId === incident.id) {
        setExpandedIncidentId(null);
      }

      if (user) {
        await loadIncidentPageData(user.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete incident");
    } finally {
      setDeletingId(null);
    }
  }

  function toggleLinkedRisks(incidentId: string) {
    setExpandedIncidentId((current) =>
      current === incidentId ? null : incidentId,
    );
  }

  async function handleLinkRisk(incidentId: string) {
    const riskId = linkSelections[incidentId];

    if (!riskId || !user) {
      return;
    }

    setLinkingIncidentId(incidentId);
    setError(null);

    try {
      const supabase = getSupabaseClient();
      const { error: linkError } = await supabase.from("incident_risks").insert({
        incident_id: incidentId,
        risk_id: riskId,
        owner_id: user.id,
      });

      if (linkError) {
        throw linkError;
      }

      setLinkSelections((current) => ({ ...current, [incidentId]: "" }));
      setRiskSearchByIncident((current) => ({ ...current, [incidentId]: "" }));
      await fetchIncidentRiskLinks(user.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to link risk");
    } finally {
      setLinkingIncidentId(null);
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

  if (authLoading) {
    return (
      <div className="flex min-h-full items-center justify-center bg-zinc-50 dark:bg-black">
        <p className="text-zinc-600 dark:text-zinc-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-zinc-50 px-6 py-10 dark:bg-black">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-10">
        <header>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            Incident Register
          </h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Track and manage security and compliance incidents.
          </p>
        </header>

        <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="mb-4 text-lg font-medium text-zinc-950 dark:text-zinc-50">
            {editingIncident ? "Edit Incident" : "Add Incident"}
          </h2>
          <form
            onSubmit={handleSubmit}
            className="grid gap-4 sm:grid-cols-2"
          >
            <IncidentFormFields form={form} onChange={updateForm} />

            <div className="flex gap-3 sm:col-span-2">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-zinc-950 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
              >
                {submitting
                  ? editingIncident
                    ? "Saving..."
                    : "Adding..."
                  : editingIncident
                    ? "Save Changes"
                    : "Add Incident"}
              </button>
              {editingIncident && (
                <button
                  type="button"
                  onClick={cancelEdit}
                  disabled={submitting}
                  className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </section>

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        )}

        <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <div className="border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
            <h2 className="text-lg font-medium text-zinc-950 dark:text-zinc-50">
              My Incidents
            </h2>
          </div>

          {loading ? (
            <p className="px-6 py-8 text-zinc-600 dark:text-zinc-400">
              Loading incidents...
            </p>
          ) : incidents.length === 0 ? (
            <p className="px-6 py-8 text-zinc-600 dark:text-zinc-400">
              No incidents yet. Add one using the form above.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-zinc-50 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
                  <tr>
                    <th className="px-6 py-3 font-medium">Title</th>
                    <th className="px-6 py-3 font-medium">Date Occurred</th>
                    <th className="px-6 py-3 font-medium">Severity</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                    <th className="px-6 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {incidents.map((incident) => {
                    const linkedRisks = linkedRisksByIncident[incident.id] ?? [];
                    const isExpanded = expandedIncidentId === incident.id;

                    return (
                      <Fragment key={incident.id}>
                        <tr>
                          <td className="px-6 py-4 font-medium text-zinc-950 dark:text-zinc-50">
                            {incident.title}
                          </td>
                          <td className="px-6 py-4 text-zinc-950 dark:text-zinc-50">
                            {formatDateOccurred(incident.date_occurred)}
                          </td>
                          <td className="px-6 py-4 text-zinc-950 dark:text-zinc-50">
                            {formatSeverity(incident.severity)}
                          </td>
                          <td className="px-6 py-4 text-zinc-950 dark:text-zinc-50">
                            {formatIncidentStatus(incident.status)}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => toggleLinkedRisks(incident.id)}
                                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                              >
                                {isExpanded
                                  ? "Hide Risks"
                                  : `Linked Risks (${linkedRisks.length})`}
                              </button>
                              <button
                                type="button"
                                onClick={() => startEdit(incident)}
                                disabled={deletingId === incident.id}
                                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleDelete(incident)}
                                disabled={deletingId === incident.id}
                                className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950"
                              >
                                {deletingId === incident.id
                                  ? "Deleting..."
                                  : "Delete"}
                              </button>
                            </div>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={5} className="p-0">
                              <LinkedRisksPanel
                                links={linkedRisks}
                                userRisks={userRisks}
                                selectedRiskId={
                                  linkSelections[incident.id] ?? ""
                                }
                                riskSearch={
                                  riskSearchByIncident[incident.id] ?? ""
                                }
                                linking={linkingIncidentId === incident.id}
                                unlinkingLinkId={unlinkingLinkId}
                                onRiskSearchChange={(value) =>
                                  setRiskSearchByIncident((current) => ({
                                    ...current,
                                    [incident.id]: value,
                                  }))
                                }
                                onSelectedRiskChange={(riskId) =>
                                  setLinkSelections((current) => ({
                                    ...current,
                                    [incident.id]: riskId,
                                  }))
                                }
                                onLink={() => void handleLinkRisk(incident.id)}
                                onUnlink={(linkId) =>
                                  void handleUnlinkRisk(linkId)
                                }
                              />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
