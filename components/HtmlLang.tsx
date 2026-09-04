"use client";

import { useEffect } from "react";
import type { Locale } from "@/lib/i18n";

/**
 * Sets <html lang> for the signed-in app without making the root layout read
 * cookies (which would turn every public marketing page dynamic). Mounted from
 * app/app/layout.tsx where the locale is already known.
 */
export default function HtmlLang({ locale }: { locale: Locale }) {
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  return null;
}
