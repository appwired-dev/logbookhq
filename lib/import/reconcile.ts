/**
 * Computed totals vs. whatever the workbook itself declares, plus sanity
 * invariants. Every check is plain data for the wizard's step 3.
 *
 * The one convention we actively look for: many spreadsheets (the founder's
 * included) credit augmenting / cruise-relief (AUG → SIC) time at 50 % in
 * their totals. When the plain sum misses the declared total but the
 * SIC-halved sum hits it, the check is "explained" and carries the
 * aug_half_credit suggestion.
 */
import type { Flight } from "../types";
import type { ParsedFlight } from "../csv";
import { computeTotals } from "../derive";
import type { Analysis, ApplyResult, ColumnMapping, DeclaredTotal, ReconcileCheck, ReconcileReport, TotalMeaning } from "./types";
import type { ApplyResultExt } from "./types-ext";
import { SUMMABLE_FIELDS } from "./targets";
import { r1, todayISO } from "./util";

const TOL_HOURS = 0.15;
const TOL_COUNT = 0.5;

const AUG_EXPLANATION = (half: number, declared: number) =>
  `Your spreadsheet credits augmenting (AUG/SIC) time at 50 % — the SIC-halved total (${fmt(half)} h) matches the declared ${fmt(declared)} h. Turn on the 50 % AUG credit setting so LogbookHQ's totals agree with your sheet.`;
const FULL_EXPLANATION = (full: number, declared: number) =>
  `Your spreadsheet counts augmenting (AUG/SIC) time in full — ${fmt(full)} h matches the declared ${fmt(declared)} h, but your account halves SIC time in totals.`;

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

const total = (f: ParsedFlight) => r1(f.day_time + f.night_time);
const credited = (f: ParsedFlight, half: boolean) => (half && f.role === "SIC" ? r1(total(f) * 0.5) : total(f));

