"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { signup } from "../login/actions";
import { AuthShell } from "@/components/AuthShell";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";

export default function SignupPage() {
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <AuthShell title="Create your account" subtitle="$30/yr or $119 lifetime — start free.">
      <form
        action={(fd) => {
          setError(null);
          setMessage(null);
          startTransition(async () => {
            const r = await signup(fd);
            if (r?.error) {
              setError(r.error);
            } else if (r?.message) {
              setMessage(r.message);
            }
          });
        }}
        className="space-y-4"
      >
        <GoogleSignInButton />
        <div>
          <label className="label" htmlFor="signup-name">Full Name</label>
          <input id="signup-name" className="input" type="text" name="full_name" autoComplete="name" required />
        </div>
        <div>
          <label className="label" htmlFor="signup-email">Email</label>
          <input id="signup-email" className="input" type="email" inputMode="email" name="email" autoComplete="email" required />
        </div>
        <div>
          <label className="label" htmlFor="signup-password">Password</label>
          <input id="signup-password" className="input" type="password" name="password" autoComplete="new-password" minLength={8} required />
          <p className="text-xs text-ink-3 mt-1">At least 8 characters.</p>
        </div>
        {error && <p className="text-sm text-bad-ink" role="alert">{error}</p>}
        {message && <p className="text-sm text-good-ink" role="status">{message}</p>}
        <button className="btn btn-primary w-full" type="submit" disabled={pending}>
          {pending ? "Creating account…" : "Create account"}
        </button>
        <p className="text-sm text-ink-3 text-center">
          Already have one? <Link className="text-brand hover:underline" href="/login">Sign in</Link>
        </p>
      </form>
    </AuthShell>
  );
}
