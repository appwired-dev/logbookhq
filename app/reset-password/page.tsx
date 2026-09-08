import type { Metadata } from "next";
import { AuthShell } from "@/components/AuthShell";
import HtmlLang from "@/components/HtmlLang";
import ExpiredLinkNotice from "@/app/auth/ExpiredLinkNotice";
import { recoveryStrings } from "@/app/auth/recovery-strings";
import { getLocale } from "@/lib/i18n-server";
import { cookies } from "next/headers";
import { RECOVERY_COOKIE } from "@/app/auth/recovery";
import { createClient } from "@/lib/supabase/server";
import ResetPasswordForm from "./ResetPasswordForm";

/**
 * Step 3 of self-serve recovery: choose the new password.
 *
 * The gate is the session, not a token in the URL. /auth/callback exchanged
 * the emailed code for a recovery session before redirecting here, so
 * `getUser()` returning nothing means the link expired, was already spent, or
 * was opened in a browser that never made the request — all of which render
 * the dead-end screen instead of a form that could not possibly save.
 *
 * Middleware must NOT treat this as an auth route: by design the visitor has
 * a session here, and bouncing signed-in users to /app would make the flow
 * impossible. See lib/supabase/middleware.ts.
 */
export const metadata: Metadata = {
  title: "Set a new password — Pilot Logbook HQ",
  robots: { index: false, follow: false },
};

export default async function ResetPasswordPage() {
  const locale = await getLocale();
  const s = recoveryStrings(locale);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  // A session alone is NOT authorisation to change a password: any signed-in
  // session (stolen cookie, shared laptop) would qualify. The marker cookie is
  // set only by /auth/callback after a successful recovery exchange.
  const recovering = (await cookies()).has(RECOVERY_COOKIE);

  if (!user || !recovering) {
    return (
      <AuthShell title={s("expiredTitle")} subtitle={s("expiredBody")}>
        <HtmlLang locale={locale} />
        <ExpiredLinkNotice locale={locale} />
      </AuthShell>
    );
  }

  return (
    <AuthShell title={s("resetTitle")} subtitle={s("resetSubtitle")}>
      <HtmlLang locale={locale} />
      {user.email && (
        <p className="-mt-4 mb-4 text-xs text-ink-3">{s("resetFor", { email: user.email })}</p>
      )}
      <ResetPasswordForm locale={locale} />
    </AuthShell>
  );
}
