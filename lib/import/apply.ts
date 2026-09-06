/**
 * ColumnMapping × Grid → ParsedFlight[].
 *
 * Category / role / day / night are derived from the *time* columns the way
 * the legacy Numbers parser (lib/import-formats.ts parseNumbersMultihead)
 * does, so totals stay comparable:
 *   - category = the category with the most hours on the row (ME beats SE
 *     on a tie); with no category columns, the aircraft name decides
 *     (multi-engine type regex → ME, simulator → SIM, else SE);
 *   - role = the role with the most hours inside that category, ties in
 *     DUAL › PIC › FO › SIC › CHECK order; AUG/relief columns are SIC, solo
 *     is logged as PIC;
 *   - day/night = the winning (category, role) bucket's day/night hours;
 *     with only generic columns, night = the night column and day = total −
 *     night; with only a row total, everything is day;
 *   - simulator sessions (SIM-like aircraft, blank aircraft with sim time,
 *     or no aircraft hours at all but sim/approach data) are SIM › DUAL with
 *     day = night = 0 and the duration in sim_inst.
 */
import type { Category, ParsedFlight, Role } from "../csv";
import type {
  Analysis, Cell, ColumnMapping, FieldTarget, Grid, SkipReason, TimeCategory, TimeCondition, TimeRole, Workbook,
} from "./types";
import type { ApplyResultExt } from "./types-ext";
import { EMPTY, cellDisplay, rowIsEmpty } from "./grid";
import { facetsOfPath } from "./synonyms";
import {
  MULTI_MAKE_RE, TOTAL_ROW_RE, excelSerialToISO, isTruthyFlag, looksLikeExcelSerial, parseClockMinutes, parseDateText,
  parseTimeValue, r1,
} from "./util";

/** Legacy simulator test (parseNumbersMultihead) widened with the other parsers' tokens. */
export const SIM_MAKE_RE = /^sim$|^ftd$|sim|alsim|aatd|ffs|fstd|fnpt/i;

type Cat = Exclude<TimeCategory, "any">;
type Rl = Exclude<TimeRole, "any">;

const CATEGORY_ENUM: Record<Cat, Category> = { se: "SE", me: "ME", ses: "SES", mes: "MES", heli: "HELI", sim: "SIM" };
const ROLE_ENUM: Record<Rl, Role> = { dual: "DUAL", pic: "PIC", fo: "FO", sic: "SIC", check: "CHECK", solo: "PIC" };
/** Tie order — first wins (legacy candidate order DUAL, PIC, FO, SIC). */
const ROLE_ORDER: Rl[] = ["dual", "pic", "fo", "sic", "check", "solo"];
/** Tie order — ME beats SE (legacy `meTotal >= seTotal`). */
const CAT_ORDER: Cat[] = ["me", "se", "mes", "ses", "heli", "sim"];
const HEADER_REPEAT_RE = /^(date|flight date|날짜|일자|日期|日付|fecha|datum)$/i;

interface TimeCol { col: number; cat: TimeCategory; cond: TimeCondition; role: TimeRole }
interface TimeHit extends TimeCol { h: number }

// ---------------------------------------------------------------------------
// Cell readers
// ---------------------------------------------------------------------------

function hoursOf(cell: Cell | undefined, clockTimes: boolean): number {
  if (!cell || cell.kind === "empty" || cell.kind === "date") return 0;
  if (cell.kind === "number") {
    if (clockTimes && cell.raw && /^\d{4}$/.test(cell.raw)) return Math.max(0, parseTimeValue(cell.raw));
    return cell.value > 0 ? cell.value : 0;
  }
  const v = parseTimeValue(cell.value);
  return Number.isFinite(v) && v > 0 ? v : 0;
}

function countOf(cell: Cell | undefined): number {
  if (!cell || cell.kind === "empty" || cell.kind === "date") return 0;
  if (cell.kind === "number") return Math.max(0, Math.round(cell.value));
  const m = /^\s*(\d+)/.exec(cell.value);
  if (m) return parseInt(m[1], 10);
  return cell.value.trim() ? 1 : 0; // ForeFlight "Approach1" = "ILS RWY 24L"
}

function textOf(cell: Cell | undefined): string | null {
  const s = cellDisplay(cell).trim();
  return s ? s : null;
}

