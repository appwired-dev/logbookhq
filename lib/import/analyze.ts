/**
 * analyzeWorkbook — everything the wizard needs to render the mapping step.
 * Synchronous and pure: bytes in, Analysis out.
 *
 * Beyond the header band and the column mapping this settles three things
 * the later steps lean on:
 *   - the day/month order of an ambiguous numeric date column (every value
 *     valid both ways): row order first, then locale priors — a non-English
 *     date header, registration prefixes, ICAO airport regions — then the
 *     separator default. `mapping.conventions.dayFirstSource` records which
 *     one decided so reconcile can tell the user to flip it;
 *   - sibling sheets: other sheets whose header fingerprint equals the flight
 *     sheet's (per-year workbooks) go to `siblingSheets` so apply imports
 *     them too; dated sheets in a different layout go to `otherDatedSheets`
 *     for an info check. Sibling footers are merged, their Total column is
 *     summed, and neither kind is scanned for (label, number) totals;
 *   - declared totals: footer rows, the sum of a mapped Total column over the
 *     rows apply keeps (date-bearing, not total rows — never an unlabeled
 *     SUM footer), and (label, number) pairs on the remaining sheets. Labels
 *     that count things ("Total flights", "Number of aircraft") are never
 *     totals.
 */
import { detectFormat } from "../import-formats";
import type {
  Analysis, CanonicalTarget, Cell, DeclaredTotal, FieldTarget, Grid, HeaderBand, ColumnMapping, ImportTemplate, TotalMeaning, Workbook,
} from "./types";
import { cellDisplay, decodeText, gridToText, readWorkbook, rowIsEmpty } from "./grid";
import { detectHeaderBand, looksLikeDataRow } from "./headers";
import { CONFIDENCE_THRESHOLD, mapColumns } from "./mapping";
import { SYSTEM_TEMPLATES, fingerprint, pathKey } from "./templates";
import { facetsOf, facetsOfPath } from "./synonyms";
import { SUMMABLE_FIELDS } from "./targets";
import { TOTAL_ROW_RE, collapse, looksLikeExcelSerial, parseDateText, r1, type DateReading } from "./util";

const SAMPLE_ROWS = 8;
const FOOTER_ROWS = 5;
/** Rows inspected for the day-first priors (registrations, airports). */
const PRIOR_ROWS = 400;
/** Ignored columns at or below this confidence with data in them are "unrecognised" — the arbiter / review list should see them. */
const IGNORED_UNRECOGNISED = 0.3;
const LEGACY_FORMATS = new Set(["foreflight", "logten", "myflightbook", "logbookhq"]);

/**
 * Extra, optional fields analyzeWorkbook puts on the Analysis it returns
 * (plain data, JSON-safe). Declared here rather than in ./types (owned by
 * the wizard team) the way ./types-ext extends ApplyResult.
 */
export interface AnalysisExt extends Analysis {
  /**
   * Total-column cells (hours) of data rows that carry no readable date,
   * keyed by 0-based row: apply skips those rows (no_date / bad_date), the
   * sheet's own SUM does not — reconcile uses this to explain such a gap.
   */
  undatedRowTotals?: Record<number, number>;
  /** Per column: what the undated (skipped) rows carry — a footer SUM counts them, apply does not. */
  undatedColumnSums?: Record<number, number>;
  /** How many undated rows carried at least one number. */
  undatedRows?: number;
  /** English reason when `conventions.dayFirstSource` is "prior" (which prior decided). */
  dayFirstReason?: string;
  /** First ambiguous date text of the date column ("05/03/2024"), for the wizard's day-first note. */
  dayFirstExample?: string;
}

