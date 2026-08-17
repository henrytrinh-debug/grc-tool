"use client";

import { useEffect } from "react";
import { useSettings } from "@/lib/settings/context";

export function ThemeApplier() {
  const { settings } = useSettings();
  const { mode, palette } = settings.workspacePreferences.appearance;

  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia("(prefers-color-scheme: dark)");

    function apply() {
      const dark =
        mode === "dark" || (mode === "system" && media.matches);
      root.classList.toggle("dark", dark);
      root.dataset.palette = palette;
    }

    apply();
    if (mode !== "system") {
      return;
    }

    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [mode, palette]);

  return null;
}
