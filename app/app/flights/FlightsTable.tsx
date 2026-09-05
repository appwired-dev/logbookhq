"use client";

import Link from "next/link";
import {
  memo, useEffect, useLayoutEffect, useMemo, useRef, useState,
  type KeyboardEvent, type MouseEvent, type ReactNode, type RefObject,
} from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
// `Pencil` is not yet re-exported from components/ui/icons.ts (locked while
// FlightForm is being reworked). Fold it into the icon map in a later pass.
import { Pencil } from "@/components/ui/icons";
import { Icon, Pill, categoryPill, rolePill } from "@/components/ui";
import type { FlightDerived } from "@/lib/types";
import { fmt, type FlightsStrings } from "./flights-strings";
import type { Agg, SortDir, SortKey } from "./use-flight-filters";

/* -------------------------------------------------------------------------- */
/* Geometry — fixed so the virtualizer and the sticky offsets agree            */
/* -------------------------------------------------------------------------- */

/** Group header row. */
const GROUP_ROW_H = 28;
/** Column header row. */
const HEADER_ROW_H = 36;
const HEAD_H = GROUP_ROW_H + HEADER_ROW_H;
/** Body row — matches `estimateSize`. */
const ROW_H = 40;
/** Footer row. */
const FOOT_H = 40;

// Row heights are set inline in px (not rem utilities) so the virtualizer's
// arithmetic and the sticky offsets can never drift from the rendered layout
// (e.g. under a non-default root font size). Heights live on the <tr>, never
// on cells: a cell's own border would otherwise push the row past ROW_H.
const GROUP_ROW_STYLE = { height: GROUP_ROW_H } as const;
const HEADER_ROW_STYLE = { height: HEADER_ROW_H } as const;
/** Column header cells stick just below the group row. */
const HEADER_STICKY_STYLE = { top: GROUP_ROW_H } as const;
/** Sort button fills the header cell's content box (row height minus its 1px bottom border). */
const HEADER_BUTTON_STYLE = { minHeight: HEADER_ROW_H - 1 } as const;
const ROW_STYLE = { height: ROW_H } as const;
const FOOT_ROW_STYLE = { height: FOOT_H } as const;
/** Space under the card: main's `md:pb-6`. */
const BOTTOM_GAP = 24;
const MIN_H = 240;

const hrefFor = (id: number) => `/app/flights/${id}`;

/* -------------------------------------------------------------------------- */
/* Column model                                                                */
/* -------------------------------------------------------------------------- */

type Group = "flight" | "crew" | "time" | "inst" | "app" | "tol" | "notes" | "actions";

type Col = {
  id: string;
  group: Group;
  label: string;
  /** Column width in px (table-layout: fixed keeps widths stable while rows virtualise). */
  width: number;
  sortKey?: SortKey;
  align?: "right" | "center";
  /** Header label visually hidden (still read by AT). */
  srLabel?: boolean;
  cell: (f: FlightDerived) => ReactNode;
  /** Full text for the `title` tooltip on truncated cells. */
  text?: (f: FlightDerived) => string | null | undefined;
  foot?: (a: Agg) => ReactNode;
};

const n = (v: unknown): number => {
  const x = Number(v ?? 0);
  return Number.isFinite(x) ? x : 0;
};

function Dash() {
  return <span aria-hidden className="text-ink-3">—</span>;
}
const hours = (v: unknown): ReactNode => {
  const x = n(v);
  return x > 0 ? <span className="num">{x.toFixed(1)}</span> : <Dash />;
};
const count = (v: unknown): ReactNode => {
  const x = n(v);
  return x > 0 ? <span className="num">{x}</span> : <Dash />;
};
const footHours = (v: number): ReactNode => (v > 0 ? v.toFixed(1) : <Dash />);
const footCount = (v: number): ReactNode => (v > 0 ? v : <Dash />);