export function reconcile(
  result: ApplyResult,
  analysis: Analysis,
  mapping: ColumnMapping,
  opts: { augHalfCredit?: boolean } = {},
): ReconcileReport {
  const aug = Boolean(opts.augHalfCredit);
  const flights = result.flights;
  const ext = result as ApplyResultExt;
  const checks: ReconcileCheck[] = [];

  // ---- 1. grand total --------------------------------------------------------
  const full = r1(flights.reduce((s, f) => s + credited(f, false), 0));
  const half = r1(flights.reduce((s, f) => s + credited(f, true), 0));
  const grand = pickGrandTotal(analysis.declaredTotals);
  if (grand) {
    checks.push(compare("grand_total", `Total time (declared: ${sourceLabel(grand)})`, grand.value, full, half, aug, TOL_HOURS));
  } else {
    checks.push({
      id: "grand_total", label: "Total time", actual: aug ? half : full, status: "info",
      explanation: "The file does not declare a grand total to compare against.",
    });
  }

  // ---- 2. per-category / per-role / per-field declared totals ---------------------
  for (const [key, d] of groupDeclared(analysis.declaredTotals)) {
    if (!d.meaning || d.meaning.kind === "grand_total") continue;
    const computed = computeForMeaning(flights, d.meaning);
    if (!computed) continue;
    const isCount = d.meaning.kind === "field" && /approaches|holds|landings|takeoffs/.test(d.meaning.field);
    checks.push(compare(`declared:${key}`, `${d.label}`, d.value, computed.full, computed.half, aug, isCount ? TOL_COUNT : TOL_HOURS));
  }

  // ---- 3. invariants ----------------------------------------------------------
  const over24 = flights.filter((f) => total(f) > 24).length;
  checks.push({
    id: "hours_gt_24", label: "Flights longer than 24 h", actual: over24, expected: 0,
    status: over24 > 0 ? "mismatch" : "match",
    explanation: over24 > 0 ? `${over24} row(s) add up to more than 24 hours — usually a time column mapped to the wrong bucket or a clock-time column read as hours.` : undefined,
    suggestion: over24 > 0 ? { kind: "review_mapping" } : undefined,
  });

  const rowTotals = ext.rowTotals;
  if (rowTotals && rowTotals.some((t) => t != null)) {
    let compared = 0, off = 0;
    flights.forEach((f, i) => {
      const t = rowTotals[i];
      if (t == null || f.category === "SIM") return;
      compared++;
      if (Math.abs(t - total(f)) > 0.1) off++;
    });
    const pct = compared ? off / compared : 0;
    checks.push({
      id: "row_totals", label: "Row totals vs. time buckets", actual: off, expected: 0,
      status: off === 0 ? "match" : pct > 0.02 ? "mismatch" : "info",
      explanation: off > 0 ? `${off} of ${compared} rows have a Total cell that differs from the sum of their time buckets by more than 0.1 h.` : undefined,
      suggestion: off > 0 && pct > 0.02 ? { kind: "review_mapping" } : undefined,
    });
  }

  if (flights.length > 1) {
    let desc = 0;
    for (let i = 1; i < flights.length; i++) if (flights[i].date < flights[i - 1].date) desc++;
    const steps = flights.length - 1;
    if (desc === 0) {
      checks.push({ id: "date_order", label: "Dates in order", actual: 0, status: "match" });
    } else if (desc >= steps * 0.9) {
      checks.push({ id: "date_order", label: "Dates in order", actual: desc, status: "info", explanation: "The sheet is in reverse-chronological order; flights are sorted by date once imported." });
    } else {
      checks.push({ id: "date_order", label: "Dates in order", actual: desc, status: "info", explanation: `${desc} row(s) are dated earlier than the row above them. Usually fine (back-filled entries) — worth a glance if the count is large.` });
    }
  }

  const today = todayISO();
  const future = flights.filter((f) => f.date > today).length;
  checks.push({
    id: "future_dates", label: "Future-dated flights", actual: future, expected: 0,
    status: future > 0 ? "mismatch" : "match",
    explanation: future > 0 ? `${future} flight(s) are dated after today — check the day/month order of the date column.` : undefined,
    suggestion: future > 0 ? { kind: "review_mapping" } : undefined,
  });

  const nightCols = mapping.columns.filter((c) => c.target.kind === "time" && c.target.condition === "night").map((c) => c.col);
  const totalCol = mapping.columns.find((c) => c.target.kind === "field" && c.target.field === "total_time")?.col;
  if (totalCol != null && nightCols.length > 0) {
    const nightSum = r1(nightCols.reduce((s, c) => s + (result.columnSums[c] ?? 0), 0));
    const totalSum = result.columnSums[totalCol] ?? 0;
    checks.push({
      id: "night_gt_total", label: "Night hours vs. total hours", actual: nightSum, expected: totalSum,
      status: nightSum > totalSum + 0.1 ? "mismatch" : "match",
      explanation: nightSum > totalSum + 0.1 ? "The night columns add up to more than the Total column — a night column may be mis-mapped." : undefined,
      suggestion: nightSum > totalSum + 0.1 ? { kind: "review_mapping" } : undefined,
    });
  }

  const byReason = new Map<string, number>();
  for (const s of result.skipped) byReason.set(s.reason, (byReason.get(s.reason) ?? 0) + 1);
  for (const [reason, count] of byReason) {
    checks.push({ id: `skipped:${reason}`, label: `Rows skipped — ${SKIP_LABEL[reason] ?? reason}`, actual: count, status: "info" });
  }

  // ---- summary -----------------------------------------------------------------
  const asFlights: Flight[] = flights.map((f, i) => ({ ...f, id: i + 1, user_id: "", duty_time: 0, created_at: "", updated_at: "" }));
  const totals = computeTotals(asFlights, { augHalfCredit: aug });
  const byRole: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  for (const f of flights) {
    const h = credited(f, aug);
    byRole[f.role] = r1((byRole[f.role] ?? 0) + h);
    byCategory[f.category] = r1((byCategory[f.category] ?? 0) + (f.category === "SIM" ? f.sim_inst : h));
  }

  return {
    checks,
    summary: { flights: flights.length, skipped: result.skipped.length, totalHours: totals.total_time, byRole, byCategory },
    ok: !checks.some((c) => c.status === "mismatch"),
  };
}

const SKIP_LABEL: Record<string, string> = {
  no_date: "no date", bad_date: "unreadable date", no_aircraft: "no aircraft", no_time: "no time logged",
  header_or_total_row: "header / total rows", empty: "blank rows",
};

function sourceLabel(d: DeclaredTotal): string {
  return d.source === "totals-sheet" ? `"${d.label}"` : d.source === "footer-row" ? `footer "${d.label}"` : `sum of "${d.label}" column`;
}

function pickGrandTotal(declared: DeclaredTotal[]): DeclaredTotal | null {
  const grand = declared.filter((d) => d.meaning?.kind === "grand_total");
  for (const src of ["totals-sheet", "footer-row", "total-column"] as const) {
    const hit = grand.find((d) => d.source === src);
    if (hit) return hit;
  }
  return null;
}

/**
 * One declared figure per (meaning, source). A summable field that a footer
 * row splits over several columns (the founder's sheet has six cross-country
 * columns — Day/Night × FO/PIC/AUG) is a single total: the cells are summed
 * before comparing, since apply sums those columns per row. Any other
 * duplicate keeps its first occurrence.
 */
