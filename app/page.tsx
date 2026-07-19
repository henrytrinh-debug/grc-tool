"use client";

import Link from "next/link";
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
      <div className="flex min-h-full items-center justify-center bg-slate-50 dark:bg-slate-950">
        <p className="text-slate-600 dark:text-slate-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-slate-50 px-6 py-10 dark:bg-slate-950">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-10">
        <header>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
            Dashboard
          </h1>
          {user?.email && (
            <p className="mt-2 text-slate-600 dark:text-slate-400">
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
          <p className="text-slate-600 dark:text-slate-400">Loading summary...</p>
        ) : (
          <>
            <section className="grid gap-4 sm:grid-cols-3">
              <Link
                href="/risks"
                className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-colors hover:border-teal-300 hover:bg-teal-50/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-teal-700 dark:hover:bg-slate-800 dark:focus-visible:outline-teal-400"
              >
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  Total Risks
                </p>
                <p className="mt-2 text-3xl font-semibold text-slate-950 dark:text-slate-50">
                  {stats.riskCount}
                </p>
                <p className="mt-2 text-xs text-teal-700 dark:text-teal-300">
                  View risk register →
                </p>
              </Link>

              <Link
                href="/controls?testingStatus=Overdue"
                className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-colors hover:border-teal-300 hover:bg-teal-50/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-teal-700 dark:hover:bg-slate-800 dark:focus-visible:outline-teal-400"
              >
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  Overdue Controls
                </p>
                <p className="mt-2 text-3xl font-semibold text-slate-950 dark:text-slate-50">
                  {stats.overdueControlCount}
                </p>
                <p className="mt-2 text-xs text-teal-700 dark:text-teal-300">
                  View overdue controls →
                </p>
              </Link>

              <Link
                href="/incidents?status=open,investigating"
                className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-colors hover:border-teal-300 hover:bg-teal-50/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-teal-700 dark:hover:bg-slate-800 dark:focus-visible:outline-teal-400"
              >
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  Open Incidents
                </p>
                <p className="mt-2 text-3xl font-semibold text-slate-950 dark:text-slate-50">
                  {stats.openIncidentCount}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">
                  Status open or investigating
                </p>
                <p className="mt-2 text-xs text-teal-700 dark:text-teal-300">
                  View open incidents →
                </p>
              </Link>
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <h2 className="text-lg font-medium text-slate-950 dark:text-slate-50">
                  Risk Heat Map
                </h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  Click a cell to filter risks by likelihood and impact.
                </p>
                <div className="mt-6">
                  <RiskHeatMap risks={charts.risks} />
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <h2 className="text-lg font-medium text-slate-950 dark:text-slate-50">
                  Risks by Risk Score
                </h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  Click a bar to filter the risk register by risk score.
                </p>
                <div className="mt-4">
                  <RiskSeverityBarChart data={charts.severityBands} />
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <h2 className="text-lg font-medium text-slate-950 dark:text-slate-50">
                  Controls by Effectiveness
                </h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  Click a slice to filter controls.
                </p>
                <div className="mt-4">
                  <ControlsEffectivenessDonut
                    data={charts.controlEffectiveness}
                  />
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <h2 className="text-lg font-medium text-slate-950 dark:text-slate-50">
                  Incidents by Status
                </h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  Click a slice to filter incidents.
                </p>
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
