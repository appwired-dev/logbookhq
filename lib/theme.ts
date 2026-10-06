/**
 * App theme: "dark" (Night-ops, the default — it continues the dark marketing
 * site), "light" (Day) or "system" (follows the device). Stored per device in
 * localStorage and applied to <html data-theme> by THEME_SCRIPT, an inline
 * <head> script that runs before first paint (no flash, and the static pages
 * stay static — nothing reads a cookie on the server).
 */
export type ThemePref = "dark" | "light" | "system";
export const THEME_KEY = "lhq.theme";
export const DEFAULT_THEME: ThemePref = "dark";
export const THEME_EVENT = "lhq-theme";

/** Runs in <head> before paint. Keep it tiny and dependency-free. */
export const THEME_SCRIPT = `(function(){var d=document.documentElement,k=${JSON.stringify(THEME_KEY)},m=window.matchMedia&&matchMedia('(prefers-color-scheme: dark)');function p(){try{var v=localStorage.getItem(k);return v==='light'||v==='dark'||v==='system'?v:${JSON.stringify(DEFAULT_THEME)}}catch(e){return ${JSON.stringify(DEFAULT_THEME)}}}function a(){var v=p(),t=v==='system'?(m&&m.matches?'dark':'light'):v;d.setAttribute('data-theme',t);d.style.colorScheme=t}a();if(m&&m.addEventListener)m.addEventListener('change',function(){if(p()==='system')a()});window.addEventListener('storage',function(e){if(e.key===k)a()})})();`;

export function readThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === "light" || v === "dark" || v === "system" ? v : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

/** Resolve "system" against the device setting. */
export function resolveTheme(pref: ThemePref): "dark" | "light" {
  if (pref !== "system") return pref;
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Persist + apply now; other open tabs follow via the storage event. */
export function applyThemePref(pref: ThemePref) {
  try { localStorage.setItem(THEME_KEY, pref); } catch { /* private mode: still apply for this page */ }
  const t = resolveTheme(pref);
  document.documentElement.setAttribute("data-theme", t);
  document.documentElement.style.colorScheme = t;
  window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: pref }));
}
