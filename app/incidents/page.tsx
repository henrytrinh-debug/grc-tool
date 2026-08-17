"use client";

import Link from "next/link";
import { Suspense, useCallback, useMemo, useState } from "react";
import { ClickableRow } from "@/app/components/clickable-row";
import { ColumnHeader } from "@/app/components/column-header";
import { QualityTitle } from "@/app/components/quality-indicator";
import {
  IncidentSeverityBadge,
  IncidentStatusBadge,
} from "@/app/components/status-badge";
import { ListToolbar } from "@/app/components/list-toolbar";
import { RegisterPresets } from "@/app/components/register-presets";
import { RegisterPageShell } from "@/app/components/register-page-shell";
import { RegisterSettingsPanel } from "@/app/components/register-settings-panel";
import {
  ErrorBanner,
  ListEmpty,
  LoadingBlock,
  PageLoading,
  RegisterTable,
  registerTheadClassName,
} from "@/app/components/page-parts";
import { primaryButtonClassName, secondaryButtonClassName } from "@/app/components/ui";
import { IncidentSummary } from "@/app/incidents/_components/incident-summary";
import { incidentQuality } from "@/lib/data-quality/record";
import { applySort } from "@/lib/list-sort";
import { useListFilters } from "@/lib/hooks/use-list-filters";
import { useRequireAuth } from "@/lib/hooks/use-require-auth";
import {
  filterIncidents,
  hasActiveFilters,
  parseIncidentFilters,
  sortIncidentsByPriority,
} from "@/lib/list-filters";
import { parseRegisterView } from "@/lib/register/view";
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
  const { filters, updateRegisterFilters, clearFilters, sort, searchParams } =
    useListFilters("/incidents", parseIncidentFilters);

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

  const filteredIncidents = useMemo(() => {
    const rows = sortIncidentsByPriority(
      filterIncidents(incidents, filters, {
        linkedCategoryIds,
        myPersonId,
        people,
      }),
    );
    return applySort(rows, sort, {
      title: (incident) => incident.title,
      category: (incident) =>
        uniqueCategoryLabels(categories, linkedCategoryIds[incident.id] ?? []),
      assignee: (incident) => formatPersonName(people, incident.assignee_id),
      occurred: (incident) => incident.date_occurred,
      age: (incident) => getOpenIncidentAgeDays(incident) ?? -1,
      severity: (incident) => incident.severity,
      status: (incident) => incident.status,
      risks: (incident) => linkedRiskCounts[incident.id] ?? 0,
      controls: (incident) => linkedControlCounts[incident.id] ?? 0,
    });
  }, [
    incidents,
    filters,
    linkedCategoryIds,
    myPersonId,
    people,
    sort,
    categories,
    linkedRiskCounts,
    linkedControlCounts,
  ]);

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
  const view = parseRegisterView(searchParams, filtersActive);
  const departmentOptions = departmentFilterOptions(people);

  if (authLoading) {
    return <PageLoading />;
  }

  return (
    <RegisterPageShell
      title="Incident Register"
      description="Track and manage security and compliance incidents."
      path="/incidents"
      hasListFilters={filtersActive}
      actions={
        <Link href="/incidents/new" className={primaryButtonClassName}>
          Add Incident
        </Link>
      }
    >
        <ErrorBanner message={error} />

        {view === "settings" ? (
          <RegisterSettingsPanel
            module="incidents"
            extra="Incident severity and status live on each record. People, taxonomy, and workspace layout stay in Admin."
          />
        ) : null}

        {view === "summary" ? (
          loading ? (
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
          ) : (
            <IncidentSummary incidents={incidents} />
          )
        ) : null}

        {view === "register" ? (
        <section className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <ListToolbar
            search={filters.q}
            onSearchChange={(value) => updateRegisterFilters({ q: value })}
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
          />

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
                    <th className="px-6 py-3">
                      <ColumnHeader
                        label="Title"
                        sortKey="title"
                        currentSort={sort}
                        onSort={(value) => updateRegisterFilters({ sort: value })}
                      />
                    </th>
                    {schemaReady && (
                      <th className="px-6 py-3">
                        <ColumnHeader
                          label="Category"
                          sortKey="category"
                          currentSort={sort}
                          onSort={(value) => updateRegisterFilters({ sort: value })}
                          filterValue={filters.categoryId}
                          filterOptions={categoryFilterOptions(categories)}
                          onFilterChange={(value) =>
                            updateRegisterFilters({ category: value })
                          }
                        />
                      </th>
                    )}
                    {enterpriseReady && (
                      <th className="px-6 py-3">
                        <ColumnHeader
                          label="Assignee"
                          sortKey="assignee"
                          currentSort={sort}
                          onSort={(value) => updateRegisterFilters({ sort: value })}
                          filterValue={filters.assignee}
                          filterOptions={assigneeFilterOptions(people)}
                          onFilterChange={(value) =>
                            updateRegisterFilters({ assignee: value })
                          }
                          extraFilter={
                            departmentOptions.length > 0
                              ? {
                                  label: "Department",
                                  value: filters.department,
                                  options: departmentOptions,
                                  onChange: (value) =>
                                    updateRegisterFilters({ department: value }),
                                }
                              : undefined
                          }
                        />
                      </th>
                    )}
                    <th className="px-6 py-3">
                      <ColumnHeader
                        label="Date Occurred"
                        sortKey="occurred"
                        currentSort={sort}
                        onSort={(value) => updateRegisterFilters({ sort: value })}
                      />
                    </th>
                    <th className="px-6 py-3">
                      <ColumnHeader
                        label="Age"
                        sortKey="age"
                        currentSort={sort}
                        onSort={(value) => updateRegisterFilters({ sort: value })}
                      />
                    </th>
                    <th className="px-6 py-3">
                      <ColumnHeader
                        label="Severity"
                        sortKey="severity"
                        currentSort={sort}
                        onSort={(value) => updateRegisterFilters({ sort: value })}
                        filterValue={filters.severity}
                        filterOptions={[
                          ...SEVERITY_OPTIONS.map((option) => ({
                            value: option.value,
                            label: option.label,
                          })),
                          { value: "high,critical", label: "High or Critical" },
                        ]}
                        onFilterChange={(value) =>
                          updateRegisterFilters({ severity: value })
                        }
                      />
                    </th>
                    <th className="px-6 py-3">
                      <ColumnHeader
                        label="Status"
                        sortKey="status"
                        currentSort={sort}
                        onSort={(value) => updateRegisterFilters({ sort: value })}
                        filterValue={statusFilterValue}
                        filterOptions={[
                          ...STATUS_OPTIONS.map((option) => ({
                            value: option.value,
                            label: option.label,
                          })),
                          {
                            value: "open,investigating",
                            label: "Open or Investigating",
                          },
                        ]}
                        onFilterChange={(value) =>
                          updateRegisterFilters({ status: value })
                        }
                      />
                    </th>
                    <th className="px-6 py-3">
                      <ColumnHeader
                        label="Linked Risks"
                        sortKey="risks"
                        currentSort={sort}
                        onSort={(value) => updateRegisterFilters({ sort: value })}
                      />
                    </th>
                    {operatingReady && (
                      <th className="px-6 py-3">
                        <ColumnHeader
                          label="Controls"
                          sortKey="controls"
                          currentSort={sort}
                          onSort={(value) => updateRegisterFilters({ sort: value })}
                        />
                      </th>
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
        ) : null}
    </RegisterPageShell>
  );
}

export default function IncidentsPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <IncidentsPageContent />
    </Suspense>
  );
}
