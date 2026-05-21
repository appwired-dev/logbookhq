/**
 * Multi-format pilot logbook CSV import.
 *
 * Handles exports from:
 *   - ForeFlight (two-section CSV: Aircraft Table + Flights Table)
 *   - LogTen Pro (flat table, `flight_*` prefixed columns)
 *   - MyFlightbook (flat table, human-readable column names)
 *   - Legacy Numbers-exported logbook (no header row, fixed column order)
 *
 * Common pipeline:
 *   1. parseCSV() splits text → rows[][] (handles quoted commas, multi-line cells)
 *   2. detectFormat() inspects header row to pick a parser
 *   3. The chosen parser walks rows + emits ParsedFlight[]
 *
 * Each format-specific parser does its own date/number normalisation since
 * conventions differ (MM/DD/YYYY vs YYYY-MM-DD vs "Sep 27, 2001", etc.).
 */
import { parseCSV, importCsvText, type ParsedFlight, type Category, type Role } from "./csv";

export type SourceFormat = "numbers" | "numbers-multihead" | "numbers-multihead-v2" | "foreflight" | "logten" | "myflightbook" | "logbookhq" | "unknown";

const r1 = (n: number) => Math.round(n * 10) / 10;
/**
 * Parse a numeric cell, handling US ("1.6", "1,234.56") and European /
 * Korean ("1,6", "0,9") decimal conventions. The disambiguation rule:
 * a SINGLE comma followed by 1-2 digits with no period is treated as a
 * decimal separator (e.g. "1,6" → 1.6, "10,75" → 10.75). Otherwise commas
 * are thousands separators and stripped (e.g. "1,234" → 1234).
 *
 * Pilot logbook cells are bounded (max ~24 hours per flight, max ~5-digit
 * career totals), so the regex never collides with realistic European
 * decimals having >2 trailing digits.
 */
