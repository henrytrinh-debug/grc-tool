"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { Risk } from "@/lib/types/risk";

export default function RisksPage() {
  const router = useRouter();
  const [risks, setRisks] = useState<Risk[]>([]);
  const [authLoading, setAuthLoading] = useState(true);
  const [loading, setLoading] = useState(true);
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

      setAuthLoading(false);
      await fetchRisks();
    }

    void checkAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.replace("/login");
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchRisks, router]);

  if (authLoading) {
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
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
              Risk Register
            </h1>
            <p className="mt-2 text-zinc-600 dark:text-zinc-400">
              Track and assess organizational risks.
            </p>
          </div>
          <Link
            href="/risks/new"
            className="inline-flex shrink-0 items-center justify-center rounded-lg bg-zinc-950 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
          >
            Add Risk
          </Link>
        </header>

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        )}

        <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          {loading ? (
            <p className="px-6 py-8 text-zinc-600 dark:text-zinc-400">
              Loading risks...
            </p>
          ) : risks.length === 0 ? (
            <p className="px-6 py-8 text-zinc-600 dark:text-zinc-400">
              No risks yet.{" "}
              <Link
                href="/risks/new"
                className="font-medium text-zinc-950 underline underline-offset-2 dark:text-zinc-50"
              >
                Add your first risk
              </Link>
              .
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
                    <tr
                      key={risk.id}
                      onClick={() => router.push(`/risks/${risk.id}/edit`)}
                      className="cursor-pointer transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900"
                    >
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
