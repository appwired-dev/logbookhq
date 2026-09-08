/**
 * ColumnMapping × Grid → ParsedFlight[].
 *
 * Category / role / day / night are derived from the *time* columns the way
 * the legacy Numbers parser (lib/import-formats.ts parseNumbersMultihead)
 * does, so totals stay comparable:
 *   - category = the category with the most hours on the row (ME beats SE
 *     on a tie); with no category columns, the aircraft name decides — first
 *     the ICAO type table (`engineClassFor`: PA44 → ME, C172 → SE, R44 →
 *     HELI, "A320 FFS" → SIM), then the legacy multi-engine regex, else SE;
 *   - role = the role with the most hours inside that category, ties in
 *     DUAL › PIC › FO › SIC › CHECK order; AUG/relief columns are SIC, solo
 *     is logged as PIC; a mapped role-text column wins when its text is
 *     recognised (English aliases, then the multilingual header vocabulary —
 *     comandante, copiloto, CDB, OPL, 기장 …); texts nobody recognises are
 *     reported in `unknownRoles` and the row falls back to the hours;
 *   - day/night = the winning (category, role) bucket's day/night hours;
 *     with only generic columns, night = the night column and day = total −
 *     night; with only a row total, everything is day; instruction given
 *     (`cfi_time`) counts as flight time when nothing else does, as PIC;
 *   - simulator sessions (SIM-like aircraft, a SIM/FFS/FTD "registration",
 *     a row Total of 0 with simulator time, blank aircraft with sim time, or
 *     no aircraft hours at all but simulator hours) are SIM › DUAL with
 *     day = night = 0, no takeoffs/landings, and the duration in sim_inst.
 *     Approaches alone are not simulator evidence — a row with an aircraft,
 *     approaches and no hours anywhere is skipped `no_time`.
 *
 * Rows whose time hits span more than one (category, role) bucket — e.g.
 * "ME › Day › FO" 3.0 and "ME › Day › AUG" 2.0 on one line — become one
 * flight per bucket instead of keeping the winning bucket and dropping the
 * rest: the same date / aircraft / crew / route / remarks on each, per-bucket
 * day/night hours, cross-country on every flight when the row is
 * cross-country, and the instrument hours, approaches, holds, instruction
 * given and takeoffs/landings attached only to the bucket with the most
 * hours (ties fall back to the orders above). Only fully-qualified hits (both
 * category and role named) define buckets — PIC and Solo share one, as both
 * log as PIC; generic columns ("Night", a bare "PIC") are handed out greedily,
 * largest bucket first, never twice. A row's Total cell belongs to the row:
 * `ApplyResult.splitRows` records the split, while `rowTotals` /
 * `sourceRows` / `skipped` stay one entry per SOURCE row (see
 * `sourceRowGroups`). Single-bucket rows take exactly the legacy path.
 *
 * Guards on the data itself:
 *   - a mapped Total column that is a running total (monotonic over ≥ 90 % of
 *     the rows and ending above 20 × the mean row bucket sum) is not used for
 *     row hours — `cumulativeTotal` is set so reconcile can explain it;
 *   - actual + hood instrument time is clamped to the row's flight time
 *     (`instrumentClamped` counts the rows);
 *   - negative hour cells read as 0 and are counted in `negativeHours`;
 *   - a user-chosen day-first convention (`conventions.dayFirstSource ===
 *     "user"`), or one that differs from the reader's per-column decision in
 *     `grid.dateCols`, re-parses every date cell's raw text — the pre-typed
 *     value is never trusted in that case.
 *
 * Sibling sheets: when `analysis.siblingSheets` lists other sheets with the
 * same header layout (per-year workbooks), their rows are imported after the
 * analysed sheet, each from its own `dataStart`. Row numbers in `sourceRows`,
 * `skipped` and `splitRows` stay per-sheet (types.ts / types-ext.ts keep them
 * as plain numbers); the parallel `sourceSheets` / `skippedSheets` /
 * `splitSheets` arrays name the sheet index for each entry.
 */