export function analyzeWorkbook(
  bytes: Uint8Array | ArrayBuffer,
  filename: string,
  opts: { templates?: ImportTemplate[] } = {},
): Analysis {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const workbook = readWorkbook(u8, filename);
  const sheetIndex = pickFlightSheet(workbook);
  const grid: Grid = workbook.sheets[sheetIndex] ?? { sheet: "csv", rows: [], width: 0 };
  const header = detectHeaderBand(grid);
  const fp = fingerprint(header.paths.map((p) => p.path));

  const pool = [...(opts.templates ?? []), ...SYSTEM_TEMPLATES];
  const template = pool.find((t) => t.fingerprint === fp) ?? null;
  const mapping = mapColumns(header, grid, header.dataStart, { template });
  const dateCol = fieldCols(mapping, "date")[0];
  const totalCol = fieldCols(mapping, "total_time")[0];

  const dayFirst = dateCol != null ? settleDayFirst(grid, header, mapping, dateCol) : null;
  const sheets = scanOtherSheets(workbook, sheetIndex, header, fp);

  // Numeric columns: tally numbers the sheet stores as text (see Analysis.textNumberCells).
  const numericCols = mapping.columns.filter((c) => isNumericTarget(c.target)).map((c) => c.col);
  const tally = new Map<number, { plain: number; text: number; sum: number }>();
  /** Per column: non-empty cells in data rows (total rows excluded). */
  const filled = new Map<number, number>();
  const undatedRowTotals: Record<number, number> = {};
  const undatedColumnSums: Record<number, number> = {};
  let undatedRows = 0;

  const sample: string[][] = [];
  let rowCount = 0;
  for (let r = header.dataStart; r < grid.rows.length; r++) {
    const row = grid.rows[r];
    if (rowIsEmpty(row)) continue;
    rowCount++;
    if (sample.length < SAMPLE_ROWS) sample.push(header.paths.map((p) => cellDisplay(row[p.col])));
    const totalRow = isTotalRow(row);
    if (!totalRow) {
      for (let c = 0; c < row.length; c++) if (row[c].kind !== "empty") filled.set(c, (filled.get(c) ?? 0) + 1);
      if (dateCol != null && !isDateBearing(row[dateCol])) {
        if (totalCol != null) {
          const cell = row[totalCol];
          if (cell?.kind === "number" && cell.value > 0) undatedRowTotals[r] = cell.value;
        }
        let any = false;
        for (let c = 0; c < row.length; c++) {
          const cell = row[c];
          if (c === dateCol || cell?.kind !== "number" || !(cell.value > 0)) continue;
          undatedColumnSums[c] = r1((undatedColumnSums[c] ?? 0) + cell.value);
          any = true;
        }
        if (any) undatedRows++;
      }
    }
    for (const c of numericCols) {
      const cell = row[c];
      if (!cell || cell.kind !== "number") continue;
      const t = tally.get(c) ?? { plain: 0, text: 0, sum: 0 };
      if (cell.raw != null) { t.text++; t.sum += cell.value; } else t.plain++;
      tally.set(c, t);
    }
  }
  const textNumberCells: NonNullable<Analysis["textNumberCells"]> = {};
  for (const [c, t] of tally) if (t.text > 0 && t.plain > 0) textNumberCells[c] = { count: t.text, sum: r1(t.sum) };

  // Below-threshold mappings plus ignored-because-unrecognised columns that do hold data.
  const lowConfidenceCols = mapping.columns
    .filter((c) => (c.target.kind !== "ignore" && c.confidence < CONFIDENCE_THRESHOLD)
      || (c.target.kind === "ignore" && c.confidence <= IGNORED_UNRECOGNISED && c.source !== "template" && c.source !== "user" && (filled.get(c.col) ?? 0) > 0))
    .map((c) => c.col);

  const isText = workbook.sheets.length === 1 && grid.sheet === "csv";
  const legacy = detectFormat(isText ? decodeText(u8).slice(0, 8000) : gridToText(grid));
  const legacyFormat = LEGACY_FORMATS.has(legacy) ? legacy : null;

  const siblingRows = sheets.siblings.reduce((s, x) => s + x.rowCount, 0);
  const out: AnalysisExt = {
    filename,
    sheetIndex,
    sheetName: grid.sheet,
    header,
    mapping,
    sample,
    rowCount: rowCount + siblingRows,
    fingerprint: fp,
    templateId: template?.id ?? null,
    templateName: template?.name ?? null,
    declaredTotals: collectDeclaredTotals(workbook, sheetIndex, header, mapping, sheets),
    lowConfidenceCols,
    legacyFormat,
    ...(Object.keys(textNumberCells).length > 0 ? { textNumberCells } : {}),
    ...(sheets.siblings.length > 0 ? { siblingSheets: sheets.siblings } : {}),
    ...(sheets.others.length > 0 ? { otherDatedSheets: sheets.others } : {}),
    ...(Object.keys(undatedRowTotals).length > 0 ? { undatedRowTotals } : {}),
    ...(undatedRows > 0 ? { undatedColumnSums, undatedRows } : {}),
    ...(dayFirst?.reason ? { dayFirstReason: dayFirst.reason } : {}),
    ...(dayFirst?.example ? { dayFirstExample: dayFirst.example } : {}),
  };
  return out;
}

