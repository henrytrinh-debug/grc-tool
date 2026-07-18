"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase/client";
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

export default function RisksPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [risks, setRisks] = useState<Risk[]>([]);
  const [form, setForm] = useState<NewRisk>(emptyForm);
  const [editingRisk, setEditingRisk] = useState<Risk | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      await fetchRisks();
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
  }, [fetchRisks, router]);

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
      await fetchRisks();
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

      await fetchRisks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete risk");
    } finally {
      setDeletingId(null);
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
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
              Risk Register
            </h1>
            <p className="mt-2 text-zinc-600 dark:text-zinc-400">
              Track and assess organizational risks.
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
                  {risks.map((risk) => (
                    <tr key={risk.id}>
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
                        <div className="flex gap-2">
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
                            {deletingId === risk.id ? "Deleting..." : "Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
