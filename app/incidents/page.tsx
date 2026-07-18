"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase/client";
import {
  formatDateOccurred,
  formatIncidentStatus,
  formatSeverity,
  type Incident,
} from "@/lib/types/incident";

export default function IncidentsPage() {
  const router = useRouter();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [authLoading, setAuthLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      await fetchIncidents(session.user.id);
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
  }, [fetchIncidents, router]);

  if (authLoading) {
    return (
      <div className="flex min-h-full items-center justify-center bg-zinc-50 dark:bg-black">
        <p className="text-zinc-600 dark:text-zinc-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-zinc-50 px-6 py-10 dark:bg-black">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
              Incident Register
            </h1>
            <p className="mt-2 text-zinc-600 dark:text-zinc-400">
              Track and manage security and compliance incidents.
            </p>
          </div>
          <Link
            href="/incidents/new"
            className="inline-flex shrink-0 items-center justify-center rounded-lg bg-zinc-950 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
          >
            Add Incident
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
              Loading incidents...
            </p>
          ) : incidents.length === 0 ? (
            <p className="px-6 py-8 text-zinc-600 dark:text-zinc-400">
              No incidents yet.{" "}
              <Link
                href="/incidents/new"
                className="font-medium text-zinc-950 underline underline-offset-2 dark:text-zinc-50"
              >
                Add your first incident
              </Link>
              .
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
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {incidents.map((incident) => (
                    <tr
                      key={incident.id}
                      onClick={() =>
                        router.push(`/incidents/${incident.id}/edit`)
                      }
                      className="cursor-pointer transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900"
                    >
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
