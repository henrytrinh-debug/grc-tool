import type { Risk } from "@/lib/types/risk";
import type { LinkedRisk } from "@/lib/types/risk-control";
import { inputClassName } from "./constants";

type LinkedRisksPanelProps = {
  links: LinkedRisk[];
  userRisks: Risk[];
  selectedRiskId: string;
  riskSearch: string;
  linking: boolean;
  unlinkingLinkId: string | null;
  onRiskSearchChange: (value: string) => void;
  onSelectedRiskChange: (riskId: string) => void;
  onLink: () => void;
  onUnlink: (linkId: string) => void;
};

export function LinkedRisksPanel({
  links,
  userRisks,
  selectedRiskId,
  riskSearch,
  linking,
  unlinkingLinkId,
  onRiskSearchChange,
  onSelectedRiskChange,
  onLink,
  onUnlink,
}: LinkedRisksPanelProps) {
  const linkedRiskIds = new Set(links.map((link) => link.riskId));
  const search = riskSearch.trim().toLowerCase();

  const availableRisks = userRisks.filter((risk) => {
    if (linkedRiskIds.has(risk.id)) {
      return false;
    }

    if (!search) {
      return true;
    }

    return risk.title.toLowerCase().includes(search);
  });

  return (
    <div className="space-y-4 rounded-xl border border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-800 dark:bg-zinc-900/50">
      <h3 className="text-sm font-medium text-zinc-950 dark:text-zinc-50">
        Linked Risks
      </h3>

      {links.length === 0 ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          No risks linked to this control yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-zinc-50 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-2 font-medium">Title</th>
                <th className="px-4 py-2 font-medium">Likelihood</th>
                <th className="px-4 py-2 font-medium">Impact</th>
                <th className="px-4 py-2 font-medium">Owner</th>
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
                    {link.likelihood}
                  </td>
                  <td className="px-4 py-3 text-zinc-950 dark:text-zinc-50">
                    {link.impact}
                  </td>
                  <td className="px-4 py-3 text-zinc-950 dark:text-zinc-50">
                    {link.owner_email}
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
            Search risks
          </span>
          <input
            type="search"
            value={riskSearch}
            onChange={(event) => onRiskSearchChange(event.target.value)}
            placeholder="Filter by title..."
            className={inputClassName}
          />
        </label>

        <label className="flex flex-1 flex-col gap-1">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Link risk
          </span>
          <select
            value={selectedRiskId}
            onChange={(event) => onSelectedRiskChange(event.target.value)}
            className={inputClassName}
          >
            <option value="">Select a risk...</option>
            {availableRisks.map((risk) => (
              <option key={risk.id} value={risk.id}>
                {risk.title}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={onLink}
          disabled={!selectedRiskId || linking}
          className="rounded-lg bg-zinc-950 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
        >
          {linking ? "Linking..." : "Link Risk"}
        </button>
      </div>

      {userRisks.length === 0 && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Create risks on the{" "}
          <a
            href="/risks"
            className="font-medium text-zinc-950 underline underline-offset-2 dark:text-zinc-50"
          >
            risks page
          </a>{" "}
          before linking them here.
        </p>
      )}

      {userRisks.length > 0 &&
        availableRisks.length === 0 &&
        links.length > 0 &&
        !search && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            All of your risks are already linked to this control.
          </p>
        )}
    </div>
  );
}
