import type { Metadata } from "next";
import { AuthShell } from "@/components/AuthShell";
import HtmlLang from "@/components/HtmlLang";
import ExpiredLinkNotice from "@/app/auth/ExpiredLinkNotice";
import { recoveryStrings } from "@/app/auth/recovery-strings";
import { getLocale } from "@/lib/i18n-server";

/**
 * Where /auth/callback sends anyone whose emailed link could not be turned
 * into a session — expired, already used, opened in a different browser from
 * the one that asked for it (PKCE keeps the code verifier in a cookie), or
 * rejected by GoTrue outright. The user never sees which: one screen, one
 * button that sends a fresh link.
 *
 * Deliberately its own route rather than an `?error=` state folded into
 * /login: the recovery dead end needs its own copy and its own primary action
 * (/forgot-password), and keeping it off the login page leaves that page's
 * client state alone.
 */
export const metadata: Metadata = {
  title: "Link expired — Pilot Logbook HQ",
  robots: { index: false, follow: false },
};

export default async function AuthCodeErrorPage() {
  const locale = await getLocale();
  const s = recoveryStrings(locale);
  return (
    <AuthShell title={s("expiredTitle")} subtitle={s("expiredBody")}>
      <HtmlLang locale={locale} />
      <ExpiredLinkNotice locale={locale} />
    </AuthShell>
  );
}
