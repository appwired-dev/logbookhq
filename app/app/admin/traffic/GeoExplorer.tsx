"use client";

import { useCallback, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { Locale } from "@/lib/i18n";
import { Card, CardHeader, Icon } from "@/components/ui";
import { adminOpsStrings } from "../admin-ops-strings";
import DiagramEmpty from "./DiagramEmpty";
import FocusChip from "./FocusChip";
import ShareList, { type ShareListRow } from "./ShareList";
import TrafficGlobeLazy from "./TrafficGlobeLazy";
import { byVisits, countryText, intFormatter, share, shareFormatter, type DimRow } from "./traffic-model";

type GlobeState = "loading" | "ready" | "unavailable";

/**
 * "Where visitors are": the visitor globe beside the Countries list, sharing
 * one country focus. Clicking a country on the globe or its list row flies the
 * camera there and highlights both; a second click or "Show all" resets.
 *
 * Country rows only become buttons once the globe is on screen and has a
 * polygon for that code (microstates such as SG or MT have none in the 110 m
 * dataset). Without WebGL the globe card disappears and the list stands alone.
 *
 * Privacy boundary: countries are a standalone marginal. This focus never
 * filters pages, sources or devices — the database holds no such pairs.
 */
export default function GeoExplorer({ countries, totalVisits, locale }: {
  /** Every `country` row in the window (traffic_report returns them all), including XX. */
  countries: DimRow[];
  totalVisits: number;
  locale: Locale;
}) {
  const o = useMemo(() => adminOpsStrings(locale), [locale]);
  const nf = useMemo(() => intFormatter(locale), [locale]);
  const pct = useMemo(() => shareFormatter(locale), [locale]);
  const titleId = useId();
  const headingRef = useRef<HTMLDivElement>(null);

  const [globe, setGlobe] = useState<GlobeState>("loading");
  const [codes, setCodes] = useState<ReadonlySet<string> | null>(null);
  const [focus, setFocus] = useState<string | null>(null);

  const sorted = useMemo(() => [...countries].sort(byVisits), [countries]);
  const globeCountries = useMemo(
    () => sorted.filter((c) => c.value !== "XX").map((c) => ({ code: c.value, visits: c.visits, views: c.views })),
    [sorted],
  );
  const hasGeo = globeCountries.some((c) => c.visits > 0 || c.views > 0);
  const known = new Set(sorted.map((c) => c.value));
  const activeFocus = focus && known.has(focus) ? focus : null;

  const onReady = useCallback((c: ReadonlySet<string>) => {
    setCodes(c);
    setGlobe("ready");
  }, []);
  const onUnavailable = useCallback(() => {
    setGlobe("unavailable");
    setFocus(null);
  }, []);
  const chipRef = useRef<HTMLDivElement>(null);
  const clear = useCallback(() => {
    // If focus is on the chip's button, it is about to disappear — keep focus in the section.
    const inChip = !!chipRef.current?.contains(document.activeElement);
    setFocus(null);
    if (inChip) headingRef.current?.focus();
  }, []);
  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === "Escape" && activeFocus) {
      e.preventDefault();
      clear();
    }
  };

  const rows: ShareListRow[] = sorted.map((c) => {
    const selectable = globe === "ready" && !!codes?.has(c.value) && (c.visits > 0 || c.views > 0);
    return {
      key: c.value,
      label: countryText(c.value, locale, o),
      visits: c.visits,
      share: share(c.visits, totalVisits),
      pressed: activeFocus === c.value,
      onSelect: selectable ? () => setFocus((f) => (f === c.value ? null : c.value)) : undefined,
    };
  });

  const showGlobe = globe !== "unavailable";
  const focusName = activeFocus ? countryText(activeFocus, locale, o) : null;

  return (
    <section className="grid gap-4 lg:grid-cols-5" onKeyDown={onKeyDown} aria-labelledby={showGlobe ? titleId : undefined}>
      {showGlobe && (
        <Card padding="md" className="min-w-0 overflow-hidden lg:col-span-3">
          <div ref={headingRef} tabIndex={-1} className="outline-none">
            <CardHeader
              title={<span id={titleId}>{o("globeTitle")}</span>}
              meta={o("globeSubtitle")}
              actions={
                <div ref={chipRef} className="min-w-0">
                  <FocusChip label={focusName ? o("focusLabel", { name: focusName }) : null} clearText={o("clearFocus")} onClear={clear} />
                </div>
              }
            />
          </div>
          {hasGeo ? (
            <div className="relative h-[280px] sm:h-[360px]">
              <TrafficGlobeLazy
                countries={globeCountries}
                focus={activeFocus}
                onFocusChange={setFocus}
                onReady={onReady}
                onUnavailable={onUnavailable}
                locale={locale}
              />
            </div>
          ) : (
            <DiagramEmpty icon={Icon.Globe2} text={o("trafficEmpty")} className="h-56" />
          )}
        </Card>
      )}
      <ShareList
        title={o("topCountries")}
        rows={rows}
        labelHeader={o("colCountry")}
        visitsHeader={o("statVisits")}
        shareHeader={o("colShare")}
        emptyText={o("trafficEmpty")}
        fmtInt={nf}
        fmtShare={pct}
        scrollClassName="max-h-[400px] overflow-y-auto"
        className={showGlobe ? "lg:col-span-2" : "lg:col-span-5"}
      />
    </section>
  );
}
