import Link from "next/link";
import { buttonClass } from "@/components/ui";
import { recoveryStrings } from "@/app/auth/recovery-strings";
import type { Locale } from "@/lib/i18n";

/**
 * The dead end of the recovery flow, shared by /auth/auth-code-error (the code
 * exchange failed) and /reset-password when it is opened without a recovery
 * session. Both look identical to the user — the link no longer works — so
 * they get one screen with one way forward: request a fresh link.
 *
 * The explanation itself is the AuthShell heading + subtitle on each page
 * (`expiredTitle` / `expiredBody`), which is what a screen reader announces on
 * arrival; this component is the actions underneath. Server component, no
 * state, so nothing needs focus management.
 */
export default function ExpiredLinkNotice({ locale }: { locale: Locale }) {
  const s = recoveryStrings(locale);
  return (
    <div className="space-y-4">
      <Link
        href="/forgot-password"
        className={buttonClass("primary", "md", "w-full h-11 sm:h-10")}
      >
        {s("requestNewLink")}
      </Link>
      <p className="text-sm text-ink-3 text-center">
        <Link
          href="/login"
          className="text-brand hover:underline rounded-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        >
          {s("backToSignIn")}
        </Link>
      </p>
    </div>
  );
}
