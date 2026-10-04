"use client";

import { useEffect, useId, useState } from "react";
import { OPT_OUT_KEY } from "@/lib/site-stats-core";

/**
 * "Don't count my visits from this browser" — one switch shared by the admin
 * Traffic tab (localised labels) and privacy policy §8 (English).
 *
 * The flag lives only in this browser's localStorage; SiteStats reads it and
 * then sends nothing (neither our beacon nor Vercel Analytics). A browser that
 * sends Global Privacy Control or Do Not Track is never counted either, so the
 * switch shows that state (checked, locked) instead of claiming "counted".
 *
 * The control is disabled until mounted (no SSR guess about storage) and stays
 * disabled if storage throws. The status line keeps its height before mount so
 * the page doesn't jump, and only a change the visitor makes is announced.
 */
type State = "loading" | "unavailable" | "signal" | "on" | "off";

export default function StatsOptOut({ label, onText, offText, signalText, className = "" }: {
  label: string;
  onText: string;
  offText: string;
  /** Shown when the browser sends GPC or DNT (always excluded, nothing to toggle). */
  signalText: string;
  className?: string;
}) {
  const id = useId();
  const [state, setState] = useState<State>("loading");
  const [announce, setAnnounce] = useState("");

  useEffect(() => {
    const n = navigator as Navigator & { globalPrivacyControl?: boolean };
    if (n.globalPrivacyControl === true || n.doNotTrack === "1") {
      setState("signal");
      return;
    }
    try {
      setState(localStorage.getItem(OPT_OUT_KEY) === "1" ? "on" : "off");
    } catch {
      setState("unavailable");
    }
  }, []);

  function toggle(on: boolean) {
    try {
      if (on) localStorage.setItem(OPT_OUT_KEY, "1");
      else localStorage.removeItem(OPT_OUT_KEY);
      setState(on ? "on" : "off");
      setAnnounce(on ? onText : offText);
    } catch {
      setState("unavailable");
    }
  }

  const disabled = state === "loading" || state === "unavailable" || state === "signal";
  const status = state === "signal" ? signalText : state === "on" ? onText : state === "off" ? offText : "";
  return (
    <div className={className}>
      <label htmlFor={id} className={`inline-flex items-center gap-2 min-h-11 text-sm ${disabled ? "opacity-60" : "cursor-pointer"}`}>
        <input
          id={id}
          type="checkbox"
          className="accent-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
          checked={state === "on" || state === "signal"}
          disabled={disabled}
          aria-describedby={`${id}-status`}
          onChange={(e) => toggle(e.target.checked)}
        />
        <span>{label}</span>
      </label>
      <p id={`${id}-status`} className="min-h-4 text-2xs text-ink-3">{status}</p>
      <span className="sr-only" aria-live="polite">{announce}</span>
    </div>
  );
}