function dateOf(cell: Cell | undefined, dayFirst: boolean | undefined): string | null {
  if (!cell || cell.kind === "empty") return null;
  if (cell.kind === "date") {
    if (dayFirst != null && cell.raw) {
      const re = parseDateText(cell.raw, dayFirst);
      if (re) return re.iso;
    }
    return cell.value;
  }
  if (cell.kind === "number") return Number.isInteger(cell.value) && looksLikeExcelSerial(cell.value) ? excelSerialToISO(cell.value) : parseDateText(String(cell.value), dayFirst)?.iso ?? null;
  return parseDateText(cell.value, dayFirst)?.iso ?? null;
}

function parseCategoryText(s: string | null): Cat | null {
  if (!s) return null;
  const t = s.trim().toLowerCase();
  if (/^(mes|ames|multi.?engine.?sea)/.test(t)) return "mes";
  if (/^(ses|ases|single.?engine.?sea|sea)/.test(t)) return "ses";
  if (/^(me|mel|amel|multi)/.test(t)) return "me";
  if (/^(se|sel|asel|single)/.test(t)) return "se";
  if (/^(heli|h$|rotor)/.test(t)) return "heli";
  if (/sim|ftd|ffs|fstd|aatd/.test(t)) return "sim";
  return null;
}

function parseRoleText(s: string | null): Role | null {
  if (!s) return null;
  const t = s.trim().toUpperCase().replace(/[.\s]/g, "");
  const ALIAS: Record<string, Role> = {
    PIC: "PIC", P1: "PIC", CAPT: "PIC", CAPTAIN: "PIC", CMDR: "PIC", SOLO: "PIC", PICUS: "PIC",
    FO: "FO", "F/O": "FO", P2: "FO", FIRSTOFFICER: "FO", COPILOT: "FO", "CO-PILOT": "FO", CP: "FO",
    SIC: "SIC", AUG: "SIC", RELIEF: "SIC", CRUISE: "SIC",
    DUAL: "DUAL", INSTRUCTION: "DUAL", TRAINING: "DUAL", STUDENT: "DUAL", DUALRECEIVED: "DUAL",
    CHECK: "CHECK", CHECKRIDE: "CHECK", PPC: "CHECK", IPC: "CHECK", LINECHECK: "CHECK",
  };
  return ALIAS[t] ?? null;
}

// ---------------------------------------------------------------------------
// applyMapping
// ---------------------------------------------------------------------------

