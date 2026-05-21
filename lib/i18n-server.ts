import { cookies } from "next/headers";
import {
  DEFAULT_LOCALE, LOCALE_COOKIE, LOCALES,
  translate, type Locale, type TranslationKey,
} from "./i18n";

/**
 * Server-only i18n helpers. Split from `lib/i18n.ts` because it imports
 * `next/headers`, which is not allowed in Client Components.
 */

/**
 * Server-side: read the user's locale preference from cookies and return a
 * bound translator function. Use in Server Components, Server Actions,
 * Route Handlers.
 */
export async function getT(): Promise<(key: TranslationKey, vars?: Record<string, string | number>) => string> {
  const locale = await getLocale();
  return (key, vars) => translate(key, locale, vars);
}

/** Server-side: read the active locale from the cookie. */
export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const cookieLocale = store.get(LOCALE_COOKIE)?.value;
  return (LOCALES.includes(cookieLocale as Locale) ? cookieLocale : DEFAULT_LOCALE) as Locale;
}
