"use client";

import { FormEvent, Fragment, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase/client";
import {
  EFFECTIVENESS_OPTIONS,
  formatEffectiveness,
  formatKeyStatus,
  formatLastTestedAt,
  getTestingStatus,
  toControlFormPayload,
  type Control,
  type NewControl,
} from "@/lib/types/control";
import {
  groupRiskControlRowsByControl,
  type LinkedRisk,
  type RiskControlRiskRow,
} from "@/lib/types/risk-control";
import type { Risk } from "@/lib/types/risk";

const emptyForm: NewControl = {
  title: "",
  description: "",
  is_key: false,
  effectiveness: "not_tested",
  last_tested_at: null,
};

const inputClassName =
  "rounded-lg border border-zinc-300 px-3 py-2 text-zinc-950 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";

type ControlFormFieldsProps = {
  form: NewControl;
  onChange: (updates: Partial<NewControl>) => void;
};

function ControlFormFields({ form, onChange }: ControlFormFieldsProps) {
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

      <label className="flex items-center gap-2 sm:col-span-2">
        <input
          type="checkbox"
          checked={form.is_key}
          onChange={(event) => onChange({ is_key: event.target.checked })}
          className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700"
        />
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Key control
        </span>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Effectiveness
        </span>
        <select
          value={form.effectiveness}
          onChange={(event) =>
            onChange({
              effectiveness: event.target.value as NewControl["effectiveness"],
            })
          }
          className={inputClassName}
        >
          {EFFECTIVENESS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Last Tested At
        </span>
        <input
          type="date"
          value={form.last_tested_at ?? ""}
          onChange={(event) =>
            onChange({
              last_tested_at: event.target.value || null,
            })
          }
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
          No risks linked to this control yet.
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
            All of your risks are already linked to this control.
          </p>
        )}
    </div>
  );
}