/** The sheet with the most flight-looking rows (ties → first). */
export function pickFlightSheet(workbook: Workbook): number {
  let best = 0, bestScore = -1;
  workbook.sheets.forEach((g, i) => {
    const score = datedRowCount(g);
    if (score > bestScore) { bestScore = score; best = i; }
  });
  return best;
}

function datedRowCount(g: Grid): number {
  let n = 0;
  for (const row of g.rows) if (looksLikeDataRow(row)) n++;
  return n;
}

function isNumericTarget(t: CanonicalTarget): boolean {
  if (t.kind === "time") return true;
  return t.kind === "field" && (t.field === "total_time" || SUMMABLE_FIELDS.has(t.field));
}

function fieldCols(mapping: ColumnMapping, f: FieldTarget): number[] {
  return mapping.columns.filter((c) => c.target.kind === "field" && c.target.field === f).map((c) => c.col);
}

/** Same test apply.ts and the total-column sum use for a totals / subtotal / carried-forward row. */
function isTotalRow(row: Cell[]): boolean {
  return row.slice(0, 6).some((c) => c.kind === "text" && TOTAL_ROW_RE.test(c.value));
}

/** A cell apply's date reader accepts: a typed date, an Excel serial, or text that parses as a date. */
export function isDateBearing(cell: Cell | undefined): boolean {
  if (!cell) return false;
  if (cell.kind === "date") return true;
  if (cell.kind === "number") return Number.isInteger(cell.value) && looksLikeExcelSerial(cell.value);
  if (cell.kind === "text") return parseDateText(cell.value) != null;
  return false;
}

// ---------------------------------------------------------------------------
// Day-first: evidence → priors → default
// ---------------------------------------------------------------------------

/** "d/m/y", "dd/mm/yyyy", "dd.mm.yy" spelled out in the header. */
const FMT_DAY_FIRST_RE = /\bd{1,2}\s*[/.\-]\s*m{1,2}(?:\s*[/.\-]\s*y{1,4})?\b/i;
/** "m/d/y", "mm/dd/yyyy". */
const FMT_MONTH_FIRST_RE = /\bm{1,2}\s*[/.\-]\s*d{1,2}(?:\s*[/.\-]\s*y{1,4})?\b/i;
/** Non-English date headers (a sheet in those languages writes day first). */
const NON_ENGLISH_DATE_RE = /(?:^|[^a-záéíóúñ])(?:fecha|datum|data|date\s+d[eu]|日期|日付|날짜|일자)(?:$|[^a-záéíóúñ])/i;
/** Registration prefixes of day-first countries (hyphenated), plus Japan / Korea / Australia-style unhyphenated forms. */
const DAY_FIRST_REG_RE = /^(?:G|F|D|EC|HB|OE|I|PH|OO|LX|SE|LN|OY|VH|ZK|ZS|C|JA|HL|B|9V|VT)-[A-Z0-9]{2,5}$|^(?:JA|HL)\d{3,4}[A-Z]?$|^(?:VH|ZK|ZS|9V|VT)[A-Z]{3}$/;
/** US N-numbers. */
const MONTH_FIRST_REG_RE = /^N\d{1,5}[A-Z]{0,2}$/;
/** ICAO regions: Europe, Australia, Africa, Middle East, Asia → day-first; USA + Canada + Pacific US → month-first. */
const DAY_FIRST_ICAO_RE = /^[ELYFHOVWZR][A-Z]{3}$/;
const MONTH_FIRST_ICAO_RE = /^[KCP][A-Z]{3}$/;

interface DayFirstDecision { reason?: string; example?: string }
interface PriorVote { score: number; reasons: string[] }
type NumericReading = NonNullable<DateReading["numeric"]>;

/**
 * Decide `conventions.dayFirstDates` for the mapped date column and record
 * how (`dayFirstSource`). Only numeric two-part dates ("05/03/2024") can be
 * ambiguous; ISO, month-name and Excel dates leave the convention alone.
 */
