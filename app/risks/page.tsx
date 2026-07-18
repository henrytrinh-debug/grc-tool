"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { NewRisk, Risk } from "@/lib/types/risk";

const emptyForm: NewRisk = {
  title: "",
  description: "",
  likelihood: 3,
  impact: 3,
  owner: "",
};

export default function RisksPage() {
  const [risks, setRisks] = useState<Risk[]>([]);
  const [form, setForm] = useState<NewRisk>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
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
    void fetchRisks();
  }, [fetchRisks]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();
      const { error: insertError } = await supabase.from("risks").insert(form);

      if (insertError) {
        throw insertError;
      }

      setForm(emptyForm);
      await fetchRisks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add risk");
    } finally {
      setSubmitting(false);
    }
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
            Add Risk
          </h2>
          <form
            onSubmit={handleSubmit}
            className="grid gap-4 sm:grid-cols-2"
          >
            <label className="flex flex-col gap-1 sm:col-span-2">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Title
              </span>
              <input
                required
                value={form.title}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
                className="rounded-lg border border-zinc-300 px-3 py-2 text-zinc-950 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
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
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                className="rounded-lg border border-zinc-300 px-3 py-2 text-zinc-950 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Likelihood (1-5)
              </span>
              <select
                value={form.likelihood}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    likelihood: Number(event.target.value),
                  }))
                }
                className="rounded-lg border border-zinc-300 px-3 py-2 text-zinc-950 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
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
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    impact: Number(event.target.value),
                  }))
                }
                className="rounded-lg border border-zinc-300 px-3 py-2 text-zinc-950 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              >
                {[1, 2, 3, 4, 5].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 sm:col-span-2">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Owner
              </span>
              <input
                required
                value={form.owner}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    owner: event.target.value,
                  }))
                }
                className="rounded-lg border border-zinc-300 px-3 py-2 text-zinc-950 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
            </label>

            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-zinc-950 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
              >
                {submitting ? "Adding..." : "Add Risk"}
              </button>
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
                        {risk.owner}
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
