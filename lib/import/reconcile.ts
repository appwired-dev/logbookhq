/**
 * Computed totals vs. whatever the workbook itself declares, plus sanity
 * invariants. Every check is plain data for the wizard's step 3; fixed
 * checks carry a `messageKey` + `vars` so the client can localise them, the
 * English `label` / `explanation` being the fallback.
 *
 * Before a gap is called a mismatch several things are actively looked for:
 *   - the rows apply skipped: undated rows the sheet's own SUM still counts
 *     ("the 2 skipped rows carry 2.3 h in the Total column");
 *   - the 50 % AUG convention: many spreadsheets (the founder's included)
 *     credit augmenting / cruise-relief (AUG → SIC) time at 50 % in their
 *     totals. When the plain sum misses the declared total but the
 *     SIC-halved sum hits it, the check is "explained" and carries the
 *     aug_half_credit suggestion (and the mirror image when the account
 *     halves but the sheet does not);
 *   - simulator sessions: a sheet's Total column carries them, LogbookHQ's
 *     flight time does not — the sheet's own figures are compared with the
 *     sims added back ("includes 4 sim sessions");
 *   - numbers stored as text: a spreadsheet SUM skips them, the import reads
 *     them, so a declared total falls short by exactly their sum;
 *   - figures in minutes: "(min)" / "minutes" labels are divided by 60, and
 *     an unlabeled integer that equals 60 × the computed hours is called out;
 *   - small residues (≤ max(min(1 h, 2 %), 0.1 %) of the declared figure):
 *     the sheet's own formula range or rounding — "explained", never a
 *     mapping problem. The 1 h floor shrinks to 2 % for small totals.
 * When the row-totals invariant has already found rows whose Total cell
 * disagrees with their buckets, the AUG / rounding explanations are
 * suppressed and the check points at those rows instead.
 *
 * Declared totals that name a role / condition ("Total X-Country PIC (Day)")
 * for a field spread over several columns are compared against the sum of
 * the source columns whose header facets match; a facet with no matching
 * column is reported as "info" rather than compared against the wrong thing.
 *
 * A cross-country column that matches its declared total can still differ
 * from LogbookHQ's own figure, which credits whole flights (day + night of
 * every flight flagged cross-country) while a sheet may log only the
 * cross-country portion — reported as "explained", not a mapping problem.
 *
 * Rows that apply split into several flights (time in more than one
 * (category, role) bucket — see apply.ts) are surfaced as an "info" check,
 * and the row-totals invariant compares each SOURCE row's Total cell with the
 * sum of the flights it emitted.
 */
import type { Flight } from "../types";
import type { ParsedFlight } from "../csv";
import { computeTotals } from "../derive";
import type {
  Analysis, ApplyResult, ColumnMapping, DeclaredTotal, FieldTarget, ReconcileCheck, ReconcileReport,
  TimeCategory, TimeCondition, TimeRole, TotalMeaning,
} from "./types";
import type { ApplyResultExt } from "./types-ext";
import { sourceRowGroups } from "./apply";
import { isCountLabel, type AnalysisExt } from "./analyze";
import { SUMMABLE_FIELDS } from "./targets";
import { facetsOfPath, type Facets } from "./synonyms";
import { parseDateText, r1, todayISO } from "./util";

const TOL_HOURS = 0.15;
const TOL_COUNT = 0.5;
/**
 * Beyond the exact tolerance, a gap up to max(min(1 h, 2 %), 0.1 %) of the
 * declared figure is the sheet's own formula/rounding, not a mapping problem:
 * 1 h on 2,000 h is rounding, 1 h on 8.5 h is not.
 */
const smallGapTol = (declared: number) => {
  const d = Math.abs(declared);
  return Math.max(Math.min(1.0, d * 0.02), d * 0.001);
};
/** Dates listed when a check points at specific rows. */
const MAX_LISTED_DATES = 3;
/** Instrument time may exceed flight time by this much before a row counts as over (clock-time rounding). */
const INST_SLACK = 0.05;

type Unit = "h" | "count";
type Vars = NonNullable<ReconcileCheck["vars"]>;
const COUNT_FIELD_RE = /approaches|holds|landings|takeoffs/;
/** Hour fields whose declared totals are compared column-wise (a SUM over the source column(s)); counts stay flight-based. */
const COLUMN_COMPARED_FIELDS: ReadonlySet<FieldTarget> = new Set<FieldTarget>(["xc_time", "actual_inst", "hood_inst", "sim_inst", "cfi_time"]);
const FIELD_WORD: Partial<Record<FieldTarget, string>> = {
  xc_time: "cross-country time", actual_inst: "actual instrument time", hood_inst: "hood time", sim_inst: "simulator time", cfi_time: "instruction given",
};
const FIELD_SHORT: Partial<Record<FieldTarget, string>> = { actual_inst: "actual", hood_inst: "hood", sim_inst: "sim" };
/** "(min)", "minutes", "mins" in a declared label → the figure is in minutes. */
const MINUTES_LABEL_RE = /\(\s*mins?(?:utes)?\.?\s*\)|\bminutes\b|\bmins\b|\bmin\b|\bminuten\b|\bminutos\b|분\b|分钟|分鐘/i;

export function isMinutesLabel(label: string): boolean {
  return MINUTES_LABEL_RE.test(label);
}

// ---------------------------------------------------------------------------
// Formatting + explanations
// ---------------------------------------------------------------------------

const NF = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
function fmt(n: number): string {
  return NF.format(r1(n));
}
function fmtU(n: number, unit: Unit): string {
  return unit === "h" ? `${fmt(n)} h` : fmt(n);
}
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const listDates = (dates: string[], total: number) => `${dates.join(", ")}${total > dates.length ? " …" : ""}`;

const AUG_EXPLANATION = (half: number, declared: number, residue: number) =>
  `Your spreadsheet credits augmenting (AUG/SIC) time at 50 % — the SIC-halved total (${fmt(half)} h) ${matchesPhrase(residue)} the declared ${fmt(declared)} h. Turn on the 50 % AUG credit setting so LogbookHQ's totals agree with your sheet.`;
const FULL_EXPLANATION = (full: number, declared: number, residue: number) =>
  `Your spreadsheet counts augmenting (AUG/SIC) time in full — ${fmt(full)} h ${matchesPhrase(residue)} the declared ${fmt(declared)} h. Your account's 50 % AUG credit setting is what decides how that time is credited in LogbookHQ.`;
const matchesPhrase = (residue: number) => (residue <= TOL_HOURS ? "matches" : `comes within ${fmt(residue)} h of`);

