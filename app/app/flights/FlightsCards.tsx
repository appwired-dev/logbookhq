"use client";

import Link from "next/link";
import { memo, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { Pill, categoryPill, rolePill } from "@/components/ui";
import { creditedHours } from "@/lib/derive";
import type { FlightDerived } from "@/lib/types";
import type { FlightsStrings } from "./flights-strings";

/** Typical card height (3 lines + padding); real heights are measured. */
const EST_H = 96;
const GAP = 8;

const n = (v: unknown): number => {
  const x = Number(v ?? 0);
  return Number.isFinite(x) ? x : 0;
};

export type FlightsCardsProps = {
  rows: readonly FlightDerived[];
  s: FlightsStrings;
  augHalfCredit: boolean;
  highlightId: number | null;
};

/**
 * Phone list. Virtualised against the window (the page scrolls naturally;
 * the layout's bottom padding keeps the last card clear of the tab bar).
 */
export function FlightsCards({ rows, s, augHalfCredit, highlightId }: FlightsCardsProps) {
  const listRef = useRef<HTMLDivElement>(null);

  // Document offset of the list start. Re-measured whenever the page's
  // height changes (toolbar wrapping, filters row appearing).
  const [offset, setOffset] = useState(0);
  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const update = () => setOffset(Math.round(el.getBoundingClientRect().top + window.scrollY));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(document.body);
    return () => ro.disconnect();
  }, []);

  const virtualizer = useWindowVirtualizer({
    count: rows.length,
    estimateSize: () => EST_H,
    overscan: 8,
    gap: GAP,
    scrollMargin: offset,
    getItemKey: (i) => rows[i].id,
  });

  // One-shot: bring the just-saved flight into view.
  const scrolledToSaved = useRef(false);
  useEffect(() => {
    if (scrolledToSaved.current || highlightId == null) return;
    const idx = rows.findIndex((r) => r.id === highlightId);
    if (idx < 0) return;
    scrolledToSaved.current = true;
    virtualizer.scrollToIndex(idx, { align: "center" });
  }, [highlightId, rows, virtualizer]);

  const items = virtualizer.getVirtualItems();
  const margin = virtualizer.options.scrollMargin;

  return (
    <div ref={listRef} className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
      {items.map((item) => {
        const f = rows[item.index];
        return (
          <div
            key={f.id}
            data-index={item.index}
            ref={virtualizer.measureElement}
            className="absolute left-0 top-0 w-full"
            style={{ transform: `translateY(${item.start - margin}px)` }}
          >
            <FlightCard f={f} s={s} augHalfCredit={augHalfCredit} highlighted={f.id === highlightId} />
          </div>
        );
      })}
    </div>
  );
}

const FlightCard = memo(function FlightCard({ f, s, augHalfCredit, highlighted }: {
  f: FlightDerived;
  s: FlightsStrings;
  augHalfCredit: boolean;
  highlighted: boolean;
}) {
  const credited = creditedHours(f, augHalfCredit);
  const inst = n(f.actual_inst) + n(f.hood_inst) + n(f.sim_inst);
  const app = n(f.ifr_approaches);

  const meta: string[] = [];
  if (f.registration) meta.push(f.registration);
  if (n(f.day_time) > 0) meta.push(`${s.colDay} ${n(f.day_time).toFixed(1)}`);
  if (n(f.night_time) > 0) meta.push(`${s.colNight} ${n(f.night_time).toFixed(1)}`);
  if (inst > 0) meta.push(`${s.groupInstrument} ${inst.toFixed(1)}`);
  if (app > 0) meta.push(`${app} ${s.groupApproaches}`);
  if (f.pic && f.role !== "PIC") meta.push(`${s.colPic} ${f.pic}`);

  return (
    <Link
      href={`/app/flights/${f.id}`}
      prefetch={false}
      className={`card block p-3 min-h-[44px] cursor-pointer
        transition-[background-color,border-color] duration-fast motion-reduce:transition-none
        hover:border-border-strong active:bg-surface-2
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas
        ${highlighted ? "row-saved" : ""}`}
    >
      <div className="flex items-baseline gap-2 min-w-0">
        <span className="mono text-xs text-ink-2 shrink-0">{f.date}</span>
        {f.route && <span className="mono text-xs text-ink-1 truncate min-w-0">{f.route}</span>}
        <span className="ml-auto text-sm font-medium text-ink-1 truncate max-w-[45%]">{f.make_model}</span>
      </div>
      <div className="mt-1.5 flex items-center gap-1.5 min-w-0">
        <Pill variant={categoryPill(f.category)}>{f.category}</Pill>
        <Pill variant={rolePill(f.role)}>{s.roleShort[f.role] ?? f.role}</Pill>
        {f.is_xcountry && <Pill variant="xc">{s.colXc}</Pill>}
        <span className="ml-auto num text-base font-semibold text-ink-1 whitespace-nowrap">
          {credited.toFixed(1)} <span className="text-xs font-normal text-ink-3">{s.hoursUnit}</span>
        </span>
      </div>
      {meta.length > 0 && <div className="mt-1 text-2xs text-ink-3 num truncate">{meta.join(" · ")}</div>}
    </Link>
  );
});
