"use client";

import { useCallback, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { Locale } from "@/lib/i18n";
import { Card, CardHeader, Icon } from "@/components/ui";
import { adminOpsStrings } from "../admin-ops-strings";
import DiagramEmpty from "./DiagramEmpty";
import FocusChip from "./FocusChip";
import ShareList, { type ShareListRow } from "./ShareList";
import TrafficFlowLazy from "./TrafficFlowLazy";
import {
  buildFlowModel, byViews, byVisits, intFormatter, pageLabel, pagesFromSource, share, shareFormatter, sourceText, sourcesToPage, type DimRow, type FlowFocus, type FlowRow, type FlowSide, OTHER_SOURCE, countPhrase,
} from "./traffic-model";

/**
 * "How visitors arrive": the arrivals Sankey plus the Sources and Pages lists,
 * sharing ONE focus. Selecting a source (node or row) narrows Pages to the
 * landings from that source; selecting a page narrows Sources to the sources
 * that landed on it. Both come from the `flow` rows (arrivals only, top 60).
 *
 * Privacy boundary: source × landing page is the only pair the database keeps,
 * so this is the only cross-filter on the Traffic tab. Countries and devices
 * are separate marginals (GeoExplorer, TrafficPanel) and never take part.
 *
 * Everything here runs on the payload the server page already fetched.
 */
export default function FlowExplorer({ flows, sources, pages, totalVisits, totalViews, locale }: {
  flows: FlowRow[];
  /** `source` dimension rows (arrivals by source, top 25). */
  sources: DimRow[];
  /** `page` dimension rows (views and arrivals by page, top 25). */
  pages: DimRow[];
  totalVisits: number;
  totalViews: number;
  locale: Locale;
}) {
  const o = useMemo(() => adminOpsStrings(locale), [locale]);
  const nf = useMemo(() => intFormatter(locale), [locale]);
  const pct = useMemo(() => shareFormatter(locale), [locale]);
  const headingRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  const model = useMemo(
    () => buildFlowModel(flows, { source: (v) => sourceText(v, o), page: (v) => pageLabel(v, o) }),
    [flows, o],
  );
  const sourceNode = useMemo(() => new Map(model.sources.map((n) => [n.key, n] as const)), [model]);
  const pageNode = useMemo(() => new Map(model.pages.map((n) => [n.key, n] as const)), [model]);

  const [rawFocus, setFocus] = useState<FlowFocus>(null);
  // A range change re-renders with new rows but keeps this state: drop a focus that no longer exists.
  const focus: FlowFocus = rawFocus && (rawFocus.side === "source" ? sourceNode : pageNode).has(rawFocus.key) ? rawFocus : null;
  const focusNode = focus ? (focus.side === "source" ? sourceNode : pageNode).get(focus.key) ?? null : null;
  // A single folded source picked from the list is named itself, not "Other".
  const focusName = focus?.raw ? sourceText(focus.raw, o) : focusNode?.label ?? null;

  const toggle = useCallback((side: FlowSide, key: string, raw?: string) => {
    setFocus((f) => (f && f.side === side && f.key === key && (f.raw ?? null) === (raw ?? null) ? null : { side, key, raw }));
  }, []);
  const chipRef = useRef<HTMLDivElement>(null);
  const clear = useCallback(() => {
    // If focus is on the chip's button, it is about to disappear — keep focus in the section.
    const inChip = !!chipRef.current?.contains(document.activeElement);
    setFocus(null);
    if (inChip) headingRef.current?.focus();
  }, []);
  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === "Escape" && focus) {
      e.preventDefault();
      clear();
    }
  };

  // ---------- Sources list ----------
  const sourceRow = (value: string, visits: number, whole: number): ShareListRow => {
    const key = model.sourceKey.get(value);
    const node = key ? sourceNode.get(key) : undefined;
    return {
      key: value,
      label: sourceText(value, o),
      visits,
      share: share(visits, whole),
      swatch: node?.color,
      pressed: !!focus && focus.side === "source" && (focus.raw ? focus.raw === value : key === focus.key),
      // A folded source keeps its own identity: the Sankey highlights "Other", the Pages list narrows to it.
      onSelect: key ? () => toggle("source", key, key === OTHER_SOURCE && value !== OTHER_SOURCE ? value : undefined) : undefined,
    };
  };
  let sourceRows: ShareListRow[];
  let sourcesMeta: string | undefined;
  if (focus?.side === "page" && focusNode) {
    const rows = sourcesToPage(flows, focus.key);
    const whole = rows.reduce((t, r) => t + r.visits, 0);
    sourceRows = rows.map((r) => sourceRow(r.value, r.visits, whole));
    sourcesMeta = o("focusLabel", { name: focusName ?? focusNode.label });
  } else {
    sourceRows = [...sources].sort(byVisits).map((r) => sourceRow(r.value, r.visits, totalVisits));
  }

  // ---------- Pages list ----------
  const pageRow = (r: DimRow, whole: number, withViews: boolean): ShareListRow => {
    const node = pageNode.get(r.value);
    return {
      key: r.value,
      label: pageLabel(r.value, o),
      title: r.value,
      visits: r.visits,
      views: withViews ? r.views : undefined,
      share: share(withViews ? r.views : r.visits, whole),
      pressed: !!focus && focus.side === "page" && focus.key === r.value,
      onSelect: node ? () => toggle("page", r.value) : undefined,
    };
  };
  let pageRows: ShareListRow[];
  let pagesMeta: string | undefined;
  const pagesFiltered = focus?.side === "source" && !!focusNode;
  if (focus?.side === "source" && focusNode) {
    const rows = pagesFromSource(flows, model, focus.key, focus.raw);
    const whole = rows.reduce((t, r) => t + r.visits, 0);
    pageRows = rows.map((r) => pageRow(r, whole, false));
    pagesMeta = o("focusLabel", { name: focusName ?? focusNode.label });
  } else {
    pageRows = [...pages].sort(byViews).map((r) => pageRow(r, totalViews, true));
  }

  const tallest = Math.max(model.sources.length, model.pages.length);
  const sankeyHeight = Math.min(640, Math.max(220, tallest * 34 + 16));
  // The chip lives in a row that is always reserved (it shows the hint when nothing is focused),
  // so selecting a node never shifts the diagram under the pointer or a second tap.
  const chipRow = (
    <div ref={chipRef} className="mt-1 mb-2 flex min-h-11 min-w-0 items-center gap-2">
      {/* Always mounted: its polite live region must exist before a focus is announced. */}
      <FocusChip label={focusName ? o("focusLabel", { name: focusName }) : null} clearText={o("clearFocus")} onClear={clear} />
      {!focusName && <p className="text-xs text-ink-3">{o("flowHint")}</p>}
    </div>
  );

  return (
    <section className="space-y-4" onKeyDown={onKeyDown} aria-labelledby={titleId}>
      <Card padding="md" className="min-w-0 overflow-hidden">
        <div ref={headingRef} tabIndex={-1} className="outline-none">
          <CardHeader
            title={<span id={titleId}>{o("flowTitle")}</span>}
            meta={o("flowSubtitle")}
          />
        </div>
        {model.links.length > 0 && chipRow}
        {model.links.length === 0 ? (
          <DiagramEmpty icon={Icon.Waypoints} text={o("flowEmpty")} className="h-56" />
        ) : (
          <div
            role="group"
            aria-label={o("flowAria", {
              sources: countPhrase(o, locale, model.sources.length, "Sources", nf),
              pages: countPhrase(o, locale, model.pages.length, "Pages", nf),
            })}
            style={{ minHeight: sankeyHeight }}
          >
            <TrafficFlowLazy model={model} focus={focus} onToggle={toggle} height={sankeyHeight} locale={locale} />
          </div>
        )}
        {flows.length > 0 && (
          <div className="sr-only">
            <table>
              <caption>{o("flowTitle")}</caption>
              <thead>
                <tr>
                  <th scope="col">{o("colSource")}</th>
                  <th scope="col">{o("colPage")}</th>
                  <th scope="col">{o("statVisits")}</th>
                </tr>
              </thead>
              <tbody>
                {flows.map((f) => (
                  <tr key={`${f.source}\u0000${f.page}`}>
                    <td>{sourceText(f.source, o)}</td>
                    <td>{pageLabel(f.page, o)}</td>
                    <td>{nf(f.visits)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <ShareList
          title={o("topSources")}
          meta={sourcesMeta}
          rows={sourceRows}
          labelHeader={o("colSource")}
          visitsHeader={o("statVisits")}
          shareHeader={o("colShare")}
          emptyText={o("trafficEmpty")}
          fmtInt={nf}
          fmtShare={pct}
        />
        <ShareList
          title={o("topPages")}
          meta={pagesMeta}
          rows={pageRows}
          labelHeader={o("colPage")}
          visitsHeader={o("statVisits")}
          viewsHeader={pagesFiltered ? undefined : o("statViews")}
          shareHeader={o("colShare")}
          emptyText={o("trafficEmpty")}
          fmtInt={nf}
          fmtShare={pct}
          barColor="rgb(var(--brand-deep))"
        />
      </div>
    </section>
  );
}
