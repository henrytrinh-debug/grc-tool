"use client";

import Link from "next/link";
import { Suspense, useCallback, useMemo, useState } from "react";
import { ClickableRow } from "@/app/components/clickable-row";
import { QualityTitle } from "@/app/components/quality-indicator";
import {
  IncidentSeverityBadge,
  IncidentStatusBadge,
} from "@/app/components/status-badge";
import { FilterSelect, ListToolbar } from "@/app/components/list-toolbar";
import { RegisterPresets } from "@/app/components/register-presets";
import {
  ErrorBanner,
  ListEmpty,
  LoadingBlock,
  PageHeader,
  PageLoading,
  RegisterTable,
  registerTheadClassName,
} from "@/app/components/page-parts";
import { primaryButtonClassName, secondaryButtonClassName } from "@/app/components/ui";
import { incidentQuality } from "@/lib/data-quality/record";
import { useListFilters } from "@/lib/hooks/use-list-filters";
import { useRequireAuth } from "@/lib/hooks/use-require-auth";
import {
  filterIncidents,
  hasActiveFilters,
  parseIncidentFilters,
  sortIncidentsByPriority,
} from "@/lib/list-filters";
import { downloadCsv } from "@/lib/export/csv";
import { useSettings } from "@/lib/settings/context";
import { getSupabaseClient } from "@/lib/supabase/client";
import { throwIfAnyQueryError } from "@/lib/supabase/owned";
import {
  assigneeFilterOptions,
  categoryFilterOptions,
  indexLinkedCategoriesFromRisks,
  uniqueCategoryLabels,
} from "@/lib/taxonomy";
import {
  departmentFilterOptions,
  formatPersonDepartment,
  formatPersonName,
  personByEmail,
} from "@/lib/types/person";
import {
  formatDateOccurred,
  formatIncidentStatus,
  formatSeverity,
  getOpenIncidentAgeDays,
  isIncidentOpen,
  SEVERITY_OPTIONS,
  STATUS_OPTIONS,
  type Incident,
} from "@/lib/types/incident";
import {
  groupIncidentRiskRowsByIncident,
  INCIDENT_RISK_RISK_SELECT,
  INCIDENT_RISK_RISK_SELECT_WITH_CATEGORY,
  type IncidentRiskRow,
} from "@/lib/types/incident-risk";
import { countByKey, countGroupedLinks } from "@/lib/types/join-utils";