const SMALL_GAP_EXPLANATION = (delta: number, declared: number, unit: Unit) =>
  `Differs by ${fmtU(Math.abs(delta), unit)} on ${fmtU(declared, unit)}. This small a gap is almost always the spreadsheet's own totals formula (a range that stops short of the newest rows, or rounding), not a mapping problem.`;

interface TextCells { count: number; sum: number; columns: string[] }
const TEXT_CELLS_EXPLANATION = (t: TextCells, unit: Unit) =>
  `The sheet's total skips ${plural(t.count, "cell")} stored as text (${fmtU(t.sum, unit)}) in ${listColumns(t.columns)} — spreadsheet SUM formulas ignore text, the import reads it. That accounts for the whole difference.`;
function listColumns(cols: string[]): string {
  const quoted = cols.map((c) => `"${c}"`);
  return quoted.length <= 3 ? quoted.join(", ") : `${quoted.slice(0, 3).join(", ")} and ${quoted.length - 3} more`;
}

// ---------------------------------------------------------------------------
// Flight-level helpers
// ---------------------------------------------------------------------------

const total = (f: ParsedFlight) => r1(f.day_time + f.night_time);
/** Hours a flight contributes; SIC at 50 % when `half`. Not rounded per flight — totals are rounded once, like computeTotals. */
const credited = (f: ParsedFlight, half: boolean) => (half && f.role === "SIC" ? total(f) * 0.5 : total(f));

const CAT_ENUM: Record<string, string> = { se: "SE", me: "ME", ses: "SES", mes: "MES", heli: "HELI", sim: "SIM" };
const ROLE_ENUM: Record<string, string> = { dual: "DUAL", pic: "PIC", fo: "FO", sic: "SIC", check: "CHECK", solo: "PIC" };

// ---------------------------------------------------------------------------
// Context shared by the declared-total checks
// ---------------------------------------------------------------------------

/** Rows whose Total cell disagrees with the sum of their buckets (row-totals invariant). */
interface OffRows { count: number; dates: string[] }
/** Undated rows apply skipped whose Total cells the sheet's own SUM still counts. */
interface SkippedTotals { rows: number; sum: number }
/** Simulator sessions: how many, what their rows carry in the sheet's Total column, and their session hours. */
interface SimInfo { sessions: number; inColumn: number; hours: number }
interface Ctx { cols: ColumnIndex; aug: boolean; offRows?: OffRows; skippedTotals?: SkippedTotals; sim: SimInfo }

type RowGroup = ReturnType<typeof sourceRowGroups>[number];

function simInfo(groups: RowGroup[], flights: ParsedFlight[]): SimInfo {
  let sessions = 0, inColumn = 0, hours = 0;
  for (const g of groups) {
    if (g.flights.length === 0 || !g.flights.every((i) => flights[i].category === "SIM")) continue;
    sessions++;
    if (g.total != null && g.total > 0) inColumn += g.total;
    hours += g.flights.reduce((s, i) => s + flights[i].sim_inst, 0);
  }
  return { sessions, inColumn: r1(inColumn), hours: r1(hours) };
}

interface RowTotalStats { compared: number; off: number; halved: number; offDates: string[] }

/** One comparison per SOURCE row: a row split into several flights stands against their sum. */
function rowTotalStats(groups: RowGroup[], flights: ParsedFlight[]): RowTotalStats {
  const stats: RowTotalStats = { compared: 0, off: 0, halved: 0, offDates: [] };
  for (const g of groups) {
    if (g.total == null) continue;
    const fs = g.flights.map((i) => flights[i]).filter((f) => f.category !== "SIM");
    if (fs.length === 0) continue;
    stats.compared++;
    const fullT = r1(fs.reduce((s, f) => s + total(f), 0));
    if (Math.abs(g.total - fullT) <= 0.1) continue;
    const halfT = r1(fs.reduce((s, f) => s + credited(f, true), 0));
    if (fs.some((f) => f.role === "SIC") && Math.abs(g.total - halfT) <= 0.1) { stats.halved++; continue; }
    stats.off++;
    if (stats.offDates.length < MAX_LISTED_DATES) stats.offDates.push(fs[0].date);
  }
  return stats;
}

function skippedUndatedTotals(result: ApplyResult, analysis: AnalysisExt): SkippedTotals | undefined {
  const map = analysis.undatedRowTotals;
  if (!map) return undefined;
  let rows = 0, sum = 0;
  for (const s of result.skipped) {
    if (s.reason !== "no_date" && s.reason !== "bad_date") continue;
    const v = map[s.row];
    if (v == null) continue;
    rows++;
    sum += v;
  }
  return rows > 0 ? { rows, sum: r1(sum) } : undefined;
}

// ---------------------------------------------------------------------------
// reconcile
// ---------------------------------------------------------------------------