function settleDayFirst(grid: Grid, header: HeaderBand, mapping: ColumnMapping, dateCol: number): DayFirstDecision | null {
  const conv = mapping.conventions;
  const readings: DateReading[] = [];
  let example: string | undefined;
  for (let r = header.dataStart; r < grid.rows.length; r++) {
    const cell = grid.rows[r]?.[dateCol];
    if (!cell || cell.kind !== "date" || !cell.raw) continue;
    const reading = parseDateText(cell.raw);
    if (!reading) continue;
    readings.push(reading);
    if (reading.numeric && !example) example = cell.raw;
  }
  const numeric = readings.map((x) => x.numeric).filter((n): n is NumericReading => n != null);
  if (numeric.length === 0) return null;

  const info = grid.dateCols?.[dateCol];
  const ambiguous = info ? info.ambiguous : numeric.every((n) => n.dayFirstIso && n.monthFirstIso);
  if (!ambiguous) {
    if (conv.dayFirstDates == null) {
      const dfValid = numeric.every((n) => n.dayFirstIso), mfValid = numeric.every((n) => n.monthFirstIso);
      if (dfValid !== mfValid) conv.dayFirstDates = dfValid;
      else if (info) conv.dayFirstDates = info.dayFirst;
    }
    if (conv.dayFirstDates != null) conv.dayFirstSource = "evidence";
    return { example };
  }

  const byOrder = orderingEvidence(readings);
  if (byOrder != null) {
    conv.dayFirstDates = byOrder;
    conv.dayFirstSource = "evidence";
    return { example };
  }
  const vote = dayFirstPriors(grid, header, mapping, dateCol);
  if (vote.score !== 0) {
    conv.dayFirstDates = vote.score > 0;
    conv.dayFirstSource = "prior";
    return { reason: vote.reasons.join(", "), example };
  }
  conv.dayFirstDates = numeric[0].defaultDayFirst;
  conv.dayFirstSource = "default";
  return { example };
}

/**
 * Which reading keeps the column closer to chronological order (ascending
 * or descending)? null when both readings are equally ordered.
 */
function orderingEvidence(readings: DateReading[]): boolean | null {
  const seq = (dayFirst: boolean) => readings.map((r) => (r.numeric ? (dayFirst ? r.numeric.dayFirstIso : r.numeric.monthFirstIso) ?? r.iso : r.iso));
  const inversions = (s: string[]) => {
    let n = 0;
    for (let i = 1; i < s.length; i++) if (s[i] < s[i - 1]) n++;
    return n;
  };
  const score = (dayFirst: boolean) => {
    const s = seq(dayFirst);
    return Math.min(inversions(s), inversions([...s].reverse()));
  };
  const day = score(true), month = score(false);
  if (day === month) return null;
  return day < month;
}

