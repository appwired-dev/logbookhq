/**
 * Column shape statistics — what the *data* in a column looks like,
 * independent of its header. Used as the 30 % shape term of the mapping
 * confidence and for shape-only mapping when a sheet has no header.
 */
import type { CanonicalTarget, Cell, Grid } from "./types";
import { TOTAL_ROW_RE, isFalsyFlag, isTruthyFlag } from "./util";
import { isDateLikeCell } from "./headers";

/** Loose registration shape (letters/digits with an optional hyphen) — see `looksLikeTail` for the actual test. */
export const TAIL_RE = /^(?:[A-Z]{1,2}-?[A-Z0-9]{2,5}|\d[A-Z]-?[A-Z0-9]{2,5})$/;
/** Registrations that cannot be type codes: hyphenated (G-ABCD, C-GABC, 9V-SKA), N-numbers, or two letters + four digits (HL1234, JA8089). */
export const STRONG_TAIL_RE = /^(?:[A-Z0-9]{1,2}-[A-Z0-9]{2,5}|N\d{1,5}[A-Z]{0,2}|[A-Z]{2}\d{4})$/;
/** ICAO type codes and similar: C172, B738, PA28, DH8C, DR400, R22. */
export const TYPE_CODE_RE = /^[A-Z]{1,2}\d{1,4}[A-Z]{0,2}$/;
export const ICAO_PAIR_RE = /^[A-Z0-9]{3,4}(?:\s*[-–—/>→]+\s*[A-Z0-9]{3,4})+$/;
export const ICAO_CODE_RE = /^[A-Z0-9]{3,4}$/;
/** Airport identifiers proper (ICAO / IATA letters only) — tested case-sensitively so "Self" does not count. */
const AIRPORT_CODE_RE = /^[A-Z]{3,4}$/;
const CLOCK_RE = /^\d{1,2}:\d{2}(?::\d{2})?$/;
/** "1:30", "1h30", "0h20", "1.30" — durations, never registrations. */
const CLOCKISH_RE = /^\d{1,2}[:hH.]\d{2}$/;
const NAME_RE = /^[\p{L}][\p{L}\s.'\-]{1,40}$/u;
const CATEGORY_TEXT_RE = /^(se|me|ses|mes|heli|sim|sel|mel|asel|amel|ases|ames|single|multi|land|sea|rotor|helicopter|glider|ftd|ffs)\b/i;
const ROLE_TEXT_RE = /^(pic|sic|fo|f\/o|dual|solo|check|p1|p2|capt|captain|student|instr|cfi|aug)\b/i;

/**
 * True when an upper-cased cell looks like an aircraft registration: the loose
 * shape plus a digit or a hyphen, and never a bare four-letter word (ICAO
 * airport codes, "SELF") or a clock/duration string.
 */
export function looksLikeTail(up: string): boolean {
  return TAIL_RE.test(up) && /[\d-]/.test(up) && !/^[A-Z]{4}$/.test(up) && !CLOCKISH_RE.test(up);
}

export interface ColumnStats {
  n: number;
  nNum: number;
  nDate: number;
  nText: number;
  maxNum: number;
  allInt: boolean;
  hasDecimal: boolean;
  dateLike: number;
  /** Cells that look like registrations (`looksLikeTail`). */
  tail: number;
  /** Subset of `tail` that cannot be a type code (hyphen, N-number, HL1234). */
  strongTail: number;
  /** Cells that look like ICAO type codes and are not strong tails (C172, B738). */
  typeCode: number;
  pair: number;
  code: number;
  /** Letters-only 3–4 character upper-case codes (airports). */
  apt: number;
  flag: number;
  clock: number;
  /** Cells carrying a ":" (clock stamps, date-times) — never counts. */
  colon: number;
  name: number;
  longText: number;
  catText: number;
  roleText: number;
  avgLen: number;
  clockRaw: boolean;
  decimalCommaRaw: boolean;
}

function isTotalRow(row: Cell[]): boolean {
  for (let c = 0; c < Math.min(row.length, 4); c++) {
    const cell = row[c];
    if (cell.kind === "text" && TOTAL_ROW_RE.test(cell.value)) return true;
  }
  return false;
}

export function columnStats(grid: Grid, col: number, dataStart: number, maxRows = 500): ColumnStats {
  const s: ColumnStats = {
    n: 0, nNum: 0, nDate: 0, nText: 0, maxNum: 0, allInt: true, hasDecimal: false, dateLike: 0,
    tail: 0, strongTail: 0, typeCode: 0, pair: 0, code: 0, apt: 0, flag: 0, clock: 0, colon: 0, name: 0, longText: 0, catText: 0, roleText: 0, avgLen: 0,
    clockRaw: false, decimalCommaRaw: false,
  };
  let lenSum = 0;
  const end = Math.min(grid.rows.length, dataStart + maxRows);
  for (let r = dataStart; r < end; r++) {
    const row = grid.rows[r];
    if (!row || isTotalRow(row)) continue;
    const cell = row[col];
    if (!cell || cell.kind === "empty") continue;
    s.n++;
    if (isDateLikeCell(cell)) s.dateLike++;
    if (cell.kind === "date") { s.nDate++; continue; }
    if (cell.kind === "number") {
      s.nNum++;
      const v = cell.value;
      if (Math.abs(v) > s.maxNum) s.maxNum = Math.abs(v);
      if (!Number.isInteger(v)) { s.allInt = false; s.hasDecimal = true; }
      if (cell.raw) {
        if (CLOCK_RE.test(cell.raw)) { s.clock++; s.clockRaw = true; s.colon++; }
        if (/^[-+]?\d+,\d{1,2}$/.test(cell.raw)) s.decimalCommaRaw = true;
      }
      if (v === 0 || v === 1) s.flag++;
      continue;
    }
    s.nText++;
    const t = cell.value;
    lenSum += t.length;
    const up = t.toUpperCase();
    if (looksLikeTail(up)) {
      s.tail++;
      if (STRONG_TAIL_RE.test(up)) s.strongTail++;
      else if (TYPE_CODE_RE.test(up)) s.typeCode++;
    }
    if (ICAO_PAIR_RE.test(up)) s.pair++;
    if (ICAO_CODE_RE.test(up)) s.code++;
    if (AIRPORT_CODE_RE.test(t.trim())) s.apt++;
    if (isTruthyFlag(t) || isFalsyFlag(t)) s.flag++;
    if (CLOCK_RE.test(t)) s.clock++;
    if (t.includes(":")) s.colon++;
    if (NAME_RE.test(t) && t.length <= 40) s.name++;
    if (t.length > 14 || /\s\S+\s/.test(t)) s.longText++;
    if (CATEGORY_TEXT_RE.test(t)) s.catText++;
    if (ROLE_TEXT_RE.test(t)) s.roleText++;
  }
  s.avgLen = s.nText ? lenSum / s.nText : 0;
  return s;
}

const ratio = (a: number, b: number) => (b > 0 ? a / b : 0);

/** 0..1 — how well the column's data fits the target. 0.5 = no evidence (empty column). */
export function shapeScore(target: CanonicalTarget, s: ColumnStats): number {
  if (s.n === 0) return 0.5;
  const numR = ratio(s.nNum, s.n);
  const textR = ratio(s.nText, s.n);
  const dateR = ratio(s.dateLike, s.n);
  if (target.kind === "ignore") return 0.5;
  if (target.kind === "time") return hoursShape(s, numR);
  switch (target.field) {
    case "date": return dateR >= 0.8 ? 1 : dateR >= 0.5 ? 0.5 : 0;
    case "total_time": case "xc_time": case "actual_inst": case "hood_inst": case "sim_inst": case "cfi_time":
      return hoursShape(s, numR);
    case "ifr_approaches": case "precision_approaches": case "non_precision_approaches": case "holds":
    case "landings_day": case "landings_night": case "takeoffs_day": case "takeoffs_night":
      // Clock stamps and date-times ("Engine Start" 2024-05-12 18:20) are never counts.
      if (dateR >= 0.5 || ratio(s.colon, s.n) >= 0.5) return 0;
      if (numR >= 0.8) return s.allInt && s.maxNum <= 60 ? 1 : 0.4;
      if (textR >= 0.8) return target.field === "ifr_approaches" ? 0.6 : 0.1; // ForeFlight "Approach1" text cells
      return 0.3;
    case "registration": {
      if (numR > 0.5) return 0;
      const tailR = ratio(s.tail, s.nText);
      if (ratio(s.strongTail, s.nText) >= 0.6) return 1;
      // Loose tails that are mostly type codes (C172, PA28) are more likely a type column.
      if (tailR >= 0.6) return ratio(s.typeCode, s.nText) >= 0.5 ? 0.5 : 0.9;
      return tailR >= 0.3 ? 0.6 : textR > 0 ? 0.4 : 0.2;
    }
    case "make_model":
      if (numR > 0.5) return 0.1;
      return textR > 0 && s.avgLen <= 24 && ratio(s.longText, s.nText) < 0.5 ? 0.9 : 0.4;
    case "route":
      if (numR > 0.5) return 0;
      if (ratio(s.pair, s.nText) >= 0.5) return 1;
      return ratio(s.code, s.nText) >= 0.5 ? 0.6 : textR > 0 ? 0.45 : 0.2;
    case "from": case "to":
      if (numR > 0.5) return 0;
      return ratio(s.code, s.nText) >= 0.6 ? 1 : ratio(s.pair, s.nText) >= 0.5 ? 0.3 : textR > 0 ? 0.5 : 0.2;
    case "remarks":
      if (numR > 0.5) return 0.1;
      return ratio(s.longText, s.nText) >= 0.4 ? 1 : textR > 0 ? 0.6 : 0.3;
    case "pic": case "copilot": case "third_pilot": case "check_pilot":
      if (numR > 0.3) return 0;
      return ratio(s.name, s.nText) >= 0.7 && s.avgLen <= 30 ? 0.9 : textR > 0 ? 0.5 : 0.2;
    case "xc_flag":
      return ratio(s.flag, s.n) >= 0.8 ? (s.nText > 0 ? 1 : 0.7) : 0.1;
    case "category":
      return ratio(s.catText, s.n) >= 0.6 ? 1 : 0.15;
    case "role":
      return ratio(s.roleText, s.n) >= 0.6 ? 1 : 0.15;
    case "block_off": case "block_on":
      return ratio(s.clock, s.n) >= 0.6 ? 1 : 0.15;
    default:
      return 0.5;
  }
}

function hoursShape(s: ColumnStats, numR: number): number {
  if (numR >= 0.8) {
    if (s.maxNum > 24 && s.maxNum <= 60 && s.clock === 0) return 0.35;
    if (s.maxNum > 60) return 0.15;
    if (s.hasDecimal || s.clock > 0) return 1;
    return s.maxNum <= 20 ? 0.7 : 0.9;
  }
  if (numR >= 0.5) return 0.5;
  return s.nNum === 0 && s.nText > 0 ? 0 : 0.2;
}