function buildColumns(s: FlightsStrings): Col[] {
  const text = (cls: string) => (v: string | null) =>
    v ? <span className={cls}>{v}</span> : <Dash />;
  const crew = text("text-xs text-ink-2");
  return [
    // Flight
    {
      id: "date", group: "flight", label: s.colDate, width: 104, sortKey: "date",
      cell: (f) => (
        <Link
          href={hrefFor(f.id)}
          prefetch={false}
          tabIndex={-1}
          className="mono text-xs text-ink-1 rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
        >
          {f.date}
        </Link>
      ),
    },
    {
      id: "make_model", group: "flight", label: s.colAircraft, width: 152, sortKey: "make_model",
      cell: (f) => <span className="font-medium text-ink-1">{f.make_model}</span>, text: (f) => f.make_model,
    },
    {
      id: "registration", group: "flight", label: s.colReg, width: 92, sortKey: "registration",
      cell: (f) => (f.registration ? <span className="mono text-xs text-ink-2">{f.registration}</span> : <Dash />),
      text: (f) => f.registration,
    },
    {
      id: "route", group: "flight", label: s.colRoute, width: 152, sortKey: "route",
      cell: (f) => (f.route ? <span className="mono text-xs text-ink-1">{f.route}</span> : <Dash />),
      text: (f) => f.route,
    },
    {
      id: "category", group: "flight", label: s.colCat, width: 64, sortKey: "category",
      cell: (f) => <Pill variant={categoryPill(f.category)}>{f.category}</Pill>,
    },
    // Crew
    {
      id: "role", group: "crew", label: s.role, width: 80, sortKey: "role",
      cell: (f) => <Pill variant={rolePill(f.role)}>{s.roleShort[f.role] ?? f.role}</Pill>,
    },
    { id: "pic", group: "crew", label: s.colPic, width: 128, sortKey: "pic", cell: (f) => text("text-xs text-ink-1")(f.pic), text: (f) => f.pic },
    { id: "copilot", group: "crew", label: s.colFo, width: 128, sortKey: "copilot", cell: (f) => crew(f.copilot), text: (f) => f.copilot },
    { id: "third_pilot", group: "crew", label: s.colSo, width: 116, sortKey: "third_pilot", cell: (f) => crew(f.third_pilot), text: (f) => f.third_pilot },
    { id: "check_pilot", group: "crew", label: s.colCheck, width: 116, sortKey: "check_pilot", cell: (f) => crew(f.check_pilot), text: (f) => f.check_pilot },
    // Time
    { id: "day_time", group: "time", label: s.colDay, width: 64, sortKey: "day_time", align: "right", cell: (f) => hours(f.day_time), foot: (a) => footHours(a.day) },
    { id: "night_time", group: "time", label: s.colNight, width: 64, sortKey: "night_time", align: "right", cell: (f) => hours(f.night_time), foot: (a) => footHours(a.night) },
    {
      id: "total_time", group: "time", label: s.colTotal, width: 72, sortKey: "total_time", align: "right",
      cell: (f) => <span className="num font-semibold text-ink-1">{n(f.total_time).toFixed(1)}</span>,
      foot: (a) => a.credited.toFixed(1),
    },
    {
      id: "is_xcountry", group: "time", label: s.colXc, width: 48, sortKey: "is_xcountry", align: "center",
      cell: (f) => f.is_xcountry
        ? <><Icon.Check size={14} strokeWidth={2.5} aria-hidden className="inline-block text-good-ink" /><span className="sr-only">{s.xcYes}</span></>
        : <Dash />,
      foot: (a) => footCount(a.xc),
    },
    { id: "cfi_time", group: "time", label: s.colCfi, width: 60, sortKey: "cfi_time", align: "right", cell: (f) => hours(f.cfi_time), foot: (a) => footHours(a.cfi) },
    // Instrument
    { id: "actual_inst", group: "inst", label: s.colActual, width: 72, sortKey: "actual_inst", align: "right", cell: (f) => hours(f.actual_inst), foot: (a) => footHours(a.actual) },
    { id: "hood_inst", group: "inst", label: s.colHood, width: 76, sortKey: "hood_inst", align: "right", cell: (f) => hours(f.hood_inst), foot: (a) => footHours(a.hood) },
    { id: "sim_inst", group: "inst", label: s.colSim, width: 60, sortKey: "sim_inst", align: "right", cell: (f) => hours(f.sim_inst), foot: (a) => footHours(a.sim) },
    // Approaches
    { id: "ifr_approaches", group: "app", label: s.colIfr, width: 60, sortKey: "ifr_approaches", align: "right", cell: (f) => count(f.ifr_approaches), foot: (a) => footCount(a.ifr) },
    { id: "precision_approaches", group: "app", label: s.colPrec, width: 64, sortKey: "precision_approaches", align: "right", cell: (f) => count(f.precision_approaches), foot: (a) => footCount(a.prec) },
    { id: "non_precision_approaches", group: "app", label: s.colNonPrec, width: 84, sortKey: "non_precision_approaches", align: "right", cell: (f) => count(f.non_precision_approaches), foot: (a) => footCount(a.nonPrec) },
    { id: "holds", group: "app", label: s.colHolds, width: 76, sortKey: "holds", align: "right", cell: (f) => count(f.holds), foot: (a) => footCount(a.holds) },
    // Takeoffs / landings (day + night; the split is in the tooltip)
    {
      id: "takeoffs", group: "tol", label: s.colTakeoffs, width: 60, sortKey: "takeoffs", align: "right",
      cell: (f) => count(n(f.takeoffs_day) + n(f.takeoffs_night)),
      text: (f) => fmt(s.tolSplit, { d: n(f.takeoffs_day), n: n(f.takeoffs_night) }),
      foot: (a) => footCount(a.takeoffs),
    },
    {
      id: "landings", group: "tol", label: s.colLandings, width: 60, sortKey: "landings", align: "right",
      cell: (f) => count(n(f.landings_day) + n(f.landings_night)),
      text: (f) => fmt(s.tolSplit, { d: n(f.landings_day), n: n(f.landings_night) }),
      foot: (a) => footCount(a.landings),
    },
    // Remarks
    {
      id: "remarks", group: "notes", label: s.colRemarks, width: 260, sortKey: "remarks",
      cell: (f) => (f.remarks ? <span className="text-xs text-ink-2">{f.remarks}</span> : <Dash />),
      text: (f) => f.remarks,
    },
    // Edit
    {
      id: "actions", group: "actions", label: s.colActions, width: 52, align: "center", srLabel: true,
      cell: (f) => (
        <Link
          href={hrefFor(f.id)}
          prefetch={false}
          aria-label={fmt(s.editFlight, { date: f.date })}
          className="btn btn-ghost btn-icon h-8 w-8 text-ink-2 hover:text-ink-1"
        >
          <Pencil size={14} strokeWidth={2} aria-hidden />
        </Link>
      ),
    },
  ];
}