import type { Category, ParsedFlight, Role } from "../csv";
import type {
  Analysis, Cell, ColumnMapping, FieldTarget, Grid, SkipReason, TimeCategory, TimeCondition, TimeRole, Workbook,
} from "./types";
import type { ApplyResultExt } from "./types-ext";
import { EMPTY, cellDisplay, rowIsEmpty } from "./grid";
import { facetsOf, facetsOfPath } from "./synonyms";
import {
  MULTI_MAKE_RE, TOTAL_ROW_RE, excelSerialToISO, isTruthyFlag, looksLikeExcelSerial, parseClockMinutes, parseDateText,
  parseTimeValue, r1,
} from "./util";
import { engineClassFor } from "./aircraft-types";

/** Legacy simulator test (parseNumbersMultihead) widened with the other parsers' tokens. */
export const SIM_MAKE_RE = /^sim$|^ftd$|sim|alsim|aatd|ffs|fstd|fnpt/i;
/** A "registration" that names a training device: "SIM", "SIM-01", "FFS", "FTD 2", "FNPT II", "SIMULATOR" (not "SIMBA"). */
export const SIM_REG_RE = /^(?:simulator|sim|ffs|ftd|fnpt|fstd|aatd|batd)(?![a-z])/i;

/** Apply output: the shared contract plus the per-sheet alignment arrays (see the header comment). */
export interface ApplyOutput extends ApplyResultExt {
  /** Aligned with `sourceRows`: index into `workbook.sheets` the row came from. */
  sourceSheets?: number[];
  /** Aligned with `skipped`. */
  skippedSheets?: number[];
  /** Aligned with `splitRows`. */
  splitSheets?: number[];
}

type Cat = Exclude<TimeCategory, "any">;
type Rl = Exclude<TimeRole, "any">;

const CATEGORY_ENUM: Record<Cat, Category> = { se: "SE", me: "ME", ses: "SES", mes: "MES", heli: "HELI", sim: "SIM" };
const ROLE_ENUM: Record<Rl, Role> = { dual: "DUAL", pic: "PIC", fo: "FO", sic: "SIC", check: "CHECK", solo: "PIC" };
/** Tie order — first wins (legacy candidate order DUAL, PIC, FO, SIC). */
const ROLE_ORDER: Rl[] = ["dual", "pic", "fo", "sic", "check", "solo"];
/** Tie order — ME beats SE (legacy `meTotal >= seTotal`). */
const CAT_ORDER: Cat[] = ["me", "se", "mes", "ses", "heli", "sim"];
const HEADER_REPEAT_RE = /^(date|flight date|날짜|일자|日期|日付|fecha|datum)$/i;
/** Float residue below which a drained shared column counts as empty. */
const EPS = 1e-9;
/** Instrument time may exceed flight time by this much (rounding of 0.1 h cells) before it is clamped. */
const INST_TOLERANCE = 0.05;
const ZERO_COUNTS = { takeoffs_day: 0, takeoffs_night: 0, landings_day: 0, landings_night: 0 } as const;

interface TimeCol { col: number; cat: TimeCategory; cond: TimeCondition; role: TimeRole }
interface TimeHit extends TimeCol { h: number }
/** One (category, role) bucket of a row; `role` is the raw column role (PIC vs Solo), `hours` its fully-qualified hits. */
interface Bucket { cat: Cat; role: Rl; hours: number }
/** One sheet to import: the analysed sheet first, then each sibling. */
interface SheetJob { sheet: number; grid: Grid; dataStart: number }

// ---------------------------------------------------------------------------
// Cell readers
// ---------------------------------------------------------------------------

/** Signed hours of a cell (negative for "-1.5"); 0 for empty / date / unparseable cells. */
function signedHours(cell: Cell | undefined, clockTimes: boolean): number {
  if (!cell || cell.kind === "empty" || cell.kind === "date") return 0;
  if (cell.kind === "number") {
    if (clockTimes && cell.raw && /^\d{4}$/.test(cell.raw)) return parseTimeValue(cell.raw);
    return Number.isFinite(cell.value) ? cell.value : 0;
  }
  const v = parseTimeValue(cell.value);
  return Number.isFinite(v) ? v : 0;
}

