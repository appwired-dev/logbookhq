/**
 * Header fingerprints + system templates.
 *
 * fingerprint(): SHA-1 of the normalised header paths (trim, lowercase,
 * collapse whitespace, strip punctuation, drop empty segments and empty
 * columns). Column *positions* are deliberately not part of it — a template
 * is applied by matching header paths, so a stray blank leading column or a
 * reordered sheet still gets its saved mapping.
 */
import type { ColumnAssignment, ColumnMapping, HeaderPath, ImportTemplate } from "./types";
import { parseTargetKey } from "./targets"; // not "./mapping": mapping imports this module, and SYSTEM_TEMPLATES is built at load time
import { normaliseHeader, sha1Hex } from "./util";

export function normalisePath(path: string[]): string[] {
  return path.map((s) => normaliseHeader(s)).filter((s) => s.length > 0);
}

export function pathKey(path: string[]): string {
  return normalisePath(path).join(" > ");
}

export function fingerprint(headerPaths: string[][]): string {
  const canonical = headerPaths.map(pathKey).filter((k) => k.length > 0).join(" | ");
  return sha1Hex(canonical);
}

/** Apply a template to the current header by path (first unused match wins). */
export function templateAssignments(template: ImportTemplate, paths: HeaderPath[]): ColumnAssignment[] {
  const pool = new Map<string, number[]>();
  template.headerPaths.forEach((p, i) => {
    const k = pathKey(p);
    if (!k) return;
    const list = pool.get(k) ?? [];
    list.push(i);
    pool.set(k, list);
  });
  const byIndex = new Map<number, ColumnAssignment>();
  for (const a of template.mapping.columns) byIndex.set(a.col, a);

  const out: ColumnAssignment[] = [];
  for (const p of paths) {
    const k = pathKey(p.path);
    if (!k) continue;
    const list = pool.get(k);
    if (!list || list.length === 0) continue;
    const idx = list.shift() as number;
    const src = byIndex.get(idx);
    if (!src) continue;
    out.push({ col: p.col, target: src.target, confidence: 1, source: "template", reason: `template "${template.name}"` });
  }
  return out;
}

// ---------------------------------------------------------------------------
// System templates
// ---------------------------------------------------------------------------

type Spec = [path: string | string[], key: string];

function makeTemplate(id: string, name: string, spec: Spec[], conventions: ColumnMapping["conventions"] = {}): ImportTemplate {
  const headerPaths = spec.map(([p]) => (Array.isArray(p) ? p : [p]));
  const columns: ColumnAssignment[] = spec.map(([, key], col) => ({ col, target: parseTargetKey(key), confidence: 1, source: "template" }));
  return { id, fingerprint: fingerprint(headerPaths), name, source: "system", mapping: { columns, conventions }, headerPaths, uses: 0 };
}

const FOREFLIGHT: Spec[] = [
  ["Date", "field:date"], ["AircraftID", "field:registration"], ["From", "field:from"], ["To", "field:to"], ["Route", "field:route"],
  ["TimeOut", "field:block_off"], ["TimeOff", "ignore"], ["TimeOn", "ignore"], ["TimeIn", "field:block_on"], ["OnDuty", "ignore"], ["OffDuty", "ignore"],
  ["TotalTime", "field:total_time"], ["PIC", "time:any:any:pic"], ["SIC", "time:any:any:sic"], ["Night", "time:any:night:any"], ["Solo", "time:any:any:solo"],
  ["CrossCountry", "field:xc_time"], ["NVG", "ignore"], ["NVGOps", "ignore"], ["Distance", "ignore"],
  ["DayTakeoffs", "field:takeoffs_day"], ["DayLandingsFullStop", "field:landings_day"], ["NightTakeoffs", "field:takeoffs_night"], ["NightLandingsFullStop", "field:landings_night"], ["AllLandings", "ignore"],
  ["ActualInstrument", "field:actual_inst"], ["SimulatedInstrument", "field:hood_inst"], ["HobbsStart", "ignore"], ["HobbsEnd", "ignore"], ["TachStart", "ignore"], ["TachEnd", "ignore"],
  ["Holds", "field:holds"], ["Approach1", "field:ifr_approaches"], ["Approach2", "field:ifr_approaches"], ["Approach3", "field:ifr_approaches"], ["Approach4", "field:ifr_approaches"], ["Approach5", "field:ifr_approaches"], ["Approach6", "field:ifr_approaches"],
  ["DualGiven", "field:cfi_time"], ["DualReceived", "time:any:any:dual"], ["SimulatedFlight", "field:sim_inst"], ["GroundTraining", "ignore"],
  ["InstructorName", "field:pic"], ["InstructorComments", "ignore"],
  ["Person1", "ignore"], ["Person2", "ignore"], ["Person3", "ignore"], ["Person4", "ignore"], ["Person5", "ignore"], ["Person6", "ignore"],
  ["FlightReview", "ignore"], ["Checkride", "ignore"], ["IPC", "ignore"], ["NVGProficiency", "ignore"], ["FAA6158", "ignore"],
  ["PilotComments", "field:remarks"],
];

