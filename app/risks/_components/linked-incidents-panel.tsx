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

  const filteredLinks = links.filter((link) => {
    if (!search) {
      return true;
    }

    return link.title.toLowerCase().includes(search);
  });

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
    <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-900/60">
      <h3 className="text-sm font-medium text-slate-950 dark:text-slate-50">
        Linked Incidents
      </h3>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Search incidents
        </span>
        <input
          type="search"
          value={incidentSearch}
          onChange={(event) => onIncidentSearchChange(event.target.value)}
          placeholder="Filter linked and available incidents by title..."
          className={inputClassName}
        />
      </label>

      {links.length === 0 ? (
        <p className="text-sm text-slate-600 dark:text-slate-400">
          No incidents linked to this risk yet.
        </p>
      ) : filteredLinks.length === 0 ? (
        <p className="text-sm text-slate-600 dark:text-slate-400">
          No linked incidents match “{incidentSearch.trim()}”.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 dark:bg-slate-900 dark:text-slate-400">
              <tr>
                <th className="px-4 py-2 font-medium">Title</th>
                <th className="px-4 py-2 font-medium">Date Occurred</th>
                <th className="px-4 py-2 font-medium">Severity</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {filteredLinks.map((link) => (
                <tr key={link.linkId}>
                  <td className="px-4 py-3 font-medium text-slate-950 dark:text-slate-50">
                    {link.title}
                  </td>
                  <td className="px-4 py-3 text-slate-950 dark:text-slate-50">
                    {formatDateOccurred(link.date_occurred)}
                  </td>
                  <td className="px-4 py-3 text-slate-950 dark:text-slate-50">
                    {formatSeverity(link.severity)}
                  </td>
                  <td className="px-4 py-3 text-slate-950 dark:text-slate-50">
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
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
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
          className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-600 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-teal-400 dark:text-slate-950 dark:hover:bg-teal-300"
        >
          {linking ? "Linking..." : "Link Incident"}
        </button>
      </div>

      {userIncidents.length === 0 && (
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Create incidents on the{" "}
          <a
            href="/incidents"
            className="font-medium text-teal-700 underline underline-offset-2 dark:text-teal-300"
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
          <p className="text-sm text-slate-600 dark:text-slate-400">
            All of your incidents are already linked to this risk.
          </p>
        )}

      {userIncidents.length > 0 && availableIncidents.length === 0 && search && (
        <p className="text-sm text-slate-600 dark:text-slate-400">
          No available incidents match “{incidentSearch.trim()}”.
        </p>
      )}
    </div>
  );
}