function hoursOf(cell: Cell | undefined, clockTimes: boolean): number {
  const v = signedHours(cell, clockTimes);
  return v > 0 ? v : 0;
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

/**
 * ISO date of a cell. `dayFirst` decides ambiguous numeric text; with
 * `reparseTyped` a date the reader already typed is re-read from its raw
 * text under that convention instead of trusting the reader's decision.
 */
function dateOf(cell: Cell | undefined, dayFirst: boolean | undefined, reparseTyped: boolean): string | null {
  if (!cell || cell.kind === "empty") return null;
  if (cell.kind === "date") {
    if (reparseTyped && dayFirst != null && cell.raw) {
      const re = parseDateText(cell.raw, dayFirst);
      if (re) return re.iso;
    }
    return cell.value;
  }
  if (cell.kind === "number") return Number.isInteger(cell.value) && looksLikeExcelSerial(cell.value) ? excelSerialToISO(cell.value) : parseDateText(String(cell.value), dayFirst)?.iso ?? null;
  return parseDateText(cell.value, dayFirst)?.iso ?? null;
}

/**
 * Category text → bucket, matched anywhere in the text: "ASEL", "Airplane
 * Single Engine Land", "Multi-Engine Land", "Rotorcraft Helicopter", "FFS".
 * Gliders, balloons and the like are null (no category of ours).
 */
export function parseCategoryText(s: string | null): Cat | null {
  if (!s) return null;
  const t = s.trim().toLowerCase();
  if (!t) return null;
  if (/\b(?:mes|ames|multi[\s-]?engine[\s-]?sea(?:plane)?|multi[\s-]?sea)\b/.test(t)) return "mes";
  if (/\b(?:ses|ases|single[\s-]?engine[\s-]?sea(?:plane)?|single[\s-]?sea|sea|seaplane|float(?:plane)?|floats|amphib(?:ian|ious)?)\b/.test(t)) return "ses";
  if (/\b(?:me|mel|amel|multi(?:[\s-]?engine)?|multiengine|twin)\b/.test(t)) return "me";
  if (/\b(?:se|sel|asel|single(?:[\s-]?engine)?|singleengine)\b/.test(t)) return "se";
  if (/^h$|\b(?:heli\w*|helo|rotor\w*|rotary)\b/.test(t)) return "heli";
  if (/\b(?:sim\w*|ftd|ffs|fstd|aatd|batd|fnpt)\b/.test(t)) return "sim";
  if (/\b(?:glider|sailplane|balloon|gyro\w*|airship)\b/.test(t)) return null;
  // Multilingual header vocabulary (단발 / 다발 / 헬기 / 模拟机 …).
  const f = facetsOf(s).cat;
  return f && f !== "any" ? f : null;
}

/** English / UK / school role texts, normalised to upper case without dots or spaces. */
const ROLE_ALIAS: Record<string, Role> = {
  PIC: "PIC", P1: "PIC", CAPT: "PIC", CAPTAIN: "PIC", CMDR: "PIC", COMMANDER: "PIC", SOLO: "PIC", PICUS: "PIC", "P1/S": "PIC", P1S: "PIC", P1US: "PIC", SPIC: "PIC",
  INSTRUCTOR: "PIC", CFI: "PIC", CFII: "PIC", FI: "PIC", MEI: "PIC", DUALGIVEN: "PIC", INSTRUCTIONGIVEN: "PIC",
  FO: "FO", "F/O": "FO", P2: "FO", FIRSTOFFICER: "FO", COPILOT: "FO", "CO-PILOT": "FO", CP: "FO",
  SIC: "SIC", AUG: "SIC", RELIEF: "SIC", CRUISE: "SIC", SAFETYPILOT: "SIC", SAFETY: "SIC",
  DUAL: "DUAL", INSTRUCTION: "DUAL", TRAINING: "DUAL", STUDENT: "DUAL", TRAINEE: "DUAL", DUALRECEIVED: "DUAL", DUALREC: "DUAL", DUALRECD: "DUAL",
  PUT: "DUAL", "P/UT": "DUAL", "PU/T": "DUAL", "P.U.T": "DUAL", ALUMNO: "DUAL", ESTUDIANTE: "DUAL",
  CHECK: "CHECK", CHECKRIDE: "CHECK", PPC: "CHECK", IPC: "CHECK", LINECHECK: "CHECK",
};

/**
 * Role text → Role: the alias table above, then the multilingual header
 * vocabulary (comandante / copiloto / CDB / OPL / DC / 기장 / 부기장 …).
 * Null when nothing recognises the text — the caller records it.
 */
export function parseRoleText(s: string | null): Role | null {
  if (!s) return null;
  const t = s.trim().toUpperCase().replace(/[.\s]/g, "");
  if (!t) return null;
  const alias = ROLE_ALIAS[t];
  if (alias) return alias;
  const role = facetsOf(s).role;
  return role && role !== "any" ? ROLE_ENUM[role] : null;
}

// ---------------------------------------------------------------------------
// applyMapping
// ---------------------------------------------------------------------------

export function applyMapping(workbook: Workbook, analysis: Analysis, mapping: ColumnMapping): ApplyOutput {
  const mainIndex = workbook.sheets[analysis.sheetIndex] ? analysis.sheetIndex : 0;
  const mainGrid: Grid = workbook.sheets[mainIndex] ?? { sheet: "csv", rows: [], width: 0 };
  // A bogus analysis (negative, fractional or NaN dataStart) must not create phantom skipped rows.
  const clampStart = (n: number): number => (Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0);
  const jobs: SheetJob[] = [{ sheet: mainIndex, grid: mainGrid, dataStart: clampStart(analysis.header.dataStart) }];
  for (const s of analysis.siblingSheets ?? []) {
    const grid = workbook.sheets[s.index];
    if (!grid || jobs.some((j) => j.sheet === s.index)) continue;
    jobs.push({ sheet: s.index, grid, dataStart: clampStart(s.dataStart) });
  }

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
  const anyLdg = has("landings_day") || has("landings_night");
  const anyTo = has("takeoffs_day") || has("takeoffs_night");
  const aircraftByReg = analysis.legacyFormat === "foreflight" ? foreflightAircraftMap(mainGrid, analysis.header.rows[0] ?? jobs[0].dataStart) : null;
  const totalCol = cols("total_time")[0];
  const cumulative = totalCol != null && looksCumulative(jobs, totalCol, timeCols, dateCol, clockTimes);

  const flights: ParsedFlight[] = [];
  const skipped: { row: number; reason: SkipReason }[] = [];
  const skippedSheets: number[] = [];
  const rowTotals: (number | null)[] = [];
  const sourceRows: number[] = [];
  const sourceSheets: number[] = [];
  const splitRows: { row: number; buckets: number }[] = [];
  const splitSheets: number[] = [];
  const columnSums: Record<number, number> = {};
  const unknownRoleCounts = new Map<string, number>();
  let instrumentClamped = 0;
  let negativeHours = 0;

  for (const job of jobs) {
    const { grid, sheet, dataStart } = job;
    // Re-read date text under the requested convention when the user chose it, or when it differs
    // from (or the reader did not record) the per-column decision the grid was typed with.
    const dayFirst = conv.dayFirstDates;
    const typed = dateCol != null ? grid.dateCols?.[dateCol] : undefined;
    const reparseDates = dayFirst != null && (conv.dayFirstSource === "user" || typed == null || typed.dayFirst !== dayFirst);

    let lastRow = grid.rows.length - 1;
    while (lastRow >= dataStart && rowIsEmpty(grid.rows[lastRow])) lastRow--;

    for (let r = dataStart; r <= lastRow; r++) {
      const row = grid.rows[r] ?? [];
      const skip = (reason: SkipReason) => { skipped.push({ row: r, reason }); skippedSheets.push(sheet); };
      if (rowIsEmpty(row)) { skip("empty"); continue; }

      const dateCell = dateCol != null ? row[dateCol] ?? EMPTY : EMPTY;
      if (isTotalOrHeaderRow(row, dateCell, dateCol)) { skip("header_or_total_row"); continue; }
      if (dateCol == null || dateCell.kind === "empty") { skip("no_date"); continue; }
      const date = dateOf(dateCell, dayFirst, reparseDates);
      if (!date) { skip("bad_date"); continue; }

      // Negative cells are counted once per (row, column) however many readers touch them.
      const negSeen = new Set<number>();
      const hoursAt = (c: number): number => {
        const v = signedHours(row[c], clockTimes);
        if (v < 0 && !negSeen.has(c)) { negSeen.add(c); negativeHours++; }
        return v > 0 ? v : 0;
      };
      const firstText = (f: FieldTarget): string | null => {
        for (const c of cols(f)) { const t = textOf(row[c]); if (t) return t; }
        return null;
      };
      const sumHours = (f: FieldTarget): number => cols(f).reduce((s, c) => s + hoursAt(c), 0);
      const sumCount = (f: FieldTarget): number => cols(f).reduce((s, c) => s + countOf(row[c]), 0);

      // --- time buckets -----------------------------------------------------
      const hits: TimeHit[] = [];
      const catHours: Partial<Record<Cat, number>> = {};
      const roleHoursAnyCat: Partial<Record<Rl, number>> = {};
      for (const tc of timeCols) {
        const h = hoursAt(tc.col);
        if (h <= 0) continue;
        hits.push({ ...tc, h });
        if (tc.cat !== "any") catHours[tc.cat] = (catHours[tc.cat] ?? 0) + h;
        if (tc.cat === "any" && tc.role !== "any") roleHoursAnyCat[tc.role] = (roleHoursAnyCat[tc.role] ?? 0) + h;
      }

      const registration = firstText("registration")?.toUpperCase() ?? null;
      let make = firstText("make_model");
      const simInstCol = sumHours("sim_inst");
      const simHours = simInstCol + (catHours.sim ?? 0);
      const approaches = has("ifr_approaches") ? sumCount("ifr_approaches") : sumCount("precision_approaches") + sumCount("non_precision_approaches");
      const totalField = sumHours("total_time");
      /** The row's Total cell as flight time — never when the column is a running total. */
      const totalForT = cumulative ? 0 : totalField;
      /** MyFlightbook-style sim rows: a mapped Total of 0 next to simulator time. */
      const zeroTotalSim = !cumulative && has("total_time") && totalField === 0 && simInstCol > 0;
      const cfiHours = sumHours("cfi_time");

      // --- category ----------------------------------------------------------
      let C: Cat | null = parseCategoryText(firstText("category"));
      if (!C) {
        for (const cat of CAT_ORDER) {
          const h = catHours[cat] ?? 0;
          if (h > (C ? catHours[C] ?? 0 : 0)) C = cat;
        }
      }

      // --- aircraft ----------------------------------------------------------
      if (!make) {
        if (registration) make = aircraftByReg?.get(registration) ?? registration;
        else if ((conv.blankAircraftIsSim || zeroTotalSim) && simHours > 0) make = "SIM";
        else { skip("no_aircraft"); continue; }
      } else if (aircraftByReg && registration && !firstText("make_model")) {
        make = aircraftByReg.get(registration) ?? make;
      }
      const typeClass = engineClassFor(make);
      const simMake = SIM_MAKE_RE.test(make) || typeClass === "sim";
      const simReg = registration != null && SIM_REG_RE.test(registration);

      // --- role text (recorded once per row, whichever path the row takes) ------
      const roleText = firstText("role");
      let roleFromField = parseRoleText(roleText);
      if (roleText && !roleFromField) unknownRoleCounts.set(roleText, (unknownRoleCounts.get(roleText) ?? 0) + 1);

      // --- row-level fields shared by every flight the row emits -----------------
      const xc = sumHours("xc_time") > 0 || cols("xc_flag").some((c) => {
        const cell = row[c];
        return cell?.kind === "number" ? cell.value > 0 : cell?.kind === "text" ? isTruthyFlag(cell.value) : false;
      });
      const from = firstText("from"), to = firstText("to");
      const route = firstText("route") ?? (from && to ? `${from}-${to}` : from ?? to);
      const base = {
        date,
        make_model: make,
        registration,
        pic: firstText("pic"),
        copilot: firstText("copilot"),
        third_pilot: firstText("third_pilot"),
        check_pilot: firstText("check_pilot"),
        route,
        remarks: firstText("remarks"),
      };
      /** Actual + hood instrument time, clamped to the row's flight hours (sims are not clamped: their time is sim time). */
      const instrument = (flightHours: number, sim: boolean): { actual: number; hood: number } => {
        let actual = sumHours("actual_inst"), hood = sumHours("hood_inst");
        if (!sim && flightHours > 0 && actual + hood > flightHours + INST_TOLERANCE) {
          instrumentClamped++;
          actual = Math.min(actual, flightHours);
          hood = Math.max(0, Math.min(hood, flightHours - actual));
        }
        return { actual, hood };
      };
      /** Takeoffs / landings from the mapped count columns, else the legacy one-per-flight default by day/night (none for sims). */
      const counts = (category: Category, day: number, night: number) => {
        let landingsDay = sumCount("landings_day"), landingsNight = sumCount("landings_night");
        let takeoffsDay = sumCount("takeoffs_day"), takeoffsNight = sumCount("takeoffs_night");
        if (landingsDayGeneric && has("landings_night") && landingsDay >= landingsNight) landingsDay -= landingsNight;
        if (takeoffsDayGeneric && has("takeoffs_night") && takeoffsDay >= takeoffsNight) takeoffsDay -= takeoffsNight;
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
        return { takeoffs_day: takeoffsDay, takeoffs_night: takeoffsNight, landings_day: landingsDay, landings_night: landingsNight };
      };
      /** Per-SOURCE-row bookkeeping — once per row, however many flights it emitted. */
      const finishRow = (emitted: number) => {
        rowTotals.push(has("total_time") && !cumulative ? r1(totalField) : null);
        sourceRows.push(r);
        sourceSheets.push(sheet);
        if (emitted > 1) { splitRows.push({ row: r, buckets: emitted }); splitSheets.push(sheet); }
        for (let c = 0; c < row.length; c++) {
          const cell = row[c];
          if (cell.kind !== "number") continue;
          // Accumulate unrounded; rounding at every step drifted +0.6 h on a
          // 2,600-row Total column. Round once below.
          columnSums[c] = (columnSums[c] ?? 0) + (dateCol === c ? 0 : hoursOf(cell, clockTimes) || cell.value);
        }
      };

      // --- rows with time in more than one (category, role) bucket ---------------
      const buckets = bucketsOf(hits);
      if (buckets.length > 1) {
        const shared = hits.filter((t) => t.cat === "any" || t.role === "any");
        const left = shared.map((t) => t.h);
        /** Hand up to `cap` hours of the shared `cond` columns compatible with `b` to it — each hour once. */
        const drain = (b: Bucket, cond: TimeCondition, cap: number): number => {
          let got = 0;
          shared.forEach((t, i) => {
            if (t.cond !== cond || left[i] <= EPS || got >= cap - EPS) return;
            if ((t.cat !== "any" && t.cat !== b.cat) || (t.role !== "any" && t.role !== b.role)) return;
            const x = Math.min(left[i], cap - got);
            left[i] -= x;
            got += x;
          });
          return got < EPS ? 0 : got;
        };
        const rowHours = buckets.reduce((s, b) => s + b.hours, 0);
        const rowSim = simMake || simReg;
        const inst = instrument(rowHours, rowSim);
        buckets.forEach((b, i) => {
          const primary = i === 0;
          const T = b.hours;
          const owned = hits.filter((t) => t.cat === b.cat && t.role === b.role);
          const ownedNight = sum(owned.filter((t) => t.cond === "night"));
          const ownedDay = sum(owned.filter((t) => t.cond === "day"));
          // As on the single-bucket path: the bucket's own day/night columns win; generic ones fill in only when it has none.
          let night: number;
          if (ownedNight > 0) { drain(b, "night", ownedNight); night = ownedNight; } else night = drain(b, "night", T);
          let dayExplicit: number;
          if (ownedDay > 0) { drain(b, "day", ownedDay); dayExplicit = ownedDay; } else dayExplicit = drain(b, "day", T);
          night = Math.min(night, T);
          let day = dayExplicit > 0 ? Math.min(dayExplicit, T) : Math.max(0, T - night);
          if (r1(day + night) < r1(T) && dayExplicit > 0) day = Math.max(0, T - night);

          const sim = rowSim || b.cat === "sim";
          const category: Category = sim ? "SIM" : CATEGORY_ENUM[b.cat];
          const role: Role = ROLE_ENUM[b.role];
          if (sim) { day = 0; night = 0; }
          day = r1(day);
          night = r1(night);
          flights.push({
            ...base,
            category,
            role,
            day_time: day,
            night_time: night,
            is_xcountry: xc,
            // Instrument time, approaches, holds, instruction given and counts belong to the row — booked once, on the largest bucket.
            actual_inst: primary ? r1(inst.actual) : 0,
            hood_inst: primary ? r1(inst.hood) : 0,
            sim_inst: sim ? r1(primary && simInstCol > 0 ? simInstCol : T) : primary ? r1(simInstCol) : 0,
            ifr_approaches: primary ? approaches : 0,
            precision_approaches: primary ? sumCount("precision_approaches") : 0,
            non_precision_approaches: primary ? sumCount("non_precision_approaches") : 0,
            holds: primary ? sumCount("holds") : 0,
            cfi_time: primary ? r1(cfiHours) : 0,
            ...(primary ? counts(category, day, night) : ZERO_COUNTS),
          });
        });
        finishRow(buckets.length);
        continue;
      }

      // --- role --------------------------------------------------------------
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
      const nightSpecific = sum(compatible.filter((t) => t.cond === "night" && (t.cat !== "any" || t.role !== "any")));
      const nightGeneric = sum(compatible.filter((t) => t.cond === "night" && t.cat === "any" && t.role === "any"));
      const daySpecific = sum(compatible.filter((t) => t.cond === "day" && (t.cat !== "any" || t.role !== "any")));
      const dayGeneric = sum(compatible.filter((t) => t.cond === "day" && t.cat === "any" && t.role === "any"));
      let night = nightSpecific > 0 ? nightSpecific : nightGeneric;
      const dayExplicit = daySpecific > 0 ? daySpecific : dayGeneric;

      // Instruction given is flight time too (an instructor's sheet may log nothing else).
      let T = pairTotal > 0 ? pairTotal : Math.max(catTotal, roleTotal, genericTotal, dayExplicit + night, totalForT, cfiHours);
      if (T === 0) T = blockDuration(row, cols("block_off")[0], cols("block_on")[0]);

      const flightHours = sum(hits.filter((t) => t.cat !== "sim"));
      // Simulator hours (not approaches) are the evidence for a session without aircraft time.
      const isSim = simMake || simReg || C === "sim" || zeroTotalSim
        || (T === 0 && simHours > 0)
        || (flightHours === 0 && totalField === 0 && cfiHours === 0 && simHours > 0);
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
        // Sheet category, else the ICAO type table, else the legacy multi-engine regex, else SE.
        // `isSim` already covers the "sim" class, so TS narrows typeClass here.
        const fromType = typeClass ?? null;
        category = CATEGORY_ENUM[C ?? fromType ?? (MULTI_MAKE_RE.test(make) ? "me" : "se")];
        role = roleFromField ?? ROLE_ENUM[R];
      }
      const inst = instrument(T, isSim);

      // --- cross-country / instrument / counts ----------------------------------
      flights.push({
        ...base,
        category,
        role,
        day_time: r1(day),
        night_time: r1(night),
        is_xcountry: xc,
        actual_inst: r1(inst.actual),
        hood_inst: r1(inst.hood),
        sim_inst: r1(simInst),
        ifr_approaches: approaches,
        precision_approaches: sumCount("precision_approaches"),
        non_precision_approaches: sumCount("non_precision_approaches"),
        holds: sumCount("holds"),
        cfi_time: r1(cfiHours),
        ...counts(category, day, night),
      });
      finishRow(1);
    }
  }
  for (const k of Object.keys(columnSums)) columnSums[Number(k)] = r1(columnSums[Number(k)]);

  const unknownRoles = [...unknownRoleCounts.entries()]
    .map(([text, count]) => ({ text, count }))
    .sort((a, b) => b.count - a.count || a.text.localeCompare(b.text));

  return {
    flights, skipped, columnSums, rowTotals, sourceRows, splitRows,
    sourceSheets, skippedSheets, splitSheets,
    unknownRoles, cumulativeTotal: cumulative, instrumentClamped, negativeHours,
  };
}