const num = (v: string | undefined) => {
  const s = (v ?? "").trim();
  if (!s) return 0;
  // European/Korean decimal — comma instead of period.
  if (/^-?\d+,\d{1,2}$/.test(s)) {
    const n = parseFloat(s.replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }
  // US format — strip commas (thousands separators) and currency markers.
  const n = parseFloat(s.replace(/[,$]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

/**
 * Inspect a CSV's content and pick the parser. Returns "unknown" when no
 * known signature matches — caller can fall back to the legacy parser.
 */
export function detectFormat(text: string): SourceFormat {
  const head = text.slice(0, 4000).toLowerCase();
  if (head.includes("aircraft table") && head.includes("flights table")) return "foreflight";
  if (head.includes("flight_flightdate") || head.includes("flight_aircrafttype")) return "logten";
  if (head.includes("tail number") && head.includes("total flight time")) return "myflightbook";
  // Pilot Logbook HQ's own export — round-trip support so users can move data
  // between accounts/environments. Unique signature: `make_model` column +
  // ISO date header pattern.
  const firstLine = (text.split(/\r?\n/, 1)[0] ?? "").toLowerCase();
  if (firstLine.startsWith("date,") && firstLine.includes("make_model")) return "logbookhq";
  // Numbers spreadsheet with a 3-row hierarchical header (Apple Numbers
  // default export). Signature: header text mentions "Single Engine Aircraft"
  // + "Multi-Engine Aircraft" in the top rows, dates like "06-Jun-13" in
  // body rows.
  if (head.includes("single engine aircraft") && head.includes("multi-engine aircraft")) {
    return "numbers-multihead";
  }
  // V2 multi-header layout (Logan Kang's Korean Excel template). Signature:
  // "Personal Information" + "License No." preamble, "Single-Engine"
  // (hyphenated) and "Multi-Engine" hierarchical headers. M/D/YY dates.
  // The "Personal Information" cell sometimes wraps to two lines (literal
  // \n inside the cell), so allow any whitespace between the two words.
  if (/personal\s+information/.test(head) && head.includes("license no")
      && head.includes("single-engine") && head.includes("multi-engine")) {
    return "numbers-multihead-v2";
  }
  // Numbers format: no real header — first cell looks like "Sep 27, 2001"
  if (/^[A-Za-z]+\s+\d{1,2},\s+\d{4}/.test(firstLine)) return "numbers";
  return "unknown";
}

/**
 * Parse any supported CSV format. Returns flights ready to insert.
 * Throws when the format can't be identified.
 */
export function parseAnyLogbook(text: string): { format: SourceFormat; flights: ParsedFlight[] } {
  const format = detectFormat(text);
  switch (format) {
    case "numbers":              return { format, flights: importCsvText(text) };
    case "numbers-multihead":    return { format, flights: parseNumbersMultihead(text) };
    case "numbers-multihead-v2": return { format, flights: parseNumbersMultiheadV2(text) };
    case "foreflight":           return { format, flights: parseForeFlight(text) };
    case "logten":            return { format, flights: parseLogTen(text) };
    case "myflightbook":      return { format, flights: parseMyFlightbook(text) };
    case "logbookhq":         return { format, flights: parseLogbookHQ(text) };
    default:
      throw new Error("Unrecognised CSV format. Supported: Pilot Logbook HQ, ForeFlight, LogTen Pro, MyFlightbook, Numbers-exported.");
  }
}

// ============================================================
// Shared helpers
// ============================================================

/**
 * Parse a date in any of the common pilot-logbook formats:
 *   2024-09-27, 9/27/2024, 27/9/2024, "Sep 27, 2024".
 * Returns ISO YYYY-MM-DD or null.
 */
function parseAnyDate(s: string): string | null {
  const t = s.trim();
  if (!t) return null;
  const MONTHS: Record<string, string> = {
    jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
    jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
  };
  // ISO
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  // US M/D/YYYY
  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  // US M/D/YY (2-digit year). 00-50 → 2000s, 51-99 → 1900s. Same heuristic
  // as the DD-MMM-YY branch below.
  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (m) {
    const yyyy = (parseInt(m[3], 10) > 50 ? "19" : "20") + m[3];
    return `${yyyy}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  }
  // "Sep 27, 2024"
  m = t.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
  if (m) {
    const mm = MONTHS[m[1].slice(0, 3).toLowerCase()];
    if (mm) return `${m[3]}-${mm}-${m[2].padStart(2, "0")}`;
  }
  // "06-Jun-13" or "06-Jun-2013" (Numbers-multihead format).
  // Two-digit year heuristic: 00-50 → 2000s, 51-99 → 1900s. Pre-1951 pilot
  // logbooks would be edge-case rare; calibrate further if it ever matters.
  m = t.match(/^(\d{1,2})-([A-Za-z]+)-(\d{2,4})$/);
  if (m) {
    const mm = MONTHS[m[2].slice(0, 3).toLowerCase()];
    if (!mm) return null;
    let yyyy = m[3];
    if (yyyy.length === 2) yyyy = (parseInt(yyyy, 10) > 50 ? "19" : "20") + yyyy;
    return `${yyyy}-${mm}-${m[1].padStart(2, "0")}`;
  }
  return null;
}

/** Build a header → column-index map, normalising spaces and case. */
function headerIndex(headers: string[]): Map<string, number> {
  const map = new Map<string, number>();
  headers.forEach((h, i) => map.set(h.trim().toLowerCase(), i));
  return map;
}

/** Pull a single cell by header name, returning "" if missing. */
function cell(row: string[], headers: Map<string, number>, name: string): string {
  const i = headers.get(name.toLowerCase());
  return i == null ? "" : (row[i] ?? "");
}

/**
 * Given separate PIC/SIC/Dual/Solo time columns plus total time, derive a
 * single (role, category, dayTime, nightTime) tuple compatible with the
 * existing schema. Logic: pick the role with the most hours; split total
 * by night-time column where present.
 */
function deriveRoleAndCategory(opts: {
  total: number; pic: number; sic: number; dual: number; solo: number;
  night: number; aircraftMake: string;
}): { role: Role; category: Category; dayTime: number; nightTime: number } {
  const { total, pic, sic, dual, solo, night, aircraftMake } = opts;
  const isSim = /sim|aatd|ftd|simulator/i.test(aircraftMake);
  // Match common multi-engine type codes / names. No trailing \b because many
  // type codes have alphanumeric suffixes (DH8C, CRJ900, B737, etc.) that
  // would defeat a word-boundary check.
  const isMulti = /\b(king\s?air|seneca|baron|navajo|duchess|twin|multi[-\s]?engine|crj|dh[c]?8|dhc|atr|a3\d|a32|a33|a34|a35|a38|b7\d{2}|md\d|e\d{3}|ea\d{2}|cl65)/i.test(aircraftMake);

  // Pick the role with the most hours.
  const buckets: [Role, number][] = [
    ["PIC", pic], ["SIC", sic], ["DUAL", dual + solo /* solo counts as dual-equivalent */],
  ];
  let best = buckets[0];
  for (const b of buckets) if (b[1] > best[1]) best = b;
  const role: Role = best[1] > 0 ? best[0] : "PIC";

  // Day = total minus night when night<=total, else just total.
  const nightTime = Math.min(night, total);
  const dayTime = Math.max(0, total - nightTime);

  const category: Category = isSim ? "SIM" : (isMulti ? "ME" : "SE");
  return { role, category, dayTime, nightTime };
}

// ============================================================
// ForeFlight parser
// ============================================================

/**
 * ForeFlight exports two stacked sections inside one CSV:
 *   "Aircraft Table"  — one row per aircraft (registration → type)
 *   "Flights Table"   — one row per flight, references aircraft by ID
 *
 * We build a registration → make_model map from the first section, then
 * parse the flight rows.
 */
function parseForeFlight(text: string): ParsedFlight[] {
  const rows = parseCSV(text);
  const out: ParsedFlight[] = [];

  // Find the two section header rows.
  let aircraftStart = -1, flightsStart = -1;
  rows.forEach((r, i) => {
    const j = (r[0] ?? "").toLowerCase().trim();
    if (j === "aircraft table") aircraftStart = i;
    if (j === "flights table") flightsStart = i;
  });
  if (flightsStart < 0) return out;

  // Build aircraft registration → type map.
  const aircraftTypeByReg = new Map<string, string>();
  if (aircraftStart >= 0) {
    const acHeaders = headerIndex(rows[aircraftStart + 1] ?? []);
    for (let i = aircraftStart + 2; i < (flightsStart > 0 ? flightsStart : rows.length); i++) {
      const r = rows[i];
      if (!r || r.length < 2) continue;
      const reg = cell(r, acHeaders, "aircraftid").trim();
      const type = cell(r, acHeaders, "typecode").trim() || cell(r, acHeaders, "model").trim();
      if (reg && type) aircraftTypeByReg.set(reg.toUpperCase(), type);
    }
  }

  // Parse flights.
  const flightHeaders = headerIndex(rows[flightsStart + 1] ?? []);
  for (let i = flightsStart + 2; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length < 3) continue;
    const date = parseAnyDate(cell(r, flightHeaders, "date"));
    if (!date) continue;

    const reg = cell(r, flightHeaders, "aircraftid").trim();
    const make = aircraftTypeByReg.get(reg.toUpperCase()) || reg || "Unknown";
    const route = [cell(r, flightHeaders, "from"), cell(r, flightHeaders, "to")]
      .filter(Boolean).join("-") || cell(r, flightHeaders, "route") || null;

    const total = num(cell(r, flightHeaders, "totaltime"));
    const pic = num(cell(r, flightHeaders, "pic"));
    const sic = num(cell(r, flightHeaders, "sic"));
    const solo = num(cell(r, flightHeaders, "solo"));
    const dualR = num(cell(r, flightHeaders, "dualreceived"));
    const night = num(cell(r, flightHeaders, "night"));
    const xc = num(cell(r, flightHeaders, "crosscountry"));
    const actualInst = num(cell(r, flightHeaders, "actualinstrument"));
    const simInst = num(cell(r, flightHeaders, "simulatedinstrument"));
    const ifrApp = Math.round(
      [1, 2, 3, 4, 5, 6].reduce((s, n) => s + (cell(r, flightHeaders, `approach${n}`) ? 1 : 0), 0)
    );

    const dayT = Math.round(num(cell(r, flightHeaders, "daytakeoffs")));
    const dayL = Math.round(num(cell(r, flightHeaders, "daylandingsfullstop")));
    const nightT = Math.round(num(cell(r, flightHeaders, "nighttakeoffs")));
    const nightL = Math.round(num(cell(r, flightHeaders, "nightlandingsfullstop")));

    const { role, category, dayTime, nightTime } = deriveRoleAndCategory({
      total, pic, sic, dual: dualR, solo, night, aircraftMake: make,
    });

    out.push({
      date,
      make_model: make,
      registration: reg || null,
      pic: null, copilot: null, third_pilot: null, check_pilot: null,
      route,
      remarks: cell(r, flightHeaders, "pilotcomments").trim() || null,
      category, role,
      day_time: r1(dayTime), night_time: r1(nightTime),
      is_xcountry: xc > 0,
      actual_inst: r1(actualInst), hood_inst: 0, sim_inst: r1(simInst),
      ifr_approaches: ifrApp,
      takeoffs_day: dayT, takeoffs_night: nightT,
      landings_day: dayL, landings_night: nightL,
      // Migration 0009 fields — source format doesn't carry these, default to 0.
      precision_approaches: 0, non_precision_approaches: 0, holds: 0, cfi_time: 0,
    });
  }
  return out;
}

// ============================================================
// LogTen Pro parser
// ============================================================

/**
 * LogTen exports a flat table with all columns prefixed `flight_`.
 * Single header row, one flight per row.
 */
function parseLogTen(text: string): ParsedFlight[] {
  const rows = parseCSV(text);
  if (rows.length < 2) return [];
  const headers = headerIndex(rows[0]);
  const out: ParsedFlight[] = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    const date = parseAnyDate(cell(r, headers, "flight_flightdate"));
    if (!date) continue;

    const reg = cell(r, headers, "flight_aircraftregistration").trim();
    const make = cell(r, headers, "flight_aircrafttype").trim() || reg || "Unknown";
    const route = [
      cell(r, headers, "flight_actualdeparture"),
      cell(r, headers, "flight_actualdestination"),
    ].filter(Boolean).join("-") || cell(r, headers, "flight_route") || null;

    const total = num(cell(r, headers, "flight_totaltime"));
    const pic = num(cell(r, headers, "flight_pic"));
    const sic = num(cell(r, headers, "flight_sic"));
    const dual = num(cell(r, headers, "flight_dual"));
    const solo = num(cell(r, headers, "flight_solo"));
    const night = num(cell(r, headers, "flight_night"));
    const xc = num(cell(r, headers, "flight_crosscountry"));
    const actualInst = num(cell(r, headers, "flight_actualinstrument"));
    const simInst = num(cell(r, headers, "flight_simulatedinstrument"));

    const { role, category, dayTime, nightTime } = deriveRoleAndCategory({
      total, pic, sic, dual, solo, night, aircraftMake: make,
    });

    out.push({
      date,
      make_model: make,
      registration: reg || null,
      pic: null, copilot: null, third_pilot: null, check_pilot: null,
      route,
      remarks: cell(r, headers, "flight_remarks").trim() || null,
      category, role,
      day_time: r1(dayTime), night_time: r1(nightTime),
      is_xcountry: xc > 0,
      actual_inst: r1(actualInst), hood_inst: 0, sim_inst: r1(simInst),
      ifr_approaches: 0,
      takeoffs_day: Math.round(num(cell(r, headers, "flight_daytakeoffs"))),
      takeoffs_night: Math.round(num(cell(r, headers, "flight_nighttakeoffs"))),
      landings_day: Math.round(num(cell(r, headers, "flight_daylandings"))),
      landings_night: Math.round(num(cell(r, headers, "flight_nightlandings"))),
      // Migration 0009 fields — source format doesn't carry these, default to 0.
      precision_approaches: 0, non_precision_approaches: 0, holds: 0,
      cfi_time: 0,
    });
  }
  return out;
}

// ============================================================
// MyFlightbook parser
// ============================================================

/**
 * MyFlightbook uses human-readable column names. Flat table.
 */
function parseMyFlightbook(text: string): ParsedFlight[] {
  const rows = parseCSV(text);
  if (rows.length < 2) return [];
  const headers = headerIndex(rows[0]);
  const out: ParsedFlight[] = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    const date = parseAnyDate(cell(r, headers, "date"));
    if (!date) continue;

    const reg = cell(r, headers, "tail number").trim();
    const make = cell(r, headers, "aircraft").trim() || reg || "Unknown";
    const route = cell(r, headers, "route").trim() || null;

    const total = num(cell(r, headers, "total flight time"));
    const pic = num(cell(r, headers, "pic"));
    const sic = num(cell(r, headers, "sic"));
    const dual = num(cell(r, headers, "dual"));   // MyFB sometimes calls this "Dual"
    const solo = num(cell(r, headers, "cfi"));    // Treat CFI-given as dual-given equivalent
    const night = num(cell(r, headers, "night"));
    const xc = num(cell(r, headers, "cross-country"));
    const actualInst = num(cell(r, headers, "imc"));
    const simInst = num(cell(r, headers, "sim instrument"));
    const approaches = Math.round(num(cell(r, headers, "approaches")));

    const { role, category, dayTime, nightTime } = deriveRoleAndCategory({
      total, pic, sic, dual, solo, night, aircraftMake: make,
    });

    const landings = Math.round(num(cell(r, headers, "landings")));
    const nightLandings = Math.round(num(cell(r, headers, "night landings")));
    const dayLandings = Math.max(0, landings - nightLandings);

    out.push({
      date,
      make_model: make,
      registration: reg || null,
      pic: null, copilot: null, third_pilot: null, check_pilot: null,
      route,
      remarks: cell(r, headers, "comments/remarks").trim() || cell(r, headers, "remarks").trim() || null,
      category, role,
      day_time: r1(dayTime), night_time: r1(nightTime),
      is_xcountry: xc > 0,
      actual_inst: r1(actualInst), hood_inst: 0, sim_inst: r1(simInst),
      ifr_approaches: approaches,
      takeoffs_day: dayLandings, // MyFB doesn't track takeoffs separately
      takeoffs_night: nightLandings,
      landings_day: dayLandings,
      landings_night: nightLandings,
      // Migration 0009 fields — MyFlightbook tracks holds + CFI; precision split unavailable.
      precision_approaches: 0, non_precision_approaches: 0,
      holds: Math.round(num(cell(r, headers, "holds"))),
      cfi_time: r1(num(cell(r, headers, "cfi"))),
    });
  }
  return out;
}

// ============================================================
// Numbers (multi-header) parser — Apple Numbers exports
// ============================================================

/**
 * Parses Apple Numbers exports that have a 3-row hierarchical header
 * (top-level categories, sub-headers, column names) and dates in
 * "06-Jun-13" format. This is the layout most legacy hand-maintained
 * pilot logbooks use when exported from Numbers.
 *
 * Column expectations (1-indexed, matches the user's header row 3):
 *   1 Date  2 Make/Model  3 Reg  4 PIC  5 Co-pilot  6 Route  7 Remarks
 *   8 SE Day Dual  9 SE Day PIC  10 SE Night Dual  11 SE Night PIC
 *   12 ME Day Dual  13 ME Day PIC  14 ME Day Co-Pilot
 *   15 ME Night Dual  16 ME Night PIC  17 ME Night Co-Pilot
 *   18 XC Day Dual  19 XC Day PIC  20 XC Night Dual  21 XC Night PIC
 *   22 Actual Inst  23 Hood  24 Sim  25 #IFR Appchs
 *
 * Rows that don't have a parseable date in col 0 are skipped — that's the
 * header rows automatically. Empty cells default to 0/null.
 */
function parseNumbersMultihead(text: string): ParsedFlight[] {
  const rows = parseCSV(text);
  const out: ParsedFlight[] = [];

  for (const r of rows) {
    if (r.length < 8) continue;
    const date = parseAnyDate(r[0] ?? "");
    if (!date) continue; // skips the 3 header rows

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
    const meDualNight = num(r[14]);
    const mePicNight = num(r[15]);
    const meFoNight = num(r[16]);

    const xcDayDual = num(r[17]);
    const xcDayPic = num(r[18]);
    const xcNightDual = num(r[19]);
    const xcNightPic = num(r[20]);
    const isXc = xcDayDual + xcDayPic + xcNightDual + xcNightPic > 0;

    const actualInst = num(r[21]);
    const hoodInst = num(r[22]);
    const simInst = num(r[23]);
    const ifrApp = Math.round(num(r[24]));

    // Pick category + role from the heaviest time bucket on this row.
    const seTotal = seDualDay + sePicDay + seDualNight + sePicNight;
    const meTotal = meDualDay + mePicDay + meFoDay + meDualNight + mePicNight + meFoNight;

    let category: Category;
    let role: Role;
    let dayTime = 0;
    let nightTime = 0;

    if (/^sim$|^ftd$|sim|alsim/i.test(make) || seTotal + meTotal === 0) {
      category = "SIM";
      role = "DUAL";
      // Sim sessions don't count as flight time — see V2 parser for the
      // rationale. Duration lives only in sim_inst.
      dayTime = 0;
      nightTime = 0;
    } else if (meTotal > 0 && meTotal >= seTotal) {
      category = "ME";
      const candidates: [Role, number, number][] = [
        ["DUAL", meDualDay, meDualNight],
        ["PIC",  mePicDay,  mePicNight],
        ["FO",   meFoDay,   meFoNight],
      ];
      const best = candidates.reduce((a, b) => (b[1] + b[2] > a[1] + a[2] ? b : a));
      role = best[0]; dayTime = best[1]; nightTime = best[2];
    } else {
      category = "SE";
      const candidates: [Role, number, number][] = [
        ["DUAL", seDualDay, seDualNight],
        ["PIC",  sePicDay,  sePicNight],
      ];
      const best = candidates.reduce((a, b) => (b[1] + b[2] > a[1] + a[2] ? b : a));
      role = best[0]; dayTime = best[1]; nightTime = best[2];
    }

    const isNight = nightTime > 0 && dayTime === 0;
    const isDay = dayTime > 0 && nightTime === 0;
    const tolDefault = category === "SIM" ? 0 : 1;

    out.push({
      date,
      make_model: make,
      registration: reg,
      pic, copilot: cop,
      third_pilot: null, check_pilot: null,
      route, remarks,
      category, role,
      day_time: r1(dayTime), night_time: r1(nightTime),
      is_xcountry: isXc,
      actual_inst: r1(actualInst),
      hood_inst: r1(hoodInst),
      sim_inst: r1(simInst),
      ifr_approaches: ifrApp,
      precision_approaches: 0, non_precision_approaches: 0, holds: 0, cfi_time: 0,
      takeoffs_day: category === "SIM" ? 0 : (isNight ? 0 : tolDefault),
      takeoffs_night: category === "SIM" ? 0 : (isDay ? 0 : (nightTime > 0 ? tolDefault : 0)),
      landings_day: category === "SIM" ? 0 : (isNight ? 0 : tolDefault),
      landings_night: category === "SIM" ? 0 : (isDay ? 0 : (nightTime > 0 ? tolDefault : 0)),
    });
  }

  return out;
}

// ============================================================
// Numbers (multi-header V2) parser — Logan-style Excel template
// ============================================================

/**
 * Variant of the multi-header Numbers/Excel layout with a 5-row personal info
 * preamble (Name, Address, Phone, Email, License No.) and slightly different
 * column order from V1 (Remark before Route; aircraft Type + Registration
 * split into separate cols).
 *
 * Column expectations after the preamble (0-indexed):
 *   0 Date  1 Type  2 Reg  3 PIC  4 Co-Pilot/Student  5 Remark  6 Route  7 (blank)
 *   8 SE Day Dual  9 SE Day PIC  10 SE Night Dual  11 SE Night PIC
 *   12-13 (SE subtotals — skipped, we recompute)
 *   14 XC Dual  15 XC PIC
 *   16 ME Day Dual  17 ME Day PIC  18 ME Night Dual  19 ME Night PIC
 *   20 IMC (actual inst)  21 Hood  22 FTD (sim)  23 IFR Approaches
 *
 * Header rows are skipped automatically — anything with an unparseable date
 * in col 0 is ignored.
 */
function parseNumbersMultiheadV2(text: string): ParsedFlight[] {
  const rows = parseCSV(text);
  const out: ParsedFlight[] = [];

  for (const r of rows) {
    if (r.length < 8) continue;
    const date = parseAnyDate(r[0] ?? "");
    if (!date) continue;

    const make = (r[1] ?? "").trim();
    if (!make) continue;

    const reg = (r[2] ?? "").trim() || null;
    const pic = (r[3] ?? "").trim() || null;
    const cop = (r[4] ?? "").trim() || null;
    const remarks = (r[5] ?? "").trim() || null;
    const route = (r[6] ?? "").trim() || null;
    // r[7] is a visual separator column, skip.

    const seDualDay = num(r[8]);
    const sePicDay = num(r[9]);
    const seDualNight = num(r[10]);
    const sePicNight = num(r[11]);
    // r[12], r[13] are SE subtotals from the spreadsheet — ignore, we recompute.

    const xcDual = num(r[14]);
    const xcPic = num(r[15]);
    const isXc = xcDual + xcPic > 0;

    const meDualDay = num(r[16]);
    const mePicDay = num(r[17]);
    const meDualNight = num(r[18]);
    const mePicNight = num(r[19]);

    const actualInst = num(r[20]); // IMC
    const hoodInst = num(r[21]);
    const simInst = num(r[22]);    // FTD
    const ifrApp = Math.round(num(r[23]));

    const seTotal = seDualDay + sePicDay + seDualNight + sePicNight;
    const meTotal = meDualDay + mePicDay + meDualNight + mePicNight;

    let category: Category;
    let role: Role;
    let dayTime = 0;
    let nightTime = 0;

    if (/^sim$|^ftd$|sim|alsim/i.test(make) || seTotal + meTotal === 0) {
      category = "SIM";
      role = "DUAL";
      // Sim sessions don't count as flight time — duration lives only in
      // sim_inst, never in day_time/night_time. Matches FAA/TCCA convention
      // where sim time is currency-eligible but never logged as hours.
      dayTime = 0;
      nightTime = 0;
    } else if (meTotal > 0 && meTotal >= seTotal) {
      category = "ME";
      const candidates: [Role, number, number][] = [
        ["DUAL", meDualDay, meDualNight],
        ["PIC",  mePicDay,  mePicNight],
      ];
      const best = candidates.reduce((a, b) => (b[1] + b[2] > a[1] + a[2] ? b : a));
      role = best[0]; dayTime = best[1]; nightTime = best[2];
    } else {
      category = "SE";
      const candidates: [Role, number, number][] = [
        ["DUAL", seDualDay, seDualNight],
        ["PIC",  sePicDay,  sePicNight],
      ];
      const best = candidates.reduce((a, b) => (b[1] + b[2] > a[1] + a[2] ? b : a));
      role = best[0]; dayTime = best[1]; nightTime = best[2];
    }

    const isNight = nightTime > 0 && dayTime === 0;
    const isDay = dayTime > 0 && nightTime === 0;
    const tolDefault = category === "SIM" ? 0 : 1;

    out.push({
      date,
      make_model: make,
      registration: reg,
      pic, copilot: cop,
      third_pilot: null, check_pilot: null,
      route, remarks,
      category, role,
      day_time: r1(dayTime), night_time: r1(nightTime),
      is_xcountry: isXc,
      actual_inst: r1(actualInst),
      hood_inst: r1(hoodInst),
      sim_inst: r1(simInst),
      ifr_approaches: ifrApp,
      precision_approaches: 0, non_precision_approaches: 0, holds: 0, cfi_time: 0,
      takeoffs_day: category === "SIM" ? 0 : (isNight ? 0 : tolDefault),
      takeoffs_night: category === "SIM" ? 0 : (isDay ? 0 : (nightTime > 0 ? tolDefault : 0)),
      landings_day: category === "SIM" ? 0 : (isNight ? 0 : tolDefault),
      landings_night: category === "SIM" ? 0 : (isDay ? 0 : (nightTime > 0 ? tolDefault : 0)),
    });
  }

  return out;
}

// ============================================================
// Pilot Logbook HQ parser (round-trip support for our own export)
// ============================================================

/**
 * Parses CSV produced by our own `exportFlightsCsv()`. Schema is 1:1 with
 * the database, so no field derivation — every column maps directly to a
 * ParsedFlight field. This is the canonical "lossless" import path for
 * migrating between accounts/environments.
 */
function parseLogbookHQ(text: string): ParsedFlight[] {
  const rows = parseCSV(text);
  if (rows.length < 2) return [];
  const headers = headerIndex(rows[0]);
  const out: ParsedFlight[] = [];

  const bool = (v: string) => v === "true" || v === "1" || v.toLowerCase() === "yes";
  const orNull = (v: string) => (v.trim() ? v.trim() : null);

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    const date = parseAnyDate(cell(r, headers, "date"));
    if (!date) continue;

    const rawCategory = cell(r, headers, "category").toUpperCase();
    const rawRole = cell(r, headers, "role").toUpperCase();

    // Defend against unknown values from a hand-edited CSV by falling back to
    // sensible defaults rather than crashing the whole import.
    const category: Category = (["SE", "ME", "SES", "MES", "HELI", "SIM"].includes(rawCategory) ? rawCategory : "SE") as Category;

    // Map common synonyms to the canonical Role enum. FO and SIC are kept
    // distinct (the schema distinguishes airline first-officer time from
    // generic second-in-command). SOLO collapses to DUAL since the schema
    // doesn't carry a separate SOLO bucket. Unknown values default to PIC.
    const ROLE_ALIAS: Record<string, Role> = {
      PIC: "PIC", P1: "PIC", CAPT: "PIC", CAPTAIN: "PIC",
      FO: "FO", "F.O.": "FO", "F/O": "FO", P2: "FO", FIRSTOFFICER: "FO", "FIRST OFFICER": "FO",
      SIC: "SIC",
      DUAL: "DUAL", INSTRUCTION: "DUAL", TRAINING: "DUAL", SOLO: "DUAL",
      CHECK: "CHECK", CHECKRIDE: "CHECK", "CHECK RIDE": "CHECK",
    };
    const role: Role = ROLE_ALIAS[rawRole] ?? "PIC";

    out.push({
      date,
      make_model: cell(r, headers, "make_model").trim() || "Unknown",
      registration: orNull(cell(r, headers, "registration")),
      pic: orNull(cell(r, headers, "pic")),
      copilot: orNull(cell(r, headers, "copilot")),
      third_pilot: orNull(cell(r, headers, "third_pilot")),
      check_pilot: orNull(cell(r, headers, "check_pilot")),
      route: orNull(cell(r, headers, "route")),
      remarks: orNull(cell(r, headers, "remarks")),
      category,
      role,
      day_time: r1(num(cell(r, headers, "day_time"))),
      night_time: r1(num(cell(r, headers, "night_time"))),
      is_xcountry: bool(cell(r, headers, "is_xcountry")),
      actual_inst: r1(num(cell(r, headers, "actual_inst"))),
      hood_inst: r1(num(cell(r, headers, "hood_inst"))),
      sim_inst: r1(num(cell(r, headers, "sim_inst"))),
      ifr_approaches: Math.round(num(cell(r, headers, "ifr_approaches"))),
      // Migration 0009 fields — default to 0 when the column is missing
      // (back-compat for older exports made before the schema expansion).
      precision_approaches: Math.round(num(cell(r, headers, "precision_approaches"))),
      non_precision_approaches: Math.round(num(cell(r, headers, "non_precision_approaches"))),
      holds: Math.round(num(cell(r, headers, "holds"))),
      cfi_time: r1(num(cell(r, headers, "cfi_time"))),
      takeoffs_day: Math.round(num(cell(r, headers, "takeoffs_day"))),
      takeoffs_night: Math.round(num(cell(r, headers, "takeoffs_night"))),
      landings_day: Math.round(num(cell(r, headers, "landings_day"))),
      landings_night: Math.round(num(cell(r, headers, "landings_night"))),
    });
  }
  return out;
}