export function applyMapping(workbook: Workbook, analysis: Analysis, mapping: ColumnMapping): ApplyResultExt {
  const grid: Grid = workbook.sheets[analysis.sheetIndex] ?? workbook.sheets[0] ?? { sheet: "csv", rows: [], width: 0 };
  const dataStart = analysis.header.dataStart;
  const conv = mapping.conventions ?? {};
  const clockTimes = Boolean(conv.clockTimes);

  const fieldCols = new Map<FieldTarget, number[]>();
  const timeCols: TimeCol[] = [];
  for (const a of mapping.columns) {
    if (a.target.kind === "field") {
      const list = fieldCols.get(a.target.field) ?? [];
      list.push(a.col);
      fieldCols.set(a.target.field, list);
    } else if (a.target.kind === "time") {
      timeCols.push({ col: a.col, cat: a.target.category, cond: a.target.condition, role: a.target.role });
    }
  }
  const cols = (f: FieldTarget): number[] => fieldCols.get(f) ?? [];
  const has = (f: FieldTarget): boolean => cols(f).length > 0;
  const dateCol = cols("date")[0];
  const pathOf = (col: number): string[] => analysis.header.paths.find((p) => p.col === col)?.path ?? [];
  const landingsDayGeneric = cols("landings_day").some((c) => facetsOfPath(pathOf(c)).cond !== "day");
  const takeoffsDayGeneric = cols("takeoffs_day").some((c) => facetsOfPath(pathOf(c)).cond !== "day");
  const aircraftByReg = analysis.legacyFormat === "foreflight" ? foreflightAircraftMap(grid, analysis.header.rows[0] ?? dataStart) : null;

  const flights: ParsedFlight[] = [];
  const skipped: { row: number; reason: SkipReason }[] = [];
  const rowTotals: (number | null)[] = [];
  const sourceRows: number[] = [];
  const columnSums: Record<number, number> = {};

  let lastRow = grid.rows.length - 1;
  while (lastRow >= dataStart && rowIsEmpty(grid.rows[lastRow])) lastRow--;

  for (let r = dataStart; r <= lastRow; r++) {
    const row = grid.rows[r] ?? [];
    const skip = (reason: SkipReason) => skipped.push({ row: r, reason });
    if (rowIsEmpty(row)) { skip("empty"); continue; }

    const dateCell = dateCol != null ? row[dateCol] ?? EMPTY : EMPTY;
    if (isTotalOrHeaderRow(row, dateCell, dateCol)) { skip("header_or_total_row"); continue; }
    if (dateCol == null || dateCell.kind === "empty") { skip("no_date"); continue; }
    const date = dateOf(dateCell, conv.dayFirstDates);
    if (!date) { skip("bad_date"); continue; }

    const firstText = (f: FieldTarget): string | null => {
      for (const c of cols(f)) { const t = textOf(row[c]); if (t) return t; }
      return null;
    };
    const sumHours = (f: FieldTarget): number => cols(f).reduce((s, c) => s + hoursOf(row[c], clockTimes), 0);
    const sumCount = (f: FieldTarget): number => cols(f).reduce((s, c) => s + countOf(row[c]), 0);

    // --- time buckets -----------------------------------------------------
    const hits: TimeHit[] = [];
    const catHours: Partial<Record<Cat, number>> = {};
    const roleHoursAnyCat: Partial<Record<Rl, number>> = {};
    for (const tc of timeCols) {
      const h = hoursOf(row[tc.col], clockTimes);
      if (h <= 0) continue;
      hits.push({ ...tc, h });
      if (tc.cat !== "any") catHours[tc.cat] = (catHours[tc.cat] ?? 0) + h;
      if (tc.cat === "any" && tc.role !== "any") roleHoursAnyCat[tc.role] = (roleHoursAnyCat[tc.role] ?? 0) + h;
    }

    const registration = firstText("registration")?.toUpperCase() ?? null;
    let make = firstText("make_model");
    const simInstCol = sumHours("sim_inst");
    const approaches = has("ifr_approaches") ? sumCount("ifr_approaches") : sumCount("precision_approaches") + sumCount("non_precision_approaches");

    // --- category ----------------------------------------------------------
    let C: Cat | null = parseCategoryText(firstText("category"));
    if (!C) {
      for (const cat of CAT_ORDER) {
        const h = catHours[cat] ?? 0;
        if (h > (C ? catHours[C] ?? 0 : 0)) C = cat;
      }
    }

    // --- aircraft ----------------------------------------------------------
    const simEvidence = simInstCol > 0 || (catHours.sim ?? 0) > 0 || approaches > 0;
    if (!make) {
      if (registration) make = aircraftByReg?.get(registration) ?? registration;
      else if (conv.blankAircraftIsSim && simEvidence) make = "SIM";
      else { skip("no_aircraft"); continue; }
    } else if (aircraftByReg && registration && !firstText("make_model")) {
      make = aircraftByReg.get(registration) ?? make;
    }
    const simMake = SIM_MAKE_RE.test(make);

    // --- role --------------------------------------------------------------
    let roleFromField = parseRoleText(firstText("role"));
    let R: Rl | null = null;
    if (roleFromField) {
      R = (Object.keys(ROLE_ENUM) as Rl[]).find((k) => k !== "solo" && ROLE_ENUM[k] === roleFromField) ?? null;
    }
    if (!R && C) {
      const pair: Partial<Record<Rl, number>> = {};
      for (const t of hits) if (t.cat === C && t.role !== "any") pair[t.role] = (pair[t.role] ?? 0) + t.h;
      R = argmaxRole(pair);
    }
    if (!R) R = argmaxRole(roleHoursAnyCat);
    if (!R && !roleFromField) {
      // Role columns with a category we did not pick (e.g. SE PIC on a row we called ME): any role hours at all.
      const anyRole: Partial<Record<Rl, number>> = {};
      for (const t of hits) if (t.role !== "any") anyRole[t.role] = (anyRole[t.role] ?? 0) + t.h;
      R = argmaxRole(anyRole);
    }
    if (!R) { R = "pic"; roleFromField = null; }

    // --- total / day / night -----------------------------------------------
    const compatible = hits.filter((t) => (t.cat === C || t.cat === "any") && (t.role === R || t.role === "any"));
    const pairTotal = C ? sum(hits.filter((t) => t.cat === C && t.role === R)) : 0;
    const catTotal = C ? sum(hits.filter((t) => t.cat === C)) : 0;
    const roleTotal = sum(hits.filter((t) => t.cat === "any" && t.role === R));
    const genericTotal = sum(hits.filter((t) => t.cat === "any" && t.role === "any"));
    const totalField = sumHours("total_time");
    const nightSpecific = sum(compatible.filter((t) => t.cond === "night" && (t.cat !== "any" || t.role !== "any")));
    const nightGeneric = sum(compatible.filter((t) => t.cond === "night" && t.cat === "any" && t.role === "any"));
    const daySpecific = sum(compatible.filter((t) => t.cond === "day" && (t.cat !== "any" || t.role !== "any")));
    const dayGeneric = sum(compatible.filter((t) => t.cond === "day" && t.cat === "any" && t.role === "any"));
    let night = nightSpecific > 0 ? nightSpecific : nightGeneric;
    const dayExplicit = daySpecific > 0 ? daySpecific : dayGeneric;

    let T = pairTotal > 0 ? pairTotal : Math.max(catTotal, roleTotal, genericTotal, dayExplicit + night, totalField);
    if (T === 0) T = blockDuration(row, cols("block_off")[0], cols("block_on")[0]);

    const flightHours = sum(hits.filter((t) => t.cat !== "sim"));
    const isSim = simMake || C === "sim" || (T === 0 && simEvidence) || (flightHours === 0 && totalField === 0 && (simInstCol > 0 || (catHours.sim ?? 0) > 0));
    if (!isSim && T === 0) { skip("no_time"); continue; }

    night = Math.min(night, T);
    let day = dayExplicit > 0 ? Math.min(dayExplicit, T) : Math.max(0, T - night);
    if (r1(day + night) < r1(T) && dayExplicit > 0) day = Math.max(0, T - night);

    let category: Category;
    let role: Role;
    let simInst = simInstCol;
    if (isSim) {
      category = "SIM";
      role = roleFromField ?? "DUAL";
      if (simInst === 0) simInst = (catHours.sim ?? 0) > 0 ? catHours.sim ?? 0 : T;
      day = 0; night = 0;
    } else {
      category = CATEGORY_ENUM[C ?? (MULTI_MAKE_RE.test(make) ? "me" : "se")];
      role = roleFromField ?? ROLE_ENUM[R];
    }

    // --- cross-country / instrument / counts ----------------------------------
    const xc = sumHours("xc_time") > 0 || cols("xc_flag").some((c) => {
      const cell = row[c];
      return cell?.kind === "number" ? cell.value > 0 : cell?.kind === "text" ? isTruthyFlag(cell.value) : false;
    });
    let landingsDay = sumCount("landings_day"), landingsNight = sumCount("landings_night");
    let takeoffsDay = sumCount("takeoffs_day"), takeoffsNight = sumCount("takeoffs_night");
    if (landingsDayGeneric && has("landings_night") && landingsDay >= landingsNight) landingsDay -= landingsNight;
    if (takeoffsDayGeneric && has("takeoffs_night") && takeoffsDay >= takeoffsNight) takeoffsDay -= takeoffsNight;
    const anyLdg = has("landings_day") || has("landings_night");
    const anyTo = has("takeoffs_day") || has("takeoffs_night");
    if (!anyTo && anyLdg) { takeoffsDay = landingsDay; takeoffsNight = landingsNight; }
    if (!anyLdg && anyTo) { landingsDay = takeoffsDay; landingsNight = takeoffsNight; }
    if (!anyLdg && !anyTo) {
      // Legacy default: one takeoff + landing per flight, by day/night; none for sims.
      const isNight = night > 0 && day === 0;
      const isDay = day > 0 && night === 0;
      const tol = category === "SIM" ? 0 : 1;
      takeoffsDay = landingsDay = category === "SIM" ? 0 : isNight ? 0 : tol;
      takeoffsNight = landingsNight = category === "SIM" ? 0 : isDay ? 0 : night > 0 ? tol : 0;
    }

    const from = firstText("from"), to = firstText("to");
    const route = firstText("route") ?? (from && to ? `${from}-${to}` : from ?? to);

    flights.push({
      date,
      make_model: make,
      registration,
      pic: firstText("pic"),
      copilot: firstText("copilot"),
      third_pilot: firstText("third_pilot"),
      check_pilot: firstText("check_pilot"),
      route,
      remarks: firstText("remarks"),
      category,
      role,
      day_time: r1(day),
      night_time: r1(night),
      is_xcountry: xc,
      actual_inst: r1(sumHours("actual_inst")),
      hood_inst: r1(sumHours("hood_inst")),
      sim_inst: r1(simInst),
      ifr_approaches: approaches,
      precision_approaches: sumCount("precision_approaches"),
      non_precision_approaches: sumCount("non_precision_approaches"),
      holds: sumCount("holds"),
      cfi_time: r1(sumHours("cfi_time")),
      takeoffs_day: takeoffsDay,
      takeoffs_night: takeoffsNight,
      landings_day: landingsDay,
      landings_night: landingsNight,
    });
    rowTotals.push(has("total_time") ? r1(totalField) : null);
    sourceRows.push(r);
    for (let c = 0; c < row.length; c++) {
      const cell = row[c];
      if (cell.kind !== "number") continue;
      // Accumulate unrounded; rounding at every step drifted +0.6 h on a
      // 2,600-row Total column. Round once below.
      columnSums[c] = (columnSums[c] ?? 0) + (dateCol === c ? 0 : hoursOf(cell, clockTimes) || cell.value);
    }
  }
  for (const k of Object.keys(columnSums)) columnSums[Number(k)] = r1(columnSums[Number(k)]);

  return { flights, skipped, columnSums, rowTotals, sourceRows };
}

