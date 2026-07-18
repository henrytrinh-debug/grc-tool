import type { Incident } from "@/lib/types/incident";
import {
  formatDateOccurred,
  formatIncidentStatus,
  formatSeverity,
} from "@/lib/types/incident";
import type { LinkedIncident } from "@/lib/types/incident-risk";
import { inputClassName } from "./constants";

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

export function LinkedIncidentsPanel({
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
    <div className="space-y-4 rounded-xl border border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-800 dark:bg-zinc-900/50">
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
