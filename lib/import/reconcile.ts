/**
 * Computed totals vs. whatever the workbook itself declares, plus sanity
 * invariants. Every check is plain data for the wizard's step 3.
 *
 * Three things are actively looked for before a gap is called a mismatch:
 *   - the 50 % AUG convention: many spreadsheets (the founder's included)
 *     credit augmenting / cruise-relief (AUG → SIC) time at 50 % in their
 *     totals. When the plain sum misses the declared total but the
 *     SIC-halved sum hits it, the check is "explained" and carries the
 *     aug_half_credit suggestion (and the mirror image when the account
 *     halves but the sheet does not);
 *   - numbers stored as text: a spreadsheet SUM skips them, the import reads
 *     them, so a declared total falls short by exactly their sum;
 *   - small residues (≤ 1 h, or 0.1 % of the declared figure): the sheet's
 *     own formula range or rounding — "explained", never a mapping problem.
 *
 * Declared totals that name a role / condition ("Total X-Country PIC (Day)")
 * for a field spread over several columns are compared against the sum of
 * the source columns whose header facets match; a facet with no matching
 * column is reported as "info" rather than compared against the wrong thing.
 */
import type { Flight } from "../types";
import type { ParsedFlight } from "../csv";
import { computeTotals } from "../derive";
import type {
  Analysis, ApplyResult, ColumnMapping, DeclaredTotal, FieldTarget, ReconcileCheck, ReconcileReport,
  TimeCategory, TimeCondition, TimeRole, TotalMeaning,
} from "./types";
import type { ApplyResultExt } from "./types-ext";
import { SUMMABLE_FIELDS } from "./targets";
import { facetsOfPath, type Facets } from "./synonyms";
import { r1, todayISO } from "./util";

const TOL_HOURS = 0.15;
const TOL_COUNT = 0.5;
/** Beyond the exact tolerance, a gap up to max(1, 0.1 %) is the sheet's own formula/rounding, not a mapping problem. */
const smallGapTol = (declared: number) => Math.max(1.0, Math.abs(declared) * 0.001);

