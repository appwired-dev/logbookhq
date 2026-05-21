"use client";

import { Suspense, useState, useTransition } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { login } from "./actions";
import { AuthShell } from "@/components/AuthShell";

export default function LoginPage() {
  return (
    <AuthShell title="Sign in" subtitle="Welcome back to Pilot Logbook HQ.">
      <Suspense fallback={<div className="text-sm text-slate-500">Loading…</div>}>
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
        <label className="label">Email</label>
        <input className="input" type="email" name="email" autoComplete="email" required />
      </div>
      <div>
        <label className="label">Password</label>
        <input className="input" type="password" name="password" autoComplete="current-password" required />
      </div>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <button className="btn btn-primary w-full" type="submit" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
      <p className="text-sm text-slate-500 text-center">
        New here? <Link className="text-sky-600 hover:underline" href="/signup">Create an account</Link>
      </p>
    </form>
  );
}
