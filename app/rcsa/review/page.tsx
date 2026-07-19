"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase/client";

function RcsaReviewPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session") ?? "";
  const riskIds = useMemo(() => {
    const raw = searchParams.get("risks") ?? "";
    return raw
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
  }, [searchParams]);

  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const supabase = getSupabaseClient();

    async function checkAuth() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/login");
        return;
      }

      setAuthLoading(false);
    }

    void checkAuth();
  }, [router]);

  if (authLoading) {
    return (
      <div className="flex min-h-full items-center justify-center bg-slate-50 dark:bg-slate-950">
        <p className="text-slate-600 dark:text-slate-400">Loading...</p>
      </div>
    );
  }

  if (!sessionId || riskIds.length === 0) {
    return (
      <div className="min-h-full bg-slate-50 px-6 py-10 dark:bg-slate-950">
        <main className="mx-auto flex w-full max-w-3xl flex-col gap-4">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
            RCSA Review
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            No active review session found. Start from the checklist to begin.
          </p>
          <Link
            href="/rcsa/start"
            className="inline-flex w-fit rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-600 dark:bg-teal-400 dark:text-slate-950 dark:hover:bg-teal-300"
          >
            Go to Start Review
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-slate-50 px-6 py-10 dark:bg-slate-950">
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <header>
          <Link
            href="/rcsa/start"
            className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-950 dark:text-slate-400 dark:hover:text-slate-50"
          >
            ← Back to checklist
          </Link>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
            RCSA Review
          </h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            Session started. The guided review steps will be built next.
          </p>
        </header>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Session ID
          </p>
          <p className="mt-1 font-mono text-sm text-slate-950 dark:text-slate-50">
            {sessionId}
          </p>

          <p className="mt-6 text-sm text-slate-600 dark:text-slate-400">
            Selected risks ({riskIds.length})
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-950 dark:text-slate-50">
            {riskIds.map((riskId) => (
              <li key={riskId} className="font-mono">
                {riskId}
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}

export default function RcsaReviewPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-full items-center justify-center bg-slate-50 dark:bg-slate-950">
          <p className="text-slate-600 dark:text-slate-400">Loading...</p>
        </div>
      }
    >
      <RcsaReviewPageContent />
    </Suspense>
  );
}
