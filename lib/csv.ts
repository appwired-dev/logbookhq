/**
 * CSV parser for Numbers-exported pilot logbooks.
 *
 * Ported from ~/pilot-logbook/server/csv.ts. Same parsing logic, but returns
 * objects shaped for the LogbookHQ Postgres schema (snake_case, ISO dates,
 * boolean for is_xcountry, no user_id — caller injects that).
 *
 * AUG hours are halved on import (augmented-crew "active duty = half cruise"
 * convention used in the source spreadsheet's totals).
 */

// Category — expanded in migration 0009 to cover sea and helicopter classes
// alongside the original SE/ME/SIM. SES = single-engine sea (float plane),
// MES = multi-engine sea, HELI = rotorcraft.
export type Category = "SE" | "ME" | "SES" | "MES" | "HELI" | "SIM";
export type Role = "PIC" | "DUAL" | "FO" | "SIC" | "CHECK";

export interface ParsedFlight {
  date: string; // ISO YYYY-MM-DD
  make_model: string;
  registration: string | null;
  pic: string | null;
  copilot: string | null;
  third_pilot: string | null;
  check_pilot: string | null;
  route: string | null;
  remarks: string | null;
  category: Category;
  role: Role;
  day_time: number;
  night_time: number;
  is_xcountry: boolean;
  actual_inst: number;
  hood_inst: number;
  sim_inst: number;
  // Total IFR approach count (kept for legacy data). New rows should also
  // populate the granular split below; the form sums them into this field.
  ifr_approaches: number;
  // Migration 0009 — granular logbook fields.
  precision_approaches: number;     // ILS, PAR, etc.
  non_precision_approaches: number; // LNAV, VOR, NDB, RNAV (LNAV)
  holds: number;                    // holding patterns flown
  cfi_time: number;                 // hours as flight instructor
  takeoffs_day: number;
  takeoffs_night: number;
  landings_day: number;
  landings_night: number;
}

export function parseCSV(text: string): string[][] {
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
    if (c === ",") { row.push(field); field = ""; i++; continue; }
    if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; i++; continue; }
    if (c === "\r") { i++; continue; }
    field += c; i++;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

/** "Sep 27, 2001" -> "2001-09-27" */
export function parseDate(s: string): string | null {
  const m = s.trim().match(/^([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})$/);
  if (!m) return null;
  const mm = MONTHS[m[1].slice(0, 3).toLowerCase()];
  if (!mm) return null;
  const dd = m[2].padStart(2, "0");
  return `${m[3]}-${mm}-${dd}`;
}

const num = (v: string) => {
  const s = (v ?? "").trim();
  if (!s) return 0;
  // European/Korean decimal ("1,6" → 1.6) — see import-formats.ts for the
  // disambiguation rule.
  if (/^-?\d+,\d{1,2}$/.test(s)) {
    const n = parseFloat(s.replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
};
const r1 = (n: number) => Math.round(n * 10) / 10;

export function importCsvText(text: string, defaultTakeoffsLandings = 1): ParsedFlight[] {
  const rows = parseCSV(text);
  const out: ParsedFlight[] = [];

  for (const r of rows) {
    if (r.length < 7) continue;
    const date = parseDate(r[0] ?? "");
    if (!date) continue;

    const make = (r[1] ?? "").trim();
    if (!make) continue;

    const reg = (r[2] ?? "").trim() || null;
    const pic = (r[3] ?? "").trim() || null;
    const cop = (r[4] ?? "").trim() || null;
    const route = (r[5] ?? "").trim() || null;
    const remarks = (r[6] ?? "").trim() || null;

    const seDualDay = num(r[7]);
    const sePicDay = num(r[8]);
    const seDualNight = num(r[9]);
    const sePicNight = num(r[10]);

    const meDualDay = num(r[11]);
    const mePicDay = num(r[12]);
    const meFoDay = num(r[13]);
    const meAugDay = num(r[14]);
    const meDualNight = num(r[15]);
    const mePicNight = num(r[16]);
    const meFoNight = num(r[17] ?? "0");
    const meAugNight = num(r[18] ?? "0");

    const xcDayDual = num(r[19] ?? "0");
    const xcDayPic = num(r[20] ?? "0");
    const xcDayAug = num(r[21] ?? "0");
    const xcNightFo = num(r[22] ?? "0");
    const xcNightPic = num(r[23] ?? "0");
    const xcNightAug = num(r[24] ?? "0");
    const isXc =
      xcDayDual + xcDayPic + xcDayAug + xcNightFo + xcNightPic + xcNightAug > 0;

    const actualInst = num(r[25] ?? "0");
    const hoodInst = num(r[26] ?? "0");
    const simInst = num(r[27] ?? "0");
    const ifrApp = Math.round(num(r[28] ?? "0"));

    let category: Category;
    let role: Role;
    let dayTime = 0;
    let nightTime = 0;

    const seTotal = seDualDay + sePicDay + seDualNight + sePicNight;
    const meTotal =
      meDualDay + mePicDay + meFoDay + meAugDay +
      meDualNight + mePicNight + meFoNight + meAugNight;

    if (make.toLowerCase() === "sim" || meTotal + seTotal === 0) {
      category = "SIM";
      role = "DUAL";
    } else if (meTotal > 0 && meTotal >= seTotal) {
      category = "ME";
      const candidates: [Role, number, number][] = [
        ["DUAL", meDualDay, meDualNight],
        ["PIC", mePicDay, mePicNight],
        ["FO", meFoDay, meFoNight],
        ["SIC", meAugDay / 2, meAugNight / 2], // Legacy AUG → SIC (halved per source convention)
      ];
      let best = candidates[0];
      for (const c of candidates) if (c[1] + c[2] > best[1] + best[2]) best = c;
      role = best[0];
      dayTime = best[1];
      nightTime = best[2];
    } else {
      category = "SE";
      const candidates: [Role, number, number][] = [
        ["DUAL", seDualDay, seDualNight],
        ["PIC", sePicDay, sePicNight],
      ];
      let best = candidates[0];
      for (const c of candidates) if (c[1] + c[2] > best[1] + best[2]) best = c;
      role = best[0];
      dayTime = best[1];
      nightTime = best[2];
    }

    const isNight = nightTime > 0 && dayTime === 0;
    const isDay = dayTime > 0 && nightTime === 0;

    out.push({
      date,
      make_model: make,
      registration: reg,
      pic,
      copilot: cop,
      third_pilot: null,
      check_pilot: null,
      route,
      remarks,
      category,
      role,
      day_time: r1(dayTime),
      night_time: r1(nightTime),
      is_xcountry: isXc,
      actual_inst: r1(actualInst),
      hood_inst: r1(hoodInst),
      sim_inst: r1(simInst),
      ifr_approaches: ifrApp,
      takeoffs_day: category === "SIM" ? 0 : (isNight ? 0 : defaultTakeoffsLandings),
      takeoffs_night: category === "SIM" ? 0 : (isDay ? 0 : (nightTime > 0 ? defaultTakeoffsLandings : 0)),
      landings_day: category === "SIM" ? 0 : (isNight ? 0 : defaultTakeoffsLandings),
      landings_night: category === "SIM" ? 0 : (isDay ? 0 : (nightTime > 0 ? defaultTakeoffsLandings : 0)),
      // Migration 0009 fields — legacy Numbers format doesn't carry these.
      precision_approaches: 0, non_precision_approaches: 0, holds: 0, cfi_time: 0,
    });
  }

  return out;
}