/**
 * Flights regrouped by the source row that produced them, aligned with
 * `rowTotals` / `sourceRows` (one entry per imported source row). Flights are
 * emitted in row order and a split row contributes `buckets` consecutive
 * flights, primary bucket first, so a cursor walk rebuilds the grouping.
 * `row` is null for a result that carries no `sourceRows` (then it is 1:1).
 * Rows from sibling sheets are told apart by `sourceSheets` / `splitSheets`;
 * the k-th group's sheet is `sourceSheets[k]`.
 */
export function sourceRowGroups(result: ApplyOutput): { row: number | null; total: number | null; flights: number[] }[] {
  const rows = result.sourceRows;
  if (!rows) return result.flights.map((_, i) => ({ row: null, total: result.rowTotals?.[i] ?? null, flights: [i] }));
  const key = (sheet: number | undefined, row: number): string => `${sheet ?? 0}:${row}`;
  const bucketsAt = new Map<string, number>();
  (result.splitRows ?? []).forEach((s, i) => bucketsAt.set(key(result.splitSheets?.[i], s.row), s.buckets));
  const out: { row: number | null; total: number | null; flights: number[] }[] = [];
  let cursor = 0;
  rows.forEach((row, k) => {
    const n = Math.max(1, bucketsAt.get(key(result.sourceSheets?.[k], row)) ?? 1);
    const idx: number[] = [];
    for (let j = 0; j < n && cursor < result.flights.length; j++) idx.push(cursor++);
    out.push({ row, total: result.rowTotals?.[k] ?? null, flights: idx });
  });
  return out;
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

/**
 * Distinct (category, role) buckets among a row's fully-qualified time hits
 * (both category and role named — "ME › Day › FO", not a generic "Night" or a
 * bare "PIC"). PIC and Solo share a bucket (both log as PIC); inside one the
 * raw role is the argmax one, as on the single-bucket path. Sorted largest
 * first, ties in CAT_ORDER then ROLE_ORDER — the first is the primary bucket.
 */
function bucketsOf(hits: TimeHit[]): Bucket[] {
  const groups = new Map<string, { cat: Cat; byRole: Partial<Record<Rl, number>> }>();
  for (const t of hits) {
    if (t.cat === "any" || t.role === "any") continue;
    const key = `${t.cat}:${ROLE_ENUM[t.role]}`;
    const g = groups.get(key) ?? { cat: t.cat, byRole: {} };
    g.byRole[t.role] = (g.byRole[t.role] ?? 0) + t.h;
    groups.set(key, g);
  }
  const out: Bucket[] = [];
  for (const g of groups.values()) {
    const role = argmaxRole(g.byRole);
    if (role) out.push({ cat: g.cat, role, hours: g.byRole[role] ?? 0 });
  }
  out.sort((a, b) =>
    r1(b.hours) - r1(a.hours)
    || CAT_ORDER.indexOf(a.cat) - CAT_ORDER.indexOf(b.cat)
    || ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role));
  return out;
}

