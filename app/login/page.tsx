"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ErrorBanner, PageLoading } from "@/app/components/page-parts";
import {
  inputClassName,
  labelClassName,
  primaryButtonClassName,
} from "@/app/components/ui";
import { getSupabaseClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    async function checkSession() {
      const supabase = getSupabaseClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        router.replace("/");
        return;
      }

      setLoading(false);
    }

    void checkSession();
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const supabase = getSupabaseClient();

      if (mode === "sign-in") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) {
          throw signInError;
        }

        router.replace("/");
      } else {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });

        if (signUpError) {
          throw signUpError;
        }

        setMessage("Account created. You can sign in now.");
        setMode("sign-in");
        setPassword("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <PageLoading />;
  }

  return (
    <div className="flex min-h-full bg-slate-50 dark:bg-slate-950">
      <div className="relative hidden w-[28rem] overflow-hidden bg-teal-800 px-10 py-12 text-teal-50 lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgb(45_212_191/0.35),transparent_55%)]" />
        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-200">
            GRC
          </p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">
            Governance, risk, and compliance in one register.
          </h1>
          <p className="mt-4 text-sm leading-6 text-teal-100/90">
            Score inherent risk, evidence controls, run assessments, and track
            findings through to close.
          </p>
        </div>
        <ul className="relative space-y-3 text-sm text-teal-100/90">
          <li>Configurable scoring and cadence on each register</li>
          <li>Registers for risks, controls, incidents, and issues</li>
          <li>Second-line oversight of coverage and review currency</li>
        </ul>
      </div>

      <div className="flex flex-1 items-center justify-center px-6 py-10">
      <main className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <header className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700 dark:text-teal-300">
            GRC
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
            {mode === "sign-in" ? "Sign in" : "Create account"}
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Manage risks, controls, incidents, and issues in one place.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className={labelClassName}>Email</span>
            <input
              required
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={inputClassName}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className={labelClassName}>Password</span>
            <input
              required
              type="password"
              autoComplete={
                mode === "sign-in" ? "current-password" : "new-password"
              }
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={inputClassName}
            />
          </label>

          <button
            type="submit"
            disabled={submitting}
            className={primaryButtonClassName}
          >
            {submitting
              ? mode === "sign-in"
                ? "Signing in..."
                : "Creating account..."
              : mode === "sign-in"
                ? "Sign in"
                : "Sign up"}
          </button>
        </form>

        <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
          {mode === "sign-in" ? "Need an account?" : "Already have an account?"}{" "}
          <button
            type="button"
            onClick={() => {
              setMode(mode === "sign-in" ? "sign-up" : "sign-in");
              setError(null);
              setMessage(null);
            }}
            className="font-medium text-teal-700 underline underline-offset-2 dark:text-teal-300"
          >
            {mode === "sign-in" ? "Sign up" : "Sign in"}
          </button>
        </p>

        {message && (
          <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
            {message}
          </p>
        )}

        <div className="mt-4">
          <ErrorBanner message={error} />
        </div>
      </main>
      </div>
    </div>
  );
}