const isGroupStart = (cols: readonly Col[], i: number) => i > 0 && cols[i - 1].group !== cols[i].group;
const GROUP_BORDER = "border-l border-border/70";

function alignClass(a: Col["align"]) {
  return a === "right" ? "text-right" : a === "center" ? "text-center" : "text-left";
}

/* -------------------------------------------------------------------------- */
/* Row                                                                          */
/* -------------------------------------------------------------------------- */

type RowProps = {
  f: FlightDerived;
  index: number;
  cols: readonly Col[];
  tdClass: readonly string[];
  highlighted: boolean;
  onOpen: (id: number) => void;
};

const isInteractive = (t: EventTarget | null) => t instanceof Element && Boolean(t.closest("a,button,input,select,textarea"));

const Row = memo(function Row({ f, index, cols, tdClass, highlighted, onOpen }: RowProps) {
  const href = hrefFor(f.id);

  function onClick(e: MouseEvent<HTMLTableRowElement>) {
    if (isInteractive(e.target)) return; // the date link / edit button handle themselves
    if (window.getSelection()?.toString()) return; // user is selecting text
    if (e.metaKey || e.ctrlKey) { window.open(href, "_blank", "noopener"); return; }
    onOpen(f.id);
  }
  function onAuxClick(e: MouseEvent<HTMLTableRowElement>) {
    if (e.button !== 1 || isInteractive(e.target)) return;
    e.preventDefault();
    window.open(href, "_blank", "noopener");
  }
  function onKeyDown(e: KeyboardEvent<HTMLTableRowElement>) {
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(f.id); }
  }

  return (
    <tr
      tabIndex={0}
      aria-rowindex={index + 3}
      onClick={onClick}
      onAuxClick={onAuxClick}
      onKeyDown={onKeyDown}
      style={ROW_STYLE}
      className={`cursor-pointer transition-colors duration-fast motion-reduce:transition-none
        hover:bg-canvas
        focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand/60 focus-visible:bg-brand/5
        ${highlighted ? "row-saved" : ""}`}
    >
      {cols.map((c, i) => (
        <td key={c.id} className={tdClass[i]} title={c.text?.(f) ?? undefined}>
          {c.cell(f)}
        </td>
      ))}
    </tr>
  );
});

