"use server";

import { cookies } from "next/headers";
import { LOCALE_COOKIE, LOCALES, type Locale } from "@/lib/i18n";

/**
 * Persist the user's locale preference. Stored in a non-HttpOnly cookie so
 * client + server reads stay in sync across renders without an extra round
 * trip. One year expiry — locale rarely changes.
 */
export async function setLocaleAction(locale: Locale) {
  if (!LOCALES.includes(locale)) return { error: "Invalid locale" };
  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  return { ok: true };
}
