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

  const filteredLinks = links.filter((link) => {
    if (!search) {
      return true;
    }

    return link.title.toLowerCase().includes(search);
  });

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
    <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-900/60">
      <h3 className="text-sm font-medium text-slate-950 dark:text-slate-50">
        Linked Controls
      </h3>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Search controls
        </span>
        <input
          type="search"
          value={controlSearch}
          onChange={(event) => onControlSearchChange(event.target.value)}
          placeholder="Filter linked and available controls by title..."
          className={inputClassName}
        />
      </label>

      {links.length === 0 ? (
        <p className="text-sm text-slate-600 dark:text-slate-400">
          No controls linked to this risk yet.
        </p>
      ) : filteredLinks.length === 0 ? (
        <p className="text-sm text-slate-600 dark:text-slate-400">
          No linked controls match “{controlSearch.trim()}”.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 dark:bg-slate-900 dark:text-slate-400">
              <tr>
                <th className="px-4 py-2 font-medium">Title</th>
                <th className="px-4 py-2 font-medium">Effectiveness</th>
                <th className="px-4 py-2 font-medium">Testing Status</th>
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
                    {formatEffectiveness(link.effectiveness)}
                  </td>
                  <td className="px-4 py-3 text-slate-950 dark:text-slate-50">
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
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
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
          className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-600 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-teal-400 dark:text-slate-950 dark:hover:bg-teal-300"
        >
          {linking ? "Linking..." : "Link Control"}
        </button>
      </div>

      {userControls.length === 0 && (
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Create controls on the{" "}
          <a
            href="/controls"
            className="font-medium text-teal-700 underline underline-offset-2 dark:text-teal-300"
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
          <p className="text-sm text-slate-600 dark:text-slate-400">
            All of your controls are already linked to this risk.
          </p>
        )}

      {userControls.length > 0 && availableControls.length === 0 && search && (
        <p className="text-sm text-slate-600 dark:text-slate-400">
          No available controls match “{controlSearch.trim()}”.
        </p>
      )}
    </div>
  );
}