function sum(list: TimeHit[]): number {
  return list.reduce((s, t) => s + t.h, 0);
}

function argmaxRole(h: Partial<Record<Rl, number>>): Rl | null {
  let best: Rl | null = null;
  for (const r of ROLE_ORDER) {
    const v = h[r] ?? 0;
    if (v > (best ? h[best] ?? 0 : 0)) best = r;
  }
  return best;
}

function blockDuration(row: Cell[], offCol: number | undefined, onCol: number | undefined): number {
  if (offCol == null || onCol == null) return 0;
  const off = parseClockMinutes(cellDisplay(row[offCol]));
  const on = parseClockMinutes(cellDisplay(row[onCol]));
  if (off == null || on == null) return 0;
  let mins = on - off;
  if (mins < 0) mins += 24 * 60;
  const h = mins / 60;
  return h > 0 && h < 22 ? h : 0;
}

/** Totals / subtotals / repeated header rows inside the data. */
function isTotalOrHeaderRow(row: Cell[], dateCell: Cell, dateCol: number | undefined): boolean {
  if (dateCell.kind === "text") {
    if (TOTAL_ROW_RE.test(dateCell.value) || HEADER_REPEAT_RE.test(dateCell.value.trim())) return true;
  }
  if (dateCell.kind === "empty" || dateCol == null) {
    const limit = Math.min(row.length, 6);
    for (let c = 0; c < limit; c++) {
      const cell = row[c];
      if (cell.kind === "text" && TOTAL_ROW_RE.test(cell.value)) return true;
    }
  }
  return false;
}

/** ForeFlight's "Aircraft Table" section above the flights: registration → type code. */
function foreflightAircraftMap(grid: Grid, before: number): Map<string, string> | null {
  const rows = grid.rows;
  let start = -1;
  for (let r = 0; r < Math.min(before, rows.length); r++) {
    const first = rows[r]?.find((c) => c.kind !== "empty");
    if (first?.kind === "text" && /^aircraft table$/i.test(first.value.trim())) { start = r; break; }
  }
  if (start < 0) return null;
  const header = (rows[start + 1] ?? []).map((c) => cellDisplay(c).trim().toLowerCase());
  const regCol = header.indexOf("aircraftid");
  const typeCol = header.indexOf("typecode");
  const modelCol = header.indexOf("model");
  if (regCol < 0) return null;
  const map = new Map<string, string>();
  for (let r = start + 2; r < before; r++) {
    const row = rows[r];
    if (!row || rowIsEmpty(row)) break;
    const reg = cellDisplay(row[regCol]).trim().toUpperCase();
    const type = (typeCol >= 0 ? cellDisplay(row[typeCol]) : "").trim() || (modelCol >= 0 ? cellDisplay(row[modelCol]) : "").trim();
    if (reg && type) map.set(reg, type);
  }
  return map;
}