function IncidentsPageContent() {
  const { filters, updateFilters, clearFilters } = useListFilters(
    "/incidents",
    parseIncidentFilters,
  );

  const { categories, schemaReady, people, enterpriseReady, operatingReady } = useSettings();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [linkedRiskCounts, setLinkedRiskCounts] = useState<
    Record<string, number>
  >({});
  const [linkedCategoryIds, setLinkedCategoryIds] = useState<
    Record<string, string[]>
  >({});
  const [linkedControlCounts, setLinkedControlCounts] = useState<
    Record<string, number>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadIncidents = useCallback(async (ownerId: string) => {
    setError(null);

    try {
      const supabase = getSupabaseClient();
      const [incidentsResult, linksResult, controlLinksResult] =
        await Promise.all([
          supabase
            .from("incidents")
            .select("*")
            .eq("owner_id", ownerId)
            .order("date_occurred", { ascending: false }),
          supabase
            .from("incident_risks")
            .select(
              schemaReady
                ? INCIDENT_RISK_RISK_SELECT_WITH_CATEGORY
                : INCIDENT_RISK_RISK_SELECT,
            )
            .eq("owner_id", ownerId),
          operatingReady
            ? supabase
                .from("incident_controls")
                .select("incident_id")
                .eq("owner_id", ownerId)
            : Promise.resolve({ data: [] as { incident_id: string }[], error: null }),
        ]);

      throwIfAnyQueryError([incidentsResult, linksResult, controlLinksResult]);

      setIncidents((incidentsResult.data ?? []) as Incident[]);

      const grouped = groupIncidentRiskRowsByIncident(
        (linksResult.data ?? []) as IncidentRiskRow[],
      );
      setLinkedRiskCounts(countGroupedLinks(grouped));
      setLinkedCategoryIds(indexLinkedCategoriesFromRisks(grouped));
      setLinkedControlCounts(
        operatingReady
          ? countByKey(
              (controlLinksResult.data ?? []) as { incident_id: string }[],
              (row) => row.incident_id,
            )
          : {},
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load incidents");
    } finally {
      setLoading(false);
    }
  }, [operatingReady, schemaReady]);

  const { user, authLoading } = useRequireAuth(loadIncidents);
  const myPersonId = personByEmail(people, user?.email)?.id ?? null;

  const filteredIncidents = useMemo(
    () =>
      sortIncidentsByPriority(
        filterIncidents(incidents, filters, {
          linkedCategoryIds,
          myPersonId,
          people,
        }),
      ),
    [incidents, filters, linkedCategoryIds, myPersonId, people],
  );

  const statusFilterValue =
    filters.status.length === 2 &&
    filters.status.includes("open") &&
    filters.status.includes("investigating")
      ? "open,investigating"
      : filters.status.length === 1
        ? filters.status[0]
        : "";

  const filtersActive = hasActiveFilters({
    q: filters.q,
    severity: filters.severity,
    status: filters.status,
    categoryId: filters.categoryId,
    assignee: filters.assignee,
    department: filters.department,
  });

  if (authLoading) {
    return <PageLoading />;
  }

  return (
    <div className="min-h-full min-w-0 bg-slate-50 px-6 py-10 dark:bg-slate-950">
      <main className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-8">
        <PageHeader
          title="Incident Register"
          description="Track and manage security and compliance incidents."
          breadcrumbs={[
            { href: "/", label: "Home" },
            { label: "Incidents" },
          ]}
          actions={
            <Link href="/incidents/new" className={primaryButtonClassName}>
              Add Incident
            </Link>
          }
        />

        <ErrorBanner message={error} />

        <section className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <ListToolbar
            search={filters.q}
            onSearchChange={(value) => updateFilters({ q: value })}
            searchPlaceholder="Search title, description, or root cause..."
            showing={filteredIncidents.length}
            total={incidents.length}
            hasFilters={filtersActive}
            onClear={clearFilters}
            actions={
              <>
                <RegisterPresets module="incidents" />
                {filteredIncidents.length > 0 ? (
                <button
                  type="button"
                  className={secondaryButtonClassName}
                  onClick={() =>
                    downloadCsv(
                      "incident-register",
                      [
                        "Title",
                        "Date Occurred",
                        "Severity",
                        "Status",
                        "Age (days)",
                        "Category",
                        "Assignee",
                        "Department",
                        "Linked Risks",
                        "Linked Controls",
                      ],
                      filteredIncidents.map((incident) => [
                        incident.title,
                        formatDateOccurred(incident.date_occurred),
                        formatSeverity(incident.severity),
                        formatIncidentStatus(incident.status),
                        getOpenIncidentAgeDays(incident) ?? "",
                        uniqueCategoryLabels(
                          categories,
                          linkedCategoryIds[incident.id] ?? [],
                        ),
                        formatPersonName(people, incident.assignee_id),
                        formatPersonDepartment(people, incident.assignee_id),
                        linkedRiskCounts[incident.id] ?? 0,
                        linkedControlCounts[incident.id] ?? 0,
                      ]),
                    )
                  }
                >
                  Export CSV
                </button>
                ) : null}
              </>
            }
          >
            <FilterSelect
              label="Severity"
              value={filters.severity}
              onChange={(value) => updateFilters({ severity: value })}
              options={[
                ...SEVERITY_OPTIONS.map((option) => ({
                  value: option.value,
                  label: option.label,
                })),
                { value: "high,critical", label: "High or Critical" },
              ]}
            />
            <FilterSelect
              label="Status"
              value={statusFilterValue}
              onChange={(value) => updateFilters({ status: value })}
              options={[
                ...STATUS_OPTIONS.map((option) => ({
                  value: option.value,
                  label: option.label,
                })),
                {
                  value: "open,investigating",
                  label: "Open or Investigating",
                },
              ]}
            />
            {schemaReady && (
              <FilterSelect
                label="Category"
                value={filters.categoryId}
                onChange={(value) => updateFilters({ category: value })}
                options={categoryFilterOptions(categories)}
              />
            )}
            {enterpriseReady && (
              <>
                <FilterSelect
                  label="Owner"
                  value={filters.assignee}
                  onChange={(value) => updateFilters({ assignee: value })}
                  options={assigneeFilterOptions(people)}
                />
                {departmentFilterOptions(people).length > 0 && (
                  <FilterSelect
                    label="Department"
                    value={filters.department}
                    onChange={(value) => updateFilters({ department: value })}
                    options={departmentFilterOptions(people)}
                  />
                )}
              </>
            )}
          </ListToolbar>

          {loading ? (
            <LoadingBlock label="Loading incidents..." />
          ) : incidents.length === 0 ? (
            <ListEmpty>
              No incidents yet.{" "}
              <Link
                href="/incidents/new"
                className="font-medium text-teal-700 underline underline-offset-2 dark:text-teal-300"
              >
                Add your first incident
              </Link>
              .
            </ListEmpty>
          ) : filteredIncidents.length === 0 ? (
            <ListEmpty>No incidents match the current filters.</ListEmpty>
          ) : (
            <RegisterTable>
                <thead className={registerTheadClassName}>
                  <tr>
                    <th className="px-6 py-3 font-medium">Title</th>
                    {schemaReady && (
                      <th className="px-6 py-3 font-medium">Category</th>
                    )}
                    {enterpriseReady && (
                      <th className="px-6 py-3 font-medium">Assignee</th>
                    )}
                    <th className="px-6 py-3 font-medium">Date Occurred</th>
                    <th className="px-6 py-3 font-medium">Age</th>
                    <th className="px-6 py-3 font-medium">Severity</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                    <th className="px-6 py-3 font-medium">Linked Risks</th>
                    {operatingReady && (
                      <th className="px-6 py-3 font-medium">Controls</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {filteredIncidents.map((incident) => {
                    const ageDays = getOpenIncidentAgeDays(incident);
                    const needsAttention =
                      isIncidentOpen(incident.status) &&
                      (incident.severity === "critical" ||
                        incident.severity === "high");

                    return (
                    <ClickableRow
                      key={incident.id}
                      href={`/incidents/${incident.id}/edit`}
                      label={`Open ${incident.title}`}
                      className={
                        needsAttention
                          ? "bg-amber-50/50 dark:bg-amber-950/20"
                          : undefined
                      }
                    >
                      <td className="px-6 py-4 font-medium text-slate-950 dark:text-slate-50">
                        <QualityTitle
                          summary={incidentQuality(incident, { enterpriseReady })}
                        >
                          {incident.title}
                        </QualityTitle>
                      </td>
                      {schemaReady && (
                        <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                          {uniqueCategoryLabels(
                            categories,
                            linkedCategoryIds[incident.id] ?? [],
                          )}
                        </td>
                      )}
                      {enterpriseReady && (
                        <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                          {formatPersonName(people, incident.assignee_id)}
                        </td>
                      )}
                      <td className="px-6 py-4 text-slate-950 dark:text-slate-50">
                        {formatDateOccurred(incident.date_occurred)}
                      </td>
                      <td className="px-6 py-4 text-slate-950 dark:text-slate-50">
                        {ageDays === null ? "—" : `${ageDays}d`}
                      </td>
                      <td className="px-6 py-4">
                        <IncidentSeverityBadge
                          severity={incident.severity}
                          label={formatSeverity(incident.severity)}
                        />
                      </td>
                      <td className="px-6 py-4">
                        <IncidentStatusBadge
                          status={incident.status}
                          label={formatIncidentStatus(incident.status)}
                        />
                      </td>
                      <td className="px-6 py-4 text-slate-950 dark:text-slate-50">
                        {linkedRiskCounts[incident.id] ?? 0}
                      </td>
                      {operatingReady && (
                        <td className="px-6 py-4 text-slate-950 dark:text-slate-50">
                          {linkedControlCounts[incident.id] ?? 0}
                        </td>
                      )}
                    </ClickableRow>
                    );
                  })}
                </tbody>
            </RegisterTable>
          )}
        </section>
      </main>
    </div>
  );
}

export default function IncidentsPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <IncidentsPageContent />
    </Suspense>
  );
}