/* -------------------------------------------------------------------------- */
/* Header bits                                                                  */
/* -------------------------------------------------------------------------- */

function SortIcon({ state }: { state: SortDir | "none" }) {
  if (state === "asc") return <Icon.ArrowUp size={12} strokeWidth={2.25} aria-hidden className="shrink-0 text-brand" />;
  if (state === "desc") return <Icon.ArrowDown size={12} strokeWidth={2.25} aria-hidden className="shrink-0 text-brand" />;
  return (
    <Icon.ChevronsUpDown
      size={12}
      strokeWidth={2}
      aria-hidden
      className="shrink-0 text-ink-3 opacity-0 group-hover/sort:opacity-100 group-focus-visible/sort:opacity-100 transition-opacity duration-fast motion-reduce:transition-none"
    />
  );
}

/** Height that lets the card end at the bottom of the viewport with the page at rest. */
function useBoundedHeight(ref: RefObject<HTMLElement | null>): number | null {
  const [h, setH] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const top = el.getBoundingClientRect().top + window.scrollY; // document offset — scroll-independent
      setH(Math.max(MIN_H, Math.round(window.innerHeight - top - BOTTOM_GAP)));
    };
    update();
    const ro = new ResizeObserver(update); // toolbar wrapping / filters row appearing
    ro.observe(document.body);
    window.addEventListener("resize", update);
    return () => { ro.disconnect(); window.removeEventListener("resize", update); };
  }, [ref]);
  return h;
}

/* -------------------------------------------------------------------------- */
/* Table                                                                        */
/* -------------------------------------------------------------------------- */

export type FlightsTableProps = {
  rows: readonly FlightDerived[];
  agg: Agg;
  s: FlightsStrings;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
  onOpen: (id: number) => void;
  augHalfCredit: boolean;
  highlightId: number | null;
};