/**
 * A mapped Total column that is a running total rather than per-row hours:
 * monotonic (either direction — the sheet may be reverse-chronological) over
 * ≥ 90 % of consecutive dated rows and reaching more than 20 × the mean of the
 * rows' own time-bucket sums. Needs at least five rows and some time columns
 * to compare against; a Total-only sheet is always taken at face value.
 */
function looksCumulative(jobs: SheetJob[], totalCol: number, timeCols: TimeCol[], dateCol: number | undefined, clockTimes: boolean): boolean {
  if (timeCols.length === 0) return false;
  const totals: number[] = [];
  let bucketSum = 0, bucketRows = 0;
  for (const job of jobs) {
    for (let r = job.dataStart; r < job.grid.rows.length; r++) {
      const row = job.grid.rows[r];
      if (!row || rowIsEmpty(row)) continue;
      if (dateCol != null) {
        const d = row[dateCol];
        if (!d || d.kind === "empty" || d.kind === "text") continue; // header repeats / footers carry no date
      }
      const cell = row[totalCol];
      if (!cell || cell.kind !== "number") continue;
      const t = hoursOf(cell, clockTimes);
      if (t <= 0) continue;
      totals.push(t);
      const b = timeCols.reduce((s, tc) => s + hoursOf(row[tc.col], clockTimes), 0);
      if (b > 0) { bucketSum += b; bucketRows++; }
    }
  }
  if (totals.length < 5 || bucketRows === 0) return false;
  let up = 0, down = 0, max = 0;
  for (let i = 0; i < totals.length; i++) {
    if (totals[i] > max) max = totals[i];
    if (i === 0) continue;
    if (totals[i] >= totals[i - 1] - EPS) up++;
    if (totals[i] <= totals[i - 1] + EPS) down++;
  }
  const steps = totals.length - 1;
  if (Math.max(up, down) < 0.9 * steps) return false;
  if (max <= Math.min(totals[0], totals[totals.length - 1]) + EPS) return false; // flat, not running
  return max > 20 * (bucketSum / bucketRows);
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
