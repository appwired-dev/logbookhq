"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * "Continue with Google" — OAuth sign-in via Supabase (PKCE).
 *
 * Self-gating: renders nothing unless NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true".
 * That lets this ship dormant and light up only once the Google provider is
 * enabled in Supabase AND the flag is set — so users never see a button that
 * would fail. Redirects to /auth/callback (same PKCE exchange as recovery);
 * `next` is where the pilot lands after signing in.
 */
export function GoogleSignInButton({ next = "/app" }: { next?: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED !== "true") return null;

  async function signIn() {
    setError(null);
    setPending(true);
    try {
      const supabase = createClient();
      const base =
        process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") || window.location.origin;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${base}/auth/callback?next=${encodeURIComponent(next)}` },
      });
      if (error) throw error;
      // Success: the browser is redirecting to Google; nothing else runs.
    } catch {
      setError("Couldn't start Google sign-in. Please try again.");
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={signIn}
        disabled={pending}
        aria-busy={pending || undefined}
        className="btn w-full"
      >
        <GoogleG />
        {pending ? "Redirecting\u2026" : "Continue with Google"}
      </button>
      {error && <p className="text-sm text-bad-ink" role="alert">{error}</p>}
      <div className="relative">
        <div aria-hidden className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-surface px-2 text-2xs uppercase tracking-[0.08em] text-ink-3">or</span>
        </div>
      </div>
    </div>
  );
}

/** Google's multicolour "G" — used on the standard Sign in with Google button. */
function GoogleG() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden focusable="false">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.57 2.68-3.88 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.85.86-3.04.86-2.34 0-4.32-1.58-5.03-3.71H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.71a5.4 5.4 0 0 1 0-3.42V4.96H.96a9 9 0 0 0 0 8.08l3.01-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}
