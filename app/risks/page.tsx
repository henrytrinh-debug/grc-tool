"use client";

import { FormEvent, Fragment, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { Control } from "@/lib/types/control";
import {
  formatEffectiveness,
  getTestingStatus,
} from "@/lib/types/control";
import {
  groupRiskControlRows,
  type LinkedControl,
  type RiskControlRow,
} from "@/lib/types/risk-control";
import {
  groupIncidentRiskRowsByRisk,
  type IncidentRiskIncidentRow,
  type LinkedIncident,
} from "@/lib/types/incident-risk";
import {
  formatDateOccurred,
  formatIncidentStatus,
  formatSeverity,
} from "@/lib/types/incident";
import type { Incident } from "@/lib/types/incident";
import { toRiskFormPayload, type NewRisk, type Risk } from "@/lib/types/risk";

const emptyForm: NewRisk = {
  title: "",
  description: "",
  likelihood: 3,
  impact: 3,
};

const inputClassName =
  "rounded-lg border border-zinc-300 px-3 py-2 text-zinc-950 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";

type RiskFormFieldsProps = {
  form: NewRisk;
  onChange: (updates: Partial<NewRisk>) => void;
};

function RiskFormFields({ form, onChange }: RiskFormFieldsProps) {
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
          Likelihood (1-5)
        </span>
        <select
          value={form.likelihood}
          onChange={(event) =>
            onChange({ likelihood: Number(event.target.value) })
          }
          className={inputClassName}
        >
          {[1, 2, 3, 4, 5].map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Impact (1-5)
        </span>
        <select
          value={form.impact}
          onChange={(event) => onChange({ impact: Number(event.target.value) })}
          className={inputClassName}
        >
          {[1, 2, 3, 4, 5].map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}

type LinkedControlsPanelProps = {
  links: LinkedControl[];
  userControls: Control[];
  selectedControlId: string;
  controlSearch: string;
  linking: boolean;
  unlinkingLinkId: string | null;
  onControlSearchChange: (value: string) => void;
  onSelectedControlChange: (controlId: string) => void;
  onLink: () => void;
  onUnlink: (linkId: string) => void;
};

function LinkedControlsPanel({
  links,
  userControls,
  selectedControlId,
  controlSearch,
  linking,
  unlinkingLinkId,
  onControlSearchChange,
  onSelectedControlChange,
  onLink,
  onUnlink,
}: LinkedControlsPanelProps) {
  const linkedControlIds = new Set(links.map((link) => link.controlId));
  const search = controlSearch.trim().toLowerCase();

  const availableControls = userControls.filter((control) => {
    if (linkedControlIds.has(control.id)) {
      return false;
    }

    if (!search) {
      return true;
    }

    return control.title.toLowerCase().includes(search);
  });

  return (
    <div className="space-y-4 bg-zinc-50 px-6 py-4 dark:bg-zinc-900/50">
      <h3 className="text-sm font-medium text-zinc-950 dark:text-zinc-50">
        Linked Controls
      </h3>

      {links.length === 0 ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          No controls linked to this risk yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-zinc-50 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-2 font-medium">Title</th>
                <th className="px-4 py-2 font-medium">Effectiveness</th>
                <th className="px-4 py-2 font-medium">Testing Status</th>
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
                    {formatEffectiveness(link.effectiveness)}
                  </td>
                  <td className="px-4 py-3 text-zinc-950 dark:text-zinc-50">
                    {getTestingStatus(link.last_tested_at)}
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
            Search controls
          </span>
          <input
            type="search"
            value={controlSearch}
            onChange={(event) => onControlSearchChange(event.target.value)}
            placeholder="Filter by title..."
            className={inputClassName}
          />
        </label>

        <label className="flex flex-1 flex-col gap-1">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Link control
          </span>
          <select
            value={selectedControlId}
            onChange={(event) => onSelectedControlChange(event.target.value)}
            className={inputClassName}
          >
            <option value="">Select a control...</option>
            {availableControls.map((control) => (
              <option key={control.id} value={control.id}>
                {control.title}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={onLink}
          disabled={!selectedControlId || linking}
          className="rounded-lg bg-zinc-950 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
        >
          {linking ? "Linking..." : "Link Control"}
        </button>
      </div>

      {userControls.length === 0 && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Create controls on the{" "}
          <a
            href="/controls"
            className="font-medium text-zinc-950 underline underline-offset-2 dark:text-zinc-50"
          >
            controls page
          </a>{" "}
          before linking them here.
        </p>
      )}

      {userControls.length > 0 &&
        availableControls.length === 0 &&
        links.length > 0 &&
        !search && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            All of your controls are already linked to this risk.
          </p>
        )}
    </div>
  );
}

type LinkedIncidentsPanelProps = {
  links: LinkedIncident[];
  userIncidents: Incident[];
  selectedIncidentId: string;
  incidentSearch: string;
  linking: boolean;
  unlinkingLinkId: string | null;
  onIncidentSearchChange: (value: string) => void;
  onSelectedIncidentChange: (incidentId: string) => void;
  onLink: () => void;
  onUnlink: (linkId: string) => void;
};

function LinkedIncidentsPanel({
  links,
  userIncidents,
  selectedIncidentId,
  incidentSearch,
  linking,
  unlinkingLinkId,
  onIncidentSearchChange,
  onSelectedIncidentChange,
  onLink,
  onUnlink,
}: LinkedIncidentsPanelProps) {
  const linkedIncidentIds = new Set(links.map((link) => link.incidentId));
  const search = incidentSearch.trim().toLowerCase();

  const availableIncidents = userIncidents.filter((incident) => {
    if (linkedIncidentIds.has(incident.id)) {
      return false;
    }

    if (!search) {
      return true;
    }

    return incident.title.toLowerCase().includes(search);
  });

  return (
    <div className="space-y-4 bg-zinc-50 px-6 py-4 dark:bg-zinc-900/50">
      <h3 className="text-sm font-medium text-zinc-950 dark:text-zinc-50">
        Linked Incidents
      </h3>

      {links.length === 0 ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          No incidents linked to this risk yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-zinc-50 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-2 font-medium">Title</th>
                <th className="px-4 py-2 font-medium">Date Occurred</th>
                <th className="px-4 py-2 font-medium">Severity</th>
                <th className="px-4 py-2 font-medium">Status</th>
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
                    {formatDateOccurred(link.date_occurred)}
                  </td>
                  <td className="px-4 py-3 text-zinc-950 dark:text-zinc-50">
                    {formatSeverity(link.severity)}
                  </td>
                  <td className="px-4 py-3 text-zinc-950 dark:text-zinc-50">
                    {formatIncidentStatus(link.status)}
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
            Search incidents
          </span>
          <input
            type="search"
            value={incidentSearch}
            onChange={(event) => onIncidentSearchChange(event.target.value)}
            placeholder="Filter by title..."
            className={inputClassName}
          />
        </label>

        <label className="flex flex-1 flex-col gap-1">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Link incident
          </span>
          <select
            value={selectedIncidentId}
            onChange={(event) => onSelectedIncidentChange(event.target.value)}
            className={inputClassName}
          >
            <option value="">Select an incident...</option>
            {availableIncidents.map((incident) => (
              <option key={incident.id} value={incident.id}>
                {incident.title}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={onLink}
          disabled={!selectedIncidentId || linking}
          className="rounded-lg bg-zinc-950 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
        >
          {linking ? "Linking..." : "Link Incident"}
        </button>
      </div>

      {userIncidents.length === 0 && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Create incidents on the{" "}
          <a
            href="/incidents"
            className="font-medium text-zinc-950 underline underline-offset-2 dark:text-zinc-50"
          >
            incidents page
          </a>{" "}
          before linking them here.
        </p>
      )}

      {userIncidents.length > 0 &&
        availableIncidents.length === 0 &&
        links.length > 0 &&
        !search && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            All of your incidents are already linked to this risk.
          </p>
        )}
    </div>
  );
}

export default function RisksPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [risks, setRisks] = useState<Risk[]>([]);
  const [userControls, setUserControls] = useState<Control[]>([]);
  const [linkedControlsByRisk, setLinkedControlsByRisk] = useState<
    Record<string, LinkedControl[]>
  >({});
  const [userIncidents, setUserIncidents] = useState<Incident[]>([]);
  const [linkedIncidentsByRisk, setLinkedIncidentsByRisk] = useState<
    Record<string, LinkedIncident[]>
  >({});
  const [expandedControlsRiskId, setExpandedControlsRiskId] = useState<
    string | null
  >(null);
  const [expandedIncidentsRiskId, setExpandedIncidentsRiskId] = useState<
    string | null
  >(null);
  const [linkSelections, setLinkSelections] = useState<Record<string, string>>(
    {},
  );
  const [incidentLinkSelections, setIncidentLinkSelections] = useState<
    Record<string, string>
  >({});
  const [controlSearchByRisk, setControlSearchByRisk] = useState<
    Record<string, string>
  >({});
  const [incidentSearchByRisk, setIncidentSearchByRisk] = useState<
    Record<string, string>
  >({});
  const [linkingControlRiskId, setLinkingControlRiskId] = useState<
    string | null
  >(null);
  const [linkingIncidentRiskId, setLinkingIncidentRiskId] = useState<
    string | null
  >(null);
  const [unlinkingControlLinkId, setUnlinkingControlLinkId] = useState<
    string | null
  >(null);
  const [unlinkingIncidentLinkId, setUnlinkingIncidentLinkId] = useState<
    string | null
  >(null);
  const [form, setForm] = useState<NewRisk>(emptyForm);
  const [editingRisk, setEditingRisk] = useState<Risk | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        "id, risk_id, control_id, controls(title, effectiveness, last_tested_at)",
      )
      .eq("owner_id", ownerId);

    if (fetchError) {
      throw fetchError;
    }

    setLinkedControlsByRisk(
      groupRiskControlRows((data ?? []) as RiskControlRow[]),
    );
  }, []);

  const fetchIncidentRiskLinks = useCallback(async (ownerId: string) => {
    const supabase = getSupabaseClient();
    const { data, error: fetchError } = await supabase
      .from("incident_risks")
      .select(
        "id, incident_id, risk_id, incidents(title, date_occurred, severity, status)",
      )
      .eq("owner_id", ownerId);

    if (fetchError) {
      throw fetchError;
    }

    setLinkedIncidentsByRisk(
      groupIncidentRiskRowsByRisk((data ?? []) as IncidentRiskIncidentRow[]),
    );
  }, []);

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

  const fetchRisks = useCallback(async () => {
    setError(null);

    try {
      const supabase = getSupabaseClient();
      const { data, error: fetchError } = await supabase
        .from("risks")
        .select("*")
        .order("created_at", { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      setRisks(data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load risks");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRiskPageData = useCallback(
    async (ownerId: string) => {
      try {
        await Promise.all([
          fetchRisks(),
          fetchUserControls(ownerId),
          fetchRiskControlLinks(ownerId),
          fetchUserIncidents(ownerId),
          fetchIncidentRiskLinks(ownerId),
        ]);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load risk page data",
        );
      }
    },
    [
      fetchIncidentRiskLinks,
      fetchRiskControlLinks,
      fetchRisks,
      fetchUserControls,
      fetchUserIncidents,
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
      await loadRiskPageData(session.user.id);
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
  }, [loadRiskPageData, router]);

  function updateForm(updates: Partial<NewRisk>) {
    setForm((current) => ({ ...current, ...updates }));
  }

  function startEdit(risk: Risk) {
    setEditingRisk(risk);
    setForm({
      title: risk.title,
      description: risk.description,
      likelihood: risk.likelihood,
      impact: risk.impact,
    });
    setError(null);
  }

  function cancelEdit() {
    setEditingRisk(null);
    setForm(emptyForm);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();

      if (editingRisk) {
        const { error: updateError } = await supabase
          .from("risks")
          .update(toRiskFormPayload(form))
          .eq("id", editingRisk.id);

        if (updateError) {
          throw updateError;
        }

        setEditingRisk(null);
      } else {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          throw new Error("You must be signed in to add a risk");
        }

        if (!user.email) {
          throw new Error("User email not available");
        }

        const { title, description, likelihood, impact } = form;

        const { error: insertError } = await supabase.from("risks").insert({
          title,
          description,
          likelihood,
          impact,
          owner_id: user.id,
          owner_email: user.email,
        });

        if (insertError) {
          throw insertError;
        }
      }

      setForm(emptyForm);
      if (user) {
        await loadRiskPageData(user.id);
      } else {
        await fetchRisks();
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : editingRisk
            ? "Failed to update risk"
            : "Failed to add risk",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(risk: Risk) {
    const confirmed = window.confirm(
      `Delete "${risk.title}"? This action cannot be undone.`,
    );

    if (!confirmed) {
      return;
    }

    setDeletingId(risk.id);
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

      if (editingRisk?.id === risk.id) {
        cancelEdit();
      }

      if (expandedControlsRiskId === risk.id) {
        setExpandedControlsRiskId(null);
      }

      if (expandedIncidentsRiskId === risk.id) {
        setExpandedIncidentsRiskId(null);
      }

      if (user) {
        await loadRiskPageData(user.id);
      } else {
        await fetchRisks();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete risk");
    } finally {
      setDeletingId(null);
    }
  }

  function toggleLinkedControls(riskId: string) {
    setExpandedControlsRiskId((current) =>
      current === riskId ? null : riskId,
    );
  }

  function toggleLinkedIncidents(riskId: string) {
    setExpandedIncidentsRiskId((current) =>
      current === riskId ? null : riskId,
    );
  }

  async function handleLinkControl(riskId: string) {
    const controlId = linkSelections[riskId];

    if (!controlId || !user) {
      return;
    }

    setLinkingControlRiskId(riskId);
    setError(null);

    try {
      const supabase = getSupabaseClient();
      const { error: linkError } = await supabase.from("risk_controls").insert({
        risk_id: riskId,
        control_id: controlId,
        owner_id: user.id,
      });

      if (linkError) {
        throw linkError;
      }

      setLinkSelections((current) => ({ ...current, [riskId]: "" }));
      setControlSearchByRisk((current) => ({ ...current, [riskId]: "" }));
      await fetchRiskControlLinks(user.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to link control");
    } finally {
      setLinkingControlRiskId(null);
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

  async function handleLinkIncident(riskId: string) {
    const incidentId = incidentLinkSelections[riskId];

    if (!incidentId || !user) {
      return;
    }

    setLinkingIncidentRiskId(riskId);
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

      setIncidentLinkSelections((current) => ({ ...current, [riskId]: "" }));
      setIncidentSearchByRisk((current) => ({ ...current, [riskId]: "" }));
      await fetchIncidentRiskLinks(user.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to link incident");
    } finally {
      setLinkingIncidentRiskId(null);
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

  if (authLoading) {
    return (
      <div className="flex min-h-full items-center justify-center bg-zinc-50 dark:bg-black">
        <p className="text-zinc-600 dark:text-zinc-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-zinc-50 px-6 py-10 dark:bg-black">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-10">
        <header>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            Risk Register
          </h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Track and assess organizational risks.
          </p>
        </header>

        <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="mb-4 text-lg font-medium text-zinc-950 dark:text-zinc-50">
            {editingRisk ? "Edit Risk" : "Add Risk"}
          </h2>
          <form
            onSubmit={handleSubmit}
            className="grid gap-4 sm:grid-cols-2"
          >
            <RiskFormFields form={form} onChange={updateForm} />

            <div className="flex gap-3 sm:col-span-2">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-zinc-950 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
              >
                {submitting
                  ? editingRisk
                    ? "Saving..."
                    : "Adding..."
                  : editingRisk
                    ? "Save Changes"
                    : "Add Risk"}
              </button>
              {editingRisk && (
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
              All Risks
            </h2>
          </div>

          {loading ? (
            <p className="px-6 py-8 text-zinc-600 dark:text-zinc-400">
              Loading risks...
            </p>
          ) : risks.length === 0 ? (
            <p className="px-6 py-8 text-zinc-600 dark:text-zinc-400">
              No risks yet. Add one using the form above.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-zinc-50 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
                  <tr>
                    <th className="px-6 py-3 font-medium">Title</th>
                    <th className="px-6 py-3 font-medium">Description</th>
                    <th className="px-6 py-3 font-medium">Likelihood</th>
                    <th className="px-6 py-3 font-medium">Impact</th>
                    <th className="px-6 py-3 font-medium">Owner</th>
                    <th className="px-6 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {risks.map((risk) => {
                    const linkedControls = linkedControlsByRisk[risk.id] ?? [];
                    const linkedIncidents = linkedIncidentsByRisk[risk.id] ?? [];
                    const controlsExpanded = expandedControlsRiskId === risk.id;
                    const incidentsExpanded = expandedIncidentsRiskId === risk.id;

                    return (
                      <Fragment key={risk.id}>
                        <tr>
                          <td className="px-6 py-4 font-medium text-zinc-950 dark:text-zinc-50">
                            {risk.title}
                          </td>
                          <td className="max-w-md px-6 py-4 text-zinc-600 dark:text-zinc-400">
                            {risk.description}
                          </td>
                          <td className="px-6 py-4 text-zinc-950 dark:text-zinc-50">
                            {risk.likelihood}
                          </td>
                          <td className="px-6 py-4 text-zinc-950 dark:text-zinc-50">
                            {risk.impact}
                          </td>
                          <td className="px-6 py-4 text-zinc-950 dark:text-zinc-50">
                            {risk.owner_email}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => toggleLinkedControls(risk.id)}
                                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                              >
                                {controlsExpanded
                                  ? "Hide Controls"
                                  : `Linked Controls (${linkedControls.length})`}
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleLinkedIncidents(risk.id)}
                                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                              >
                                {incidentsExpanded
                                  ? "Hide Incidents"
                                  : `Linked Incidents (${linkedIncidents.length})`}
                              </button>
                              <button
                                type="button"
                                onClick={() => startEdit(risk)}
                                disabled={deletingId === risk.id}
                                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleDelete(risk)}
                                disabled={deletingId === risk.id}
                                className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950"
                              >
                                {deletingId === risk.id
                                  ? "Deleting..."
                                  : "Delete"}
                              </button>
                            </div>
                          </td>
                        </tr>
                        {controlsExpanded && (
                          <tr>
                            <td colSpan={6} className="p-0">
                              <LinkedControlsPanel
                                links={linkedControls}
                                userControls={userControls}
                                selectedControlId={
                                  linkSelections[risk.id] ?? ""
                                }
                                controlSearch={
                                  controlSearchByRisk[risk.id] ?? ""
                                }
                                linking={linkingControlRiskId === risk.id}
                                unlinkingLinkId={unlinkingControlLinkId}
                                onControlSearchChange={(value) =>
                                  setControlSearchByRisk((current) => ({
                                    ...current,
                                    [risk.id]: value,
                                  }))
                                }
                                onSelectedControlChange={(controlId) =>
                                  setLinkSelections((current) => ({
                                    ...current,
                                    [risk.id]: controlId,
                                  }))
                                }
                                onLink={() => void handleLinkControl(risk.id)}
                                onUnlink={(linkId) =>
                                  void handleUnlinkControl(linkId)
                                }
                              />
                            </td>
                          </tr>
                        )}
                        {incidentsExpanded && (
                          <tr>
                            <td colSpan={6} className="p-0">
                              <LinkedIncidentsPanel
                                links={linkedIncidents}
                                userIncidents={userIncidents}
                                selectedIncidentId={
                                  incidentLinkSelections[risk.id] ?? ""
                                }
                                incidentSearch={
                                  incidentSearchByRisk[risk.id] ?? ""
                                }
                                linking={linkingIncidentRiskId === risk.id}
                                unlinkingLinkId={unlinkingIncidentLinkId}
                                onIncidentSearchChange={(value) =>
                                  setIncidentSearchByRisk((current) => ({
                                    ...current,
                                    [risk.id]: value,
                                  }))
                                }
                                onSelectedIncidentChange={(incidentId) =>
                                  setIncidentLinkSelections((current) => ({
                                    ...current,
                                    [risk.id]: incidentId,
                                  }))
                                }
                                onLink={() => void handleLinkIncident(risk.id)}
                                onUnlink={(linkId) =>
                                  void handleUnlinkIncident(linkId)
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
