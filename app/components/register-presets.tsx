"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { listInputClassName } from "@/app/components/list-toolbar";
import { secondaryButtonClassName } from "@/app/components/ui";
import { useSettings } from "@/lib/settings/context";
import {
  addRegisterPreset,
  createRegisterPreset,
  registerPresetHref,
  type RegisterPresetModule,
} from "@/lib/settings/preferences";

export function RegisterPresets({
  module: registerModule,
}: {
  module: RegisterPresetModule;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { settings, saveSettings, preferencesReady } = useSettings();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!preferencesReady) {
    return null;
  }

  const query = searchParams.toString();
  const presets = settings.workspacePreferences.registerPresets.filter(
    (preset) => preset.module === registerModule,
  );

  async function saveCurrentView() {
    const name = window.prompt("Name this saved view");
    if (!name?.trim()) {
      return;
    }

    const preset = createRegisterPreset({ name, module: registerModule, query });
    if (!preset) {
      setError("A saved view needs a name and at least one filter.");
      return;
    }

    const nextPrefs = addRegisterPreset(settings.workspacePreferences, preset);
    if (!nextPrefs) {
      setError("You already have the maximum number of saved views.");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      await saveSettings({
        ...settings,
        workspacePreferences: nextPrefs,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save view");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {presets.length > 0 ? (
            <select
              value=""
              aria-label="Saved views"
              className={`${listInputClassName} w-full sm:w-44`}
              onChange={(event) => {
                const preset = presets.find((item) => item.id === event.target.value);
                if (preset) {
                  router.replace(registerPresetHref(preset));
                }
              }}
            >
              <option value="">Saved views</option>
              {presets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name}
                </option>
              ))}
            </select>
      ) : null}
      {query ? (
        <button
          type="button"
          className={secondaryButtonClassName}
          disabled={busy}
          onClick={() => void saveCurrentView()}
        >
          {busy ? "Saving..." : "Save view"}
        </button>
      ) : null}
      {error ? (
        <p role="alert" className="basis-full text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      ) : null}
    </>
  );
}