export default function ControlsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [controls, setControls] = useState<Control[]>([]);
  const [userRisks, setUserRisks] = useState<Risk[]>([]);
  const [linkedRisksByControl, setLinkedRisksByControl] = useState<
    Record<string, LinkedRisk[]>
  >({});
  const [expandedControlId, setExpandedControlId] = useState<string | null>(
    null,
  );
  const [linkSelections, setLinkSelections] = useState<Record<string, string>>(
    {},
  );
  const [riskSearchByControl, setRiskSearchByControl] = useState<
    Record<string, string>
  >({});
  const [linkingControlId, setLinkingControlId] = useState<string | null>(
    null,
  );
  const [unlinkingLinkId, setUnlinkingLinkId] = useState<string | null>(null);
  const [form, setForm] = useState<NewControl>(emptyForm);
  const [editingControl, setEditingControl] = useState<Control | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
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

  const fetchRiskControlLinks = useCallback(async (ownerId: string) => {
    const supabase = getSupabaseClient();
    const { data, error: fetchError } = await supabase
      .from("risk_controls")
      .select(
        "id, risk_id, control_id, risks(title, likelihood, impact, owner_email)",
      )
      .eq("owner_id", ownerId);

    if (fetchError) {
      throw fetchError;
    }

    setLinkedRisksByControl(
      groupRiskControlRowsByControl((data ?? []) as RiskControlRiskRow[]),
    );
  }, []);

  const fetchControls = useCallback(async (ownerId: string) => {
    setError(null);

    try {
      const supabase = getSupabaseClient();
      const { data, error: fetchError } = await supabase
        .from("controls")
        .select("*")
        .eq("owner_id", ownerId)
        .order("created_at", { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      setControls(data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load controls");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadControlPageData = useCallback(
    async (ownerId: string) => {
      try {
        await Promise.all([
          fetchControls(ownerId),
          fetchUserRisks(ownerId),
          fetchRiskControlLinks(ownerId),
        ]);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load control page data",
        );
      }
    },
    [fetchControls, fetchRiskControlLinks, fetchUserRisks],
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
      await loadControlPageData(session.user.id);
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
  }, [loadControlPageData, router]);

  function updateForm(updates: Partial<NewControl>) {
    setForm((current) => ({ ...current, ...updates }));
  }

  function startEdit(control: Control) {
    setEditingControl(control);
    setForm({
      title: control.title,
      description: control.description,
      is_key: control.is_key,
      effectiveness: control.effectiveness,
      last_tested_at: control.last_tested_at,
    });
    setError(null);
  }

  function cancelEdit() {
    setEditingControl(null);
    setForm(emptyForm);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();
      const payload = toControlFormPayload(form);

      if (editingControl) {
        const { error: updateError } = await supabase
          .from("controls")
          .update(payload)
          .eq("id", editingControl.id);

        if (updateError) {
          throw updateError;
        }

        setEditingControl(null);
      } else {
        const {
          data: { user: currentUser },
        } = await supabase.auth.getUser();

        if (!currentUser) {
          throw new Error("You must be signed in to add a control");
        }

        if (!currentUser.email) {
          throw new Error("User email not available");
        }

        const { error: insertError } = await supabase.from("controls").insert({
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
        await loadControlPageData(user.id);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : editingControl
            ? "Failed to update control"
            : "Failed to add control",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLogout() {
    setLoggingOut(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();
      const { error: signOutError } = await supabase.auth.signOut();

      if (signOutError) {
        throw signOutError;
      }

      router.replace("/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to log out");
      setLoggingOut(false);
    }
  }

  async function handleDelete(control: Control) {
    const confirmed = window.confirm(
      `Delete "${control.title}"? This action cannot be undone.`,
    );

    if (!confirmed) {
      return;
    }

    setDeletingId(control.id);
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

      if (editingControl?.id === control.id) {
        cancelEdit();
      }

      if (expandedControlId === control.id) {
        setExpandedControlId(null);
      }

      if (user) {
        await loadControlPageData(user.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete control");
    } finally {
      setDeletingId(null);
    }
  }

  function toggleLinkedRisks(controlId: string) {
    setExpandedControlId((current) =>
      current === controlId ? null : controlId,
    );
  }

  async function handleLinkRisk(controlId: string) {
    const riskId = linkSelections[controlId];

    if (!riskId || !user) {
      return;
    }

    setLinkingControlId(controlId);
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

      setLinkSelections((current) => ({ ...current, [controlId]: "" }));
      setRiskSearchByControl((current) => ({ ...current, [controlId]: "" }));
      await fetchRiskControlLinks(user.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to link risk");
    } finally {
      setLinkingControlId(null);
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
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
              Control Register
            </h1>
            <p className="mt-2 text-zinc-600 dark:text-zinc-400">
              Manage and track your assigned controls.
            </p>
            {user?.email && (
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-500">
                Signed in as {user.email}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => void handleLogout()}
            disabled={loggingOut}
            className="self-start rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            {loggingOut ? "Logging out..." : "Log out"}
          </button>
        </header>

        <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="mb-4 text-lg font-medium text-zinc-950 dark:text-zinc-50">
            {editingControl ? "Edit Control" : "Add Control"}
          </h2>
          <form
            onSubmit={handleSubmit}
            className="grid gap-4 sm:grid-cols-2"
          >
            <ControlFormFields form={form} onChange={updateForm} />

            <div className="flex gap-3 sm:col-span-2">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-zinc-950 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
              >
                {submitting
                  ? editingControl
                    ? "Saving..."
                    : "Adding..."
                  : editingControl
                    ? "Save Changes"
                    : "Add Control"}
              </button>
              {editingControl && (
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
              My Controls
            </h2>
          </div>

          {loading ? (
            <p className="px-6 py-8 text-zinc-600 dark:text-zinc-400">
              Loading controls...
            </p>
          ) : controls.length === 0 ? (
            <p className="px-6 py-8 text-zinc-600 dark:text-zinc-400">
              No controls yet. Add one using the form above.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-zinc-50 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
                  <tr>
                    <th className="px-6 py-3 font-medium">Title</th>
                    <th className="px-6 py-3 font-medium">Key</th>
                    <th className="px-6 py-3 font-medium">Effectiveness</th>
                    <th className="px-6 py-3 font-medium">Last Tested</th>
                    <th className="px-6 py-3 font-medium">Testing Status</th>
                    <th className="px-6 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {controls.map((control) => {
                    const linkedRisks = linkedRisksByControl[control.id] ?? [];
                    const isExpanded = expandedControlId === control.id;

                    return (
                      <Fragment key={control.id}>
                        <tr>
                          <td className="px-6 py-4 font-medium text-zinc-950 dark:text-zinc-50">
                            {control.title}
                          </td>
                          <td className="px-6 py-4 text-zinc-950 dark:text-zinc-50">
                            {formatKeyStatus(control.is_key)}
                          </td>
                          <td className="px-6 py-4 text-zinc-950 dark:text-zinc-50">
                            {formatEffectiveness(control.effectiveness)}
                          </td>
                          <td className="px-6 py-4 text-zinc-950 dark:text-zinc-50">
                            {formatLastTestedAt(control.last_tested_at)}
                          </td>
                          <td className="px-6 py-4 text-zinc-950 dark:text-zinc-50">
                            {getTestingStatus(control.last_tested_at)}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => toggleLinkedRisks(control.id)}
                                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                              >
                                {isExpanded
                                  ? "Hide Risks"
                                  : `Linked Risks (${linkedRisks.length})`}
                              </button>
                              <button
                                type="button"
                                onClick={() => startEdit(control)}
                                disabled={deletingId === control.id}
                                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleDelete(control)}
                                disabled={deletingId === control.id}
                                className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950"
                              >
                                {deletingId === control.id
                                  ? "Deleting..."
                                  : "Delete"}
                              </button>
                            </div>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={6} className="p-0">
                              <LinkedRisksPanel
                                links={linkedRisks}
                                userRisks={userRisks}
                                selectedRiskId={linkSelections[control.id] ?? ""}
                                riskSearch={riskSearchByControl[control.id] ?? ""}
                                linking={linkingControlId === control.id}
                                unlinkingLinkId={unlinkingLinkId}
                                onRiskSearchChange={(value) =>
                                  setRiskSearchByControl((current) => ({
                                    ...current,
                                    [control.id]: value,
                                  }))
                                }
                                onSelectedRiskChange={(riskId) =>
                                  setLinkSelections((current) => ({
                                    ...current,
                                    [control.id]: riskId,
                                  }))
                                }
                                onLink={() => void handleLinkRisk(control.id)}
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
