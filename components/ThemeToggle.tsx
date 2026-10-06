"use client";

import { useEffect, useState } from "react";
import { Moon, Sun, Monitor } from "lucide-react";
import { THEME_EVENT, applyThemePref, readThemePref, resolveTheme, type ThemePref } from "@/lib/theme";

/** The saved preference, kept in sync with other toggles and tabs. */
function useThemePref(): [ThemePref | null, (p: ThemePref) => void] {
  // null until mounted: the server can't know the device's saved choice.
  const [pref, setPref] = useState<ThemePref | null>(null);
  useEffect(() => {
    setPref(readThemePref());
    const sync = () => setPref(readThemePref());
    window.addEventListener(THEME_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener(THEME_EVENT, sync); window.removeEventListener("storage", sync); };
  }, []);
  return [pref, (p) => { applyThemePref(p); setPref(p); }];
}

/** Header button: one tap flips between Night-ops and Day. Hidden on phones (no room in the bar); Settings → Appearance has it there. */
export function ThemeHeaderButton({ toDark, toLight }: { toDark: string; toLight: string }) {
  const [pref, setPref] = useThemePref();
  const dark = pref ? resolveTheme(pref) === "dark" : true;
  const label = dark ? toLight : toDark;
  return (
    <button
      type="button"
      onClick={() => setPref(dark ? "light" : "dark")}
      aria-label={label}
      title={label}
      className="hidden sm:inline-grid h-9 w-9 place-items-center rounded-control border border-border bg-surface-2/50 text-ink-2 hover:text-ink-1 hover:bg-surface-2 cursor-pointer transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
    >
      {/* Both icons render; CSS picks one by theme so there's no hydration flip. */}
      <Sun size={16} strokeWidth={1.9} aria-hidden className="hidden dark:block" />
      <Moon size={16} strokeWidth={1.9} aria-hidden className="block dark:hidden" />
    </button>
  );
}

/** Settings → Appearance: Night-ops / Day / Match device. */
export function ThemeChoice({ legend, dark, light, system }: { legend: string; dark: string; light: string; system: string }) {
  const [pref, setPref] = useThemePref();
  const options: { value: ThemePref; label: string; Icon: typeof Moon }[] = [
    { value: "dark", label: dark, Icon: Moon },
    { value: "light", label: light, Icon: Sun },
    { value: "system", label: system, Icon: Monitor },
  ];
  return (
    <div role="radiogroup" aria-label={legend} className="inline-flex flex-wrap gap-1 rounded-control border border-border bg-surface-2/50 p-1">
      {options.map(({ value, label, Icon }) => {
        const on = pref === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => setPref(value)}
            className={`inline-flex min-h-10 items-center gap-2 rounded-[6px] px-3 text-sm font-medium cursor-pointer transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 ${
              on ? "bg-surface text-ink-1 shadow-sm ring-1 ring-border-strong" : "text-ink-2 hover:text-ink-1"
            }`}
          >
            <Icon size={15} strokeWidth={1.9} aria-hidden />
            {label}
          </button>
        );
      })}
    </div>
  );
}
