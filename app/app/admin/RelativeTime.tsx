"use client";

import { useEffect, useState } from "react";
import type { Locale } from "@/lib/i18n";

/**
 * Relative "last active" time, admin-only. Rendered client-side after mount to
 * avoid a hydration mismatch (Date.now / timezone differ server<->client);
 * before mount it shows the deterministic ISO date so SSR and first paint agree.
 */
export function RelativeTime({ iso, locale }: { iso: string | null; locale: Locale }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!iso) return <span className="text-ink-3">—</span>;
  if (!mounted) return <span className="mono text-xs text-ink-2">{iso.slice(0, 10)}</span>;
  const then = new Date(iso);
  const t = then.getTime();
  if (Number.isNaN(t)) return <span className="text-ink-3">—</span>;
  const sec = (t - Date.now()) / 1000;
  const a = Math.abs(sec);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const rel =
    a < 60 ? rtf.format(Math.round(sec), "second")
    : a < 3600 ? rtf.format(Math.round(sec / 60), "minute")
    : a < 86400 ? rtf.format(Math.round(sec / 3600), "hour")
    : a < 2592000 ? rtf.format(Math.round(sec / 86400), "day")
    : a < 31536000 ? rtf.format(Math.round(sec / 2592000), "month")
    : rtf.format(Math.round(sec / 31536000), "year");
  return <span className="text-xs text-ink-2 whitespace-nowrap" title={then.toLocaleString(locale)}>{rel}</span>;
}
