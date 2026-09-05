"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * SSR-safe media-query hook built on useSyncExternalStore.
 *
 * `serverDefault` is what the server render *and* the hydration pass assume.
 * Once hydrated, React swaps to the real `matchMedia` snapshot without a
 * hydration-mismatch warning because the change flows through the store
 * (React re-renders with the client snapshot instead of diffing markup).
 *
 * Use it to render ONE tree per breakpoint instead of rendering both and
 * hiding one with CSS.
 */
export function useMediaQuery(query: string, serverDefault = false): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    [query],
  );
  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);
  const getServerSnapshot = useCallback(() => serverDefault, [serverDefault]);
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Tailwind `md` breakpoint (768px). */
export const MD_QUERY = "(min-width: 768px)";

/**
 * True at `md` and up. The server assumes desktop so SSR emits the full table
 * (the larger, more useful tree for crawlers and for most sessions); phones
 * correct to the card list right after hydration.
 */
export function useIsDesktop(): boolean {
  return useMediaQuery(MD_QUERY, true);
}
