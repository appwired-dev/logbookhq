"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import s from "./tcexamprep.module.css";

/**
 * The hero of /tcexamprep: an open logbook. Left page, a ruled paper page
 * closing on the three totals rows every paper logbook ends with; right page,
 * the same totals as the dashboard keeps them. "Log the next flight" writes a
 * line in and both pages carry it forward.
 *
 * Sample data only — a made-up student's page, not anyone's real logbook — and
 * nothing is sent or saved. Deterministic (no clock), so the static render and
 * the hydrated page match.
 */

type Entry = { date: string; route: string; dual: number; pic: number; night: number; xc: number; inst: number; ldg: number };

const YEAR = "2026";
const AIRCRAFT = "C172";
const ENTRIES: Entry[] = [
  { date: "09-02", route: "CYOO local", dual: 1.2, pic: 0, night: 0, xc: 0, inst: 0, ldg: 6 },
  { date: "09-06", route: "CYOO local", dual: 0, pic: 0.9, night: 0, xc: 0, inst: 0, ldg: 5 },
  { date: "09-14", route: "CYOO–CYKF", dual: 2.4, pic: 0, night: 0, xc: 2.4, inst: 0, ldg: 2 },
  { date: "09-21", route: "CYOO local", dual: 1.3, pic: 0, night: 0, xc: 0, inst: 1.0, ldg: 1 },
  { date: "09-28", route: "CYOO–CYXU", dual: 0, pic: 2.6, night: 0, xc: 2.6, inst: 0, ldg: 2 },
  { date: "10-05", route: "CYOO local", dual: 1.5, pic: 0, night: 1.5, xc: 0, inst: 0, ldg: 5 },
  { date: "10-12", route: "CYOO–CYHM", dual: 1.8, pic: 0, night: 1.8, xc: 1.8, inst: 0, ldg: 2 },
  { date: "10-19", route: "CYOO local", dual: 0, pic: 1.1, night: 0, xc: 0, inst: 0, ldg: 6 },
  { date: "10-26", route: "CYOO local", dual: 1.4, pic: 0, night: 0, xc: 0, inst: 0.4, ldg: 3 },
];
/** Earlier pages of the same sample logbook. */
const BROUGHT_FORWARD = { dual: 31.2, pic: 7.2, night: 0, xc: 2.1, inst: 1.5, ldg: 96 };
const START = 6;

const COLS = ["dual", "pic", "night", "xc", "inst", "ldg"] as const;
type Col = (typeof COLS)[number];
type Sums = Record<Col, number>;

const sum = (rows: readonly Entry[]): Sums =>
  Object.fromEntries(COLS.map((c) => [c, round1(rows.reduce((t, r) => t + r[c], 0))])) as Sums;
const add = (a: Sums, b: Sums): Sums => Object.fromEntries(COLS.map((c) => [c, round1(a[c] + b[c])])) as Sums;
function round1(n: number) { return Math.round(n * 10) / 10; }
/** Write-in order of a cell in the newest line. */
const order = (n: number) => ({ "--c": n }) as CSSProperties;

/** Blank on paper when nothing was flown in that column, as pilots write it. */
const cell = (c: Col, v: number) => (v === 0 ? "" : c === "ldg" ? String(v) : v.toFixed(1));

/** Days between two MM-DD dates of YEAR (sample dates only). */
function daysBetween(a: string, b: string): number {
  const d = (x: string) => Date.UTC(Number(YEAR), Number(x.slice(0, 2)) - 1, Number(x.slice(3, 5)));
  return Math.round((d(b) - d(a)) / 86_400_000);
}

/** Eases a number toward its target; jumps straight there under reduced motion. */
function useCountUp(target: number, reduce: boolean): number {
  const [shown, setShown] = useState(target);
  const current = useRef(target);
  useEffect(() => {
    if (reduce) { current.current = target; setShown(target); return; }
    const from = current.current;
    if (from === target) return;
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / 650);
      current.current = from + (target - from) * (1 - Math.pow(1 - k, 3));
      setShown(current.current);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, reduce]);
  return shown;
}

function Tile({ label, value, big = false, count = false, reduce }: { label: string; value: number; big?: boolean; count?: boolean; reduce: boolean }) {
  const v = useCountUp(value, reduce);
  return (
    <div className={`${s.tile} ${big ? s.tileBig : ""}`}>
      <div className={s.tileLabel}>{label}</div>
      <div className={s.tileVal}>{count ? Math.round(v) : v.toFixed(1)}{!count && <span className={s.unit}>h</span>}</div>
    </div>
  );
}

