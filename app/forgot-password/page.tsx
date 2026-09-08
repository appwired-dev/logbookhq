import type { Metadata } from "next";
import { AuthShell } from "@/components/AuthShell";
import HtmlLang from "@/components/HtmlLang";
import { recoveryStrings } from "@/app/auth/recovery-strings";
import { getLocale } from "@/lib/i18n-server";
import ForgotPasswordForm from "./ForgotPasswordForm";

/**
 * Step 1 of self-serve recovery: ask for the account's email address.
 *
 * Server component so the copy is localised from the `logbookhq.locale`
 * cookie on the first paint (the form itself is a client component for its
 * pending / outcome states). Middleware treats this like /login and /signup —
 * a signed-in user is bounced to /app.
 */
export const metadata: Metadata = {
  title: "Reset your password — Pilot Logbook HQ",
  robots: { index: false, follow: false },
};

export default async function ForgotPasswordPage() {
  const locale = await getLocale();
  const s = recoveryStrings(locale);
  return (
    <AuthShell title={s("forgotTitle")} subtitle={s("forgotSubtitle")}>
      <HtmlLang locale={locale} />
      <ForgotPasswordForm locale={locale} />
    </AuthShell>
  );
}
