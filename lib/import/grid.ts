/**
 * File bytes → Workbook of typed Grids.
 *
 * CSV/TSV/TXT: own RFC-4180 parser (delimiter sniffed among , ; \t, quoted
 * fields, BOM, UTF-16 BOMs). xlsx/xls/…: SheetJS with `cellDates`, merged
 * header cells forward-filled (text anchors only — numbers are never
 * duplicated).
 *
 * Every cell is typed once here so the rest of the pipeline never touches
 * strings it does not understand:
 *   - numbers: "1.5", "1,5" (decimal comma), "1,234.5", "1:30" (→ 1.5 h) —
 *     the raw text is kept so conventions can be detected later and block
 *     times can still be read as clock times;
 *   - dates: Date objects, ISO / dd/mm/yyyy / mm/dd/yyyy / yyyy.mm.dd /
 *     dd-MMM-yy / 2024년 3월 5일 … Day-vs-month ambiguity is resolved per
 *     column by which reading keeps every value valid and the column
 *     roughly monotonic;
 *   - "-", "—", "n/a" and friends are empty.
 */
import * as XLSX from "xlsx";
import type { Cell, Grid, Workbook } from "./types";
import {
  collapse, dateObjectToISO, isValidYMD, isoDate, parseDateText, parseTimeValue, type DateReading,
} from "./util";

const EMPTY_TOKENS = new Set(["", "-", "—", "–", "--", "---", ".", "n/a", "na", "n.a.", "null", "nil", "none", "#n/a", "#value!", "#ref!"]);

export const EMPTY: Cell = { kind: "empty" };

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function readWorkbook(bytes: Uint8Array | ArrayBuffer, filename: string): Workbook {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (isBinarySpreadsheet(u8, filename)) return readSpreadsheet(u8, filename);
  const text = decodeText(u8);
  return { filename, sheets: [gridFromValues("csv", parseDelimited(text))] };
}

function extensionOf(filename: string): string {
  return (/\.([a-z0-9]+)$/i.exec(filename.trim())?.[1] ?? "").toLowerCase();
}

function isBinarySpreadsheet(u8: Uint8Array, filename: string): boolean {
  const ext = extensionOf(filename);
  if (["xlsx", "xlsm", "xlsb", "xls", "ods", "numbers"].includes(ext)) return true;
  // Zip (xlsx/ods/numbers) or OLE2 (legacy xls) magic, regardless of the name.
  if (u8.length > 4 && u8[0] === 0x50 && u8[1] === 0x4b && (u8[2] === 0x03 || u8[2] === 0x05 || u8[2] === 0x07)) return true;
  if (u8.length > 8 && u8[0] === 0xd0 && u8[1] === 0xcf && u8[2] === 0x11 && u8[3] === 0xe0) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Text decoding + delimited parsing
// ---------------------------------------------------------------------------

/** Bytes → string. Honours UTF-8 / UTF-16 BOMs; falls back to UTF-8. */
export function decodeText(u8: Uint8Array): string {
  if (u8.length >= 2 && u8[0] === 0xff && u8[1] === 0xfe) return new TextDecoder("utf-16le").decode(u8.subarray(2));
  if (u8.length >= 2 && u8[0] === 0xfe && u8[1] === 0xff) return new TextDecoder("utf-16be").decode(u8.subarray(2));
  let text = new TextDecoder("utf-8").decode(u8);
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  return text;
}

/** Pick the delimiter that yields the most consistent column count over the first lines. */
export function sniffDelimiter(text: string): string {
  const lines = text.split(/\r?\n/).filter((l) => l.trim()).slice(0, 25);
  let best = ",";
  let bestScore = -1;
  for (const d of [",", ";", "\t", "|"]) {
    const counts = lines.map((l) => countOutsideQuotes(l, d));
    const total = counts.reduce((a, b) => a + b, 0);
    if (total === 0) continue;
    // Consistency: how many lines share the modal count.
    const freq = new Map<number, number>();
    for (const c of counts) freq.set(c, (freq.get(c) ?? 0) + 1);
    const modal = Math.max(...freq.values());
    const score = total + modal * 10;
    if (score > bestScore) { bestScore = score; best = d; }
  }
  return best;
}

function countOutsideQuotes(line: string, d: string): number {
  let n = 0, q = false;
  for (const ch of line) {
    if (ch === '"') q = !q;
    else if (!q && ch === d) n++;
  }
  return n;
}

/** RFC-4180 parser with a sniffed delimiter. Returns raw strings (untrimmed). */
export function parseDelimited(text: string, delimiter?: string): string[][] {
  const d = delimiter ?? sniffDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"') { inQuotes = true; i++; continue; }
    if (c === d) { row.push(field); field = ""; i++; continue; }
    if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; i++; continue; }
    if (c === "\r") { i++; continue; }
    field += c; i++;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

// ---------------------------------------------------------------------------
// SheetJS
// ---------------------------------------------------------------------------

type RawValue = string | number | boolean | Date | null | undefined;

function readSpreadsheet(u8: Uint8Array, filename: string): Workbook {
  const wb = XLSX.read(u8, { type: "array", cellDates: true, cellNF: false, cellText: false });
  const sheets: Grid[] = [];
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    const ref = ws?.["!ref"];
    if (!ws || !ref) { sheets.push({ sheet: name, rows: [], width: 0 }); continue; }
    const range = XLSX.utils.decode_range(ref);
    // Anchor the grid at A1 so column indices equal real sheet columns even
    // when the used range starts further right/down.
    const rows = XLSX.utils.sheet_to_json<RawValue[]>(ws, {
      header: 1, raw: true, defval: null, blankrows: true,
      range: { s: { r: 0, c: 0 }, e: range.e },
    });
    const grid = gridFromValues(name, rows);
    applyMerges(grid, ws["!merges"]);
    sheets.push(grid);
  }
  return { filename, sheets };
}

