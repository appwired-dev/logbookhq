"use client";

import { Suspense, useState, useTransition } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { login } from "./actions";
import { AuthShell } from "@/components/AuthShell";
import { LoginFormSkeleton } from "./loading";
import { recoveryStrings } from "@/app/auth/recovery-strings";

export default function LoginPage() {
  return (
    <AuthShell title="Sign in" subtitle="Welcome back to Pilot Logbook HQ.">
      <Suspense fallback={<LoginFormSkeleton />}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}

const LINK =
  "text-brand hover:underline rounded-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

function LoginForm() {
  const sp = useSearchParams();
  const next = sp.get("next") ?? "/app";
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // This page is still English-only (title, field labels, footer). The
  // recovery copy is authored in all four locales, so the link pins "en" here
  // rather than inventing a fifth source of truth; when /login and /signup get
  // their localisation pass, swap "en" for the active locale and the label
  // follows.
  const s = recoveryStrings("en");

  return (
    <form
      action={(fd) => {
        setError(null);
        fd.set("next", next);
        startTransition(async () => {
          const r = await login(fd);
          if (r?.error) setError(r.error);
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
          <Link href="/forgot-password" className={`${LINK} text-2xs font-medium mb-1.5`}>
            {s("forgotLink")}
          </Link>
        </div>
        <input id="login-password" className="input" type="password" name="password" autoComplete="current-password" required />
      </div>
      {error && <p className="text-sm text-bad-ink">{error}</p>}
      <button className="btn btn-primary w-full" type="submit" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
      <p className="text-sm text-ink-3 text-center">
        New here? <Link className={LINK} href="/signup">Create an account</Link>
      </p>
    </form>
  );
}
