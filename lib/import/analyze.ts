/**
 * analyzeWorkbook — everything the wizard needs to render the mapping step.
 * Synchronous and pure: bytes in, Analysis out.
 */
import { detectFormat } from "../import-formats";
import type {
  Analysis, CanonicalTarget, DeclaredTotal, FieldTarget, Grid, HeaderBand, ColumnMapping, ImportTemplate, TotalMeaning, Workbook,
} from "./types";
import { cellDisplay, decodeText, gridToText, readWorkbook, rowIsEmpty } from "./grid";
import { detectHeaderBand, looksLikeDataRow } from "./headers";
import { CONFIDENCE_THRESHOLD, mapColumns } from "./mapping";
import { SYSTEM_TEMPLATES, fingerprint } from "./templates";
import { facetsOf, facetsOfPath } from "./synonyms";
import { SUMMABLE_FIELDS } from "./targets";
import { TOTAL_ROW_RE, collapse, r1 } from "./util";

const SAMPLE_ROWS = 8;
const FOOTER_ROWS = 5;
const LEGACY_FORMATS = new Set(["foreflight", "logten", "myflightbook", "logbookhq"]);

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

  // Numeric columns: tally numbers the sheet stores as text (see Analysis.textNumberCells).
  const numericCols = mapping.columns.filter((c) => isNumericTarget(c.target)).map((c) => c.col);
  const tally = new Map<number, { plain: number; text: number; sum: number }>();

  const sample: string[][] = [];
  let rowCount = 0;
  for (let r = header.dataStart; r < grid.rows.length; r++) {
    const row = grid.rows[r];
    if (rowIsEmpty(row)) continue;
    rowCount++;
    if (sample.length < SAMPLE_ROWS) sample.push(header.paths.map((p) => cellDisplay(row[p.col])));
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

  const lowConfidenceCols = mapping.columns
    .filter((c) => c.target.kind !== "ignore" && c.confidence < CONFIDENCE_THRESHOLD)
    .map((c) => c.col);

  const isText = workbook.sheets.length === 1 && grid.sheet === "csv";
  const legacy = detectFormat(isText ? decodeText(u8).slice(0, 8000) : gridToText(grid));
  const legacyFormat = LEGACY_FORMATS.has(legacy) ? legacy : null;

  return {
    filename,
    sheetIndex,
    sheetName: grid.sheet,
    header,
    mapping,
    sample,
    rowCount,
    fingerprint: fp,
    templateId: template?.id ?? null,
    templateName: template?.name ?? null,
    declaredTotals: collectDeclaredTotals(workbook, sheetIndex, header, mapping),
    lowConfidenceCols,
    legacyFormat,
    ...(Object.keys(textNumberCells).length > 0 ? { textNumberCells } : {}),
  };
}

/** The sheet with the most flight-looking rows (ties → first). */
export function pickFlightSheet(workbook: Workbook): number {
  let best = 0, bestScore = -1;
  workbook.sheets.forEach((g, i) => {
    let score = 0;
    for (const row of g.rows) if (looksLikeDataRow(row)) score++;
    if (score > bestScore) { bestScore = score; best = i; }
  });
  return best;
}

function isNumericTarget(t: CanonicalTarget): boolean {
  if (t.kind === "time") return true;
  return t.kind === "field" && (t.field === "total_time" || SUMMABLE_FIELDS.has(t.field));
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

function collectDeclaredTotals(workbook: Workbook, sheetIndex: number, header: HeaderBand, mapping: ColumnMapping): DeclaredTotal[] {
  const out: DeclaredTotal[] = [];
  const grid = workbook.sheets[sheetIndex];
  if (!grid) return out;
  const labelOf = (col: number) => header.paths.find((p) => p.col === col)?.label || `column ${col + 1}`;

  // Footer rows of the flight sheet.
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

  // Sum of a mapped row-total column.
  const totalCol = mapping.columns.find((c) => c.target.kind === "field" && c.target.field === "total_time")?.col;
  if (totalCol != null) {
    let sum = 0, n = 0;
    for (let r = header.dataStart; r < grid.rows.length; r++) {
      const row = grid.rows[r];
      if (!row || rowIsEmpty(row)) continue;
      if (row.slice(0, 6).some((c) => c.kind === "text" && TOTAL_ROW_RE.test(c.value))) continue;
      const cell = row[totalCol];
      if (cell?.kind === "number") { sum += cell.value; n++; }
    }
    if (n > 0) out.push({ source: "total-column", label: labelOf(totalCol), value: Math.round(sum * 10) / 10, meaning: { kind: "grand_total" } });
  }

  // Other sheets: (label, number) pairs.
  workbook.sheets.forEach((g, i) => {
    if (i === sheetIndex) return;
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
        if (!meaning && !TOTAL_ROW_RE.test(label) && !/total|합계|총계|总计|總計|合计/i.test(label)) continue;
        out.push({ source: "totals-sheet", label, value, meaning, ...(composite ? { composite } : {}) });
      }
    }
  });
  return out;
}