/** Locale priors, strongest first: an explicit format in the header (±4), a non-English date header (+3), registrations (±2), airports (±1). */
function dayFirstPriors(grid: Grid, header: HeaderBand, mapping: ColumnMapping, dateCol: number): PriorVote {
  const vote: PriorVote = { score: 0, reasons: [] };
  const label = header.paths.find((p) => p.col === dateCol)?.label ?? "";
  const low = label.toLowerCase();
  if (FMT_DAY_FIRST_RE.test(low)) { vote.score += 4; vote.reasons.push(`the "${label}" header spells out day/month order`); }
  else if (FMT_MONTH_FIRST_RE.test(low)) { vote.score -= 4; vote.reasons.push(`the "${label}" header spells out month/day order`); }
  else if (NON_ENGLISH_DATE_RE.test(low)) { vote.score += 3; vote.reasons.push(`the date header "${label}" is not English`); }

  const end = Math.min(grid.rows.length, header.dataStart + PRIOR_ROWS);
  const regCols = fieldCols(mapping, "registration");
  if (regCols.length > 0) {
    let day = 0, month = 0, n = 0;
    let dayEx = "", monthEx = "";
    for (let r = header.dataStart; r < end; r++) {
      const row = grid.rows[r];
      if (!row || isTotalRow(row)) continue;
      for (const c of regCols) {
        const cell = row[c];
        if (!cell || cell.kind !== "text") continue;
        const reg = cell.value.trim().toUpperCase();
        if (!reg) continue;
        n++;
        if (DAY_FIRST_REG_RE.test(reg)) { day++; dayEx ||= reg; }
        else if (MONTH_FIRST_REG_RE.test(reg)) { month++; monthEx ||= reg; }
      }
    }
    if (day > month && day * 2 >= n) { vote.score += 2; vote.reasons.push(`registrations like ${dayEx}`); }
    else if (month > day && month * 2 >= n) { vote.score -= 2; vote.reasons.push(`US registrations like ${monthEx}`); }
  }

  const apCols = [...fieldCols(mapping, "from"), ...fieldCols(mapping, "to"), ...fieldCols(mapping, "route")];
  if (apCols.length > 0) {
    let day = 0, month = 0;
    let dayEx = "", monthEx = "";
    for (let r = header.dataStart; r < end; r++) {
      const row = grid.rows[r];
      if (!row || isTotalRow(row)) continue;
      for (const c of apCols) {
        const cell = row[c];
        if (!cell || cell.kind !== "text") continue;
        for (const tok of cell.value.split(/[^A-Za-z0-9]+/)) {
          if (!/^[A-Z]{4}$/.test(tok)) continue;
          if (DAY_FIRST_ICAO_RE.test(tok)) { day++; dayEx ||= tok; }
          else if (MONTH_FIRST_ICAO_RE.test(tok)) { month++; monthEx ||= tok; }
        }
      }
    }
    if (day > month) { vote.score += 1; vote.reasons.push(`airports like ${dayEx}`); }
    else if (month > day) { vote.score -= 1; vote.reasons.push(`airports like ${monthEx}`); }
  }
  return vote;
}

// ---------------------------------------------------------------------------
// Other sheets: siblings (same layout) and dated sheets in another layout
// ---------------------------------------------------------------------------

type SiblingSheet = NonNullable<Analysis["siblingSheets"]>[number];
type OtherDatedSheet = NonNullable<Analysis["otherDatedSheets"]>[number];

interface SheetScan {
  siblings: SiblingSheet[];
  others: OtherDatedSheet[];
  /** Header band of every sibling, by sheet index (for column matching by header path). */
  bands: Map<number, HeaderBand>;
}

function scanOtherSheets(workbook: Workbook, sheetIndex: number, header: HeaderBand, fp: string): SheetScan {
  const scan: SheetScan = { siblings: [], others: [], bands: new Map() };
  const hasHeader = header.paths.some((p) => p.path.length > 0);
  workbook.sheets.forEach((g, i) => {
    if (i === sheetIndex) return;
    const dated = datedRowCount(g);
    if (dated === 0) return;
    const band = detectHeaderBand(g);
    if (hasHeader && fingerprint(band.paths.map((p) => p.path)) === fp) {
      let rowCount = 0;
      for (let r = band.dataStart; r < g.rows.length; r++) if (!rowIsEmpty(g.rows[r])) rowCount++;
      scan.siblings.push({ index: i, name: g.sheet, dataStart: band.dataStart, rowCount });
      scan.bands.set(i, band);
    } else if (dated >= 2) {
      scan.others.push({ index: i, name: g.sheet, rowCount: dated });
    }
  });
  return scan;
}

/** The sibling's column for `col` of the main sheet, matched by header path (k-th occurrence for repeated paths). */
function siblingColumn(main: HeaderBand, sib: HeaderBand, col: number): number | undefined {
  const path = main.paths.find((p) => p.col === col)?.path;
  if (!path) return undefined;
  const key = pathKey(path);
  if (!key) return undefined;
  const ordinal = main.paths.filter((p) => p.col < col && pathKey(p.path) === key).length;
  return sib.paths.filter((p) => pathKey(p.path) === key)[ordinal]?.col;
}

// ---------------------------------------------------------------------------
// Declared totals
// ---------------------------------------------------------------------------

function meaningOfColumn(mapping: ColumnMapping, col: number): TotalMeaning | undefined {
  const a = mapping.columns.find((c) => c.col === col);
  if (!a) return undefined;
  if (a.target.kind === "time") return { kind: "time", category: a.target.category, condition: a.target.condition, role: a.target.role };
  if (a.target.kind === "field") {
    if (a.target.field === "total_time") return { kind: "grand_total" };
    if (["xc_time", "actual_inst", "hood_inst", "sim_inst", "ifr_approaches", "precision_approaches", "non_precision_approaches", "holds", "cfi_time", "landings_day", "landings_night", "takeoffs_day", "takeoffs_night"].includes(a.target.field)) {
      return { kind: "field", field: a.target.field };
    }
  }
  return undefined;
}