function groupDeclared(declared: DeclaredTotal[]): Map<string, DeclaredTotal> {
  const groups = new Map<string, { total: DeclaredTotal; labels: string[] }>();
  for (const d of declared) {
    if (!d.meaning || d.meaning.kind === "grand_total") continue;
    if (d.source === "total-column") continue;
    const key = `${meaningKey(d.meaning)}|${d.source}`;
    const g = groups.get(key);
    if (!g) { groups.set(key, { total: { ...d }, labels: [d.label] }); continue; }
    if (d.source === "footer-row" && d.meaning.kind === "field" && SUMMABLE_FIELDS.has(d.meaning.field)) {
      g.total.value = r1(g.total.value + d.value);
      g.labels.push(d.label);
    }
  }
  const out = new Map<string, DeclaredTotal>();
  for (const [key, g] of groups) {
    if (g.labels.length > 1) g.total.label = `${commonLabelPrefix(g.labels)} (${g.labels.length} columns)`;
    out.set(key, g.total);
  }
  return out;
}

/** "Totals › Cross Country › Day › FO", "Totals › Cross Country › Night › PIC" → "Totals › Cross Country". */
function commonLabelPrefix(labels: string[]): string {
  const split = labels.map((l) => l.split(" › "));
  const prefix: string[] = [];
  for (let i = 0; i < split[0].length; i++) {
    const seg = split[0][i];
    if (!split.every((s) => s[i] === seg)) break;
    prefix.push(seg);
  }
  return prefix.length > 0 ? prefix.join(" › ") : labels[0];
}

function meaningKey(m: TotalMeaning): string {
  if (m.kind === "grand_total") return "grand";
  if (m.kind === "field") return `field:${m.field}`;
  return `time:${m.category}:${m.condition}:${m.role}`;
}

/** Computed figure for a declared label, full-credit and SIC-halved. */
function computeForMeaning(flights: ParsedFlight[], m: TotalMeaning): { full: number; half: number } | null {
  if (m.kind === "grand_total") return null;
  if (m.kind === "field") {
    const pick = (f: ParsedFlight): number => {
      switch (m.field) {
        case "xc_time": return f.is_xcountry ? total(f) : 0;
        case "actual_inst": return f.actual_inst;
        case "hood_inst": return f.hood_inst;
        case "sim_inst": return f.sim_inst;
        case "ifr_approaches": return f.ifr_approaches;
        case "precision_approaches": return f.precision_approaches;
        case "non_precision_approaches": return f.non_precision_approaches;
        case "holds": return f.holds;
        case "cfi_time": return f.cfi_time;
        case "landings_day": return f.landings_day;
        case "landings_night": return f.landings_night;
        case "takeoffs_day": return f.takeoffs_day;
        case "takeoffs_night": return f.takeoffs_night;
        case "total_time": return total(f);
        default: return NaN;
      }
    };
    const vals = flights.map(pick);
    if (vals.some((v) => Number.isNaN(v))) return null;
    const v = r1(vals.reduce((s, x) => s + x, 0));
    return { full: v, half: v };
  }
  const CAT: Record<string, string> = { se: "SE", me: "ME", ses: "SES", mes: "MES", heli: "HELI", sim: "SIM" };
  const ROLE: Record<string, string> = { dual: "DUAL", pic: "PIC", fo: "FO", sic: "SIC", check: "CHECK", solo: "PIC" };
  const sumWith = (halve: boolean) => r1(flights.reduce((s, f) => {
    if (m.category !== "any" && f.category !== CAT[m.category]) return s;
    if (m.role !== "any" && f.role !== ROLE[m.role]) return s;
    let h = m.condition === "day" ? f.day_time : m.condition === "night" ? f.night_time : total(f);
    if (f.category === "SIM" && m.category === "sim") h = f.sim_inst;
    if (halve && f.role === "SIC") h = r1(h * 0.5);
    return s + h;
  }, 0));
  return { full: sumWith(false), half: sumWith(true) };
}

function compare(id: string, label: string, declared: number, full: number, half: number, aug: boolean, tol: number): ReconcileCheck {
  const primary = aug ? half : full;
  const alt = aug ? full : half;
  const base: ReconcileCheck = { id, label, expected: declared, actual: primary, delta: r1(primary - declared), status: "match" };
  if (Math.abs(primary - declared) <= tol) return base;
  if (half !== full && Math.abs(alt - declared) <= tol) {
    return {
      ...base, status: "explained",
      explanation: aug ? FULL_EXPLANATION(full, declared) : AUG_EXPLANATION(half, declared),
      suggestion: aug ? { kind: "none", detail: "Turn off the 50 % AUG credit setting to match this sheet." } : { kind: "aug_half_credit", detail: "Enable 50 % AUG/SIC credit" },
    };
  }
  return {
    ...base, status: "mismatch",
    explanation: `Computed ${fmt(primary)} vs. declared ${fmt(declared)} (difference ${fmt(r1(primary - declared))}). A column may be mapped to the wrong bucket, or the sheet's total includes rows that were skipped.`,
    suggestion: { kind: "review_mapping" },
  };
}