export function FlightsTable({ rows, agg, s, sortKey, sortDir, onSort, onOpen, augHalfCredit, highlightId }: FlightsTableProps) {
  const cols = useMemo(() => buildColumns(s), [s]);
  // Cells carry no height of their own — see the *_STYLE constants above.
  const tdClass = useMemo(() => cols.map((c, i) => [
    "px-3 py-0 align-middle whitespace-nowrap overflow-hidden text-ellipsis border-b border-border/60",
    alignClass(c.align),
    c.id === "actions" ? "px-1" : "",
    isGroupStart(cols, i) ? GROUP_BORDER : "",
  ].join(" ")), [cols]);

  const groups = useMemo(() => {
    const labels: Record<Group, string> = {
      flight: s.groupFlight, crew: s.groupCrew, time: s.groupTime, inst: s.groupInstrument,
      app: s.groupApproaches, tol: s.groupTol, notes: s.groupRemarks, actions: "",
    };
    const out: { id: Group; label: string; span: number }[] = [];
    for (const c of cols) {
      const last = out[out.length - 1];
      if (last && last.id === c.group) last.span++;
      else out.push({ id: c.group, label: labels[c.group], span: 1 });
    }
    return out;
  }, [cols, s]);

  const leading = cols.findIndex((c) => c.foot); // footer label spans the non-numeric columns

  const scrollRef = useRef<HTMLDivElement>(null);
  const maxHeight = useBoundedHeight(scrollRef);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_H,
    overscan: 12,
    // The sticky header/footer live inside the scroll content, so offset the
    // item positions and the scroll-into-view padding by their heights.
    scrollMargin: HEAD_H,
    scrollPaddingStart: HEAD_H,
    scrollPaddingEnd: FOOT_H,
    getItemKey: (i) => rows[i].id,
  });

  // New filter / sort → back to the top.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [rows]);

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
  const padTop = items.length ? items[0].start - margin : 0;
  const padBottom = items.length ? virtualizer.getTotalSize() - (items[items.length - 1].end - margin) : 0;

  return (
    <div className="card overflow-hidden">
      <div
        ref={scrollRef}
        className="overflow-auto overscroll-contain scrollbar-always"
        style={{ maxHeight: maxHeight != null ? `${maxHeight}px` : "calc(100dvh - 12rem)" }}
      >
        <table
          className="table-fixed w-full border-separate border-spacing-0 text-sm"
          aria-rowcount={rows.length + 3}
        >
          <caption className="sr-only">{s.title}</caption>
          <colgroup>
            {cols.map((c) => <col key={c.id} style={{ width: c.width }} />)}
          </colgroup>

          <thead>
            <tr style={GROUP_ROW_STYLE}>
              {groups.map((g, gi) => (
                <th
                  key={g.id}
                  scope="colgroup"
                  colSpan={g.span}
                  className={`sticky top-0 z-10 px-3 bg-surface text-left text-2xs font-semibold uppercase tracking-[0.1em] text-ink-3 whitespace-nowrap overflow-hidden text-ellipsis border-b border-border/60 ${gi > 0 ? GROUP_BORDER : ""}`}
                >
                  {g.label}
                </th>
              ))}
            </tr>
            <tr style={HEADER_ROW_STYLE}>
              {cols.map((c, i) => {
                const sk = c.sortKey;
                const state: SortDir | "none" | undefined = sk ? (sk === sortKey ? sortDir : "none") : undefined;
                const ariaSort = state === "asc" ? "ascending" : state === "desc" ? "descending" : state === "none" ? "none" : undefined;
                const active = state === "asc" || state === "desc";
                return (
                  <th
                    key={c.id}
                    scope="col"
                    aria-sort={ariaSort}
                    style={HEADER_STICKY_STYLE}
                    className={`sticky z-10 p-0 bg-surface border-b border-border text-2xs font-semibold uppercase tracking-[0.06em] whitespace-nowrap
                      ${alignClass(c.align)} ${active ? "text-ink-1" : "text-ink-2"} ${isGroupStart(cols, i) ? GROUP_BORDER : ""}`}
                  >
                    {sk && state ? (
                      <button
                        type="button"
                        onClick={() => onSort(sk)}
                        style={HEADER_BUTTON_STYLE}
                        className={`group/sort flex w-full items-center gap-1 px-3 cursor-pointer select-none
                          ${c.align === "right" ? "justify-end" : c.align === "center" ? "justify-center" : ""}
                          hover:bg-surface-2 hover:text-ink-1 transition-colors duration-fast motion-reduce:transition-none
                          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand/60`}
                      >
                        <span className="truncate">{c.label}</span>
                        <SortIcon state={state} />
                      </button>
                    ) : (
                      <span className={c.srLabel ? "sr-only" : "block px-3"}>{c.label}</span>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {padTop > 0 && (
              <tr aria-hidden="true">
                <td colSpan={cols.length} className="p-0 border-0" style={{ height: padTop }} />
              </tr>
            )}
            {items.map((item) => {
              const f = rows[item.index];
              return (
                <Row
                  key={f.id}
                  f={f}
                  index={item.index}
                  cols={cols}
                  tdClass={tdClass}
                  highlighted={f.id === highlightId}
                  onOpen={onOpen}
                />
              );
            })}
            {padBottom > 0 && (
              <tr aria-hidden="true">
                <td colSpan={cols.length} className="p-0 border-0" style={{ height: padBottom }} />
              </tr>
            )}
          </tbody>

          <tfoot>
            <tr style={FOOT_ROW_STYLE}>
              <td
                colSpan={leading}
                className="sticky bottom-0 z-10 px-3 bg-surface border-t border-border text-xs font-semibold text-ink-1 whitespace-nowrap overflow-hidden text-ellipsis"
              >
                {s.totals}
                <span className="ml-2 font-normal text-ink-3 num">· {agg.count.toLocaleString()}</span>
                {augHalfCredit && <span className="ml-2 font-normal text-ink-3">· {s.augNote}</span>}
              </td>
              {cols.slice(leading).map((c, j) => {
                const i = leading + j;
                return (
                  <td
                    key={c.id}
                    className={`sticky bottom-0 z-10 px-3 bg-surface border-t border-border num text-xs font-semibold text-ink-1 whitespace-nowrap
                      ${alignClass(c.align)} ${isGroupStart(cols, i) ? GROUP_BORDER : ""}`}
                  >
                    {c.foot ? c.foot(agg) : null}
                  </td>
                );
              })}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