/**
 * Recency windows ("Last 90 Days", "최근 30일", "últimos 12 meses") are
 * currency figures, not totals — they are left out of the declared totals
 * entirely so the wizard never compares a 365-day window against a career sum.
 */
const RECENCY_RES: RegExp[] = [
  /\b(?:last|past|previous|prior|rolling|trailing|recent)\s+\d+\s*(?:day|days|month|months|year|years|week|weeks|wk|wks|hr|hrs|hours)\b/i,
  /\b\d+\s*(?:day|month|year|week)s?\b.*\b(?:last|past|previous|prior|rolling|trailing)\b/i,
  /\b\d+\s*-\s*(?:day|month|year|week)\b/i, // "90-day", "12-month"
  /\bwithin\s+(?:the\s+)?\d+\s*(?:day|days|month|months|year|years)\b/i,
  /\b(?:ytd|mtd|year\s+to\s+date|month\s+to\s+date|this\s+(?:year|month|week)|current\s+(?:year|month|week)|calendar\s+year)\b/i,
  /(?:최근|지난)\s*\d+\s*(?:일|개월|달|년|주)/, // 최근 90일, 지난 12개월
  /(?:올해|이번\s*달|금년|당해)/,
  /(?:最近|过去|過去)\s*\d+\s*(?:天|日|个月|個月|月|年|周|週)/, // 最近90天
  /(?:今年|本月|本年|近\d+天)/,
  /(?:^|[^a-záéíóúñ])[uú]ltim[oa]s\s+\d+\s*(?:d[ií]as?|meses?|a[ñn]os?|semanas?|horas?)(?![a-záéíóúñ])/i, // últimos 90 días (\b is ASCII-only)
  /\bletzten?\s+\d+\s*(?:tage?n?|monate?n?|jahre?n?|wochen?)\b/i, // letzte 90 Tage
  /\bderni[eè]r(?:e|es|s)?\s+\d+\s*(?:jours?|mois|ans?|semaines?)\b/i, // derniers 90 jours
];

export function isRecencyLabel(label: string): boolean {
  return RECENCY_RES.some((re) => re.test(label));
}

/**
 * "Total flights", "Number of aircraft", "Flights per year", "Night
 * flights": the label counts things, so its number is never an hours total
 * — whatever else it says. A count noun directly followed by a time word
 * ("flight time", "flight hours") is not a count, and neither is a label
 * that carries a time word anywhere ("Total Time (all types)").
 */
const COUNT_NOUN_RE = /\b(?:flights?|sectors?|legs?|entries|entry|aircraft|types?|airports?|aerodromes?|days?|trips?|routes?|rows?|records?)\b(?!\s*(?:time|hours|hrs|hr|h)\b)/i;
const TIME_WORD_RE = /\b(?:time|hours|hrs|hr|duration|h)\b|시간|時間|时间/i;
const COUNT_PREFIX_RE = /\b(?:number|no\.?|count|nr|qty)\s+of\b|^#\s*(?:of\b)?/i;

export function isCountLabel(label: string): boolean {
  if (COUNT_PREFIX_RE.test(label)) return true;
  return COUNT_NOUN_RE.test(label) && !TIME_WORD_RE.test(label);
}

/**
 * "Multi & Single", "SE/ME", "single and multi engine", "all types" — the
 * label spans every category, so it carries no category facet.
 */
const ALL_TYPES_RE = /\b(?:all|any|every|todos?|todas?|alle|tous|toutes)\s+(?:types?|aircraft|aeroplanes?|airplanes?|categor(?:y|ies)|class(?:es)?|tipos?|aeronaves?|klassen)\b|전\s*기종|모든\s*기종|所有机型|全部机型/i;
const CATEGORY_SPLIT_RE = /[&+/,()]|\band\b|\bor\b|\by\b|\bund\b|\bet\b|\bou\b|및|와|과|和|及|与|或/i;