type Unit = "h" | "count";
const COUNT_FIELD_RE = /approaches|holds|landings|takeoffs/;
/** Hour fields whose declared totals are compared column-wise (a SUM over the source column(s)); counts stay flight-based. */
const COLUMN_COMPARED_FIELDS: ReadonlySet<FieldTarget> = new Set<FieldTarget>(["xc_time", "actual_inst", "hood_inst", "sim_inst", "cfi_time"]);
const FIELD_WORD: Partial<Record<FieldTarget, string>> = {
  xc_time: "cross-country time", actual_inst: "actual instrument time", hood_inst: "hood time", sim_inst: "simulator time", cfi_time: "instruction given",
};
const FIELD_SHORT: Partial<Record<FieldTarget, string>> = { actual_inst: "actual", hood_inst: "hood", sim_inst: "sim" };

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
  const checks: ReconcileCheck[] = [];
  const cols = new ColumnIndex(analysis, mapping, result.columnSums);

  // ---- 1. grand total --------------------------------------------------------
  const full = r1(flights.reduce((s, f) => s + credited(f, false), 0));
  const half = r1(flights.reduce((s, f) => s + credited(f, true), 0));
  const grand = pickGrandTotal(analysis.declaredTotals);
  if (grand) {
    checks.push(compare({
      id: "grand_total", label: `Total time (declared: ${sourceLabel(grand)})`, declared: grand.value, unit: "h",
      ...augPair(full, half, aug),
      textCells: cols.textCells(cols.timeCols().map((t) => t.col)),
    }));
  } else {
    checks.push({
      id: "grand_total", label: "Total time", actual: aug ? half : full, status: "info",
      explanation: "The file does not declare a grand total to compare against.",
    });
  }

  // ---- 2. per-category / per-role / per-field declared totals ---------------------
  for (const [key, d] of groupDeclared(analysis.declaredTotals)) {
    if (!d.meaning || d.meaning.kind === "grand_total") continue;
    const check = d.meaning.kind === "field"
      ? fieldCheck(`declared:${key}`, d, d.meaning.field, flights, cols)
      : timeCheck(`declared:${key}`, d, d.meaning, flights, aug, cols);
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
  });

  const rowTotals = ext.rowTotals;
  if (rowTotals && rowTotals.some((t) => t != null)) {
    let compared = 0, off = 0, halved = 0;
    flights.forEach((f, i) => {
      const t = rowTotals[i];
      if (t == null || f.category === "SIM") return;
      compared++;
      const fullT = total(f);
      if (Math.abs(t - fullT) <= 0.1) return;
      if (f.role === "SIC" && Math.abs(t - fullT * 0.5) <= 0.1) { halved++; return; }
      off++;
    });
    const pct = compared ? off / compared : 0;
    const halvedNote = halved > 0
      ? `${plural(halved, "AUG row")} carry a Total cell at 50 % of their logged time — the sheet credits augmenting time at 50 % in its row totals.`
      : "";
    checks.push({
      id: "row_totals", label: "Row totals vs. time buckets", actual: off,
      status: off === 0 ? "match" : pct > 0.02 ? "mismatch" : "info",
      explanation: off > 0
        ? `${off} of ${compared} rows have a Total cell that differs from the sum of their time buckets by more than 0.1 h.${halvedNote ? ` ${halvedNote}` : ""}`
        : halvedNote || `Every row's Total cell equals the sum of its time buckets (within 0.1 h).`,
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
      checks.push({ id: "date_order", label: "Dates in order", actual: desc, status: "info", explanation: `${plural(desc, "row")} are dated earlier than the row above them. Usually fine (back-filled entries) — worth a glance if the count is large.` });
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
  });

  const nightCols = cols.timeCols().filter((t) => t.cond === "night").map((t) => t.col);
  const totalCol = cols.forField("total_time")[0];
  if (totalCol != null && nightCols.length > 0) {
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
    });
  }

  const byReason = new Map<string, number>();
  for (const s of result.skipped) byReason.set(s.reason, (byReason.get(s.reason) ?? 0) + 1);
  for (const [reason, count] of byReason) {
    checks.push({ id: `skipped:${reason}`, label: `Rows skipped — ${SKIP_LABEL[reason] ?? reason}`, actual: count, status: "info" });
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
// Grand-total selection
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
 * grand-total line. Composite figures ("Total Instrument Time") never qualify.
 */
function pickGrandTotal(declared: DeclaredTotal[]): DeclaredTotal | null {
  const grand = declared.filter((d) => d.meaning?.kind === "grand_total" && !d.composite);
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

function timeCheck(id: string, d: DeclaredTotal, m: Extract<TotalMeaning, { kind: "time" }>, flights: ParsedFlight[], aug: boolean, cols: ColumnIndex): ReconcileCheck {
  const sumWith = (halve: boolean) => r1(flights.reduce((s, f) => {
    if (m.category !== "any" && f.category !== CAT_ENUM[m.category]) return s;
    if (m.role !== "any" && f.role !== ROLE_ENUM[m.role]) return s;
    let h = m.condition === "day" ? f.day_time : m.condition === "night" ? f.night_time : total(f);
    if (f.category === "SIM" && m.category === "sim") h = f.sim_inst;
    if (halve && f.role === "SIC") h = h * 0.5;
    return s + h;
  }, 0));
  const full = sumWith(false), half = sumWith(true);
  return compare({
    id, label: d.label, declared: d.value, unit: "h",
    ...augPair(full, half, aug),
    textCells: cols.textCells(cols.timeColsFor(m)),
  });
}

function fieldCheck(id: string, d: DeclaredTotal, field: FieldTarget, flights: ParsedFlight[], cols: ColumnIndex): ReconcileCheck | null {
  if (d.composite && d.composite.length > 1) return compositeCheck(id, d, d.composite, flights, cols);
  const unit: Unit = COUNT_FIELD_RE.test(field) ? "count" : "h";
  const mapped = cols.forField(field);
  const lf = labelFacets(d.label, field);

  if (mapped.length === 0 || !COLUMN_COMPARED_FIELDS.has(field)) {
    // Flight-based figure (counts, or a field derived without a source column of its own).
    if (hasFacets(lf)) return notCompared(id, d, unit);
    const computed = computeField(flights, field);
    if (computed == null) return null;
    return compare({ id, label: d.label, declared: d.value, unit, primary: computed, textCells: cols.textCells(mapped) });
  }

  // Column-wise: the label's facets pick the source columns ("X-Country PIC (Day)" → Cross Country › Day › PIC).
  const matched = hasFacets(lf) ? mapped.filter((c) => cols.matches(c, lf)) : mapped;
  if (matched.length === 0) return notCompared(id, d, unit);
  const fullSum = r1(matched.reduce((s, c) => s + cols.sum(c), 0));
  const halfSum = r1(matched.reduce((s, c) => s + cols.sum(c) * (cols.isSicColumn(c) ? 0.5 : 1), 0));
  const via = matched.length < mapped.length || matched.length > 1 ? `Compared with the sum of ${listColumns(matched.map((c) => cols.labelOf(c)))}.` : undefined;
  return compare({
    id, label: d.label, declared: d.value, unit, primary: fullSum,
    alt: halfSum !== fullSum ? {
      value: halfSum,
      explain: (declared, residue) => `Your spreadsheet credits the AUG column${matched.filter((c) => cols.isSicColumn(c)).length === 1 ? "" : "s"} at 50 % in this line — ${fmt(halfSum)} h ${matchesPhrase(residue)} the declared ${fmt(declared)} h. LogbookHQ counts ${FIELD_WORD[field] ?? field} in full.`,
      suggestion: { kind: "none" },
    } : undefined,
    textCells: cols.textCells(matched),
    note: via,
  });
}

/** "Total Instrument Time" = actual + hood + sim; when that misses but actual + hood hits, the sheet leaves sim out. */
function compositeCheck(id: string, d: DeclaredTotal, fields: FieldTarget[], flights: ParsedFlight[], cols: ColumnIndex): ReconcileCheck {
  const sumOf = (fs: FieldTarget[]) => r1(fs.reduce((s, f) => {
    const mapped = cols.forField(f);
    return s + (mapped.length > 0 ? mapped.reduce((a, c) => a + cols.sum(c), 0) : computeField(flights, f) ?? 0);
  }, 0));
  const variants = [fields, fields.filter((f) => f !== "sim_inst")].filter((fs, i, arr) => fs.length > 0 && (i === 0 || fs.length !== arr[0].length));
  let best = variants[0], bestValue = sumOf(best);
  for (const fs of variants.slice(1)) {
    const v = sumOf(fs);
    if (Math.abs(v - d.value) < Math.abs(bestValue - d.value)) { best = fs; bestValue = v; }
  }
  const parts = best.map((f) => FIELD_SHORT[f] ?? f).join(" + ");
  return compare({
    id, label: `Instrument time (${parts})`, declared: d.value, unit: "h", primary: bestValue,
    textCells: cols.textCells(best.flatMap((f) => cols.forField(f))),
    note: `Declared as "${d.label}".`,
  });
}

function notCompared(id: string, d: DeclaredTotal, unit: Unit): ReconcileCheck {
  return {
    id, label: d.label, actual: d.value, status: "info",
    explanation: `No single column in the file corresponds to this line (declared ${fmtU(d.value, unit)}), so it wasn't compared.`,
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

interface Alt {
  value: number;
  explain: (declared: number, residue: number) => string;
  suggestion: ReconcileCheck["suggestion"];
}

interface Cmp {
  id: string;
  label: string;
  declared: number;
  /** Computed figure under the account's convention. */
  primary: number;
  unit: Unit;
  /** The figure under the other AUG convention, with what to say if that is the one that matches. */
  alt?: Alt;
  /** Stored-as-text numbers in the compared columns. */
  textCells?: TextCells | null;
  /** Appended to any explanation ("Compared with the sum of …"). */
  note?: string;
}

/** Full-credit vs. SIC-halved figures → primary per the account setting, the other as the AUG explanation. */
function augPair(full: number, half: number, aug: boolean): { primary: number; alt?: Alt } {
  const primary = aug ? half : full;
  const other = aug ? full : half;
  if (other === primary) return { primary };
  return {
    primary,
    alt: {
      value: other,
      explain: (declared, residue) => (aug ? FULL_EXPLANATION(full, declared, residue) : AUG_EXPLANATION(half, declared, residue)),
      suggestion: aug
        ? { kind: "none", detail: "Turn off the 50 % AUG credit setting to match this sheet." }
        : { kind: "aug_half_credit", detail: "Enable 50 % AUG/SIC credit" },
    },
  };
}

/**
 * Tiers: exact (0.15 h / 0.5 count) → the other AUG convention exact → the
 * gap equals the stored-as-text cells → small residue (≤ max(1, 0.1 %)) →
 * the other AUG convention within a small residue → mismatch.
 */
function compare(c: Cmp): ReconcileCheck {
  const tol = c.unit === "h" ? TOL_HOURS : TOL_COUNT;
  const delta = r1(c.primary - c.declared);
  const base: ReconcileCheck = { id: c.id, label: c.label, expected: c.declared, actual: c.primary, delta, status: "match" };
  const withNote = (text: string) => (c.note ? `${text} ${c.note}` : text);
  const altResidue = c.alt ? Math.abs(r1(c.alt.value - c.declared)) : Infinity;

  if (Math.abs(delta) <= tol) return base;
  if (c.alt && altResidue <= tol) {
    return { ...base, status: "explained", explanation: withNote(c.alt.explain(c.declared, altResidue)), suggestion: c.alt.suggestion };
  }
  if (c.textCells && c.textCells.sum > 0 && Math.abs(delta - c.textCells.sum) <= tol) {
    return { ...base, status: "explained", explanation: withNote(TEXT_CELLS_EXPLANATION(c.textCells, c.unit)), suggestion: { kind: "none" } };
  }
  const small = smallGapTol(c.declared);
  if (Math.abs(delta) <= small) {
    return { ...base, status: "explained", explanation: withNote(SMALL_GAP_EXPLANATION(delta, c.declared, c.unit)), suggestion: { kind: "none" } };
  }
  if (c.alt && altResidue <= small) {
    return { ...base, status: "explained", explanation: withNote(c.alt.explain(c.declared, altResidue)), suggestion: c.alt.suggestion };
  }
  const closer = c.alt && altResidue < Math.abs(delta)
    ? ` The other AUG convention gets closer (${fmtU(c.alt.value, c.unit)}) but does not match either.`
    : "";
  return {
    ...base, status: "mismatch",
    explanation: withNote(`Computed ${fmtU(c.primary, c.unit)} vs. declared ${fmtU(c.declared, c.unit)} (difference ${fmtU(delta, c.unit)}).${closer} A column may be mapped to the wrong bucket, or the sheet's total includes rows that were skipped.`),
    suggestion: { kind: "review_mapping" },
  };
}