export function reconcile(
  result: ApplyResult,
  analysis: Analysis,
  mapping: ColumnMapping,
  opts: { augHalfCredit?: boolean } = {},
): ReconcileReport {
  const aug = Boolean(opts.augHalfCredit);
  const flights = result.flights;
  const ext = result as ApplyResultExt;
  const anx = analysis as AnalysisExt;
  const checks: ReconcileCheck[] = [];
  const cols = new ColumnIndex(analysis, mapping, result.columnSums);
  const cumulative = Boolean(result.cumulativeTotal);
  const groups = sourceRowGroups(ext);

  // ---- context the declared checks lean on ---------------------------------------
  const sim = simInfo(groups, flights);
  const rowStats = !cumulative && ext.rowTotals?.some((t) => t != null) ? rowTotalStats(groups, flights) : null;
  const offRows = rowStats && rowStats.off > 0 ? { count: rowStats.off, dates: rowStats.offDates } : undefined;
  const ctx: Ctx = { cols, aug, offRows, skippedTotals: skippedUndatedTotals(result, anx), sim };

  // ---- 1. grand total --------------------------------------------------------
  const full = r1(flights.reduce((s, f) => s + credited(f, false), 0));
  const half = r1(flights.reduce((s, f) => s + credited(f, true), 0));
  // A running-total column is not a per-row total: its sum means nothing.
  const declaredPool = cumulative ? analysis.declaredTotals.filter((d) => d.source !== "total-column") : analysis.declaredTotals;
  const grand = pickGrandTotal(declaredPool);
  if (grand) {
    checks.push(grandCheck(grand, full, half, ctx));
  } else {
    const computed = aug ? half : full;
    checks.push({
      id: "grand_total", label: "Total time", actual: computed, status: "info",
      explanation: "The file does not declare a grand total to compare against.",
      messageKey: "grand_total_none", vars: { computed },
    });
  }

  // ---- 2. per-category / per-role / per-field declared totals ---------------------
  for (const [key, d] of groupDeclared(declaredPool)) {
    if (!d.meaning || d.meaning.kind === "grand_total") continue;
    const check = d.meaning.kind === "field"
      ? fieldCheck(`declared:${key}`, d, d.meaning.field, flights, ctx)
      : timeCheck(`declared:${key}`, d, d.meaning, flights, ctx);
    if (check) checks.push(check);
  }

  // ---- 3. invariants (bounds live in the explanation — nothing here is a declared number) ----
  const over24 = flights.filter((f) => total(f) > 24).length;
  checks.push({
    id: "hours_gt_24", label: "Flights longer than 24 h", actual: over24,
    status: over24 > 0 ? "mismatch" : "match",
    explanation: over24 > 0
      ? `${plural(over24, "row")} add up to more than 24 hours — usually a time column mapped to the wrong bucket or a clock-time column read as hours.`
      : "No row adds up to more than 24 h.",
    suggestion: over24 > 0 ? { kind: "review_mapping" } : undefined,
    messageKey: over24 > 0 ? "hours_gt_24_some" : "hours_gt_24_none", vars: { count: over24 },
  });

  const above = analysis.header.dateRowsAbove ?? 0;
  if (above > 0) {
    checks.push({
      id: "date_rows_above_header", label: "Dated rows above the header", actual: above, status: "mismatch",
      explanation: `${plural(above, "dated row")} above the detected header were not imported — the header may have been detected too far down.`,
      suggestion: { kind: "review_mapping" }, messageKey: "date_rows_above_header", vars: { count: above },
    });
  }

  if (rowStats) {
    const { compared, off, halved, offDates } = rowStats;
    const pct = compared ? off / compared : 0;
    const halvedNote = halved > 0
      ? `${plural(halved, "AUG row")} carry a Total cell at 50 % of their logged time — the sheet credits augmenting time at 50 % in its row totals.`
      : "";
    const dates = listDates(offDates, off);
    checks.push({
      id: "row_totals", label: "Row totals vs. time buckets", actual: off,
      status: off === 0 ? "match" : pct > 0.02 ? "mismatch" : "info",
      explanation: off > 0
        ? `${off} of ${compared} rows have a Total cell that differs from the sum of their time buckets by more than 0.1 h (${dates}).${halvedNote ? ` ${halvedNote}` : ""}`
        : halvedNote || `Every row's Total cell equals the sum of its time buckets (within 0.1 h).`,
      suggestion: off > 0 && pct > 0.02 ? { kind: "review_mapping" } : undefined,
      messageKey: off > 0 ? "row_totals_off" : halved > 0 ? "row_totals_halved" : "row_totals_ok",
      vars: { off, compared, halved, dates },
    });
  }

  if (cumulative) {
    checks.push({
      id: "cumulative_total", label: "Total column", actual: flights.length, status: "explained",
      explanation: "The Total column looks cumulative (running total) and was not used for row hours.",
      suggestion: { kind: "none" }, messageKey: "cumulative_total", vars: {},
    });
  }

  const split = ext.splitRows ?? [];
  if (split.length > 0) {
    checks.push({
      id: "split_rows", label: "Rows split across roles", actual: split.length, status: "info",
      explanation: `${split.length === 1 ? "1 row carries" : `${split.length} rows carry`} time in more than one role; each was imported as one flight per role so no hours are lost.`,
      messageKey: "split_rows", vars: { count: split.length },
    });
  }

  // Instrument time (actual + hood) never exceeds flight time — per source row, sims aside.
  let instOver = 0;
  const instDates: string[] = [];
  for (const g of groups) {
    const fs = g.flights.map((i) => flights[i]).filter((f) => f.category !== "SIM");
    if (fs.length === 0) continue;
    const inst = fs.reduce((s, f) => s + f.actual_inst + f.hood_inst, 0);
    const flown = fs.reduce((s, f) => s + f.day_time + f.night_time, 0);
    if (r1(inst) > r1(flown) + INST_SLACK) {
      instOver++;
      if (instDates.length < MAX_LISTED_DATES) instDates.push(fs[0].date);
    }
  }
  const clamped = result.instrumentClamped ?? 0;
  if (instOver > 0) {
    const dates = listDates(instDates, instOver);
    checks.push({
      id: "instrument_gt_flight", label: "Instrument time vs. flight time", actual: instOver, status: "mismatch",
      explanation: `${plural(instOver, "row")} log more instrument time (actual + hood) than flight time (${dates}) — an instrument column may be mapped twice or to the wrong field.`,
      suggestion: { kind: "review_mapping" }, messageKey: "instrument_gt_flight", vars: { count: instOver, dates },
    });
  } else if (clamped > 0) {
    checks.push({
      id: "instrument_gt_flight", label: "Instrument time vs. flight time", actual: clamped, status: "info",
      explanation: `${plural(clamped, "row")} had instrument time above flight time; clamped to the flight time.`,
      messageKey: "instrument_clamped", vars: { count: clamped },
    });
  } else {
    checks.push({
      id: "instrument_gt_flight", label: "Instrument time vs. flight time", actual: 0, status: "match",
      explanation: "No row logs more instrument time than flight time.", messageKey: "instrument_ok", vars: {},
    });
  }

  if (flights.length > 1) {
    let desc = 0;
    for (let i = 1; i < flights.length; i++) if (flights[i].date < flights[i - 1].date) desc++;
    const steps = flights.length - 1;
    if (desc === 0) {
      checks.push({ id: "date_order", label: "Dates in order", actual: 0, status: "match", messageKey: "date_order_ok", vars: {} });
    } else if (desc >= steps * 0.9) {
      checks.push({
        id: "date_order", label: "Dates in order", actual: desc, status: "info",
        explanation: "The sheet is in reverse-chronological order; flights are sorted by date once imported.",
        messageKey: "date_order_reversed", vars: { count: desc },
      });
    } else {
      checks.push({
        id: "date_order", label: "Dates in order", actual: desc, status: "info",
        explanation: `${plural(desc, "row")} are dated earlier than the row above them. Usually fine (back-filled entries) — worth a glance if the count is large.`,
        messageKey: "date_order_backfilled", vars: { count: desc },
      });
    }
  }

  const today = todayISO();
  const future = flights.filter((f) => f.date > today).length;
  checks.push({
    id: "future_dates", label: "Future-dated flights", actual: future,
    status: future > 0 ? "mismatch" : "match",
    explanation: future > 0
      ? `${plural(future, "flight")} are dated after today — check the day/month order of the date column.`
      : `No flight is dated after today (${today}).`,
    suggestion: future > 0 ? { kind: "review_mapping" } : undefined,
    messageKey: future > 0 ? "future_dates_some" : "future_dates_none", vars: { count: future, today },
  });

  const nightCols = cols.timeCols().filter((t) => t.cond === "night").map((t) => t.col);
  const totalCol = cols.forField("total_time")[0];
  if (!cumulative && totalCol != null && nightCols.length > 0) {
    const nightSum = r1(nightCols.reduce((s, c) => s + cols.sum(c), 0));
    const totalSum = r1(cols.sum(totalCol));
    const bad = nightSum > totalSum + 0.1;
    checks.push({
      id: "night_gt_total", label: "Night hours vs. total hours", actual: nightSum,
      status: bad ? "mismatch" : "match",
      explanation: bad
        ? `The night columns add up to ${fmt(nightSum)} h, more than the Total column's ${fmt(totalSum)} h — a night column may be mis-mapped.`
        : `${fmt(nightSum)} night h ≤ ${fmt(totalSum)} total h`,
      suggestion: bad ? { kind: "review_mapping" } : undefined,
      messageKey: bad ? "night_gt_total" : "night_le_total", vars: { night: nightSum, total: totalSum },
    });
  }

  const unknownRoles = result.unknownRoles ?? [];
  if (unknownRoles.length > 0) {
    const count = unknownRoles.reduce((s, u) => s + u.count, 0);
    const samples = unknownRoles.slice(0, 3).map((u) => u.text).join(", ");
    checks.push({
      id: "unknown_roles", label: "Unrecognised role text", actual: count, status: "info",
      explanation: `${plural(count, "row")} with unrecognised role text (${samples}) were imported as PIC — review the Role column.`,
      suggestion: { kind: "review_mapping" }, messageKey: "unknown_roles", vars: { count, samples },
    });
  }

  const negative = result.negativeHours ?? 0;
  if (negative > 0) {
    checks.push({
      id: "negative_hours", label: "Negative hours", actual: negative, status: "info",
      explanation: `${plural(negative, "cell")} with negative hours were treated as 0.`,
      messageKey: "negative_hours", vars: { count: negative },
    });
  }

  const conv = mapping.conventions ?? {};
  if (conv.dayFirstDates != null && (conv.dayFirstSource === "prior" || conv.dayFirstSource === "default")) {
    const example = anx.dayFirstExample ?? "";
    const readAs = example ? parseDateText(example, conv.dayFirstDates)?.iso ?? "" : "";
    const other = example ? parseDateText(example, !conv.dayFirstDates)?.iso ?? "" : "";
    const order = conv.dayFirstDates ? "day-first (day/month/year)" : "month-first (month/day/year)";
    const why = conv.dayFirstSource === "prior"
      ? `because of ${anx.dayFirstReason || "the sheet's language, registrations or airports"}`
      : "by default — the file gives no clue either way";
    const ex = example && readAs ? ` "${example}" was read as ${readAs}${other && other !== readAs ? ` (not ${other})` : ""}.` : "";
    checks.push({
      id: "day_first_dates", label: "Day/month order of dates", actual: flights.length, status: "info",
      explanation: `Ambiguous dates were read ${order} ${why}.${ex} Flip the day-first switch if that is wrong.`,
      messageKey: conv.dayFirstSource === "prior" ? "day_first_prior" : "day_first_default",
      vars: { dayFirst: String(conv.dayFirstDates), reason: anx.dayFirstReason ?? "", example, readAs, other },
    });
  }

  const siblings = analysis.siblingSheets ?? [];
  if (siblings.length > 0) {
    const names = siblings.map((s) => s.name);
    const shown = names.length <= 5 ? names.join(", ") : `${names.slice(0, 5).join(", ")} …`;
    const rows = siblings.reduce((s, x) => s + x.rowCount, 0);
    checks.push({
      id: "sibling_sheets", label: "Sheets with the same layout", actual: siblings.length, status: "info",
      explanation: `Also importing ${plural(siblings.length, "sheet")} with the same layout (${shown}).`,
      messageKey: "sibling_sheets", vars: { count: siblings.length, names: shown, rows },
    });
  }
  for (const o of analysis.otherDatedSheets ?? []) {
    checks.push({
      id: `other_sheet:${o.index}`, label: `Sheet "${o.name}" not imported`, actual: o.rowCount, status: "info",
      explanation: `Sheet "${o.name}" has ${plural(o.rowCount, "dated row")} in a different layout and was not imported.`,
      messageKey: "other_dated_sheet", vars: { sheet: o.name, rows: o.rowCount },
    });
  }

  const byReason = new Map<string, number>();
  for (const s of result.skipped) byReason.set(s.reason, (byReason.get(s.reason) ?? 0) + 1);
  for (const [reason, count] of byReason) {
    const reasonLabel = SKIP_LABEL[reason] ?? reason;
    checks.push({
      id: `skipped:${reason}`, label: `Rows skipped — ${reasonLabel}`, actual: count, status: "info",
      messageKey: "skipped_rows", vars: { reason, reasonLabel, count },
    });
  }

  // ---- summary -----------------------------------------------------------------
  const asFlights: Flight[] = flights.map((f, i) => ({ ...f, id: i + 1, user_id: "", duty_time: 0, created_at: "", updated_at: "" }));
  const rawTotals = computeTotals(asFlights, { augHalfCredit: false });
  const creditedTotals = aug ? computeTotals(asFlights, { augHalfCredit: true }) : rawTotals;
  const byRole: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  for (const f of flights) {
    const h = credited(f, aug);
    byRole[f.role] = (byRole[f.role] ?? 0) + h;
    byCategory[f.category] = (byCategory[f.category] ?? 0) + (f.category === "SIM" ? f.sim_inst : h);
  }
  for (const k of Object.keys(byRole)) byRole[k] = r1(byRole[k]);
  for (const k of Object.keys(byCategory)) byCategory[k] = r1(byCategory[k]);

  return {
    checks,
    summary: {
      flights: flights.length,
      skipped: result.skipped.length,
      totalHours: r1(rawTotals.total_time),
      creditedHours: r1(creditedTotals.total_time),
      byRole,
      byCategory,
    },
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

// ---------------------------------------------------------------------------
// Grand-total selection + check
// ---------------------------------------------------------------------------

/** How strongly a Totals-sheet label says "this is the grand total". */
function grandLabelScore(label: string): number {
  if (/total\s*(?:flight\s*)?(?:time|hours|hrs)|총\s*비행\s*시간|总飞行时间|總飛行時間|gesamt(?:flug)?zeit/i.test(label)) return 3;
  if (/grand|overall|all\s+time|career/i.test(label)) return 2;
  if (/\bsum\b|\btotal\b|합계|총계|总计|總計|合计|合計|gesamt|somme|suma/i.test(label)) return 1;
  return 0;
}

/**
 * The sheet's own grand total: a Totals-sheet line that plainly says so
 * ("Total Time", "Sum", "Grand total"), else the footer cell under the Total
 * column, else our sum of the per-row Total column, else any other
 * grand-total line. Composite figures ("Total Instrument Time") and labels
 * that count things ("Total flights") never qualify.
 */
function pickGrandTotal(declared: DeclaredTotal[]): DeclaredTotal | null {
  const grand = declared.filter((d) => d.meaning?.kind === "grand_total" && !d.composite && !isCountLabel(d.label));
  let best: DeclaredTotal | null = null, bestScore = 0;
  for (const d of grand) {
    if (d.source !== "totals-sheet") continue;
    const score = grandLabelScore(d.label);
    if (score > bestScore) { best = d; bestScore = score; }
  }
  return best
    ?? grand.find((d) => d.source === "footer-row")
    ?? grand.find((d) => d.source === "total-column")
    ?? grand.find((d) => d.source === "totals-sheet")
    ?? null;
}

/**
 * Total time vs. the sheet's grand total. A figure that comes from the
 * sheet's own Total column (the column's sum, or its footer) counts the
 * simulator rows that column carries, so those are added to the computed
 * side; a Totals-sheet line may or may not include sims, so "+ sims" is
 * tried as an alternative. The per-row Total column is compared against
 * apply's own sum of it — the same rows, never a footer or an undated row.
 */
function grandCheck(grand: DeclaredTotal, full: number, half: number, ctx: Ctx): ReconcileCheck {
  const { aug, sim, cols } = ctx;
  const minutes = isMinutesLabel(grand.label);
  let declared = minutes ? grand.value / 60 : grand.value;
  const fromSheetColumn = grand.source === "total-column" || grand.source === "footer-row";
  if (grand.source === "total-column") {
    const totalCol = cols.forField("total_time")[0];
    if (totalCol != null && cols.has(totalCol)) declared = cols.sum(totalCol);
  }
  const context: string[] = [];
  if (minutes) context.push(`Declared as ${fmt(grand.value)} min.`);
  const simExtra = fromSheetColumn ? sim.inColumn : 0;
  if (simExtra > 0) context.push(`Includes ${plural(sim.sessions, "sim session")} (${fmt(simExtra)} h) logged in the Total column.`);

  const primaryBase = aug ? half : full;
  const alts: Alt[] = [];
  const augAlternative = augAlt(full, half, aug, simExtra);
  if (augAlternative) alts.push(augAlternative);
  if (!fromSheetColumn && sim.hours > 0) alts.push(simAlt(primaryBase + sim.hours, sim));

  return compare({
    id: "grand_total", label: `Total time (declared: ${sourceLabel(grand)})`, declared, unit: "h",
    primary: r1(primaryBase + simExtra), alts,
    textCells: cols.textCells(cols.timeCols().map((t) => t.col)),
    context: context.length > 0 ? context.join(" ") : undefined,
    offRows: ctx.offRows, skippedTotals: ctx.skippedTotals, minutesLabel: minutes,
    vars: { source: grand.source, declaredLabel: grand.label, simSessions: sim.sessions, simHours: simExtra },
  });
}

// ---------------------------------------------------------------------------
// Grouping declared figures
// ---------------------------------------------------------------------------

/**
 * One declared figure per (meaning, source[, label facets]). A summable
 * field that a footer row splits over several columns (the founder's sheet
 * has six cross-country columns — Day/Night × FO/PIC/AUG) is a single total:
 * the cells are summed before comparing, since apply sums those columns per
 * row. Totals-sheet lines for the same field but different facets ("X-Country
 * PIC (Day)", "X-Country (Night)") stay separate; any other duplicate keeps
 * its first occurrence.
 */
function groupDeclared(declared: DeclaredTotal[]): Map<string, DeclaredTotal> {
  const groups = new Map<string, { total: DeclaredTotal; labels: string[] }>();
  for (const d of declared) {
    if (!d.meaning || d.meaning.kind === "grand_total") continue;
    if (d.source === "total-column") continue;
    const key = declaredKey(d, d.meaning);
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

function declaredKey(d: DeclaredTotal, m: TotalMeaning): string {
  const base = `${d.composite ? `composite:${d.composite.join("+")}` : meaningKey(m)}|${d.source}`;
  if (d.source === "totals-sheet" && m.kind === "field" && !d.composite) {
    const lf = labelFacets(d.label, m.field);
    if (lf.cat || lf.cond || lf.role) return `${base}|${lf.cat ?? "any"}:${lf.cond ?? "any"}:${lf.role ?? "any"}`;
  }
  return base;
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

// ---------------------------------------------------------------------------
// Label facets
// ---------------------------------------------------------------------------

interface LabelFacets { cat: TimeCategory | null; cond: TimeCondition | null; role: TimeRole | null }

/**
 * Category / condition / role a declared label names, minus whatever the
 * field itself already encodes ("Night Landings" → landings_night carries the
 * night; "Total Sim" → sim_inst carries the simulator).
 */
function labelFacets(label: string, field: FieldTarget): LabelFacets {
  const f = facetsOfPath([label]);
  let cond = f.cond;
  let cat = f.cat;
  if ((field.endsWith("_day") && cond === "day") || (field.endsWith("_night") && cond === "night")) cond = null;
  if (field === "sim_inst" && cat === "sim") cat = null;
  return { cat, cond, role: f.role };
}

const hasFacets = (lf: LabelFacets) => Boolean(lf.cat || lf.cond || lf.role);

// ---------------------------------------------------------------------------
// Column index
// ---------------------------------------------------------------------------

interface TimeCol { col: number; cat: TimeCategory; cond: TimeCondition; role: TimeRole }

class ColumnIndex {
  private readonly paths = new Map<number, string[]>();
  private readonly labels = new Map<number, string>();
  private readonly facetCache = new Map<number, Facets>();
  private readonly byField = new Map<FieldTarget, number[]>();
  private readonly times: TimeCol[] = [];

  constructor(private readonly analysis: Analysis, mapping: ColumnMapping, private readonly sums: Record<number, number>) {
    for (const p of analysis.header.paths) { this.paths.set(p.col, p.path); this.labels.set(p.col, p.label); }
    for (const a of mapping.columns) {
      if (a.target.kind === "field") {
        const list = this.byField.get(a.target.field) ?? [];
        list.push(a.col);
        this.byField.set(a.target.field, list);
      } else if (a.target.kind === "time") {
        this.times.push({ col: a.col, cat: a.target.category, cond: a.target.condition, role: a.target.role });
      }
    }
  }

  forField(f: FieldTarget): number[] { return this.byField.get(f) ?? []; }
  timeCols(): TimeCol[] { return this.times; }
  sum(col: number): number { return this.sums[col] ?? 0; }
  /** True when apply summed this column (it held at least one number on an imported row). */
  has(col: number): boolean { return this.sums[col] != null; }
  labelOf(col: number): string { return this.labels.get(col) || `column ${col + 1}`; }

  facets(col: number): Facets {
    let f = this.facetCache.get(col);
    if (!f) { f = facetsOfPath(this.paths.get(col) ?? []); this.facetCache.set(col, f); }
    return f;
  }

  /** A column matches a label facet set when every facet the label names is on the column's header path. */
  matches(col: number, lf: LabelFacets): boolean {
    const f = this.facets(col);
    if (lf.cat && f.cat !== lf.cat) return false;
    if (lf.cond && f.cond !== lf.cond) return false;
    if (lf.role && f.role !== lf.role) return false;
    return true;
  }

  isSicColumn(col: number): boolean { return this.facets(col).role === "sic"; }

  /** Time columns that can feed a (category, condition, role) bucket. */
  timeColsFor(m: Extract<TotalMeaning, { kind: "time" }>): number[] {
    return this.times
      .filter((t) => (m.category === "any" || t.cat === m.category || t.cat === "any")
        && (m.condition === "any" || t.cond === m.condition || t.cond === "any")
        && (m.role === "any" || t.role === m.role || t.role === "any"))
      .map((t) => t.col);
  }

  /** What the undated rows apply skipped carry in the given columns — a footer SUM still counts them. */
  skipped(columns: number[]): SkippedTotals | undefined {
    const ext = this.analysis as AnalysisExt;
    const sums = ext.undatedColumnSums;
    if (!sums || !ext.undatedRows) return undefined;
    let sum = 0;
    for (const c of columns) sum += sums[c] ?? 0;
    return sum > 0 ? { rows: ext.undatedRows, sum: r1(sum) } : undefined;
  }

  /** Stored-as-text numbers in the given columns (see Analysis.textNumberCells). */
  textCells(columns: number[]): TextCells | null {
    const src = this.analysis.textNumberCells;
    if (!src) return null;
    let count = 0, sum = 0;
    const names: string[] = [];
    for (const c of columns) {
      const t = src[c];
      if (!t) continue;
      count += t.count; sum += t.sum; names.push(this.labelOf(c));
    }
    return count > 0 ? { count, sum: r1(sum), columns: names } : null;
  }
}

// ---------------------------------------------------------------------------
// Declared-total checks
// ---------------------------------------------------------------------------

function timeCheck(id: string, d: DeclaredTotal, m: Extract<TotalMeaning, { kind: "time" }>, flights: ParsedFlight[], ctx: Ctx): ReconcileCheck {
  const { aug, cols, sim } = ctx;
  const minutes = isMinutesLabel(d.label);
  const declared = minutes ? d.value / 60 : d.value;
  const sumWith = (halve: boolean) => r1(flights.reduce((s, f) => {
    if (m.category !== "any" && f.category !== CAT_ENUM[m.category]) return s;
    if (m.role !== "any" && f.role !== ROLE_ENUM[m.role]) return s;
    let h = m.condition === "day" ? f.day_time : m.condition === "night" ? f.night_time : total(f);
    if (f.category === "SIM" && m.category === "sim") h = f.sim_inst;
    if (halve && f.role === "SIC") h = h * 0.5;
    return s + h;
  }, 0));
  const full = sumWith(false), half = sumWith(true);
  const primary = aug ? half : full;
  const alts: Alt[] = [];
  const augAlternative = augAlt(full, half, aug, 0);
  if (augAlternative) alts.push(augAlternative);
  // "Total Dual" on a totals sheet may count the simulator sessions LogbookHQ keeps out of flight time.
  if (m.category === "any" && m.condition === "any" && sim.sessions > 0) {
    const simHours = r1(flights.reduce((s, f) => (f.category === "SIM" && (m.role === "any" || f.role === ROLE_ENUM[m.role]) ? s + f.sim_inst : s), 0));
    if (simHours > 0) alts.push(simAlt(primary + simHours, { ...sim, hours: simHours }));
  }
  return compare({
    id, label: d.label, declared, unit: "h", primary, alts,
    textCells: cols.textCells(cols.timeColsFor(m)),
    skippedTotals: cols.skipped(cols.timeColsFor(m)), skippedWhere: "those columns",
    context: minutes ? `Declared as ${fmt(d.value)} min.` : undefined,
    offRows: ctx.offRows, minutesLabel: minutes,
    vars: { source: d.source, declaredLabel: d.label },
  });
}

function fieldCheck(id: string, d: DeclaredTotal, field: FieldTarget, flights: ParsedFlight[], ctx: Ctx): ReconcileCheck | null {
  const { cols } = ctx;
  if (d.composite && d.composite.length > 1) return compositeCheck(id, d, d.composite, flights, ctx);
  const unit: Unit = COUNT_FIELD_RE.test(field) ? "count" : "h";
  const minutes = unit === "h" && isMinutesLabel(d.label);
  const declared = minutes ? d.value / 60 : d.value;
  const context = minutes ? `Declared as ${fmt(d.value)} min.` : undefined;
  const mapped = cols.forField(field);
  const lf = labelFacets(d.label, field);
  const vars: Vars = { source: d.source, declaredLabel: d.label, field };

  if (mapped.length === 0 || !COLUMN_COMPARED_FIELDS.has(field)) {
    // Flight-based figure (counts, or a field derived without a source column of its own).
    if (hasFacets(lf)) return notCompared(id, d, unit);
    const computed = computeField(flights, field);
    if (computed == null) return null;
    return compare({ id, label: d.label, declared, unit, primary: computed, textCells: cols.textCells(mapped), skippedTotals: cols.skipped(mapped), skippedWhere: "those columns", context, minutesLabel: minutes, vars });
  }

  // Column-wise: the label's facets pick the source columns ("X-Country PIC (Day)" → Cross Country › Day › PIC).
  const matched = hasFacets(lf) ? mapped.filter((c) => cols.matches(c, lf)) : mapped;
  if (matched.length === 0) return notCompared(id, d, unit);
  const fullSum = r1(matched.reduce((s, c) => s + cols.sum(c), 0));
  const halfSum = r1(matched.reduce((s, c) => s + cols.sum(c) * (cols.isSicColumn(c) ? 0.5 : 1), 0));
  const via = matched.length < mapped.length || matched.length > 1 ? `Compared with the sum of ${listColumns(matched.map((c) => cols.labelOf(c)))}.` : undefined;
  const alts: Alt[] = halfSum !== fullSum ? [{
    value: halfSum,
    key: "declared_aug_column",
    explain: (dec, residue) => `Your spreadsheet credits the AUG column${matched.filter((c) => cols.isSicColumn(c)).length === 1 ? "" : "s"} at 50 % in this line — ${fmt(halfSum)} h ${matchesPhrase(residue)} the declared ${fmt(dec)} h. LogbookHQ counts ${FIELD_WORD[field] ?? field} in full.`,
    suggestion: { kind: "none" },
  }] : [];
  const check = compare({
    id, label: d.label, declared, unit, primary: fullSum, alts,
    textCells: cols.textCells(matched), skippedTotals: cols.skipped(matched), skippedWhere: "those columns", note: via, context, minutesLabel: minutes, vars,
  });
  return field === "xc_time" && check.status === "match" ? wholeFlightXc(check, flights, lf, fullSum, via) : check;
}

/**
 * A matching cross-country column vs. LogbookHQ's own cross-country figure:
 * the app credits whole flights (day + night of every flight flagged
 * cross-country, narrowed to the label's facets) while a sheet may log only
 * the cross-country portion of a flight. More than 0.15 h apart → "explained"
 * with the gap, so the user knows why the app's total will read differently.
 */
function wholeFlightXc(check: ReconcileCheck, flights: ParsedFlight[], lf: LabelFacets, columnSum: number, note?: string): ReconcileCheck {
  const flightBased = r1(flights.reduce((s, f) => {
    if (!f.is_xcountry) return s;
    if (lf.cat && lf.cat !== "any" && f.category !== CAT_ENUM[lf.cat]) return s;
    if (lf.role && lf.role !== "any" && f.role !== ROLE_ENUM[lf.role]) return s;
    return s + (lf.cond === "day" ? f.day_time : lf.cond === "night" ? f.night_time : total(f));
  }, 0));
  const gap = r1(flightBased - columnSum);
  if (Math.abs(gap) <= TOL_HOURS) return check;
  const text = `LogbookHQ credits whole flights as cross-country (${gap > 0 ? "+" : "−"}${fmt(Math.abs(gap))} h vs. your sheet's cross-country column).`;
  return {
    ...check, status: "explained", explanation: note ? `${text} ${note}` : text, suggestion: { kind: "none" },
    messageKey: "declared_xc_whole_flight", vars: { ...(check.vars ?? {}), gap },
  };
}

/** "Total Instrument Time" = actual + hood + sim; when that misses but actual + hood hits, the sheet leaves sim out. */
function compositeCheck(id: string, d: DeclaredTotal, fields: FieldTarget[], flights: ParsedFlight[], ctx: Ctx): ReconcileCheck {
  const { cols } = ctx;
  const minutes = isMinutesLabel(d.label);
  const declared = minutes ? d.value / 60 : d.value;
  const sumOf = (fs: FieldTarget[]) => r1(fs.reduce((s, f) => {
    const mapped = cols.forField(f);
    return s + (mapped.length > 0 ? mapped.reduce((a, c) => a + cols.sum(c), 0) : computeField(flights, f) ?? 0);
  }, 0));
  const variants = [fields, fields.filter((f) => f !== "sim_inst")].filter((fs, i, arr) => fs.length > 0 && (i === 0 || fs.length !== arr[0].length));
  let best = variants[0], bestValue = sumOf(best);
  for (const fs of variants.slice(1)) {
    const v = sumOf(fs);
    if (Math.abs(v - declared) < Math.abs(bestValue - declared)) { best = fs; bestValue = v; }
  }
  const parts = best.map((f) => FIELD_SHORT[f] ?? f).join(" + ");
  return compare({
    id, label: `Instrument time (${parts})`, declared, unit: "h", primary: bestValue,
    textCells: cols.textCells(best.flatMap((f) => cols.forField(f))),
    note: `Declared as "${d.label}".`,
    context: minutes ? `Declared as ${fmt(d.value)} min.` : undefined, minutesLabel: minutes,
    vars: { source: d.source, declaredLabel: d.label, parts },
  });
}

function notCompared(id: string, d: DeclaredTotal, unit: Unit): ReconcileCheck {
  return {
    id, label: d.label, actual: d.value, status: "info",
    explanation: `No single column in the file corresponds to this line (declared ${fmtU(d.value, unit)}), so it wasn't compared.`,
    messageKey: "declared_not_compared", vars: { declared: d.value, unit, declaredLabel: d.label },
  };
}

/** Flight-based figure for a field total (counts, and fields with no source column of their own). */
function computeField(flights: ParsedFlight[], field: FieldTarget): number | null {
  const pick = (f: ParsedFlight): number => {
    switch (field) {
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
  return r1(vals.reduce((s, x) => s + x, 0));
}

// ---------------------------------------------------------------------------
// The comparison itself
// ---------------------------------------------------------------------------

/** An alternative computed figure with what to say if that is the one that matches. */
interface Alt {
  value: number;
  /** messageKey when this alternative explains the gap. */
  key: string;
  explain: (declared: number, residue: number) => string;
  suggestion: ReconcileCheck["suggestion"];
}

/** The other AUG convention (SIC halved vs. in full), `extra` added to both sides (sim rows the column carries). */
function augAlt(full: number, half: number, aug: boolean, extra: number): Alt | null {
  if (r1(full) === r1(half)) return null;
  return aug
    ? {
      value: r1(full + extra), key: "declared_aug_full",
      explain: (declared, residue) => FULL_EXPLANATION(full + extra, declared, residue),
      suggestion: { kind: "none", detail: "Turn off the 50 % AUG credit setting to match this sheet." },
    }
    : {
      value: r1(half + extra), key: "declared_aug_half",
      explain: (declared, residue) => AUG_EXPLANATION(half + extra, declared, residue),
      suggestion: { kind: "aug_half_credit", detail: "Enable 50 % AUG/SIC credit" },
    };
}

function simAlt(value: number, sim: SimInfo): Alt {
  const v = r1(value);
  return {
    value: v, key: "declared_sim_included",
    explain: (declared, residue) => `This figure includes ${plural(sim.sessions, "simulator session")} (${fmt(sim.hours)} h) — ${fmt(v)} h ${matchesPhrase(residue)} the declared ${fmt(declared)} h. LogbookHQ keeps simulator time out of total flight time.`,
    suggestion: { kind: "none" },
  };
}

interface Cmp {
  id: string;
  label: string;
  declared: number;
  /** Computed figure under the account's convention. */
  primary: number;
  unit: Unit;
  /** Other computed figures (the other AUG convention, "+ sims"), tried in order. */
  alts?: Alt[];
  /** Stored-as-text numbers in the compared columns. */
  textCells?: TextCells | null;
  /** Appended to any explanation ("Compared with the sum of …"); a plain match carries no explanation. */
  note?: string;
  /** Shown even on a plain match ("Includes 4 sim sessions …", "Declared as 402 min."). */
  context?: string;
  /** Rows whose Total cell disagrees with their buckets — suppresses the AUG / rounding explanations. */
  offRows?: OffRows;
  /** Undated rows apply skipped whose Total cells may account for the gap. */
  skippedTotals?: SkippedTotals;
  /** Where those skipped values sit ("the Total column" by default; "those columns" for per-column checks). */
  skippedWhere?: string;
  /** The label itself said minutes (already divided) — skip the ×60 guess. */
  minutesLabel?: boolean;
  vars?: Vars;
}

/**
 * Tiers: exact (0.15 h / 0.5 count) → skipped undated rows account for the
 * gap → the other convention exact (AUG, + sims) → the gap equals the
 * stored-as-text cells → [rows off against their own Total cell → mismatch
 * naming them] → an unlabeled figure in minutes → small residue → the other
 * convention within a small residue → mismatch.
 */
function compare(c: Cmp): ReconcileCheck {
  const tol = c.unit === "h" ? TOL_HOURS : TOL_COUNT;
  const delta = r1(c.primary - c.declared);
  const vars: Vars = { ...(c.vars ?? {}), declared: r1(c.declared), computed: c.primary, delta, unit: c.unit, label: c.label };
  const base: ReconcileCheck = { id: c.id, label: c.label, expected: c.declared, actual: c.primary, delta, status: "match", vars };
  const withNote = (text: string) => {
    const parts = [text];
    if (c.context) parts.push(c.context);
    if (c.note) parts.push(c.note);
    return parts.join(" ");
  };
  const done = (status: ReconcileCheck["status"], key: string, text: string, suggestion: ReconcileCheck["suggestion"], extra: Vars = {}): ReconcileCheck =>
    ({ ...base, status, explanation: withNote(text), suggestion, messageKey: key, vars: { ...vars, ...extra } });

  if (Math.abs(delta) <= tol) {
    return c.context ? { ...base, messageKey: "declared_match", explanation: c.context } : { ...base, messageKey: "declared_match" };
  }
  const skipped = c.skippedTotals;
  if (skipped && skipped.sum > 0 && Math.abs(delta + skipped.sum) <= tol) {
    return done("explained", "declared_skipped_rows",
      `The ${plural(skipped.rows, "skipped row")} (no date) carry ${fmtU(skipped.sum, c.unit)} in ${c.skippedWhere ?? "the Total column"} — that is the whole difference.`,
      { kind: "none" }, { skippedRows: skipped.rows, skippedSum: skipped.sum });
  }
  const alts = c.alts ?? [];
  const residueOf = (a: Alt) => Math.abs(r1(a.value - c.declared));
  if (!c.offRows) {
    for (const alt of alts) {
      const residue = residueOf(alt);
      if (residue <= tol) return done("explained", alt.key, alt.explain(c.declared, residue), alt.suggestion, { alternative: alt.value });
    }
  }
  if (c.textCells && c.textCells.sum > 0 && Math.abs(delta - c.textCells.sum) <= tol) {
    return done("explained", "declared_text_cells", TEXT_CELLS_EXPLANATION(c.textCells, c.unit), { kind: "none" },
      { textCells: c.textCells.count, textCellsSum: c.textCells.sum, textCellColumns: c.textCells.columns.join(", ") });
  }
  if (c.offRows) {
    const dates = listDates(c.offRows.dates, c.offRows.count);
    const rows = c.offRows.count === 1 ? "1 row differs" : `${c.offRows.count} rows differ`;
    return done("mismatch", "declared_off_rows",
      `Computed ${fmtU(c.primary, c.unit)} vs. declared ${fmtU(c.declared, c.unit)} (difference ${fmtU(delta, c.unit)}). ${rows} from their own Total cell: ${dates} — fix those rows first.`,
      { kind: "review_mapping" }, { offRows: c.offRows.count, offDates: dates });
  }
  if (c.unit === "h" && !c.minutesLabel && Number.isInteger(c.declared) && c.declared >= 60 && Math.abs(r1(c.primary - c.declared / 60)) <= tol) {
    return done("explained", "declared_minutes",
      `The declared figure looks like minutes: ${fmt(c.declared)} min = ${fmt(c.declared / 60)} h, which matches the computed ${fmt(c.primary)} h.`,
      { kind: "none" }, { minutes: c.declared, hours: r1(c.declared / 60) });
  }
  const small = smallGapTol(c.declared);
  if (Math.abs(delta) <= small) {
    return done("explained", "declared_small_gap", SMALL_GAP_EXPLANATION(delta, c.declared, c.unit), { kind: "none" });
  }
  for (const alt of alts) {
    const residue = residueOf(alt);
    if (residue <= small) return done("explained", alt.key, alt.explain(c.declared, residue), alt.suggestion, { alternative: alt.value });
  }
  const closest = alts.length > 0 ? alts.reduce((a, b) => (residueOf(b) < residueOf(a) ? b : a)) : null;
  const closer = closest && residueOf(closest) < Math.abs(delta)
    ? ` ${closest.key === "declared_sim_included" ? "Adding the simulator sessions" : "The other AUG convention"} gets closer (${fmtU(closest.value, c.unit)}) but does not match either.`
    : "";
  return done("mismatch", "declared_mismatch",
    `Computed ${fmtU(c.primary, c.unit)} vs. declared ${fmtU(c.declared, c.unit)} (difference ${fmtU(delta, c.unit)}).${closer} A column may be mapped to the wrong bucket, or the sheet's total includes rows that were skipped.`,
    { kind: "review_mapping" }, closest ? { alternative: closest.value } : {});
}