export function namesAllCategories(label: string): boolean {
  if (ALL_TYPES_RE.test(label)) return true;
  const cats = new Set<string>();
  for (const part of label.split(CATEGORY_SPLIT_RE)) {
    const cat = facetsOf(part).cat;
    if (cat && cat !== "sim") cats.add(cat);
  }
  return cats.size >= 2;
}

const INSTRUMENT_COMPOSITE: FieldTarget[] = ["actual_inst", "hood_inst", "sim_inst"];

/** Best-effort meaning of a free-standing label such as "Total PIC" or "ME Night", plus the composite it names, if any. */
export function classifyDeclaredLabel(label: string): { meaning?: TotalMeaning; composite?: FieldTarget[] } {
  const f = facetsOfPath([label]);
  const cat = namesAllCategories(label) ? null : f.cat;
  const field = (name: FieldTarget): { meaning: TotalMeaning } => ({ meaning: { kind: "field", field: name } });

  if (f.approach) return field(f.approach === "precision" ? "precision_approaches" : f.approach === "non_precision" ? "non_precision_approaches" : "ifr_approaches");
  if (f.holds) return field("holds");
  if (f.xc) return field("xc_time");
  if (f.landing) return field(f.cond === "night" ? "landings_night" : "landings_day");
  if (f.takeoff) return field(f.cond === "night" ? "takeoffs_night" : "takeoffs_day");
  if (f.inst === "hood") return field("hood_inst");
  if (f.inst === "actual" && !f.instrumentWord) return field("actual_inst");
  // A bare "Instrument" / "IFR" total is actual + hood + sim, not any one bucket.
  if (f.instrumentWord && !cat && !f.cond && !f.role) return { meaning: { kind: "field", field: "actual_inst" }, composite: [...INSTRUMENT_COMPOSITE] };
  if (f.cat === "sim" && !f.role && !f.cond) return field("sim_inst");
  if (f.field === "cfi_time") return field("cfi_time");
  // "Total flights", "Night sectors": a count, not hours of anything.
  if (isCountLabel(label)) return {};
  if (cat || f.cond || f.role) return { meaning: { kind: "time", category: cat ?? "any", condition: f.cond ?? "any", role: f.role ?? "any" } };
  if (f.total || f.timeWord) return { meaning: { kind: "grand_total" } };
  return {};
}

/** Meaning only (see classifyDeclaredLabel). */
export function classifyTotalLabel(label: string): TotalMeaning | undefined {
  return classifyDeclaredLabel(label).meaning;
}

/** "Total Single Engine Dual (Day) =" → "Total Single Engine Dual (Day)". */
function cleanLabel(raw: string): string {
  return collapse(raw).replace(/\s*[=:：]+$/, "").trim();
}

interface FooterRow { label: string; cells: Map<number, number> }

/** The bottom-most labeled totals row within the last FOOTER_ROWS non-empty rows: label + its numeric cells by column. */
function footerRow(grid: Grid, dataStart: number): FooterRow | null {
  let seen = 0;
  for (let r = grid.rows.length - 1; r >= dataStart && seen < FOOTER_ROWS; r--) {
    const row = grid.rows[r];
    if (rowIsEmpty(row)) continue;
    seen++;
    const labelCell = row.find((c) => c.kind === "text" && TOTAL_ROW_RE.test(c.value));
    if (!labelCell || labelCell.kind !== "text") continue;
    const cells = new Map<number, number>();
    row.forEach((cell, col) => { if (cell.kind === "number") cells.set(col, cell.value); });
    return { label: labelCell.value, cells };
  }
  return null;
}