const LOGTEN: Spec[] = [
  ["flight_flightDate", "field:date"], ["flight_aircraftType", "field:make_model"], ["flight_aircraftRegistration", "field:registration"],
  ["flight_actualDeparture", "field:from"], ["flight_actualDestination", "field:to"], ["flight_route", "field:route"],
  ["flight_totalTime", "field:total_time"], ["flight_pic", "time:any:any:pic"], ["flight_sic", "time:any:any:sic"], ["flight_dual", "time:any:any:dual"],
  ["flight_solo", "time:any:any:solo"], ["flight_night", "time:any:night:any"], ["flight_crossCountry", "field:xc_time"],
  ["flight_actualInstrument", "field:actual_inst"], ["flight_simulatedInstrument", "field:hood_inst"],
  ["flight_dayTakeoffs", "field:takeoffs_day"], ["flight_dayLandings", "field:landings_day"], ["flight_nightTakeoffs", "field:takeoffs_night"], ["flight_nightLandings", "field:landings_night"],
  ["flight_remarks", "field:remarks"],
];

const MYFLIGHTBOOK: Spec[] = [
  ["Date", "field:date"], ["Tail Number", "field:registration"], ["Aircraft", "field:make_model"], ["Route", "field:route"],
  ["Total Flight Time", "field:total_time"], ["Approaches", "field:ifr_approaches"], ["PIC", "time:any:any:pic"], ["SIC", "time:any:any:sic"],
  ["CFI", "field:cfi_time"], ["Dual", "time:any:any:dual"], ["Cross-Country", "field:xc_time"], ["Night", "time:any:night:any"],
  ["IMC", "field:actual_inst"], ["Sim Instrument", "field:hood_inst"], ["Landings", "field:landings_day"], ["Night Landings", "field:landings_night"],
  ["Holds", "field:holds"], ["Comments/Remarks", "field:remarks"],
];

/** Mirrors lib/csv-export.ts HEADERS (round-trip of our own export). */
const LOGBOOKHQ: Spec[] = [
  ["date", "field:date"], ["make_model", "field:make_model"], ["registration", "field:registration"],
  ["pic", "field:pic"], ["copilot", "field:copilot"], ["third_pilot", "field:third_pilot"], ["check_pilot", "field:check_pilot"],
  ["route", "field:route"], ["remarks", "field:remarks"], ["category", "field:category"], ["role", "field:role"],
  ["day_time", "time:any:day:any"], ["night_time", "time:any:night:any"], ["is_xcountry", "field:xc_flag"],
  ["actual_inst", "field:actual_inst"], ["hood_inst", "field:hood_inst"], ["sim_inst", "field:sim_inst"], ["ifr_approaches", "field:ifr_approaches"],
  ["takeoffs_day", "field:takeoffs_day"], ["takeoffs_night", "field:takeoffs_night"], ["landings_day", "field:landings_day"], ["landings_night", "field:landings_night"],
  ["duty_time", "ignore"],
  ["precision_approaches", "field:precision_approaches"], ["non_precision_approaches", "field:non_precision_approaches"], ["holds", "field:holds"],
  ["cfi_time", "field:cfi_time"],
];

const SE = "Single Engine Aircraft", ME = "Multi-Engine Aircraft", XC = "Cross Country", INST = "Instrument";
/**
 * The founder's Apple Numbers layout (3 header rows) — see
 * lib/import-formats.ts parseNumbersMultihead. Header paths are the ones the
 * real Numbers → Excel export produces (fingerprint 3bf044c6…): the "Aircraft"
 * group spans Make/Model and a sub-header-less registration column, "AUG." is
 * written with its period, and "Total" stands alone in the top header row.
 */
const NUMBERS_MULTIHEAD: Spec[] = [
  ["Date (d/m/y)", "field:date"], [["Aircraft", "Make/Model"], "field:make_model"], ["Aircraft", "field:registration"],
  ["Pilot in Command", "field:pic"], ["Co-Pilot", "field:copilot"], ["Route", "field:route"], ["Remarks", "field:remarks"],
  [[SE, "Day", "Dual"], "time:se:day:dual"], [[SE, "Day", "PIC"], "time:se:day:pic"], [[SE, "Night", "Dual"], "time:se:night:dual"], [[SE, "Night", "PIC"], "time:se:night:pic"],
  [[ME, "Day", "Dual"], "time:me:day:dual"], [[ME, "Day", "PIC"], "time:me:day:pic"], [[ME, "Day", "FO"], "time:me:day:fo"], [[ME, "Day", "AUG."], "time:me:day:sic"],
  [[ME, "Night", "Dual"], "time:me:night:dual"], [[ME, "Night", "PIC"], "time:me:night:pic"], [[ME, "Night", "FO"], "time:me:night:fo"], [[ME, "Night", "AUG."], "time:me:night:sic"],
  [[XC, "Day", "FO"], "field:xc_time"], [[XC, "Day", "PIC"], "field:xc_time"], [[XC, "Day", "AUG."], "field:xc_time"],
  [[XC, "Night", "FO"], "field:xc_time"], [[XC, "Night", "PIC"], "field:xc_time"], [[XC, "Night", "AUG."], "field:xc_time"],
  [[INST, "Actual"], "field:actual_inst"], [[INST, "Hood"], "field:hood_inst"], [[INST, "Sim"], "field:sim_inst"], [[INST, "#IFR Appchs"], "field:ifr_approaches"],
  ["Total", "field:total_time"],
];

export const SYSTEM_TEMPLATES: ImportTemplate[] = [
  makeTemplate("system:foreflight", "ForeFlight", FOREFLIGHT),
  makeTemplate("system:logten", "LogTen Pro", LOGTEN),
  makeTemplate("system:myflightbook", "MyFlightbook", MYFLIGHTBOOK),
  makeTemplate("system:logbookhq", "LogbookHQ export", LOGBOOKHQ),
  makeTemplate("system:numbers-multihead", "Apple Numbers logbook (3-row header)", NUMBERS_MULTIHEAD, { blankAircraftIsSim: true }),
];
