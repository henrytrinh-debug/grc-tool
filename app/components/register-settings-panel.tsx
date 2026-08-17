"use client";

import Link from "next/link";
import { MethodologySettings, type MethodologySection } from "@/app/components/methodology-settings";
import { RegisterPresets } from "@/app/components/register-presets";
import { SectionCard } from "@/app/components/page-parts";
import { mutedTextClassName } from "@/app/components/ui";
import { useSettings } from "@/lib/settings/context";
import type { RegisterPresetModule } from "@/lib/settings/preferences";

export function RegisterSettingsPanel({
  module: registerModule,
  sections,
  extra,
}: {
  module: RegisterPresetModule | "evidence";
  sections?: MethodologySection[];
  extra?: string;
}) {
  const { loading } = useSettings();

  return (
    <div className="flex flex-col gap-6">
      {sections && sections.length > 0 ? (
        loading ? (
          <p className={`text-sm ${mutedTextClassName}`}>Loading settings...</p>
        ) : (
          <MethodologySettings key="ready" sections={sections} />
        )
      ) : null}

      {registerModule !== "evidence" ? (
        <SectionCard
          title="Saved views"
          description="Filter the register, then save the query. Saved views also appear in the command palette."
        >
          <div className="flex flex-wrap gap-2">
            <RegisterPresets module={registerModule} />
          </div>
        </SectionCard>
      ) : null}

      <SectionCard
        title="Organisation settings"
        description="People, taxonomy, workspace layout, and demonstration data stay in Admin because they apply across registers."
      >
        <p className={`text-sm ${mutedTextClassName}`}>
          {extra ??
            "Scoring and cadence for this register are above. Organisation-wide configuration is in Admin."}{" "}
          <Link
            href="/admin"
            className="font-medium text-teal-800 hover:underline dark:text-teal-300"
          >
            Open Admin
          </Link>
        </p>
      </SectionCard>
    </div>
  );
}