/** Copy text anchors across merged ranges (header groups). Numbers/dates are never duplicated. */
function applyMerges(grid: Grid, merges: XLSX.Range[] | undefined): void {
  if (!merges) return;
  for (const m of merges) {
    const anchor = grid.rows[m.s.r]?.[m.s.c];
    if (!anchor || anchor.kind !== "text") continue;
    for (let r = m.s.r; r <= m.e.r; r++) {
      const row = grid.rows[r];
      if (!row) continue;
      for (let c = m.s.c; c <= m.e.c; c++) {
        if (row[c] === undefined || row[c].kind === "empty") row[c] = anchor;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Typing
// ---------------------------------------------------------------------------

interface Provisional {
  cell: Cell;
  /** Set when the text was a date; `numeric` marks day/month ambiguity. */
  reading?: DateReading;
}

/** Raw values (strings from CSV, mixed from SheetJS) → typed Grid. */
export function gridFromValues(sheet: string, raw: RawValue[][]): Grid {
  const width = raw.reduce((w, r) => Math.max(w, r.length), 0);
  const prov: Provisional[][] = raw.map((r) => {
    const out: Provisional[] = new Array(width);
    for (let c = 0; c < width; c++) out[c] = typeValue(r[c]);
    return out;
  });
  resolveDateColumns(prov, width);
  const rows: Cell[][] = prov.map((r) => r.map((p) => p.cell));
  return { sheet, rows, width };
}

function typeValue(v: RawValue): Provisional {
  if (v == null) return { cell: EMPTY };
  if (v instanceof Date) {
    const iso = dateObjectToISO(v);
    return { cell: iso ? { kind: "date", value: iso } : EMPTY };
  }
  if (typeof v === "number") {
    return { cell: Number.isFinite(v) ? { kind: "number", value: v } : EMPTY };
  }
  if (typeof v === "boolean") return { cell: { kind: "text", value: v ? "TRUE" : "FALSE" } };
  return typeText(String(v));
}

const NUM_PLAIN = /^[-+]?\d+(\.\d+)?$/;
const NUM_THOUSANDS = /^[-+]?\d{1,3}(,\d{3})+(\.\d+)?$/;
const NUM_DECIMAL_COMMA = /^[-+]?\d+,\d{1,2}$/;
const NUM_CLOCK = /^\d{1,3}:\d{2}(:\d{2})?$/;
const NUM_PLUS = /^\d{1,3}\+\d{2}$/;
const NUM_UNIT = /^(\d+(?:[.,]\d+)?)\s*(h|hr|hrs|hour|hours|시간|小时|小時)$/i;
const DATE_COMPACT = /^(19|20)\d{6}$/;

/** One string → typed cell (dates provisional; see resolveDateColumns). */
export function typeText(input: string): Provisional {
  const t = collapse(input);
  if (EMPTY_TOKENS.has(t.toLowerCase())) return { cell: EMPTY };

  if (DATE_COMPACT.test(t)) {
    const y = +t.slice(0, 4), m = +t.slice(4, 6), d = +t.slice(6, 8);
    if (isValidYMD(y, m, d)) return { cell: { kind: "date", value: isoDate(y, m, d), raw: t }, reading: { iso: isoDate(y, m, d) } };
  }
  if (NUM_PLAIN.test(t)) return { cell: { kind: "number", value: parseFloat(t), raw: t } };
  if (NUM_THOUSANDS.test(t)) return { cell: { kind: "number", value: parseFloat(t.replace(/,/g, "")), raw: t } };
  if (NUM_DECIMAL_COMMA.test(t)) return { cell: { kind: "number", value: parseFloat(t.replace(",", ".")), raw: t } };
  if (NUM_CLOCK.test(t)) return { cell: { kind: "number", value: parseTimeValue(t), raw: t } };
  if (NUM_PLUS.test(t)) {
    const [h, mm] = t.split("+").map((x) => parseInt(x, 10));
    if (mm < 60) return { cell: { kind: "number", value: h + mm / 60, raw: t } };
  }
  const unit = NUM_UNIT.exec(t);
  if (unit) return { cell: { kind: "number", value: parseFloat(unit[1].replace(",", ".")), raw: t } };

  const reading = parseDateText(t);
  if (reading) return { cell: { kind: "date", value: reading.iso, raw: t }, reading };

  return { cell: { kind: "text", value: t } };
}

/**
 * Decide day-first vs month-first per column for numeric dates such as
 * "05/03/2024": prefer the reading under which every ambiguous value is a
 * valid calendar date; when both are, the one with fewer out-of-order
 * steps; then the separator default ("/" → month-first, "." "-" → day-first).
 */
function resolveDateColumns(prov: Provisional[][], width: number): void {
  for (let c = 0; c < width; c++) {
    const readings: { r: number; reading: DateReading }[] = [];
    for (let r = 0; r < prov.length; r++) {
      const p = prov[r][c];
      if (p?.reading) readings.push({ r, reading: p.reading });
    }
    const ambiguous = readings.filter((x) => x.reading.numeric);
    if (ambiguous.length === 0) continue;
    const dayFirst = decideDayFirst(readings.map((x) => x.reading));
    for (const { r, reading } of ambiguous) {
      const n = reading.numeric!;
      const iso = dayFirst ? (n.dayFirstIso ?? n.monthFirstIso) : (n.monthFirstIso ?? n.dayFirstIso);
      const cell = prov[r][c].cell;
      if (iso && cell.kind === "date") prov[r][c] = { cell: { kind: "date", value: iso, raw: cell.raw }, reading };
    }
  }
}

export function decideDayFirst(readings: DateReading[]): boolean {
  const amb = readings.filter((r) => r.numeric);
  if (amb.length === 0) return false;
  const dfValid = amb.every((r) => r.numeric!.dayFirstIso);
  const mfValid = amb.every((r) => r.numeric!.monthFirstIso);
  const separatorDefault = amb[0].numeric!.defaultDayFirst;
  if (dfValid !== mfValid) return dfValid;
  if (!dfValid) return separatorDefault; // mixed validity — per-cell fallback handles it
  const seq = (dayFirst: boolean) => readings.map((r) => {
    if (!r.numeric) return r.iso;
    return (dayFirst ? r.numeric.dayFirstIso : r.numeric.monthFirstIso) ?? r.iso;
  });
  const inversions = (s: string[]) => {
    let n = 0;
    for (let i = 1; i < s.length; i++) if (s[i] < s[i - 1]) n++;
    return n;
  };
  const invDay = inversions(seq(true));
  const invMonth = inversions(seq(false));
  // A logbook is either ascending or descending; count against both.
  const rev = (s: string[]) => [...s].reverse();
  const dayScore = Math.min(invDay, inversions(rev(seq(true))));
  const monthScore = Math.min(invMonth, inversions(rev(seq(false))));
  if (dayScore !== monthScore) return dayScore < monthScore;
  return separatorDefault;
}

// ---------------------------------------------------------------------------
// Cell helpers shared by headers / mapping / apply
// ---------------------------------------------------------------------------

export function cellAt(grid: Grid, r: number, c: number): Cell {
  return grid.rows[r]?.[c] ?? EMPTY;
}





// Pure cell helpers live in ./cells so header detection and column mapping
// can be imported by client code without dragging SheetJS along.
export { cellDisplay, cellHeaderText, rowIsEmpty, countKinds } from "./cells";
import { cellDisplay } from "./cells";

/** Grid → CSV-ish text (first `maxRows` rows) for legacy signature detection. */
export function gridToText(grid: Grid, maxRows = 80): string {
  return grid.rows.slice(0, maxRows).map((r) => r.map((c) => {
    const s = cellDisplay(c);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(",")).join("\n");
}
