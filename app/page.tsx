"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import {
  ControlsEffectivenessDonut,
  IncidentsStatusDonut,
} from "@/app/components/dashboard/donut-charts";
import { RiskHeatMap } from "@/app/components/dashboard/risk-heat-map";
import { RiskSeverityBarChart } from "@/app/components/dashboard/risk-severity-bar-chart";
import {
  buildControlEffectivenessCounts,
  buildIncidentStatusCounts,
  buildSeverityBandCounts,
  type ChartCount,
  type SeverityBandCount,
} from "@/lib/dashboard/analytics";
import { getSupabaseClient } from "@/lib/supabase/client";
import { getTestingStatus, type Control } from "@/lib/types/control";
import type { Incident } from "@/lib/types/incident";
import type { Risk } from "@/lib/types/risk";

type DashboardStats = {
  riskCount: number;
  overdueControlCount: number;
  openIncidentCount: number;
};

type DashboardCharts = {
  risks: Risk[];
  severityBands: SeverityBandCount[];
  controlEffectiveness: ChartCount[];
  incidentStatus: ChartCount[];
};

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState<DashboardStats>({
    riskCount: 0,
    overdueControlCount: 0,
    openIncidentCount: 0,
  });
  const [charts, setCharts] = useState<DashboardCharts>({
    risks: [],
    severityBands: [],
    controlEffectiveness: [],
    incidentStatus: [],
  });
  const [authLoading, setAuthLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async (ownerId: string) => {
    setError(null);

    try {
      const supabase = getSupabaseClient();

      const [risksResult, controlsResult, incidentsResult] = await Promise.all([
        supabase.from("risks").select("*").eq("owner_id", ownerId),
        supabase.from("controls").select("*").eq("owner_id", ownerId),
        supabase.from("incidents").select("*").eq("owner_id", ownerId),
      ]);

      if (risksResult.error) {
        throw risksResult.error;
      }

      if (controlsResult.error) {
        throw controlsResult.error;
      }

      if (incidentsResult.error) {
        throw incidentsResult.error;
      }

      const risks = (risksResult.data ?? []) as Risk[];
      const controls = (controlsResult.data ?? []) as Control[];
      const incidents = (incidentsResult.data ?? []) as Incident[];

      setStats({
        riskCount: risks.length,
        overdueControlCount: controls.filter(
          (control) => getTestingStatus(control.last_tested_at) === "Overdue",
        ).length,
        openIncidentCount: incidents.filter(
          (incident) =>
            incident.status === "open" || incident.status === "investigating",
        ).length,
      });

      setCharts({
        risks,
        severityBands: buildSeverityBandCounts(risks),
        controlEffectiveness: buildControlEffectivenessCounts(controls),
        incidentStatus: buildIncidentStatusCounts(incidents),
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load dashboard data",
      );
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
      await fetchDashboardData(session.user.id);
    }

    void checkAuth();
  }, [fetchDashboardData, router]);

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
            Dashboard
          </h1>
          {user?.email && (
            <p className="mt-2 text-zinc-600 dark:text-zinc-400">
              Welcome back, {user.email}
            </p>
          )}
        </header>

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        )}

        {loading ? (
          <p className="text-zinc-600 dark:text-zinc-400">Loading summary...</p>
        ) : (
          <>
            <section className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
                <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                  Total Risks
                </p>
                <p className="mt-2 text-3xl font-semibold text-zinc-950 dark:text-zinc-50">
                  {stats.riskCount}
                </p>
              </div>

              <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
                <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                  Overdue Controls
                </p>
                <p className="mt-2 text-3xl font-semibold text-zinc-950 dark:text-zinc-50">
                  {stats.overdueControlCount}
                </p>
              </div>

              <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
                <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                  Open Incidents
                </p>
                <p className="mt-2 text-3xl font-semibold text-zinc-950 dark:text-zinc-50">
                  {stats.openIncidentCount}
                </p>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
                  Status open or investigating
                </p>
              </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
                <h2 className="text-lg font-medium text-zinc-950 dark:text-zinc-50">
                  Risk Heat Map
                </h2>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  Likelihood × impact matrix with risk counts per cell.
                </p>
                <div className="mt-6">
                  <RiskHeatMap risks={charts.risks} />
                </div>
              </div>

              <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
                <h2 className="text-lg font-medium text-zinc-950 dark:text-zinc-50">
                  Risks by Severity Band
                </h2>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  Low (1–5), Medium (6–10), High (11–19), Critical (20–25).
                </p>
                <div className="mt-4">
                  <RiskSeverityBarChart data={charts.severityBands} />
                </div>
              </div>

              <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
                <h2 className="text-lg font-medium text-zinc-950 dark:text-zinc-50">
                  Controls by Effectiveness
                </h2>
                <div className="mt-4">
                  <ControlsEffectivenessDonut
                    data={charts.controlEffectiveness}
                  />
                </div>
              </div>

              <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
                <h2 className="text-lg font-medium text-zinc-950 dark:text-zinc-50">
                  Incidents by Status
                </h2>
                <div className="mt-4">
                  <IncidentsStatusDonut data={charts.incidentStatus} />
                </div>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