export function LogbookSpread() {
  const reduce = useReducedMotion();
  // One state object, updated purely, so quick repeated taps each land.
  const [{ count, justAdded }, setPage] = useState<{ count: number; justAdded: number | null }>({ count: START, justAdded: null });

  const rows = ENTRIES.slice(0, count);
  const page = sum(rows);
  const toDate = add(page, BROUGHT_FORWARD);
  const pageTotal = round1(page.dual + page.pic);
  const total = round1(toDate.dual + toDate.pic);
  const full = count === ENTRIES.length;

  // Passenger recency under CARs 401.05: take-offs and landings in the six
  // months (180 days) to the latest entry. Brought-forward pages are older.
  const last = rows[rows.length - 1].date;
  const recent = rows.filter((r) => daysBetween(r.date, last) <= 180).reduce((t, r) => t + r.ldg, 0);

  const logNext = () =>
    setPage((p) => (p.count >= ENTRIES.length ? { count: START, justAdded: null } : { count: p.count + 1, justAdded: p.count }));

  const sums: [string, Sums, number][] = [
    ["Totals this page", page, pageTotal],
    ["Brought forward", BROUGHT_FORWARD, round1(BROUGHT_FORWARD.dual + BROUGHT_FORWARD.pic)],
    ["Totals to date", toDate, total],
  ];

  return (
    <figure className={s.spread} aria-label="Sample logbook: a paper page and the same totals as Pilot Logbook HQ keeps them">
      <div className={s.paper}>
        <div className={`${s.pageHead} ${s.printed}`}>
          <span>Pilot&rsquo;s log &middot; {YEAR}</span>
          <span>Aircraft {AIRCRAFT} &middot; Page 4</span>
        </div>
        <table className={s.sheet}>
          <caption className="sr-only">Sample student logbook page. Hours in decimal; Ldg counts take-offs and landings.</caption>
          <colgroup>
            <col style={{ width: "13%" }} />
            <col style={{ width: "25.5%" }} />
            {COLS.map((c) => <col key={c} style={{ width: c === "ldg" ? "8%" : "10.7%" }} />)}
          </colgroup>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col" className={s.left}>Route</th>
              <th scope="col">Dual</th>
              <th scope="col">PIC</th>
              <th scope="col">Night</th>
              <th scope="col"><abbr title="Cross-country" style={{ textDecoration: "none" }}>X-C</abbr></th>
              <th scope="col"><abbr title="Instrument" style={{ textDecoration: "none" }}>Inst</abbr></th>
              <th scope="col"><abbr title="Take-offs and landings" style={{ textDecoration: "none" }}>Ldg</abbr></th>
            </tr>
          </thead>
          <tbody>
            {ENTRIES.map((e, i) =>
              i < count ? (
                <tr key={e.date} className={i === justAdded ? s.inkIn : undefined}>
                  <td style={order(0)}>{e.date}</td>
                  <td className={s.left} style={order(1)}>{e.route}</td>
                  {COLS.map((c, j) => <td key={c} style={order(2 + j)}>{cell(c, e[c])}</td>)}
                </tr>
              ) : (
                // Ruled, unwritten lines keep the page the same height as it fills.
                <tr key={e.date} aria-hidden>
                  <td /><td />{COLS.map((c) => <td key={c} />)}
                </tr>
              ),
            )}
          </tbody>
          <tfoot>
            {sums.map(([label, v]) => (
              <tr key={label}>
                <th scope="row" colSpan={2} className={s.printed}>{label}</th>
                {COLS.map((c) => <td key={c}>{c === "ldg" ? String(v[c]) : v[c].toFixed(1)}</td>)}
              </tr>
            ))}
          </tfoot>
        </table>
        <div className={s.pageFoot}>
          <button type="button" className={`${s.logBtn} ${full ? s.ghostBtn : ""}`} onClick={logNext}>
            {full ? "Start the page again" : "Log the next flight"}
          </button>
          <span className={s.note}>Sample page &middot; nothing is saved or sent</span>
        </div>
      </div>

      <div className={s.panel}>
        <div className={s.panelHead}>
          <span>Totals to date</span>
          <span>Sample</span>
        </div>
        <div className={s.tiles} aria-live="polite">
          <Tile big label="Total time" value={total} reduce={reduce} />
          <Tile label="Dual" value={toDate.dual} reduce={reduce} />
          <Tile label="PIC" value={toDate.pic} reduce={reduce} />
          <Tile label="Night" value={toDate.night} reduce={reduce} />
          <Tile label="Cross-country" value={toDate.xc} reduce={reduce} />
          <Tile label="Instrument" value={toDate.inst} reduce={reduce} />
          <Tile count label="Ldg · 6 mo" value={recent} reduce={reduce} />
        </div>
        <div className={s.status}>
          <span className={s.dot} aria-hidden />
          <span><strong>Passenger recency</strong> &middot; CARs 401.05</span>
          <span className={s.sub}>{recent} take-offs &amp; landings in 6 months &middot; 5 needed</span>
        </div>
        <div className={s.status} style={{ borderTop: "none", paddingTop: 0 }}>
          <span className={s.dot} aria-hidden />
          <span><strong>Category 3 medical</strong> &middot; on file</span>
          <span className={s.sub}>expiry date tracked &middot; flagged before it lapses</span>
        </div>
      </div>
    </figure>
  );
}
