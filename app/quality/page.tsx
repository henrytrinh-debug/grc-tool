"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import {
  ErrorBanner,
  ListEmpty,
  LoadingBlock,
  PageHeader,
  PageLoading,
  SchemaNotice,
} from "@/app/components/page-parts";
import { RecordLinkList } from "@/app/components/record-link-list";
import { StatCard } from "@/app/components/dashboard/stat-card";
import { mutedTextClassName, pageClassName } from "@/app/components/ui";
import { buildQualityFindings } from "@/lib/data-quality/checks";
import { useRequireAuth } from "@/lib/hooks/use-require-auth";
import { useSettings } from "@/lib/settings/context";
import { getSupabaseClient } from "@/lib/supabase/client";
import { fetchOwnedTableOptional } from "@/lib/supabase/owned";
import {
  emptyGrcSnapshot,
  fetchGrcSnapshot,
  type GrcSnapshot,
} from "@/lib/snapshot/grc-snapshot";
import type { ObligationControlLink } from "@/lib/types/obligation-links";
import type { ObligationRecord } from "@/lib/types/obligation";
import type { EvidenceRecord } from "@/lib/types/evidence";

export default function QualityPage() {
  const { operatingReady, obligationsReady, evidenceReady } = useSettings();
  const [snapshot, setSnapshot] = useState<GrcSnapshot>(emptyGrcSnapshot);
  const [obligations, setObligations] = useState<ObligationRecord[]>([]);
  const [obligationControlLinks, setObligationControlLinks] = useState<
    ObligationControlLink[]
  >([]);
  const [evidence, setEvidence] = useState<EvidenceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (ownerId: string) => {
      setError(null);
      try {
        const supabase = getSupabaseClient();
        const nextSnapshot = await fetchGrcSnapshot(supabase, ownerId, "quality");
        setSnapshot(nextSnapshot);

        const [nextObligations, nextLinks, nextEvidence] = await Promise.all([
          obligationsReady
            ? fetchOwnedTableOptional<ObligationRecord>(
                supabase,
                "obligations",
                ownerId,
              )
            : Promise.resolve([] as ObligationRecord[]),
          obligationsReady
            ? fetchOwnedTableOptional<ObligationControlLink>(
                supabase,
                "obligation_controls",
                ownerId,
                { columns: "obligation_id, control_id" },
              )
            : Promise.resolve([] as ObligationControlLink[]),
          evidenceReady
            ? fetchOwnedTableOptional<EvidenceRecord>(
                supabase,
                "evidence",
                ownerId,
              )
            : Promise.resolve([] as EvidenceRecord[]),
        ]);

        setObligations(nextObligations);
        setObligationControlLinks(nextLinks);
        setEvidence(nextEvidence);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load data quality",
        );
      } finally {
        setLoading(false);
      }
    },
    [evidenceReady, obligationsReady],
  );

  const { authLoading } = useRequireAuth(load);

  const findings = useMemo(
    () =>
      buildQualityFindings({
        risks: snapshot.risks,
        controls: snapshot.controls,
        incidents: snapshot.incidents,
        issues: snapshot.issues,
        indexes: snapshot.indexes,
        riskControlLinks: snapshot.riskControlLinks,
        issueRiskLinks: snapshot.issueRiskLinks,
        issueControlLinks: snapshot.issueControlLinks,
        operatingReady,
        obligations: obligationsReady ? obligations : undefined,
        obligationControlLinks: obligationsReady
          ? obligationControlLinks
          : undefined,
        evidence: evidenceReady ? evidence : undefined,
      }),
    [
      evidence,
      evidenceReady,
      obligationControlLinks,
      obligations,
      obligationsReady,
      operatingReady,
      snapshot,
    ],
  );

  const openFindings = findings.filter((finding) => finding.count > 0);
  const openCount = openFindings.reduce((sum, finding) => sum + finding.count, 0);

  if (authLoading) {
    return <PageLoading />;
  }

  return (
    <div className={`${pageClassName} print:bg-white`}>
      <main className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-8">
        <PageHeader
          title="Data quality"
          description="Completeness and linkage gaps across the registers. This is a live checklist, not a stored score."
          breadcrumbs={[
            { href: "/", label: "Home" },
            { label: "Data quality" },
          ]}
        />

        <ErrorBanner message={error} />

        {loading ? (
          <LoadingBlock label="Checking registers..." />
        ) : (
          <>
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <StatCard
                label="Open quality items"
                value={openCount}
                hint="Records matching at least one check"
                tone={openCount > 0 ? "alert" : "default"}
              />
              <StatCard
                label="Checks with gaps"
                value={openFindings.length}
                hint={`${findings.length} checks run · no score is stored`}
              />
            </section>

            {openCount === 0 ? (
              <ListEmpty>
                No completeness gaps on the current checks. Direct URLs into
                filtered registers still work if you want to inspect the data.
              </ListEmpty>
            ) : (
              <div className="grid min-w-0 gap-6 lg:grid-cols-2">
                {openFindings.map((finding) => (
                  <section
                    key={finding.id}
                    className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                  >
                    <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          {finding.title}
                        </h2>
                        <p className={`mt-1 text-sm ${mutedTextClassName}`}>
                          {finding.description}
                        </p>
                      </div>
                      <Link
                        href={finding.href}
                        className="text-sm font-medium text-teal-800 hover:underline dark:text-teal-300"
                      >
                        Open register ({finding.count})
                      </Link>
                    </div>
                    <RecordLinkList
                      items={finding.items}
                      empty="No records match this check."
                      limit={6}
                      moreHref={finding.href}
                      moreLabel={`Open register (${finding.count})`}
                    />
                  </section>
                ))}
              </div>
            )}

            <p className={`${mutedTextClassName} print:hidden text-sm`}>
              Visibility of this page in the sidebar is presentation only — it
              is not an access-control boundary.
            </p>
            {!operatingReady ? (
              <SchemaNotice>
                Treatment-rationale checks appear after{" "}
                <code className="font-mono">005_operating.sql</code>.
              </SchemaNotice>
            ) : null}
          </>
        )}
      </main>
    </div>
  );
}
