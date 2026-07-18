import type { Control } from "@/lib/types/control";
import {
  formatEffectiveness,
  getTestingStatus,
} from "@/lib/types/control";
import type { LinkedControl } from "@/lib/types/risk-control";
import { inputClassName } from "./constants";

type LinkedControlsPanelProps = {
  links: LinkedControl[];
  userControls: Control[];
  selectedControlId: string;
  controlSearch: string;
  linking: boolean;
  unlinkingLinkId: string | null;
  onControlSearchChange: (value: string) => void;
  onSelectedControlChange: (controlId: string) => void;
  onLink: () => void;
  onUnlink: (linkId: string) => void;
};

export function LinkedControlsPanel({
  links,
  userControls,
  selectedControlId,
  controlSearch,
  linking,
  unlinkingLinkId,
  onControlSearchChange,
  onSelectedControlChange,
  onLink,
  onUnlink,
}: LinkedControlsPanelProps) {
  const linkedControlIds = new Set(links.map((link) => link.controlId));
  const search = controlSearch.trim().toLowerCase();

  const availableControls = userControls.filter((control) => {
    if (linkedControlIds.has(control.id)) {
      return false;
    }

    if (!search) {
      return true;
    }

    return control.title.toLowerCase().includes(search);
  });

  return (
    <div className="space-y-4 rounded-xl border border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-800 dark:bg-zinc-900/50">
      <h3 className="text-sm font-medium text-zinc-950 dark:text-zinc-50">
        Linked Controls
      </h3>

      {links.length === 0 ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          No controls linked to this risk yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-zinc-50 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-2 font-medium">Title</th>
                <th className="px-4 py-2 font-medium">Effectiveness</th>
                <th className="px-4 py-2 font-medium">Testing Status</th>
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
                    {formatEffectiveness(link.effectiveness)}
                  </td>
                  <td className="px-4 py-3 text-zinc-950 dark:text-zinc-50">
                    {getTestingStatus(link.last_tested_at)}
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
            Search controls
          </span>
          <input
            type="search"
            value={controlSearch}
            onChange={(event) => onControlSearchChange(event.target.value)}
            placeholder="Filter by title..."
            className={inputClassName}
          />
        </label>

        <label className="flex flex-1 flex-col gap-1">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Link control
          </span>
          <select
            value={selectedControlId}
            onChange={(event) => onSelectedControlChange(event.target.value)}
            className={inputClassName}
          >
            <option value="">Select a control...</option>
            {availableControls.map((control) => (
              <option key={control.id} value={control.id}>
                {control.title}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={onLink}
          disabled={!selectedControlId || linking}
          className="rounded-lg bg-zinc-950 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
        >
          {linking ? "Linking..." : "Link Control"}
        </button>
      </div>

      {userControls.length === 0 && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Create controls on the{" "}
          <a
            href="/controls"
            className="font-medium text-zinc-950 underline underline-offset-2 dark:text-zinc-50"
          >
            controls page
          </a>{" "}
          before linking them here.
        </p>
      )}

      {userControls.length > 0 &&
        availableControls.length === 0 &&
        links.length > 0 &&
        !search && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            All of your controls are already linked to this risk.
          </p>
        )}
    </div>
  );
}