function collectDeclaredTotals(workbook: Workbook, sheetIndex: number, header: HeaderBand, mapping: ColumnMapping, sheets: SheetScan): DeclaredTotal[] {
  const out: DeclaredTotal[] = [];
  const grid = workbook.sheets[sheetIndex];
  if (!grid) return out;
  const labelOf = (col: number) => header.paths.find((p) => p.col === col)?.label || `column ${col + 1}`;
  const dateCol = fieldCols(mapping, "date")[0];
  const totalCol = fieldCols(mapping, "total_time")[0];
  const siblings = sheets.siblings;
  const skip = new Set<number>([...siblings.map((s) => s.index), ...sheets.others.map((s) => s.index)]);

  // Footer rows of the flight sheet.
  if (siblings.length === 0) {
    const nonEmpty: number[] = [];
    for (let r = grid.rows.length - 1; r >= header.dataStart && nonEmpty.length < FOOTER_ROWS; r--) {
      if (!rowIsEmpty(grid.rows[r])) nonEmpty.push(r);
    }
    for (const r of nonEmpty) {
      const row = grid.rows[r];
      const labelCell = row.find((c) => c.kind === "text" && TOTAL_ROW_RE.test(c.value));
      if (!labelCell || labelCell.kind !== "text") continue;
      row.forEach((cell, col) => {
        if (cell.kind !== "number") return;
        const meaning = meaningOfColumn(mapping, col);
        if (!meaning) return;
        out.push({ source: "footer-row", label: `${labelCell.value} › ${labelOf(col)}`, value: cell.value, meaning });
      });
    }
  } else {
    // Per-year workbooks: each sheet's footer is a subtotal — merge them, and only when every sheet has one.
    const main = footerRow(grid, header.dataStart);
    const sibFooters = siblings.map((s) => {
      const band = sheets.bands.get(s.index);
      const g = workbook.sheets[s.index];
      return band && g ? { band, footer: footerRow(g, band.dataStart) } : null;
    });
    if (main && sibFooters.every((f): f is { band: HeaderBand; footer: FooterRow } => f != null && f.footer != null)) {
      for (const [col, value] of main.cells) {
        const meaning = meaningOfColumn(mapping, col);
        if (!meaning) continue;
        let sum = value;
        for (const f of sibFooters) {
          const sc = siblingColumn(header, f.band, col);
          sum += sc != null ? f.footer.cells.get(sc) ?? 0 : 0;
        }
        out.push({ source: "footer-row", label: `${main.label} › ${labelOf(col)} (${siblings.length + 1} sheets)`, value: sum, meaning });
      }
    }
  }

  // Sum of a mapped row-total column over the rows apply keeps: date-bearing, not a totals row.
  if (totalCol != null) {
    let sum = 0, n = 0;
    const add = (g: Grid, start: number, dCol: number | undefined, tCol: number) => {
      for (let r = start; r < g.rows.length; r++) {
        const row = g.rows[r];
        if (!row || rowIsEmpty(row) || isTotalRow(row)) continue;
        if (dCol == null || !isDateBearing(row[dCol])) continue;
        const cell = row[tCol];
        if (cell?.kind === "number") { sum += cell.value; n++; }
      }
    };
    add(grid, header.dataStart, dateCol, totalCol);
    for (const s of siblings) {
      const band = sheets.bands.get(s.index);
      const g = workbook.sheets[s.index];
      if (!band || !g) continue;
      const tCol = siblingColumn(header, band, totalCol);
      const dCol = dateCol != null ? siblingColumn(header, band, dateCol) : undefined;
      if (tCol != null) add(g, band.dataStart, dCol, tCol);
    }
    if (n > 0) {
      const label = siblings.length > 0 ? `${labelOf(totalCol)} (${siblings.length + 1} sheets)` : labelOf(totalCol);
      out.push({ source: "total-column", label, value: Math.round(sum * 10) / 10, meaning: { kind: "grand_total" } });
    }
  }

  // Other sheets: (label, number) pairs — never a sibling or another dated logbook sheet.
  workbook.sheets.forEach((g, i) => {
    if (i === sheetIndex || skip.has(i)) return;
    for (const row of g.rows) {
      for (let c = 0; c < row.length; c++) {
        const cell = row[c];
        if (cell.kind !== "text") continue;
        const label = cleanLabel(cell.value);
        if (!label || label.length > 60) continue;
        let value: number | null = null;
        for (let k = c + 1; k < Math.min(row.length, c + 4); k++) {
          const v = row[k];
          if (v.kind === "number") { value = v.value; break; }
          if (v.kind !== "empty") break;
        }
        if (value == null) continue;
        if (isRecencyLabel(label)) continue;
        const { meaning, composite } = classifyDeclaredLabel(label);
        // Landings / approaches keep their field meaning above; anything else that counts things is not a total.
        if (!meaning && isCountLabel(label)) continue;
        if (!meaning && !TOTAL_ROW_RE.test(label) && !/total|합계|총계|总计|總計|合计/i.test(label)) continue;
        out.push({ source: "totals-sheet", label, value, meaning, ...(composite ? { composite } : {}) });
      }
    }
  });
  return out;
}
