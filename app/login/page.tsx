"use client";

import { Suspense, useState, useTransition } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { login } from "./actions";
import { AuthShell } from "@/components/AuthShell";
import { LoginFormSkeleton } from "./loading";
import { Turnstile } from "@/components/ui/Turnstile";

export default function LoginPage() {
  return (
    <AuthShell title="Sign in" subtitle="Welcome back to Pilot Logbook HQ.">
      <Suspense fallback={<LoginFormSkeleton />}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}

function LoginForm() {
  const sp = useSearchParams();
  const next = sp.get("next") ?? "/app";
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // Turnstile tokens are single-use; a rejected attempt remounts the widget
  // (bump the key) so the next submit carries a fresh one.
  const [attempt, setAttempt] = useState(0);

  return (
    <form
      action={(fd) => {
        setError(null);
        fd.set("next", next);
        startTransition(async () => {
          const r = await login(fd);
          if (r?.error) {
            setError(r.error);
            setAttempt((n) => n + 1);
          }
        });
      }}
      className="space-y-4"
    >
      <div>
        <label className="label" htmlFor="login-email">Email</label>
        <input id="login-email" className="input" type="email" name="email" autoComplete="email" required />
      </div>
      <div>
        <div className="flex items-baseline justify-between gap-3">
          <label className="label" htmlFor="login-password">Password</label>
          <Link
            href="/forgot-password"
            className="text-2xs text-brand hover:underline rounded-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
          >
            Forgot password?
          </Link>
        </div>
        <input id="login-password" className="input" type="password" name="password" autoComplete="current-password" required />
      </div>
      <Turnstile key={attempt} />
      {error && <p className="text-sm text-bad-ink" role="alert">{error}</p>}
      <button className="btn btn-primary w-full" type="submit" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
      <p className="text-sm text-ink-3 text-center">
        New here? <Link className="text-brand hover:underline" href="/signup">Create an account</Link>
      </p>
    </form>
  );
}
